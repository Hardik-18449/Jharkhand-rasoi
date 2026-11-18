/**
 * Port of OrdersMain.jsx list components (AllOrders / NewOrders / PreparingOrders / ReadyOrders / OutForDeliveryOrders /
 * ScheduledOrders / CompletedOrders / CancelledOrders / DeadOrders) + RestaurantOrdersPagination.
 * One generic list: backend status filter, VIP-first sort, preparing ETA countdown + auto mark-ready, manual mark-ready.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import Txt from "../ui/Txt";
import Spinner from "../ui/Spinner";
import OrderCard, { transformOrderForList } from "./OrderCard";
import usePaginatedRestaurantOrders, { RESTAURANT_ORDER_TAB_STATUS } from "../../hooks/usePaginatedRestaurantOrders";
import { restaurantAPI } from "../../api";
import { toast } from "../../utils/toast";
import { palette } from "../../theme";

const STATUS_PRIORITY = { pending: 0, confirmed: 1, preparing: 2, ready: 3, out_for_delivery: 4, scheduled: 5, delivered: 6, completed: 6, cancelled: 7, dead: 8 };
const TITLES = {
  all: ["All orders", "No orders found"],
  new: ["New orders", "No new orders found"],
  preparing: ["Preparing orders", "No orders in preparation"],
  ready: ["Ready for pickup", "No orders ready for pickup"],
  "out-for-delivery": ["Out for delivery", "No orders out for delivery"],
  scheduled: ["Scheduled orders", "No scheduled orders"],
  completed: ["Completed orders", "No completed orders"],
  cancelled: ["Cancelled orders", "No cancelled orders"],
  dead: ["Dead orders", "No dead orders"],
};
const POLL_TABS = new Set(["all", "new", "preparing", "ready", "out-for-delivery", "scheduled"]);

export function Pagination({ page, totalPages, total, limit, onPageChange }) {
  if (!totalPages || totalPages <= 1) return null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  return (
    <View style={styles.pager}>
      <Pressable onPress={() => onPageChange(page - 1)} disabled={page <= 1} style={[styles.pageBtn, page <= 1 && { opacity: 0.4 }]}>
        <ChevronLeft size={16} color={palette.gray700} />
      </Pressable>
      <Txt weight={500} style={{ fontSize: 12, color: palette.gray600 }}>
        {from}–{to} of {total} • Page {page}/{totalPages}
      </Txt>
      <Pressable onPress={() => onPageChange(page + 1)} disabled={page >= totalPages} style={[styles.pageBtn, page >= totalPages && { opacity: 0.4 }]}>
        <ChevronRight size={16} color={palette.gray700} />
      </Pressable>
    </View>
  );
}

export default function OrdersList({ tab, refreshToken, onSelectOrder, onStatusChanged, isSocketConnected }) {
  const pollMs = tab === "preparing" ? (isSocketConnected ? 45000 : 20000) : isSocketConnected ? 30000 : 15000;
  const { orders: raw, meta, page, loading, setPage, refetch } = usePaginatedRestaurantOrders({
    status: RESTAURANT_ORDER_TAB_STATUS[tab] || "all",
    refreshToken,
    enablePoll: POLL_TABS.has(tab),
    pollMs,
  });
  const [now, setNow] = useState(() => new Date());
  const [marking, setMarking] = useState({});
  const [hidden, setHidden] = useState(() => new Set());
  const markedRef = useRef(new Set());

  useEffect(() => {
    if (tab !== "preparing") return undefined;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [tab]);

  const orders = useMemo(() => {
    const list = raw.map((o) => {
      const t = transformOrderForList(o);
      if (tab === "preparing") t.type = o.deliveryFleet === "standard" || !o.deliveryFleet ? "Home Delivery" : "Express Delivery";
      return t;
    });
    const filtered = list.filter((o) => !hidden.has(o.mongoId || o.orderId));
    if (tab === "all" || tab === "new") {
      filtered.sort((a, b) => {
        if (a.isPriority !== b.isPriority) return a.isPriority ? -1 : 1;
        if (tab === "all") {
          const d = (STATUS_PRIORITY[a.status] ?? 999) - (STATUS_PRIORITY[b.status] ?? 999);
          if (d) return d;
        }
        return b.sortTimestamp - a.sortTimestamp;
      });
    }
    return filtered;
  }, [raw, hidden, tab]);

  const etaFor = (o) => {
    const elapsedMs = now - o.preparingTimestamp;
    const remainingMin = Math.max(0, o.initialETA - Math.floor(elapsedMs / 60000));
    if (remainingMin > 0) return `${remainingMin} mins`;
    const secs = Math.max(0, Math.floor(o.initialETA * 60 - elapsedMs / 1000));
    return secs > 0 ? `${secs} secs` : "0 mins";
  };

  // Auto mark ready when ETA elapses (web PreparingOrders)
  useEffect(() => {
    if (tab !== "preparing" || !orders.length) return;
    orders.forEach(async (o) => {
      const key = o.mongoId || o.orderId;
      if (markedRef.current.has(key) || String(o.status).toLowerCase() !== "preparing") return;
      const elapsedSec = Math.floor((now - o.preparingTimestamp) / 1000);
      if (elapsedSec < o.initialETA * 60 - 2) return;
      markedRef.current.add(key);
      try {
        await restaurantAPI.markOrderReady(key);
        onStatusChanged?.();
        refetch();
      } catch (e) {
        const msg = String(e?.response?.data?.message || e?.message || "").toLowerCase();
        if (!(e?.response?.status === 400 && (msg.includes("cannot be marked as ready") || msg.includes("current status")))) markedRef.current.delete(key);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, tab]);

  const handleMarkReady = async (o) => {
    const key = o.mongoId || o.orderId;
    if (!key || marking[key]) return;
    setMarking((p) => ({ ...p, [key]: true }));
    try {
      await restaurantAPI.markOrderReady(key);
      setHidden((p) => new Set(p).add(key));
      toast.success(`Order ${o.orderId} marked ready${o.customerName ? ` for ${o.customerName}` : ""}`);
      onStatusChanged?.();
      refetch();
    } catch (e) {
      const message = e?.response?.data?.message || "Failed to mark order as ready";
      if (e?.response?.status === 400 && String(message).toLowerCase().includes("current status")) {
        setHidden((p) => new Set(p).add(key));
        toast.success(`Order ${o.orderId} is already ready`);
        onStatusChanged?.();
        refetch();
      } else toast.error(message);
    } finally {
      setMarking((p) => {
        const n = { ...p };
        delete n[key];
        return n;
      });
    }
  };

  const [title, empty] = TITLES[tab] || TITLES.all;
  return (
    <View style={{ paddingTop: 4, paddingBottom: 24 }}>
      <View style={styles.titleRow}>
        <Txt weight={600} style={{ fontSize: 16, color: palette.black }}>{title}</Txt>
        {loading ? <Spinner size="small" color={palette.gray500} /> : <Txt style={{ fontSize: 12, color: palette.gray500 }}>{meta.total} {tab === "preparing" ? "active" : "total"}</Txt>}
      </View>
      {loading && !orders.length ? (
        <Txt style={styles.empty}>Loading...</Txt>
      ) : orders.length === 0 ? (
        <Txt style={styles.empty}>{empty}</Txt>
      ) : (
        orders.map((o) => (
          <OrderCard
            key={o.mongoId || o.orderId}
            order={tab === "preparing" ? { ...o, eta: etaFor(o) } : o}
            onSelect={onSelectOrder}
            onMarkReady={handleMarkReady}
            isMarkingReady={Boolean(marking[o.mongoId || o.orderId])}
            onRefresh={() => refetch()}
          />
        ))
      )}
      <Pagination page={page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit || 30} onPageChange={setPage} />
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  empty: { textAlign: "center", paddingVertical: 32, color: palette.gray500, fontSize: 14 },
  pager: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 8 },
  pageBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: palette.gray200, backgroundColor: palette.white, alignItems: "center", justifyContent: "center" },
});
