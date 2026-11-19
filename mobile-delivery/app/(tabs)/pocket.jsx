/**
 * Earnings tab — port of DeliveryV2/pages/PocketV2.jsx + pocket/PocketBalanceV2.jsx (withdraw).
 * Real data only: the web page showed invented fallback trips / weekly bars / "14.5 h" when its non-existent
 * getHistory call failed (deviation D4); cash deposit is not offered because the web called a non-existent
 * initiateDeposit (deviation D5).
 */
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, Wallet, CheckCircle2, Gift, Sparkles, Banknote, ArrowUpRight, Package } from "lucide-react-native";
import Txt from "../../src/components/ui/Txt";
import Spinner from "../../src/components/ui/Spinner";
import { deliveryAPI } from "../../src/api";
import { toast } from "../../src/utils/toast";
import { palette, dv } from "../../src/theme";

const money = (v, d = 0) => `₹${Number(v || 0).toFixed(d)}`;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function PocketTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [w, setW] = useState(null);
  const [days, setDays] = useState([]);
  const [recent, setRecent] = useState([]);
  const [withdrawing, setWithdrawing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [profileRes, earnRes, walletRes, recentRes] = await Promise.all([
        deliveryAPI.getProfile().catch(() => null),
        deliveryAPI.getEarnings({ period: "week" }).catch(() => null),
        deliveryAPI.getWallet().catch(() => null),
        deliveryAPI.getDeliveredOrders({ limit: 5 }).catch(() => null),
      ]);
      const profile = profileRes?.data?.data?.profile || {};
      const summary = earnRes?.data?.data?.summary || {};
      const wallet = walletRes?.data?.data?.wallet || {};
      const pocket = Number(wallet.pocketBalance ?? wallet.totalBalance ?? summary.totalEarnings ?? 0) || 0;
      setW({
        pocket,
        weekly: Number(summary.totalEarnings ?? 0) || 0,
        orders: Number(summary.totalOrders ?? profile.totalOrders ?? 0) || 0,
        tips: Number(summary.totalTips ?? 0) || 0,
        incentives: Number(summary.totalIncentives ?? 0) || 0,
        onlineHours: summary.onlineHours != null ? Number(summary.onlineHours) : null,
        cashInHand: Number(wallet.cashInHand ?? 0) || 0,
        availableCashLimit: Number(wallet.availableCashLimit ?? 0) || 0,
        totalCashLimit: Number(wallet.totalCashLimit ?? 0) || 0,
        withdrawalLimit: Number(wallet.deliveryWithdrawalLimit) || 100,
        bankFilled: Boolean(profile?.documents?.bankDetails?.accountNumber || profile?.bankDetails?.accountNumber || profile?.bankAccountNumber),
      });
      const api = Array.isArray(summary.dailyBreakdown) ? summary.dailyBreakdown : [];
      const todayIdx = (new Date().getDay() + 6) % 7;
      setDays(
        DAYS.map((d, i) => {
          const m = api.find((x) => String(x.day || "").toLowerCase().startsWith(d.toLowerCase()));
          return { day: d, amount: m ? Number(m.amount || 0) : 0, isToday: i === todayIdx };
        }),
      );
      setRecent(Array.isArray(recentRes?.data?.data?.deliveredOrders) ? recentRes.data.data.deliveredOrders.slice(0, 5) : []);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const withdraw = async () => {
    if (!w) return;
    if (!w.bankFilled) {
      toast.error("Please add bank details first");
      return;
    }
    if (w.pocket < w.withdrawalLimit) {
      toast.error(`Minimum withdrawal is ${money(w.withdrawalLimit)}`);
      return;
    }
    setWithdrawing(true);
    try {
      const res = await deliveryAPI.createWithdrawalRequest({ amount: w.pocket, paymentMethod: "bank_transfer" });
      if (res?.data?.success) {
        toast.success("Withdrawal request submitted");
        load();
      } else toast.error(res?.data?.message || "Withdrawal failed");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Withdrawal failed");
    } finally {
      setWithdrawing(false);
    }
  };

  const max = Math.max(1, ...days.map((d) => d.amount));
  return (
    <View style={{ flex: 1, backgroundColor: palette.gray50 }}>
      <View style={[styles.top, { paddingTop: insets.top + 10 }]}>
        <Txt weight={900} style={{ fontSize: 22, color: palette.gray900, flex: 1 }}>Earnings</Txt>
        <Pressable onPress={() => router.push("/notifications")} style={styles.iconBtn}>
          <Bell size={18} color={palette.gray800} />
        </Pressable>
      </View>
      {loading ? (
        <Spinner full />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 100, gap: 12 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} colors={[dv.accent]} />}>
          <View style={styles.balance}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Wallet size={16} color="rgba(255,255,255,0.8)" />
              <Txt weight={700} style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", letterSpacing: 1.5 }}>TOTAL BALANCE</Txt>
            </View>
            <Txt weight={900} style={{ fontSize: 38, color: palette.white, marginTop: 4 }}>{money(w?.pocket, 2)}</Txt>
            <Txt weight={600} style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>Net earnings this week: {money(w?.weekly, 2)}</Txt>
            <Pressable onPress={withdraw} disabled={withdrawing} style={[styles.withdraw, withdrawing && { opacity: 0.6 }]}>
              {withdrawing ? <Spinner color={palette.gray900} /> : <ArrowUpRight size={16} color={palette.gray900} />}
              <Txt weight={800} style={{ fontSize: 13, color: palette.gray900 }}>Withdraw to Bank</Txt>
            </Pressable>
            <Txt style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", marginTop: 6 }}>Minimum withdrawal {money(w?.withdrawalLimit)}{w?.bankFilled ? "" : " • add bank details in Profile"}</Txt>
          </View>

          <View style={styles.grid}>
            {[
              ["Completed", String(w?.orders ?? 0), CheckCircle2, palette.green600],
              ["Tips Earned", money(w?.tips), Gift, palette.purple600],
              ["Incentives", money(w?.incentives), Sparkles, "#d97706"],
              ["Login Hours", w?.onlineHours != null ? `${w.onlineHours.toFixed(1)} h` : "—", Banknote, palette.blue600],
            ].map(([label, value, Icon, color]) => (
              <View key={label} style={styles.stat}>
                <Icon size={18} color={color} />
                <Txt weight={900} style={{ fontSize: 18, color: palette.gray900, marginTop: 6 }}>{value}</Txt>
                <Txt weight={700} style={{ fontSize: 11, color: palette.gray500 }}>{label}</Txt>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Txt weight={800} style={styles.h3}>Cash In Hand</Txt>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
              <Txt weight={900} style={{ fontSize: 22, color: palette.gray900 }}>{money(w?.cashInHand)}</Txt>
              <Txt weight={600} style={{ fontSize: 12, color: palette.gray500, alignSelf: "flex-end" }}>Available limit {money(w?.availableCashLimit)} / {money(w?.totalCashLimit)}</Txt>
            </View>
            <View style={styles.limitBar}>
              <View style={[styles.limitFill, { width: `${w?.totalCashLimit ? Math.min(100, (w.cashInHand / w.totalCashLimit) * 100) : 0}%` }]} />
            </View>
          </View>

          <View style={styles.card}>
            <Txt weight={800} style={styles.h3}>Weekly Breakdown</Txt>
            <View style={styles.bars}>
              {days.map((d) => (
                <View key={d.day} style={{ alignItems: "center", flex: 1 }}>
                  <Txt weight={700} style={{ fontSize: 9, color: palette.gray500, marginBottom: 4 }}>{d.amount ? money(d.amount) : ""}</Txt>
                  <View style={[styles.bar, { height: Math.max(4, (d.amount / max) * 90), backgroundColor: d.isToday ? dv.accent : "#fed7aa" }]} />
                  <Txt weight={d.isToday ? 900 : 600} style={{ fontSize: 11, color: d.isToday ? dv.accent : palette.gray500, marginTop: 4 }}>{d.day}</Txt>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <Txt weight={800} style={styles.h3}>Recent Deliveries</Txt>
              <Pressable onPress={() => router.push("/history")}>
                <Txt weight={700} style={{ fontSize: 12, color: dv.accent }}>Trip History</Txt>
              </Pressable>
            </View>
            {recent.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 20 }}>
                <Package size={28} color={palette.gray300} />
                <Txt style={{ fontSize: 13, color: palette.gray500, marginTop: 6 }}>No deliveries yet</Txt>
              </View>
            ) : (
              recent.map((o, i) => (
                <View key={o._id || i} style={styles.recentRow}>
                  <View style={{ flex: 1 }}>
                    <Txt weight={700} style={{ fontSize: 13, color: palette.gray900 }}>#{o.orderId || o._id}</Txt>
                    <Txt style={{ fontSize: 11, color: palette.gray500 }}>{o.restaurantName || o.restaurant || ""}</Txt>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Txt weight={700} style={{ fontSize: 9, color: palette.gray400 }}>EARNED</Txt>
                    <Txt weight={900} style={{ fontSize: 14, color: palette.green700 }}>{money(o.riderEarning || o.deliveryEarning || o.earningAmount || o.earnings)}</Txt>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", backgroundColor: palette.white, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: palette.gray100 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: palette.gray100, alignItems: "center", justifyContent: "center" },
  balance: { backgroundColor: "#111827", borderRadius: 24, padding: 18 },
  withdraw: { marginTop: 14, height: 46, borderRadius: 14, backgroundColor: dv.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: { width: "48%", flexGrow: 1, backgroundColor: palette.white, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: palette.gray100 },
  card: { backgroundColor: palette.white, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: palette.gray100 },
  h3: { fontSize: 15, color: palette.gray900 },
  limitBar: { height: 8, borderRadius: 4, backgroundColor: palette.gray100, marginTop: 10, overflow: "hidden" },
  limitFill: { height: "100%", backgroundColor: "#f59e0b" },
  bars: { flexDirection: "row", alignItems: "flex-end", height: 130, marginTop: 10 },
  bar: { width: 18, borderRadius: 6 },
  recentRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderTopWidth: 1, borderTopColor: palette.gray50 },
});
