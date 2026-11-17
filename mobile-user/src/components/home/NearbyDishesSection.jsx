/** Port of components/user/home/NearbyDishesSection.jsx */
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { Utensils, Store } from "lucide-react-native";
import Txt from "../ui/Txt";
import Skeleton from "../ui/Skeleton";
import AddToCartButton from "../AddToCartButton";
import { getPublicFoods } from "../../api";
import { getRestaurantAvailabilityStatus } from "../../utils/restaurantAvailability";
import { getMediaUrl } from "../../utils/media";
import { toast } from "../../utils/toast";
import { palette } from "../../theme";

const FALLBACK_IMG = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=60";

export default function NearbyDishesSection({ zoneId }) {
  const router = useRouter();
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        setLoading(true);
        const params = { limit: 16 };
        if (zoneId) params.zoneId = zoneId;
        const res = await getPublicFoods(params);
        const items = Array.isArray(res?.foods) ? res.foods : Array.isArray(res?.data?.foods) ? res.data.foods : [];
        if (isMounted) setDishes(items.filter((item) => item?.name && item?.price > 0));
      } catch {
        // keep empty
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [zoneId]);

  if (!loading && dishes.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={{ marginBottom: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={styles.iconBox}>
            <Utensils size={16} color={palette.black} />
          </View>
          <Txt weight={800} style={{ fontSize: 20, color: palette.gray900, letterSpacing: -0.4 }}>
            Popular Dishes Nearby
          </Txt>
        </View>
        <Txt weight={400} style={{ fontSize: 12, color: palette.gray500, marginTop: 4 }}>
          Discover and order favorite dishes directly from nearby restaurants
        </Txt>
      </View>
      {loading ? (
        <View style={styles.grid}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} style={styles.cell} height={240} radius={16} color={palette.gray100} />
          ))}
        </View>
      ) : (
        <View style={styles.grid}>
          {dishes.map((dish) => {
            const isVeg = dish.foodType === "Veg" || dish.isVeg === true || String(dish.categoryName || "").toLowerCase().includes("veg");
            const price = Number(dish.prepaidPrice || dish.price) || 0;
            const codPrice = Number(dish.codPrice) || 0;
            const hasCashlessDiscount = codPrice > price;
            const onlineSaving = Math.round((codPrice - price) * 100) / 100;
            const onlineSavingLabel = Number.isInteger(onlineSaving) ? String(onlineSaving) : onlineSaving.toFixed(2);
            const isRestaurantOpen = dish.restaurant ? getRestaurantAvailabilityStatus(dish.restaurant).isOpen : dish.isRestaurantOpen !== false;
            const isDishAvailable = dish.isAvailable !== false && isRestaurantOpen;
            const cartItem = {
              id: String(dish.id || dish._id),
              name: dish.name,
              price,
              prepaidPrice: price,
              codPrice: codPrice > 0 ? codPrice : null,
              restaurantId: String(dish.restaurantId || ""),
              restaurant: dish.restaurantName || "Restaurant",
              restaurantSlug: dish.restaurantSlug || String(dish.restaurantId || ""),
              image: dish.image,
              foodType: dish.foodType || (isVeg ? "Veg" : "Non-Veg"),
              isVeg,
              isAvailable: isDishAvailable,
              isRestaurantOpen,
            };
            const restaurantUrl = `/restaurants/${dish.restaurantSlug || dish.restaurantId}`;
            return (
              <View key={dish.id || dish._id} style={[styles.cell, styles.dishCard, !isDishAvailable && { opacity: 0.8 }]}>
                <View>
                  <View style={styles.dishImg}>
                    <Image source={{ uri: getMediaUrl(dish.image) || FALLBACK_IMG }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} blurRadius={!isDishAvailable ? 2 : 0} />
                    <View style={styles.vegBadge}>
                      <View style={{ width: 14, height: 14, borderRadius: 3, borderWidth: 1, borderColor: isVeg ? palette.green600 : palette.red600, alignItems: "center", justifyContent: "center" }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isVeg ? palette.green600 : palette.red600 }} />
                      </View>
                    </View>
                    {!isDishAvailable ? (
                      <View style={styles.closedOverlay}>
                        <View style={styles.closedPill}>
                          <Txt weight={800} style={{ fontSize: 10, color: palette.white, letterSpacing: 1 }}>
                            CLOSED
                          </Txt>
                        </View>
                      </View>
                    ) : hasCashlessDiscount ? (
                      <View style={styles.saveTag}>
                        <Txt weight={700} style={{ fontSize: 10, color: palette.white }}>
                          Save ₹{onlineSavingLabel} online
                        </Txt>
                      </View>
                    ) : null}
                  </View>
                  <Txt weight={700} numberOfLines={1} style={{ fontSize: 14, color: palette.gray900 }}>
                    {dish.name}
                  </Txt>
                  {dish.restaurantName ? (
                    <Pressable onPress={() => router.push(restaurantUrl)} style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                      <Store size={12} color={palette.gray500} />
                      <Txt weight={400} numberOfLines={1} style={{ flex: 1, fontSize: 11, color: palette.gray500 }}>
                        {dish.restaurantName}
                      </Txt>
                    </Pressable>
                  ) : null}
                </View>
                <View style={styles.footerRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
                      <Txt weight={800} style={{ fontSize: 14, color: palette.gray900 }}>
                        ₹{price}
                      </Txt>
                      {hasCashlessDiscount ? (
                        <Txt weight={400} style={{ fontSize: 10, color: palette.gray400, textDecorationLine: "line-through" }}>
                          ₹{codPrice}
                        </Txt>
                      ) : null}
                    </View>
                    {hasCashlessDiscount ? (
                      <Txt weight={700} style={{ fontSize: 9, color: palette.emerald600 }}>
                        Prepaid Price
                      </Txt>
                    ) : codPrice > 0 ? (
                      <Txt weight={400} style={{ fontSize: 9, color: palette.gray400 }}>
                        COD: ₹{codPrice}
                      </Txt>
                    ) : null}
                  </View>
                  {isDishAvailable ? (
                    <AddToCartButton item={cartItem} />
                  ) : (
                    <Pressable onPress={() => toast.error("Restaurant is currently offline or timing is not available.")} style={styles.closedBtn}>
                      <Txt weight={700} style={{ fontSize: 12, color: palette.gray400 }}>
                        Closed
                      </Txt>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 40, marginBottom: 32, paddingHorizontal: 16 },
  iconBox: { width: 32, height: 32, borderRadius: 12, backgroundColor: palette.orange100, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 14 },
  cell: { width: "48%" },
  dishCard: { justifyContent: "space-between", borderRadius: 16, borderWidth: 1, borderColor: "rgba(229,231,235,0.8)", backgroundColor: palette.white, padding: 12, elevation: 1 },
  dishImg: { aspectRatio: 4 / 3, width: "100%", borderRadius: 12, overflow: "hidden", backgroundColor: palette.gray100, marginBottom: 10 },
  vegBadge: { position: "absolute", top: 8, left: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.95)", padding: 4, zIndex: 10 },
  closedOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", zIndex: 10 },
  closedPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.85)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  saveTag: { position: "absolute", bottom: 8, left: 8, borderRadius: 6, backgroundColor: "rgba(5,150,105,0.9)", paddingHorizontal: 6, paddingVertical: 2 },
  footerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: palette.gray100 },
  closedBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: palette.gray100 },
});
