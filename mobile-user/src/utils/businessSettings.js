/** Port of web utils/businessSettings.js (favicon/title parts are browser-only and dropped). */
import { publicGetOnce } from "../api";
import { BACKEND_ORIGIN } from "../config";
import { readScopedCachedValue, removeScopedValue, writeScopedCachedValue } from "./storage";
import { dispatchAppEvent } from "./events";

const SETTINGS_SCOPE = "settings";
const SETTINGS_KEY = "business";
const SETTINGS_TTL_MS = 6 * 60 * 60 * 1000;

const normalizeUrl = (url) => {
  if (!url || typeof url !== "string") return url;
  if (url.startsWith("http")) return url;
  return `${BACKEND_ORIGIN}${url.startsWith("/") ? "" : "/"}${url}`;
};

export const normalizeSettingsUrls = (settings) => {
  if (!settings) return settings;
  const s = { ...settings };
  ["logo", "userLogo", "restaurantLogo", "deliveryLogo", "favicon", "termsAndConditionsPdf"].forEach((k) => {
    if (s[k]?.url) s[k] = { ...s[k], url: normalizeUrl(s[k].url) };
  });
  return s;
};

let cachedSettings = readScopedCachedValue(SETTINGS_SCOPE, SETTINGS_KEY) || null;
let inFlightSettingsPromise = null;

export const loadBusinessSettings = async () => {
  try {
    if (inFlightSettingsPromise) return await inFlightSettingsPromise;
    inFlightSettingsPromise = (async () => {
      const response = await publicGetOnce("/food/admin/business-settings/public", { noCache: true });
      const rawSettings = response?.data?.data || response?.data;
      if (rawSettings) {
        const settings = normalizeSettingsUrls(rawSettings);
        cachedSettings = settings;
        writeScopedCachedValue(SETTINGS_SCOPE, SETTINGS_KEY, settings, { ttlMs: SETTINGS_TTL_MS });
        dispatchAppEvent("businessSettingsUpdated");
        return settings;
      }
      return cachedSettings;
    })();
    return await inFlightSettingsPromise;
  } catch {
    return cachedSettings;
  } finally {
    inFlightSettingsPromise = null;
  }
};

export const setCachedSettings = (settings) => {
  if (!settings) return;
  cachedSettings = normalizeSettingsUrls(settings);
  writeScopedCachedValue(SETTINGS_SCOPE, SETTINGS_KEY, cachedSettings, { ttlMs: SETTINGS_TTL_MS });
  dispatchAppEvent("businessSettingsUpdated");
};
export const clearCache = () => {
  cachedSettings = null;
  removeScopedValue(SETTINGS_SCOPE, SETTINGS_KEY);
};
export const getCachedSettings = () => cachedSettings;
export const getCompanyName = () => getCachedSettings()?.companyName || "Jharkhand Rasoi";
export const getCompanyNameAsync = async () => {
  try {
    const settings = await loadBusinessSettings();
    return settings?.companyName || "Jharkhand Rasoi";
  } catch {
    return "Jharkhand Rasoi";
  }
};
