/** Port of components/user/home/AdsBannerCarousel.jsx */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { Megaphone } from "lucide-react-native";
import Txt from "../ui/Txt";
import { LinearGradient } from "../ui/LinearGradient";
import { getMediaUrl } from "../../utils/media";
import { palette } from "../../theme";

export default function AdsBannerCarousel({ advertisements = [], banners = [], data = [] }) {
  const { width } = useWindowDimensions();
  const itemW = width - 32;
  const items = useMemo(() => {
    if (Array.isArray(advertisements) && advertisements.length > 0) {
      return advertisements.map((ad) => ({ title: ad.title || ad.name || "", posterUrl: ad.posterUrl || ad.image || ad.imageUrl || "" })).filter((i) => Boolean(i.posterUrl));
    }
    if (Array.isArray(banners) && banners.length > 0) {
      return banners.map((banner, idx) => ({ title: data?.[idx]?.title || data?.[idx]?.name || "Special Offer", posterUrl: typeof banner === "string" ? banner : banner?.url || "" })).filter((i) => Boolean(i.posterUrl));
    }
    return [];
  }, [advertisements, banners, data]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const listRef = useRef(null);
  const idxRef = useRef(0);
  const timerRef = useRef(null);
  const startAutoSlide = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (items.length <= 1) return;
    timerRef.current = setInterval(() => {
      const next = (idxRef.current + 1) % items.length;
      idxRef.current = next;
      setCurrentIndex(next);
      listRef.current?.scrollToIndex({ index: next, animated: true });
    }, 4500);
  };
  useEffect(() => {
    setCurrentIndex(0);
    idxRef.current = 0;
    startAutoSlide();
    return () => timerRef.current && clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  if (items.length === 0) return null;
  const currentItem = items[currentIndex];

  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 8, marginVertical: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Megaphone size={16} color={palette.black} />
          <Txt weight={700} style={{ fontSize: 16, color: palette.gray900 }}>
            Featured Offers & Updates
          </Txt>
        </View>
        {items.length > 1 ? (
          <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
            {items.map((_, idx) => (
              <Pressable
                key={idx}
                onPress={() => {
                  idxRef.current = idx;
                  setCurrentIndex(idx);
                  listRef.current?.scrollToIndex({ index: idx, animated: true });
                  startAutoSlide();
                }}
                style={[styles.dot, idx === currentIndex && styles.dotActive]}
              />
            ))}
          </View>
        ) : null}
      </View>
      <View style={styles.box}>
        <FlatList
          ref={listRef}
          data={items}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(_, i) => String(i)}
          getItemLayout={(_, index) => ({ length: itemW, offset: itemW * index, index })}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / itemW);
            idxRef.current = idx;
            setCurrentIndex(idx);
            startAutoSlide();
          }}
          renderItem={({ item }) => <Image source={{ uri: getMediaUrl(item.posterUrl) }} style={{ width: itemW, height: 140 }} contentFit="cover" transition={400} />}
        />
        <LinearGradient colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.3)", "rgba(0,0,0,0.7)"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.grad} pointerEvents="none" />
        {currentItem?.title ? (
          <View style={styles.titleWrap}>
            <Txt weight={600} numberOfLines={1} style={{ fontSize: 12, color: palette.white }}>
              {currentItem.title}
            </Txt>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { height: 140, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: palette.gray100, backgroundColor: palette.gray100 },
  grad: { position: "absolute", left: 0, right: 0, bottom: 0, height: 70 },
  titleWrap: { position: "absolute", bottom: 12, left: 12, maxWidth: "85%", backgroundColor: "rgba(0,0,0,0.7)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  dot: { height: 6, width: 6, borderRadius: 3, backgroundColor: palette.gray300 },
  dotActive: { width: 16, backgroundColor: palette.yellow },
});
