/** Ports of DeliveryV2/hooks/useOrderManager.js + useProximityCheck.js (same API calls, statuses and messages). */
import { useMemo, useRef } from "react";
import { deliveryAPI } from "../api";
import { toast } from "../utils/toast";
import { useDeliveryStore } from "./store";
import { calculateDistance, getOrderAcceptId, parseLatLng } from "./orderUtils";

const errMsg = (e, fallback) => e?.response?.data?.error || e?.response?.data?.message || fallback;

export function useProximityCheck() {
  const riderLocation = useDeliveryStore((s) => s.riderLocation);
  const activeOrder = useDeliveryStore((s) => s.activeOrder);
  const tripStatus = useDeliveryStore((s) => s.tripStatus);
  const settings = useDeliveryStore((s) => s.settings);

  const targetLocation = useMemo(() => {
    if (!activeOrder) return null;
    if (["PICKING_UP", "REACHED_PICKUP"].includes(tripStatus))
      return parseLatLng(activeOrder.restaurantLocation) || parseLatLng(activeOrder.restaurant_location) || parseLatLng(activeOrder.restaurantId?.location) || parseLatLng(activeOrder.restaurantId);
    if (["PICKED_UP", "REACHED_DROP"].includes(tripStatus))
      return parseLatLng(activeOrder.customerLocation) || parseLatLng(activeOrder.customer_location) || parseLatLng(activeOrder.deliveryAddress?.location) || parseLatLng(activeOrder.deliveryAddress);
    return null;
  }, [activeOrder, tripStatus]);

  const riderPoint = useMemo(() => parseLatLng(riderLocation), [riderLocation]);
  const actionLimit = tripStatus === "PICKING_UP" ? settings.pickupRangeLimit || 1500 : tripStatus === "PICKED_UP" ? settings.deliveryRangeLimit || 1500 : 1500;
  const distanceToTarget = useMemo(
    () => (!riderPoint || !targetLocation ? Infinity : calculateDistance(riderPoint.lat, riderPoint.lng, targetLocation.lat, targetLocation.lng)),
    [riderPoint, targetLocation],
  );
  const isWithinRange = !targetLocation ? true : distanceToTarget <= actionLimit;
  return { distanceToTarget, isWithinRange, actionLimit, targetLocation };
}

const getLoc = (ref, keysLat, keysLng) => {
  if (!ref) return null;
  if (ref.location) {
    if (Array.isArray(ref.location.coordinates) && ref.location.coordinates.length >= 2) return { lat: ref.location.coordinates[1], lng: ref.location.coordinates[0] };
    return { lat: ref.location.latitude || ref.location.lat, lng: ref.location.longitude || ref.location.lng };
  }
  for (const k of keysLat) if (ref[k] != null) return { lat: ref[k], lng: ref[keysLng[keysLat.indexOf(k)]] };
  return null;
};

export function useOrderManager() {
  const { activeOrder, updateTripStatus, clearActiveOrder, removeAcceptedOrder, setActiveOrder, riderLocation } = useDeliveryStore();
  const inFlight = useRef(false);
  const resolveOrderId = (o = activeOrder) => getOrderAcceptId(o);

  const acceptOrder = async (order) => {
    if (inFlight.current) {
      toast.info("Already processing this order...");
      return;
    }
    const orderId = resolveOrderId(order);
    if (!orderId) {
      toast.error("Invalid order data");
      return;
    }
    inFlight.current = true;
    try {
      const res = await deliveryAPI.acceptOrder(orderId);
      if (!res?.data?.success) {
        toast.error(res?.data?.message || "Order already taken or unavailable");
        throw new Error("Accept failed");
      }
      const full = res.data.data?.order || order;
      const resLoc = getLoc(full.restaurantId, ["latitude", "lat"], ["longitude", "lng"]) || getLoc(full, ["restaurant_lat", "restaurantLat", "latitude"], ["restaurant_lng", "restaurantLng", "longitude"]);
      const cusLoc = getLoc(full.deliveryAddress, ["latitude", "lat"], ["longitude", "lng"]) || getLoc(full, ["customer_lat", "customerLat", "latitude"], ["customer_lng", "customerLng", "longitude"]);
      setActiveOrder({ ...full, orderId, restaurantLocation: resLoc, customerLocation: cusLoc });
      updateTripStatus("PICKING_UP");
    } catch (error) {
      const msg = errMsg(error, "Network error. Please try again.");
      if (error?.response?.status === 403 || String(msg).toLowerCase().includes("already accepted")) toast.error("This order was just taken by another delivery partner.", { duration: 4000 });
      else if (error?.message !== "Accept failed") toast.error(msg);
      throw error;
    } finally {
      inFlight.current = false;
    }
  };

  const reachPickup = async () => {
    const orderId = resolveOrderId();
    if (!orderId) {
      toast.error("Order id not found. Please refresh current trip.");
      throw new Error("Missing order id");
    }
    try {
      const res = await deliveryAPI.confirmReachedPickup(orderId);
      if (!res?.data?.success) throw new Error("Confirm pickup failed");
      updateTripStatus("REACHED_PICKUP");
    } catch (e) {
      toast.error(errMsg(e, "Failed to update status"));
      throw e;
    }
  };

  const pickUpOrder = async (billImageUrl, otp) => {
    const orderId = resolveOrderId();
    if (!orderId) {
      toast.error("Order id not found. Please refresh current trip.");
      throw new Error("Missing order id");
    }
    try {
      const res = await deliveryAPI.confirmOrderId(orderId, activeOrder.displayOrderId || orderId, riderLocation || {}, { billImageUrl, otp });
      if (!res?.data?.success) throw new Error("Confirm order ID failed");
      updateTripStatus("PICKED_UP");
    } catch (e) {
      toast.error(errMsg(e, "Error confirming pickup"));
      throw e;
    }
  };

  const reachDrop = async () => {
    const orderId = resolveOrderId();
    if (!orderId) {
      toast.error("Order id not found. Please refresh current trip.");
      throw new Error("Missing order id");
    }
    try {
      const res = await deliveryAPI.confirmReachedDrop(orderId);
      if (!res?.data?.success) throw new Error("Confirm drop failed");
      updateTripStatus("REACHED_DROP");
    } catch (e) {
      toast.error(errMsg(e, "Failed to notify arrival"));
      throw e;
    }
  };

  const completeDelivery = async (otp, paymentOverride, targetOrder) => {
    const cur = targetOrder || activeOrder;
    const orderId = cur?.order_id || cur?.orderId || cur?._id || cur?.orderMongoId || resolveOrderId();
    if (!orderId) {
      toast.error("Order id not found. Please refresh current trip.");
      throw new Error("Missing order id");
    }
    try {
      const alreadyVerified = cur?.deliveryVerification?.dropOtp?.verified;
      const bypass = !otp || otp === "BYPASS" || otp === "SKIP";
      if (!alreadyVerified && !bypass) {
        const v = await deliveryAPI.verifyDropOtp(orderId, otp);
        if (!v?.data?.success) {
          toast.error("Invalid OTP. Please check with customer.");
          throw new Error("Invalid OTP");
        }
      }
      const otpToUse = otp || cur?.deliveryVerification?.dropOtp?.code || "BYPASS";
      let finalOrder = cur;
      try {
        const c = await deliveryAPI.completeDelivery(orderId, { otp: otpToUse, rating: 5, paymentOverride, paymentMethod: paymentOverride });
        if (c.data?.success && c.data?.data?.order) finalOrder = c.data.data.order;
      } catch (ce) {
        const m = String(errMsg(ce, "")).toLowerCase();
        if (!m.includes("already at status") && !m.includes("delivered")) throw ce;
      }
      if (finalOrder) setActiveOrder(finalOrder);
      updateTripStatus("COMPLETED");
    } catch (e) {
      if (e?.message !== "Invalid OTP") toast.error(errMsg(e, "Verification failed"));
      throw e;
    }
  };

  const resetTrip = () => {
    const id = resolveOrderId();
    if (id) removeAcceptedOrder(id);
    clearActiveOrder();
  };

  return { acceptOrder, reachPickup, pickUpOrder, reachDrop, completeDelivery, resetTrip };
}
