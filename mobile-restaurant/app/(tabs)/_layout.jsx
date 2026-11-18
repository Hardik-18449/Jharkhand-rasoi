/**
 * Bottom tabs — port of components/restaurant/BottomNavOrders.jsx (Orders / Inventory / Feedback / Explore, crimson pill bar,
 * red dot on Orders for a waiting order and on Feedback for unread inbox) wrapped in RestaurantBlockGuard (30 s status poll).
 */
import React, { useEffect, useState } from "react";
import { Keyboard, Pressable, StyleSheet, View } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FileText, Package, MessageSquare, Compass, ShieldX } from "lucide-react-native";
import Txt from "../../src/components/ui/Txt";
import Spinner from "../../src/components/ui/Spinner";
import { restaurantAPI } from "../../src/api";
import { clearModuleAuth, isModuleAuthenticated } from "../../src/auth/session";
import { useRestaurantNotifications } from "../../src/context/RestaurantNotificationContext";
import useNotificationInbox from "../../src/hooks/useNotificationInbox";
import { palette, rt } from "../../src/theme";

const TABS = [
  { name: "index", label: "Orders", Icon: FileText },
  { name: "inventory", label: "Inventory", Icon: Package },
  { name: "feedback", label: "Feedback", Icon: MessageSquare },
  { name: "explore", label: "Explore", Icon: Compass },
];

function TabBar({ state }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { newOrder, newReservation } = useRestaurantNotifications();
  const { unreadCount } = useNotificationInbox("restaurant", { limit: 20, pollMs: 60 * 1000 });
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    const a = Keyboard.addListener("keyboardDidShow", () => setKeyboard(true));
    const b = Keyboard.addListener("keyboardDidHide", () => setKeyboard(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);
  if (keyboard) return null;
  return (
    <View style={[styles.barWrap, { paddingBottom: Math.max(insets.bottom, 6) }]}>
      <View style={styles.bar}>
        {TABS.map((tab, i) => {
          const isActive = state.index === i;
          const showDot = (tab.name === "index" && (newOrder || newReservation)) || (tab.name === "feedback" && unreadCount > 0);
          return (
            <Pressable
              key={tab.name}
              onPress={() => {
                if (isActive) return;
                // navigation prop is undefined in this expo-router build (same fix as mobile-user)
                router.navigate(tab.name === "index" ? "/(tabs)" : `/(tabs)/${tab.name}`);
              }}
              style={({ pressed }) => [styles.tab, isActive && styles.tabActive, pressed && { transform: [{ scale: 0.92 }] }]}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <tab.Icon size={20} color={isActive ? palette.white : "rgba(255,255,255,0.7)"} />
              {showDot ? <View style={styles.dot} /> : null}
              <Txt weight={isActive ? 800 : 500} style={{ fontSize: 11, color: isActive ? palette.white : "rgba(255,255,255,0.7)" }} numberOfLines={1}>
                {tab.label}
              </Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const router = useRouter();
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    if (!isModuleAuthenticated()) {
      router.replace("/login");
      return undefined;
    }
    let mounted = true;
    let intervalId = null;
    const check = async () => {
      try {
        const res = await restaurantAPI.getCurrentRestaurant({ noCache: true });
        const r = res?.data?.data?.restaurant || res?.data?.restaurant;
        if (!mounted) return;
        if (r?.status === "rejected" || r?.isActive === false) {
          setStatus("blocked");
          if (intervalId) clearInterval(intervalId);
        } else setStatus("active");
      } catch (error) {
        if (!mounted) return;
        if (error?.response?.status === 401) {
          clearModuleAuth();
          router.replace("/login");
        } else setStatus((s) => (s === "blocked" ? s : "active"));
      }
    };
    check();
    intervalId = setInterval(check, 30000);
    return () => {
      mounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [router]);

  if (status === "loading") {
    return (
      <View style={styles.center}>
        <Spinner size="large" />
        <Txt weight={500} style={{ marginTop: 16, color: palette.slate500 }}>Checking account status...</Txt>
      </View>
    );
  }
  if (status === "blocked") {
    return (
      <View style={[styles.center, { padding: 24 }]}>
        <View style={styles.blockIcon}>
          <ShieldX size={48} color={palette.red600} />
        </View>
        <Txt weight={700} style={{ fontSize: 24, color: palette.gray900, marginBottom: 12, textAlign: "center" }}>Account Blocked</Txt>
        <Txt weight={400} style={{ fontSize: 16, color: palette.gray600, textAlign: "center", lineHeight: 24, marginBottom: 32 }}>
          You are blocked by Admin. Please contact Admin for further assistance.
        </Txt>
        <Pressable
          onPress={() => {
            clearModuleAuth();
            router.replace("/login");
          }}
          style={styles.blockBtn}
        >
          <Txt weight={600} style={{ color: palette.white }}>Back to Login</Txt>
        </Pressable>
      </View>
    );
  }

  return (
    <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: rt.pageBg } }} tabBar={(props) => <TabBar {...props} />}>
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  barWrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 8 },
  bar: { flexDirection: "row", backgroundColor: rt.primary, borderRadius: 30, paddingVertical: 8, paddingLeft: 12, paddingRight: 8, gap: 4, elevation: 16, shadowColor: rt.primary, shadowOpacity: 0.35, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 8, borderRadius: 999 },
  tabActive: { backgroundColor: "rgba(255,255,255,0.25)" },
  dot: { position: "absolute", top: 6, right: "26%", width: 10, height: 10, borderRadius: 5, backgroundColor: palette.red500, borderWidth: 1, borderColor: palette.white },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc" },
  blockIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: palette.red100, alignItems: "center", justifyContent: "center", marginBottom: 24 },
  blockBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: palette.gray900 },
});
