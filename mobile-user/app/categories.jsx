/** Port of pages/user/Categories.jsx (4-column grid at phone width). */
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, Search, Grid2x2 } from "lucide-react-native";
import Txt from "../src/components/ui/Txt";
import Screen from "../src/components/ui/Screen";
import Skeleton from "../src/components/ui/Skeleton";
import AppImage from "../src/components/ui/AppImage";
import { getPublicCategories } from "../src/api";
import { useAppLocation } from "../src/context/LocationProvider";
import { foodImages } from "../src/constants/images";
import { BACKEND_ORIGIN } from "../src/config";
import { palette, fonts } from "../src/theme";

const normalizeImageUrl = (u) => {
  if (typeof u !== "string") return "";
  const t = u.trim();
  if (!t) return "";
  if (/^(data|blob):/i.test(t)) return t;
  const n = t.replace(/\\/g, "/").replace(/^(https?):\/(?!\/)/i, "$1://").replace(/^(https?:\/\/)(https?:\/\/)/i, "$1");
  if (/^(https?:)?\/\//i.test(n)) return n;
  return n.startsWith("/") ? `${BACKEND_ORIGIN}${n}` : `${BACKEND_ORIGIN}/${n.replace(/^\.?\/*/, "")}`;
};

export default function CategoriesScreen() {
  const router = useRouter();
  const { zoneId } = useAppLocation();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await getPublicCategories(zoneId || null);
        const list = data?.categories || (Array.isArray(data) ? data : []);
        if (Array.isArray(list)) {
          setCategories(
            list.map((c, i) => ({
              id: String(c?.id || c?._id || c?.slug || i),
              name: c?.name || "",
              slug: c?.slug || String(c?.name || "").toLowerCase().replace(/\s+/g, "-"),
              image: normalizeImageUrl(c?.image || c?.imageUrl) || foodImages[i % foodImages.length],
            })),
          );
        }
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, [zoneId]);

  const filtered = categories.filter((c) => (c.name || "").toLowerCase().includes(q.toLowerCase()));

  return (
    <Screen bg={palette.white}>
      <View style={styles.header}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={{ padding: 8, borderRadius: 999 }}><ArrowLeft size={24} color="#262626" /></Pressable>
        <View style={{ flex: 1 }}>
          <Txt weight={700} style={{ fontSize: 20, color: "#171717" }}>All Categories</Txt>
          <Txt weight={700} style={{ fontSize: 10, color: "#737373", letterSpacing: 2, marginTop: 4 }}>WHAT'S ON YOUR MIND?</Txt>
        </View>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ paddingHorizontal: 16, paddingVertical: 24 }}>
          <View style={{ justifyContent: "center" }}>
            <Search size={20} color="#a3a3a3" style={{ position: "absolute", left: 16, zIndex: 1 }} />
            <TextInput value={q} onChangeText={setQ} placeholder="Search specialties, cuisines..." placeholderTextColor="#a3a3a3" style={styles.search} />
          </View>
        </View>
        <View style={{ paddingHorizontal: 16 }}>
          <View style={styles.grid}>
            {loading
              ? Array.from({ length: 12 }).map((_, i) => (
                  <View key={i} style={styles.cell}>
                    <Skeleton style={{ width: "100%", aspectRatio: 1 }} radius={999} color="#f5f5f5" />
                    <Skeleton height={8} width={48} radius={4} color="#f5f5f5" style={{ marginTop: 12 }} />
                  </View>
                ))
              : filtered.map((c) => (
                  <Pressable key={c.id} onPress={() => router.push(`/category/${c.slug}`)} style={styles.cell}>
                    <View style={styles.circle}>
                      <AppImage src={c.image} style={StyleSheet.absoluteFill} width={200} />
                    </View>
                    <Txt weight={700} style={{ fontSize: 11, color: "#404040", textAlign: "center", marginTop: 10, lineHeight: 14 }}>{c.name}</Txt>
                  </Pressable>
                ))}
          </View>
          {!loading && filtered.length === 0 ? (
            <View style={{ paddingVertical: 80, alignItems: "center", paddingHorizontal: 24 }}>
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: "#fafafa", alignItems: "center", justifyContent: "center", marginBottom: 24 }}><Grid2x2 size={40} color="#d4d4d4" /></View>
              <Txt weight={700} style={{ fontSize: 18, color: "#171717" }}>No results found</Txt>
              <Txt weight={400} style={{ fontSize: 14, color: "#737373", marginTop: 8, maxWidth: 240, textAlign: "center" }}>We couldn't find any categories matching your search. Try another keyword!</Txt>
              <Pressable onPress={() => setQ("")} style={styles.showAll}><Txt weight={700} style={{ fontSize: 14, color: palette.white }}>Show all categories</Txt></Pressable>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderColor: "#f5f5f5", backgroundColor: "rgba(255,255,255,0.95)" },
  search: { paddingLeft: 48, paddingRight: 16, paddingVertical: 16, backgroundColor: "#fafafa", borderWidth: 1, borderColor: "#f5f5f5", borderRadius: 16, fontFamily: fonts.medium, fontSize: 14, color: palette.gray900 },
  grid: { flexDirection: "row", flexWrap: "wrap", columnGap: 16, rowGap: 40 },
  cell: { width: "21%", alignItems: "center" },
  circle: { width: "100%", aspectRatio: 1, borderRadius: 999, overflow: "hidden", borderWidth: 1, borderColor: "#f5f5f5", backgroundColor: palette.white, elevation: 1 },
  showAll: { marginTop: 32, paddingHorizontal: 32, paddingVertical: 12, backgroundColor: "#171717", borderRadius: 16, elevation: 4 },
});
