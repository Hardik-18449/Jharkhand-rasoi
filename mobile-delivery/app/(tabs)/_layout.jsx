/** Bottom nav — port of DeliveryHomeV2's fixed nav (Home / Earnings / Orders / Profile, orange active + dot, order count badge). */
import React, { useEffect, useState } from "react";
import { Keyboard, Pressable, StyleSheet, View } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Home, TrendingUp, Package, User } from "lucide-react-native";
import Txt from "../../src/components/ui/Txt";
import { isModuleAuthenticated } from "../../src/auth/session";
import { useDeliveryStore } from "../../src/delivery/store";
import { palette, dv } from "../../src/theme";

const TABS = [
  { name: "index", label: "Home", Icon: Home },
  { name: "pocket", label: "Earnings", Icon: TrendingUp },
  { name: "orders", label: "Orders", Icon: Package },
  { name: "profile", label: "Profile", Icon: User },
];


function TabBar({ state }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const acceptedCount = useDeliveryStore((s) => s.acceptedOrders.length);
  const [kb, setKb] = useState(false);
  useEffect(() => {
    const a = Keyboard.addListener("keyboardDidShow", () => setKb(true));
    const b = Keyboard.addListener("keyboardDidHide", () => setKb(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);
  if (kb) return null;
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {TABS.map((t, i) => {
        const active = state.index === i;
        const color = active ? dv.accent : palette.gray400;
        return (
          <Pressable
            key={t.name}
            onPress={() => !active && router.navigate(t.name === "index" ? "/(tabs)" : `/(tabs)/${t.name}`)}
            style={({ pressed }) => [styles.tab, pressed && { transform: [{ scale: 0.95 }] }]}
          >
            <View>
              <t.Icon size={22} color={color} strokeWidth={2.2} />
              {t.name === "orders" && acceptedCount > 0 ? (
                <View style={styles.badge}>
                  <Txt weight={900} style={{ fontSize: 9, color: palette.white }}>{acceptedCount}</Txt>
                </View>
              ) : null}
              {active ? <View style={styles.dot} /> : null}
            </View>
            <Txt weight={active ? 900 : 600} style={{ fontSize: 11, color }}>{t.label}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const router = useRouter();
  useEffect(() => {
    if (!isModuleAuthenticated()) router.replace("/login");
  }, [router]);
  return (
    <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: dv.bg } }} tabBar={(p) => <TabBar {...p} />}>
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", backgroundColor: palette.white, borderTopWidth: 1, borderTopColor: palette.gray100, paddingTop: 8, paddingHorizontal: 16, elevation: 12 },
  tab: { flex: 1, alignItems: "center", gap: 4, paddingVertical: 2 },
  dot: { position: "absolute", bottom: -5, alignSelf: "center", width: 6, height: 6, borderRadius: 3, backgroundColor: dv.accent },
  badge: { position: "absolute", top: -4, right: -10, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3, backgroundColor: dv.accent, alignItems: "center", justifyContent: "center" },
});
