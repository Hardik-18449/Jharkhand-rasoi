/** Restaurant details — port of pages/user/restaurants/RestaurantDetails.jsx */
import React, { Component, useEffect, useMemo, useRef, useState } from "react";
import { Image as RNImage, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { ArrowLeft, Search, MoreVertical, MapPin, Clock, ChevronDown, Star, SlidersHorizontal, Utensils, Bookmark, Share2, Plus, Minus, X, Check, Percent, AlertCircle, Tag } from "lucide-react-native";
import Svg, { Path } from "react-native-svg";
import Txt from "../../src/components/ui/Txt";
import Screen from "../../src/components/ui/Screen";
import Skeleton from "../../src/components/ui/Skeleton";
import AppImage from "../../src/components/ui/AppImage";
import BottomSheet from "../../src/components/ui/BottomSheet";
import Button from "../../src/components/ui/Button";
import CartPill from "../../src/components/CartPill";
import { LinearGradient } from "../../src/components/ui/LinearGradient";
import { shareLink, WEB_ORIGIN } from "../../src/components/ui/ShareSheet";
import { restaurantAPI, diningAPI } from "../../src/api";
import { useAppLocation } from "../../src/context/LocationProvider";
import { useCart } from "../../src/context/CartContext";
import { useProfile } from "../../src/context/ProfileContext";
import { getCompanyNameAsync } from "../../src/utils/businessSettings";
import { isModuleAuthenticated } from "../../src/auth/session";
import { getRestaurantAvailabilityStatus } from "../../src/utils/restaurantAvailability";
import { getMediaUrl } from "../../src/utils/media";
import { buildCartLineId, getDefaultFoodVariant, getFoodDisplayPrice, getFoodPriceLabel, getFoodVariants, hasFoodVariants } from "../../src/utils/foodVariants";
import { localImages } from "../../src/constants/images";
import { toast } from "../../src/utils/toast";
import { palette, fonts } from "../../src/theme";

const R = "₹";

const calcDistanceKm = (lat1, lng1, lat2, lng2) => {
  const Rr = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Rr * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.35;
};
const fmtDistance = (km) => (km >= 1 ? `${km.toFixed(1)} km` : `${Math.round(km * 1000)} m`);

const formatRestaurantAddress = (loc) => {
  if (!loc) return "Location";
  if (typeof loc === "string") return loc;
  const clean = (s) => s.replace(/^[A-Z0-9]+\+[A-Z0-9]+,\s*/i, "");
  const fa = typeof loc.formattedAddress === "string" ? loc.formattedAddress.trim() : "";
  const isCoords = (s) => /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(s);
  if (fa && fa !== "Select location" && !isCoords(fa) && (/\b\d{6}\b/.test(fa) || fa.split(",").length >= 3)) return clean(fa);
  const parts = [loc.addressLine1, loc.addressLine2, loc.area, loc.city, loc.state].filter((p) => p && String(p).trim()).map((p) => String(p).trim());
  const pin = loc.pincode || loc.zipCode || loc.postalCode;
  if (pin && String(pin).trim()) parts.push(String(pin).trim());
  if (parts.length >= 2) return parts.join(", ");
  if (fa && fa !== "Select location" && !isCoords(fa)) return clean(fa);
  if (loc.address && String(loc.address).trim()) return String(loc.address).trim();
  return loc.area || loc.city || "Location";
};
const categoryFromArray = (list) => {
  if (!Array.isArray(list) || list.length === 0) return null;
  const f = list[0];
  if (typeof f === "string") return f;
  return f?.name || f?.label || f?.title || null;
};
const toArray = (v) => (Array.isArray(v) ? v : !v || typeof v !== "object" ? [] : Object.values(v).filter((e) => e && typeof e === "object"));
const extractFirstImage = (candidates) => {
  for (const c of candidates) {
    if (!c) continue;
    if (typeof c === "string" && c.trim()) return getMediaUrl(c.trim());
    if (Array.isArray(c) && c.length) {
      const r = extractFirstImage([c[0]]);
      if (r) return r;
    }
    if (typeof c === "object") {
      const s = c.url || c.secure_url || c.imageUrl || c.image || c.src;
      if (typeof s === "string" && s.trim()) return getMediaUrl(s.trim());
    }
  }
  return "";
};
const isRecommendedItem = (item) => Boolean(item?.isRecommended || item?.recommended || item?.isPopular || item?.popular || item?.isBestseller);
const isRecommendedSection = (section) => {
  const n = String(section?.name || section?.title || "").trim().toLowerCase();
  return n === "recommended for you" || n === "result for your search";
};
const getSectionDisplayName = (section) => {
  if (isRecommendedSection(section)) return "Recommended for you";
  if (typeof section?.name === "string" && section.name.trim()) return section.name.trim();
  if (typeof section?.title === "string" && section.title.trim()) return section.title.trim();
  return "Unnamed Section";
};
const normalizeMenuCategoryId = (v) => String(v || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const normalizeItem = (item = {}) => {
  const isRec = item.isRecommended === true || item.isRecommended === 1 || String(item.isRecommended) === "true";
  const isSpicy = item.isSpicy === true || item.isSpicy === 1 || String(item.isSpicy) === "true";
  let foodType = item.foodType || "Non-Veg";
  if (typeof foodType === "string") {
    if (foodType.toLowerCase() === "veg") foodType = "Veg";
    else if (["non-veg", "nonveg"].includes(foodType.toLowerCase())) foodType = "Non-Veg";
  }
  return {
    ...item,
    id: String(item.id || item._id || `${Date.now()}-${Math.random()}`),
    name: item.name || "Unnamed Item",
    foodType,
    isVeg: foodType === "Veg",
    price: getFoodDisplayPrice(item),
    image: extractFirstImage([item.image, item.imageUrl, item.photo, item.photoUrl, item.menuImage, item.menuImageUrl, item.images, item.photos, item.gallery]),
    variants: getFoodVariants(item),
    variations: getFoodVariants(item),
    isAvailable: item.isAvailable !== false,
    isRecommended: isRec,
    isSpicy,
    description: typeof item.description === "string" ? item.description : "",
  };
};

function VegBox({ isVeg, size = 16 }) {
  const c = isVeg ? palette.green600 : palette.red600;
  return (
    <View style={{ width: size, height: size, borderWidth: 2, borderColor: c, borderRadius: 2, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: size / 2, height: size / 2, borderRadius: size, backgroundColor: c }} />
    </View>
  );
}

function RestaurantDetailsContent() {
  const params = useLocalSearchParams();
  const slug = String(params.slug || "");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showOnlyUnder250 = params.under250 === "true";
  const targetDishId = String(params.highlightItemId || params.dish || params.dishId || params.foodId || params.itemId || "").trim();
  const { addToCart, updateQuantity, removeFromCart, getCartItem, cart, itemCount } = useCart();
  const { vegMode, vegModeOption, addDishFavorite, removeDishFavorite, isDishFavorite, getDishFavorites, getFavorites, addFavorite, removeFavorite, isFavorite } = useProfile();
  const { location: userLocation, zoneId, isOutOfService, serviceUnavailableMessage } = useAppLocation();

  const [highlightIndex, setHighlightIndex] = useState(0);
  const [showManageCollections, setShowManageCollections] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [showOffersSheet, setShowOffersSheet] = useState(false);
  const [expandedCoupons, setExpandedCoupons] = useState(new Set());
  const [showMenuSheet, setShowMenuSheet] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [availabilityTick, setAvailabilityTick] = useState(Date.now());
  const [showMenuOptionsSheet, setShowMenuOptionsSheet] = useState(false);
  const [expandedSections, setExpandedSections] = useState(new Set([0]));
  const [highlightedDishId, setHighlightedDishId] = useState(null);
  const [loadingMenuItems, setLoadingMenuItems] = useState(true);
  const [menuUnavailable, setMenuUnavailable] = useState(false);
  const [combos, setCombos] = useState([]);
  const [selectedMenuCategory, setSelectedMenuCategory] = useState("all");
  const [visibleItemCount, setVisibleItemCount] = useState(20);
  const [showScan, setShowScan] = useState(true);
  const [filters, setFilters] = useState({ sortBy: null, vegNonVeg: null, highlyReordered: false, spicy: false });
  const [restaurant, setRestaurant] = useState(null);
  const [loadingRestaurant, setLoadingRestaurant] = useState(true);
  const [restaurantError, setRestaurantError] = useState(null);
  const fetchedRef = useRef({ done: false, slug: null, zoneId: null });
  const scrollRef = useRef(null);
  const sectionY = useRef({});
  const dishY = useRef({});
  const menuTopY = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setShowScan(false), 2200);
    const i = setInterval(() => setAvailabilityTick(Date.now()), 60000);
    return () => {
      clearTimeout(t);
      clearInterval(i);
    };
  }, []);
  useEffect(() => setSelectedMenuCategory("all"), [slug]);

  /* -------- fetch restaurant + menu -------- */
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!slug) return;
      if (fetchedRef.current.done && fetchedRef.current.slug === slug && fetchedRef.current.zoneId === zoneId && restaurant) return;
      try {
        setLoadingRestaurant(!fetchedRef.current.done && !restaurant);
        setRestaurantError(null);
        let apiRestaurant = null;
        const requestConfig = {};
        if (Number.isFinite(userLocation?.latitude) && Number.isFinite(userLocation?.longitude)) requestConfig.params = { lat: userLocation.latitude, lng: userLocation.longitude };
        try {
          const r = await diningAPI.getRestaurantBySlug(slug, requestConfig);
          if (r?.data?.success && r?.data?.data) apiRestaurant = r.data.data;
        } catch {}
        if (!apiRestaurant) {
          try {
            const r = await restaurantAPI.getRestaurantById(slug, requestConfig);
            if (r?.data?.success && r?.data?.data) apiRestaurant = r.data.data;
          } catch {
            const variants = zoneId ? [{ limit: 100, zoneId }, { limit: 100 }] : [{ limit: 100 }];
            for (const sp of variants) {
              try {
                const sr = await restaurantAPI.getRestaurants(sp, { noCache: true });
                const list = sr?.data?.data?.restaurants || sr?.data?.data || [];
                const nameGuess = slug.replace(/-/g, " ").toLowerCase();
                const match = list.find((x) => x.slug === slug || x.name?.toLowerCase().replace(/\s+/g, "-") === slug.toLowerCase() || x.name?.toLowerCase() === nameGuess);
                if (match) {
                  const fr = await restaurantAPI.getRestaurantById(match._id || match.restaurantId, requestConfig);
                  if (fr?.data?.success && fr?.data?.data) {
                    apiRestaurant = fr.data.data;
                    break;
                  }
                }
              } catch {}
            }
          }
        }
        if (cancelled) return;
        if (!apiRestaurant) {
          if (!fetchedRef.current.done) {
            setRestaurantError("Restaurant not found");
            setRestaurant(null);
          }
          return;
        }
        const actual = apiRestaurant?.restaurant || apiRestaurant;
        const locationObj = actual?.location || apiRestaurant?.location;
        const rLat = locationObj?.latitude || (Array.isArray(locationObj?.coordinates) ? locationObj.coordinates[1] : null);
        const rLng = locationObj?.longitude || (Array.isArray(locationObj?.coordinates) ? locationObj.coordinates[0] : null);
        let calculatedDistance = apiRestaurant?.distanceText || actual?.distanceText || null;
        if (!calculatedDistance && userLocation?.latitude && userLocation?.longitude && rLat && rLng) calculatedDistance = fmtDistance(calcDistanceKm(userLocation.latitude, userLocation.longitude, rLat, rLng));
        const topCategory =
          actual?.topCategory || apiRestaurant?.topCategory || categoryFromArray(actual?.topCategories) || categoryFromArray(apiRestaurant?.topCategories) || categoryFromArray(actual?.cuisines) || categoryFromArray(apiRestaurant?.cuisines) || categoryFromArray(actual?.categories) || categoryFromArray(apiRestaurant?.categories) || actual?.cuisine || apiRestaurant?.cuisine || actual?.category || apiRestaurant?.category || "Multi-cuisine";
        const step2 = actual?.onboarding?.step2 || apiRestaurant?.onboarding?.step2 || {};
        const coverImages = Array.isArray(actual?.coverImages) && actual.coverImages.length ? actual.coverImages : Array.isArray(apiRestaurant?.coverImages) ? apiRestaurant.coverImages : [];
        const ro = actual?.restaurantOffers || apiRestaurant?.restaurantOffers || {};
        const transformed = {
          id: actual?.restaurantId || actual?._id || actual?.id || apiRestaurant?.restaurantId || apiRestaurant?._id || null,
          mongoId: actual?._id || apiRestaurant?._id || null,
          _id: actual?._id || apiRestaurant?._id || null,
          name: actual?.name || actual?.restaurantName || apiRestaurant?.name || apiRestaurant?.restaurantName || "Unknown Restaurant",
          cuisine: topCategory,
          topCategory,
          rating: actual?.rating || apiRestaurant?.rating || actual?.averageRating || apiRestaurant?.averageRating || null,
          reviews: actual?.totalRatings || apiRestaurant?.totalRatings || actual?.reviewCount || apiRestaurant?.reviewCount || actual?.reviews?.length || apiRestaurant?.reviews?.length || 0,
          deliveryTime: actual?.estimatedDeliveryTime || apiRestaurant?.estimatedDeliveryTime || actual?.deliveryTime || apiRestaurant?.deliveryTime || actual?.avgDeliveryTime || apiRestaurant?.avgDeliveryTime || "25-30 mins",
          distance: calculatedDistance || actual?.distance || apiRestaurant?.distance || "1.2 km",
          location: formatRestaurantAddress(locationObj),
          locationObject: locationObj,
          image: coverImages?.[0]?.url || coverImages?.[0] || actual?.profileImage?.url || actual?.profileImage || step2?.profileImageUrl || null,
          priceRange: actual?.priceRange || apiRestaurant?.priceRange || "$$",
          offers: Array.isArray(actual?.offers) ? actual.offers : Array.isArray(apiRestaurant?.offers) ? apiRestaurant.offers : [],
          offerText: actual?.offer || apiRestaurant?.offer || actual?.onboarding?.step4?.offer || "",
          restaurantOffers: { coupons: Array.isArray(ro?.coupons) ? ro.coupons : [] },
          slug: actual?.slug || apiRestaurant?.slug || actual?.name?.toLowerCase().replace(/\s+/g, "-") || slug || "unknown",
          restaurantId: actual?.restaurantId || actual?._id || actual?.id || apiRestaurant?.restaurantId || apiRestaurant?._id || apiRestaurant?.id || null,
          openDays: Array.isArray(actual?.openDays) ? actual.openDays : Array.isArray(apiRestaurant?.openDays) ? apiRestaurant.openDays : Array.isArray(step2?.openDays) ? step2.openDays : [],
          openingTime: actual?.openingTime || apiRestaurant?.openingTime || actual?.deliveryTimings?.openingTime || apiRestaurant?.deliveryTimings?.openingTime || null,
          closingTime: actual?.closingTime || apiRestaurant?.closingTime || actual?.deliveryTimings?.closingTime || apiRestaurant?.deliveryTimings?.closingTime || null,
          deliveryTimings: actual?.deliveryTimings || apiRestaurant?.deliveryTimings || {
            openingTime: actual?.openingTime || apiRestaurant?.openingTime || step2?.deliveryTimings?.openingTime || "09:00",
            closingTime: actual?.closingTime || apiRestaurant?.closingTime || step2?.deliveryTimings?.closingTime || "22:00",
          },
          outletTimings: actual?.outletTimings || apiRestaurant?.outletTimings || null,
          cuisines: Array.isArray(actual?.cuisines) ? actual.cuisines : Array.isArray(apiRestaurant?.cuisines) ? apiRestaurant.cuisines : [],
          menuSections: [],
          onboarding: actual?.onboarding || apiRestaurant?.onboarding || null,
          isActive: actual?.isActive !== false,
          isAcceptingOrders: actual?.isAcceptingOrders !== false,
          discount: actual?.discount || apiRestaurant?.discount || 0,
          itemDiscounts: Array.isArray(actual?.itemDiscounts) ? actual.itemDiscounts : Array.isArray(apiRestaurant?.itemDiscounts) ? apiRestaurant.itemDiscounts : [],
          discountRules: Array.isArray(actual?.discountRules) ? actual.discountRules : Array.isArray(apiRestaurant?.discountRules) ? apiRestaurant.discountRules : [],
          distanceText: apiRestaurant?.distanceText || actual?.distanceText || null,
          distanceInfo: apiRestaurant?.distanceInfo || actual?.distanceInfo || null,
        };
        setRestaurant(transformed);
        fetchedRef.current = { done: true, slug, zoneId };

        const outletId = transformed.mongoId;
        if (outletId) {
          restaurantAPI
            .getOutletTimingsByRestaurantId(outletId, { noCache: true })
            .then((r) => {
              const ot = r?.data?.data?.outletTimings || r?.data?.outletTimings;
              if (ot && !cancelled) setRestaurant((p) => ({ ...p, outletTimings: ot }));
            })
            .catch(() => {});
        }

        const lookupIds = [transformed.id, slug, transformed.restaurantId, transformed.mongoId, apiRestaurant?.restaurantId, apiRestaurant?._id, actual?.restaurantId, actual?._id, actual?.slug]
          .filter(Boolean)
          .map((v) => String(v).trim())
          .filter((v, i, a) => a.indexOf(v) === i);
        setLoadingMenuItems(true);
        setMenuUnavailable(false);
        try {
          let menuResponse = null;
          for (const id of lookupIds) {
            try {
              const r = await restaurantAPI.getMenuByRestaurantId(id);
              if (r?.data?.success) {
                menuResponse = r;
                break;
              }
            } catch (e) {
              if (e?.response?.status !== 404) throw e;
            }
          }
          if (!menuResponse) throw Object.assign(new Error("Menu not found"), { response: { status: 404 } });
          const rawSections = menuResponse?.data?.data?.menu?.sections || [];
          const menuSections = toArray(rawSections).map((section, si) => ({
            ...section,
            id: String(section.id || section._id || `section-${si}`),
            name: section.name || section.title || "Unnamed Section",
            items: toArray(section.items).map(normalizeItem),
            subsections: toArray(section.subsections).map((sub, ssi) => ({ ...sub, id: String(sub.id || sub._id || `subsection-${si}-${ssi}`), name: sub.name || "Unnamed Subsection", items: toArray(sub.items).map(normalizeItem) })),
          }));
          const menuHasItems = menuSections.some((s) => s.items.length > 0 || s.subsections.some((ss) => ss.items.length > 0));
          let finalSections = [...menuSections];
          if (targetDishId) {
            const all = menuSections.flatMap((s) => [...s.items, ...s.subsections.flatMap((ss) => ss.items)]);
            const matched = all.find((i) => String(i.id || i._id || "").trim() === targetDishId);
            if (matched) finalSections = [{ name: "Result for your search", items: [matched], subsections: [], isSearchResult: true }, ...finalSections];
          }
          if (cancelled) return;
          setRestaurant((p) => ({ ...p, menuSections: finalSections }));
          setMenuUnavailable(!menuHasItems);
          const exp = new Set();
          finalSections.forEach((s, i) => {
            exp.add(i);
            (s.subsections || []).forEach((_, j) => exp.add(`${i}-${j}`));
          });
          setExpandedSections(exp);
        } catch (menuError) {
          if (menuError?.response?.status === 404 && !cancelled) setMenuUnavailable(true);
        } finally {
          if (!cancelled) setLoadingMenuItems(false);
        }
      } catch (error) {
        if (cancelled) return;
        if (!fetchedRef.current.done) {
          const isNetwork = error?.isNetworkError || error?.code === "ERR_NETWORK";
          setRestaurantError(isNetwork ? "Backend server is not connected. Please make sure the backend is running." : error?.response?.status === 404 ? "Restaurant not found" : error.message || "Failed to load restaurant");
          setRestaurant(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingRestaurant(false);
          setLoadingMenuItems(false);
        }
      }
    };
    if (fetchedRef.current.done && (fetchedRef.current.slug !== slug || fetchedRef.current.zoneId !== zoneId)) fetchedRef.current = { done: false, slug: null, zoneId: null };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, zoneId]);

  // recalc distance when user location changes
  const rLat = restaurant?.locationObject?.latitude || (Array.isArray(restaurant?.locationObject?.coordinates) ? restaurant.locationObject.coordinates[1] : null);
  const rLng = restaurant?.locationObject?.longitude || (Array.isArray(restaurant?.locationObject?.coordinates) ? restaurant.locationObject.coordinates[0] : null);
  useEffect(() => {
    if (!restaurant || !userLocation?.latitude || !rLat || !rLng || restaurant.distanceText) return;
    const d = fmtDistance(calcDistanceKm(userLocation.latitude, userLocation.longitude, rLat, rLng));
    setRestaurant((p) => (p?.distance === d ? p : { ...p, distance: d }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation?.latitude, userLocation?.longitude, rLat, rLng]);

  // combos
  useEffect(() => {
    const id = restaurant?._id || restaurant?.restaurantId || restaurant?.id;
    if (!id) return undefined;
    let cancelled = false;
    restaurantAPI
      .getCombosByRestaurantId(String(id))
      .then((r) => {
        if (cancelled) return;
        const list = r?.data?.data?.combos || r?.data?.combos || [];
        setCombos(Array.isArray(list) ? list : []);
      })
      .catch(() => !cancelled && setCombos([]));
    return () => {
      cancelled = true;
    };
  }, [restaurant?._id, restaurant?.restaurantId, restaurant?.id]);

  useEffect(() => {
    if (!selectedItem) {
      setSelectedVariantId("");
      return;
    }
    setSelectedVariantId(getDefaultFoodVariant(selectedItem)?.id || "");
  }, [selectedItem]);

  const quantities = useMemo(() => {
    const q = {};
    if (!restaurant?.name) return q;
    cart.forEach((i) => {
      if (i.restaurant === restaurant.name) q[i.id] = i.quantity || 0;
    });
    return q;
  }, [cart, restaurant?.name]);

  const getLineItemIdForDish = (item, variant = null) => buildCartLineId(item?.id || item?._id || "", variant?.id || variant?._id || "");
  const getVariantForDish = (item, preferred = "") => {
    const v = getFoodVariants(item);
    if (v.length === 0) return null;
    return v.find((x) => String(x.id) === String(preferred || "")) || v[0];
  };
  const getDishQuantity = (item, preferred = "") => quantities[getLineItemIdForDish(item, getVariantForDish(item, preferred))] || 0;

  const calculateBestDiscount = (item, priceNum) => {
    let best = { discountValue: 0, isFlatDiscount: false, discountAmount: 0 };
    const itemDiscount = (restaurant?.itemDiscounts || []).find((d) => String(d.itemId) === String(item.id || item._id));
    if (itemDiscount) {
      const v = itemDiscount.discountValue || 0;
      const flat = String(itemDiscount.discountType || "").toUpperCase() === "FLAT";
      const amt = flat ? v : (priceNum * v) / 100;
      if (amt > best.discountAmount) best = { discountValue: v, isFlatDiscount: flat, discountAmount: amt };
    }
    const rule = (restaurant?.discountRules || []).find((r) => {
      const v = Number(r.conditionValue);
      return (r.conditionType === "PRICE_ABOVE" && priceNum > v) || (r.conditionType === "PRICE_BELOW" && priceNum < v);
    });
    if (rule) {
      const v = rule.discountValue || 0;
      const amt = (priceNum * v) / 100;
      if (amt > best.discountAmount) best = { discountValue: v, isFlatDiscount: false, discountAmount: amt };
    }
    const g = Number(restaurant?.discount || 0);
    if (g > 0) {
      const amt = (priceNum * g) / 100;
      if (amt > best.discountAmount) best = { discountValue: g, isFlatDiscount: false, discountAmount: amt };
    }
    return best;
  };
  const getFinalPrice = (item) => {
    let p = item.price || 0;
    if (typeof p === "string") {
      const parsed = parseFloat(p.replace(/[^0-9.]/g, ""));
      if (!isNaN(parsed)) p = parsed;
    }
    const { discountAmount } = calculateBestDiscount(item, p);
    return Math.max(0, discountAmount > 0 ? p - discountAmount : p);
  };

  const availabilityStatus = restaurant ? getRestaurantAvailabilityStatus(restaurant, new Date(availabilityTick)) : { isOpen: false };
  const isRestaurantOffline = !availabilityStatus.isOpen;
  const shouldShowGrayscale = isOutOfService || isRestaurantOffline;

  const ensureCanAdd = () => {
    if (!isModuleAuthenticated()) {
      toast.error("Please login to add items to cart");
      router.push({ pathname: "/login", params: { from: `/restaurants/${slug}` } });
      return false;
    }
    if (isOutOfService) {
      toast.error(serviceUnavailableMessage || "Service is currently unavailable.");
      return false;
    }
    if (!getRestaurantAvailabilityStatus(restaurant).isOpen) {
      toast.error("Restaurant is currently offline. Please try again later.");
      return false;
    }
    return true;
  };

  const updateItemQuantity = (item, newQuantity, preferredVariant = null) => {
    if (!ensureCanAdd()) return;
    const variant = preferredVariant || getDefaultFoodVariant(item);
    const lineItemId = getLineItemIdForDish(item, variant);
    if (!restaurant?.name) {
      toast.error("Restaurant information is missing. Please refresh the page.");
      return;
    }
    const validRestaurantId = restaurant?.restaurantId || restaurant?._id || restaurant?.id;
    if (!validRestaurantId) {
      toast.error("Restaurant ID is missing. Please refresh the page.");
      return;
    }
    const basePrice = variant?.price ?? item.price;
    const priceNum = typeof basePrice === "number" ? basePrice : parseFloat(String(basePrice).replace(/[^0-9.]/g, "")) || 0;
    const { discountValue, isFlatDiscount } = calculateBestDiscount(item, priceNum);
    const finalPrice = discountValue > 0 ? Math.round(isFlatDiscount ? Math.max(0, priceNum - discountValue) : priceNum * (1 - discountValue / 100)) : priceNum;
    const cartItem = {
      id: lineItemId,
      lineItemId,
      itemId: item.id,
      name: item.name,
      price: finalPrice,
      originalPrice: priceNum,
      variantId: variant?.id || "",
      variantName: variant?.name || "",
      variantPrice: finalPrice,
      addons: [],
      image: item.image,
      restaurant: restaurant.name,
      restaurantId: validRestaurantId,
      description: item.description,
      isVeg: item.isVeg === true,
      foodType: item.foodType,
      preparationTime: item.preparationTime,
      priceOnOtherPlatforms: item.priceOnOtherPlatforms || null,
      otherPlatformGst: item.otherPlatformGst ?? null,
    };
    if (newQuantity <= 0) {
      removeFromCart(lineItemId);
      return;
    }
    if (getCartItem(lineItemId)) updateQuantity(lineItemId, newQuantity);
    else {
      const result = addToCart(cartItem);
      if (result?.ok === false) {
        toast.error(result.error || "Cannot add item from different restaurant. Please clear cart first.");
        return;
      }
      if (newQuantity > 1) setTimeout(() => updateQuantity(lineItemId, newQuantity), 0);
    }
  };

  const getComboLineId = (combo) => `combo-${String(combo?.id || combo?._id || "")}`;
  const getComboQuantity = (combo) => Number(getCartItem(getComboLineId(combo))?.quantity || 0);
  const updateComboQuantity = (combo, newQuantity) => {
    if (!ensureCanAdd()) return;
    const validRestaurantId = restaurant?.restaurantId || restaurant?._id || restaurant?.id;
    if (!restaurant?.name || !validRestaurantId) {
      toast.error("Restaurant information is missing. Please refresh the page.");
      return;
    }
    const lineItemId = getComboLineId(combo);
    const comboId = String(combo?.id || combo?._id || "");
    const comboPrice = Number(combo?.comboPrice ?? combo?.price) || 0;
    const cartItem = {
      id: lineItemId,
      lineItemId,
      itemId: comboId,
      isCombo: true,
      comboId,
      comboItems: (Array.isArray(combo?.items) ? combo.items : []).map((ci) => ({ foodId: String(ci.foodId || ""), name: ci.name, variantName: ci.variantName || "", quantity: Number(ci.quantity) || 1, foodType: ci.foodType || "" })),
      name: combo.name,
      price: comboPrice,
      originalPrice: Number(combo?.originalPrice) || comboPrice,
      variantId: "",
      variantName: "",
      variantPrice: comboPrice,
      addons: [],
      image: combo.image || (Array.isArray(combo.images) && combo.images[0]) || "",
      restaurant: restaurant.name,
      restaurantId: validRestaurantId,
      description: combo.description || "",
      isVeg: combo.isVeg === true || combo.foodType === "Veg",
      foodType: combo.foodType || (combo.isVeg ? "Veg" : "Non-Veg"),
    };
    if (newQuantity <= 0) {
      removeFromCart(lineItemId);
      return;
    }
    if (!getCartItem(lineItemId)) {
      const result = addToCart(cartItem);
      if (result?.ok === false) {
        toast.error(result.error || "Cannot add item from different restaurant. Please clear cart first.");
        return;
      }
      if (newQuantity > 1) setTimeout(() => updateQuantity(lineItemId, newQuantity), 0);
      return;
    }
    updateQuantity(lineItemId, newQuantity);
  };

  const restaurantIdForFav = restaurant?.restaurantId || restaurant?._id || restaurant?.id;
  const handleBookmarkClick = (item) => {
    if (!restaurantIdForFav) return toast.error("Restaurant information is missing");
    const dishId = item.id || item._id;
    if (!dishId) return toast.error("Dish information is missing");
    if (isDishFavorite(dishId, restaurantIdForFav)) {
      removeDishFavorite(dishId, restaurantIdForFav);
      toast.success("Dish removed from favorites");
    } else {
      addDishFavorite({ id: dishId, name: item.name, description: item.description, price: item.price, originalPrice: item.originalPrice, image: item.image, restaurantId: restaurantIdForFav, restaurantName: restaurant?.name || "", restaurantSlug: restaurant?.slug || slug || "", foodType: item.foodType, isSpicy: item.isSpicy, customisable: item.customisable });
      toast.success("Dish added to favorites");
    }
    return undefined;
  };
  const handleAddToCollection = () => {
    const rs = restaurant?.slug || slug || "";
    if (!rs) return toast.error("Restaurant information is missing");
    if (isFavorite(rs)) {
      removeFavorite(rs);
      toast.success("Restaurant removed from collection");
    } else {
      addFavorite({ slug: rs, name: restaurant.name || "", cuisine: restaurant.cuisine || "", rating: restaurant.rating || 0, deliveryTime: restaurant.deliveryTime || "", distance: restaurant.distance || "", priceRange: restaurant.priceRange || "", image: restaurant.image || "" });
      toast.success("Restaurant added to collection");
    }
    setShowMenuOptionsSheet(false);
    return undefined;
  };
  const handleShareRestaurant = async () => {
    const companyName = await getCompanyNameAsync();
    const rs = restaurant?.slug || slug || "";
    const url = `${WEB_ORIGIN}/user/restaurants/${rs}`;
    setShowMenuOptionsSheet(false);
    shareLink({ title: restaurant?.name || "this restaurant", text: `Check out ${restaurant?.name || "this restaurant"} on ${companyName}!`, url });
  };
  const handleShareClick = (item) => {
    const url = `${WEB_ORIGIN}/user/restaurants/${restaurant?.slug || slug || ""}?dish=${item.id || item._id}`;
    shareLink({ title: `${item.name} - ${restaurant?.name || ""}`, text: `Check out ${item.name} from ${restaurant?.name || "this restaurant"}!`, url });
  };

  const menuCategories = useMemo(() => {
    if (!Array.isArray(restaurant?.menuSections)) return [];
    return restaurant.menuSections
      .map((section, index) => {
        if (isRecommendedSection(section)) return null;
        const title = getSectionDisplayName(section);
        const total = toArray(section?.items).length + toArray(section?.subsections).reduce((s, sub) => s + toArray(sub?.items).length, 0);
        if (total <= 0) return null;
        const image = (typeof section?.image === "string" && section.image.trim()) || toArray(section?.items).find((i) => i?.image)?.image || toArray(section?.subsections).flatMap((s) => toArray(s?.items)).find((i) => i?.image)?.image || "";
        return { id: normalizeMenuCategoryId(section?.categoryId || title || index) || `section-${index}`, name: title, image, count: total, sectionIndex: index };
      })
      .filter(Boolean);
  }, [restaurant?.menuSections]);

  useEffect(() => {
    if (selectedMenuCategory !== "all" && !menuCategories.some((c) => c.id === selectedMenuCategory)) setSelectedMenuCategory("all");
  }, [menuCategories, selectedMenuCategory]);

  const activeFilterCount = [filters.sortBy, filters.vegNonVeg, filters.highlyReordered, filters.spicy].filter(Boolean).length;

  const filterMenuItems = (items) =>
    (items || []).filter((item) => {
      if (showOnlyUnder250 && getFinalPrice(item) > 250) return false;
      if (searchQuery.trim() && !(item.name?.toLowerCase() || "").includes(searchQuery.toLowerCase().trim())) return false;
      if (vegMode === true && item.foodType !== "Veg") return false;
      if (filters.vegNonVeg === "veg" && item.foodType !== "Veg") return false;
      if (filters.vegNonVeg === "non-veg" && item.foodType !== "Non-Veg") return false;
      if (filters.highlyReordered && !isRecommendedItem(item)) return false;
      if (filters.spicy && item.isSpicy !== true) return false;
      return true;
    });
  const sortMenuItems = (items) => {
    if (!items || !filters.sortBy) return items;
    const s = [...items];
    return filters.sortBy === "low-to-high" ? s.sort((a, b) => getFinalPrice(a) - getFinalPrice(b)) : s.sort((a, b) => getFinalPrice(b) - getFinalPrice(a));
  };
  const getSectionSortValue = (section) => {
    const prices = [...toArray(section?.items), ...toArray(section?.subsections).flatMap((s) => toArray(s?.items))].map(getFinalPrice).filter(Number.isFinite);
    if (prices.length === 0) return null;
    return filters.sortBy === "low-to-high" ? Math.min(...prices) : filters.sortBy === "high-to-low" ? Math.max(...prices) : null;
  };

  const filteredSections = useMemo(() => {
    if (!restaurant?.menuSections) return [];
    const visible = restaurant.menuSections
      .map((section, index) => ({
        section: {
          ...section,
          items: sortMenuItems(filterMenuItems(toArray(section?.items).filter((i) => i?.isAvailable !== false))),
          subsections: toArray(section?.subsections)
            .map((sub) => ({ ...sub, items: sortMenuItems(filterMenuItems(toArray(sub?.items).filter((i) => i?.isAvailable !== false))) }))
            .filter((sub) => sub.items.length > 0),
        },
        originalIndex: index,
      }))
      .filter(({ section }) => {
        if (selectedMenuCategory !== "all") {
          if (isRecommendedSection(section)) return false;
          if (normalizeMenuCategoryId(section?.categoryId || getSectionDisplayName(section)) !== selectedMenuCategory) return false;
        }
        return section.items.length > 0 || section.subsections.length > 0;
      });
    if (!filters.sortBy) return visible;
    return [...visible].sort((l, r) => {
      const lv = getSectionSortValue(l.section);
      const rv = getSectionSortValue(r.section);
      if (lv == null && rv == null) return 0;
      if (lv == null) return 1;
      if (rv == null) return -1;
      return filters.sortBy === "low-to-high" ? lv - rv : rv - lv;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant?.menuSections, showOnlyUnder250, searchQuery, vegMode, filters, selectedMenuCategory, restaurant?.discount, restaurant?.itemDiscounts, restaurant?.discountRules]);

  const hasActiveMenuFilters = Boolean(showOnlyUnder250 || searchQuery.trim() || vegMode === true || filters.sortBy || filters.vegNonVeg || filters.highlyReordered || filters.spicy);
  const totalFilteredItems = useMemo(() => filteredSections.reduce((c, { section }) => c + section.items.length + section.subsections.reduce((s, sub) => s + sub.items.length, 0), 0), [filteredSections]);
  const paginatedSections = useMemo(() => {
    if (visibleItemCount >= totalFilteredItems) return filteredSections;
    let count = 0;
    return filteredSections
      .map(({ section, originalIndex }) => {
        if (count >= visibleItemCount) return { section: { ...section, items: [], subsections: [] }, originalIndex };
        const ns = { ...section, items: [], subsections: [] };
        if (section.subsections?.length > 0) {
          for (const sub of section.subsections) {
            if (count >= visibleItemCount) break;
            const take = (sub.items || []).slice(0, visibleItemCount - count);
            count += take.length;
            ns.subsections.push({ ...sub, items: take });
          }
        } else {
          const take = (section.items || []).slice(0, visibleItemCount - count);
          count += take.length;
          ns.items = take;
        }
        return { section: ns, originalIndex };
      })
      .filter((s) => s.section.items?.length > 0 || s.section.subsections?.some((sub) => sub.items?.length > 0));
  }, [filteredSections, visibleItemCount, totalFilteredItems]);

  useEffect(() => setVisibleItemCount(20), [filteredSections]);
  useEffect(() => {
    if (!hasActiveMenuFilters) return;
    setExpandedSections((prev) => {
      const n = new Set(prev);
      filteredSections.forEach(({ section, originalIndex }) => {
        n.add(originalIndex);
        section.subsections.forEach((_, j) => n.add(`${originalIndex}-${j}`));
      });
      return n;
    });
  }, [filteredSections, hasActiveMenuFilters]);

  // highlight searched dish
  useEffect(() => {
    if (!restaurant?.menuSections || !targetDishId) return undefined;
    let found = false;
    restaurant.menuSections.forEach((s) => {
      if ([...toArray(s.items), ...toArray(s.subsections).flatMap((ss) => toArray(ss.items))].some((i) => String(i?.id || i?._id || "").trim() === targetDishId)) found = true;
    });
    if (!found) return undefined;
    setHighlightedDishId(targetDishId);
    const st = setTimeout(() => {
      const y = dishY.current[targetDishId];
      if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 200), animated: true });
    }, 450);
    const ht = setTimeout(() => setHighlightedDishId((c) => (c === targetDishId ? null : c)), 3500);
    return () => {
      clearTimeout(st);
      clearTimeout(ht);
    };
  }, [restaurant?.menuSections, targetDishId]);

  // rotating offer line
  const offersList = Array.isArray(restaurant?.offers) ? restaurant.offers : [];
  useEffect(() => {
    if (offersList.length <= 1) return undefined;
    const i = setInterval(() => setHighlightIndex((p) => (p + 1) % offersList.length), 3000);
    return () => clearInterval(i);
  }, [offersList.length]);
  const activeOffer = offersList.length > 0 ? offersList[highlightIndex % offersList.length] : null;
  const offerIndicatorCount = Math.min(offersList.length > 0 ? offersList.length : 1, 5);
  const activeOfferIndicator = highlightIndex % offerIndicatorCount;
  const offerHeadline = activeOffer?.title || restaurant?.offerText || "No offers currently available";
  const offerSubline = activeOffer?.description || activeOffer?.subtitle || (activeOffer?.code ? `Use code ${activeOffer.code}` : "Tap to view all offers");

  const ratingValue = Number(restaurant?.rating || 0);
  const hasRating = Number.isFinite(ratingValue) && ratingValue > 0;
  const ratingLabel = hasRating ? ratingValue.toFixed(1) : "New";
  const reviewsCount = Number(restaurant?.reviews || 0);
  const reviewsLabel = hasRating && reviewsCount > 0 ? `${reviewsCount.toLocaleString()}+ ratings` : "New";
  const goBack = () => (router.canGoBack() ? router.back() : router.replace(showOnlyUnder250 ? "/under-250" : "/"));

  const toggleSection = (key) =>
    setExpandedSections((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  const renderPrice = (item) => {
    const priceStr = getFoodPriceLabel(item);
    const isStartingFrom = priceStr.includes("Starting from");
    const priceNum = parseFloat(priceStr.replace(/[^0-9.]/g, ""));
    if (isNaN(priceNum)) return <Txt weight={600} style={{ fontSize: 14, color: palette.gray900 }}>{priceStr}</Txt>;
    const { discountValue, isFlatDiscount, discountAmount } = calculateBestDiscount(item, priceNum);
    if (discountAmount > 0) {
      const dp = Math.max(0, Math.round(priceNum - discountAmount));
      const pct = Math.round(((priceNum - dp) / priceNum) * 100);
      return (
        <View style={{ gap: 2, marginTop: 2 }}>
          {isStartingFrom ? <Txt weight={500} style={{ fontSize: 11, color: palette.gray500 }}>Starting from</Txt> : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Txt weight={400} style={{ fontSize: 11, color: palette.gray500, textDecorationLine: "line-through" }}>₹{priceNum}</Txt>
            <Txt weight={700} style={{ fontSize: 15, color: palette.gray900 }}>₹{dp}</Txt>
          </View>
          <View style={styles.offTag}>
            <Tag size={8} color={palette.green600} />
            <Txt weight={700} style={{ fontSize: 9, color: palette.green600, marginLeft: 2 }}>{isFlatDiscount ? `₹${discountValue} OFF` : `${pct}% OFF`}</Txt>
          </View>
        </View>
      );
    }
    if (isStartingFrom)
      return (
        <View>
          <Txt weight={500} style={{ fontSize: 11, color: palette.gray500 }}>Starting from</Txt>
          <Txt weight={600} style={{ fontSize: 14, color: palette.gray900 }}>₹{priceNum}</Txt>
        </View>
      );
    return <Txt weight={600} style={{ fontSize: 14, color: palette.gray900 }}>{priceStr}</Txt>;
  };

  const renderDishCard = (item) => {
    const quantity = getDishQuantity(item);
    const id = item.id || item._id;
    const isHighlighted = highlightedDishId === id;
    const fav = isDishFavorite(id, restaurantIdForFav);
    return (
      <Pressable
        key={id}
        onLayout={(e) => {
          dishY.current[id] = (dishY.current.__base || 0) + e.nativeEvent.layout.y;
        }}
        onPress={() => setSelectedItem(item)}
        style={[styles.dish, isHighlighted && styles.dishHighlight]}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <VegBox isVeg={item.foodType === "Veg"} />
            {item.isSpicy ? <Txt weight={600} style={{ fontSize: 12, color: palette.red500 }}>Spicy</Txt> : null}
          </View>
          <Txt weight={700} style={{ fontSize: 18, color: palette.gray800, lineHeight: 22 }}>{item.name}</Txt>
          {isRecommendedItem(item) ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
              <View style={{ height: 6, width: 64, backgroundColor: palette.gray200, borderRadius: 3, overflow: "hidden" }}>
                <View style={{ height: "100%", width: "75%", backgroundColor: palette.yellow }} />
              </View>
              <Txt weight={500} style={{ fontSize: 12, color: palette.gray500 }}>Highly reordered</Txt>
            </View>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
            {renderPrice(item)}
            {item.preparationTime && String(item.preparationTime).trim() ? (
              <View style={styles.prepPill}>
                <Clock size={12} color={palette.gray500} />
                <Txt weight={500} style={{ fontSize: 12, color: palette.gray600 }}>{String(item.preparationTime).trim()}</Txt>
              </View>
            ) : null}
          </View>
          {item.description ? <Txt weight={400} numberOfLines={2} style={{ fontSize: 14, color: palette.gray500, marginTop: 4 }}>{item.description}</Txt> : null}
          <View style={{ flexDirection: "row", gap: 16, marginTop: 12 }}>
            <Pressable onPress={() => handleBookmarkClick(item)} style={[styles.iconBtn, fav && { borderColor: palette.red500, backgroundColor: palette.red50 }]}>
              <Bookmark size={18} color={fav ? palette.red500 : palette.gray600} fill={fav ? palette.red500 : "transparent"} />
            </Pressable>
            <Pressable onPress={() => handleShareClick(item)} style={styles.iconBtn}>
              <Share2 size={18} color={palette.gray600} />
            </Pressable>
          </View>
        </View>
        <View style={{ width: 128, height: 128 }}>
          <View style={styles.dishImg}>
            <AppImage src={item.image} style={StyleSheet.absoluteFill} width={400} />
            {shouldShowGrayscale ? (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.3)", alignItems: "center", justifyContent: "center" }]}>
                <View style={styles.closedPill}>
                  <Txt weight={800} style={{ fontSize: 9, color: palette.white, letterSpacing: 1 }}>CLOSED</Txt>
                </View>
              </View>
            ) : null}
          </View>
          {quantity > 0 ? (
            <View style={[styles.qtyPill, shouldShowGrayscale && styles.addDisabled]}>
              <Pressable disabled={shouldShowGrayscale} onPress={() => updateItemQuantity(item, Math.max(0, quantity - 1))} hitSlop={8}>
                <Minus size={16} color={shouldShowGrayscale ? palette.gray500 : palette.orange500} strokeWidth={3} />
              </Pressable>
              <Txt weight={800} style={{ fontSize: 14, color: palette.orange600 }}>{quantity}</Txt>
              <Pressable disabled={shouldShowGrayscale} onPress={() => updateItemQuantity(item, quantity + 1)} hitSlop={8}>
                <Plus size={16} color={shouldShowGrayscale ? palette.gray500 : palette.orange500} strokeWidth={3} />
              </Pressable>
            </View>
          ) : (
            <Pressable disabled={shouldShowGrayscale} onPress={() => updateItemQuantity(item, 1)} style={[styles.addBtn, shouldShowGrayscale && { backgroundColor: palette.gray400, borderColor: palette.gray400 }]}>
              <Txt weight={800} style={{ fontSize: 12, letterSpacing: 2, color: shouldShowGrayscale ? palette.white : palette.orange500 }}>{isRestaurantOffline ? "CLOSED" : "ADD"}</Txt>
              {!isRestaurantOffline ? <Txt weight={500} style={{ fontSize: 16, color: palette.orange500, marginTop: -2 }}> +</Txt> : null}
            </Pressable>
          )}
        </View>
      </Pressable>
    );
  };

  /* ---------------- render ---------------- */
  const scanOverlay = showScan ? (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.white, padding: 16, paddingTop: insets.top + 12, gap: 20, zIndex: 9999 }]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Skeleton width={44} height={44} radius={22} />
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Skeleton width={96} height={44} radius={22} />
          <Skeleton width={44} height={44} radius={22} />
        </View>
      </View>
      <Skeleton height={224} radius={30} />
      <Skeleton height={110} radius={30} />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} height={110} radius={24} />
      ))}
    </View>
  ) : null;

  if (loadingRestaurant && !restaurant) return <Screen bg={palette.white}>{scanOverlay || <View />}</Screen>;
  if (!restaurant) {
    const isConn = String(restaurantError || "").includes("Backend server is not connected");
    return (
      <Screen bg={palette.gray50}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, gap: 16 }}>
          <AlertCircle size={48} color={isConn ? palette.yellow : palette.red500} />
          <Txt weight={600} style={{ fontSize: 18, color: palette.gray900 }}>{isConn ? "Connection Error" : restaurantError === "Restaurant not found" || !restaurantError ? "Restaurant not found" : "Error"}</Txt>
          {restaurantError && restaurantError !== "Restaurant not found" ? <Txt weight={400} style={{ fontSize: 14, color: palette.gray600, textAlign: "center" }}>{restaurantError}</Txt> : null}
          <Button title="Go Back" variant="outline" rounded="md" onPress={goBack} />
        </View>
      </Screen>
    );
  }

  const fssai = restaurant?.onboarding?.step3?.fssai?.registrationNumber;

  return (
    <Screen bg={palette.white}>
      <View style={[{ flex: 1 }, shouldShowGrayscale && { opacity: 0.75 }]}>
        <View style={styles.topBar}>
          <Pressable onPress={goBack} style={styles.roundBtn}>
            <ArrowLeft size={20} color={palette.gray900} />
          </Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1, justifyContent: "flex-end", marginLeft: 12 }}>
            {!showSearch ? (
              <Pressable onPress={() => setShowSearch(true)} style={styles.searchPill}>
                <Search size={16} color={palette.gray900} />
                <Txt weight={500} style={{ fontSize: 14, color: palette.gray900 }}>Search</Txt>
              </Pressable>
            ) : (
              <View style={styles.searchBox}>
                <Search size={16} color={palette.gray400} />
                <TextInput
                  autoFocus
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search for dishes..."
                  placeholderTextColor={palette.gray400}
                  style={styles.searchInput}
                  onBlur={() => !searchQuery && setShowSearch(false)}
                />
                {searchQuery ? (
                  <Pressable
                    onPress={() => {
                      setSearchQuery("");
                      setShowSearch(false);
                    }}
                  >
                    <X size={16} color={palette.gray400} />
                  </Pressable>
                ) : null}
              </View>
            )}
            <Pressable onPress={() => setShowMenuOptionsSheet(true)} style={styles.roundBtn}>
              <MoreVertical size={20} color={palette.gray900} />
            </Pressable>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onScroll={(e) => {
            const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
            if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 800) setVisibleItemCount((p) => (p >= totalFilteredItems ? p : p + 20));
          }}
          scrollEventThrottle={200}
          contentContainerStyle={{ paddingBottom: 160 }}
        >
          <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 12 }}>
            {/* Summary card */}
            <View style={styles.summary}>
              <LinearGradient colors={[palette.yellow, "#8a4b77", "#b36b8f"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6 }} />
              <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Txt weight={700} numberOfLines={1} style={{ fontSize: 24, color: palette.gray900, flexShrink: 1 }}>{restaurant.name || "Unknown Restaurant"}</Txt>
                    {isRestaurantOffline ? (
                      <View style={{ backgroundColor: palette.gray400, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                        <Txt weight={800} style={{ fontSize: 10, color: palette.white, letterSpacing: 1.5 }}>CLOSED</Txt>
                      </View>
                    ) : null}
                  </View>
                  <View style={{ marginTop: 4, flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Utensils size={16} color={palette.gray700} />
                    <Txt weight={400} style={{ fontSize: 14, color: palette.gray700 }}>{restaurant.topCategory || restaurant.cuisine || "Multi-cuisine"}</Txt>
                  </View>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <View style={styles.ratingBadge}>
                    <Star size={12} color={palette.white} fill={palette.white} />
                    <Txt weight={600} style={{ fontSize: 12, color: palette.white }}>{ratingLabel}</Txt>
                  </View>
                  <Txt weight={400} style={{ marginTop: 4, fontSize: 12, color: palette.gray500 }}>{reviewsLabel}</Txt>
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flex: 1, minWidth: 0 }}>
                  <MapPin size={16} color={palette.gray700} />
                  <Txt weight={400} numberOfLines={1} style={{ fontSize: 14, color: palette.gray700, flex: 1 }}>{restaurant.distance || "1.2 km"} | {restaurant.location || "Location"}</Txt>
                </View>
                <View style={{ backgroundColor: isRestaurantOffline ? "#e11d48" : palette.emerald600, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Txt weight={600} style={{ fontSize: 12, color: palette.white }}>{isRestaurantOffline ? "Closed" : "Open now"}</Txt>
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Clock size={16} color={palette.gray700} />
                <Txt weight={400} style={{ fontSize: 14, color: palette.gray700 }}>{restaurant.deliveryTime || "25-30 mins"}</Txt>
              </View>
            </View>

            {isRestaurantOffline ? (
              <View style={styles.closedNotice}>
                <Txt weight={400} style={{ fontSize: 14, color: "#be123c" }}>This restaurant is currently closed. Orders are unavailable right now.</Txt>
              </View>
            ) : null}

            {restaurant.discount > 0 ? (
              <View style={styles.discountCard}>
                <View style={styles.discountIcon}>
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={palette.green600} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M12.864 2.227l8.909 8.91a2.182 2.182 0 010 3.085l-7.364 7.364a2.182 2.182 0 01-3.085 0l-8.91-8.91A2.182 2.182 0 012 11.137V4.41A2.182 2.182 0 014.182 2.23h6.727a2.182 2.182 0 011.955-.003z" />
                  </Svg>
                </View>
                <View>
                  <Txt weight={800} style={{ fontSize: 14, color: "#166534", letterSpacing: 0.5 }}>FLAT {restaurant.discount}% OFF</Txt>
                  <Txt weight={500} style={{ fontSize: 12, color: palette.green600, marginTop: 2 }}>Applied automatically on all items</Txt>
                </View>
              </View>
            ) : null}

            <Pressable onPress={() => setShowOffersSheet(true)} style={styles.couponCard}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                <View style={styles.couponIcon}>
                  <Percent size={20} color={palette.orange600} />
                </View>
                <View style={{ flex: 1, minWidth: 0, justifyContent: "center" }}>
                  <Txt weight={600} numberOfLines={1} style={{ fontSize: 14, color: palette.gray900 }}>{offerHeadline}</Txt>
                  <Txt weight={400} numberOfLines={1} style={{ fontSize: 12, color: palette.gray500, marginTop: 2 }}>{offerSubline}</Txt>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <View style={styles.ratingSoft}>
                    <Star size={12} color="#047857" fill="#047857" />
                    <Txt weight={600} style={{ fontSize: 12, color: "#047857" }}>{ratingLabel}</Txt>
                  </View>
                  <Txt weight={400} style={{ fontSize: 10, color: palette.gray400 }}>{reviewsLabel}</Txt>
                </View>
              </View>
              <View style={{ marginTop: 10, flexDirection: "row", gap: 6, paddingLeft: 56 }}>
                {Array.from({ length: offerIndicatorCount }).map((_, i) => (
                  <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: i === activeOfferIndicator ? palette.orange500 : palette.gray200 }} />
                ))}
              </View>
            </Pressable>

            {/* Filter + category rows */}
            <View style={styles.filterWrap}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 8, paddingHorizontal: 16 }} style={{ borderBottomWidth: 1, borderBottomColor: palette.gray100 }}>
                <Pressable onPress={() => setShowFilterSheet(true)} style={styles.filterBtn}>
                  <SlidersHorizontal size={16} color={palette.gray900} />
                  <Txt weight={500} style={{ fontSize: 13, color: palette.gray900 }}>Filters</Txt>
                  {activeFilterCount > 0 ? (
                    <View style={styles.filterCount}>
                      <Txt weight={600} style={{ fontSize: 11, color: palette.white }}>{activeFilterCount}</Txt>
                    </View>
                  ) : null}
                  <ChevronDown size={12} color={palette.gray900} />
                </Pressable>
                {vegModeOption !== "pure-veg" ? (
                  <Pressable onPress={() => setFilters((p) => ({ ...p, vegNonVeg: p.vegNonVeg === "veg" ? null : "veg" }))} style={[styles.filterBtn, { borderRadius: 999 }, filters.vegNonVeg === "veg" && { borderColor: palette.green600, backgroundColor: palette.green50 }]}>
                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: palette.green600 }} />
                    <Txt weight={filters.vegNonVeg === "veg" ? 700 : 500} style={{ fontSize: 13, color: filters.vegNonVeg === "veg" ? palette.green700 : palette.gray900 }}>Veg</Txt>
                    {filters.vegNonVeg === "veg" ? <X size={12} color={palette.gray600} /> : null}
                  </Pressable>
                ) : null}
                {vegModeOption !== "pure-veg" && !vegMode ? (
                  <Pressable onPress={() => setFilters((p) => ({ ...p, vegNonVeg: p.vegNonVeg === "non-veg" ? null : "non-veg" }))} style={[styles.filterBtn, { borderRadius: 999 }, filters.vegNonVeg === "non-veg" && { borderColor: palette.red600, backgroundColor: palette.red50 }]}>
                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: palette.red600 }} />
                    <Txt weight={500} style={{ fontSize: 13, color: filters.vegNonVeg === "non-veg" ? palette.red600 : palette.gray900 }}>Non-veg</Txt>
                    {filters.vegNonVeg === "non-veg" ? <X size={12} color={palette.gray600} /> : null}
                  </Pressable>
                ) : null}
              </ScrollView>
              {menuCategories.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 10, paddingBottom: 2, paddingHorizontal: 16 }}>
                  <Pressable onPress={() => setSelectedMenuCategory("all")} style={[styles.catChip, selectedMenuCategory === "all" && styles.catChipActive]}>
                    <Txt weight={600} style={{ fontSize: 14, color: selectedMenuCategory === "all" ? palette.black : palette.gray700 }}>All</Txt>
                  </Pressable>
                  {menuCategories.map((c) => (
                    <Pressable key={c.id} onPress={() => setSelectedMenuCategory(c.id)} style={[styles.catChip, selectedMenuCategory === c.id && styles.catChipActive]}>
                      {c.image ? (
                        <AppImage src={c.image} style={{ width: 24, height: 24, borderRadius: 12 }} width={100} />
                      ) : (
                        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: palette.gray100, alignItems: "center", justifyContent: "center" }}>
                          <Txt weight={700} style={{ fontSize: 10, color: palette.gray500 }}>{(c.name?.charAt(0) || "C").toUpperCase()}</Txt>
                        </View>
                      )}
                      <Txt weight={600} style={{ fontSize: 14, color: selectedMenuCategory === c.id ? palette.black : palette.gray700 }}>{c.name}</Txt>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}
            </View>
          </View>

          {loadingMenuItems && !restaurant.menuSections?.length ? (
            <View style={{ padding: 16, gap: 16 }}>
              <Skeleton height={24} width={160} radius={12} color={palette.gray100} />
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} height={96} radius={16} color={palette.gray100} />
              ))}
            </View>
          ) : null}

          {restaurant.menuSections?.length > 0 ? (
            <View
              style={{ paddingHorizontal: 16, paddingVertical: 24, gap: 24 }}
              onLayout={(e) => {
                menuTopY.current = e.nativeEvent.layout.y;
              }}
            >
              {filteredSections.length === 0 && hasActiveMenuFilters ? (
                <View style={styles.dashedBox}>
                  <Txt weight={500} style={{ fontSize: 14, color: palette.gray700 }}>No dishes match the selected filters.</Txt>
                  <Txt weight={400} style={{ fontSize: 12, color: palette.gray500, marginTop: 8 }}>Clear filters or try a different combination.</Txt>
                </View>
              ) : null}
              {filteredSections.length === 0 ? (
                <View style={[styles.dashedBox, { borderRadius: 24 }]}>
                  <Txt weight={400} style={{ fontSize: 14, color: palette.gray500 }}>No dishes match the current filters.</Txt>
                </View>
              ) : null}

              {combos.length > 0 ? (
                <View style={{ gap: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View>
                      <Txt weight={700} style={{ fontSize: 18, color: palette.gray900 }}>Combo offers</Txt>
                      <Txt weight={400} style={{ fontSize: 12, color: palette.gray500 }}>Meal bundles at a special price</Txt>
                    </View>
                    <View style={{ backgroundColor: "rgba(254,198,0,0.15)", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 }}>
                      <Txt weight={600} style={{ fontSize: 12, color: palette.black }}>{combos.length} {combos.length === 1 ? "deal" : "deals"}</Txt>
                    </View>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 8 }} style={{ marginHorizontal: -16, paddingHorizontal: 16 }}>
                    {combos.map((combo) => {
                      const qty = getComboQuantity(combo);
                      const comboPrice = Number(combo.comboPrice ?? combo.price) || 0;
                      const originalPrice = Number(combo.originalPrice) || 0;
                      const savings = Math.max(0, originalPrice - comboPrice);
                      const isVeg = combo.isVeg === true || combo.foodType === "Veg";
                      const image = combo.image || (Array.isArray(combo.images) && combo.images[0]) || "";
                      const contents = (Array.isArray(combo.items) ? combo.items : []).map((ci) => `${ci.quantity || 1} x ${ci.name}${ci.variantName ? ` (${ci.variantName})` : ""}`).join(" + ");
                      return (
                        <View key={combo.id || combo._id} style={styles.comboCard}>
                          <View style={{ height: 128, backgroundColor: palette.gray100 }}>
                            {image ? <AppImage src={image} style={StyleSheet.absoluteFill} width={600} /> : null}
                            {savings > 0 ? (
                              <View style={styles.saveBadge}>
                                <Txt weight={700} style={{ fontSize: 11, color: palette.white }}>Save {R}{Math.round(savings)}</Txt>
                              </View>
                            ) : null}
                            <View style={{ position: "absolute", top: 8, right: 8, backgroundColor: palette.white, borderRadius: 2 }}>
                              <VegBox isVeg={isVeg} />
                            </View>
                          </View>
                          <View style={{ padding: 12, gap: 8 }}>
                            <Txt weight={700} numberOfLines={1} style={{ fontSize: 15, color: palette.gray900 }}>{combo.name}</Txt>
                            <Txt weight={400} numberOfLines={2} style={{ fontSize: 12, color: palette.gray500, minHeight: 32 }}>{contents}</Txt>
                            <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
                              <View style={{ flexDirection: "row", alignItems: "baseline" }}>
                                <Txt weight={700} style={{ fontSize: 16, color: palette.gray900 }}>{R}{Math.round(comboPrice)}</Txt>
                                {originalPrice > comboPrice ? <Txt weight={400} style={{ marginLeft: 8, fontSize: 12, color: palette.gray400, textDecorationLine: "line-through" }}>{R}{Math.round(originalPrice)}</Txt> : null}
                              </View>
                              {qty > 0 ? (
                                <View style={styles.comboQty}>
                                  <Pressable onPress={() => updateComboQuantity(combo, qty - 1)} style={{ paddingHorizontal: 10, paddingVertical: 6 }}><Minus size={14} color={palette.black} /></Pressable>
                                  <Txt weight={600} style={{ minWidth: 24, textAlign: "center", fontSize: 14, color: palette.black }}>{qty}</Txt>
                                  <Pressable onPress={() => updateComboQuantity(combo, qty + 1)} style={{ paddingHorizontal: 10, paddingVertical: 6 }}><Plus size={14} color={palette.black} /></Pressable>
                                </View>
                              ) : (
                                <Pressable onPress={() => updateComboQuantity(combo, 1)} style={styles.comboAdd}>
                                  <Txt weight={700} style={{ fontSize: 14, color: palette.black }}>ADD</Txt>
                                </Pressable>
                              )}
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}

              {paginatedSections.map(({ section, originalIndex }) => {
                const isRec = isRecommendedSection(section);
                const isExpanded = expandedSections.has(originalIndex);
                const items = toArray(section?.items);
                const subs = toArray(section?.subsections);
                return (
                  <View
                    key={`sec-${originalIndex}`}
                    style={{ gap: 4 }}
                    onLayout={(e) => {
                      sectionY.current[originalIndex] = menuTopY.current + e.nativeEvent.layout.y;
                      dishY.current.__base = sectionY.current[originalIndex];
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <Txt weight={700} style={{ fontSize: 18, color: palette.gray900, flex: 1 }}>{isRec ? "Recommended for you" : getSectionDisplayName(section)}</Txt>
                      <Pressable onPress={() => toggleSection(originalIndex)} style={{ padding: 4 }}>
                        <ChevronDown size={20} color={palette.gray600} style={{ transform: [{ rotate: isExpanded ? "0deg" : "-90deg" }] }} />
                      </Pressable>
                    </View>
                    {section.subtitle && !isRec ? <Txt weight={400} style={{ fontSize: 14, color: palette.blue600, textDecorationLine: "underline" }}>{section.subtitle}</Txt> : null}
                    {isExpanded && isRec && !loadingMenuItems && items.length === 0 ? (
                      <View style={{ alignItems: "center", paddingVertical: 32 }}>
                        <Txt weight={400} style={{ fontSize: 14, color: palette.gray500 }}>No dish recommended</Txt>
                      </View>
                    ) : null}
                    {isExpanded && items.length > 0 ? <View>{items.map((i) => renderDishCard(i))}</View> : null}
                    {isExpanded && subs.length > 0 ? (
                      <View style={{ gap: 16 }}>
                        {subs.map((sub, j) => {
                          const key = `${originalIndex}-${j}`;
                          const subExpanded = expandedSections.has(key);
                          return (
                            <View key={key} style={{ gap: 16 }}>
                              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                <Txt weight={600} style={{ fontSize: 16, color: palette.gray900 }}>{sub?.name || sub?.title || "Subsection"}</Txt>
                                <Pressable onPress={() => toggleSection(key)} style={{ padding: 4 }}>
                                  <ChevronDown size={16} color={palette.gray500} style={{ transform: [{ rotate: subExpanded ? "0deg" : "-90deg" }] }} />
                                </Pressable>
                              </View>
                              {subExpanded && toArray(sub?.items).length > 0 ? <View>{toArray(sub.items).map((i) => renderDishCard(i))}</View> : null}
                            </View>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null}

          {!loadingMenuItems && menuUnavailable ? (
            <View style={{ padding: 16 }}>
              <View style={styles.dashedBox}>
                <Txt weight={500} style={{ fontSize: 14, color: palette.gray700 }}>Menu is not available yet.</Txt>
                <Txt weight={400} style={{ fontSize: 12, color: palette.gray500, marginTop: 8 }}>The restaurant has not uploaded its menu.</Txt>
              </View>
            </View>
          ) : null}

          {fssai ? (
            <View style={styles.fssai}>
              <View style={styles.fssaiLogo}>
                <RNImage source={localImages.fssai} style={{ height: "100%", width: "100%" }} resizeMode="contain" />
              </View>
              <View style={{ flex: 1 }}>
                <Txt weight={700} style={{ fontSize: 10, color: palette.gray400, letterSpacing: 2, marginBottom: 4 }}>LICENSE NO.</Txt>
                <Txt weight={600} style={{ fontSize: 14, color: palette.gray600, fontFamily: "monospace", letterSpacing: 0.5 }}>{fssai}</Txt>
              </View>
            </View>
          ) : null}
        </ScrollView>
      </View>

      {/* Floating MENU button + cart pill */}
      {!showScan ? (
        <View pointerEvents="box-none" style={[styles.menuFloat, { bottom: (itemCount > 0 ? 74 : 16) + insets.bottom }]}>
          <Pressable onPress={() => setShowMenuSheet(true)} style={styles.menuBtn}>
            <Utensils size={16} color={palette.white} />
            <Txt weight={700} style={{ fontSize: 12, color: palette.white, letterSpacing: 2 }}>MENU</Txt>
          </Pressable>
        </View>
      ) : null}
      {!showScan ? <CartPill bottom={16 + insets.bottom} /> : null}

      {/* Menu categories sheet */}
      <BottomSheet visible={showMenuSheet} onClose={() => setShowMenuSheet(false)} maxHeightRatio={0.85}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 24 }}>
          {menuCategories.map((c, i) => (
            <Pressable
              key={i}
              onPress={() => {
                setShowMenuSheet(false);
                setExpandedSections((p) => new Set(p).add(c.sectionIndex));
                setVisibleItemCount(totalFilteredItems);
                setTimeout(() => {
                  const y = sectionY.current[c.sectionIndex];
                  if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: true });
                }, 400);
              }}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, paddingHorizontal: 8 }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                {c.image ? (
                  <AppImage src={c.image} style={{ width: 40, height: 40, borderRadius: 12, borderWidth: 1, borderColor: palette.gray200 }} width={120} />
                ) : (
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: palette.gray100, alignItems: "center", justifyContent: "center" }}>
                    <Txt weight={700} style={{ fontSize: 14, color: palette.gray500 }}>{(c.name?.charAt(0) || "C").toUpperCase()}</Txt>
                  </View>
                )}
                <Txt weight={500} numberOfLines={1} style={{ fontSize: 16, color: palette.gray900, flex: 1 }}>{c.name}</Txt>
              </View>
              <Txt weight={400} style={{ fontSize: 14, color: palette.gray500 }}>{c.count}</Txt>
            </Pressable>
          ))}
        </ScrollView>
        <View style={{ borderTopWidth: 1, borderTopColor: palette.gray200, padding: 16 }}>
          <Button title="Close" rounded="xl" size="lg" onPress={() => setShowMenuSheet(false)} icon={<X size={16} color={palette.black} />} />
        </View>
      </BottomSheet>

      {/* Filters sheet */}
      <BottomSheet visible={showFilterSheet} onClose={() => setShowFilterSheet(false)} maxHeightRatio={0.8}>
        <View style={styles.sheetHead}>
          <Txt weight={600} style={{ fontSize: 18, color: palette.gray900 }}>Filters and Sorting</Txt>
          <Pressable onPress={() => setShowFilterSheet(false)} style={{ padding: 8 }}><X size={20} color={palette.gray600} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 16 }}>
          <View style={{ gap: 8 }}>
            <Txt weight={600} style={{ fontSize: 14, color: palette.gray900 }}>Sort by:</Txt>
            {[["low-to-high", "Price - low to high"], ["high-to-low", "Price - high to low"]].map(([id, label]) => (
              <Pressable key={id} onPress={() => setFilters((p) => ({ ...p, sortBy: p.sortBy === id ? null : id }))} style={[styles.sortOpt, filters.sortBy === id && { borderColor: palette.blue500, backgroundColor: palette.blue50 }]}>
                <Txt weight={400} style={{ fontSize: 14, color: filters.sortBy === id ? "#1d4ed8" : palette.gray700 }}>{label}</Txt>
              </Pressable>
            ))}
          </View>
          {vegModeOption !== "pure-veg" ? (
            <View style={{ gap: 8 }}>
              <Txt weight={600} style={{ fontSize: 14, color: palette.gray900 }}>Veg/Non-veg preference:</Txt>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable onPress={() => setFilters((p) => ({ ...p, vegNonVeg: p.vegNonVeg === "veg" ? null : "veg" }))} style={[styles.sortOpt, { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }, filters.vegNonVeg === "veg" && { borderColor: palette.green600, backgroundColor: palette.green50 }]}>
                  <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: palette.green600 }} />
                  <Txt weight={500} style={{ fontSize: 14, color: filters.vegNonVeg === "veg" ? palette.green700 : palette.gray700 }}>Veg</Txt>
                </Pressable>
                {!vegMode ? (
                  <Pressable onPress={() => setFilters((p) => ({ ...p, vegNonVeg: p.vegNonVeg === "non-veg" ? null : "non-veg" }))} style={[styles.sortOpt, { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }, filters.vegNonVeg === "non-veg" && { borderColor: palette.red600, backgroundColor: palette.red50 }]}>
                    <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: palette.red600 }} />
                    <Txt weight={500} style={{ fontSize: 14, color: filters.vegNonVeg === "non-veg" ? palette.red600 : palette.gray700 }}>Non-veg</Txt>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}
        </ScrollView>
        <View style={[styles.sheetFoot, { justifyContent: "space-between" }]}>
          <Pressable onPress={() => setFilters({ sortBy: null, vegNonVeg: null, highlyReordered: false, spicy: false })}>
            <Txt weight={500} style={{ fontSize: 14, color: palette.red600 }}>Clear All</Txt>
          </Pressable>
          <Button title={`Apply${activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}`} rounded="lg" size="md" onPress={() => setShowFilterSheet(false)} />
        </View>
      </BottomSheet>

      {/* Item detail sheet */}
      <BottomSheet visible={!!selectedItem} onClose={() => setSelectedItem(null)} contentStyle={{ overflow: "visible" }}>
        {selectedItem ? (
          <>
            <Pressable onPress={() => setSelectedItem(null)} style={styles.closeFloat}><X size={20} color={palette.white} /></Pressable>
            <View style={{ height: 256, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden", backgroundColor: palette.gray100 }}>
              {selectedItem.image ? (
                <AppImage src={selectedItem.image} style={StyleSheet.absoluteFill} width={1000} />
              ) : (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                  <Txt weight={400} style={{ fontSize: 14, color: palette.gray400 }}>No image available</Txt>
                </View>
              )}
              <View style={{ position: "absolute", bottom: 16, right: 16, flexDirection: "row", gap: 12 }}>
                {(() => {
                  const fav = isDishFavorite(selectedItem.id || selectedItem._id, restaurantIdForFav);
                  return (
                    <Pressable onPress={() => handleBookmarkClick(selectedItem)} style={[styles.roundIcon, fav && { borderColor: palette.red500, backgroundColor: palette.red50 }]}>
                      <Bookmark size={20} color={fav ? palette.red500 : palette.gray600} fill={fav ? palette.red500 : "transparent"} />
                    </Pressable>
                  );
                })()}
                <Pressable onPress={() => handleShareClick(selectedItem)} style={styles.roundIcon}><Share2 size={20} color={palette.gray600} /></Pressable>
              </View>
            </View>
            <ScrollView style={{ maxHeight: 280 }} contentContainerStyle={{ padding: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <VegBox isVeg={selectedItem.foodType === "Veg"} size={20} />
                <Txt weight={700} style={{ fontSize: 20, color: palette.gray900, flex: 1 }}>{selectedItem.name}</Txt>
              </View>
              {selectedItem.description ? <Txt weight={400} style={{ fontSize: 14, color: palette.gray600, lineHeight: 22, marginBottom: 16 }}>{selectedItem.description}</Txt> : null}
              {isRecommendedItem(selectedItem) ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <View style={{ flex: 1, height: 2, backgroundColor: palette.gray200, borderRadius: 1 }}>
                    <View style={{ height: "100%", width: "50%", backgroundColor: palette.green500 }} />
                  </View>
                  <Txt weight={500} style={{ fontSize: 12, color: palette.gray600 }}>highly reordered</Txt>
                </View>
              ) : null}
              {selectedItem.notEligibleForCoupons ? <Txt weight={500} style={{ fontSize: 12, color: palette.gray500, marginBottom: 16 }}>NOT ELIGIBLE FOR COUPONS</Txt> : null}
              {hasFoodVariants(selectedItem) ? (
                <View style={{ marginBottom: 16 }}>
                  <Txt weight={600} style={{ fontSize: 14, color: palette.gray900, marginBottom: 8 }}>Choose a variant</Txt>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {getFoodVariants(selectedItem).map((v) => {
                      const active = String(selectedVariantId || "") === String(v.id);
                      return (
                        <Pressable key={v.id} onPress={() => setSelectedVariantId(v.id)} style={[styles.variantChip, active && { borderColor: palette.red500, backgroundColor: palette.red50 }]}>
                          <Txt weight={500} style={{ fontSize: 14, color: active ? palette.red600 : palette.gray700 }}>{v.name} · {R}{Math.round(v.price)}</Txt>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </ScrollView>
            <View style={styles.actionBar}>
              {(() => {
                const q = getDishQuantity(selectedItem, selectedVariantId);
                const variant = getVariantForDish(selectedItem, selectedVariantId);
                const basePrice = hasFoodVariants(selectedItem) ? variant?.price || selectedItem.price : selectedItem.price;
                const priceNum = Number(basePrice) || 0;
                const { discountAmount } = calculateBestDiscount(selectedItem, priceNum);
                const discounted = Math.max(0, priceNum - discountAmount);
                const prefix = hasFoodVariants(selectedItem) ? `${variant?.name || "Default"} · ` : "";
                return (
                  <>
                    <View style={[styles.qtyBox, shouldShowGrayscale && { opacity: 0.5 }]}>
                      <Pressable disabled={q === 0 || shouldShowGrayscale} onPress={() => updateItemQuantity(selectedItem, Math.max(0, q - 1), variant)}>
                        <Minus size={20} color={q === 0 ? palette.gray300 : palette.gray600} />
                      </Pressable>
                      <Txt weight={600} style={{ fontSize: 18, color: palette.gray900, minWidth: 32, textAlign: "center" }}>{q}</Txt>
                      <Pressable disabled={shouldShowGrayscale} onPress={() => updateItemQuantity(selectedItem, q + 1, variant)}>
                        <Plus size={20} color={palette.gray600} />
                      </Pressable>
                    </View>
                    <Pressable
                      disabled={shouldShowGrayscale}
                      onPress={() => {
                        updateItemQuantity(selectedItem, q + 1, variant);
                        setSelectedItem(null);
                      }}
                      style={[styles.addItemBtn, shouldShowGrayscale && { backgroundColor: palette.gray300, opacity: 0.5 }]}
                    >
                      <Txt weight={600} style={{ fontSize: 14, color: palette.black }}>Add item</Txt>
                      {discountAmount > 0 ? (
                        <>
                          <Txt weight={400} style={{ fontSize: 14, color: "#991b1b", textDecorationLine: "line-through" }}>{R}{Math.round(priceNum)}</Txt>
                          <Txt weight={700} style={{ fontSize: 16, color: palette.black }}>{prefix}{R}{Math.round(discounted)}</Txt>
                        </>
                      ) : selectedItem.originalPrice && selectedItem.originalPrice > basePrice ? (
                        <>
                          <Txt weight={400} style={{ fontSize: 14, color: "#991b1b", textDecorationLine: "line-through" }}>{R}{Math.round(selectedItem.originalPrice)}</Txt>
                          <Txt weight={700} style={{ fontSize: 16, color: palette.black }}>{prefix}{R}{Math.round(basePrice)}</Txt>
                        </>
                      ) : (
                        <Txt weight={700} style={{ fontSize: 16, color: palette.black }}>{prefix}{R}{Math.round(basePrice)}</Txt>
                      )}
                    </Pressable>
                  </>
                );
              })()}
            </View>
          </>
        ) : null}
      </BottomSheet>

      {/* Offers sheet */}
      <BottomSheet visible={showOffersSheet} onClose={() => setShowOffersSheet(false)} maxHeightRatio={0.85}>
        <View style={[styles.sheetHead, { paddingTop: 24 }]}>
          <Txt weight={700} style={{ fontSize: 18, color: palette.gray900 }}>Offers at {restaurant.name || "Unknown Restaurant"}</Txt>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {restaurant.restaurantOffers?.coupons?.length > 0 ? (
            <View>
              <Txt weight={600} style={{ fontSize: 14, color: palette.gray900, marginBottom: 12 }}>Restaurant coupons</Txt>
              <View style={{ gap: 12 }}>
                {restaurant.restaurantOffers.coupons.map((coupon, ci) => {
                  const key = coupon?.id || coupon?.code || `coupon-${ci}`;
                  const exp = expandedCoupons.has(key);
                  return (
                    <View key={key} style={{ borderWidth: 1, borderColor: palette.gray200, borderRadius: 8, overflow: "hidden" }}>
                      <Pressable
                        onPress={() =>
                          setExpandedCoupons((p) => {
                            const n = new Set(p);
                            if (n.has(key)) n.delete(key);
                            else n.add(key);
                            return n;
                          })
                        }
                        style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 16 }}
                      >
                        <Percent size={20} color={palette.blue600} />
                        <View style={{ flex: 1 }}>
                          <Txt weight={500} style={{ fontSize: 14, color: palette.gray900, marginBottom: 4 }}>{coupon?.title || "Restaurant coupon"}</Txt>
                          <Txt weight={400} style={{ fontSize: 12, color: palette.gray500 }}>Use code {coupon?.code || "N/A"}</Txt>
                        </View>
                        <Pressable onPress={() => coupon?.code && Clipboard.setStringAsync(coupon.code)} style={{ paddingHorizontal: 12, paddingVertical: 4, backgroundColor: palette.gray100, borderRadius: 4 }}>
                          <Txt weight={500} style={{ fontSize: 12, color: palette.gray700 }}>{coupon?.code || "Copy"}</Txt>
                        </Pressable>
                        <ChevronDown size={16} color={palette.gray500} style={{ transform: [{ rotate: exp ? "180deg" : "0deg" }] }} />
                      </Pressable>
                      {exp ? (
                        <View style={{ paddingHorizontal: 16, paddingBottom: 16, paddingTop: 8, borderTopWidth: 1, borderTopColor: palette.gray100 }}>
                          <Txt weight={400} style={{ fontSize: 12, color: palette.gray600 }}>Terms and conditions apply</Txt>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}
        </ScrollView>
        <View style={{ borderTopWidth: 1, borderTopColor: palette.gray200, padding: 16 }}>
          <Button title="Close" rounded="xl" size="lg" onPress={() => setShowOffersSheet(false)} icon={<X size={16} color={palette.black} />} />
        </View>
      </BottomSheet>

      {/* Menu options (collection / share / FSSAI) */}
      <BottomSheet visible={showMenuOptionsSheet} onClose={() => setShowMenuOptionsSheet(false)} maxHeightRatio={0.7}>
        <View style={[styles.sheetHead, { paddingTop: 24 }]}>
          <Txt weight={700} style={{ fontSize: 18, color: palette.gray900 }}>{restaurant.name || "Unknown Restaurant"}</Txt>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Pressable onPress={handleAddToCollection} style={styles.optRow}>
            <Bookmark size={20} color={palette.gray700} />
            <Txt weight={400} style={{ fontSize: 16, color: palette.gray900 }}>{isFavorite(restaurant.slug || slug || "") ? "Remove from Collection" : "Add to Collection"}</Txt>
          </Pressable>
          <Pressable onPress={handleShareRestaurant} style={styles.optRow}>
            <Share2 size={20} color={palette.gray700} />
            <Txt weight={400} style={{ fontSize: 16, color: palette.gray900 }}>Share this restaurant</Txt>
          </Pressable>
          <View style={{ marginTop: 24, paddingHorizontal: 8 }}>
            <Txt weight={400} style={{ fontSize: 12, color: palette.gray500, lineHeight: 19 }}>Menu items, prices, photos and descriptions are set directly by the restaurant. In case you see any incorrect information, please report it to us.</Txt>
          </View>
          {fssai ? (
            <View style={{ marginTop: 16, paddingHorizontal: 8, paddingTop: 16, borderTopWidth: 1, borderTopColor: palette.gray100, flexDirection: "row", alignItems: "center", gap: 12, opacity: 0.8 }}>
              <View style={{ height: 32, width: 56, backgroundColor: palette.white, borderRadius: 4, padding: 4, borderWidth: 1, borderColor: palette.gray100 }}>
                <RNImage source={localImages.fssai} style={{ height: "100%", width: "100%" }} resizeMode="contain" />
              </View>
              <View>
                <Txt weight={500} style={{ fontSize: 10, color: palette.gray500, letterSpacing: 1 }}>LIC. NO.</Txt>
                <Txt weight={600} style={{ fontSize: 12, color: palette.gray700 }}>{fssai}</Txt>
              </View>
            </View>
          ) : null}
        </ScrollView>
        <View style={{ alignItems: "center", paddingVertical: 8 }}>
          <View style={{ height: 4, width: 48, backgroundColor: palette.gray300, borderRadius: 2 }} />
        </View>
      </BottomSheet>

      {/* Manage collections (kept for parity; opened from bookmark flows) */}
      <BottomSheet visible={showManageCollections} onClose={() => setShowManageCollections(false)}>
        <View style={[styles.sheetHead, { paddingTop: 24 }]}>
          <Txt weight={700} style={{ fontSize: 18, color: palette.gray900 }}>Manage Collections</Txt>
          <Pressable onPress={() => setShowManageCollections(false)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: palette.gray700, alignItems: "center", justifyContent: "center" }}><X size={16} color={palette.white} /></Pressable>
        </View>
        <View style={{ padding: 16, gap: 8 }}>
          <View style={{ flexDirection: "row", gap: 12, padding: 12 }}>
            <View style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: "#fce7f3", alignItems: "center", justifyContent: "center" }}><Bookmark size={24} color={palette.red500} fill={palette.red500} /></View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Txt weight={500} style={{ fontSize: 16, color: palette.gray900 }}>Bookmarks</Txt>
                <View style={{ width: 20, height: 20, borderRadius: 4, backgroundColor: palette.red500, alignItems: "center", justifyContent: "center" }}><Check size={12} color={palette.white} /></View>
              </View>
              <Txt weight={400} style={{ fontSize: 14, color: palette.gray500, marginTop: 4 }}>{getDishFavorites().length} dishes • {getFavorites().length} restaurant</Txt>
            </View>
          </View>
        </View>
        <View style={{ borderTopWidth: 1, borderTopColor: palette.gray200, padding: 16 }}>
          <Button title="Done" rounded="lg" onPress={() => setShowManageCollections(false)} />
        </View>
      </BottomSheet>

      {scanOverlay}
    </Screen>
  );
}

class RestaurantDetailsErrorBoundary extends Component {
  constructor(p) {
    super(p);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <Screen bg={palette.gray50}>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 16 }}>
            <AlertCircle size={48} color={palette.red500} />
            <Txt weight={600} style={{ fontSize: 18, color: palette.gray900 }}>Something went wrong</Txt>
            <Txt weight={400} style={{ fontSize: 14, color: palette.gray600 }}>We could not load this restaurant page right now.</Txt>
            <Button title="Reload Page" variant="outline" rounded="md" onPress={() => this.setState({ hasError: false })} />
          </View>
        </Screen>
      );
    }
    return this.props.children;
  }
}

export default function RestaurantDetailsScreen() {
  return (
    <RestaurantDetailsErrorBoundary>
      <RestaurantDetailsContent />
    </RestaurantDetailsErrorBoundary>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, backgroundColor: palette.white },
  roundBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: palette.gray200, backgroundColor: palette.white, alignItems: "center", justifyContent: "center", elevation: 1 },
  searchPill: { height: 40, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: palette.gray200, backgroundColor: palette.white, flexDirection: "row", alignItems: "center", gap: 8, elevation: 1 },
  searchBox: { flex: 1, maxWidth: 360, height: 38, borderRadius: 19, borderWidth: 1, borderColor: palette.yellow, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 8 },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: palette.gray900, paddingVertical: 0 },
  summary: { borderRadius: 24, borderWidth: 1, borderColor: palette.gray100, backgroundColor: palette.white, padding: 16, gap: 16, overflow: "hidden", elevation: 4, shadowColor: "#0f172a", shadowOpacity: 0.08, shadowRadius: 40, shadowOffset: { width: 0, height: 16 } },
  ratingBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, backgroundColor: palette.emerald600, paddingHorizontal: 10, paddingVertical: 4 },
  closedNotice: { borderRadius: 8, borderWidth: 1, borderColor: "#fecdd3", backgroundColor: "#fff1f2", paddingHorizontal: 12, paddingVertical: 8 },
  discountCard: { borderRadius: 16, borderWidth: 1, borderColor: "#bbf7d0", backgroundColor: "#f0fdf4", paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  discountIcon: { width: 44, height: 44, borderRadius: 16, backgroundColor: palette.green100, alignItems: "center", justifyContent: "center" },
  couponCard: { borderRadius: 16, borderWidth: 1, borderColor: "rgba(17,24,39,0.2)", backgroundColor: palette.white, paddingHorizontal: 16, paddingVertical: 12, elevation: 3, shadowColor: "#0f172a", shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
  couponIcon: { width: 44, height: 44, borderRadius: 16, backgroundColor: palette.orange100, alignItems: "center", justifyContent: "center" },
  ratingSoft: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, backgroundColor: "#ecfdf5", paddingHorizontal: 10, paddingVertical: 4 },
  filterWrap: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: palette.gray200, paddingVertical: 12, marginHorizontal: -16 },
  filterBtn: { flexDirection: "row", alignItems: "center", gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: palette.gray300, backgroundColor: palette.white },
  filterCount: { position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: palette.red500, alignItems: "center", justifyContent: "center", zIndex: 10 },
  catChip: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, borderWidth: 1, borderColor: palette.gray300, backgroundColor: palette.white, paddingHorizontal: 12, paddingVertical: 6 },
  catChipActive: { borderColor: palette.yellow, backgroundColor: "rgba(254,198,0,0.12)" },
  dashedBox: { borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: palette.gray300, backgroundColor: palette.white, paddingHorizontal: 20, paddingVertical: 32, alignItems: "center" },
  comboCard: { width: 260, borderRadius: 16, borderWidth: 1, borderColor: palette.gray200, backgroundColor: palette.white, overflow: "hidden", elevation: 1 },
  saveBadge: { position: "absolute", top: 8, left: 8, borderRadius: 999, backgroundColor: palette.green600, paddingHorizontal: 8, paddingVertical: 2 },
  comboQty: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "rgba(254,198,0,0.4)", borderRadius: 8, overflow: "hidden" },
  comboAdd: { borderRadius: 8, borderWidth: 1, borderColor: palette.yellow, paddingHorizontal: 16, paddingVertical: 6, backgroundColor: palette.white },
  dish: { flexDirection: "row", gap: 16, padding: 16, paddingBottom: 28, borderBottomWidth: 1, borderBottomColor: palette.gray100, borderRadius: 16 },
  dishHighlight: { borderWidth: 2, borderColor: palette.orange600, backgroundColor: "rgba(255,247,237,0.4)", marginVertical: 6 },
  offTag: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", backgroundColor: palette.green50, borderWidth: 1, borderColor: "#bbf7d0", paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, marginTop: 1 },
  prepPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: palette.gray100, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  iconBtn: { padding: 6, borderWidth: 1, borderColor: palette.gray300, borderRadius: 8 },
  dishImg: { width: 128, height: 128, borderRadius: 16, overflow: "hidden", backgroundColor: palette.gray100 },
  closedPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.75)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  qtyPill: { position: "absolute", bottom: -12, alignSelf: "center", height: 34, minWidth: 92, paddingHorizontal: 12, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, backgroundColor: palette.white, borderWidth: 1, borderColor: palette.orange500, elevation: 4 },
  addDisabled: { backgroundColor: palette.gray300, borderColor: palette.gray300, opacity: 0.5 },
  addBtn: { position: "absolute", bottom: -12, alignSelf: "center", height: 34, minWidth: 92, paddingHorizontal: 20, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: palette.white, borderWidth: 1, borderColor: palette.orange500, elevation: 4 },
  fssai: { paddingHorizontal: 16, paddingVertical: 16, marginTop: 8, marginHorizontal: 16, borderTopWidth: 1, borderStyle: "dashed", borderColor: palette.gray200, backgroundColor: "rgba(249,250,251,0.3)", borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 16 },
  fssaiLogo: { height: 48, width: 80, backgroundColor: palette.white, borderRadius: 8, padding: 6, borderWidth: 1, borderColor: palette.gray100 },
  menuFloat: { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 9998 },
  menuBtn: { minWidth: 110, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: palette.orange500, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", elevation: 6, shadowColor: "#ff6600", shadowOpacity: 0.4, shadowRadius: 15, shadowOffset: { width: 0, height: 4 } },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: palette.gray200 },
  sheetFoot: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: palette.gray200 },
  sortOpt: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 2, borderColor: palette.gray200, backgroundColor: palette.white },
  closeFloat: { position: "absolute", top: -48, alignSelf: "center", width: 40, height: 40, borderRadius: 20, backgroundColor: palette.gray800, alignItems: "center", justifyContent: "center", zIndex: 10, elevation: 6 },
  roundIcon: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: palette.white, backgroundColor: "rgba(255,255,255,0.9)", alignItems: "center", justifyContent: "center" },
  variantChip: { borderRadius: 999, borderWidth: 1, borderColor: palette.gray200, backgroundColor: palette.white, paddingHorizontal: 12, paddingVertical: 6 },
  actionBar: { flexDirection: "row", alignItems: "center", gap: 16, borderTopWidth: 1, borderTopColor: palette.gray200, paddingHorizontal: 16, paddingVertical: 16 },
  qtyBox: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 2, borderColor: palette.gray300, borderRadius: 8, paddingHorizontal: 12, height: 44 },
  addItemBtn: { flex: 1, height: 44, borderRadius: 8, backgroundColor: palette.yellow, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  optRow: { flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 8, paddingVertical: 12 },
});
