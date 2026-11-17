/** Port of pages/user/profile/About.jsx */
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, ArrowRight, Heart, Users, Shield, Clock, Star, Award, FileText, Lock, Receipt, Truck, XCircle } from "lucide-react-native";
import Txt from "../../src/components/ui/Txt";
import Screen from "../../src/components/ui/Screen";
import AppImage from "../../src/components/ui/AppImage";
import RequireAuth from "../../src/components/RequireAuth";
import { LinearGradient } from "../../src/components/ui/LinearGradient";
import { publicAPI } from "../../src/api";
import { useCompanyName } from "../../src/hooks/useCompanyName";
import { getCachedSettings, loadBusinessSettings } from "../../src/utils/businessSettings";
import { addAppListener } from "../../src/utils/events";
import { palette } from "../../src/theme";

const iconMap = { Heart, Users, Shield, Clock, Star, Award };
// Tailwind classes stored by admin (e.g. "bg-red-100", "text-red-600") → colours
const TW = { red: ["#fee2e2", "#dc2626"], orange: ["#ffedd5", "#ea580c"], amber: ["#fef3c7", "#d97706"], yellow: ["#fef9c3", "#ca8a04"], green: ["#dcfce7", "#16a34a"], emerald: ["#d1fae5", "#059669"], blue: ["#dbeafe", "#2563eb"], indigo: ["#e0e7ff", "#4f46e5"], purple: ["#f3e8ff", "#9333ea"], pink: ["#fce7f3", "#db2777"], gray: ["#f3f4f6", "#4b5563"] };
const twColor = (cls, idx) => {
  const m = String(cls || "").match(/(?:bg|text)-([a-z]+)-/);
  return (TW[m?.[1]] || TW.orange)[idx];
};
const LEGAL = [
  ["/profile/terms", FileText, "Terms and Conditions", "Read our terms and conditions"],
  ["/profile/privacy", Lock, "Privacy Policy", "Learn how we protect your data"],
  ["/profile/refund", Receipt, "Refund Policy", "Read our refund terms and conditions"],
  ["/profile/shipping", Truck, "Shipping Policy", "Learn about our shipping terms"],
  ["/profile/cancellation", XCircle, "Cancellation Policy", "Read our cancellation terms and conditions"],
];

function AboutScreen() {
  const router = useRouter();
  const companyName = useCompanyName();
  const [loading, setLoading] = useState(true);
  const [logoUrl, setLogoUrl] = useState(null);
  const [aboutData, setAboutData] = useState({ appName: "", version: "", description: "", features: [] });

  useEffect(() => {
    (async () => {
      try {
        const r = await publicAPI.getPage("about");
        if (r?.data?.success) setAboutData(r.data.data || {});
      } catch {
      } finally {
        setLoading(false);
      }
    })();
    const cached = getCachedSettings();
    if (cached?.logo?.url) setLogoUrl(cached.logo.url);
    else loadBusinessSettings().then((s) => s?.logo?.url && setLogoUrl(s.logo.url));
    return addAppListener("businessSettingsUpdated", () => {
      const c = getCachedSettings();
      if (c?.logo?.url) setLogoUrl(c.logo.url);
    });
  }, []);

  if (loading) {
    return (
      <Screen bg={palette.gray50}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={palette.gray600} />
          <Txt weight={400} style={{ marginTop: 16, color: palette.gray600 }}>Loading...</Txt>
        </View>
      </Screen>
    );
  }
  return (
    <Screen bg={palette.gray50}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/profile"))} style={{ width: 36, height: 36, justifyContent: "center" }}>
            <ArrowLeft size={20} color={palette.gray900} />
          </Pressable>
          <Txt weight={700} style={{ fontSize: 24, color: palette.gray900 }}>About</Txt>
        </View>

        <View style={[styles.card, { borderRadius: 16, overflow: "hidden", marginBottom: 24, padding: 0 }]}>
          <LinearGradient colors={["#fff7ed", "#fffbeb"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 32, alignItems: "center" }}>
            <View style={styles.logoWrap}>
              {logoUrl ? (
                <AppImage src={logoUrl} style={{ width: 64, height: 64, borderRadius: 32 }} contentFit="contain" width={200} />
              ) : (
                <Txt weight={700} style={{ fontSize: 24, color: palette.amber600 }}>{(aboutData.appName || companyName || "T").charAt(0).toUpperCase()}</Txt>
              )}
            </View>
            <Txt weight={700} style={{ fontSize: 30, color: palette.gray900, marginBottom: 8, textAlign: "center" }}>{aboutData.appName || companyName || "About"}</Txt>
            <Txt weight={400} style={{ fontSize: 14, color: palette.gray600, marginBottom: 16 }}>{aboutData.version ? `Version ${aboutData.version}` : " "}</Txt>
            <Txt weight={400} style={{ fontSize: 16, color: palette.gray700, lineHeight: 26, textAlign: "center" }}>{aboutData.description || "This page will appear once the admin adds About content."}</Txt>
          </LinearGradient>
        </View>

        {Array.isArray(aboutData.features) && aboutData.features.length > 0 ? (
          <View style={{ gap: 16, marginBottom: 24 }}>
            {aboutData.features.map((f, i) => {
              const Icon = iconMap[f.icon] || Heart;
              return (
                <View key={i} style={[styles.card, { flexDirection: "row", gap: 16, padding: 20 }]}>
                  <View style={{ backgroundColor: twColor(f.bgColor, 0), borderRadius: 12, padding: 12, alignSelf: "flex-start" }}><Icon size={24} color={twColor(f.color, 1)} /></View>
                  <View style={{ flex: 1 }}>
                    <Txt weight={600} style={{ fontSize: 18, color: palette.gray900, marginBottom: 8 }}>{f.title}</Txt>
                    <Txt weight={400} style={{ fontSize: 14, color: palette.gray600, lineHeight: 22 }}>{f.description}</Txt>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={[styles.card, { padding: 20 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <FileText size={20} color={palette.gray600} />
            <Txt weight={600} style={{ fontSize: 18, color: palette.gray900 }}>Legal Information</Txt>
          </View>
          <View style={{ gap: 12 }}>
            {LEGAL.map(([href, Icon, t, d]) => (
              <Pressable key={href} onPress={() => router.push(href)} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 8 }}>
                <View style={{ backgroundColor: palette.gray100, borderRadius: 8, padding: 8 }}><Icon size={20} color={palette.gray600} /></View>
                <View style={{ flex: 1 }}>
                  <Txt weight={500} style={{ fontSize: 16, color: palette.gray900 }}>{t}</Txt>
                  <Txt weight={400} style={{ fontSize: 14, color: palette.gray500 }}>{d}</Txt>
                </View>
                <ArrowRight size={20} color={palette.gray400} />
              </Pressable>
            ))}
          </View>
        </View>

        <Txt weight={400} style={{ textAlign: "center", marginTop: 32, fontSize: 14, color: palette.gray500 }}>© {new Date().getFullYear()} {companyName}. All rights reserved.</Txt>
      </ScrollView>
    </Screen>
  );
}

export default function AboutRoute() {
  return (
    <RequireAuth>
      <AboutScreen />
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: palette.white, borderRadius: 12, elevation: 2 },
  logoWrap: { backgroundColor: palette.white, borderRadius: 999, padding: 16, minHeight: 96, minWidth: 96, alignItems: "center", justifyContent: "center", marginBottom: 24, elevation: 8, shadowColor: palette.yellow, shadowOpacity: 0.4, shadowRadius: 20 },
});
