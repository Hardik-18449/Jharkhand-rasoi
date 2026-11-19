/** Cart + checkout — port of pages/user/cart/Cart.jsx (order creation, COD / wallet / Razorpay). */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAudioPlayer } from "expo-audio";
import {
  AlertTriangle, Heart, Plus, Minus, ArrowLeft, ChevronRight, MapPin, Phone, FileText, Utensils, Percent, Share2, X, Check, Wallet, Sparkles, Banknote, Zap, CheckCircle2,
} from "lucide-react-native";
import Svg, { Path } from "react-native-svg";
import Txt from "../src/components/ui/Txt";
import Screen from "../src/components/ui/Screen";
import AppImage from "../src/components/ui/AppImage";
import BottomSheet from "../src/components/ui/BottomSheet";
import Button from "../src/components/ui/Button";
import Confetti from "../src/components/Confetti";
import { shareLink, WEB_ORIGIN } from "../src/components/ui/ShareSheet";
import { useCart } from "../src/context/CartContext";
import { useProfile } from "../src/context/ProfileContext";
import { useAppLocation } from "../src/context/LocationProvider";
import { orderAPI, restaurantAPI, adminAPI, userAPI, publicAPI } from "../src/api";
import { initRazorpayPayment } from "../src/utils/razorpay";
import { toast } from "../src/utils/toast";
import { getCompanyNameAsync } from "../src/utils/businessSettings";
import { calculateDistance } from "../src/utils/common";
import { useCompanyName } from "../src/hooks/useCompanyName";
import { getRestaurantAvailabilityStatus, checkAddressDeliverability } from "../src/utils/restaurantAvailability";
import { readDeliveryAddressMode, readStoredUserLocation } from "../src/utils/locationPersistence";
import { localStore, sessionStore } from "../src/utils/storage";
import { dispatchAppEvent } from "../src/utils/events";
import { palette, fonts } from "../src/theme";

const R = "₹";
/** number or 0 (API amounts may be strings / null) */
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const CART_RECIPIENT_DETAILS_STORAGE_KEY = "food-cart-recipient-details-v1";
const CART_ORDER_NOTE_STORAGE_KEY = "food-cart-order-note-v1";
const PRIMARY = palette.yellow;
const successSound = require("../assets/audio/zomato_sms.mp3");

const formatFullAddress = (address) => {
  if (!address) return "";
  const looksLikeLatLng = (s) => /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(String(s || "").trim());
  if (address.formattedAddress && address.formattedAddress !== "Select location" && !looksLikeLatLng(address.formattedAddress)) return address.formattedAddress;
  const parts = [address.street, address.additionalDetails, address.city, address.state, address.zipCode].filter(Boolean);
  if (parts.length > 0) return parts.join(", ");
  if (address.address && address.address !== "Select location") return address.address;
  return "";
};
const readJson = (key) => {
  try {
    const raw = localStore.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const toLocalDateStr = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split("T")[0];
const buildPricingItems = (cart, { withOriginal = false, withModePrices = false } = {}) =>
  cart.map((item) => ({
    itemId: item.itemId || item.id,
    name: item.name,
    price: item.price,
    ...(withOriginal ? { originalPrice: item.originalPrice ?? item.price } : {}),
    variantId: item.variantId || undefined,
    variantName: item.variantName || undefined,
    variantPrice: item.variantPrice || item.price,
    ...(withModePrices
      ? { codPrice: item.codPrice != null ? Number(item.codPrice) : undefined, prepaidPrice: item.prepaidPrice != null ? Number(item.prepaidPrice) : undefined }
      : {}),
    quantity: item.quantity || 1,
    isCombo: item.isCombo === true ? true : undefined,
    comboId: item.isCombo === true ? String(item.comboId || item.itemId || item.id) : undefined,
    comboItems: item.isCombo === true && Array.isArray(item.comboItems) ? item.comboItems : undefined,
    image: item.image,
    description: item.description,
    isVeg: item.isVeg !== false,
  }));

function VegBox({ isVeg, size = 16 }) {
  const c = isVeg ? palette.green600 : palette.red600;
  return (
    <View style={{ width: size, height: size, borderWidth: 2, borderColor: c, borderRadius: 2, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: size / 2, height: size / 2, borderRadius: size, backgroundColor: c }} />
    </View>
  );
}

const { width: SW } = Dimensions.get("window");

function CartScreen() {
  const companyName = useCompanyName();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const player = useAudioPlayer(successSound);
  const hasRestoredRecipientRef = useRef(false);

  const { cart, updateQuantity, addToCart, clearCart, cleanCartForRestaurant } = useCart();
  const { getDefaultAddress, setDefaultAddress, addresses, userProfile } = useProfile();
  const { location: currentLocation, loading: currentLocationLoading, zoneId, deliveryAddressMode: ctxMode } = useAppLocation();

  const [showCoupons, setShowCoupons] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponCode, setCouponCode] = useState("");
  const [manualCouponCode, setManualCouponCode] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("cash");
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [onlinePaymentOnly, setOnlinePaymentOnly] = useState(false);
  const [maxCodAmount, setMaxCodAmount] = useState(0);
  const storedNote = useMemo(() => readJson(CART_ORDER_NOTE_STORAGE_KEY), []);
  const [restaurantNote, setRestaurantNote] = useState(() => String(storedNote?.restaurantNote || ""));
  const [showRestaurantNoteInput, setShowRestaurantNoteInput] = useState(() => Boolean(storedNote?.showRestaurantNoteInput) || String(storedNote?.restaurantNote || "").trim().length > 0);
  const [isEditingRecipient, setIsEditingRecipient] = useState(false);
  const [recipientDetails, setRecipientDetails] = useState({ name: "", phone: "" });
  const [sendCutlery, setSendCutlery] = useState(true);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [showBillDetails, setShowBillDetails] = useState(true);
  const [showGstModal, setShowGstModal] = useState(false);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [showSavingsCongrats, setShowSavingsCongrats] = useState(false);
  const [congratsSavingsAmount, setCongratsSavingsAmount] = useState(0);
  const [congratsSavingsPercentage, setCongratsSavingsPercentage] = useState(0);
  const [congratsSavingsItems, setCongratsSavingsItems] = useState([]);
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);
  const [orderSuccessSavingsAmount, setOrderSuccessSavingsAmount] = useState(0);
  const [placedOrderId, setPlacedOrderId] = useState(null);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const deliveryAddressMode = ctxMode || readDeliveryAddressMode() || "saved";

  const [restaurantData, setRestaurantData] = useState(null);
  const [loadingRestaurant, setLoadingRestaurant] = useState(false);
  const [pricing, setPricing] = useState(null);
  const [deliveryTip, setDeliveryTip] = useState(0);
  const [customTipInput, setCustomTipInput] = useState("");
  const [showCustomTip, setShowCustomTip] = useState(false);
  const [addons, setAddons] = useState([]);
  const [loadingAddons, setLoadingAddons] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [loadingCoupons, setLoadingCoupons] = useState(false);
  const [userOrderCount, setUserOrderCount] = useState(0);
  const [feeSettings, setFeeSettings] = useState({ deliveryFee: 0, deliveryFeeRanges: [], freeDeliveryUpTo: 0, freeDeliveryThreshold: 149, platformFee: 0, packagingFee: 0, gstRate: 0 });

  useEffect(() => {
    publicAPI
      .getBusinessSettings()
      .then((r) => {
        if (r?.data?.success && r?.data?.data) {
          setOnlinePaymentOnly(!!r.data.data.onlinePaymentOnly);
          setMaxCodAmount(Number(r.data.data.maxCodAmount) || 0);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!showOrderSuccess) return;
    try {
      player.seekTo(0);
      player.volume = 0.8;
      player.play();
    } catch {}
  }, [showOrderSuccess, player]);

  useEffect(() => {
    if (!showSavingsCongrats) return undefined;
    const t = setTimeout(() => {
      setShowSavingsCongrats(false);
      setShowOrderSuccess(true);
    }, 3000);
    return () => clearTimeout(t);
  }, [showSavingsCongrats]);
  useEffect(() => {
    if (showOrderSuccess) {
      setCongratsSavingsAmount(0);
      setCongratsSavingsPercentage(0);
      setCongratsSavingsItems([]);
    }
  }, [showOrderSuccess]);

  const availableTimeSlots = useMemo(() => {
    if (!isScheduled || !scheduledDate || !restaurantData) return [];
    try {
      const status = getRestaurantAvailabilityStatus(restaurantData, new Date(scheduledDate));
      let openingHour = 9;
      let closingHour = 22;
      if (status.openingTime) openingHour = parseInt(status.openingTime.split(":")[0], 10);
      if (status.closingTime) closingHour = parseInt(status.closingTime.split(":")[0], 10);
      if (closingHour < openingHour) closingHour += 24;
      const slots = [];
      const now = new Date();
      const isToday = scheduledDate === toLocalDateStr(now);
      const currentHour = now.getHours();
      for (let h = openingHour; h <= closingHour; h++) {
        const actualHour = h % 24;
        if (isToday && h <= currentHour) continue;
        slots.push({ value: `${String(actualHour).padStart(2, "0")}:00`, label: `${actualHour % 12 || 12}:00 ${actualHour >= 12 ? "PM" : "AM"}` });
      }
      return slots;
    } catch {
      return [];
    }
  }, [isScheduled, scheduledDate, restaurantData]);
  useEffect(() => {
    if (isScheduled && availableTimeSlots.length > 0) {
      if (!availableTimeSlots.some((s) => s.value === scheduledTime)) setScheduledTime(availableTimeSlots[0].value);
    } else if (!isScheduled) {
      setScheduledDate("");
      setScheduledTime("");
    }
  }, [isScheduled, availableTimeSlots, scheduledTime]);

  const getAddressId = (a) => a?.id || a?._id || null;
  const normalizeAddressLabel = (label) => {
    if (!label) return "";
    const v = String(label).trim().toLowerCase();
    if (v === "work" || v === "office") return "office";
    return v;
  };
  const getDisplayAddressLabel = (label) => {
    const n = normalizeAddressLabel(label);
    if (n === "office") return "Work";
    if (n === "home") return "Home";
    if (n === "other") return "Other";
    return label || "Saved address";
  };
  const sanitizeRecipientPhone = (v) => String(v || "").replace(/[^\d+]/g, "").slice(0, 14);
  const savedAddress = getDefaultAddress();
  const selectedAddress = addresses.find((a) => getAddressId(a) && getAddressId(a) === selectedAddressId);

  const currentLocationAddress = useMemo(() => {
    const loc = currentLocation?.latitude && currentLocation?.longitude ? currentLocation : readStoredUserLocation();
    if (!loc?.latitude || !loc?.longitude) return null;
    const formattedAddress = loc?.formattedAddress || loc?.address || "";
    if (!formattedAddress || formattedAddress === "Select location") return null;
    return {
      label: "Home",
      formattedAddress,
      address: formattedAddress,
      street: loc?.street || loc?.address || loc?.area || "Current Location",
      additionalDetails: loc?.area || "",
      city: loc?.city || loc?.area || "Current City",
      state: loc?.state || loc?.city || "Current State",
      zipCode: loc?.postalCode || loc?.zipCode || "",
      phone: userProfile?.phone || "",
      location: { type: "Point", coordinates: [loc.longitude, loc.latitude] },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLocation?.latitude, currentLocation?.longitude, currentLocation?.formattedAddress, currentLocation?.address, currentLocation?.area, currentLocation?.city, currentLocation?.state, userProfile?.phone, deliveryAddressMode]);

  const defaultAddress = useMemo(
    () => (deliveryAddressMode === "current" ? currentLocationAddress || selectedAddress || savedAddress || null : selectedAddress || savedAddress || currentLocationAddress || null),
    [deliveryAddressMode, currentLocationAddress, selectedAddress, savedAddress],
  );
  const hasSavedAddress = Boolean(defaultAddress && formatFullAddress(defaultAddress));
  const recipientName = String(recipientDetails.name || "").trim() || userProfile?.name || "Your Name";
  const recipientPhone = sanitizeRecipientPhone(recipientDetails.phone || "") || userProfile?.phone || "";

  const addressDeliverabilityMap = useMemo(() => {
    const map = new Map();
    if (!restaurantData || !Array.isArray(addresses)) return map;
    addresses.forEach((a) => {
      const id = getAddressId(a);
      if (id) map.set(id, checkAddressDeliverability(a, restaurantData));
    });
    return map;
  }, [addresses, restaurantData]);
  const currentAddressDeliverability = useMemo(() => checkAddressDeliverability(defaultAddress, restaurantData), [defaultAddress, restaurantData]);
  const isCurrentAddressDeliverable = currentAddressDeliverability.isDeliverable;

  // recipient restore / persist
  useEffect(() => {
    const stored = readJson(CART_RECIPIENT_DETAILS_STORAGE_KEY);
    if (stored) {
      setRecipientDetails({ name: stored?.name || "", phone: sanitizeRecipientPhone(stored?.phone || "") });
      setIsEditingRecipient(Boolean(stored?.isEditingRecipient));
    }
    hasRestoredRecipientRef.current = true;
  }, []);
  useEffect(() => {
    setRecipientDetails((p) => ({ name: p.name || userProfile?.name || "", phone: p.phone || userProfile?.phone || "" }));
  }, [userProfile?.name, userProfile?.phone]);
  useEffect(() => {
    if (!hasRestoredRecipientRef.current) return;
    try {
      localStore.setItem(CART_RECIPIENT_DETAILS_STORAGE_KEY, JSON.stringify({ name: recipientDetails.name || "", phone: sanitizeRecipientPhone(recipientDetails.phone || ""), isEditingRecipient }));
    } catch {}
  }, [recipientDetails, isEditingRecipient]);
  useEffect(() => {
    try {
      localStore.setItem(CART_ORDER_NOTE_STORAGE_KEY, JSON.stringify({ restaurantNote, showRestaurantNoteInput }));
    } catch {}
  }, [restaurantNote, showRestaurantNoteInput]);

  useEffect(() => {
    if (deliveryAddressMode === "current") setSelectedAddressId(null);
  }, [deliveryAddressMode]);
  useEffect(() => {
    const defaultId = getAddressId(savedAddress);
    if (deliveryAddressMode !== "current" && !selectedAddressId && defaultId) setSelectedAddressId(defaultId);
  }, [savedAddress, selectedAddressId, deliveryAddressMode]);

  const restaurantId = cart.length > 0 ? restaurantData?._id || restaurantData?.restaurantId || cart[0]?.restaurantId || null : null;

  // restaurant data
  useEffect(() => {
    const run = async () => {
      if (cart.length === 0) {
        setRestaurantData(null);
        return;
      }
      if (restaurantData) return;
      setLoadingRestaurant(true);
      if (cart[0]?.restaurantId) {
        try {
          const cartRestaurantId = cart[0].restaurantId;
          const r = await restaurantAPI.getRestaurantById(cartRestaurantId);
          const data = r?.data?.data?.restaurant || r?.data?.restaurant;
          if (data) {
            const matches = (data.restaurantId || data._id?.toString()) === cartRestaurantId || data._id?.toString() === cartRestaurantId || data.restaurantId === cartRestaurantId;
            if (!matches) {
              setLoadingRestaurant(false);
              return;
            }
            setRestaurantData(data);
            setLoadingRestaurant(false);
            return;
          }
        } catch {}
      }
      if (cart[0]?.restaurant) {
        try {
          const sr = await restaurantAPI.getRestaurants({ limit: 100 });
          const list = sr?.data?.data?.restaurants || sr?.data?.data || [];
          const name = cart[0].restaurant?.toLowerCase().trim();
          let match = list.find((x) => x.name?.toLowerCase().trim() === name);
          if (!match) match = list.find((x) => x.name?.toLowerCase().includes(name) || name.includes(x.name?.toLowerCase()));
          if (match) {
            if (name && match.name?.toLowerCase().trim() !== name) {
              setLoadingRestaurant(false);
              return;
            }
            setRestaurantData(match);
            setLoadingRestaurant(false);
            return;
          }
        } catch {}
      }
      setRestaurantData(null);
      setLoadingRestaurant(false);
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.length, cart[0]?.restaurantId, cart[0]?.restaurant]);

  useEffect(() => {
    if (restaurantData) sessionStore.setItem("cart_restaurant", JSON.stringify(restaurantData));
    else if (cart.length === 0) sessionStore.removeItem("cart_restaurant");
  }, [restaurantData, cart.length]);

  // addons
  useEffect(() => {
    if (cart.length === 0) {
      setAddons([]);
      return;
    }
    if (loadingRestaurant) return;
    const idToUse = restaurantData?._id || restaurantData?.restaurantId;
    if (!idToUse || !/^[a-zA-Z0-9\-_]+$/.test(String(idToUse)) || String(idToUse).length < 3) {
      setAddons([]);
      return;
    }
    setLoadingAddons(true);
    restaurantAPI
      .getAddonsByRestaurantId(String(idToUse))
      .then((r) => setAddons(r?.data?.data?.addons || r?.data?.addons || []))
      .catch(() => setAddons([]))
      .finally(() => setLoadingAddons(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantData, cart.length, loadingRestaurant]);

  // coupons
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (cart.length === 0 || !restaurantId) {
        setAvailableCoupons([]);
        return;
      }
      setLoadingCoupons(true);
      const all = [];
      const codes = new Set();
      for (const cartItem of cart) {
        const couponItemId = cartItem.itemId || cartItem.id;
        if (!couponItemId) continue;
        try {
          const r = await restaurantAPI.getCouponsByItemIdPublic(restaurantId, couponItemId);
          if (r?.data?.success && r?.data?.data?.coupons) {
            r.data.data.coupons.forEach((coupon) => {
              if (codes.has(coupon.couponCode)) return;
              codes.add(coupon.couponCode);
              const isPct = coupon.discountType === "percentage";
              const flat = isPct ? 0 : Number(coupon.discountValue || coupon.discount || coupon.originalPrice || 0);
              const pct = isPct ? Number(coupon.discountPercentage || coupon.discountValue || 0) : 0;
              all.push({
                code: coupon.couponCode,
                discount: flat,
                discountValue: Number(coupon.discountValue || flat || pct || 0),
                discountPercentage: pct,
                discountDisplay: isPct ? `${pct}% OFF` : `${R}${flat} OFF`,
                minOrder: coupon.minOrderValue || coupon.minOrder || 0,
                description: isPct ? `${pct}% OFF with '${coupon.couponCode}'` : `Save ${R}${flat} with '${coupon.couponCode}'`,
                originalPrice: coupon.originalPrice,
                discountedPrice: coupon.discountedPrice,
                customerGroup: coupon.customerGroup || "all",
                isGlobalCoupon: Boolean(coupon.isGlobalCoupon),
                discountType: coupon.discountType,
                itemId: couponItemId,
                itemName: cartItem.name,
              });
            });
          }
        } catch {}
      }
      if (cancelled) return;
      setAvailableCoupons(all);
      setLoadingCoupons(false);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [cart, restaurantId]);

  // backend pricing
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (cart.length === 0 || !hasSavedAddress) {
        setPricing(null);
        return;
      }
      try {
        const r = await orderAPI.calculateOrder({
          items: buildPricingItems(cart, { withModePrices: true }),
          restaurantId: restaurantData?.restaurantId || restaurantData?._id || restaurantId || undefined,
          deliveryAddress: defaultAddress,
          couponCode: appliedCoupon?.code || couponCode || undefined,
          paymentMethod: selectedPaymentMethod,
          deliveryTip: deliveryTip || 0,
        });
        if (cancelled) return;
        if (r?.data?.success && r?.data?.data?.pricing) {
          const np = r.data.data.pricing;
          setPricing(np);
          if (np.couponError && appliedCoupon) {
            toast.error(np.couponError);
            setAppliedCoupon(null);
            setCouponCode("");
            setManualCouponCode("");
          } else if (np.appliedCoupon && !appliedCoupon) {
            const c = availableCoupons.find((x) => x.code === np.appliedCoupon.code);
            if (c) setAppliedCoupon(c);
          } else if (!np.appliedCoupon && appliedCoupon) {
            setAppliedCoupon(null);
            setCouponCode("");
            setManualCouponCode("");
          }
        }
      } catch {
        if (!cancelled) setPricing(null);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, defaultAddress, appliedCoupon, couponCode, restaurantId, selectedPaymentMethod, deliveryTip]);

  const refreshWallet = () =>
    userAPI
      .getWallet()
      .then((r) => {
        if (r?.data?.success && r?.data?.data?.wallet) setWalletBalance(r.data.data.wallet.balance || 0);
      })
      .catch(() => setWalletBalance(0));
  useEffect(() => {
    refreshWallet();
    // getOrders lives on orderAPI (userAPI.getOrders is undefined → crashed the cart on open)
    orderAPI
      .getOrders({ page: 1, limit: 1 })
      .then((r) => r?.data?.success && setUserOrderCount(r?.data?.data?.pagination?.total || 0))
      .catch(() => setUserOrderCount(0));
  }, []);

  useEffect(() => {
    const fetchFees = () =>
      adminAPI
        .getPublicFeeSettings()
        .then((r) => {
          const fs = r?.data?.data?.feeSettings;
          if (r?.data?.success && fs) {
            setFeeSettings({
              deliveryFee: fs.deliveryFee ?? 0,
              deliveryFeeRanges: fs.deliveryFeeRanges ?? [],
              freeDeliveryUpTo: fs.freeDeliveryUpTo ?? 0,
              freeDeliveryThreshold: fs.freeDeliveryThreshold ?? 149,
              platformFee: fs.platformFee ?? 0,
              packagingFee: fs.packagingFee ?? 0,
              gstRate: fs.gstRate ?? 0,
              gstOnDeliveryFee: fs.gstOnDeliveryFee ?? 0,
              gstOnPlatformFee: fs.gstOnPlatformFee ?? 0,
              gstOnPackagingFee: fs.gstOnPackagingFee ?? 0,
            });
          }
        })
        .catch(() => {});
    fetchFees();
    const id = setInterval(fetchFees, 30000);
    return () => clearInterval(id);
  }, []);

  const isCodSelected = selectedPaymentMethod === "cash";
  const getItemEffectivePrice = (item) => {
    if (isCodSelected && item.codPrice != null && Number(item.codPrice) > 0) return Number(item.codPrice);
    if (!isCodSelected && item.prepaidPrice != null && Number(item.prepaidPrice) > 0) return Number(item.prepaidPrice);
    return Number(item.price) || 0;
  };
  const cashlessSavings = useMemo(() => {
    if (pricing && Number.isFinite(Number(pricing.codSubtotal)) && Number.isFinite(Number(pricing.prepaidSubtotal))) {
      return Math.max(0, Math.round((Number(pricing.codSubtotal) - Number(pricing.prepaidSubtotal)) * 100) / 100);
    }
    return cart.reduce((sum, item) => {
      const codP = item.codPrice != null && Number(item.codPrice) > 0 ? Number(item.codPrice) : null;
      const preP = item.prepaidPrice != null && Number(item.prepaidPrice) > 0 ? Number(item.prepaidPrice) : Number(item.price) || 0;
      return codP && codP > preP ? sum + (codP - preP) * (item.quantity || 1) : sum;
    }, 0);
  }, [cart, pricing]);
  const modeItemTotals = useMemo(() => {
    const pre = Number(pricing?.prepaidSubtotal);
    const cod = Number(pricing?.codSubtotal);
    if (!Number.isFinite(pre) || !Number.isFinite(cod) || Math.abs(pre - cod) < 0.01) return null;
    return { prepaid: pre, cod };
  }, [pricing]);

  // Amounts can arrive as strings from the API / fee settings; Hermes throws "undefined is not a function" on "10".toFixed() → crash. Always coerce.
  const subtotal = num(pricing?.subtotal) || cart.reduce((s, i) => s + num(getItemEffectivePrice(i)) * (num(i.quantity) || 1), 0);
  const orderDistanceKm = useMemo(() => {
    const rc = restaurantData?.location?.coordinates;
    const dc = defaultAddress?.location?.coordinates;
    if (!Array.isArray(rc) || !Array.isArray(dc) || rc.length !== 2 || dc.length !== 2) return null;
    return calculateDistance(rc[1], rc[0], dc[1], dc[0]);
  }, [restaurantData, defaultAddress]);
  const fallbackDeliveryFee = (() => {
    if (appliedCoupon?.freeDelivery) return 0;
    const freeUpTo = Number(feeSettings.freeDeliveryUpTo || 0);
    if (freeUpTo > 0 && subtotal >= freeUpTo) return 0;
    const ranges = Array.isArray(feeSettings.deliveryFeeRanges) ? [...feeSettings.deliveryFeeRanges] : [];
    if (ranges.length > 0 && Number.isFinite(orderDistanceKm)) {
      const sorted = ranges.sort((a, b) => Number(a.min) - Number(b.min));
      for (let i = 0; i < sorted.length; i += 1) {
        const min = Number(sorted[i].min);
        const max = Number(sorted[i].max);
        const inRange = i === sorted.length - 1 ? orderDistanceKm >= min : orderDistanceKm >= min && orderDistanceKm < max;
        if (inRange) return Number(sorted[i].fee);
      }
    }
    return Number(feeSettings.deliveryFee || 0);
  })();
  const deliveryFee = num(pricing != null ? pricing.deliveryFee : fallbackDeliveryFee);
  const dfb = pricing?.deliveryFeeBreakdown || null;
  const deliveryFeeBreakdownText = dfb?.source === "distance" && Number.isFinite(Number(dfb?.distanceKm)) ? `Distance ${Number(dfb.distanceKm).toFixed(1)} km` : null;
  const platformFee = num(pricing != null ? pricing.platformFee : feeSettings.platformFee);
  const packagingFee = num(pricing != null ? pricing.packagingFee : feeSettings.packagingFee);
  const gstOnItemTotal = num(pricing?.taxBreakdown?.itemTax ?? subtotal * (num(feeSettings.gstRate) / 100));
  const gstOnDeliveryFee = num(pricing?.taxBreakdown?.deliveryTax ?? num(fallbackDeliveryFee) * (num(feeSettings.gstOnDeliveryFee) / 100));
  const gstOnPlatformFee = num(pricing?.taxBreakdown?.platformTax ?? num(feeSettings.platformFee) * (num(feeSettings.gstOnPlatformFee) / 100));
  const gstOnPackagingFee = num(pricing?.taxBreakdown?.packagingTax ?? num(feeSettings.packagingFee) * (num(feeSettings.gstOnPackagingFee) / 100));
  const gstCharges = num(pricing != null ? pricing.tax : Math.round(gstOnItemTotal + gstOnDeliveryFee + gstOnPlatformFee + gstOnPackagingFee));
  const couponDiscount = num(pricing?.couponDiscount) || (appliedCoupon ? Math.min(num(appliedCoupon.discount), subtotal * 0.5) : 0);
  const discount = num(pricing?.discount) || couponDiscount;
  const totalBeforeDiscount = subtotal + deliveryFee + platformFee + packagingFee + gstCharges + (Number(deliveryTip) || 0);
  const total = pricing?.total != null ? num(pricing.total) + (pricing.deliveryTip != null ? 0 : Number(deliveryTip) || 0) : Math.max(0, totalBeforeDiscount - discount);
  const savings = num(pricing?.savings ?? Math.max(0, totalBeforeDiscount - total));
  const isCodHidden = onlinePaymentOnly || (maxCodAmount > 0 && total > maxCodAmount) || userProfile?.codEnabled === false;
  useEffect(() => {
    if (isCodHidden && selectedPaymentMethod === "cash") setSelectedPaymentMethod("razorpay");
  }, [isCodHidden, selectedPaymentMethod, total]);

  const platformPricingSavings = useMemo(() => {
    let totalPlatformPrice = 0;
    let totalPlatformGst = 0;
    const items = [];
    let has = false;
    cart.forEach((item) => {
      if (item.priceOnOtherPlatforms && item.priceOnOtherPlatforms > 0) {
        has = true;
        const q = item.quantity || 1;
        const pp = (item.priceOnOtherPlatforms || 0) * q;
        const rate = Number(item.otherPlatformGst || 0);
        const pg = rate > 0 ? Math.round(pp * (rate / 100)) : 0;
        const our = (item.price || 0) * q;
        totalPlatformPrice += pp;
        totalPlatformGst += pg;
        items.push({ name: item.name, savings: Math.max(0, pp + pg - our), quantity: q });
      }
    });
    const withGst = totalPlatformPrice + totalPlatformGst;
    const totalSavings = Math.max(0, withGst - total);
    return { hasPlatformPricing: has, totalPlatformPrice, totalPlatformGst, totalPlatformPriceWithGst: withGst, totalSavings, savingsPercentage: withGst > 0 ? ((totalSavings / withGst) * 100).toFixed(1) : 0, items };
  }, [cart, total]);

  const selectedPaymentLabel = selectedPaymentMethod === "wallet" ? "Wallet" : selectedPaymentMethod === "razorpay" ? "Online Payment" : "Cash on Delivery";
  const restaurantName = restaurantData?.name || cart[0]?.restaurant || "Restaurant";

  const handleShare = () => {
    const n = restaurantName || companyName || "this restaurant";
    const url = `${WEB_ORIGIN}/user/cart`;
    shareLink({ title: `My Cart at ${n}`, text: `Check out what I'm ordering from ${n}!`, url });
  };
  const handleBack = () => {
    const idOrSlug = restaurantData?.slug || restaurantId;
    if (idOrSlug) router.replace(`/restaurants/${idOrSlug}`);
    else if (router.canGoBack()) router.back();
    else router.replace("/");
  };
  const openLocationSelector = () => router.push("/address-selector");

  const handleSelectSavedAddress = (address) => {
    const id = getAddressId(address);
    if (id) {
      setSelectedAddressId(id);
      setDefaultAddress(id);
    }
    if (restaurantData) {
      if (!checkAddressDeliverability(address, restaurantData).isDeliverable) toast.error("Unable to deliver to this address. Please choose a nearby address.");
      else toast.success(`${address.label || "Saved"} address selected!`);
    }
  };
  const handleSelectAddressByLabel = (label) => {
    const address = addresses.find((a) => normalizeAddressLabel(a.label) === normalizeAddressLabel(label));
    if (!address) {
      toast.error(`No ${label} address found. Please add an address first.`);
      return;
    }
    handleSelectSavedAddress(address);
  };

  const validateCoupon = async (code) => {
    const r = await orderAPI.calculateOrder({
      items: buildPricingItems(cart, { withOriginal: true }),
      restaurantId: restaurantData?.restaurantId || restaurantData?._id || restaurantId || null,
      deliveryAddress: defaultAddress,
      couponCode: code,
      paymentMethod: selectedPaymentMethod,
      deliveryTip: deliveryTip || 0,
    });
    return r?.data?.data?.pricing;
  };
  const handleApplyCoupon = async (coupon) => {
    if (coupon?.customerGroup === "new" && userOrderCount > 0) return toast.error("This coupon is only for first-time users");
    if (subtotal < (Number(coupon.minOrder) || 0)) return toast.error(`Min order ${R}${Number(coupon.minOrder || 0)}`);
    if (cart.length === 0) return toast.error("Add items to cart first");
    if (!hasSavedAddress) return toast.error("Add delivery address first");
    try {
      const p = await validateCoupon(coupon.code);
      if (p?.couponError) return toast.error(p.couponError);
      if (!p || !p.appliedCoupon) return toast.error("Coupon not applicable");
      setPricing(p);
      setAppliedCoupon({ ...coupon, discount: Number(p.appliedCoupon.discount || p.couponDiscount || coupon.discount || 0) });
      setCouponCode(coupon.code);
      setManualCouponCode(coupon.code);
      setShowCoupons(false);
    } catch {
      toast.error("Failed to apply coupon");
    }
    return undefined;
  };
  const handleApplyCouponCode = async () => {
    const inputCode = manualCouponCode.trim().toUpperCase();
    if (!inputCode) return toast.error("Enter coupon code");
    if (cart.length === 0 || !hasSavedAddress) return toast.error("Add items and delivery address first");
    const matched = availableCoupons.find((c) => String(c.code || "").toUpperCase() === inputCode);
    if (matched?.customerGroup === "new" && userOrderCount > 0) return toast.error("This coupon is only for first-time users");
    try {
      const p = await validateCoupon(inputCode);
      if (!p) return toast.error("Unable to validate coupon");
      if (p.couponError) {
        toast.error(p.couponError);
        setCouponCode("");
        return undefined;
      }
      if (!p.appliedCoupon) {
        toast.error("Invalid or unavailable coupon code");
        setCouponCode("");
        return undefined;
      }
      setPricing(p);
      setCouponCode(inputCode);
      setAppliedCoupon(matched || { code: inputCode, discount: p.appliedCoupon.discount || 0, minOrder: 0, customerGroup: "all" });
      setShowCoupons(false);
      toast.success("Coupon applied");
    } catch {
      toast.error("Failed to apply coupon");
    }
    return undefined;
  };
  const handleRemoveCoupon = async () => {
    setAppliedCoupon(null);
    setCouponCode("");
    setManualCouponCode("");
    if (cart.length > 0 && hasSavedAddress) {
      try {
        const p = await validateCoupon(null);
        if (p) setPricing(p);
      } catch {}
    }
  };

  const finishSuccess = (order) => {
    setPlacedOrderId(order?._id || order?.orderId || order?.id || null);
    setOrderSuccessSavingsAmount(platformPricingSavings.totalSavings > 0 ? platformPricingSavings.totalSavings : 0);
    if (platformPricingSavings.totalSavings > 0) {
      setCongratsSavingsAmount(platformPricingSavings.totalSavings);
      setCongratsSavingsPercentage(platformPricingSavings.savingsPercentage);
      setCongratsSavingsItems(platformPricingSavings.items);
      setShowSavingsCongrats(true);
    } else setShowOrderSuccess(true);
    dispatchAppEvent("order-placed", { order });
    clearCart();
  };
  const clearNote = () => {
    setRestaurantNote("");
    setShowRestaurantNoteInput(false);
    try {
      localStore.removeItem(CART_ORDER_NOTE_STORAGE_KEY);
    } catch {}
  };

  const handlePlaceOrder = async () => {
    if (!hasSavedAddress) {
      toast.error("Please choose a delivery location to continue");
      openLocationSelector();
      return;
    }
    if (!isCurrentAddressDeliverable) {
      toast.error(currentAddressDeliverability.reason || "The selected delivery address is out of this restaurant's delivery zone. Please choose a nearby address.");
      return;
    }
    if (isScheduled) {
      if (!scheduledDate || !scheduledTime) return toast.error("Please select both date and time to schedule your order");
      if (new Date(`${scheduledDate}T${scheduledTime}:00`) < new Date()) return toast.error("Scheduled time must be in the future");
    }
    if (cart.length === 0) return toast.error("Your cart is empty");
    setIsPlacingOrder(true);
    try {
      const orderPricing = pricing
        ? { ...pricing, deliveryTip: Number(deliveryTip) || 0, total: pricing.total + (pricing.deliveryTip != null ? 0 : Number(deliveryTip) || 0) }
        : { subtotal, deliveryFee, tax: gstCharges, platformFee, discount, total, couponCode: appliedCoupon?.code || null };
      if (!orderPricing.couponCode && appliedCoupon?.code) orderPricing.couponCode = appliedCoupon.code;
      const orderItems = cart.map((item) => ({
        itemId: item.itemId || item.id,
        name: item.name,
        price: getItemEffectivePrice(item),
        codPrice: item.codPrice != null ? Number(item.codPrice) : undefined,
        prepaidPrice: item.prepaidPrice != null ? Number(item.prepaidPrice) : undefined,
        originalPrice: item.originalPrice ?? item.price,
        variantId: item.variantId || undefined,
        variantName: item.variantName || undefined,
        variantPrice: item.variantPrice || item.price,
        quantity: item.quantity || 1,
        isCombo: item.isCombo === true ? true : undefined,
        comboId: item.isCombo === true ? String(item.comboId || item.itemId || item.id) : undefined,
        comboItems: item.isCombo === true && Array.isArray(item.comboItems) ? item.comboItems : undefined,
        image: item.image || "",
        description: item.description || "",
        isVeg: item.isVeg === true || item.foodType === "Veg",
        preparationTime: item.preparationTime,
      }));
      const finalRestaurantId = restaurantData?.restaurantId || restaurantData?._id || null;
      const finalRestaurantName = restaurantData?.name || null;
      if (!isScheduled && restaurantData && !getRestaurantAvailabilityStatus(restaurantData).isOpen) {
        toast.error("Restaurant is currently offline or timing is not available. Please order during open hours.");
        setIsPlacingOrder(false);
        return undefined;
      }
      if (!finalRestaurantId) {
        toast.error("Error: Restaurant information is missing. Please refresh the page and try again.");
        setIsPlacingOrder(false);
        return undefined;
      }
      const ids = cart.map((i) => i.restaurantId).filter(Boolean).map((id) => String(id).trim());
      const names = [...new Set(cart.map((i) => i.restaurant).filter(Boolean).map((n) => n.trim().toLowerCase()))];
      if (names.length > 1) {
        if (finalRestaurantId && finalRestaurantName) cleanCartForRestaurant(finalRestaurantId, finalRestaurantName);
        else if (cart[0]?.restaurantId && cart[0]?.restaurant) cleanCartForRestaurant(cart[0].restaurantId, cart[0].restaurant);
        toast.error("Cart contained items from different restaurants. Items from other restaurants have been removed.");
        setIsPlacingOrder(false);
        return undefined;
      }
      if (ids.length > 0) {
        const cid = ids[0];
        if (!(cid === finalRestaurantId || cid === restaurantData?._id?.toString() || cid === restaurantData?.restaurantId)) {
          toast.error(`Error: Cart items belong to "${names[0] || "Unknown Restaurant"}" but restaurant data doesn't match. Please refresh the page and try again.`);
          setIsPlacingOrder(false);
          return undefined;
        }
      }
      if (names.length > 0 && finalRestaurantName && names[0] !== finalRestaurantName.toLowerCase().trim()) {
        toast.error(`Error: Cart items belong to "${names[0]}" but restaurant data shows "${finalRestaurantName}". Please refresh the page and try again.`);
        setIsPlacingOrder(false);
        return undefined;
      }
      const orderPayload = {
        items: orderItems,
        address: { ...defaultAddress, phone: recipientPhone || defaultAddress?.phone || "", name: recipientName, fullName: recipientName },
        customerName: recipientName,
        customerPhone: recipientPhone || defaultAddress?.phone || "",
        restaurantId: finalRestaurantId,
        restaurantName: finalRestaurantName || undefined,
        pricing: orderPricing,
        note: "",
        restaurantNote: restaurantNote || "",
        sendCutlery: sendCutlery !== false,
        paymentMethod: selectedPaymentMethod,
        zoneId: zoneId || undefined,
        scheduledAt: isScheduled ? new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString() : undefined,
      };
      if (selectedPaymentMethod === "wallet" && walletBalance < total) {
        toast.error(`Insufficient wallet balance. Required: ${R}${total.toFixed(0)}, Available: ${R}${walletBalance.toFixed(0)}`);
        setIsPlacingOrder(false);
        return undefined;
      }
      if (!isScheduled) {
        try {
          const a = await orderAPI.checkRiderAvailability({ restaurantId: finalRestaurantId, zoneId: zoneId || defaultAddress?.zoneId || undefined });
          if (a?.data?.data && a.data.data.available === false) {
            toast.error("All riders are busy, kindly try after some time");
            setIsPlacingOrder(false);
            return undefined;
          }
        } catch (e) {
          const msg = e?.response?.data?.message || e?.message;
          if (msg && msg.toLowerCase().includes("busy")) {
            toast.error("All riders are busy, kindly try after some time");
            setIsPlacingOrder(false);
            return undefined;
          }
        }
      }

      const orderResponse = await orderAPI.createOrder(orderPayload);
      const { order, razorpay } = orderResponse.data.data;

      if (selectedPaymentMethod === "cash" || selectedPaymentMethod === "wallet") {
        toast.success(selectedPaymentMethod === "cash" ? "Order placed with Cash on Delivery" : "Order placed with Wallet payment");
        finishSuccess(order);
        clearNote();
        setIsPlacingOrder(false);
        if (selectedPaymentMethod === "wallet") refreshWallet();
        return undefined;
      }
      if (!razorpay || !razorpay.orderId || !razorpay.key) throw new Error(razorpay ? "Razorpay payment gateway is not configured. Please contact support." : "Failed to initialize payment");

      const userInfo = userProfile || {};
      const formattedPhone = String(recipientPhone || userInfo.phone || defaultAddress?.phone || "").replace(/\D/g, "").slice(-10);
      const company = await getCompanyNameAsync();
      const cancelUnpaid = async (reason) => {
        const cancelId = order?._id || order?.id || order?.orderMongoId;
        if (!cancelId) return false;
        try {
          await orderAPI.cancelOrder(cancelId, { reason });
          return true;
        } catch {
          return false;
        }
      };
      await initRazorpayPayment({
        key: razorpay.key,
        amount: razorpay.amount,
        currency: razorpay.currency || "INR",
        order_id: razorpay.orderId,
        name: company,
        description: `Order ${order._id || order.orderId} - ${R}${(razorpay.amount / 100).toFixed(2)}`,
        prefill: { name: recipientName || userInfo.name || "", email: userInfo.email || "", contact: formattedPhone },
        notes: { orderId: order._id || order.orderId, userId: userInfo.id || "", restaurantId: restaurantId || "unknown" },
        handler: async (response) => {
          try {
            const verifyOrderId = order?._id || order?.id || order?.orderMongoId;
            if (!verifyOrderId) throw new Error("Unable to verify payment: missing order id from create-order response");
            const v = await orderAPI.verifyPayment({
              orderId: verifyOrderId,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            if (!v.data.success) throw new Error(v.data.message || "Payment verification failed");
            finishSuccess(order);
          } catch (error) {
            toast.error(error?.response?.data?.message || error?.response?.data?.error?.message || error?.message || "Payment verification failed. Please contact support.");
          } finally {
            setIsPlacingOrder(false);
          }
        },
        onError: async (error) => {
          await cancelUnpaid("Payment failed or was not completed");
          toast.error(error?.description || error?.message || "Payment failed. Please try again.");
          setIsPlacingOrder(false);
        },
        onClose: async () => {
          const ok = await cancelUnpaid("User closed payment gateway without paying");
          if (ok) toast.info("Payment was not completed. No order has been placed.");
          else toast.warning("Payment was not completed. If you see a pending order, please cancel it manually.");
          setIsPlacingOrder(false);
        },
      });
    } catch (error) {
      let msg = "Failed to create order. Please try again.";
      if (error.code === "ERR_NETWORK" || error.message === "Network Error") msg = "Network Error: Cannot connect to server. Please check your internet connection.";
      else if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) msg = "Request timed out. The server is taking too long to respond. Please try again.";
      else if (error.response) msg = error.response.data?.message || `Server error: ${error.response.status}`;
      else if (error.message) msg = error.message;
      const busy = msg?.toLowerCase?.().includes("all riders are busy") || error?.response?.data?.code === "NO_RIDERS_AVAILABLE" || ["all_riders_busy", "no_online_riders"].includes(error?.response?.data?.data?.reason);
      toast.error(busy ? "All riders are busy, kindly try after some time" : msg);
      setIsPlacingOrder(false);
    }
    return undefined;
  };

  const handleGoToOrders = () => {
    setShowOrderSuccess(false);
    setShowSavingsCongrats(false);
    setOrderSuccessSavingsAmount(0);
    if (placedOrderId) router.replace({ pathname: "/orders/[orderId]", params: { orderId: String(placedOrderId), confirmed: "true" } });
    else router.replace("/orders");
  };

  /* ---------- render ---------- */
  if (cart.length === 0 && !showOrderSuccess && !showSavingsCongrats) {
    return (
      <Screen bg={palette.gray50}>
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={{ padding: 8 }}><ArrowLeft size={16} color={palette.gray700} /></Pressable>
          <Txt weight={600} style={{ fontSize: 16, color: palette.gray800 }}>Cart</Txt>
        </View>
        <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 80, paddingHorizontal: 16 }}>
          <View style={{ width: 96, height: 96, backgroundColor: palette.gray100, borderRadius: 48, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <Utensils size={40} color={palette.gray400} />
          </View>
          <Txt weight={600} style={{ fontSize: 18, color: palette.gray800, marginBottom: 4 }}>Your cart is empty</Txt>
          <Txt weight={400} style={{ fontSize: 14, color: palette.gray500, marginBottom: 16, textAlign: "center" }}>Add items from a restaurant to start a new order</Txt>
          <Button title="Browse Restaurants" rounded="md" onPress={() => router.replace("/")} />
        </View>
      </Screen>
    );
  }

  const addrText = defaultAddress ? formatFullAddress(defaultAddress) || defaultAddress?.formattedAddress || defaultAddress?.address || defaultAddress?.city || "Select address" : "Select address";
  const today = new Date();
  const tomorrow = new Date(Date.now() + 86400000);
  const customTipActive = deliveryTip > 0 && ![10, 20, 30, 50].includes(deliveryTip);

  return (
    <Screen bg="#f8fafc">
      <View style={[styles.header, { justifyContent: "space-between" }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
          <Pressable onPress={handleBack} style={{ padding: 6 }}><ArrowLeft size={16} color={palette.gray700} /></Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt weight={400} style={{ fontSize: 12, color: palette.gray500 }}>{restaurantName}</Txt>
            <Txt weight={500} numberOfLines={1} style={{ fontSize: 14, color: palette.gray800 }}>
              {restaurantData?.estimatedDeliveryTime || "10-15 mins"} to <Txt weight={600} style={{ fontSize: 14 }}>Location</Txt>
              <Txt weight={400} style={{ fontSize: 12, color: palette.gray400 }}> {addrText}</Txt>
            </Txt>
          </View>
        </View>
        <Pressable onPress={handleShare} style={{ padding: 6 }}><Share2 size={16} color={palette.gray800} /></Pressable>
      </View>

      <KeyboardAvoidingView behavior="height" style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 190 + insets.bottom }}>
          {savings > 0 ? (
            <View style={{ backgroundColor: palette.blue100, paddingHorizontal: 16, paddingVertical: 8 }}>
              <Txt weight={500} style={{ fontSize: 14, color: "#1e40af" }}>Saved {R}{savings} on this order</Txt>
            </View>
          ) : null}

          <View style={{ padding: 16, gap: 8 }}>
            {/* Items */}
            <View style={styles.card}>
              <View style={{ gap: 24 }}>
                {cart.map((item, index) => {
                  const stored = Number(item.price) || 0;
                  const orig = Math.max(stored, Number(item.originalPrice) || 0);
                  let display = stored;
                  let best = 0;
                  if (orig <= stored && restaurantData?.itemDiscounts?.length > 0) {
                    const rule = restaurantData.itemDiscounts.find((r) => String(r.itemId) === String(item.itemId || item.id));
                    const dv = Number(rule?.discountValue) || 0;
                    if (rule && dv > 0) best = rule.discountType === "FLAT" ? Math.min(orig, dv) : orig * (dv / 100);
                  }
                  if (orig <= stored) {
                    const mr = (restaurantData?.discountRules || []).find((r) => (r.conditionType === "PRICE_ABOVE" && orig > Number(r.conditionValue)) || (r.conditionType === "PRICE_BELOW" && orig < Number(r.conditionValue)));
                    if (mr) best = Math.max(best, orig * ((Number(mr.discountValue) || 0) / 100));
                  }
                  if (orig <= stored && restaurantData?.discount > 0) best = Math.max(best, orig * (Number(restaurantData.discount) / 100));
                  if (orig <= stored && best > 0) display = Math.max(0, orig - best);
                  const q = item.quantity || 1;
                  return (
                    <View key={item.id}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                        <VegBox isVeg={item.isVeg === true || item.foodType === "Veg"} />
                        <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 16 }}>
                          {item.image ? <AppImage src={item.image} style={styles.itemImg} width={200} /> : null}
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Txt weight={700} numberOfLines={1} style={{ fontSize: 14, color: palette.gray900 }}>{item.name}</Txt>
                            {item.variantName ? (
                              <View style={styles.variantTag}><Txt weight={500} style={{ fontSize: 10, color: palette.gray500 }}>{item.variantName}</Txt></View>
                            ) : null}
                            {item.isCombo && Array.isArray(item.comboItems) && item.comboItems.length > 0 ? (
                              <Txt weight={400} numberOfLines={2} style={{ fontSize: 10, color: palette.gray500, marginTop: 4 }}>
                                <Txt weight={600} style={{ fontSize: 10, color: palette.amber600 }}>Combo:</Txt> {item.comboItems.map((ci) => `${ci.quantity || 1} x ${ci.name}${ci.variantName ? ` (${ci.variantName})` : ""}`).join(", ")}
                              </Txt>
                            ) : null}
                          </View>
                        </View>
                        <View style={{ alignItems: "flex-end", gap: 10 }}>
                          <View style={styles.qty}>
                            <Pressable onPress={() => updateQuantity(item.id, item.quantity - 1)} style={{ paddingHorizontal: 10, paddingVertical: 6 }}><Minus size={14} color={palette.amber600} /></Pressable>
                            <Txt weight={900} style={{ minWidth: 28, textAlign: "center", fontSize: 14, color: palette.amber600 }}>{item.quantity}</Txt>
                            <Pressable onPress={() => updateQuantity(item.id, item.quantity + 1)} style={{ paddingHorizontal: 10, paddingVertical: 6 }}><Plus size={14} color={palette.amber600} /></Pressable>
                          </View>
                          <View style={{ alignItems: "flex-end" }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              {orig > display ? <Txt weight={400} style={{ fontSize: 12, color: palette.gray400, textDecorationLine: "line-through" }}>{R}{(orig * q).toFixed(0)}</Txt> : null}
                              <Txt weight={900} style={{ fontSize: 14, color: palette.gray900 }}>{R}{(display * q).toFixed(0)}</Txt>
                            </View>
                            {orig > display ? (
                              <View style={styles.offBadge}><Txt weight={700} style={{ fontSize: 10, color: palette.green600 }}>{Math.round(((orig - display) / orig) * 100)}% OFF</Txt></View>
                            ) : null}
                          </View>
                        </View>
                      </View>
                      {index < cart.length - 1 ? <View style={{ marginTop: 24, borderBottomWidth: 1, borderStyle: "dashed", borderColor: palette.gray100 }} /> : null}
                    </View>
                  );
                })}
              </View>
              <Pressable onPress={handleBack} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16 }}>
                <Plus size={16} color={palette.amber600} />
                <Txt weight={500} style={{ fontSize: 14, color: palette.amber600 }}>Add more items</Txt>
              </Pressable>
            </View>

            {/* Note & cutlery */}
            <View style={[styles.card, { paddingVertical: 16, flexDirection: "row", gap: 12 }]}>
              <Pressable onPress={() => setShowRestaurantNoteInput(!showRestaurantNoteInput)} style={[styles.outlineBtn, { flex: 1 }]}>
                <Utensils size={16} color={palette.gray600} />
                <Txt weight={400} numberOfLines={1} style={{ fontSize: 14, color: palette.gray600, flex: 1 }}>{restaurantNote || "Add note for restaurant"}</Txt>
              </Pressable>
              <Pressable onPress={() => setSendCutlery(!sendCutlery)} style={[styles.outlineBtn, !sendCutlery && { borderColor: PRIMARY, backgroundColor: "rgba(254,198,0,0.06)" }]}>
                <Utensils size={16} color={sendCutlery ? palette.gray600 : palette.amber600} />
                <Txt weight={400} style={{ fontSize: 14, color: sendCutlery ? palette.gray600 : palette.amber600 }}>{sendCutlery ? "Send cutlery" : "Don't send"}</Txt>
              </Pressable>
            </View>
            {showRestaurantNoteInput ? (
              <View style={[styles.card, { paddingVertical: 12, borderRadius: 12 }]}>
                <Txt weight={500} style={{ fontSize: 12, color: palette.gray500, marginBottom: 8 }}>Restaurant instructions</Txt>
                <TextInput
                  value={restaurantNote}
                  onChangeText={setRestaurantNote}
                  placeholder="Eg. Don't add onions, make it extra spicy, etc."
                  placeholderTextColor={palette.gray400}
                  multiline
                  maxLength={240}
                  textAlignVertical="top"
                  style={[styles.input, { height: 80 }]}
                />
                <View style={{ marginTop: 8, flexDirection: "row", justifyContent: "space-between" }}>
                  <Txt weight={400} style={{ fontSize: 11, color: palette.gray500 }}>Note for restaurant.</Txt>
                  <Txt weight={400} style={{ fontSize: 11, color: palette.gray400 }}>{restaurantNote.length}/240</Txt>
                </View>
              </View>
            ) : null}

            {/* Addons */}
            {addons.length > 0 ? (
              <View style={[styles.card, { paddingVertical: 20 }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <View style={{ width: 24, height: 24, backgroundColor: palette.gray100, borderRadius: 4, alignItems: "center", justifyContent: "center" }}><Sparkles size={16} color={palette.amber600} /></View>
                  <Txt weight={600} style={{ fontSize: 14, color: palette.gray800 }}>Complete your meal with</Txt>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
                  {(loadingAddons ? [] : addons).map((addon) => (
                    <View key={addon.id || addon._id} style={{ width: 112 }}>
                      <View style={{ borderRadius: 8, overflow: "hidden", backgroundColor: palette.gray100 }}>
                        <AppImage src={addon.image || (addon.images && addon.images[0]) || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&h=200&fit=crop"} style={{ width: 112, height: 112 }} width={240} />
                        <View style={{ position: "absolute", top: 4, left: 4, backgroundColor: palette.white, borderRadius: 3 }}><VegBox isVeg size={14} /></View>
                        <Pressable
                          onPress={() => {
                            const rid = cart[0]?.restaurantId || restaurantId;
                            const rname = cart[0]?.restaurant || restaurantName;
                            if (!rid || !rname) return toast.error("Restaurant information is missing. Please refresh the page.");
                            addToCart({ id: addon.id || addon._id, name: addon.name, price: addon.price, image: addon.image || (addon.images && addon.images[0]) || "", description: addon.description || "", isVeg: true, restaurant: rname, restaurantId: rid });
                            return undefined;
                          }}
                          style={styles.addonPlus}
                        >
                          <Plus size={14} color={palette.amber600} />
                        </Pressable>
                      </View>
                      <Txt weight={500} numberOfLines={2} style={{ fontSize: 12, color: palette.gray800, marginTop: 6 }}>{addon.name}</Txt>
                      {addon.description ? <Txt weight={400} numberOfLines={1} style={{ fontSize: 12, color: palette.gray500 }}>{addon.description}</Txt> : null}
                      <Txt weight={600} style={{ fontSize: 12, color: palette.gray800 }}>{R}{addon.price}</Txt>
                    </View>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {/* Coupons */}
            <View style={[styles.card, { padding: 0, overflow: "hidden" }]}>
              {deliveryFee === 0 ? (
                <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderStyle: "dashed", borderColor: palette.gray200, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#f4fcf7" }}>
                  <CheckCircle2 size={20} color={palette.green600} />
                  <Txt weight={600} style={{ fontSize: 14, color: palette.gray800 }}>You saved {R}{feeSettings.deliveryFee || 25} on delivery</Txt>
                </View>
              ) : null}
              {appliedCoupon ? (
                <View style={{ paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <Percent size={20} color={palette.amber600} />
                    <View>
                      <Txt weight={600} style={{ fontSize: 14, color: palette.gray800 }}>'{appliedCoupon.code}' applied</Txt>
                      <Txt weight={500} style={{ fontSize: 12, color: palette.amber600, marginTop: 2 }}>You saved {R}{discount}</Txt>
                    </View>
                  </View>
                  <Pressable onPress={handleRemoveCoupon}><Txt weight={600} style={{ fontSize: 12, color: palette.amber600 }}>REMOVE</Txt></Pressable>
                </View>
              ) : (
                <View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 12 }}>
                  {loadingCoupons ? (
                    <Txt weight={400} style={{ fontSize: 14, color: palette.gray500 }}>Loading offers...</Txt>
                  ) : availableCoupons.length > 0 ? (
                    <CouponRow coupon={availableCoupons[0]} primary subtotal={subtotal} userOrderCount={userOrderCount} onApply={handleApplyCoupon} extra={availableCoupons.length > 1 ? (
                      <Pressable onPress={() => setShowCoupons(!showCoupons)} style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                        <Txt weight={400} style={{ fontSize: 11, color: palette.amber600 }}>View all coupons</Txt>
                        <ChevronRight size={12} color={palette.amber600} />
                      </Pressable>
                    ) : null} />
                  ) : (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <Percent size={20} color={palette.gray400} />
                      <Txt weight={400} style={{ fontSize: 14, color: palette.gray500 }}>No offers available</Txt>
                    </View>
                  )}
                  {showCoupons && availableCoupons.length > 0 ? (
                    <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderStyle: "dashed", borderColor: palette.gray200, gap: 16 }}>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <TextInput value={manualCouponCode} onChangeText={(t) => setManualCouponCode(t.toUpperCase())} placeholder="Enter coupon code" placeholderTextColor={palette.gray400} autoCapitalize="characters" style={[styles.input, { flex: 1, height: 36, paddingVertical: 0 }]} />
                        <Pressable onPress={handleApplyCouponCode} style={styles.applyBtn}><Txt weight={600} style={{ fontSize: 12, color: palette.amber600 }}>APPLY</Txt></Pressable>
                      </View>
                      {availableCoupons.slice(1).map((c) => (
                        <CouponRow key={c.code} coupon={c} subtotal={subtotal} userOrderCount={userOrderCount} onApply={handleApplyCoupon} />
                      ))}
                    </View>
                  ) : null}
                </View>
              )}
            </View>

            {/* Delivery time / schedule */}
            <View style={[styles.card, { paddingVertical: 20 }]}>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Zap size={20} color={palette.green600} />
                <View style={{ flex: 1 }}>
                  <Txt weight={400} style={{ fontSize: 16, color: palette.gray800 }}>
                    Delivery in <Txt weight={700} style={{ fontSize: 16, color: palette.green600 }}>{restaurantData?.estimatedDeliveryTime || "15-20 mins"}</Txt>
                  </Txt>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                    <Txt weight={400} style={{ fontSize: 14, color: palette.gray600 }}>Want this later?</Txt>
                    <Pressable
                      onPress={() => {
                        const next = !isScheduled;
                        setIsScheduled(next);
                        if (next && !scheduledDate) setScheduledDate(toLocalDateStr(new Date()));
                      }}
                    >
                      <Txt weight={500} style={{ fontSize: 14, color: palette.gray600, textDecorationLine: "underline", textDecorationStyle: "dashed" }}>{isScheduled ? "Cancel schedule" : "Schedule it"}</Txt>
                    </Pressable>
                  </View>
                </View>
              </View>
              {isScheduled ? (
                <View style={{ marginTop: 20, paddingTop: 12, borderTopWidth: 1, borderColor: palette.gray100, gap: 12 }}>
                  <View>
                    <Txt weight={400} style={{ fontSize: 12, color: palette.gray500, marginBottom: 4 }}>Date (Up to Tomorrow)</Txt>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {[["Today", today], ["Tomorrow", tomorrow]].map(([label, d]) => {
                        const v = toLocalDateStr(d);
                        const active = scheduledDate === v;
                        return (
                          <Pressable key={label} onPress={() => setScheduledDate(v)} style={[styles.slot, { flex: 1 }, active && styles.slotActive]}>
                            <Txt weight={active ? 700 : 500} style={{ fontSize: 14, color: palette.gray800 }}>{label}</Txt>
                            <Txt weight={400} style={{ fontSize: 11, color: palette.gray500 }}>{d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</Txt>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                  <View>
                    <Txt weight={400} style={{ fontSize: 12, color: palette.gray500, marginBottom: 4 }}>Time</Txt>
                    {availableTimeSlots.length > 0 ? (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                        {availableTimeSlots.map((s) => (
                          <Pressable key={s.value} onPress={() => setScheduledTime(s.value)} style={[styles.slot, scheduledTime === s.value && styles.slotActive]}>
                            <Txt weight={scheduledTime === s.value ? 700 : 500} style={{ fontSize: 13, color: palette.gray800 }}>{s.label}</Txt>
                          </Pressable>
                        ))}
                      </ScrollView>
                    ) : (
                      <View style={[styles.slot, { backgroundColor: palette.gray100 }]}>
                        <Txt weight={400} style={{ fontSize: 14, color: palette.gray500, textAlign: "center" }}>{scheduledDate ? "No slots available" : "Select date first"}</Txt>
                      </View>
                    )}
                  </View>
                </View>
              ) : null}
            </View>

            {/* Address */}
            <View style={[styles.card, { paddingVertical: 20 }]}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                <View style={{ backgroundColor: "rgba(254,198,0,0.1)", padding: 8, borderRadius: 12 }}><MapPin size={20} color={palette.amber600} /></View>
                <View style={{ flex: 1 }}>
                  <Txt weight={400} style={{ fontSize: 14, color: palette.gray800 }}>
                    Delivery at <Txt weight={600} style={{ fontSize: 14 }}>{deliveryAddressMode === "current" ? "Current location" : "Location"}</Txt>
                  </Txt>
                  {deliveryAddressMode === "current" ? (
                    <View style={{ marginTop: 4 }}>
                      <Txt weight={400} numberOfLines={2} style={{ fontSize: 12, color: palette.gray500 }}>
                        {currentLocationLoading || !currentLocationAddress ? "Finding your current address..." : formatFullAddress(currentLocationAddress) || currentLocationAddress?.formattedAddress || "Add delivery address"}
                      </Txt>
                      <View style={styles.gpsTag}><Txt weight={600} style={{ fontSize: 10, color: palette.amber600 }}>GPS enabled</Txt></View>
                    </View>
                  ) : (
                    <Txt weight={400} numberOfLines={2} style={{ fontSize: 14, color: palette.gray500, marginTop: 4, paddingRight: 16 }}>
                      {defaultAddress ? formatFullAddress(defaultAddress) || defaultAddress?.formattedAddress || defaultAddress?.address || "Add delivery address" : "Add delivery address"}
                    </Txt>
                  )}
                  {!hasSavedAddress ? <Txt weight={500} style={{ fontSize: 14, color: palette.amber600, marginTop: 8 }}>Select a delivery location to continue</Txt> : null}
                  {hasSavedAddress && !isCurrentAddressDeliverable ? (
                    <View style={styles.undeliverable}>
                      <AlertTriangle size={20} color={palette.red600} />
                      <View style={{ flex: 1 }}>
                        <Txt weight={700} style={{ fontSize: 14, color: palette.red600 }}>Unable to deliver to this address</Txt>
                        <Txt weight={400} style={{ fontSize: 12, color: palette.red600, marginTop: 2 }}>{currentAddressDeliverability.reason || "This restaurant cannot deliver to this address because it is outside their delivery zone. Please choose a nearby address."}</Txt>
                      </View>
                    </View>
                  ) : null}
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                    {["Home", "Work", "Other"].map((label) => {
                      const m = addresses.find((a) => normalizeAddressLabel(a.label) === normalizeAddressLabel(label));
                      const d = m && restaurantData ? addressDeliverabilityMap.get(getAddressId(m)) || checkAddressDeliverability(m, restaurantData) : { isDeliverable: true };
                      const ok = Boolean(m) && d.isDeliverable;
                      return (
                        <Pressable
                          key={label}
                          onPress={() => (m ? handleSelectAddressByLabel(label) : toast.error(`No ${label} address found. Please add an address first.`))}
                          style={[styles.labelChip, !m ? { backgroundColor: palette.gray50, borderColor: palette.gray100 } : !ok ? { backgroundColor: palette.red50, borderColor: "#fecaca" } : { backgroundColor: palette.slate100, borderColor: palette.slate100 }]}
                        >
                          <Txt weight={600} style={{ fontSize: 12, color: !m ? palette.gray400 : !ok ? palette.red600 : "#334155" }}>{label}{m && !ok ? " (Unable to deliver)" : ""}</Txt>
                        </Pressable>
                      );
                    })}
                  </View>
                  {addresses.length > 0 ? (
                    <View style={{ marginTop: 16, gap: 12 }}>
                      {addresses.map((address) => {
                        const id = getAddressId(address);
                        const sel = id && id === selectedAddressId;
                        const d = addressDeliverabilityMap.get(id) || checkAddressDeliverability(address, restaurantData);
                        const ok = d.isDeliverable;
                        return (
                          <Pressable
                            key={id || `${address.label}-${address.street}-${address.city}`}
                            onPress={() => handleSelectSavedAddress(address)}
                            style={[styles.addrCard, sel && !ok ? { borderColor: palette.red500, backgroundColor: "rgba(254,242,242,0.3)" } : sel ? { borderColor: PRIMARY, backgroundColor: "rgba(254,198,0,0.04)" } : !ok ? { borderColor: "rgba(254,202,202,0.7)" } : null]}
                          >
                            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                  <Txt weight={700} style={{ fontSize: 14, color: palette.gray900 }}>{getDisplayAddressLabel(address.label)}</Txt>
                                  {!ok ? <View style={{ backgroundColor: palette.red100, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}><Txt weight={700} style={{ fontSize: 10, color: "#b91c1c" }}>Unable to deliver</Txt></View> : null}
                                </View>
                                <Txt weight={400} numberOfLines={2} style={{ fontSize: 12, color: palette.gray500, marginTop: 4 }}>{formatFullAddress(address) || address.address || "Address details"}</Txt>
                                {!ok ? <Txt weight={500} style={{ fontSize: 11, color: palette.red500, marginTop: 6 }}>⚠️ Unable to deliver here {d.distanceKm ? `(${d.distanceKm.toFixed(0)} km away)` : "(Out of delivery area)"}</Txt> : null}
                              </View>
                              {sel ? (
                                <View style={{ alignSelf: "flex-start", backgroundColor: ok ? PRIMARY : palette.red600, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                                  <Txt weight={700} style={{ fontSize: 10, color: ok ? palette.black : palette.white, letterSpacing: 1 }}>SELECTED</Txt>
                                </View>
                              ) : null}
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
                <Pressable onPress={openLocationSelector} style={{ padding: 8, backgroundColor: "rgba(254,198,0,0.08)", borderRadius: 999 }}><ChevronRight size={20} color={palette.amber600} /></Pressable>
              </View>
            </View>

            {/* Contact */}
            <View style={[styles.card, { paddingVertical: 16 }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                <View style={{ flexDirection: "row", gap: 12, flex: 1, minWidth: 0 }}>
                  <Phone size={16} color={palette.gray500} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Txt weight={500} style={{ fontSize: 14, color: palette.gray800 }}>{recipientName}, <Txt weight={600} style={{ fontSize: 14 }}>{recipientPhone || "+91-XXXXXXXXXX"}</Txt></Txt>
                    <Txt weight={400} style={{ fontSize: 12, color: palette.gray500, marginTop: 4 }}>Order recipient details</Txt>
                  </View>
                </View>
                <Pressable onPress={() => setIsEditingRecipient((p) => !p)}><Txt weight={600} style={{ fontSize: 12, color: palette.amber600 }}>{isEditingRecipient ? "Done" : "Change"}</Txt></Pressable>
              </View>
              {isEditingRecipient ? (
                <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderStyle: "dashed", borderColor: palette.gray200, gap: 12 }}>
                  <View>
                    <Txt weight={500} style={{ fontSize: 12, color: palette.gray500, marginBottom: 6 }}>Name</Txt>
                    <TextInput value={recipientDetails.name} onChangeText={(t) => setRecipientDetails((p) => ({ ...p, name: t }))} placeholder="Enter recipient name" placeholderTextColor={palette.gray400} style={[styles.input, { borderRadius: 12 }]} />
                  </View>
                  <View>
                    <Txt weight={500} style={{ fontSize: 12, color: palette.gray500, marginBottom: 6 }}>Phone Number</Txt>
                    <TextInput value={recipientDetails.phone} onChangeText={(t) => setRecipientDetails((p) => ({ ...p, phone: sanitizeRecipientPhone(t) }))} keyboardType="phone-pad" placeholder="Enter recipient phone" placeholderTextColor={palette.gray400} style={[styles.input, { borderRadius: 12 }]} />
                  </View>
                  <Txt weight={400} style={{ fontSize: 11, color: palette.gray500 }}>Agar aap kisi aur ke liye order kar rahe ho, to yahan uska naam aur phone save kar do.</Txt>
                </View>
              ) : null}
            </View>

            {/* Tip */}
            <View style={[styles.card, { paddingVertical: 16, gap: 12 }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ padding: 8, backgroundColor: "#fff1f2", borderRadius: 12 }}><Heart size={20} color="#f43f5e" fill="#f43f5e" /></View>
                <View style={{ flex: 1 }}>
                  <Txt weight={700} style={{ fontSize: 14, color: palette.gray900 }}>Tip your delivery partner</Txt>
                  <Txt weight={400} style={{ fontSize: 12, color: palette.gray500 }}>100% of your tip goes directly to your delivery partner</Txt>
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                {[10, 20, 30, 50].map((amt) => {
                  const sel = deliveryTip === amt;
                  return (
                    <Pressable
                      key={amt}
                      onPress={() => {
                        setDeliveryTip(sel ? 0 : amt);
                        setShowCustomTip(false);
                      }}
                      style={[styles.tipChip, sel && { backgroundColor: palette.orange500, borderColor: palette.orange500 }]}
                    >
                      <Txt weight={700} style={{ fontSize: 12, color: sel ? palette.white : palette.gray700 }}>{R}{amt}</Txt>
                    </Pressable>
                  );
                })}
                <Pressable onPress={() => setShowCustomTip(!showCustomTip)} style={[styles.tipChip, (showCustomTip || customTipActive) && { backgroundColor: PRIMARY, borderColor: PRIMARY }]}>
                  <Txt weight={700} style={{ fontSize: 12, color: showCustomTip || customTipActive ? palette.black : palette.gray700 }}>{customTipActive ? `${R}${deliveryTip} (Custom)` : "Custom"}</Txt>
                </Pressable>
                {deliveryTip > 0 ? (
                  <Pressable
                    onPress={() => {
                      setDeliveryTip(0);
                      setCustomTipInput("");
                      setShowCustomTip(false);
                    }}
                    style={{ marginLeft: "auto" }}
                  >
                    <Txt weight={600} style={{ fontSize: 12, color: "#f43f5e" }}>Clear Tip</Txt>
                  </Pressable>
                ) : null}
              </View>
              {showCustomTip ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ flex: 1, justifyContent: "center" }}>
                    <Txt weight={700} style={{ position: "absolute", left: 12, fontSize: 14, color: palette.gray500, zIndex: 1 }}>{R}</Txt>
                    <TextInput
                      keyboardType="number-pad"
                      placeholder="Enter tip amount"
                      placeholderTextColor={palette.gray400}
                      value={customTipInput}
                      onChangeText={(v) => {
                        const clean = v.replace(/[^\d]/g, "").slice(0, 4);
                        setCustomTipInput(clean);
                        setDeliveryTip(Math.min(1000, Math.max(0, parseInt(clean, 10) || 0)));
                      }}
                      style={[styles.input, { paddingLeft: 28, height: 36, paddingVertical: 0, borderRadius: 12, backgroundColor: palette.gray50, fontSize: 12 }]}
                    />
                  </View>
                  <Pressable onPress={() => setShowCustomTip(false)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: palette.gray100 }}>
                    <Txt weight={700} style={{ fontSize: 12, color: palette.gray700 }}>Done</Txt>
                  </Pressable>
                </View>
              ) : null}
            </View>

            {/* Bill */}
            <View style={[styles.card, { paddingVertical: 20 }]}>
              <Pressable onPress={() => setShowBillDetails(!showBillDetails)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                  <FileText size={20} color={palette.gray500} />
                  <View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <Txt weight={700} style={{ fontSize: 16, color: palette.green600 }}>To Pay</Txt>
                      {platformPricingSavings.hasPlatformPricing ? <Txt weight={500} style={{ fontSize: 16, color: palette.gray400, textDecorationLine: "line-through" }}>{R}{platformPricingSavings.totalPlatformPriceWithGst.toFixed(2)}</Txt> : null}
                      <Txt weight={700} style={{ fontSize: 16, color: palette.green600 }}>{R}{total.toFixed(2)}</Txt>
                    </View>
                    <Txt weight={400} style={{ fontSize: 12, color: palette.gray500, marginTop: 4 }}>Incl. taxes and charges</Txt>
                  </View>
                </View>
                <ChevronRight size={20} color={palette.gray400} style={{ transform: [{ rotate: showBillDetails ? "90deg" : "0deg" }] }} />
              </Pressable>
              {showBillDetails ? (
                <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderStyle: "dashed", borderColor: palette.gray200, gap: 12 }}>
                  <BillRow label="Item Total" value={`${R}${subtotal.toFixed(2)}`} />
                  {cashlessSavings > 0 && !isCodSelected ? (
                    <View style={styles.cashlessOk}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Sparkles size={14} color={palette.emerald600} />
                        <Txt weight={600} style={{ fontSize: 12, color: palette.emerald600 }}>Online payment price applied</Txt>
                      </View>
                      <Txt weight={600} style={{ fontSize: 12, color: palette.emerald600 }}>You save {R}{cashlessSavings.toFixed(2)}</Txt>
                    </View>
                  ) : null}
                  {cashlessSavings > 0 && isCodSelected ? (
                    <View style={styles.cashlessHint}>
                      <Txt weight={400} style={{ fontSize: 12, color: "#92400e", flex: 1 }}>💡 Save {R}{Number.isInteger(cashlessSavings) ? cashlessSavings : cashlessSavings.toFixed(2)} with Cashless Payment</Txt>
                      <Pressable onPress={() => setSelectedPaymentMethod("razorpay")}><Txt weight={700} style={{ fontSize: 12, color: palette.amber600, textDecorationLine: "underline" }}>Pay Online</Txt></Pressable>
                    </View>
                  ) : null}
                  {deliveryTip > 0 ? (
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Heart size={14} color="#f43f5e" fill="#f43f5e" />
                        <Txt weight={400} style={{ fontSize: 14, color: palette.gray600 }}>Delivery Partner Tip</Txt>
                      </View>
                      <Txt weight={500} style={{ fontSize: 14, color: palette.gray800 }}>{R}{Number(deliveryTip).toFixed(2)}</Txt>
                    </View>
                  ) : null}
                  <BillRow label="Delivery Fee" value={deliveryFee === 0 ? "FREE" : `${R}${deliveryFee.toFixed(2)}`} valueColor={deliveryFee === 0 ? palette.amber600 : undefined} />
                  {deliveryFeeBreakdownText ? (
                    <View style={{ marginTop: -6, marginLeft: 4, borderLeftWidth: 2, borderColor: palette.gray100, paddingLeft: 8 }}>
                      <Txt weight={400} style={{ fontSize: 11, color: palette.gray500 }}>{deliveryFeeBreakdownText}</Txt>
                    </View>
                  ) : null}
                  {Number((pricing?.freeDeliveryUpTo ?? feeSettings.freeDeliveryUpTo) || 0) > 0 ? (
                    <View style={styles.freeDelivery}>
                      <Sparkles size={12} color={palette.amber600} />
                      <Txt weight={600} style={{ fontSize: 11, color: palette.amber600 }}>Free delivery at</Txt>
                      <Txt weight={600} style={{ fontSize: 11, color: palette.gray900 }}>{R}{Number((pricing?.freeDeliveryUpTo ?? feeSettings.freeDeliveryUpTo) || 0).toFixed(0)}+</Txt>
                    </View>
                  ) : null}
                  <BillRow label="Platform Fee" value={`${R}${platformFee.toFixed(2)}`} />
                  <BillRow label="Packaging Charges" value={`${R}${packagingFee.toFixed(2)}`} />
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Pressable onPress={() => setShowGstModal(true)}>
                      <Txt weight={400} style={{ fontSize: 14, color: palette.gray600, textDecorationLine: "underline", textDecorationStyle: "dashed" }}>GST</Txt>
                    </Pressable>
                    <Txt weight={500} style={{ fontSize: 14, color: palette.gray800 }}>{R}{gstCharges.toFixed(2)}</Txt>
                  </View>
                  {couponDiscount > 0 ? <BillRow label="Coupon Discount" value={`-${R}${couponDiscount.toFixed(2)}`} labelColor={palette.amber600} valueColor={palette.amber600} /> : null}
                  {platformPricingSavings.hasPlatformPricing ? (
                    <View style={styles.platformBox}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Sparkles size={16} color={palette.amber600} />
                          <Txt weight={600} style={{ fontSize: 14, color: palette.amber600 }}>Other platform total</Txt>
                        </View>
                        <Txt weight={500} style={{ fontSize: 14, color: palette.gray700 }}>{R}{platformPricingSavings.totalPlatformPrice.toFixed(2)}</Txt>
                      </View>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Txt weight={400} style={{ fontSize: 12, color: palette.gray600 }}>GST on other platforms</Txt>
                        <Txt weight={500} style={{ fontSize: 12, color: palette.gray600 }}>{R}{platformPricingSavings.totalPlatformGst.toFixed(2)}</Txt>
                      </View>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Txt weight={600} style={{ fontSize: 14, color: palette.gray800 }}>Other platform total (incl. GST)</Txt>
                        <Txt weight={600} style={{ fontSize: 14, color: palette.gray800 }}>{R}{platformPricingSavings.totalPlatformPriceWithGst.toFixed(2)}</Txt>
                      </View>
                      {platformPricingSavings.items.length > 0 ? (
                        <View style={{ borderTopWidth: 1, borderColor: "rgba(254,198,0,0.15)", paddingTop: 8, gap: 4 }}>
                          {platformPricingSavings.items.slice(0, 2).map((it, i) => (
                            <View key={i} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                              <Txt weight={400} style={{ fontSize: 12, color: palette.gray600 }}>{it.name} x{it.quantity}</Txt>
                              <Txt weight={500} style={{ fontSize: 12, color: palette.amber600 }}>-{R}{it.savings.toFixed(0)}</Txt>
                            </View>
                          ))}
                          {platformPricingSavings.items.length > 2 ? <Txt weight={600} style={{ fontSize: 12, color: palette.amber600, textAlign: "center" }}>+{platformPricingSavings.items.length - 2} more items</Txt> : null}
                        </View>
                      ) : null}
                      <View style={styles.saveApprox}>
                        <Txt weight={700} style={{ fontSize: 12, color: "#065f46" }}>You save approx</Txt>
                        <Txt weight={700} style={{ fontSize: 12, color: "#065f46" }}>{R}{platformPricingSavings.totalSavings.toFixed(0)} ({platformPricingSavings.savingsPercentage}%)</Txt>
                      </View>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>

            <View style={{ backgroundColor: palette.gray50, paddingHorizontal: 16, paddingVertical: 16, borderRadius: 16 }}>
              <Txt weight={700} style={{ fontSize: 15, color: palette.gray400, marginBottom: 2 }}>Cancellation policy:</Txt>
              <Txt weight={400} style={{ fontSize: 13, color: palette.gray400, lineHeight: 18 }}>Please double-check your order and address details.{"\n"}Orders are non-refundable once placed.</Txt>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom sticky */}
      <View style={[styles.bottomBar, { paddingBottom: 12 + insets.bottom }]}>
        <Pressable onPress={() => setShowPaymentSheet(true)} style={styles.payWith}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={styles.payIcon}>
              {selectedPaymentMethod === "wallet" ? <Wallet size={20} color={palette.amber600} /> : selectedPaymentMethod === "razorpay" ? <Zap size={20} color={palette.amber600} /> : <Banknote size={20} color={palette.amber600} />}
            </View>
            <View>
              <Txt weight={700} style={{ fontSize: 10, color: palette.gray500, letterSpacing: 1, opacity: 0.8 }}>PAYING WITH</Txt>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Txt weight={700} style={{ fontSize: 14, color: palette.gray800 }}>{selectedPaymentLabel}</Txt>
                {selectedPaymentMethod === "wallet" ? <View style={{ backgroundColor: palette.green50, paddingHorizontal: 4, borderRadius: 4 }}><Txt weight={700} style={{ fontSize: 10, color: palette.green600 }}>{R}{walletBalance.toFixed(0)}</Txt></View> : null}
              </View>
            </View>
          </View>
          <View style={styles.changeBtn}>
            <Txt weight={700} style={{ fontSize: 11, color: palette.orange600, letterSpacing: 2 }}>CHANGE</Txt>
            <ChevronRight size={14} color={palette.orange600} />
          </View>
        </Pressable>
        <Pressable onPress={handlePlaceOrder} disabled={isPlacingOrder || (selectedPaymentMethod === "wallet" && walletBalance < total)} style={[styles.placeBtn, (isPlacingOrder || (selectedPaymentMethod === "wallet" && walletBalance < total)) && { opacity: 0.5 }]}>
          <View style={{ borderRightWidth: 1.5, borderColor: "rgba(255,255,255,0.2)", paddingRight: 16 }}>
            <Txt weight={600} style={{ fontSize: 12, color: "rgba(255,255,255,0.9)" }}>{R}{total.toFixed(2)}</Txt>
            <Txt weight={700} style={{ fontSize: 9, color: "rgba(255,255,255,0.8)", letterSpacing: 1, marginTop: -2 }}>TOTAL</Txt>
          </View>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 }}>
            <Txt weight={700} style={{ fontSize: 14, color: palette.white, letterSpacing: 0.5 }}>{isPlacingOrder ? "Processing..." : !hasSavedAddress ? "Select Address" : "Place Order"}</Txt>
            <ChevronRight size={16} color={palette.white} />
          </View>
        </Pressable>
      </View>

      {/* Payment sheet */}
      <BottomSheet visible={showPaymentSheet} onClose={() => setShowPaymentSheet(false)} maxHeightRatio={0.82}>
        <View style={{ padding: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <View>
              <Txt weight={800} style={{ fontSize: 20, color: palette.gray900 }}>Payment Method</Txt>
              <Txt weight={700} style={{ fontSize: 11, color: palette.gray400, marginTop: 4 }}>SELECT HOW YOU WANT TO PAY</Txt>
            </View>
            <Pressable onPress={() => setShowPaymentSheet(false)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: palette.gray100, alignItems: "center", justifyContent: "center" }}><X size={16} color={palette.gray500} /></Pressable>
          </View>
          <View style={{ gap: 12 }}>
            {[
              { id: "razorpay", name: "Online Payment", description: "UPI, Cards, Netbanking", Icon: Zap, bg: "#ecfdf5", fg: palette.emerald600, badge: "SECURE", priceHint: modeItemTotals ? `Item total ${R}${modeItemTotals.prepaid.toFixed(2)}` : null },
              { id: "wallet", name: "Quick Wallet", description: "Pay from your wallet", Icon: Wallet, bg: palette.blue50, fg: palette.blue600, subInfo: `Bal: ${R}${walletBalance.toFixed(0)}`, disabled: walletBalance < total, disabledText: "Low Balance", priceHint: modeItemTotals ? `Item total ${R}${modeItemTotals.prepaid.toFixed(2)}` : null },
              { id: "cash", name: "Cash on Delivery", description: "Pay when order arrives", Icon: Banknote, bg: palette.orange50, fg: palette.orange600, hidden: isCodHidden, priceHint: modeItemTotals ? `Item total ${R}${modeItemTotals.cod.toFixed(2)}` : null },
            ]
              .filter((o) => !o.hidden)
              .map((o) => {
                const sel = selectedPaymentMethod === o.id;
                return (
                  <Pressable
                    key={o.id}
                    onPress={() => {
                      if (o.disabled) return;
                      setSelectedPaymentMethod(o.id);
                      setShowPaymentSheet(false);
                    }}
                    style={[styles.payOpt, sel && { borderColor: palette.orange500, backgroundColor: "rgba(255,247,237,0.5)" }, o.disabled && { opacity: 0.4 }]}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 14, flex: 1 }}>
                      <View style={{ width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: o.bg }}><o.Icon size={20} color={o.fg} /></View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Txt weight={700} style={{ fontSize: 14, color: palette.gray900 }}>{o.name}</Txt>
                          {o.badge ? <View style={{ backgroundColor: "#d1fae5", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999 }}><Txt weight={900} style={{ fontSize: 9, color: "#047857", letterSpacing: 1 }}>{o.badge}</Txt></View> : null}
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                          <Txt weight={400} style={{ fontSize: 12, color: palette.gray500 }}>{o.description}</Txt>
                          {o.subInfo && !o.disabled ? <Txt weight={700} style={{ fontSize: 11, color: palette.emerald600 }}>• {o.subInfo}</Txt> : null}
                        </View>
                        {o.priceHint ? <Txt weight={600} style={{ fontSize: 11, color: palette.gray700, marginTop: 2 }}>{o.priceHint}</Txt> : null}
                        {o.disabled ? <Txt weight={700} style={{ fontSize: 10, color: palette.red500, marginTop: 4, letterSpacing: 0.5 }}>{o.disabledText.toUpperCase()}</Txt> : null}
                      </View>
                    </View>
                    <View style={[styles.radio, sel && { backgroundColor: palette.orange500, borderColor: palette.orange500 }]}>{sel ? <Check size={14} color={palette.white} strokeWidth={3.5} /> : null}</View>
                  </Pressable>
                );
              })}
          </View>
          <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderColor: palette.gray100, flexDirection: "row", alignItems: "center", gap: 16 }}>
            <View>
              <Txt weight={700} style={{ fontSize: 10, color: palette.gray400, letterSpacing: 2, marginBottom: 4 }}>TOTAL PAY</Txt>
              <Txt weight={900} style={{ fontSize: 20, color: palette.gray900 }}>{R}{total.toFixed(0)}</Txt>
            </View>
            <Pressable onPress={() => setShowPaymentSheet(false)} style={[styles.placeBtn, { flex: 1, height: 48, borderRadius: 12, justifyContent: "center" }]}>
              <Txt weight={700} style={{ fontSize: 14, color: palette.white }}>Confirm Order</Txt>
            </Pressable>
          </View>
        </View>
      </BottomSheet>

      {/* GST modal */}
      <BottomSheet visible={showGstModal} onClose={() => setShowGstModal(false)} position="center">
        <View style={{ padding: 20, width: Math.min(320, SW * 0.9) }}>
          <Txt weight={400} style={{ fontSize: 13, color: palette.gray600, lineHeight: 20, marginBottom: 16 }}>{companyName} has no role to play in taxes levied by the govt.</Txt>
          <View style={{ gap: 12 }}>
            <BillRow label="GST on item total" value={`${R}${gstOnItemTotal.toFixed(2)}`} small />
            {gstOnPackagingFee > 0 ? <BillRow label="GST on restaurant packaging charges" value={`${R}${gstOnPackagingFee.toFixed(2)}`} small /> : null}
            {gstOnDeliveryFee > 0 ? <BillRow label="GST on delivery partner fee" value={`${R}${gstOnDeliveryFee.toFixed(2)}`} small /> : null}
            {gstOnPlatformFee > 0 ? <BillRow label="GST on platform fee" value={`${R}${gstOnPlatformFee.toFixed(2)}`} small /> : null}
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 12, borderTopWidth: 1, borderColor: palette.gray100 }}>
              <Txt weight={700} style={{ fontSize: 14, color: palette.gray900 }}>Total</Txt>
              <Txt weight={700} style={{ fontSize: 14, color: palette.gray900 }}>{R}{gstCharges.toFixed(2)}</Txt>
            </View>
          </View>
        </View>
        <Pressable onPress={() => setShowGstModal(false)} style={{ paddingVertical: 12, borderTopWidth: 1, borderColor: palette.gray100, alignItems: "center" }}>
          <Txt weight={600} style={{ fontSize: 14, color: palette.amber600 }}>OKAY</Txt>
        </Pressable>
      </BottomSheet>

      {/* Savings congrats */}
      {showSavingsCongrats ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "#ecfdf5", alignItems: "center", justifyContent: "center", zIndex: 70 }]}>
          <Confetti count={40} colors={["#22c55e", "#10b981", "#34d399", "#6ee7b7"]} />
          <View style={{ alignItems: "center", paddingHorizontal: 24 }}>
            <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: palette.yellow400, alignItems: "center", justifyContent: "center", marginBottom: 32, elevation: 8 }}>
              <Txt style={{ fontSize: 48 }}>🎉</Txt>
            </View>
            <Txt weight={700} style={{ fontSize: 36, color: palette.gray900, marginBottom: 16, textAlign: "center" }}>Congratulations!</Txt>
            <Txt weight={400} style={{ fontSize: 18, color: palette.gray600, marginBottom: 8 }}>You saved approx</Txt>
            <Txt weight={700} style={{ fontSize: 48, color: palette.green600, marginBottom: 16 }}>{R}{congratsSavingsAmount.toFixed(0)}</Txt>
            <Txt weight={400} style={{ fontSize: 16, color: palette.gray600 }}>{congratsSavingsPercentage}% cheaper than other platforms</Txt>
            {congratsSavingsItems.length > 0 ? (
              <View style={{ marginTop: 32, backgroundColor: palette.white, borderRadius: 8, padding: 16, borderWidth: 1, borderColor: "#bbf7d0", minWidth: 260 }}>
                <Txt weight={600} style={{ fontSize: 14, color: palette.gray700, marginBottom: 12, textAlign: "center" }}>Savings on your items:</Txt>
                {congratsSavingsItems.slice(0, 3).map((it, i) => (
                  <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                    <Txt weight={400} style={{ fontSize: 14, color: palette.gray600 }}>{it.name}</Txt>
                    <Txt weight={600} style={{ fontSize: 14, color: palette.green600 }}>-{R}{it.savings.toFixed(0)}</Txt>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* Order success */}
      {showOrderSuccess ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.white, alignItems: "center", justifyContent: "center", zIndex: 70 }]}>
          <Confetti count={50} colors={[PRIMARY, "#3b82f6", "#f59e0b", "#ef4444", "#111827", "#ec4899"]} size={12} round={false} />
          <View style={{ alignItems: "center", paddingHorizontal: 24 }}>
            <View style={{ width: 128, height: 128, borderRadius: 64, backgroundColor: palette.green500, alignItems: "center", justifyContent: "center", marginBottom: 32, elevation: 10 }}>
              <Svg width={64} height={64} viewBox="0 0 24 24" fill="none" stroke={palette.white} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M5 12l5 5L19 7" />
              </Svg>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <MapPin size={20} color={palette.red500} fill={palette.red500} />
              <Txt weight={700} style={{ fontSize: 24, color: palette.gray900 }}>{defaultAddress?.city || "Your Location"}</Txt>
            </View>
            <Txt weight={400} style={{ fontSize: 16, color: palette.gray500, textAlign: "center" }}>{defaultAddress ? formatFullAddress(defaultAddress) || defaultAddress?.formattedAddress || defaultAddress?.address || "Delivery Address" : "Delivery Address"}</Txt>
            <View style={{ marginTop: 48, alignItems: "center" }}>
              <Txt weight={700} style={{ fontSize: 30, color: palette.amber600, marginBottom: 8 }}>Order Placed!</Txt>
              <Txt weight={400} style={{ fontSize: 16, color: palette.gray600 }}>Your delicious food is on its way</Txt>
              {orderSuccessSavingsAmount > 0 ? <Txt weight={400} style={{ marginTop: 8, fontSize: 14, color: palette.amber600 }}>You save approx {R}{orderSuccessSavingsAmount.toFixed(0)} on this order</Txt> : null}
            </View>
            <Pressable onPress={handleGoToOrders} style={styles.trackBtn}>
              <Txt weight={600} style={{ fontSize: 16, color: palette.black }}>Track Your Order</Txt>
            </Pressable>
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

function CouponRow({ coupon, primary, subtotal, userOrderCount, onApply, extra }) {
  const disabled = subtotal < coupon.minOrder || (coupon.customerGroup === "new" && userOrderCount > 0);
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
      <View style={{ flexDirection: "row", gap: 12, flex: 1 }}>
        <Percent size={20} color={palette.gray700} style={{ opacity: primary ? 1 : 0.5, marginTop: 2 }} />
        <View style={{ flex: 1 }}>
          <Txt weight={600} style={{ fontSize: 14, color: palette.gray800, marginBottom: 2 }}>{coupon.discountDisplay || `Save ${R}${coupon.discount}`} with '{coupon.code}'</Txt>
          {coupon.customerGroup === "new" ? (
            <Txt weight={400} style={{ fontSize: 11, color: palette.amber600 }}>First-time users only</Txt>
          ) : subtotal < coupon.minOrder ? (
            <Txt weight={500} numberOfLines={1} style={{ fontSize: 12, color: palette.blue600 }}>Add items worth {R}{(coupon.minOrder - subtotal).toFixed(0)} more to unlock</Txt>
          ) : !primary ? (
            <Txt weight={400} numberOfLines={1} style={{ fontSize: 12, color: palette.gray500 }}>{coupon.description}</Txt>
          ) : null}
          {extra}
        </View>
      </View>
      <Pressable disabled={disabled} onPress={() => onApply(coupon)} style={[styles.applyBtn, { height: 30, marginLeft: 8 }, !primary && { borderColor: palette.gray300 }, disabled && { opacity: 0.5 }]}>
        <Txt weight={600} style={{ fontSize: 12, letterSpacing: 1, color: primary ? palette.amber600 : palette.gray600 }}>APPLY</Txt>
      </Pressable>
    </View>
  );
}

function BillRow({ label, value, valueColor, labelColor, small }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
      <Txt weight={labelColor ? 500 : 400} style={{ fontSize: small ? 13 : 14, color: labelColor || (small ? palette.gray800 : palette.gray600), flex: 1 }}>{label}</Txt>
      <Txt weight={500} style={{ fontSize: small ? 13 : 14, color: valueColor || palette.gray800 }}>{value}</Txt>
    </View>
  );
}

// Web route `cart` is not wrapped in ProtectedRoute — same here.
export default CartScreen;

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: palette.white, borderBottomWidth: 1, borderColor: palette.gray200 },
  card: { backgroundColor: palette.white, paddingHorizontal: 16, paddingVertical: 16, borderRadius: 16, borderWidth: 1, borderColor: palette.slate100, elevation: 1 },
  itemImg: { width: 64, height: 64, borderRadius: 16, borderWidth: 1, borderColor: palette.gray100 },
  variantTag: { alignSelf: "flex-start", marginTop: 4, backgroundColor: palette.gray50, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  qty: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "rgba(254,198,0,0.4)", borderRadius: 8, backgroundColor: palette.white, elevation: 1 },
  offBadge: { marginTop: 4, backgroundColor: palette.green50, borderWidth: 1, borderColor: "#bbf7d0", paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },
  outlineBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: palette.gray200, borderRadius: 8 },
  input: { borderWidth: 1, borderColor: palette.gray200, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontFamily: fonts.regular, fontSize: 14, color: palette.gray900, backgroundColor: palette.white },
  addonPlus: { position: "absolute", bottom: 4, right: 4, width: 24, height: 24, backgroundColor: palette.white, borderWidth: 1, borderColor: PRIMARY, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  applyBtn: { borderWidth: 1, borderColor: PRIMARY, borderRadius: 4, paddingHorizontal: 12, height: 36, alignItems: "center", justifyContent: "center", backgroundColor: palette.white },
  slot: { borderWidth: 1, borderColor: palette.gray300, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8, alignItems: "center", backgroundColor: palette.white },
  slotActive: { borderColor: PRIMARY, backgroundColor: "rgba(254,198,0,0.12)" },
  gpsTag: { marginTop: 4, alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: "rgba(254,198,0,0.06)", borderWidth: 1, borderColor: "rgba(254,198,0,0.3)" },
  undeliverable: { marginTop: 12, padding: 12, backgroundColor: palette.red50, borderWidth: 1, borderColor: "#fca5a5", borderRadius: 12, flexDirection: "row", gap: 10 },
  labelChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  addrCard: { borderRadius: 12, borderWidth: 2, borderColor: palette.slate100, padding: 12 },
  tipChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: palette.gray200, backgroundColor: palette.gray50 },
  cashlessOk: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#ecfdf5", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: "rgba(167,243,208,0.5)" },
  cashlessHint: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 12, backgroundColor: "#fffbeb", borderWidth: 1, borderColor: "rgba(253,230,138,0.6)" },
  freeDelivery: { alignSelf: "flex-start", marginTop: -6, flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, backgroundColor: "rgba(254,198,0,0.15)", borderWidth: 1, borderColor: "rgba(254,198,0,0.25)", paddingHorizontal: 10, paddingVertical: 4 },
  platformBox: { borderRadius: 8, backgroundColor: "rgba(254,198,0,0.08)", borderWidth: 1, borderColor: "rgba(254,198,0,0.2)", padding: 12, gap: 8, marginTop: 8, overflow: "hidden" },
  saveApprox: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#ecfdf5", borderWidth: 1, borderColor: "#a7f3d0", paddingHorizontal: 10, paddingVertical: 6, marginHorizontal: -12, marginBottom: -12 },
  bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: palette.white, borderTopWidth: 1, borderColor: palette.gray200, paddingHorizontal: 16, paddingTop: 12, gap: 12, elevation: 12 },
  payWith: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 8, backgroundColor: palette.gray50, borderRadius: 12, borderWidth: 1, borderColor: palette.gray100 },
  payIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: "rgba(254,198,0,0.12)", alignItems: "center", justifyContent: "center" },
  changeBtn: { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: palette.orange50, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  placeBtn: { flexDirection: "row", alignItems: "center", backgroundColor: palette.orange500, paddingHorizontal: 24, height: 48, borderRadius: 16, elevation: 6, shadowColor: palette.orange500, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  payOpt: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderRadius: 16, borderWidth: 2, borderColor: "rgba(229,231,235,0.8)", backgroundColor: palette.white },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: palette.gray300, alignItems: "center", justifyContent: "center" },
  trackBtn: { marginTop: 40, backgroundColor: PRIMARY, paddingVertical: 16, paddingHorizontal: 48, borderRadius: 12, elevation: 6 },
});
