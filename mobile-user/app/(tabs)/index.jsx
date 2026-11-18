/**
 * Home — port of Frontend/src/modules/Food/pages/user/Home.jsx (phone layout).
 * Sections in web order: HomeHeader → FestBanner → categories rail → HeroBanner → filter chips →
 * Recommended For You → Ads carousel → Explore More → Gourmet → All Restaurants (grid) → Nearby dishes → End badge.
 * Overlays: filter bottom sheet, veg-mode popups, manage collections sheet, StickyCartCard, VIP modal, OrderTrackingCard, intro splash.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Image, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowDownUp, SlidersHorizontal, MapPin, Timer, Star, IndianRupee, BadgePercent, ShieldCheck, Flame, X, AlertCircle, Bookmark, Check, Plus, Pizza, UtensilsCrossed } from "lucide-react-native";

import Screen from "../../src/components/ui/Screen";
import Txt from "../../src/components/ui/Txt";
import Skeleton from "../../src/components/ui/Skeleton";
import AppImage from "../../src/components/ui/AppImage";
import BottomSheet from "../../src/components/ui/BottomSheet";
import Button from "../../src/components/ui/Button";
import { LinearGradient } from "../../src/components/ui/LinearGradient";
import HomeHeader from "../../src/components/home/HomeHeader";
import FestBanner from "../../src/components/home/FestBanner";
import HeroBanner from "../../src/components/home/HeroBanner";
import RestaurantImageCarousel from "../../src/components/home/RestaurantImageCarousel";
import HomeRestaurantCard from "../../src/components/home/HomeRestaurantCard";
import NearbyDishesSection from "../../src/components/home/NearbyDishesSection";
import ExploreMoreSection from "../../src/components/home/ExploreMoreSection";
import AdsBannerCarousel from "../../src/components/home/AdsBannerCarousel";
import EndOfFeedBadge from "../../src/components/home/EndOfFeedBadge";
import VipSubscriptionModal from "../../src/components/home/VipSubscriptionModal";
import StickyCartCard from "../../src/components/StickyCartCard";
import OrderTrackingCard from "../../src/components/OrderTrackingCard";
import AppIntroSplash from "../../src/components/AppIntroSplash";

import { useProfile } from "../../src/context/ProfileContext";
import { useAppLocation } from "../../src/context/LocationProvider";
import { useLocationSelector } from "../../src/context/SearchOverlayContext";
import { restaurantAPI, publicGetOnce, getPublicLandingSettings, getPublicExploreIcons, getPublicCategories, getPublicGourmetRestaurants } from "../../src/api";
import { getRestaurantAvailabilityStatus } from "../../src/utils/restaurantAvailability";
import { getRestaurantDisplayName } from "../../src/utils/restaurantDisplayName";
import { primeOutletTimingsCache } from "../../src/utils/outletTimingsCache";
import { getMediaUrl } from "../../src/utils/media";
import { foodImages, localImages } from "../../src/constants/images";
import { toast } from "../../src/utils/toast";
import { palette, GRADIENT_YELLOW, BOTTOM_NAV_HEIGHT } from "../../src/theme";

const placeholders = ['Search "burger"', 'Search "biryani"', 'Search "pizza"', 'Search "desserts"', 'Search "chinese"', 'Search "thali"', 'Search "momos"', 'Search "dosa"'];

const homePageCache = {
  effectiveZoneId: null, lat: null, lng: null, landingExploreMore: null, landingExploreFetched: false, exploreMoreHeading: null,
  recommendedRestaurantIds: null, under250PriceLimit: null, recommendedRestaurantsFromSettings: null, festBannerImages: null,
  heroBannerImages: null, heroBannersData: null, heroBannersFetched: false, adsBannerImages: null, adsBannersData: null, adsBannersFetched: false,
  gourmetRestaurants: null, showGourmet: true, restaurantsData: null,
};
const roundCoord = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 100000) / 100000 : null);
const slugifyCategory = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const calcDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.35;
};
const extractImageFromValue = (value) => {
  if (!value) return "";
  if (typeof value === "string") return getMediaUrl(value);
  if (typeof value === "object") {
    const c = value.url || value.secure_url || value.imageUrl || value.imageURL || value.image || value.src || value.path || value.location || value.link || value.href || "";
    return typeof c === "string" ? getMediaUrl(c) : "";
  }
  return "";
};
const extractImages = (source) => {
  if (!source) return [];
  const list = (Array.isArray(source) ? source : [source]).map(extractImageFromValue).filter(Boolean).map((v) => String(v).trim()).filter(Boolean);
  return list.filter((v, i) => list.indexOf(v) === i);
};
const sortRestaurants = (restaurants, sortBy, userLat, userLng) =>
  [...restaurants].sort((a, b) => {
    if (Boolean(a.isBanned) !== Boolean(b.isBanned)) return a.isBanned ? 1 : -1;
    if (!userLat || !userLng) return 0;
    const aOpen = getRestaurantAvailabilityStatus(a, new Date(), { ignoreOperationalStatus: true }).isOpen;
    const bOpen = getRestaurantAvailabilityStatus(b, new Date(), { ignoreOperationalStatus: true }).isOpen;
    if (aOpen !== bOpen) return aOpen ? -1 : 1;
    if (sortBy === "price-low") return (a.featuredPrice || 0) - (b.featuredPrice || 0);
    if (sortBy === "price-high") return (b.featuredPrice || 0) - (a.featuredPrice || 0);
    if (sortBy === "rating-high") return (b.rating || 0) - (a.rating || 0);
    if (sortBy === "rating-low") return (a.rating || 0) - (b.rating || 0);
    if (sortBy === "nearby") return (a.distanceInKm ?? Infinity) - (b.distanceInKm ?? Infinity);
    const aF = a.isFranchise || a.restaurantType === "franchise" ? 0 : 1;
    const bF = b.isFranchise || b.restaurantType === "franchise" ? 0 : 1;
    if (aF !== bF) return aF - bF;
    const aRank = a.zoneRank ?? Infinity;
    const bRank = b.zoneRank ?? Infinity;
    if (aRank !== bRank) return aRank - bRank;
    return (a.distanceInKm ?? Infinity) - (b.distanceInKm ?? Infinity);
  });

const FILTER_TABS = [
  { id: "sort", label: "Sort By", Icon: ArrowDownUp },
  { id: "time", label: "Time", Icon: Timer },
  { id: "rating", label: "Rating", Icon: Star },
  { id: "distance", label: "Distance", Icon: MapPin },
  { id: "price", label: "Dish Price", Icon: IndianRupee },
  { id: "offers", label: "Offers", Icon: BadgePercent },
  { id: "trust", label: "Trust", Icon: ShieldCheck },
];
const SORT_OPTIONS = [
  { id: null, label: "Relevance" },
  { id: "nearby", label: "Nearby" },
  { id: "price-low", label: "Price: Low to High" },
  { id: "price-high", label: "Price: High to Low" },
  { id: "rating-high", label: "Rating: High to Low" },
  { id: "rating-low", label: "Rating: Low to High" },
];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { openLocationSelector } = useLocationSelector();
  const { vegMode, setVegMode: setVegModeContext, vegModeOption, setVegModeOption, addFavorite, removeFavorite, isFavorite, getFavorites, getDefaultAddress } = useProfile();
  const { location, loading: effectiveZoneLoading, zoneId: effectiveZoneId, isOutOfService, isOutOfZone, isOutOfRadius, serviceUnavailableMessage, requestLocation } = useAppLocation();
  // No usable coordinates once location resolution has finished → ask for a location instead of showing a stale zone's data.
  const hasLocation = Number.isFinite(Number(location?.latitude)) && Number.isFinite(Number(location?.longitude));
  const needsLocation = !effectiveZoneLoading && !hasLocation;
  const [locating, setLocating] = useState(false);
  const useCurrentLocation = async () => {
    if (locating) return;
    setLocating(true);
    try {
      await requestLocation?.(true, true);
    } catch (e) {
      toast.error(e?.message || "Unable to detect your location");
    } finally {
      setLocating(false);
    }
  };

  const [introFinished, setIntroFinished] = useState(false);
  const [prevVegMode, setPrevVegMode] = useState(vegMode);
  const [showVegModePopup, setShowVegModePopup] = useState(false);
  const [showSwitchOffPopup, setShowSwitchOffPopup] = useState(false);
  const [isApplyingVegMode, setIsApplyingVegMode] = useState(false);
  const [isSwitchingOffVegMode, setIsSwitchingOffVegMode] = useState(false);
  const isHandlingSwitchOff = useRef(false);

  const [heroBannerImages, setHeroBannerImages] = useState(() => homePageCache.heroBannerImages ?? []);
  const [heroBannersData, setHeroBannersData] = useState(() => homePageCache.heroBannersData ?? []);
  const [loadingBanners, setLoadingBanners] = useState(() => !homePageCache.heroBannersFetched);
  const [advertisements, setAdvertisements] = useState([]);
  const [landingExploreMore, setLandingExploreMore] = useState(() => homePageCache.landingExploreMore || []);
  const [exploreMoreHeading, setExploreMoreHeading] = useState(() => homePageCache.exploreMoreHeading || "Explore More");
  const [festBannerImages, setFestBannerImages] = useState(() => homePageCache.festBannerImages ?? []);
  const [bgIndex, setBgIndex] = useState(0);
  const [recommendedRestaurantIds, setRecommendedRestaurantIds] = useState(() => homePageCache.recommendedRestaurantIds || []);
  const [recommendedRestaurantsFromSettings, setRecommendedRestaurantsFromSettings] = useState(() => homePageCache.recommendedRestaurantsFromSettings || []);
  const [gourmetRestaurants, setGourmetRestaurants] = useState(() => homePageCache.gourmetRestaurants || []);
  const [showGourmetSection, setShowGourmetSection] = useState(() => homePageCache.showGourmet ?? true);
  const [loadingLandingConfig, setLoadingLandingConfig] = useState(() => !homePageCache.landingExploreFetched);
  const [restaurantsData, setRestaurantsData] = useState(() => homePageCache.restaurantsData || []);
  const [loadingRestaurants, setLoadingRestaurants] = useState(() => !homePageCache.restaurantsData);
  const [realCategories, setRealCategories] = useState([]);
  const [loadingRealCategories, setLoadingRealCategories] = useState(true);
  const [menuCategories, setMenuCategories] = useState([]);
  const [loadingMenuCategories, setLoadingMenuCategories] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All");

  const [activeFilters, setActiveFilters] = useState(new Set());
  const [sortBy, setSortBy] = useState(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState({ activeFilters: new Set(), sortBy: null, selectedCuisine: null });
  const [isLoadingFilterResults, setIsLoadingFilterResults] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState("sort");
  const filterScrollRef = useRef(null);
  const filterSectionY = useRef({});
  const restaurantsRequestSeqRef = useRef(0);
  const menuUnionRequestSeqRef = useRef(0);
  const menuUnionCacheRef = useRef(new Map());
  const [showManageCollections, setShowManageCollections] = useState(false);
  const [selectedRestaurantSlug, setSelectedRestaurantSlug] = useState(null);

  const festVideoActive = Array.isArray(festBannerImages) && festBannerImages.length > 0;
  useEffect(() => {
    if (!festVideoActive || festBannerImages.length <= 1) return undefined;
    const t = setInterval(() => setBgIndex((p) => (p + 1) % festBannerImages.length), 5000);
    return () => clearInterval(t);
  }, [festVideoActive, festBannerImages.length]);

  const effectiveLocation = location;
  const showBannerSkeleton = loadingBanners;
  const showCategorySkeleton = loadingRealCategories || loadingMenuCategories;
  const showExploreSkeleton = loadingLandingConfig;
  const showRestaurantSkeleton = isLoadingFilterResults || loadingRestaurants;

  const menuUnionRestaurantIdsKey = useMemo(
    () => (Array.isArray(restaurantsData) && restaurantsData.length ? restaurantsData.map((r) => String(r?.restaurantId || r?.id || "").trim()).filter(Boolean).sort().join(",") : ""),
    [restaurantsData],
  );

  const finalExploreItems = useMemo(() => {
    const fallback = [
      { id: "offers", label: "Offers", image: localImages.explore.offers, fallbackImage: localImages.explore.offers, href: "/offers" },
      { id: "gourmet", label: "Gourmet", image: localImages.explore.gourmet, fallbackImage: localImages.explore.gourmet, href: "/gourmet" },
      { id: "collection", label: "Collections", image: localImages.explore.collection, fallbackImage: localImages.explore.collection, href: "/profile/favorites" },
    ];
    if (!landingExploreMore || landingExploreMore.length === 0) return fallback;
    return fallback.map((item) => {
      const apiItem = landingExploreMore.find((ai) => ai.label?.toLowerCase() === item.label?.toLowerCase());
      if (!apiItem) return item;
      const link = apiItem.link ? (apiItem.link.startsWith("/") ? apiItem.link : `/${apiItem.link}`) : item.href;
      const href = link.replace(/^\/food\/user/, "").replace(/^\/user/, "") || "/";
      const rawImg = apiItem.imageUrl || apiItem.image || "";
      const isBroken = typeof rawImg === "string" && /xv4gkshv/i.test(rawImg);
      return { ...item, image: isBroken ? item.image : getMediaUrl(rawImg) || item.image, fallbackImage: item.image, href };
    });
  }, [landingExploreMore]);

  const displayCategories = useMemo(() => (realCategories.length > 0 ? realCategories : menuCategories), [menuCategories, realCategories]);

  useEffect(() => {
    if (vegMode !== prevVegMode && !isHandlingSwitchOff.current) setPrevVegMode(vegMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vegMode]);

  const handleVegModeChange = (newValue) => {
    if (isHandlingSwitchOff.current) return;
    if (newValue && !prevVegMode) setShowVegModePopup(true);
    else if (!newValue && prevVegMode) {
      isHandlingSwitchOff.current = true;
      setShowSwitchOffPopup(true);
    } else {
      setVegModeContext(newValue);
      setPrevVegMode(newValue);
    }
  };

  /* ---------- categories ---------- */
  useEffect(() => {
    if (effectiveZoneLoading) return undefined;
    let cancelled = false;
    (async () => {
      try {
        setLoadingRealCategories(true);
        const data = await getPublicCategories(effectiveZoneId || null);
        if (cancelled) return;
        const list = data?.categories || (Array.isArray(data) ? data : []);
        setRealCategories(
          (Array.isArray(list) ? list : []).map((cat, idx) => ({
            id: String(cat?.id || cat?._id || cat?.slug || idx),
            name: cat?.name || "",
            slug: cat?.slug || String(cat?.name || "").toLowerCase().replace(/\s+/g, "-"),
            image: getMediaUrl(cat?.image || cat?.imageUrl) || foodImages[idx % foodImages.length] || foodImages[0],
            type: cat?.type || "",
          })),
        );
      } catch {
        if (!cancelled) setRealCategories([]);
      } finally {
        if (!cancelled) setLoadingRealCategories(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveZoneId, effectiveZoneLoading]);

  /* ---------- landing config ---------- */
  useEffect(() => {
    if (effectiveZoneLoading) return undefined;
    if (homePageCache.landingExploreFetched && homePageCache.effectiveZoneId === effectiveZoneId) {
      setLoadingLandingConfig(false);
      return undefined;
    }
    let cancelled = false;
    setLoadingLandingConfig(true);
    Promise.all([getPublicExploreIcons(effectiveZoneId).catch(() => ({})), getPublicLandingSettings(effectiveZoneId).catch(() => ({})), getPublicGourmetRestaurants(effectiveZoneId).catch(() => [])])
      .then(([exploreData, settings, gourmetData]) => {
        if (cancelled) return;
        const items = Array.isArray(exploreData?.items) ? exploreData.items : Array.isArray(exploreData) ? exploreData : [];
        const exploreMoreData = items.map((it) => ({ ...it, imageUrl: it.imageUrl || it.iconUrl, label: it.label || it.name }));
        setLandingExploreMore(exploreMoreData);
        const s = settings || {};
        const heading = s.exploreMoreHeading || "Explore More";
        setExploreMoreHeading(heading);
        setRecommendedRestaurantIds(s.recommendedRestaurantIds || []);
        setRecommendedRestaurantsFromSettings(s.recommendedRestaurants || []);
        const images = Array.isArray(s.festBannerImages) ? s.festBannerImages : [];
        setFestBannerImages(images);
        const gourmetList = Array.isArray(gourmetData) ? gourmetData : [];
        setGourmetRestaurants(gourmetList);
        setShowGourmetSection(s.showGourmet ?? true);
        Object.assign(homePageCache, { landingExploreMore: exploreMoreData, exploreMoreHeading: heading, recommendedRestaurantIds: s.recommendedRestaurantIds || [], under250PriceLimit: Number(s.under250PriceLimit) || 250, recommendedRestaurantsFromSettings: s.recommendedRestaurants || [], festBannerImages: images, gourmetRestaurants: gourmetList, showGourmet: s.showGourmet ?? true, landingExploreFetched: true, effectiveZoneId });
      })
      .catch(() => {
        if (!cancelled) {
          setLandingExploreMore([]);
          setExploreMoreHeading("Explore More");
          setRecommendedRestaurantsFromSettings([]);
          setFestBannerImages([]);
          setGourmetRestaurants([]);
          setShowGourmetSection(true);
        }
        homePageCache.landingExploreFetched = true;
        homePageCache.effectiveZoneId = effectiveZoneId;
      })
      .finally(() => !cancelled && setLoadingLandingConfig(false));
    return () => {
      cancelled = true;
    };
  }, [effectiveZoneId, effectiveZoneLoading]);

  /* ---------- hero banners ---------- */
  useEffect(() => {
    if (effectiveZoneLoading) return undefined;
    if (homePageCache.heroBannersFetched && homePageCache.effectiveZoneId === effectiveZoneId) {
      setLoadingBanners(false);
      return undefined;
    }
    let cancelled = false;
    setLoadingBanners(true);
    publicGetOnce("/food/hero-banners/public", { params: { zoneId: effectiveZoneId } })
      .then((response) => {
        if (cancelled) return;
        const data = response?.data?.data;
        const list = Array.isArray(data?.banners) ? data.banners : Array.isArray(data) ? data : [];
        const images = list.map((b) => (b && typeof b.imageUrl === "string" ? b.imageUrl : "")).filter(Boolean);
        setHeroBannerImages(images);
        setHeroBannersData(list);
        Object.assign(homePageCache, { heroBannerImages: images, heroBannersData: list, heroBannersFetched: true, effectiveZoneId });
      })
      .catch(() => {
        if (cancelled) return;
        setHeroBannerImages([]);
        setHeroBannersData([]);
        Object.assign(homePageCache, { heroBannerImages: [], heroBannersData: [], heroBannersFetched: true, effectiveZoneId });
      })
      .finally(() => !cancelled && setLoadingBanners(false));
    return () => {
      cancelled = true;
    };
  }, [effectiveZoneId, effectiveZoneLoading]);

  /* ---------- advertisements ---------- */
  useEffect(() => {
    let cancelled = false;
    publicGetOnce("/food/advertisements/public")
      .then((response) => !cancelled && setAdvertisements(response?.data?.data?.advertisements || []))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  /* ---------- restaurants ---------- */
  const fetchRestaurants = useCallback(
    async (filters = {}) => {
      const isDefaultFetch = Object.keys(filters).length === 0 || (!filters.sortBy && !filters.selectedCuisine && (!filters.activeFilters || filters.activeFilters.size === 0));
      if (isDefaultFetch && effectiveZoneLoading) return;
      if (!effectiveZoneId && !effectiveLocation?.city) {
        setLoadingRestaurants(false);
        setRestaurantsData([]);
        return;
      }
      const isLocationSame = homePageCache.lat === roundCoord(effectiveLocation?.latitude) && homePageCache.lng === roundCoord(effectiveLocation?.longitude);
      if (isDefaultFetch && homePageCache.restaurantsData && homePageCache.restaurantsData.length > 0 && homePageCache.effectiveZoneId === effectiveZoneId && isLocationSame) {
        setLoadingRestaurants(false);
        return;
      }
      const requestSeq = ++restaurantsRequestSeqRef.current;
      try {
        setLoadingRestaurants(true);
        const params = {};
        const effectiveLat = effectiveLocation?.latitude ?? effectiveLocation?.lat;
        const effectiveLng = effectiveLocation?.longitude ?? effectiveLocation?.lng;
        if (Number.isFinite(effectiveLat) && Number.isFinite(effectiveLng)) {
          params.lat = effectiveLat;
          params.lng = effectiveLng;
        }
        if (filters.sortBy) params.sortBy = filters.sortBy;
        if (filters.selectedCuisine) params.cuisine = filters.selectedCuisine;
        const af = filters.activeFilters;
        if (af?.has("rating-45-plus")) params.minRating = 4.5;
        else if (af?.has("rating-4-plus")) params.minRating = 4.0;
        else if (af?.has("rating-35-plus")) params.minRating = 3.5;
        if (af?.has("delivery-under-30")) params.maxDeliveryTime = 30;
        else if (af?.has("delivery-under-45")) params.maxDeliveryTime = 45;
        if (af?.has("distance-under-1km")) params.radiusKm = 1.0;
        else if (af?.has("distance-under-2km")) params.radiusKm = 2.0;
        if (af?.has("price-under-200")) params.maxPrice = 200;
        else if (af?.has("price-under-500")) params.maxPrice = 500;
        if (af?.has("has-offers")) params.hasOffers = "true";
        if (af?.has("top-rated")) params.topRated = "true";
        else if (af?.has("trusted")) params.trusted = "true";
        if (effectiveZoneId) params.zoneId = effectiveZoneId;

        const response = await restaurantAPI.getRestaurants(params, { noCache: true });
        if (requestSeq !== restaurantsRequestSeqRef.current) return;
        if (response.data?.success && response.data.data?.restaurants) {
          const restaurantsArray = response.data.data.restaurants;
          if (restaurantsArray.length === 0) {
            setRestaurantsData([]);
            return;
          }
          const userLat = effectiveLocation?.latitude ?? effectiveLocation?.lat;
          const userLng = effectiveLocation?.longitude ?? effectiveLocation?.lng;
          const transformed = restaurantsArray.map((restaurant) => {
            const deliveryTime = restaurant.estimatedDeliveryTime || "25-30 mins";
            let distance = restaurant.distance || "1.2 km";
            const rl = restaurant.location;
            const rLat = rl?.latitude || (Array.isArray(rl?.coordinates) ? rl.coordinates[1] : null);
            const rLng = rl?.longitude || (Array.isArray(rl?.coordinates) ? rl.coordinates[0] : null);
            let distanceInKm = null;
            if (restaurant.distanceText) {
              distance = restaurant.distanceText;
              distanceInKm = restaurant.distanceInfo?.distanceValue ? restaurant.distanceInfo.distanceValue / 1000 : null;
            } else if (userLat && userLng && rLat && rLng && !isNaN(userLat) && !isNaN(userLng) && !isNaN(rLat) && !isNaN(rLng)) {
              distanceInKm = calcDistance(userLat, userLng, rLat, rLng);
              distance = distanceInKm >= 1 ? `${distanceInKm.toFixed(1)} km` : `${Math.round(distanceInKm * 1000)} m`;
            }
            const cuisine = restaurant.cuisines?.length > 0 ? restaurant.cuisines[0] : "Multi-cuisine";
            const menuImages = extractImages((Array.isArray(restaurant.menuImages) ? restaurant.menuImages : [restaurant.menuImages]).filter(Boolean));
            const carouselImages = Array.from(new Set(menuImages)).reverse();
            return {
              id: restaurant.restaurantId || restaurant._id,
              mongoId: restaurant._id || null,
              name: getRestaurantDisplayName(restaurant),
              cuisine,
              cuisines: Array.isArray(restaurant.cuisines) ? restaurant.cuisines : [],
              rating: Number(restaurant.rating) || 0,
              deliveryTime: restaurant.deliveryTime || restaurant.estimatedDeliveryTime || (restaurant.estimatedDeliveryTimeMinutes ? `${restaurant.estimatedDeliveryTimeMinutes} mins` : deliveryTime),
              distance,
              distanceInKm,
              image: carouselImages[0] || "",
              images: carouselImages,
              priceRange: restaurant.priceRange || "$$",
              featuredDish: restaurant.featuredDish || (restaurant.cuisines?.length > 0 ? `${restaurant.cuisines[0]} Special` : "Special Dish"),
              featuredPrice: restaurant.featuredPrice || 249,
              menuItems: restaurant.menu?.sections ? restaurant.menu.sections.reduce((acc, s) => acc.concat(s.items || []), []) : Array.isArray(restaurant.menuItems) ? restaurant.menuItems : Array.isArray(restaurant.topItems) ? restaurant.topItems : [],
              popularItems: Array.isArray(restaurant.popularItems) ? restaurant.popularItems : [],
              itemDiscounts: Array.isArray(restaurant.itemDiscounts) ? restaurant.itemDiscounts : [],
              recommendedItems: Array.isArray(restaurant.recommendedItems) ? restaurant.recommendedItems : [],
              previewItems: Array.isArray(restaurant.previewItems) ? restaurant.previewItems : [],
              offers: Array.isArray(restaurant.offers) ? restaurant.offers : [],
              discountRules: Array.isArray(restaurant.discountRules) ? restaurant.discountRules : [],
              offer: restaurant.offer || null,
              slug: restaurant.slug,
              restaurantId: restaurant.restaurantId,
              pureVegRestaurant: restaurant.pureVegRestaurant === true,
              location: restaurant.location,
              isActive: restaurant.isActive !== false,
              isBanned: Boolean(restaurant.isBanned || restaurant.status === "banned" || (restaurant.status === "rejected" && /disabled by admin|banned/i.test(restaurant.rejectionReason || ""))),
              isAcceptingOrders: restaurant.isAcceptingOrders !== false,
              openDays: Array.isArray(restaurant.openDays) ? restaurant.openDays : [],
              deliveryTimings: restaurant.deliveryTimings || null,
              outletTimings: restaurant.outletTimings || null,
              openingTime: restaurant.openingTime || restaurant?.deliveryTimings?.openingTime || null,
              closingTime: restaurant.closingTime || restaurant?.deliveryTimings?.closingTime || null,
              zoneRank: restaurant.zoneRank || null,
              discount: restaurant.discount || 0,
              distanceText: restaurant.distanceText || null,
              distanceInfo: restaurant.distanceInfo || null,
              isFranchise: restaurant.isFranchise,
              restaurantType: restaurant.restaurantType,
              zoneId: restaurant.zoneId,
              status: restaurant.status,
              rejectionReason: restaurant.rejectionReason,
            };
          });
          transformed.forEach((r) => r?.mongoId && r?.outletTimings && primeOutletTimingsCache(r.mongoId, r.outletTimings));
          const finalSorted = sortRestaurants(transformed, filters.sortBy, userLat, userLng);
          setRestaurantsData(finalSorted);
          if (isDefaultFetch) {
            homePageCache.restaurantsData = finalSorted;
            homePageCache.effectiveZoneId = effectiveZoneId;
            homePageCache.lat = roundCoord(effectiveLocation?.latitude);
            homePageCache.lng = roundCoord(effectiveLocation?.longitude);
          }
        } else setRestaurantsData([]);
      } catch {
        setRestaurantsData([]);
      } finally {
        if (requestSeq === restaurantsRequestSeqRef.current) setLoadingRestaurants(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [effectiveLocation?.latitude, effectiveLocation?.longitude, effectiveLocation?.lat, effectiveLocation?.lng, effectiveLocation?.city, effectiveLocation?.state, effectiveZoneId, effectiveZoneLoading],
  );

  const applyFiltersAndRefetch = useCallback(
    async (nextActiveFilters = activeFilters, nextSortBy = sortBy) => {
      const next = { activeFilters: new Set(nextActiveFilters), sortBy: nextSortBy, selectedCuisine: null };
      setAppliedFilters(next);
      setIsLoadingFilterResults(true);
      try {
        await fetchRestaurants(next);
      } finally {
        setIsLoadingFilterResults(false);
      }
    },
    [activeFilters, sortBy, fetchRestaurants],
  );

  useEffect(() => {
    fetchRestaurants(appliedFilters);
  }, [appliedFilters, fetchRestaurants]);

  // recalc distances on location change
  useEffect(() => {
    if (!effectiveLocation?.latitude || !effectiveLocation?.longitude) return;
    setRestaurantsData((prev) => {
      if (!prev || prev.length === 0) return prev;
      let hasChanges = false;
      const updated = prev.map((r) => {
        if (!r.location) return r;
        const rLat = r.location?.latitude || (Array.isArray(r.location?.coordinates) ? r.location.coordinates[1] : null);
        const rLng = r.location?.longitude || (Array.isArray(r.location?.coordinates) ? r.location.coordinates[0] : null);
        if (!rLat || !rLng || isNaN(rLat) || isNaN(rLng)) return r;
        let dist;
        let km;
        if (r.distanceText) {
          dist = r.distanceText;
          km = r.distanceInfo?.distanceValue ? r.distanceInfo.distanceValue / 1000 : null;
        } else {
          km = calcDistance(effectiveLocation.latitude, effectiveLocation.longitude, rLat, rLng);
          dist = km >= 1 ? `${km.toFixed(1)} km` : `${Math.round(km * 1000)} m`;
        }
        if (r.distance !== dist || r.distanceInKm !== km) {
          hasChanges = true;
          return { ...r, distance: dist, distanceInKm: km };
        }
        return r;
      });
      if (!hasChanges) return prev;
      return sortRestaurants(updated, appliedFilters.sortBy, effectiveLocation.latitude, effectiveLocation.longitude);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveLocation?.latitude, effectiveLocation?.longitude]);

  // menu-category union fallback (only when admin categories unavailable)
  useEffect(() => {
    const restaurantIds = menuUnionRestaurantIdsKey ? menuUnionRestaurantIdsKey.split(",").filter(Boolean) : [];
    const shouldFetchMenuMeta = realCategories.length === 0;
    const run = async () => {
      const requestSeq = ++menuUnionRequestSeqRef.current;
      if (!menuUnionRestaurantIdsKey || !shouldFetchMenuMeta) {
        setMenuCategories([]);
        setLoadingMenuCategories(false);
        return;
      }
      setLoadingMenuCategories(true);
      try {
        const categoryMap = new Map();
        const menuCache = menuUnionCacheRef.current;
        const menuResponses = [];
        for (let index = 0; index < restaurantIds.length; index += 4) {
          const batch = await Promise.all(
            restaurantIds.slice(index, index + 4).map(async (id) => {
              if (!id) return { id: null, menu: null };
              if (menuCache.has(id)) return { id, menu: menuCache.get(id) };
              try {
                const response = await restaurantAPI.getMenuByRestaurantId(id);
                const menu = response?.data?.data?.menu || null;
                menuCache.set(id, menu);
                return { id, menu };
              } catch {
                menuCache.set(id, null);
                return { id, menu: null };
              }
            }),
          );
          if (requestSeq !== menuUnionRequestSeqRef.current) return;
          menuResponses.push(...batch);
        }
        if (requestSeq !== menuUnionRequestSeqRef.current) return;
        menuResponses.forEach(({ menu }) => {
          (Array.isArray(menu?.sections) ? menu.sections : []).forEach((section) => {
            const categoryName = String(section?.name || "").trim();
            if (!categoryName) return;
            const slug = slugifyCategory(categoryName);
            if (!slug) return;
            let image = "";
            if (Array.isArray(section?.items) && section.items.length > 0) image = getMediaUrl(section.items[0]?.image);
            if (!image && Array.isArray(section?.subsections)) {
              for (const sub of section.subsections) {
                if (Array.isArray(sub?.items) && sub.items.length > 0) {
                  image = getMediaUrl(sub.items[0]?.image);
                  if (image) break;
                }
              }
            }
            if (!categoryMap.has(slug)) categoryMap.set(slug, { id: slug, name: categoryName, slug, label: categoryName, image: image || "" });
            else if (image && !categoryMap.get(slug).image) categoryMap.get(slug).image = image;
          });
        });
        setMenuCategories(
          Array.from(categoryMap.values())
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((c, i) => ({ ...c, image: c.image || foodImages[i % foodImages.length] || foodImages[0] })),
        );
      } finally {
        if (requestSeq === menuUnionRequestSeqRef.current) setLoadingMenuCategories(false);
      }
    };
    run();
  }, [menuUnionRestaurantIdsKey, realCategories.length]);

  const matchesVegMode = useCallback((r) => (!vegMode ? true : vegModeOption === "pure-veg" ? r?.pureVegRestaurant === true : true), [vegMode, vegModeOption]);
  const matchesCategory = useCallback(
    (r) => {
      if (selectedCategory === "All") return true;
      const cuisines = r.cuisines || [];
      if (cuisines.some((c) => c.toLowerCase() === selectedCategory.toLowerCase())) return true;
      const all = [...(r.menuItems || []), ...(r.popularItems || []), ...(r.itemDiscounts || [])];
      return all.some((item) => item.category && item.category.toLowerCase() === selectedCategory.toLowerCase());
    },
    [selectedCategory],
  );
  const filteredRestaurants = useMemo(() => (restaurantsData || []).filter(matchesVegMode).filter(matchesCategory), [restaurantsData, matchesVegMode, matchesCategory]);

  const shouldShowOutOfZoneHome = !effectiveZoneLoading && isOutOfZone;
  const shouldShowOutOfRadiusHome = !effectiveZoneLoading && isOutOfRadius && !showRestaurantSkeleton && filteredRestaurants.length === 0;

  const recommendedForYouRestaurants = useMemo(() => {
    if (!effectiveZoneId) return [];
    const idsInOrder = (recommendedRestaurantIds || []).map(String);
    const hasIds = idsInOrder.length > 0;
    const fromSettings = Array.isArray(recommendedRestaurantsFromSettings) ? recommendedRestaurantsFromSettings : [];
    const mapped = fromSettings
      .filter((r) => {
        const rZoneId = r?.zoneId?._id || r?.zoneId;
        return rZoneId ? String(rZoneId) === String(effectiveZoneId) : true;
      })
      .map((restaurant, index) => {
        const restaurantId = restaurant?._id ? String(restaurant._id) : "";
        const matched = (restaurantsData || []).find((r) => String(r.mongoId || r.id || r._id || "") === restaurantId);
        const cuisine = Array.isArray(restaurant?.cuisines) && restaurant.cuisines.length > 0 ? restaurant.cuisines[0] : matched?.cuisine || "Multi-cuisine";
        const menuImages = extractImages((Array.isArray(restaurant?.menuImages) ? restaurant.menuImages : [restaurant?.menuImages]).filter(Boolean));
        const coverImages = extractImages((Array.isArray(restaurant?.coverImages) ? restaurant.coverImages : [restaurant?.coverImages]).filter(Boolean));
        const profileImg = restaurant?.profileImage?.url || (typeof restaurant?.profileImage === "string" ? restaurant.profileImage : "");
        const all = [...(matched?.images || []), ...coverImages, ...menuImages, ...(profileImg ? [profileImg] : []), ...(matched?.image ? [matched.image] : [])].filter((img) => img && !img.includes("xv4gkshv"));
        const carouselImages = Array.from(new Set(all));
        const finalImage = carouselImages[0] || matched?.image || foodImages[index % foodImages.length];
        return {
          ...(matched || {}),
          ...restaurant,
          id: restaurant?.restaurantId || restaurantId,
          mongoId: restaurantId,
          name: getRestaurantDisplayName(restaurant),
          cuisine,
          rating: Number(restaurant?.rating ?? matched?.rating) || 0,
          distance: matched?.distance || "",
          deliveryTime: matched?.deliveryTime || "",
          image: getMediaUrl(finalImage) || finalImage,
          images: carouselImages.length > 0 ? carouselImages : [finalImage],
          coverImages: coverImages.length > 0 ? coverImages : matched?.coverImages || [],
          recommendedItems: matched?.recommendedItems?.length > 0 ? matched.recommendedItems : restaurant?.recommendedItems || [],
          slug: restaurant?.slug || matched?.slug || restaurantId,
          offer: restaurant?.offer || matched?.offer || null,
          pureVegRestaurant: restaurant?.pureVegRestaurant === true || matched?.pureVegRestaurant === true,
          isActive: true,
          isAcceptingOrders: true,
          zoneId: restaurant?.zoneId || matched?.zoneId,
        };
      });
    const ordered = hasIds ? idsInOrder.map((id) => mapped.find((r) => String(r.mongoId) === id)).filter(Boolean) : mapped;
    const existingIds = new Set(ordered.map((r) => String(r.mongoId || r.id)));
    const missing = (restaurantsData || []).filter((r) => {
      const mongoId = String(r.mongoId || "");
      const rZoneId = r?.zoneId?._id || r?.zoneId;
      const matchesZone = !rZoneId || String(rZoneId) === String(effectiveZoneId);
      return hasIds && idsInOrder.includes(mongoId) && !existingIds.has(mongoId) && matchesZone;
    });
    return [...ordered, ...missing].filter(matchesVegMode).slice(0, 12);
  }, [effectiveZoneId, recommendedRestaurantIds, recommendedRestaurantsFromSettings, restaurantsData, matchesVegMode]);

  const displayGourmetRestaurants = useMemo(() => {
    if (!showGourmetSection || !Array.isArray(gourmetRestaurants) || gourmetRestaurants.length === 0) return [];
    return gourmetRestaurants
      .slice()
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
      .map((gItem) => {
        const gId = String(gItem._id || gItem.mongoId || gItem.id || gItem.restaurantId || "");
        const matched = (restaurantsData || []).find((r) => String(r.mongoId || r.id || r._id || "") === gId);
        if (matched) return { ...matched, priority: gItem.priority ?? 0 };
        const name = gItem.name || gItem.restaurantName || "Restaurant";
        const coverImages = Array.isArray(gItem.coverImages) ? gItem.coverImages : [];
        const profileImg = gItem.profileImage?.url || gItem.profileImage;
        const images = coverImages.length > 0 ? coverImages : profileImg ? [profileImg] : [];
        return { ...gItem, id: gId, mongoId: gId, name, slug: gItem.slug || name.toLowerCase().replace(/\s+/g, "-"), rating: Number(gItem.rating) || 0, cuisines: Array.isArray(gItem.cuisines) ? gItem.cuisines : [], images, coverImages, image: images[0] || null, priority: gItem.priority ?? 0 };
      })
      .filter((r) => !r.isBanned && matchesVegMode(r));
  }, [showGourmetSection, gourmetRestaurants, restaurantsData, matchesVegMode]);

  const handleRestaurantFavoriteToggle = useCallback(
    (restaurant, restaurantSlug, favorite) => {
      if (favorite) {
        setSelectedRestaurantSlug(restaurantSlug);
        setShowManageCollections(true);
      } else {
        addFavorite({ slug: restaurantSlug, name: restaurant.name, cuisine: restaurant.cuisine, rating: restaurant.rating, deliveryTime: restaurant.deliveryTime, distance: restaurant.distance, priceRange: restaurant.priceRange, image: restaurant.image });
        toast.message("Added to bookmark", { duration: 3000 });
      }
    },
    [addFavorite],
  );

  const toggleFilter = (id) =>
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /* ================= NO LOCATION SCREEN ================= */
  if (needsLocation) {
    return (
      <View style={{ flex: 1, backgroundColor: "#1e1332" }}>
        <Image source={localImages.outOfZoneBg} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <LinearGradient colors={["rgba(27,21,45,0)", "rgba(0,0,0,0.6)", "#1b152d"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "70%" }} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingBottom: 80 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: palette.yellow, alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
            <MapPin size={30} color={palette.black} strokeWidth={2.5} />
          </View>
          <Txt weight={900} maxFontSizeMultiplier={1.2} style={{ fontSize: 28, color: palette.white, textAlign: "center", marginBottom: 12, letterSpacing: -0.5 }}>
            Select your location
          </Txt>
          <Txt weight={400} maxFontSizeMultiplier={1.2} style={{ fontSize: 15, color: palette.gray200, textAlign: "center", marginBottom: 36, maxWidth: 380 }}>
            We need your delivery location to show restaurants that deliver to you.
          </Txt>
          <Button title="Use current location" onPress={useCurrentLocation} loading={locating} icon={<MapPin size={18} color={palette.black} />} size="xl" rounded="2xl" weight={800} style={{ width: "100%", maxWidth: 300 }} textStyle={{ fontSize: 17 }} />
          <Button title="Change Location" variant="outline" onPress={() => router.push("/address-selector")} size="xl" rounded="2xl" weight={800} style={{ width: "100%", maxWidth: 300, marginTop: 12, borderColor: palette.white }} textStyle={{ fontSize: 17, color: palette.white }} />
        </View>
      </View>
    );
  }

  /* ================= OUT OF ZONE SCREEN ================= */
  if (shouldShowOutOfZoneHome) {
    return (
      <View style={{ flex: 1, backgroundColor: "#1e1332" }}>
        <Image source={localImages.outOfZoneBg} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <LinearGradient colors={["rgba(27,21,45,0)", "rgba(0,0,0,0.6)", "#1b152d"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "70%" }} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingBottom: 80 }}>
          <Txt weight={900} style={{ fontSize: 30, color: palette.white, textAlign: "center", marginBottom: 12, letterSpacing: -0.5 }}>
            We are coming soon in your city
          </Txt>
          <Txt weight={400} style={{ fontSize: 16, color: palette.gray200, textAlign: "center", marginBottom: 40, maxWidth: 380 }}>
            Please change the location to continue ordering.
          </Txt>
          <Button title="Change Location" onPress={() => router.push("/address-selector")} size="xl" rounded="2xl" weight={800} style={{ width: "100%", maxWidth: 280 }} textStyle={{ fontSize: 18 }} />
        </View>
      </View>
    );
  }

  const chipFilters = [
    { id: "delivery-under-30", label: "Under 30 mins" },
    { id: "delivery-under-45", label: "Under 45 mins" },
    { id: "distance-under-1km", label: "Under 1km", Icon: MapPin },
    { id: "distance-under-2km", label: "Under 2km", Icon: MapPin },
  ];
  const hasAnyFilter = activeFilters.size > 0 || sortBy;

  const renderHeader = () => (
    <View>
      {/* Yellow header background */}
      <View style={styles.headerBg}>
        <LinearGradient colors={GRADIENT_YELLOW} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill}>
          {festVideoActive ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "#0f172a" }]}>
              <AppImage src={festBannerImages[bgIndex]} style={StyleSheet.absoluteFill} contentFit="cover" />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.2)" }]} />
            </View>
          ) : null}
        </LinearGradient>
      </View>
      <View style={{ paddingTop: insets.top }}>
        <HomeHeader location={effectiveLocation} handleLocationClick={openLocationSelector} handleSearchFocus={() => router.push("/search")} placeholders={placeholders} vegMode={vegMode} handleVegModeChange={handleVegModeChange} />
        {festVideoActive ? <View style={{ height: 12 }} /> : <FestBanner isVegMode={vegMode} images={[]} hideFoodImages={false} />}
        <View style={{ height: 12 }} />

        {/* What's on your mind */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Txt weight={700} style={{ fontSize: 18, color: palette.gray900, lineHeight: 22, flexShrink: 1 }}>
              What's on your mind today?
            </Txt>
            <View style={{ flex: 1, height: 1, backgroundColor: palette.gray100 }} />
            <Pressable onPress={() => router.push("/categories")} style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
              <Txt weight={700} style={{ fontSize: 14, color: palette.gray800 }}>
                View All
              </Txt>
              <ArrowDownUp size={12} color={palette.gray800} style={{ transform: [{ rotate: "90deg" }] }} />
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 8 }}>
            {showCategorySkeleton && displayCategories.length === 0
              ? Array.from({ length: 6 }).map((_, i) => (
                  <View key={i} style={{ width: 76, alignItems: "center", gap: 6 }}>
                    <Skeleton width={68} height={68} radius={34} />
                    <Skeleton width={50} height={10} radius={5} />
                  </View>
                ))
              : [{ id: "all", name: "All", slug: "all", image: foodImages[0] }, ...displayCategories].map((category, index) => {
                  const isActive = selectedCategory === category.name;
                  return (
                    <Pressable
                      key={category.id || index}
                      onPress={() => {
                        setSelectedCategory(category.name);
                        if (category.slug === "all") router.push("/categories");
                        else router.push(`/category/${category.slug || category.name.toLowerCase().replace(/\s+/g, "-")}`);
                      }}
                      style={{ width: 76, alignItems: "center", gap: 6, transform: [{ scale: isActive ? 1.05 : 1 }] }}
                    >
                      <View style={[styles.catCircle, isActive && { borderColor: palette.black }]}>
                        <AppImage src={category.image} fallbackSrc={foodImages[index % foodImages.length]} style={StyleSheet.absoluteFill} width={200} />
                      </View>
                      <Txt weight={isActive ? 900 : 800} numberOfLines={1} style={{ fontSize: 11, color: palette.gray900, textAlign: "center", width: "100%" }}>
                        {category.name}
                      </Txt>
                    </Pressable>
                  );
                })}
          </ScrollView>
        </View>

        <HeroBanner images={heroBannerImages} bannersData={heroBannersData} loading={showBannerSkeleton} />

        {/* Filter chips */}
        <View style={styles.filterBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 10 }}>
            <Pressable onPress={() => setIsFilterOpen(true)} style={styles.chip}>
              <SlidersHorizontal size={16} color={palette.black} />
              <Txt weight={700} style={{ fontSize: 12, color: palette.black, letterSpacing: -0.2 }}>
                FILTERS
              </Txt>
            </Pressable>
            {chipFilters.map((f) => {
              const isActive = activeFilters.has(f.id);
              return (
                <Pressable
                  key={f.id}
                  onPress={() => {
                    const next = new Set(activeFilters);
                    if (next.has(f.id)) next.delete(f.id);
                    else next.add(f.id);
                    setActiveFilters(next);
                    applyFiltersAndRefetch(next, sortBy);
                  }}
                  style={[styles.chip, isActive && { backgroundColor: palette.yellow, borderColor: palette.yellow }]}
                >
                  {f.Icon ? <f.Icon size={14} color={palette.black} fill={isActive ? palette.black : "transparent"} /> : null}
                  <Txt weight={700} style={{ fontSize: 12, color: isActive ? palette.black : palette.gray700, letterSpacing: -0.2 }}>
                    {f.label}
                  </Txt>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Recommended for you */}
        {recommendedForYouRestaurants.length > 0 ? (
          <View style={{ paddingTop: 4 }}>
            <Txt weight={600} style={styles.sectionKicker}>
              RECOMMENDED FOR YOU
            </Txt>
            <View style={{ flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, justifyContent: "space-between", rowGap: 12 }}>
              {recommendedForYouRestaurants.map((restaurant) => {
                const slug = restaurant.slug || restaurant.name.toLowerCase().replace(/\s+/g, "-");
                return (
                  <Pressable key={`recommended-${restaurant.mongoId || restaurant.id || slug}`} onPress={() => router.push(`/restaurants/${slug}`)} style={styles.recCard}>
                    <View style={{ height: 96, backgroundColor: palette.gray50 }}>
                      <RestaurantImageCarousel restaurant={restaurant} height={96} radius={0} width={(width - 44) / 2} />
                      <View style={[styles.ratingPill, { backgroundColor: Number(restaurant.rating) > 0 ? "rgba(0,0,0,0.8)" : "rgba(229,231,235,0.9)" }]}>
                        <Txt weight={500} style={{ fontSize: 10, color: Number(restaurant.rating) > 0 ? palette.white : palette.gray600 }}>
                          {Number(restaurant.rating) > 0 ? Number(restaurant.rating).toFixed(1) : "NEW"}
                        </Txt>
                      </View>
                    </View>
                    <View style={{ padding: 10 }}>
                      <Txt weight={600} numberOfLines={1} style={{ fontSize: 14, color: palette.gray900, letterSpacing: -0.2 }}>
                        {restaurant.name}
                      </Txt>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                        <Flame size={14} color={palette.black} fill={palette.black} />
                        <Txt weight={700} style={{ fontSize: 10, color: palette.black, letterSpacing: 1 }}>
                          NEAR & FAST
                        </Txt>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {advertisements.length > 0 ? <AdsBannerCarousel advertisements={advertisements} /> : null}

        <ExploreMoreSection heading={exploreMoreHeading} items={finalExploreItems} showSkeleton={showExploreSkeleton} />

        <View style={{ paddingTop: 12 }}>
          {displayGourmetRestaurants.length > 0 ? (
            <View style={{ marginBottom: 24 }}>
              <View style={{ paddingHorizontal: 16, marginBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View>
                  <Txt weight={900} style={{ fontSize: 18, color: palette.gray900, letterSpacing: -0.4 }}>
                    Gourmet Restaurants
                  </Txt>
                  <Txt weight={500} style={{ fontSize: 12, color: palette.gray500 }}>
                    Premium spots just for you
                  </Txt>
                </View>
                <Pressable onPress={() => router.push("/gourmet")}>
                  <Txt weight={600} style={{ fontSize: 12, color: palette.black, textDecorationLine: "underline" }}>
                    See all
                  </Txt>
                </Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingHorizontal: 16, paddingBottom: 16 }} snapToInterval={256} decelerationRate="fast">
                {displayGourmetRestaurants.map((restaurant) => {
                  const slug = restaurant.slug || restaurant.name?.toLowerCase().replace(/\s+/g, "-");
                  return (
                    <Pressable key={restaurant.mongoId || restaurant.id || restaurant._id} onPress={() => router.push(`/restaurants/${slug}`)} style={styles.gourmetCard}>
                      <View style={{ height: 128, backgroundColor: palette.gray50 }}>
                        <RestaurantImageCarousel restaurant={restaurant} height={128} radius={0} width={240} />
                        <View style={styles.gourmetRating}>
                          <Star size={12} color={palette.yellow} fill={palette.yellow} />
                          <Txt weight={700} style={{ fontSize: 12, color: palette.white }}>
                            {Number(restaurant.rating || 0).toFixed(1)}
                          </Txt>
                        </View>
                      </View>
                      <View style={{ padding: 12 }}>
                        <Txt weight={700} numberOfLines={1} style={{ fontSize: 14, color: palette.gray900 }}>
                          {restaurant.name}
                        </Txt>
                        <Txt weight={400} numberOfLines={1} style={{ fontSize: 12, color: palette.gray500, marginTop: 2 }}>
                          {Array.isArray(restaurant.cuisines) && restaurant.cuisines.length ? restaurant.cuisines.join(", ") : "Various Cuisines"}
                        </Txt>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
            <Txt weight={600} style={[styles.sectionKicker, { paddingHorizontal: 0, marginBottom: 2 }]}>
              {filteredRestaurants.length} RESTAURANTS DELIVERING TO YOU
            </Txt>
            <Txt weight={700} style={{ fontSize: 16, color: palette.gray900, letterSpacing: -0.3 }}>
              All Restaurants
            </Txt>
          </View>

          {shouldShowOutOfRadiusHome ? (
            <View style={{ alignItems: "center", paddingVertical: 64, paddingHorizontal: 16, minHeight: 480 }}>
              <View style={{ marginBottom: 56, alignItems: "center", justifyContent: "center" }}>
                <Pizza size={48} color="rgba(251,146,60,0.4)" strokeWidth={1} style={{ position: "absolute", top: -40, left: -40 }} />
                <UtensilsCrossed size={40} color="rgba(251,113,133,0.4)" strokeWidth={1} style={{ position: "absolute", bottom: -24, right: -48 }} />
                <Flame size={32} color="rgba(251,191,36,0.3)" strokeWidth={1} style={{ position: "absolute", top: 16, right: -56 }} />
                <View style={styles.mascotBox}>
                  <Image source={localImages.chefMascot} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
                </View>
              </View>
              <Txt weight={900} style={{ fontSize: 30, color: palette.black, textAlign: "center", marginBottom: 16, letterSpacing: -0.5 }}>
                Service Unavailable
              </Txt>
              <Txt weight={500} style={{ fontSize: 16, color: palette.gray500, textAlign: "center", lineHeight: 26, maxWidth: 320 }}>
                {serviceUnavailableMessage || "Service is currently unavailable."} Please try another delivery location.
              </Txt>
            </View>
          ) : null}

          {showRestaurantSkeleton && filteredRestaurants.length === 0 ? (
            <View style={{ paddingHorizontal: 16, gap: 20 }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <View key={i} style={{ borderRadius: 28, backgroundColor: palette.white, overflow: "hidden", borderWidth: 1, borderColor: palette.orange50 }}>
                  <Skeleton height={192} radius={0} color="#f7f5f2" />
                  <View style={{ padding: 16, gap: 8 }}>
                    <Skeleton height={24} width={190} radius={6} color={palette.orange100} />
                    <Skeleton height={16} width={96} radius={4} color={palette.orange50} />
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );

  const renderFooter = () => (
    <View>
      <NearbyDishesSection zoneId={effectiveZoneId} />
      <EndOfFeedBadge />
      <View style={{ height: 64 }} />
    </View>
  );

  return (
    <Screen padTop={false} bg={palette.white}>
      {!introFinished ? <AppIntroSplash onComplete={() => setIntroFinished(true)} /> : null}
      <FlatList
        data={shouldShowOutOfRadiusHome ? [] : filteredRestaurants}
        keyExtractor={(r, i) => String(r?.id || r?._id || r?.mongoId || i)}
        renderItem={({ item, index }) => (
          <View style={{ paddingHorizontal: 16, marginBottom: 20, opacity: isLoadingFilterResults || loadingRestaurants ? 0.5 : 1 }}>
            <HomeRestaurantCard restaurant={item} index={index} isOutOfService={isOutOfService} isFavorite={isFavorite} onToggleFavorite={handleRestaurantFavoriteToggle} />
          </View>
        )}
        // Pass elements, not functions: a new function each render is a new component type → FlatList remounted the whole header on every render (render loop / hang).
        ListHeaderComponent={renderHeader()}
        ListFooterComponent={renderFooter()}
        showsVerticalScrollIndicator={false}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={7}
        removeClippedSubviews
      />

      <StickyCartCard bottom={12} />
      <VipSubscriptionModal />
      <OrderTrackingCard hasBottomNav bottom={16} />

      {/* Filters bottom sheet */}
      <BottomSheet visible={isFilterOpen} onClose={() => setIsFilterOpen(false)} maxHeightRatio={0.85} contentStyle={{ height: "85%" }}>
        <View style={styles.sheetHeader}>
          <Txt weight={700} style={{ fontSize: 18, color: palette.gray900 }}>
            Filters and sorting
          </Txt>
          <Pressable
            onPress={() => {
              setActiveFilters(new Set());
              setSortBy(null);
            }}
          >
            <Txt weight={700} style={{ fontSize: 14, color: palette.black }}>
              Clear all
            </Txt>
          </Pressable>
        </View>
        <View style={{ flex: 1, flexDirection: "row" }}>
          <View style={styles.filterSidebar}>
            {FILTER_TABS.map((tab) => {
              const isActive = activeFilterTab === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => {
                    setActiveFilterTab(tab.id);
                    const y = filterSectionY.current[tab.id];
                    if (y != null) filterScrollRef.current?.scrollTo({ y, animated: true });
                  }}
                  style={[styles.filterTab, isActive && { backgroundColor: palette.white }]}
                >
                  {isActive ? <View style={styles.filterTabIndicator} /> : null}
                  <tab.Icon size={20} color={isActive ? palette.black : palette.gray500} strokeWidth={1.5} />
                  <Txt weight={isActive ? 700 : 500} style={{ fontSize: 12, color: isActive ? palette.black : palette.gray500, textAlign: "center" }}>
                    {tab.label}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
          <ScrollView ref={filterScrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
            <View onLayout={(e) => (filterSectionY.current.sort = e.nativeEvent.layout.y)} style={{ marginBottom: 32 }}>
              <Txt weight={600} style={styles.filterTitle}>Sort by</Txt>
              <View style={{ gap: 12 }}>
                {SORT_OPTIONS.map((o) => (
                  <Pressable key={o.id || "relevance"} onPress={() => setSortBy(o.id)} style={[styles.optionRow, sortBy === o.id && styles.optionActive]}>
                    <Txt weight={sortBy === o.id ? 700 : 500} style={{ fontSize: 14, color: sortBy === o.id ? palette.black : palette.gray700 }}>{o.label}</Txt>
                  </Pressable>
                ))}
              </View>
            </View>
            <View onLayout={(e) => (filterSectionY.current.time = e.nativeEvent.layout.y)} style={{ marginBottom: 32 }}>
              <Txt weight={600} style={styles.filterTitle}>Estimated Time</Txt>
              <View style={styles.grid2}>
                {[["delivery-under-30", "Under 30 mins"], ["delivery-under-45", "Under 45 mins"]].map(([id, label]) => (
                  <Pressable key={id} onPress={() => toggleFilter(id)} style={[styles.optionTile, activeFilters.has(id) && styles.optionActive]}>
                    <Timer size={24} color={activeFilters.has(id) ? palette.black : palette.gray600} strokeWidth={1.5} />
                    <Txt weight={activeFilters.has(id) ? 700 : 500} style={{ fontSize: 14, color: activeFilters.has(id) ? palette.black : palette.gray700 }}>{label}</Txt>
                  </Pressable>
                ))}
              </View>
            </View>
            <View onLayout={(e) => (filterSectionY.current.rating = e.nativeEvent.layout.y)} style={{ marginBottom: 32 }}>
              <Txt weight={600} style={styles.filterTitle}>Restaurant Rating</Txt>
              <View style={styles.grid2}>
                {[["rating-35-plus", "Rated 3.5+"], ["rating-4-plus", "Rated 4.0+"], ["rating-45-plus", "Rated 4.5+"]].map(([id, label]) => (
                  <Pressable key={id} onPress={() => toggleFilter(id)} style={[styles.optionTile, activeFilters.has(id) && styles.optionActive]}>
                    <Star size={24} color={activeFilters.has(id) ? palette.black : palette.gray400} fill={activeFilters.has(id) ? palette.black : "transparent"} />
                    <Txt weight={activeFilters.has(id) ? 700 : 500} style={{ fontSize: 14, color: activeFilters.has(id) ? palette.black : palette.gray700 }}>{label}</Txt>
                  </Pressable>
                ))}
              </View>
            </View>
            <View onLayout={(e) => (filterSectionY.current.distance = e.nativeEvent.layout.y)} style={{ marginBottom: 32 }}>
              <Txt weight={600} style={styles.filterTitle}>Distance</Txt>
              <View style={styles.grid2}>
                {[["distance-under-1km", "Under 1 km"], ["distance-under-2km", "Under 2 km"]].map(([id, label]) => (
                  <Pressable key={id} onPress={() => toggleFilter(id)} style={[styles.optionTile, activeFilters.has(id) && styles.optionActive]}>
                    <MapPin size={24} color={activeFilters.has(id) ? palette.black : palette.gray600} strokeWidth={1.5} />
                    <Txt weight={activeFilters.has(id) ? 700 : 500} style={{ fontSize: 14, color: activeFilters.has(id) ? palette.black : palette.gray700 }}>{label}</Txt>
                  </Pressable>
                ))}
              </View>
            </View>
            <View onLayout={(e) => (filterSectionY.current.price = e.nativeEvent.layout.y)} style={{ marginBottom: 32 }}>
              <Txt weight={600} style={styles.filterTitle}>Dish Price</Txt>
              <View style={{ gap: 12 }}>
                {[["price-under-200", "Under ₹200"], ["price-under-500", "Under ₹500"]].map(([id, label]) => (
                  <Pressable key={id} onPress={() => toggleFilter(id)} style={[styles.optionRow, activeFilters.has(id) && styles.optionActive]}>
                    <Txt weight={activeFilters.has(id) ? 700 : 500} style={{ fontSize: 14, color: activeFilters.has(id) ? palette.black : palette.gray700 }}>{label}</Txt>
                  </Pressable>
                ))}
              </View>
            </View>
            <View onLayout={(e) => (filterSectionY.current.trust = e.nativeEvent.layout.y)} style={{ marginBottom: 32 }}>
              <Txt weight={600} style={styles.filterTitle}>Trust Markers</Txt>
              <View style={{ gap: 12 }}>
                {[["top-rated", "Top Rated"], ["trusted", "Trusted by 1000+ users"]].map(([id, label]) => (
                  <Pressable key={id} onPress={() => toggleFilter(id)} style={[styles.optionRow, activeFilters.has(id) && styles.optionActive]}>
                    <Txt weight={activeFilters.has(id) ? 700 : 500} style={{ fontSize: 14, color: activeFilters.has(id) ? palette.black : palette.gray700 }}>{label}</Txt>
                  </Pressable>
                ))}
              </View>
            </View>
            <View onLayout={(e) => (filterSectionY.current.offers = e.nativeEvent.layout.y)} style={{ marginBottom: 32 }}>
              <Txt weight={600} style={styles.filterTitle}>Offers</Txt>
              <Pressable onPress={() => toggleFilter("has-offers")} style={[styles.optionRow, activeFilters.has("has-offers") && styles.optionActive]}>
                <Txt weight={activeFilters.has("has-offers") ? 700 : 500} style={{ fontSize: 14, color: activeFilters.has("has-offers") ? palette.black : palette.gray700 }}>Restaurants with offers</Txt>
              </Pressable>
            </View>
          </ScrollView>
        </View>
        <View style={styles.sheetFooter}>
          <Pressable onPress={() => setIsFilterOpen(false)} style={{ flex: 1, paddingVertical: 12, alignItems: "center" }}>
            <Txt weight={600} style={{ fontSize: 15, color: palette.gray700 }}>Close</Txt>
          </Pressable>
          <Pressable
            disabled={isLoadingFilterResults}
            onPress={async () => {
              setIsFilterOpen(false);
              await applyFiltersAndRefetch(activeFilters, sortBy);
            }}
            style={{ flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center", backgroundColor: hasAnyFilter ? palette.yellow : palette.gray200 }}
          >
            <Txt weight={600} style={{ fontSize: 15, color: hasAnyFilter ? palette.black : palette.gray500 }}>{isLoadingFilterResults ? "Loading..." : "Show results"}</Txt>
          </Pressable>
        </View>
      </BottomSheet>

      {/* Veg mode popup */}
      <BottomSheet
        visible={showVegModePopup}
        position="center"
        onClose={() => {
          setShowVegModePopup(false);
          setVegModeContext(false);
          setPrevVegMode(false);
        }}
        contentStyle={{ maxWidth: 320, borderRadius: 16, padding: 24 }}
      >
        <Txt weight={700} style={{ fontSize: 16, color: palette.gray900, marginBottom: 12 }}>See veg dishes from</Txt>
        <View style={{ gap: 8, marginBottom: 16 }}>
          {[["all", "All restaurants"], ["pure-veg", "Pure Veg restaurants only"]].map(([id, label]) => (
            <Pressable key={id} onPress={() => setVegModeOption(id)} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 6, borderRadius: 8 }}>
              <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: vegModeOption === id ? palette.green600 : palette.gray300, backgroundColor: vegModeOption === id ? palette.green600 : palette.white, alignItems: "center", justifyContent: "center" }}>
                {vegModeOption === id ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: palette.white }} /> : null}
              </View>
              <Txt weight={500} style={{ fontSize: 14, color: palette.gray900 }}>{label}</Txt>
            </Pressable>
          ))}
        </View>
        <Button
          title="Apply"
          rounded="xl"
          weight={600}
          size="md"
          onPress={() => {
            setShowVegModePopup(false);
            setIsApplyingVegMode(true);
            setVegModeContext(true);
            setPrevVegMode(true);
            setTimeout(() => setIsApplyingVegMode(false), 2000);
          }}
        />
      </BottomSheet>

      {/* Switch off veg mode popup */}
      <BottomSheet
        visible={showSwitchOffPopup}
        position="center"
        onClose={() => {
          setShowSwitchOffPopup(false);
          isHandlingSwitchOff.current = false;
          setVegModeContext(true);
        }}
        contentStyle={{ maxWidth: 340, borderRadius: 16, padding: 24 }}
      >
        <View style={{ alignItems: "center", marginBottom: 16 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: "#fce7f3", alignItems: "center", justifyContent: "center" }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(239,68,68,0.9)", alignItems: "center", justifyContent: "center" }}>
              <AlertCircle size={64} color={palette.white} strokeWidth={2.5} />
            </View>
          </View>
        </View>
        <Txt weight={700} style={{ fontSize: 24, color: palette.gray900, textAlign: "center", marginBottom: 8 }}>Switch off Veg Mode?</Txt>
        <Txt weight={400} style={{ fontSize: 14, color: palette.gray600, textAlign: "center", marginBottom: 24 }}>You'll see all restaurants, including those serving non-veg dishes</Txt>
        <View style={{ gap: 12 }}>
          <Pressable
            onPress={() => {
              setShowSwitchOffPopup(false);
              setIsSwitchingOffVegMode(true);
              setTimeout(() => {
                setIsSwitchingOffVegMode(false);
                isHandlingSwitchOff.current = false;
                setVegModeContext(false);
                setPrevVegMode(false);
              }, 2000);
            }}
            style={{ paddingVertical: 6, alignItems: "center" }}
          >
            <Txt weight={400} style={{ fontSize: 16, color: palette.red600 }}>Switch off</Txt>
          </Pressable>
          <Pressable
            onPress={() => {
              setShowSwitchOffPopup(false);
              isHandlingSwitchOff.current = false;
              setVegModeContext(true);
            }}
            style={{ paddingVertical: 6, alignItems: "center" }}
          >
            <Txt weight={400} style={{ fontSize: 16, color: palette.gray900 }}>Keep using this mode</Txt>
          </Pressable>
        </View>
      </BottomSheet>

      {/* Applying veg mode overlay */}
      {isApplyingVegMode ? (
        <View style={styles.fullOverlay}>
          <View style={styles.vegBadge}>
            <Txt weight={800} style={{ fontSize: 30, color: palette.green600, lineHeight: 32 }}>100%</Txt>
            <Txt weight={800} style={{ fontSize: 30, color: palette.green600, lineHeight: 32, marginTop: 2 }}>VEG</Txt>
          </View>
          <Txt weight={400} style={{ fontSize: 20, color: palette.gray800, textAlign: "center", marginTop: 40 }}>Explore veg dishes from all restaurants</Txt>
        </View>
      ) : null}
      {isSwitchingOffVegMode ? (
        <View style={styles.fullOverlay}>
          <View style={styles.spinnerRing} />
          <Txt weight={400} style={{ fontSize: 20, color: palette.gray800, textAlign: "center", marginTop: 24 }}>Switching off</Txt>
          <Txt weight={400} style={{ fontSize: 20, color: palette.gray800, textAlign: "center" }}>Veg Mode for you</Txt>
        </View>
      ) : null}

      {/* Manage collections */}
      <BottomSheet visible={showManageCollections} onClose={() => setShowManageCollections(false)}>
        <View style={[styles.sheetHeader, { paddingTop: 24 }]}>
          <Txt weight={700} style={{ fontSize: 18, color: palette.gray900 }}>Manage Collections</Txt>
          <Pressable onPress={() => setShowManageCollections(false)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: palette.gray700, alignItems: "center", justifyContent: "center" }}>
            <X size={16} color={palette.white} />
          </Pressable>
        </View>
        <View style={{ paddingHorizontal: 16, paddingVertical: 16, gap: 8 }}>
          <View style={{ flexDirection: "row", gap: 12, padding: 12 }}>
            <View style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: "#fce7f3", alignItems: "center", justifyContent: "center" }}>
              <Bookmark size={24} color={palette.red500} fill={palette.red500} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Txt weight={500} style={{ fontSize: 16, color: palette.gray900 }}>Bookmarks</Txt>
                <Pressable
                  onPress={() => {
                    if (selectedRestaurantSlug) {
                      removeFavorite(selectedRestaurantSlug);
                      setSelectedRestaurantSlug(null);
                      setShowManageCollections(false);
                    }
                  }}
                  style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: palette.red500, backgroundColor: palette.red500, alignItems: "center", justifyContent: "center" }}
                >
                  <Check size={12} color={palette.white} />
                </Pressable>
              </View>
              <Txt weight={400} style={{ fontSize: 14, color: palette.gray500, marginTop: 4 }}>
                {getFavorites().length} restaurant{getFavorites().length !== 1 ? "s" : ""}
              </Txt>
            </View>
          </View>
          <Pressable onPress={() => setShowManageCollections(false)} style={{ flexDirection: "row", gap: 12, padding: 12 }}>
            <View style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: "#fce7f3", alignItems: "center", justifyContent: "center" }}>
              <Plus size={24} color={palette.red500} />
            </View>
            <Txt weight={500} style={{ fontSize: 16, color: palette.gray900, alignSelf: "center" }}>Create new Collection</Txt>
          </Pressable>
        </View>
        <View style={{ borderTopWidth: 1, borderTopColor: palette.gray200, padding: 16 }}>
          <Button
            title="Done"
            variant="secondary"
            rounded="lg"
            weight={500}
            onPress={() => {
              setSelectedRestaurantSlug(null);
              setShowManageCollections(false);
            }}
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerBg: { position: "absolute", top: 0, left: 0, right: 0, height: 300, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: "hidden" },
  catCircle: { width: 68, height: 68, borderRadius: 34, overflow: "hidden", borderWidth: 2, borderColor: palette.gray100, backgroundColor: palette.white, elevation: 2 },
  filterBar: { backgroundColor: "rgba(255,255,255,0.95)", borderBottomWidth: 1, borderBottomColor: palette.gray100 },
  chip: { height: 36, paddingHorizontal: 16, borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: palette.white, borderWidth: 1, borderColor: palette.gray200, elevation: 1 },
  sectionKicker: { fontSize: 12, color: palette.gray400, letterSpacing: 2, marginBottom: 8, paddingHorizontal: 16 },
  recCard: { width: "48%", borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: palette.gray100, backgroundColor: palette.white, elevation: 1 },
  ratingPill: { position: "absolute", bottom: 8, left: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  gourmetCard: { width: 240, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: palette.gray100, backgroundColor: palette.white, elevation: 1 },
  gourmetRating: { position: "absolute", top: 8, left: 8, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: "rgba(0,0,0,0.8)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  mascotBox: { width: 176, height: 176, borderRadius: 48, backgroundColor: "rgba(255,255,255,0.8)", borderWidth: 1, borderColor: "rgba(255,255,255,0.5)", padding: 8, elevation: 8, shadowColor: "#7e3866", shadowOpacity: 0.3, shadowRadius: 50, shadowOffset: { width: 0, height: 20 } },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: palette.gray200 },
  sheetFooter: { flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 16, paddingVertical: 16, borderTopWidth: 1, borderTopColor: palette.gray200, backgroundColor: palette.white },
  filterSidebar: { width: 96, backgroundColor: palette.gray50, borderRightWidth: 1, borderRightColor: palette.gray200 },
  filterTab: { alignItems: "center", gap: 4, paddingVertical: 16, paddingHorizontal: 8 },
  filterTabIndicator: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4, backgroundColor: palette.black, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  filterTitle: { fontSize: 18, color: palette.gray900, marginBottom: 16 },
  optionRow: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: palette.gray200 },
  optionTile: { width: "48%", alignItems: "center", gap: 8, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: palette.gray200 },
  optionActive: { borderColor: palette.yellow, backgroundColor: "#F9F9FB" },
  grid2: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 12 },
  fullOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 10000, backgroundColor: palette.white, alignItems: "center", justifyContent: "center" },
  vegBadge: { width: 112, height: 112, borderRadius: 56, borderWidth: 2, borderColor: palette.green600, backgroundColor: palette.white, alignItems: "center", justifyContent: "center" },
  spinnerRing: { width: 64, height: 64, borderRadius: 32, borderWidth: 4, borderColor: "transparent", borderTopColor: palette.pink500, borderRightColor: palette.pink500 },
});
