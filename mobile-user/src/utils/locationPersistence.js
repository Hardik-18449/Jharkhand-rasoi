/** Port of web utils/locationPersistence.js (single writer for location storage). */
import {
  localStore,
  readScopedCachedValue,
  readScopedValue,
  removeScopedValue,
  writeScopedCachedValue,
  writeScopedValue,
} from "./storage";
import { dispatchAppEvent } from "./events";

const LOCATION_SCOPE = "location";
const ZONE_SCOPE = "zone";
const LOCATION_TTL_MS = 24 * 60 * 60 * 1000;

export function readStoredUserLocation() {
  const loc = readScopedCachedValue(LOCATION_SCOPE, "current", { fallback: null });
  if (loc) {
    const isBarlong =
      (loc.city && /barlong|ramgarh|chitarpur/i.test(loc.city)) ||
      (loc.area && /barlong|ramgarh|chitarpur|hmf3/i.test(loc.area)) ||
      (loc.address && /barlong|ramgarh|chitarpur|hmf3/i.test(loc.address)) ||
      (loc.formattedAddress && /barlong|ramgarh|chitarpur|hmf3/i.test(loc.formattedAddress));
    if (isBarlong) {
      clearStoredUserLocation();
      clearStoredZoneContext();
      return null;
    }
  }
  return loc;
}

export function persistUserLocation(location, { mode } = {}) {
  if (!location?.latitude || !location?.longitude) return;
  writeScopedCachedValue(LOCATION_SCOPE, "current", location, { ttlMs: LOCATION_TTL_MS });
  if (mode === "saved" || mode === "current") writeScopedValue(LOCATION_SCOPE, "mode", mode);
  localStore.setItem("userLocation", JSON.stringify(location));
  localStore.setItem("userLat", String(location.latitude));
  localStore.setItem("userLng", String(location.longitude));
  if (mode === "saved" || mode === "current") localStore.setItem("deliveryAddressMode", mode);
}

export function clearStoredUserLocation() {
  removeScopedValue(LOCATION_SCOPE, "current");
  ["userLocation", "userLat", "userLng", "deliveryAddressMode"].forEach((k) => localStore.removeItem(k));
}

const getAddressLatLng = (address) => {
  if (!address) return null;
  const coords = address.location?.coordinates;
  const lat = Number(Array.isArray(coords) ? coords[1] : (address.latitude ?? address.lat));
  const lng = Number(Array.isArray(coords) ? coords[0] : (address.longitude ?? address.lng));
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
};

export function clearLocationMatchingAddress(address) {
  const target = getAddressLatLng(address);
  const stored = readScopedCachedValue(LOCATION_SCOPE, "current", { fallback: null });
  if (!target || !stored) return false;
  const matches =
    Math.abs(Number(stored.latitude) - target.lat) < 0.001 && Math.abs(Number(stored.longitude) - target.lng) < 0.001;
  if (!matches) return false;
  clearStoredUserLocation();
  clearStoredZoneContext();
  persistDeliveryAddressMode("current");
  notifyDeliveryModeUpdated("current");
  dispatchAppEvent("userLocationCleared");
  return true;
}

export function persistDeliveryAddressMode(mode) {
  if (mode === "saved" || mode === "current") {
    writeScopedValue(LOCATION_SCOPE, "mode", mode);
    localStore.setItem("deliveryAddressMode", mode);
    return;
  }
  removeScopedValue(LOCATION_SCOPE, "mode");
  localStore.removeItem("deliveryAddressMode");
}

export function readDeliveryAddressMode() {
  return readScopedValue(LOCATION_SCOPE, "mode", { fallback: "saved" }) || "saved";
}

export function notifyLocationUpdated(location) {
  if (!location) return;
  dispatchAppEvent("userLocationUpdated", { location });
}

export function notifyDeliveryModeUpdated(mode) {
  dispatchAppEvent("deliveryAddressModeUpdated", { mode });
}

export function readStoredZoneContext() {
  const zoneId = readScopedValue(ZONE_SCOPE, "id", { fallback: null });
  const zoneStatus = readScopedValue(ZONE_SCOPE, "status", { fallback: null });
  const zone = readScopedCachedValue(ZONE_SCOPE, "data", { fallback: null });
  const location = readStoredUserLocation();
  const latitude = location?.latitude ?? null;
  const longitude = location?.longitude ?? null;

  const isJharkhandZone = zoneId === "6ae4b7c55a61b5a44a0e0cb0" || zoneId === "6ae5906eb29ee7eff14b807c";
  const isIndoreLocation = latitude && longitude && Math.abs(latitude - 22.7) < 1 && Math.abs(longitude - 75.8) < 1;
  if (isJharkhandZone && isIndoreLocation) {
    clearStoredZoneContext();
    return { zoneId: null, zoneStatus: null, zone: null, latitude, longitude };
  }
  return { zoneId, zoneStatus, zone, latitude, longitude };
}

export function persistZoneContext({ zoneId = null, zone = null, status = null } = {}) {
  if (zoneId) {
    writeScopedValue(ZONE_SCOPE, "id", zoneId);
    localStore.setItem("userZoneId", zoneId);
  } else {
    removeScopedValue(ZONE_SCOPE, "id");
    localStore.removeItem("userZoneId");
  }
  if (status) {
    writeScopedValue(ZONE_SCOPE, "status", status);
    localStore.setItem("outOfService", status);
  } else {
    removeScopedValue(ZONE_SCOPE, "status");
    localStore.removeItem("outOfService");
  }
  if (zone) {
    writeScopedCachedValue(ZONE_SCOPE, "data", zone, { ttlMs: LOCATION_TTL_MS });
    localStore.setItem("userZone", JSON.stringify(zone));
  } else {
    removeScopedValue(ZONE_SCOPE, "data");
    localStore.removeItem("userZone");
  }
}

export function clearStoredZoneContext() {
  removeScopedValue(ZONE_SCOPE, "id");
  removeScopedValue(ZONE_SCOPE, "status");
  removeScopedValue(ZONE_SCOPE, "data");
  ["userZoneId", "userZone", "outOfService"].forEach((k) => localStore.removeItem(k));
}
