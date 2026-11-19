/**
 * Home (feed) — port of DeliveryV2/pages/DeliveryHomeV2.jsx (feed tab).
 * Header: avatar → profile, ONLINE/OFFLINE switch (GPS fix → shift selfie → availability online → tracking), SOS, bell;
 * status card (offline / waiting / distance + arrival during a trip, team-leader call, cash-limit alert).
 * Body: live map when online, offline illustration otherwise. Overlays: new-order offer, pickup / drop panels,
 * verification (OTP → payment), trip summary, minimized restore bar, emergency sheet, auto-killed reason prompt.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, Linking, Modal, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertTriangle, Bell, Clock, Navigation2, Phone, Plus, Minus, Target, User as UserIcon, X } from "lucide-react-native";
import Txt from "../../src/components/ui/Txt";
import { deliveryAPI } from "../../src/api";
import { addAppListener } from "../../src/utils/events";
import { toast } from "../../src/utils/toast";
import useNotificationInbox from "../../src/hooks/useNotificationInbox";
import { useDeliveryStore } from "../../src/delivery/store";
import { useDeliveryNotifications } from "../../src/delivery/DeliveryNotificationContext";
import { useOrderManager, useProximityCheck } from "../../src/delivery/useTrip";
import { getTripStatusForOrder, normalizeDeliveryActiveOrder, useOffers } from "../../src/delivery/useOffers";
import { getCurrentFix, startTracking, stopTracking } from "../../src/delivery/locationTracking";
import LiveMap from "../../src/delivery/LiveMap";
import { DeliveryVerificationModal, DropPanel, NewOrderModal, OrderSummaryModal, PickupPanel, ShiftSelfieModal } from "../../src/delivery/TripModals";
import { calculateETA, getHaversineDistance, getOrderAcceptId, getOrderMongoId, getPrimaryIncomingOrder, isSameOrder, normalizeIncomingOrder, upsertIncomingOrderInQueue } from "../../src/delivery/orderUtils";
import { palette, dv } from "../../src/theme";

const avatar = require("../../assets/images/delivery_avatar.jpg");
const NAV = 70;
const toArray = (p) => (Array.isArray(p?.data) ? p.data : Array.isArray(p?.docs) ? p.docs : Array.isArray(p?.items) ? p.items : Array.isArray(p) ? p : []);

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const store = useDeliveryStore();
  const { isOnline, riderLocation, activeOrder, acceptedOrders, orderCapacity, tripStatus, incomingOrders, selectedIncomingId, cashLimitNotice } = store;
  const A = useDeliveryStore.actions;
  const { isWithinRange, distanceToTarget } = useProximityCheck();
  const { reachPickup, pickUpOrder, reachDrop, completeDelivery, resetTrip } = useOrderManager();
  const n = useDeliveryNotifications();
  const { handleAcceptOffer, handlePassOffer, removeClaimedOrderFromQueue, syncSelectionAfterQueueChange } = useOffers();
  const { unreadCount } = useNotificationInbox("delivery", { limit: 20, pollMs: 60000 });

  const [profileImage, setProfileImage] = useState(null);
  const [emergency, setEmergency] = useState({});
  const [showSos, setShowSos] = useState(false);
  const [showSelfie, setShowSelfie] = useState(false);
  const [selfieCoords, setSelfieCoords] = useState(null);
  const [goingOnline, setGoingOnline] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [minimized, setMinimized] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [bypassOtp, setBypassOtp] = useState(false);
  const [eta, setEta] = useState(null);
  const [killPrompt, setKillPrompt] = useState(null);
  const [killReason, setKillReason] = useState("");
  const mapRef = useRef(null);
  const lockedIdRef = useRef(null);
  const lastSentRef = useRef({ at: 0, coord: null });
  const speedsRef = useRef([]);
  const polylineRef = useRef(null);
  const autoArrivalRef = useRef({ PICKING_UP: false, PICKED_UP: false });

  const incomingOrder = useMemo(() => getPrimaryIncomingOrder(incomingOrders, selectedIncomingId), [incomingOrders, selectedIncomingId]);

  /* ---------- profile + emergency ---------- */
  useEffect(() => {
    Promise.all([deliveryAPI.getEmergencyHelp().catch(() => null), deliveryAPI.getProfile().catch(() => null)]).then(([e, p]) => {
      if (e?.data?.success && e.data.data) setEmergency(e.data.data);
      const prof = p?.data?.data?.profile;
      if (prof) setProfileImage(prof.profileImage?.url || prof.documents?.photo || null);
    });
  }, []);

  /* ---------- initial server sync of accepted orders ---------- */
  useEffect(() => {
    (async () => {
      try {
        const res = await deliveryAPI.getActiveOrders();
        const payload = res?.data?.data || {};
        const orders = (Array.isArray(payload.activeOrders) ? payload.activeOrders : []).map(normalizeDeliveryActiveOrder);
        A.setAcceptedOrders(orders);
        A.setOrderCapacity(payload.capacity || {});
        if (orders.length) {
          A.setActiveOrder(orders[0]);
          A.updateTripStatus(getTripStatusForOrder(orders[0]));
        } else A.clearActiveOrder();
      } catch {
        A.clearActiveOrder();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- online state → server + tracking (resume tracking if persisted online) ---------- */
  useEffect(() => {
    deliveryAPI.updateOnlineStatus(isOnline).catch(() => {});
    if (isOnline) {
      startTracking()
        .then(() => setLocationError(""))
        .catch((e) => {
          setLocationError(e?.message || "Location is off or unavailable. Enable precise location to go online.");
          toast.error("Location unavailable", { description: "Enable precise location to go online." });
          A.setOnline(false);
          deliveryAPI.updateOnlineStatus(false).catch(() => {});
        });
    } else {
      stopTracking();
      setLocationError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  /* ---------- ETA from rolling speed ---------- */
  useEffect(() => {
    if (distanceToTarget != null && distanceToTarget !== Infinity) {
      const avg = speedsRef.current.length ? speedsRef.current.reduce((a, b) => a + b, 0) / speedsRef.current.length : 8;
      setEta(calculateETA(distanceToTarget, avg));
    } else setEta(null);
  }, [distanceToTarget]);

  const activeMeta = useCallback(() => {
    const o = useDeliveryStore.getState().activeOrder;
    if (!o) return null;
    return {
      orderId: getOrderMongoId(o) || getOrderAcceptId(o),
      userId: o.userId?._id?.toString?.() || o.userId?.toString?.() || o.user?._id?.toString?.() || o.user?.id || o.userId,
      restaurantId: o.restaurantId?._id?.toString?.() || o.restaurantId?.toString?.() || o.restaurantId,
    };
  }, []);

  /* ---------- each GPS fix: emit to customer tracking (10 m / 4 s), geofence auto-arrival ---------- */
  useEffect(
    () =>
      addAppListener("riderLocationUpdate", (e) => {
        const { lat, lng, heading, speed, accuracy } = e?.detail || {};
        if (speed && speed > 0) speedsRef.current = [...speedsRef.current.slice(-4), speed];
        const st = useDeliveryStore.getState();
        const now = Date.now();
        const moved = lastSentRef.current.coord ? getHaversineDistance(lat, lng, lastSentRef.current.coord.lat, lastSentRef.current.coord.lng) : 1000;
        if (moved >= 10 || now - lastSentRef.current.at >= 4000) {
          lastSentRef.current = { at: now, coord: { lat, lng } };
          const meta = activeMeta();
          if (meta?.orderId) n.emitLocation({ lat, lng, heading, speed: speed || 0, accuracy, ...meta, status: "on_the_way", polyline: polylineRef.current, eta });
        }
        // geofence auto-arrival (100 m) — web Phase 11
        const ts = st.tripStatus;
        if (st.activeOrder && distanceToTarget <= 100 && !autoArrivalRef.current[ts]) {
          if (ts === "PICKING_UP") {
            autoArrivalRef.current[ts] = true;
            reachPickup().catch(() => (autoArrivalRef.current[ts] = false));
          } else if (ts === "PICKED_UP") {
            autoArrivalRef.current[ts] = true;
            reachDrop().catch(() => (autoArrivalRef.current[ts] = false));
          }
        }
        if (distanceToTarget > 200) autoArrivalRef.current[ts] = false;
      }),
    [n, activeMeta, eta, distanceToTarget, reachPickup, reachDrop],
  );

  const onPolyline = useCallback(
    (enc) => {
      polylineRef.current = enc;
      const meta = activeMeta();
      const c = useDeliveryStore.getState().riderLocation;
      if (meta?.orderId && c) n.emitLocation({ ...meta, lat: c.lat, lng: c.lng, heading: c.heading || 0, polyline: enc, status: useDeliveryStore.getState().tripStatus, eta });
    },
    [activeMeta, n, eta],
  );

  /* ---------- offer queue: socket newOrder / pending offers / open-order (push tap) ---------- */
  const selectIncoming = useCallback((order) => {
    const o = normalizeIncomingOrder(order);
    const id = getOrderMongoId(o) || getOrderAcceptId(o);
    if (!id) return;
    lockedIdRef.current = id;
    A.setSelectedIncomingId(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!n.newOrder) return;
    const o = normalizeIncomingOrder(n.newOrder);
    const id = getOrderMongoId(o) || getOrderAcceptId(o);
    if (!id) return;
    setMinimized(false);
    A.setIncomingOrders((prev) => upsertIncomingOrderInQueue(prev, o));
    A.setSelectedIncomingId((prev) => {
      if (prev) return prev;
      lockedIdRef.current = id;
      return id;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n.newOrder]);

  useEffect(() => {
    const a = addAppListener("deliveryPendingOffers", (e) => {
      const offers = e?.detail?.offers || [];
      if (!offers.length) return;
      A.setIncomingOrders((prev) => offers.reduce((acc, of) => upsertIncomingOrderInQueue(acc, of), prev));
      A.setSelectedIncomingId((prev) => prev || getOrderMongoId(offers[0]) || getOrderAcceptId(offers[0]));
    });
    const b = addAppListener("delivery-open-order-modal", (e) => {
      const id = e?.detail?.orderMongoId || e?.detail?.orderId;
      if (id) {
        A.setSelectedIncomingId(id);
        deliveryAPI
          .getOrderDetails(id)
          .then((res) => {
            const raw = res?.data?.data?.order || res?.data?.data;
            if (raw && (raw._id || raw.orderId)) A.setIncomingOrders((prev) => upsertIncomingOrderInQueue(prev, normalizeIncomingOrder(raw)));
          })
          .catch(() => {});
      }
      setMinimized(false);
    });
    return () => {
      a();
      b();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // enrich partial offers
  useEffect(() => {
    if (!incomingOrder) return;
    const id = getOrderMongoId(incomingOrder);
    if (id && (!incomingOrder.restaurantId || !incomingOrder.items || !incomingOrder.pricing)) {
      deliveryAPI
        .getOrderDetails(id)
        .then((res) => {
          const raw = res?.data?.data?.order || res?.data?.data;
          if (raw && (raw._id || raw.orderId)) A.setIncomingOrders((prev) => upsertIncomingOrderInQueue(prev, normalizeIncomingOrder(raw)));
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingOrder]);

  useEffect(() => setMinimized(false), [tripStatus, showVerification, incomingOrder]);
  useEffect(() => {
    if (selectedIncomingId) lockedIdRef.current = selectedIncomingId;
  }, [selectedIncomingId]);

  // claimed / cancelled / reassigned offers
  useEffect(() => {
    const c = n.claimedOrderId;
    if (!c?.orderId && !c?.orderMongoId) return;
    const ref = { orderId: c.orderId, orderMongoId: c.orderMongoId || c.orderId, _id: c.orderMongoId || c.orderId, claimedBy: c.claimedBy };
    const myId = n.deliveryPartnerId;
    if (c.claimedBy && myId && String(c.claimedBy) === String(myId)) removeClaimedOrderFromQueue(ref, { notify: false });
    else if (useDeliveryStore.getState().incomingOrders.some((i) => isSameOrder(i, ref))) removeClaimedOrderFromQueue(ref, { notify: true, visibleOrder: incomingOrder });
    n.clearClaimedOrderId();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n.claimedOrderId]);

  // available-orders fallback poll (15 s, 45 s when socket is healthy)
  useEffect(() => {
    if (!isOnline) return undefined;
    let cancelled = false;
    const hydrate = async () => {
      try {
        const act = await deliveryAPI.getActiveOrders();
        const ap = act?.data?.data || {};
        if (!cancelled) {
          A.setAcceptedOrders((Array.isArray(ap.activeOrders) ? ap.activeOrders : []).map(normalizeDeliveryActiveOrder));
          A.setOrderCapacity(ap.capacity || {});
        }
        const av = await deliveryAPI.getOrders({ limit: 20, page: 1 });
        const payload = av?.data?.data || av?.data || {};
        if (!cancelled) A.setCashLimitNotice(payload?.cashLimit?.blocked ? payload.cashLimit : null);
        const incoming = toArray(payload)
          .map(normalizeIncomingOrder)
          .filter((o) => ["unassigned", "assigned"].includes(String(o?.dispatch?.status || "").toLowerCase()) && ["confirmed", "preparing", "ready_for_pickup"].includes(String(o?.orderStatus || o?.status || "").toLowerCase()));
        if (!cancelled && incoming.length) {
          A.setCashLimitNotice(null);
          A.setIncomingOrders((prev) => incoming.reduce((acc, o) => upsertIncomingOrderInQueue(acc, o), prev));
          A.setSelectedIncomingId((prev) => prev || getOrderMongoId(incoming[0]) || null);
        }
      } catch {}
    };
    hydrate();
    const t = setInterval(hydrate, n.isConnected ? 45000 : 15000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, n.isConnected]);

  // status updates (cancel / resync recovery)
  useEffect(() => {
    const u = n.orderStatusUpdate;
    if (!u) return;
    if (String(u.status || "").toLowerCase().includes("cancel")) {
      toast.error("Order cancelled");
      const id = getOrderMongoId(u) || getOrderAcceptId(u);
      if (!id || isSameOrder(activeOrder, u)) resetTrip();
      else A.removeAcceptedOrder(id);
      n.clearOrderStatusUpdate();
      return;
    }
    if (u.recoverySource === "socket_resync" || u.recoverySource === "delivery_reconnect") {
      const p = normalizeDeliveryActiveOrder(u);
      if (!activeOrder || isSameOrder(activeOrder, p)) {
        A.setActiveOrder(p);
        A.updateTripStatus(getTripStatusForOrder(p));
      } else {
        const exists = acceptedOrders.some((o) => isSameOrder(o, p));
        A.setAcceptedOrders(exists ? acceptedOrders.map((o) => (isSameOrder(o, p) ? p : o)) : [...acceptedOrders, p]);
      }
    }
    n.clearOrderStatusUpdate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n.orderStatusUpdate]);

  // auto-killed → ask reason (web window.prompt)
  useEffect(() => {
    if (!n.autoKilledOrder) return;
    setKillPrompt(n.autoKilledOrder);
    setKillReason("");
    n.clearAutoKilledOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n.autoKilledOrder]);

  useEffect(() => {
    if (!n.adminNotification) return;
    toast.info(n.adminNotification.title || "New Notification", { description: n.adminNotification.message || n.adminNotification.body || "", duration: 8000 });
    n.clearAdminNotification();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n.adminNotification]);

  /* ---------- go online / offline ---------- */
  const toggleOnline = async () => {
    if (isOnline) {
      A.setOnline(false);
      deliveryAPI.updateOnlineStatus(false).catch(() => {});
      return;
    }
    if (goingOnline) return;
    setGoingOnline(true);
    try {
      const fix = await getCurrentFix();
      setSelfieCoords(fix);
      setLocationError("");
      setShowSelfie(true);
    } catch (e) {
      if (e?.code === "PERMISSION") {
        toast.error("Location permission is required to go online", { description: e.blocked ? "Allow location for Jharkhand Rasoi Delivery in Settings" : "Tap Online again and choose Allow", duration: 6000 });
        if (e.blocked) Linking.openSettings().catch(() => {});
      } else {
        toast.error(e?.message || "Please enable your GPS for current location");
      }
    } finally {
      setGoingOnline(false);
    }
  };
  const onSelfieUpload = async (base64, address) => {
    try {
      await deliveryAPI.updateOnlineStatus(true, base64, address);
      A.setOnline(true);
      setShowSelfie(false);
      if (selfieCoords) deliveryAPI.updateLocation(selfieCoords.lat, selfieCoords.lng, true).catch(() => {});
      toast.success("Shift started successfully!");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to start shift. Please try again.");
    }
  };

  const triggerMarkDelivered = (order) => {
    const t = order || activeOrder;
    if (!t) return toast.error("No order selected to deliver");
    A.setActiveOrder(normalizeDeliveryActiveOrder(t));
    setMinimized(false);
    setBypassOtp(true);
    setShowVerification(true);
  };

  const onAcceptFromModal = async (orderFromModal) => {
    const target = normalizeIncomingOrder(orderFromModal || incomingOrder);
    const locked = lockedIdRef.current;
    if (locked && target && !isSameOrder({ orderMongoId: locked, _id: locked }, target)) {
      toast.error("Order changed while accepting. Please try again.", { duration: 4000 });
      throw new Error("mismatch");
    }
    await handleAcceptOffer(target);
  };

  const emergencyOptions = [
    { title: "Medical Emergency", subtitle: "Call an ambulance", color: palette.red600, phone: emergency.medicalEmergency },
    { title: "Accident Helpline", subtitle: "Report an accident", color: "#ea580c", phone: emergency.accidentHelpline },
    { title: "Contact Police", subtitle: "Nearest police support", color: palette.blue600, phone: emergency.contactPolice },
    { title: "Insurance", subtitle: "Policy & claim help", color: palette.green600, phone: emergency.insurance },
    { title: "Team Leader", subtitle: "Contact your assigned team leader", color: palette.purple600, phone: emergency.teamLeader },
  ];
  const dial = (num) => {
    const d = String(num || "").replace(/\D/g, "");
    if (d) Linking.openURL(`tel:${d}`);
    else toast.error("Number not configured");
  };

  const showPanels = !minimized && !incomingOrder && activeOrder && tripStatus !== "COMPLETED" && !showVerification;
  const showOffer = !minimized && incomingOrder && orderCapacity.canAcceptMore !== false;

  return (
    <View style={{ flex: 1, backgroundColor: dv.bg }}>
      {/* map / offline body */}
      {isOnline ? (
        <>
          <LiveMap ref={mapRef} onPolylineReceived={onPolyline} onMapPress={() => (activeOrder || incomingOrder) && setMinimized(true)} />
          <View style={[styles.mapControls, { bottom: NAV + 90 }]}>
            <View style={styles.zoomBox}>
              <Pressable onPress={() => mapRef.current?.zoomBy(1)} style={styles.zoomBtn}>
                <Plus size={20} color={palette.gray900} strokeWidth={2.75} />
              </Pressable>
              <Pressable onPress={() => mapRef.current?.zoomBy(-1)} style={[styles.zoomBtn, { borderTopWidth: 1, borderTopColor: palette.gray100 }]}>
                <Minus size={20} color={palette.gray900} strokeWidth={2.75} />
              </Pressable>
            </View>
            <Pressable onPress={() => mapRef.current?.recenter()} style={styles.fab}>
              <Target size={26} color={palette.gray900} />
            </Pressable>
          </View>
        </>
      ) : (
        <View style={styles.offline}>
          <View style={styles.offlineGlow} />
          <Image source={avatar} style={styles.offlineAvatar} />
          <View style={styles.offlineCard}>
            <Txt weight={900} style={{ fontSize: 17, color: palette.gray900, letterSpacing: 2 }}>YOU ARE OFFLINE</Txt>
            <Txt weight={700} style={{ fontSize: 11, color: palette.gray500, letterSpacing: 1.2, marginTop: 4 }}>GO ONLINE TO RECEIVE ORDERS</Txt>
          </View>
        </View>
      )}

      {/* header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Pressable onPress={() => router.navigate("/(tabs)/profile")} style={styles.avatarRing}>
              <Image source={profileImage ? { uri: profileImage } : avatar} style={{ width: "100%", height: "100%", borderRadius: 20 }} />
            </Pressable>
            <Pressable onPress={toggleOnline} style={[styles.toggle, { backgroundColor: isOnline ? "#22c55e" : "#ef4444" }]}>
              <Txt weight={900} style={[styles.toggleText, { left: isOnline ? 10 : undefined, right: isOnline ? undefined : 8 }]}>{goingOnline ? "..." : isOnline ? "ONLINE" : "OFFLINE"}</Txt>
              <View style={[styles.knob, { left: isOnline ? 62 : 4 }]} />
            </Pressable>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable onPress={() => setShowSos(true)} style={[styles.headBtn, { borderColor: "#fee2e2" }]} accessibilityLabel="Emergency SOS">
              <AlertTriangle size={16} color="#DC2626" />
            </Pressable>
            <Pressable onPress={() => router.push("/notifications")} style={styles.headBtn} accessibilityLabel="Notifications">
              <Bell size={16} color="#1F2937" />
              {unreadCount > 0 ? (
                <View style={styles.bellBadge}>
                  <Txt weight={900} style={{ fontSize: 9, color: palette.white }}>{unreadCount > 9 ? "9+" : unreadCount}</Txt>
                </View>
              ) : null}
            </Pressable>
          </View>
        </View>

        {activeOrder ? (
          <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
            <View style={styles.statCard}>
              <View>
                <Txt weight={900} style={styles.statLabel}>DISTANCE</Txt>
                <Txt weight={900} style={styles.statValue}>
                  {distanceToTarget && distanceToTarget !== Infinity ? (distanceToTarget / 1000).toFixed(1) : "--"} <Txt weight={900} style={styles.statUnit}>KM</Txt>
                </Txt>
              </View>
              <View style={[styles.statIcon, { backgroundColor: "#FFF7ED", borderColor: "#FFEDD5" }]}>
                <Navigation2 size={16} color="#EA580C" />
              </View>
            </View>
            <View style={styles.statCard}>
              <View>
                <Txt weight={900} style={styles.statLabel}>ARRIVAL</Txt>
                <Txt weight={900} style={styles.statValue}>
                  {eta ? String(eta) : "--"} <Txt weight={900} style={styles.statUnit}>MIN</Txt>
                </Txt>
              </View>
              <View style={[styles.statIcon, { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" }]}>
                <Clock size={16} color="#059669" />
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.statusCard}>
            <View style={[styles.statusDotBox, { backgroundColor: isOnline ? "#ECFDF5" : "#F3F4F6", borderColor: isOnline ? "#A7F3D0" : "#E5E7EB" }]}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: isOnline ? "#10B981" : "#9CA3AF" }} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt weight={900} style={{ fontSize: 12, color: "#030712", letterSpacing: 1 }}>{isOnline ? "SYSTEM ONLINE" : "SYSTEM OFFLINE"}</Txt>
              <Txt weight={600} style={{ fontSize: 11, color: palette.gray500 }}>{isOnline ? "Waiting for order requests" : "Go online to receive orders"}</Txt>
            </View>
            {emergency.teamLeader ? (
              <Pressable onPress={() => dial(emergency.teamLeader)} style={{ alignItems: "center" }}>
                <View style={styles.tlBtn}>
                  <Phone size={16} color="#2563EB" />
                </View>
                <Txt weight={700} style={{ fontSize: 8, color: palette.gray500, marginTop: 2 }}>TEAM LEADER</Txt>
              </Pressable>
            ) : null}
          </View>
        )}
        {!activeOrder && cashLimitNotice?.blocked ? (
          <View style={styles.cashAlert}>
            <Txt weight={900} style={{ fontSize: 10, color: "#b45309", letterSpacing: 1.4 }}>CASH LIMIT ALERT</Txt>
            <Txt weight={600} style={{ fontSize: 11, color: "#92400e", marginTop: 2 }}>{cashLimitNotice?.message || "Please deposit your amount to get orders."}</Txt>
          </View>
        ) : null}
      </View>

      {locationError && isOnline ? (
        <View style={[styles.locErr, { top: insets.top + 170 }]}>
          <Txt weight={900} style={{ fontSize: 10, color: palette.red600, letterSpacing: 1.5 }}>LOCATION UNAVAILABLE</Txt>
          <Txt weight={600} style={{ fontSize: 12, color: palette.gray700, marginTop: 2 }}>{locationError}</Txt>
        </View>
      ) : null}

      {/* trip panels */}
      {showPanels && (tripStatus === "PICKING_UP" || tripStatus === "REACHED_PICKUP") ? (
        <PickupPanel
          order={activeOrder}
          status={tripStatus}
          isWithinRange={isWithinRange}
          distanceToTarget={distanceToTarget}
          eta={eta}
          onReachedPickup={reachPickup}
          onPickedUp={(bill, otp) => pickUpOrder(bill, otp)}
          onMarkDelivered={triggerMarkDelivered}
          onMinimize={() => setMinimized(true)}
          bottomOffset={NAV}
        />
      ) : null}
      {showPanels && (tripStatus === "PICKED_UP" || tripStatus === "REACHED_DROP") ? (
        <DropPanel
          order={activeOrder}
          status={tripStatus}
          isWithinRange={isWithinRange}
          distanceToTarget={distanceToTarget}
          eta={eta}
          onReachedDrop={reachDrop}
          onVerify={() => {
            setBypassOtp(false);
            setShowVerification(true);
          }}
          onMarkDelivered={triggerMarkDelivered}
          onMinimize={() => setMinimized(true)}
          bottomOffset={NAV}
        />
      ) : null}

      {minimized && (activeOrder || incomingOrder) ? (
        <Pressable onPress={() => setMinimized(false)} style={[styles.restoreBar, { bottom: NAV + 16 }]}>
          <View>
            <Txt weight={700} style={{ fontSize: 10, color: palette.gray400, letterSpacing: 1.5 }}>{incomingOrders.length > 1 ? `${incomingOrders.length} ORDERS WAITING` : "ORDER ACTION PENDING"}</Txt>
            <Txt weight={700} style={{ fontSize: 12, color: palette.white, letterSpacing: 1 }}>{incomingOrders.length > 1 ? "TAP TO CHOOSE AND ACCEPT" : "TAP TO OPEN DELIVERY PANEL"}</Txt>
          </View>
          <View style={{ backgroundColor: "#f97316", padding: 8, borderRadius: 12 }}>
            <Plus size={18} color={palette.white} />
          </View>
        </Pressable>
      ) : null}

      {showOffer ? (
        <NewOrderModal
          key={getOrderMongoId(incomingOrder) || getOrderAcceptId(incomingOrder)}
          order={incomingOrder}
          queuedOrders={incomingOrders}
          onSelectOrder={selectIncoming}
          onAccept={onAcceptFromModal}
          onReject={() => handlePassOffer(incomingOrder)}
          onMinimize={() => setMinimized(true)}
        />
      ) : null}

      {showVerification && tripStatus !== "COMPLETED" && activeOrder ? (
        <DeliveryVerificationModal
          order={activeOrder}
          skipOtp={bypassOtp}
          onComplete={async (otp, paymentOverride) => {
            await completeDelivery(otp, paymentOverride, activeOrder);
            setShowVerification(false);
            setBypassOtp(false);
          }}
          onClose={() => {
            setShowVerification(false);
            setBypassOtp(false);
          }}
        />
      ) : null}
      {tripStatus === "COMPLETED" && activeOrder ? <OrderSummaryModal order={activeOrder} onDone={resetTrip} /> : null}

      <ShiftSelfieModal visible={showSelfie} coords={selfieCoords} onClose={() => setShowSelfie(false)} onUpload={onSelfieUpload} />

      <Modal visible={showSos} transparent animationType="slide" onRequestClose={() => setShowSos(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setShowSos(false)}>
          <Pressable style={[styles.bottomSheet, { paddingBottom: Math.max(insets.bottom, 16) }]} onPress={() => {}}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
              <Txt weight={900} style={{ fontSize: 20, color: palette.gray900, flex: 1 }}>EMERGENCY HELP</Txt>
              <Pressable onPress={() => setShowSos(false)} style={styles.closeRound}>
                <X size={16} color={palette.gray500} />
              </Pressable>
            </View>
            {emergencyOptions.map((o) => (
              <Pressable key={o.title} onPress={() => dial(o.phone)} style={styles.sosRow}>
                <View style={styles.sosIcon}>{o.title === "Team Leader" ? <UserIcon size={20} color={o.color} /> : <AlertTriangle size={20} color={o.color} />}</View>
                <View>
                  <Txt weight={700} style={{ fontSize: 15, color: palette.gray900 }}>{o.title}</Txt>
                  <Txt style={{ fontSize: 12, color: palette.gray500 }}>{o.subtitle}</Txt>
                </View>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={Boolean(killPrompt)} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.centerBackdrop}>
          <View style={styles.killCard}>
            <Txt weight={800} style={{ fontSize: 17, color: palette.gray900 }}>Order cancelled by system</Txt>
            <Txt style={{ fontSize: 13, color: palette.gray600, marginVertical: 8 }}>Your order exceeded the 1 hour limit and was cancelled by the system. Please provide a reason for the failure/delay:</Txt>
            <TextInput value={killReason} onChangeText={setKillReason} placeholder="Reason" placeholderTextColor={palette.gray400} multiline style={styles.killInput} />
            <Pressable
              onPress={() => {
                const reason = killReason.trim();
                if (!reason) return toast.error("You must provide a reason for the delayed delivery.");
                deliveryAPI
                  .rejectOrder(killPrompt.orderId || killPrompt.orderMongoId || killPrompt._id, { reason })
                  .then(() => toast.success("Reason saved successfully."))
                  .catch(() => toast.error("Failed to save reason."));
                setKillPrompt(null);
              }}
              style={styles.killBtn}
            >
              <Txt weight={800} style={{ color: palette.white, fontSize: 13, letterSpacing: 1 }}>SUBMIT REASON</Txt>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { position: "absolute", top: 0, left: 0, right: 0, backgroundColor: dv.primary, paddingHorizontal: 12, paddingBottom: 10, borderBottomLeftRadius: 0, elevation: 10 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 },
  avatarRing: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: "rgba(255,255,255,0.4)", padding: 1, backgroundColor: "rgba(255,255,255,0.2)" },
  toggle: { width: 92, height: 32, borderRadius: 16, justifyContent: "center" },
  toggleText: { position: "absolute", fontSize: 9, color: palette.white, letterSpacing: 1.5 },
  knob: { position: "absolute", width: 24, height: 24, borderRadius: 12, backgroundColor: palette.white, elevation: 2 },
  headBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: palette.white, borderWidth: 1, borderColor: palette.gray100, alignItems: "center", justifyContent: "center", elevation: 3 },
  bellBadge: { position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 3, backgroundColor: palette.red600, borderWidth: 2, borderColor: palette.white, alignItems: "center", justifyContent: "center" },
  statusCard: { marginTop: 6, backgroundColor: palette.white, borderRadius: 18, padding: 12, flexDirection: "row", alignItems: "center", gap: 12, elevation: 3 },
  statusDotBox: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  tlBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: palette.blue50, borderWidth: 1, borderColor: palette.blue100, alignItems: "center", justifyContent: "center" },
  statCard: { flex: 1, backgroundColor: palette.white, borderRadius: 18, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", elevation: 3 },
  statLabel: { fontSize: 10, color: palette.gray400, letterSpacing: 1 },
  statValue: { fontSize: 24, color: "#030712" },
  statUnit: { fontSize: 11, color: palette.gray500 },
  statIcon: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  cashAlert: { marginTop: 8, borderRadius: 16, borderWidth: 1, borderColor: "#fcd34d", backgroundColor: "#fffbeb", padding: 10 },
  locErr: { position: "absolute", left: 16, right: 16, backgroundColor: palette.white, borderRadius: 16, borderWidth: 1, borderColor: "#fecaca", padding: 12, elevation: 8 },
  mapControls: { position: "absolute", right: 16, gap: 14, alignItems: "flex-end" },
  zoomBox: { backgroundColor: palette.white, borderRadius: 16, borderWidth: 1, borderColor: palette.gray200, overflow: "hidden", elevation: 6 },
  zoomBtn: { padding: 12 },
  fab: { width: 56, height: 56, borderRadius: 28, backgroundColor: palette.white, alignItems: "center", justifyContent: "center", elevation: 6 },
  offline: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 140, backgroundColor: "#f8f9fa" },
  offlineGlow: { position: "absolute", width: 300, height: 300, borderRadius: 150, backgroundColor: "rgba(59,130,246,0.12)", top: "32%" },
  offlineAvatar: { width: 220, height: 220, borderRadius: 110, borderWidth: 8, borderColor: palette.white },
  offlineCard: { marginTop: 28, backgroundColor: "rgba(255,255,255,0.9)", paddingHorizontal: 28, paddingVertical: 18, borderRadius: 24, alignItems: "center", elevation: 4 },
  restoreBar: { position: "absolute", left: 24, right: 24, backgroundColor: "rgba(17,24,39,0.92)", borderRadius: 18, paddingVertical: 14, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", elevation: 12 },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  bottomSheet: { backgroundColor: palette.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  closeRound: { width: 32, height: 32, borderRadius: 16, backgroundColor: palette.gray100, alignItems: "center", justifyContent: "center" },
  sosRow: { flexDirection: "row", alignItems: "center", gap: 16, padding: 14, borderRadius: 16, backgroundColor: palette.gray50, marginBottom: 10 },
  sosIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: palette.white, alignItems: "center", justifyContent: "center", elevation: 1 },
  centerBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 },
  killCard: { backgroundColor: palette.white, borderRadius: 20, padding: 20 },
  killInput: { minHeight: 80, borderWidth: 1, borderColor: palette.gray200, borderRadius: 12, padding: 12, textAlignVertical: "top", color: palette.gray900, marginBottom: 12 },
  killBtn: { height: 48, borderRadius: 14, backgroundColor: palette.gray900, alignItems: "center", justifyContent: "center" },
});
