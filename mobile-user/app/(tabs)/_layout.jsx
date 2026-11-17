/**
 * Bottom tab bar — port of components/user/BottomNavigation.jsx (+ UserLayout showBottomNav rules).
 * Tabs: Home / Under ₹N / Orders / Profile. "Under" tab hidden when landing settings `showUnder250` is false.
 * Hidden entirely when the user is out of service (web: `!isOutOfService`).
 */
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Home as HomeIcon, Tag, ShoppingBag, User } from "lucide-react-native";
import Txt from "../../src/components/ui/Txt";
import { getPublicLandingSettings } from "../../src/api";
import { useAppLocation } from "../../src/context/LocationProvider";
import { useColors, useTheme } from "../../src/context/ThemeContext";
import { palette, BOTTOM_NAV_HEIGHT, shadows } from "../../src/theme";

function TabBar({ state, settings }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { isDark } = useTheme();
  const { isOutOfService } = useAppLocation();
  if (isOutOfService) return null;

  const TABS = [
    { name: "index", label: "Home", Icon: HomeIcon },
    ...(settings.showUnder250 ? [{ name: "under-250", label: `Under ₹${settings.under250PriceLimit}`, Icon: Tag }] : []),
    { name: "orders", label: "Orders", Icon: ShoppingBag },
    { name: "profile", label: "Profile", Icon: User },
  ];
  const activeName = state.routes[state.index]?.name;

  return (
    <View style={[styles.bar, shadows.navTop, { backgroundColor: colors.navBg, borderTopColor: colors.navBorder, paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.row}>
        {TABS.map((tab) => {
          const route = state.routes.find((r) => r.name === tab.name);
          const isActive = activeName === tab.name;
          const color = isActive ? (isDark ? palette.white : palette.black) : isDark ? palette.gray400 : palette.slate500;
          return (
            <Pressable
              key={tab.name}
              onPress={() => {
                if (!route || isActive) return;
                // expo-router's tab bar props don't always include `navigation.emit`; navigate by path instead.
                router.navigate(tab.name === "index" ? "/" : `/${tab.name}`);
              }}
              style={[styles.tab, isActive && { backgroundColor: isDark ? palette.zinc800 : "rgba(254,198,0,0.25)" }]}
            >
              <tab.Icon size={20} color={color} strokeWidth={isActive ? 2.5 : 2} />
              <Txt weight={isActive ? 800 : 600} style={[styles.label, { color }]} numberOfLines={1}>
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
  const { zoneId } = useAppLocation();
  const [settings, setSettings] = useState({ under250PriceLimit: 250, showDining: true, showUnder250: true });

  useEffect(() => {
    let cancelled = false;
    getPublicLandingSettings(zoneId || null)
      .then((s) => {
        if (cancelled || !s) return;
        setSettings((prev) => ({
          under250PriceLimit: typeof s.under250PriceLimit === "number" ? s.under250PriceLimit : prev.under250PriceLimit,
          showDining: typeof s.showDining === "boolean" ? s.showDining : prev.showDining,
          showUnder250: typeof s.showUnder250 === "boolean" ? s.showUnder250 : prev.showUnder250,
        }));
      })
      .catch(() => !cancelled && setSettings({ under250PriceLimit: 250, showDining: true, showUnder250: true }));
    return () => {
      cancelled = true;
    };
  }, [zoneId]);

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} settings={settings} />}
      screenOptions={{ headerShown: false, lazy: true }}
      backBehavior="initialRoute"
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="under-250" />
      <Tabs.Screen name="orders" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: { borderTopWidth: 1 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, paddingTop: 6, minHeight: BOTTOM_NAV_HEIGHT },
  tab: { width: "22%", alignItems: "center", justifyContent: "center", paddingVertical: 8, borderRadius: 24, gap: 4 },
  label: { fontSize: 10 },
});
