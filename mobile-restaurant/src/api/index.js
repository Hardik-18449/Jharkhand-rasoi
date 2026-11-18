/**
 * API layer — port of web services/api/index.js (`restaurantAPI`, notifications, public pages) + services/api/auth.js (restaurant OTP).
 * Screens call these only; same endpoints, same response normalisation as web.
 */
import restaurantClient, { userClient } from "./client";
import { getModuleRefreshToken, getModuleFcmToken } from "../auth/session";

export { restaurantClient };
export default restaurantClient;

const AUTH = {
  REQUEST_OTP: "/food/auth/restaurant/request-otp",
  VERIFY_OTP: "/food/auth/restaurant/verify-otp",
  LOGOUT: "/food/auth/logout",
  ME: "/food/auth/me",
};
const normalizePhone = (phone) => {
  const digits = phone ? String(phone).replace(/\D/g, "") : "";
  return digits.length > 10 ? digits.slice(-10) : digits;
};

/* ---------- small in-flight / TTL caches (same idea as web) ---------- */
function stableStringify(value) {
  if (value == null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}
function createInFlightCache({ ttlMs }) {
  const cache = new Map();
  const inFlight = new Map();
  return {
    getOrCreate(key, fn) {
      const hit = cache.get(key);
      if (hit && Date.now() - hit.at < ttlMs) return Promise.resolve(hit.res);
      if (inFlight.has(key)) return inFlight.get(key);
      const p = fn()
        .then((res) => {
          cache.set(key, { at: Date.now(), res });
          return res;
        })
        .finally(() => inFlight.delete(key));
      inFlight.set(key, p);
      return p;
    },
  };
}
const publicGenericGetCache = createInFlightCache({ ttlMs: 300000 });
export const publicGetOnce = (url, config = {}) => {
  const safeUrl = typeof url === "string" ? url.trim() : "";
  const { noCache, params, ...axiosConfig } = config || {};
  if (!safeUrl) return Promise.reject(new Error("url is required"));
  if (noCache) return userClient.get(safeUrl, { params, ...axiosConfig });
  return publicGenericGetCache.getOrCreate(`GET:${safeUrl}:${stableStringify(params)}`, () => userClient.get(safeUrl, { params, ...axiosConfig }));
};

/* ---------- current restaurant (deduped + short cache, web getRestaurantCurrentOnce) ---------- */
let restaurantCurrentInFlight = null;
let restaurantCurrentCached = null;
let restaurantCurrentCacheTime = 0;
const RESTAURANT_CURRENT_CACHE_MS = 5000;
function getRestaurantCurrentOnce(config = {}) {
  const { noCache, ...axiosConfig } = config || {};
  if (!noCache && restaurantCurrentCached && Date.now() - restaurantCurrentCacheTime < RESTAURANT_CURRENT_CACHE_MS) return Promise.resolve(restaurantCurrentCached);
  if (!noCache && restaurantCurrentInFlight) return restaurantCurrentInFlight;
  restaurantCurrentInFlight = restaurantClient
    .get("/food/restaurant/current", axiosConfig)
    .then((res) => {
      restaurantCurrentCached = res;
      restaurantCurrentCacheTime = Date.now();
      return res;
    })
    .finally(() => {
      restaurantCurrentInFlight = null;
    });
  return restaurantCurrentInFlight;
}
const keepCurrentCache = (res) => {
  restaurantCurrentCached = res;
  restaurantCurrentCacheTime = Date.now();
  return res;
};
export const invalidateCurrentRestaurant = () => {
  restaurantCurrentCached = null;
  restaurantCurrentCacheTime = 0;
};

const savedFcmAt = new Map();
const withdrawalRequestId = (kind, amount) => `${kind}-${Number(amount) || 0}-${Math.floor(Date.now() / 10000)}`;

/** Order list status normalisation (web getOrders). */
const normalizeListStatus = (s) => {
  const v = String(s || "").toLowerCase();
  if (v === "created") return "confirmed";
  if (v === "ready_for_pickup") return "ready";
  if (v === "picked_up") return "out_for_delivery";
  if (v.includes("cancel")) return "cancelled";
  return v || "confirmed";
};
const normalizeOutgoingStatus = (s) => {
  const v = String(s || "").toLowerCase().trim();
  if (v === "ready") return "ready_for_pickup";
  if (v === "out_for_delivery") return "picked_up";
  if (v === "cancelled") return "cancelled_by_restaurant";
  return v;
};

const ordersCache = { inFlight: null, inFlightKey: "", cache: null, cacheKey: "", cacheAt: 0 };

export const restaurantAPI = {
  sendOTP: (phone) => {
    const normalized = normalizePhone(phone);
    if (normalized.length < 8) return Promise.reject(new Error("Phone must be at least 8 digits"));
    return restaurantClient.post(AUTH.REQUEST_OTP, { phone: normalized });
  },
  verifyOTP: (phone, otp, fcmToken = null, platform = "mobile") => {
    const normalized = normalizePhone(phone);
    const otpStr = String(otp).replace(/\D/g, "").slice(0, 6);
    if (!normalized || otpStr.length < 6) return Promise.reject(new Error("Phone and 6-digit OTP are required"));
    return restaurantClient.post(AUTH.VERIFY_OTP, { phone: normalized, otp: otpStr, ...(fcmToken ? { fcmToken, platform } : {}) });
  },
  getMe: () => restaurantClient.get(AUTH.ME),
  getCurrentRestaurant: (config = {}) => getRestaurantCurrentOnce(config),
  getFinance: (params = {}) => restaurantClient.get("/food/restaurant/finance", { params: params || {} }),
  getDashboardStats: (params = {}) => restaurantClient.get("/food/restaurant/dashboard-stats", { params: params || {} }),
  createWithdrawalRequest: (amount) => restaurantClient.post("/food/restaurant/withdraw", { amount: Number(amount), requestId: withdrawalRequestId("restaurant", amount) }),
  getWithdrawalHistory: () => restaurantClient.get("/food/restaurant/withdrawals"),

  getPromocodes: () => restaurantClient.get("/food/promocodes"),
  createPromocode: (data) => restaurantClient.post("/food/promocodes", data),
  togglePromocodeStatus: (id, isActive) => restaurantClient.patch(`/food/promocodes/${id}`, { isActive }),
  deletePromocode: (id) => restaurantClient.delete(`/food/promocodes/${id}`),

  updateProfile: (body) => restaurantClient.patch("/food/restaurant/profile", body ?? {}, { timeout: 300000 }).then(keepCurrentCache),
  updateDiningSettings: (body) => restaurantClient.patch("/food/restaurant/dining-settings", body ?? {}).then(keepCurrentCache),
  requestDiningUpdate: (body) => restaurantClient.post("/food/restaurant/dining-settings/request", body ?? {}),
  getPendingDiningRequest: () => restaurantClient.get("/food/restaurant/dining-settings/pending"),
  /** PATCH /food/restaurant/availability. Body: { isAcceptingOrders } */
  updateAcceptingOrders: (isAcceptingOrders) => restaurantClient.patch("/food/restaurant/availability", { isAcceptingOrders: Boolean(isAcceptingOrders) }).then(keepCurrentCache),
  /** file = { uri, name, type } (React Native FormData file) */
  uploadProfileImage: (file) => {
    if (!file) return Promise.reject(new Error("File is required"));
    const fd = new FormData();
    fd.append("file", file);
    return restaurantClient.post("/food/restaurant/profile/profile-image", fd);
  },
  uploadMenuImage: (file) => {
    if (!file) return Promise.reject(new Error("File is required"));
    const fd = new FormData();
    fd.append("file", file);
    return restaurantClient.post("/food/restaurant/profile/menu-image", fd);
  },
  uploadCoverImages: (files = []) => {
    const list = Array.from(files || []).filter(Boolean);
    if (!list.length) return Promise.reject(new Error("At least one file is required"));
    const fd = new FormData();
    list.forEach((f) => fd.append("files", f));
    return restaurantClient.post("/food/restaurant/profile/cover-images", fd);
  },

  getCategories: (params = {}) => restaurantClient.get("/food/restaurant/categories", { params: { compact: true, limit: 1000, ...params } }),
  getAllCategories: (params = {}) => restaurantClient.get("/food/restaurant/categories", { params: { includeInactive: true, withCounts: true, limit: 1000, ...params } }),
  createCategory: (body) => restaurantClient.post("/food/restaurant/categories", body ?? {}),
  updateCategory: (id, body) => restaurantClient.patch(`/food/restaurant/categories/${String(id)}`, body ?? {}),
  deleteCategory: (id) => restaurantClient.delete(`/food/restaurant/categories/${String(id)}`),
  getMenu: (params = {}) => restaurantClient.get("/food/restaurant/menu", { params }),
  updateMenu: (body) => restaurantClient.patch("/food/restaurant/menu", body ?? {}),

  saveFcmToken: (token, platform = "mobile") => {
    if (!token) return Promise.reject(new Error("FCM token is required"));
    const key = `${platform}:${token}`;
    const last = savedFcmAt.get(key);
    if (last && Date.now() - last < 86400000) return Promise.resolve({ data: { success: true, deduped: true } });
    return restaurantClient.post(platform === "mobile" ? "/fcm-tokens/mobile/save" : "/fcm-tokens/save", { token: String(token), platform }).then((res) => {
      savedFcmAt.set(key, Date.now());
      return res;
    });
  },
  savePushDevice: (payload = {}) => restaurantClient.post("/fcm-tokens/device/save", payload ?? {}),
  removePushDevice: (payload = {}) => restaurantClient.delete("/fcm-tokens/device/remove", { data: payload ?? {}, params: payload ?? {} }),

  getOutletTimings: () => restaurantClient.get("/food/restaurant/outlet-timings"),
  saveOutletTimings: (outletTimings) => restaurantClient.put("/food/restaurant/outlet-timings", { outletTimings: outletTimings || {} }),

  createFood: (body) => restaurantClient.post("/food/restaurant/foods", body ?? {}),
  updateFood: (id, body) => restaurantClient.patch(`/food/restaurant/foods/${String(id)}`, body ?? {}),
  deleteFood: (id) => restaurantClient.delete(`/food/restaurant/foods/${String(id)}`),

  /** Orders (paginated, backend status filter). Normalised to { data: { data: { orders, meta } } } like web. */
  getOrders: (params = {}) => {
    const key = JSON.stringify({ limit: 30, page: 1, ...params });
    const now = Date.now();
    if (ordersCache.cache && ordersCache.cacheKey === key && now - ordersCache.cacheAt < 800) return Promise.resolve(ordersCache.cache);
    if (ordersCache.inFlight && ordersCache.inFlightKey === key) return ordersCache.inFlight;
    ordersCache.inFlightKey = key;
    ordersCache.inFlight = restaurantClient
      .get("/food/restaurant/orders", { params: { limit: 30, page: 1, ...params } })
      .then((res) => {
        const payload = res?.data?.data || {};
        const rowsRaw = Array.isArray(payload.orders) ? payload.orders : Array.isArray(payload.data) ? payload.data : [];
        const rows = rowsRaw.map((o) => ({
          ...o,
          status: normalizeListStatus(o.orderStatus || o.status),
          address: o.deliveryAddress || o.address,
          total: o.pricing?.total ?? o.total ?? 0,
          paymentMethod: o.payment?.method || o.paymentMethod || null,
        }));
        const meta = payload.meta || payload.pagination || {};
        const normalized = { ...res, data: { ...res.data, data: { orders: rows, meta } } };
        ordersCache.cache = normalized;
        ordersCache.cacheKey = key;
        ordersCache.cacheAt = Date.now();
        return normalized;
      })
      .finally(() => {
        ordersCache.inFlight = null;
        ordersCache.inFlightKey = "";
      });
    return ordersCache.inFlight;
  },
  invalidateOrders: () => {
    ordersCache.cache = null;
    ordersCache.cacheAt = 0;
  },
  updateOrderStatus: (orderId, body) => {
    const outgoing = { ...(body ?? {}) };
    if (outgoing.orderStatus) outgoing.orderStatus = normalizeOutgoingStatus(outgoing.orderStatus);
    restaurantAPI.invalidateOrders();
    return restaurantClient.patch(`/food/restaurant/orders/${String(orderId)}/status`, outgoing);
  },
  acceptOrder: async (orderId) => {
    try {
      return await restaurantAPI.updateOrderStatus(orderId, { orderStatus: "preparing" });
    } catch (error) {
      if (Number(error?.response?.status || 0) === 400) return restaurantAPI.updateOrderStatus(orderId, { orderStatus: "confirmed" });
      throw error;
    }
  },
  rejectOrder: (orderId, reason = "") => restaurantAPI.updateOrderStatus(orderId, { orderStatus: "cancelled_by_restaurant", note: reason }),
  markOrderReady: (orderId) => restaurantAPI.updateOrderStatus(orderId, { orderStatus: "ready_for_pickup" }),
  getOrderById: (orderId) => restaurantClient.get(`/food/restaurant/orders/${String(orderId)}`),
  resendDeliveryNotification: (orderId, voipToken = "") => restaurantClient.post(`/food/restaurant/orders/${String(orderId)}/resend-notification`, { voipToken }),

  getAddons: (params = {}) => restaurantClient.get("/food/restaurant/addons", { params: { limit: 100, page: 1, ...params } }),
  addAddon: (body) => restaurantClient.post("/food/restaurant/addons", body ?? {}),
  updateAddon: (id, body) => restaurantClient.patch(`/food/restaurant/addons/${String(id)}`, body ?? {}),
  deleteAddon: (id) => restaurantClient.delete(`/food/restaurant/addons/${String(id)}`),
  getCombos: (params = {}) => restaurantClient.get("/food/restaurant/combos", { params: { limit: 100, page: 1, ...params } }),
  addCombo: (body) => restaurantClient.post("/food/restaurant/combos", body ?? {}),
  updateCombo: (id, body) => restaurantClient.patch(`/food/restaurant/combos/${String(id)}`, body ?? {}),
  deleteCombo: (id) => restaurantClient.delete(`/food/restaurant/combos/${String(id)}`),

  logout: (refreshToken, fcmToken = null, platform = "mobile") => {
    invalidateCurrentRestaurant();
    const token = refreshToken || getModuleRefreshToken();
    const resolvedFcm = fcmToken || getModuleFcmToken();
    return restaurantClient.post(AUTH.LOGOUT, { ...(token ? { refreshToken: token } : {}), ...(resolvedFcm ? { fcmToken: resolvedFcm, platform } : {}) });
  },

  getComplaints: (params = {}) => restaurantClient.get("/food/restaurant/complaints", { params }),
  createSupportTicket: (body = {}) => restaurantClient.post("/food/restaurant/support/tickets", body ?? {}),
  getSupportTickets: (params = {}) => restaurantClient.get("/food/restaurant/support/tickets", { params }),
  deleteAccount: () => restaurantClient.delete("/food/restaurant/account"),

  getDedicatedRiders: () => restaurantClient.get("/food/restaurant/dedicated-riders"),
  addDedicatedRider: (body) => restaurantClient.post("/food/restaurant/dedicated-riders", body),
  removeDedicatedRider: (partnerId) => restaurantClient.delete(`/food/restaurant/dedicated-riders/${partnerId}`),
  updateDeliveryDispatchSettings: (body) => restaurantClient.patch("/food/restaurant/delivery-dispatch-settings", body),
};

export const notificationAPI = {
  getInbox: (params = {}, config = {}) => restaurantClient.get("/food/notifications/inbox", { params, ...config }),
  markAsRead: (id, config = {}) => restaurantClient.patch(`/food/notifications/${String(id)}/read`, {}, config),
  dismiss: (id, config = {}) => restaurantClient.delete(`/food/notifications/${String(id)}`, config),
  dismissAll: (config = {}) => restaurantClient.delete("/food/notifications/inbox/all", config),
};

export const publicAPI = {
  getPrivacy: (key = "privacy") => userClient.get(`/food/pages/${key}`),
  getTerms: (key = "terms") => userClient.get(`/food/pages/${key}`),
  getPage: (key) => userClient.get(`/food/pages/${key}`),
  getBusinessSettings: () => userClient.get("/food/admin/business-settings/public"),
};
