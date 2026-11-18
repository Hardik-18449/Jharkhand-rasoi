/** Port of pages/restaurant/Notifications.jsx — inbox (admin broadcasts, approvals), mark read on open, dismiss, clear all. */
import React, { useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Bell, X, Trash2 } from "lucide-react-native";
import Screen from "../src/components/ui/Screen";
import PageHeader from "../src/components/ui/PageHeader";
import Txt from "../src/components/ui/Txt";
import Spinner from "../src/components/ui/Spinner";
import useNotificationInbox from "../src/hooks/useNotificationInbox";
import { palette, rt } from "../src/theme";

const timeAgo = (iso) => {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { items, loading, refresh, markAsRead, dismiss, dismissAll } = useNotificationInbox("restaurant", { limit: 50 });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onOpen = (n) => {
    if (!n.read) markAsRead(n.id);
    if (n.link && n.link.startsWith("/")) {
      const path = n.link.replace(/^\/food\/restaurant/, "").replace(/^\/restaurant/, "") || "/";
      if (/^\/orders\//.test(path)) router.push(path);
    }
  };

  return (
    <Screen bg={rt.pageBg}>
      <PageHeader
        title="Notifications"
        right={
          items.length ? (
            <Pressable onPress={dismissAll} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Trash2 size={16} color={palette.red500} />
              <Txt weight={600} style={{ fontSize: 12, color: palette.red500 }}>Clear all</Txt>
            </Pressable>
          ) : null
        }
      />
      {loading && !items.length ? (
        <Spinner full />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 10 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refresh(); setRefreshing(false); }} colors={[rt.primary]} />}>
          {items.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 64 }}>
              <View style={styles.emptyIcon}>
                <Bell size={30} color={palette.gray400} />
              </View>
              <Txt weight={700} style={{ fontSize: 16, color: palette.gray800 }}>No notifications</Txt>
              <Txt style={{ fontSize: 13, color: palette.gray500, marginTop: 4 }}>You're all caught up.</Txt>
            </View>
          ) : (
            items.map((n) => (
              <Pressable key={n.id} onPress={() => onOpen(n)} style={[styles.card, !n.read && styles.unread]}>
                <View style={[styles.icon, { backgroundColor: n.read ? palette.gray100 : rt.primarySoft }]}>
                  <Bell size={18} color={n.read ? palette.gray500 : rt.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt weight={n.read ? 600 : 700} style={{ fontSize: 14, color: palette.gray900 }}>{n.title}</Txt>
                  {n.message ? <Txt style={{ fontSize: 13, color: palette.gray600, marginTop: 2 }}>{n.message}</Txt> : null}
                  <Txt style={{ fontSize: 11, color: palette.gray400, marginTop: 6 }}>{timeAgo(n.createdAt)}</Txt>
                </View>
                <Pressable onPress={() => dismiss(n.id)} hitSlop={10}>
                  <X size={16} color={palette.gray400} />
                </Pressable>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: palette.gray100, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  card: { flexDirection: "row", gap: 12, backgroundColor: palette.white, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: palette.gray100 },
  unread: { borderColor: rt.border, backgroundColor: "#fffafb" },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
