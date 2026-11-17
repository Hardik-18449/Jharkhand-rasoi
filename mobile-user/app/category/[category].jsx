/** Category listing — port of pages/user/CategoryPage.jsx (matched dishes + all restaurants + filter/sort sheet). */
import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Star, Clock, Search, SlidersHorizontal, Bookmark, BadgePercent, MapPin, ArrowDownUp, Timer, IndianRupee, UtensilsCrossed, ShieldCheck } from "lucide-react-native";
import Txt from "../../src/components/ui/Txt";
import Screen from "../../src/components/ui/Screen";
import Skeleton from "../../src/components/ui/Skeleton";
import AppImage from "../../src/components/ui/AppImage";
import BottomSheet from "../../src/components/ui/BottomSheet";
import RestaurantImageCarousel, { RestaurantCarouselStateProvider, RestaurantOfferBanner } from "../../src/components/home/RestaurantImageCarousel";
import { restaurantAPI, getPublicCategories, getPublicFoods } from "../../src/api";
import { useProfile } from "../../src/context/ProfileContext";
import { useAppLocation } from "../../src/context/LocationProvider";
import { getMenuFromResponse } from "../../src/utils/menuItems";
import { extractImages, normalizeImageUrl, slugify } from "../../src/utils/common";
import { getRestaurantAvailabilityStatus } from "../../src/utils/restaurantAvailability";
import { foodImages } from "../../src/constants/images";
import { localStore } from "../../src/utils/storage";
import { palette, fonts } from "../../src/theme";

const STORAGE_KEY = "food-category-page-filters-v1";
const STOP = ["of", "the", "and", "in", "with", "a", "an", "to", "for"];
const norm = (v) => String(v || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
const matchesCategoryText = (value, keywords) => {
  const nv = norm(value);
  if (!nv) return false;
  return keywords.some((k) => {
    const nk = norm(k);
    if (!nk) return false;
    if (nv === nk || slugify(nv) === slugify(nk)) return true;
    if (nk.length <= 2 || STOP.includes(nk)) return false;
    try {
      return new RegExp(`\\b${nk}\\b`, "i").test(nv);
    } catch {
      return nv.includes(` ${nk} `) || nv.startsWith(`${nk} `) || nv.endsWith(` ${nk}`);
    }
  });
};
const toArray = (v) => (Array.isArray(v) ? v : !v || typeof v !== "object" ? [] : Object.values(v).filter((e) => e && typeof e === "object"));
const normalizeMenu = (menu) => ({
  ...menu,
  sections: toArray(menu?.sections).map((s, si) => ({
    ...s,
    id: String(s?.id || s?._id || `section-${si}`),
    name: s?.name || s?.title || "Unnamed Section",
    items: toArray(s?.items).map((it, ii) => ({ ...it, id: String(it?.id || it?._id || `${si}-${ii}`) })),
    subsections: toArray(s?.subsections).map((ss, ssi) => ({ ...ss, id: String(ss?.id || ss?._id || `subsection-${si}-${ssi}`), name: ss?.name || "Unnamed Subsection", items: toArray(ss?.items).map((it, ii) => ({ ...it, id: String(it?.id || it?._id || `${si}-${ssi}-${ii}`) })) })),
  })),
});
const parseNum = (v) => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const m = String(v || "").match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
};
const cmpTime = (r) => parseNum(r?.deliveryTime);
const cmpDist = (r) => {
  const raw = String(r?.distance || "").trim().toLowerCase();
  const p = parseNum(raw);
  if (!raw || p == null) return null;
  return raw.includes("m") && !raw.includes("km") ? p / 1000 : p;
};
const cmpPrice = (r) => {
  const raw = r?.categoryDishPrice ?? r?.featuredPrice ?? null;
  const p = typeof raw === "number" ? raw : parseNum(raw);
  return Number.isFinite(p) ? p : null;
};
const cmpRating = (r) => {
  const p = typeof r?.rating === "number" ? r.rating : parseNum(r?.rating);
  return Number.isFinite(p) ? p : null;
};
const DEFAULTS = { offer: ["Flat ₹50 OFF above ₹199", "Flat 50% OFF", "Flat ₹40 OFF above ₹149"], deliveryTime: ["25-30 mins", "20-25 mins", "30-35 mins"], distance: ["1.2 km", "1 km", "0.8 km"] };
const isDefault = (v, f) => (f === "featuredPrice" ? v === 249 : !!v && (DEFAULTS[f] || []).includes(v));
const dishPrice = (it) => {
  const op = it?.originalPrice || it?.price || 0;
  const dp = it?.discountPercent || 0;
  return dp > 0 ? Math.round(op * (1 - dp / 100)) : op;
};

const FILTER_TABS = [
  { id: "sort", label: "Sort By", Icon: ArrowDownUp },
  { id: "time", label: "Time", Icon: Timer },
  { id: "rating", label: "Rating", Icon: Star },
  { id: "distance", label: "Distance", Icon: MapPin },
  { id: "price", label: "Dish Price", Icon: IndianRupee },
  { id: "offers", label: "Offers", Icon: BadgePercent },
  { id: "trust", label: "Trust", Icon: ShieldCheck },
];

export default function CategoryScreen() {
  const { category: routeCategory } = useLocalSearchParams();
  const category = String(routeCategory || "all");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { vegMode, vegModeOption } = useProfile();
  const { zoneId, isOutOfService } = useAppLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);
  const [selectedCategory, setSelectedCategory] = useState(category.toLowerCase());
  const [activeFilters, setActiveFilters] = useState(new Set());
  const [favorites, setFavorites] = useState(new Set());
  const [sortBy, setSortBy] = useState(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("sort");
  const [isLoadingFilterResults, setIsLoadingFilterResults] = useState(false);
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [restaurantsData, setRestaurantsData] = useState([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(true);
  const [isEnrichingMenus, setIsEnrichingMenus] = useState(false);
  const [approvedFoodsData, setApprovedFoodsData] = useState([]);
  const [categoryKeywords, setCategoryKeywords] = useState({});
  const [visibleCount, setVisibleCount] = useState(20);
  const enrichReqRef = useRef(0);
  const foodsCacheRef = useRef(null);
  const foodsInFlightRef = useRef(null);
  const restoredRef = useRef(false);
  const sectionY = useRef({});
  const filterScrollRef = useRef(null);
  const railRef = useRef(null);
  const chipX = useRef({});

  const fetchApprovedFoods = async () => {
    if (Array.isArray(foodsCacheRef.current)) return foodsCacheRef.current;
    if (foodsInFlightRef.current) return foodsInFlightRef.current;
    foodsInFlightRef.current = (async () => {
      try {
        const data = await getPublicFoods(zoneId ? { limit: 50, zoneId } : { limit: 50 });
        const list = data?.foods || [];
        const ok = Array.isArray(list) ? list.filter((f) => String(f?.approvalStatus || "").toLowerCase() === "approved" && f?.isAvailable !== false) : [];
        foodsCacheRef.current = ok;
        return ok;
      } catch {
        foodsCacheRef.current = [];
        return [];
      } finally {
        foodsInFlightRef.current = null;
      }
    })();
    return foodsInFlightRef.current;
  };
  useEffect(() => {
    foodsCacheRef.current = null;
    foodsInFlightRef.current = null;
    let c = false;
    fetchApprovedFoods().then((f) => !c && setApprovedFoodsData(Array.isArray(f) ? f : []));
    return () => {
      c = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneId]);

  const getCategoryKeywords = (id) => {
    if (id === "all") return ["all"];
    const raw = String(id || "").trim().toLowerCase();
    const fromAdmin = categoryKeywords[raw];
    let kw;
    if (Array.isArray(fromAdmin) && fromAdmin.length) kw = [...fromAdmin];
    else {
      const parts = raw.split(/[\s-]+/).filter(Boolean);
      kw = parts.length ? Array.from(new Set([raw, ...parts])) : [];
    }
    if (kw.includes("samosha") || kw.includes("samosa")) {
      if (!kw.includes("samosa")) kw.push("samosa");
      if (!kw.includes("samosha")) kw.push("samosha");
    }
    return kw;
  };
  const checkCategoryInMenu = (menu, id) => {
    if (!menu?.sections || !Array.isArray(menu.sections)) return false;
    if (id === "all") return true;
    const kw = getCategoryKeywords(id);
    if (!kw.length) return false;
    for (const s of menu.sections) {
      if (matchesCategoryText(s.name, kw)) return true;
      for (const it of s.items || []) if (matchesCategoryText(it.name, kw) || matchesCategoryText(it.categoryName || it.category, kw)) return true;
      for (const ss of s.subsections || []) {
        if (matchesCategoryText(ss?.name, kw)) return true;
        for (const it of ss?.items || []) if (matchesCategoryText(it?.name, kw) || matchesCategoryText(it?.categoryName || it?.category, kw)) return true;
      }
    }
    return false;
  };
  const getAllCategoryDishesFromMenu = (menu, id) => {
    if (!menu?.sections || !Array.isArray(menu.sections)) return [];
    const isAll = id === "all";
    const kw = isAll ? [] : getCategoryKeywords(id);
    if (!isAll && !kw.length) return [];
    const out = [];
    const push = (it, ...imgSources) =>
      out.push({ name: it?.name, price: dishPrice(it), image: normalizeImageUrl(it?.image?.url || it?.image || imgSources.find(Boolean) || ""), originalPrice: it?.originalPrice || it?.price || 0, itemId: it?._id || it?.id || `${it?.name}-${dishPrice(it)}`, foodType: it?.foodType });
    for (const s of menu.sections) {
      const sm = isAll || matchesCategoryText(s?.name, kw);
      for (const it of s.items || []) if (sm || isAll || matchesCategoryText(it.name, kw) || matchesCategoryText(it.categoryName || it.category, kw)) push(it, s.image?.url, s.image);
      for (const ss of s.subsections || []) {
        const ssm = isAll || matchesCategoryText(ss?.name, kw);
        for (const it of ss?.items || []) if (sm || ssm || matchesCategoryText(it?.name, kw) || matchesCategoryText(it?.categoryName || it?.category, kw)) push(it, ss?.image?.url, ss?.image, s?.image?.url, s?.image);
      }
    }
    return out;
  };
  const buildFallbackMenuFromFoods = (foods, r) => {
    const ids = new Set([r?.restaurantId, r?.id, r?.mongoId].filter(Boolean).map((v) => String(v).trim()));
    const name = String(r?.name || "").trim().toLowerCase();
    const match = foods.filter((f) => (String(f?.restaurantId || "").trim() && ids.has(String(f.restaurantId).trim())) || (name && String(f?.restaurantName || "").trim().toLowerCase() === name));
    if (!match.length) return null;
    const map = new Map();
    match.forEach((f, i) => {
      const sn = String(f?.categoryName || f?.category || "Varieties").trim() || "Varieties";
      const key = slugify(sn);
      if (!map.has(key)) map.set(key, { id: key || `section-${i}`, name: sn, items: [], subsections: [] });
      map.get(key).items.push({ id: String(f?.id || f?._id || `${key}-${i}`), _id: f?._id, name: f?.name || "Unnamed Item", description: f?.description || "", price: Number(f?.price || 0), originalPrice: Number(f?.originalPrice || f?.price || 0), image: normalizeImageUrl(f?.image), foodType: f?.foodType || "Non-Veg", isAvailable: f?.isAvailable !== false, categoryName: f?.categoryName || sn, category: f?.categoryName || sn, preparationTime: f?.preparationTime || "", approvalStatus: f?.approvalStatus || "approved" });
    });
    return { sections: Array.from(map.values()) };
  };
  const getFallbackDishes = (id, restaurants) => {
    const kw = getCategoryKeywords(id);
    if (!kw.length || !approvedFoodsData.length) return [];
    const byId = new Map();
    const byName = new Map();
    (restaurants || []).forEach((r) => {
      [r?.restaurantId, r?.id, r?.mongoId].filter(Boolean).forEach((v) => !byId.has(String(v).trim()) && byId.set(String(v).trim(), r));
      const n = String(r?.name || "").trim().toLowerCase();
      if (n && !byName.has(n)) byName.set(n, r);
    });
    return approvedFoodsData
      .filter((f) => f?.isAvailable !== false && String(f?.approvalStatus || "").toLowerCase() === "approved" && (matchesCategoryText(f?.categoryName || f?.category, kw) || matchesCategoryText(f?.name, kw)))
      .map((f, i) => {
        const rid = String(f?.restaurantId || "").trim();
        const rname = String(f?.restaurantName || "").trim();
        const m = byId.get(rid) || byName.get(rname.toLowerCase()) || null;
        const fbName = rname || "Restaurant";
        const img = normalizeImageUrl(f?.image);
        return {
          ...(m || {}),
          id: `${rid || slugify(fbName) || "restaurant"}-${String(f?.id || f?._id || i)}`,
          restaurantId: rid || m?.restaurantId || m?.id || null,
          mongoId: m?.mongoId || m?.id || null,
          slug: m?.slug || slugify(fbName),
          name: m?.name || fbName,
          image: m?.image || img,
          images: m?.images?.length ? m.images : img ? [img] : [],
          rating: m?.rating || null,
          deliveryTime: m?.deliveryTime || null,
          distance: m?.distance || null,
          offer: m?.offer || null,
          featuredDish: m?.featuredDish || f?.name || null,
          featuredPrice: m?.featuredPrice || Number(f?.price || 0),
          menu: m?.menu || null,
          dishId: String(f?.id || f?._id || `${rid}-${i}`),
          categoryDish: f,
          categoryDishName: f?.name || "Unnamed Item",
          categoryDishPrice: Number(f?.price || 0),
          categoryDishImage: img,
          categoryDishFoodType: f?.foodType || "Non-Veg",
        };
      });
  };

  const applyFiltersAndSorting = (rows) => {
    let n = Array.isArray(rows) ? [...rows] : [];
    const has = (k) => activeFilters.has(k);
    const keep = (fn) => (n = n.filter(fn));
    if (has("under-30-mins")) keep((r) => cmpTime(r) != null && cmpTime(r) <= 30);
    if (has("delivery-under-45")) keep((r) => cmpTime(r) != null && cmpTime(r) <= 45);
    if (has("rating-35-plus")) keep((r) => cmpRating(r) != null && cmpRating(r) >= 3.5);
    if (has("rating-4-plus")) keep((r) => cmpRating(r) != null && cmpRating(r) >= 4);
    if (has("rating-45-plus")) keep((r) => cmpRating(r) != null && cmpRating(r) >= 4.5);
    if (has("distance-under-1km")) keep((r) => cmpDist(r) != null && cmpDist(r) <= 1);
    if (has("distance-under-2km")) keep((r) => cmpDist(r) != null && cmpDist(r) <= 2);
    if (has("price-under-200")) keep((r) => cmpPrice(r) != null && cmpPrice(r) <= 200);
    if (has("under-250")) keep((r) => cmpPrice(r) != null && cmpPrice(r) <= 250);
    if (has("price-under-500")) keep((r) => cmpPrice(r) != null && cmpPrice(r) <= 500);
    if (has("flat-50-off")) keep((r) => /50\s*%/i.test(String(r?.offer || "")));
    if (has("price-match")) keep((r) => [r?.offer, r?.priceRange, r?.categoryDish?.description].some((v) => /price\s*match/i.test(String(v || ""))));
    if (deferredSearch.trim()) {
      const q = deferredSearch.toLowerCase();
      keep((r) => r.name?.toLowerCase().includes(q) || r.cuisine?.toLowerCase().includes(q) || r.featuredDish?.toLowerCase().includes(q) || r.categoryDishName?.toLowerCase().includes(q));
    }
    if (vegMode && vegModeOption === "pure-veg") keep((r) => r.pureVegRestaurant === true);
    if (sortBy) {
      n.sort((a, b) => {
        const [fa, fb] = sortBy.startsWith("price") ? [cmpPrice(a), cmpPrice(b)] : [cmpRating(a), cmpRating(b)];
        if (fa == null && fb == null) return 0;
        if (fa == null) return 1;
        if (fb == null) return -1;
        return sortBy === "price-low" || sortBy === "rating-low" ? fa - fb : fb - fa;
      });
    }
    const seen = new Set();
    return n.filter((r) => {
      const key = r.dishId ? `dish-${r.dishId}` : r.restaurantId || r.id || `raw-${slugify(r.name)}`;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  // categories
  useEffect(() => {
    let c = false;
    (async () => {
      try {
        setLoadingCategories(true);
        const data = await getPublicCategories(zoneId || null);
        if (c) return;
        const arr = data?.categories || [];
        if (Array.isArray(arr) && arr.length) {
          setCategories([{ id: "all", name: "All", image: null, slug: "all" }, ...arr.map((x) => ({ id: x.slug || x.id, name: x.name, image: x.image ? normalizeImageUrl(x.image) : foodImages[0], slug: x.slug || x.name.toLowerCase().replace(/\s+/g, "-"), type: x.type }))]);
          const map = {};
          arr.forEach((x) => {
            const n = x.name.toLowerCase();
            map[x.slug || x.id] = [n, ...n.split(/[\s-]+/).filter((w) => w.length > 2 && !STOP.includes(w))];
          });
          setCategoryKeywords(map);
        } else setCategories([{ id: "all", name: "All", image: null, slug: "all" }]);
      } catch {
        if (!c) setCategories([{ id: "all", name: "All", image: null, slug: "all" }]);
      } finally {
        if (!c) setLoadingCategories(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [zoneId]);

  // restaurants + menu enrichment (batches of 4, same as web)
  useEffect(() => {
    (async () => {
      try {
        setLoadingRestaurants(true);
        const r = await restaurantAPI.getRestaurants(zoneId ? { zoneId } : {});
        const arr = r?.data?.success ? r.data.data?.restaurants : null;
        if (!arr) {
          setRestaurantsData([]);
          return;
        }
        const base = arr
          .filter((x) => String(x.restaurantName || x.name || "").trim().length > 0)
          .map((x) => {
            const menuImages = extractImages((Array.isArray(x.menuImages) ? x.menuImages : [x.menuImages]).filter(Boolean));
            const all = Array.from(new Set(menuImages)).reverse();
            const id = x.restaurantId || x._id;
            return {
              id,
              name: x.restaurantName || x.name,
              cuisine: x.cuisines?.length ? x.cuisines.join(", ") : null,
              cuisines: x.cuisines || [],
              rating: x.rating || null,
              deliveryTime: isDefault(x.estimatedDeliveryTime, "deliveryTime") ? null : x.estimatedDeliveryTime || null,
              distance: isDefault(x.distance, "distance") ? null : x.distance || null,
              image: all[0] || foodImages[0],
              images: all.length ? all : [foodImages[0]],
              recommendedItems: Array.isArray(x.recommendedItems) ? x.recommendedItems : [],
              itemDiscounts: Array.isArray(x.itemDiscounts) ? x.itemDiscounts : [],
              discountRules: Array.isArray(x.discountRules) ? x.discountRules : [],
              discount: Number(x.discount) || 0,
              priceRange: x.priceRange || null,
              featuredDish: x.featuredDish || null,
              featuredPrice: x.featuredPrice && !isDefault(x.featuredPrice, "featuredPrice") ? x.featuredPrice : null,
              offer: isDefault(x.offer, "offer") ? null : x.offer || null,
              slug: x.slug || (x.restaurantName || x.name)?.toLowerCase().replace(/\s+/g, "-"),
              restaurantId: id,
              mongoId: x._id,
              pureVegRestaurant: x.pureVegRestaurant || false,
              isActive: x.isActive,
              isAcceptingOrders: x.isAcceptingOrders,
              openingTime: x.openingTime,
              closingTime: x.closingTime,
              openDays: x.openDays,
              deliveryTimings: x.deliveryTimings,
              outletTimings: x.outletTimings,
              onboarding: x.onboarding,
            };
          });
        setRestaurantsData(base);
        setIsEnrichingMenus(true);
        const reqId = ++enrichReqRef.current;
        const out = [];
        try {
          for (let i = 0; i < base.length; i += 4) {
            const batch = await Promise.all(
              base.slice(i, i + 4).map(async (rest) => {
                try {
                  let menu = null;
                  for (const lid of [rest.restaurantId, rest.id, rest.mongoId, rest.slug].filter(Boolean).map(String).filter((v, k, a) => a.indexOf(v) === k)) {
                    try {
                      const mr = await restaurantAPI.getMenuByRestaurantId(lid);
                      const nm = normalizeMenu(getMenuFromResponse(mr));
                      if (mr?.data?.success && nm?.sections?.length) {
                        menu = nm;
                        break;
                      }
                    } catch (e) {
                      if (e?.response?.status !== 404) throw e;
                    }
                  }
                  if (!menu?.sections?.length) menu = buildFallbackMenuFromFoods(await fetchApprovedFoods(), rest);
                  if (menu?.sections?.length) {
                    let fd = rest.featuredDish;
                    let fp = rest.featuredPrice;
                    if (!fd || !fp) {
                      const sec = menu.sections.find((s) => s.items?.length);
                      if (sec) {
                        if (!fd) fd = sec.items[0].name;
                        if (!fp) fp = dishPrice(sec.items[0]);
                      }
                    }
                    return { ...rest, menu, featuredDish: fd || null, featuredPrice: fp || null };
                  }
                } catch {}
                return { ...rest, menu: null };
              }),
            );
            if (reqId !== enrichReqRef.current) return;
            out.push(...batch);
          }
          if (reqId === enrichReqRef.current) setRestaurantsData(out);
        } finally {
          if (reqId === enrichReqRef.current) setIsEnrichingMenus(false);
        }
      } catch {
        setRestaurantsData([]);
      } finally {
        setLoadingRestaurants(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneId, isOutOfService]);

  useEffect(() => {
    const slug = category.toLowerCase();
    if (categories.length) {
      const m = categories.find((c) => c.slug === slug || c.id === slug || c.name.toLowerCase().replace(/\s+/g, "-") === slug);
      setSelectedCategory(m ? m.slug || m.id : slug);
    } else setSelectedCategory(slug);
  }, [category, categories]);

  const filterKey = slugify(selectedCategory || category || "all") || "all";
  useEffect(() => {
    restoredRef.current = false;
    try {
      const st = JSON.parse(localStore.getItem(STORAGE_KEY) || "{}")?.[filterKey];
      if (st && typeof st === "object") {
        setSortBy(st.sortBy || null);
        setActiveFilters(new Set(Array.isArray(st.activeFilters) ? st.activeFilters : []));
      }
    } catch {
      setSortBy(null);
      setActiveFilters(new Set());
    } finally {
      restoredRef.current = true;
    }
  }, [filterKey]);
  useEffect(() => {
    if (!restoredRef.current) return;
    try {
      const st = JSON.parse(localStore.getItem(STORAGE_KEY) || "{}");
      st[filterKey] = { sortBy, activeFilters: Array.from(activeFilters) };
      localStore.setItem(STORAGE_KEY, JSON.stringify(st));
    } catch {}
  }, [filterKey, sortBy, activeFilters]);
  useEffect(() => {
    const x = chipX.current[selectedCategory];
    if (x != null) setTimeout(() => railRef.current?.scrollTo({ x: Math.max(0, x - 120), animated: true }), 150);
  }, [selectedCategory, categories]);

  const flashLoading = () => {
    setIsLoadingFilterResults(true);
    setTimeout(() => setIsLoadingFilterResults(false), 500);
  };
  const toggleFilter = (id) => {
    setActiveFilters((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
    flashLoading();
  };

  const filteredRecommended = useMemo(() => {
    const expanded = [];
    restaurantsData.forEach((r) => {
      if (r.menu && checkCategoryInMenu(r.menu, selectedCategory)) {
        const dishes = getAllCategoryDishesFromMenu(r.menu, selectedCategory);
        (vegMode ? dishes.filter((d) => d.foodType === "Veg") : dishes).forEach((d) =>
          expanded.push({ ...r, id: `${r.id || r.restaurantId}-${d.itemId}`, dishId: d.itemId || `${r.id}-dish`, categoryDish: d, categoryDishName: d.name, categoryDishPrice: d.price, categoryDishImage: d.image, categoryDishFoodType: d.foodType }),
        );
      }
    });
    let f = expanded;
    if (!f.length && selectedCategory !== "all") {
      const fb = getFallbackDishes(selectedCategory, restaurantsData);
      f = vegMode ? fb.filter((d) => d.categoryDishFoodType === "Veg") : fb;
    }
    return applyFiltersAndSorting(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, activeFilters, deferredSearch, restaurantsData, categoryKeywords, vegMode, vegModeOption, approvedFoodsData, sortBy]);
  const filteredAll = useMemo(() => {
    let f = [...restaurantsData];
    if (selectedCategory && selectedCategory !== "all") {
      const c = selectedCategory.toLowerCase();
      f = f.filter((r) => (r.cuisines || []).some((x) => x.toLowerCase().includes(c)) || (r.menu ? checkCategoryInMenu(r.menu, selectedCategory) : false));
    }
    return applyFiltersAndSorting(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, activeFilters, deferredSearch, restaurantsData, categoryKeywords, vegMode, vegModeOption, approvedFoodsData, sortBy]);

  const showSkeleton = isLoadingFilterResults || loadingRestaurants || (isEnrichingMenus && selectedCategory !== "all" && filteredRecommended.length === 0);
  const linkTo = (r) => {
    const ident = r?.slug || r?.restaurantId || r?.mongoId || slugify(r?.name || "");
    const dishId = r?.dishId || r?.categoryDish?.id || r?.categoryDish?._id || null;
    router.push({ pathname: `/restaurants/${ident}`, params: dishId ? { dish: String(dishId) } : {} });
  };
  const gray = isOutOfService;

  const Chip = ({ id, label, Icon }) => {
    const on = activeFilters.has(id);
    return (
      <Pressable onPress={() => toggleFilter(id)} style={[styles.chip, on && { backgroundColor: palette.yellow, borderColor: palette.yellow }]}>
        {Icon ? <Icon size={14} color={palette.gray900} /> : null}
        <Txt weight={700} style={{ fontSize: 12, color: palette.black }}>{label}</Txt>
      </Pressable>
    );
  };
  const Opt = ({ on, onPress, label, Icon, green, fillIcon }) => (
    <Pressable onPress={onPress} style={[styles.opt, on && (green ? { borderColor: palette.green600, backgroundColor: palette.green50 } : { borderColor: palette.yellow, backgroundColor: "#F9F9FB" })]}>
      {Icon ? <Icon size={24} color={on ? palette.black : palette.gray600} fill={fillIcon && on ? palette.black : "transparent"} strokeWidth={1.5} /> : null}
      <Txt weight={on ? 700 : 500} style={{ fontSize: 14, color: on ? palette.black : palette.gray700 }}>{label}</Txt>
    </Pressable>
  );
  const Row = ({ on, onPress, label, green }) => (
    <Pressable onPress={onPress} style={[styles.row, on && (green ? { borderColor: palette.green600, backgroundColor: palette.green50 } : { borderColor: palette.yellow, backgroundColor: "#F9F9FB" })]}>
      <Txt weight={on ? 700 : 500} style={{ fontSize: 14, color: on ? palette.black : palette.gray700 }}>{label}</Txt>
    </Pressable>
  );
  const Section = ({ id, title, children }) => (
    <View onLayout={(e) => (sectionY.current[id] = e.nativeEvent.layout.y)} style={{ marginBottom: 32, gap: 12 }}>
      <Txt weight={600} style={{ fontSize: 18, color: palette.gray900, marginBottom: 4 }}>{title}</Txt>
      {children}
    </View>
  );

  return (
    <Screen bg={palette.white}>
      <View style={[{ flex: 1 }, gray && { opacity: 0.75 }]}>
        <View style={styles.header}>
          <View style={styles.searchRow}>
            <Pressable onPress={() => router.replace("/")} style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" }}><ArrowLeft size={16} color={palette.gray700} /></Pressable>
            <View style={{ flex: 1, justifyContent: "center" }}>
              <Search size={14} color={palette.gray500} style={{ position: "absolute", left: 10, zIndex: 1 }} />
              <TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Search..." placeholderTextColor={palette.gray600} style={styles.searchInput} />
            </View>
          </View>
          <ScrollView ref={railRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingHorizontal: 16, paddingVertical: 12 }} style={{ borderBottomWidth: 1, borderColor: palette.gray100 }}>
            {loadingCategories
              ? Array.from({ length: 6 }).map((_, i) => (
                  <View key={i} style={{ alignItems: "center", gap: 6 }}>
                    <Skeleton width={64} height={64} radius={32} />
                    <Skeleton width={48} height={8} radius={4} />
                  </View>
                ))
              : categories.filter((c) => c.id !== "all" && c.slug !== "all").length
                ? categories
                    .filter((c) => c.id !== "all" && c.slug !== "all")
                    .map((c) => {
                      const slug = c.slug || c.id;
                      const sel = selectedCategory === slug || selectedCategory === c.id;
                      return (
                        <Pressable
                          key={c.id}
                          onLayout={(e) => (chipX.current[slug] = e.nativeEvent.layout.x)}
                          onPress={() => {
                            setSelectedCategory(slug);
                            router.setParams({ category: slug });
                          }}
                          style={[{ alignItems: "center", gap: 6, paddingBottom: 8 }, sel && { borderBottomWidth: 2, borderColor: palette.yellow }]}
                        >
                          {c.image ? (
                            <View style={[styles.catImg, sel && { borderColor: palette.yellow, elevation: 6 }]}>
                              <AppImage src={c.image} style={StyleSheet.absoluteFill} width={200} />
                            </View>
                          ) : (
                            <View style={[styles.catImg, { backgroundColor: palette.gray100, alignItems: "center", justifyContent: "center" }, sel && { borderColor: palette.yellow }]}>
                              <Txt weight={600} style={{ fontSize: 14, color: palette.gray600 }}>{String(c.name || "?").trim().slice(0, 2).toUpperCase()}</Txt>
                            </View>
                          )}
                          <Txt weight={500} style={{ fontSize: 12, color: sel ? palette.amber600 : palette.gray600 }}>{c.name}</Txt>
                        </Pressable>
                      );
                    })
                : <Txt weight={400} style={{ fontSize: 14, color: palette.gray600, paddingVertical: 16 }}>No categories available</Txt>}
          </ScrollView>
          <View style={{ paddingVertical: 12, gap: 8 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
              <Pressable onPress={() => setIsFilterOpen(true)} style={styles.chip}>
                <SlidersHorizontal size={14} color={palette.gray900} />
                <Txt weight={700} style={{ fontSize: 12, color: palette.black }}>Filters</Txt>
              </Pressable>
              <Chip id="under-30-mins" label="Under 30 mins" />
              <Chip id="delivery-under-45" label="Under 45 mins" />
              <Chip id="rating-4-plus" label="Rating 4.0+" />
              <Chip id="rating-45-plus" label="Rating 4.5+" />
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
              <Chip id="distance-under-1km" label="Under 1km" Icon={MapPin} />
              <Chip id="distance-under-2km" label="Under 2km" Icon={MapPin} />
              <Chip id="flat-50-off" label="Flat 50% OFF" />
              <Chip id="under-250" label="Under ₹250" />
            </ScrollView>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 32 + insets.bottom }}
          scrollEventThrottle={200}
          onScroll={(e) => {
            const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
            if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 600 && filteredAll.length > visibleCount) setVisibleCount((p) => p + 20);
          }}
        >
          {filteredRecommended.length > 0 && selectedCategory !== "all" ? (
            <View style={{ marginBottom: 32 }}>
              <Txt weight={600} style={styles.secTitle}>MATCHED DISHES</Txt>
              <View style={{ gap: 12 }}>
                {filteredRecommended.slice(0, visibleCount).map((r) => {
                  const closed = !getRestaurantAvailabilityStatus(r).isOpen;
                  return (
                    <Pressable key={r.id} disabled={closed} onPress={() => linkTo(r)} style={[styles.dishCard, (gray || closed) && { opacity: 0.75 }]}>
                      <View style={styles.dishImg}>
                        {r.categoryDishImage ? <AppImage src={r.categoryDishImage} style={StyleSheet.absoluteFill} width={300} /> : <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: palette.gray100 }}><UtensilsCrossed size={32} color={palette.gray300} /></View>}
                        <View style={styles.vegBadge}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: r.categoryDishFoodType === "Veg" ? palette.green500 : palette.red500 }} /></View>
                        {closed ? (
                          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", zIndex: 2 }]}>
                            <View style={styles.closed}><Txt weight={900} style={{ fontSize: 10, color: palette.white, letterSpacing: 2 }}>CLOSED</Txt></View>
                          </View>
                        ) : null}
                      </View>
                      <View style={{ flex: 1, minWidth: 0, paddingVertical: 4 }}>
                        <View style={styles.restPill}><Txt weight={700} numberOfLines={1} style={{ fontSize: 9, color: "#be185d", letterSpacing: 1 }}>{String(r.name || "").toUpperCase()}</Txt></View>
                        <Txt weight={700} numberOfLines={2} style={{ fontSize: 14, color: palette.gray900, marginBottom: 8 }}>{r.categoryDishName || r.featuredDish || r.name}</Txt>
                        <View style={{ marginTop: "auto", flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                              <Star size={12} color={palette.red500} fill={palette.red500} />
                              <Txt weight={600} style={{ fontSize: 12, color: palette.gray700 }}>{r.rating || "New"}</Txt>
                            </View>
                            {r.deliveryTime ? (
                              <>
                                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: palette.gray300 }} />
                                <Clock size={12} color={palette.gray500} />
                                <Txt weight={400} style={{ fontSize: 12, color: palette.gray500 }}>{r.deliveryTime}</Txt>
                              </>
                            ) : null}
                          </View>
                          <Txt weight={700} style={{ fontSize: 14, color: palette.gray900 }}>₹{Number(r.categoryDishPrice || r.featuredPrice || 0).toFixed(2)}</Txt>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View>
            <Txt weight={600} style={styles.secTitle}>ALL RESTAURANTS</Txt>
            {showSkeleton ? (
              <View style={{ gap: 16 }}>
                {[0, 1, 2].map((i) => <Skeleton key={i} height={260} radius={16} />)}
              </View>
            ) : (
              <View style={{ gap: 16 }}>
                {filteredAll.slice(0, visibleCount).map((r) => {
                  const fav = favorites.has(r.id);
                  const closed = !getRestaurantAvailabilityStatus(r).isOpen;
                  const hasRecImg = (r.recommendedItems || []).some((it) => typeof (it?.image || it?.imageUrl || it?.photoUrl) === "string" && (it?.image || it?.imageUrl || it?.photoUrl).trim());
                  return (
                    <RestaurantCarouselStateProvider key={r.id}>
                      <Pressable disabled={closed} onPress={() => linkTo(r)} style={[styles.restCard, (gray || closed) && { opacity: 0.75 }]}>
                        <View style={{ height: 192, borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: "hidden" }}>
                          <RestaurantImageCarousel restaurant={r} autoPlay height={192} radius={0} />
                          {closed ? (
                            <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", zIndex: 20 }]}>
                              <View style={styles.closed}><Txt weight={900} style={{ fontSize: 12, color: palette.white, letterSpacing: 2 }}>CLOSED</Txt></View>
                            </View>
                          ) : null}
                          {!hasRecImg && (r.categoryDishName || r.featuredDish) ? (
                            <View style={styles.dishBadge}><Txt weight={600} style={{ fontSize: 12, color: palette.white }}>{`${r.categoryDishName || r.featuredDish} • ₹${r.categoryDishPrice || r.featuredPrice || 0}`}</Txt></View>
                          ) : null}
                          <Pressable
                            onPress={() =>
                              setFavorites((p) => {
                                const n = new Set(p);
                                if (n.has(r.id)) n.delete(r.id);
                                else n.add(r.id);
                                return n;
                              })
                            }
                            style={styles.bookmark}
                          >
                            <Bookmark size={20} color={fav ? palette.red500 : palette.gray600} fill={fav ? palette.red500 : "transparent"} strokeWidth={2} />
                          </Pressable>
                        </View>
                        <View style={{ padding: 16 }}>
                          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                            <Txt weight={700} numberOfLines={1} style={{ fontSize: 16, color: palette.gray900, flex: 1 }}>{r.name}</Txt>
                            <View style={styles.ratingPill}>
                              <Txt weight={700} style={{ fontSize: 14, color: palette.white }}>{r.rating || "New"}</Txt>
                              <Star size={14} color={palette.white} fill={palette.white} />
                            </View>
                          </View>
                          {r.deliveryTime || r.distance ? (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
                              {r.deliveryTime ? (
                                <>
                                  <Clock size={16} color={palette.gray500} strokeWidth={1.5} />
                                  <Txt weight={500} style={{ fontSize: 14, color: palette.gray500 }}>{r.deliveryTime}</Txt>
                                </>
                              ) : null}
                              {r.deliveryTime && r.distance ? <Txt style={{ color: palette.gray300, marginHorizontal: 4 }}>|</Txt> : null}
                              {r.distance ? <Txt weight={500} style={{ fontSize: 14, color: palette.gray500 }}>{r.distance}</Txt> : null}
                            </View>
                          ) : null}
                          <RestaurantOfferBanner restaurant={r} />
                        </View>
                      </Pressable>
                    </RestaurantCarouselStateProvider>
                  );
                })}
              </View>
            )}
            {!showSkeleton && filteredAll.length > visibleCount ? <ActivityIndicator color={palette.yellow} style={{ marginTop: 16 }} /> : null}
            {!showSkeleton && filteredAll.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 48 }}>
                <Txt weight={400} style={{ fontSize: 14, color: palette.gray500, textAlign: "center" }}>{searchQuery ? `No restaurants found for "${searchQuery}"` : "No restaurants found with selected filters"}</Txt>
                <Pressable
                  onPress={() => {
                    setActiveFilters(new Set());
                    setSearchQuery("");
                    setSortBy(null);
                    enrichReqRef.current += 1;
                    setIsEnrichingMenus(false);
                    flashLoading();
                  }}
                  style={styles.clearBtn}
                >
                  <Txt weight={500} style={{ fontSize: 14, color: palette.gray900 }}>Clear all filters</Txt>
                </Pressable>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </View>

      <BottomSheet visible={isFilterOpen} onClose={() => setIsFilterOpen(false)} maxHeightRatio={0.85}>
        <View style={{ height: 620, maxHeight: "100%" }}>
          <View style={styles.sheetHead}>
            <Txt weight={700} style={{ fontSize: 18, color: palette.gray900 }}>Filters and sorting</Txt>
            <Pressable
              onPress={() => {
                setActiveFilters(new Set());
                setSortBy(null);
                flashLoading();
              }}
            >
              <Txt weight={700} style={{ fontSize: 14, color: palette.black, textDecorationLine: "underline" }}>Clear all</Txt>
            </Pressable>
          </View>
          <View style={{ flex: 1, flexDirection: "row" }}>
            <View style={styles.tabs}>
              {FILTER_TABS.map((t) => {
                const on = activeTab === t.id;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => {
                      setActiveTab(t.id);
                      const y = sectionY.current[t.id];
                      if (y != null) filterScrollRef.current?.scrollTo({ y, animated: true });
                    }}
                    style={[styles.tab, on && { backgroundColor: palette.white }]}
                  >
                    {on ? <View style={styles.tabBar} /> : null}
                    <t.Icon size={20} color={on ? palette.black : palette.gray500} strokeWidth={1.5} />
                    <Txt weight={on ? 700 : 500} style={{ fontSize: 12, color: on ? palette.black : palette.gray500, textAlign: "center" }}>{t.label}</Txt>
                  </Pressable>
                );
              })}
            </View>
            <ScrollView
              ref={filterScrollRef}
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16 }}
              scrollEventThrottle={100}
              onScroll={(e) => {
                const y = e.nativeEvent.contentOffset.y + 60;
                let cur = "sort";
                FILTER_TABS.forEach((t) => {
                  if (sectionY.current[t.id] != null && sectionY.current[t.id] <= y) cur = t.id;
                });
                if (cur !== activeTab && cur !== "trust") setActiveTab(cur);
              }}
            >
              <Section id="sort" title="Sort by">
                {[
                  [null, "Relevance"],
                  ["price-low", "Price: Low to High"],
                  ["price-high", "Price: High to Low"],
                  ["rating-high", "Rating: High to Low"],
                  ["rating-low", "Rating: Low to High"],
                ].map(([id, l]) => (
                  <Row key={l} on={sortBy === id} onPress={() => setSortBy(id)} label={l} />
                ))}
              </Section>
              <Section id="time" title="Estimated Time">
                <View style={styles.optGrid}>
                  <Opt on={activeFilters.has("under-30-mins")} onPress={() => toggleFilter("under-30-mins")} label="Under 30 mins" Icon={Timer} />
                  <Opt on={activeFilters.has("delivery-under-45")} onPress={() => toggleFilter("delivery-under-45")} label="Under 45 mins" Icon={Timer} />
                </View>
              </Section>
              <Section id="rating" title="Restaurant Rating">
                <View style={styles.optGrid}>
                  <Opt on={activeFilters.has("rating-35-plus")} onPress={() => toggleFilter("rating-35-plus")} label="Rated 3.5+" Icon={Star} fillIcon />
                  <Opt on={activeFilters.has("rating-4-plus")} onPress={() => toggleFilter("rating-4-plus")} label="Rated 4.0+" Icon={Star} fillIcon green />
                  <Opt on={activeFilters.has("rating-45-plus")} onPress={() => toggleFilter("rating-45-plus")} label="Rated 4.5+" Icon={Star} fillIcon green />
                </View>
              </Section>
              <Section id="distance" title="Distance">
                <View style={styles.optGrid}>
                  <Opt on={activeFilters.has("distance-under-1km")} onPress={() => toggleFilter("distance-under-1km")} label="Under 1 km" Icon={MapPin} green />
                  <Opt on={activeFilters.has("distance-under-2km")} onPress={() => toggleFilter("distance-under-2km")} label="Under 2 km" Icon={MapPin} green />
                </View>
              </Section>
              <Section id="price" title="Dish Price">
                <Row on={activeFilters.has("price-under-200")} onPress={() => toggleFilter("price-under-200")} label="Under ₹200" green />
                <Row on={activeFilters.has("under-250")} onPress={() => toggleFilter("under-250")} label="Under ₹250" green />
                <Row on={activeFilters.has("price-under-500")} onPress={() => toggleFilter("price-under-500")} label="Under ₹500" green />
              </Section>
              <Section id="offers" title="Offers">
                <View style={styles.optGrid}>
                  <Opt on={activeFilters.has("flat-50-off")} onPress={() => toggleFilter("flat-50-off")} label="Flat 50% OFF" Icon={BadgePercent} green />
                  <Opt on={activeFilters.has("price-match")} onPress={() => toggleFilter("price-match")} label="Price Match" Icon={BadgePercent} green />
                </View>
              </Section>
              {activeTab === "trust" ? (
                <View onLayout={(e) => (sectionY.current.trust = e.nativeEvent.layout.y)} style={{ gap: 12 }}>
                  <Txt weight={600} style={{ fontSize: 18, color: palette.gray900 }}>Trust Markers</Txt>
                  <Row label="Top Rated" />
                  <Row label="Trusted by 1000+ users" />
                </View>
              ) : null}
            </ScrollView>
          </View>
          <View style={styles.sheetFoot}>
            <Pressable onPress={() => setIsFilterOpen(false)} style={{ flex: 1, paddingVertical: 14, alignItems: "center" }}>
              <Txt weight={600} style={{ fontSize: 14, color: palette.gray700 }}>Close</Txt>
            </Pressable>
            <Pressable
              onPress={() => {
                setIsFilterOpen(false);
                flashLoading();
              }}
              style={[{ flex: 1, paddingVertical: 14, alignItems: "center", borderRadius: 12 }, activeFilters.size > 0 || sortBy ? { backgroundColor: palette.yellow } : { backgroundColor: palette.gray200 }]}
            >
              <Txt weight={600} style={{ fontSize: 14, color: activeFilters.size > 0 || sortBy ? palette.black : palette.gray500 }}>Show results</Txt>
            </Pressable>
          </View>
        </View>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: "rgba(255,255,255,0.95)", elevation: 2 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderColor: palette.gray100 },
  searchInput: { height: 36, paddingLeft: 32, paddingRight: 12, borderRadius: 8, borderWidth: 1, borderColor: palette.gray300, backgroundColor: palette.gray50, fontFamily: fonts.regular, fontSize: 12, color: palette.gray900 },
  catImg: { width: 64, height: 64, borderRadius: 32, overflow: "hidden", borderWidth: 2, borderColor: "transparent" },
  chip: { height: 28, paddingHorizontal: 10, borderRadius: 6, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: palette.white, borderWidth: 1, borderColor: palette.gray200 },
  secTitle: { fontSize: 12, color: palette.gray400, letterSpacing: 3, marginBottom: 16 },
  dishCard: { flexDirection: "row", gap: 12, backgroundColor: palette.white, borderWidth: 1, borderColor: palette.gray100, padding: 8, borderRadius: 16, elevation: 1 },
  dishImg: { width: 96, height: 96, borderRadius: 12, overflow: "hidden", backgroundColor: palette.gray50, borderWidth: 1, borderColor: palette.gray100 },
  vegBadge: { position: "absolute", top: 6, left: 6, zIndex: 3, backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 2, padding: 2, borderWidth: 1, borderColor: palette.gray200 },
  closed: { backgroundColor: "rgba(156,163,175,0.9)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  restPill: { alignSelf: "flex-start", backgroundColor: "#fdf2f8", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, marginBottom: 6 },
  restCard: { borderRadius: 16, borderWidth: 1, borderColor: palette.gray100, backgroundColor: palette.white, overflow: "hidden", elevation: 3 },
  dishBadge: { position: "absolute", top: 12, left: 12, zIndex: 10, backgroundColor: "rgba(17,24,39,0.8)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  bookmark: { position: "absolute", top: 12, right: 12, width: 36, height: 36, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.95)", alignItems: "center", justifyContent: "center", zIndex: 10, elevation: 2 },
  ratingPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: palette.emerald600, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  clearBtn: { marginTop: 16, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: palette.gray300 },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderColor: palette.gray200 },
  tabs: { width: 96, backgroundColor: palette.gray50, borderRightWidth: 1, borderColor: palette.gray200 },
  tab: { alignItems: "center", gap: 4, paddingVertical: 16, paddingHorizontal: 8 },
  tabBar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4, backgroundColor: palette.black, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  optGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  opt: { width: "46%", alignItems: "center", gap: 8, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: palette.gray200 },
  row: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: palette.gray200 },
  sheetFoot: { flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderColor: palette.gray200 },
});
