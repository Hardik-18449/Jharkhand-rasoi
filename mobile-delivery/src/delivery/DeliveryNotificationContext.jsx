/**
 * Port of Food/hooks/useDeliveryNotifications.js + context/DeliveryNotificationContext.jsx.
 * Socket.IO (join-delivery, resync) is the offer channel (web also had a Firebase RTDB offers listener; the app
 * relies on the socket + REST recovery — deviation D2), alert loop (alert.mp3 every 4.5 s, max 2 min) + vibration,
 * recovery on reconnect / app foreground, claimed / cancelled / auto-killed / reassigned handling, admin force status,
 * emitLocation → 'join-tracking' + 'update-location' for the customer tracking map.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Vibration } from "react-native";
import io from "socket.io-client";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { SOCKET_BASE_URL } from "../config";
import { deliveryAPI } from "../api";
import { decodeJwtPayload, getCurrentUser, getModuleToken, isModuleAuthenticated } from "../auth/session";
import { addAppListener, dispatchAppEvent } from "../utils/events";
import { dispatchNotificationInboxRefresh } from "../hooks/useNotificationInbox";
import { toast } from "../utils/toast";
import { useDeliveryStore } from "./store";
import { getOrderAcceptId, getOrderAlertKey, getOrderMongoId, normalizeIncomingOrder } from "./orderUtils";

const alertSound = require("../../assets/audio/alert.mp3");
const ALERT_LOOP_INTERVAL_MS = 4500;
const ALERT_LOOP_MAX_MS = 120000;
const ALERT_DEDUPE_MS = 15000;
const VIBRATE = [0, 200, 100, 200, 100, 300];

const DeliveryNotificationContext = createContext(null);
const isRiderOnline = () => Boolean(useDeliveryStore.getState().isOnline);

export const resolveDeliveryPartnerId = () => {
  const u = getCurrentUser();
  const nested = u?.id || u?._id || u?.userId || u?.deliveryId || u?.deliveryPartnerId || u?.user?.id || u?.user?._id;
  if (nested) return String(nested);
  const p = decodeJwtPayload(getModuleToken());
  const t = p?.userId || p?.id || p?._id || p?.sub;
  return t ? String(t) : null;
};

const toArray = (payload) =>
  Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.docs) ? payload.docs : Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : [];

export function DeliveryNotificationProvider({ children }) {
  const [token, setToken] = useState(() => (isModuleAuthenticated() ? getModuleToken() : null));
  const [deliveryPartnerId, setDeliveryPartnerId] = useState(null);
  const [newOrder, setNewOrder] = useState(null);
  const [orderReady, setOrderReady] = useState(null);
  const [orderStatusUpdate, setOrderStatusUpdate] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [autoKilledOrder, setAutoKilledOrder] = useState(null);
  const [claimedOrderId, setClaimedOrderId] = useState(null);
  const [adminNotification, setAdminNotification] = useState(null);

  const socketRef = useRef(null);
  const playerRef = useRef(null);
  const activeOrderRef = useRef(null);
  const loopRef = useRef(null);
  const loopStartRef = useRef(0);
  const lastAlertRef = useRef(new Map());
  const joinedRoomRef = useRef(null);
  const joinedTrackingRef = useRef(new Set());

  useEffect(
    () =>
      addAppListener("deliveryAuthChanged", () => {
        setToken(isModuleAuthenticated() ? getModuleToken() : null);
      }),
    [],
  );
  useEffect(
    () =>
      addAppListener("authRefreshed", (e) => {
        const t = e?.detail?.token;
        if (!t || !socketRef.current) return;
        socketRef.current.auth = { token: t };
        if (socketRef.current.io?.opts) socketRef.current.io.opts.query = { token: t };
        joinedRoomRef.current = null;
        joinedTrackingRef.current.clear();
        socketRef.current.disconnect();
        socketRef.current.connect();
      }),
    [],
  );

  // sound
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: "duckOthers" }).catch(() => {});
    try {
      playerRef.current = createAudioPlayer(alertSound);
      playerRef.current.volume = 0.9;
    } catch {
      playerRef.current = null;
    }
    return () => {
      try {
        playerRef.current?.remove();
      } catch {}
    };
  }, []);

  const playNotificationSound = useCallback(() => {
    try {
      Vibration.vibrate(VIBRATE);
    } catch {}
    try {
      playerRef.current?.seekTo(0);
      playerRef.current?.play();
    } catch {}
  }, []);

  const stopAlertLoop = useCallback(() => {
    if (loopRef.current) clearInterval(loopRef.current);
    loopRef.current = null;
    loopStartRef.current = 0;
    try {
      playerRef.current?.pause();
      playerRef.current?.seekTo(0);
      Vibration.cancel();
    } catch {}
  }, []);

  const startAlertLoop = useCallback(() => {
    if (loopRef.current) clearInterval(loopRef.current);
    loopStartRef.current = Date.now();
    loopRef.current = setInterval(() => {
      if (Date.now() - loopStartRef.current >= ALERT_LOOP_MAX_MS || !activeOrderRef.current) {
        stopAlertLoop();
        return;
      }
      playNotificationSound();
    }, ALERT_LOOP_INTERVAL_MS);
  }, [playNotificationSound, stopAlertLoop]);

  const handleIncomingOrderAlert = useCallback(
    (orderData, { force = false } = {}) => {
      const key = getOrderAlertKey(orderData);
      if (!force && key) {
        const last = lastAlertRef.current.get(key) || 0;
        if (Date.now() - last < ALERT_DEDUPE_MS) return;
        lastAlertRef.current.set(key, Date.now());
      }
      activeOrderRef.current = orderData || { id: Date.now() };
      playNotificationSound();
      startAlertLoop();
    },
    [playNotificationSound, startAlertLoop],
  );

  // partner id
  useEffect(() => {
    if (!token) {
      setDeliveryPartnerId(null);
      return undefined;
    }
    const fallback = resolveDeliveryPartnerId();
    if (fallback) setDeliveryPartnerId(fallback);
    let cancelled = false;
    deliveryAPI
      .getMe()
      .then((res) => {
        const p = res?.data?.data?.user || res?.data?.data?.deliveryPartner;
        const id = p?.id?.toString() || p?._id?.toString() || p?.deliveryId;
        if (!cancelled && id) setDeliveryPartnerId(String(id));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token]);

  const recoverDeliveryState = useCallback(async () => {
    if (!deliveryPartnerId) return;
    try {
      const [avail, cur] = await Promise.allSettled([deliveryAPI.getOrders({ limit: 20, page: 1 }), deliveryAPI.getCurrentDelivery()]);
      const currentTrip = cur.status === "fulfilled" ? cur.value?.data?.data ?? cur.value?.data ?? null : null;
      if (currentTrip && (currentTrip._id || currentTrip.orderId)) {
        setOrderStatusUpdate({ ...currentTrip, recoverySource: "delivery_reconnect" });
        return;
      }
      const payload = avail.status === "fulfilled" ? avail.value?.data?.data ?? avail.value?.data ?? {} : {};
      const recoverable = toArray(payload).find(
        (o) => ["unassigned", "assigned"].includes(o?.dispatch?.status) && ["confirmed", "accepted", "preparing", "ready", "ready_for_pickup"].includes(String(o?.orderStatus || o?.status || "").toLowerCase()),
      );
      if (recoverable && !activeOrderRef.current && isRiderOnline()) {
        const n = normalizeIncomingOrder(recoverable);
        setNewOrder(n);
        handleIncomingOrderAlert(n);
      }
    } catch {}
  }, [deliveryPartnerId, handleIncomingOrderAlert]);

  const joinRoom = useCallback(() => {
    if (!socketRef.current?.connected || !deliveryPartnerId) return false;
    if (joinedRoomRef.current === deliveryPartnerId) return true;
    socketRef.current.emit("join-delivery", deliveryPartnerId);
    joinedRoomRef.current = deliveryPartnerId;
    return true;
  }, [deliveryPartnerId]);

  // socket
  useEffect(() => {
    if (!token || !SOCKET_BASE_URL) {
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

    const onNewOffer = (orderData) => {
      if (!isRiderOnline()) return;
      const n = normalizeIncomingOrder(orderData);
      setNewOrder(n);
      handleIncomingOrderAlert(n);
    };
    const clearIfCurrent = (data) => {
      stopAlertLoop();
      activeOrderRef.current = null;
      setNewOrder(null);
      const id = data?.orderId || data?.orderMongoId || data?._id;
      if (id) setClaimedOrderId({ orderId: id, claimedBy: "cancelled" });
    };

    socket.on("connect", () => {
      setIsConnected(true);
      joinedRoomRef.current = null;
      joinedTrackingRef.current.clear();
      joinRoom();
      socket.emit("resync");
      recoverDeliveryState();
    });
    socket.io.on("reconnect", () => {
      setIsConnected(true);
      joinedRoomRef.current = null;
      joinedTrackingRef.current.clear();
      joinRoom();
      socket.emit("resync");
      recoverDeliveryState();
    });
    socket.on("connect_error", () => setIsConnected(false));
    socket.on("disconnect", (reason) => {
      setIsConnected(false);
      joinedRoomRef.current = null;
      joinedTrackingRef.current.clear();
      if (reason === "io server disconnect") socket.connect();
    });
    socket.on("active_order", (d) => d && setOrderStatusUpdate({ ...d, recoverySource: "socket_resync" }));
    socket.on("pending_offers", ({ offers = [] } = {}) => {
      if (!isRiderOnline() || !Array.isArray(offers) || !offers.length) return;
      dispatchAppEvent("deliveryPendingOffers", { offers: offers.map(normalizeIncomingOrder).filter(Boolean) });
    });
    socket.on("new_order", onNewOffer);
    socket.on("new_order_available", onNewOffer);
    socket.on("play_notification_sound", (data) => {
      if (!isRiderOnline()) return;
      const n = normalizeIncomingOrder({ orderId: data?.orderId || data?.order_id, orderMongoId: data?.orderMongoId || data?.order_mongo_id, ...data });
      setNewOrder(n);
      handleIncomingOrderAlert(n, { force: true });
    });
    socket.on("order_ready", (d) => {
      setOrderReady(d);
      playNotificationSound();
    });
    socket.on("order_status_update", (d) => setOrderStatusUpdate(d || null));
    socket.on("order_cancelled", (d) => {
      clearIfCurrent(d);
      setOrderStatusUpdate({ ...(d || {}), status: "cancelled" });
    });
    socket.on("order_deleted", (d) => setOrderStatusUpdate({ ...(d || {}), status: "deleted" }));
    socket.on("order_auto_killed", (d) => {
      clearIfCurrent(d);
      setOrderStatusUpdate({ ...(d || {}), status: "cancelled" });
      setAutoKilledOrder(d);
    });
    socket.on("order_reassigned_elsewhere", (d) => {
      stopAlertLoop();
      activeOrderRef.current = null;
      setNewOrder(null);
      const id = getOrderMongoId(d) || d?.orderId;
      if (id) setClaimedOrderId({ orderId: id, orderMongoId: getOrderMongoId(d) || id, claimedBy: d?.claimedBy || "reassigned" });
    });
    socket.on("order_claimed", (d) => {
      const claimed = getOrderMongoId(d) || d?.orderId || d?.order_id;
      const current = getOrderMongoId(activeOrderRef.current) || activeOrderRef.current?.orderId || activeOrderRef.current?._id;
      if (claimed && current && String(claimed) === String(current)) {
        stopAlertLoop();
        activeOrderRef.current = null;
        setNewOrder(null);
      }
      if (claimed) setClaimedOrderId({ orderId: claimed, orderMongoId: getOrderMongoId(d) || claimed, claimedBy: d?.claimedBy });
    });
    socket.on("admin_notification", (p) => {
      setAdminNotification(p);
      dispatchNotificationInboxRefresh();
    });
    socket.on("admin_force_status", (p) => {
      const online = p?.status === "online";
      useDeliveryStore.actions.setOnline(online);
      if (online) toast.success(p?.message || "You have been marked online by the Admin.");
      else {
        toast.error(p?.message || "You have been marked offline by the Admin.", { duration: 8000 });
        stopAlertLoop();
        activeOrderRef.current = null;
        setNewOrder(null);
      }
    });

    return () => {
      stopAlertLoop();
      joinedRoomRef.current = null;
      joinedTrackingRef.current.clear();
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // join room once the partner id is known
  useEffect(() => {
    if (!deliveryPartnerId) return;
    joinRoom();
    if (socketRef.current?.connected) {
      socketRef.current.emit("resync");
      recoverDeliveryState();
    }
  }, [deliveryPartnerId, joinRoom, recoverDeliveryState]);

  // app back in foreground → recover (web: focus / visibilitychange)
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") recoverDeliveryState();
    });
    return () => sub.remove();
  }, [recoverDeliveryState]);

  const emitLocation = useCallback((data) => {
    if (!socketRef.current?.connected || !data) return false;
    const orderId = String(getOrderMongoId(data) || getOrderAcceptId(data) || data.orderId || "").trim();
    if (!orderId) return false;
    if (!joinedTrackingRef.current.has(orderId)) {
      joinedTrackingRef.current.add(orderId);
      socketRef.current.emit("join-tracking", orderId);
    }
    socketRef.current.emit("update-location", { ...data, orderId, userId: data.userId, restaurantId: data.restaurantId });
    return true;
  }, []);

  const value = useMemo(
    () => ({
      newOrder,
      clearNewOrder: () => {
        stopAlertLoop();
        activeOrderRef.current = null;
        setNewOrder(null);
      },
      orderReady,
      clearOrderReady: () => setOrderReady(null),
      orderStatusUpdate,
      clearOrderStatusUpdate: () => setOrderStatusUpdate(null),
      adminNotification,
      clearAdminNotification: () => setAdminNotification(null),
      claimedOrderId,
      clearClaimedOrderId: () => setClaimedOrderId(null),
      autoKilledOrder,
      clearAutoKilledOrder: () => setAutoKilledOrder(null),
      isConnected,
      playNotificationSound,
      stopAlertLoop,
      emitLocation,
      deliveryPartnerId,
    }),
    [newOrder, orderReady, orderStatusUpdate, adminNotification, claimedOrderId, autoKilledOrder, isConnected, playNotificationSound, stopAlertLoop, emitLocation, deliveryPartnerId],
  );

  return <DeliveryNotificationContext.Provider value={value}>{children}</DeliveryNotificationContext.Provider>;
}

export function useDeliveryNotifications() {
  const ctx = useContext(DeliveryNotificationContext);
  if (!ctx) throw new Error("useDeliveryNotifications must be used within DeliveryNotificationProvider");
  return ctx;
}
