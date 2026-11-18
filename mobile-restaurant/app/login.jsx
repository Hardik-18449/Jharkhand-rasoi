/** Port of pages/restaurant/auth/Login.jsx — phone number → request OTP. */
import React, { useRef, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowRight, ShieldCheck, Heart } from "lucide-react-native";
import Txt from "../src/components/ui/Txt";
import { restaurantAPI } from "../src/api";
import { sessionStore } from "../src/utils/storage";
import { localImages } from "../src/constants/images";
import { toast } from "../src/utils/toast";
import { fonts, palette, rt } from "../src/theme";

const validatePhone = (num) => {
  const digits = num.replace(/\D/g, "");
  return digits.length === 10 && ["6", "7", "8", "9"].includes(digits[0]);
};

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState(() => sessionStore.getItem("restaurantLoginPhone") || "");
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);

  const handleSendOTP = async () => {
    if (!validatePhone(phone)) {
      toast.error("Please enter a valid 10-digit mobile number");
      return;
    }
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true);
    const fullPhone = `+91 ${phone}`.trim();
    try {
      await restaurantAPI.sendOTP(fullPhone);
      sessionStore.setItem("restaurantAuthData", JSON.stringify({ method: "phone", phone: fullPhone, isSignUp: false, module: "restaurant" }));
      sessionStore.setItem("restaurantLoginPhone", phone);
      toast.success("Verification code sent!");
      router.push("/otp");
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to send OTP.");
    } finally {
      setLoading(false);
      submitting.current = false;
    }
  };

  const disabled = loading || phone.length < 10;
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: palette.white }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.glow} />
      <ScrollView contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.logoRing}>
          <Image source={localImages.brandlogo} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
        </View>
        <Txt weight={700} style={styles.partner}>RESTAURANT PARTNER</Txt>

        <View style={styles.card}>
          <Txt weight={900} family="outfit" style={styles.title}>Partner Login</Txt>
          <View style={styles.titleBar} />
          <Txt weight={500} style={styles.subtitle}>Enter your registered mobile number to manage your restaurant</Txt>

          <Txt weight={900} style={styles.label}>MOBILE NUMBER</Txt>
          <View style={styles.inputWrap}>
            <Txt weight={700} style={styles.cc}>+91</Txt>
            <TextInput
              value={phone}
              onChangeText={(t) => setPhone(t.replace(/\D/g, "").slice(0, 10))}
              keyboardType="phone-pad"
              maxLength={10}
              autoFocus
              placeholder="00000 00000"
              placeholderTextColor={palette.gray300}
              style={styles.input}
              onSubmitEditing={handleSendOTP}
              returnKeyType="done"
            />
          </View>

          <Pressable onPress={handleSendOTP} disabled={disabled} style={({ pressed }) => [styles.btn, disabled && styles.btnDisabled, pressed && !disabled && { backgroundColor: rt.primaryStrong }]}>
            {loading ? (
              <ActivityIndicator color={palette.white} />
            ) : (
              <>
                <Txt weight={700} style={{ fontSize: 17, color: disabled ? palette.gray400 : palette.white }}>Get Start</Txt>
                <ArrowRight size={20} color={disabled ? palette.gray400 : palette.white} />
              </>
            )}
          </Pressable>
        </View>

        <Txt weight={500} style={styles.terms}>
          By continuing, you agree to Jharkhand Rasoi's{"\n"}
          <Txt weight={700} style={styles.termsLink} onPress={() => router.push("/terms")}>Terms of Service</Txt> &{" "}
          <Txt weight={700} style={styles.termsLink} onPress={() => router.push("/privacy")}>Privacy Policy</Txt>
        </Txt>

        <View style={styles.badges}>
          <View style={styles.badge}>
            <ShieldCheck size={16} color={palette.gray500} />
            <Txt weight={900} style={styles.badgeText}>BUSINESS VERIFIED</Txt>
          </View>
          <View style={styles.badge}>
            <Heart size={16} color={palette.gray500} />
            <Txt weight={900} style={styles.badgeText}>PARTNER SUCCESS</Txt>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  glow: { position: "absolute", top: 0, left: 0, right: 0, height: 420, backgroundColor: rt.primarySoft },
  wrap: { flexGrow: 1, alignItems: "center", paddingHorizontal: 24 },
  logoRing: { width: 128, height: 128, borderRadius: 64, borderWidth: 4, borderColor: palette.white, backgroundColor: palette.white, overflow: "hidden", padding: 8, elevation: 8, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 15, shadowOffset: { width: 0, height: 8 } },
  partner: { marginTop: 16, marginBottom: 28, fontSize: 12, color: palette.gray400, letterSpacing: 3.6 },
  card: { width: "100%", maxWidth: 440, backgroundColor: palette.white, borderRadius: 40, padding: 28, borderWidth: 1, borderColor: palette.gray100, elevation: 10, shadowColor: rt.orderBrand, shadowOpacity: 0.2, shadowRadius: 40, shadowOffset: { width: 0, height: 20 } },
  title: { fontSize: 30, color: palette.gray900, letterSpacing: -0.5 },
  titleBar: { height: 4, width: 40, backgroundColor: rt.primary, borderRadius: 2, marginVertical: 10 },
  subtitle: { fontSize: 15, color: palette.gray500, marginBottom: 28 },
  label: { fontSize: 10, color: rt.primary, letterSpacing: 2, marginLeft: 4, marginBottom: 8 },
  inputWrap: { flexDirection: "row", alignItems: "center", backgroundColor: palette.gray50, borderRadius: 16, paddingHorizontal: 20, height: 58 },
  cc: { fontSize: 14, color: rt.primary, paddingRight: 12, marginRight: 12, borderRightWidth: 1, borderRightColor: palette.gray200 },
  input: { flex: 1, fontFamily: fonts.bold, fontSize: 18, color: palette.gray900, letterSpacing: 1.5, padding: 0 },
  btn: { marginTop: 28, height: 58, borderRadius: 16, backgroundColor: rt.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  btnDisabled: { backgroundColor: palette.gray200 },
  terms: { marginTop: 32, fontSize: 11, color: palette.gray400, textAlign: "center", lineHeight: 18 },
  termsLink: { fontSize: 11, color: palette.gray900 },
  badges: { marginTop: 40, flexDirection: "row", gap: 24, opacity: 0.4 },
  badge: { flexDirection: "row", alignItems: "center", gap: 6 },
  badgeText: { fontSize: 10, letterSpacing: 1.5, color: palette.gray600 },
});
