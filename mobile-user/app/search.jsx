/** Port of pages/user/search/ProfessionalSearch.jsx (+ PremiumLoader, voice overlay). */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Star, Clock, Search, BadgePercent, Mic, X, History, MapPin, Utensils, Flame } from "lucide-react-native";
import Txt from "../src/components/ui/Txt";
import Screen from "../src/components/ui/Screen";
import AppImage from "../src/components/ui/AppImage";
import BottomSheet from "../src/components/ui/BottomSheet";
import { LinearGradient } from "../src/components/ui/LinearGradient";
import { searchAPI, getPublicCategories } from "../src/api";
import { useAppLocation } from "../src/context/LocationProvider";
import { useVoiceSearch } from "../src/hooks/useVoiceSearch";
import { calculateDistance } from "../src/utils/common";
import { getMediaUrl } from "../src/utils/media";
import { readScopedValue, writeScopedValue } from "../src/utils/storage";
import { palette, fonts } from "../src/theme";

const sessionSearchCache = new Map();
const sessionCategoriesCache = new Map();
const readHistory = () => {
  const v = readScopedValue("search", "professional-history", { fallback: null });
  return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 5) : [];
};
const persistHistory = (h) => writeScopedValue("search", "professional-history", (Array.isArray(h) ? h : []).filter((x) => typeof x === "string").slice(0, 5));
function useDebounce(v, d) {
  const [x, setX] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setX(v), d);
    return () => clearTimeout(t);
  }, [v, d]);
  return x;
}
const img = (u) => (u && typeof u === "string" ? getMediaUrl(u) : null);

function useLoop(duration, delay = 0) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([Animated.delay(delay), Animated.timing(v, { toValue: 1, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }), Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true })]));
    a.start();
    return () => a.stop();
  }, [v, duration, delay]);
  return v;
}
function PremiumLoader() {
  const spin = useLoop(3000);
  const pulse = useLoop(1500);
  const dots = [useLoop(600, 0), useLoop(600, 150), useLoop(600, 300)];
  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 80, minHeight: 300 }}>
      <View style={{ width: 96, height: 96, alignItems: "center", justifyContent: "center" }}>
        <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 48, backgroundColor: "rgba(254,198,0,0.2)", transform: [{ scale: pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.2, 1] }) }] }]} />
        <Animated.View style={[styles.loaderCircle, { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }]}>
          <View style={{ position: "absolute", top: -8, width: 16, height: 16, borderRadius: 8, backgroundColor: palette.yellow }} />
          <Utensils size={24} color={palette.amber600} />
        </Animated.View>
        <Flame size={16} color="#a05485" style={{ position: "absolute", top: 8, right: 8 }} />
        <Flame size={12} color={palette.amber600} style={{ position: "absolute", top: 16, left: 8 }} />
      </View>
      <Txt weight={900} style={{ marginTop: 24, fontSize: 14, color: palette.gray800, letterSpacing: 1 }}>PREPARING RESULTS</Txt>
      <View style={{ flexDirection: "row", gap: 4, marginTop: 8 }}>
        {dots.map((d, i) => (
          <Animated.View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: palette.yellow, transform: [{ translateY: d.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -5, 0] }) }] }} />
        ))}
      </View>
    </View>
  );
}
function ListeningOverlay({ onClose }) {
  const ring = useLoop(20000);
  const pulse = useLoop(1500);
  const bars = [6, 12, 20, 32, 48, 36, 24, 14, 8];
  const Wing = ({ reverse }) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 96 }}>
      {bars.map((h, i) => (
        <Bar key={i} h={h} delay={(reverse ? 8 - i : i) * 100} />
      ))}
    </View>
  );
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: "#050505", alignItems: "center", justifyContent: "center", zIndex: 100 }]}>
      <Pressable onPress={onClose} style={{ position: "absolute", top: 48, left: 24, padding: 12, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.05)" }}><ArrowLeft size={24} color="rgba(255,255,255,0.5)" /></Pressable>
      <View style={{ width: 280, height: 280, alignItems: "center", justifyContent: "center", marginBottom: 48 }}>
        <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 140, borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(220,38,38,0.3)", transform: [{ rotate: ring.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }]} />
        <Animated.View style={{ position: "absolute", top: 32, left: 32, right: 32, bottom: 32, borderRadius: 999, borderWidth: 1, borderColor: "rgba(220,38,38,0.8)", transform: [{ scale: pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.05, 1] }) }] }} />
        <View style={{ position: "absolute", left: -40 }}><Wing /></View>
        <View style={{ position: "absolute", right: -40 }}><Wing reverse /></View>
        <LinearGradient colors={["#2a2a2a", "#0a0a0a"]} style={styles.micCore}>
          <Animated.View style={{ transform: [{ scale: pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.15, 1] }) }] }}>
            <Mic size={56} color={palette.red500} fill={palette.red500} strokeWidth={1} />
          </Animated.View>
        </LinearGradient>
      </View>
      <Txt weight={700} style={{ fontSize: 22, color: palette.red500, letterSpacing: 0.5 }}>Listening...</Txt>
      <Txt weight={500} style={{ fontSize: 15, color: palette.gray400, textAlign: "center", marginTop: 16, maxWidth: 200 }}>How can we help{"\n"}you with your order?</Txt>
    </View>
  );
}
function Bar({ h, delay }) {
  const v = useLoop(1200, delay);
  return <Animated.View style={{ width: 6, height: h, borderRadius: 3, backgroundColor: "#dc2626", transform: [{ scaleY: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.5, 1] }) }] }} />;
}

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const { location: userCoords, zoneId } = useAppLocation();
  const [query, setQuery] = useState(String(params.q || ""));
  const debounced = useDebounce(query, 500);
  const [results, setResults] = useState({ restaurants: [], dishes: [] });
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(params.cat ? String(params.cat) : null);
  const [history, setHistory] = useState([]);
  const [selectedDish, setSelectedDish] = useState(null);
  const historyRef = useRef([]);
  historyRef.current = history;

  const addToHistory = (term) => {
    const h = [term, ...historyRef.current.filter((x) => x !== term)].slice(0, 5);
    setHistory(h);
    persistHistory(h);
  };
  const { isListening, startListening, stopListening } = useVoiceSearch((t) => {
    setQuery(t);
    addToHistory(t);
  });
  useEffect(() => {
    if (params.voice === "true") setTimeout(startListening, 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setHistory(readHistory());
    const key = String(zoneId || "global");
    if (sessionCategoriesCache.has(key)) {
      setCategories(sessionCategoriesCache.get(key));
      return;
    }
    getPublicCategories(zoneId || null)
      .then((p) => {
        const list = Array.isArray(p?.categories) ? p.categories : Array.isArray(p) ? p : null;
        if (list) {
          sessionCategoriesCache.set(key, list);
          setCategories(list);
        }
      })
      .catch(() => {});
  }, [zoneId]);

  const performSearch = useCallback(
    async (term, catId) => {
      if (!term && !catId) {
        setResults({ restaurants: [], dishes: [] });
        return;
      }
      const key = `${term}-${catId}-${zoneId}`;
      if (sessionSearchCache.has(key)) {
        setResults(sessionSearchCache.get(key));
        return;
      }
      setLoading(true);
      try {
        const r = await searchAPI.unifiedSearch({ q: term, categoryId: catId, lat: userCoords?.latitude, lng: userCoords?.longitude, zoneId });
        if (r.data?.success) {
          const all = r.data.data.restaurants || [];
          const parsed = { restaurants: all.filter((x) => x.matchType === "restaurant" || !x.matchType), dishes: all.filter((x) => x.matchType === "food") };
          sessionSearchCache.set(key, parsed);
          setResults(parsed);
        }
      } catch {
      } finally {
        setLoading(false);
      }
    },
    [userCoords, zoneId],
  );
  useEffect(() => {
    performSearch(debounced, selectedCategoryId);
    router.setParams({ q: debounced || undefined, cat: selectedCategoryId || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, selectedCategoryId, performSearch]);

  const handleClear = () => {
    setQuery("");
    setSelectedCategoryId(null);
    setResults({ restaurants: [], dishes: [] });
  };
  const goRestaurant = (r, dishId) => router.push({ pathname: `/restaurants/${r.slug || r.originalRestaurantId || r._id}`, params: dishId ? { dish: String(dishId) } : {} });

  return (
    <Screen bg="#f8fafc">
      <View style={styles.header}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={{ padding: 6, borderRadius: 999 }}><ArrowLeft size={20} color={palette.gray700} /></Pressable>
        <View style={{ flex: 1, justifyContent: "center" }}>
          <Search size={16} color={palette.amber600} strokeWidth={2.5} style={{ position: "absolute", left: 14, zIndex: 1 }} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={(t) => {
              setQuery(t);
              if (t && selectedCategoryId) setSelectedCategoryId(null);
            }}
            onSubmitEditing={() => query.trim() && addToHistory(query.trim())}
            returnKeyType="search"
            placeholder="Search dishes or restaurants"
            placeholderTextColor={palette.gray400}
            style={styles.input}
          />
          <View style={{ position: "absolute", right: 6, flexDirection: "row", alignItems: "center", gap: 4 }}>
            {query ? <Pressable onPress={handleClear} style={{ padding: 6 }}><X size={16} color={palette.gray400} /></Pressable> : null}
            <View style={{ width: 1, height: 16, backgroundColor: palette.gray200, marginHorizontal: 2 }} />
            <Pressable onPress={() => (isListening ? stopListening() : startListening())} style={[{ padding: 6, borderRadius: 12 }, isListening && { backgroundColor: palette.red50 }]}>
              <Mic size={20} color={isListening ? palette.red500 : palette.amber600} />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 32 + insets.bottom }}>
        {!query && !loading && history.length > 0 ? (
          <View style={{ marginBottom: 24 }}>
            <Txt weight={900} style={styles.sectionLabel}>RECENT SEARCHES</Txt>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {history.map((t, i) => (
                <Pressable
                  key={i}
                  onPress={() => {
                    setQuery(t);
                    setSelectedCategoryId(null);
                  }}
                  style={styles.historyChip}
                >
                  <History size={14} color={palette.gray400} />
                  <Txt weight={700} style={{ fontSize: 12, color: palette.gray600 }}>{t}</Txt>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {!query && !loading ? (
          <View style={{ marginBottom: 32 }}>
            <Txt weight={900} style={[styles.sectionLabel, { marginBottom: 16 }]}>TRENDING CATEGORIES</Txt>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingVertical: 8, paddingHorizontal: 4 }}>
              {categories
                .filter((c) => c.image)
                .slice(0, 15)
                .map((c) => {
                  const sel = selectedCategoryId === c._id;
                  return (
                    <Pressable key={c._id} onPress={() => setSelectedCategoryId(sel ? null : c._id)} style={{ width: 64, alignItems: "center" }}>
                      <View style={[styles.catRing, sel ? { borderWidth: 3, borderColor: palette.yellow, backgroundColor: palette.white } : null]}>
                        <View style={{ flex: 1, borderRadius: 999, overflow: "hidden", backgroundColor: palette.white }}>
                          <AppImage src={img(c.image)} style={StyleSheet.absoluteFill} width={160} />
                        </View>
                      </View>
                      <Txt weight={700} numberOfLines={2} style={{ fontSize: 10, textAlign: "center", lineHeight: 13, color: sel ? palette.amber600 : palette.gray600 }}>{c.name}</Txt>
                    </Pressable>
                  );
                })}
            </ScrollView>
          </View>
        ) : null}

        {loading ? <PremiumLoader /> : null}

        {!loading && (query || selectedCategoryId) ? (
          <View style={{ gap: 32 }}>
            {results.dishes.length > 0 ? (
              <View>
                <View style={styles.resHead}>
                  <Txt weight={900} style={styles.resTitle}>MATCHED DISHES</Txt>
                  <View style={styles.count}><Txt weight={700} style={{ fontSize: 10, color: palette.gray400 }}>{results.dishes.length} results</Txt></View>
                </View>
                <View style={{ gap: 16 }}>
                  {results.dishes.map((r) => (
                    <Pressable key={r._id} onPress={() => setSelectedDish(r)} style={styles.dishCard}>
                      <View style={{ width: 96, height: 96, borderRadius: 16, overflow: "hidden", backgroundColor: palette.gray200 }}>
                        <AppImage src={img(r.matchedDishImage || r.profileImage || r.image || (Array.isArray(r.images) && r.images[0]))} style={StyleSheet.absoluteFill} width={300} />
                        {r.pureVegRestaurant ? (
                          <View style={styles.vegDot}><View style={{ flex: 1, borderRadius: 6, backgroundColor: palette.green600 }} /></View>
                        ) : null}
                      </View>
                      <View style={{ flex: 1, minWidth: 0, paddingVertical: 4, justifyContent: "space-between" }}>
                        <View>
                          <View style={styles.restTag}><Txt weight={900} style={{ fontSize: 9, color: "#a05485", letterSpacing: 1 }}>{String(r.restaurantName || "").toUpperCase()}</Txt></View>
                          <Txt weight={900} numberOfLines={1} style={{ fontSize: 16, color: palette.gray900 }}>{r.matchedDish || query}</Txt>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
                            <Star size={12} color={palette.amber600} fill={palette.amber600} />
                            <Txt weight={900} style={{ fontSize: 11, color: palette.gray900 }}>{r.rating || "New"}</Txt>
                            <Txt style={{ color: palette.gray200 }}>•</Txt>
                            <Clock size={12} color={palette.gray500} />
                            <Txt weight={500} style={{ fontSize: 11, color: palette.gray500 }}>{r.estimatedDeliveryTime || "30-40 mins"}</Txt>
                          </View>
                          {r.matchedDishPrice || r.price ? (
                            <View style={{ backgroundColor: palette.gray50, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                              <Txt weight={900} style={{ fontSize: 14, color: palette.gray900 }}>₹{Number(r.matchedDishPrice || r.price).toFixed(2)}</Txt>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {results.restaurants.length > 0 ? (
              <View>
                <View style={styles.resHead}>
                  <Txt weight={900} style={styles.resTitle}>RESTAURANTS</Txt>
                  <View style={styles.count}><Txt weight={700} style={{ fontSize: 10, color: palette.gray400 }}>{results.restaurants.length} stores</Txt></View>
                </View>
                <View style={{ gap: 24 }}>
                  {results.restaurants.map((r) => (
                    <Pressable key={r._id} onPress={() => goRestaurant(r)}>
                      <View style={styles.restImg}>
                        <AppImage src={img(r.profileImage || r.image || (Array.isArray(r.images) && r.images[0]))} placeholderType="shop" style={StyleSheet.absoluteFill} width={900} />
                        <LinearGradient colors={["transparent", "rgba(0,0,0,0.2)", "rgba(0,0,0,0.8)"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[StyleSheet.absoluteFill, { opacity: 0.8 }]} />
                        <View style={{ position: "absolute", bottom: 16, left: 20, right: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
                          <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                            <Txt weight={900} numberOfLines={1} style={{ fontSize: 20, color: palette.white, marginBottom: 6 }}>{r.restaurantName}</Txt>
                            <Txt weight={700} numberOfLines={1} style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", letterSpacing: 1 }}>{String(r.cuisines?.join?.(", ") || "").toUpperCase()}</Txt>
                          </View>
                          <View style={styles.ratingGlass}>
                            <Star size={16} color={palette.white} fill={palette.white} />
                            <Txt weight={900} style={{ fontSize: 14, color: palette.white }}>{r.rating || "4.0"}</Txt>
                          </View>
                        </View>
                        {r.offer ? (
                          <View style={styles.offer}>
                            <BadgePercent size={14} color={palette.black} />
                            <Txt weight={900} style={{ fontSize: 10, color: palette.black }}>{String(r.offer).toUpperCase()}</Txt>
                          </View>
                        ) : null}
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Clock size={14} color={palette.amber600} />
                            <Txt weight={700} style={styles.meta}>{String(r.estimatedDeliveryTime || "30 mins").toUpperCase()}</Txt>
                          </View>
                          <Txt style={{ color: palette.gray200 }}>•</Txt>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <MapPin size={14} color={palette.amber600} />
                            <Txt weight={700} style={styles.meta}>
                              {userCoords?.latitude && r.location?.coordinates ? `${calculateDistance(userCoords.latitude, userCoords.longitude, r.location.coordinates[1], r.location.coordinates[0]).toFixed(1)} KM` : String(r.location?.area || "Nearby").toUpperCase()}
                            </Txt>
                          </View>
                        </View>
                        <LinearGradient colors={[palette.yellow, "#a05485"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 }}>
                          <Txt weight={900} style={{ fontSize: 10, color: palette.white, letterSpacing: 2 }}>VIEW MENU</Txt>
                        </LinearGradient>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {results.restaurants.length === 0 && results.dishes.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 80 }}>
                <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: palette.slate100, alignItems: "center", justifyContent: "center", marginBottom: 16 }}><Search size={32} color="#cbd5e1" /></View>
                <Txt weight={700} style={{ fontSize: 20, color: "#0f172a", marginBottom: 8 }}>We couldn't find any results</Txt>
                <Txt weight={400} style={{ fontSize: 14, color: palette.slate500, maxWidth: 280, textAlign: "center" }}>Maybe try searching for something else or check your spelling</Txt>
                <Pressable onPress={handleClear} style={styles.clearBtn}><Txt weight={500} style={{ fontSize: 14, color: "#f43f5e" }}>Clear all filters</Txt></Pressable>
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <BottomSheet visible={!!selectedDish} onClose={() => setSelectedDish(null)} rounded>
        {selectedDish ? (
          <View>
            <View style={{ height: 224, backgroundColor: palette.gray100, borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: "hidden" }}>
              <AppImage src={img(selectedDish.matchedDishImage || selectedDish.profileImage || selectedDish.image || (Array.isArray(selectedDish.images) && selectedDish.images[0]))} style={StyleSheet.absoluteFill} width={900} />
              <LinearGradient colors={["transparent", "rgba(0,0,0,0.6)"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
              <Pressable onPress={() => setSelectedDish(null)} style={styles.closeDish}><X size={20} color={palette.white} /></Pressable>
              <View style={{ position: "absolute", bottom: 16, left: 16, right: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  {selectedDish.pureVegRestaurant ? <View style={[styles.vegDot, { position: "relative", top: 0, left: 0 }]}><View style={{ flex: 1, borderRadius: 6, backgroundColor: palette.green500 }} /></View> : null}
                  <View style={{ backgroundColor: palette.yellow, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}><Txt weight={900} style={{ fontSize: 10, color: palette.black, letterSpacing: 1 }}>{String(selectedDish.restaurantName || "").toUpperCase()}</Txt></View>
                </View>
                <Txt weight={900} numberOfLines={2} style={{ fontSize: 24, color: palette.white, lineHeight: 28 }}>{selectedDish.matchedDish || selectedDish.name}</Txt>
              </View>
            </View>
            <View style={{ padding: 20 }}>
              <View style={{ flexDirection: "row", gap: 16, marginBottom: 16 }}>
                <View style={styles.pill}><Star size={14} color={palette.yellow500} fill={palette.yellow500} /><Txt weight={700} style={styles.pillTxt}>{String(selectedDish.rating || "New").toUpperCase()}</Txt></View>
                <View style={styles.pill}><Clock size={14} color={palette.gray700} /><Txt weight={700} style={styles.pillTxt}>{String(selectedDish.estimatedDeliveryTime || "30 mins").toUpperCase()}</Txt></View>
              </View>
              {selectedDish.matchedDishDescription || selectedDish.description ? (
                <View style={{ backgroundColor: palette.gray50, padding: 16, borderRadius: 16, marginBottom: 8 }}>
                  <Txt weight={400} style={{ fontSize: 14, color: palette.gray600, lineHeight: 22 }}>{selectedDish.matchedDishDescription || selectedDish.description}</Txt>
                </View>
              ) : null}
            </View>
            <View style={{ padding: 16, borderTopWidth: 1, borderColor: palette.gray100, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View>
                <Txt weight={700} style={{ fontSize: 12, color: palette.gray500, letterSpacing: 1 }}>PRICE</Txt>
                <Txt weight={900} style={{ fontSize: 24, color: palette.gray900 }}>{selectedDish.matchedDishPrice ? `₹${Number(selectedDish.matchedDishPrice).toFixed(2)}` : selectedDish.price ? `₹${Number(selectedDish.price).toFixed(2)}` : "₹-"}</Txt>
              </View>
              <Pressable
                onPress={() => {
                  const d = selectedDish;
                  setSelectedDish(null);
                  goRestaurant(d, d.matchedDishId);
                }}
                style={styles.viewAdd}
              >
                <Txt weight={900} style={{ fontSize: 14, color: palette.black, letterSpacing: 1 }}>VIEW & ADD</Txt>
              </Pressable>
            </View>
          </View>
        ) : null}
      </BottomSheet>

      {isListening ? <ListeningOverlay onClose={stopListening} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "rgba(255,255,255,0.95)", borderBottomWidth: 1, borderColor: palette.gray100 },
  input: { height: 44, paddingLeft: 40, paddingRight: 88, backgroundColor: palette.gray50, borderWidth: 1, borderColor: palette.gray100, borderRadius: 16, fontFamily: fonts.regular, fontSize: 14, color: palette.gray900 },
  sectionLabel: { fontSize: 11, color: palette.gray400, letterSpacing: 2, marginBottom: 12, paddingHorizontal: 4 },
  historyChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: palette.white, borderWidth: 1, borderColor: palette.gray200, borderRadius: 12 },
  catRing: { width: 64, height: 64, borderRadius: 32, marginBottom: 8, padding: 2, borderWidth: 1, borderColor: "rgba(229,231,235,0.8)", backgroundColor: palette.gray50 },
  resHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20, paddingHorizontal: 4 },
  resTitle: { fontSize: 14, color: palette.gray400, letterSpacing: 2 },
  count: { backgroundColor: palette.gray100, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  dishCard: { flexDirection: "row", gap: 16, padding: 12, backgroundColor: palette.white, borderRadius: 24, borderWidth: 1, borderColor: palette.gray100, elevation: 1 },
  vegDot: { position: "absolute", top: 6, left: 6, width: 16, height: 16, borderWidth: 1, borderColor: palette.green600, padding: 1.5, backgroundColor: palette.white, borderRadius: 2 },
  restTag: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, backgroundColor: "rgba(254,198,0,0.06)", borderRadius: 999, marginBottom: 4 },
  restImg: { borderRadius: 32, overflow: "hidden", aspectRatio: 16 / 10, marginBottom: 16, backgroundColor: palette.gray200, elevation: 6 },
  ratingGlass: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.15)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  offer: { position: "absolute", top: 20, left: 0, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: palette.yellow, paddingHorizontal: 16, paddingVertical: 8, borderTopRightRadius: 16, borderBottomRightRadius: 16, elevation: 6 },
  meta: { fontSize: 12, color: palette.gray500 },
  clearBtn: { marginTop: 24, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: "#f43f5e" },
  closeDish: { position: "absolute", top: 16, right: 16, width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", zIndex: 2 },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: palette.gray100, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  pillTxt: { fontSize: 12, color: palette.gray700 },
  viewAdd: { paddingHorizontal: 32, paddingVertical: 14, backgroundColor: palette.yellow, borderRadius: 16, elevation: 6 },
  loaderCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: palette.white, borderWidth: 4, borderColor: palette.gray50, alignItems: "center", justifyContent: "center", elevation: 8 },
  micCore: { width: 144, height: 144, borderRadius: 72, borderWidth: 4, borderColor: "#111", alignItems: "center", justifyContent: "center", elevation: 12, shadowColor: "#dc2626", shadowOpacity: 0.3, shadowRadius: 30 },
});
