/**
 * Port of modules/auth/pages/PublicSupport.jsx — reached from the Login "SUPPORT" link
 * (the web link targets a non-existent route; this is the closest public support page).
 * Deviation: the web hard-codes another brand's fallback contact/footer ("switcheats…", "8919142335", "© Switcheats");
 * native shows only the business-settings contact and the company name. See CONVERSION_CHECKLIST.md.
 */
import React, { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, Mail, Phone, MessageSquare, Clock, ShieldCheck } from "lucide-react-native";
import Txt from "../src/components/ui/Txt";
import Screen from "../src/components/ui/Screen";
import { adminAPI } from "../src/api";
import { useCompanyName } from "../src/hooks/useCompanyName";
import { palette } from "../src/theme";

const RED = "#DC2626";
const FAQS = [
  ["How to update menu prices?", "You can update prices instantly through the 'Menu Management' section in your portal."],
  ["Delay in payout settlement?", "Payouts are settled within 48 hours of order completion. Contact support for delays exceeding 3 days."],
  ["Technical issue with tablet?", "Restart the app and check internet connectivity. If issue persists, call our technical helpline."],
];

export default function PublicSupportScreen() {
  const router = useRouter();
  const companyName = useCompanyName();
  const [s, setS] = useState({ supportEmail: "", supportPhone: "", supportHours: "Merchant support is available from 8 AM to 12 AM, 7 days a week." });

  useEffect(() => {
    adminAPI
      .getPublicBusinessSettings()
      .then((r) => {
        const d = r?.data?.data || r?.data;
        if (d) setS((p) => ({ supportEmail: d.supportEmail || "", supportPhone: d.supportPhone || "", supportHours: d.supportHours || p.supportHours }));
      })
      .catch(() => null);
  }, []);
  const tel = String(s.supportPhone || "").replace(/[^0-9+]/g, "");

  const Card = ({ Icon, title, value, action, onPress }) => (
    <View style={styles.contact}>
      <View style={styles.iconBox}><Icon size={20} color={RED} /></View>
      <Txt weight={700} style={{ fontSize: 11, color: palette.gray900, letterSpacing: 2, marginBottom: 8 }}>{title}</Txt>
      <Pressable disabled={!value} onPress={onPress}><Txt weight={500} style={{ fontSize: 13, color: palette.gray600, marginBottom: 12 }}>{value || "Not available"}</Txt></Pressable>
      {value ? (
        <Pressable onPress={onPress}><Txt weight={700} style={{ fontSize: 10, color: RED, letterSpacing: 2 }}>{action}</Txt></Pressable>
      ) : null}
    </View>
  );

  return (
    <Screen bg="#F8F9FA">
      <View style={styles.header}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/login"))} style={{ padding: 4, borderRadius: 999 }}><ArrowLeft size={20} color={palette.gray800} /></Pressable>
        <View>
          <Txt weight={700} style={{ fontSize: 17, color: palette.gray900 }}>Help & Support</Txt>
          <Txt weight={700} style={{ fontSize: 10, color: palette.gray400, letterSpacing: 1, marginTop: 2 }}>RESTAURANT PARTNER INFORMATION</Txt>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingVertical: 24 }}>
        <View style={{ gap: 16, marginBottom: 32 }}>
          <Card Icon={Mail} title="MERCHANT SUPPORT" value={s.supportEmail} action="EMAIL SUPPORT" onPress={() => Linking.openURL(`mailto:${s.supportEmail}`).catch(() => {})} />
          <Card Icon={Phone} title="MERCHANT HELPLINE" value={s.supportPhone} action="INSTANT CALL" onPress={() => Linking.openURL(`tel:${tel}`).catch(() => {})} />
        </View>
        <View style={{ marginBottom: 32 }}>
          <Txt weight={700} style={{ fontSize: 17, color: palette.gray900, marginBottom: 24 }}>Merchant FAQs</Txt>
          <View style={{ gap: 24 }}>
            {FAQS.map(([q, a]) => (
              <View key={q} style={{ flexDirection: "row", gap: 12 }}>
                <MessageSquare size={18} color={RED} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Txt weight={700} style={{ fontSize: 13, color: palette.gray900, marginBottom: 4 }}>{q}</Txt>
                  <Txt weight={400} style={{ fontSize: 12, color: palette.gray500, lineHeight: 18 }}>{a}</Txt>
                </View>
              </View>
            ))}
          </View>
        </View>
        <View style={{ gap: 12, marginBottom: 48 }}>
          {[
            [Clock, "BUSINESS HOURS", s.supportHours],
            [ShieldCheck, "SECURE SUPPORT", "Our support staff will never ask for your password or financial credentials."],
          ].map(([Icon, t, d]) => (
            <View key={t} style={styles.info}>
              <Icon size={18} color={RED} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Txt weight={700} style={{ fontSize: 10, color: palette.gray900, letterSpacing: 2, marginBottom: 4 }}>{t}</Txt>
                <Txt weight={400} style={{ fontSize: 11, color: palette.gray500, lineHeight: 16 }}>{d}</Txt>
              </View>
            </View>
          ))}
        </View>
        <View style={{ alignItems: "center", paddingBottom: 32 }}>
          <Txt weight={700} style={{ fontSize: 9, color: palette.gray400, letterSpacing: 2 }}>© {new Date().getFullYear()} {String(companyName || "").toUpperCase()}. ALL RIGHTS RESERVED.</Txt>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 16, backgroundColor: palette.white, borderBottomWidth: 1, borderColor: palette.gray100 },
  contact: { backgroundColor: palette.white, borderRadius: 16, padding: 24, alignItems: "center", borderWidth: 1, borderColor: palette.gray50, elevation: 1 },
  iconBox: { width: 48, height: 48, borderWidth: 2, borderColor: RED, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 16, backgroundColor: "rgba(254,242,242,0.5)" },
  info: { backgroundColor: palette.white, borderRadius: 12, padding: 16, flexDirection: "row", gap: 16, borderWidth: 1, borderColor: palette.gray50, elevation: 1 },
});
