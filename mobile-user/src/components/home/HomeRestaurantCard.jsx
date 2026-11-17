/** Port of components/user/home/HomeRestaurantCard.jsx */
import React, { memo, useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Bookmark, Plus, Star, Timer } from "lucide-react-native";
import { Image } from "expo-image";
import Txt from "../ui/Txt";
import RestaurantImageCarousel, { RestaurantCarouselStateProvider, resolveItemOffer } from "./RestaurantImageCarousel";
import { foodImages } from "../../constants/images";
import { useDeferredOutletTimings } from "../../hooks/useDeferredOutletTimings";
import { getRestaurantAvailabilityStatus } from "../../utils/restaurantAvailability";
import { getMediaUrl } from "../../utils/media";
import { toast } from "../../utils/toast";
import { palette } from "../../theme";

export function resolveRestaurantSlug(restaurant, index = 0) {
  const nameStr = typeof restaurant?.name === "string" ? restaurant.name.trim() : "";
  const fallback = nameStr || (typeof restaurant?.restaurantName === "string" ? restaurant.restaurantName.trim() : "") || String(restaurant?.slug || restaurant?.id || restaurant?._id || `restaurant-${index}`);
  return typeof restaurant?.slug === "string" && restaurant.slug.trim() ? restaurant.slug.trim() : fallback.toLowerCase().replace(/\s+/g, "-");
}

function resolveHeadlineOffer(restaurant) {
  if (typeof restaurant?.offer === "string" && restaurant.offer.trim()) return restaurant.offer.trim();
  const offers = Array.isArray(restaurant?.offers) ? restaurant.offers : [];
  const best = offers.reduce((acc, offer) => (!acc || Number(offer.discountValue) > Number(acc.discountValue) ? offer : acc), null);
  if (best) {
    const value = Number(best.discountValue) || 0;
    const isFlat = String(best.discountType || "").toUpperCase() === "FLAT";
    if (best.title) return best.title;
    if (value > 0) return isFlat ? `Flat ₹${value} off` : `${value}% off`;
  }
  if (Number(restaurant?.discount) > 0) return `${restaurant.discount}% off`;
  return null;
}

function buildPreviewItems(restaurant) {
  const source = Array.isArray(restaurant?.previewItems) && restaurant.previewItems.length > 0 ? restaurant.previewItems : Array.isArray(restaurant?.recommendedItems) ? restaurant.recommendedItems : [];
  return source
    .filter((item) => item?.name)
    .map((item, idx) => {
      const price = Number(item.price) || 0;
      const offer = resolveItemOffer(restaurant, { ...item, id: item.id || item._id, price });
      const finalPrice = offer ? offer.discountedPrice : price;
      const otherPrice = Number(item.priceOnOtherPlatforms) || 0;
      const lowerPercent = otherPrice > finalPrice && finalPrice > 0 ? Math.round(((otherPrice - finalPrice) / otherPrice) * 100) : 0;
      return {
        id: item.id || item._id,
        name: item.name,
        image: getMediaUrl(item.image || item.imageUrl) || foodImages[idx % foodImages.length],
        foodType: item.foodType,
        isRecommended: item.isRecommended === true,
        price,
        finalPrice,
        hasDiscount: Boolean(offer),
        lowerPercent,
      };
    });
}

function VegDot({ foodType, size = 14 }) {
  const isVeg = foodType === "Veg";
  return (
    <View style={{ width: size, height: size, borderRadius: 3, borderWidth: 1, borderColor: isVeg ? palette.green600 : palette.red600, alignItems: "center", justifyContent: "center", marginTop: 3 }}>
      <View style={{ width: size * 0.43, height: size * 0.43, borderRadius: size, backgroundColor: isVeg ? palette.green600 : palette.red600 }} />
    </View>
  );
}

function PreviewItemCard({ item, onSelect, isRestaurantOpen = true }) {
  return (
    <Pressable onPress={() => onSelect(item)} style={[styles.preview, !isRestaurantOpen && { opacity: 0.8 }]}>
      <View style={styles.previewImgWrap}>
        <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} blurRadius={!isRestaurantOpen ? 2 : 0} />
        {item.isRecommended && isRestaurantOpen ? (
          <View style={styles.popularTag}>
            <Txt weight={700} style={{ fontSize: 11, color: palette.green700 }}>
              Popular
            </Txt>
          </View>
        ) : null}
        {!isRestaurantOpen ? (
          <View style={styles.closedOverlay}>
            <View style={styles.closedPill}>
              <Txt weight={800} style={{ fontSize: 10, color: palette.white, letterSpacing: 1 }}>
                CLOSED
              </Txt>
            </View>
          </View>
        ) : (
          <View style={styles.plus}>
            <Plus size={20} color={palette.black} strokeWidth={2.5} />
          </View>
        )}
      </View>
      <View style={{ marginTop: 8, flexDirection: "row", gap: 6 }}>
        {item.foodType ? <VegDot foodType={item.foodType} /> : null}
        <Txt weight={500} numberOfLines={2} style={{ flex: 1, fontSize: 14, color: palette.gray900, lineHeight: 19 }}>
          {item.name}
        </Txt>
      </View>
      <View style={{ marginTop: 4, flexDirection: "row", alignItems: "center", gap: 6 }}>
        {item.hasDiscount ? (
          <>
            <Txt weight={400} style={{ fontSize: 13, color: palette.gray400, textDecorationLine: "line-through" }}>
              ₹{Math.round(item.price)}
            </Txt>
            <View style={{ backgroundColor: "rgba(254,198,0,0.15)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
              <Txt weight={700} style={{ fontSize: 14, color: palette.black }}>
                ₹{Math.round(item.finalPrice)}
              </Txt>
            </View>
          </>
        ) : (
          <Txt weight={500} style={{ fontSize: 14, color: palette.gray700 }}>
            ₹{Math.round(item.price)}
          </Txt>
        )}
      </View>
      {item.lowerPercent > 0 ? (
        <Txt weight={600} style={{ marginTop: 4, fontSize: 12, color: palette.black }}>
          Our app: {item.lowerPercent}% lower
        </Txt>
      ) : null}
    </Pressable>
  );
}

function HomeRestaurantCard({ restaurant, index = 0, isOutOfService = false, isFavorite, onToggleFavorite }) {
  const router = useRouter();
  const isBanned = Boolean(restaurant?.isBanned === true || restaurant?.status === "banned" || (restaurant?.status === "rejected" && /disabled by admin|banned/i.test(restaurant?.rejectionReason || "")));
  const resolvedRestaurantId = restaurant?.mongoId || restaurant?._id || restaurant?.id || restaurant?.restaurantId;
  const { outletTimings } = useDeferredOutletTimings(resolvedRestaurantId, restaurant?.outletTimings ?? null);
  const restaurantForAvailability = useMemo(() => ({ ...restaurant, outletTimings: outletTimings ?? restaurant?.outletTimings }), [restaurant, outletTimings]);
  const rawAvailability = getRestaurantAvailabilityStatus(restaurantForAvailability, new Date());
  const availability = isBanned ? { ...rawAvailability, isOpen: false, closingCountdownLabel: null } : rawAvailability;
  const restaurantSlug = resolveRestaurantSlug(restaurant, index);
  const favorite = !isBanned && typeof isFavorite === "function" ? isFavorite(restaurantSlug) : false;
  const previewItems = useMemo(() => buildPreviewItems(restaurant), [restaurant]);
  const headlineOffer = useMemo(() => resolveHeadlineOffer(restaurant), [restaurant]);
  const pricedItems = previewItems.map((i) => i.finalPrice).filter((p) => p > 0);
  const minItemPrice = pricedItems.length > 0 ? Math.round(Math.min(...pricedItems)) : null;
  const cuisineText = (Array.isArray(restaurant?.cuisines) && restaurant.cuisines.length > 0 ? restaurant.cuisines.slice(0, 2).join(", ") : restaurant?.cuisine) || "";
  const metaParts = [restaurant?.deliveryTime, restaurant?.distance, cuisineText].filter(Boolean);
  const dimmed = isBanned || isOutOfService || !availability.isOpen;

  const openItem = (itemId) => {
    if (isBanned) return;
    router.push({ pathname: `/restaurants/${restaurantSlug}`, params: itemId ? { highlightItemId: itemId } : {} });
  };

  return (
    <Pressable onPress={() => !isBanned && router.push(`/restaurants/${restaurantSlug}`)} disabled={isBanned} style={[styles.card, dimmed && { opacity: 0.75 }]}>
      <RestaurantCarouselStateProvider>
        <View style={styles.infoRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            {restaurant.isFranchise || restaurant.restaurantType === "franchise" ? (
              <View style={styles.franchise}>
                <Txt weight={800} style={{ fontSize: 10, color: palette.amber600, letterSpacing: 1 }}>
                  ★ FRANCHISE
                </Txt>
              </View>
            ) : null}
            {headlineOffer ? (
              <Txt weight={800} numberOfLines={1} style={{ fontSize: 13, color: palette.black, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 2 }}>
                {headlineOffer}
              </Txt>
            ) : null}
            <Txt weight={700} numberOfLines={1} style={styles.name}>
              {restaurant.name}
            </Txt>
            <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={styles.ratingDot}>
                <Star size={10} color={palette.white} fill={palette.white} strokeWidth={0} />
              </View>
              <Txt weight={600} style={{ fontSize: 14, color: palette.gray800 }}>
                {Number(restaurant.rating) > 0 ? Number(restaurant.rating).toFixed(1) : "New"}
              </Txt>
              {metaParts.length > 0 ? (
                <Txt weight={400} numberOfLines={1} style={{ flex: 1, fontSize: 14, color: palette.gray600 }}>
                  • {metaParts.join(" • ")}
                </Txt>
              ) : null}
            </View>
            <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <View style={[styles.openPill, availability.isOpen ? styles.openPillOpen : styles.openPillClosed]}>
                <Txt weight={800} style={{ fontSize: 10, letterSpacing: 1.5, color: availability.isOpen ? palette.green700 : palette.gray500 }}>
                  {availability.isOpen ? "OPEN NOW" : "CLOSED"}
                </Txt>
              </View>
              {availability.isOpen && availability.closingCountdownLabel && availability.openingTime && availability.closingTime ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Timer size={12} color={palette.black} strokeWidth={3} />
                  <Txt weight={700} style={{ fontSize: 11, color: palette.black }}>
                    {availability.closingCountdownLabel}
                  </Txt>
                </View>
              ) : null}
              {minItemPrice > 0 ? (
                <Txt weight={500} style={{ fontSize: 13, color: palette.gray600 }}>
                  • Items at ₹{minItemPrice}
                </Txt>
              ) : null}
            </View>
          </View>
          {!isBanned ? (
            <Pressable onPress={() => onToggleFavorite(restaurant, restaurantSlug, favorite)} hitSlop={6} style={[styles.bookmark, favorite && { backgroundColor: palette.red500, borderColor: palette.red500 }]}>
              <Bookmark size={18} color={favorite ? palette.white : palette.gray800} fill={favorite ? palette.white : "transparent"} />
            </Pressable>
          ) : null}
        </View>

        {previewItems.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 }} nestedScrollEnabled>
            {previewItems.map((item) => (
              <PreviewItemCard
                key={item.id || item.name}
                item={item}
                isRestaurantOpen={availability.isOpen}
                onSelect={(selected) => {
                  if (!availability.isOpen) {
                    toast.error("Restaurant is currently closed or timing is not available.");
                    return;
                  }
                  openItem(selected.id);
                }}
              />
            ))}
          </ScrollView>
        ) : (
          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 }}>
            <RestaurantImageCarousel restaurant={restaurant} autoPlay={!isBanned && availability.isOpen} onSlideClick={(slide) => slide?.id && slide?.isRecommended && openItem(slide.id)} height={176} radius={16} />
          </View>
        )}
      </RestaurantCarouselStateProvider>
    </Pressable>
  );
}

export default memo(HomeRestaurantCard);

const styles = StyleSheet.create({
  card: { borderRadius: 24, borderWidth: 1, borderColor: "rgba(229,231,235,0.8)", backgroundColor: palette.white, overflow: "hidden", elevation: 1 },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 16, paddingTop: 16 },
  franchise: { alignSelf: "flex-start", backgroundColor: "rgba(245,158,11,0.15)", paddingHorizontal: 10, paddingVertical: 2, borderRadius: 999, borderWidth: 1, borderColor: "rgba(245,158,11,0.3)", marginBottom: 4 },
  name: { fontSize: 20, color: "#030712", letterSpacing: -0.4, lineHeight: 24 },
  ratingDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: palette.green700, alignItems: "center", justifyContent: "center" },
  openPill: { paddingHorizontal: 10, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
  openPillOpen: { backgroundColor: palette.green50, borderColor: "#bbf7d0" },
  openPillClosed: { backgroundColor: palette.gray100, borderColor: palette.gray200 },
  bookmark: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: palette.gray200, backgroundColor: palette.white, alignItems: "center", justifyContent: "center" },
  preview: { width: 150 },
  previewImgWrap: { height: 120, width: "100%", borderRadius: 16, overflow: "hidden", backgroundColor: palette.gray100 },
  popularTag: { position: "absolute", left: 8, top: 8, backgroundColor: palette.white, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  closedOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
  closedPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.85)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  plus: { position: "absolute", bottom: 8, right: 8, width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: "rgba(254,198,0,0.6)", backgroundColor: palette.white, alignItems: "center", justifyContent: "center", elevation: 2 },
});
