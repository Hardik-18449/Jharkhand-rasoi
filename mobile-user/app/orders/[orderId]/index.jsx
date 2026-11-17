/** Live order tracking — port of pages/user/orders/OrderTracking.jsx */
import React, { Component, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Linking, Pressable, ScrollView, StyleSheet, TextInput, Vibration, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Svg, { Circle, Path } from "react-native-svg";
import { ArrowLeft, Share2, Star, RefreshCw, Phone, User, ChevronRight, MessageSquare, X, Check, Shield, ShieldCheck, Receipt, Clock, Calendar } from "lucide-react-native";
import Txt from "../../../src/components/ui/Txt";
import Screen from "../../../src/components/ui/Screen";
import BottomSheet from "../../../src/components/ui/BottomSheet";
import Button from "../../../src/components/ui/Button";
import RequireAuth from "../../../src/components/RequireAuth";
import DeliveryTrackingMap from "../../../src/components/DeliveryTrackingMap";
import { shareLink, WEB_ORIGIN } from "../../../src/components/ui/ShareSheet";
import { useOrders } from "../../../src/context/OrdersContext";
import { useProfile } from "../../../src/context/ProfileContext";
import { useAppLocation } from "../../../src/context/LocationProvider";
import { useUserNotifications } from "../../../src/context/UserNotificationContext";
import { orderAPI, restaurantAPI } from "../../../src/api";
import { useCompanyName } from "../../../src/hooks/useCompanyName";
import { patchOrderFromSocketPayload, socketPayloadNeedsRefetch } from "../../../src/utils/orderSocketPatch";
import { isUserSocketConnected } from "../../../src/utils/userSocketManager";
import { addAppListener } from "../../../src/utils/events";
import { toast } from "../../../src/utils/toast";
import { palette, fonts } from "../../../src/theme";

/* ---------- pure helpers (verbatim logic from web) ---------- */
const getRestaurantCoordsFromOrder = (o, fallback = null) => {
  if (Array.isArray(o?.restaurantId?.location?.coordinates) && o.restaurantId.location.coordinates.length >= 2) return o.restaurantId.location.coordinates;
  if (o?.restaurantId?.location?.latitude && o?.restaurantId?.location?.longitude) return [o.restaurantId.location.longitude, o.restaurantId.location.latitude];
  if (Array.isArray(o?.restaurant?.location?.coordinates) && o.restaurant.location.coordinates.length >= 2) return o.restaurant.location.coordinates;
  return fallback || null;
};
const getRestaurantAddressFromOrder = (o, prev = null, explicit = null) => {
  if (explicit && String(explicit).trim()) return String(explicit).trim();
  const l = o?.restaurantId?.location || o?.restaurant?.location || {};
  for (const k of ["formattedAddress", "address", "addressLine1"]) if (l?.[k] && String(l[k]).trim()) return String(l[k]).trim();
  const parts = [l?.street, l?.area, l?.city, l?.state, l?.zipCode].map((v) => (v == null ? "" : String(v).trim())).filter(Boolean);
  if (parts.length) return parts.join(", ");
  return prev?.restaurantAddress || o?.restaurantAddress || o?.restaurant?.address || "Restaurant location";
};
const getCustomerCoordsFromApiOrder = (o, prev = null) => {
  const a = o?.address || o?.deliveryAddress || {};
  if (Array.isArray(a?.location?.coordinates) && a.location.coordinates.length >= 2) return a.location.coordinates;
  if (Array.isArray(a?.coordinates) && a.coordinates.length >= 2) return a.coordinates;
  const obj = a?.location || a;
  const lat = Number(obj?.lat ?? obj?.latitude);
  const lng = Number(obj?.lng ?? obj?.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return [lng, lat];
  const p = prev?.address?.coordinates || prev?.address?.location?.coordinates;
  return Array.isArray(p) && p.length >= 2 ? p : null;
};
const transformOrderForTracking = (o, prev = null, explicitCoords = null, explicitAddress = null) => {
  const restaurantCoords = explicitCoords || getRestaurantCoordsFromOrder(o, prev?.restaurantLocation?.coordinates);
  const addr = o?.address || o?.deliveryAddress || {};
  const cc = getCustomerCoordsFromApiOrder(o, prev);
  return {
    id: o?.orderId || o?._id,
    mongoId: o?._id || null,
    orderId: o?.orderId || o?._id,
    restaurant: o?.restaurantName || o?.restaurantId?.restaurantName || o?.restaurantId?.name || o?.restaurant?.restaurantName || o?.restaurant?.name || prev?.restaurant || "Restaurant",
    restaurantPhone: o?.restaurantPhone || o?.restaurantId?.phone || o?.restaurantId?.ownerPhone || o?.restaurant?.phone || o?.restaurant?.ownerPhone || prev?.restaurantPhone || "",
    restaurantAddress: getRestaurantAddressFromOrder(o, prev, explicitAddress),
    restaurantId: o?.restaurantId || prev?.restaurantId || null,
    userId: o?.userId || prev?.userId || null,
    userName: o?.userName || o?.userId?.name || o?.userId?.fullName || prev?.userName || "",
    userPhone: o?.userPhone || o?.userId?.phone || prev?.userPhone || "",
    address: {
      street: addr?.street || prev?.address?.street || "",
      city: addr?.city || prev?.address?.city || "",
      state: addr?.state || prev?.address?.state || "",
      zipCode: addr?.zipCode || prev?.address?.zipCode || "",
      additionalDetails: addr?.additionalDetails || prev?.address?.additionalDetails || "",
      formattedAddress:
        addr?.formattedAddress ||
        (addr?.street && addr?.city
          ? `${addr.street}${addr.additionalDetails ? `, ${addr.additionalDetails}` : ""}, ${addr.city}${addr.state ? `, ${addr.state}` : ""}${addr.zipCode ? ` ${addr.zipCode}` : ""}`
          : prev?.address?.formattedAddress || addr?.city || ""),
      coordinates: cc || addr?.location?.coordinates || prev?.address?.coordinates || null,
    },
    restaurantLocation: { coordinates: restaurantCoords },
    items: o?.items?.map((i) => ({ name: i.name, variantName: i.variantName || "", isCombo: i.isCombo === true, comboItems: Array.isArray(i.comboItems) ? i.comboItems : [], quantity: i.quantity, price: i.price, originalPrice: i.originalPrice ?? i.price })) || prev?.items || [],
    total: o?.pricing?.total || prev?.total || 0,
    status: o?.orderStatus || o?.status || prev?.status || "pending",
    deliveryPartner: o?.deliveryPartnerId
      ? { name: o.deliveryPartnerId.name || o.deliveryPartnerId.fullName || "Delivery Partner", phone: o.deliveryPartnerId.phone || o.deliveryPartnerId.phoneNumber || "", avatar: o.deliveryPartnerId.avatar || o.deliveryPartnerId.profilePicture || null }
      : prev?.deliveryPartner || null,
    deliveryPartnerId: o?.deliveryPartnerId?._id || o?.deliveryPartnerId || o?.dispatch?.deliveryPartnerId?._id || o?.dispatch?.deliveryPartnerId || o?.assignmentInfo?.deliveryPartnerId || null,
    dispatch: o?.dispatch || prev?.dispatch || null,
    assignmentInfo: o?.assignmentInfo || prev?.assignmentInfo || null,
    tracking: o?.tracking || prev?.tracking || {},
    deliveryState: o?.deliveryState || prev?.deliveryState || null,
    scheduledAt: o?.scheduledAt || prev?.scheduledAt || null,
    createdAt: o?.createdAt || prev?.createdAt || null,
    updatedAt: o?.updatedAt || prev?.updatedAt || null,
    note: o?.note ?? prev?.note ?? "",
    totalAmount: o?.pricing?.total || o?.totalAmount || prev?.totalAmount || 0,
    deliveryFee: o?.pricing?.deliveryFee || o?.deliveryFee || prev?.deliveryFee || 0,
    gst: o?.pricing?.tax || o?.pricing?.gst || o?.gst || o?.tax || prev?.gst || 0,
    packagingFee: o?.pricing?.packagingFee || o?.packagingFee || 0,
    platformFee: o?.pricing?.platformFee || o?.platformFee || 0,
    discount: o?.pricing?.discount || o?.discount || 0,
    subtotal: o?.pricing?.subtotal || o?.subtotal || 0,
    paymentMethod: o?.paymentMethod || o?.payment?.method || prev?.paymentMethod || null,
    payment: o?.payment || prev?.payment || null,
    deliveryVerification: (() => {
      const pDV = prev?.deliveryVerification || null;
      const aDV = o?.deliveryVerification || null;
      const handoverOtp = o?.handoverOtp || null;
      if (!pDV && !aDV && !handoverOtp) return null;
      const merged = { ...(pDV || {}), ...(aDV || {}) };
      const code = handoverOtp || pDV?.dropOtp?.code || aDV?.dropOtp?.code;
      if (code || pDV?.dropOtp?.required || aDV?.dropOtp?.required) merged.dropOtp = { ...(pDV?.dropOtp || {}), ...(aDV?.dropOtp || {}), code };
      return merged;
    })(),
    cancellationReason: o?.cancellationReason || prev?.cancellationReason || null,
    ratings: o?.ratings || prev?.ratings || {},
    restaurantRating: o?.ratings?.restaurant?.rating || o?.restaurantRating || prev?.restaurantRating || null,
    deliveryPartnerRating: o?.ratings?.deliveryPartner?.rating || o?.deliveryPartnerRating || prev?.deliveryPartnerRating || null,
    restaurantLogo: o?.restaurantLogo || prev?.restaurantLogo,
  };
};
function mapBackendOrderStatusToUi(raw) {
  const s = String(raw || "").toLowerCase();
  if (!s || s === "pending" || s === "created") return "placed";
  if (s === "confirmed" || s === "accepted") return "confirmed";
  if (s === "preparing" || s === "processed") return "preparing";
  if (["ready", "ready_for_pickup", "reached_pickup", "order_confirmed"].includes(s)) return "ready";
  if (["picked_up", "out_for_delivery", "en_route_to_delivery"].includes(s)) return "on_way";
  if (["reached_drop", "at_drop", "at_delivery"].includes(s)) return "at_drop";
  if (s === "delivered" || s === "completed") return "delivered";
  if (s.includes("cancelled")) return "cancelled";
  if (s === "dead") return "dead";
  return "placed";
}
const isCancelledStatus = (r) => {
  const s = String(r || "").toLowerCase();
  return s.includes("cancelled") || s === "dead";
};
function mapOrderToTrackingUiStatus(o) {
  if (!o) return "placed";
  const raw = o.status || o.orderStatus;
  const phase = o.deliveryState?.currentPhase;
  if (isCancelledStatus(raw)) return "cancelled";
  if (raw === "delivered" || raw === "completed") return "delivered";
  const accepted = o.dispatch?.status === "accepted" || o.assignmentInfo?.status === "accepted" || o.deliveryPartner?.status === "accepted";
  if (phase === "reached_drop" || phase === "at_drop" || raw === "at_drop") return "at_drop";
  if (phase === "en_route_to_delivery" || raw === "picked_up" || raw === "out_for_delivery") return "on_way";
  if (phase === "at_pickup" && o.deliveryPartnerId && accepted) return "at_pickup";
  if (phase === "en_route_to_pickup" && o.deliveryPartnerId && accepted) return "assigned";
  return mapBackendOrderStatusToUi(raw);
}
const normalizeLookupId = (v) => {
  if (v == null) return "";
  const r = String(v).trim();
  return !r || r === "undefined" || r === "null" ? "" : r;
};
const toPoint = (c) => {
  if (!Array.isArray(c) || c.length < 2) return null;
  const lng = Number(c[0]);
  const lat = Number(c[1]);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
};
const isRazorpayPaidOrder = (o) => {
  const m = String(o?.payment?.method || o?.paymentMethod || "").toLowerCase();
  const s = String(o?.payment?.status || "").toLowerCase();
  return m === "razorpay" && ["paid", "authorized", "captured", "settled", "refunded"].includes(s);
};
const dial = (raw, label) => {
  const clean = String(raw || "").replace(/[^\d+]/g, "");
  if (!clean || clean.length < 5) {
    toast.error(`${label} phone number not available`);
    return;
  }
  Linking.openURL(`tel:${clean}`).catch(() => toast.error("Unable to open dialer"));
};

/* ---------- small UI pieces ---------- */
function AnimatedCheckmark() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: 1, useNativeDriver: true, friction: 5 }).start();
  }, [v]);
  return (
    <Animated.View style={{ transform: [{ scale: v }], opacity: v, alignSelf: "center" }}>
      <Svg width={80} height={80} viewBox="0 0 80 80">
        <Circle cx={40} cy={40} r={36} fill="none" stroke="#22c55e" strokeWidth={4} />
        <Path d="M24 40 L35 51 L56 30" fill="none" stroke="#22c55e" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Animated.View>
  );
}
function SpinIcon({ spinning, color = palette.white }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!spinning) return;
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, [spinning, v]);
  return (
    <Animated.View style={{ transform: [{ rotate: v.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }}>
      <RefreshCw size={16} color={color} />
    </Animated.View>
  );
}
function SectionItem({ Icon, iconNode, title, subtitle, onPress, showArrow = true }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.sectionItem}>
      <View style={styles.sectionIcon}>{iconNode || <Icon size={20} color={palette.gray600} />}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt weight={500} numberOfLines={1} style={{ fontSize: 16, color: palette.gray900 }}>{title}</Txt>
        {subtitle ? <Txt weight={400} numberOfLines={1} style={{ fontSize: 14, color: palette.gray500 }}>{subtitle}</Txt> : null}
      </View>
      {showArrow ? <ChevronRight size={20} color={palette.gray400} /> : null}
    </Pressable>
  );
}
function MiniPin({ color }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Path fill={color} d="M12 2C8.13 2 5 5.13 5 9c0 4.17 4.42 9.92 6.24 12.11.4.48 1.08.48 1.52 0C14.58 18.92 19 13.17 19 9c0-3.87-3.13-7-7-7z" />
      <Circle cx={12} cy={9} r={3} fill="#FFFFFF" />
    </Svg>
  );
}
function RiderIcon({ size = 32 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      <Circle cx={30} cy={30} r={28} fill="#fff7ed" />
      <Path transform="translate(15, 15) scale(1.2)" fill="#ff8100" d="M19 7c0-1.1-.9-2-2-2h-3v2h3v2.65l-2.13 1.52c-.31.22-.5.57-.5.95V13h-4.4a2 2 0 00-1.92 1.45L6 20H2v2h4.5c1.07 0 1.97-.85 1.97-1.97V20l.4-1.2h3.13l.4 1.2c.4 1.2 1.5 2 2.77 2h.3c1.07 0 1.97-.85 1.97-1.97V20l-.4-1.2H14.1l-.33-1H18v-2h-2.17l-.67-2H18c1.1 0 2-.9 2-2V7h-1zM7 18h-.5C5.67 18 5 17.33 5 16.5S5.67 15 6.5 15H7v3zm8.5 0h-.5V15h.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z" />
    </Svg>
  );
}
function Stars({ value, onChange, size = 40 }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "center", gap: 12 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Pressable key={s} onPress={() => onChange?.(s)} disabled={!onChange} style={{ padding: 4 }}>
          <Star size={size} color={s <= (value || 0) ? palette.yellow400 : palette.gray200} fill={s <= (value || 0) ? palette.yellow400 : "transparent"} />
        </Pressable>
      ))}
    </View>
  );
}
class MapErrorBoundary extends Component {
  constructor(p) {
    super(p);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ height: 300, backgroundColor: palette.gray100, alignItems: "center", justifyContent: "center" }}>
          <Txt weight={400} style={{ fontSize: 14, color: palette.gray600 }}>Live map unavailable right now</Txt>
        </View>
      );
    }
    return this.props.children;
  }
}

/* ---------- screen ---------- */
function OrderTrackingScreen() {
  const companyName = useCompanyName();
  const router = useRouter();
  const params = useLocalSearchParams();
  const orderId = String(params.orderId || "");
  const confirmed = params.confirmed === "true";
  const { getOrderById } = useOrders();
  const { userProfile, getDefaultAddress } = useProfile();
  const { location: userLiveLocation } = useAppLocation();
  const { isConnected: isSocketConnected } = useUserNotifications();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(confirmed);
  const [orderStatus, setOrderStatus] = useState("placed");
  const [estimatedTime, setEstimatedTime] = useState(29);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [refundDestination, setRefundDestination] = useState("source");
  const [isCancelling, setIsCancelling] = useState(false);
  const [isInstructionsModalOpen, setIsInstructionsModalOpen] = useState(false);
  const [deliveryInstructions, setDeliveryInstructions] = useState("");
  const [isUpdatingInstructions, setIsUpdatingInstructions] = useState(false);
  const [timerNow, setTimerNow] = useState(Date.now());
  const [cancelSecondsRemaining, setCancelSecondsRemaining] = useState(0);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedRestaurantRating, setSelectedRestaurantRating] = useState(null);
  const [selectedDeliveryRating, setSelectedDeliveryRating] = useState(null);
  const [restaurantFeedbackText, setRestaurantFeedbackText] = useState("");
  const [deliveryFeedbackText, setDeliveryFeedbackText] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);
  const [socketDropOtpCode, setSocketDropOtpCode] = useState(null);

  const lastRealtimeRefreshRef = useRef(0);
  const trackingOrderIdsRef = useRef(new Set());
  const terminalPollStopRef = useRef(false);
  const lookupIdsRef = useRef([]);
  const lastStatusToastRef = useRef({ key: "", at: 0 });
  const pollRef = useRef(null);
  const orderRef = useRef(null);
  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  // 65 s free-cancel window
  useEffect(() => {
    if (!order?.createdAt) return undefined;
    const calc = () => Math.max(0, Math.floor((65000 - (Date.now() - new Date(order.createdAt).getTime())) / 1000));
    setCancelSecondsRemaining(calc());
    const t = setInterval(() => {
      const r = calc();
      setCancelSecondsRemaining(r);
      if (r <= 0) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [order?.createdAt]);

  const hasRestaurantRating = Number.isFinite(Number(order?.ratings?.restaurant?.rating || order?.restaurantRating)) && Boolean(order?.ratings?.restaurant?.rating || order?.restaurantRating);
  const hasDeliveryPartner = !!(order?.deliveryPartnerId || order?.deliveryPartnerName);
  const hasDeliveryRating = Boolean(order?.ratings?.deliveryPartner?.rating || order?.deliveryPartnerRating);
  const isOrderRated = hasRestaurantRating && (!hasDeliveryPartner || hasDeliveryRating);

  const handleOpenRating = () => {
    setSelectedRestaurantRating(order?.ratings?.restaurant?.rating || order?.restaurantRating || null);
    setSelectedDeliveryRating(order?.ratings?.deliveryPartner?.rating || order?.deliveryPartnerRating || null);
    setRestaurantFeedbackText(order?.ratings?.restaurant?.comment || "");
    setDeliveryFeedbackText(order?.ratings?.deliveryPartner?.comment || "");
    setShowRatingModal(true);
  };
  const handleSubmitRating = async () => {
    if (!order || selectedRestaurantRating === null || (hasDeliveryPartner && selectedDeliveryRating === null)) {
      toast.error("Please select all required ratings first");
      return;
    }
    try {
      setSubmittingRating(true);
      const r = await orderAPI.submitOrderRatings(order.mongoId || order._id || order.id, {
        restaurantRating: selectedRestaurantRating,
        deliveryPartnerRating: hasDeliveryPartner ? selectedDeliveryRating : undefined,
        restaurantComment: restaurantFeedbackText || undefined,
        deliveryPartnerComment: hasDeliveryPartner ? deliveryFeedbackText || undefined : undefined,
      });
      const u = r?.data?.data?.order || r?.data?.order;
      if (u) setOrder((p) => ({ ...p, ratings: u.ratings, restaurantRating: u.ratings?.restaurant?.rating, deliveryPartnerRating: u.ratings?.deliveryPartner?.rating }));
      toast.success("Thanks for your feedback!");
      setShowRatingModal(false);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to submit ratings");
    } finally {
      setSubmittingRating(false);
    }
  };

  const handleEtaUpdate = useCallback((eta) => {
    if (typeof eta === "string") {
      const m = eta.match(/(\d+)/);
      if (m) setEstimatedTime(parseInt(m[1], 10));
    } else if (typeof eta === "number" && !isNaN(eta)) setEstimatedTime(eta);
  }, []);

  // handover OTP from socket
  useEffect(
    () =>
      addAppListener("deliveryDropOtp", (event) => {
        const d = event?.detail || {};
        const otp = d?.otp != null ? String(d.otp) : null;
        if (!otp) return;
        const o = orderRef.current;
        const ids = [String(orderId), o?.orderId, o?.mongoId, o?._id].filter(Boolean).map(String);
        if (!((d.orderId && ids.includes(String(d.orderId))) || (d.orderMongoId && ids.includes(String(d.orderMongoId))))) return;
        setSocketDropOtpCode(otp);
        setOrder((p) => (!p || p.deliveryVerification?.dropOtp?.code === otp ? p : { ...p, deliveryVerification: { ...(p.deliveryVerification || {}), dropOtp: { ...(p.deliveryVerification?.dropOtp || {}), required: true, verified: false, code: otp } } }));
      }),
    [orderId],
  );

  // arrival-time sync (same as Home card)
  useEffect(() => {
    if (!order) return undefined;
    const tick = () => {
      const t = new Date(order.scheduledAt || order.createdAt || Date.now());
      const mins = order.scheduledAt ? 0 : order.estimatedDeliveryTime || order.estimatedTime || 35;
      setEstimatedTime(Math.max(0, Math.floor((t.getTime() + mins * 60000 - Date.now()) / 60000)));
    };
    tick();
    const i = setInterval(tick, 30000);
    return () => clearInterval(i);
  }, [order]);

  useEffect(() => {
    const s = trackingOrderIdsRef.current;
    [orderId, order?.orderId, order?.mongoId, order?.id].filter(Boolean).forEach((x) => s.add(String(x)));
    lookupIdsRef.current = [...new Set([orderId, order?.orderId, order?.mongoId, order?._id, order?.id].map(normalizeLookupId).filter(Boolean))];
  }, [orderId, order?.orderId, order?.mongoId, order?._id, order?.id]);

  const resolveOrderFromList = useCallback(async (raw) => {
    const needle = normalizeLookupId(raw);
    if (!needle) return null;
    for (let page = 1; page <= 3; page += 1) {
      const r = await orderAPI.getOrders({ page, limit: 50 });
      const orders = r?.data?.data?.orders || r?.data?.orders || (Array.isArray(r?.data?.data?.data) ? r.data.data.data : Array.isArray(r?.data?.data) ? r.data.data : []);
      const m = (orders || []).find((o) => [o?._id, o?.id, o?.orderId, o?.mongoId].map(normalizeLookupId).includes(needle));
      if (m) return m;
      const pages = Number(r?.data?.data?.pagination?.pages) || Number(r?.data?.data?.totalPages) || 1;
      if (page >= pages) break;
    }
    return null;
  }, []);
  const fetchOrderDetailsWithFallback = useCallback(async (options = {}) => {
    const ids = lookupIdsRef.current.length ? lookupIdsRef.current : [normalizeLookupId(orderId)].filter(Boolean);
    if (!ids.length) throw new Error("Order id required");
    let lastError = null;
    for (const id of ids) {
      try {
        return await orderAPI.getOrderDetails(id, options);
      } catch (e) {
        lastError = e;
        if (e?.response?.status === 400 || e?.response?.status === 404) continue;
        throw e;
      }
    }
    throw lastError || new Error("Failed to fetch order details");
  }, [orderId]);
  const extractOrder = (r) => {
    if (r.data?.success && r.data.data?.order) return r.data.data.order;
    if (r.data?.success && r.data?.data && (r.data.data._id || r.data.data.orderId || r.data.data.id)) return r.data.data;
    if (r.data?.success && r.data?.order) return r.data.order;
    return null;
  };

  // clear OTP when finished
  useEffect(() => {
    if (!order) return;
    const s = mapOrderToTrackingUiStatus(order);
    if (s === "delivered" || s === "cancelled") {
      setSocketDropOtpCode(null);
      setOrder((p) => (!p?.deliveryVerification?.dropOtp?.code ? p : { ...p, deliveryVerification: { ...(p.deliveryVerification || {}), dropOtp: { ...(p.deliveryVerification?.dropOtp || {}), code: null } } }));
    }
  }, [orderStatus, order]);

  const defaultAddress = getDefaultAddress();
  const fallbackCustomerCoords = useMemo(() => {
    const oc = toPoint(order?.address?.coordinates || order?.address?.location?.coordinates);
    if (oc) return oc;
    const dc = toPoint(defaultAddress?.location?.coordinates);
    if (dc) return dc;
    const lat = Number(userLiveLocation?.latitude);
    const lng = Number(userLiveLocation?.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }, [order?.address?.coordinates, order?.address?.location?.coordinates, defaultAddress?.location?.coordinates, userLiveLocation?.latitude, userLiveLocation?.longitude]);
  const userLiveCoords = useMemo(() => {
    const lat = Number(userLiveLocation?.latitude);
    const lng = Number(userLiveLocation?.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }, [userLiveLocation?.latitude, userLiveLocation?.longitude]);

  const isAdminAccepted = ["confirmed", "preparing", "ready", "ready_for_pickup", "picked_up"].includes(order?.status);
  useEffect(() => {
    if (order) setOrderStatus(mapOrderToTrackingUiStatus(order));
  }, [order?.status, order?.deliveryState?.currentPhase, order?.deliveryState?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const acceptedAtMs = useMemo(() => {
    const ts = order?.tracking?.confirmed?.timestamp || order?.tracking?.preparing?.timestamp || order?.updatedAt || order?.createdAt;
    const p = ts ? new Date(ts).getTime() : NaN;
    return Number.isFinite(p) ? p : null;
  }, [order?.tracking?.confirmed?.timestamp, order?.tracking?.preparing?.timestamp, order?.updatedAt, order?.createdAt]);
  const editWindowRemainingMs = isAdminAccepted && acceptedAtMs ? Math.max(0, 60000 - (timerNow - acceptedAtMs)) : 0;
  const isEditWindowOpen = editWindowRemainingMs > 0;
  useEffect(() => {
    if (!isEditWindowOpen) return undefined;
    const i = setInterval(() => setTimerNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [isEditWindowOpen]);

  const customerDeliveryOtp = order?.deliveryVerification?.dropOtp?.code ?? socketDropOtpCode ?? null;

  // initial fetch + poll
  useEffect(() => {
    if (!orderId) return undefined;
    let alive = true;
    let busy = false;
    const poll = async (isInitial = false) => {
      if (!alive || busy) return;
      if (terminalPollStopRef.current && !isInitial) return;
      if (isInitial) {
        const ctx = getOrderById(orderId);
        if (ctx) {
          setOrder((p) => transformOrderForTracking(ctx, p));
          setLoading(false);
        }
      }
      busy = true;
      try {
        const r = await fetchOrderDetailsWithFallback({ force: isInitial });
        if (!alive) return;
        let data = extractOrder(r);
        if (!data && isInitial) data = await resolveOrderFromList(orderId);
        if (data) {
          setOrder((p) => {
            const t = transformOrderForTracking(data, p);
            const ui = mapOrderToTrackingUiStatus(t);
            terminalPollStopRef.current = ui === "delivered" || ui === "cancelled";
            return t;
          });
          setError(null);
          setLoading(false);
          return;
        }
        if (isInitial && !orderRef.current) {
          setError(r.data?.message || "Order not found");
          terminalPollStopRef.current = true;
        }
      } catch (err) {
        if (isInitial && !orderRef.current) {
          try {
            const m = await resolveOrderFromList(orderId);
            if (m && alive) {
              setOrder((p) => transformOrderForTracking(m, p));
              setError(null);
              setLoading(false);
              return;
            }
          } catch {}
          if (!alive) return;
          setError(err.response?.data?.message || "Failed to fetch order details");
          terminalPollStopRef.current = true;
        } else if (err.response?.status === 404) {
          terminalPollStopRef.current = true;
          if (alive) setError(err.response?.data?.message || "Order not found");
        }
      } finally {
        busy = false;
        if (isInitial && alive) setLoading(false);
      }
    };
    pollRef.current = poll;
    terminalPollStopRef.current = false;
    poll(true);
    return () => {
      alive = false;
    };
  }, [orderId, fetchOrderDetailsWithFallback, resolveOrderFromList, getOrderById]);

  useEffect(() => {
    if (!orderId) return undefined;
    const ms = isSocketConnected || isUserSocketConnected() ? 75000 : 12000;
    const i = setInterval(() => {
      if (!terminalPollStopRef.current) pollRef.current?.(false);
    }, ms);
    return () => clearInterval(i);
  }, [orderId, isSocketConnected]);

  useEffect(() => {
    if (!confirmed) return undefined;
    const t = setTimeout(() => setShowConfirmation(false), order ? 700 : 1800);
    return () => clearTimeout(t);
  }, [confirmed, order]);

  useEffect(() => {
    const t = setInterval(() => setEstimatedTime((p) => Math.max(0, p - 1)), 60000);
    return () => clearInterval(t);
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const r = await fetchOrderDetailsWithFallback({ force: true });
      const api = extractOrder(r);
      if (api) {
        let coords = null;
        let address = null;
        if (Array.isArray(api.restaurantId?.location?.coordinates) && api.restaurantId.location.coordinates.length >= 2) coords = api.restaurantId.location.coordinates;
        else if (api.restaurantId?.location?.latitude && api.restaurantId?.location?.longitude) coords = [api.restaurantId.location.longitude, api.restaurantId.location.latitude];
        else if (api.restaurant?.location?.coordinates) coords = api.restaurant.location.coordinates;
        else if (typeof api.restaurantId === "string") {
          try {
            const rr = await restaurantAPI.getRestaurantById(api.restaurantId);
            const rest = rr?.data?.data?.restaurant;
            if (Array.isArray(rest?.location?.coordinates) && rest.location.coordinates.length >= 2) coords = rest.location.coordinates;
            address = rest?.location?.formattedAddress || rest?.location?.address || rest?.address || null;
          } catch {}
        }
        setOrder((p) => transformOrderForTracking(api, p, coords, address));
      }
    } catch {
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchOrderDetailsWithFallback]);

  // socket status notifications
  useEffect(
    () =>
      addAppListener("orderStatusNotification", (event) => {
        const payload = event?.detail || {};
        const { message, status, estimatedDeliveryTime, orderId: evtOrderId, orderMongoId } = payload;
        const keys = [evtOrderId, orderMongoId, payload?._id].filter(Boolean).map(String);
        const idMatches = keys.length === 0 || keys.some((k) => k === String(orderId) || trackingOrderIdsRef.current.has(k));
        if (idMatches) {
          setOrderStatus(mapOrderToTrackingUiStatus({ status, orderStatus: payload.orderStatus || status, deliveryState: payload.deliveryState }));
          setOrder((p) => (p ? transformOrderForTracking(patchOrderFromSocketPayload(p, payload), p) : p));
          const now = Date.now();
          if (socketPayloadNeedsRefetch(payload, payload.orderStatus || status) && now - lastRealtimeRefreshRef.current > 30000) {
            lastRealtimeRefreshRef.current = now;
            handleRefresh();
          } else if (!orderRef.current && now - lastRealtimeRefreshRef.current > 2000) {
            lastRealtimeRefreshRef.current = now;
            handleRefresh();
          }
        }
        if (message && idMatches) {
          const key = `${String(evtOrderId || orderMongoId || orderId)}:${String(status || payload.orderStatus || "")}`;
          const now = Date.now();
          if (key === lastStatusToastRef.current.key && now - lastStatusToastRef.current.at < 4000) return;
          lastStatusToastRef.current = { key, at: now };
          toast.dismiss();
          toast.success(message, { duration: 5000, description: estimatedDeliveryTime ? `Estimated delivery in ${Math.round(estimatedDeliveryTime / 60)} minutes` : undefined });
          Vibration.vibrate([0, 200, 100, 200]);
        }
      }),
    [orderId, handleRefresh],
  );

  const handleCancelOrder = () => {
    if (!order) return;
    if (isAdminAccepted && !isEditWindowOpen) return toast.error("Cancellation window ended. You can no longer cancel this order.");
    if (order.status === "cancelled") return toast.error("Order is already cancelled");
    if (order.status === "delivered") return toast.error("Cannot cancel a delivered order");
    setRefundDestination(isRazorpayPaidOrder(order) ? "source" : "wallet");
    setShowCancelDialog(true);
    return undefined;
  };
  const handleConfirmCancel = async () => {
    if (!cancellationReason.trim()) return toast.error("Please provide a reason for cancellation");
    setIsCancelling(true);
    try {
      const paid = isRazorpayPaidOrder(order);
      const r = await orderAPI.cancelOrder(lookupIdsRef.current[0] || normalizeLookupId(orderId), { reason: cancellationReason.trim(), ...(paid ? { refundDestination } : {}) });
      if (r.data?.success) {
        const pm = order?.payment?.method || order?.paymentMethod;
        toast.success(
          r.data?.message ||
            (pm === "cash" || pm === "cod"
              ? "Order cancelled successfully. No refund required as payment was not made."
              : refundDestination === "wallet"
                ? "Order cancelled successfully. Refund has been added to your wallet."
                : "Order cancelled successfully. Refund will be processed to your original payment method."),
        );
        setShowCancelDialog(false);
        setCancellationReason("");
        setRefundDestination("source");
        const fr = await fetchOrderDetailsWithFallback({ force: true });
        if (fr.data?.success && fr.data.data?.order) setOrder((p) => transformOrderForTracking(fr.data.data.order, p));
      } else toast.error(r.data?.message || "Failed to cancel order");
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to cancel order");
    } finally {
      setIsCancelling(false);
    }
    return undefined;
  };
  const handleUpdateInstructions = async () => {
    try {
      setIsUpdatingInstructions(true);
      const r = await orderAPI.updateOrderInstructions(orderId, deliveryInstructions);
      if (r.data?.success) {
        toast.success("Delivery instructions updated");
        setIsInstructionsModalOpen(false);
        const u = r.data.data?.order;
        setOrder((p) => (u ? transformOrderForTracking(u, p) : { ...p, note: deliveryInstructions }));
      } else toast.error(r.data?.message || "Failed to update instructions");
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to update instructions");
    } finally {
      setIsUpdatingInstructions(false);
    }
  };
  const handleShare = () =>
    shareLink({
      title: `Track my order from ${order?.restaurant || companyName}`,
      text: `Hey! Track my order from ${order?.restaurant || companyName} with ID #${order?.orderId || order?.id}.`,
      url: `${WEB_ORIGIN}/user/orders/${orderId}`,
    });
  const goBack = () => router.replace("/orders");

  if (loading) {
    return (
      <Screen bg={palette.gray50}>
        <View style={{ alignItems: "center", paddingVertical: 80 }}>
          <ActivityIndicator size="large" color={palette.gray600} />
          <Txt weight={400} style={{ marginTop: 16, fontSize: 16, color: palette.gray600 }}>Loading order details...</Txt>
        </View>
      </Screen>
    );
  }
  if (error || !order) {
    return (
      <Screen bg={palette.gray50}>
        <View style={{ alignItems: "center", paddingVertical: 80, paddingHorizontal: 16 }}>
          <Txt weight={700} style={{ fontSize: 20, color: palette.gray900, marginBottom: 16 }}>Order Not Found</Txt>
          <Txt weight={400} style={{ fontSize: 16, color: palette.gray600, marginBottom: 24, textAlign: "center" }}>{error || "The order you're looking for doesn't exist."}</Txt>
          <Button title="Back to Orders" rounded="md" onPress={goBack} />
        </View>
      </Screen>
    );
  }

  const statusConfig = {
    placed: { title: "Order Placed", subtitle: "Waiting for restaurant to accept", color: palette.green600, iconType: "food" },
    confirmed: { title: "Order Confirmed", subtitle: "Restaurant has accepted your order", color: palette.green600, iconType: "food" },
    preparing: { title: "Food is being prepared", subtitle: `Arriving in ${estimatedTime} mins`, color: palette.green600, iconType: "food" },
    assigned: { title: "Rider is arriving", subtitle: "A delivery partner is arriving at the restaurant", color: palette.green600, iconType: "rider" },
    at_pickup: { title: "Rider at restaurant", subtitle: "Rider is waiting for your order", color: palette.green600, iconType: "rider" },
    ready: { title: "Handover in progress", subtitle: "Rider is picking up your order", color: palette.green600, iconType: "rider" },
    on_way: { title: "Out for delivery", subtitle: `Arriving in ${estimatedTime} mins`, color: palette.green600, iconType: "rider" },
    at_drop: { title: "Arrived at location", subtitle: "Please come to the door", color: palette.green600, iconType: "rider" },
    delivered: { title: "Order delivered", subtitle: "Enjoy your meal!", color: palette.green600, iconType: "delivered" },
    cancelled: { title: "Order cancelled", subtitle: order?.cancellationReason || "This order has been cancelled", color: palette.red600, iconType: "cancelled" },
    dead: { title: "Order Delivery Failed", subtitle: "We're extremely sorry for the inconvenience. Your order could not be completed.", color: palette.red600, iconType: "cancelled" },
  };
  const cs = statusConfig[orderStatus] || statusConfig.placed;
  const isScheduledOrder = Boolean(order?.scheduledAt) && !["delivered", "cancelled"].includes(orderStatus);
  const scheduledFmt = order?.scheduledAt ? new Date(order.scheduledAt).toLocaleString("en-IN", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : null;
  const isDeliveredOrder = orderStatus === "delivered" || order?.status === "delivered" || Boolean(order?.deliveredAt);
  const scheduledPending = isScheduledOrder && ["placed", "confirmed"].includes(orderStatus);

  const restaurantCoords = toPoint(order?.restaurantLocation?.coordinates) || toPoint(order?.restaurantId?.location?.coordinates);
  const customerCoords = toPoint(order?.address?.coordinates || order?.address?.location?.coordinates) || fallbackCustomerCoords;
  const effCustomer = customerCoords || userLiveCoords || restaurantCoords;
  const effRestaurant = restaurantCoords || effCustomer;
  const trackingIds = [order?.orderId, order?.mongoId, order?._id, orderId, order?.id].filter(Boolean);

  const deliveryAddressText = (() => {
    if (order?.address?.formattedAddress && order.address.formattedAddress !== "Select location") return order.address.formattedAddress;
    const p1 = [order?.address?.street, order?.address?.additionalDetails, order?.address?.city, order?.address?.state, order?.address?.zipCode].filter(Boolean);
    if (p1.length) return p1.join(", ");
    if (defaultAddress?.formattedAddress && defaultAddress.formattedAddress !== "Select location") return defaultAddress.formattedAddress;
    const p2 = [defaultAddress?.street, defaultAddress?.additionalDetails, defaultAddress?.city, defaultAddress?.state, defaultAddress?.zipCode].filter(Boolean);
    return p2.length ? p2.join(", ") : "Add delivery address";
  })();

  return (
    <Screen bg={cs.color}>
      <View style={{ flex: 1, backgroundColor: palette.gray100 }}>
        {/* header */}
        <View style={{ backgroundColor: cs.color }}>
          <View style={styles.nav}>
            <Pressable onPress={goBack} style={styles.navBtn}><ArrowLeft size={24} color={palette.white} /></Pressable>
            <Txt weight={600} numberOfLines={1} style={{ fontSize: 18, color: palette.white, flex: 1, textAlign: "center" }}>{order.restaurant}</Txt>
            <Pressable onPress={handleShare} style={styles.navBtn}><Share2 size={20} color={palette.white} /></Pressable>
          </View>
          {scheduledPending ? (
            <View style={{ paddingHorizontal: 16, paddingBottom: 20, alignItems: "center" }}>
              <View style={styles.headerPill}>
                <Clock size={16} color={palette.white} />
                <Txt weight={600} style={{ fontSize: 14, color: palette.white }}>Scheduled Order</Txt>
              </View>
              <Txt weight={700} style={{ fontSize: 24, color: palette.white, marginVertical: 8 }}>Order Scheduled</Txt>
              <View style={[styles.headerPill, { paddingHorizontal: 20, paddingVertical: 10 }]}>
                <Calendar size={16} color={palette.white} />
                <Txt weight={500} style={{ fontSize: 14, color: palette.white }}>{scheduledFmt}</Txt>
                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.6)" }} />
                <Pressable onPress={handleRefresh}><SpinIcon spinning={isRefreshing} /></Pressable>
              </View>
              <Txt weight={400} style={{ fontSize: 12, marginTop: 12, color: "rgba(255,255,255,0.8)", textAlign: "center" }}>The restaurant will start preparing your order closer to the scheduled time</Txt>
            </View>
          ) : !["at_pickup", "ready", "on_way", "at_drop", "delivered"].includes(orderStatus) ? (
            <View style={{ paddingHorizontal: 16, paddingBottom: 16, alignItems: "center" }}>
              <Txt weight={700} style={{ fontSize: 24, color: palette.white, marginBottom: 12 }}>{cs.title}</Txt>
              <View style={styles.headerPill}>
                <Txt weight={400} style={{ fontSize: 14, color: palette.white, flexShrink: 1 }}>{cs.subtitle}</Txt>
                {orderStatus === "preparing" ? (
                  <>
                    <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: palette.white }} />
                    <Txt weight={400} style={{ fontSize: 14, color: palette.orange200 }}>On time</Txt>
                  </>
                ) : null}
                <Pressable onPress={handleRefresh} style={{ marginLeft: 4 }}><SpinIcon spinning={isRefreshing} /></Pressable>
              </View>
            </View>
          ) : null}
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 96 }}>
          {!isDeliveredOrder && orderStatus !== "cancelled" && orderStatus !== "dead" && !scheduledPending ? (
            <MapErrorBoundary>
              {effRestaurant && effCustomer ? (
                <DeliveryTrackingMap orderId={orderId} orderTrackingIds={trackingIds} restaurantCoords={effRestaurant} customerCoords={effCustomer} order={order} onEtaUpdate={handleEtaUpdate} />
              ) : (
                <View style={{ height: 300, backgroundColor: palette.gray200 }} />
              )}
            </MapErrorBoundary>
          ) : null}

          <View style={{ padding: 16, gap: 16 }}>
            {customerDeliveryOtp && !["delivered", "cancelled", "dead"].includes(orderStatus) ? (
              <View style={styles.otpCard}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: "#d1fae5", alignItems: "center", justifyContent: "center", marginBottom: 12 }}><ShieldCheck size={32} color={palette.emerald600} /></View>
                <Txt weight={900} style={{ fontSize: 12, color: "#047857", letterSpacing: 2, marginBottom: 4 }}>DELIVERY HANDOVER OTP</Txt>
                <Txt weight={500} style={{ fontSize: 13, color: palette.gray600, marginBottom: 16, textAlign: "center" }}>Share this 4-digit code with your delivery partner at drop-off to complete delivery</Txt>
                <View style={styles.otpBox}>
                  <Txt selectable weight={900} style={{ fontSize: 40, color: "#065f46", letterSpacing: 14, fontFamily: "monospace", textAlign: "center" }}>{String(customerDeliveryOtp)}</Txt>
                </View>
                <Txt weight={600} style={{ fontSize: 11, color: palette.emerald600 }}>Only share this code when the rider arrives with your order.</Txt>
              </View>
            ) : null}

            {/* status card */}
            <View style={[styles.card, { padding: 12 }]}>
              {scheduledPending ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                  <View style={[styles.statusIcon, { backgroundColor: palette.blue50, borderColor: palette.blue100 }]}><Clock size={28} color={palette.blue600} /></View>
                  <View style={{ flex: 1 }}>
                    <Txt weight={600} style={{ fontSize: 16, color: palette.gray900 }}>Order Scheduled</Txt>
                    <Txt weight={400} style={{ fontSize: 14, color: palette.gray500, marginTop: 4 }}>{scheduledFmt}</Txt>
                    <Txt weight={400} style={{ fontSize: 12, color: palette.blue600, marginTop: 4 }}>We'll notify you when the restaurant starts preparing</Txt>
                  </View>
                </View>
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                  <View style={[styles.statusIcon, { backgroundColor: cs.iconType === "rider" ? palette.blue50 : cs.iconType === "cancelled" ? palette.red50 : cs.iconType === "delivered" ? palette.green50 : palette.orange50 }]}>
                    {cs.iconType === "rider" ? <RiderIcon size={56} /> : cs.iconType === "cancelled" ? <X size={36} color={palette.red500} /> : cs.iconType === "delivered" ? <Check size={36} color={palette.green500} /> : <Receipt size={36} color={palette.orange500} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt weight={600} style={{ fontSize: 16, color: palette.gray900 }}>{cs.title}</Txt>
                    <Txt weight={400} style={{ fontSize: 14, color: palette.gray500, marginTop: 4 }}>{cs.subtitle}</Txt>
                    {orderStatus === "dead" ? (
                      <View style={{ marginTop: 12, backgroundColor: palette.red50, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: palette.red100 }}>
                        <Txt weight={500} style={{ fontSize: 14, color: "#b91c1c", marginBottom: 8 }}>If your money was deducted, it will be automatically refunded. Please reach out to support for instant help.</Txt>
                        <Pressable onPress={() => Linking.openURL("tel:+919755633147")} style={styles.supportBtn}>
                          <Phone size={12} color={palette.white} />
                          <Txt weight={700} style={{ fontSize: 12, color: palette.white }}>Contact Admin Support</Txt>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                </View>
              )}
            </View>

            {orderStatus === "delivered" && !isOrderRated ? (
              <View style={[styles.card, { padding: 24, alignItems: "center", borderWidth: 2, borderColor: "rgba(254,198,0,0.1)" }]}>
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(254,198,0,0.12)", alignItems: "center", justifyContent: "center", marginBottom: 16 }}><Star size={32} color={palette.yellow} fill={palette.yellow} /></View>
                <Txt weight={700} style={{ fontSize: 20, color: palette.gray900 }}>Enjoyed your food?</Txt>
                <Txt weight={400} style={{ fontSize: 14, color: palette.gray500, marginTop: 8, marginBottom: 24, textAlign: "center", maxWidth: 280 }}>
                  Rate your experience with <Txt weight={600} style={{ fontSize: 14, color: palette.gray700 }}>{order?.restaurant}</Txt> and help us improve!
                </Txt>
                <Button title="Rate Order" rounded="xl" size="lg" onPress={handleOpenRating} style={{ width: 200 }} />
              </View>
            ) : null}

            {orderStatus === "delivered" && isOrderRated ? (
              <View style={[styles.card, { padding: 20 }]}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderColor: palette.gray50 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: palette.green500 }} />
                    <Txt weight={700} style={{ fontSize: 14, color: palette.gray900 }}>Your Feedback</Txt>
                  </View>
                  <Pressable onPress={handleOpenRating}><Txt weight={700} style={{ fontSize: 10, color: palette.amber600, letterSpacing: 2 }}>EDIT RATING</Txt></Pressable>
                </View>
                <RatedRow label="Food & Restaurant" comment={order?.ratings?.restaurant?.comment} value={order?.ratings?.restaurant?.rating || order?.restaurantRating} />
                {hasDeliveryPartner ? <RatedRow label="Delivery Service" comment={order?.ratings?.deliveryPartner?.comment} value={order?.ratings?.deliveryPartner?.rating || order?.deliveryPartnerRating} /> : null}
              </View>
            ) : null}

            {order?.deliveryPartnerId ? (
              <View style={[styles.card, { overflow: "hidden" }]}>
                <View style={[styles.sectionItem, { borderBottomWidth: order?.note ? 1 : 0 }]}>
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: palette.blue50, overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: palette.blue100 }}>
                    <RiderIcon size={40} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt weight={600} style={{ fontSize: 16, color: palette.gray900 }}>{order.deliveryPartner?.name || "Delivery Partner"}</Txt>
                    <Txt weight={400} style={{ fontSize: 14, color: palette.gray500 }}>{orderStatus === "delivered" ? "Delivered your order" : "Your delivery partner is arriving"}</Txt>
                  </View>
                  <Pressable onPress={() => dial(order?.deliveryPartner?.phone, "Rider")} style={[styles.callBtn, { backgroundColor: palette.blue50 }]}><Phone size={20} color={palette.blue600} /></Pressable>
                </View>
                {order?.note ? (
                  <View style={styles.riderNote}>
                    <MessageSquare size={16} color={palette.blue500} style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Txt weight={700} style={{ fontSize: 10, color: palette.blue600, letterSpacing: 1, marginBottom: 2 }}>INSTRUCTION FOR RIDER</Txt>
                      <Txt weight={500} style={{ fontSize: 12, color: palette.gray700 }}>"{order.note}"</Txt>
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}

            {orderStatus !== "delivered" && orderStatus !== "cancelled" ? (
              <View style={{ backgroundColor: "#fefce8", borderRadius: 12, padding: 16, alignItems: "center" }}>
                <Txt weight={500} style={{ fontSize: 14, color: "#854d0e" }}>All your delivery details in one place 🥡</Txt>
              </View>
            ) : null}

            <View style={[styles.card, { overflow: "hidden" }]}>
              <SectionItem Icon={User} title={order?.userName || order?.userId?.fullName || order?.userId?.name || userProfile?.name || "Customer"} subtitle={order?.userPhone || order?.userId?.phone || userProfile?.phone || defaultAddress?.phone || "Phone number not available"} showArrow={false} />
              <SectionItem iconNode={<MiniPin color="#10B981" />} title="Delivery at Location" subtitle={deliveryAddressText} showArrow={false} />
              {!isAdminAccepted && orderStatus !== "cancelled" && orderStatus !== "delivered" ? (
                <SectionItem
                  Icon={MessageSquare}
                  title={order?.note ? "Edit delivery instructions" : "Add delivery instructions"}
                  subtitle={order?.note ? order.note.substring(0, 35) + (order.note.length > 35 ? "..." : "") : ""}
                  onPress={() => {
                    setDeliveryInstructions(order?.note || "");
                    setIsInstructionsModalOpen(true);
                  }}
                />
              ) : null}
            </View>

            <View style={[styles.card, { overflow: "hidden" }]}>
              <View style={styles.sectionItem}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: palette.orange100, alignItems: "center", justifyContent: "center" }}><MiniPin color="#FF6B35" /></View>
                <View style={{ flex: 1 }}>
                  <Txt weight={600} style={{ fontSize: 16, color: palette.gray900 }}>{order.restaurant}</Txt>
                  <Txt weight={400} style={{ fontSize: 14, color: palette.gray500 }}>{order.restaurantAddress || "Restaurant location"}</Txt>
                </View>
                <Pressable onPress={() => dial(order?.restaurantPhone || order?.restaurantId?.phone || order?.restaurantId?.ownerPhone || order?.restaurantId?.contact?.phone || order?.restaurantId?.location?.phone, "Restaurant")} style={[styles.callBtn, { backgroundColor: palette.orange50 }]}>
                  <Phone size={20} color={palette.amber600} />
                </Pressable>
              </View>
              <Pressable onPress={() => setShowOrderDetails(true)} style={{ padding: 16, flexDirection: "row", gap: 12 }}>
                <Receipt size={20} color={palette.gray500} style={{ marginTop: 2 }} />
                <View style={{ flex: 1, marginTop: 8, gap: 4 }}>
                  {order?.items?.map((it, i) => (
                    <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={{ width: 16, height: 16, borderRadius: 4, borderWidth: 1, borderColor: palette.green600, alignItems: "center", justifyContent: "center" }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: palette.green600 }} /></View>
                      <Txt weight={400} style={{ fontSize: 14, color: palette.gray600, flex: 1 }}>{it.quantity} x {it.name}{it.variantName ? ` (${it.variantName})` : ""}</Txt>
                    </View>
                  ))}
                </View>
                <ChevronRight size={20} color={palette.gray400} />
              </Pressable>
            </View>

            {cancelSecondsRemaining > 0 && !["cancelled", "delivered", "picked_up"].includes(orderStatus) ? (
              <View style={{ gap: 12 }}>
                <Pressable onPress={handleCancelOrder} style={styles.cancelBtn}>
                  <Txt weight={600} style={{ fontSize: 14, color: palette.red600 }}>Cancel Order ({cancelSecondsRemaining}s)</Txt>
                </Pressable>
                <Txt weight={400} style={{ fontSize: 10, color: palette.gray400, textAlign: "center", paddingHorizontal: 16 }}>You can cancel your order for free within the next {cancelSecondsRemaining} seconds.</Txt>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </View>

      {/* confirmation splash */}
      {showConfirmation ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.white, alignItems: "center", justifyContent: "center", zIndex: 50 }]}>
          <AnimatedCheckmark />
          <Txt weight={700} style={{ fontSize: 24, color: palette.gray900, marginTop: 24 }}>{isScheduledOrder ? "Order Scheduled!" : "Order Confirmed!"}</Txt>
          <Txt weight={400} style={{ fontSize: 16, color: palette.gray600, marginTop: 8 }}>{isScheduledOrder ? `Scheduled for ${scheduledFmt}` : "Your order has been placed successfully"}</Txt>
        </View>
      ) : null}

      {/* cancel dialog */}
      <BottomSheet visible={showCancelDialog} onClose={() => !isCancelling && setShowCancelDialog(false)} position="center">
        <View style={{ padding: 20, width: 340, gap: 16 }}>
          <Txt weight={700} style={{ fontSize: 20, color: palette.gray900 }}>Cancel Order</Txt>
          {isRazorpayPaidOrder(order) ? (
            <View style={{ gap: 8, borderRadius: 8, borderWidth: 1, borderColor: palette.gray200, backgroundColor: palette.gray50, padding: 16 }}>
              <Txt weight={600} style={{ fontSize: 14, color: palette.gray900 }}>Refund preference</Txt>
              {[
                ["source", "Refund to original payment method (5-7 working days)"],
                ["wallet", "Refund to wallet (instant credit)"],
              ].map(([v, l]) => (
                <Pressable key={v} disabled={isCancelling} onPress={() => setRefundDestination(v)} style={styles.radioRow}>
                  <View style={[styles.radio, refundDestination === v && { borderColor: palette.blue600 }]}>{refundDestination === v ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: palette.blue600 }} /> : null}</View>
                  <Txt weight={400} style={{ fontSize: 14, color: palette.gray700, flex: 1 }}>{l}</Txt>
                </Pressable>
              ))}
            </View>
          ) : null}
          <TextInput value={cancellationReason} onChangeText={setCancellationReason} editable={!isCancelling} placeholder="e.g., Changed my mind, Wrong address, etc." placeholderTextColor={palette.gray400} multiline textAlignVertical="top" style={[styles.textarea, { borderWidth: 2, borderColor: palette.gray300 }]} />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Button
              title="Cancel"
              variant="outline"
              rounded="md"
              disabled={isCancelling}
              onPress={() => {
                setShowCancelDialog(false);
                setCancellationReason("");
                setRefundDestination("source");
              }}
              style={{ flex: 1 }}
            />
            <Button title={isCancelling ? "Cancelling..." : "Confirm Cancellation"} variant="destructive" rounded="md" loading={isCancelling} disabled={isCancelling || !cancellationReason.trim()} onPress={handleConfirmCancel} style={{ flex: 1 }} />
          </View>
        </View>
      </BottomSheet>

      {/* order details dialog */}
      <BottomSheet visible={showOrderDetails} onClose={() => setShowOrderDetails(false)} position="center">
        <View style={{ width: 340, maxHeight: 600 }}>
          <View style={{ padding: 24, paddingBottom: 16, borderBottomWidth: 1, borderColor: palette.gray100 }}>
            <Txt weight={700} style={{ fontSize: 20, color: palette.gray900 }}>Order Details</Txt>
          </View>
          <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 16, gap: 24 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
              <View>
                <Txt weight={400} style={styles.metaLabel}>DATE & TIME</Txt>
                <Txt weight={500} style={{ fontSize: 14, color: palette.gray900 }}>{order?.createdAt ? new Date(order.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }) : "N/A"}</Txt>
              </View>
              <View style={{ height: 32, width: 1, backgroundColor: palette.gray100 }} />
              <View>
                <Txt weight={400} style={styles.metaLabel}>STATUS</Txt>
                <Txt weight={700} style={{ fontSize: 14, color: palette.green600, textTransform: "uppercase" }}>{order?.status?.replace("_", " ")}</Txt>
              </View>
            </View>
            {order?.note ? (
              <View style={{ backgroundColor: "rgba(255,247,237,0.5)", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: palette.orange100, flexDirection: "row", gap: 12 }}>
                <MessageSquare size={20} color={palette.amber600} />
                <View style={{ flex: 1 }}>
                  <Txt weight={700} style={{ fontSize: 12, color: palette.gray900, letterSpacing: 1, marginBottom: 4 }}>DELIVERY INSTRUCTIONS</Txt>
                  <Txt weight={500} style={{ fontSize: 14, color: palette.gray800 }}>{order.note}</Txt>
                </View>
              </View>
            ) : null}
            <View>
              <Txt weight={500} style={[styles.metaLabel, { fontSize: 14, marginBottom: 12 }]}>ORDER ITEMS</Txt>
              <View style={{ gap: 16 }}>
                {order?.items?.map((it, i) => (
                  <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", gap: 16 }}>
                    <View style={{ flexDirection: "row", gap: 12, flex: 1 }}>
                      <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: palette.green600, alignItems: "center", justifyContent: "center", marginTop: 2 }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: palette.green600 }} /></View>
                      <View style={{ flex: 1 }}>
                        <Txt weight={600} style={{ fontSize: 16, color: palette.gray900 }}>{it.name}</Txt>
                        {it.variantName ? <Txt weight={400} style={{ fontSize: 14, color: palette.gray500, marginTop: 2 }}>{it.variantName}</Txt> : null}
                        {it.isCombo && it.comboItems?.length ? <Txt weight={400} style={{ fontSize: 12, color: palette.gray500, marginTop: 2 }}>Combo: {it.comboItems.map((c) => `${c.quantity || 1} x ${c.name}`).join(", ")}</Txt> : null}
                        <Txt weight={400} style={{ fontSize: 14, color: palette.gray500, marginTop: 2 }}>Quantity: {it.quantity}</Txt>
                      </View>
                    </View>
                    <Txt weight={600} style={{ fontSize: 16, color: palette.gray900 }}>₹{((it?.price || 0) * (it?.quantity || 0)).toFixed(2)}</Txt>
                  </View>
                ))}
              </View>
            </View>
            <View style={{ backgroundColor: palette.gray50, borderRadius: 12, padding: 16, gap: 12 }}>
              <Txt weight={700} style={{ fontSize: 14, color: palette.gray900, letterSpacing: 1 }}>BILL SUMMARY</Txt>
              <BillRow label="Item Total" value={order?.subtotal} />
              {Number(order?.packagingFee) > 0 ? <BillRow label="Packaging Charges" value={order.packagingFee} /> : null}
              {Number(order?.platformFee) > 0 ? <BillRow label="Platform Fee" value={order.platformFee} /> : null}
              <BillRow label="Delivery Fee" value={order?.deliveryFee} />
              <BillRow label="GST" value={order?.gst} />
              {Number(order?.discount) > 0 ? <BillRow label="Discount Applied" value={order.discount} negative /> : null}
              <View style={{ paddingTop: 8, borderTopWidth: 1, borderColor: palette.gray200, flexDirection: "row", justifyContent: "space-between" }}>
                <Txt weight={700} style={{ fontSize: 16, color: palette.gray900 }}>Total Amount</Txt>
                <Txt weight={700} style={{ fontSize: 18, color: palette.gray900 }}>₹{Number(order?.totalAmount || 0).toFixed(2)}</Txt>
              </View>
            </View>
            {order?.paymentMethod ? (
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Shield size={16} color={palette.gray600} />
                  <Txt weight={500} style={{ fontSize: 14, color: palette.gray600 }}>Payment Method</Txt>
                </View>
                <Txt weight={700} style={{ fontSize: 14, color: palette.gray900, textTransform: "uppercase" }}>{order.paymentMethod}</Txt>
              </View>
            ) : null}
          </ScrollView>
          <View style={{ padding: 24, borderTopWidth: 1, borderColor: palette.gray100 }}>
            <Button title="Okay" variant="dark" rounded="xl" size="lg" onPress={() => setShowOrderDetails(false)} />
          </View>
        </View>
      </BottomSheet>

      {/* delivery instructions */}
      <BottomSheet visible={isInstructionsModalOpen} onClose={() => setIsInstructionsModalOpen(false)} position="center">
        <View style={{ padding: 24, width: 340, gap: 16 }}>
          <Txt weight={700} style={{ fontSize: 20, color: palette.amber600 }}>Delivery Instructions</Txt>
          <Txt weight={400} style={{ fontSize: 14, color: palette.gray500 }}>Add instructions for the delivery partner to help them find your address or know where to leave your order.</Txt>
          <TextInput value={deliveryInstructions} onChangeText={setDeliveryInstructions} placeholder="E.g. Ring the doorbell, leave at the front desk..." placeholderTextColor={palette.gray400} multiline textAlignVertical="top" style={[styles.textarea, { minHeight: 120, backgroundColor: palette.gray50 }]} />
          <Button title="Save Instructions" rounded="xl" size="lg" loading={isUpdatingInstructions} disabled={isUpdatingInstructions} onPress={handleUpdateInstructions} />
        </View>
      </BottomSheet>

      {/* rating */}
      <BottomSheet visible={showRatingModal} onClose={() => setShowRatingModal(false)} position="center">
        <ScrollView style={{ maxHeight: 640 }} contentContainerStyle={{ padding: 24, width: 340, gap: 24 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Star size={24} color={palette.yellow} fill={palette.yellow} />
            <Txt weight={700} style={{ fontSize: 20, color: palette.gray900 }}>Rate your Experience</Txt>
          </View>
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Txt weight={600} style={{ fontSize: 16, color: palette.gray800 }}>How was the food?</Txt>
              <View style={{ paddingHorizontal: 8, paddingVertical: 2, backgroundColor: palette.orange50, borderRadius: 999 }}><Txt weight={500} style={{ fontSize: 12, color: palette.orange600 }}>Restaurant</Txt></View>
            </View>
            <Stars value={selectedRestaurantRating} onChange={setSelectedRestaurantRating} />
            <TextInput placeholder="Write a quick review for the food (optional)" placeholderTextColor={palette.gray400} value={restaurantFeedbackText} onChangeText={setRestaurantFeedbackText} multiline textAlignVertical="top" style={[styles.textarea, { minHeight: 80, backgroundColor: palette.gray50, borderColor: palette.gray100 }]} />
          </View>
          {hasDeliveryPartner ? (
            <View style={{ gap: 12, paddingTop: 16, borderTopWidth: 1, borderColor: palette.gray100 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Txt weight={600} style={{ fontSize: 16, color: palette.gray800 }}>How was the delivery?</Txt>
                <View style={{ paddingHorizontal: 8, paddingVertical: 2, backgroundColor: palette.blue50, borderRadius: 999 }}><Txt weight={500} style={{ fontSize: 12, color: palette.blue600 }}>Delivery</Txt></View>
              </View>
              <Stars value={selectedDeliveryRating} onChange={setSelectedDeliveryRating} />
              <TextInput placeholder={`How was ${order?.deliveryPartnerName || "the rider"}? (optional)`} placeholderTextColor={palette.gray400} value={deliveryFeedbackText} onChangeText={setDeliveryFeedbackText} multiline textAlignVertical="top" style={[styles.textarea, { minHeight: 80, backgroundColor: palette.gray50, borderColor: palette.gray100 }]} />
            </View>
          ) : null}
          <Button title="Submit Feedback" rounded="xl" size="lg" loading={submittingRating} disabled={submittingRating || selectedRestaurantRating === null || (hasDeliveryPartner && selectedDeliveryRating === null)} onPress={handleSubmitRating} />
          <Pressable onPress={() => setShowRatingModal(false)} style={{ paddingVertical: 8, alignItems: "center" }}>
            <Txt weight={500} style={{ fontSize: 14, color: palette.gray400 }}>Maybe later</Txt>
          </Pressable>
        </ScrollView>
      </BottomSheet>
    </Screen>
  );
}

function RatedRow({ label, comment, value }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
      <View style={{ flex: 1 }}>
        <Txt weight={600} style={{ fontSize: 12, color: palette.gray700 }}>{label}</Txt>
        {comment ? <Txt weight={400} numberOfLines={1} style={{ fontSize: 10, color: palette.gray500, fontStyle: "italic", marginTop: 2 }}>"{comment}"</Txt> : null}
      </View>
      <View style={{ flexDirection: "row", gap: 2 }}>
        {[1, 2, 3, 4, 5].map((s) => (
          <Star key={s} size={14} color={s <= (value || 0) ? palette.yellow400 : palette.gray200} fill={s <= (value || 0) ? palette.yellow400 : "transparent"} />
        ))}
      </View>
    </View>
  );
}
function BillRow({ label, value, negative }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Txt weight={negative ? 500 : 400} style={{ fontSize: 14, color: negative ? palette.green600 : palette.gray600 }}>{label}</Txt>
      <Txt weight={500} style={{ fontSize: 14, color: negative ? palette.green600 : palette.gray900 }}>{negative ? "-" : ""}₹{Number(value || 0).toFixed(2)}</Txt>
    </View>
  );
}

export default function OrderTrackingRoute() {
  return (
    <RequireAuth>
      <OrderTrackingScreen />
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  navBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerPill: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, maxWidth: "100%" },
  card: { backgroundColor: palette.white, borderRadius: 12, elevation: 1 },
  otpCard: { backgroundColor: "#ecfdf5", borderWidth: 2, borderColor: "#34d399", borderRadius: 16, padding: 20, alignItems: "center", elevation: 3 },
  otpBox: { width: "100%", maxWidth: 320, backgroundColor: palette.white, borderWidth: 2, borderColor: "#6ee7b7", borderRadius: 16, paddingVertical: 14, paddingHorizontal: 24, marginBottom: 12 },
  statusIcon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 1, borderColor: palette.gray100 },
  supportBtn: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: palette.red600, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999 },
  sectionItem: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderBottomWidth: 1, borderStyle: "dashed", borderColor: palette.gray200 },
  sectionIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.gray100, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  callBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  riderNote: { backgroundColor: "rgba(239,246,255,0.5)", padding: 12, margin: 16, marginTop: 0, borderRadius: 8, flexDirection: "row", gap: 8, borderWidth: 1, borderColor: palette.blue100 },
  cancelBtn: { height: 48, borderRadius: 12, borderWidth: 1, borderColor: palette.red100, alignItems: "center", justifyContent: "center", backgroundColor: palette.white },
  textarea: { minHeight: 100, borderWidth: 1, borderColor: palette.gray200, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontFamily: fonts.regular, fontSize: 14, color: palette.gray900 },
  radioRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, borderRadius: 6, borderWidth: 1, borderColor: palette.gray200, backgroundColor: palette.white, paddingHorizontal: 12, paddingVertical: 8 },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: palette.gray400, alignItems: "center", justifyContent: "center", marginTop: 2 },
  metaLabel: { fontSize: 12, color: palette.gray500, letterSpacing: 1 },
});
