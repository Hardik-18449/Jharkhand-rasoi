/** Port of DeliveryV2/pages/HistoryV2.jsx — period (daily / weekly / monthly) + date + trip type → GET /food/delivery/trip-history; totals (trips, COD collected, earnings). */
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { ChevronLeft, ChevronRight, Package } from "lucide-react-native";
import Screen from "../src/components/ui/Screen";
import PageHeader from "../src/components/ui/PageHeader";
import Txt from "../src/components/ui/Txt";
import Spinner from "../src/components/ui/Spinner";
import { deliveryAPI } from "../src/api";
import { toast } from "../src/utils/toast";
import { palette, dv } from "../src/theme";

const PERIODS = [
  ["daily", "Daily"],
  ["weekly", "Weekly"],
  ["monthly", "Monthly"],
];
const TYPES = ["ALL TRIPS", "Completed", "Cancelled", "Pending"];
const money = (v) => `₹${Number(v || 0).toFixed(0)}`;
const isCodTrip = (t) => ["cash", "cod"].includes(String(t.paymentMethod || "").toLowerCase());
const isQrTrip = (t) => String(t.paymentMethod || "").toLowerCase() === "razorpay_qr";

export default function HistoryScreen() {
  const [period, setPeriod] = useState("daily");
  const [date, setDate] = useState(new Date());
  const [type, setType] = useState("ALL TRIPS");
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        const r = await deliveryAPI.getTripHistory({ period, date: dateStr, status: type !== "ALL TRIPS" ? type : undefined, limit: 1000 });
        if (!cancelled && r.data?.success) setTrips(Array.isArray(r.data?.data?.trips) ? r.data.data.trips : []);
      } catch {
        if (!cancelled) toast.error("Failed to load history");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [period, date, type]);

  const totals = useMemo(
    () =>
      trips.reduce(
        (acc, t) => {
          acc.earn += Number(t.riderEarning || t.deliveryEarning || t.earningAmount || t.amount || 0);
          if (isCodTrip(t) || isQrTrip(t)) acc.cod += Number(t.codCollectedAmount || t.orderTotal || 0);
          return acc;
        },
        { earn: 0, cod: 0 },
      ),
    [trips],
  );

  const shift = (dir) => {
    const d = new Date(date);
    if (period === "daily") d.setDate(d.getDate() + dir);
    else if (period === "weekly") d.setDate(d.getDate() + 7 * dir);
    else d.setMonth(d.getMonth() + dir);
    if (d > new Date()) return;
    setDate(d);
  };
  const label =
    period === "monthly"
      ? date.toLocaleDateString("en-IN", { month: "long", year: "numeric" })
      : period === "weekly"
        ? `Week of ${date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
        : date.toDateString() === new Date().toDateString()
          ? "Today"
          : date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

  return (
    <Screen bg={palette.gray50}>
      <PageHeader title="Trip History" subtitle="Your delivery milestones" />
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40, gap: 12 }}>
        <View style={styles.segment}>
          {PERIODS.map(([k, l]) => (
            <Pressable key={k} onPress={() => setPeriod(k)} style={[styles.segBtn, period === k && styles.segActive]}>
              <Txt weight={period === k ? 800 : 600} style={{ fontSize: 13, color: period === k ? palette.white : palette.gray600 }}>{l}</Txt>
            </Pressable>
          ))}
        </View>
        <View style={styles.dateRow}>
          <Pressable onPress={() => shift(-1)} style={styles.arrow}>
            <ChevronLeft size={18} color={palette.gray700} />
          </Pressable>
          <Txt weight={800} style={{ fontSize: 14, color: palette.gray900 }}>{label}</Txt>
          <Pressable onPress={() => shift(1)} style={styles.arrow}>
            <ChevronRight size={18} color={palette.gray700} />
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {TYPES.map((t) => (
            <Pressable key={t} onPress={() => setType(t)} style={[styles.chip, type === t && styles.chipActive]}>
              <Txt weight={type === t ? 800 : 600} style={{ fontSize: 12, color: type === t ? palette.white : palette.gray700 }}>{t}</Txt>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.totals}>
          {[
            ["Trips", String(trips.length)],
            ["COD Collected", money(totals.cod)],
            ["Earnings", money(totals.earn)],
          ].map(([l, v]) => (
            <View key={l} style={{ flex: 1, alignItems: "center" }}>
              <Txt weight={900} style={{ fontSize: 18, color: palette.gray900 }}>{v}</Txt>
              <Txt weight={700} style={{ fontSize: 10, color: palette.gray500 }}>{l.toUpperCase()}</Txt>
            </View>
          ))}
        </View>
        {loading ? (
          <Spinner full />
        ) : trips.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 50 }}>
            <Package size={34} color={palette.gray300} />
            <Txt weight={700} style={{ color: palette.gray500, marginTop: 8 }}>No Trips Recorded</Txt>
          </View>
        ) : (
          trips.map((t, i) => {
            const status = String(t.status || "").toLowerCase();
            const collection = isCodTrip(t) || isQrTrip(t) ? Number(t.codCollectedAmount || t.orderTotal || 0) : 0;
            return (
              <View key={t._id || t.orderId || i} style={styles.trip}>
                <View style={{ flex: 1 }}>
                  <Txt weight={800} style={{ fontSize: 13, color: palette.gray900 }}>#{t.orderId}</Txt>
                  <Txt style={{ fontSize: 12, color: palette.gray500 }}>{t.restaurantName || t.restaurant || ""}</Txt>
                  <Txt style={{ fontSize: 11, color: palette.gray400 }}>{t.time || ""}</Txt>
                  {collection ? <Txt weight={700} style={{ fontSize: 11, color: "#b45309", marginTop: 2 }}>{isQrTrip(t) ? "QR" : "COD"} collected {money(collection)}</Txt> : null}
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Txt weight={800} style={[styles.status, status.includes("cancel") ? { color: palette.red600, backgroundColor: palette.red50 } : status.includes("complet") || status.includes("deliver") ? { color: palette.green700, backgroundColor: palette.green50 } : { color: "#b45309", backgroundColor: "#fffbeb" }]}>
                    {String(t.status || "").toUpperCase()}
                  </Txt>
                  <Txt weight={700} style={{ fontSize: 9, color: palette.gray400 }}>EARNING</Txt>
                  <Txt weight={900} style={{ fontSize: 15, color: palette.green700 }}>{money(t.riderEarning || t.deliveryEarning || t.earningAmount || t.amount)}</Txt>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: "row", backgroundColor: palette.white, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: palette.gray100 },
  segBtn: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 10 },
  segActive: { backgroundColor: dv.accent },
  dateRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: palette.white, borderRadius: 14, padding: 8, borderWidth: 1, borderColor: palette.gray100 },
  arrow: { width: 36, height: 36, borderRadius: 18, backgroundColor: palette.gray50, alignItems: "center", justifyContent: "center" },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: palette.white, borderWidth: 1, borderColor: palette.gray200 },
  chipActive: { backgroundColor: palette.gray900, borderColor: palette.gray900 },
  totals: { flexDirection: "row", backgroundColor: palette.white, borderRadius: 18, paddingVertical: 14, borderWidth: 1, borderColor: palette.gray100 },
  trip: { flexDirection: "row", backgroundColor: palette.white, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: palette.gray100 },
  status: { fontSize: 10, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: "hidden" },
});
