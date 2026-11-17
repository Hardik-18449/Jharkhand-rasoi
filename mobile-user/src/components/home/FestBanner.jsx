/** Port of components/user/home/FestBanner.jsx (yellow hero with rotating food images). */
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { ArrowRightCircle, Leaf, Flame } from "lucide-react-native";
import Txt from "../ui/Txt";
import { LinearGradient } from "../ui/LinearGradient";
import { getMediaUrl } from "../../utils/media";
import { palette, GRADIENT_YELLOW } from "../../theme";

const defaultImages = {
  nonVeg: [
    "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=500&h=500&fit=crop",
    "https://images.unsplash.com/photo-1544025162-d76694265947?w=500&h=500&fit=crop",
    "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&h=500&fit=crop",
    "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=500&h=500&fit=crop",
    "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=500&h=500&fit=crop",
  ],
  veg: [
    "https://images.unsplash.com/photo-1585238341267-1cfec2046a55?w=500&h=500&fit=crop",
    "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&h=500&fit=crop",
    "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=500&h=500&fit=crop",
    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&h=500&fit=crop",
    "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&h=500&fit=crop",
  ],
};

export default function FestBanner({ isVegMode, images = [], hideFoodImages = false }) {
  const [imgIndex, setImgIndex] = useState(0);
  const [bgIndex, setBgIndex] = useState(0);
  const currentPool = isVegMode ? defaultImages.veg : defaultImages.nonVeg;
  const hasBgImages = Array.isArray(images) && images.length > 0;

  useEffect(() => {
    const timer = setInterval(() => setImgIndex((p) => (p + 1) % currentPool.length), 4000);
    return () => clearInterval(timer);
  }, [currentPool.length]);
  useEffect(() => {
    if (!hasBgImages || images.length <= 1) return undefined;
    const timer = setInterval(() => setBgIndex((p) => (p + 1) % images.length), 5000);
    return () => clearInterval(timer);
  }, [hasBgImages, images.length]);
  useEffect(() => setImgIndex(0), [isVegMode]);

  const displayImages = [currentPool[imgIndex % currentPool.length], currentPool[(imgIndex + 1) % currentPool.length], currentPool[(imgIndex + 2) % currentPool.length]];

  return (
    <LinearGradient colors={GRADIENT_YELLOW} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.root}>
      {hasBgImages ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "#0f172a" }]}>
          <Image source={{ uri: getMediaUrl(images[bgIndex]) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={1200} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.2)" }]} />
        </View>
      ) : null}
      <View style={styles.content}>
        <Txt weight={900} style={styles.title}>
          {isVegMode ? "VEGGIE DELIGHT" : "FEAST BONANZA"}
        </Txt>
        <View style={styles.pill}>
          {isVegMode ? <Leaf size={14} color="#34d399" fill="#34d399" /> : <Flame size={14} color={palette.yellow} fill={palette.yellow} />}
          <Txt weight={900} style={styles.pillText}>
            {isVegMode ? "PURE VEG MAGIC" : "UPTO 60% OFF NOW"}
          </Txt>
          <ArrowRightCircle size={20} color={palette.yellow} />
        </View>
        {hideFoodImages ? (
          <View style={{ height: 112 }} />
        ) : (
          <View style={styles.imagesRow}>
            <Image source={{ uri: displayImages[0] }} style={[styles.sideImg, { transform: [{ rotate: "-3deg" }] }]} contentFit="cover" transition={600} />
            <Image source={{ uri: displayImages[1] }} style={styles.centerImg} contentFit="cover" transition={600} />
            <Image source={{ uri: displayImages[2] }} style={[styles.sideImg, { transform: [{ rotate: "3deg" }] }]} contentFit="cover" transition={600} />
          </View>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { width: "100%", paddingHorizontal: 16, paddingTop: 24, paddingBottom: 32, minHeight: 160, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  content: { alignItems: "center", gap: 16 },
  title: { fontSize: 24, color: palette.black, fontStyle: "italic", letterSpacing: -1, textTransform: "uppercase", lineHeight: 26 },
  pill: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 6, backgroundColor: palette.black, borderRadius: 999, borderWidth: 1, borderColor: "rgba(0,0,0,0.2)" },
  pillText: { fontSize: 14, color: palette.white, letterSpacing: 1.4, textTransform: "uppercase" },
  imagesRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 20, paddingTop: 40, marginBottom: 8 },
  sideImg: { width: 64, height: 64, borderRadius: 16, borderWidth: 3, borderColor: palette.white },
  centerImg: { width: 96, height: 96, borderRadius: 40, borderWidth: 4, borderColor: palette.white, marginBottom: -8 },
});
