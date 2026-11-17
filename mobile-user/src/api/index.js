/**
 * API layer — user-scope subset of web services/api/index.js + auth.js, same function names and response shapes.
 */
import axios from "axios";
import { userClient } from "./client";
import { API_BASE_URL } from "../config";
import { getModuleFcmToken, getModuleRefreshToken, getModuleToken } from "../auth/session";

export default userClient;

/* ------------------------------------------------------------------ auth (auth.js) */
const AUTH = {
  USER_REQUEST_OTP: "/food/auth/user/request-otp",
  USER_VERIFY_OTP: "/food/auth/user/verify-otp",
  REFRESH_TOKEN: "/food/auth/refresh-token",
  LOGOUT: "/food/auth/logout",
  ME: "/food/auth/me",
};
const USER_PHONE_LENGTH = 10;
const normalizePhone = (phone) => (phone ? String(phone).replace(/\D/g, "").slice(-15) : "");

export function requestUserOtp(phone) {
  const digits = normalizePhone(phone);
  if (!digits) return Promise.reject(new Error("Phone number is required"));
  if (!/^\d+$/.test(digits)) return Promise.reject(new Error("Phone must contain only digits"));
  const normalized = digits.length > USER_PHONE_LENGTH ? digits.slice(-USER_PHONE_LENGTH) : digits;
  if (normalized.length !== USER_PHONE_LENGTH) return Promise.reject(new Error("Phone number must be exactly 10 digits"));
  return userClient.post(AUTH.USER_REQUEST_OTP, { phone: normalized });
}

export function verifyUserOtp(phone, otp, ref, name = null, fcmToken = null, platform = "mobile", confirmAction = null) {
  const digits = normalizePhone(phone);
  if (!digits) return Promise.reject(new Error("Phone number is required"));
  const normalized = digits.length > USER_PHONE_LENGTH ? digits.slice(-USER_PHONE_LENGTH) : digits;
  if (normalized.length !== USER_PHONE_LENGTH) return Promise.reject(new Error("Phone number must be exactly 10 digits"));
  const otpStr = String(otp ?? "").replace(/\D/g, "").slice(0, 6);
  if (!otpStr) return Promise.reject(new Error("OTP is required"));
  if (otpStr.length !== 6) return Promise.reject(new Error("OTP must be exactly 6 digits"));
  const refValue = typeof ref === "string" ? ref.trim() : "";
  return userClient.post(AUTH.USER_VERIFY_OTP, {
    phone: normalized,
    otp: otpStr,
    ...(refValue ? { ref: refValue } : {}),
    ...(name ? { name } : {}),
    ...(fcmToken ? { fcmToken, platform } : {}),
    ...(confirmAction ? { confirmAction } : {}),
  });
}

/* /me dedupe + 3 s cache + 429 backoff (web getMeOnce) */
const ME_CACHE_MS = 3000;
const BACKOFF_MS = 10000;
let meCache = null;
let meInFlight = null;
let meBackoffUntil = 0;
export function clearMeCache() {
  meCache = null;
  meInFlight = null;
}
export function getMe() {
  const now = Date.now();
  if (now < meBackoffUntil) return Promise.reject(new Error("Rate limited. Retrying too soon."));
  if (meCache && now - meCache.at < ME_CACHE_MS) return Promise.resolve(meCache.res);
  if (!getModuleToken()) return Promise.reject(new Error("Not authenticated"));
  if (meInFlight) return meInFlight;
  meInFlight = userClient
    .get(AUTH.ME)
    .then((res) => {
      meCache = { at: Date.now(), res };
      return res;
    })
    .catch((err) => {
      if (err?.response?.status === 429) meBackoffUntil = Date.now() + BACKOFF_MS;
      throw err;
    })
    .finally(() => {
      meInFlight = null;
    });
  return meInFlight;
}

export function logout(refreshToken, fcmToken = null, platform = "mobile") {
  if (!refreshToken && !fcmToken) return Promise.resolve({ data: { success: true } });
  const payload = {};
  if (refreshToken) payload.refreshToken = refreshToken;
  if (fcmToken) {
    payload.fcmToken = fcmToken;
    payload.platform = platform;
  }
  clearMeCache();
  return userClient.post(AUTH.LOGOUT, payload);
}

export const authAPI = {
  sendOTP: (phone) => (phone ? requestUserOtp(phone) : Promise.reject(new Error("Phone is required"))),
  verifyOTP: (phone, otp, _purpose, name, _email, _role, _password, referralCode, fcmToken = null, platform = "mobile", _token, confirmAction = null) =>
    !phone || !otp ? Promise.reject(new Error("Phone and OTP are required")) : verifyUserOtp(phone, otp, referralCode, name, fcmToken, platform, confirmAction),
  getCurrentUser: () => getMe(),
  refreshToken: (token) => userClient.post(AUTH.REFRESH_TOKEN, { refreshToken: token }),
  logout: (refreshToken, fcmToken = null, platform = "mobile") =>
    logout(refreshToken || getModuleRefreshToken(), fcmToken || getModuleFcmToken(), platform),
};

/* ------------------------------------------------------------------ small caches */
function stableStringify(value) {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

function createInFlightCache({ ttlMs }) {
  const inFlight = new Map();
  const cached = new Map();
  const getOrCreate = (key, factory) => {
    const hit = cached.get(key);
    if (hit && Date.now() - hit.t <= ttlMs) return Promise.resolve(hit.v);
    if (hit) cached.delete(key);
    if (inFlight.has(key)) return inFlight.get(key);
    const p = Promise.resolve()
      .then(factory)
      .then((res) => {
        cached.set(key, { t: Date.now(), v: res });
        return res;
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, p);
    return p;
  };
  return { getOrCreate, clear: () => cached.clear() };
}

const publicRestaurantsCache = createInFlightCache({ ttlMs: 1000 });
const publicRestaurantMenuCache = createInFlightCache({ ttlMs: 300000 });
const publicRestaurantOutletTimingsCache = createInFlightCache({ ttlMs: 5000 });
const publicCategoriesCache = createInFlightCache({ ttlMs: 300000 });
const publicFoodsCache = createInFlightCache({ ttlMs: 300000 });
const publicGenericGetCache = createInFlightCache({ ttlMs: 300000 });

export const publicGetOnce = (url, config = {}) => {
  const safeUrl = typeof url === "string" ? url.trim() : "";
  const { noCache, params, ...axiosConfig } = config || {};
  if (!safeUrl) return Promise.reject(new Error("url is required"));
  if (noCache) return userClient.get(safeUrl, { params, ...axiosConfig });
  const keyParams = params && typeof params === "object" ? { ...params } : params;
  if (keyParams && typeof keyParams === "object") delete keyParams._ts;
  const key = `GET:${safeUrl}:${stableStringify(keyParams)}`;
  return publicGenericGetCache.getOrCreate(key, () => userClient.get(safeUrl, { params, ...axiosConfig }));
};

export const getPublicLandingSettings = (zoneId = null) =>
  publicGetOnce("/food/landing/settings/public", { params: zoneId ? { zoneId } : {} }).then((res) => res?.data?.data ?? res?.data ?? {});

export const getPublicExploreIcons = (zoneId = null) =>
  publicGetOnce("/food/explore-icons/public", { params: zoneId ? { zoneId } : {} }).then((res) => res?.data?.data ?? res?.data ?? {});

export const getPublicGourmetRestaurants = (zoneId = null) =>
  publicGetOnce("/food/hero-banners/gourmet/public", { params: zoneId ? { zoneId } : {} }).then((res) => {
    const data = res?.data?.data;
    return Array.isArray(data?.restaurants) ? data.restaurants : Array.isArray(data) ? data : [];
  });

const getPublicCategoriesOnce = (params = {}, config = {}) => {
  const { noCache, ...axiosConfig } = config || {};
  const keyParams = params && typeof params === "object" ? { ...params } : {};
  if (keyParams._ts) delete keyParams._ts;
  if (noCache) return userClient.get("/food/restaurant/categories/public", { params: keyParams, ...axiosConfig });
  return publicCategoriesCache.getOrCreate(`categories:${stableStringify(keyParams)}`, () =>
    userClient.get("/food/restaurant/categories/public", { params: keyParams, ...axiosConfig }),
  );
};
export const getPublicCategories = (zoneId = null, config = {}) =>
  getPublicCategoriesOnce(zoneId ? { zoneId } : {}, config).then((res) => res?.data?.data ?? res?.data ?? {});

const getPublicFoodsOnce = (params = {}, config = {}) => {
  const { noCache, ...axiosConfig } = config || {};
  const keyParams = params && typeof params === "object" ? { ...params } : {};
  if (keyParams._ts) delete keyParams._ts;
  if (noCache) return userClient.get("/food/restaurant/foods/public", { params: keyParams, ...axiosConfig });
  return publicFoodsCache.getOrCreate(`foods:${stableStringify(keyParams)}`, () =>
    userClient.get("/food/restaurant/foods/public", { params: keyParams, ...axiosConfig }),
  );
};
export const getPublicFoods = (params = {}, config = {}) => getPublicFoodsOnce(params, config).then((res) => res?.data?.data ?? res?.data ?? {});

const getPublicRestaurantsOnce = (params = {}, config = {}) => {
  const { noCache, ...axiosConfig } = config || {};
  if (noCache) {
    return userClient.get("/food/restaurant/restaurants", {
      params: { limit: 1000, ...params, _ts: Date.now() },
      headers: { ...(axiosConfig.headers || {}), "Cache-Control": "no-cache, no-store, must-revalidate", Pragma: "no-cache" },
      ...axiosConfig,
    });
  }
  const keyParams = { limit: 1000, ...params };
  delete keyParams._ts;
  if (Number.isFinite(Number(keyParams.lat))) keyParams.lat = Math.round(Number(keyParams.lat) * 100000) / 100000;
  if (Number.isFinite(Number(keyParams.lng))) keyParams.lng = Math.round(Number(keyParams.lng) * 100000) / 100000;
  return publicRestaurantsCache.getOrCreate(`restaurants:${stableStringify(keyParams)}`, () =>
    userClient.get("/food/restaurant/restaurants", { params: { limit: 1000, ...params }, ...axiosConfig }),
  );
};

const emptyOk = () => Promise.resolve({ data: { success: false, data: null }, status: 200, statusText: "OK", headers: {}, config: {} });

const getPublicRestaurantMenuOnce = (id, config = {}) => {
  const safeId = String(id || "").trim();
  const { noCache, ...axiosConfig } = config || {};
  if (!safeId) return emptyOk();
  if (noCache) return userClient.get(`/food/restaurant/restaurants/${safeId}/menu`, { ...axiosConfig });
  return publicRestaurantMenuCache.getOrCreate(`menu:${safeId}`, () => userClient.get(`/food/restaurant/restaurants/${safeId}/menu`, { ...axiosConfig }));
};

const getPublicRestaurantOutletTimingsOnce = (id, config = {}) => {
  const safeId = String(id || "").trim();
  const { noCache, ...axiosConfig } = config || {};
  if (!safeId) return emptyOk();
  const mergedConfig = {
    ...axiosConfig,
    params: { ...(axiosConfig.params || {}), _ts: Date.now() },
    headers: { ...(axiosConfig.headers || {}), "Cache-Control": "no-cache, no-store, must-revalidate", Pragma: "no-cache" },
  };
  if (noCache) return userClient.get(`/food/restaurant/restaurants/${safeId}/outlet-timings`, mergedConfig);
  return publicRestaurantOutletTimingsCache.getOrCreate(`outletTimings:${safeId}`, () =>
    userClient.get(`/food/restaurant/restaurants/${safeId}/outlet-timings`, mergedConfig),
  );
};

/* ------------------------------------------------------------------ push */
const savedFcmAt = new Map();
export const saveUserFcmTokenOnce = (token, platform = "mobile") => {
  if (!token) return Promise.reject(new Error("FCM token is required"));
  const key = `${platform}:${token}`;
  const last = savedFcmAt.get(key);
  if (last && Date.now() - last < 24 * 60 * 60 * 1000) return Promise.resolve({ data: { success: true, deduped: true } });
  const path = platform === "mobile" ? "/fcm-tokens/mobile/save" : "/fcm-tokens/save";
  return userClient.post(path, { token: String(token), platform }).then((res) => {
    savedFcmAt.set(key, Date.now());
    return res;
  });
};

/* ------------------------------------------------------------------ restaurant (public subset) */
export const restaurantAPI = {
  getPublicOffers: (params = {}) => userClient.get("/food/restaurant/offers", { params }),
  getCouponsByItemIdPublic: (restaurantId) =>
    userClient.get("/food/restaurant/offers").then((res) => {
      const list = res?.data?.data?.allOffers || res?.data?.allOffers || [];
      const now = Date.now();
      const coupons = list
        .filter((o) => {
          if (String(o?.restaurantScope) === "selected") {
            if (!restaurantId) return false;
            return String(o.restaurantId || "") === String(restaurantId || "");
          }
          return true;
        })
        .map((o) => {
          const isPct = o.discountType === "percentage";
          const discountValue = Number(o.discountValue) || 0;
          const flatDiscount = isPct ? 0 : discountValue;
          return {
            couponCode: o.couponCode,
            discountType: o.discountType,
            discountValue,
            discountPercentage: isPct ? discountValue : 0,
            discount: flatDiscount,
            originalPrice: flatDiscount,
            discountedPrice: 0,
            minOrderValue: Number(o.minOrderValue || 0),
            minOrder: Number(o.minOrderValue || 0),
            maxDiscount: o.maxDiscount != null ? Number(o.maxDiscount) : null,
            customerGroup: o.customerScope === "first-time" ? "new" : "all",
            isGlobalCoupon: true,
            endDate: o.endDate || null,
            showInCart: o.showInCart !== false,
            _ts: now,
          };
        });
      return { data: { success: true, data: { coupons } } };
    }),
  getRestaurants: (params = {}, config = {}) => getPublicRestaurantsOnce(params, config),
  getRestaurantById: (id, config = {}) => userClient.get(`/food/restaurant/restaurants/${String(id)}`, { ...config }),
  getMenuByRestaurantId: (id, config = {}) => getPublicRestaurantMenuOnce(id, config),
  getOutletTimingsByRestaurantId: (id, config = {}) => getPublicRestaurantOutletTimingsOnce(id, config),
  getAddonsByRestaurantId: (id, config = {}) => userClient.get(`/food/restaurant/restaurants/${String(id)}/addons`, { ...config }),
  getCombosByRestaurantId: (id, config = {}) => userClient.get(`/food/restaurant/restaurants/${String(id)}/combos`, { ...config }),
};

/* ------------------------------------------------------------------ user */
const dedupedGet = (path, cacheMs = 3000) => {
  let inFlight = null;
  let cached = null;
  let cacheTime = 0;
  const fn = () => {
    const now = Date.now();
    if (cached && now - cacheTime < cacheMs) return Promise.resolve(cached);
    if (!inFlight) {
      inFlight = userClient
        .get(path)
        .then((res) => {
          cached = res;
          cacheTime = Date.now();
          return res;
        })
        .finally(() => {
          inFlight = null;
        });
    }
    return inFlight;
  };
  fn.clear = () => {
    cached = null;
    cacheTime = 0;
  };
  return fn;
};

export const userAPI = {
  getPublicSubscriptionPlans: () => userClient.get("/food/subscriptions/plans"),
  getMySubscription: () => userClient.get("/food/subscriptions/my"),
  createSubscriptionRazorpayOrder: (data) => userClient.post("/food/subscriptions/create-razorpay-order", data),
  subscribePlan: (data) => userClient.post("/food/subscriptions/subscribe", data),
  getProfile: () =>
    getMe().then((res) => {
      const user = res?.data?.data?.user ?? res?.data?.user ?? res?.data?.data ?? res?.data;
      return { ...res, data: { ...res.data, data: { user } } };
    }),
  updateProfile: (body) => userClient.patch("/food/user/profile", body ?? {}),
  getActivePromocodes: (restaurantId) => userClient.get(`/food/promocodes/restaurant/${restaurantId}`),
  validatePromocode: (data) => userClient.post("/food/promocodes/validate", data),
  /** multipart: { uri, name, type } */
  uploadProfileImage: (file) => {
    if (!file) return Promise.reject(new Error("File is required"));
    const formData = new FormData();
    formData.append("file", file);
    return userClient.post("/food/user/profile/profile-image", formData, { headers: { "Content-Type": "multipart/form-data" }, timeout: 120000 });
  },
  getWallet: dedupedGet("/food/user/wallet"),
  getReferralStats: () => userClient.get("/food/user/referrals/stats"),
  getReferralDetails: () => userClient.get("/food/user/referrals/details"),
  createWalletTopupOrder: (amount) => userClient.post("/food/user/wallet/topup/order", { amount: Number(amount) }),
  verifyWalletTopupPayment: (body) => userClient.post("/food/user/wallet/topup/verify", body ?? {}),
  getAddresses: dedupedGet("/food/user/addresses"),
  addAddress: (body) => userClient.post("/food/user/addresses", body ?? {}),
  updateAddress: (id, body) => userClient.patch(`/food/user/addresses/${String(id)}`, body ?? {}),
  deleteAddress: (id) => userClient.delete(`/food/user/addresses/${String(id)}`),
  setDefaultAddress: (id) => userClient.patch(`/food/user/addresses/${String(id)}/default`, {}),
  createSafetyEmergencyReport: (message) => userClient.post("/food/user/safety-emergency-reports", { message: String(message || "") }),
  getMySafetyEmergencyReports: (params) => userClient.get("/food/user/safety-emergency-reports", { params: params ?? {} }),
  getLocation: () => userClient.get("/food/user/location"),
  updateLocation: (payload) => userClient.put("/food/user/location", payload ?? {}),
  clearLocation: () => userClient.delete("/food/user/location"),
  saveFcmToken: (token, options = {}) => saveUserFcmTokenOnce(token, options?.platform === "web" ? "web" : "mobile"),
  savePushDevice: (payload = {}) => userClient.post("/fcm-tokens/device/save", payload ?? {}),
  removePushDevice: (payload = {}) => userClient.delete("/fcm-tokens/device/remove", { data: payload ?? {}, params: payload ?? {} }),
  removeFcmToken: (token, options = {}) => {
    if (!token) return Promise.reject(new Error("FCM token is required"));
    const platform = options?.platform === "web" ? "web" : "mobile";
    return userClient.delete("/fcm-tokens/remove", { params: { platform }, data: { token: String(token), platform } });
  },
  testFcmNotification: () => userClient.post("/fcm-tokens/test", { platform: "mobile" }),
  deleteAccount: () => userClient.delete("/food/user/account"),
};

export const locationAPI = {
  reverseGeocode: (latitude, longitude) => userClient.get("/food/location/reverse-geocode", { params: { lat: latitude, lng: longitude } }),
  computeDistance: (body) => userClient.post("/food/location/distance", body ?? {}),
};

export const zoneAPI = {
  detectZone: (lat, lng) => userClient.get("/food/zones/detect", { params: { lat, lng } }),
  getPublicZones: (params = {}, config = {}) => userClient.get("/food/zones/public", { params: params ?? {}, ...config }),
};

/* ------------------------------------------------------------------ upload */
export const uploadAPI = {
  /** file: { uri, name, type } */
  uploadMedia: async (file, options = {}) => {
    if (!file) return Promise.reject(new Error("File is required for upload"));
    const formData = new FormData();
    formData.append("file", file);
    if (options.folder) formData.append("folder", options.folder);
    const headers = { "Content-Type": "multipart/form-data" };
    const token = getModuleToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    let lastError = null;
    for (const path of ["/uploads/image", "/uploads/single"]) {
      try {
        return await axios.post(`${API_BASE_URL}${path}`, formData, { timeout: 300000, headers });
      } catch (error) {
        lastError = error;
        if (error?.response?.status && error.response.status !== 404) throw error;
      }
    }
    throw lastError || new Error("Upload failed");
  },
};

/* ------------------------------------------------------------------ orders */
export const orderAPI = {
  checkRiderAvailability: (params = {}) => userClient.get("/food/orders/check-rider-availability", { params }),
  calculateOrder: (payload) => userClient.post("/food/orders/calculate", payload ?? {}),
  createOrder: (payload) => userClient.post("/food/orders", payload ?? {}),
  verifyPayment: (body) => userClient.post("/food/orders/verify-payment", body ?? {}),
  getOrders: (params = {}) =>
    userClient.get("/food/orders", { params: { limit: 20, page: 1, ...params } }).then((res) => {
      const payload = res?.data?.data;
      if (payload && typeof payload === "object" && Array.isArray(payload.data) && payload.meta && typeof payload.meta === "object") {
        const meta = payload.meta;
        return {
          ...res,
          data: {
            ...res.data,
            data: {
              ...payload,
              orders: payload.data,
              pagination: {
                total: Number(meta.total || 0),
                page: Number(meta.page || 1),
                limit: Number(meta.limit || params.limit || 20),
                pages: Number(meta.totalPages || 1),
              },
            },
          },
        };
      }
      return res;
    }),
  getOrderDetails: (() => {
    const inFlight = new Map();
    const cache = new Map();
    const CACHE_MS = 800;
    return (orderId, options = {}) => {
      const key = String(orderId ?? "").trim();
      if (!key) return Promise.reject(new Error("orderId required"));
      const force = options.force === true;
      const now = Date.now();
      if (!force) {
        const hit = cache.get(key);
        if (hit && now - hit.at < CACHE_MS) return Promise.resolve(hit.res);
      }
      const pending = inFlight.get(key);
      if (pending) return pending;
      const p = userClient
        .get(`/food/orders/${key}`)
        .then((res) => {
          cache.set(key, { at: Date.now(), res });
          return res;
        })
        .finally(() => inFlight.delete(key));
      inFlight.set(key, p);
      return p;
    };
  })(),
  cancelOrder: (orderId, body = {}) => userClient.patch(`/food/orders/${String(orderId)}/cancel`, body ?? {}),
  updateOrderInstructions: (orderId, instructions) => userClient.patch(`/food/orders/${String(orderId)}/instructions`, { instructions }),
  submitOrderRatings: (orderId, body = {}) => userClient.patch(`/food/orders/${String(orderId)}/ratings`, body ?? {}),
  submitComplaint: (payload) =>
    userClient.post("/food/user/support/ticket", {
      type: "order",
      orderId: payload.orderId,
      issueType: payload.complaintType,
      description: payload.subject ? `${payload.subject}: ${payload.description}` : payload.description,
    }),
};

/* ------------------------------------------------------------------ others */
export const diningAPI = {
  getCategories: (params = {}) => userClient.get("/food/dining/categories/public", { params }),
  getRestaurants: (params = {}) => userClient.get("/food/dining/restaurants/public", { params }),
  getOccupiedSeatsPublic: (restaurantId) => userClient.get(`/food/dining/restaurants/${String(restaurantId)}/occupied-seats/public`),
  getHeroBanners: () => userClient.get("/food/hero-banners/ads/public"),
  getRestaurantBySlug: (slug, config = {}) => userClient.get(`/food/restaurant/restaurants/${String(slug)}`, config),
  getOfferBanners: () => Promise.resolve({ data: { success: true, data: [] } }),
  getStories: () => Promise.resolve({ data: { success: true, data: [] } }),
  getBankOffers: () => Promise.resolve({ data: { success: true, data: [] } }),
  getBookings: () => userClient.get("/food/dining/bookings/my"),
  createReview: (payload = {}) => userClient.post(`/food/dining/bookings/${String(payload?.bookingId)}/review`, payload),
  createBooking: (payload = {}) => userClient.post("/food/dining/bookings", payload),
};

export const searchAPI = {
  unifiedSearch: (params = {}) => userClient.get("/food/search/unified", { params }),
};

export const supportAPI = {
  createTicket: (body) => userClient.post("/food/user/support/ticket", body ?? {}),
  getMyTickets: (params = {}) => userClient.get("/food/user/support/my-tickets", { params }),
};

export const notificationAPI = {
  getInbox: (params = {}, config = {}) => userClient.get("/food/notifications/inbox", { params, ...config }),
  markAsRead: (id, config = {}) => userClient.patch(`/food/notifications/${String(id)}/read`, {}, config),
  dismiss: (id, config = {}) => userClient.delete(`/food/notifications/${String(id)}`, config),
  dismissAll: (config = {}) => userClient.delete("/food/notifications/inbox/all", config),
};

export const publicAPI = {
  getPrivacy: (key = "privacy") => userClient.get(`/food/pages/${key}`),
  getTerms: (key = "terms") => userClient.get(`/food/pages/${key}`),
  getPage: (key) => userClient.get(`/food/pages/${key}`),
  getBusinessSettings: () => userClient.get("/food/admin/business-settings/public"),
  getPublicFeeSettings: () => userClient.get("/food/admin/fee-settings/public"),
  getAppConfig: () => publicGetOnce("/app-config/user_app", { noCache: true }),
  getAppIntroAds: () => userClient.get("/food/app-intro-ads/public"),
};

export const adminAPI = {
  getPublicBusinessSettings: () => userClient.get("/food/admin/business-settings/public"),
  getPublicFeeSettings: () => userClient.get("/food/admin/fee-settings/public"),
};

export const advertisementAPI = {
  getPublicAdvertisements: () => userClient.get("/food/advertisements/public"),
};

export const api = userClient;
