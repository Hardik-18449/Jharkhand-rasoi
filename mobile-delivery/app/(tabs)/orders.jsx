/** Orders tab — port of DeliveryV2/pages/OrdersV2.jsx: Active / Delivered segments, New Offers (accept / pass), Active Deliveries (live route, mark delivered), Delivered list. */
import React, { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Store, MapPin, Phone, Navigation, CheckCircle2, Package } from "lucide-react-native";
import Txt from "../../src/components/ui/Txt";
import Spinner from "../../src/components/ui/Spinner";
import { deliveryAPI } from "../../src/api";
import { toast } from "../../src/utils/toast";
import { useDeliveryStore } from "../../src/delivery/store";
import { useOffers } from "../../src/delivery/useOffers";
import { getCustomerDisplayInfo, getOrderDisplayId, getOrderMongoId, getOrderPaymentInfo, getRestaurantDisplayInfo } from "../../src/delivery/orderUtils";
import { palette, dv } from "../../src/theme";

const money = (v) => `₹${Number(v || 0).toFixed(0)}`;
const call = (n) => n && Linking.openURL(`tel:${String(n).replace(/[^\d+]/g, "")}`);
const deliveredTime = (o) => {
  const d = new Date(o?.deliveredAt || o?.updatedAt || o?.createdAt || o?.time || Date.now());
  const today = new Date();
  const same = d.toDateString() === today.toDateString();
  return `${same ? "Today" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}, ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
};

function OrderInfo({ order, footer }) {
  const r = getRestaurantDisplayInfo(order);
  const c = getCustomerDisplayInfo(order);
  const p = getOrderPaymentInfo(order);
  const pay = Number(order.earnings || order.riderEarning || order.deliveryEarning || 0);
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Txt weight={900} style={{ fontSize: 14, color: palette.gray900 }}>#{getOrderDisplayId(order)}</Txt>
        <View style={{ alignItems: "flex-end" }}>
          <Txt weight={700} style={{ fontSize: 9, color: palette.gray400, letterSpacing: 1 }}>RIDER PAY</Txt>
          <Txt weight={900} style={{ fontSize: 16, color: palette.green700 }}>{money(pay)}</Txt>
        </View>
      </View>
      <View style={styles.stop}>
        <Store size={15} color={dv.orange} />
        <View style={{ flex: 1 }}>
          <Txt weight={700} style={styles.kicker}>PICKUP RESTAURANT</Txt>
          <Txt weight={700} style={styles.name}>{r.name}</Txt>
          <Txt numberOfLines={1} style={styles.addr}>{r.shortAddress}</Txt>
        </View>
        {r.phone ? (
          <Pressable onPress={() => call(r.phone)} style={styles.callBtn}>
            <Phone size={12} color={palette.blue600} />
            <Txt weight={700} style={{ fontSize: 11, color: palette.blue600 }}>Call</Txt>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.stop}>
        <MapPin size={15} color={palette.green600} />
        <View style={{ flex: 1 }}>
          <Txt weight={700} style={styles.kicker}>CUSTOMER DROP</Txt>
          <Txt weight={700} style={styles.name}>{c.name}</Txt>
          <Txt numberOfLines={1} style={styles.addr}>{c.shortAddress}</Txt>
        </View>
        {c.phone ? (
          <Pressable onPress={() => call(c.phone)} style={styles.callBtn}>
            <Phone size={12} color={palette.blue600} />
            <Txt weight={700} style={{ fontSize: 11, color: palette.blue600 }}>Call</Txt>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.billRow}>
        <Txt weight={700} style={{ fontSize: 11, color: palette.gray500 }}>TOTAL BILL</Txt>
        <Txt weight={800} style={[styles.payTag, p.isCod ? { color: "#92400e", backgroundColor: "#fef3c7" } : { color: palette.green700, backgroundColor: palette.green100 }]}>{p.paymentLabel}</Txt>
        <Txt weight={900} style={{ fontSize: 14, color: palette.gray900, marginLeft: "auto" }}>{p.formattedTotal}</Txt>
      </View>
      {footer}
    </View>
  );
}

export default function OrdersTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { incomingOrders, acceptedOrders, orderCapacity: capacity } = useDeliveryStore();
  const { handleAcceptOffer, handlePassOffer, openAcceptedOrder, refreshAcceptedOrders } = useOffers();
  const [seg, setSeg] = useState("active");
  const [delivered, setDelivered] = useState([]);
  const [loadingDelivered, setLoadingDelivered] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const limit = Number(capacity.effectiveLimit || 1);
  const activeCount = Number(capacity.activeOrderCount ?? acceptedOrders.length);
  const canAccept = capacity.canAcceptMore !== false && activeCount < limit;

  const fetchDelivered = useCallback(async () => {
    try {
      let list = [];
      const res = await deliveryAPI.getDeliveredOrders({ limit: 100 }).catch(() => null);
      if (res?.data?.success && Array.isArray(res.data?.data?.deliveredOrders)) list = res.data.data.deliveredOrders;
      if (!list.length) {
        const h = await deliveryAPI.getTripHistory({ status: "Completed", period: "all", all: true, limit: 100 }).catch(() => null);
        if (h?.data?.success && Array.isArray(h.data?.data?.trips)) list = h.data.data.trips;
      }
      setDelivered(list);
    } finally {
      setLoadingDelivered(false);
    }
  }, []);
  useEffect(() => {
    fetchDelivered();
    refreshAcceptedOrders().catch(() => {});
  }, [fetchDelivered, refreshAcceptedOrders]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchDelivered(), refreshAcceptedOrders().catch(() => {})]);
    setRefreshing(false);
  };

  const accept = async (o) => {
    const id = getOrderMongoId(o);
    setBusyId(id);
    try {
      await handleAcceptOffer(o);
      toast.success("Order accepted");
      router.navigate("/(tabs)");
    } catch {
    } finally {
      setBusyId(null);
    }
  };
  const openOnMap = (o) => {
    openAcceptedOrder(o);
    router.navigate("/(tabs)");
  };
  const markDelivered = (o) => {
    openAcceptedOrder(o);
    router.navigate("/(tabs)");
    toast.info("Open the delivery panel and slide to verify & complete");
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.gray50 }}>
      <View style={[styles.top, { paddingTop: insets.top + 10 }]}>
        <Txt weight={900} style={{ fontSize: 22, color: palette.gray900 }}>Orders</Txt>
        <View style={styles.segment}>
          {[
            ["active", `Active (${incomingOrders.length + acceptedOrders.length})`],
            ["delivered", "Delivered"],
          ].map(([k, l]) => (
            <Pressable key={k} onPress={() => setSeg(k)} style={[styles.segBtn, seg === k && styles.segActive]}>
              <Txt weight={seg === k ? 800 : 600} style={{ fontSize: 13, color: seg === k ? palette.white : palette.gray600 }}>{l}</Txt>
            </Pressable>
          ))}
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 100 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[dv.accent]} />}>
        {seg === "active" ? (
          <>
            <View style={styles.capRow}>
              <Txt weight={700} style={{ fontSize: 12, color: palette.gray600 }}>Capacity</Txt>
              <Txt weight={900} style={{ fontSize: 12, color: canAccept ? palette.green700 : palette.red600 }}>{activeCount}/{limit} active {canAccept ? "• can accept more" : "• full"}</Txt>
            </View>
            <Txt weight={900} style={styles.h2}>New Offers</Txt>
            {incomingOrders.length === 0 ? (
              <Txt style={styles.empty}>No new offers right now. Stay online to receive orders.</Txt>
            ) : (
              incomingOrders.map((o) => {
                const id = getOrderMongoId(o);
                return (
                  <OrderInfo
                    key={id || getOrderDisplayId(o)}
                    order={o}
                    footer={
                      <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                        <Pressable onPress={() => handlePassOffer(o)} style={[styles.btn, { backgroundColor: palette.gray100, flex: 1 }]}>
                          <Txt weight={800} style={{ fontSize: 12, color: palette.gray700 }}>PASS</Txt>
                        </Pressable>
                        <Pressable onPress={() => accept(o)} disabled={!canAccept || busyId === id} style={[styles.btn, { backgroundColor: palette.green600, flex: 2 }, (!canAccept || busyId === id) && { opacity: 0.5 }]}>
                          {busyId === id ? <Spinner color={palette.white} /> : <Txt weight={800} style={{ fontSize: 12, color: palette.white }}>{canAccept ? "ACCEPT ORDER" : "CAPACITY FULL"}</Txt>}
                        </Pressable>
                      </View>
                    }
                  />
                );
              })
            )}
            <Txt weight={900} style={[styles.h2, { marginTop: 18 }]}>Active Deliveries</Txt>
            {acceptedOrders.length === 0 ? (
              <Txt style={styles.empty}>No active deliveries.</Txt>
            ) : (
              acceptedOrders.map((o) => (
                <OrderInfo
                  key={getOrderMongoId(o) || getOrderDisplayId(o)}
                  order={o}
                  footer={
                    <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                      <Pressable onPress={() => openOnMap(o)} style={[styles.btn, { backgroundColor: palette.gray900, flex: 1 }]}>
                        <Navigation size={14} color={palette.white} />
                        <Txt weight={800} style={{ fontSize: 12, color: palette.white }}>LIVE ROUTE</Txt>
                      </Pressable>
                      <Pressable onPress={() => markDelivered(o)} style={[styles.btn, { backgroundColor: "#ecfdf5", borderWidth: 1, borderColor: "#6ee7b7", flex: 1 }]}>
                        <CheckCircle2 size={14} color="#059669" />
                        <Txt weight={800} style={{ fontSize: 12, color: "#065f46" }}>DELIVERED</Txt>
                      </Pressable>
                    </View>
                  }
                />
              ))
            )}
          </>
        ) : loadingDelivered ? (
          <Spinner full />
        ) : delivered.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 60 }}>
            <Package size={36} color={palette.gray300} />
            <Txt weight={700} style={{ color: palette.gray500, marginTop: 8 }}>No delivered orders yet</Txt>
          </View>
        ) : (
          delivered.map((o, i) => (
            <View key={o._id || o.orderId || i} style={styles.card}>
              <View style={styles.cardHead}>
                <View>
                  <Txt weight={900} style={{ fontSize: 14, color: palette.gray900 }}>#{o.orderId || getOrderDisplayId(o)}</Txt>
                  <Txt style={{ fontSize: 11, color: palette.gray500 }}>{o.restaurantName || o.restaurant || getRestaurantDisplayInfo(o).name}</Txt>
                  <Txt style={{ fontSize: 11, color: palette.gray400 }}>{deliveredTime(o)}</Txt>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Txt weight={800} style={[styles.payTag, { color: palette.green700, backgroundColor: palette.green100 }]}>DELIVERED</Txt>
                  <Txt weight={700} style={{ fontSize: 9, color: palette.gray400, marginTop: 6 }}>EARNED</Txt>
                  <Txt weight={900} style={{ fontSize: 16, color: palette.green700 }}>{money(o.riderEarning || o.deliveryEarning || o.earningAmount || o.amount || o.earnings)}</Txt>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { backgroundColor: palette.white, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: palette.gray100, gap: 10 },
  segment: { flexDirection: "row", gap: 8 },
  segBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: palette.gray100 },
  segActive: { backgroundColor: dv.accent },
  capRow: { flexDirection: "row", justifyContent: "space-between", backgroundColor: palette.white, borderRadius: 14, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: palette.gray100 },
  h2: { fontSize: 15, color: palette.gray900, marginBottom: 8 },
  empty: { fontSize: 13, color: palette.gray500, textAlign: "center", paddingVertical: 18 },
  card: { backgroundColor: palette.white, borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: palette.gray100 },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  stop: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  kicker: { fontSize: 9, color: palette.gray400, letterSpacing: 1.2 },
  name: { fontSize: 13, color: palette.gray900 },
  addr: { fontSize: 11, color: palette.gray500 },
  callBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: palette.blue50 },
  billRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: palette.gray100 },
  payTag: { fontSize: 10, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: "hidden" },
  btn: { height: 44, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
});
