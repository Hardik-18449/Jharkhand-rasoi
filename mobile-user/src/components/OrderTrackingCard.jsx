/** Port of components/user/OrderTrackingCard.jsx — live order strip on the home page. */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, AppState, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import Svg, { Path, Rect } from "react-native-svg";
import { ChevronRight, X } from "lucide-react-native";
import Txt from "./ui/Txt";
import { useOrders } from "../context/OrdersContext";
import { orderAPI } from "../api";
import { patchOrderFromSocketPayload, socketPayloadNeedsRefetch } from "../utils/orderSocketPatch";
import { addAppListener } from "../utils/events";
import { isModuleAuthenticated } from "../auth/session";
import { palette } from "../theme";

const getOrderKey = (order) => order?.id || order?._id || order?.orderId || null;
const normalizeOrderToken = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
const getOrderStatus = (order) => normalizeOrderToken(order?.orderStatus || order?.status || order?.deliveryState?.status || order?.deliveryStatus || "");
const getOrderPhase = (order) => normalizeOrderToken(order?.deliveryState?.currentPhase || order?.currentPhase || "");
const ACTIVE_PHASES = new Set(["created", "confirmed", "preparing", "accepted", "ready", "ready_for_pickup", "reached_pickup", "picked_up", "out_for_delivery", "en_route_to_delivery", "at_pickup", "at_drop"]);
const TERMINAL_STATUSES = new Set(["delivered", "cancelled", "canceled", "completed", "failed", "cancelled_by_user", "canceled_by_user", "cancelled_by_restaurant", "canceled_by_restaurant", "cancelled_by_admin", "canceled_by_admin", "dead"]);

const isActiveOrder = (order) => {
  if (!order) return false;
  const status = getOrderStatus(order);
  const phase = getOrderPhase(order);
  if (TERMINAL_STATUSES.has(status)) return false;
  if (phase === "completed" || phase === "delivered") return false;
  if (order.scheduledAt && (status === "confirmed" || status === "created" || status === "pending")) return false;
  if (!status && phase) return ACTIVE_PHASES.has(phase);
  if (!status) return false;
  return true;
};
const getTimeRemaining = (order) => {
  if (!order) return null;
  const orderTime = new Date(order.scheduledAt || order.createdAt || order.orderDate || order.created_at || order.date || Date.now());
  const estimatedMinutes = order.scheduledAt ? 0 : order.estimatedDeliveryTime || order.estimatedTime || order.estimated_delivery_time || 35;
  const deliveryTime = new Date(orderTime.getTime() + estimatedMinutes * 60000);
  return Math.max(0, Math.floor((deliveryTime - new Date()) / 60000));
};
const ordersFingerprint = (orders) => (Array.isArray(orders) && orders.length ? orders.map((o) => `${getOrderKey(o)}:${getOrderStatus(o)}`).join("|") : "");

function CookingAnimation() {
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.timing(rot, { toValue: 1, duration: 300, useNativeDriver: true }), Animated.timing(rot, { toValue: 0, duration: 300, useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [rot]);
  return (
    <View style={styles.cook}>
      <Animated.View style={{ transform: [{ rotate: rot.interpolate({ inputRange: [0, 1], outputRange: ["-2deg", "2deg"] }) }], marginTop: 4 }}>
        <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M6 10h12v6a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4v-6z" fill="#000" fillOpacity={0.12} />
          <Rect x={5} y={8} width={14} height={2} rx={1} fill="#000" />
          <Path d="M12 8V5" />
          <Path d="M11 5h2v2h-2z" fill="#000" />
          <Path d="M19 9l3-1v2l-3 1" fill="#000" strokeWidth={1.2} />
          <Path d="M5 10H3v2h2" />
        </Svg>
      </Animated.View>
      <View style={styles.flame} />
    </View>
  );
}

function OrderTrackingCardInner({ hasBottomNav = true, bottom }) {
  const router = useRouter();
  const { orders: contextOrders } = useOrders();
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [apiOrders, setApiOrders] = useState([]);
  const [hasFetchedApi, setHasFetchedApi] = useState(false);
  const [activeOrderOverride, setActiveOrderOverride] = useState(null);
  const [invalidOrderIds, setInvalidOrderIds] = useState(new Set());
  const [dismissedKey, setDismissedKey] = useState(null);
  const lastRefreshRef = useRef(0);
  const lastApiFingerprintRef = useRef("");
  const activeOrderKeyRef = useRef("");
  const activeOrderSnapshotRef = useRef(null);
  const slide = useRef(new Animated.Value(100)).current;

  const fetchOrders = useCallback(async () => {
    if (!isModuleAuthenticated()) {
      setHasFetchedApi(true);
      return;
    }
    try {
      const response = await orderAPI.getOrders({ limit: 10, page: 1 });
      let nextOrders = [];
      if (response?.data?.success && response?.data?.data?.orders) nextOrders = response.data.data.orders;
      else if (response?.data?.orders) nextOrders = response.data.orders;
      else if (Array.isArray(response?.data?.data?.data)) nextOrders = response.data.data.data;
      else if (Array.isArray(response?.data?.data?.docs)) nextOrders = response.data.data.docs;
      else if (Array.isArray(response?.data?.data)) nextOrders = response.data.data;
      const list = Array.isArray(nextOrders) ? nextOrders : [];
      const fp = ordersFingerprint(list);
      if (fp !== lastApiFingerprintRef.current) {
        lastApiFingerprintRef.current = fp;
        setApiOrders(list);
      }
    } catch {
      if (lastApiFingerprintRef.current !== "") {
        lastApiFingerprintRef.current = "";
        setApiOrders([]);
      }
    } finally {
      setHasFetchedApi(true);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(() => {
      if (AppState.currentState !== "active") return;
      fetchOrders();
    }, 90000);
    const off = addAppListener("userAuthChanged", fetchOrders);
    return () => {
      clearInterval(interval);
      off();
    };
  }, [fetchOrders]);

  const uniqueOrders = useMemo(() => {
    const isMongoObjectId = (v) => /^[a-f0-9]{24}$/i.test(String(v || ""));
    const serverKeys = new Set((apiOrders || []).map((o) => String(getOrderKey(o) || "")).filter(Boolean));
    const seen = new Set();
    return [...apiOrders, ...contextOrders].filter((order) => {
      const key = getOrderKey(order);
      if (!key || seen.has(key)) return false;
      if (invalidOrderIds.has(key)) return false;
      if (hasFetchedApi && isMongoObjectId(key) && !serverKeys.has(String(key))) return false;
      seen.add(key);
      return true;
    });
  }, [contextOrders, apiOrders, invalidOrderIds, hasFetchedApi]);

  const activeOrder = useMemo(() => {
    const candidate = uniqueOrders.find((o) => isActiveOrder(o)) || null;
    if (!candidate) return null;
    const overrideKey = getOrderKey(activeOrderOverride);
    const candidateKey = getOrderKey(candidate);
    if (overrideKey && candidateKey && overrideKey === candidateKey) return activeOrderOverride;
    return candidate;
  }, [uniqueOrders, activeOrderOverride]);

  useEffect(() => {
    activeOrderKeyRef.current = String(getOrderKey(activeOrder) || "");
    activeOrderSnapshotRef.current = activeOrder;
  }, [activeOrder]);

  useEffect(() => {
    const off1 = addAppListener("orderStatusNotification", async (event) => {
      const detail = event?.detail || {};
      const incomingKey = String(detail?.orderMongoId || detail?.orderId || "").trim();
      const currentKey = activeOrderKeyRef.current;
      if (!incomingKey || !currentKey || incomingKey !== currentKey) return;
      const snap = activeOrderSnapshotRef.current;
      setActiveOrderOverride((prev) => patchOrderFromSocketPayload(prev || snap || {}, detail));
      if (!socketPayloadNeedsRefetch(detail, detail?.orderStatus)) return;
      const now = Date.now();
      if (now - lastRefreshRef.current < 30000) return;
      lastRefreshRef.current = now;
      try {
        const response = await orderAPI.getOrderDetails(incomingKey);
        const fresh = response?.data?.data?.order || response?.data?.order || response?.data?.data || null;
        if (fresh) setActiveOrderOverride(fresh);
      } catch (error) {
        if (error?.response?.status === 404 || error?.response?.status === 400) setInvalidOrderIds((prev) => new Set(prev).add(incomingKey));
      }
    });
    const off2 = addAppListener("order-placed", () => fetchOrders());
    return () => {
      off1();
      off2();
    };
  }, [fetchOrders]);

  useEffect(() => {
    if (!activeOrder) {
      setTimeRemaining(null);
      return undefined;
    }
    const tick = () => setTimeRemaining(getTimeRemaining(activeOrder));
    tick();
    const interval = setInterval(tick, 60000);
    return () => clearInterval(interval);
  }, [activeOrder]);

  useEffect(() => {
    const key = getOrderKey(activeOrder);
    if (!key || invalidOrderIds.has(key)) return;
    if (apiOrders.some((o) => getOrderKey(o) === key)) return;
    orderAPI.getOrderDetails(key).catch((error) => {
      if (error?.response?.status === 404 || error?.response?.status === 400) setInvalidOrderIds((prev) => new Set(prev).add(key));
    });
  }, [activeOrder, apiOrders, invalidOrderIds]);

  const visible = Boolean(activeOrder) && dismissedKey !== (activeOrder?.id || activeOrder?._id || activeOrder?.orderId);
  useEffect(() => {
    Animated.spring(slide, { toValue: visible ? 0 : 100, damping: 25, stiffness: 200, useNativeDriver: true }).start();
  }, [visible, slide]);

  if (!activeOrder) return null;
  const currentOrderKey = activeOrder.id || activeOrder._id || activeOrder.orderId;
  if (dismissedKey === currentOrderKey) return null;
  const orderStatus = getOrderStatus(activeOrder) || "preparing";
  const orderPhase = getOrderPhase(activeOrder);
  if (TERMINAL_STATUSES.has(orderStatus) || orderPhase === "cancelled" || orderPhase === "canceled") return null;

  const restaurantName = activeOrder.restaurant || activeOrder.restaurantName || "Restaurant";
  const statusText = (() => {
    const s = String(orderStatus);
    const p = String(orderPhase);
    if (s === "confirmed") return "Order confirmed";
    if (s === "preparing" || s === "created" || s === "pending") return "Preparing your order";
    if (s === "ready_for_pickup") return "Ready for pickup";
    if (s === "reached_pickup" || p === "at_pickup") return "Delivery partner reached restaurant";
    if (s === "picked_up" || p === "en_route_to_delivery") return "On the way";
    if (s === "reached_drop" || p === "at_drop") return "Arrived near you";
    if (s === "delivered" || p === "delivered" || p === "completed") return "Delivered";
    return "Preparing your order";
  })();

  return (
    <Animated.View style={[styles.wrap, { bottom: bottom ?? (hasBottomNav ? 80 : 24), transform: [{ translateY: slide }] }]}>
      <Pressable onPress={() => router.push(`/orders/${currentOrderKey}`)} style={styles.card}>
        <Pressable onPress={() => setDismissedKey(currentOrderKey)} style={styles.close} hitSlop={8}>
          <X size={14} color={palette.black} />
        </Pressable>
        <View style={styles.row}>
          <CookingAnimation />
          <View style={{ flex: 1, minWidth: 0, paddingRight: 16 }}>
            <Txt weight={700} numberOfLines={1} style={styles.name}>
              {restaurantName}
            </Txt>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
              <Txt weight={500} numberOfLines={1} style={styles.status}>
                {statusText}
              </Txt>
              <ChevronRight size={14} color={palette.black} />
            </View>
          </View>
          <View style={styles.eta}>
            <Txt weight={700} style={styles.etaLabel}>
              ARRIVING IN
            </Txt>
            <Txt weight={800} style={styles.etaValue}>
              {timeRemaining !== null ? `${Math.max(1, timeRemaining)} min` : "--"}
            </Txt>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const OrderTrackingCard = memo(OrderTrackingCardInner);
export default OrderTrackingCard;

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16, zIndex: 9999 },
  card: { backgroundColor: "rgba(255,255,255,0.97)", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "rgba(255,237,213,0.6)", shadowColor: "#eb590e", shadowOpacity: 0.15, shadowRadius: 30, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  close: { position: "absolute", top: 8, right: 8, padding: 6, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.9)", zIndex: 20, elevation: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 16 },
  cook: { width: 48, height: 48, borderRadius: 12, backgroundColor: palette.orange50, borderWidth: 1, borderColor: palette.orange100, alignItems: "center", justifyContent: "center" },
  flame: { position: "absolute", bottom: 2, width: 16, height: 4, borderRadius: 2, backgroundColor: palette.yellow, opacity: 0.7 },
  name: { fontSize: 16, color: palette.gray900 },
  status: { fontSize: 12, color: palette.gray500, flexShrink: 1 },
  eta: { backgroundColor: palette.yellow, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8, alignItems: "center", borderWidth: 1, borderColor: palette.orange200 },
  etaLabel: { fontSize: 10, color: palette.gray800, letterSpacing: 1 },
  etaValue: { fontSize: 16, color: palette.black },
});
