import { restaurantAPI } from "@food/api";

const CACHE_TTL_MS = 15000; // 15s session cache to prevent stale status
const cache = new Map();
const inFlight = new Map();

/** Session cache + in-flight dedupe for outlet timings (viewport-deferred fetch). */
export async function fetchOutletTimingsOnce(restaurantId) {
  const id = String(restaurantId || "").trim();
  if (!id) return null;
  const entry = cache.get(id);
  if (entry && Date.now() - entry.time < CACHE_TTL_MS) return entry.data;
  if (inFlight.has(id)) return inFlight.get(id);

  const promise = (async () => {
    try {
      const response = await restaurantAPI.getOutletTimingsByRestaurantId(id, { noCache: true });
      const timings =
        response?.data?.data?.outletTimings ||
        response?.data?.outletTimings ||
        null;
      cache.set(id, { data: timings, time: Date.now() });
      return timings;
    } catch {
      cache.set(id, { data: null, time: Date.now() });
      return null;
    } finally {
      inFlight.delete(id);
    }
  })();

  inFlight.set(id, promise);
  return promise;
}

export function primeOutletTimingsCache(restaurantId, timings) {
  const id = String(restaurantId || "").trim();
  if (!id || timings == null) return;
  cache.set(id, { data: timings, time: Date.now() });
}