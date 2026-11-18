/**
 * Port of components/restaurant/RestaurantNavbar.jsx (mobile): crimson gradient header with restaurant name, address • company,
 * Online/Offline tag, search overlay (orders search via API → "restaurantSearchUpdated"; inventory → "restaurantInventorySearch"),
 * notifications bell with unread dot, and the real-time table-booking popup.
 */
import React, { useEffect, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, MapPin, Search, X, Utensils } from "lucide-react-native";
import Txt from "./ui/Txt";
import { LinearGradient } from "./ui/LinearGradient";
import { restaurantAPI } from "../api";
import { addAppListener, dispatchAppEvent } from "../utils/events";
import { localStore } from "../utils/storage";
import { getCachedSettings, loadBusinessSettings } from "../utils/businessSettings";
import useNotificationInbox from "../hooks/useNotificationInbox";
import { useRestaurantNotifications } from "../context/RestaurantNotificationContext";
import { fonts, palette, rt } from "../theme";

const isCoords = (s) => /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(String(s || "").trim());
export function formatRestaurantAddress(r) {
  const loc = r?.location;
  if (loc) {
    if (loc.formattedAddress && loc.formattedAddress.trim() && loc.formattedAddress !== "Select location" && !isCoords(loc.formattedAddress)) return loc.formattedAddress.trim();
    if (loc.address && loc.address.trim()) return loc.address.trim();
    const parts = [];
    if (loc.addressLine1) parts.push(loc.addressLine1.trim());
    else if (loc.street) parts.push(loc.street.trim());
    if (loc.addressLine2) parts.push(loc.addressLine2.trim());
    if (loc.area) parts.push(loc.area.trim());
    if (loc.landmark) parts.push(loc.landmark.trim());
    if (loc.city && !parts.some((p) => p.toLowerCase().includes(loc.city.trim().toLowerCase()))) parts.push(loc.city.trim());
    if (loc.state && !parts.some((p) => p.toLowerCase().includes(loc.state.trim().toLowerCase()))) parts.push(loc.state.trim());
    const zip = loc.zipCode || loc.pincode || loc.postalCode;
    if (zip) parts.push(String(zip).trim());
    if (parts.length) return parts.join(", ");
  }
  return typeof r?.address === "string" ? r.address.trim() : "";
}

export default function RestaurantHeader({ mode = "orders", showSearch = true, showNotifications = true, showOfflineOnlineTag = true }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { unreadCount } = useNotificationInbox("restaurant", { limit: 20, pollMs: 5 * 60 * 1000 });
  const { newReservation, clearNewReservation } = useRestaurantNotifications();
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Offline");
  const [companyName, setCompanyName] = useState("");
  const [logoUrl, setLogoUrl] = useState(null);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const timer = useRef(null);

  useEffect(() => {
    const apply = (s) => {
      if (!s) return;
      if (s.companyName) setCompanyName(s.companyName);
      const l = s.restaurantLogo?.url || s.logo?.url;
      if (l) setLogoUrl(l);
    };
    const cached = getCachedSettings?.();
    if (cached) apply(cached);
    else loadBusinessSettings().then(apply).catch(() => {});
    return addAppListener("businessSettingsUpdated", () => apply(getCachedSettings?.()));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      restaurantAPI
        .getCurrentRestaurant()
        .then((res) => {
          const r = res?.data?.data?.restaurant || res?.data?.restaurant || res?.data?.data;
          if (!cancelled && r) setRestaurant(r);
        })
        .catch(() => {})
        .finally(() => !cancelled && setLoading(false));
    load();
    const off = addAppListener("restaurantProfileRefresh", load);
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  useEffect(() => {
    const saved = localStore.getItem("restaurant_online_status");
    if (saved !== null && saved !== undefined) {
      try {
        setStatus(JSON.parse(saved) ? "Online" : "Offline");
      } catch {
        setStatus(restaurant?.isAcceptingOrders ? "Online" : "Offline");
      }
    } else setStatus(restaurant?.isAcceptingOrders ? "Online" : "Offline");
    return addAppListener("restaurantStatusChanged", (e) => setStatus(e?.detail?.isOnline ? "Online" : "Offline"));
  }, [restaurant]);

  // Search (debounced 500 ms like web)
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (mode === "inventory") {
      dispatchAppEvent("restaurantInventorySearch", { query: searchValue });
      return undefined;
    }
    if (!searchValue.trim()) {
      dispatchAppEvent("restaurantSearchUpdated", { query: "", results: [], isLoading: false });
      return undefined;
    }
    dispatchAppEvent("restaurantSearchUpdated", { query: searchValue, results: [], isLoading: true });
    timer.current = setTimeout(async () => {
      try {
        const res = await restaurantAPI.getOrders({ page: 1, limit: 100, search: searchValue });
        dispatchAppEvent("restaurantSearchUpdated", { query: searchValue, results: res?.data?.data?.orders || [], isLoading: false });
      } catch {
        dispatchAppEvent("restaurantSearchUpdated", { query: searchValue, results: [], isLoading: false });
      }
    }, 500);
    return () => timer.current && clearTimeout(timer.current);
  }, [searchValue, mode]);

  const closeSearch = () => {
    setIsSearchActive(false);
    setSearchValue("");
  };
  const address = formatRestaurantAddress(restaurant);
  const name = restaurant?.name || restaurant?.restaurantName || "Restaurant";

  return (
    <View>
      <LinearGradient colors={["#B80B3D", "#66001D"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.bar, { paddingTop: insets.top + 14 }]}>
        <View style={styles.left}>
          {logoUrl ? <Image source={{ uri: logoUrl }} style={styles.logo} resizeMode="contain" /> : null}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt weight={900} numberOfLines={1} style={styles.name}>{loading ? "Loading..." : name}</Txt>
            {!loading ? (
              <View style={styles.locRow}>
                {address ? <MapPin size={12} color="rgba(255,255,255,0.8)" /> : null}
                <Txt weight={500} numberOfLines={1} style={styles.loc}>
                  {address}
                  {address && companyName ? " • " : ""}
                  {companyName ? <Txt weight={700} style={[styles.loc, { letterSpacing: 1 }]}>{companyName.toUpperCase()}</Txt> : null}
                </Txt>
              </View>
            ) : null}
          </View>
        </View>
        <View style={styles.right}>
          {showOfflineOnlineTag ? (
            <View style={[styles.tag, status === "Online" ? styles.tagOn : styles.tagOff]}>
              <View style={[styles.tagDot, { backgroundColor: status === "Online" ? "#00e676" : palette.gray400 }]} />
              <Txt weight={700} style={styles.tagText}>{status}</Txt>
            </View>
          ) : null}
          {showSearch ? (
            <Pressable onPress={() => setIsSearchActive(true)} style={styles.iconBtn} hitSlop={6} accessibilityLabel="Search">
              <Search size={20} color={palette.white} />
            </Pressable>
          ) : null}
          {showNotifications ? (
            <Pressable onPress={() => router.push("/notifications")} style={styles.iconBtn} hitSlop={6} accessibilityLabel="Notifications">
              <Bell size={20} color={palette.white} />
              {unreadCount > 0 ? <View style={styles.bellDot} /> : null}
            </Pressable>
          ) : null}
        </View>

        {isSearchActive ? (
          <View style={[styles.searchOverlay, { paddingTop: insets.top + 8 }]}>
            <Search size={20} color={palette.gray400} />
            <TextInput
              value={searchValue}
              onChangeText={setSearchValue}
              autoFocus
              placeholder={mode === "inventory" ? "Search menu items or categories" : "Search by order ID, dish or customer"}
              placeholderTextColor={palette.gray400}
              style={styles.searchInput}
            />
            <Pressable onPress={closeSearch} style={styles.closeBtn} accessibilityLabel="Close search">
              <X size={20} color={palette.gray700} />
            </Pressable>
          </View>
        ) : null}
      </LinearGradient>

      {newReservation ? (
        <View style={styles.bookingPop}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16, padding: 16 }}>
            <View style={styles.bookingIcon}>
              <Utensils size={24} color={rt.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt weight={900} style={{ fontSize: 14, color: palette.gray900 }}>New Table Request!</Txt>
              <Txt weight={500} numberOfLines={1} style={{ fontSize: 12, color: palette.slate500, marginTop: 2 }}>
                {newReservation.user?.name || "A Guest"} has requested a table for {newReservation.guests} people.
              </Txt>
            </View>
            <Pressable onPress={clearNewReservation} style={styles.bookingClose}>
              <X size={16} color={palette.gray400} />
            </Pressable>
          </View>
          <View style={{ flexDirection: "row", gap: 8, padding: 12, backgroundColor: "#f8fafc" }}>
            <Pressable
              onPress={() => {
                clearNewReservation();
                router.push("/(tabs)/explore");
              }}
              style={[styles.bookingBtn, { flex: 1, backgroundColor: rt.primary }]}
            >
              <Txt weight={700} style={{ fontSize: 12, color: palette.white, letterSpacing: 1.5 }}>VIEW REQUEST</Txt>
            </Pressable>
            <Pressable onPress={clearNewReservation} style={[styles.bookingBtn, { paddingHorizontal: 16, backgroundColor: palette.white, borderWidth: 1, borderColor: palette.slate200 }]}>
              <Txt weight={700} style={{ fontSize: 12, color: palette.gray600, letterSpacing: 1.5 }}>LATER</Txt>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderBottomLeftRadius: 24, borderBottomRightRadius: 24, paddingHorizontal: 12, paddingBottom: 16, flexDirection: "row", alignItems: "center", gap: 8, elevation: 6 },
  left: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 },
  logo: { width: 36, height: 36, borderRadius: 8 },
  name: { fontSize: 16, color: palette.white },
  locRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2, opacity: 0.9 },
  loc: { flexShrink: 1, fontSize: 11, color: "rgba(255,255,255,0.8)" },
  right: { flexDirection: "row", alignItems: "center" },
  tag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  tagOn: { backgroundColor: "rgba(255,255,255,0.2)", borderColor: "rgba(255,255,255,0.2)" },
  tagOff: { backgroundColor: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.1)" },
  tagDot: { width: 8, height: 8, borderRadius: 4 },
  tagText: { fontSize: 11, color: palette.white, letterSpacing: 0.5 },
  iconBtn: { padding: 8, marginLeft: 4, borderRadius: 999 },
  bellDot: { position: "absolute", top: 8, right: 8, width: 10, height: 10, borderRadius: 5, backgroundColor: palette.red500, borderWidth: 1, borderColor: palette.white },
  searchOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: palette.white, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 12 },
  searchInput: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: palette.gray900, paddingVertical: 8 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: palette.gray100, alignItems: "center", justifyContent: "center" },
  bookingPop: { position: "absolute", top: "100%", left: 16, right: 16, marginTop: 8, zIndex: 100, backgroundColor: palette.white, borderRadius: 24, overflow: "hidden", borderWidth: 1, borderColor: rt.border, elevation: 12 },
  bookingIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: "#faf5ff", alignItems: "center", justifyContent: "center" },
  bookingClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#f8fafc", alignItems: "center", justifyContent: "center" },
  bookingBtn: { height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
