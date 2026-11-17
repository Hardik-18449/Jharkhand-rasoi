/** Select / add delivery location — port of pages/user/cart/AddressSelectorPage.jsx (Google map → react-native-maps). */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Easing, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import { ChevronLeft, ChevronRight, Plus, MapPin, Navigation, Home, Building2, Briefcase, Search, Trash2, Pencil } from "lucide-react-native";
import Txt from "../src/components/ui/Txt";
import Screen from "../src/components/ui/Screen";
import { useProfile } from "../src/context/ProfileContext";
import { useAppLocation } from "../src/context/LocationProvider";
import { clearStoredUserLocation, notifyLocationUpdated, persistDeliveryAddressMode, persistUserLocation, readStoredUserLocation } from "../src/utils/locationPersistence";
import { GOOGLE_MAPS_API_KEY } from "../src/config";
import { toast } from "../src/utils/toast";
import { palette, fonts } from "../src/theme";

const FALLBACK = [22.7196, 75.8577];
const NOMINATIM_HEADERS = { Accept: "application/json", "Accept-Language": "en", "User-Agent": "Jharkhand Rasoi-App" };

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const a1 = (lat1 * Math.PI) / 180;
  const a2 = (lat2 * Math.PI) / 180;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(a1) * Math.cos(a2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
const getAddressIcon = (address) => {
  const l = (address.label || address.additionalDetails || "").toLowerCase();
  if (l.includes("work") || l.includes("office")) return Briefcase;
  if (l.includes("building") || l.includes("apt")) return Building2;
  return Home;
};
const getAddressId = (a) => a?.id || a?._id || null;
const buildLocationDataFromAddress = (address) => {
  const c = address?.location?.coordinates || [];
  const longitude = Number(c[0] ?? address?.longitude);
  const latitude = Number(c[1] ?? address?.latitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const street = String(address?.street || "").trim();
  const city = String(address?.city || "").trim();
  const state = String(address?.state || "").trim();
  const area = String(address?.additionalDetails || "").trim();
  const zipCode = String(address?.zipCode || "").trim();
  const stateAndZip = [state, zipCode].filter(Boolean).join(" ");
  return {
    city, state, area, zipCode, latitude, longitude,
    address: [street, city].filter(Boolean).join(", "),
    formattedAddress: area ? [area, street, city, stateAndZip].filter(Boolean).join(", ") : [street, city, stateAndZip].filter(Boolean).join(", "),
    label: address?.label || "Home",
  };
};
const forwardGeocodeAddress = async (query) => {
  const q = String(query || "").trim();
  if (!q) return null;
  try {
    if (GOOGLE_MAPS_API_KEY) {
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${GOOGLE_MAPS_API_KEY}`);
      const data = await res.json();
      const loc = data?.results?.[0]?.geometry?.location;
      if (data.status === "OK" && loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) return { lat: loc.lat, lng: loc.lng, formattedAddress: data.results[0].formatted_address };
    }
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&q=${encodeURIComponent(q)}`, { headers: NOMINATIM_HEADERS });
    const json = await res.json();
    if (Array.isArray(json) && json.length > 0) {
      const lat = Number(json[0].lat);
      const lng = Number(json[0].lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng, formattedAddress: json[0].display_name };
    }
  } catch {}
  return null;
};

function BouncePin() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([Animated.timing(v, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }), Animated.timing(v, { toValue: 0, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true })]));
    a.start();
    return () => a.stop();
  }, [v]);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
      <View style={{ alignItems: "center", marginBottom: 32 }}>
        <Animated.View style={{ transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }], width: 40, height: 40, borderRadius: 20, backgroundColor: palette.green100, alignItems: "center", justifyContent: "center", marginBottom: -6 }}>
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: palette.green600, borderWidth: 2, borderColor: palette.white, alignItems: "center", justifyContent: "center" }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: palette.white }} />
          </View>
        </Animated.View>
        <View style={{ width: 6, height: 24, backgroundColor: palette.green600, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, borderLeftWidth: 1, borderRightWidth: 1, borderColor: palette.white }} />
      </View>
    </View>
  );
}

const EMPTY_FORM = { street: "", city: "", state: "", zipCode: "", additionalDetails: "", label: "Home", phone: "" };

export default function AddressSelectorScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addresses = [], addAddress, updateAddress, deleteAddress, setDefaultAddress, isAuthenticated } = useProfile();
  const { location, requestLocation, setSavedLocation, setDeliveryAddressMode } = useAppLocation();
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [mapPosition, setMapPosition] = useState(() => {
    const s = readStoredUserLocation();
    return s?.latitude && s?.longitude && Number.isFinite(Number(s.latitude)) && Number.isFinite(Number(s.longitude)) ? [Number(s.latitude), Number(s.longitude)] : FALLBACK;
  });
  const [addressFormData, setAddressFormData] = useState(EMPTY_FORM);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [currentAddress, setCurrentAddress] = useState("");
  const [addressAutocompleteValue, setAddressAutocompleteValue] = useState("");
  const [keywordAddressSuggestions, setKeywordAddressSuggestions] = useState([]);
  const [isKeywordSearching, setIsKeywordSearching] = useState(false);
  const mapRef = useRef(null);
  const skipNextIdle = useRef(false);

  const handleBack = () => (router.canGoBack() ? router.back() : router.replace("/"));
  const panTo = (lat, lng, zoomDelta = 0.005) => {
    skipNextIdle.current = true;
    mapRef.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: zoomDelta, longitudeDelta: zoomDelta }, 400);
  };

  // Nominatim keyword search (web parity)
  useEffect(() => {
    if (!showAddressForm) return undefined;
    const q = String(addressAutocompleteValue || "").trim();
    if (q.length < 3) {
      setKeywordAddressSuggestions([]);
      setIsKeywordSearching(false);
      return undefined;
    }
    const t = setTimeout(async () => {
      try {
        setIsKeywordSearching(true);
        const refLat = location?.latitude ?? FALLBACK[0];
        const refLng = location?.longitude ?? FALLBACK[1];
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=10&q=${encodeURIComponent(q)}`, { headers: NOMINATIM_HEADERS });
        const json = await res.json();
        const mapped = (Array.isArray(json) ? json : [])
          .map((r) => ({ id: r.place_id || r.osm_id, display: r.display_name || "", lat: Number(r.lat), lng: Number(r.lon), address: r.address || {} }))
          .filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lng))
          .map((x) => ({ ...x, distanceMeters: calculateDistance(refLat, refLng, x.lat, x.lng) }))
          .sort((a, b) => a.distanceMeters - b.distanceMeters)
          .slice(0, 4);
        setKeywordAddressSuggestions(mapped);
      } catch {
        setKeywordAddressSuggestions([]);
      } finally {
        setIsKeywordSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [addressAutocompleteValue, showAddressForm, location]);

  const handleMapMoveEnd = async (lat, lng) => {
    try {
      if (GOOGLE_MAPS_API_KEY) {
        const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`);
        const data = await res.json();
        if (data.status === "OK" && data.results?.length > 0) {
          const result = data.results[0];
          const comps = result.address_components || [];
          const find = (t) => comps.find((c) => c.types.includes(t))?.long_name;
          setCurrentAddress(result.formatted_address);
          setAddressFormData((p) => ({
            ...p,
            street: result.formatted_address.split(",")[0] || "",
            additionalDetails: find("sublocality_level_1") || find("sublocality") || find("neighborhood") || "",
            city: find("locality") || "",
            state: find("administrative_area_level_1") || "",
            zipCode: find("postal_code") || "",
          }));
          return;
        }
      }
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`, { headers: NOMINATIM_HEADERS });
      const json = await res.json();
      if (json?.address) {
        const a = json.address;
        const formatted = json.display_name;
        const street = [a.road, a.suburb, a.neighbourhood, a.house_number].filter(Boolean).slice(0, 2).join(", ") || a.amenity || a.industrial || "";
        setCurrentAddress(formatted);
        setAddressFormData((p) => ({
          ...p,
          street: street || formatted.split(",")[0] || p.street,
          city: a.city || a.town || a.village || a.municipality || a.county || p.city,
          state: a.state || p.state,
          zipCode: a.postcode || p.zipCode,
        }));
      }
    } catch {}
  };

  const getDevicePosition = async () => {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") throw new Error("Location permission denied");
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  };

  const handleUseCurrentLocation = async () => {
    try {
      toast.message("Getting location...");
      clearStoredUserLocation();
      const loc = await requestLocation(true, true);
      if (loc?.latitude) {
        setMapPosition([loc.latitude, loc.longitude]);
        setCurrentAddress(loc.formattedAddress || loc.address || "");
        persistDeliveryAddressMode("current");
        persistUserLocation(loc, { mode: "current" });
        toast.success("Location ready: " + (loc.area || loc.city || "Current Location"));
        setTimeout(handleBack, 200);
      }
    } catch (e) {
      toast.error(e?.message || "Failed to get location");
    }
  };

  const handleSelectSavedAddress = async (address) => {
    const id = getAddressId(address);
    if (!id) return;
    const locationData = buildLocationDataFromAddress(address);
    if (!locationData) {
      toast.error("Selected address does not have valid coordinates");
      return;
    }
    await setDefaultAddress(id);
    await setSavedLocation(locationData, { mode: "saved", persistDb: true });
    persistDeliveryAddressMode("saved");
    setDeliveryAddressMode("saved");
    toast.success("Address selected");
    handleBack();
  };

  const handleEditAddress = (addr) => {
    setAddressFormData({ id: getAddressId(addr), street: addr.street || "", city: addr.city || "", state: addr.state || "", zipCode: addr.zipCode || "", additionalDetails: addr.additionalDetails || "", label: addr.label || "Home", phone: addr.phone || "" });
    let lat = FALLBACK[0];
    let lng = FALLBACK[1];
    if (addr.location?.coordinates) {
      lng = addr.location.coordinates[0];
      lat = addr.location.coordinates[1];
    } else if (addr.latitude && addr.longitude) {
      lat = addr.latitude;
      lng = addr.longitude;
    }
    skipNextIdle.current = true;
    setMapPosition([lat, lng]);
    setCurrentAddress([addr.additionalDetails, addr.street, addr.city].filter(Boolean).join(", "));
    setShowAddressForm(true);
  };

  const handleDeleteAddress = (addr) => {
    Alert.alert("Delete address", "Are you sure you want to delete this address?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "OK",
        onPress: async () => {
          const id = getAddressId(addr);
          if (!id) return;
          try {
            await deleteAddress(id);
            toast.success("Address deleted successfully");
          } catch {
            toast.error("Failed to delete address");
          }
        },
      },
    ]);
  };

  const handleLocateCurrentPositionInForm = async () => {
    try {
      toast.message("Getting current location...");
      const loc = await getDevicePosition();
      setMapPosition([loc.latitude, loc.longitude]);
      panTo(loc.latitude, loc.longitude, 0.004);
      await handleMapMoveEnd(loc.latitude, loc.longitude);
      toast.success("Location updated");
    } catch (e) {
      toast.error(e?.message || "Failed to get location");
    }
  };

  const handleAddAddressClick = () => {
    if (!isAuthenticated) {
      toast.info("Please login to add an address");
      router.push("/login");
      return;
    }
    setAddressFormData(EMPTY_FORM);
    setShowAddressForm(true);
    const stored = readStoredUserLocation();
    const target = location?.latitude && location?.longitude ? location : stored;
    if (target?.latitude && target?.longitude) {
      const pos = [Number(target.latitude), Number(target.longitude)];
      skipNextIdle.current = true;
      setMapPosition(pos);
      handleMapMoveEnd(pos[0], pos[1]);
    }
    getDevicePosition()
      .then((fresh) => {
        setMapPosition([fresh.latitude, fresh.longitude]);
        panTo(fresh.latitude, fresh.longitude, 0.004);
        handleMapMoveEnd(fresh.latitude, fresh.longitude);
      })
      .catch(() => {});
  };

  const syncMapWithTypedAddress = async () => {
    const query = [addressFormData.street, addressFormData.additionalDetails, addressFormData.city, addressFormData.state, addressFormData.zipCode].filter(Boolean).join(", ");
    if (!query || (!addressFormData.city && !addressFormData.street)) return;
    const g = await forwardGeocodeAddress(query);
    if (g && calculateDistance(mapPosition[0], mapPosition[1], g.lat, g.lng) > 15000) {
      setMapPosition([g.lat, g.lng]);
      panTo(g.lat, g.lng);
      setCurrentAddress(g.formattedAddress || query);
    }
  };

  const handleAddressFormSubmit = async () => {
    if (!addressFormData.street || !addressFormData.city) {
      toast.error("Please fill required fields");
      return;
    }
    setLoadingAddress(true);
    try {
      let [finalLat, finalLng] = mapPosition;
      const typedQuery = [addressFormData.street, addressFormData.additionalDetails, addressFormData.city, addressFormData.state, addressFormData.zipCode].filter(Boolean).join(", ");
      const isDefaultIndore = calculateDistance(finalLat, finalLng, FALLBACK[0], FALLBACK[1]) < 2000;
      if (typedQuery) {
        const g = await forwardGeocodeAddress(typedQuery);
        if (g && (isDefaultIndore || calculateDistance(finalLat, finalLng, g.lat, g.lng) > 15000)) {
          finalLat = g.lat;
          finalLng = g.lng;
          setMapPosition([finalLat, finalLng]);
        }
      }
      if (!isAuthenticated) {
        const locData = {
          latitude: finalLat,
          longitude: finalLng,
          address: [addressFormData.additionalDetails, addressFormData.street, addressFormData.city].filter(Boolean).join(", "),
          formattedAddress: currentAddress || typedQuery,
          city: addressFormData.city,
          state: addressFormData.state,
          area: addressFormData.additionalDetails || "",
          label: addressFormData.label,
        };
        persistUserLocation(locData, { mode: "saved" });
        persistDeliveryAddressMode("saved");
        notifyLocationUpdated(locData);
        toast.success("Location set successfully");
        handleBack();
        return;
      }
      const payload = { ...addressFormData, label: addressFormData.label === "Work" ? "Office" : addressFormData.label, location: { type: "Point", coordinates: [finalLng, finalLat] }, latitude: finalLat, longitude: finalLng };
      const saved = addressFormData.id ? await updateAddress(addressFormData.id, payload) : await addAddress(payload);
      if (saved) {
        const id = getAddressId(saved);
        if (id) await setDefaultAddress(id);
        const locationData = buildLocationDataFromAddress({ ...saved, ...payload, id, _id: saved?._id || id });
        if (locationData) {
          await setSavedLocation(locationData, { mode: "saved", persistDb: true });
          persistDeliveryAddressMode("saved");
          setDeliveryAddressMode("saved");
        }
        toast.success(addressFormData.id ? "Address updated" : "Address saved");
        handleBack();
      }
    } catch {
      toast.error("Failed to save address");
    } finally {
      setLoadingAddress(false);
    }
  };

  const initialRegion = useMemo(() => ({ latitude: mapPosition[0], longitude: mapPosition[1], latitudeDelta: 0.006, longitudeDelta: 0.006 }), [showAddressForm]); // eslint-disable-line react-hooks/exhaustive-deps

  if (showAddressForm) {
    const field = (key, props = {}) => (
      <TextInput
        value={addressFormData[key] || ""}
        onChangeText={(t) => setAddressFormData((p) => ({ ...p, [key]: t }))}
        placeholderTextColor={palette.gray400}
        style={styles.input}
        {...props}
      />
    );
    return (
      <Screen bg={palette.white}>
        <View style={styles.formHeader}>
          <Pressable onPress={() => setShowAddressForm(false)} style={{ padding: 6 }}><ChevronLeft size={24} color={palette.gray900} /></Pressable>
          <Txt weight={700} style={{ fontSize: 18, color: palette.gray900 }}>Add delivery location</Txt>
        </View>
        <KeyboardAvoidingView behavior="height" style={{ flex: 1 }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 }}>
            <View style={{ height: 320 }}>
              <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                style={StyleSheet.absoluteFill}
                initialRegion={initialRegion}
                showsPointsOfInterest={false}
                toolbarEnabled={false}
                onRegionChangeComplete={(r) => {
                  setMapPosition([r.latitude, r.longitude]);
                  if (skipNextIdle.current) {
                    skipNextIdle.current = false;
                    return;
                  }
                  handleMapMoveEnd(r.latitude, r.longitude);
                }}
              />
              <BouncePin />
              <View style={styles.searchWrap}>
                <View style={styles.searchBox}>
                  <Search size={20} color={palette.gray400} />
                  <TextInput value={addressAutocompleteValue} onChangeText={setAddressAutocompleteValue} placeholder="Search area, street, landmark..." placeholderTextColor={palette.gray400} style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, color: palette.gray900 }} />
                  {isKeywordSearching ? <ActivityIndicator size="small" color={palette.yellow} /> : null}
                </View>
                {keywordAddressSuggestions.length > 0 ? (
                  <View style={styles.suggestions}>
                    <Txt weight={700} style={{ paddingHorizontal: 16, paddingVertical: 8, fontSize: 10, letterSpacing: 1, color: palette.gray400, backgroundColor: palette.gray50 }}>SUGGESTIONS</Txt>
                    {keywordAddressSuggestions.map((s) => (
                      <Pressable
                        key={s.id}
                        onPress={() => {
                          setMapPosition([s.lat, s.lng]);
                          panTo(s.lat, s.lng, 0.004);
                          setAddressAutocompleteValue(s.display);
                          setAddressFormData((p) => ({ ...p, street: s.display || p.street, city: s.address.city || s.address.town || s.address.village || s.address.county || p.city, state: s.address.state || p.state, zipCode: s.address.postcode || p.zipCode }));
                          setKeywordAddressSuggestions([]);
                        }}
                        style={styles.suggestionRow}
                      >
                        <MapPin size={16} color={palette.gray400} style={{ marginTop: 2 }} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Txt weight={600} numberOfLines={1} style={{ fontSize: 14, color: palette.gray900 }}>{s.display}</Txt>
                          <Txt weight={400} numberOfLines={1} style={{ fontSize: 12, color: palette.gray500 }}>{s.address?.city || s.address?.state}</Txt>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
              <Pressable onPress={handleLocateCurrentPositionInForm} style={styles.myLocBtn}>
                <Navigation size={16} color={palette.black} />
                <Txt weight={600} style={{ fontSize: 14, color: palette.black }}>Use My Location</Txt>
              </Pressable>
            </View>

            <View style={styles.formBody}>
              <View style={styles.pinned}>
                <MapPin size={20} color={palette.black} />
                <View style={{ flex: 1 }}>
                  <Txt weight={700} style={{ fontSize: 12, color: palette.black, marginBottom: 4 }}>PINNED LOCATION</Txt>
                  <Txt weight={400} numberOfLines={2} style={{ fontSize: 14, color: palette.gray700 }}>{currentAddress || "Select a location on map"}</Txt>
                </View>
              </View>
              <View>
                <Txt weight={700} style={styles.label}>Primary Address (Street / Area / Landmark)</Txt>
                {field("street", { placeholder: "Search or drag to update street/area", onBlur: syncMapWithTypedAddress, style: [styles.input, { backgroundColor: palette.gray50, marginBottom: 16 }] })}
                <Txt weight={700} style={[styles.label, { color: palette.gray700 }]}>Secondary Address (House No. / Flat / Floor)</Txt>
                {field("additionalDetails", { placeholder: "E.g. Flat 402, 4th Floor, Jharkhand Rasoi Building" })}
              </View>
              <View style={{ flexDirection: "row", gap: 16 }}>
                <View style={{ flex: 1 }}>
                  <Txt weight={500} style={styles.smallLabel}>City</Txt>
                  {field("city", { onBlur: syncMapWithTypedAddress })}
                </View>
                <View style={{ flex: 1 }}>
                  <Txt weight={500} style={styles.smallLabel}>State</Txt>
                  {field("state", { onBlur: syncMapWithTypedAddress })}
                </View>
              </View>
              <View>
                <Txt weight={500} style={styles.smallLabel}>Pincode / ZIP</Txt>
                {field("zipCode", { placeholder: "Pincode", keyboardType: "number-pad" })}
              </View>
              <View>
                <Txt weight={700} style={styles.label}>Save address as</Txt>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {["Home", "Work", "Other"].map((l) => {
                    const active = addressFormData.label === l;
                    return (
                      <Pressable key={l} onPress={() => setAddressFormData((p) => ({ ...p, label: l }))} style={[styles.labelBtn, active && { backgroundColor: palette.yellow, borderColor: palette.yellow }]}>
                        <Txt weight={active ? 700 : 500} style={{ fontSize: 14, color: palette.black }}>{l}</Txt>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          </ScrollView>
          <View style={[styles.saveBar, { paddingBottom: 16 + insets.bottom }]}>
            <Pressable onPress={handleAddressFormSubmit} disabled={loadingAddress} style={[styles.saveBtn, loadingAddress && { opacity: 0.6 }]}>
              <Txt weight={900} style={{ fontSize: 18, color: palette.black }}>{loadingAddress ? "Saving..." : "Save Address & Proceed"}</Txt>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Screen>
    );
  }

  return (
    <Screen bg={palette.white}>
      <View style={[styles.formHeader, { paddingVertical: 14 }]}>
        <Pressable onPress={handleBack} style={{ padding: 6 }}><ChevronLeft size={24} color={palette.gray900} /></Pressable>
        <Txt weight={700} style={{ fontSize: 20, color: palette.gray900 }}>Select Location</Txt>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 64 + insets.bottom }}>
        <View style={{ padding: 16, backgroundColor: palette.gray50, borderBottomWidth: 1, borderColor: palette.gray100 }}>
          <Pressable onPress={handleUseCurrentLocation} style={styles.currentBtn}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(254,198,0,0.12)", alignItems: "center", justifyContent: "center" }}><Navigation size={20} color={palette.black} /></View>
            <View style={{ flex: 1 }}>
              <Txt weight={700} style={{ fontSize: 16, color: palette.black }}>Use Current Location</Txt>
              <Txt weight={400} numberOfLines={1} style={{ fontSize: 12, color: palette.gray500 }}>{currentAddress || "Enable GPS for accuracy"}</Txt>
            </View>
            <ChevronRight size={20} color={palette.gray400} />
          </Pressable>
        </View>
        <View style={{ padding: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <Txt weight={700} style={{ fontSize: 14, letterSpacing: 1, color: palette.gray500 }}>SAVED ADDRESSES</Txt>
            <Pressable onPress={handleAddAddressClick} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Plus size={16} color={palette.black} />
              <Txt weight={700} style={{ fontSize: 14, color: palette.black }}>Add New</Txt>
            </Pressable>
          </View>
          <View style={{ gap: 16 }}>
            {addresses.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 40, opacity: 0.5 }}>
                <MapPin size={48} color={palette.gray400} />
                <Txt weight={400} style={{ marginTop: 8, fontSize: 16, color: palette.gray900 }}>No addresses saved yet</Txt>
              </View>
            ) : (
              addresses.map((addr, idx) => {
                const Icon = getAddressIcon(addr);
                return (
                  <Pressable key={getAddressId(addr) || idx} onPress={() => handleSelectSavedAddress(addr)} style={styles.addrRow}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: palette.white, alignItems: "center", justifyContent: "center", elevation: 1 }}><Icon size={20} color={palette.gray600} /></View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Txt weight={700} style={{ fontSize: 16, color: palette.gray900, textTransform: "capitalize" }}>{addr.label || "Address"}</Txt>
                      <Txt weight={400} numberOfLines={2} style={{ fontSize: 12, color: palette.gray500, marginTop: 2 }}>{[addr.additionalDetails, addr.street, addr.city, addr.state].filter(Boolean).join(", ")}</Txt>
                    </View>
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                      <Pressable onPress={() => handleEditAddress(addr)} style={styles.rowIcon}><Pencil size={16} color={palette.gray500} /></Pressable>
                      <Pressable onPress={() => handleDeleteAddress(addr)} style={styles.rowIcon}><Trash2 size={16} color={palette.red500} /></Pressable>
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  formHeader: { flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderColor: palette.gray100, backgroundColor: palette.white },
  searchWrap: { position: "absolute", top: 16, left: 16, right: 16, zIndex: 20 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, height: 48, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.95)", elevation: 8 },
  suggestions: { marginTop: 8, backgroundColor: palette.white, borderRadius: 12, borderWidth: 1, borderColor: palette.gray100, overflow: "hidden", elevation: 10 },
  suggestionRow: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: palette.gray50 },
  myLocBtn: { position: "absolute", bottom: 40, right: 16, flexDirection: "row", alignItems: "center", gap: 8, height: 48, paddingHorizontal: 24, borderRadius: 24, backgroundColor: palette.white, borderWidth: 1, borderColor: palette.gray200, elevation: 8 },
  formBody: { backgroundColor: palette.white, borderTopLeftRadius: 32, borderTopRightRadius: 32, marginTop: -32, padding: 16, gap: 24, elevation: 6 },
  pinned: { flexDirection: "row", gap: 12, padding: 16, borderRadius: 12, backgroundColor: "rgba(254,198,0,0.05)", borderWidth: 1, borderColor: "rgba(254,198,0,0.1)" },
  label: { fontSize: 14, color: palette.gray900, marginBottom: 8 },
  smallLabel: { fontSize: 12, color: palette.gray900, marginBottom: 4 },
  input: { height: 48, borderRadius: 12, borderWidth: 1, borderColor: palette.gray200, paddingHorizontal: 12, fontFamily: fonts.regular, fontSize: 14, color: palette.gray900, backgroundColor: palette.white },
  labelBtn: { flex: 1, height: 40, borderRadius: 8, borderWidth: 1, borderColor: palette.gray200, alignItems: "center", justifyContent: "center" },
  saveBar: { padding: 16, backgroundColor: palette.white, borderTopWidth: 1, borderColor: palette.gray200, elevation: 10 },
  saveBtn: { height: 48, borderRadius: 8, backgroundColor: palette.yellow, alignItems: "center", justifyContent: "center", elevation: 3 },
  currentBtn: { flexDirection: "row", alignItems: "center", gap: 16, padding: 16, backgroundColor: palette.white, borderRadius: 12, elevation: 1 },
  addrRow: { flexDirection: "row", alignItems: "flex-start", gap: 16, padding: 16, backgroundColor: "#f8fafc", borderRadius: 12 },
  rowIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
});
