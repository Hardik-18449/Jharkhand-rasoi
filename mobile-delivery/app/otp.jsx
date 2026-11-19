/** Port of DeliveryV2/pages/auth/OTP.jsx — 6-digit code, resend after 60 s, routing on verify result. */
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, ShieldCheck, RefreshCw } from "lucide-react-native";
import Txt from "../src/components/ui/Txt";
import { deliveryAPI } from "../src/api";
import { setAuthData } from "../src/auth/session";
import { getFcmDeviceToken } from "../src/push/notifications";
import { sessionStore, localStore } from "../src/utils/storage";
import { toast } from "../src/utils/toast";
import { fonts, palette, rt } from "../src/theme";

const readAuthData = () => {
  try {
    return JSON.parse(sessionStore.getItem("deliveryAuthData") || "null");
  } catch {
    return null;
  }
};

export default function OtpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [authData] = useState(readAuthData);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const inputs = useRef([]);
  const contactInfo = authData?.phone || "";

  useEffect(() => {
    if (!authData?.phone) router.replace("/login");
  }, [authData, router]);

  useEffect(() => {
    if (resendTimer <= 0) return undefined;
    const t = setInterval(() => setResendTimer((p) => (p <= 1 ? 0 : p - 1)), 1000);
    return () => clearInterval(t);
  }, [resendTimer]);

  const handleChange = (index, value) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length > 1) {
      // paste / SMS autofill of the full code
      const next = [...otp];
      for (let i = 0; i < 6 - index && i < digits.length; i += 1) next[index + i] = digits[i];
      setOtp(next);
      const filled = next.join("");
      if (filled.length === 6) handleVerify(filled);
      else inputs.current[Math.min(5, index + digits.length)]?.focus();
      return;
    }
    const next = [...otp];
    next[index] = digits;
    setOtp(next);
    if (digits && index < 5) inputs.current[index + 1]?.focus();
    const code = next.join("");
    if (code.length === 6) handleVerify(code);
  };

  const handleKeyPress = (index, key) => {
    if (key === "Backspace" && !otp[index] && index > 0) inputs.current[index - 1]?.focus();
  };

  const handleVerify = async (codeArg) => {
    const code = codeArg || otp.join("");
    if (code.length !== 6 || isLoading) return;
    setIsLoading(true);
    try {
      let fcmToken = null;
      try {
        fcmToken = await getFcmDeviceToken({ ask: false });
      } catch {}
      const response = await deliveryAPI.verifyOTP(contactInfo, code, fcmToken, "mobile");
      const data = response?.data?.data || response?.data;

      if (data?.needsRegistration) {
        localStore.setItem("delivery_pending_phone", data.phone || contactInfo);
        sessionStore.removeItem("deliveryAuthData");
        router.replace({ pathname: "/pending-verification", params: { mode: "register", phone: data.phone || contactInfo } });
        return;
      }
      if (data?.pendingApproval) {
        localStore.setItem("delivery_pending_phone", data.phone || contactInfo);
        sessionStore.removeItem("deliveryAuthData");
        router.replace({ pathname: "/pending-verification", params: { phone: data.phone || contactInfo, isRejected: data.isRejected ? "1" : "", rejectionReason: data.rejectionReason || "" } });
        return;
      }
      const accessToken = data?.accessToken;
      const partner = data?.user ?? data?.deliveryPartner;
      if (accessToken && partner) {
        setAuthData(accessToken, partner, data?.refreshToken);
        sessionStore.removeItem("deliveryAuthData");
        toast.success("Verification successful!");
        router.replace("/");
      } else {
        toast.error("Invalid OTP. Please try again.");
      }
    } catch (err) {
      const message = err?.response?.data?.message || "Invalid OTP. Please try again.";
      if (/pending approval/i.test(message)) {
        router.replace({ pathname: "/pending-verification", params: { phone: contactInfo } });
        return;
      }
      toast.error(message);
      setOtp(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    try {
      await deliveryAPI.sendOTP(contactInfo);
      toast.success("New code sent!");
      setResendTimer(60);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to resend code");
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: palette.white }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.replace("/login")} style={styles.back} hitSlop={10}>
          <ArrowLeft size={22} color={palette.gray800} />
        </Pressable>
        <View style={{ alignItems: "center", marginTop: 24, marginBottom: 40 }}>
          <View style={styles.shield}>
            <ShieldCheck size={40} color={palette.white} />
          </View>
          <Txt weight={900} family="outfit" style={styles.title}>Verify Account</Txt>
          <Txt weight={500} style={styles.sub}>
            Enter the 6-digit code sent to{"\n"}
            <Txt weight={700} style={{ color: rt.primary }}>{contactInfo}</Txt>
          </Txt>
        </View>

        <View style={styles.otpRow}>
          {otp.map((d, i) => (
            <TextInput
              key={i}
              ref={(el) => (inputs.current[i] = el)}
              value={d}
              onChangeText={(v) => handleChange(i, v)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
              keyboardType="number-pad"
              maxLength={i === 0 ? 6 : 1}
              autoFocus={i === 0}
              textContentType="oneTimeCode"
              autoComplete={i === 0 ? "sms-otp" : "off"}
              style={[styles.otpBox, d && styles.otpBoxFilled]}
            />
          ))}
        </View>

        <Pressable onPress={() => handleVerify()} disabled={isLoading || otp.join("").length !== 6} style={[styles.btn, (isLoading || otp.join("").length !== 6) && { opacity: 0.5 }]}>
          {isLoading ? <ActivityIndicator color={palette.white} /> : <Txt weight={700} style={{ fontSize: 17, color: palette.white }}>Verify & Continue</Txt>}
        </Pressable>

        <View style={{ alignItems: "center", marginTop: 24 }}>
          {resendTimer > 0 ? (
            <Txt weight={900} style={styles.resendWait}>
              RESEND CODE IN <Txt weight={700} style={{ color: rt.primary, fontSize: 10 }}>{resendTimer}s</Txt>
            </Txt>
          ) : (
            <Pressable onPress={handleResend} style={{ flexDirection: "row", alignItems: "center", gap: 8 }} hitSlop={8}>
              <RefreshCw size={14} color={rt.primary} />
              <Txt weight={900} style={styles.resend}>RESEND OTP CODE</Txt>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, paddingHorizontal: 24 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: palette.gray50 },
  shield: { width: 80, height: 80, borderRadius: 28, backgroundColor: rt.primary, alignItems: "center", justifyContent: "center", marginBottom: 24 },
  title: { fontSize: 34, color: rt.primary, letterSpacing: -0.5, marginBottom: 12 },
  sub: { fontSize: 15, color: palette.gray500, textAlign: "center", lineHeight: 22 },
  otpRow: { flexDirection: "row", justifyContent: "space-between", gap: 8, marginBottom: 32 },
  otpBox: { flex: 1, height: 58, borderRadius: 16, backgroundColor: palette.gray50, borderWidth: 2, borderColor: "transparent", textAlign: "center", fontFamily: fonts.extrabold, fontSize: 22, color: palette.gray900 },
  otpBoxFilled: { borderColor: rt.border, backgroundColor: rt.primarySoft },
  btn: { height: 58, borderRadius: 16, backgroundColor: rt.primary, alignItems: "center", justifyContent: "center" },
  resendWait: { fontSize: 10, color: palette.gray400, letterSpacing: 1.5 },
  resend: { fontSize: 12, color: rt.primary, letterSpacing: 1.5 },
});
