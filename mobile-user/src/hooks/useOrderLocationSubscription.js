/** Port of hooks/useOrderLocationSubscription.js — joins order tracking rooms on the shared user socket. */
import { useEffect, useState } from "react";
import { userAPI } from "../api";
import { acquireUserSocket, releaseUserSocket, joinOrderTrackingRooms, leaveOrderTrackingRooms, subscribeLocationUpdates } from "../utils/userSocketManager";

function useFoodUserId(enabled) {
  const [userId, setUserId] = useState(null);
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const r = await userAPI.getProfile();
        const u = r.data?.data?.user;
        const id = u?._id?.toString() || u?.userId || u?.id;
        if (!cancelled && id) setUserId(String(id));
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return userId;
}

export function useOrderLocationSubscription(orderIds = [], { enabled = true } = {}) {
  const userId = useFoodUserId(enabled);
  const idsKey = [...new Set(orderIds.map((id) => String(id || "").trim()).filter(Boolean))].join("|");
  useEffect(() => {
    if (!enabled || !userId || !idsKey) return undefined;
    const ids = idsKey.split("|").filter(Boolean);
    acquireUserSocket(userId);
    joinOrderTrackingRooms(ids);
    return () => {
      leaveOrderTrackingRooms(ids);
      releaseUserSocket();
    };
  }, [enabled, userId, idsKey]);
  return { subscribeLocationUpdates, userId, isReady: Boolean(userId) };
}

export default useOrderLocationSubscription;
