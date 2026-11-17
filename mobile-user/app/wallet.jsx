/** Port of pages/user/Wallet.jsx */
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, IndianRupee, Plus, ArrowDownCircle, ArrowUpCircle, RefreshCw } from "lucide-react-native";
import Txt from "../src/components/ui/Txt";
import Screen from "../src/components/ui/Screen";
import RequireAuth from "../src/components/RequireAuth";
import AddMoneySheet from "../src/components/AddMoneySheet";
import { LinearGradient } from "../src/components/ui/LinearGradient";
import { userAPI } from "../src/api";
import { useCompanyName } from "../src/hooks/useCompanyName";
import { toast } from "../src/utils/toast";
import { palette } from "../src/theme";

const FILTERS = [
  { id: "all", label: "All Transactions" },
  { id: "additions", label: "Additions" },
  { id: "deductions", label: "Deductions" },
  { id: "refunds", label: "Refunds" },
];
const isReferral = (t) => t?.metadata?.source === "referral_signup" || String(t.description || "").toLowerCase().startsWith("referral reward");
const fmtAmount = (a) => {
  const n = Number(a ?? 0);
  return `₹${(Number.isFinite(n) ? n : 0).toLocaleString("en-IN")}`;
};
const fmtDate = (s) => {
  if (!s) return "N/A";
  const d = new Date(s);
  return `${d.toLocaleDateString("en-IN", { year: "numeric", month: "2-digit", day: "2-digit" })} | ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}`;
};
const TX = { addition: [ArrowDownCircle, palette.green600], deduction: [ArrowUpCircle, palette.red600], refund: [RefreshCw, palette.blue600] };

function WalletScreen() {
  const router = useRouter();
  const companyName = useCompanyName();
  const [filter, setFilter] = useState("all");
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addOpen, setAddOpen] = useState(false);

  const fetchWalletData = async () => {
    try {
      setLoading(true);
      setError(null);
      const r = await userAPI.getWallet();
      const w = r?.data?.data?.wallet || r?.data?.wallet;
      if (w) {
        setWallet(w);
        setTransactions(w.transactions || []);
      }
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load wallet");
      toast.error("Failed to load wallet data");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchWalletData();
  }, []);

  const referralEarnings = useMemo(() => {
    if (wallet?.referralEarnings != null) return Number(wallet.referralEarnings) || 0;
    return transactions.filter((t) => t.type === "addition" && t.status === "Completed" && isReferral(t)).reduce((s, t) => s + (Number(t.amount) || 0), 0);
  }, [wallet, transactions]);
  const filtered = useMemo(() => {
    if (filter === "all") return transactions;
    const map = { additions: "addition", deductions: "deduction", refunds: "refund" };
    return transactions.filter((t) => t.type === map[filter]);
  }, [filter, transactions]);

  return (
    <Screen bg={palette.white}>
      <View style={styles.header}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/profile"))} style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" }}><ArrowLeft size={20} color={palette.gray700} /></Pressable>
        <Txt weight={700} style={{ fontSize: 18, color: palette.gray900 }}>Wallet</Txt>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingVertical: 24, gap: 24 }}>
        {loading ? (
          <View style={{ paddingVertical: 48, alignItems: "center" }}><ActivityIndicator size="large" color={palette.gray600} /></View>
        ) : error ? (
          <View style={{ backgroundColor: palette.red50, borderWidth: 1, borderColor: "#fecaca", borderRadius: 8, padding: 16 }}>
            <Txt weight={400} style={{ fontSize: 14, color: palette.red600 }}>{error}</Txt>
          </View>
        ) : (
          <>
            <View style={{ alignItems: "center", gap: 16 }}>
              <View>
                <View style={[styles.badge, { position: "absolute", top: 4, backgroundColor: "#991b1b", opacity: 0.25 }]} />
                <LinearGradient colors={["#ef4444", "#dc2626", "#b91c1c"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.badge}>
                  <View style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}>
                    <IndianRupee size={40} color={palette.white} strokeWidth={2.5} />
                  </View>
                </LinearGradient>
              </View>
              <View style={{ alignItems: "center" }}>
                <Txt weight={700} style={{ fontSize: 20, color: palette.gray900, marginBottom: 8 }}>{companyName} Money</Txt>
                <Txt weight={400} style={{ fontSize: 12, color: palette.gray500, marginBottom: 4 }}>Current Balance</Txt>
                <Txt weight={700} style={{ fontSize: 24, color: palette.gray900, marginBottom: 8 }}>{fmtAmount(wallet?.balance || 0)}</Txt>
                <Txt weight={400} style={{ fontSize: 12, color: palette.gray500, marginBottom: 4 }}>Referral Earnings</Txt>
                <Txt weight={600} style={{ fontSize: 18, color: palette.green600, marginBottom: 8 }}>{fmtAmount(referralEarnings)}</Txt>
                <Txt weight={400} style={{ fontSize: 12, color: palette.gray500, textAlign: "center" }}>Add money to enjoy one-tap, seamless payments</Txt>
              </View>
              <Pressable onPress={() => setAddOpen(true)} style={styles.addBtn}>
                <Plus size={16} color={palette.white} />
                <Txt weight={600} style={{ fontSize: 14, color: palette.white }}>Add money</Txt>
              </Pressable>
            </View>

            <View style={{ gap: 16 }}>
              <Txt weight={600} style={{ fontSize: 12, color: palette.gray400, letterSpacing: 3 }}>TRANSACTION HISTORY</Txt>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
                {FILTERS.map((f) => {
                  const sel = filter === f.id;
                  return (
                    <Pressable key={f.id} onPress={() => setFilter(f.id)} style={[styles.filter, sel && { borderWidth: 2, borderColor: palette.green600, elevation: 1 }]}>
                      <Txt weight={500} style={{ fontSize: 12, color: sel ? palette.green600 : palette.gray600 }}>{f.label}</Txt>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {filtered.length > 0 ? (
                <View style={{ gap: 12 }}>
                  {filtered.map((t, i) => {
                    const [Icon, color] = TX[t.type] || [null, palette.gray600];
                    return (
                      <View key={t.id || t._id || i} style={styles.tx}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 16, flex: 1, minWidth: 0 }}>
                          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: palette.gray50, alignItems: "center", justifyContent: "center" }}>{Icon ? <Icon size={24} color={color} /> : null}</View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Txt weight={600} numberOfLines={1} style={{ fontSize: 14, color: palette.gray900, marginBottom: 4 }}>{t.description}</Txt>
                            {isReferral(t) ? <Txt weight={500} style={{ fontSize: 11, color: palette.green600, marginBottom: 4 }}>Referral reward</Txt> : null}
                            <Txt weight={400} style={{ fontSize: 12, color: palette.gray500 }}>{fmtDate(t.date || t.createdAt)}</Txt>
                          </View>
                        </View>
                        <Txt weight={700} style={{ fontSize: 18, color }}>{t.type === "deduction" ? "-" : "+"}{fmtAmount(t.amount)}</Txt>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={{ paddingVertical: 48 }}>
                  <View style={{ gap: 12, marginBottom: 24 }}>
                    {[1, 2, 3].map((i) => (
                      <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: palette.gray100, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, opacity: 0.3 + i * 0.15 }}>
                        <View style={{ width: 40, height: 40, backgroundColor: palette.gray200, borderRadius: 8 }} />
                        <View style={{ flex: 1, gap: 8 }}>
                          <View style={{ height: 12, backgroundColor: palette.gray200, borderRadius: 4, width: "75%" }} />
                          <View style={{ height: 8, backgroundColor: palette.gray200, borderRadius: 4, width: "50%" }} />
                        </View>
                      </View>
                    ))}
                  </View>
                  <Txt weight={500} style={{ fontSize: 14, color: palette.gray600, textAlign: "center" }}>Your transactions will appear here</Txt>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
      <AddMoneySheet open={addOpen} onOpenChange={setAddOpen} onSuccess={fetchWalletData} />
    </Screen>
  );
}

export default function WalletRoute() {
  return (
    <RequireAuth>
      <WalletScreen />
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, backgroundColor: palette.white, borderBottomWidth: 1, borderColor: palette.gray100 },
  badge: { width: 80, height: 80, borderRadius: 12, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-5deg" }], elevation: 6 },
  addBtn: { width: "100%", height: 48, borderRadius: 12, backgroundColor: palette.green600, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  filter: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: palette.gray200, backgroundColor: palette.white },
  tx: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: palette.gray100, backgroundColor: palette.white, elevation: 1 },
});
