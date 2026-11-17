/** Port of pages/user/Gourmet.jsx. Web computes distance from an undefined `location` (always falls back); native uses the user's location as intended. */
import React, { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, Star, Clock, Bookmark, BadgePercent, Utensils } from "lucide-react-native";
import Txt from "../src/components/ui/Txt";
import Screen from "../src/components/ui/Screen";
import Skeleton from "../src/components/ui/Skeleton";
import AppImage from "../src/components/ui/AppImage";
import Button from "../src/components/ui/Button";
import { LinearGradient } from "../src/components/ui/LinearGradient";
import { api } from "../src/api";
import { useAppLocation } from "../src/context/LocationProvider";
import { getMediaUrl } from "../src/utils/media";
import { localImages } from "../src/constants/images";
import { toast } from "../src/utils/toast";
import { palette } from "../src/theme";

const distKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.35;
};

export default function GourmetScreen() {
  const router = useRouter();
  const { zoneId, location } = useAppLocation();
  const [favorites, setFavorites] = useState(new Set());
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const r = await api.get("/food/hero-banners/gourmet/public", { params: zoneId ? { zoneId } : {} });
        const d = r?.data?.data;
        setList(d?.restaurants ?? (Array.isArray(d) ? d : []));
      } catch (e) {
        const m = e?.response?.data?.message || e?.message || "Failed to load Gourmet restaurants";
        setError(m);
        toast.error(m);
        setList([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [zoneId, reloadKey]);

  const toggleFav = (id) =>
    setFavorites((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <Screen bg={palette.white} edges={[]} padTop={false}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={{ height: 260, overflow: "hidden" }}>
          {localImages.gourmetNewBanner ? <Image source={localImages.gourmetNewBanner} style={[StyleSheet.absoluteFill, { width: "100%", height: "100%", transform: [{ scale: 1.05 }] }]} resizeMode="cover" /> : null}
          <LinearGradient colors={["transparent", "rgba(0,0,0,0.4)", "rgba(0,0,0,0.8)"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={styles.back}><ArrowLeft size={20} color={palette.white} /></Pressable>
          <View style={{ position: "absolute", bottom: 32, left: 24, right: 24, gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 32, height: 2, backgroundColor: palette.yellow }} />
              <Txt weight={900} style={{ fontSize: 10, letterSpacing: 3, color: "rgba(255,255,255,0.8)" }}>EXPERIENCE EXCELLENCE</Txt>
            </View>
            <Txt weight={900} style={{ fontSize: 30, color: palette.white }}>Gourmet Dining</Txt>
            <Txt weight={500} style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}>Indulge in carefully curated premium dining from the city's finest restaurants.</Txt>
          </View>
        </View>

        <View style={{ padding: 16, paddingVertical: 24, gap: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 8, borderBottomWidth: 1, borderColor: palette.gray100 }}>
            <Txt weight={900} style={{ fontSize: 10, color: palette.gray400, letterSpacing: 2 }}>{loading ? "..." : list.length} PREMIER ESTABLISHMENTS</Txt>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: palette.green500 }} />
              <Txt weight={700} style={{ fontSize: 10, color: palette.gray500 }}>LIVE DEALS AVAILABLE</Txt>
            </View>
          </View>

          {loading ? (
            [0, 1, 2].map((i) => <Skeleton key={i} height={300} radius={32} />)
          ) : error ? (
            <View style={{ alignItems: "center", paddingVertical: 80 }}>
              <Txt weight={400} style={{ color: palette.red500, textAlign: "center" }}>{error}</Txt>
              <Button title="Retry" rounded="md" onPress={() => setReloadKey((k) => k + 1)} style={{ marginTop: 16 }} />
            </View>
          ) : list.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 48 }}>
              <Txt weight={400} style={{ color: palette.gray500 }}>No Gourmet restaurants available at the moment</Txt>
            </View>
          ) : (
            list.map((item) => {
              const r = item.restaurant || item;
              const slug = r.slug || r.restaurantName?.toLowerCase().replace(/\s+/g, "-") || r.name?.toLowerCase().replace(/\s+/g, "-") || "";
              const id = r._id || r.restaurantId || r.id;
              const fav = favorites.has(id);
              const rLat = r.location?.latitude || r.location?.coordinates?.[1];
              const rLng = r.location?.longitude || r.location?.coordinates?.[0];
              const dist = location?.latitude && location?.longitude && rLat && rLng ? `${distKm(location.latitude, location.longitude, rLat, rLng).toFixed(1)} km` : r.distance || "1.2 km";
              const cover = (r.coverImages || []).map((x) => x?.url || x).filter(Boolean);
              const menu = (r.menuImages || []).map((x) => x?.url || x).filter(Boolean);
              const raw = cover[0] || menu[0] || r.profileImage?.url || r.profileImage || r.image || "";
              const img = raw ? getMediaUrl(raw) : "";
              return (
                <Pressable key={id} onPress={() => router.push(`/restaurants/${slug}`)} style={styles.card}>
                  <View style={{ height: 200, borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: "hidden" }}>
                    {img ? (
                      <AppImage src={img} style={StyleSheet.absoluteFill} width={900} />
                    ) : (
                      <View style={{ flex: 1, backgroundColor: palette.gray100, alignItems: "center", justifyContent: "center" }}><Utensils size={32} color={palette.gray200} /></View>
                    )}
                    <LinearGradient colors={["transparent", "rgba(0,0,0,0.36)"]} start={{ x: 0, y: 0.4 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
                    <Pressable onPress={() => toggleFav(id)} style={styles.bookmark}>
                      <Bookmark size={20} color={fav ? palette.white : "rgba(255,255,255,0.8)"} fill={fav ? palette.white : "transparent"} />
                    </Pressable>
                    <View style={styles.rating}>
                      <Txt weight={900} style={{ fontSize: 14, color: palette.gray900 }}>{r.rating?.toFixed?.(1) || "4.0"}</Txt>
                      <Star size={14} color={palette.yellow} fill={palette.yellow} />
                    </View>
                  </View>
                  <View style={{ padding: 20 }}>
                    <Txt weight={900} numberOfLines={1} style={{ fontSize: 20, color: palette.gray900, marginBottom: 12 }}>{r.restaurantName || r.name}</Txt>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 16 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Clock size={16} color={palette.amber600} strokeWidth={2.5} />
                        <Txt weight={700} style={{ fontSize: 12, color: palette.gray500 }}>{String(r.estimatedDeliveryTime || "25-30 mins").toUpperCase()}</Txt>
                      </View>
                      <Txt style={{ color: palette.gray200 }}>•</Txt>
                      <Txt weight={900} style={{ fontSize: 12, color: "#a05485" }}>{String(dist).toUpperCase()} AWAY</Txt>
                    </View>
                    {r.offer ? (
                      <View style={[styles.tag, { backgroundColor: "rgba(254,198,0,0.08)" }]}>
                        <BadgePercent size={16} color={palette.amber600} strokeWidth={3} />
                        <Txt weight={900} style={{ fontSize: 10, color: palette.amber600, letterSpacing: 1 }}>{String(r.offer).toUpperCase()}</Txt>
                      </View>
                    ) : (
                      <View style={[styles.tag, { backgroundColor: palette.gray50 }]}>
                        <Txt weight={900} style={{ fontSize: 10, color: palette.gray400, letterSpacing: 2 }}>ELITE SELECTION</Txt>
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { position: "absolute", top: 44, left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: palette.white, borderRadius: 32, marginBottom: 16, elevation: 6, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
  bookmark: { position: "absolute", top: 16, right: 16, width: 40, height: 40, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  rating: { position: "absolute", bottom: 16, right: 16, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: palette.white, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, elevation: 8 },
  tag: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
});
