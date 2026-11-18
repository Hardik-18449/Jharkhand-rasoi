/**
 * Explore tab — port of pages/restaurant/ExploreMore.jsx: restaurant card, delivery ON/OFF quick card, sections
 * (Manage outlet / Settings / Orders / Help / Finance), profile, logout, delete account.
 * Pages not yet native open the same page of the web dashboard in the browser (deviation D3, marked "Web").
 */
import React, { useCallback, useEffect, useState } from "react";
import { Image, Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Info, Clock, Settings, Ticket, Truck, MapPin, FileText, Star, MessageSquare, LifeBuoy, Edit, IndianRupee, Receipt, Building2, ChevronRight, LogOut, Trash2, ExternalLink, Bell, Shield, User } from "lucide-react-native";
import Txt from "../../src/components/ui/Txt";
import { restaurantAPI } from "../../src/api";
import { clearModuleAuth, getCurrentUser, getModuleFcmToken } from "../../src/auth/session";
import { addAppListener } from "../../src/utils/events";
import { syncOnlineStatus } from "../../src/utils/onlineStatus";
import { formatRestaurantAddress } from "../../src/components/RestaurantHeader";
import { BACKEND_ORIGIN } from "../../src/config";
import { toast } from "../../src/utils/toast";
import { palette, rt, BOTTOM_NAV_HEIGHT } from "../../src/theme";

const WEB = `${BACKEND_ORIGIN}/food/restaurant`;
const SECTIONS = [
  {
    title: "Manage outlet",
    items: [
      { label: "Outlet info", Icon: Info, web: "/outlet-info" },
      { label: "Outlet timings", Icon: Clock, web: "/outlet-timings" },
      { label: "Menu categories", Icon: Settings, web: "/menu-categories" },
      { label: "Promo Codes", Icon: Ticket, web: "/promocodes" },
    ],
  },
  {
    title: "Settings",
    items: [
      { label: "Delivery settings", Icon: Truck, route: "/delivery-settings" },
      { label: "Zone Setup", Icon: MapPin, web: "/zone-setup" },
      { label: "Notifications", Icon: Bell, route: "/notifications" },
    ],
  },
  {
    title: "Orders",
    items: [
      { label: "Order history", Icon: FileText, route: "/orders-history" },
      { label: "Complaints", Icon: Star, route: "/(tabs)/feedback" },
      { label: "Reviews", Icon: MessageSquare, route: "/(tabs)/feedback" },
    ],
  },
  {
    title: "Help",
    items: [
      { label: "Support", Icon: LifeBuoy, web: "/help-centre/support" },
      { label: "Share your feedback", Icon: Edit, web: "/share-feedback" },
      { label: "Terms & Conditions", Icon: FileText, route: "/terms" },
      { label: "Privacy Policy", Icon: Shield, route: "/privacy" },
    ],
  },
  {
    title: "Finance",
    items: [
      { label: "Payout", Icon: IndianRupee, web: "/hub-finance" },
      { label: "Invoices", Icon: Receipt, web: "/hub-finance?tab=invoices" },
      { label: "Bank details", Icon: Building2, web: "/update-bank-details" },
    ],
  },
];

export default function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [restaurant, setRestaurant] = useState(null);
  const [online, setOnline] = useState(false);
  const [savingOnline, setSavingOnline] = useState(false);
  const [confirm, setConfirm] = useState(null); // "logout" | "delete" | "offline"
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await restaurantAPI.getCurrentRestaurant({ noCache: true });
      const r = res?.data?.data?.restaurant || res?.data?.restaurant;
      if (r) {
        setRestaurant(r);
        setOnline(r.isAcceptingOrders === true);
      }
    } catch {}
  }, []);
  useEffect(() => {
    load();
    const a = addAppListener("restaurantStatusChanged", (e) => setOnline(Boolean(e?.detail?.isOnline)));
    const b = addAppListener("restaurantProfileRefresh", load);
    return () => {
      a();
      b();
    };
  }, [load]);

  const setAccepting = async (next) => {
    const prev = online;
    try {
      setSavingOnline(true);
      setOnline(next);
      syncOnlineStatus(next);
      await restaurantAPI.updateAcceptingOrders(next);
      toast.success(next ? "Delivery is ON - You're receiving orders" : "Delivery is OFF - Not receiving orders");
    } catch (e) {
      setOnline(prev);
      syncOnlineStatus(prev);
      toast.error(e?.response?.data?.message || "Error updating delivery status");
    } finally {
      setSavingOnline(false);
    }
  };

  const open = (item) => {
    if (item.route) router.push(item.route);
    else if (item.web) Linking.openURL(`${WEB}${item.web}`);
  };

  const signOut = async () => {
    setBusy(true);
    try {
      const fcmToken = getModuleFcmToken();
      if (fcmToken) await restaurantAPI.removePushDevice({ fcmToken, pushPlatform: "mobile" }).catch(() => {});
      await restaurantAPI.logout(null, fcmToken, "mobile").catch(() => {});
    } finally {
      clearModuleAuth();
      setBusy(false);
      setConfirm(null);
      router.replace("/login");
    }
  };
  const deleteAccount = async () => {
    setBusy(true);
    try {
      await restaurantAPI.deleteAccount();
      toast.success("Restaurant account deleted");
      clearModuleAuth();
      setConfirm(null);
      router.replace("/login");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to delete account");
    } finally {
      setBusy(false);
    }
  };

  const session = getCurrentUser();
  const owner = {
    name: session?.name || restaurant?.ownerName || restaurant?.name || "Restaurant Owner",
    phone: session?.phone || restaurant?.ownerPhone || restaurant?.phone || "",
    email: session?.email || restaurant?.ownerEmail || restaurant?.email || "",
  };
  const cover = restaurant?.profileImage?.url || (typeof restaurant?.profileImage === "string" ? restaurant.profileImage : null) || restaurant?.coverImages?.[0]?.url || restaurant?.coverImages?.[0];

  return (
    <View style={{ flex: 1, backgroundColor: rt.pageBg }}>
      <View style={[styles.top, { paddingTop: insets.top + 12 }]}>
        <Txt weight={800} style={{ fontSize: 20, color: palette.gray900 }}>Explore more</Txt>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: BOTTOM_NAV_HEIGHT + 48, gap: 14 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} colors={[rt.primary]} />}>
        <Pressable onPress={() => Linking.openURL(`${WEB}/outlet-info`)} style={styles.restCard}>
          {cover ? <Image source={{ uri: cover }} style={styles.restImg} /> : <View style={[styles.restImg, { backgroundColor: rt.primarySoft, alignItems: "center", justifyContent: "center" }]}><Txt weight={800} style={{ fontSize: 22, color: rt.primary }}>{String(restaurant?.name || "R").charAt(0)}</Txt></View>}
          <View style={{ flex: 1 }}>
            <Txt weight={800} numberOfLines={1} style={{ fontSize: 16, color: palette.gray900 }}>{restaurant?.name || "Loading..."}</Txt>
            <Txt numberOfLines={2} style={{ fontSize: 12, color: palette.gray500, marginTop: 2 }}>{formatRestaurantAddress(restaurant)}</Txt>
            {restaurant?.restaurantId ? <Txt weight={600} style={{ fontSize: 11, color: palette.gray400, marginTop: 2 }}>ID: {restaurant.restaurantId}</Txt> : null}
          </View>
          <ChevronRight size={18} color={palette.gray400} />
        </Pressable>

        <View style={[styles.onlineCard, { borderColor: online ? "#bbf7d0" : palette.gray200 }]}>
          <View style={[styles.dot, { backgroundColor: online ? palette.green500 : palette.gray400 }]} />
          <View style={{ flex: 1 }}>
            <Txt weight={700} style={{ fontSize: 15, color: palette.gray900 }}>{online ? "You're Online" : "You're Offline"}</Txt>
            <Txt style={{ fontSize: 12, color: palette.gray500 }}>{online ? "Receiving new orders" : "Turn on to start receiving orders"}</Txt>
          </View>
          <Switch value={online} disabled={savingOnline} onValueChange={(v) => (v ? setAccepting(true) : setConfirm("offline"))} trackColor={{ true: "#86efac", false: palette.gray300 }} thumbColor={online ? palette.green600 : palette.white} />
        </View>

        {SECTIONS.map((sec) => (
          <View key={sec.title} style={styles.section}>
            <Txt weight={700} style={styles.secTitle}>{sec.title.toUpperCase()}</Txt>
            {sec.items.map((it, i) => (
              <Pressable key={it.label} onPress={() => open(it)} style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && { backgroundColor: palette.gray50 }]}>
                <View style={styles.rowIcon}>
                  <it.Icon size={18} color={rt.primary} />
                </View>
                <Txt weight={500} style={{ fontSize: 14, color: palette.gray800, flex: 1 }}>{it.label}</Txt>
                {it.web ? (
                  <View style={styles.webTag}>
                    <ExternalLink size={11} color={palette.gray500} />
                    <Txt weight={600} style={{ fontSize: 10, color: palette.gray500 }}>Web</Txt>
                  </View>
                ) : (
                  <ChevronRight size={16} color={palette.gray400} />
                )}
              </Pressable>
            ))}
          </View>
        ))}

        <View style={styles.section}>
          <Txt weight={700} style={styles.secTitle}>MY PROFILE</Txt>
          <View style={[styles.row, { alignItems: "flex-start" }]}>
            <View style={styles.rowIcon}>
              <User size={18} color={rt.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt weight={700} style={{ fontSize: 14, color: palette.gray900 }}>{owner.name}</Txt>
              {owner.phone ? <Txt style={{ fontSize: 12, color: palette.gray500 }}>{owner.phone}</Txt> : null}
              {owner.email && owner.email !== "N/A" ? <Txt style={{ fontSize: 12, color: palette.gray500 }}>{owner.email}</Txt> : null}
            </View>
            <Pressable onPress={() => Linking.openURL(`${WEB}/edit-owner`)} hitSlop={8}>
              <Txt weight={600} style={{ fontSize: 12, color: rt.primary }}>Edit</Txt>
            </Pressable>
          </View>
          <Pressable onPress={() => setConfirm("logout")} style={[styles.row, styles.rowBorder]}>
            <View style={[styles.rowIcon, { backgroundColor: palette.red50 }]}>
              <LogOut size={18} color={palette.red600} />
            </View>
            <Txt weight={600} style={{ fontSize: 14, color: palette.red600, flex: 1 }}>Logout</Txt>
          </Pressable>
          <Pressable onPress={() => setConfirm("delete")} style={[styles.row, styles.rowBorder]}>
            <View style={[styles.rowIcon, { backgroundColor: palette.red50 }]}>
              <Trash2 size={18} color={palette.red600} />
            </View>
            <Txt weight={500} style={{ fontSize: 14, color: palette.gray600, flex: 1 }}>Delete restaurant account</Txt>
          </Pressable>
        </View>
        <Txt style={{ textAlign: "center", fontSize: 11, color: palette.gray400 }}>Jharkhand Rasoi Restaurant • v1.0.0</Txt>
      </ScrollView>

      <Modal visible={Boolean(confirm)} transparent animationType="fade" onRequestClose={() => setConfirm(null)}>
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <Txt weight={700} style={{ fontSize: 18, color: palette.gray900 }}>{confirm === "logout" ? "Logout?" : confirm === "delete" ? "Delete Restaurant?" : "Go offline?"}</Txt>
            <Txt style={{ fontSize: 14, color: palette.gray600, marginTop: 8 }}>
              {confirm === "logout"
                ? "You will stop receiving order alerts on this phone until you log in again."
                : confirm === "delete"
                  ? "This permanently deletes your restaurant account, menu and history. This cannot be undone."
                  : "You will stop receiving new orders until you turn it back on."}
            </Txt>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
              <Pressable onPress={() => setConfirm(null)} style={[styles.dBtn, { backgroundColor: palette.gray100 }]}>
                <Txt weight={600} style={{ color: palette.gray700 }}>Cancel</Txt>
              </Pressable>
              <Pressable
                disabled={busy}
                onPress={() => {
                  if (confirm === "logout") signOut();
                  else if (confirm === "delete") deleteAccount();
                  else {
                    setConfirm(null);
                    setAccepting(false);
                  }
                }}
                style={[styles.dBtn, { backgroundColor: palette.red600 }, busy && { opacity: 0.6 }]}
              >
                <Txt weight={600} style={{ color: palette.white }}>{busy ? "Please wait..." : confirm === "logout" ? "Logout" : confirm === "delete" ? "Delete" : "Go offline"}</Txt>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { backgroundColor: palette.white, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: palette.gray100 },
  restCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: palette.white, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: palette.gray100 },
  restImg: { width: 56, height: 56, borderRadius: 14 },
  onlineCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: palette.white, borderRadius: 16, padding: 14, borderWidth: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  section: { backgroundColor: palette.white, borderRadius: 16, paddingVertical: 6, borderWidth: 1, borderColor: palette.gray100 },
  secTitle: { fontSize: 11, color: palette.gray400, letterSpacing: 1.2, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  rowBorder: { borderTopWidth: 1, borderTopColor: palette.gray50 },
  rowIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: rt.primarySoft, alignItems: "center", justifyContent: "center" },
  webTag: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: palette.gray100 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 16 },
  dialog: { backgroundColor: palette.white, borderRadius: 20, padding: 20 },
  dBtn: { flex: 1, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
