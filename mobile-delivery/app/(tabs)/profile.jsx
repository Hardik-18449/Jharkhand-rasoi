/**
 * Profile tab — port of DeliveryV2/pages/ProfileV2.jsx: rider card (photo, name, phone, partner id, rating, trips, on-time),
 * menu (personal / vehicle / bank / documents → web, trip history, notifications, support, terms, privacy), log out.
 * Profile editing screens (ProfileDetailsV2 / ProfileBankV2 / ProfileDocsV2) open the web dashboard (deviation D3).
 */
import React, { useEffect, useState } from "react";
import { Image, Linking, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { User, Bike, Building2, FileCheck, History, Bell, LifeBuoy, FileText, Shield, LogOut, ChevronRight, ExternalLink, Star, Package, Clock } from "lucide-react-native";
import Txt from "../../src/components/ui/Txt";
import Spinner from "../../src/components/ui/Spinner";
import { deliveryAPI } from "../../src/api";
import { clearModuleAuth, getModuleFcmToken } from "../../src/auth/session";
import { useDeliveryStore } from "../../src/delivery/store";
import { stopTracking } from "../../src/delivery/locationTracking";
import { BACKEND_ORIGIN } from "../../src/config";
import { toast } from "../../src/utils/toast";
import { palette, dv } from "../../src/theme";

const avatar = require("../../assets/images/delivery_avatar.jpg");
const WEB = `${BACKEND_ORIGIN}/food/delivery`;

export default function ProfileTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    deliveryAPI
      .getProfile()
      .then((r) => r?.data?.success && setProfile(r.data.data?.profile || null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    if (busy) return;
    setConfirm(false);
    setBusy(true);
    try {
      useDeliveryStore.actions.setOnline(false);
      await stopTracking();
      await deliveryAPI.updateOnlineStatus(false).catch(() => {});
      const fcm = getModuleFcmToken();
      if (fcm) await deliveryAPI.removePushDevice({ fcmToken: fcm, pushPlatform: "mobile" }).catch(() => {});
      await deliveryAPI.logout(null, fcm, "mobile").catch(() => {});
    } finally {
      clearModuleAuth();
      useDeliveryStore.actions.clearActiveOrder();
      useDeliveryStore.actions.setAcceptedOrders([]);
      useDeliveryStore.actions.setIncomingOrders([]);
      toast.success("Logged out successfully");
      setBusy(false);
      router.replace("/login");
    }
  };

  const partnerId = profile?._id ? `JR-${String(profile._id).slice(-6).toUpperCase()}` : profile?.id ? `JR-${String(profile.id).slice(-6).toUpperCase()}` : "JR-DP";
  const photo = profile?.profileImage?.url || (typeof profile?.profileImage === "string" ? profile.profileImage : null) || profile?.profilePhoto || profile?.documents?.photo;
  const rows = [
    { label: "Personal Information", sub: profile?.phone || "", Icon: User, web: "/profile/details" },
    { label: "Vehicle Details", sub: profile?.vehicleType ? `${String(profile.vehicleType).toUpperCase()} • ${profile?.vehicleNumber || "Registered"}` : "Motorcycle / Electric", Icon: Bike, web: "/profile/details" },
    { label: "Bank Details", sub: "Payout account", Icon: Building2, web: "/profile/bank" },
    { label: "Document Verification", sub: "Verified", Icon: FileCheck, web: "/profile/documents" },
    { label: "Trip History", sub: "Your delivery milestones", Icon: History, route: "/history" },
    { label: "Notifications", sub: "Admin updates & alerts", Icon: Bell, route: "/notifications" },
    { label: "Help & Support", sub: "Raise a ticket", Icon: LifeBuoy, web: "/help/tickets" },
    { label: "Rider ID Card", sub: "Show at restaurants", Icon: FileText, web: "/help/id-card" },
    { label: "Terms & Conditions", sub: "Delivery terms and legal notice", Icon: FileText, route: "/terms" },
    { label: "Privacy Policy", sub: "How we use your data", Icon: Shield, route: "/privacy" },
  ];

  if (loading) return <Spinner full />;
  return (
    <View style={{ flex: 1, backgroundColor: "#F8F9FB" }}>
      <View style={[styles.top, { paddingTop: insets.top + 10 }]}>
        <Txt weight={900} style={{ fontSize: 22, color: palette.gray900 }}>Profile</Txt>
      </View>
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 100, gap: 12 }}>
        <View style={styles.card}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <Image source={photo ? { uri: photo } : avatar} style={styles.photo} />
            <View style={{ flex: 1 }}>
              <Txt weight={900} style={{ fontSize: 18, color: palette.gray900 }}>{profile?.name || "Delivery Partner"}</Txt>
              <Txt style={{ fontSize: 13, color: palette.gray500 }}>{profile?.phone || ""}</Txt>
              <Txt weight={800} style={styles.idTag}>{partnerId}</Txt>
            </View>
          </View>
          <View style={styles.stats}>
            <View style={styles.statBox}>
              <Star size={16} color="#f59e0b" fill="#f59e0b" />
              <Txt weight={900} style={styles.statValue}>{profile?.rating ? Number(profile.rating).toFixed(1) : "—"}</Txt>
              <Txt weight={700} style={styles.statLabel}>RATING</Txt>
            </View>
            <View style={styles.statBox}>
              <Package size={16} color={dv.accent} />
              <Txt weight={900} style={styles.statValue}>{profile?.deliveredOrdersCount ?? profile?.totalOrders ?? 0}</Txt>
              <Txt weight={700} style={styles.statLabel}>TRIPS</Txt>
            </View>
            <View style={styles.statBox}>
              <Clock size={16} color={palette.green600} />
              <Txt weight={900} style={styles.statValue}>{profile?.onTimeDeliveryRate != null ? `${Math.round(profile.onTimeDeliveryRate)}%` : "—"}</Txt>
              <Txt weight={700} style={styles.statLabel}>ON TIME</Txt>
            </View>
          </View>
        </View>

        <View style={styles.menu}>
          {rows.map((r, i) => (
            <Pressable key={r.label} onPress={() => (r.route ? router.push(r.route) : Linking.openURL(`${WEB}${r.web}`))} style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && { backgroundColor: palette.gray50 }]}>
              <View style={styles.rowIcon}>
                <r.Icon size={18} color={dv.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt weight={700} style={{ fontSize: 14, color: palette.gray900 }}>{r.label}</Txt>
                {r.sub ? <Txt numberOfLines={1} style={{ fontSize: 11, color: palette.gray500 }}>{r.sub}</Txt> : null}
              </View>
              {r.web ? (
                <View style={styles.webTag}>
                  <ExternalLink size={11} color={palette.gray500} />
                  <Txt weight={600} style={{ fontSize: 10, color: palette.gray500 }}>Web</Txt>
                </View>
              ) : (
                <ChevronRight size={16} color={palette.gray400} />
              )}
            </Pressable>
          ))}
        </View>

        <Pressable onPress={() => setConfirm(true)} disabled={busy} style={styles.logout}>
          {busy ? <Spinner color={palette.red600} /> : <LogOut size={18} color={palette.red600} />}
          <Txt weight={800} style={{ fontSize: 14, color: palette.red600 }}>Log Out</Txt>
        </Pressable>
        <Txt style={{ textAlign: "center", fontSize: 11, color: palette.gray400 }}>Jharkhand Rasoi Delivery • v1.0.0</Txt>
      </ScrollView>

      <Modal visible={confirm} transparent animationType="fade" onRequestClose={() => setConfirm(false)}>
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <Txt weight={800} style={{ fontSize: 18, color: palette.gray900 }}>Confirm Log Out</Txt>
            <Txt style={{ fontSize: 14, color: palette.gray600, marginTop: 8 }}>You will go offline and stop receiving orders on this phone.</Txt>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
              <Pressable onPress={() => setConfirm(false)} style={[styles.dBtn, { backgroundColor: palette.gray100 }]}>
                <Txt weight={700} style={{ color: palette.gray700 }}>Cancel</Txt>
              </Pressable>
              <Pressable onPress={logout} style={[styles.dBtn, { backgroundColor: palette.red600 }]}>
                <Txt weight={700} style={{ color: palette.white }}>Log Out</Txt>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { backgroundColor: palette.white, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: palette.gray100 },
  card: { backgroundColor: palette.white, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: palette.gray100 },
  photo: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: dv.primary },
  idTag: { alignSelf: "flex-start", marginTop: 6, fontSize: 11, color: dv.accent, backgroundColor: dv.primarySoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: "hidden" },
  stats: { flexDirection: "row", gap: 10, marginTop: 16 },
  statBox: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 14, backgroundColor: palette.gray50 },
  statValue: { fontSize: 17, color: palette.gray900, marginTop: 4 },
  statLabel: { fontSize: 9, color: palette.gray400, letterSpacing: 1 },
  menu: { backgroundColor: palette.white, borderRadius: 22, borderWidth: 1, borderColor: palette.gray100, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  rowBorder: { borderTopWidth: 1, borderTopColor: palette.gray50 },
  rowIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: dv.primarySoft, alignItems: "center", justifyContent: "center" },
  webTag: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: palette.gray100 },
  logout: { height: 52, borderRadius: 18, borderWidth: 1, borderColor: "#fecaca", backgroundColor: palette.red50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 },
  dialog: { backgroundColor: palette.white, borderRadius: 20, padding: 20 },
  dBtn: { flex: 1, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
