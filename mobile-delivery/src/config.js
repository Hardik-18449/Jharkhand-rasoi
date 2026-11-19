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
/** Sent as X-Android-Package / X-Android-Cert to Google web APIs (Routes) so an Android-app-restricted key is accepted.
 *  SHA-1 of the signing certificate, no colons. Default = current test (debug) signing cert; set EXPO_PUBLIC_ANDROID_CERT_SHA1 for the release key. */
export const ANDROID_PACKAGE = "com.jharkhandrasoi.delivery";
export const ANDROID_CERT_SHA1 = String(process.env.EXPO_PUBLIC_ANDROID_CERT_SHA1 || "5E8F16062EA3CD2C4A0D547876BAA6F38CABF625").trim();
