/**
 * Offer queue actions shared by Home + Orders tabs — port of DeliveryHomeV2's handleAcceptOffer / handlePassOffer /
 * removeClaimedOrderFromQueue / refreshAcceptedOrders / handleOpenAcceptedOrder + normalizeDeliveryActiveOrder.
 */
import { useCallback } from "react";
import { deliveryAPI } from "../api";
import { toast } from "../utils/toast";
import { useDeliveryStore } from "./store";
import { useOrderManager } from "./useTrip";
import { useDeliveryNotifications } from "./DeliveryNotificationContext";
import { getOrderAcceptId, getOrderMongoId, isSameOrder, normalizeIncomingOrder, removeIncomingOrderFromQueue } from "./orderUtils";

function extractOrderLocation(ref, keysLat = [], keysLng = []) {
  if (!ref) return null;
  const cand = ref.location && typeof ref.location === "object" ? ref.location : ref;
  const coords = Array.isArray(cand?.coordinates) ? cand.coordinates : Array.isArray(cand?.location?.coordinates) ? cand.location.coordinates : null;
  if (coords?.length >= 2) {
    const lng = Number(coords[0]);
    const lat = Number(coords[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  const lat = Number(cand?.latitude ?? cand?.lat ?? cand?.location?.latitude ?? cand?.location?.lat);
  const lng = Number(cand?.longitude ?? cand?.lng ?? cand?.location?.longitude ?? cand?.location?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  for (const [i, k] of keysLat.entries()) {
    if (ref[k] != null) {
      const a = Number(ref[k]);
      const b = Number(ref[keysLng[i]]);
      if (Number.isFinite(a) && Number.isFinite(b)) return { lat: a, lng: b };
    }
  }
  return null;
}

export function normalizeDeliveryActiveOrder(raw) {
  if (!raw) return null;
  const restaurantLocation =
    extractOrderLocation(raw.restaurantLocation) ||
    extractOrderLocation(raw.restaurantId, ["latitude", "lat"], ["longitude", "lng"]) ||
    extractOrderLocation(raw.restaurant, ["latitude", "lat"], ["longitude", "lng"]) ||
    extractOrderLocation(raw, ["restaurant_lat", "restaurantLat"], ["restaurant_lng", "restaurantLng"]);
  const customerLocation =
    extractOrderLocation(raw.customerLocation) ||
    extractOrderLocation(raw.deliveryAddress, ["latitude", "lat"], ["longitude", "lng"]) ||
    extractOrderLocation(raw.customer_address, ["latitude", "lat"], ["longitude", "lng"]) ||
    extractOrderLocation(raw.user, ["latitude", "lat"], ["longitude", "lng"]) ||
    extractOrderLocation(raw, ["customer_lat", "customerLat"], ["customer_lng", "customerLng"]);
  return {
    ...raw,
    _id: raw._id || raw.orderMongoId || raw.orderId,
    orderId: raw.orderId || raw.order_id || raw._id || raw.orderMongoId,
    restaurantLocation,
    customerLocation,
    items: Array.isArray(raw.items) ? raw.items : Array.isArray(raw.orderItems) ? raw.orderItems : [],
  };
}

export function getTripStatusForOrder(order) {
  const s = String(order?.deliveryStatus || order?.orderState?.status || order?.orderStatus || order?.status || "").toLowerCase();
  const phase = String(order?.deliveryState?.currentPhase || "").toLowerCase();
  if (["delivered", "completed"].includes(s)) return "COMPLETED";
  if (phase === "at_drop" || s === "reached_drop") return "REACHED_DROP";
  if (["picked_up", "delivering"].includes(s)) return "PICKED_UP";
  if (phase === "at_pickup" || s === "reached_pickup") return "REACHED_PICKUP";
  return "PICKING_UP";
}

export function useOffers() {
  const { acceptOrder } = useOrderManager();
  const { clearNewOrder } = useDeliveryNotifications();

  const syncSelectionAfterQueueChange = useCallback((nextQueue) => {
    useDeliveryStore.actions.setSelectedIncomingId((cur) => {
      const still = (nextQueue || []).some((i) => cur && ((getOrderMongoId(i) || getOrderAcceptId(i)) === cur || isSameOrder(i, { orderMongoId: cur, _id: cur, orderId: cur })));
      if (still) return cur;
      return nextQueue?.[0] ? getOrderMongoId(nextQueue[0]) || getOrderAcceptId(nextQueue[0]) : null;
    });
  }, []);

  const removeClaimedOrderFromQueue = useCallback(
    (claimedRef, { notify = true, visibleOrder = null } = {}) => {
      const target = { orderMongoId: claimedRef?.orderMongoId || claimedRef?.orderId || claimedRef?._id, orderId: claimedRef?.orderId, _id: claimedRef?._id };
      const { incomingOrders } = useDeliveryStore.getState();
      const wasVisible = visibleOrder && isSameOrder(visibleOrder, target);
      const wasQueued = incomingOrders.some((i) => isSameOrder(i, target) && visibleOrder && !isSameOrder(i, visibleOrder));
      const next = removeIncomingOrderFromQueue(incomingOrders, target);
      useDeliveryStore.actions.setIncomingOrders(next);
      syncSelectionAfterQueueChange(next);
      if (notify && wasVisible) {
        if (claimedRef?.claimedBy === "cancelled") toast.error("Order was cancelled.", { duration: 4000 });
        else toast.info("Order was taken by another delivery partner.", { duration: 4000 });
      } else if (notify && wasQueued) toast.info("One of your queued orders was taken.", { duration: 3000 });
      clearNewOrder();
    },
    [syncSelectionAfterQueueChange, clearNewOrder],
  );

  const refreshAcceptedOrders = useCallback(async () => {
    const res = await deliveryAPI.getActiveOrders();
    const payload = res?.data?.data || {};
    const orders = (Array.isArray(payload.activeOrders) ? payload.activeOrders : []).map(normalizeDeliveryActiveOrder);
    useDeliveryStore.actions.setAcceptedOrders(orders);
    useDeliveryStore.actions.setOrderCapacity(payload.capacity || {});
    return orders;
  }, []);

  const handleAcceptOffer = useCallback(
    async (order) => {
      const target = normalizeIncomingOrder(order);
      try {
        await acceptOrder(target);
        removeClaimedOrderFromQueue(target, { notify: false });
        await refreshAcceptedOrders().catch(() => {});
      } catch (err) {
        const msg = String(err?.response?.data?.message || err?.message || "").toLowerCase();
        if (msg.includes("already accepted") || msg.includes("another partner") || err?.response?.status === 403) removeClaimedOrderFromQueue(target, { notify: false });
        throw err;
      }
    },
    [acceptOrder, refreshAcceptedOrders, removeClaimedOrderFromQueue],
  );

  const handlePassOffer = useCallback(
    async (order) => {
      const id = getOrderMongoId(order) || getOrderAcceptId(order);
      if (!id) return;
      try {
        await deliveryAPI.passOrder(id);
        toast.success("Order passed");
      } catch (e) {
        toast.error(e?.response?.data?.message || "This offer is no longer available");
      } finally {
        removeClaimedOrderFromQueue(order, { notify: false });
      }
    },
    [removeClaimedOrderFromQueue],
  );

  const openAcceptedOrder = useCallback((order) => {
    const n = normalizeDeliveryActiveOrder(order);
    useDeliveryStore.actions.setActiveOrder(n);
    useDeliveryStore.actions.updateTripStatus(getTripStatusForOrder(n));
  }, []);

  return { handleAcceptOffer, handlePassOffer, removeClaimedOrderFromQueue, refreshAcceptedOrders, openAcceptedOrder, syncSelectionAfterQueueChange };
}
