/**
 * Port of DeliveryV2/pages/auth/VerificationPending.jsx.
 * mode=register / onboarding: the 4-step registration form (web Onboarding.jsx) is completed on the website
 * (deviation D1 in CONVERSION_CHECKLIST.md) — this screen explains that and opens the web page.
 */
import React, { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertCircle, Clock3, ShieldCheck, ExternalLink } from "lucide-react-native";
import Txt from "../src/components/ui/Txt";
import { deliveryAPI } from "../src/api";
import { clearModuleAuth, getModuleToken } from "../src/auth/session";
import { localStore } from "../src/utils/storage";
import { BACKEND_ORIGIN } from "../src/config";
import { palette, rt } from "../src/theme";

const ONBOARDING_URL = `${BACKEND_ORIGIN}/food/delivery/signup/details`;

export default function VerificationPendingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const mode = String(params.mode || "");
  const needsWebOnboarding = mode === "register" || mode === "onboarding";
  const isRejected = params.isRejected === "1";
  const rejectionReason = String(params.rejectionReason || "");
  const pendingPhone = String(params.phone || localStore.getItem("delivery_pending_phone") || "");
  const [checkingStatus, setCheckingStatus] = useState(!needsWebOnboarding);

  useEffect(() => {
    if (needsWebOnboarding) return undefined;
    let cancelled = false;
    (async () => {
      if (!getModuleToken()) {
        setCheckingStatus(false);
        return;
      }
      try {
        const res = await deliveryAPI.getMe();
        const r = res?.data?.data?.user || res?.data?.data?.deliveryPartner;
        if (!cancelled && String(r?.status || "").toLowerCase() === "approved") {
          localStore.removeItem("delivery_pending_phone");
          router.replace("/");
        }
      } catch {}
      if (!cancelled) setCheckingStatus(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [needsWebOnboarding, router]);

  const backToLogin = () => {
    localStore.removeItem("delivery_pending_phone");
    if (mode === "onboarding") clearModuleAuth();
    router.replace("/login");
  };

  const kicker = needsWebOnboarding ? "Registration Required" : isRejected ? "Registration Rejected" : "Verification Pending";
  const title = needsWebOnboarding ? "Complete Registration" : isRejected ? "Action Required" : "Under Review";
  const body = needsWebOnboarding
    ? "Your delivery partner registration isn't complete yet. Finish the registration form (personal details, vehicle, documents and bank details) on the Jharkhand Rasoi website, then log in here."
    : isRejected
      ? "Your delivery partner registration was not approved. Please review the reason below and try again."
      : "Jharkhand Rasoi received your onboarding details successfully. Our team will verify your documents soon.";
  const tone = isRejected ? palette.red500 : needsWebOnboarding ? rt.primary : palette.amber500;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#f8fafc" }} contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.card}>
        <View style={[styles.iconBox, { backgroundColor: isRejected ? palette.red50 : needsWebOnboarding ? rt.primarySoft : "#fffbeb" }]}>
          {isRejected ? <AlertCircle size={40} color={tone} /> : needsWebOnboarding ? <ExternalLink size={36} color={tone} /> : <Clock3 size={40} color={tone} />}
        </View>
        <Txt weight={900} style={[styles.kicker, { color: tone }]}>{kicker.toUpperCase()}</Txt>
        <Txt weight={900} family="outfit" style={styles.title}>{title}</Txt>
        <Txt weight={500} style={styles.body}>{body}</Txt>
        {!isRejected && !needsWebOnboarding && checkingStatus ? <Txt weight={700} style={styles.checking}>CHECKING APPROVAL STATUS...</Txt> : null}

        {isRejected && rejectionReason ? (
          <View style={styles.reasonBox}>
            <Txt weight={900} style={{ fontSize: 10, letterSpacing: 1.5, color: palette.red600, marginBottom: 8 }}>REJECTION REASON</Txt>
            <Txt weight={700} style={{ fontSize: 14, color: "#7f1d1d", fontStyle: "italic" }}>"{rejectionReason}"</Txt>
          </View>
        ) : null}

        {!isRejected && !needsWebOnboarding ? (
          <View style={styles.nextBox}>
            <View style={styles.nextIcon}>
              <ShieldCheck size={16} color={palette.emerald600} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt weight={700} style={{ fontSize: 14, color: palette.gray900 }}>What's next?</Txt>
              <Txt weight={400} style={{ fontSize: 14, color: palette.gray600, marginTop: 4 }}>We'll notify you via SMS/Email once verified.</Txt>
              {pendingPhone ? <Txt weight={500} style={{ fontSize: 12, color: palette.gray400, marginTop: 12 }}>ID: <Txt style={{ fontSize: 12, color: palette.gray600 }}>{pendingPhone}</Txt></Txt> : null}
            </View>
          </View>
        ) : null}

        {needsWebOnboarding || isRejected ? (
          <Pressable onPress={() => Linking.openURL(ONBOARDING_URL)} style={[styles.btn, { backgroundColor: isRejected ? palette.red600 : rt.primary }]}>
            <Txt weight={700} style={styles.btnText}>{isRejected ? "Retry Registration" : "Open Registration Form"}</Txt>
          </Pressable>
        ) : null}
        <Pressable onPress={backToLogin} style={[styles.btn, needsWebOnboarding || isRejected ? styles.btnGhost : { backgroundColor: rt.primary }]}>
          <Txt weight={needsWebOnboarding || isRejected ? 900 : 700} style={needsWebOnboarding || isRejected ? styles.ghostText : styles.btnText}>
            {needsWebOnboarding || isRejected ? "BACK TO LOGIN" : "Back to Login"}
          </Txt>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24 },
  card: { backgroundColor: palette.white, borderRadius: 40, borderWidth: 1, borderColor: palette.slate200, padding: 28, elevation: 6, shadowColor: "#0f172a", shadowOpacity: 0.1, shadowRadius: 40, shadowOffset: { width: 0, height: 20 } },
  iconBox: { alignSelf: "center", width: 80, height: 80, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 28 },
  kicker: { textAlign: "center", fontSize: 12, letterSpacing: 3.6, marginBottom: 12 },
  title: { textAlign: "center", fontSize: 30, color: "#020617", letterSpacing: -0.5 },
  body: { textAlign: "center", fontSize: 14, color: palette.slate500, lineHeight: 22, marginTop: 16 },
  checking: { textAlign: "center", marginTop: 16, fontSize: 10, letterSpacing: 2, color: palette.gray400 },
  reasonBox: { marginTop: 28, borderRadius: 28, backgroundColor: "#fef2f280", borderWidth: 1, borderColor: palette.red100, padding: 20 },
  nextBox: { marginTop: 28, borderRadius: 28, borderWidth: 1, borderColor: palette.slate100, backgroundColor: "#f8fafc80", padding: 20, flexDirection: "row", gap: 16 },
  nextIcon: { width: 32, height: 32, borderRadius: 12, backgroundColor: palette.white, alignItems: "center", justifyContent: "center", marginTop: 2 },
  btn: { marginTop: 16, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  btnText: { color: palette.white, fontSize: 16 },
  btnGhost: { height: 40, marginTop: 8 },
  ghostText: { fontSize: 12, letterSpacing: 2.4, color: palette.gray400 },
});
