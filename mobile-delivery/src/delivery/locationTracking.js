/**
 * Rider GPS — native replacement for DeliveryHomeV2's navigator.geolocation.watchPosition + the web "keep-alive" hacks
 * (wake lock / silent audio). Uses an Android foreground-service location task so tracking continues while the rider
 * is in Google Maps; falls back to foreground watchPositionAsync when background permission is refused.
 * Each fix → store.riderLocation + "riderLocationUpdate" app event (the home screen emits it to the socket).
 * HTTP availability heartbeat every 45 s (web lastHttpSyncAt).
 */
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { deliveryAPI } from "../api";
import { dispatchAppEvent } from "../utils/events";
import { useDeliveryStore } from "./store";
import { calculateHeading, getHaversineDistance } from "./orderUtils";

export const LOCATION_TASK = "jr-delivery-location";
const HTTP_SYNC_MS = 45000;

let lastHttpSyncAt = 0;
let lastFix = null;
let foregroundSub = null;

function handleFix(coords) {
  if (!coords) return;
  const { latitude: lat, longitude: lng, heading, speed, accuracy } = coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  let resolvedHeading = Number.isFinite(heading) && heading > 0 ? heading : 0;
  if (!resolvedHeading && lastFix) {
    const d = getHaversineDistance(lastFix.lat, lastFix.lng, lat, lng);
    resolvedHeading = d > 1.5 ? calculateHeading(lastFix.lat, lastFix.lng, lat, lng) : lastFix.heading || 0;
  }
  lastFix = { lat, lng, heading: resolvedHeading };
  useDeliveryStore.actions.setRiderLocation({ lat, lng, heading: resolvedHeading });
  dispatchAppEvent("riderLocationUpdate", { lat, lng, heading: resolvedHeading, speed: speed || 0, accuracy });
  const now = Date.now();
  if (now - lastHttpSyncAt >= HTTP_SYNC_MS && useDeliveryStore.getState().isOnline) {
    lastHttpSyncAt = now;
    deliveryAPI.updateLocation(lat, lng, true, { heading: resolvedHeading, speed: speed || 0, accuracy }).catch(() => {});
  }
}

// Must be defined at module scope (imported from the root layout) so Android can run it after a restart.
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  const locations = data?.locations || [];
  const latest = locations[locations.length - 1];
  if (latest?.coords) handleFix(latest.coords);
});

export async function ensureForegroundPermission({ ask = true } = {}) {
  let perm = await Location.getForegroundPermissionsAsync();
  if (!perm.granted && ask) perm = await Location.requestForegroundPermissionsAsync();
  return perm.granted;
}

export async function getCurrentFix() {
  const enabled = await Location.hasServicesEnabledAsync().catch(() => true);
  if (!enabled) {
    // Android shows the system "Turn on location" dialog; throws if the rider declines.
    await Location.enableNetworkProviderAsync().catch(() => {
      throw new Error("Location is off. Turn on GPS to go online.");
    });
  }
  let perm = await Location.getForegroundPermissionsAsync();
  if (!perm.granted && perm.canAskAgain !== false) perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) {
    const err = new Error("Location permission is required to go online.");
    err.code = "PERMISSION";
    err.blocked = perm.canAskAgain === false;
    throw err;
  }
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
  const pos = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }), 15000)
    .catch(() => withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), 10000))
    .catch(() => Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 }))
    .then((p) => {
      if (!p?.coords) throw new Error("Could not get your location. Move to an open area and try again.");
      return p;
    });
  handleFix(pos.coords);
  return { lat: pos.coords.latitude, lng: pos.coords.longitude, heading: pos.coords.heading || 0 };
}

export async function startTracking() {
  if (!(await ensureForegroundPermission({ ask: true }))) throw new Error("Location permission is required to go online.");
  let bg = await Location.getBackgroundPermissionsAsync().catch(() => ({ granted: false }));
  if (!bg.granted) bg = await Location.requestBackgroundPermissionsAsync().catch(() => ({ granted: false }));
  if (bg.granted) {
    const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
    if (!running) {
      await Location.startLocationUpdatesAsync(LOCATION_TASK, {
        accuracy: Location.Accuracy.High,
        timeInterval: 4000,
        distanceInterval: 10,
        pausesUpdatesAutomatically: false,
        foregroundService: {
          notificationTitle: "You're online",
          notificationBody: "Sharing your location for deliveries",
          notificationColor: "#FEC600",
          killServiceOnDestroy: false,
        },
      });
    }
    return "background";
  }
  // foreground-only fallback
  if (!foregroundSub) {
    foregroundSub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 4000, distanceInterval: 10 }, (pos) => handleFix(pos.coords));
  }
  return "foreground";
}

export async function stopTracking() {
  try {
    foregroundSub?.remove();
  } catch {}
  foregroundSub = null;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  } catch {}
}

export const getLastFix = () => lastFix;
