/** Port of web context/LocationProvider.jsx + locationContext.js + hooks/useAppLocation.jsx */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocationEngine } from "../hooks/useLocationEngine";
import { useZone } from "../hooks/useZone";
import { userAPI } from "../api";
import { addAppListener } from "../utils/events";
import { localStore } from "../utils/storage";
import {
  persistUserLocation,
  readDeliveryAddressMode,
  readStoredUserLocation,
  notifyLocationUpdated,
  notifyDeliveryModeUpdated,
} from "../utils/locationPersistence";

export const LocationContext = createContext(null);
export const useLocationContext = () => useContext(LocationContext);
export function useLocationFromContext() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocation must be used within LocationProvider");
  return ctx;
}
export const useLocation = useLocationFromContext;

export function LocationProvider({ children }) {
  const engine = useLocationEngine();
  const { location: engineLocation, loading, error, permissionGranted, requestLocation: engineRequestLocation, startWatchingLocation, stopWatchingLocation } = engine;

  const [deliveryAddressMode, setDeliveryAddressModeState] = useState(readDeliveryAddressMode);
  const [savedLocationOverride, setSavedLocationOverride] = useState(null);

  const location = useMemo(() => {
    if (deliveryAddressMode === "saved" && savedLocationOverride) return savedLocationOverride;
    if (deliveryAddressMode === "saved") {
      const stored = readStoredUserLocation();
      if (stored) return stored;
    }
    return engineLocation;
  }, [deliveryAddressMode, savedLocationOverride, engineLocation]);

  const { zoneId, zone, zoneStatus, loading: zoneLoading, error: zoneError, isInService, isOutOfService, isOutOfRadius, isOutOfZone, serviceUnavailableMessage, refreshZone } =
    useZone(location);

  useEffect(() => {
    const offMode = addAppListener("deliveryAddressModeUpdated", (e) => e?.detail?.mode && setDeliveryAddressModeState(e.detail.mode));
    const offLoc = addAppListener("userLocationUpdated", (e) => e?.detail?.location && setSavedLocationOverride(e.detail.location));
    const offCleared = addAppListener("userLocationCleared", () => {
      setSavedLocationOverride(null);
      setDeliveryAddressModeState("current");
    });
    return () => {
      offMode();
      offLoc();
      offCleared();
    };
  }, []);

  const effectiveLocation = useMemo(() => (deliveryAddressMode === "current" ? engineLocation || location : location), [deliveryAddressMode, engineLocation, location]);

  const setDeliveryAddressMode = useCallback((mode) => {
    localStore.setItem("deliveryAddressMode", mode);
    setDeliveryAddressModeState(mode);
    notifyDeliveryModeUpdated(mode);
    if (mode === "current") setSavedLocationOverride(null);
  }, []);

  const setSavedLocation = useCallback(
    async (payload, options = {}) => {
      if (!payload?.latitude || !payload?.longitude) return;
      const mode = options.mode || "saved";
      setSavedLocationOverride(payload);
      persistUserLocation(payload, { mode });
      notifyLocationUpdated(payload);
      setDeliveryAddressMode(mode);
      if (options.persistDb !== false) {
        try {
          await userAPI.updateLocation(payload);
        } catch {}
      }
    },
    [setDeliveryAddressMode],
  );

  const requestLocation = useCallback(
    async (...args) => {
      setSavedLocationOverride(null);
      const result = await engineRequestLocation(...args);
      if (result?.latitude) {
        persistUserLocation(result, { mode: "current" });
        setDeliveryAddressMode("current");
        notifyLocationUpdated(result);
      }
      return result;
    },
    [engineRequestLocation, setDeliveryAddressMode],
  );

  useEffect(() => {
    if (engineLocation?.latitude && engineLocation?.longitude && deliveryAddressMode === "current") persistUserLocation(engineLocation, { mode: "current" });
  }, [engineLocation?.latitude, engineLocation?.longitude, engineLocation?.formattedAddress, deliveryAddressMode, engineLocation]);

  const value = useMemo(
    () => ({
      location,
      effectiveLocation,
      deliveryAddressMode,
      loading: loading || zoneLoading,
      error: error || zoneError,
      permissionGranted,
      zoneId,
      zone,
      zoneStatus,
      isInService,
      isOutOfService,
      isOutOfRadius,
      isOutOfZone,
      serviceUnavailableMessage,
      isLocationResolved: Boolean(location?.latitude && !loading),
      address: location?.address || location?.formattedAddress || "",
      requestLocation,
      setSavedLocation,
      setDeliveryAddressMode,
      refreshZone,
      startWatchingLocation,
      stopWatchingLocation,
    }),
    [location, effectiveLocation, deliveryAddressMode, loading, zoneLoading, error, zoneError, permissionGranted, zoneId, zone, zoneStatus, isInService, isOutOfService, isOutOfRadius, isOutOfZone, serviceUnavailableMessage, requestLocation, setSavedLocation, setDeliveryAddressMode, refreshZone, startWatchingLocation, stopWatchingLocation],
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useAppLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) {
    return {
      isLocationResolved: false, location: null, effectiveLocation: null, zoneId: null, address: null, zoneStatus: "loading",
      loading: true, isOutOfService: false, isOutOfRadius: false, isOutOfZone: false, serviceUnavailableMessage: "", deliveryAddressMode: "saved",
    };
  }
  return {
    isLocationResolved: ctx.isLocationResolved,
    location: ctx.location,
    effectiveLocation: ctx.effectiveLocation,
    zoneId: ctx.zoneId,
    address: ctx.address,
    zoneStatus: ctx.zoneStatus,
    loading: ctx.loading,
    isOutOfService: ctx.isOutOfService,
    isOutOfRadius: ctx.isOutOfRadius,
    isOutOfZone: ctx.isOutOfZone,
    serviceUnavailableMessage: ctx.serviceUnavailableMessage,
    deliveryAddressMode: ctx.deliveryAddressMode,
    requestLocation: ctx.requestLocation,
    setSavedLocation: ctx.setSavedLocation,
    setDeliveryAddressMode: ctx.setDeliveryAddressMode,
    refreshZone: ctx.refreshZone,
  };
}
