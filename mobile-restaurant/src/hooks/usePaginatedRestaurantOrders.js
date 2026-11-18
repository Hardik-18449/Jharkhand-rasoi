/** Port of web hooks/usePaginatedRestaurantOrders.js (backend status filter, 30/page, optional silent poll). */
import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { restaurantAPI } from "../api";

export const RESTAURANT_ORDERS_PAGE_SIZE = 30;
export const RESTAURANT_ORDER_TAB_STATUS = {
  new: "new",
  preparing: "preparing",
  ready: "ready",
  "out-for-delivery": "out_for_delivery",
  scheduled: "scheduled",
  completed: "completed",
  cancelled: "cancelled",
  dead: "dead",
  all: "all",
};

export default function usePaginatedRestaurantOrders({ status = "all", refreshToken = 0, enablePoll = false, pollMs = 15000 }) {
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: RESTAURANT_ORDERS_PAGE_SIZE, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(
    async (pageNum, { silent = false } = {}) => {
      if (!silent) setLoading(true);
      try {
        const res = await restaurantAPI.getOrders({ page: pageNum, limit: RESTAURANT_ORDERS_PAGE_SIZE, status });
        if (res.data?.success) {
          const rows = res.data.data?.orders || [];
          const m = res.data.data?.meta || {};
          setOrders(rows);
          setMeta({ total: Number(m.total ?? rows.length), page: Number(m.page ?? pageNum), limit: Number(m.limit ?? RESTAURANT_ORDERS_PAGE_SIZE), totalPages: Number(m.totalPages ?? 1) });
        } else {
          setOrders([]);
          setMeta({ total: 0, page: pageNum, limit: RESTAURANT_ORDERS_PAGE_SIZE, totalPages: 1 });
        }
      } catch {
        if (!silent) setOrders([]);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [status],
  );

  useEffect(() => {
    setPage(1);
  }, [status, refreshToken]);

  useEffect(() => {
    fetchOrders(page);
  }, [page, refreshToken, fetchOrders]);

  useEffect(() => {
    if (!enablePoll) return undefined;
    const id = setInterval(() => {
      if (AppState.currentState !== "active") return;
      fetchOrders(page, { silent: true });
    }, pollMs);
    return () => clearInterval(id);
  }, [enablePoll, pollMs, page, fetchOrders]);

  const goToPage = (next) => setPage(() => Math.max(1, Math.min(next, meta.totalPages || 1)));

  return { orders, meta, page, loading, setPage: goToPage, refetch: (opts) => fetchOrders(page, opts) };
}
