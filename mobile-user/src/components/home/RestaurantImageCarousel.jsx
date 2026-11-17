/** Port of components/user/home/RestaurantImageCarousel.jsx (slides from recommended items or cover images, swipe, dots, dish tag). */
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Sparkles } from "lucide-react-native";
import Txt from "../ui/Txt";
import { foodImages } from "../../constants/images";
import { getMediaUrl } from "../../utils/media";
import { palette } from "../../theme";

const RestaurantCarouselStateContext = createContext(null);

export function RestaurantCarouselStateProvider({ children }) {
  const [activeSlide, setActiveSlide] = useState(null);
  const value = useMemo(() => ({ activeSlide, setActiveSlide }), [activeSlide]);
  return <RestaurantCarouselStateContext.Provider value={value}>{children}</RestaurantCarouselStateContext.Provider>;
}

function resolveSlideOffer(restaurant, slide) {
  if (!slide?.isRecommended) return null;
  const originalPrice = Number(slide.price) || 0;
  if (originalPrice <= 0) return null;
  const buildResult = (discountValue, isFlat, offerText) => {
    const value = Number(discountValue) || 0;
    if (value <= 0) return null;
    const discountedPrice = isFlat ? Math.max(0, originalPrice - value) : Math.max(0, originalPrice * (1 - value / 100));
    if (discountedPrice >= originalPrice) return null;
    return { offerText, originalPrice, discountedPrice };
  };
  const specificDiscount = Array.isArray(restaurant?.itemDiscounts) ? restaurant.itemDiscounts.find((d) => String(d.itemId) === String(slide.id)) : null;
  if (specificDiscount && Number(specificDiscount.discountValue) > 0) {
    const value = Number(specificDiscount.discountValue);
    const isFlat = String(specificDiscount.discountType || "").toUpperCase() === "FLAT";
    return buildResult(value, isFlat, isFlat ? `FLAT ₹${value} OFF` : `${value}% OFF`);
  }
  if (Number(slide.discountPercent) > 0) return buildResult(Number(slide.discountPercent), false, `${Number(slide.discountPercent)}% OFF`);
  const matchingRule = (restaurant?.discountRules || []).find((rule) => {
    const cv = Number(rule.conditionValue);
    return (rule.conditionType === "PRICE_ABOVE" && originalPrice > cv) || (rule.conditionType === "PRICE_BELOW" && originalPrice < cv);
  });
  if (matchingRule && Number(matchingRule.discountValue) > 0) return buildResult(Number(matchingRule.discountValue), false, `${Number(matchingRule.discountValue)}% OFF`);
  if (Number(restaurant?.discount) > 0) return buildResult(Number(restaurant.discount), false, `${Number(restaurant.discount)}% OFF`);
  return null;
}

export function resolveItemOffer(restaurant, item) {
  return resolveSlideOffer(restaurant, { ...item, isRecommended: true });
}

export function RestaurantOfferBanner({ restaurant }) {
  const carouselState = useContext(RestaurantCarouselStateContext);
  const activeSlide = carouselState?.activeSlide || null;
  const offerDetails = useMemo(() => resolveSlideOffer(restaurant, activeSlide), [restaurant, activeSlide]);
  if (!activeSlide || !offerDetails) return null;
  return (
    <View style={styles.offerBanner}>
      <Txt weight={800} style={{ fontSize: 12, color: palette.black, textTransform: "uppercase" }}>
        {offerDetails.offerText}
      </Txt>
      <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.6)" }} />
      <Txt weight={700} numberOfLines={1} style={{ flex: 1, fontSize: 11, color: palette.black }}>
        {activeSlide.name}
      </Txt>
      <Txt weight={400} style={{ fontSize: 10, color: "rgba(0,0,0,0.5)", textDecorationLine: "line-through" }}>
        ₹{Math.round(offerDetails.originalPrice)}
      </Txt>
      <Txt weight={600} style={{ fontSize: 11, color: palette.black }}>
        ₹{Math.round(offerDetails.discountedPrice)}
      </Txt>
    </View>
  );
}

function RestaurantImageCarousel({ restaurant, autoPlay = false, height = 176, radius = 16, onSlideClick = null, width }) {
  const carouselState = useContext(RestaurantCarouselStateContext);
  const setSyncedActiveSlide = carouselState?.setActiveSlide;
  const [layoutW, setLayoutW] = useState(width || 0);
  const itemW = width || layoutW;

  const slides = useMemo(() => {
    const result = [];
    const recItems = Array.isArray(restaurant?.recommendedItems) ? restaurant.recommendedItems : [];
    recItems.forEach((item) => {
      const rawImg = item?.image || item?.imageUrl || item?.photoUrl;
      if (typeof rawImg === "string" && rawImg.trim()) {
        result.push({ url: getMediaUrl(rawImg.trim()), id: item.id || item._id, name: item.name || "Recommended Dish", price: item.price || 0, foodType: item.foodType, discountPercent: item.discountPercent, isRecommended: true });
      }
    });
    if (result.length > 0) return result;
    let sourceImages = [];
    if (Array.isArray(restaurant?.images) && restaurant.images.length > 0) sourceImages = restaurant.images;
    else if (Array.isArray(restaurant?.coverImages) && restaurant.coverImages.length > 0) sourceImages = restaurant.coverImages;
    else if (restaurant?.image) sourceImages = [restaurant.image];
    else if (restaurant?.profileImage) {
      const pUrl = typeof restaurant.profileImage === "string" ? restaurant.profileImage : restaurant.profileImage?.url || "";
      if (pUrl) sourceImages = [pUrl];
    }
    sourceImages
      .map((img) => (typeof img === "string" ? img : img?.url || img?.secure_url || ""))
      .filter((img) => typeof img === "string" && img.trim() && !img.includes("xv4gkshv"))
      .forEach((img) => {
        const url = getMediaUrl(img.trim());
        if (!result.some((s) => s.url === url)) result.push({ url, isRecommended: false });
      });
    if (result.length === 0) {
      const seedStr = String(restaurant?.id || restaurant?.mongoId || restaurant?._id || restaurant?.name || "food");
      let hash = 0;
      for (let i = 0; i < seedStr.length; i++) {
        hash = (hash << 5) - hash + seedStr.charCodeAt(i);
        hash |= 0;
      }
      result.push({ url: foodImages[Math.abs(hash) % foodImages.length] || foodImages[0], isRecommended: false });
    }
    return result;
  }, [restaurant?.recommendedItems, restaurant?.images, restaurant?.coverImages, restaurant?.image, restaurant?.profileImage, restaurant?.id, restaurant?.mongoId, restaurant?._id, restaurant?.name]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const listRef = useRef(null);
  const indexRef = useRef(0);
  const currentSlide = slides[currentIndex] || null;

  useEffect(() => {
    setSyncedActiveSlide?.(currentSlide);
  }, [setSyncedActiveSlide, currentSlide]);

  useEffect(() => {
    setCurrentIndex(0);
    indexRef.current = 0;
  }, [restaurant?.id, restaurant?.slug]);

  useEffect(() => {
    if (!autoPlay || slides.length <= 1 || !itemW) return undefined;
    const interval = setInterval(() => {
      const next = (indexRef.current + 1) % slides.length;
      indexRef.current = next;
      setCurrentIndex(next);
      listRef.current?.scrollToIndex({ index: next, animated: true });
    }, 7000);
    return () => clearInterval(interval);
  }, [autoPlay, slides.length, itemW]);

  return (
    <View style={[styles.wrap, { height, borderRadius: radius }]} onLayout={(e) => !width && setLayoutW(e.nativeEvent.layout.width)}>
      {itemW > 0 ? (
        <FlatList
          ref={listRef}
          data={slides}
          horizontal
          pagingEnabled
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(s, i) => `${i}-${s.url}`}
          getItemLayout={(_, index) => ({ length: itemW, offset: itemW * index, index })}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / itemW);
            indexRef.current = idx;
            setCurrentIndex(idx);
          }}
          renderItem={({ item }) => (
            <Pressable onPress={() => onSlideClick?.(item)} disabled={!onSlideClick} style={{ width: itemW, height }}>
              <Image source={{ uri: item.url }} style={{ width: itemW, height }} contentFit="cover" transition={300} recyclingKey={item.url} />
            </Pressable>
          )}
        />
      ) : null}
      {currentSlide?.isRecommended && currentSlide?.foodType ? (
        <View style={[styles.vegMark, { borderColor: currentSlide.foodType === "Veg" ? palette.green600 : palette.red600 }]}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: currentSlide.foodType === "Veg" ? palette.green600 : palette.red600 }} />
        </View>
      ) : null}
      {currentSlide?.isRecommended && currentSlide?.name ? (
        <View style={[styles.dishTag, { left: currentSlide.foodType ? 48 : 12 }]}>
          <Sparkles size={12} color={palette.amber400} fill={palette.amber400} />
          <Txt weight={700} numberOfLines={1} style={{ fontSize: 11, color: palette.white, maxWidth: 140 }}>
            {currentSlide.name}
          </Txt>
          {currentSlide.price > 0 ? (
            <Txt weight={800} style={{ fontSize: 11, color: "#fcd34d", marginLeft: 2 }}>
              ₹{Math.round(currentSlide.price)}
            </Txt>
          ) : null}
        </View>
      ) : null}
      {slides.length > 1 ? (
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View key={i} style={[styles.dot, i === currentIndex && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default React.memo(RestaurantImageCarousel);

const styles = StyleSheet.create({
  wrap: { width: "100%", overflow: "hidden", backgroundColor: palette.gray100 },
  vegMark: { position: "absolute", left: 12, top: 12, width: 28, height: 28, borderRadius: 6, borderWidth: 2, backgroundColor: "rgba(255,255,255,0.95)", alignItems: "center", justifyContent: "center" },
  dishTag: { position: "absolute", top: 12, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.75)", borderWidth: 1, borderColor: "rgba(251,191,36,0.4)" },
  dots: { position: "absolute", bottom: 8, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.5)" },
  dotActive: { width: 24, backgroundColor: palette.white },
  offerBanner: { height: 30, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, marginBottom: 8 },
});
