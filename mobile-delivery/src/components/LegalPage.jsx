/** Shared port of pages/user/profile/{Terms,Privacy,Refund,Shipping,Cancellation}.jsx (identical layout, different endpoint/title/icon). */
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import Txt from "./ui/Txt";
import Screen from "./ui/Screen";
import HtmlContent from "./HtmlContent";
import { publicAPI } from "../api";
import { palette } from "../theme";

export default function LegalPage({ pageKey, defaultTitle, subtitle = "Jharkhand Rasoi Policy", EmptyIcon }) {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ title: defaultTitle, content: "" });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const r = await publicAPI.getPage(pageKey);
        if (alive && r?.data?.success) setData(r.data.data || { title: defaultTitle, content: "" });
      } catch {
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [pageKey, defaultTitle]);

  const handleBack = () => {
    if (returnTo) router.replace(String(returnTo));
    else if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  if (loading) {
    return (
      <Screen bg={palette.white}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16 }}>
          <ActivityIndicator size="large" color="#CB202D" />
          <Txt weight={700} style={{ fontSize: 12, color: palette.gray500, letterSpacing: 2 }}>LOADING...</Txt>
        </View>
      </Screen>
    );
  }
  const now = new Date();
  return (
    <Screen bg={palette.white}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.back}><ArrowLeft size={24} color={palette.gray900} /></Pressable>
        <View style={{ flex: 1 }}>
          <Txt weight={900} numberOfLines={1} style={{ fontSize: 20, color: palette.gray900, letterSpacing: -0.3 }}>{data.title || defaultTitle}</Txt>
          <Txt weight={700} style={{ fontSize: 10, color: palette.gray400, letterSpacing: 2, marginTop: 4 }}>{subtitle.toUpperCase()}</Txt>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 32, paddingBottom: 40 }}>
        <View style={styles.card}>
          {data.content ? (
            <HtmlContent html={data.content} />
          ) : (
            <View style={{ alignItems: "center", paddingVertical: 80 }}>
              <EmptyIcon size={64} color={palette.gray100} />
              <Txt weight={500} style={{ marginTop: 16, fontSize: 14, color: palette.gray400 }}>No content available at the moment.</Txt>
            </View>
          )}
        </View>
        <Txt weight={900} style={{ textAlign: "center", marginTop: 40, fontSize: 10, color: palette.gray400, letterSpacing: 2, lineHeight: 18 }}>
          LAST UPDATED: {now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }).toUpperCase()}
          {"\n"}© {now.getFullYear()} JHARKHAND RASOI. ALL RIGHTS RESERVED.
        </Txt>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { height: 64, flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: palette.gray100, backgroundColor: "rgba(255,255,255,0.95)" },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: palette.white, borderRadius: 32, padding: 24, borderWidth: 1, borderColor: palette.gray50, elevation: 1 },
});
