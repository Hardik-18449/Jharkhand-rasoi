/** Port of pages/restaurant/AllOrdersPage.jsx (order history) — status chips + paginated list, tap → order details. */
import React, { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import Screen from "../src/components/ui/Screen";
import PageHeader from "../src/components/ui/PageHeader";
import Txt from "../src/components/ui/Txt";
import OrdersList from "../src/components/orders/OrdersList";
import { palette, rt } from "../src/theme";

const TABS = [
  ["all", "All"],
  ["completed", "Completed"],
  ["cancelled", "Cancelled"],
  ["dead", "Dead"],
];

export default function OrdersHistoryScreen() {
  const router = useRouter();
  const [tab, setTab] = useState("all");
  const [token, setToken] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  return (
    <Screen bg={rt.pageBg}>
      <PageHeader title="Order history" />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setToken((t) => t + 1); setTimeout(() => setRefreshing(false), 600); }} colors={[rt.primary]} />}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 12 }}>
          {TABS.map(([k, l]) => (
            <Pressable key={k} onPress={() => setTab(k)} style={[styles.chip, tab === k && styles.chipActive]}>
              <Txt weight={tab === k ? 700 : 500} style={{ fontSize: 13, color: tab === k ? palette.white : palette.gray700 }}>{l}</Txt>
            </Pressable>
          ))}
        </ScrollView>
        <OrdersList key={tab} tab={tab} refreshToken={token} onSelectOrder={(o) => router.push(`/orders/${o.mongoId || o.orderId}`)} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: palette.white, borderWidth: 1, borderColor: palette.gray200 },
  chipActive: { backgroundColor: rt.primary, borderColor: rt.primary },
});
