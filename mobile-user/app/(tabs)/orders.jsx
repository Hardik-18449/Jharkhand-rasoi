/** Orders — port of pages/user/orders/Orders.jsx (Your Orders: search, Today/History tabs, cards, rating modal, share sheet). */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, FlatList, Linking, Pressable, Share, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import * as Clipboard from "expo-clipboard";
import { ArrowLeft, Search, MoreVertical, ChevronRight, Star, RotateCcw, AlertCircle, Clock, Phone, X } from "lucide-react-native";
import Screen from "../../src/components/ui/Screen";
import Txt from "../../src/components/ui/Txt";
import Spinner from "../../src/components/ui/Spinner";
import BottomSheet from "../../src/components/ui/BottomSheet";
import Button from "../../src/components/ui/Button";
import RequireAuth from "../../src/components/RequireAuth";
import { orderAPI } from "../../src/api";
import { useCart } from "../../src/context/CartContext";
import { toast } from "../../src/utils/toast";
import { getCompanyNameAsync } from "../../src/utils/businessSettings";
import { isModuleAuthenticated } from "../../src/auth/session";
import { getJSON, localStore } from "../../src/utils/storage";
import { getMediaUrl } from "../../src/utils/media";
import { palette, fonts } from "../../src/theme";

const FALLBACK_RESTAURANT_IMG = "https://images.unsplash.com/photo-1604908176997-125188eb3c52?auto=format&fit=crop&w=200&q=80";
const WEB_ORIGIN = "https://jharkhandrasoi.com";

const getOrderStatus = (order) => {
  const status = order.status;
  if (status === "delivered" || status === "completed") return "delivered";
  if (status === "out_for_delivery" || status === "outForDelivery") return "outForDelivery";
  if (status === "ready" || status === "preparing") return "preparing";
  if (String(status).toLowerCase().includes("cancel")) return "cancelled";
  if (status === "dead") return "dead";
  return status || "confirmed";
};
const formatDate = (dateString) => {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, "0");
  const month = date.toLocaleDateString("en-US", { month: "short" });
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${day} ${month}, ${hours % 12 || 12}:${minutes}${hours >= 12 ? "PM" : "AM"}`;
};
const isToday = (dateString) => {
  if (!dateString) return false;
  const d = new Date(dateString);
  const t = new Date();
  return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
};
const calculateCountdown = (order) => {
  if (!order || order.status === "delivered" || String(order.status).toLowerCase().includes("cancel")) return null;
  const elapsed = Math.floor((new Date() - new Date(order.createdAt)) / 60000);
  const maxETA = order.eta?.max || order.estimatedDeliveryTime || 30;
  const remaining = Math.max(0, maxETA - elapsed);
  return remaining > 0 ? remaining : null;
};

function transformOrder(order) {
  const createdAt = order.createdAt ? new Date(order.createdAt) : new Date();
  const backendStatus = order.orderStatus || order.status;
  const isCancelled = ["cancelled", "cancelled_by_user", "cancelled_by_restaurant", "cancelled_by_admin", "dead"].includes(backendStatus);
  const cancellationReason = order.cancellationReason || "";
  const isRestaurantCancelled = isCancelled && (order.cancelledBy === "restaurant" || /rejected by restaurant|restaurant rejected|restaurant cancelled|restaurant is too busy|item not available|outside delivery area|kitchen closing|technical issue|order not accepted within time limit|restaurant did not respond/i.test(cancellationReason));
  const isUserCancelled = isCancelled && order.cancelledBy === "user";
  const isDead = backendStatus === "dead";
  const restaurantRating = order.ratings?.restaurant?.rating || null;
  const deliveryPartnerRating = order.ratings?.deliveryPartner?.rating || null;
  return {
    id: order._id?.toString() || order.orderId || `ORD-${order._id}`,
    mongoId: order._id,
    orderId: order.orderId || order._id?.toString(),
    status: isRestaurantCancelled ? "restaurant_cancelled" : getOrderStatus({ ...order, status: backendStatus }),
    originalStatus: backendStatus,
    createdAt: createdAt.toISOString(),
    address: order.address || order.deliveryAddress || {},
    items: (order.items || []).map((item) => ({
      itemId: item.itemId || item._id || item.id,
      name: item.name || item.foodName || "Item",
      variantName: item.variantName || "",
      isCombo: item.isCombo === true,
      comboItems: Array.isArray(item.comboItems) ? item.comboItems : [],
      quantity: item.quantity || 1,
      price: item.price || 0,
      originalPrice: item.originalPrice ?? item.price ?? 0,
      image: item.image || null,
      description: item.description || null,
      isVeg: item.isVeg === true || item.foodType === "Veg" || item.category === "veg" || item.type === "veg",
      _id: item._id || item.id,
      id: item.id || item._id,
    })),
    total: order.pricing?.total || order.total || 0,
    subtotal: order.pricing?.subtotal || 0,
    deliveryFee: order.pricing?.deliveryFee || 0,
    tax: order.pricing?.tax || 0,
    pricing: order.pricing || {},
    payment: order.payment || {},
    paymentMethod: order.payment?.method || order.paymentMethod,
    restaurant: order.restaurantId?.restaurantName || order.restaurantId?.name || order.restaurantName || "Restaurant",
    restaurantId: order.restaurantId?._id || order.restaurantId,
    restaurantSlug: order.restaurantId?.slug || null,
    restaurantImage: order.restaurantId?.profileImage?.url || order.restaurantId?.profileImage || null,
    restaurantLocation: order.restaurantId?.location?.area || order.restaurantId?.location?.city || order.address?.city || order.deliveryAddress?.city || "",
    restaurantRating,
    deliveryPartnerRating,
    ratings: order.ratings || {},
    rating: restaurantRating || null,
    review: order.review || null,
    tracking: order.tracking || {},
    cancellationReason,
    isRestaurantCancelled,
    isUserCancelled,
    isDead,
    cancelledBy: order.cancelledBy,
    eta: order.eta || { min: order.estimatedDeliveryTime || 30, max: order.estimatedDeliveryTime || 30 },
    estimatedDeliveryTime: order.estimatedDeliveryTime || 30,
    preparationTime: order.preparationTime || 0,
    deliveredAt: order.deliveredAt || null,
    deliveryPartnerId: order.deliveryPartnerId?._id || order.deliveryPartnerId || null,
    deliveryPartnerName: order.deliveryPartnerId?.name || order.deliveryPartnerName || null,
    deliveryPartnerPhone: order.deliveryPartnerId?.phone || order.deliveryPartnerPhone || null,
    note: order.note || null,
  };
}

const extractList = (resp) => {
  if (resp?.data?.success && resp?.data?.data?.orders) return { list: resp.data.data.orders || [], pages: resp.data.data?.pagination?.pages || 1 };
  if (resp?.data?.orders) return { list: resp.data.orders || [], pages: resp.data?.pagination?.pages || 1 };
  if (Array.isArray(resp?.data?.data)) return { list: resp.data.data, pages: 1 };
  return { list: [], pages: 1 };
};

function Stars({ value, onChange, prefix }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 12 }}>
      {[1, 2, 3, 4, 5].map((num) => (
        <Pressable key={`${prefix}-${num}`} onPress={() => onChange(num)} style={{ padding: 8 }}>
          <Star size={40} color={(value || 0) >= num ? palette.yellow400 : palette.gray300} fill={(value || 0) >= num ? palette.yellow400 : "transparent"} />
        </Pressable>
      ))}
    </View>
  );
}

function OrdersInner() {
  const router = useRouter();
  const { replaceCart } = useCart();
  const isAuthenticated = isModuleAuthenticated();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("today");
  const [ratingModal, setRatingModal] = useState({ open: false, order: null });
  const [activeMenuOrderId, setActiveMenuOrderId] = useState(null);
  const [selectedRestaurantRating, setSelectedRestaurantRating] = useState(null);
  const [selectedDeliveryRating, setSelectedDeliveryRating] = useState(null);
  const [restaurantFeedbackText, setRestaurantFeedbackText] = useState("");
  const [deliveryFeedbackText, setDeliveryFeedbackText] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);
  const [countdowns, setCountdowns] = useState({});
  const [shownRatingForOrders, setShownRatingForOrders] = useState(() => new Set(getJSON("shownRatingForOrders", []) || []));
  const fetchingRef = useRef(false);

  useEffect(() => {
    localStore.setItem("shownRatingForOrders", JSON.stringify(Array.from(shownRatingForOrders)));
  }, [shownRatingForOrders]);

  useEffect(() => {
    const update = () => {
      const next = {};
      orders.forEach((o) => {
        const r = calculateCountdown(o);
        if (r !== null) next[o.id] = r;
      });
      setCountdowns(next);
    };
    update();
    const i = setInterval(update, 10000);
    return () => clearInterval(i);
  }, [orders]);

  // auto rating popup
  useEffect(() => {
    if (orders.length === 0 || ratingModal.open) return;
    const delivered = orders.filter((order) => {
      const originalStatus = String(order.originalStatus || order.status || "").toLowerCase();
      const transformedStatus = String(order.status || "").toLowerCase();
      const isDelivered = ["delivered", "completed"].includes(originalStatus) || ["delivered", "completed"].includes(transformedStatus);
      const hasRestaurantRating = Number.isFinite(Number(order.restaurantRating)) && order.restaurantRating != null;
      const hasDeliveryPartner = !!(order.deliveryPartnerId || order.deliveryPartnerName);
      const hasDeliveryRating = Number.isFinite(Number(order.deliveryPartnerRating)) && order.deliveryPartnerRating != null;
      const hasRating = hasRestaurantRating && (!hasDeliveryPartner || hasDeliveryRating);
      const orderId = order.id || order._id || order.mongoId;
      const hasDeliveredAt = order.deliveredAt != null;
      return (isDelivered || hasDeliveredAt) && !hasRating && !shownRatingForOrders.has(orderId);
    });
    if (delivered.length > 0) {
      const orderToRate = delivered[0];
      const orderId = orderToRate.id || orderToRate._id || orderToRate.mongoId;
      setShownRatingForOrders((prev) => new Set([...prev, orderId]));
      setTimeout(() => {
        setRatingModal({ open: true, order: orderToRate });
        setSelectedRestaurantRating(null);
        setSelectedDeliveryRating(null);
        setRestaurantFeedbackText("");
        setDeliveryFeedbackText("");
      }, 800);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, shownRatingForOrders, ratingModal.open]);

  const fetchOrders = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      setLoading((l) => (orders.length === 0 ? true : l));
      const FETCH_LIMIT = 100;
      const first = await orderAPI.getOrders({ limit: FETCH_LIMIT, page: 1 });
      const { list: firstPage, pages } = extractList(first);
      let all = firstPage;
      if (pages > 1) {
        const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, i) => orderAPI.getOrders({ limit: FETCH_LIMIT, page: i + 2 })));
        all = [...firstPage, ...rest.flatMap((r) => extractList(r).list)];
      }
      const transformed = all.map(transformOrder).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setOrders(transformed);
    } catch (error) {
      let msg = "Failed to load orders";
      if (error?.response?.status === 401) msg = "Please login to view your orders";
      else if (error?.response?.data?.message) msg = error.response.data.message;
      toast.error(msg);
      setOrders([]);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return undefined;
    }
    fetchOrders();
    const poll = setInterval(() => {
      if (AppState.currentState !== "active") return;
      fetchOrders();
    }, 60000);
    const sub = AppState.addEventListener("change", (s) => s === "active" && fetchOrders());
    return () => {
      clearInterval(poll);
      sub.remove();
    };
  }, [isAuthenticated, fetchOrders]);

  const filteredOrders = useMemo(
    () =>
      orders.filter((order) => {
        const orderIsToday = isToday(order.createdAt);
        const isActiveStatus = ["preparing", "outForDelivery", "confirmed"].includes(order.status);
        if (activeTab === "today") {
          if (!orderIsToday && !isActiveStatus) return false;
        } else if (orderIsToday || isActiveStatus) return false;
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return order.restaurant?.toLowerCase().includes(q) || order.items.some((item) => (item.name || "").toLowerCase().includes(q));
      }),
    [orders, activeTab, searchQuery],
  );

  const ratingModalHasDeliveryPartner = !!(ratingModal.order?.deliveryPartnerId || ratingModal.order?.deliveryPartnerName);
  const ratingSubmitDisabled = submittingRating || selectedRestaurantRating === null || (ratingModalHasDeliveryPartner && selectedDeliveryRating === null);

  const handleReorder = (order) => {
    const restaurantTarget = order.restaurantSlug || order.restaurantId;
    if (!restaurantTarget || !order.items?.length) {
      toast.info("Order items or restaurant information not available");
      return;
    }
    const reorderItems = order.items
      .map((item, index) => {
        const itemId = item.id || item.itemId || item._id;
        if (!itemId) return null;
        return {
          id: itemId,
          name: item.name || "Item",
          price: Number(item.price) || 0,
          originalPrice: Math.max(Number(item.price) || 0, Number(item.originalPrice) || 0),
          image: item.image || "",
          restaurant: order.restaurant || "Restaurant",
          restaurantId: order.restaurantId,
          description: item.description || "",
          isVeg: item.isVeg !== false,
          quantity: Math.max(1, Number(item.quantity) || 1),
          reorderIndex: index,
        };
      })
      .filter(Boolean);
    if (!reorderItems.length) {
      toast.error("No reorderable items found in this order");
      return;
    }
    replaceCart(reorderItems);
    toast.success("Items added to cart");
    router.push(`/restaurants/${restaurantTarget}`);
  };

  const handleShareRestaurant = async (order) => {
    setActiveMenuOrderId(null);
    const companyName = await getCompanyNameAsync();
    const location = order.restaurantLocation || `${order.address?.city || ""}, ${order.address?.state || ""}`.trim();
    const restaurantPath = order.restaurantSlug || order.restaurantId;
    const url = restaurantPath ? `${WEB_ORIGIN}/food/user/restaurants/${restaurantPath}` : `${WEB_ORIGIN}/food/user/orders/${order.id}`;
    const text = `Check out ${order.restaurant} on ${companyName}.\nLocation: ${location || "Location not available"}\nOrder again from this restaurant in the ${companyName} app.`;
    try {
      const res = await Share.share({ title: order.restaurant, message: `${text} ${url}`, url });
      if (res.action === Share.sharedAction) toast.success("Restaurant shared successfully");
    } catch {
      try {
        await Clipboard.setStringAsync(url);
        toast.success("Link copied to clipboard!");
      } catch {
        toast.error("Failed to share restaurant");
      }
    }
  };

  const handleViewOrderDetails = (order) => {
    setActiveMenuOrderId(null);
    const status = String(order.status || "").toLowerCase();
    const isTerminal = ["delivered", "cancelled", "completed", "failed"].includes(status) || status.includes("cancelled");
    router.push(isTerminal ? `/orders/${order.id}/details` : `/orders/${order.id}`);
  };

  const handleOpenRating = (order) => {
    setRatingModal({ open: true, order });
    setSelectedRestaurantRating(order.restaurantRating || null);
    setSelectedDeliveryRating(order.deliveryPartnerRating || null);
    setRestaurantFeedbackText(order.ratings?.restaurant?.comment || "");
    setDeliveryFeedbackText(order.ratings?.deliveryPartner?.comment || "");
  };
  const handleCloseRating = () => {
    setRatingModal({ open: false, order: null });
    setSelectedRestaurantRating(null);
    setSelectedDeliveryRating(null);
    setRestaurantFeedbackText("");
    setDeliveryFeedbackText("");
  };
  const handleSubmitRating = async () => {
    const hasDeliveryPartner = ratingModalHasDeliveryPartner;
    if (!ratingModal.order || selectedRestaurantRating === null || (hasDeliveryPartner && selectedDeliveryRating === null)) {
      toast.error("Please select all required ratings first");
      return;
    }
    try {
      setSubmittingRating(true);
      const order = ratingModal.order;
      const response = await orderAPI.submitOrderRatings(order.id, {
        restaurantRating: selectedRestaurantRating,
        deliveryPartnerRating: hasDeliveryPartner ? selectedDeliveryRating : undefined,
        restaurantComment: restaurantFeedbackText || undefined,
        deliveryPartnerComment: hasDeliveryPartner ? deliveryFeedbackText || undefined : undefined,
      });
      const updatedOrder = response?.data?.data?.order || response?.data?.order || null;
      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id
            ? {
                ...o,
                restaurantRating: updatedOrder?.ratings?.restaurant?.rating ?? selectedRestaurantRating,
                deliveryPartnerRating: updatedOrder?.ratings?.deliveryPartner?.rating ?? (hasDeliveryPartner ? selectedDeliveryRating : null),
                ratings: updatedOrder?.ratings || { restaurant: { rating: selectedRestaurantRating, comment: restaurantFeedbackText || "" }, deliveryPartner: hasDeliveryPartner ? { rating: selectedDeliveryRating, comment: deliveryFeedbackText || "" } : undefined },
                rating: updatedOrder?.ratings?.restaurant?.rating ?? selectedRestaurantRating,
              }
            : o,
        ),
      );
      toast.success("Thanks for rating your order!");
      setShownRatingForOrders((prev) => new Set([...prev, order.id || order._id || order.mongoId]));
      handleCloseRating();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to submit ratings. Please try again.");
    } finally {
      setSubmittingRating(false);
    }
  };

  const Header = (
    <View style={styles.header}>
      <Pressable onPress={() => router.navigate("/")} hitSlop={8}>
        <ArrowLeft size={24} color={palette.gray700} />
      </Pressable>
      <Txt weight={600} style={{ marginLeft: 16, fontSize: 20, color: palette.gray800 }}>
        Your Orders
      </Txt>
    </View>
  );

  if (loading) {
    return (
      <Screen bg={palette.gray50}>
        {Header}
        <Spinner full />
      </Screen>
    );
  }
  if (orders.length === 0) {
    return (
      <Screen bg={palette.gray50}>
        {Header}
        <View style={{ paddingHorizontal: 16, paddingVertical: 32, alignItems: "center" }}>
          <Txt weight={400} style={{ fontSize: 15, color: palette.gray600 }}>
            You haven't placed any orders yet
          </Txt>
          <Pressable onPress={() => router.navigate("/")} style={{ marginTop: 16 }}>
            <Txt weight={500} style={{ fontSize: 15, color: palette.black }}>
              Start Ordering
            </Txt>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const renderOrder = ({ item: order }) => {
    const isCodOrWallet = ["cash", "cod", "wallet"].includes(order.payment?.method) || ["cash", "cod", "wallet"].includes(order.paymentMethod);
    const isCancelled = order.status === "cancelled" || order.status === "restaurant_cancelled" || order.status === "dead" || order.isDead;
    const paymentFailed = !isCodOrWallet && !isCancelled && order.payment?.status === "failed";
    const isDelivered = order.status === "delivered";
    const isRestaurantCancelled = order.isRestaurantCancelled || order.status === "restaurant_cancelled";
    const isUserCancelled = order.isUserCancelled || (isCancelled && order.cancelledBy === "user");
    const isDead = order.isDead || order.status === "dead";
    const restaurantImage = getMediaUrl(order.items?.[0]?.image || order.restaurantImage) || FALLBACK_RESTAURANT_IMG;
    const location = order.restaurantLocation || `${order.address?.city || ""}, ${order.address?.state || ""}`.trim() || "Location not available";
    const paymentLabel = order.payment?.method === "cash" || order.payment?.method === "cod" ? "Cash on Delivery" : order.payment?.method === "wallet" ? "Wallet" : order.payment?.method === "razorpay" ? "Online" : order.payment?.method || "N/A";
    const payStatus = order.payment?.status;
    const payStatusStyle =
      payStatus === "completed" || (isDelivered && isCodOrWallet) ? { bg: palette.green100, fg: palette.green700 } : payStatus === "failed" ? { bg: palette.red100, fg: "#b91c1c" } : payStatus === "pending" || payStatus === "cod_pending" ? { bg: "#fef9c3", fg: "#a16207" } : { bg: palette.gray100, fg: palette.gray700 };

    return (
      <View style={styles.card}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", padding: 16, paddingBottom: 8 }}>
          <View style={{ flexDirection: "row", gap: 12, flex: 1 }}>
            <View style={styles.restImg}>
              <Image source={{ uri: restaurantImage }} style={StyleSheet.absoluteFill} contentFit="cover" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt weight={600} numberOfLines={1} style={{ fontSize: 16, color: palette.gray800 }}>
                {order.restaurant}
              </Txt>
              <Txt weight={400} style={{ fontSize: 10, color: palette.gray500, marginTop: 2 }}>
                Order ID: <Txt weight={600} style={{ fontSize: 10, color: palette.gray700 }}>{order.orderId || order.id}</Txt>
              </Txt>
              <Txt weight={400} numberOfLines={1} style={{ fontSize: 11, color: palette.gray500, marginTop: 2 }}>
                {location}
              </Txt>
              {order.deliveryPartnerName ? (
                <Txt weight={400} style={{ fontSize: 12, color: palette.gray600, marginTop: 4 }}>
                  <Txt weight={500} style={{ fontSize: 12, color: palette.gray600 }}>Delivery:</Txt> {order.deliveryPartnerName}
                  {order.deliveryPartnerPhone ? ` | ${order.deliveryPartnerPhone}` : ""}
                </Txt>
              ) : null}
              {order.restaurantId ? (
                <Pressable onPress={() => router.push(`/restaurants/${order.restaurantId}`)} style={{ marginTop: 4 }}>
                  <Txt weight={500} style={{ fontSize: 12, color: palette.black }}>View menu &gt;</Txt>
                </Pressable>
              ) : null}
            </View>
          </View>
          <Pressable onPress={() => setActiveMenuOrderId((c) => (c === order.id ? null : order.id))} style={{ padding: 4 }} hitSlop={6}>
            <MoreVertical size={20} color={palette.gray400} />
          </Pressable>
        </View>
        {activeMenuOrderId === order.id ? (
          <View style={styles.menu}>
            <Pressable onPress={() => handleShareRestaurant(order)} style={styles.menuItem}>
              <Txt weight={400} style={{ fontSize: 12, color: palette.gray800 }}>Share restaurant</Txt>
            </Pressable>
            <Pressable onPress={() => handleViewOrderDetails(order)} style={styles.menuItem}>
              <Txt weight={400} style={{ fontSize: 12, color: palette.gray800 }}>Order details</Txt>
            </Pressable>
          </View>
        ) : null}
        <View style={styles.dashed} />
        <View style={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}>
          {order.items?.length > 0 ? (
            order.items.map((item, idx) => {
              const qty = item.quantity || 1;
              const total = qty * (item.price || 0);
              return (
                <View key={item._id || item.id || item.itemId || idx} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                  <View style={{ width: 16, height: 16, borderWidth: 1, borderColor: item.isVeg ? palette.green600 : palette.red600, padding: 2, marginTop: 2 }}>
                    <View style={{ flex: 1, borderRadius: 8, backgroundColor: item.isVeg ? palette.green600 : palette.red600 }} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Txt weight={500} style={{ fontSize: 14, color: palette.gray800 }}>{qty} x {item.name}</Txt>
                    {item.variantName ? <Txt weight={400} style={{ fontSize: 12, color: palette.gray500, marginTop: 2 }}>{item.variantName}</Txt> : null}
                    {item.isCombo && item.comboItems?.length > 0 ? <Txt weight={400} style={{ fontSize: 12, color: palette.gray500, marginTop: 2 }}>Combo: {item.comboItems.map((ci) => `${ci.quantity || 1} x ${ci.name}`).join(", ")}</Txt> : null}
                    {item.description ? <Txt weight={400} numberOfLines={1} style={{ fontSize: 12, color: palette.gray500, marginTop: 2 }}>{item.description}</Txt> : null}
                  </View>
                  <Txt weight={600} style={{ fontSize: 12, color: palette.gray800 }}>₹{total.toFixed(2)}</Txt>
                </View>
              );
            })
          ) : (
            <Txt weight={400} style={{ fontSize: 14, color: palette.gray500 }}>No items found</Txt>
          )}
        </View>
        <View style={styles.summary}>
          {order.pricing?.discount > 0 ? (
            <View style={styles.rowBetween}>
              <Txt weight={400} style={{ fontSize: 11, color: palette.green600 }}>Discount Applied</Txt>
              <Txt weight={500} style={{ fontSize: 11, color: palette.green600 }}>-₹{order.pricing.discount.toFixed(2)}</Txt>
            </View>
          ) : null}
          <View style={styles.rowBetween}>
            <Txt weight={600} style={{ fontSize: 12, color: palette.gray800 }}>Total Bill</Txt>
            <Txt weight={700} style={{ fontSize: 16, color: palette.gray900 }}>₹{Number(order.total).toFixed(2)}</Txt>
          </View>
        </View>
        <View style={{ paddingHorizontal: 16, paddingVertical: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1 }}>
            <Txt weight={400} style={{ fontSize: 12, color: palette.gray400 }}>Order placed on {formatDate(order.createdAt)}</Txt>
            {order.deliveredAt ? <Txt weight={400} style={{ fontSize: 12, color: palette.gray400, marginTop: 2 }}>Delivered on {formatDate(order.deliveredAt)}</Txt> : null}
            {order.payment ? (
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
                <Txt weight={400} style={{ fontSize: 12, color: palette.gray500 }}>
                  Payment: <Txt weight={500} style={{ fontSize: 12, color: palette.gray800, textTransform: "capitalize" }}>{paymentLabel}</Txt>
                </Txt>
                {payStatus ? (
                  <View style={{ marginLeft: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: payStatusStyle.bg }}>
                    <Txt weight={500} style={{ fontSize: 10, color: payStatusStyle.fg }}>{isDelivered && isCodOrWallet ? "Paid" : payStatus}</Txt>
                  </View>
                ) : null}
              </View>
            ) : null}
            {isDelivered && !paymentFailed ? <Txt weight={500} style={{ fontSize: 12, color: palette.green600, marginTop: 4 }}>Delivered</Txt> : null}
            {isRestaurantCancelled ? (
              <View>
                <Txt weight={500} style={{ fontSize: 12, color: palette.red500, marginTop: 4 }}>Restaurant Cancelled</Txt>
                {order.cancellationReason ? <Txt weight={400} style={{ fontSize: 10, color: palette.red400, fontStyle: "italic" }}>Reason: {order.cancellationReason}</Txt> : null}
              </View>
            ) : null}
            {isUserCancelled ? <Txt weight={500} style={{ fontSize: 12, color: palette.gray500, marginTop: 4 }}>Cancelled by you</Txt> : null}
            {isDead ? <Txt weight={500} style={{ fontSize: 12, color: palette.red500, marginTop: 4 }}>Delivery Failed</Txt> : null}
            {isCancelled && !isRestaurantCancelled && !isUserCancelled && !isDead ? <Txt weight={500} style={{ fontSize: 12, color: palette.gray500, marginTop: 4 }}>Cancelled</Txt> : null}
          </View>
          <Pressable onPress={() => router.push(isDelivered || isCancelled ? `/orders/${order.id}/details` : `/orders/${order.id}`)} style={{ flexDirection: "row", alignItems: "center", gap: 4, marginLeft: 16 }}>
            <Txt weight={500} style={{ fontSize: 12, color: palette.black }}>View Details</Txt>
            <ChevronRight size={16} color={palette.black} />
          </Pressable>
        </View>
        <View style={{ borderTopWidth: 1, borderTopColor: palette.gray100, marginHorizontal: 16 }} />
        <View style={{ paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          {isRestaurantCancelled ? (
            <View style={{ gap: 4, flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={styles.errIcon}><AlertCircle size={16} color={palette.red500} /></View>
                <Txt weight={600} style={{ fontSize: 12, color: palette.red500 }}>Restaurant Cancelled</Txt>
              </View>
              {order.cancellationReason ? <Txt weight={500} style={{ fontSize: 12, color: palette.red600, marginLeft: 28, marginBottom: 4 }}>Reason: {order.cancellationReason}</Txt> : null}
              <Txt weight={400} style={{ fontSize: 12, color: palette.gray600, marginLeft: 28 }}>Refund will be processed in 24-48 hours</Txt>
            </View>
          ) : isDead ? (
            <View style={{ gap: 8, flex: 1, paddingRight: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={styles.errIcon}><AlertCircle size={16} color={palette.red500} /></View>
                <Txt weight={600} style={{ fontSize: 12, color: palette.red500 }}>Order Delivery Failed</Txt>
              </View>
              <Txt weight={400} style={{ fontSize: 10, color: palette.gray600, marginLeft: 28 }}>We apologize, but your order could not be completed.</Txt>
              <Pressable onPress={() => Linking.openURL("tel:+919755633147")} style={styles.supportBtn}>
                <Phone size={12} color={palette.red600} />
                <Txt weight={500} style={{ fontSize: 10, color: palette.red600 }}>Support / Refund</Txt>
              </Pressable>
            </View>
          ) : paymentFailed ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={styles.errIcon}><AlertCircle size={16} color={palette.red500} /></View>
              <Txt weight={600} style={{ fontSize: 12, color: palette.red500 }}>Payment failed</Txt>
            </View>
          ) : isDelivered && order.restaurantRating && (!order.deliveryPartnerId || order.deliveryPartnerRating) ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Txt weight={400} style={{ fontSize: 14, color: palette.gray800 }}>You rated</Txt>
              <View style={[styles.ratedPill, { backgroundColor: palette.yellow400 }]}>
                <Txt weight={500} style={{ fontSize: 10, color: palette.white }}>R {order.restaurantRating}</Txt>
                <Star size={8} color={palette.white} fill={palette.white} />
              </View>
              {order.deliveryPartnerId ? (
                <View style={[styles.ratedPill, { backgroundColor: palette.blue500 }]}>
                  <Txt weight={500} style={{ fontSize: 10, color: palette.white }}>D {order.deliveryPartnerRating}</Txt>
                  <Star size={8} color={palette.white} fill={palette.white} />
                </View>
              ) : null}
            </View>
          ) : isDelivered ? (
            <View>
              <Txt weight={400} style={{ fontSize: 12, color: palette.gray500 }}>Order delivered</Txt>
              <Pressable onPress={() => handleOpenRating(order)} style={{ marginTop: 2 }}>
                <Txt weight={500} style={{ fontSize: 12, color: palette.black }}>Rate restaurant & delivery &gt;</Txt>
              </Pressable>
            </View>
          ) : (
            <View>
              <Txt weight={400} style={{ fontSize: 12, color: palette.gray500 }}>
                {order.status === "preparing" ? "Preparing" : order.status === "outForDelivery" ? "Out for delivery" : order.status === "confirmed" ? "Order confirmed" : ""}
              </Txt>
              {countdowns[order.id] > 0 ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                  <Clock size={12} color={palette.black} />
                  <Txt weight={500} style={{ fontSize: 12, color: palette.black }}>{countdowns[order.id]} min{countdowns[order.id] !== 1 ? "s" : ""} remaining</Txt>
                </View>
              ) : null}
            </View>
          )}
          {isDelivered && !paymentFailed ? (
            <Pressable onPress={() => handleReorder(order)} style={styles.reorder}>
              <RotateCcw size={14} color={palette.black} />
              <Txt weight={500} style={{ fontSize: 14, color: palette.black }}>Reorder</Txt>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <Screen bg={palette.gray50}>
      {Header}
      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Search size={20} color={palette.black} />
          <TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Search by restaurant or dish" placeholderTextColor={palette.gray400} style={styles.searchInput} returnKeyType="search" />
        </View>
      </View>
      <View style={styles.tabs}>
        {[["today", "Today's Orders"], ["past", "Order History"]].map(([id, label]) => (
          <Pressable key={id} onPress={() => setActiveTab(id)} style={{ paddingBottom: 12 }}>
            <Txt weight={600} style={{ fontSize: 15, color: activeTab === id ? palette.black : palette.gray500 }}>{label}</Txt>
            {activeTab === id ? <View style={styles.tabIndicator} /> : null}
          </Pressable>
        ))}
      </View>
      <FlatList
        data={filteredOrders}
        keyExtractor={(o) => String(o.id)}
        renderItem={renderOrder}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 16, paddingBottom: 96 }}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Txt weight={400} style={{ fontSize: 14, color: palette.gray600 }}>No orders found matching your search</Txt>
          </View>
        }
        ListFooterComponent={
          <View style={{ alignItems: "center", marginTop: 32, marginBottom: 16 }}>
            <Txt weight={900} style={{ fontSize: 36, color: palette.gray200, fontStyle: "italic", letterSpacing: -1.5 }}>JHARKHANDRASOI</Txt>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      <BottomSheet visible={ratingModal.open && !!ratingModal.order} onClose={handleCloseRating} position="center" contentStyle={{ borderRadius: 24 }}>
        <View style={{ backgroundColor: palette.yellow, paddingHorizontal: 24, paddingVertical: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Star size={20} color={palette.black} fill={palette.black} />
              <Txt weight={700} style={{ fontSize: 20, color: palette.black }}>Rate Your Delivery</Txt>
            </View>
            <Pressable onPress={handleCloseRating} style={{ padding: 4 }}><X size={20} color={palette.black} /></Pressable>
          </View>
          <Txt weight={400} style={{ fontSize: 14, color: "rgba(0,0,0,0.9)" }}>{ratingModal.order?.restaurant}</Txt>
        </View>
        <View style={{ paddingHorizontal: 24, paddingVertical: 24 }}>
          <Txt weight={600} style={{ fontSize: 14, color: palette.gray900, marginBottom: 12 }}>Restaurant rating (out of 5)</Txt>
          <Stars value={selectedRestaurantRating} onChange={setSelectedRestaurantRating} prefix="r" />
          <TextInput value={restaurantFeedbackText} onChangeText={setRestaurantFeedbackText} placeholder="Restaurant feedback (optional)" placeholderTextColor={palette.gray400} multiline style={styles.textarea} />
          {ratingModalHasDeliveryPartner ? (
            <View style={{ marginTop: 24 }}>
              <Txt weight={600} style={{ fontSize: 14, color: palette.gray900, marginBottom: 12 }}>Delivery partner rating (out of 5)</Txt>
              <Stars value={selectedDeliveryRating} onChange={setSelectedDeliveryRating} prefix="d" />
              <TextInput value={deliveryFeedbackText} onChangeText={setDeliveryFeedbackText} placeholder="Delivery partner feedback (optional)" placeholderTextColor={palette.gray400} multiline style={styles.textarea} />
            </View>
          ) : null}
          <Button title={submittingRating ? "Submitting..." : "Submit Ratings"} onPress={handleSubmitRating} disabled={ratingSubmitDisabled} loading={submittingRating} rounded="xl" size="lg" style={{ marginTop: 24 }} icon={<Star size={18} color={palette.black} fill={palette.black} />} />
          {ratingSubmitDisabled && !submittingRating ? <Txt weight={400} style={{ fontSize: 12, color: palette.red500, textAlign: "center", marginTop: 8 }}>Please select all required ratings to continue</Txt> : null}
        </View>
      </BottomSheet>
    </Screen>
  );
}

export default function OrdersScreen() {
  return (
    <RequireAuth>
      <OrdersInner />
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: palette.white, padding: 16, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: palette.gray200, elevation: 1 },
  searchWrap: { padding: 16, backgroundColor: palette.white, marginTop: 4, borderBottomWidth: 1, borderBottomColor: palette.gray200 },
  searchBox: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: palette.gray200, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: palette.white },
  searchInput: { flex: 1, marginLeft: 12, fontFamily: fonts.regular, fontSize: 14, color: palette.gray600, paddingVertical: 0 },
  tabs: { backgroundColor: palette.white, paddingHorizontal: 16, paddingTop: 12, flexDirection: "row", gap: 24, borderBottomWidth: 1, borderBottomColor: palette.gray200 },
  tabIndicator: { position: "absolute", bottom: 0, left: 0, right: 0, height: 3, backgroundColor: palette.yellow, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  card: { backgroundColor: palette.white, borderRadius: 12, borderWidth: 1, borderColor: palette.gray100, overflow: "visible", elevation: 1 },
  restImg: { width: 48, height: 48, borderRadius: 8, backgroundColor: palette.gray200, overflow: "hidden" },
  menu: { position: "absolute", right: 12, top: 40, zIndex: 20, width: 160, borderRadius: 12, backgroundColor: palette.white, borderWidth: 1, borderColor: palette.gray100, paddingVertical: 4, elevation: 6 },
  menuItem: { paddingHorizontal: 12, paddingVertical: 8 },
  dashed: { borderTopWidth: 1, borderStyle: "dashed", borderColor: palette.gray200, marginHorizontal: 16, marginVertical: 4 },
  summary: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: palette.gray50, borderRadius: 8, marginHorizontal: 12, marginBottom: 8, gap: 4 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  errIcon: { backgroundColor: palette.red100, padding: 4, borderRadius: 999 },
  supportBtn: { marginLeft: 28, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: palette.red50, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: palette.red100 },
  ratedPill: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 4, height: 16, borderRadius: 4 },
  reorder: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: palette.yellow, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  emptyCard: { backgroundColor: palette.white, borderRadius: 12, borderWidth: 1, borderColor: palette.gray100, padding: 32, alignItems: "center" },
  textarea: { minHeight: 60, borderRadius: 12, borderWidth: 2, borderColor: palette.gray200, paddingHorizontal: 16, paddingVertical: 8, fontFamily: fonts.regular, fontSize: 14, color: palette.gray800, textAlignVertical: "top" },
});
