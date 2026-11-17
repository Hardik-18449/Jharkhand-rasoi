/** Port of web context/ProfileContext.jsx */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authAPI, userAPI } from "../api";
import { getJSON, localStore } from "../utils/storage";
import { hasUserSession, setStoredUser } from "../auth/session";
import { addAppListener } from "../utils/events";
import { persistUserLocation, notifyLocationUpdated, notifyDeliveryModeUpdated, clearLocationMatchingAddress } from "../utils/locationPersistence";

const ProfileContext = createContext(null);
const USER_SESSION_PREFERENCE_KEYS = ["userVegMode", "userVegModeOption", "food-under-250-filters"];

const getAddressId = (address) => address?.id || address?._id || null;
const normalizeAddressLabel = (label) => {
  const normalized = String(label || "").trim().toLowerCase();
  if (normalized === "home") return "Home";
  if (normalized === "office" || normalized === "work") return "Office";
  return "Other";
};
const normalizeAddress = (address) => {
  if (!address || typeof address !== "object") return null;
  const id = getAddressId(address);
  return { ...address, label: normalizeAddressLabel(address.label), ...(id ? { id: String(id) } : {}) };
};
const dedupeAddressesByLabel = (addressList = []) => {
  const addressMap = new Map();
  addressList.forEach((addr, index) => {
    const normalizedAddress = normalizeAddress(addr);
    if (!normalizedAddress) return;
    addressMap.set(normalizedAddress.label || getAddressId(normalizedAddress) || index, normalizedAddress);
  });
  return Array.from(addressMap.values());
};

export function ProfileProvider({ children }) {
  const [userProfile, setUserProfile] = useState(() => getJSON("user_user") || getJSON("userProfile") || null);
  const [loading, setLoading] = useState(true);
  const [addresses, setAddresses] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState(() => getJSON("userPaymentMethods", []) || []);
  const [favorites, setFavorites] = useState(() => getJSON("userFavorites", []) || []);
  const [dishFavorites, setDishFavorites] = useState(() => getJSON("userDishFavorites", []) || []);
  const [vegMode, setVegMode] = useState(() => {
    const saved = localStore.getItem("userVegMode");
    return saved !== null ? saved === "true" : false;
  });
  const [vegModeOption, setVegModeOption] = useState(() => localStore.getItem("userVegModeOption") ?? "all");
  const [authTick, setAuthTick] = useState(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const isAuthenticated = useMemo(() => hasUserSession(), [userProfile, authTick]);

  useEffect(() => {
    if (userProfile || isAuthenticated) localStore.setItem("userProfile", JSON.stringify(userProfile));
  }, [userProfile, isAuthenticated]);
  useEffect(() => {
    if (addresses.length > 0 || isAuthenticated) localStore.setItem("userAddresses", JSON.stringify(addresses));
  }, [addresses, isAuthenticated]);
  useEffect(() => {
    if (paymentMethods.length > 0 || isAuthenticated) localStore.setItem("userPaymentMethods", JSON.stringify(paymentMethods));
  }, [paymentMethods, isAuthenticated]);
  useEffect(() => {
    if (favorites.length > 0 || isAuthenticated) localStore.setItem("userFavorites", JSON.stringify(favorites));
  }, [favorites, isAuthenticated]);
  useEffect(() => {
    if (dishFavorites.length > 0 || isAuthenticated) localStore.setItem("userDishFavorites", JSON.stringify(dishFavorites));
  }, [dishFavorites, isAuthenticated]);
  useEffect(() => {
    if (isAuthenticated) {
      localStore.setItem("userVegMode", vegMode.toString());
      localStore.setItem("userVegModeOption", vegModeOption);
    }
  }, [vegMode, vegModeOption, isAuthenticated]);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!hasUserSession()) {
        setUserProfile(null);
        setAddresses([]);
        setPaymentMethods([]);
        setFavorites([]);
        setDishFavorites([]);
        setVegMode(false);
        setVegModeOption("all");
        USER_SESSION_PREFERENCE_KEYS.forEach((key) => localStore.removeItem(key));
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const response = await authAPI.getCurrentUser();
        const userData = response?.data?.data?.user || response?.data?.user || response?.data;
        if (userData) {
          setUserProfile(userData);
          setStoredUser(userData);
          localStore.setItem("userProfile", JSON.stringify(userData));
        }
        try {
          const addressesResponse = await userAPI.getAddresses();
          const addressesData = addressesResponse?.data?.data?.addresses || addressesResponse?.data?.addresses || [];
          const normalizedAddresses = dedupeAddressesByLabel(addressesData);
          setAddresses(normalizedAddresses);
          localStore.setItem("userAddresses", JSON.stringify(normalizedAddresses));
        } catch {
          const saved = getJSON("userAddresses");
          if (Array.isArray(saved)) setAddresses(dedupeAddressesByLabel(saved));
        }
      } catch {
        const saved = getJSON("userAddresses");
        if (Array.isArray(saved)) setAddresses(dedupeAddressesByLabel(saved));
      } finally {
        setLoading(false);
      }
    };
    fetchUserProfile();
    return addAppListener("userAuthChanged", () => {
      setAuthTick((t) => t + 1);
      fetchUserProfile();
    });
  }, []);

  const addAddress = useCallback(async (address) => {
    const response = await userAPI.addAddress(address);
    const newAddress = response?.data?.data?.address || response?.data?.address;
    if (newAddress) {
      const normalizedNewAddress = normalizeAddress(newAddress);
      setAddresses((prev) => {
        const filtered = prev.filter((addr) => normalizeAddressLabel(addr?.label) !== normalizeAddressLabel(normalizedNewAddress?.label));
        const updated = dedupeAddressesByLabel([...filtered, normalizedNewAddress]);
        localStore.setItem("userAddresses", JSON.stringify(updated));
        return updated;
      });
      return normalizedNewAddress;
    }
    return undefined;
  }, []);

  const updateAddress = useCallback(async (id, updatedAddress) => {
    const response = await userAPI.updateAddress(id, updatedAddress);
    const updatedAddr = response?.data?.data?.address || response?.data?.address;
    if (updatedAddr) {
      const normalizedUpdatedAddress = normalizeAddress(updatedAddr);
      setAddresses((prev) => {
        const updated = dedupeAddressesByLabel(prev.map((addr) => (String(getAddressId(addr)) === String(id) ? normalizedUpdatedAddress : normalizeAddress(addr))));
        localStore.setItem("userAddresses", JSON.stringify(updated));
        return updated;
      });
      return normalizedUpdatedAddress;
    }
    return undefined;
  }, []);

  const deleteAddress = useCallback(
    async (id) => {
      const deletedAddress = addresses.find((addr) => String(getAddressId(addr)) === String(id));
      await userAPI.deleteAddress(id);
      try {
        clearLocationMatchingAddress(deletedAddress);
      } catch {}
      setAddresses((prev) => {
        const newAddresses = prev.filter((addr) => String(getAddressId(addr)) !== String(id));
        localStore.setItem("userAddresses", JSON.stringify(newAddresses));
        return newAddresses;
      });
    },
    [addresses],
  );

  const setDefaultAddress = useCallback(async (id) => {
    setAddresses((prev) => {
      const updatedAddresses = prev.map((addr) => ({ ...addr, isDefault: String(getAddressId(addr)) === String(id) }));
      localStore.setItem("userAddresses", JSON.stringify(updatedAddresses));
      setTimeout(() => {
        notifyDeliveryModeUpdated("saved");
        const selectedAddress = updatedAddresses.find((addr) => addr.isDefault) || updatedAddresses[0];
        if (selectedAddress) {
          const coordinates = selectedAddress?.location?.coordinates;
          const lngFromCoords = Array.isArray(coordinates) && coordinates.length >= 2 ? Number(coordinates[0]) : null;
          const latFromCoords = Array.isArray(coordinates) && coordinates.length >= 2 ? Number(coordinates[1]) : null;
          const lat = Number(Number.isFinite(latFromCoords) ? latFromCoords : (selectedAddress?.latitude ?? selectedAddress?.lat));
          const lng = Number(Number.isFinite(lngFromCoords) ? lngFromCoords : (selectedAddress?.longitude ?? selectedAddress?.lng));
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            const existingLocation = getJSON("userLocation") || {};
            const parts = [selectedAddress?.additionalDetails, selectedAddress?.street, selectedAddress?.city, selectedAddress?.state, selectedAddress?.zipCode].filter(Boolean);
            const resolvedAddress = parts.length > 0 ? parts.join(", ") : selectedAddress?.formattedAddress || selectedAddress?.address || "";
            const syncedLocation = {
              ...existingLocation,
              latitude: lat,
              longitude: lng,
              area: selectedAddress?.additionalDetails || selectedAddress?.street || selectedAddress?.area || existingLocation?.area || "",
              city: selectedAddress?.city || existingLocation?.city || "",
              state: selectedAddress?.state || existingLocation?.state || "",
              address: resolvedAddress || existingLocation?.address || "",
              formattedAddress: resolvedAddress || existingLocation?.formattedAddress || "",
            };
            persistUserLocation(syncedLocation, { mode: "saved" });
            notifyLocationUpdated(syncedLocation);
          }
        }
      }, 0);
      return updatedAddresses;
    });
    try {
      await userAPI.setDefaultAddress(id);
    } catch {}
  }, []);

  const getDefaultAddress = useCallback(() => addresses.find((addr) => addr.isDefault) || addresses[0] || null, [addresses]);
  const getAddressById = useCallback((id) => addresses.find((addr) => String(getAddressId(addr)) === String(id)), [addresses]);

  const addPaymentMethod = useCallback((payment) => {
    setPaymentMethods((prev) => [...prev, { ...payment, id: Date.now().toString(), isDefault: prev.length === 0 }]);
  }, []);
  const updatePaymentMethod = useCallback((id, updatedPayment) => {
    setPaymentMethods((prev) => prev.map((pm) => (pm.id === id ? { ...pm, ...updatedPayment } : pm)));
  }, []);
  const deletePaymentMethod = useCallback((id) => {
    setPaymentMethods((prev) => {
      const paymentToDelete = prev.find((pm) => pm.id === id);
      const newPayments = prev.filter((pm) => pm.id !== id);
      if (paymentToDelete?.isDefault && newPayments.length > 0) newPayments[0].isDefault = true;
      return newPayments;
    });
  }, []);
  const setDefaultPaymentMethod = useCallback((id) => {
    setPaymentMethods((prev) => prev.map((pm) => ({ ...pm, isDefault: pm.id === id })));
  }, []);
  const getDefaultPaymentMethod = useCallback(() => paymentMethods.find((pm) => pm.isDefault) || paymentMethods[0] || null, [paymentMethods]);
  const getPaymentMethodById = useCallback((id) => paymentMethods.find((pm) => pm.id === id), [paymentMethods]);

  const addFavorite = useCallback((restaurant) => {
    setFavorites((prev) => (prev.find((fav) => fav.slug === restaurant.slug) ? prev : [...prev, restaurant]));
  }, []);
  const removeFavorite = useCallback((slug) => setFavorites((prev) => prev.filter((fav) => fav.slug !== slug)), []);
  const isFavorite = useCallback((slug) => favorites.some((fav) => fav.slug === slug), [favorites]);
  const getFavorites = useCallback(() => favorites, [favorites]);

  const addDishFavorite = useCallback((dish) => {
    setDishFavorites((prev) => (prev.find((fav) => fav.id === dish.id && fav.restaurantId === dish.restaurantId) ? prev : [...prev, dish]));
  }, []);
  const removeDishFavorite = useCallback((dishId, restaurantId) => {
    setDishFavorites((prev) => prev.filter((fav) => !(fav.id === dishId && fav.restaurantId === restaurantId)));
  }, []);
  const isDishFavorite = useCallback((dishId, restaurantId) => dishFavorites.some((fav) => fav.id === dishId && fav.restaurantId === restaurantId), [dishFavorites]);
  const getDishFavorites = useCallback(() => dishFavorites, [dishFavorites]);

  const updateUserProfile = useCallback((updatedProfile) => setUserProfile((prev) => ({ ...prev, ...updatedProfile })), []);

  const value = useMemo(
    () => ({
      userProfile,
      loading,
      updateUserProfile,
      addresses,
      paymentMethods,
      favorites,
      vegMode,
      setVegMode,
      vegModeOption,
      setVegModeOption,
      addAddress,
      updateAddress,
      deleteAddress,
      setDefaultAddress,
      getDefaultAddress,
      getAddressById,
      addPaymentMethod,
      updatePaymentMethod,
      deletePaymentMethod,
      setDefaultPaymentMethod,
      getDefaultPaymentMethod,
      getPaymentMethodById,
      addFavorite,
      removeFavorite,
      isFavorite,
      getFavorites,
      dishFavorites,
      addDishFavorite,
      removeDishFavorite,
      isDishFavorite,
      getDishFavorites,
      isAuthenticated,
    }),
    [
      userProfile, loading, updateUserProfile, addresses, paymentMethods, favorites, dishFavorites, vegMode, vegModeOption,
      addAddress, updateAddress, deleteAddress, setDefaultAddress, getDefaultAddress, getAddressById, addPaymentMethod,
      updatePaymentMethod, deletePaymentMethod, setDefaultPaymentMethod, getDefaultPaymentMethod, getPaymentMethodById,
      addFavorite, removeFavorite, isFavorite, getFavorites, addDishFavorite, removeDishFavorite, isDishFavorite, getDishFavorites, isAuthenticated,
    ],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

const noop = () => {};
export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    return {
      userProfile: null, loading: false, updateUserProfile: noop, addresses: [], paymentMethods: [], favorites: [],
      addAddress: noop, updateAddress: noop, deleteAddress: noop, setDefaultAddress: noop, getDefaultAddress: () => null,
      getAddressById: () => null, addPaymentMethod: noop, updatePaymentMethod: noop, deletePaymentMethod: noop,
      setDefaultPaymentMethod: noop, getDefaultPaymentMethod: () => null, getPaymentMethodById: () => null,
      addFavorite: noop, removeFavorite: noop, isFavorite: () => false, getFavorites: () => [], dishFavorites: [],
      addDishFavorite: noop, removeDishFavorite: noop, isDishFavorite: () => false, getDishFavorites: () => [],
      vegMode: false, setVegMode: noop, vegModeOption: "all", setVegModeOption: noop, isAuthenticated: false,
    };
  }
  return context;
}
