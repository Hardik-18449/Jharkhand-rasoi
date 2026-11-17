/**
 * Port of pages/user/Notifications.jsx (local order/OTP events + admin broadcast inbox).
 * Deviation: web seeds two hard-coded demo notifications ("Order #12345 confirmed", "50% off") when storage is empty;
 * native starts empty so users never see fake order alerts. See CONVERSION_CHECKLIST.md.
 */
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, Bell, CheckCircle2, Clock, Tag, Gift, AlertCircle, Trash2, X } from "lucide-react-native";
import Txt from "../src/components/ui/Txt";
import Screen from "../src/components/ui/Screen";
import RequireAuth from "../src/components/RequireAuth";
import useNotificationInbox from "../src/hooks/useNotificationInbox";
import { localStore } from "../src/utils/storage";
import { addAppListener, dispatchAppEvent } from "../src/utils/events";
import { palette } from "../src/theme";

const KEY = "food_user_notifications";
const ICON_MAP = { CheckCircle2, Tag, Gift, AlertCircle };
const ICON_COLOR = { "text-primary": palette.amber600, "text-red-600": palette.red600, "text-blue-600": palette.blue600 };
const TYPE_BG = { order: palette.green100, offer: palette.red100, promotion: palette.blue100 };

function NotificationsScreen() {
  const router = useRouter();
  const [list, setList] = useState(() => {
    try {
      const s = localStore.getItem(KEY);
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });
  const { items: broadcast, unreadCount: broadcastUnread, markAsRead, dismiss, dismissAll } = useNotificationInbox("user", { limit: 100 });

  useEffect(() => {
    localStore.setItem(KEY, JSON.stringify(list));
    dispatchAppEvent("notificationsUpdated", { count: list.filter((n) => !n.read).length });
  }, [list]);

  useEffect(() => {
    const off1 = addAppListener("orderStatusNotification", (e) => {
      const { orderId, status, message, title } = e?.detail || {};
      const cancelled = String(status || "").toLowerCase().includes("cancel");
      setList((p) => [{ id: `order-${Date.now()}`, type: cancelled ? "alert" : "order", title: title || `Order #${orderId} ${status}`, message: message || `Your order status is now ${status}`, time: "Just now", timestamp: Date.now(), read: false, icon: cancelled ? "AlertCircle" : "CheckCircle2", iconColor: cancelled ? "text-red-600" : "text-primary" }, ...p]);
    });
    const off2 = addAppListener("deliveryDropOtp", (e) => {
      const { orderId, otp, message } = e?.detail || {};
      setList((p) => [{ id: `otp-${Date.now()}`, type: "alert", title: "Delivery OTP Received", message: message || `Your OTP for order #${orderId} is ${otp}`, time: "Just now", timestamp: Date.now(), read: false, icon: "AlertCircle", iconColor: "text-primary" }, ...p]);
    });
    return () => {
      off1?.();
      off2?.();
    };
  }, []);

  const merged = useMemo(() => {
    const local = (list || []).map((i) => ({ ...i, source: "local" }));
    const bc = (broadcast || []).map((i) => ({
      ...i,
      source: "broadcast",
      type: "broadcast",
      time: i.createdAt ? new Date(i.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true }) : "Just now",
      timestamp: i.createdAt || Date.now(),
      icon: "Bell",
      iconColor: "text-blue-600",
    }));
    return [...bc, ...local].sort((a, b) => new Date(b.timestamp || b.createdAt || 0) - new Date(a.timestamp || a.createdAt || 0));
  }, [broadcast, list]);
  const unread = list.filter((n) => !n.read).length + broadcastUnread;

  const markRead = (id, source) => (source === "broadcast" ? markAsRead(id) : setList((p) => p.map((n) => (n.id === id ? { ...n, read: true } : n))));
  const del = (id, source) => (source === "broadcast" ? dismiss(id) : setList((p) => p.filter((n) => n.id !== id)));
  const clearAll = () => {
    setList([]);
    dismissAll();
  };

  return (
    <Screen bg={palette.white}>
      <ScrollView contentContainerStyle={{ padding: 12, paddingVertical: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" }}><ArrowLeft size={16} color={palette.gray900} /></Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
            <Bell size={20} color={palette.amber600} fill={palette.amber600} />
            <Txt weight={700} style={{ fontSize: 18, color: palette.gray800 }}>Notifications</Txt>
            {unread > 0 ? (
              <View style={{ backgroundColor: palette.yellow, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}><Txt weight={600} style={{ fontSize: 12, color: palette.black }}>{unread}</Txt></View>
            ) : null}
          </View>
          {merged.length > 0 ? (
            <Pressable onPress={clearAll} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8, paddingVertical: 6 }}>
              <Trash2 size={16} color={palette.gray500} />
              <Txt weight={500} style={{ fontSize: 12, color: palette.gray500 }}>Clear All</Txt>
            </Pressable>
          ) : null}
        </View>

        <View style={{ gap: 12 }}>
          {merged.map((n) => {
            const Icon = ICON_MAP[n.icon] || Bell;
            return (
              <Pressable key={`${n.source}-${n.id}`} onPress={() => markRead(n.id, n.source)} style={[styles.card, !n.read ? { backgroundColor: "rgba(254,242,242,0.5)", borderColor: "#fecaca" } : null]}>
                {!n.read ? <View style={styles.dot} /> : null}
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={[styles.iconWrap, { backgroundColor: TYPE_BG[n.type] || palette.orange100 }]}><Icon size={20} color={ICON_COLOR[n.iconColor] || palette.amber600} /></View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                      <Txt weight={600} style={{ fontSize: 14, color: !n.read ? palette.gray900 : palette.gray700, flex: 1 }}>{n.title}</Txt>
                      <Pressable onPress={() => del(n.id, n.source)} hitSlop={8} style={{ padding: 4 }}><X size={16} color={palette.gray400} /></Pressable>
                    </View>
                    <Txt weight={400} numberOfLines={2} style={{ fontSize: 12, color: palette.gray600, marginBottom: 8 }}>{n.message}</Txt>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Clock size={12} color={palette.gray500} />
                      <Txt weight={400} style={{ fontSize: 12, color: palette.gray500 }}>{n.time}</Txt>
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>

        {merged.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <Bell size={64} color={palette.gray300} />
            <Txt weight={600} style={{ fontSize: 18, color: palette.gray700, marginTop: 16, marginBottom: 8 }}>No notifications</Txt>
            <Txt weight={400} style={{ fontSize: 14, color: palette.gray500 }}>You're all caught up!</Txt>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

export default function NotificationsRoute() {
  return (
    <RequireAuth>
      <NotificationsScreen />
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: 1, borderColor: palette.gray200, backgroundColor: palette.white, padding: 12, paddingVertical: 14 },
  dot: { position: "absolute", top: 8, right: 8, width: 10, height: 10, borderRadius: 5, backgroundColor: palette.yellow },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
});
