/** Port of pages/restaurant/OrderDetails.jsx — order header, note, pickup OTP, customer, rider, items (with combo), payout breakdown, timeline. */
import React, { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Copy, FileText, Phone, Bike, User, MapPin, ChevronDown, ChevronUp, CheckCircle2, XCircle } from "lucide-react-native";
import Screen from "../../src/components/ui/Screen";
import PageHeader from "../../src/components/ui/PageHeader";
import Txt from "../../src/components/ui/Txt";
import Spinner from "../../src/components/ui/Spinner";
import AppImage from "../../src/components/ui/AppImage";
import { restaurantAPI } from "../../src/api";
import { addAppListener } from "../../src/utils/events";
import { toast } from "../../src/utils/toast";
import { palette, rt } from "../../src/theme";

const firstNumber = (...v) => {
  for (const x of v) {
    const n = Number(x);
    if (x !== null && x !== undefined && x !== "" && Number.isFinite(n)) return n;
  }
  return null;
};
const firstText = (...v) => v.find((x) => typeof x === "string" && x.trim())?.trim() || "";
const money = (n) => `₹${(Number(n) || 0).toFixed(2)}`;

function transform(order) {
  const statusLower = String(order.status || order.orderStatus || "").toLowerCase();
  const pricing = order.pricing || {};
  const computedSubtotal = Array.isArray(order.items) ? order.items.reduce((s, i) => s + (Number(i?.price) || 0) * (Number(i?.quantity) || 1), 0) : 0;
  const itemSubtotal = firstNumber(pricing.subtotal, pricing.itemsTotal, pricing.itemSubtotal, order.itemSubtotal, order.subtotal) ?? computedSubtotal;
  const taxes = firstNumber(pricing.tax, pricing.gst, order.tax, order.gst) ?? 0;
  const packagingFee = firstNumber(pricing.packagingFee, order.packagingFee) ?? 0;
  const deliveryFee = firstNumber(pricing.deliveryFee, order.deliveryFee) ?? 0;
  const platformFee = firstNumber(pricing.platformFee, order.platformFee) ?? 0;
  const discount = firstNumber(pricing.discount, order.discount) ?? 0;
  const total = firstNumber(pricing.total, order.payment?.amountDue, order.totalAmount, order.total, order.amount) ?? Math.max(0, itemSubtotal + taxes + packagingFee + deliveryFee + platformFee - discount);
  const restaurantCommission = Number(pricing.restaurantCommission) || 0;
  const gstOnItem = Number(pricing.gstOnItem) || 0;
  const gstOnCommission = Number(pricing.gstOnCommission) || 0;
  const paymentGatewayFee = Number(pricing.paymentGatewayFee) || 0;
  const tcs = Number(pricing.tcs) || 0;
  const restaurantGets = Math.max(0, itemSubtotal + packagingFee - restaurantCommission - gstOnItem - gstOnCommission - paymentGatewayFee - tcs);
  const deliveryDistance = firstNumber(order.deliveryDistance, order.customer?.distance, 0);
  const a = order.address || {};
  const d = order.deliveryAddress || {};
  const fullAddress =
    a.formattedAddress || a.address || d.formattedAddress || d.address || [d.street, d.city, d.state, d.zipCode].filter(Boolean).join(", ") || [a.street, a.area, a.city, a.state, a.pincode].filter(Boolean).join(", ") || "Address not available";
  const rawPay = String(order.payment?.status || order.paymentStatus || "").toLowerCase();
  const payMethod = String(order.payment?.method || "").toLowerCase();
  let paymentStatus = "PENDING";
  if (["completed", "paid", "captured", "success", "succeeded"].includes(rawPay)) paymentStatus = "PAID";
  else if (["failed", "declined"].includes(rawPay)) paymentStatus = "FAILED";
  else if (["refunded", "refund"].includes(rawPay)) paymentStatus = "REFUNDED";
  else if (payMethod === "cash") paymentStatus = statusLower === "delivered" ? "PAID" : "COD";
  const reached = {
    confirmed: order.tracking?.confirmed?.status || ["confirmed", "preparing", "ready", "ready_for_pickup", "picked_up", "out_for_delivery", "delivered"].includes(statusLower),
    preparing: order.tracking?.preparing?.status || ["preparing", "ready", "ready_for_pickup", "picked_up", "out_for_delivery", "delivered"].includes(statusLower),
    ready: order.tracking?.ready?.status || ["ready", "ready_for_pickup", "picked_up", "out_for_delivery", "delivered"].includes(statusLower),
    outForDelivery: order.tracking?.outForDelivery?.status || ["picked_up", "out_for_delivery", "delivered"].includes(statusLower),
    delivered: order.tracking?.delivered?.status || statusLower === "delivered",
  };
  const ts = (x) => (x ? new Date(x).toLocaleString("en-GB") : "");
  const partner = order.deliveryPartner || (typeof order.dispatch?.deliveryPartnerId === "object" ? order.dispatch?.deliveryPartnerId : null);
  return {
    id: order.orderId || order._id,
    mongoId: order._id,
    status: statusLower.toUpperCase() || "PENDING",
    statusLower,
    date: new Date(order.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    time: new Date(order.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }),
    restaurant: firstText(order.restaurantName, order.restaurant?.restaurantName, order.restaurant?.name, order.restaurantId?.restaurantName, order.restaurantId?.name) || "Restaurant",
    isPriority: Boolean(order.isPriority || order.customerSubscription?.isSubscribed),
    customer: {
      name: firstText(order.userId?.name, order.customerName, order.customer?.name, order.deliveryAddress?.name, order.deliveryAddress?.fullName, order.address?.name) || "Customer",
      orderCount: order.userId?.orderCount || 1,
      location: fullAddress,
      distance: deliveryDistance ? `${deliveryDistance} km` : "-",
    },
    items: (order.items || []).map((i) => ({ name: i.name, quantity: i.quantity, price: i.price, image: i.image, variantName: i.variantName, isCombo: i.isCombo === true, comboItems: Array.isArray(i.comboItems) ? i.comboItems : [], veg: i.isVeg || i.foodType === "Veg" })),
    billing: { itemSubtotal, taxes, packagingFee, deliveryFee, platformFee, discount, total, paymentStatus, restaurantCommission, gstOnItem, gstOnCommission, paymentGatewayFee, tcs, restaurantGets, deliveryDistance },
    deliveryPartner: partner,
    reason: order.cancellationReason || "",
    restaurantNote: order.restaurantNote || "",
    pickupOtp: order.pickupOtp || null,
    timeline: [
      { event: "Order placed", timestamp: ts(order.createdAt), status: "completed" },
      ...(reached.confirmed ? [{ event: "Order confirmed", timestamp: ts(order.tracking?.confirmed?.timestamp), status: "completed" }] : []),
      ...(reached.preparing ? [{ event: "Preparing", timestamp: ts(order.tracking?.preparing?.timestamp), status: "completed" }] : []),
      ...(reached.ready ? [{ event: "Ready for pickup", timestamp: ts(order.tracking?.ready?.timestamp), status: "completed" }] : []),
      ...(reached.outForDelivery ? [{ event: "Out for delivery", timestamp: ts(order.tracking?.outForDelivery?.timestamp), status: "completed" }] : []),
      ...(reached.delivered ? [{ event: "Delivered", timestamp: ts(order.tracking?.delivered?.timestamp), status: "completed" }] : []),
      ...(statusLower.includes("cancel") ? [{ event: "Cancelled", timestamp: ts(order.cancelledAt), status: "rejected", reason: order.cancellationReason }] : []),
    ],
  };
}

function Section({ title, children, right }) {
  return (
    <View style={styles.section}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <Txt weight={700} style={{ fontSize: 15, color: palette.gray900 }}>{title}</Txt>
        {right}
      </View>
      {children}
    </View>
  );
}
const Row = ({ label, value, bold, color }) => (
  <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
    <Txt weight={bold ? 700 : 400} style={{ fontSize: 13, color: color || palette.gray600 }}>{label}</Txt>
    <Txt weight={bold ? 700 : 500} style={{ fontSize: 13, color: color || palette.gray900 }}>{value}</Txt>
  </View>
);

export default function OrderDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPayout, setShowPayout] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [marking, setMarking] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await restaurantAPI.getOrderById(String(id));
      const o = res?.data?.data?.order || res?.data?.data;
      if (!res?.data?.success || !o) throw new Error("Order not found");
      setOrder(transform(o));
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Failed to fetch order");
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    return addAppListener("restaurantOrderStatusUpdate", (e) => {
      const p = e?.detail || {};
      if ([p.orderMongoId, p.orderId, p._id].map(String).includes(String(id))) load();
    });
  }, [load, id]);

  const copyId = async () => {
    await Clipboard.setStringAsync(String(order?.id || ""));
    toast.success("Order ID copied");
  };
  const markReady = async () => {
    if (marking) return;
    setMarking(true);
    try {
      await restaurantAPI.markOrderReady(order.mongoId || order.id);
      toast.success(`Order ${order.id} marked ready`);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to mark order as ready");
    } finally {
      setMarking(false);
    }
  };

  if (loading) return <Screen bg={rt.pageBg}><PageHeader title="Order details" /><Spinner full /></Screen>;
  if (!order) {
    return (
      <Screen bg={rt.pageBg}>
        <PageHeader title="Order details" />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Txt weight={700} style={{ fontSize: 20, color: palette.gray900, marginBottom: 8 }}>Order Not Found</Txt>
          <Txt style={{ color: palette.gray500, textAlign: "center", marginBottom: 20 }}>{error || "The order you're looking for doesn't exist."}</Txt>
          <Pressable onPress={() => router.back()} style={styles.primaryBtn}>
            <Txt weight={700} style={{ color: palette.white }}>Back to Orders</Txt>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const b = order.billing;
  const isCancelled = order.statusLower.includes("cancel");
  return (
    <Screen bg={rt.pageBg}>
      <PageHeader title="Order details" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} colors={[rt.primary]} />}>
        <View style={styles.section}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Pressable onPress={copyId} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Txt weight={900} style={{ fontSize: 18, color: palette.gray900 }}>#{order.id}</Txt>
              <Copy size={14} color={palette.gray500} />
            </Pressable>
            <Txt weight={800} style={[styles.status, isCancelled ? { color: palette.red600, backgroundColor: palette.red50 } : { color: rt.primary, backgroundColor: rt.primarySoft }]}>{order.status.replace(/_/g, " ")}</Txt>
          </View>
          <Txt style={{ fontSize: 12, color: palette.gray500, marginTop: 4 }}>{order.date} • {order.time} • {order.restaurant}</Txt>
          {order.isPriority ? <Txt weight={900} style={styles.vip}>VIP PRIORITY • SERVE FIRST</Txt> : null}
          {order.restaurantNote ? (
            <View style={styles.note}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <FileText size={14} color={palette.blue600} />
                <Txt weight={700} style={{ fontSize: 11, color: "#1d4ed8" }}>NOTE FOR RESTAURANT</Txt>
              </View>
              <Txt weight={500} style={{ fontSize: 13, color: "#1e3a8a" }}>{order.restaurantNote}</Txt>
            </View>
          ) : null}
          {order.pickupOtp ? (
            <View style={styles.otp}>
              <Txt weight={700} style={{ fontSize: 10, color: "#047857", letterSpacing: 1 }}>PICKUP VERIFICATION OTP</Txt>
              <Txt weight={900} style={{ fontSize: 18, color: "#065f46", letterSpacing: 4 }}>{order.pickupOtp}</Txt>
            </View>
          ) : null}
          {order.statusLower === "preparing" ? (
            <Pressable onPress={markReady} disabled={marking} style={[styles.primaryBtn, { marginTop: 12, backgroundColor: rt.orderBrand }, marking && { opacity: 0.6 }]}>
              <Txt weight={900} style={{ color: palette.white, fontSize: 13 }}>{marking ? "..." : "MARK READY"}</Txt>
            </Pressable>
          ) : null}
        </View>

        <Section title="Customer details">
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={styles.avatar}><User size={18} color={palette.gray600} /></View>
            <View style={{ flex: 1 }}>
              <Txt weight={700} style={{ fontSize: 14, color: palette.gray900 }}>{order.customer.name}</Txt>
              <Txt style={{ fontSize: 12, color: palette.gray500 }}>{order.customer.orderCount} order{order.customer.orderCount === 1 ? "" : "s"} • {order.customer.distance}</Txt>
              <View style={{ flexDirection: "row", gap: 4, marginTop: 6 }}>
                <MapPin size={12} color="#f43f5e" style={{ marginTop: 2 }} />
                <Txt style={{ fontSize: 12, color: palette.gray600, flex: 1 }}>{order.customer.location}</Txt>
              </View>
            </View>
          </View>
        </Section>

        {order.deliveryPartner ? (
          <Section title="Delivery boy details">
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={[styles.avatar, { backgroundColor: palette.blue600 }]}><Bike size={18} color={palette.white} /></View>
              <View style={{ flex: 1 }}>
                <Txt weight={700} style={{ fontSize: 14, color: palette.gray900 }}>{order.deliveryPartner.name || order.deliveryPartner.fullName || "Delivery Partner"}</Txt>
                {order.deliveryPartner.vehicleNumber ? <Txt style={{ fontSize: 12, color: palette.gray500 }}>{order.deliveryPartner.vehicleNumber}</Txt> : null}
              </View>
              {order.deliveryPartner.phone ? (
                <Pressable onPress={() => Linking.openURL(`tel:${order.deliveryPartner.phone}`)} style={styles.callBtn}>
                  <Phone size={14} color="#1d4ed8" />
                  <Txt weight={700} style={{ fontSize: 12, color: "#1d4ed8" }}>Call Rider</Txt>
                </Pressable>
              ) : null}
            </View>
          </Section>
        ) : null}

        <Section title="Item details">
          {order.items.map((it, i) => (
            <View key={i} style={styles.item}>
              <AppImage src={it.image} style={styles.itemImg} width={160} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={[styles.vegBox, { borderColor: it.veg ? palette.green600 : palette.red600 }]}><View style={[styles.vegDot, { backgroundColor: it.veg ? palette.green600 : palette.red600 }]} /></View>
                  <Txt weight={600} style={{ fontSize: 13, color: palette.gray900, flex: 1 }}>{it.quantity} x {it.name}{it.variantName ? ` (${it.variantName})` : ""}</Txt>
                </View>
                {it.isCombo && it.comboItems.length ? (
                  <Txt style={{ fontSize: 11, color: palette.gray500, marginTop: 2 }}>
                    <Txt weight={700} style={{ fontSize: 11, color: rt.primary }}>Combo includes:</Txt> {it.comboItems.map((ci) => `${ci.quantity || 1} x ${ci.name}${ci.variantName ? ` (${ci.variantName})` : ""}`).join(", ")}
                  </Txt>
                ) : null}
              </View>
              <Txt weight={600} style={{ fontSize: 13, color: palette.gray900 }}>{money((Number(it.price) || 0) * (Number(it.quantity) || 1))}</Txt>
            </View>
          ))}
        </Section>

        <Section title="Restaurant Payout" right={<Txt weight={700} style={[styles.payTag, b.paymentStatus === "COD" ? { color: "#c2410c", backgroundColor: palette.orange50 } : { color: palette.green700, backgroundColor: palette.green50 }]}>{b.paymentStatus}</Txt>}>
          <Row label="Item subtotal" value={money(b.itemSubtotal)} />
          {b.packagingFee ? <Row label="Packaging fee" value={money(b.packagingFee)} /> : null}
          <Pressable onPress={() => setShowPayout((v) => !v)} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 6 }}>
            <Txt weight={600} style={{ fontSize: 12, color: rt.primary }}>{showPayout ? "Hide" : "Show"} deductions</Txt>
            {showPayout ? <ChevronUp size={14} color={rt.primary} /> : <ChevronDown size={14} color={rt.primary} />}
          </Pressable>
          {showPayout ? (
            <View style={{ paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: palette.gray100 }}>
              <Row label="Restaurant commission" value={`- ${money(b.restaurantCommission)}`} />
              <Row label="GST on item" value={`- ${money(b.gstOnItem)}`} />
              <Row label="GST on commission" value={`- ${money(b.gstOnCommission)}`} />
              <Row label="Payment gateway fee" value={`- ${money(b.paymentGatewayFee)}`} />
              {b.tcs ? <Row label="TCS" value={`- ${money(b.tcs)}`} /> : null}
            </View>
          ) : null}
          <View style={{ height: 1, backgroundColor: palette.gray100, marginVertical: 8 }} />
          <Row label="Restaurant gets" value={money(b.restaurantGets)} bold color={palette.green700} />
          <Row label="Customer paid" value={money(b.total)} />
        </Section>

        <Section title="Delivery Info">
          <Row label="Distance for this order" value={b.deliveryDistance ? `${b.deliveryDistance} km` : "-"} />
        </Section>

        <Section title="Order timeline">
          {order.timeline.map((t, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 10, paddingVertical: 6 }}>
              {t.status === "rejected" ? <XCircle size={18} color={palette.red500} /> : <CheckCircle2 size={18} color={palette.green600} />}
              <View style={{ flex: 1 }}>
                <Txt weight={600} style={{ fontSize: 13, color: palette.gray900 }}>{t.event}</Txt>
                {t.timestamp ? <Txt style={{ fontSize: 11, color: palette.gray500 }}>{t.timestamp}</Txt> : null}
                {t.reason ? <Txt style={{ fontSize: 11, color: palette.red600 }}>Reason: {t.reason}</Txt> : null}
              </View>
            </View>
          ))}
        </Section>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { backgroundColor: palette.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: palette.gray100 },
  status: { fontSize: 11, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: "hidden" },
  vip: { marginTop: 8, alignSelf: "flex-start", fontSize: 10, color: "#0f172a", backgroundColor: "#fbbf24", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: "hidden" },
  note: { marginTop: 12, backgroundColor: palette.blue50, borderWidth: 1, borderColor: "#bfdbfe", borderRadius: 10, padding: 10 },
  otp: { marginTop: 12, backgroundColor: "#ecfdf5", borderWidth: 1, borderColor: "#a7f3d0", borderRadius: 10, padding: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.gray100, alignItems: "center", justifyContent: "center" },
  callBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: palette.blue50 },
  item: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: palette.gray50 },
  itemImg: { width: 44, height: 44, borderRadius: 8 },
  vegBox: { width: 14, height: 14, borderWidth: 1.5, borderRadius: 2, alignItems: "center", justifyContent: "center" },
  vegDot: { width: 6, height: 6, borderRadius: 3 },
  payTag: { fontSize: 11, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: "hidden" },
  primaryBtn: { height: 46, paddingHorizontal: 20, borderRadius: 12, backgroundColor: rt.primary, alignItems: "center", justifyContent: "center" },
});
