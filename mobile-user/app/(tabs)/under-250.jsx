/** Under ₹N — port of pages/user/Under250.jsx */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { Star, ArrowDownUp, Timer, ArrowRight, ChevronDown, Bookmark, Share2, Plus, Minus, X, UtensilsCrossed } from "lucide-react-native";
import Screen from "../../src/components/ui/Screen";
import Txt from "../../src/components/ui/Txt";
import Skeleton from "../../src/components/ui/Skeleton";
import AppImage from "../../src/components/ui/AppImage";
import BottomSheet from "../../src/components/ui/BottomSheet";
import Spinner from "../../src/components/ui/Spinner";
import StickyCartCard from "../../src/components/StickyCartCard";
import { shareLink, WEB_ORIGIN } from "../../src/components/ui/ShareSheet";
import { useAppLocation } from "../../src/context/LocationProvider";
import { useCart } from "../../src/context/CartContext";
import { restaurantAPI, publicGetOnce, getPublicLandingSettings, getPublicCategories } from "../../src/api";
import { isModuleAuthenticated } from "../../src/auth/session";
import { flattenMenuItems, getMenuFromResponse } from "../../src/utils/menuItems";
import { calculateDistance, formatDistance, getItemDiscountPercent } from "../../src/utils/common";
import { getRestaurantAvailabilityStatus } from "../../src/utils/restaurantAvailability";
import { toast } from "../../src/utils/toast";
import { palette } from "../../src/theme";

const R = "₹";
const pageCache = { zoneId: null, categories: null, bannerImages: null, under250Restaurants: null, allRawRestaurants: null, visibleRestaurantCount: 0, hasMore: true, fetchedIds: null };
const sortOptions = [
  { id: null, label: "Relevance" },
  { id: "rating-high", label: "Rating: High to Low" },
  { id: "delivery-time-low", label: "Estimated Time: Low to High" },
  { id: "distance-low", label: "Distance: Low to High" },
];
const parseDeliveryTime = (v) => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (!v) return 999;
  const s = String(v);
  const r = s.match(/(\d+)\s*-\s*(\d+)/);
  if (r) return (parseInt(r[1], 10) + parseInt(r[2], 10)) / 2;
  const m = s.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 999;
};
const parseDistance = (v) => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (!v) return 999;
  const s = String(v);
  const m = s.match(/(\d+\.?\d*)/);
  if (!m) return 999;
  const n = parseFloat(m[1]);
  return s.toLowerCase().includes("m") && !s.toLowerCase().includes("km") ? n / 1000 : n;
};

function VegMark({ isVeg, size = 14 }) {
  const c = isVeg ? palette.green600 : palette.red600;
  return (
    <View style={{ width: size, height: size, borderRadius: 3, borderWidth: 1, borderColor: c, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: size * 0.57, height: size * 0.57, borderRadius: size, backgroundColor: c }} />
    </View>
  );
}

export default function Under250Screen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { location, zoneId, isOutOfService, serviceUnavailableMessage } = useAppLocation();
  const { addToCart, updateQuantity, removeFromCart, getCartItem, cart } = useCart();
  const isCacheValid = pageCache.zoneId === zoneId;

  const [showScan, setShowScan] = useState(true);
  const [activeCategory, setActiveCategory] = useState(null);
  const [isSwitchingCategory, setIsSwitchingCategory] = useState(false);
  const [showSortPopup, setShowSortPopup] = useState(false);
  const [selectedSort, setSelectedSort] = useState(null);
  const [draftSelectedSort, setDraftSelectedSort] = useState(null);
  const [under30MinsFilter, setUnder30MinsFilter] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemDetailQuantity, setItemDetailQuantity] = useState(1);
  const [bookmarkedItems, setBookmarkedItems] = useState(new Set());
  const [categories, setCategories] = useState(() => (isCacheValid ? pageCache.categories || [] : []));
  const [loadingCategories, setLoadingCategories] = useState(() => !(isCacheValid && pageCache.categories));
  const [bannerImages, setBannerImages] = useState(() => (isCacheValid ? pageCache.bannerImages || [] : []));
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [under250Restaurants, setUnder250Restaurants] = useState(() => (isCacheValid ? pageCache.under250Restaurants || [] : []));
  const [loadingRestaurants, setLoadingRestaurants] = useState(() => !(isCacheValid && pageCache.allRawRestaurants));
  const [under250PriceLimit, setUnder250PriceLimit] = useState(250);
  const [allRawRestaurants, setAllRawRestaurants] = useState(() => (isCacheValid ? pageCache.allRawRestaurants || [] : []));
  const [visibleRestaurantCount, setVisibleRestaurantCount] = useState(() => (isCacheValid ? pageCache.visibleRestaurantCount || 0 : 0));
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(() => (isCacheValid ? pageCache.hasMore !== false : true));
  const fetchedIdsRef = useRef(isCacheValid && pageCache.fetchedIds ? new Set(pageCache.fetchedIds) : new Set());
  const bannerRef = useRef(null);
  const bannerIdx = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setShowScan(false), 2200);
    return () => clearTimeout(t);
  }, []);

  const quantities = useMemo(() => {
    const q = {};
    cart.forEach((i) => (q[i.id] = i.quantity || 0));
    return q;
  }, [cart]);

  // banners
  useEffect(() => {
    if (pageCache.zoneId === zoneId && pageCache.bannerImages?.length > 0) {
      setBannerImages(pageCache.bannerImages);
      return undefined;
    }
    let cancelled = false;
    publicGetOnce("/food/hero-banners/under-250/public", { params: { zoneId } })
      .then((res) => {
        if (cancelled) return;
        const data = res?.data?.data;
        const list = Array.isArray(data?.banners) ? data.banners : Array.isArray(data) ? data : [];
        const images = list.map((b) => (typeof b?.imageUrl === "string" ? b.imageUrl.trim() : "")).filter(Boolean);
        setBannerImages(images);
        pageCache.bannerImages = images;
        pageCache.zoneId = zoneId;
      })
      .catch(() => !cancelled && setBannerImages([]));
    return () => {
      cancelled = true;
    };
  }, [zoneId]);

  useEffect(() => {
    if (bannerImages.length <= 1) return undefined;
    const i = setInterval(() => {
      const next = (bannerIdx.current + 1) % bannerImages.length;
      bannerIdx.current = next;
      setCurrentBannerIndex(next);
      bannerRef.current?.scrollToIndex({ index: next, animated: true });
    }, 3500);
    return () => clearInterval(i);
  }, [bannerImages.length]);

  useEffect(() => {
    let cancelled = false;
    getPublicLandingSettings(zoneId)
      .then((s) => !cancelled && typeof s?.under250PriceLimit === "number" && setUnder250PriceLimit(s.under250PriceLimit))
      .catch(() => setUnder250PriceLimit(250));
    return () => {
      cancelled = true;
    };
  }, [zoneId]);

  // 1. raw list
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingRestaurants(true);
        const params = zoneId ? { zoneId } : {};
        if (location?.latitude && location?.longitude) {
          params.lat = location.latitude;
          params.lng = location.longitude;
        }
        const response = await restaurantAPI.getRestaurants(params);
        const raw = Array.isArray(response?.data?.data?.restaurants) ? response.data.data.restaurants : [];
        if (!cancelled) {
          setAllRawRestaurants(raw);
          setVisibleRestaurantCount(5);
          setUnder250Restaurants([]);
          fetchedIdsRef.current.clear();
          setHasMore(raw.length > 0);
          Object.assign(pageCache, { allRawRestaurants: raw, visibleRestaurantCount: 5, under250Restaurants: [], fetchedIds: new Set(), hasMore: raw.length > 0, zoneId });
        }
      } catch {
        if (!cancelled) setAllRawRestaurants([]);
      } finally {
        if (!cancelled) setLoadingRestaurants(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneId, isOutOfService]);

  // 2. menus for chunk
  useEffect(() => {
    if (allRawRestaurants.length === 0 || visibleRestaurantCount === 0) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const slice = allRawRestaurants.slice(0, visibleRestaurantCount);
        const toFetch = slice.filter((r) => {
          const id = String(r?.restaurantId || r?._id);
          return id && !fetchedIdsRef.current.has(id);
        });
        if (toFetch.length === 0) {
          if (!cancelled) {
            setHasMore(visibleRestaurantCount < allRawRestaurants.length);
            setLoadingMore(false);
          }
          return;
        }
        if (!cancelled) setLoadingMore(true);
        const userLat = Number(location?.latitude);
        const userLng = Number(location?.longitude);
        const results = await Promise.all(
          toFetch.map(async (restaurant) => {
            const restaurantId = restaurant?.restaurantId || restaurant?._id;
            if (!restaurantId) return null;
            try {
              const menuResponse = await restaurantAPI.getMenuByRestaurantId(restaurantId);
              const menuItems = flattenMenuItems(getMenuFromResponse(menuResponse))
                .filter((item) => Number(item?.price || 0) <= under250PriceLimit && item?.isAvailable !== false)
                .map((item) => {
                  const ft = String(item?.foodType || "").toLowerCase();
                  return {
                    ...item,
                    id: String(item?.id || item?._id || `${restaurantId}-${item?.name || "dish"}`),
                    price: Number(item?.price || 0),
                    isVeg: ft.includes("veg") && !ft.includes("non"),
                    image: item?.image || restaurant?.coverImages?.[0]?.url || restaurant?.coverImages?.[0] || restaurant?.menuImages?.[0]?.url || restaurant?.menuImages?.[0] || restaurant?.profileImage?.url || "",
                  };
                });
              if (menuItems.length === 0) return null;
              const deliveryMinutes = Number(restaurant?.estimatedDeliveryTimeMinutes) || Number(restaurant?.estimatedDeliveryTime) || null;
              const rl = restaurant?.location;
              const rLat = Number(rl?.latitude ?? (Array.isArray(rl?.coordinates) ? rl.coordinates[1] : null));
              const rLng = Number(rl?.longitude ?? (Array.isArray(rl?.coordinates) ? rl.coordinates[0] : null));
              const distanceInKm =
                restaurant?.distanceInKm !== undefined ? restaurant.distanceInKm : Number.isFinite(userLat) && Number.isFinite(userLng) && Number.isFinite(rLat) && Number.isFinite(rLng) ? calculateDistance(userLat, userLng, rLat, rLng) : null;
              const fallbackDistance = typeof restaurant?.distance === "number" ? formatDistance(restaurant.distance) : restaurant?.distanceText || restaurant?.distance || "";
              return {
                id: String(restaurantId),
                restaurantId: String(restaurantId),
                slug: restaurant?.slug || String(restaurant?.restaurantName || restaurant?.name || "").toLowerCase().replace(/\s+/g, "-"),
                name: restaurant?.restaurantName || restaurant?.name || "Restaurant",
                rating: Number(restaurant?.rating || 0),
                totalRatings: Number(restaurant?.totalRatings || restaurant?.ratingCount || 0),
                deliveryTime: restaurant?.estimatedDeliveryTime || (deliveryMinutes ? `${deliveryMinutes} mins` : "30 mins"),
                distance: restaurant?.distanceText || (distanceInKm !== null ? formatDistance(distanceInKm) : fallbackDistance),
                distanceInKm,
                discount: restaurant?.discount || 0,
                itemDiscounts: Array.isArray(restaurant?.itemDiscounts) ? restaurant.itemDiscounts : [],
                discountRules: Array.isArray(restaurant?.discountRules) ? restaurant.discountRules : [],
                isActive: restaurant?.isActive !== false,
                isAcceptingOrders: restaurant?.isAcceptingOrders !== false,
                openDays: Array.isArray(restaurant?.openDays) ? restaurant.openDays : [],
                outletTimings: restaurant?.outletTimings || null,
                deliveryTimings: restaurant?.deliveryTimings || null,
                openingTime: restaurant?.openingTime || restaurant?.deliveryTimings?.openingTime || null,
                closingTime: restaurant?.closingTime || restaurant?.deliveryTimings?.closingTime || null,
                originalIndex: allRawRestaurants.findIndex((r) => String(r?.restaurantId || r?._id) === String(restaurantId)),
                menuItems,
              };
            } catch {
              return null;
            }
          }),
        );
        if (!cancelled) {
          const valid = results.filter(Boolean);
          toFetch.forEach((r) => fetchedIdsRef.current.add(String(r?.restaurantId || r?._id)));
          setUnder250Restaurants((prev) => {
            const updated = [...prev, ...valid];
            pageCache.under250Restaurants = updated;
            return updated;
          });
          setHasMore(visibleRestaurantCount < allRawRestaurants.length);
          Object.assign(pageCache, { visibleRestaurantCount, hasMore: visibleRestaurantCount < allRawRestaurants.length, fetchedIds: new Set(fetchedIdsRef.current), zoneId });
        }
      } finally {
        if (!cancelled) setLoadingMore(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRawRestaurants, visibleRestaurantCount, location?.latitude, location?.longitude, under250PriceLimit]);

  // categories
  useEffect(() => {
    if (pageCache.zoneId === zoneId && pageCache.categories?.length > 0) {
      setCategories(pageCache.categories);
      setLoadingCategories(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoadingCategories(true);
        const payload = (await getPublicCategories(zoneId || null)) || {};
        const raw = Array.isArray(payload?.categories) ? payload.categories : Array.isArray(payload) ? payload : [];
        const mapped = raw
          .map((cat, index) => {
            const name = String(cat?.name || "").trim();
            if (!name) return null;
            return { id: String(cat?.id || cat?._id || cat?.slug || `cat-${index}`), name, slug: String(cat?.slug || name.toLowerCase().replace(/\s+/g, "-")), image: cat?.imageUrl || cat?.image || cat?.icon || "" };
          })
          .filter(Boolean);
        if (!cancelled) {
          setCategories(mapped);
          pageCache.categories = mapped;
          pageCache.zoneId = zoneId;
        }
      } catch {
        if (!cancelled) setCategories([]);
      } finally {
        if (!cancelled) setLoadingCategories(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [zoneId]);

  const sortedAndFiltered = useMemo(() => {
    let filtered = under250Restaurants.map((r) => ({ ...r, menuItems: [...(r.menuItems || [])] }));
    if (activeCategory) {
      const cat = categories.find((c) => c.id === activeCategory);
      if (cat) {
        const n = cat.name.toLowerCase();
        filtered = filtered
          .map((r) => {
            const m = r.menuItems.filter((i) => (i.category || "").toLowerCase() === n || (i.sectionName || "").toLowerCase() === n || (i.subsectionName || "").toLowerCase() === n);
            return m.length > 0 ? { ...r, menuItems: m } : null;
          })
          .filter(Boolean);
      }
    }
    if (under30MinsFilter) filtered = filtered.filter((r) => parseDeliveryTime(r.deliveryTime) <= 30);
    if (selectedSort === "rating-high") filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.menuItems?.length || 0) - (a.menuItems?.length || 0));
    else if (selectedSort === "delivery-time-low") filtered.sort((a, b) => parseDeliveryTime(a.deliveryTime) - parseDeliveryTime(b.deliveryTime) || (b.rating || 0) - (a.rating || 0) || (a.originalIndex || 0) - (b.originalIndex || 0));
    else if (selectedSort === "distance-low")
      filtered.sort((a, b) => {
        const da = Number.isFinite(a.distanceInKm) ? a.distanceInKm : parseDistance(a.distance);
        const db = Number.isFinite(b.distanceInKm) ? b.distanceInKm : parseDistance(b.distance);
        return da - db || (b.rating || 0) - (a.rating || 0) || (a.originalIndex || 0) - (b.originalIndex || 0);
      });
    return filtered;
  }, [under250Restaurants, selectedSort, under30MinsFilter, activeCategory, categories]);

  const handleCategorySwitch = useCallback((id) => {
    setIsSwitchingCategory(true);
    setActiveCategory(id);
    setTimeout(() => setIsSwitchingCategory(false), 400);
  }, []);
  const handleClearAll = () => {
    setSelectedSort(null);
    setDraftSelectedSort(null);
    setUnder30MinsFilter(false);
    setActiveCategory(null);
  };

  const updateItemQuantity = (item, newQuantity, restaurantName = null) => {
    if (!isModuleAuthenticated()) {
      toast.error("Please login to add items to cart");
      router.push({ pathname: "/login", params: { from: "/under-250" } });
      return;
    }
    if (isOutOfService) {
      toast.error(serviceUnavailableMessage || "Service is currently unavailable.");
      return;
    }
    const restaurantObj = under250Restaurants.find((r) => r.menuItems?.some((m) => m.id === item.id));
    const pct = getItemDiscountPercent(restaurantObj, item);
    const finalPrice = pct > 0 ? Math.round(item.price * (1 - pct / 100)) : item.price;
    const cartItem = {
      id: item.id,
      name: item.name,
      price: finalPrice,
      image: item.image,
      restaurant: restaurantName || item.restaurant || "Under 250",
      restaurantId: restaurantObj?.restaurantId,
      description: item.description || "",
      originalPrice: item.originalPrice || item.price,
      priceOnOtherPlatforms: item.priceOnOtherPlatforms || null,
      otherPlatformGst: item.otherPlatformGst ?? null,
      isVeg: item.isVeg,
      foodType: item.foodType,
    };
    if (newQuantity <= 0) {
      removeFromCart(item.id);
      return;
    }
    const existing = getCartItem(item.id);
    if (existing) {
      updateQuantity(item.id, newQuantity);
    } else {
      const result = addToCart(cartItem);
      if (result?.ok === false) {
        toast.error(result.error || "Cannot add item from different restaurant. Please clear cart first.");
        return;
      }
      if (newQuantity > 1) setTimeout(() => updateQuantity(item.id, newQuantity), 0);
    }
  };

  const handleItemClick = (item, restaurant) => {
    const withR = { ...item, restaurant: restaurant.name, restaurantSlug: restaurant.slug || restaurant.restaurantId || "", description: item.description || `${item.name} from ${restaurant.name}`, customisable: item.customisable || false, notEligibleForCoupons: item.notEligibleForCoupons || false };
    const existingQ = quantities[item.id] || 0;
    setItemDetailQuantity(existingQ > 0 ? existingQ : 1);
    setSelectedItem(withR);
  };

  const handleShareItem = (item) => {
    const itemId = item.id || item._id;
    const slug = item.restaurantSlug || item.slug || "";
    const url = slug ? `${WEB_ORIGIN}/user/restaurants/${slug}${itemId ? `?dish=${encodeURIComponent(itemId)}` : ""}` : WEB_ORIGIN;
    shareLink({ title: item.name || "Dish", text: `Check out ${item.name || "this dish"} from ${item.restaurant || "Under 250"}`, url });
  };

  const selectedRestaurant = selectedItem ? under250Restaurants.find((r) => r.menuItems?.some((m) => m.id === selectedItem.id)) : null;
  const bannerW = width;

  const header = (
    <View>
      {bannerImages.length > 0 ? (
        <View style={{ width: bannerW, height: Math.min(240, bannerW / 2), borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: "hidden" }}>
          <FlatList
            ref={bannerRef}
            data={bannerImages}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(b, i) => `${b}-${i}`}
            getItemLayout={(_, index) => ({ length: bannerW, offset: bannerW * index, index })}
            onMomentumScrollEnd={(e) => {
              const i = Math.round(e.nativeEvent.contentOffset.x / bannerW);
              bannerIdx.current = i;
              setCurrentBannerIndex(i);
            }}
            renderItem={({ item }) => <AppImage src={item} style={{ width: bannerW, height: Math.min(240, bannerW / 2) }} width={1200} />}
          />
        </View>
      ) : null}
      <View style={styles.sticky}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4, paddingHorizontal: 2 }}>
          <Pressable onPress={() => handleCategorySwitch(null)} style={styles.catItem}>
            <View style={[styles.catCircle, !activeCategory ? { backgroundColor: palette.yellow, borderColor: palette.yellow } : null, { alignItems: "center", justifyContent: "center" }]}>
              <UtensilsCrossed size={24} color={!activeCategory ? palette.black : palette.gray500} strokeWidth={!activeCategory ? 2.5 : 2} />
            </View>
            <Txt weight={!activeCategory ? 900 : 600} numberOfLines={1} style={styles.catLabel}>All</Txt>
          </Pressable>
          {loadingCategories
            ? Array.from({ length: 7 }).map((_, i) => (
                <View key={i} style={styles.catItem}>
                  <Skeleton width={60} height={60} radius={30} color={palette.gray100} />
                  <Skeleton width={48} height={12} radius={4} color={palette.gray100} />
                </View>
              ))
            : categories.map((c) => {
                const isActive = activeCategory === c.id;
                return (
                  <Pressable key={c.id} onPress={() => handleCategorySwitch(isActive ? null : c.id)} style={styles.catItem}>
                    <View style={[styles.catCircle, isActive && { borderColor: palette.yellow }]}>
                      <AppImage src={c.image} style={StyleSheet.absoluteFill} width={200} />
                    </View>
                    <Txt weight={isActive ? 900 : 600} numberOfLines={1} style={styles.catLabel}>{c.name}</Txt>
                  </Pressable>
                );
              })}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 4 }} style={{ borderTopWidth: 1, borderTopColor: palette.gray100, marginTop: 12 }}>
          <Pressable onPress={() => { setDraftSelectedSort(selectedSort); setShowSortPopup(true); }} style={[styles.chip, selectedSort && styles.chipActive]}>
            <ArrowDownUp size={14} color={selectedSort ? palette.black : palette.gray700} style={{ transform: [{ rotate: "90deg" }] }} />
            <Txt weight={800} style={{ fontSize: 12, color: selectedSort ? palette.black : palette.gray800 }}>{selectedSort ? sortOptions.find((o) => o.id === selectedSort)?.label : "Sort"}</Txt>
            <ChevronDown size={12} color={selectedSort ? palette.black : palette.gray500} />
          </Pressable>
          <Pressable onPress={() => setUnder30MinsFilter(!under30MinsFilter)} style={[styles.chip, under30MinsFilter && styles.chipActive]}>
            <Timer size={14} color={under30MinsFilter ? palette.black : palette.gray600} />
            <Txt weight={800} style={{ fontSize: 12, color: under30MinsFilter ? palette.black : palette.gray800 }}>Under 30 mins</Txt>
          </Pressable>
          {selectedSort || under30MinsFilter || activeCategory ? (
            <Pressable onPress={handleClearAll} style={[styles.chip, { borderColor: "#fecaca", backgroundColor: palette.red50 }]}>
              <X size={14} color={palette.red600} />
              <Txt weight={700} style={{ fontSize: 12, color: palette.red600 }}>Reset</Txt>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>
      {loadingRestaurants || isSwitchingCategory ? (
        <View style={{ paddingHorizontal: 12, paddingTop: 16, gap: 32 }}>
          {Array.from({ length: 3 }).map((_, r) => (
            <View key={r} style={{ gap: 12 }}>
              <Skeleton height={24} width={190} radius={6} color={palette.orange100} />
              <View style={{ flexDirection: "row", gap: 12 }}>
                {Array.from({ length: 2 }).map((__, i) => (
                  <View key={i} style={{ width: 200, borderRadius: 8, borderWidth: 1, borderColor: palette.orange100, overflow: "hidden" }}>
                    <Skeleton height={128} radius={0} color={palette.orange50} />
                    <View style={{ padding: 12, gap: 8 }}>
                      <Skeleton height={18} width={140} radius={4} color={palette.orange100} />
                      <Skeleton height={18} width={50} radius={4} color={palette.orange100} />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      ) : sortedAndFiltered.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: 48 }}>
          <Txt weight={400} style={{ color: palette.gray500, fontSize: 14 }}>
            {under250Restaurants.length === 0 ? `No restaurants with dishes under ${R}${under250PriceLimit} found.` : "No restaurants match the selected filters."}
          </Txt>
        </View>
      ) : null}
      <View style={{ height: 16 }} />
    </View>
  );

  const renderRestaurant = ({ item: restaurant }) => {
    const slug = restaurant.slug || restaurant.name.toLowerCase().replace(/\s+/g, "-");
    const isClosed = !getRestaurantAvailabilityStatus(restaurant).isOpen;
    return (
      <View style={[styles.section, isClosed && { opacity: 0.7 }]}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
          <View style={{ flex: 1 }}>
            <Txt weight={700} style={{ fontSize: 20, color: palette.gray900, marginBottom: 6 }}>{restaurant.name}</Txt>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: palette.green600, alignItems: "center", justifyContent: "center" }}>
                <Star size={12} color={palette.white} fill={palette.white} />
              </View>
              <Txt weight={700} style={{ fontSize: 14, color: palette.gray700 }}>
                {restaurant.rating} {restaurant.totalRatings > 0 ? `(${restaurant.totalRatings >= 1000 ? `${(restaurant.totalRatings / 1000).toFixed(1)}K+` : restaurant.totalRatings}+)` : ""}
              </Txt>
              <Txt style={{ color: palette.gray500 }}>•</Txt>
              {restaurant.distance ? (
                <>
                  <Txt weight={600} style={{ fontSize: 14, color: palette.gray700 }}>{restaurant.distance}</Txt>
                  <Txt style={{ color: palette.gray500 }}>•</Txt>
                </>
              ) : null}
              <Txt weight={600} style={{ fontSize: 14, color: palette.gray700 }}>{restaurant.deliveryTime}</Txt>
            </View>
          </View>
          <Pressable disabled={isClosed} onPress={() => router.push({ pathname: `/restaurants/${slug}`, params: { under250: "true" } })} style={{ flexDirection: "row", alignItems: "center", marginTop: 4, opacity: isClosed ? 0.5 : 1 }}>
            <Txt weight={700} style={{ fontSize: 14, color: isClosed ? palette.gray500 : palette.black }}>{isClosed ? "Closed" : "View Items"}</Txt>
            <ArrowRight size={16} color={isClosed ? palette.gray500 : palette.black} style={{ marginLeft: 2 }} />
          </Pressable>
        </View>
        {restaurant.menuItems?.length > 0 ? (
          <FlatList
            horizontal
            data={restaurant.menuItems}
            keyExtractor={(i) => i.id}
            showsHorizontalScrollIndicator={false}
            initialNumToRender={4}
            contentContainerStyle={{ gap: 12 }}
            nestedScrollEnabled
            renderItem={({ item }) => {
              const q = quantities[item.id] || 0;
              const pct = getItemDiscountPercent(restaurant, item);
              return (
                <Pressable onPress={() => !isClosed && handleItemClick(item, restaurant)} style={{ width: 140 }}>
                  <View style={{ width: 140, height: 140, borderRadius: 16, overflow: "hidden", marginBottom: 12 }}>
                    <AppImage src={item.image} style={StyleSheet.absoluteFill} width={400} />
                    {isClosed ? (
                      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" }]}>
                        <View style={{ backgroundColor: "rgba(156,163,175,0.9)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
                          <Txt weight={900} style={{ color: palette.white, fontSize: 12, letterSpacing: 2 }}>CLOSED</Txt>
                        </View>
                      </View>
                    ) : null}
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 }}>
                    <VegMark isVeg={item.isVeg} />
                    <Txt weight={600} numberOfLines={1} style={{ flex: 1, fontSize: 14, color: palette.gray900 }}>{item.name}</Txt>
                  </View>
                  <View>
                    {pct > 0 ? (
                      <View style={{ gap: 2 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Txt weight={700} style={{ fontSize: 16, color: palette.gray900 }}>{R}{Math.round(item.price * (1 - pct / 100))}</Txt>
                          <Txt weight={400} style={{ fontSize: 12, color: palette.gray500, textDecorationLine: "line-through" }}>{R}{Math.round(item.price)}</Txt>
                        </View>
                        <View style={{ alignSelf: "flex-start", backgroundColor: palette.green50, borderWidth: 1, borderColor: "#bbf7d0", paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 }}>
                          <Txt weight={700} style={{ fontSize: 10, color: palette.green600 }}>{pct}% OFF</Txt>
                        </View>
                      </View>
                    ) : (
                      <Txt weight={700} style={{ fontSize: 16, color: palette.gray900 }}>{R}{Math.round(item.price)}</Txt>
                    )}
                    <View style={{ marginTop: 8 }}>
                      {isClosed ? (
                        <View style={[styles.addBtn, { backgroundColor: palette.gray400, borderColor: palette.gray400 }]}>
                          <Txt weight={700} style={{ fontSize: 12, color: palette.white }}>CLOSED</Txt>
                        </View>
                      ) : q > 0 ? (
                        <Pressable onPress={() => router.push("/cart")} style={styles.addBtn}>
                          <Txt weight={700} style={{ fontSize: 12, color: palette.black }}>VIEW CART</Txt>
                        </Pressable>
                      ) : (
                        <Pressable onPress={() => handleItemClick(item, restaurant)} style={styles.addBtn}>
                          <Txt weight={700} style={{ fontSize: 14, color: palette.black }}>ADD</Txt>
                        </Pressable>
                      )}
                    </View>
                  </View>
                </Pressable>
              );
            }}
          />
        ) : null}
      </View>
    );
  };

  return (
    <Screen bg={palette.white}>
      <View style={[{ flex: 1 }, isOutOfService && { opacity: 0.75 }]}>
        <FlatList
          data={loadingRestaurants || isSwitchingCategory ? [] : sortedAndFiltered}
          keyExtractor={(r) => r.id}
          renderItem={renderRestaurant}
          ListHeaderComponent={header}
          ListFooterComponent={loadingMore ? <Spinner style={{ paddingVertical: 32 }} /> : <View style={{ height: 96 }} />}
          onEndReached={() => {
            if (hasMore && !loadingMore && !loadingRestaurants && !isSwitchingCategory) setVisibleRestaurantCount((p) => p + 5);
          }}
          onEndReachedThreshold={0.6}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      </View>
      <StickyCartCard bottom={16} />

      {showScan ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.white, padding: 16, gap: 20 }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 48 }}>
            <Skeleton width={44} height={44} radius={22} />
            <Skeleton width={96} height={44} radius={22} />
          </View>
          <Skeleton height={224} radius={30} />
          <Skeleton height={110} radius={30} />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={110} radius={24} />
          ))}
        </View>
      ) : null}

      <BottomSheet visible={showSortPopup} onClose={() => setShowSortPopup(false)} maxHeightRatio={0.6}>
        <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 8 }}>
          <View style={{ width: 48, height: 4, backgroundColor: palette.gray300, borderRadius: 2 }} />
        </View>
        <View style={styles.sheetHead}>
          <Txt weight={700} style={{ fontSize: 18, color: palette.gray900 }}>Sort By</Txt>
          <Pressable onPress={handleClearAll}><Txt weight={700} style={{ fontSize: 14, color: palette.black }}>Clear all</Txt></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          {sortOptions.map((o) => (
            <Pressable key={o.id || "relevance"} onPress={() => setDraftSelectedSort(o.id)} style={[styles.sortOpt, draftSelectedSort === o.id && { borderColor: palette.yellow, backgroundColor: "#fffbeb" }]}>
              <Txt weight={700} style={{ fontSize: 14, color: draftSelectedSort === o.id ? palette.black : palette.gray700 }}>{o.label}</Txt>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.sheetFoot}>
          <Pressable onPress={() => setShowSortPopup(false)} style={{ flex: 1, paddingVertical: 12, alignItems: "center" }}><Txt weight={600} style={{ color: palette.gray700 }}>Close</Txt></Pressable>
          <Pressable onPress={() => { setSelectedSort(draftSelectedSort); setShowSortPopup(false); }} style={{ flex: 1, paddingVertical: 12, alignItems: "center", backgroundColor: palette.yellow, borderRadius: 12 }}>
            <Txt weight={800} style={{ color: palette.black }}>Apply</Txt>
          </Pressable>
        </View>
      </BottomSheet>

      <BottomSheet visible={!!selectedItem} onClose={() => setSelectedItem(null)} contentStyle={{ overflow: "visible" }}>
        {selectedItem ? (
          <>
            <Pressable onPress={() => setSelectedItem(null)} style={styles.closeFloat}>
              <X size={20} color={palette.white} />
            </Pressable>
            <View style={{ height: 256, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden" }}>
              <AppImage src={selectedItem.image} style={StyleSheet.absoluteFill} width={1000} />
              <View style={{ position: "absolute", bottom: 16, right: 16, flexDirection: "row", gap: 12 }}>
                <Pressable
                  onPress={() =>
                    setBookmarkedItems((prev) => {
                      const n = new Set(prev);
                      if (n.has(selectedItem.id)) n.delete(selectedItem.id);
                      else n.add(selectedItem.id);
                      return n;
                    })
                  }
                  style={[styles.roundIcon, bookmarkedItems.has(selectedItem.id) && { borderColor: palette.red500, backgroundColor: palette.red50 }]}
                >
                  <Bookmark size={20} color={bookmarkedItems.has(selectedItem.id) ? palette.red500 : palette.gray600} fill={bookmarkedItems.has(selectedItem.id) ? palette.red500 : "transparent"} />
                </Pressable>
                <Pressable onPress={() => handleShareItem(selectedItem)} style={styles.roundIcon}>
                  <Share2 size={20} color={palette.gray600} />
                </Pressable>
              </View>
            </View>
            <ScrollView style={{ maxHeight: 220 }} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                {selectedItem.isVeg ? <VegMark isVeg size={20} /> : null}
                <Txt weight={700} style={{ fontSize: 20, color: palette.gray900, flex: 1 }}>{selectedItem.name}</Txt>
              </View>
              <Txt weight={400} style={{ fontSize: 14, color: palette.gray600, lineHeight: 22, marginBottom: 16 }}>{selectedItem.description || `${selectedItem.name} from ${selectedItem.restaurant || "Under 250"}`}</Txt>
              {selectedItem.notEligibleForCoupons ? <Txt weight={500} style={{ fontSize: 12, color: palette.gray500 }}>NOT ELIGIBLE FOR COUPONS</Txt> : null}
            </ScrollView>
            <View style={styles.actionBar}>
              <View style={[styles.qtyBox, isOutOfService && { opacity: 0.5 }]}>
                <Pressable disabled={itemDetailQuantity <= 1 || isOutOfService} onPress={() => setItemDetailQuantity((p) => Math.max(1, p - 1))}>
                  <Minus size={20} color={itemDetailQuantity <= 1 ? palette.gray300 : palette.gray600} />
                </Pressable>
                <Txt weight={600} style={{ fontSize: 18, color: palette.gray900, minWidth: 32, textAlign: "center" }}>{itemDetailQuantity}</Txt>
                <Pressable disabled={isOutOfService} onPress={() => setItemDetailQuantity((p) => p + 1)}>
                  <Plus size={20} color={palette.gray600} />
                </Pressable>
              </View>
              <Pressable
                disabled={isOutOfService}
                onPress={() => {
                  updateItemQuantity(selectedItem, itemDetailQuantity, selectedItem.restaurant);
                  setSelectedItem(null);
                }}
                style={[styles.addItemBtn, isOutOfService && { backgroundColor: palette.gray300, opacity: 0.5 }]}
              >
                <Txt weight={800} style={{ fontSize: 14, color: palette.black }}>Add item</Txt>
                {selectedRestaurant?.discount > 0 ? (
                  <>
                    <Txt weight={400} style={{ fontSize: 14, color: "#fecaca", textDecorationLine: "line-through" }}>{R}{Math.round(selectedItem.price)}</Txt>
                    <Txt weight={700} style={{ fontSize: 16, color: palette.black }}>{R}{Math.round(selectedItem.price * (1 - selectedRestaurant.discount / 100))}</Txt>
                  </>
                ) : selectedItem.originalPrice && selectedItem.originalPrice > selectedItem.price ? (
                  <>
                    <Txt weight={400} style={{ fontSize: 14, color: "#fecaca", textDecorationLine: "line-through" }}>{R}{Math.round(selectedItem.originalPrice)}</Txt>
                    <Txt weight={700} style={{ fontSize: 16, color: palette.black }}>{R}{Math.round(selectedItem.price)}</Txt>
                  </>
                ) : (
                  <Txt weight={700} style={{ fontSize: 16, color: palette.black }}>{R}{Math.round(selectedItem.price)}</Txt>
                )}
              </Pressable>
            </View>
          </>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sticky: { backgroundColor: "rgba(255,255,255,0.95)", borderBottomWidth: 1, borderBottomColor: palette.gray100, paddingHorizontal: 12, paddingVertical: 12 },
  catItem: { width: 68, alignItems: "center", gap: 6 },
  catCircle: { width: 60, height: 60, borderRadius: 30, overflow: "hidden", borderWidth: 2, borderColor: palette.gray100, backgroundColor: palette.white },
  catLabel: { fontSize: 11, color: palette.gray700, textAlign: "center", width: "100%" },
  chip: { height: 32, paddingHorizontal: 14, borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: palette.gray200, backgroundColor: palette.white, marginTop: 4 },
  chipActive: { backgroundColor: palette.yellow, borderColor: palette.yellow },
  section: { padding: 16, marginHorizontal: 12, marginBottom: 24, borderRadius: 16, backgroundColor: "#f8fafc" },
  addBtn: { height: 32, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1, borderColor: palette.yellow, backgroundColor: palette.white, alignItems: "center", justifyContent: "center", alignSelf: "flex-start" },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: palette.gray200 },
  sheetFoot: { flexDirection: "row", gap: 16, paddingHorizontal: 16, paddingVertical: 16, borderTopWidth: 1, borderTopColor: palette.gray200 },
  sortOpt: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: palette.gray200 },
  closeFloat: { position: "absolute", top: -48, alignSelf: "center", width: 40, height: 40, borderRadius: 20, backgroundColor: palette.gray800, alignItems: "center", justifyContent: "center", zIndex: 10, elevation: 6 },
  roundIcon: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: palette.white, backgroundColor: "rgba(255,255,255,0.9)", alignItems: "center", justifyContent: "center" },
  actionBar: { flexDirection: "row", alignItems: "center", gap: 16, borderTopWidth: 1, borderTopColor: palette.gray200, paddingHorizontal: 16, paddingVertical: 16 },
  qtyBox: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 2, borderColor: palette.gray300, borderRadius: 8, paddingHorizontal: 12, height: 44 },
  addItemBtn: { flex: 1, height: 44, borderRadius: 8, backgroundColor: palette.yellow, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
});
