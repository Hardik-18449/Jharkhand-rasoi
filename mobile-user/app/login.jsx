/**
 * Login — port of Frontend/src/modules/auth/pages/Login.jsx (UnifiedOTPFastLogin).
 * Phone step → OTP step (6 boxes, resend 59 s, block timer), name modal for first-time users,
 * deleted-account restore popup, "Skip for now", Terms/Privacy/Support links.
 */
import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, TextInput, Pressable, Image, KeyboardAvoidingView, Platform, ScrollView, BackHandler, Dimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Svg, { Defs, LinearGradient, Stop, Path } from "react-native-svg";
import { Pencil, User, X, Phone, ArrowRight } from "lucide-react-native";
import Txt from "../src/components/ui/Txt";
import BottomSheet from "../src/components/ui/BottomSheet";
import Spinner from "../src/components/ui/Spinner";
import { authAPI, userAPI } from "../src/api";
import { setAuthData, markSkippedLogin, getModuleFcmToken } from "../src/auth/session";
import { getFcmDeviceToken } from "../src/push/notifications";
import { toast } from "../src/utils/toast";
import { useCompanyName } from "../src/hooks/useCompanyName";
import { sessionStore } from "../src/utils/storage";
import { palette, fonts } from "../src/theme";

const RESEND_COOLDOWN_SECONDS = 59;
const OTP_LENGTH = 6;
const SESSION_KEY = "user_auth_session_data";
const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get("window");

const brandLogo = require("../assets/images/brandlogo.png");
const foodDish = require("../assets/images/food_dish.png");
const foodDish2 = require("../assets/images/food_dish_2.png");

const parseBlockSeconds = (msg) => {
  let totalSeconds = 180;
  const timeMatch = String(msg).match(/(\d+)(?::(\d+))?/);
  if (timeMatch) {
    const mins = parseInt(timeMatch[1], 10);
    const secs = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    totalSeconds = mins * 60 + secs;
  }
  return totalSeconds;
};
const isBlockedMsg = (msg) => {
  const l = String(msg).toLowerCase();
  return l.includes("blocked") || l.includes("too many attempts") || l.includes("try again after");
};

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const from = typeof params.from === "string" ? params.from : null;
  const companyName = useCompanyName() || "Jharkhand Rasoi";

  const [phoneNumber, setPhoneNumber] = useState(() => sessionStore.getItem("draft_phone_login") || "");
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [showNameModal, setShowNameModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [tempAuth, setTempAuth] = useState(null);
  const [pendingVerify, setPendingVerify] = useState(null);
  const [showRestorePopup, setShowRestorePopup] = useState(false);
  const [blockTimer, setBlockTimer] = useState(0);
  const submitting = useRef(false);
  const otpRefs = useRef([]);
  const phoneRef = useRef(null);

  // Rehydrate (web sessionStorage persistence)
  useEffect(() => {
    const saved = sessionStore.getItem(SESSION_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (parsed.phoneNumber) setPhoneNumber(parsed.phoneNumber);
      if (parsed.step) setStep(parsed.step);
      if (parsed.showNameModal !== undefined) setShowNameModal(parsed.showNameModal);
      if (parsed.newName) setNewName(parsed.newName);
      if (parsed.tempAuth) setTempAuth(parsed.tempAuth);
      if (parsed.pendingVerify) setPendingVerify(parsed.pendingVerify);
      if (parsed.showRestorePopup !== undefined) setShowRestorePopup(parsed.showRestorePopup);
      if (parsed.resendExpiresAt) {
        const remaining = Math.max(0, Math.floor((parsed.resendExpiresAt - Date.now()) / 1000));
        if (remaining > 0) setResendTimer(remaining);
      }
      if (parsed.blockExpiresAt) {
        const remaining = Math.max(0, Math.floor((parsed.blockExpiresAt - Date.now()) / 1000));
        if (remaining > 0) {
          setBlockTimer(remaining);
          if (parsed.step === 1) setStep(2);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (step === 1 && !phoneNumber && !blockTimer && !showNameModal && !showRestorePopup) return;
    sessionStore.setItem(
      SESSION_KEY,
      JSON.stringify({
        phoneNumber,
        step,
        showNameModal,
        newName,
        tempAuth,
        pendingVerify,
        showRestorePopup,
        resendExpiresAt: resendTimer > 0 ? Date.now() + resendTimer * 1000 : null,
        blockExpiresAt: blockTimer > 0 ? Date.now() + blockTimer * 1000 : null,
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneNumber, step, showNameModal, newName, tempAuth, pendingVerify, showRestorePopup, resendTimer === 0, blockTimer === 0]);

  const clearSessionData = () => sessionStore.removeItem(SESSION_KEY);
  const normalizedPhone = () => {
    const digits = String(phoneNumber).replace(/\D/g, "").slice(-15);
    return digits.length >= 8 ? digits : "";
  };
  const goHome = () => {
    if (from && typeof from === "string" && from !== "/login") router.replace(from);
    else router.replace("/");
  };

  const handleSendOTP = async () => {
    const phone = normalizedPhone();
    if (phone.length < 10) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true);
    try {
      await authAPI.sendOTP(phoneNumber);
      setOtp("");
      setOtpError("");
      setBlockTimer(0);
      setStep(2);
      setResendTimer(RESEND_COOLDOWN_SECONDS);
      toast.success("OTP sent successfully!");
    } catch (err) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || err?.message || "Failed to send OTP.";
      if (isBlockedMsg(msg)) {
        setBlockTimer(parseBlockSeconds(msg));
        setStep(2);
        return;
      }
      toast.error(msg);
    } finally {
      setLoading(false);
      submitting.current = false;
    }
  };

  const handleResendOTP = async () => {
    const phone = normalizedPhone();
    if (phone.length < 10) {
      toast.error("Please enter a valid phone number");
      return;
    }
    if (resendTimer > 0 || blockTimer > 0 || submitting.current) return;
    submitting.current = true;
    setLoading(true);
    try {
      await authAPI.sendOTP(phoneNumber);
      setOtp("");
      setResendTimer(RESEND_COOLDOWN_SECONDS);
      toast.success("OTP resent successfully.");
    } catch (err) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || err?.message || "Failed to resend OTP.";
      if (isBlockedMsg(msg)) {
        setBlockTimer(parseBlockSeconds(msg));
        return;
      }
      toast.error(msg);
    } finally {
      setLoading(false);
      submitting.current = false;
    }
  };

  const handleEditNumber = () => {
    setShowNameModal(false);
    setShowRestorePopup(false);
    setPendingVerify(null);
    setBlockTimer(0);
    setOtpError("");
    setOtp("");
    setStep(1);
    setResendTimer(0);
  };

  const processVerify = async (phone, otpCode, confirmAction = null) => {
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true);
    let fcmToken = null;
    const platform = "mobile";
    try {
      try {
        fcmToken = getModuleFcmToken() || (await getFcmDeviceToken({ ask: false }));
      } catch {}
      const response = await authAPI.verifyOTP(phone, otpCode, "login", null, null, "user", null, null, fcmToken, platform, null, confirmAction);
      const data = response?.data?.data || response?.data || {};
      if (data.deletedAccountFound) {
        setShowRestorePopup(true);
        setLoading(false);
        submitting.current = false;
        return;
      }
      if (data.needsName) {
        setShowRestorePopup(false);
        setPendingVerify({ phone: phoneNumber, otp: otpCode, fcmToken, platform, confirmAction });
        setShowNameModal(true);
        setLoading(false);
        submitting.current = false;
        return;
      }
      const accessToken = data.accessToken;
      const refreshToken = data.refreshToken || null;
      const user = data.user;
      if (!accessToken || !user) throw new Error("Invalid parameters from server");
      setAuthData(accessToken, user, refreshToken);
      if (!user.name || user.name.trim() === "") {
        setTempAuth({ accessToken, user, refreshToken });
        setShowNameModal(true);
      } else {
        clearSessionData();
        toast.success("Welcome back!");
        goHome();
      }
    } catch (err) {
      const status = err?.response?.status;
      let msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Invalid OTP. Please try again.";
      setOtp("");
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
      if (String(msg).toLowerCase().includes("blocked") || String(msg).toLowerCase().includes("too many attempts")) {
        const m = String(msg).match(/(\d+)(?::(\d+))?/);
        if (m) {
          setBlockTimer(parseInt(m[1], 10) * 60 + (m[2] ? parseInt(m[2], 10) : 0));
          msg = "";
        }
      }
      const nameRequired = /name\s+is\s+required.*first[- ]?time|first[- ]?time.*name\s+is\s+required|first[- ]?time\s*sign\s*up/i.test(String(msg));
      if (nameRequired) {
        setShowRestorePopup(false);
        setPendingVerify({ phone: phoneNumber, otp: otpCode, fcmToken, platform, confirmAction });
        setShowNameModal(true);
        return;
      }
      if (status === 401 && msg) {
        if (/deactivat(ed|e)/i.test(String(msg))) toast.error("Your account is deactivated. Please contact support.");
        else setOtpError("Invalid OTP");
      } else if (msg) toast.error(msg);
    } finally {
      setLoading(false);
      submitting.current = false;
    }
  };

  const handleVerifyOTP = async (customOtp = null) => {
    const code = typeof customOtp === "string" ? customOtp : otp;
    const otpDigits = String(code).replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (otpDigits.length !== OTP_LENGTH) {
      toast.error(`Please enter the ${OTP_LENGTH}-digit OTP`);
      return;
    }
    await processVerify(phoneNumber, otpDigits);
  };

  const handleNameSubmit = async () => {
    if (!newName.trim()) {
      toast.error("Please enter your name");
      return;
    }
    try {
      setIsUpdatingName(true);
      if (pendingVerify) {
        const response = await authAPI.verifyOTP(pendingVerify.phone, pendingVerify.otp, "login", newName.trim(), null, "user", null, null, pendingVerify.fcmToken, pendingVerify.platform, null, pendingVerify.confirmAction);
        const data = response?.data?.data || response?.data || {};
        setAuthData(data.accessToken, data.user, data.refreshToken || null);
        setPendingVerify(null);
        clearSessionData();
        setShowNameModal(false);
        toast.success(`Welcome to ${companyName}!`);
        goHome();
        return;
      }
      await userAPI.updateProfile({ name: newName.trim() });
      const updatedUser = { ...tempAuth.user, name: newName.trim() };
      setAuthData(tempAuth.accessToken, updatedUser, tempAuth.refreshToken);
      clearSessionData();
      setShowNameModal(false);
      toast.success(`Welcome to ${companyName}!`);
      goHome();
    } catch {
      toast.error("Failed to update name. You can skip this for now or try again.");
    } finally {
      setIsUpdatingName(false);
    }
  };

  useEffect(() => {
    if (step !== 2 || resendTimer <= 0) return undefined;
    const id = setInterval(() => setResendTimer((p) => (p > 0 ? p - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [step, resendTimer]);
  useEffect(() => {
    if (blockTimer <= 0) return undefined;
    const id = setInterval(() => setBlockTimer((p) => (p > 0 ? p - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [blockTimer]);
  useEffect(() => {
    if (step === 2) setTimeout(() => otpRefs.current[0]?.focus(), 250);
    else setTimeout(() => phoneRef.current?.focus(), 250);
  }, [step]);

  // Hardware back: OTP step → back to phone step (web popstate handling)
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (showNameModal || showRestorePopup) return true; // modals are not dismissable (web onOpenChange ignores close)
      if (step === 2) {
        if (blockTimer > 0) return true;
        handleEditNumber();
        return true;
      }
      return false;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, blockTimer > 0, showNameModal, showRestorePopup]);

  const formatResendTimer = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  const setOtpDigit = (index, text) => {
    const val = text.replace(/\D/g, "");
    if (index === 0 && val) setOtpError("");
    if (val.length > 1) {
      // paste / autofill
      const pasted = val.slice(0, OTP_LENGTH);
      setOtp(pasted);
      setOtpError("");
      otpRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
      if (pasted.length === OTP_LENGTH) handleVerifyOTP(pasted);
      return;
    }
    if (!val) return;
    const arr = otp.split("");
    arr[index] = val;
    const combined = arr.join("").slice(0, OTP_LENGTH);
    setOtp(combined);
    if (index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus();
  };
  const onOtpKeyPress = (index, e) => {
    if (e.nativeEvent.key === "Backspace") {
      if (!otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
      else {
        const arr = otp.split("");
        arr[index] = "";
        setOtp(arr.join(""));
      }
    }
  };

  const topWaveH = SCREEN_H * 0.4;
  const bottomWaveH = SCREEN_H * 0.5;

  return (
    <View style={styles.root}>
      {/* Top wave */}
      <View pointerEvents="none" style={[styles.topWave, { height: topWaveH }]}>
        <Svg width="100%" height="100%" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="topYellowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#F59E0B" />
              <Stop offset="100%" stopColor="#FEC600" />
            </LinearGradient>
          </Defs>
          <Path fill="url(#topYellowGrad)" d="M -50,-50 L -50,280 C 200,100 800,100 1490,100 L 1490,-50 Z" />
        </Svg>
        <Image source={foodDish} style={[styles.dish, { top: topWaveH * 0.08, left: SCREEN_W * 0.05, width: SCREEN_H * 0.14, height: SCREEN_H * 0.14 }]} resizeMode="contain" />
      </View>
      {/* Bottom wave */}
      <View pointerEvents="none" style={[styles.bottomWave, { height: bottomWaveH }]}>
        <Svg width="100%" height="100%" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="botYellowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#FEC600" />
              <Stop offset="100%" stopColor="#EAB308" />
            </LinearGradient>
          </Defs>
          <Path fill="url(#botYellowGrad)" d="M -50,370 L -50,220 C 640,220 1240,220 1490,40 L 1490,370 Z" />
        </Svg>
        <Image source={foodDish2} style={[styles.dish, { bottom: bottomWaveH * 0.08, right: SCREEN_W * 0.05, width: SCREEN_H * 0.18, height: SCREEN_H * 0.18 }]} resizeMode="contain" />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.fill}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={[styles.card, step === 2 && { marginTop: -16 }]}>
            <View style={styles.logoWrap}>
              <Image source={brandLogo} style={styles.logo} resizeMode="contain" />
              <View style={styles.subRow}>
                {step === 1 ? (
                  <Txt weight={500} style={styles.subText}>
                    Login or signup with your phone number
                  </Txt>
                ) : (
                  <>
                    <Txt weight={500} style={styles.subText}>
                      We've sent a code to +91 {phoneNumber}
                    </Txt>
                    <Pressable onPress={handleEditNumber} style={styles.editBtn}>
                      <Pencil size={16} color={palette.black} strokeWidth={2.5} />
                    </Pressable>
                  </>
                )}
              </View>
            </View>

            {step === 1 ? (
              <View style={{ gap: 24 }}>
                <View style={styles.phoneWrap}>
                  <View style={styles.prefix}>
                    <Txt weight={600} style={styles.prefixText}>
                      +91
                    </Txt>
                  </View>
                  <TextInput
                    ref={phoneRef}
                    value={phoneNumber}
                    onChangeText={(t) => {
                      const v = t.replace(/\D/g, "").slice(0, 10);
                      setPhoneNumber(v);
                      sessionStore.setItem("draft_phone_login", v);
                    }}
                    keyboardType="phone-pad"
                    textContentType="telephoneNumber"
                    autoComplete="tel"
                    maxLength={10}
                    placeholder="Mobile number"
                    placeholderTextColor={palette.gray400}
                    style={styles.phoneInput}
                    returnKeyType="done"
                    onSubmitEditing={handleSendOTP}
                  />
                </View>
                <Pressable onPress={handleSendOTP} disabled={loading || phoneNumber.length < 10} style={({ pressed }) => [styles.primaryBtn, (loading || phoneNumber.length < 10) && { opacity: 0.5 }, pressed && { transform: [{ scale: 0.98 }] }]}>
                  {loading ? <Spinner color={palette.black} /> : <Txt weight={800} style={styles.primaryBtnText}>Log in</Txt>}
                </Pressable>
              </View>
            ) : (
              <View style={{ gap: 24 }}>
                {otpError ? (
                  <Txt weight={700} style={styles.otpError}>
                    {otpError}
                  </Txt>
                ) : null}
                <View style={styles.otpRow}>
                  {Array.from({ length: OTP_LENGTH }).map((_, index) => (
                    <TextInput
                      key={index}
                      ref={(el) => (otpRefs.current[index] = el)}
                      value={otp[index] || ""}
                      onChangeText={(t) => setOtpDigit(index, t)}
                      onKeyPress={(e) => onOtpKeyPress(index, e)}
                      keyboardType="number-pad"
                      textContentType="oneTimeCode"
                      autoComplete={index === 0 ? "sms-otp" : "off"}
                      editable={!loading && blockTimer <= 0}
                      maxLength={index === 0 ? OTP_LENGTH : 1}
                      placeholder="•"
                      placeholderTextColor={palette.gray400}
                      style={[styles.otpBox, blockTimer > 0 && styles.otpBoxBlocked]}
                      selectTextOnFocus
                    />
                  ))}
                </View>
                <View style={{ alignItems: "center" }}>
                  {blockTimer > 0 ? (
                    <Txt weight={800} style={styles.resendMuted}>
                      RESEND SMS
                    </Txt>
                  ) : resendTimer > 0 ? (
                    <Txt weight={800} style={styles.resendMuted}>
                      Resend SMS in <Txt weight={800} style={{ color: palette.slate800, fontSize: 12 }}>{formatResendTimer(resendTimer)}</Txt>
                    </Txt>
                  ) : (
                    <Pressable onPress={handleResendOTP}>
                      <Txt weight={800} style={{ color: palette.slate800, fontSize: 12 }}>
                        Didn't receive SMS? Resend SMS
                      </Txt>
                    </Pressable>
                  )}
                </View>
                <Pressable
                  onPress={() => handleVerifyOTP()}
                  disabled={loading || otp.length < OTP_LENGTH || blockTimer > 0}
                  style={({ pressed }) => [styles.primaryBtn, { marginTop: 4 }, (loading || otp.length < OTP_LENGTH || blockTimer > 0) && { opacity: 0.5 }, pressed && { transform: [{ scale: 0.98 }] }]}
                >
                  {loading ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Spinner color={palette.black} />
                      <Txt weight={800} style={styles.primaryBtnText}>Verifying...</Txt>
                    </View>
                  ) : (
                    <Txt weight={800} style={styles.primaryBtnText}>Verify & Continue</Txt>
                  )}
                </Pressable>
                {blockTimer > 0 ? (
                  <View style={styles.blockBox}>
                    <Txt weight={700} style={styles.blockTitle}>
                      TOO MANY FAILED ATTEMPTS
                    </Txt>
                    <Txt weight={700} style={styles.blockTime}>
                      Try again after {Math.floor((blockTimer - 1) / 60)}:{String((blockTimer - 1) % 60).padStart(2, "0")}
                    </Txt>
                  </View>
                ) : null}
              </View>
            )}

            {step === 1 && blockTimer <= 0 ? (
              <View style={{ marginTop: 20, alignItems: "center" }}>
                <Pressable
                  onPress={() => {
                    markSkippedLogin();
                    clearSessionData();
                    router.replace("/");
                  }}
                  style={({ pressed }) => [styles.skipBtn, pressed && { transform: [{ scale: 0.95 }] }]}
                >
                  <Txt weight={700} style={styles.skipText}>
                    Skip for now
                  </Txt>
                  <ArrowRight size={14} color={palette.yellow} strokeWidth={2.5} style={{ opacity: 0.8, marginLeft: 6 }} />
                </Pressable>
              </View>
            ) : null}

            {step === 1 ? (
              <View style={{ marginTop: 32, alignItems: "center" }}>
                <Txt weight={500} style={styles.footer}>
                  By continuing, you agree to our{"\n"}
                  <Txt weight={600} style={styles.footerLink} onPress={() => router.push({ pathname: "/profile/terms", params: { from: "/login" } })}>
                    TERMS
                  </Txt>
                  <Txt weight={700} style={styles.footer}>  •  </Txt>
                  <Txt weight={600} style={styles.footerLink} onPress={() => router.push({ pathname: "/profile/privacy", params: { from: "/login" } })}>
                    PRIVACY
                  </Txt>
                  <Txt weight={700} style={styles.footer}>  •  </Txt>
                  <Txt weight={600} style={styles.footerLink} onPress={() => router.push("/support-public")}>
                    SUPPORT
                  </Txt>
                </Txt>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Name modal */}
      <BottomSheet visible={showNameModal} position="center" dismissable={false} contentStyle={{ borderRadius: 32 }}>
        <View style={styles.nameHeader}>
          <Pressable onPress={handleEditNumber} style={styles.nameClose}>
            <X size={20} color={palette.black} />
          </Pressable>
          <View style={styles.nameIcon}>
            <User size={30} color={palette.black} />
          </View>
          <Txt weight={800} style={styles.nameTitle}>
            Almost there!
          </Txt>
          <Txt weight={500} style={styles.nameDesc}>
            We'd love to know your name to personalize your experience.
          </Txt>
        </View>
        <View style={{ padding: 24, paddingTop: 20, gap: 20 }}>
          <View>
            <Txt weight={600} style={{ fontSize: 13, color: palette.gray700, marginBottom: 8 }}>
              Full Name
            </Txt>
            <View style={styles.nameInputWrap}>
              <User size={20} color={palette.gray400} />
              <TextInput value={newName} onChangeText={(t) => setNewName(t.replace(/[^a-zA-Z\s]/g, ""))} placeholder="Enter your name" placeholderTextColor={palette.gray400} style={styles.nameInput} autoFocus returnKeyType="done" onSubmitEditing={handleNameSubmit} />
            </View>
          </View>
          <View style={{ gap: 10 }}>
            <Pressable onPress={handleNameSubmit} disabled={isUpdatingName} style={({ pressed }) => [styles.primaryBtn, { borderRadius: 16, height: 48 }, pressed && { transform: [{ scale: 0.98 }] }]}>
              {isUpdatingName ? <Spinner color={palette.black} /> : <Txt weight={700} style={{ color: palette.black, fontSize: 15 }}>Complete Profile</Txt>}
            </Pressable>
            {!pendingVerify ? (
              <Pressable
                onPress={() => {
                  setShowNameModal(false);
                  goHome();
                }}
                style={{ alignItems: "center", paddingVertical: 4 }}
              >
                <Txt weight={500} style={{ fontSize: 13, color: palette.gray400 }}>
                  Skip for now
                </Txt>
              </Pressable>
            ) : (
              <Txt weight={500} style={{ fontSize: 11, color: palette.gray400, textAlign: "center" }}>
                Name is required to complete signup.
              </Txt>
            )}
          </View>
        </View>
      </BottomSheet>

      {/* Restore account popup */}
      <BottomSheet visible={showRestorePopup} position="center" dismissable={false} contentStyle={{ borderRadius: 24, padding: 32, alignItems: "center" }}>
        <Pressable onPress={handleEditNumber} style={styles.restoreClose}>
          <X size={20} color={palette.gray400} />
        </Pressable>
        <View style={styles.restoreIcon}>
          <Phone size={40} color={palette.amber600} />
        </View>
        <Txt weight={700} style={{ fontSize: 24, color: palette.gray900, marginBottom: 12 }}>
          Account Found!
        </Txt>
        <Txt weight={400} style={{ fontSize: 14, color: palette.gray500, textAlign: "center", lineHeight: 22, marginBottom: 32 }}>
          A deleted account for <Txt weight={700} style={{ color: palette.gray900 }}>+91 {phoneNumber}</Txt> was found. Do you want to restore your old data or start fresh with a new account?
        </Txt>
        <View style={{ width: "100%", gap: 16 }}>
          <Pressable
            onPress={async () => {
              await processVerify(phoneNumber, otp, "restore");
              setShowRestorePopup(false);
            }}
            style={({ pressed }) => [styles.primaryBtn, { height: 56, borderRadius: 16 }, pressed && { transform: [{ scale: 0.98 }] }]}
          >
            <Txt weight={800} style={{ color: palette.black, fontSize: 15 }}>Restore My Account</Txt>
          </Pressable>
          <Pressable
            onPress={async () => {
              await processVerify(phoneNumber, otp, "new");
              setShowRestorePopup(false);
            }}
            style={({ pressed }) => [styles.outlineBtn, pressed && { transform: [{ scale: 0.98 }] }]}
          >
            <Txt weight={700} style={{ color: palette.gray700, fontSize: 15 }}>Create New Account</Txt>
          </Pressable>
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.white, overflow: "hidden" },
  fill: { flex: 1 },
  topWave: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 0 },
  bottomWave: { position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 0 },
  dish: { position: "absolute" },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingTop: 24, paddingBottom: 80 },
  card: { width: "100%", maxWidth: 384, alignSelf: "center" },
  logoWrap: { alignItems: "center", marginBottom: 24, marginTop: 4 },
  logo: { height: 128, width: 200 },
  subRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 4 },
  subText: { fontSize: 14, color: palette.gray500 },
  editBtn: { padding: 6, marginLeft: 4, backgroundColor: palette.yellow, borderRadius: 10 },
  phoneWrap: { flexDirection: "row", alignItems: "center", height: 54, borderRadius: 999, borderWidth: 2, borderColor: palette.gray300, backgroundColor: palette.gray50, paddingLeft: 24, paddingRight: 24 },
  prefix: { paddingRight: 12, borderRightWidth: 1, borderRightColor: palette.gray300, marginRight: 12 },
  prefixText: { fontSize: 14, color: palette.gray600 },
  phoneInput: { flex: 1, fontFamily: fonts.medium, fontSize: 16, color: palette.gray900, paddingVertical: 0 },
  primaryBtn: { height: 52, borderRadius: 999, backgroundColor: palette.yellow, alignItems: "center", justifyContent: "center", shadowColor: "#FEC600", shadowOpacity: 0.35, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  primaryBtnText: { color: palette.black, fontSize: 16 },
  otpError: { color: palette.red600, fontSize: 15, textAlign: "center", letterSpacing: 0.5, marginTop: -28, marginBottom: -8 },
  otpRow: { flexDirection: "row", justifyContent: "center", gap: 8 },
  otpBox: { width: 44, height: 52, textAlign: "center", fontSize: 22, fontFamily: fonts.extrabold, backgroundColor: palette.gray50, borderWidth: 2, borderColor: palette.gray300, borderRadius: 16, color: palette.gray900 },
  otpBoxBlocked: { opacity: 0.5, borderColor: palette.red400, backgroundColor: palette.red50, color: "#991b1b" },
  resendMuted: { fontSize: 12, color: palette.gray400, letterSpacing: 0.5 },
  blockBox: { alignSelf: "center", paddingHorizontal: 24, paddingVertical: 10, backgroundColor: palette.red50, borderRadius: 12, borderWidth: 1, borderColor: palette.red100, marginTop: 4, alignItems: "center" },
  blockTitle: { fontSize: 11, color: palette.red600, letterSpacing: 1 },
  blockTime: { fontSize: 14, color: palette.red600 },
  skipBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 32, paddingVertical: 8, backgroundColor: palette.neutral900, borderRadius: 999, elevation: 4 },
  skipText: { fontSize: 13, color: palette.yellow, letterSpacing: 0.5 },
  footer: { fontSize: 11, color: "rgba(156,163,175,0.8)", textAlign: "center", lineHeight: 18, maxWidth: 320 },
  footerLink: { fontSize: 11, color: palette.gray400, letterSpacing: 1 },
  nameHeader: { backgroundColor: palette.yellow, paddingHorizontal: 24, paddingVertical: 24, alignItems: "center" },
  nameClose: { position: "absolute", top: 16, right: 16, padding: 8, backgroundColor: "rgba(0,0,0,0.1)", borderRadius: 12 },
  nameIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.4)", alignItems: "center", justifyContent: "center", marginBottom: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.6)" },
  nameTitle: { fontSize: 20, color: palette.black, marginBottom: 6 },
  nameDesc: { fontSize: 13, color: "rgba(0,0,0,0.85)", textAlign: "center", maxWidth: 300, lineHeight: 20 },
  nameInputWrap: { flexDirection: "row", alignItems: "center", height: 48, borderRadius: 16, borderWidth: 1, borderColor: palette.gray200, backgroundColor: "rgba(249,250,251,0.8)", paddingHorizontal: 14, gap: 10 },
  nameInput: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: palette.gray900, paddingVertical: 0 },
  restoreClose: { position: "absolute", top: 16, right: 16, padding: 8 },
  restoreIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(254,198,0,0.2)", alignItems: "center", justifyContent: "center", marginBottom: 24 },
  outlineBtn: { height: 56, borderRadius: 16, borderWidth: 2, borderColor: palette.gray200, alignItems: "center", justifyContent: "center" },
});
