/** Port of components/restaurant/GlobalPickupOtpModal.jsx — shown app-wide when a rider requests the pickup OTP. */
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import BottomSheet from "./ui/BottomSheet";
import Txt from "./ui/Txt";
import { useRestaurantNotifications } from "../context/RestaurantNotificationContext";
import { palette, rt } from "../theme";

export default function PickupOtpModal() {
  const { pickupOtpReveal, clearPickupOtpReveal } = useRestaurantNotifications();
  return (
    <BottomSheet visible={Boolean(pickupOtpReveal)} onClose={clearPickupOtpReveal} position="center" dismissable={false}>
      <View style={styles.body}>
        <View style={styles.icon}>
          <Txt style={{ fontSize: 26 }}>🛵</Txt>
        </View>
        <Txt weight={900} style={styles.kicker}>DELIVERY PARTNER ARRIVED</Txt>
        <Txt weight={500} style={styles.sub}>Share this OTP with the delivery partner for Order #{pickupOtpReveal?.orderId || ""}</Txt>
        <View style={styles.otpBox}>
          <Txt weight={700} style={styles.otpLabel}>PICKUP VERIFICATION OTP</Txt>
          <Txt weight={900} style={styles.otp}>{pickupOtpReveal?.otp}</Txt>
        </View>
        <Txt weight={500} style={styles.hint}>Tell this code to the delivery partner so they can complete the pickup.</Txt>
        <Pressable onPress={clearPickupOtpReveal} style={styles.btn}>
          <Txt weight={700} style={{ color: palette.white, fontSize: 14 }}>Got it</Txt>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { padding: 24, alignItems: "center" },
  icon: { width: 56, height: 56, borderRadius: 28, backgroundColor: palette.orange100, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  kicker: { fontSize: 12, color: palette.orange600, letterSpacing: 2, marginBottom: 4 },
  sub: { fontSize: 13, color: palette.gray500, textAlign: "center", marginBottom: 20 },
  otpBox: { width: "100%", backgroundColor: "#ecfdf5", borderWidth: 2, borderColor: "#a7f3d0", borderRadius: 16, paddingVertical: 16, alignItems: "center", marginBottom: 20 },
  otpLabel: { fontSize: 10, color: "#059669", letterSpacing: 1, marginBottom: 4 },
  otp: { fontSize: 36, color: "#065f46", letterSpacing: 10 },
  hint: { fontSize: 11, color: palette.gray400, textAlign: "center", marginBottom: 16 },
  btn: { width: "100%", paddingVertical: 12, borderRadius: 12, backgroundColor: rt.primary, alignItems: "center" },
});
