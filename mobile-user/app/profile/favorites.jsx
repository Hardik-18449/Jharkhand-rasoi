/** Port of pages/user/profile/Favorites.jsx (2-column grid at phone width). */
import React, { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Heart, Star, Clock, MapPin, ArrowRight, ArrowLeft, Bookmark } from "lucide-react-native";
import Txt from "../../src/components/ui/Txt";
import Screen from "../../src/components/ui/Screen";
import AppImage from "../../src/components/ui/AppImage";
import Button from "../../src/components/ui/Button";
import RequireAuth from "../../src/components/RequireAuth";
import { LinearGradient } from "../../src/components/ui/LinearGradient";
import { useProfile } from "../../src/context/ProfileContext";
import { toast } from "../../src/utils/toast";
import { palette } from "../../src/theme";

const FALLBACK = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop&q=80";
const confirm = (msg, onOk) => Alert.alert("Confirm", msg, [{ text: "Cancel", style: "cancel" }, { text: "OK", onPress: onOk }]);

function FavoritesScreen() {
  const router = useRouter();
  const { getFavorites, removeFavorite, getDishFavorites, removeDishFavorite } = useProfile();
  const restaurants = getFavorites();
  const dishes = getDishFavorites();
  const [tab, setTab] = useState("restaurants");
  const back = () => (router.canGoBack() ? router.back() : router.replace("/profile"));

  const Header = ({ withCounts }) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
      <Pressable onPress={back} style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" }}><ArrowLeft size={16} color={palette.gray900} /></Pressable>
      <View>
        <Txt weight={700} style={{ fontSize: 18, color: palette.gray900 }}>My Favorites</Txt>
        {withCounts ? (
          <Txt weight={600} style={{ fontSize: 14, color: palette.gray700, marginTop: 4 }}>
            {dishes.length || 0} {dishes.length === 1 ? "dish" : "dishes"} • {restaurants.length || 0} {restaurants.length === 1 ? "restaurant" : "restaurants"}
          </Txt>
        ) : null}
      </View>
    </View>
  );
  const Empty = ({ Icon, text, cta }) => (
    <View style={{ alignItems: "center", paddingVertical: 48, width: "100%" }}>
      <Icon size={64} color={palette.gray400} />
      <Txt weight={400} style={{ fontSize: 18, color: palette.gray500, marginVertical: 16 }}>{text}</Txt>
      <Button title={cta} rounded="md" onPress={() => router.replace("/")} />
    </View>
  );

  if (restaurants.length + dishes.length === 0) {
    return (
      <Screen bg="#fffef7">
        <View style={{ padding: 16 }}>
          <Header />
          <View style={styles.card}>
            <Empty Icon={Heart} text="You haven't added any favorites yet" cta="Explore Restaurants" />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen bg="#fffef7">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Header withCounts />
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 24, borderBottomWidth: 1, borderColor: palette.gray200 }}>
          {[
            ["restaurants", `Restaurants (${restaurants.length})`],
            ["dishes", `Dishes (${dishes.length})`],
          ].map(([k, l]) => (
            <Pressable key={k} onPress={() => setTab(k)} style={[{ paddingHorizontal: 16, paddingVertical: 8 }, tab === k && { borderBottomWidth: 2, borderColor: palette.yellow }]}>
              <Txt weight={500} style={{ fontSize: 15, color: tab === k ? palette.amber600 : palette.gray500 }}>{l}</Txt>
            </Pressable>
          ))}
        </View>

        <View style={styles.grid}>
          {tab === "restaurants"
            ? restaurants.length === 0
              ? <Empty Icon={Heart} text="No restaurants saved yet" cta="Explore Restaurants" />
              : restaurants.map((r) => (
                  <Pressable key={r.slug} onPress={() => router.push(`/restaurants/${r.slug}`)} style={[styles.card, styles.cell]}>
                    <View style={{ height: 128 }}>
                      <AppImage src={r.image || FALLBACK} fallbackSrc={FALLBACK} style={StyleSheet.absoluteFill} width={500} />
                      <LinearGradient colors={["transparent", "rgba(0,0,0,0.6)"]} start={{ x: 0, y: 0.4 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
                      <Pressable
                        onPress={() =>
                          confirm("Remove this restaurant from favorites?", () => {
                            removeFavorite(r.slug);
                            toast.success("Restaurant removed from favorites");
                          })
                        }
                        style={styles.heart}
                      >
                        <Heart size={16} color={palette.red500} fill={palette.red500} />
                      </Pressable>
                      <View style={styles.rating}>
                        <Star size={12} color={palette.yellow400} fill={palette.yellow400} />
                        <Txt weight={700} style={{ fontSize: 12, color: palette.gray900 }}>{r.rating}</Txt>
                      </View>
                    </View>
                    <View style={{ padding: 12, gap: 8 }}>
                      <View>
                        <Txt weight={700} numberOfLines={1} style={{ fontSize: 14, color: palette.gray900, marginBottom: 2 }}>{r.name}</Txt>
                        <Txt weight={500} numberOfLines={1} style={{ fontSize: 12, color: palette.gray500 }}>{r.cuisine}</Txt>
                      </View>
                      <View style={styles.meta}>
                        <View style={styles.metaItem}><Clock size={12} color={palette.gray500} /><Txt weight={500} style={styles.metaTxt}>{r.deliveryTime}</Txt></View>
                        <View style={styles.metaItem}><MapPin size={12} color={palette.gray500} /><Txt weight={500} style={styles.metaTxt}>{r.distance}</Txt></View>
                      </View>
                      <View style={styles.viewBtn}><Txt weight={600} style={{ fontSize: 12, color: palette.black }}>View Restaurant</Txt><ArrowRight size={12} color={palette.black} /></View>
                    </View>
                  </Pressable>
                ))
            : dishes.length === 0
              ? <Empty Icon={Bookmark} text="No dishes saved yet" cta="Explore Dishes" />
              : dishes.map((d) => (
                  <Pressable key={`${d.id}-${d.restaurantId}`} onPress={() => router.push({ pathname: `/restaurants/${d.restaurantSlug || ""}`, params: { dish: String(d.id) } })} style={[styles.card, styles.cell]}>
                    <View style={{ height: 128 }}>
                      <AppImage src={d.image || FALLBACK} fallbackSrc={FALLBACK} style={StyleSheet.absoluteFill} width={500} />
                      <LinearGradient colors={["transparent", "rgba(0,0,0,0.6)"]} start={{ x: 0, y: 0.4 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
                      <Pressable
                        onPress={() =>
                          confirm("Remove this dish from favorites?", () => {
                            removeDishFavorite(d.id, d.restaurantId);
                            toast.success("Dish removed from favorites");
                          })
                        }
                        style={styles.heart}
                      >
                        <Bookmark size={16} color={palette.red500} fill={palette.red500} />
                      </Pressable>
                    </View>
                    <View style={{ padding: 12, gap: 8 }}>
                      <View>
                        <Txt weight={700} numberOfLines={1} style={{ fontSize: 14, color: palette.gray900, marginBottom: 2 }}>{d.name}</Txt>
                        <Txt weight={400} numberOfLines={1} style={{ fontSize: 12, color: palette.gray500 }}>{d.restaurantName || "Restaurant"}</Txt>
                      </View>
                      <View style={styles.meta}>
                        <View style={styles.metaItem}>
                          <View style={{ width: 12, height: 12, borderWidth: 2, borderColor: d.foodType === "Veg" ? palette.green600 : palette.red600, borderRadius: 2, alignItems: "center", justifyContent: "center" }}>
                            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: d.foodType === "Veg" ? palette.green600 : palette.red600 }} />
                          </View>
                          <Txt weight={500} style={styles.metaTxt}>{d.foodType || "N/A"}</Txt>
                        </View>
                        <Txt weight={700} style={{ fontSize: 14, color: palette.amber600 }}>₹{Math.round(d.price || 0)}</Txt>
                      </View>
                      <View style={styles.viewBtn}><Txt weight={600} style={{ fontSize: 12, color: palette.black }}>View Dish</Txt><ArrowRight size={12} color={palette.black} /></View>
                    </View>
                  </Pressable>
                ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

export default function FavoritesRoute() {
  return (
    <RequireAuth>
      <FavoritesScreen />
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: palette.white, borderRadius: 12, borderWidth: 1, borderColor: palette.gray200, overflow: "hidden" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  cell: { width: "47%" },
  heart: { position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.9)", alignItems: "center", justifyContent: "center" },
  rating: { position: "absolute", bottom: 8, left: 8, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.9)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  meta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTopWidth: 1, borderColor: palette.gray200 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaTxt: { fontSize: 12, color: palette.gray500 },
  viewBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, height: 32, borderRadius: 6, backgroundColor: palette.yellow },
});
