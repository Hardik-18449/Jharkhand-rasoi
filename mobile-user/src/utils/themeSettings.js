/**
 * Port of web utils/themeSettings.js for the user app: reads /app-config/user_app and stores
 * primary/secondary colors + logo. Web applied CSS vars; native exposes them via `getDynamicTheme()`.
 */
import { publicGetOnce } from "../api";
import { localStore } from "./storage";
import { dispatchAppEvent } from "./events";

let dynamicTheme = { primaryColor: null, secondaryColor: null, primaryForeground: null, fontFamily: null, logoUrl: null };

const isLightColor = (hex) => {
  if (!hex || typeof hex !== "string") return false;
  const c = hex.replace("#", "").trim();
  if (c.length < 6) return true;
  const r = parseInt(c.substring(0, 2), 16) || 0;
  const g = parseInt(c.substring(2, 4), 16) || 0;
  const b = parseInt(c.substring(4, 6), 16) || 0;
  return (r * 299 + g * 587 + b * 114) / 1000 > 140;
};

export const getDynamicTheme = () => dynamicTheme;

export const applyDynamicTheme = async () => {
  try {
    const response = await publicGetOnce("/app-config/user_app", { noCache: true }).catch(() => null);
    const activeConfig = response?.data?.data || response?.data;
    if (!activeConfig) return;
    dynamicTheme = {
      primaryColor: activeConfig.primaryColor || null,
      primaryForeground: activeConfig.primaryColor ? (isLightColor(activeConfig.primaryColor) ? "#000000" : "#ffffff") : null,
      secondaryColor: activeConfig.secondaryColor || null,
      fontFamily: activeConfig.fontFamily || null,
      logoUrl: activeConfig.logoUrl || null,
    };
    if (activeConfig.logoUrl) localStore.setItem("user_app_logo", activeConfig.logoUrl);
    dispatchAppEvent("themeLoaded", { updated: true });
  } catch {
    // fall back to defaults
  }
};
