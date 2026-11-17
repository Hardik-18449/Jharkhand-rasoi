/** Port of web utils/common.js */
import { getMediaUrl } from "./media";

export const normalizeImageUrl = (imageUrl, backendOrigin = "") => {
  if (typeof imageUrl !== "string") return "";
  const trimmed = imageUrl.trim();
  if (!trimmed || /^data:/i.test(trimmed) || /^blob:/i.test(trimmed)) return trimmed;
  const resolved = getMediaUrl(trimmed);
  if (!backendOrigin || !String(resolved).startsWith("/uploads/")) return resolved;
  return `${String(backendOrigin).replace(/\/$/, "")}${resolved}`;
};

export const extractImages = (source, backendOrigin = "") => {
  if (!source) return [];
  const normalize = (val) => {
    if (!val) return "";
    if (typeof val === "string") return normalizeImageUrl(val, backendOrigin);
    if (Array.isArray(val)) return val.length ? normalize(val[0]) : "";
    if (typeof val === "object") {
      const src = val.url || val.secure_url || val.imageUrl || val.image || val.src || "";
      return typeof src === "string" ? normalizeImageUrl(src, backendOrigin) : "";
    }
    return "";
  };
  return (Array.isArray(source) ? source.map(normalize) : [normalize(source)]).filter(Boolean);
};

export const calculateDistance = (lat1, lng1, lat2, lng2) => {
  if (!lat1 || !lng1 || !lat2 || !lng2) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.35;
};

export const formatDistance = (km) => {
  if (km === null || km === undefined) return "1.2 km";
  return km >= 1 ? `${km.toFixed(1)} km` : `${Math.round(km * 1000)} m`;
};

export const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

/** Discount % for an item from restaurant itemDiscounts / discountRules / flat discount (shared by Under250 + others). */
export const getItemDiscountPercent = (restaurant, item) => {
  let pct = restaurant?.discount || 0;
  const specific = (restaurant?.itemDiscounts || []).find((d) => String(d.itemId) === String(item.id || item._id));
  if (specific) pct = specific.discountValue || 0;
  else {
    const rule = (restaurant?.discountRules || []).find((r) => {
      const v = Number(r.conditionValue);
      return (r.conditionType === "PRICE_ABOVE" && item.price > v) || (r.conditionType === "PRICE_BELOW" && item.price < v);
    });
    if (rule) pct = rule.discountValue || 0;
  }
  return pct;
};
