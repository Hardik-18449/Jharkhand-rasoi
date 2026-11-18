/**
 * Orders tab — port of pages/restaurant/OrdersMain.jsx (phone layout).
 * Header (RestaurantNavbar) → status banners → filter chips (All/New/Preparing/Ready/Out for delivery/Scheduled/Completed/Cancelled/Dead)
 * → order list | search results. New-order popup: queue head from RestaurantNotificationContext or 60 s REST fallback,
 * 3-min countdown → auto-reject, slide-to-accept with prep time, reject reasons, admin-assign / cancel events dismiss it.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { RefreshControl, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { AlertCircle, Clock, Utensils } from "lucide-react-native";
import Txt from "../../src/components/ui/Txt";
import Spinner from "../../src/components/ui/Spinner";
import RestaurantHeader from "../../src/components/RestaurantHeader";
import OrdersList from "../../src/components/orders/OrdersList";
import OrderCard, { transformOrderForList } from "../../src/components/orders/OrderCard";
import NewOrderPopup, { ReasonSheet } from "../../src/components/orders/NewOrderPopup";
import { restaurantAPI } from "../../src/api";
import { useRestaurantNotifications } from "../../src/context/RestaurantNotificationContext";
import { addAppListener } from "../../src/utils/events";
import { toast } from "../../src/utils/toast";
import { palette, rt, BOTTOM_NAV_HEIGHT } from "../../src/theme";

const FILTER_TABS = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "preparing", label: "Preparing" },
  { id: "ready", label: "Ready" },
  { id: "out-for-delivery", label: "Out for delivery" },
  { id: "scheduled", label: "Scheduled" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
  { id: "dead", label: "Dead Orders" },
];

const normStatus = (v) => String(v || "").toLowerCase().trim().replace(/\s+/g, "_");
const isAnyCancelled = (v) => ["cancelled", "cancelled_by_user", "cancelled_by_restaurant", "cancelled_by_admin"].includes(normStatus(v));
const idsOf = (o) => [o?.orderMongoId, o?._id, o?.orderId, o?.order_id, o?.id].map((v) => (v == null ? "" : String(v).trim())).filter(Boolean);
const resolveActionId = (o) => String(o?._id || o?.orderMongoId || o?.mongoId || o?.orderId || o?.order_id || o?.id || "").trim() || null;

export default function OrdersScreen() {
  const router = useRouter();
  const { newOrder, orderQueue, clearNewOrder, isConnected, stopSound, playNotificationSound, setMuted } = useRestaurantNotifications();
  const [activeFilter, setActiveFilter] = useState("all");
  const [refreshToken, setRefreshToken] = useState(0);
  const requestOrdersRefresh = useCallback(() => setRefreshToken((t) => t + 1), []);
  const [refreshing, setRefreshing] = useState(false);

  const [restaurantStatus, setRestaurantStatus] = useState({ isLoading: true });
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [pendingDiningRequest, setPendingDiningRequest] = useState(null);

  // search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // popup
  const [showPopup, setShowPopup] = useState(false);
  const [popupOrder, setPopupOrder] = useState(null);
  const [countdown, setCountdown] = useState(180);
  const [prepTime, setPrepTime] = useState(11);
  const [accepting, setAccepting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const shownRef = useRef(new Set());
  const showPopupRef = useRef(false);
  const popupOrderRef = useRef(null);
  const newOrderRef = useRef(null);
  showPopupRef.current = showPopup;
  popupOrderRef.current = popupOrder;
  newOrderRef.current = newOrder;

  const markShown = (o) => idsOf(o).forEach((k) => shownRef.current.add(k));
  const wasShown = (o) => idsOf(o).some((k) => shownRef.current.has(k));
  const sameOrder = (a, b) => {
    if (!a || !b) return false;
    const x = idsOf(a);
    return idsOf(b).some((id) => x.includes(id));
  };

  const closePopup = useCallback(() => {
    setShowPopup(false);
    setPopupOrder(null);
    stopSound();
    clearNewOrder();
    setCountdown(180);
    setPrepTime(11);
    setAccepting(false);
  }, [stopSound, clearNewOrder]);

  /* ---------- restaurant status + counts ---------- */
  const fetchStatus = useCallback(async () => {
    try {
      const res = await restaurantAPI.getCurrentRestaurant();
      const r = res?.data?.data?.restaurant || res?.data?.restaurant;
      if (r) {
        setRestaurantStatus({
          isActive: r.isActive,
          status: r.status,
          approvedAt: r.approvedAt,
          pendingUpdateReason: r.pendingUpdateReason,
          rejectionReason: r.rejectionReason || null,
          onboarding: r.onboarding || null,
          isLoading: false,
        });
      }
    } catch {
      setRestaurantStatus((p) => ({ ...p, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    return addAppListener("restaurantProfileRefresh", fetchStatus);
  }, [fetchStatus]);

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const req = await restaurantAPI.getPendingDiningRequest().catch(() => null);
        setPendingDiningRequest(req?.data?.success && req.data.data ? req.data.data : null);
        const res = await restaurantAPI.getOrders({ page: 1, limit: 100 });
        if (res.data?.success) {
          const list = Array.isArray(res.data.data?.orders) ? res.data.data.orders : [];
          setPendingOrdersCount(list.filter((o) => ["pending", "created", "confirmed"].includes(String(o.status).toLowerCase())).length);
        }
      } catch {}
    };
    fetchCounts();
    const id = setInterval(fetchCounts, 30000);
    return () => clearInterval(id);
  }, [refreshToken]);

  /* ---------- search ---------- */
  useEffect(
    () =>
      addAppListener("restaurantSearchUpdated", (e) => {
        const { query, results, isLoading } = e?.detail || {};
        setSearchQuery(query || "");
        setSearchResults(results || []);
        setIsSearching(Boolean(isLoading));
      }),
    [],
  );

  /* ---------- new order from socket / poll queue ---------- */
  useEffect(() => {
    if (!newOrder) return;
    if (isAnyCancelled(newOrder.status || newOrder.orderStatus)) {
      clearNewOrder();
      return;
    }
    const scheduledAt = newOrder.scheduledAt ? new Date(newOrder.scheduledAt).getTime() : null;
    if (scheduledAt && scheduledAt > Date.now() + 30 * 60000) {
      toast.info(`New scheduled order received for ${new Date(scheduledAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`);
      clearNewOrder();
      requestOrdersRefresh();
      return;
    }
    if (!wasShown(newOrder)) {
      markShown(newOrder);
      if (!showPopupRef.current) {
        setPopupOrder(newOrder);
        setShowPopup(true);
        setCountdown(180);
      }
      requestOrdersRefresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newOrder]);

  // Next queued order after the current popup closes
  useEffect(() => {
    if (!showPopup && newOrder && !wasShown(newOrder) && !isAnyCancelled(newOrder.status)) {
      markShown(newOrder);
      setPopupOrder(newOrder);
      setShowPopup(true);
      setCountdown(180);
    } else if (!showPopup && newOrder && wasShown(newOrder) && !popupOrder) {
      // head already shown & handled elsewhere: show it again only if still waiting
      setPopupOrder(newOrder);
      setShowPopup(true);
      setCountdown(180);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPopup, orderQueue.length]);

  /* ---------- REST fallback: confirmed / due-scheduled orders not yet shown (every 60 s) ---------- */
  useEffect(() => {
    const check = async () => {
      if (showPopupRef.current || newOrderRef.current) return;
      try {
        const res = await restaurantAPI.getOrders();
        const list = res?.data?.data?.orders || [];
        const now = Date.now();
        const target = list.find((o) => {
          if (wasShown(o)) return false;
          if (o.status === "confirmed" && !o.scheduledAt) return true;
          if (o.scheduledAt && (o.status === "created" || o.status === "confirmed")) return new Date(o.scheduledAt).getTime() <= now + 30 * 60000;
          return false;
        });
        if (target && !showPopupRef.current && !newOrderRef.current) {
          const forPopup = {
            orderId: target.orderId,
            orderMongoId: target._id,
            restaurantId: target.restaurantId,
            restaurantName: target.restaurantName,
            items: target.items || [],
            total: target.pricing?.total || 0,
            customerAddress: target.address,
            status: target.status,
            createdAt: target.createdAt,
            scheduledAt: target.scheduledAt,
            note: target.note || "",
            restaurantNote: target.restaurantNote || "",
            sendCutlery: target.sendCutlery,
            paymentMethod: target.paymentMethod || target.payment?.method || null,
            payment: target.payment,
          };
          markShown({ orderId: target.orderId, _id: target._id });
          setPopupOrder(forPopup);
          setShowPopup(true);
          setCountdown(180);
          if (!isMuted) playNotificationSound();
        }
      } catch {}
    };
    check();
    const id = setInterval(check, 60000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);

  /* ---------- status updates (cancel / admin assigned) ---------- */
  useEffect(
    () =>
      addAppListener("restaurantOrderStatusUpdate", (e) => {
        const payload = e?.detail || {};
        const st = normStatus(payload.orderStatus || payload.status);
        const dismiss = () => {
          const active = popupOrderRef.current || newOrderRef.current;
          markShown(payload);
          if (active && payload && !sameOrder(active, payload)) return;
          if (active) markShown(active);
          closePopup();
          requestOrdersRefresh();
        };
        if ((st === "confirmed" || st === "preparing") && payload.updatedBy === "ADMIN") {
          dismiss();
          toast.success("Order assigned by admin to you");
          return;
        }
        if (!isAnyCancelled(st)) {
          requestOrdersRefresh();
          return;
        }
        dismiss();
        toast.info(st === "cancelled_by_user" ? "Order canceled by user" : "Order cancelled");
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [closePopup, requestOrdersRefresh],
  );

  /* ---------- countdown → auto reject ---------- */
  useEffect(() => {
    if (!showPopup) return undefined;
    if (countdown > 0) {
      const t = setInterval(() => setCountdown((p) => p - 1), 1000);
      return () => clearInterval(t);
    }
    const id = resolveActionId(popupOrder || newOrder);
    if (id && !accepting) {
      restaurantAPI
        .rejectOrder(id, "No response from restaurant (Auto-rejected)")
        .then(() => {
          toast.info("Order auto-rejected due to no response");
          requestOrdersRefresh();
          closePopup();
        })
        .catch(() => setShowPopup(false));
    } else setShowPopup(false);
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPopup, countdown]);

  /* ---------- actions ---------- */
  const handleAccept = async () => {
    if (accepting) return;
    setAccepting(true);
    const order = popupOrder || newOrder;
    markShown(order);
    let id = resolveActionId(order);
    if (!id) {
      try {
        const latest = await restaurantAPI.getOrders({ page: 1, limit: 20 });
        const t = (latest?.data?.data?.orders || []).find((o) => ["confirmed", "created"].includes(String(o?.status || o?.orderStatus || "").toLowerCase()));
        id = resolveActionId(t);
      } catch {}
    }
    if (!id) {
      toast.error("Unable to accept this order: order id missing");
      setAccepting(false);
      return;
    }
    try {
      await restaurantAPI.acceptOrder(id, prepTime);
      toast.success("Order accepted successfully");
      requestOrdersRefresh();
      closePopup();
      setActiveFilter("preparing");
    } catch (error) {
      const msg = error?.response?.data?.message || error?.message || "Failed to accept order. Please try again.";
      toast.error(error?.response?.status === 404 ? "Order not found. It may have been cancelled or already processed." : msg);
      setAccepting(false);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectReason) return;
    const order = popupOrder || newOrder;
    const id = order?.orderMongoId || order?.orderId || resolveActionId(order);
    if (id) {
      try {
        await restaurantAPI.rejectOrder(id, rejectReason);
        requestOrdersRefresh();
      } catch {
        toast.error("Failed to reject order. Please try again.");
        return;
      }
    }
    setShowReject(false);
    setRejectReason("");
    closePopup();
  };

  const toggleMute = () => {
    setIsMuted((m) => {
      setMuted(!m);
      if (m) playNotificationSound();
      return !m;
    });
  };

  // un-mute again for the next order once this popup closes
  useEffect(() => {
    if (!showPopup && isMuted) {
      setIsMuted(false);
      setMuted(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPopup]);

  const onRefresh = async () => {
    setRefreshing(true);
    restaurantAPI.invalidateOrders();
    requestOrdersRefresh();
    await fetchStatus();
    setTimeout(() => setRefreshing(false), 600);
  };

  const selectOrder = (o) => router.push(`/orders/${o.mongoId || o.orderId}`);
  const popupStatus = (popupOrder || newOrder)?.orderStatus || (popupOrder || newOrder)?.status;
  const cancelledLabel = isAnyCancelled(popupStatus) ? (normStatus(popupStatus) === "cancelled_by_user" ? "Order canceled by user" : "Order cancelled") : null;
  const rs = restaurantStatus;

  return (
    <View style={{ flex: 1, backgroundColor: rt.pageBg }}>
      <RestaurantHeader mode="orders" />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: BOTTOM_NAV_HEIGHT + 48 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[rt.primary]} />}
        stickyHeaderIndices={[1]}
      >
        <View>
          {!rs.isLoading && rs.status === "pending" && (rs.approvedAt || (rs.pendingUpdateReason && rs.pendingUpdateReason !== "New Registration")) ? (
            <View style={[styles.banner, { backgroundColor: "#fffbeb", borderColor: "#fde68a" }]}>
              <Clock size={20} color={palette.amber600} />
              <View style={{ flex: 1 }}>
                <Txt weight={700} style={{ fontSize: 14, color: "#78350f" }}>{rs.pendingUpdateReason || "Update Pending"}</Txt>
                <Txt style={{ fontSize: 12, color: "#92400e", marginTop: 2 }}>
                  Your restaurant <Txt weight={700} style={{ fontSize: 12, color: "#92400e" }}>{rs.pendingUpdateReason || "profile update"}</Txt> is pending approval. Please wait for admin response. You are currently continuing operations with your existing details/location.
                </Txt>
              </View>
            </View>
          ) : null}

          {!rs.isLoading && !rs.isActive && rs.onboarding?.completedSteps === 4 ? (
            <View style={[styles.verify, rs.rejectionReason ? { backgroundColor: palette.red50, borderColor: palette.red100 } : null]}>
              {rs.rejectionReason ? (
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <AlertCircle size={22} color={palette.red600} />
                  <View style={{ flex: 1 }}>
                    <Txt weight={700} style={{ fontSize: 18, color: palette.red600, marginBottom: 8 }}>Denied Verification</Txt>
                    <Txt weight={600} style={{ fontSize: 13, color: palette.gray800 }}>Reason for Rejection:</Txt>
                    {String(rs.rejectionReason)
                      .split(/\n|•/)
                      .map((l) => l.trim())
                      .filter(Boolean)
                      .map((l, i) => (
                        <Txt key={i} style={{ fontSize: 13, color: palette.gray700, marginTop: 4 }}>• {l}</Txt>
                      ))}
                    <Txt style={{ fontSize: 12, color: palette.gray600, marginTop: 10 }}>Please correct the above issues on the website and contact support to reverify your restaurant.</Txt>
                  </View>
                </View>
              ) : (
                <>
                  <Txt weight={700} style={{ fontSize: 18, color: palette.gray900, marginBottom: 4 }}>Verification Done in 24 Hours</Txt>
                  <Txt style={{ fontSize: 13, color: palette.gray600 }}>Your account is under verification. You'll be notified once approved.</Txt>
                </>
              )}
            </View>
          ) : null}

          {pendingDiningRequest ? (
            <View style={[styles.banner, { backgroundColor: "#faf5ff", borderColor: "#e9d5ff" }]}>
              <Utensils size={20} color={palette.purple600} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Txt weight={700} style={{ fontSize: 15, color: palette.gray900, flex: 1 }}>Dining Activation Request Pending</Txt>
                  <Txt weight={700} style={styles.reviewChip}>Under Review</Txt>
                </View>
                <Txt style={{ fontSize: 12, color: palette.gray600, marginTop: 4 }}>
                  Your request to {pendingDiningRequest.requestedSettings?.isEnabled ? "enable" : "update"} dining services is being reviewed by our team. You'll be notified via SMS/Dashboard once it's approved.
                </Txt>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.chipsWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 12 }}>
            {FILTER_TABS.map((t) => {
              const active = activeFilter === t.id;
              return (
                <Pressable key={t.id} onPress={() => setActiveFilter(t.id)} style={[styles.chip, active && styles.chipActive]}>
                  <Txt weight={active ? 700 : 500} style={{ fontSize: 13, color: active ? palette.white : palette.gray700 }}>{t.label}</Txt>
                  {t.id === "all" && pendingOrdersCount > 0 ? (
                    <View style={[styles.count, active && { backgroundColor: palette.white }]}>
                      <Txt weight={700} style={{ fontSize: 10, color: active ? rt.primary : palette.white }}>{pendingOrdersCount}</Txt>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {searchQuery ? (
          <View style={{ paddingTop: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Txt weight={600} style={{ fontSize: 16 }}>Search results for "{searchQuery}"</Txt>
              {isSearching ? <Spinner /> : <Txt style={{ fontSize: 12, color: palette.gray500 }}>{searchResults.length} found</Txt>}
            </View>
            {!isSearching && searchResults.length === 0 ? (
              <Txt style={{ textAlign: "center", paddingVertical: 32, color: palette.gray500 }}>No orders match your search</Txt>
            ) : (
              searchResults.map((o) => {
                const t = transformOrderForList(o);
                return <OrderCard key={t.mongoId || t.orderId} order={t} onSelect={selectOrder} />;
              })
            )}
          </View>
        ) : (
          <OrdersList key={activeFilter} tab={activeFilter} refreshToken={refreshToken} onSelectOrder={selectOrder} onStatusChanged={requestOrdersRefresh} isSocketConnected={isConnected} />
        )}
      </ScrollView>

      <NewOrderPopup
        visible={showPopup && !showReject}
        order={popupOrder || newOrder}
        queueLength={orderQueue.length}
        countdown={countdown}
        prepTime={prepTime}
        setPrepTime={setPrepTime}
        accepting={accepting}
        onAccept={handleAccept}
        onReject={() => setShowReject(true)}
        isMuted={isMuted}
        onToggleMute={toggleMute}
        cancelledLabel={cancelledLabel}
      />
      <ReasonSheet
        visible={showReject}
        title={`Reject Order ${(popupOrder || newOrder)?.orderId || "#Order"}`}
        value={rejectReason}
        onChange={setRejectReason}
        onConfirm={handleRejectConfirm}
        onClose={() => {
          setShowReject(false);
          setRejectReason("");
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: "row", gap: 12, marginTop: 16, padding: 14, borderRadius: 16, borderWidth: 1 },
  verify: { marginTop: 16, padding: 18, borderRadius: 16, borderWidth: 1, borderColor: palette.gray100, backgroundColor: palette.white },
  reviewChip: { fontSize: 10, color: palette.purple600, backgroundColor: "#f3e8ff", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: "hidden" },
  chipsWrap: { backgroundColor: rt.pageBg },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: palette.white, borderWidth: 1, borderColor: palette.gray200 },
  chipActive: { backgroundColor: rt.primary, borderColor: rt.primary },
  count: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: palette.red500, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
});
