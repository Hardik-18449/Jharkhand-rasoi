/** Past order details — port of pages/user/orders/UserOrderDetails.jsx */
import React, { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import Svg, { Path } from "react-native-svg";
import { ArrowLeft, ShoppingBag, Phone, Copy, Download, User, CreditCard, Calendar, MapPin, RotateCcw, FileText } from "lucide-react-native";
import Txt from "../../../src/components/ui/Txt";
import Screen from "../../../src/components/ui/Screen";
import AppImage from "../../../src/components/ui/AppImage";
import Button from "../../../src/components/ui/Button";
import RequireAuth from "../../../src/components/RequireAuth";
import { orderAPI, restaurantAPI } from "../../../src/api";
import { useCart } from "../../../src/context/CartContext";
import { loadBusinessSettings } from "../../../src/utils/businessSettings";
import { generateAndShareInvoice } from "../../../src/utils/invoicePdf";
import { toast } from "../../../src/utils/toast";
import { palette } from "../../../src/theme";

const isCancelled = (s) => s === "cancelled" || s === "cancelled_by_restaurant" || s === "restaurant_cancelled" || String(s || "").includes("cancel");

function OrderDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { replaceCart } = useCart();
  const { orderId } = useLocalSearchParams();
  const [order, setOrder] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const goOrders = () => router.replace("/orders");
  const goBack = () => (router.canGoBack() ? router.back() : goOrders());

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const r = await orderAPI.getOrderDetails(String(orderId));
        let data = null;
        if (r?.data?.success && r.data.data?.order) data = r.data.data.order;
        else if (r?.data?.success && r.data?.data && (r.data.data._id || r.data.data.orderId || r.data.data.id)) data = r.data.data;
        else if (r?.data?.order && typeof r.data.order === "object") data = r.data.order;
        else {
          toast.error("Order not found");
          goOrders();
          return;
        }
        setOrder(data);
        const rid = data.restaurantId;
        if (rid && typeof rid === "string" && !data.restaurant) {
          try {
            const rr = await restaurantAPI.getRestaurantById(rid);
            setRestaurant(rr?.data?.data?.restaurant || rr?.data?.restaurant || null);
          } catch {}
        }
      } catch (e) {
        toast.error(e?.response?.data?.message || "Failed to load order details");
        goOrders();
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  if (loading) {
    return (
      <Screen bg={palette.gray50}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Txt weight={400} style={{ fontSize: 14, color: palette.gray600 }}>Loading order details...</Txt>
        </View>
      </Screen>
    );
  }
  if (!order) {
    return (
      <Screen bg={palette.gray50}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <Txt weight={500} style={{ fontSize: 14, color: palette.gray700 }}>Order not found</Txt>
          <Button title="Back to Orders" rounded="md" size="sm" onPress={goOrders} />
        </View>
      </Screen>
    );
  }

  const orderIdDisplay = order.orderId || order._id || orderId;
  const restaurantObj = restaurant || (typeof order.restaurantId === "object" ? order.restaurantId : null) || order.restaurant || {};
  const restaurantName = order.restaurantId?.restaurantName || order.restaurantId?.name || order.restaurantName || restaurantObj.restaurantName || restaurantObj.name || "Restaurant";
  const restaurantLocation = (() => {
    const loc = restaurantObj.location || {};
    if (restaurantObj.address) return restaurantObj.address;
    if (loc.formattedAddress) return loc.formattedAddress;
    if (loc.address) return loc.address;
    if (loc.street || loc.city) {
      const p = [loc.street, loc.area, loc.city, loc.state, loc.zipCode || loc.pincode || loc.postalCode].filter(Boolean);
      if (p.length) return p.join(", ");
    }
    if (loc.addressLine1) {
      const p = [loc.addressLine1, loc.addressLine2, loc.city, loc.state].filter(Boolean);
      if (p.length) return p.join(", ");
    }
    return order.restaurantAddress || "Address not available";
  })();
  const items = Array.isArray(order.items) ? order.items : [];
  const pricing = order.pricing || {};
  const sendsCutlery = order.sendCutlery !== false;
  const userName = order.userName || "";
  const userPhone = order.userPhone || "";
  const paymentMethod = order.payment?.method || "Online";
  const paymentDate = order.createdAt ? new Date(order.createdAt).toLocaleString("en-IN", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "";
  const da = order.deliveryAddress || order.address || {};
  const addressText = da.formattedAddress || da.address || [da.addressLine1, da.addressLine2, da.street, da.area, da.city, da.state, da.zipCode || da.pincode || da.postalCode].filter(Boolean).join(", ");
  const savings = (pricing.discount || 0) + (pricing.originalItemTotal || 0) - (pricing.subtotal || 0);
  const restaurantPhone = restaurantObj.primaryContactNumber || restaurantObj.phone || restaurantObj.contactNumber || order.restaurantPhone || "";

  const handleCopyOrderId = async () => {
    try {
      await Clipboard.setStringAsync(String(orderIdDisplay));
      toast.success("Order ID copied");
    } catch {
      toast.error("Failed to copy Order ID");
    }
  };
  const handleCallRestaurant = () => {
    if (!restaurantPhone) return toast.error("Restaurant phone number not available");
    Linking.openURL(`tel:${restaurantPhone}`).catch(() => {});
    return undefined;
  };
  const handleDownloadSummary = async () => {
    try {
      toast.info("Generating invoice...");
      let settings = {};
      try {
        settings = (await loadBusinessSettings()) || {};
      } catch {}
      await generateAndShareInvoice({ settings, restaurantName, restaurantLocation, restaurantObj, order, orderIdDisplay, paymentDate, paymentMethod, userName, addressText, items, pricing });
      toast.success("Invoice downloaded successfully!");
    } catch {
      toast.error("Failed to download invoice");
    }
  };
  const handleReorder = () => {
    const target = restaurantObj.slug || restaurantObj._id || restaurantObj.restaurantId || (typeof order?.restaurantId === "string" ? order.restaurantId : order?.restaurantId?._id);
    if (!target || !items.length) return toast.error("Order items or restaurant information not available");
    const reorderItems = items
      .map((item, index) => {
        const itemId = item.id || item.itemId || item._id;
        if (!itemId) return null;
        return {
          id: itemId,
          name: item.name || item.foodName || "Item",
          price: Number(item.price) || 0,
          originalPrice: Math.max(Number(item.price) || 0, Number(item.originalPrice) || 0),
          image: item.image || "",
          restaurant: restaurantName,
          restaurantId: restaurantObj._id || restaurantObj.restaurantId || (typeof order?.restaurantId === "string" ? order.restaurantId : order?.restaurantId?._id),
          description: item.description || "",
          isVeg: item.isVeg === true || item.foodType === "Veg",
          quantity: Math.max(1, Number(item.quantity || item.qty) || 1),
          reorderIndex: index,
        };
      })
      .filter(Boolean);
    if (!reorderItems.length) return toast.error("No reorderable items found in this order");
    replaceCart(reorderItems);
    toast.success("Items added to cart");
    router.push(`/restaurants/${target}`);
    return undefined;
  };
  const cancelled = isCancelled(order.status);

  return (
    <Screen bg={palette.gray50}>
      <View style={styles.header}>
        <Pressable onPress={goBack} style={{ padding: 4 }}><ArrowLeft size={24} color={palette.gray700} /></Pressable>
        <Txt weight={600} style={{ fontSize: 18, color: palette.gray800 }}>Order Details</Txt>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 110 + insets.bottom }}>
        <View style={[styles.card, { flexDirection: "row", alignItems: "flex-start", gap: 12 }]}>
          <View style={{ backgroundColor: palette.gray100, padding: 8, borderRadius: 8 }}><ShoppingBag size={24} color={palette.gray600} /></View>
          <View style={{ flex: 1 }}>
            <Txt weight={600} style={{ fontSize: 16, color: palette.gray800 }}>{order.status === "delivered" ? "Order was delivered" : cancelled ? "Order was cancelled" : "Order status: " + (order.status || "Processing")}</Txt>
            {cancelled ? (
              <View style={styles.cancelBox}>
                <Txt weight={700} style={{ fontSize: 14, color: "#b91c1c", marginBottom: 4 }}>Cancellation Reason:</Txt>
                <Txt weight={500} style={{ fontSize: 14, color: palette.red600 }}>{order.cancellationReason || "The restaurant was unable to fulfill this order."}</Txt>
                <Txt weight={400} style={{ fontSize: 10, color: palette.gray500, marginTop: 8 }}>Refund will be initiated to your source payment method.</Txt>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.card}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
              <AppImage src={items[0]?.image || restaurantObj.profileImage?.url || restaurantObj.profileImage || order.restaurantImage || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=100&q=80"} style={{ width: 40, height: 40, borderRadius: 8 }} width={120} />
              <View style={{ flex: 1 }}>
                <Txt weight={600} style={{ fontSize: 16, color: palette.gray800 }}>{restaurantName}</Txt>
                <Txt weight={400} style={{ fontSize: 12, color: palette.gray500 }}>{restaurantLocation}</Txt>
              </View>
            </View>
            <Pressable onPress={handleCallRestaurant} style={styles.callBtn}><Phone size={16} color={palette.amber600} /></Pressable>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Txt weight={500} style={{ fontSize: 12, color: palette.gray500, letterSpacing: 0.5 }}>ORDER ID: #{String(orderIdDisplay).toUpperCase()}</Txt>
            <Pressable onPress={handleCopyOrderId} hitSlop={8}><Copy size={12} color={palette.gray400} /></Pressable>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            <View style={[styles.tag, sendsCutlery ? { backgroundColor: "#ecfdf5", borderColor: "#a7f3d0" } : { backgroundColor: palette.orange50, borderColor: palette.orange200 }]}>
              <Txt weight={600} style={{ fontSize: 12, color: sendsCutlery ? "#047857" : "#c2410c" }}>{sendsCutlery ? "Send cutlery" : "Don't send cutlery"}</Txt>
            </View>
            {order.note ? (
              <View style={[styles.tag, { backgroundColor: palette.blue50, borderColor: "#bfdbfe" }]}>
                <Txt weight={600} style={{ fontSize: 12, color: "#1d4ed8" }}>Note: {order.note}</Txt>
              </View>
            ) : null}
          </View>
          <View style={{ borderTopWidth: 1, borderStyle: "dashed", borderColor: palette.gray200, marginVertical: 12 }} />
          {items.map((item, idx) => {
            const dp = Number(item.price) || 0;
            const op = Math.max(dp, Number(item.originalPrice) || 0);
            const disc = op > dp;
            const veg = item.isVeg === true || item.foodType === "Veg";
            return (
              <View key={idx} style={{ flexDirection: "row", justifyContent: "space-between", marginTop: idx ? 16 : 0, gap: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                  {item.image ? <AppImage src={item.image} style={{ width: 64, height: 64, borderRadius: 12, borderWidth: 1, borderColor: palette.gray100 }} width={200} /> : null}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={{ width: 12, height: 12, borderWidth: 1, borderColor: veg ? palette.green600 : palette.red600, padding: 1 }}><View style={{ flex: 1, borderRadius: 6, backgroundColor: veg ? palette.green600 : palette.red600 }} /></View>
                      <Txt weight={500} style={{ fontSize: 14, color: palette.gray700, flex: 1 }}>{item.quantity || item.qty || 1} x {item.name}{item.variantName ? ` (${item.variantName})` : ""}</Txt>
                    </View>
                    {item.isCombo && Array.isArray(item.comboItems) && item.comboItems.length ? <Txt weight={400} style={{ fontSize: 12, color: palette.gray500, marginTop: 2 }}>Combo: {item.comboItems.map((ci) => `${ci.quantity || 1} x ${ci.name}`).join(", ")}</Txt> : null}
                  </View>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  {disc ? <Txt weight={400} style={{ fontSize: 12, color: palette.gray400, textDecorationLine: "line-through" }}>₹{op.toFixed(2)}</Txt> : null}
                  <Txt weight={500} style={{ fontSize: 14, color: disc ? palette.green600 : palette.gray800 }}>₹{dp.toFixed(2)}</Txt>
                </View>
              </View>
            );
          })}
        </View>

        <View style={[styles.card, { padding: 0, overflow: "hidden" }]}>
          <View style={{ padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderColor: palette.gray100 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <FileText size={20} color={palette.gray600} />
              <Txt weight={600} style={{ fontSize: 16, color: palette.gray800 }}>Bill Summary</Txt>
            </View>
            <Pressable onPress={handleDownloadSummary} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(254,198,0,0.12)", alignItems: "center", justifyContent: "center" }}><Download size={16} color={palette.amber600} /></Pressable>
          </View>
          <View style={{ padding: 16, gap: 8 }}>
            <View style={styles.row}>
              <Txt weight={400} style={styles.lbl}>Item total</Txt>
              <View style={{ flexDirection: "row" }}>
                {pricing.originalItemTotal ? <Txt weight={400} style={{ fontSize: 14, color: palette.gray400, textDecorationLine: "line-through", marginRight: 4 }}>₹{Number(pricing.originalItemTotal).toFixed(2)}</Txt> : null}
                <Txt weight={400} style={styles.val}>₹{Number(pricing.subtotal || pricing.total || 0).toFixed(2)}</Txt>
              </View>
            </View>
            <View style={styles.row}>
              <Txt weight={400} style={styles.lbl}>GST (govt. taxes)</Txt>
              <Txt weight={400} style={styles.val}>₹{Number(pricing.tax || 0).toFixed(2)}</Txt>
            </View>
            <View style={styles.row}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Txt weight={500} style={[styles.lbl, { color: palette.gray400 }]}>Delivery fee</Txt>
                {pricing.deliveryFee === 0 ? <View style={{ borderWidth: 1, borderColor: palette.amber600, paddingHorizontal: 4, borderRadius: 4, marginLeft: 4 }}><Txt weight={700} style={{ fontSize: 10, color: palette.amber600 }}>FREE</Txt></View> : null}
              </View>
              <Txt weight={500} style={{ fontSize: 14, color: palette.amber600, textTransform: "uppercase" }}>{pricing.deliveryFee ? `₹${Number(pricing.deliveryFee).toFixed(2)}` : "Free"}</Txt>
            </View>
            <View style={styles.row}>
              <Txt weight={400} style={styles.lbl}>Platform fee</Txt>
              <Txt weight={400} style={styles.val}>₹{Number(pricing.platformFee || 0).toFixed(2)}</Txt>
            </View>
            <View style={[styles.row, { borderTopWidth: 1, borderColor: palette.gray100, marginTop: 8, paddingTop: 8 }]}>
              <Txt weight={700} style={{ fontSize: 14, color: palette.gray800 }}>Paid</Txt>
              <Txt weight={700} style={{ fontSize: 14, color: palette.gray800 }}>₹{Number(pricing.total || 0).toFixed(2)}</Txt>
            </View>
          </View>
          {savings > 0 ? (
            <View style={{ backgroundColor: "rgba(254,198,0,0.06)", padding: 12, paddingBottom: 16, marginTop: 8 }}>
              <Svg width="100%" height={8} viewBox="0 0 1200 120" preserveAspectRatio="none" style={{ position: "absolute", top: -6, left: 0, right: 0 }}>
                <Path fill="#ffffff" d="M0,0V46.29c47,0,47,69.5,94,69.5s47-69.5,94-69.5,47,69.5,94,69.5,47-69.5,94-69.5,47,69.5,94,69.5,47-69.5,94-69.5,47,69.5,94,69.5,47-69.5,94-69.5,47,69.5,94,69.5V0Z" />
              </Svg>
              <Txt weight={700} style={{ fontSize: 14, color: palette.amber600, textAlign: "center", paddingTop: 4 }}>You saved ₹{Number(savings).toFixed(2)} on this order!</Txt>
            </View>
          ) : null}
        </View>

        <View style={[styles.card, { gap: 20 }]}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: palette.gray200, alignItems: "center", justifyContent: "center" }}><User size={20} color={palette.gray500} /></View>
            <View>
              <Txt weight={600} style={{ fontSize: 14, color: palette.gray800 }}>{userName || "Customer"}</Txt>
              <Txt weight={400} style={{ fontSize: 12, color: palette.gray500 }}>{userPhone}</Txt>
            </View>
          </View>
          <InfoRow Icon={CreditCard} title="Payment method" text={`Paid via: ${String(paymentMethod).toUpperCase()}`} />
          <InfoRow Icon={Calendar} title="Payment date" text={paymentDate} />
          <InfoRow Icon={MapPin} title="Delivery address" text={addressText || "Address not available"} />
        </View>

        <Pressable
          onPress={() => {
            const mongoId = order._id || orderId;
            if (!mongoId) return toast.error("Order ID not available. Please refresh the page.");
            router.push(`/complaints/submit/${encodeURIComponent(String(mongoId))}`);
            return undefined;
          }}
          style={styles.complaintBtn}
        >
          <FileText size={16} color={palette.amber600} />
          <Txt weight={600} style={{ fontSize: 14, color: palette.amber600 }}>Restaurant Complaint</Txt>
        </Pressable>
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: 16 + insets.bottom }]}>
        <Pressable onPress={handleReorder} style={[styles.bottomBtn, { backgroundColor: palette.yellow }]}>
          <RotateCcw size={16} color={palette.black} />
          <Txt weight={600} style={{ fontSize: 14, color: palette.black }}>Reorder</Txt>
        </Pressable>
        <Pressable onPress={handleDownloadSummary} style={[styles.bottomBtn, { backgroundColor: palette.white, borderWidth: 1, borderColor: palette.yellow }]}>
          <Download size={16} color={palette.amber600} />
          <Txt weight={600} style={{ fontSize: 14, color: palette.amber600 }}>Invoice</Txt>
        </Pressable>
      </View>
    </Screen>
  );
}

function InfoRow({ Icon, title, text }) {
  return (
    <View style={{ flexDirection: "row", gap: 12 }}>
      <Icon size={20} color={palette.gray500} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Txt weight={600} style={{ fontSize: 14, color: palette.gray800 }}>{title}</Txt>
        <Txt weight={400} style={{ fontSize: 12, color: palette.gray500, marginTop: 2, lineHeight: 18 }}>{text}</Txt>
      </View>
    </View>
  );
}

export default function OrderDetailsRoute() {
  return (
    <RequireAuth>
      <OrderDetailsScreen />
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, backgroundColor: palette.white, borderBottomWidth: 1, borderColor: palette.gray200, elevation: 1 },
  card: { backgroundColor: palette.white, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: palette.gray100, elevation: 1 },
  cancelBox: { marginTop: 8, padding: 12, backgroundColor: palette.red50, borderWidth: 1, borderColor: palette.red100, borderRadius: 12 },
  callBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: "rgba(254,198,0,0.3)", alignItems: "center", justifyContent: "center" },
  tag: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  lbl: { fontSize: 14, color: palette.gray500 },
  val: { fontSize: 14, color: palette.gray800 },
  complaintBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 8, backgroundColor: "rgba(254,198,0,0.06)", borderWidth: 1, borderColor: "rgba(254,198,0,0.2)" },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: palette.white, borderTopWidth: 1, borderColor: palette.gray200, padding: 16, flexDirection: "row", gap: 12 },
  bottomBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 8 },
});
