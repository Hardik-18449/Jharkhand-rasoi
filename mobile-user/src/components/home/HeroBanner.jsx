/** Port of components/user/home/HeroBanner.jsx — admin hero banners carousel (auto-slide 3.5 s, swipe, dots, tap → linked restaurant). */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import Skeleton from "../ui/Skeleton";
import { getMediaUrl } from "../../utils/media";
import { palette } from "../../theme";

const AUTO_SLIDE_MS = 3500;

export default function HeroBanner({ images = [], bannersData = [], loading = false }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const itemW = width - 32;
  const [currentIndex, setCurrentIndex] = useState(0);
  const listRef = useRef(null);
  const timerRef = useRef(null);
  const indexRef = useRef(0);

  const startAutoSlide = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (images.length <= 1) return;
    timerRef.current = setInterval(() => {
      const next = (indexRef.current + 1) % images.length;
      indexRef.current = next;
      setCurrentIndex(next);
      listRef.current?.scrollToIndex({ index: next, animated: true });
    }, AUTO_SLIDE_MS);
  }, [images.length]);

  useEffect(() => {
    startAutoSlide();
    return () => timerRef.current && clearInterval(timerRef.current);
  }, [startAutoSlide]);

  if (loading) {
    return (
      <View style={styles.wrap}>
        <Skeleton height={(itemW * 9) / 21} radius={16} style={{ width: "100%" }} />
      </View>
    );
  }
  if (images.length === 0) return null;

  const onPressBanner = () => {
    const bannerData = bannersData[currentIndex];
    const linkedRestaurants = bannerData?.linkedRestaurants || [];
    if (linkedRestaurants.length > 0) {
      const first = linkedRestaurants[0];
      const slug = first.slug || first.restaurantId || first._id;
      router.push(`/restaurants/${slug}`);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.shell}>
        <FlatList
          ref={listRef}
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item, i) => `${i}-${item}`}
          getItemLayout={(_, index) => ({ length: itemW, offset: itemW * index, index })}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / itemW);
            indexRef.current = idx;
            setCurrentIndex(idx);
            startAutoSlide();
          }}
          onScrollBeginDrag={() => timerRef.current && clearInterval(timerRef.current)}
          renderItem={({ item }) => (
            <Pressable onPress={onPressBanner} style={{ width: itemW, minHeight: 180, justifyContent: "center", backgroundColor: palette.gray50 }}>
              <Image source={{ uri: getMediaUrl(item) }} style={{ width: itemW, height: Math.min(250, (itemW * 9) / 16) }} contentFit="contain" transition={300} />
            </Pressable>
          )}
        />
        {images.length > 1 ? (
          <View style={styles.dots}>
            {images.map((_, i) => (
              <View key={i} style={[styles.dot, i === currentIndex && styles.dotActive]} />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingVertical: 8 },
  shell: { borderRadius: 16, overflow: "hidden", backgroundColor: palette.white, elevation: 1 },
  dots: { position: "absolute", bottom: 12, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { height: 6, width: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.4)" },
  dotActive: { width: 16, backgroundColor: "rgba(255,255,255,0.9)" },
});
