/**
 * Port of web hooks/useRestaurantNotifications.js + context/RestaurantNotificationContext.jsx.
 * One provider for the whole app (web mounted it once in RestaurantLayout):
 * - Socket.IO (join-restaurant room) for new_order / order_status_update / pickup_otp_reveal / notifications
 * - REST polling every 8 s as reliability fallback (same filters as web)
 * - ring sound (restaurant_order_ring.wav) + vibration, repeated every 6 s for max 2 min while an order waits
 * - order queue (head = `newOrder`), cancelled-id tracking, pickup OTP reveal persisted in storage
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Vibration } from "react-native";
import io from "socket.io-client";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { SOCKET_BASE_URL } from "../config";
import { restaurantAPI } from "../api";
import { getModuleToken, isModuleAuthenticated } from "../auth/session";
import { addAppListener, dispatchAppEvent } from "../utils/events";
import { dispatchNotificationInboxRefresh } from "../hooks/useNotificationInbox";
import { localStore } from "../utils/storage";
import { toast } from "../utils/toast";

const ringSound = require("../../assets/audio/restaurant_order_ring.wav");

export const RestaurantNotificationContext = createContext(null);

const ALERT_POLL_MS = 8000;
const ALERT_LOOP_INTERVAL_MS = 6000;
const ALERT_LOOP_MAX_MS = 120000;
const ALERT_DEDUPE_MS = 15000;
const VIBRATE_PATTERN = [0, 200, 100, 200, 100, 300];
const OTP_KEY = "restaurant_pickupOtpReveal";

const getOrderAlertKey = (o = {}) => String(o?.orderMongoId || o?.order_mongo_id || o?.orderId || o?.order_id || o?._id || o?.id || "").trim();
const normStatus = (v) => String(v || "").toLowerCase().trim().replace(/\s+/g, "_");
const isCancelled = (v) => ["cancelled_by_user", "cancelled_by_restaurant", "cancelled_by_admin", "cancelled"].includes(normStatus(v));

export function RestaurantNotificationProvider({ children }) {
  const [authed, setAuthed] = useState(() => isModuleAuthenticated());
  const [restaurantId, setRestaurantId] = useState(null);
  const [orderQueue, setOrderQueue] = useState([]);
  const [newReservation, setNewReservation] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [pickupOtpReveal, setPickupOtpRevealState] = useState(() => {
    try {
      const saved = localStore.getItem(OTP_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const socketRef = useRef(null);
  const playerRef = useRef(null);
  const activeOrderRef = useRef(null);
  const alertLoopTimerRef = useRef(null);
  const alertLoopStartedAtRef = useRef(0);
  const lastAlertAtByOrderRef = useRef(new Map());
  const cancelledOrderIdsRef = useRef(new Set());
  const pickupOtpRef = useRef(pickupOtpReveal);
  const mutedRef = useRef(false);

  const setPickupOtpReveal = useCallback((data) => {
    pickupOtpRef.current = data;
    setPickupOtpRevealState(data);
    if (data) localStore.setItem(OTP_KEY, JSON.stringify(data));
    else localStore.removeItem(OTP_KEY);
  }, []);

  // Auth changes (login / logout)
  useEffect(() => addAppListener("restaurantAuthChanged", () => setAuthed(isModuleAuthenticated())), []);

  // Sound player (plays even when the phone is on silent? Android: follows media volume)
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: "duckOthers" }).catch(() => {});
    try {
      playerRef.current = createAudioPlayer(ringSound);
      playerRef.current.volume = 1;
    } catch {
      playerRef.current = null;
    }
    return () => {
      try {
        playerRef.current?.remove();
      } catch {}
      playerRef.current = null;
    };
  }, []);

  const playNotificationSound = useCallback(() => {
    if (mutedRef.current) return;
    try {
      Vibration.vibrate(VIBRATE_PATTERN);
    } catch {}
    try {
      const p = playerRef.current;
      if (!p) return;
      p.seekTo(0);
      p.play();
    } catch {}
  }, []);

  const stopSound = useCallback(() => {
    try {
      playerRef.current?.pause();
      playerRef.current?.seekTo(0);
    } catch {}
    try {
      Vibration.cancel();
    } catch {}
  }, []);

  const stopAlertLoop = useCallback(() => {
    if (alertLoopTimerRef.current) {
      clearInterval(alertLoopTimerRef.current);
      alertLoopTimerRef.current = null;
    }
    alertLoopStartedAtRef.current = 0;
    stopSound();
  }, [stopSound]);

  const startAlertLoop = useCallback(() => {
    if (alertLoopTimerRef.current) clearInterval(alertLoopTimerRef.current);
    alertLoopStartedAtRef.current = Date.now();
    alertLoopTimerRef.current = setInterval(() => {
      if (Date.now() - alertLoopStartedAtRef.current >= ALERT_LOOP_MAX_MS || !activeOrderRef.current) {
        stopAlertLoop();
        return;
      }
      playNotificationSound();
    }, ALERT_LOOP_INTERVAL_MS);
  }, [playNotificationSound, stopAlertLoop]);

  const enqueueOrder = useCallback((orderData) => {
    setOrderQueue((prev) => {
      const key = getOrderAlertKey(orderData);
      if (key && prev.some((o) => getOrderAlertKey(o) === key)) return prev;
      return [...prev, orderData];
    });
  }, []);

  const removeOrderFromQueue = useCallback(
    (orderIdToRemove) => {
      const keyToRemove = String(orderIdToRemove || "").trim();
      if (!keyToRemove) return;
      setOrderQueue((prev) => prev.filter((o) => getOrderAlertKey(o) !== keyToRemove));
      if (activeOrderRef.current && getOrderAlertKey(activeOrderRef.current) === keyToRemove) {
        stopAlertLoop();
        activeOrderRef.current = null;
      }
    },
    [stopAlertLoop],
  );

  const shouldProcessOrderAlert = (orderData) => {
    const key = getOrderAlertKey(orderData);
    if (!key) return true;
    const now = Date.now();
    const last = lastAlertAtByOrderRef.current.get(key) || 0;
    if (now - last < ALERT_DEDUPE_MS) return false;
    lastAlertAtByOrderRef.current.set(key, now);
    return true;
  };

  const handleIncomingOrderAlert = useCallback(
    (orderData, source = "unknown") => {
      if (orderData?.scheduledAt && new Date(orderData.scheduledAt).getTime() > Date.now() + 15 * 60000) return;
      const deduped = !shouldProcessOrderAlert(orderData);
      if (deduped && source !== "socket") return;
      activeOrderRef.current = orderData || { id: Date.now() };
      playNotificationSound();
      startAlertLoop();
    },
    [playNotificationSound, startAlertLoop],
  );

  // Restaurant id (needed to join the socket room)
  useEffect(() => {
    if (!authed) {
      setRestaurantId(null);
      return;
    }
    let cancelled = false;
    restaurantAPI
      .getCurrentRestaurant()
      .then((res) => {
        const r = res?.data?.data?.restaurant;
        if (!cancelled && r) setRestaurantId(r._id?.toString() || r.restaurantId);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authed]);

  /** Shared handler for REST rows (poll + foreground refresh). */
  const processRows = useCallback(
    (rows, { alert }) => {
      const confirmed = (rows || [])
        .filter((o) => {
          if (String(o?.status || "").toLowerCase() !== "confirmed") return false;
          const oId = String(o?._id || o?.orderMongoId || o?.orderId || "").trim();
          if (oId && cancelledOrderIdsRef.current.has(oId)) return false;
          if (o.scheduledAt) return new Date(o.scheduledAt).getTime() <= Date.now() + 30 * 60000;
          return true;
        })
        .sort((a, b) => new Date(b?.updatedAt || b?.createdAt || 0).getTime() - new Date(a?.updatedAt || a?.createdAt || 0).getTime());
      confirmed.slice(0, 5).forEach((o) => {
        if (alert) handleIncomingOrderAlert(o, "poll");
        enqueueOrder(o);
      });

      // Cancellation fallback when socket missed it
      if (activeOrderRef.current) {
        const a = activeOrderRef.current;
        const activeId = a._id || a.orderMongoId || a.orderId;
        const match = rows.find((o) => o._id === activeId || o.orderId === activeId);
        if (match && isCancelled(match.status || match.orderStatus)) {
          removeOrderFromQueue(activeId);
          dispatchAppEvent("restaurantOrderStatusUpdate", match);
        }
      }

      // Pickup OTP request fallback
      const current = pickupOtpRef.current;
      const otpRequests = rows
        .filter((o) => {
          const reqAt = o?.deliveryVerification?.pickupOtp?.requestedAt;
          if (!reqAt || o?.deliveryVerification?.pickupOtp?.verified || !o?.pickupOtp) return false;
          if (Date.now() - new Date(reqAt).getTime() > 15 * 60000) return false;
          if (current && current.orderMongoId === o._id) return false;
          return true;
        })
        .sort((a, b) => new Date(b.deliveryVerification.pickupOtp.requestedAt).getTime() - new Date(a.deliveryVerification.pickupOtp.requestedAt).getTime());
      if (otpRequests.length > 0) {
        const r = otpRequests[0];
        setPickupOtpReveal({
          orderMongoId: String(r._id),
          orderId: r.orderId || r.order_id || String(r._id),
          otp: r.pickupOtp,
          message: "Delivery partner is requesting the Pickup OTP. Please share this code with them.",
        });
      }
    },
    [enqueueOrder, handleIncomingOrderAlert, removeOrderFromQueue, setPickupOtpReveal],
  );

  // REST polling fallback
  useEffect(() => {
    if (!restaurantId) return undefined;
    let stop = false;
    const poll = async () => {
      if (stop || AppState.currentState !== "active") return;
      try {
        const res = await restaurantAPI.getOrders({ page: 1, limit: 30 });
        processRows(res?.data?.data?.orders || [], { alert: true });
      } catch {}
    };
    poll();
    const id = setInterval(poll, ALERT_POLL_MS);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [restaurantId, processRows]);

  // App back to foreground → fetch to catch missed orders (web: visibilitychange)
  useEffect(() => {
    if (!restaurantId) return undefined;
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      restaurantAPI
        .getOrders({ page: 1, limit: 10 })
        .then((res) => processRows(res?.data?.data?.orders || [], { alert: false }))
        .catch(() => {});
    });
    return () => sub.remove();
  }, [restaurantId, processRows]);

  // Socket.IO
  useEffect(() => {
    const token = getModuleToken();
    if (!restaurantId || !token || !SOCKET_BASE_URL) {
      setIsConnected(false);
      return undefined;
    }
    const socket = io(SOCKET_BASE_URL, {
      path: "/socket.io/",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      timeout: 20000,
      auth: { token },
      query: { token },
    });
    socketRef.current = socket;
    const join = () => {
      socket.emit("join-restaurant", restaurantId);
      setTimeout(() => socket.connected && socket.emit("join-restaurant", restaurantId), 2000);
    };
    socket.on("connect", () => {
      setIsConnected(true);
      join();
    });
    socket.on("connect_error", () => setIsConnected(false));
    socket.on("disconnect", (reason) => {
      setIsConnected(false);
      if (reason === "io server disconnect") socket.connect();
    });
    socket.io.on("reconnect", () => {
      setIsConnected(true);
      socket.emit("join-restaurant", restaurantId);
    });
    socket.on("new_order", (orderData) => {
      const normalized = {
        ...orderData,
        orderMongoId: orderData?.orderMongoId || orderData?._id || orderData?.order_mongo_id,
        orderId: orderData?.orderId || orderData?.order_id || orderData?._id,
      };
      if (normalized.scheduledAt && new Date(normalized.scheduledAt).getTime() > Date.now() + 15 * 60000) return;
      enqueueOrder(normalized);
      handleIncomingOrderAlert(normalized, "socket");
    });
    socket.on("new_dining_booking", (booking) => {
      setNewReservation(booking);
      playNotificationSound();
    });
    socket.on("play_notification_sound", (data) => {
      handleIncomingOrderAlert({ orderId: data?.orderId || data?.order_id, orderMongoId: data?.orderMongoId || data?.order_mongo_id, ...data }, "socket");
    });
    socket.on("order_status_update", (data) => {
      if (isCancelled(data?.orderStatus || data?.status)) {
        [data?.orderMongoId, data?.orderId, data?._id, data?.id]
          .map((v) => (v == null ? "" : String(v).trim()))
          .filter(Boolean)
          .forEach((id) => {
            cancelledOrderIdsRef.current.add(id);
            removeOrderFromQueue(id);
          });
      }
      dispatchAppEvent("restaurantOrderStatusUpdate", data || {});
    });
    socket.on("pickup_otp_reveal", (data) => {
      setPickupOtpReveal(data);
      dispatchAppEvent("restaurantPickupOtpReveal", data || {});
    });
    socket.on("admin_notification", () => dispatchNotificationInboxRefresh());
    socket.on("food_approval_status", (data) => {
      dispatchNotificationInboxRefresh();
      if (data?.status === "approved") toast.success(data.message || `Dish "${data.name}" has been approved!`);
      else if (data?.status === "rejected") toast.error(data.message || `Dish "${data.name}" was rejected.`);
      playNotificationSound();
    });
    socket.on("notification", (payload) => {
      dispatchNotificationInboxRefresh();
      if (payload?.title && payload?.body) toast.message(`${payload.title}: ${payload.body}`);
      playNotificationSound();
    });
    return () => {
      stopAlertLoop();
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  // Logout → reset everything
  useEffect(() => {
    if (authed) return;
    stopAlertLoop();
    activeOrderRef.current = null;
    setOrderQueue([]);
    setPickupOtpReveal(null);
  }, [authed, stopAlertLoop, setPickupOtpReveal]);

  const clearNewOrder = useCallback(() => {
    stopAlertLoop();
    activeOrderRef.current = null;
    setOrderQueue((prev) => prev.slice(1));
  }, [stopAlertLoop]);

  const value = useMemo(
    () => ({
      newOrder: orderQueue[0] || null,
      orderQueue,
      newReservation,
      pickupOtpReveal,
      clearPickupOtpReveal: () => setPickupOtpReveal(null),
      clearNewOrder,
      clearNewReservation: () => setNewReservation(null),
      removeOrderFromQueue,
      isConnected,
      playNotificationSound,
      stopSound: stopAlertLoop,
      setMuted: (m) => {
        mutedRef.current = Boolean(m);
        if (m) stopSound();
      },
    }),
    [orderQueue, newReservation, pickupOtpReveal, clearNewOrder, removeOrderFromQueue, isConnected, playNotificationSound, stopAlertLoop, stopSound, setPickupOtpReveal],
  );

  return <RestaurantNotificationContext.Provider value={value}>{children}</RestaurantNotificationContext.Provider>;
}

export function useRestaurantNotifications() {
  const ctx = useContext(RestaurantNotificationContext);
  if (!ctx) throw new Error("useRestaurantNotifications must be used within RestaurantNotificationProvider");
  return ctx;
}
