/**
 * Port of DeliveryV2/store/useDeliveryStore.js (zustand) without the dependency:
 * same state + actions; `useDeliveryStore(selector?)` hook and `useDeliveryStore.getState()`.
 * Only `isOnline` is persisted (web: partialize → 'delivery-v2-online-pref').
 */
import { useSyncExternalStore } from "react";
import { localStore } from "../utils/storage";

const PERSIST_KEY = "delivery-v2-online-pref";
const listeners = new Set();

const readPersistedOnline = () => {
  try {
    const raw = localStore.getItem(PERSIST_KEY);
    return Boolean(raw && JSON.parse(raw)?.state?.isOnline);
  } catch {
    return false;
  }
};

const idOf = (o) => String(o?._id || o?.orderId || "");

let state = {
  isOnline: false,
  riderLocation: null,
  activeOrder: null,
  acceptedOrders: [],
  orderCapacity: { enabled: false, maxConcurrentOrders: 1, effectiveLimit: 1, activeOrderCount: 0, remainingSlots: 1, canAcceptMore: true },
  tripStatus: "IDLE", // IDLE | PICKING_UP | REACHED_PICKUP | PICKED_UP | REACHED_DROP | COMPLETED
  settings: { pickupRangeLimit: 1500, deliveryRangeLimit: 1500 },
  // incoming offers queue (web: DeliveryHomeV2 incomingOrders / selectedIncomingId) — shared by Home + Orders tabs
  incomingOrders: [],
  selectedIncomingId: null,
  cashLimitNotice: null,
};

const set = (partial) => {
  const next = typeof partial === "function" ? partial(state) : partial;
  const prevOnline = state.isOnline;
  state = { ...state, ...next };
  if (state.isOnline !== prevOnline) localStore.setItem(PERSIST_KEY, JSON.stringify({ state: { isOnline: state.isOnline } }));
  listeners.forEach((l) => l());
};

const actions = {
  hydrate: () => set({ isOnline: readPersistedOnline() }),
  toggleOnline: () => set((s) => ({ isOnline: !s.isOnline })),
  setOnline: (online) => set({ isOnline: Boolean(online) }),
  setRiderLocation: (location) => set({ riderLocation: location }),
  setSettings: (newSettings) => set((s) => ({ settings: { ...s.settings, ...newSettings } })),
  setActiveOrder: (order) =>
    set((s) => ({
      activeOrder: order,
      acceptedOrders: order ? [...s.acceptedOrders.filter((i) => idOf(i) !== idOf(order)), order] : s.acceptedOrders,
      tripStatus: order ? (s.tripStatus === "IDLE" ? "PICKING_UP" : s.tripStatus) : "IDLE",
    })),
  updateTripStatus: (status) => set({ tripStatus: status }),
  setAcceptedOrders: (orders = []) =>
    set((s) => {
      const acceptedOrders = Array.isArray(orders) ? orders : [];
      const selectedId = idOf(s.activeOrder);
      const activeOrder = acceptedOrders.find((i) => idOf(i) === selectedId) || acceptedOrders[0] || null;
      return { acceptedOrders, activeOrder };
    }),
  removeAcceptedOrder: (orderId) =>
    set((s) => {
      const id = String(orderId || "");
      const acceptedOrders = s.acceptedOrders.filter((i) => idOf(i) !== id);
      const wasSelected = idOf(s.activeOrder) === id;
      const limit = Number(s.orderCapacity.effectiveLimit || 1);
      return {
        acceptedOrders,
        activeOrder: wasSelected ? null : s.activeOrder,
        tripStatus: wasSelected ? "IDLE" : s.tripStatus,
        orderCapacity: {
          ...s.orderCapacity,
          activeOrderCount: Math.max(0, Number(s.orderCapacity.activeOrderCount || s.acceptedOrders.length) - 1),
          remainingSlots: Math.max(0, limit - acceptedOrders.length),
          canAcceptMore: acceptedOrders.length < limit,
        },
      };
    }),
  setOrderCapacity: (capacity = {}) => set((s) => ({ orderCapacity: { ...s.orderCapacity, ...capacity } })),
  clearActiveOrder: () => set({ activeOrder: null, tripStatus: "IDLE" }),
  setIncomingOrders: (fnOrList) => set((s) => ({ incomingOrders: typeof fnOrList === "function" ? fnOrList(s.incomingOrders) : fnOrList || [] })),
  setSelectedIncomingId: (fnOrId) => set((s) => ({ selectedIncomingId: typeof fnOrId === "function" ? fnOrId(s.selectedIncomingId) : fnOrId })),
  setCashLimitNotice: (n) => set({ cashLimitNotice: n || null }),
};

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getSnapshot = () => state;

export function useDeliveryStore(selector) {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const full = { ...snap, ...actions };
  return selector ? selector(full) : full;
}
useDeliveryStore.getState = () => ({ ...state, ...actions });
useDeliveryStore.actions = actions;
