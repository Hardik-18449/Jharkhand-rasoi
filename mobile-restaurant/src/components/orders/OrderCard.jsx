/** Port of OrdersMain.jsx `OrderCard` + components/restaurant/ResendNotificationButton.jsx + `transformOrderForList`. */
import React, { useState } from "react";
import { ActivityIndicator, Image, Linking, Pressable, StyleSheet, View } from "react-native";
import { Calendar, MapPin, Bike, Phone, Volume2 } from "lucide-react-native";
import Txt from "../ui/Txt";
import { restaurantAPI } from "../../api";
import { toast } from "../../utils/toast";
import { palette, rt } from "../../theme";

const BRAND = rt.orderBrand;

const getAllOrdersTimestamp = (o) => o?.cancelledAt || o?.deliveredAt || o?.updatedAt || o?.createdAt || new Date().toISOString();

export const formatShortDateTime = (d) =>
  new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

/** web transformOrderForList */
export function transformOrderForList(order) {
  const rawPartner = order.deliveryPartner || order.dispatch?.deliveryPartnerId;
  const partnerObj = rawPartner && typeof rawPartner === "object" ? rawPartner : null;
  let deliveryAddressStr = null;
  const addr = order.deliveryAddress || order.address;
  if (typeof addr === "string") deliveryAddressStr = addr;
  else if (addr && typeof addr === "object") {
    const parts = [addr.street, addr.additionalDetails, addr.area, addr.city].filter(Boolean);
    deliveryAddressStr = parts.length ? parts.join(", ") : addr.formattedAddress || addr.address || null;
  }
  return {
    orderId: order.orderId || order._id,
    mongoId: order._id,
    status: order.status || "pending",
    customerName: order.userId?.name || order.customerName || "Customer",
    customerPhone: order.userId?.phone || order.customerPhone || order.deliveryAddress?.phone || null,
    type: "Home Delivery",
    timePlaced: formatShortDateTime(getAllOrdersTimestamp(order)),
    eta: null,
    itemsSummary: order.items?.map((i) => `${i.quantity}x ${i.name}`).join(", ") || "No items",
    photoUrl: order.items?.[0]?.image || null,
    photoAlt: order.items?.[0]?.name || "Order",
    paymentMethod: order.paymentMethod || order.payment?.method || null,
    deliveryPartnerId: partnerObj ? partnerObj._id || partnerObj.id : order.deliveryPartnerId || null,
    deliveryPartner: partnerObj
      ? {
          _id: partnerObj._id || partnerObj.id,
          name: partnerObj.name || partnerObj.fullName || "Delivery Partner",
          phone: partnerObj.phone || partnerObj.phoneNumber || "",
          vehicleNumber: partnerObj.vehicleNumber || "",
        }
      : null,
    deliveryAddress: deliveryAddressStr,
    dispatchStatus: order.dispatch?.status || null,
    preparingTimestamp: order.tracking?.preparing?.timestamp ? new Date(order.tracking.preparing.timestamp) : new Date(order.createdAt || Date.now()),
    initialETA: order.estimatedDeliveryTime || 30,
    sortTimestamp: new Date(getAllOrdersTimestamp(order)).getTime(),
    scheduledAt: order.scheduledAt || null,
    restaurantNote: order.restaurantNote || null,
    pickupOtp: order.pickupOtp || null,
    cancellationReason: order.cancellationReason || order.cancelReason || null,
    rejectionReason: order.rejectionReason || null,
    isPriority: Boolean(order.isPriority || order.customerSubscription?.isSubscribed),
    customerSubscription: order.customerSubscription || (order.userId?.isSubscribed ? { isSubscribed: true, planName: order.userId?.subscriptionPlanName, badgeText: order.userId?.subscriptionBadge || "VIP" } : null),
  };
}

export function ResendNotificationButton({ orderId, mongoId, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const handleResend = async () => {
    if (loading) return;
    try {
      setLoading(true);
      const res = await restaurantAPI.resendDeliveryNotification(mongoId || orderId);
      if (res.data?.success) {
        const d = res.data.data || {};
        const notified = Number(d.notifiedCount || 0);
        const shortlisted = Number(d.shortlistedCount || 0);
        const radius = d.searchRadiusKm ? ` within ${d.searchRadiusKm} km` : "";
        const live = d.connectedSocketCount != null ? ` (live sockets: ${d.connectedSocketCount})` : "";
        if (notified > 0) toast.success(`Notification sent to ${notified} delivery partner${notified === 1 ? "" : "s"}${radius}${live}`);
        else
          toast.warning(
            shortlisted > 0
              ? `No delivery partners received the alert${radius}. Shortlisted: ${shortlisted}${d.connectedSocketCount != null ? `, live sockets: ${d.connectedSocketCount}` : ""}.`
              : `No free online delivery partners found in this zone${radius}.`,
          );
        onSuccess?.();
      } else toast.error(res.data?.message || "Failed to send notification");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to send notification. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <Pressable onPress={handleResend} disabled={loading} style={[styles.resend, loading && { opacity: 0.5 }]} hitSlop={6}>
      {loading ? <ActivityIndicator size={10} color="#1d4ed8" /> : <Volume2 size={11} color="#1d4ed8" />}
      <Txt weight={500} style={{ fontSize: 10, color: "#1d4ed8" }}>{loading ? "Sending..." : "Resend"}</Txt>
    </Pressable>
  );
}

export default function OrderCard({ order, onSelect, onMarkReady, isMarkingReady = false, onRefresh }) {
  const { orderId, mongoId, status, customerName, type, timePlaced, eta, itemsSummary, photoUrl, photoAlt, deliveryPartner, deliveryAddress, scheduledAt, restaurantNote, pickupOtp, isPriority, customerSubscription } = order;
  const s = String(status || "").toLowerCase();
  const isReady = s === "ready";
  const isPreparing = s === "preparing";
  let statusLabel = String(status || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  if (s === "confirmed" || s === "created") statusLabel = "Pending";
  const badgeStyle = isReady ? [styles.badgeEmerald, { color: "#059669" }] : s === "confirmed" ? [styles.badgeAmber, { color: "#d97706" }] : [styles.badgeSlate, { color: palette.slate500 }];

  return (
    <View style={[styles.card, isPriority && styles.cardPriority]}>
      <View style={[styles.stripe, { backgroundColor: isPriority ? "#F59E0B" : BRAND }]} />
      {isPriority ? (
        <View style={styles.vip}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Txt weight={900} style={styles.vipChip}>VIP</Txt>
            <Txt weight={900} style={{ fontSize: 10, color: "#0f172a", letterSpacing: 1 }}>VIP PRIORITY • SERVE FIRST</Txt>
          </View>
          <Txt weight={900} style={styles.vipPlan}>{customerSubscription?.badgeText || customerSubscription?.planName || "VIP Member"}</Txt>
        </View>
      ) : null}

      <Pressable onPress={() => onSelect?.(order)} style={styles.row}>
        <View style={styles.photo}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={{ width: "100%", height: "100%" }} />
          ) : (
            <Txt weight={700} numberOfLines={3} style={styles.photoAlt}>{String(photoAlt || "").toUpperCase()}</Txt>
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.topRow}>
            <Txt weight={900} numberOfLines={1} style={{ fontSize: 13, color: "#0f172a", flexShrink: 1 }}>
              #<Txt weight={900} style={{ fontSize: 13, color: BRAND }}>{orderId}</Txt>
            </Txt>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              {scheduledAt ? (
                <View style={styles.schedChip}>
                  <Calendar size={9} color={palette.green600} />
                  <Txt weight={900} style={{ fontSize: 8, color: palette.green600 }}>SCHEDULED</Txt>
                </View>
              ) : null}
              <Txt weight={900} style={[styles.badge, ...badgeStyle]}>{statusLabel.toUpperCase()}</Txt>
            </View>
          </View>
          <View style={styles.metaRow}>
            <Txt weight={700} numberOfLines={1} style={[styles.meta, { maxWidth: "60%" }]}>{String(customerName).toUpperCase()}</Txt>
            <Txt weight={700} style={styles.meta}>{String(type).toUpperCase()}</Txt>
          </View>
          {deliveryAddress ? (
            <View style={styles.addrRow}>
              <MapPin size={10} color="#f43f5e" />
              <Txt weight={500} numberOfLines={1} style={{ fontSize: 9, color: palette.slate500, flex: 1 }}>{deliveryAddress}</Txt>
            </View>
          ) : null}
          {deliveryPartner ? (
            <View style={styles.rider}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                <View style={styles.riderIcon}>
                  <Bike size={10} color={palette.white} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt weight={700} numberOfLines={1} style={{ fontSize: 9, color: "#0f172a" }}>{deliveryPartner.name || "Assigned Rider"}</Txt>
                  {deliveryPartner.vehicleNumber ? <Txt style={{ fontSize: 8, color: palette.slate500 }}>{deliveryPartner.vehicleNumber}</Txt> : null}
                </View>
              </View>
              {deliveryPartner.phone ? (
                <Pressable onPress={() => Linking.openURL(`tel:${deliveryPartner.phone}`)} style={styles.callBtn} hitSlop={6}>
                  <Phone size={9} color="#1d4ed8" />
                  <Txt weight={700} style={{ fontSize: 8, color: "#1d4ed8" }}>Call</Txt>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          <Txt weight={700} numberOfLines={1} style={styles.items}>{itemsSummary}</Txt>
          {restaurantNote ? (
            <View style={styles.note}>
              <Txt weight={700} numberOfLines={1} style={{ fontSize: 9, color: "#1d4ed8", fontStyle: "italic" }}>Note: {restaurantNote}</Txt>
            </View>
          ) : null}
          {pickupOtp ? (
            <View style={styles.otp}>
              <Txt weight={700} style={{ fontSize: 9, color: "#047857" }}>PICKUP OTP</Txt>
              <Txt weight={900} style={{ fontSize: 13, color: "#065f46", letterSpacing: 2.6 }}>{pickupOtp}</Txt>
            </View>
          ) : (isReady || isPreparing || s === "confirmed") && type === "Home Delivery" ? (
            <View style={styles.otpWait}>
              <Txt weight={700} style={{ fontSize: 8, color: palette.gray500, letterSpacing: 1 }}>OTP SHOWN UPON RIDER ARRIVAL</Txt>
            </View>
          ) : null}

          <View style={styles.bottomRow}>
            {scheduledAt ? (
              <View>
                <Txt weight={700} style={{ fontSize: 8, color: palette.green600 }}>SCHEDULED FOR</Txt>
                <Txt weight={900} style={{ fontSize: 10, color: palette.green700 }}>{new Date(scheduledAt).toLocaleString("en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}</Txt>
              </View>
            ) : (
              <View>
                {!isReady && eta ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Txt weight={700} style={{ fontSize: 8, color: palette.slate400 || palette.gray400 }}>ETA</Txt>
                    <Txt weight={900} style={{ fontSize: 11, color: palette.slate800 }}>{eta}</Txt>
                  </View>
                ) : null}
                <Txt weight={700} style={{ fontSize: 8, color: palette.gray300 }}>{String(timePlaced || "").toUpperCase()}</Txt>
              </View>
            )}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              {isPreparing && onMarkReady ? (
                <Pressable onPress={() => onMarkReady(order)} disabled={isMarkingReady} style={[styles.readyBtn, isMarkingReady && { opacity: 0.5 }]}>
                  <Txt weight={900} style={{ fontSize: 10, color: palette.white }}>{isMarkingReady ? "..." : "MARK READY"}</Txt>
                </Pressable>
              ) : null}
              {isReady ? (
                deliveryPartner ? (
                  <View style={styles.pillEmerald}>
                    <View style={[styles.pillDot, { backgroundColor: palette.emerald500 }]} />
                    <Txt weight={700} style={{ fontSize: 8, color: "#047857" }}>RIDER ASSIGNED</Txt>
                  </View>
                ) : (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Txt weight={900} style={styles.searching}>SEARCHING RIDER</Txt>
                    <ResendNotificationButton orderId={orderId} mongoId={mongoId} onSuccess={onRefresh} />
                  </View>
                )
              ) : null}
              {s === "out_for_delivery" || s === "picked_up" ? (
                <View style={styles.pillBlue}>
                  <View style={[styles.pillDot, { backgroundColor: palette.blue500 }]} />
                  <Txt weight={700} style={{ fontSize: 8, color: "#1d4ed8" }}>ON THE WAY</Txt>
                </View>
              ) : null}
              {s === "delivered" ? (
                <View style={styles.pillSlate}>
                  <Txt weight={700} style={{ fontSize: 8, color: palette.gray600 }}>DELIVERED</Txt>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: palette.white, borderRadius: 16, padding: 12, paddingLeft: 14, marginBottom: 12, overflow: "hidden", borderWidth: 1, borderColor: palette.gray100, elevation: 1 },
  cardPriority: { borderWidth: 2, borderColor: "#fbbf24", backgroundColor: "#fffdf5", elevation: 3 },
  stripe: { position: "absolute", top: 0, left: 0, bottom: 0, width: 6 },
  vip: { marginBottom: 8, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: "#fbbf24", borderRadius: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: "#fcd34d" },
  vipChip: { fontSize: 10, color: palette.white, backgroundColor: "rgba(0,0,0,0.25)", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, overflow: "hidden" },
  vipPlan: { fontSize: 9, color: palette.white, backgroundColor: "rgba(0,0,0,0.2)", paddingHorizontal: 8, paddingVertical: 1, borderRadius: 999, overflow: "hidden" },
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start", paddingLeft: 4 },
  photo: { width: 56, height: 56, borderRadius: 8, overflow: "hidden", backgroundColor: "#f8fafc", borderWidth: 1, borderColor: palette.slate100, marginTop: 2, alignItems: "center", justifyContent: "center", padding: 2 },
  photoAlt: { fontSize: 8, color: palette.gray300, textAlign: "center" },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 },
  schedChip: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, backgroundColor: palette.green50, borderWidth: 1, borderColor: palette.green100 },
  badge: { fontSize: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, borderWidth: 1, overflow: "hidden", letterSpacing: 0.8 },
  badgeEmerald: { backgroundColor: "#ecfdf5", borderColor: "#d1fae5" },
  badgeAmber: { backgroundColor: "#fffbeb", borderColor: "#fef3c7" },
  badgeSlate: { backgroundColor: "#f8fafc", borderColor: palette.slate100 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  meta: { fontSize: 9, color: palette.gray400 },
  addrRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
  rider: { marginBottom: 6, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: "#eff6ffe6", borderWidth: 1, borderColor: "#bfdbfecc", borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 4 },
  riderIcon: { width: 16, height: 16, borderRadius: 8, backgroundColor: palette.blue600, alignItems: "center", justifyContent: "center" },
  callBtn: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: palette.white, borderWidth: 1, borderColor: "#bfdbfe", borderRadius: 4 },
  items: { fontSize: 10, color: palette.gray600, fontStyle: "italic", marginBottom: 4 },
  note: { marginBottom: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: palette.blue50, borderWidth: 1, borderColor: palette.blue100, borderRadius: 6 },
  otp: { marginBottom: 8, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: "#ecfdf5", borderWidth: 1, borderColor: "#d1fae5", borderRadius: 4, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  otpWait: { marginBottom: 8, paddingVertical: 4, backgroundColor: palette.gray50, borderWidth: 1, borderColor: palette.gray100, borderRadius: 4, alignItems: "center" },
  bottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#f8fafc" },
  readyBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: BRAND },
  pillEmerald: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, backgroundColor: "#ecfdf5", borderWidth: 1, borderColor: "#a7f3d0" },
  pillBlue: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, backgroundColor: palette.blue50, borderWidth: 1, borderColor: "#bfdbfe" },
  pillSlate: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: palette.slate200 },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  searching: { fontSize: 8, color: "#b45309", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: "#fffbeb", borderWidth: 1, borderColor: "#fde68a", overflow: "hidden" },
  resend: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: palette.blue100, borderWidth: 1, borderColor: "#93c5fd" },
});
