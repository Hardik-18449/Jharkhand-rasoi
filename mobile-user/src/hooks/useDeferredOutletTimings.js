/** Port of web hooks/user/useDeferredOutletTimings.js — native lists mount lazily, so fetch on mount when missing. */
import { useEffect, useState } from "react";
import { fetchOutletTimingsOnce, primeOutletTimingsCache } from "../utils/outletTimingsCache";

export function useDeferredOutletTimings(restaurantId, initialTimings = null) {
  const [outletTimings, setOutletTimings] = useState(initialTimings);
  const needsFetch = initialTimings == null && Boolean(restaurantId);

  useEffect(() => {
    setOutletTimings(initialTimings);
    if (initialTimings != null && restaurantId) primeOutletTimingsCache(restaurantId, initialTimings);
  }, [initialTimings, restaurantId]);

  useEffect(() => {
    if (!needsFetch) return undefined;
    let cancelled = false;
    fetchOutletTimingsOnce(restaurantId).then((timings) => {
      if (!cancelled && timings) setOutletTimings(timings);
    });
    return () => {
      cancelled = true;
    };
  }, [needsFetch, restaurantId]);

  return { outletTimings };
}
