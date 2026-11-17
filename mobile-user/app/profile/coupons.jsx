/** Port of pages/user/profile/Coupons.jsx */
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import Svg, { Path } from "react-native-svg";
import { ArrowLeft, Copy, MapPin, TicketPercent } from "lucide-react-native";
import Txt from "../../src/components/ui/Txt";
import Screen from "../../src/components/ui/Screen";
import RequireAuth from "../../src/components/RequireAuth";
import { LinearGradient } from "../../src/components/ui/LinearGradient";
import { restaurantAPI } from "../../src/api";
import { toast } from "../../src/utils/toast";
import { palette } from "../../src/theme";

function Coin({ style }) {
  return <LinearGradient colors={["#facc15", "#eab308"]} style={[{ width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: "#ca8a04" }, style]} />;
}

function CouponsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [offers, setOffers] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const r = await restaurantAPI.getPublicOffers();
        const list = r?.data?.data?.allOffers || r?.data?.allOffers || [];
        if (!cancelled) setOffers(Array.isArray(list) ? list.filter((o) => o?.showInCart !== false) : []);
      } catch {
        if (!cancelled) setOffers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sorted = useMemo(() => [...offers].sort((a, b) => String(a?.couponCode || "").localeCompare(String(b?.couponCode || ""))), [offers]);
  const handleCopy = async (code) => {
    const v = String(code || "").trim();
    if (!v) return;
    try {
      await Clipboard.setStringAsync(v);
      toast.success("Coupon copied");
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <Screen bg="#f5f5f5">
      <ScrollView contentContainerStyle={{ padding: 16, flexGrow: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 32 }}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/profile"))} style={{ width: 32, height: 32, justifyContent: "center" }}><ArrowLeft size={20} color={palette.black} /></Pressable>
          <Txt weight={700} style={{ fontSize: 20, color: palette.black }}>Your coupons</Txt>
        </View>
        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", minHeight: 400 }}>
            <Txt weight={400} style={{ fontSize: 14, color: palette.gray600 }}>Loading coupons...</Txt>
          </View>
        ) : sorted.length > 0 ? (
          <View style={{ gap: 12, paddingBottom: 24 }}>
            {sorted.map((o) => {
              const code = o?.couponCode || "";
              const end = o?.endDate ? new Date(o.endDate) : null;
              const expiry = end && !Number.isNaN(end.getTime()) ? `Valid till ${end.toLocaleDateString()}` : "No expiry";
              return (
                <View key={o?.id || o?.offerId || code} style={styles.card}>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, flex: 1, minWidth: 0 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: palette.orange100, alignItems: "center", justifyContent: "center" }}><TicketPercent size={20} color="#c2410c" /></View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <Txt weight={600} style={{ fontSize: 14, color: palette.gray900 }}>{code}</Txt>
                        {o?.title ? <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: palette.gray100 }}><Txt weight={400} style={{ fontSize: 12, color: palette.gray700 }}>{o.title}</Txt></View> : null}
                      </View>
                      <Txt weight={400} numberOfLines={1} style={{ fontSize: 12, color: palette.gray600, marginTop: 4 }}>{o?.restaurantName || "All Restaurants"}</Txt>
                      <Txt weight={400} style={{ fontSize: 11, color: palette.gray500, marginTop: 4 }}>{expiry}</Txt>
                    </View>
                  </View>
                  <Pressable onPress={() => handleCopy(code)} style={styles.copyBtn}>
                    <Copy size={16} color={palette.gray800} />
                    <Txt weight={500} style={{ fontSize: 14, color: palette.gray800 }}>Copy</Txt>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", minHeight: 480, paddingHorizontal: 16 }}>
            <View style={styles.mapCircle}>
              <Svg width="100%" height="100%" viewBox="0 0 200 200" style={[StyleSheet.absoluteFill, { opacity: 0.7 }]}>
                <Path d="M 20 100 Q 50 80, 80 100 T 140 100" stroke="#a1a1aa" strokeWidth={4} fill="none" strokeLinecap="round" />
                <Path d="M 100 20 Q 100 50, 100 80 T 100 140" stroke="#a1a1aa" strokeWidth={4} fill="none" strokeLinecap="round" />
                <Path d="M 40 40 Q 60 60, 80 80 T 120 120" stroke="#b4b4b8" strokeWidth={3} fill="none" strokeLinecap="round" />
                <Path d="M 160 40 Q 140 60, 120 80 T 80 120" stroke="#b4b4b8" strokeWidth={3} fill="none" strokeLinecap="round" />
                <Path d="M 30 170 Q 50 150, 70 130 T 110 90" stroke="#b4b4b8" strokeWidth={3} fill="none" strokeLinecap="round" />
                <Path d="M 170 170 Q 150 150, 130 130 T 90 90" stroke="#b4b4b8" strokeWidth={3} fill="none" strokeLinecap="round" />
                {["M 50 50 L 70 70", "M 150 50 L 130 70", "M 50 150 L 70 130", "M 150 150 L 130 130"].map((d) => (
                  <Path key={d} d={d} stroke="#c4c4c7" strokeWidth={2} strokeLinecap="round" />
                ))}
              </Svg>
              <MapPin size={28} color={palette.red500} fill={palette.red500} style={{ position: "absolute", left: 48, top: 64 }} />
              <MapPin size={28} color={palette.red500} fill={palette.red500} style={{ position: "absolute", right: 48, top: 80 }} />
              <View style={{ alignItems: "center" }}>
                <View style={{ position: "absolute", left: -40, top: 8, gap: 2 }}>
                  <Coin />
                  <Coin style={{ marginLeft: -4 }} />
                  <Coin style={{ marginLeft: -8 }} />
                </View>
                <View style={{ marginTop: 16 }}>
                  <LinearGradient colors={["#92400e", "#78350f"]} style={{ width: 96, height: 80, borderRadius: 8, alignItems: "center", justifyContent: "center", elevation: 8 }}>
                    <View style={{ position: "absolute", top: -12, left: 0, right: 0, height: 20, backgroundColor: "#451a03", borderTopLeftRadius: 8, borderTopRightRadius: 8 }} />
                    <View style={{ position: "absolute", top: 12, left: 12, width: 64, height: 6, borderRadius: 3, backgroundColor: "#451a03" }} />
                    <View style={{ position: "absolute", bottom: 12, left: 12, width: 64, height: 6, borderRadius: 3, backgroundColor: "#451a03" }} />
                    <LinearGradient colors={["#facc15", "#ca8a04"]} style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: "#a16207", alignItems: "center", justifyContent: "center" }}>
                      <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: "#a16207" }} />
                    </LinearGradient>
                  </LinearGradient>
                </View>
              </View>
            </View>
            <Txt weight={700} style={{ fontSize: 20, color: palette.black, marginTop: 32, marginBottom: 12 }}>No coupons found</Txt>
            <Txt weight={400} style={{ fontSize: 14, color: palette.gray600, lineHeight: 22, textAlign: "center", maxWidth: 320 }}>Discover hidden coupons on your map screen after placing an order</Txt>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

export default function CouponsRoute() {
  return (
    <RequireAuth>
      <CouponsScreen />
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: palette.white, borderRadius: 16, borderWidth: 1, borderColor: palette.gray200, padding: 16, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 8, height: 36, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: palette.gray200 },
  mapCircle: { width: 256, height: 256, borderRadius: 128, backgroundColor: palette.gray200, alignItems: "center", justifyContent: "center", overflow: "hidden" },
});
