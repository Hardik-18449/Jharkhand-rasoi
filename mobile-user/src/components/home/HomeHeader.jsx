/** Port of components/user/home/HomeHeader.jsx — location row, VIP pill, bell (notifications popover), sticky search + veg toggle. */
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View, Modal, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { MapPin, ChevronDown, Search, Mic, Bell, CheckCircle2, Tag, Gift, AlertCircle, BellOff, Crown } from "lucide-react-native";
import Txt from "../ui/Txt";
import useNotificationInbox from "../../hooks/useNotificationInbox";
import { getJSON, localStore } from "../../utils/storage";
import { addAppListener, dispatchAppEvent } from "../../utils/events";
import { palette, GRADIENT_YELLOW } from "../../theme";
import { LinearGradient } from "../ui/LinearGradient";

const ICON_MAP = { CheckCircle2, Tag, Gift, AlertCircle };

export function resolveLocationTitle(location) {
  const area = location?.area || location?.subLocality || location?.mainTitle || location?.neighborhood;
  const city = (location?.city || "").toLowerCase();
  const state = (location?.state || "").toLowerCase();
  if (area && !/^-?\d+(\.\d+)?$/.test(String(area).trim())) {
    const areaLower = String(area).toLowerCase();
    if (areaLower !== city && areaLower !== state) return area;
  }
  if (location?.address && location.address !== "Select location") {
    const parts = location.address.split(",").map((p) => p.trim());
    for (const part of parts) {
      const partLower = part.toLowerCase();
      if (partLower && partLower !== city && partLower !== state && !/^-?\d/.test(part) && part.length > 2) return part;
    }
  }
  return location?.area || location?.city || "Select Location";
}

export function resolveLocationSubtitle(location) {
  const addr = location?.formattedAddress || location?.address || "";
  if (addr && addr.length > 5 && addr !== "Select location") return addr;
  const state = location?.state || "";
  const pincode = location?.pincode || "";
  if (state && pincode) return `${state}, ${pincode}`;
  if (state) return state;
  if (pincode) return pincode;
  return "Pinpoint location";
}

export default function HomeHeader({ location, handleLocationClick, handleSearchFocus, placeholders, vegMode = false, handleVegModeChange, showVoice = false, handleVoiceSearchClick }) {
  const router = useRouter();
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [notifications, setNotifications] = useState(() => getJSON("food_user_notifications", []) || []);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const { items: broadcastNotifications, unreadCount: broadcastUnreadCount, dismiss: dismissBroadcast } = useNotificationInbox("user", { limit: 20 });

  useEffect(() => {
    if (!Array.isArray(placeholders) || placeholders.length <= 1) return undefined;
    const interval = setInterval(() => setPlaceholderIndex((p) => (p + 1) % placeholders.length), 2500);
    return () => clearInterval(interval);
  }, [placeholders?.length, placeholders]);

  useEffect(() => addAppListener("notificationsUpdated", () => setNotifications(getJSON("food_user_notifications", []) || [])), []);

  const mergedNotifications = useMemo(() => {
    const localItems = (Array.isArray(notifications) ? notifications : []).map((item) => ({ ...item, source: "local" }));
    const broadcastItems = (broadcastNotifications || []).map((item) => ({
      ...item,
      source: "broadcast",
      time: item.createdAt ? new Date(item.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true }) : "Just now",
      type: "broadcast",
      icon: "Bell",
    }));
    return [...broadcastItems, ...localItems].sort((a, b) => new Date(b.createdAt || b.timestamp || 0).getTime() - new Date(a.createdAt || a.timestamp || 0).getTime());
  }, [broadcastNotifications, notifications]);

  const unreadCount = notifications.filter((n) => !n.read).length + broadcastUnreadCount;

  const handleDeleteNotification = (id, source = "local") => {
    if (source === "broadcast") return dismissBroadcast(id);
    setNotifications((prev) => {
      const next = prev.filter((n) => n.id !== id);
      localStore.setItem("food_user_notifications", JSON.stringify(next));
      dispatchAppEvent("notificationsUpdated", { count: next.filter((n) => !n.read).length });
      return next;
    });
    return undefined;
  };

  return (
    <View>
      {/* Row 1: location + VIP + bell */}
      <View style={styles.locRow}>
        <Pressable onPress={handleLocationClick} style={styles.locBtn}>
          <MapPin size={26} color={palette.black} strokeWidth={2.5} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Txt weight={700} numberOfLines={1} style={styles.locTitle}>
                {resolveLocationTitle(location)}
              </Txt>
              <ChevronDown size={16} color={palette.black} strokeWidth={2.5} />
            </View>
            <Txt weight={600} numberOfLines={1} style={styles.locSub}>
              {resolveLocationSubtitle(location).toUpperCase()}
            </Txt>
          </View>
        </Pressable>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Pressable onPress={() => router.push("/subscription")} style={styles.vip}>
            <Crown size={14} color={palette.yellow} fill={palette.yellow} />
            <Txt weight={800} style={{ fontSize: 10, color: palette.yellow }}>
              VIP
            </Txt>
          </Pressable>
          <Pressable onPress={() => setPopoverOpen(true)} style={styles.bell}>
            <Bell size={16} color={palette.black} />
            {unreadCount > 0 ? <View style={styles.bellDot} /> : null}
          </Pressable>
        </View>
      </View>

      {/* Row 2: search + veg toggle on yellow */}
      <LinearGradient colors={GRADIENT_YELLOW} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.searchRow}>
        <Pressable onPress={handleSearchFocus} style={styles.searchBar}>
          <Search size={18} color={palette.black} strokeWidth={2.5} />
          <Txt weight={700} numberOfLines={1} style={styles.placeholder}>
            {placeholders?.[placeholderIndex] || "Search"}
          </Txt>
          {showVoice ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 8 }}>
              <View style={{ height: 20, width: 1, backgroundColor: palette.gray200 }} />
              <Pressable onPress={handleVoiceSearchClick} hitSlop={8}>
                <Mic size={20} color={palette.black} />
              </Pressable>
            </View>
          ) : null}
        </Pressable>
        <Pressable onPress={() => handleVegModeChange?.(!vegMode)} style={styles.vegToggle}>
          <Txt weight={800} style={styles.vegLabel}>
            VEG{"\n"}MODE
          </Txt>
          <View style={[styles.switch, { backgroundColor: vegMode ? palette.green600 : "rgba(188,192,197,0.5)" }]}>
            <View style={[styles.knob, { transform: [{ translateX: vegMode ? 15 : 1 }] }]} />
          </View>
        </Pressable>
      </LinearGradient>

      {/* Notifications popover */}
      <Modal visible={popoverOpen} transparent animationType="fade" onRequestClose={() => setPopoverOpen(false)}>
        <Pressable style={styles.popBackdrop} onPress={() => setPopoverOpen(false)}>
          <View style={styles.pop}>
            <View style={styles.popHeader}>
              <Txt weight={700} style={{ fontSize: 15, color: palette.gray900 }}>
                Notifications
              </Txt>
              {unreadCount > 0 ? (
                <View style={styles.newBadge}>
                  <Txt weight={700} style={{ fontSize: 10, color: palette.black }}>
                    {unreadCount} New
                  </Txt>
                </View>
              ) : null}
            </View>
            <ScrollView style={{ maxHeight: 384 }}>
              {mergedNotifications.length > 0 ? (
                mergedNotifications.slice(0, 5).map((notif) => {
                  const Icon = ICON_MAP[notif.icon] || Bell;
                  return (
                    <Pressable key={notif.id} onLongPress={() => handleDeleteNotification(notif.id, notif.source)} style={styles.popItem}>
                      <View style={styles.popIcon}>
                        <Icon size={16} color={palette.black} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Txt weight={700} numberOfLines={1} style={{ fontSize: 14, color: palette.gray900 }}>
                          {notif.title}
                        </Txt>
                        <Txt weight={400} numberOfLines={1} style={{ fontSize: 12, color: palette.gray500 }}>
                          {notif.message}
                        </Txt>
                      </View>
                    </Pressable>
                  );
                })
              ) : (
                <View style={{ padding: 32, alignItems: "center", gap: 8 }}>
                  <BellOff size={40} color={palette.gray200} />
                  <Txt weight={500} style={{ fontSize: 12, color: palette.gray400 }}>
                    All caught up!
                  </Txt>
                </View>
              )}
            </ScrollView>
            <Pressable
              onPress={() => {
                setPopoverOpen(false);
                router.push("/notifications");
              }}
              style={styles.popFooter}
            >
              <Txt weight={700} style={{ fontSize: 12, color: palette.gray400 }}>
                View All
              </Txt>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  locRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 16, paddingTop: 8 },
  locBtn: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 },
  locTitle: { fontSize: 15, color: palette.black, flexShrink: 1, letterSpacing: -0.3 },
  locSub: { fontSize: 11, color: "rgba(0,0,0,0.8)", marginTop: 2 },
  vip: { height: 32, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, backgroundColor: palette.black, borderWidth: 1, borderColor: "rgba(0,0,0,0.4)" },
  bell: { height: 32, width: 32, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.1)", borderWidth: 1, borderColor: "rgba(0,0,0,0.15)", alignItems: "center", justifyContent: "center" },
  bellDot: { position: "absolute", top: 6, right: 6, width: 6, height: 6, borderRadius: 3, backgroundColor: palette.orange400, borderWidth: 1, borderColor: palette.yellow },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 12, marginTop: 4, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  searchBar: { flex: 1, height: 44, borderRadius: 16, backgroundColor: palette.white, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 8 },
  placeholder: { flex: 1, fontSize: 13, color: palette.gray400 },
  vegToggle: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16, backgroundColor: palette.white, alignItems: "center", justifyContent: "center" },
  vegLabel: { fontSize: 9, color: palette.gray700, textAlign: "center", lineHeight: 11, letterSpacing: 0.5 },
  switch: { marginTop: 2, width: 30, height: 16, borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  knob: { position: "absolute", top: 1, width: 12, height: 12, borderRadius: 6, backgroundColor: palette.white },
  popBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.15)", alignItems: "flex-end", paddingTop: 96, paddingRight: 16 },
  pop: { width: 320, backgroundColor: palette.white, borderRadius: 16, overflow: "hidden", elevation: 12, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 25, shadowOffset: { width: 0, height: 20 } },
  popHeader: { padding: 16, borderBottomWidth: 1, borderBottomColor: palette.gray100, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(249,250,251,0.5)" },
  newBadge: { backgroundColor: palette.orange100, paddingHorizontal: 6, height: 16, borderRadius: 8, justifyContent: "center" },
  popItem: { padding: 16, flexDirection: "row", alignItems: "flex-start", gap: 12, borderBottomWidth: 1, borderBottomColor: palette.gray50 },
  popIcon: { marginTop: 4, padding: 8, borderRadius: 999, backgroundColor: palette.gray100 },
  popFooter: { padding: 12, alignItems: "center", backgroundColor: "rgba(249,250,251,0.5)" },
});
