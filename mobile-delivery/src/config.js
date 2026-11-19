/**
 * App config. All values come from EXPO_PUBLIC_* (public, client-side only).
 * Web equivalents: services/api/config.js, utils/socketOrigin.js, utils/googleMapsApiKey.js
 */
const strip = (v) => String(v || "").trim().replace(/\/+$/, "");

export const API_BASE_URL = strip(process.env.EXPO_PUBLIC_API_BASE_URL) || "https://jharkhandrasoi.com/api/v1";

export const BACKEND_ORIGIN = API_BASE_URL.replace(/\/api(\/v\d+)?\/?$/i, "");

export const SOCKET_BASE_URL = strip(process.env.EXPO_PUBLIC_SOCKET_BASE_URL) || BACKEND_ORIGIN;

export const GOOGLE_MAPS_API_KEY = String(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "").trim();

export const RAZORPAY_KEY_ID = String(process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || "").trim();

export const COMPANY_NAME_DEFAULT = "Jharkhand Rasoi";

export const REQUEST_TIMEOUT_MS = 30000;
