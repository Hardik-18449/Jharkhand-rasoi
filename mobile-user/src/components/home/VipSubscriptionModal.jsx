/** Port of components/user/home/VipSubscriptionModal.jsx (daily VIP promo card; swipe-to-dismiss kept in intent via tap/dismiss). */
import React, { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { X, Sparkles, Crown } from "lucide-react-native";
import Txt from "../ui/Txt";
import BottomSheet from "../ui/BottomSheet";
import { LinearGradient } from "../ui/LinearGradient";
import { isModuleAuthenticated } from "../../auth/session";
import { userAPI } from "../../api";
import { localStore, sessionStore } from "../../utils/storage";
import { localImages } from "../../constants/images";
import { palette } from "../../theme";

export default function VipSubscriptionModal() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [planPrice, setPlanPrice] = useState(99);
  const [planDuration, setPlanDuration] = useState("1 month");

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        if (isModuleAuthenticated()) {
          try {
            const subRes = await userAPI.getMySubscription();
            const subData = subRes?.data?.data || subRes?.data;
            const isActive = subData && (subData.status === "active" || (subData.endDate && new Date(subData.endDate) > new Date()));
            if (isActive) return;
          } catch {}
          const todayStr = new Date().toISOString().slice(0, 10);
          if (localStore.getItem("jr_vip_modal_last_shown_date") === todayStr) return;
          localStore.setItem("jr_vip_modal_last_shown_date", todayStr);
        } else {
          if (sessionStore.getItem("jr_vip_modal_session_shown") === "true") return;
          sessionStore.setItem("jr_vip_modal_session_shown", "true");
        }
        try {
          const plansRes = await userAPI.getPublicSubscriptionPlans();
          const plans = Array.isArray(plansRes?.data?.data) ? plansRes.data.data : Array.isArray(plansRes?.data) ? plansRes.data : [];
          const activePlans = plans.filter((p) => p.isActive !== false && p.price > 0);
          const popular = activePlans.find((p) => p.isPopular) || activePlans[0];
          if (popular && isMounted) {
            setPlanPrice(popular.price);
            if (popular.durationDays) setPlanDuration(popular.durationDays >= 365 ? "1 year" : `${Math.round(popular.durationDays / 30)} month`);
          }
        } catch {}
        setTimeout(() => isMounted && setIsOpen(true), 1100);
      } catch {}
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleClose = () => setIsOpen(false);
  const go = () => {
    setIsOpen(false);
    router.push("/subscription");
  };

  return (
    <BottomSheet visible={isOpen} onClose={handleClose} position="center" bg="transparent" contentStyle={{ alignItems: "center", overflow: "visible" }}>
      <LinearGradient colors={["#F25A05", "#E84E00", "#C93800"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.card}>
        <Pressable onPress={handleClose} style={styles.close}>
          <X size={16} color="rgba(255,255,255,0.9)" strokeWidth={2.5} />
        </Pressable>
        <View style={styles.iconsRow}>
          <View style={styles.ticket}>
            <Txt style={{ fontSize: 10, color: "#fef08a" }}>✦</Txt>
          </View>
          <View style={styles.mascot}>
            <Image source={localImages.chefMascot} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
          </View>
          <View style={styles.gift}>
            <Sparkles size={14} color="#fde047" />
          </View>
        </View>
        <Txt weight={800} style={styles.title}>
          Come back to VIP Club for ₹{planPrice} for {planDuration}.
        </Txt>
        <Txt weight={500} style={styles.desc}>
          Don't let delivery charges hold you back. Enjoy ₹0 Delivery Fee, exclusive restaurant discounts, and priority orders.
        </Txt>
        <Pressable onPress={go} style={({ pressed }) => [styles.cta, pressed && { transform: [{ scale: 0.95 }] }]}>
          <Crown size={16} color={palette.black} fill={palette.black} />
          <Txt weight={800} style={{ fontSize: 14, color: palette.black, letterSpacing: 1 }}>
            REJOIN VIP AT ₹{planPrice}
          </Txt>
        </Pressable>
        <Txt weight={400} style={styles.terms}>
          Welcome back offer for VIP plan. Redeemable on all approved restaurants across your city.{" "}
          <Txt weight={400} onPress={go} style={[styles.terms, { textDecorationLine: "underline" }]}>
            Terms apply.
          </Txt>
        </Txt>
      </LinearGradient>
      <Pressable onPress={handleClose} style={{ marginTop: 12, paddingVertical: 8, paddingHorizontal: 24 }}>
        <Txt weight={700} style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", letterSpacing: 1 }}>
          DISMISS
        </Txt>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  card: { width: "100%", maxWidth: 380, borderRadius: 32, padding: 24, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  close: { position: "absolute", top: 16, right: 16, zIndex: 20, width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.2)", alignItems: "center", justifyContent: "center" },
  iconsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, paddingTop: 4, paddingBottom: 16 },
  ticket: { width: 40, height: 24, borderRadius: 12, backgroundColor: "#fb923c", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)", alignItems: "center", justifyContent: "center", transform: [{ rotate: "-30deg" }] },
  mascot: { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(0,0,0,0.3)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", padding: 8 },
  gift: { width: 32, height: 32, borderRadius: 6, backgroundColor: "#7e22ce", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, color: palette.white, textAlign: "center", lineHeight: 29, letterSpacing: -0.5, marginTop: 4 },
  desc: { marginTop: 14, fontSize: 12, color: "rgba(255,255,255,0.95)", textAlign: "center", lineHeight: 19, maxWidth: 320, alignSelf: "center" },
  cta: { marginTop: 24, height: 50, borderRadius: 999, backgroundColor: "#FFDE31", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  terms: { marginTop: 16, fontSize: 10, color: "rgba(255,255,255,0.8)", textAlign: "center", lineHeight: 15, maxWidth: 310, alignSelf: "center" },
});
