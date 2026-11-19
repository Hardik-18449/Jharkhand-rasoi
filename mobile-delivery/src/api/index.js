/**
 * API layer — port of web services/api/index.js (`deliveryAPI`, notifications, public pages) + services/api/auth.js (delivery OTP).
 * Same endpoints / caching as web; screens call these only.
 */
import deliveryClient, { userClient } from "./client";
import { getModuleRefreshToken, getModuleFcmToken } from "../auth/session";

export { deliveryClient };
export default deliveryClient;

const AUTH = {
  REQUEST_OTP: "/food/auth/delivery/request-otp",
  VERIFY_OTP: "/food/auth/delivery/verify-otp",
  LOGOUT: "/food/auth/logout",
  ME: "/food/auth/me",
};
const normalizePhone = (phone) => {
  const digits = phone ? String(phone).replace(/\D/g, "") : "";
  return digits.length > 10 ? digits.slice(-10) : digits;
};

/* /me — deduped + short cache (web getDeliveryMeOnce) */
let meInFlight = null;
let meCached = null;
let meCachedAt = 0;
const getMeOnce = () => {
  if (meCached && Date.now() - meCachedAt < 3000) return Promise.resolve(meCached);
  if (meInFlight) return meInFlight;
  meInFlight = deliveryClient
    .get(AUTH.ME)
    .then((res) => {
      meCached = res;
      meCachedAt = Date.now();
      return res;
    })
    .finally(() => {
      meInFlight = null;
    });
  return meInFlight;
};
export const clearMeCache = () => {
  meCached = null;
  meCachedAt = 0;
};

/** single-flight + short TTL GET cache keyed by params (web getOrders / getOrderDetails) */
const cachedGet = (fn, ttl) => {
  const inFlight = new Map();
  const cache = new Map();
  return (key, ...args) => {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < ttl) return Promise.resolve(hit.res);
    if (inFlight.has(key)) return inFlight.get(key);
    const p = fn(...args)
      .then((res) => {
        cache.set(key, { at: Date.now(), res });
        return res;
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, p);
    return p;
  };
};
const ordersGet = cachedGet((params) => deliveryClient.get("/food/delivery/orders/available", { params }), 2500);
const orderDetailGet = cachedGet((id) => deliveryClient.get(`/food/delivery/orders/${id}`), 1200);
const withdrawalRequestId = (kind, amount) => `${kind}-${Number(amount) || 0}-${Math.floor(Date.now() / 10000)}`;
const savedFcmAt = new Map();

export const deliveryAPI = {
  sendOTP: (phone) => {
    const n = normalizePhone(phone);
    if (n.length < 8) return Promise.reject(new Error("Phone must be at least 8 digits"));
    return deliveryClient.post(AUTH.REQUEST_OTP, { phone: n });
  },
  verifyOTP: (phone, otp, fcmToken = null, platform = "mobile") => {
    const n = normalizePhone(phone);
    const otpStr = String(otp).replace(/\D/g, "").slice(0, 6);
    if (!n || otpStr.length < 6) return Promise.reject(new Error("Phone and 6-digit OTP are required"));
    return deliveryClient.post(AUTH.VERIFY_OTP, { phone: n, otp: otpStr, ...(fcmToken ? { fcmToken, platform } : {}) });
  },
  getMe: () => getMeOnce(),
  getProfile: () => getMeOnce().then((res) => ({ ...res, data: { ...res.data, data: { profile: res.data?.data?.user ?? res.data?.data } } })),
  getReferralStats: () => deliveryClient.get("/food/delivery/referrals/stats"),
  logout: (refreshToken, fcmToken = null, platform = "mobile") => {
    clearMeCache();
    const token = refreshToken || getModuleRefreshToken();
    const fcm = fcmToken || getModuleFcmToken();
    if (!token && !fcm) return Promise.resolve({ data: { success: true } });
    return deliveryClient.post(AUTH.LOGOUT, { ...(token ? { refreshToken: token } : {}), ...(fcm ? { fcmToken: fcm, platform } : {}) });
  },
  updateProfileDetails: (payload) => deliveryClient.patch("/food/delivery/profile/details", payload ?? {}),
  updateProfile: (payload) => deliveryClient.patch("/food/delivery/profile/bank-details", payload ?? {}),

  saveFcmToken: (token, platform = "mobile") => {
    if (!token) return Promise.reject(new Error("FCM token is required"));
    const key = `${platform}:${token}`;
    const last = savedFcmAt.get(key);
    if (last && Date.now() - last < 86400000) return Promise.resolve({ data: { success: true, deduped: true } });
    return deliveryClient.post(platform === "mobile" ? "/fcm-tokens/mobile/save" : "/fcm-tokens/save", { token: String(token), platform }).then((res) => {
      savedFcmAt.set(key, Date.now());
      return res;
    });
  },
  savePushDevice: (payload = {}) => deliveryClient.post("/fcm-tokens/device/save", payload ?? {}),
  removePushDevice: (payload = {}) => deliveryClient.delete("/fcm-tokens/device/remove", { data: payload ?? {}, params: payload ?? {} }),

  getSupportTickets: () => deliveryClient.get("/food/delivery/support-tickets"),
  createSupportTicket: (body) => deliveryClient.post("/food/delivery/support-tickets", body ?? {}),
  getSupportTicketById: (id) => deliveryClient.get(`/food/delivery/support-tickets/${id}`),

  /** PATCH /food/delivery/availability — online/offline (+ optional shift selfie base64 + address) */
  updateOnlineStatus: (isOnline, shiftStartPicBase64 = null, shiftStartAddress = null) =>
    deliveryClient.patch("/food/delivery/availability", { status: isOnline ? "online" : "offline", shiftStartPicBase64, shiftStartAddress }, { timeout: 60000 }),
  updateLocation: (latitude, longitude, isOnline, extras = {}) =>
    deliveryClient.patch("/food/delivery/availability", { status: isOnline ? "online" : "offline", latitude, longitude, ...extras }),

  getOrders: (params = {}) => {
    const p = { limit: 50, page: 1, ...params };
    const key = JSON.stringify(Object.keys(p).sort().reduce((a, k) => ({ ...a, [k]: p[k] }), {}));
    return ordersGet(key, p);
  },
  getOrderDetails: (orderId) => {
    const key = String(orderId || "").trim();
    if (!/^[a-f0-9]{24}$/i.test(key)) return Promise.resolve({ data: { success: false, message: "Invalid order id", data: null } });
    return orderDetailGet(key, key);
  },
  getOrderById: (orderId) => deliveryAPI.getOrderDetails(orderId),
  getCurrentDelivery: () => deliveryClient.get("/food/delivery/orders/current"),
  getActiveOrders: () => deliveryClient.get("/food/delivery/orders/active"),
  getDeliveredOrders: (params = {}) => deliveryClient.get("/food/delivery/orders/delivered", { params }),
  acceptOrder: (orderId, body = {}) => deliveryClient.patch(`/food/delivery/orders/${String(orderId)}/accept`, body ?? {}),
  rejectOrder: (orderId, body = {}) => deliveryClient.patch(`/food/delivery/orders/${String(orderId)}/reject`, body ?? {}),
  confirmReachedPickup: (orderId) => deliveryClient.patch(`/food/delivery/orders/${String(orderId)}/reached-pickup`, {}),
  confirmOrderId: (orderId, confirmedOrderId, location = {}, data = {}) =>
    deliveryClient.patch(`/food/delivery/orders/${String(orderId)}/confirm-pickup`, { confirmedOrderId, latitude: location.lat, longitude: location.lng, billImageUrl: data.billImageUrl, otp: data.otp }),
  requestPickupOtp: (orderId) => deliveryClient.post(`/food/delivery/orders/${String(orderId)}/request-pickup-otp`, {}),
  confirmReachedDrop: (orderId) => deliveryClient.patch(`/food/delivery/orders/${String(orderId)}/reached-drop`, {}),
  verifyDropOtp: (orderId, otp) => deliveryClient.post(`/food/delivery/orders/${String(orderId)}/verify-drop-otp`, { otp: String(otp) }),
  createCollectQr: (orderId, body = {}) => deliveryClient.post(`/food/delivery/orders/${String(orderId)}/payment-qr`, body ?? {}),
  passOrder: (orderId) => deliveryClient.patch(`/food/delivery/orders/${String(orderId)}/pass`, {}),
  getPaymentStatus: (orderId) => deliveryClient.get(`/food/delivery/orders/${String(orderId)}/payment-status`),
  completeDelivery: (orderId, body = {}) => {
    let payload = body ?? {};
    if (typeof payload === "number" || typeof payload === "string" || payload == null) payload = { rating: payload == null ? null : Number(payload) };
    return deliveryClient.patch(`/food/delivery/orders/${String(orderId)}/complete`, payload);
  },

  getWallet: () => deliveryClient.get("/food/delivery/wallet"),
  getEarnings: (params) => deliveryClient.get("/food/delivery/earnings", { params: params ?? {} }),
  getActiveEarningAddons: () => deliveryClient.get("/food/delivery/earning-addons/active"),
  getTripHistory: (params) => deliveryClient.get("/food/delivery/trip-history", { params: params ?? {} }),
  getPocketDetails: (params) => deliveryClient.get("/food/delivery/pocket-details", { params: params ?? {} }),
  getEmergencyHelp: () => deliveryClient.get("/food/delivery/emergency-help"),
  getCashLimit: () => deliveryClient.get("/food/delivery/cash-limit"),
  createWithdrawalRequest: (body) => deliveryClient.post("/food/delivery/wallet/withdraw", { ...(body ?? {}), requestId: withdrawalRequestId("delivery", body?.amount) }),
  createDepositOrder: (amount) => deliveryClient.post("/food/delivery/wallet/deposit/order", { amount }),
  verifyDepositPayment: (body) => deliveryClient.post("/food/delivery/wallet/deposit/verify", body ?? {}),
  getWalletTransactions: (params) =>
    deliveryClient.get("/food/delivery/wallet", { params: params ?? {} }).then((res) => ({ ...res, data: { ...res.data, data: { transactions: res?.data?.data?.wallet?.transactions ?? [] } } })),
  getZonesInRadius: (lat, lng, radiusKm = 10) => deliveryClient.get("/food/zones/nearby", { params: { lat, lng, radius: radiusKm } }),
  deleteAccount: () => deliveryClient.delete("/food/delivery/account"),
};

export const locationAPI = {
  /** backend reverse geocode (key stays on the server) */
  reverseGeocode: (lat, lng) => userClient.get("/food/location/reverse-geocode", { params: { lat, lng } }),
};

export const notificationAPI = {
  getInbox: (params = {}, config = {}) => deliveryClient.get("/food/notifications/inbox", { params, ...config }),
  markAsRead: (id, config = {}) => deliveryClient.patch(`/food/notifications/${String(id)}/read`, {}, config),
  dismiss: (id, config = {}) => deliveryClient.delete(`/food/notifications/${String(id)}`, config),
  dismissAll: (config = {}) => deliveryClient.delete("/food/notifications/inbox/all", config),
};

export const publicGetOnce = (url, config = {}) => userClient.get(url, config);
export const publicAPI = {
  getPrivacy: (key = "privacy") => userClient.get(`/food/pages/${key}`),
  getTerms: (key = "terms") => userClient.get(`/food/pages/${key}`),
  getPage: (key) => userClient.get(`/food/pages/${key}`),
  getBusinessSettings: () => userClient.get("/food/admin/business-settings/public"),
};
