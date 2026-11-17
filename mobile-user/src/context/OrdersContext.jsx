/** Port of web context/OrdersContext.jsx */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getJSON, localStore } from "../utils/storage";
import { hasUserSession } from "../auth/session";
import { addAppListener } from "../utils/events";

const OrdersContext = createContext(null);

const normalizeOrderLookupId = (value) => (value == null ? "" : String(value).trim());
const orderLookupIds = (order) =>
  !order ? [] : [order._id, order.mongoId, order.orderMongoId, order.orderId, order.id].map(normalizeOrderLookupId).filter(Boolean);

export function OrdersProvider({ children }) {
  const [orders, setOrders] = useState(() => {
    const saved = getJSON("userOrders", []);
    return Array.isArray(saved) ? saved : [];
  });

  useEffect(() => {
    if (orders.length > 0 || hasUserSession()) localStore.setItem("userOrders", JSON.stringify(orders));
  }, [orders]);

  const createOrder = (orderData) => {
    const newOrder = {
      id: `ORD-${Date.now()}`,
      ...orderData,
      status: "confirmed",
      createdAt: new Date().toISOString(),
      tracking: {
        confirmed: { status: true, timestamp: new Date().toISOString() },
        preparing: { status: false, timestamp: null },
        outForDelivery: { status: false, timestamp: null },
        delivered: { status: false, timestamp: null },
      },
    };
    setOrders((prev) => [newOrder, ...prev]);
    return newOrder.id;
  };

  const upsertOrder = useCallback((apiOrder) => {
    if (!apiOrder || typeof apiOrder !== "object") return;
    const incomingIds = orderLookupIds(apiOrder);
    if (incomingIds.length === 0) return;
    setOrders((prev) => {
      const idx = prev.findIndex((existing) => {
        const existingIds = orderLookupIds(existing);
        return incomingIds.some((id) => existingIds.includes(id));
      });
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...apiOrder };
        return next;
      }
      return [apiOrder, ...prev];
    });
  }, []);

  useEffect(() => addAppListener("order-placed", (e) => e?.detail?.order && upsertOrder(e.detail.order)), [upsertOrder]);

  const getOrderById = useCallback(
    (orderId) => {
      const needle = normalizeOrderLookupId(orderId);
      if (!needle) return null;
      return orders.find((order) => orderLookupIds(order).includes(needle)) || null;
    },
    [orders],
  );
  const getAllOrders = useCallback(() => [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), [orders]);
  const updateOrderStatus = useCallback((orderId, status) => {
    setOrders((prev) =>
      prev.map((order) => {
        if (order.id !== orderId) return order;
        const updatedTracking = { ...order.tracking };
        if (status === "preparing") updatedTracking.preparing = { status: true, timestamp: new Date().toISOString() };
        else if (status === "outForDelivery") updatedTracking.outForDelivery = { status: true, timestamp: new Date().toISOString() };
        else if (status === "delivered") updatedTracking.delivered = { status: true, timestamp: new Date().toISOString() };
        return { ...order, status, tracking: updatedTracking };
      }),
    );
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(() => ({ orders, createOrder, getOrderById, getAllOrders, updateOrderStatus }), [orders]);
  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
}

export function useOrders() {
  const context = useContext(OrdersContext);
  if (!context) throw new Error("useOrders must be used within an OrdersProvider");
  return context;
}
