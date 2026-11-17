/** Port of components/user/home/ExploreMoreSection.jsx */
import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import Txt from "../ui/Txt";
import Skeleton from "../ui/Skeleton";
import AppImage from "../ui/AppImage";
import { palette } from "../../theme";

export default function ExploreMoreSection({ heading = "Explore More", items = [], showSkeleton = false }) {
  const router = useRouter();
  return (
    <View style={{ paddingTop: 8 }}>
      <View style={styles.headRow}>
        <Txt weight={700} style={{ fontSize: 18, color: palette.gray900, lineHeight: 22 }}>
          {heading}
        </Txt>
        <View style={{ flex: 1, height: 1, backgroundColor: palette.gray100 }} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {showSkeleton
          ? Array.from({ length: 4 }).map((_, i) => (
              <View key={i} style={styles.item}>
                <Skeleton width={80} height={80} radius={20} />
                <Skeleton width={56} height={10} radius={5} style={{ marginTop: 8 }} />
              </View>
            ))
          : items.map((item) => (
              <Pressable key={item.id} onPress={() => router.push(item.href)} style={({ pressed }) => [styles.item, pressed && { transform: [{ scale: 0.95 }] }]}>
                <View style={styles.tile}>
                  <AppImage src={item.image} fallbackSrc={item.fallbackImage} style={StyleSheet.absoluteFill} width={200} />
                </View>
                <Txt weight={700} numberOfLines={1} style={styles.label}>
                  {String(item.label || "").toUpperCase()}
                </Txt>
              </Pressable>
            ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  headRow: { paddingHorizontal: 16, marginBottom: 24, flexDirection: "row", alignItems: "center", gap: 8 },
  row: { paddingHorizontal: 16, paddingBottom: 16, gap: 40, alignItems: "flex-start", justifyContent: "center", flexGrow: 1, paddingVertical: 8 },
  item: { width: 80, alignItems: "center", gap: 8 },
  tile: { width: 80, height: 80, borderRadius: 20, backgroundColor: palette.white, borderWidth: 1, borderColor: palette.gray100, overflow: "hidden", elevation: 2 },
  label: { fontSize: 10, color: palette.gray500, letterSpacing: -0.2, textAlign: "center" },
});
