/**
 * Auth session — port of web `utils/auth.js` for the "restaurant" module only.
 * Tokens + user live in expo-secure-store, mirrored in memory so checks are synchronous.
 * `bootstrapSession()` runs once at app start.
 */
import * as SecureStore from "expo-secure-store";
import { localStore } from "../utils/storage";
import { dispatchAppEvent } from "../utils/events";

const KEYS = {
  accessToken: "restaurant_accessToken",
  refreshToken: "restaurant_refreshToken",
  user: "restaurant_user",
  authenticated: "restaurant_authenticated",
  fcmToken: "fcm_registered_token_restaurant",
};

const mem = {
  accessToken: null,
  refreshToken: null,
  user: null,
  authenticated: false,
  fcmToken: null,
};
let booted = false;

const secureGet = async (k) => {
  try {
    return await SecureStore.getItemAsync(k);
  } catch {
    return null;
  }
};
const secureSet = (k, v) => {
  if (v == null || v === "") return SecureStore.deleteItemAsync(k).catch(() => {});
  return SecureStore.setItemAsync(k, String(v)).catch(() => {});
};

export async function bootstrapSession() {
  if (booted) return;
  const [a, r, u, auth, fcm] = await Promise.all([
    secureGet(KEYS.accessToken),
    secureGet(KEYS.refreshToken),
    secureGet(KEYS.user),
    secureGet(KEYS.authenticated),
    secureGet(KEYS.fcmToken),
  ]);
  mem.accessToken = a || null;
  mem.refreshToken = r || null;
  try {
    mem.user = u ? JSON.parse(u) : null;
  } catch {
    mem.user = null;
  }
  mem.authenticated = auth === "true";
  mem.fcmToken = fcm || null;
  booted = true;
}

export function isSessionBooted() {
  return booted;
}

/* ---------- JWT helpers (same as web) ---------- */
function base64Decode(str) {
  try {
    if (typeof atob === "function") return atob(str);
  } catch {}
  // minimal fallback
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let output = "";
  let i = 0;
  str = str.replace(/[^A-Za-z0-9+/=]/g, "");
  while (i < str.length) {
    const e1 = chars.indexOf(str.charAt(i++));
    const e2 = chars.indexOf(str.charAt(i++));
    const e3 = chars.indexOf(str.charAt(i++));
    const e4 = chars.indexOf(str.charAt(i++));
    const c1 = (e1 << 2) | (e2 >> 4);
    const c2 = ((e2 & 15) << 4) | (e3 >> 2);
    const c3 = ((e3 & 3) << 6) | e4;
    output += String.fromCharCode(c1);
    if (e3 !== 64) output += String.fromCharCode(c2);
    if (e4 !== 64) output += String.fromCharCode(c3);
  }
  return output;
}

export function decodeJwtPayload(token) {
  if (!token || typeof token !== "string") return null;
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    return JSON.parse(decodeURIComponent(escape(base64Decode(padded))));
  } catch {
    try {
      const [, payload] = token.split(".");
      const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(base64Decode(normalized));
    } catch {
      return null;
    }
  }
}

export function isTokenExpired(token) {
  const payload = decodeJwtPayload(token);
  if (!payload) return true;
  const exp = Number(payload.exp);
  if (!Number.isFinite(exp) || exp <= 0) return false;
  return exp * 1000 <= Date.now();
}

function tokenCanAccessRestaurant(token) {
  const payload = decodeJwtPayload(token);
  const role = String(payload?.role || "").trim().toUpperCase();
  return role === "RESTAURANT";
}

/* ---------- getters (sync) ---------- */
export const getModuleToken = () => mem.accessToken;
export const getModuleRefreshToken = () => mem.refreshToken;
export const getCurrentUser = () => mem.user;
export const getModuleFcmToken = () => mem.fcmToken;

export function isModuleAuthenticated() {
  const token = mem.accessToken;
  const refreshToken = mem.refreshToken;
  if (token && !isTokenExpired(token) && tokenCanAccessRestaurant(token)) return true;
  if (refreshToken && typeof refreshToken === "string" && !isTokenExpired(refreshToken)) {
    const tokenToCheck = token || refreshToken;
    if (tokenCanAccessRestaurant(tokenToCheck)) return true;
  }
  return false;
}

/** web: localStorage.getItem("restaurant_authenticated") === "true" || !!localStorage.getItem("restaurant_accessToken") */
export const hasUserSession = () => mem.authenticated || Boolean(mem.accessToken);

/* ---------- setters ---------- */
export function setModuleAccessToken(token) {
  mem.accessToken = token || null;
  secureSet(KEYS.accessToken, token || null);
}

export function setModuleRefreshToken(token) {
  mem.refreshToken = token || null;
  secureSet(KEYS.refreshToken, token || null);
}

export function setModuleFcmToken(token) {
  mem.fcmToken = token || null;
  secureSet(KEYS.fcmToken, token || null);
}

export function clearModuleFcmToken() {
  setModuleFcmToken(null);
}

export function setStoredUser(user) {
  mem.user = user || null;
  secureSet(KEYS.user, user ? JSON.stringify(user) : null);
  if (user) localStore.setItem("restaurant_user", JSON.stringify(user));
  else localStore.removeItem("restaurant_user");
}

/** web clearUserSession() */
export function clearUserSession() {
  ["restaurant_user", "restaurant_pickupOtpReveal"].forEach((k) => localStore.removeItem(k));
}

export function setAuthData(token, user, refreshToken = null) {
  if (!token) throw new Error("Invalid parameters: token missing");
  clearUserSession();
  setModuleAccessToken(token);
  if (refreshToken && typeof refreshToken === "string") setModuleRefreshToken(refreshToken);
  mem.authenticated = true;
  secureSet(KEYS.authenticated, "true");
  localStore.setItem("restaurant_authenticated", "true");
  if (user) setStoredUser(user);
  dispatchAppEvent("restaurantAuthChanged");
}

export function clearModuleAuth() {
  mem.accessToken = null;
  mem.refreshToken = null;
  mem.user = null;
  mem.authenticated = false;
  secureSet(KEYS.accessToken, null);
  secureSet(KEYS.refreshToken, null);
  secureSet(KEYS.user, null);
  secureSet(KEYS.authenticated, null);
  localStore.removeItem("restaurant_authenticated");
  clearModuleFcmToken();
  clearUserSession();
  dispatchAppEvent("restaurantAuthChanged");
}

/** web login "Skip for now": localStorage.setItem("restaurant_authenticated","false") */
export function markSkippedLogin() {
  mem.authenticated = false;
  secureSet(KEYS.authenticated, "false");
  localStore.setItem("restaurant_authenticated", "false");
}
