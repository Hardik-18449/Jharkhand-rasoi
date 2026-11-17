/**
 * Port of web hooks/useLocation.jsx `useLocationEngine` on expo-location (foreground only).
 * Flow kept from web: stored location → DB (`/food/user/location`) → GPS + backend reverse-geocode,
 * fallbacks (cached → DB → default Indore) and "Select location" placeholders, DB sync throttling.
 */
import { useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import { locationAPI, userAPI } from "../api";
import { getModuleToken } from "../auth/session";
import {
  clearStoredUserLocation,
  notifyDeliveryModeUpdated,
  persistDeliveryAddressMode,
  persistUserLocation,
  readDeliveryAddressMode,
  readStoredUserLocation,
} from "../utils/locationPersistence";
import { readScopedValue, writeScopedValue } from "../utils/storage";
import { addAppListener } from "../utils/events";

const DB_LOCATION_FETCH_TTL_MS = 30_000;
const DB_UPDATE_MIN_DISTANCE_M = 50;
const DB_UPDATE_MIN_INTERVAL_MS = 60_000;

const geoDistanceMeters = (lat1, lng1, lat2, lng2) => {
  if ([lat1, lng1, lat2, lng2].some((v) => typeof v !== "number")) return Number.POSITIVE_INFINITY;
  const latDiff = lat2 - lat1;
  const lngDiff = lng2 - lng1;
  return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111320;
};

const PLACEHOLDER = { city: "Current Location", state: "", country: "", area: "", address: "Select location", formattedAddress: "Select location" };
const DEFAULT_INDORE = {
  city: "Indore",
  area: "South Tukoganj",
  state: "Madhya Pradesh",
  address: "South Tukoganj, Indore",
  formattedAddress: "South Tukoganj, Indore, Madhya Pradesh 452001, India",
  latitude: 22.7196,
  longitude: 75.8577,
};
const isInIndiaRange = (lat, lng) => lat >= 6.5 && lat <= 37.1 && lng >= 68.7 && lng <= 97.4 && lng > 0;
const isPlaceholderLoc = (loc) =>
  !loc ||
  loc.city === "Current Location" ||
  loc.address === "Select location" ||
  loc.formattedAddress === "Select location" ||
  (!loc.city && !loc.address && !loc.formattedAddress && !loc.area);

let lastGeocode = { lat: null, lng: null, at: 0, value: null };

/** Backend reverse geocode (web: reverseGeocodeWithGoogleMaps → locationAPI.reverseGeocode), with expo fallback. */
async function reverseGeocode(latitude, longitude) {
  const moved = geoDistanceMeters(lastGeocode.lat, lastGeocode.lng, latitude, longitude);
  if (lastGeocode.value && moved < 75 && Date.now() - lastGeocode.at < 60_000) return lastGeocode.value;
  try {
    const res = await locationAPI.reverseGeocode(latitude, longitude);
    const loc = res?.data?.data?.location;
    if (loc?.formattedAddress && loc?.source !== "coords_only") {
      const value = {
        city: loc.city || "",
        state: loc.state || "",
        country: loc.country || "India",
        area: loc.area || "",
        mainTitle: loc.area || loc.city,
        address: loc.address || loc.formattedAddress,
        formattedAddress: loc.formattedAddress,
        postalCode: loc.postalCode || loc.pincode || "",
        pincode: loc.postalCode || loc.pincode || "",
      };
      lastGeocode = { lat: latitude, lng: longitude, at: Date.now(), value };
      return value;
    }
  } catch {}
  // Native fallback (web used BigDataCloud/Nominatim directly)
  try {
    const [g] = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (g) {
      const area = g.district || g.subregion || g.name || "";
      const city = g.city || g.subregion || "";
      const state = g.region || "";
      const parts = [g.name, g.street, area, city, state, g.postalCode].filter((p, i, a) => p && a.indexOf(p) === i);
      const value = {
        city,
        state,
        country: g.country || "India",
        area,
        mainTitle: area || city,
        address: [area, city].filter(Boolean).join(", "),
        formattedAddress: parts.join(", "),
        postalCode: g.postalCode || "",
        pincode: g.postalCode || "",
        street: g.street || "",
      };
      if (value.formattedAddress) {
        lastGeocode = { lat: latitude, lng: longitude, at: Date.now(), value };
        return value;
      }
    }
  } catch {}
  return { ...PLACEHOLDER };
}

export function useLocationEngine() {
  const [location, setLocation] = useState(() => {
    const stored = readStoredUserLocation();
    return stored && Number.isFinite(Number(stored.latitude)) ? stored : null;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const lastDbLocationRef = useRef(null);
  const lastDbLocationFetchAtRef = useRef(0);
  const lastDbUpdatedCoordsRef = useRef({ latitude: null, longitude: null });
  const lastDbUpdateAtRef = useRef(0);
  const watchRef = useRef(null);

  const isLoggedIn = () => Boolean(getModuleToken());

  const updateLocationInDB = async (locationData) => {
    if (!isLoggedIn() || !locationData?.latitude) return;
    const dist = geoDistanceMeters(lastDbUpdatedCoordsRef.current.latitude, lastDbUpdatedCoordsRef.current.longitude, locationData.latitude, locationData.longitude);
    const age = Date.now() - lastDbUpdateAtRef.current;
    if (dist < DB_UPDATE_MIN_DISTANCE_M && age < DB_UPDATE_MIN_INTERVAL_MS) return;
    const payload = {
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      address: locationData.address || "",
      city: locationData.city || "",
      state: locationData.state || "",
      area: locationData.area || "",
      formattedAddress: locationData.formattedAddress || locationData.address || "",
    };
    if (locationData.accuracy != null) payload.accuracy = locationData.accuracy;
    if (locationData.postalCode) payload.postalCode = locationData.postalCode;
    if (locationData.street) payload.street = locationData.street;
    try {
      await userAPI.updateLocation(payload);
      lastDbUpdatedCoordsRef.current = { latitude: payload.latitude, longitude: payload.longitude };
      lastDbUpdateAtRef.current = Date.now();
      lastDbLocationRef.current = null;
    } catch {}
  };

  const fetchLocationFromDB = async () => {
    try {
      if (!isLoggedIn()) return null;
      if (lastDbLocationRef.current && Date.now() - lastDbLocationFetchAtRef.current < DB_LOCATION_FETCH_TTL_MS) return lastDbLocationRef.current;
      const res = await userAPI.getLocation();
      const loc = res?.data?.data?.location;
      if (loc?.latitude && loc?.longitude) {
        let result;
        if (!isInIndiaRange(loc.latitude, loc.longitude)) {
          result = { latitude: loc.latitude, longitude: loc.longitude, ...PLACEHOLDER };
        } else if (
          (loc.formattedAddress && loc.formattedAddress !== "Select location") ||
          (loc.address && loc.address !== "Select location") ||
          (loc.city && loc.city !== "Current Location")
        ) {
          result = {
            latitude: loc.latitude,
            longitude: loc.longitude,
            city: loc.city || "Current Location",
            area: loc.area || "",
            state: loc.state || "",
            country: loc.country || "",
            address: loc.address || loc.formattedAddress || "Select location",
            formattedAddress: loc.formattedAddress || loc.address || "Select location",
          };
        } else {
          const addr = await reverseGeocode(loc.latitude, loc.longitude);
          result = { ...addr, latitude: loc.latitude, longitude: loc.longitude };
        }
        lastDbLocationRef.current = result;
        lastDbLocationFetchAtRef.current = Date.now();
        return result;
      }
    } catch {}
    return null;
  };

  const saveRawCoordsToDB = async (latitude, longitude, accuracy) => {
    if (!isLoggedIn()) return null;
    try {
      const res = await userAPI.updateLocation({ latitude, longitude, ...(Number.isFinite(accuracy) ? { accuracy } : {}) });
      lastDbLocationRef.current = null;
      lastDbUpdatedCoordsRef.current = { latitude, longitude };
      lastDbUpdateAtRef.current = Date.now();
      const loc = res?.data?.data?.location;
      if (loc?.latitude && loc?.longitude && loc.formattedAddress && loc.city) return { ...loc, accuracy: accuracy || null };
    } catch {}
    return null;
  };

  const getPosition = async (forceFresh) => {
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        maximumAge: forceFresh ? 0 : 300000,
        timeout: 15000,
      });
      return pos;
    } catch {
      // retry with lower accuracy (web did the same on timeout)
      return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, maximumAge: forceFresh ? 0 : 300000, timeout: 5000 });
    }
  };

  const getLocation = async (updateDB = true, forceFresh = false, showLoading = false) => {
    const preferLiveGps = forceFresh || readDeliveryAddressMode() === "current";
    const dbLocation = !preferLiveGps ? await fetchLocationFromDB() : null;
    if (dbLocation && !forceFresh) {
      setLocation(dbLocation);
      if (showLoading) setLoading(false);
      return dbLocation;
    }

    const perm = await Location.getForegroundPermissionsAsync();
    let granted = perm.granted;
    if (!granted && forceFresh && showLoading) {
      const req = await Location.requestForegroundPermissionsAsync();
      granted = req.granted;
    }
    if (!granted) {
      const err = { code: 1, message: "Location permission is blocked. Please allow location access for this app in Settings." };
      return handlePositionError(err, { forceFresh, showLoading, dbLocation });
    }

    try {
      const pos = await getPosition(forceFresh);
      const { latitude, longitude, accuracy } = pos.coords;
      let addr;
      if (!isInIndiaRange(latitude, longitude)) addr = { ...PLACEHOLDER };
      else addr = await reverseGeocode(latitude, longitude);

      let displayAddress = addr.address || "";
      if (/^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(displayAddress.trim())) {
        if (addr.area?.trim()) displayAddress = addr.area;
        else if (addr.city?.trim() && addr.city !== "Unknown City") displayAddress = addr.city;
      }
      const finalLoc = {
        ...addr,
        latitude,
        longitude,
        accuracy: accuracy || null,
        address: displayAddress,
        formattedAddress: addr.formattedAddress || displayAddress,
      };

      if (isPlaceholderLoc(finalLoc)) {
        if (updateDB) {
          const serverLoc = await saveRawCoordsToDB(latitude, longitude, accuracy);
          if (serverLoc) {
            persistUserLocation(serverLoc);
            setLocation(serverLoc);
            setPermissionGranted(true);
            if (showLoading) setLoading(false);
            setError(null);
            return serverLoc;
          }
        }
        const coordOnlyLoc = { latitude, longitude, accuracy: accuracy || null, city: finalLoc.city, address: finalLoc.address, formattedAddress: finalLoc.formattedAddress };
        setLocation(coordOnlyLoc);
        setPermissionGranted(true);
        if (showLoading) setLoading(false);
        setError(null);
        return coordOnlyLoc;
      }

      persistUserLocation(finalLoc);
      setLocation(finalLoc);
      setPermissionGranted(true);
      if (showLoading) setLoading(false);
      setError(null);
      if (updateDB) await updateLocationInDB(finalLoc).catch(() => {});
      return finalLoc;
    } catch (e) {
      const code = /timeout|timed out/i.test(String(e?.message)) ? 3 : /denied|permission/i.test(String(e?.message)) ? 1 : 2;
      return handlePositionError({ code, message: e?.message || "Location error" }, { forceFresh, showLoading, dbLocation });
    }
  };

  const handlePositionError = async (err, { forceFresh, showLoading, dbLocation }) => {
    if (forceFresh && showLoading) {
      const message =
        err.code === 1
          ? "Location permission is blocked. Please allow location access for this app in Settings."
          : err.code === 3
            ? "Location request timed out. Please check that location services are on and try again."
            : "Unable to detect your current location. Please turn on location services and try again.";
      setError(message);
      setLoading(false);
      throw new Error(message);
    }
    try {
      let fallback = null;
      const storedFirst = readStoredUserLocation();
      if (storedFirst && typeof storedFirst.latitude === "number") fallback = storedFirst;
      if (!fallback && readDeliveryAddressMode() !== "current") fallback = dbLocation || (await fetchLocationFromDB());
      if (!fallback) {
        fallback = {
          latitude: 22.7196,
          longitude: 75.8577,
          city: "Indore",
          state: "Madhya Pradesh",
          country: "India",
          area: "Vijay Nagar",
          address: "Vijay Nagar, Indore",
          formattedAddress: "Vijay Nagar, Indore, Madhya Pradesh 452010",
        };
      }
      setLocation(fallback);
      if (err.code !== 3) setError(err.message);
      setPermissionGranted(true);
      if (showLoading) setLoading(false);
      return fallback;
    } catch {
      setLocation(null);
      setError(err.code === 3 ? "Location request timed out. Please try again." : err.message);
      setPermissionGranted(false);
      if (showLoading) setLoading(false);
      return null;
    }
  };

  const startWatchingLocation = async () => {
    stopWatchingLocation();
    const perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted) return;
    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 10000, distanceInterval: 25 },
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        if (!isInIndiaRange(latitude, longitude)) return;
        const addr = await reverseGeocode(latitude, longitude);
        if (isPlaceholderLoc(addr)) return;
        const next = { ...addr, latitude, longitude, accuracy: accuracy || null };
        persistUserLocation(next);
        setLocation(next);
        updateLocationInDB(next).catch(() => {});
      },
    );
  };

  const stopWatchingLocation = () => {
    try {
      watchRef.current?.remove?.();
    } catch {}
    watchRef.current = null;
  };

  /* ===================== INIT ===================== */
  useEffect(() => {
    let cancelled = false;
    const storedLocation = readStoredUserLocation();
    let shouldForceRefresh = false;
    let hasInitialLocation = false;
    if (storedLocation) {
      const lat = Number(storedLocation?.latitude);
      const lng = Number(storedLocation?.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        setLocation(storedLocation);
        setPermissionGranted(true);
        setLoading(false);
        hasInitialLocation = true;
      } else shouldForceRefresh = true;
    }

    if (!hasInitialLocation && readDeliveryAddressMode() !== "current") {
      fetchLocationFromDB()
        .then((dbLoc) => {
          if (cancelled) return;
          if (dbLoc && Number.isFinite(Number(dbLoc.latitude)) && Number.isFinite(Number(dbLoc.longitude))) {
            setLocation(dbLoc);
            setPermissionGranted(true);
            setLoading(false);
            hasInitialLocation = true;
          } else {
            setLoading(false);
            shouldForceRefresh = true;
          }
        })
        .catch(() => {
          if (!cancelled) {
            setLoading(false);
            shouldForceRefresh = true;
          }
        });
    }

    const loadingTimeout = setTimeout(() => {
      setLoading((currentLoading) => {
        if (currentLoading) {
          setLocation((cur) => (!cur || (cur.formattedAddress === "Select location" && !cur.latitude && !cur.city) ? DEFAULT_INDORE : cur));
        }
        return false;
      });
    }, 5000);

    const checkPermissionAndStart = async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        const granted = perm.granted;
        let intentionallySaved = false;
        const mode = readDeliveryAddressMode();
        if (mode === "saved") intentionallySaved = true;
        else if (mode === null) {
          const loc = readStoredUserLocation();
          if (loc && loc.formattedAddress && loc.formattedAddress !== "Select location" && loc.city !== "Current Location") intentionallySaved = true;
        }
        const hasFetchedThisSession = readScopedValue("session", "locationFetched", { storage: "session", fallback: null });
        const shouldAutoFetch = !intentionallySaved && !hasFetchedThisSession;

        if (!granted && !shouldAutoFetch && hasInitialLocation) {
          setLoading(false);
          return;
        }
        // web never prompts on load; native: only auto-fetch when permission already granted
        if (!granted) {
          setLoading(false);
          return;
        }
        const shouldFetch = shouldForceRefresh || !hasInitialLocation || shouldAutoFetch;
        if (shouldFetch) {
          writeScopedValue("session", "locationFetched", true, { storage: "session" });
          getLocation(true, shouldForceRefresh || shouldAutoFetch)
            .then((loc) => {
              if (cancelled || !loc) return;
              if (loc.formattedAddress !== "Select location" && loc.city !== "Current Location") {
                setLocation(loc);
                setPermissionGranted(true);
                persistDeliveryAddressMode("current");
                notifyDeliveryModeUpdated("current");
              }
            })
            .catch(() => {});
        }
      } catch {
        setLoading(false);
      }
    };
    checkPermissionAndStart();

    const offUpdated = addAppListener("userLocationUpdated", (e) => {
      if (e.detail?.location) {
        setLocation(e.detail.location);
        setPermissionGranted(true);
        setLoading(false);
      }
    });
    const offCleared = addAppListener("userLocationCleared", async () => {
      lastDbLocationRef.current = null;
      lastDbLocationFetchAtRef.current = 0;
      setLocation(null);
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.granted) await getLocation(true, true, false);
      } catch {}
    });

    return () => {
      cancelled = true;
      clearTimeout(loadingTimeout);
      stopWatchingLocation();
      offUpdated();
      offCleared();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestLocation = async (updateDB = true, forceFresh = true) => {
    setLoading(true);
    setError(null);
    try {
      persistDeliveryAddressMode("current");
      notifyDeliveryModeUpdated("current");
      if (forceFresh) {
        clearStoredUserLocation();
        lastDbLocationRef.current = null;
        lastDbLocationFetchAtRef.current = 0;
      }
      return await getLocation(updateDB, forceFresh, true);
    } catch (err) {
      setError(err.message || "Failed to get location");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { location, loading, error, permissionGranted, requestLocation, startWatchingLocation, stopWatchingLocation };
}
