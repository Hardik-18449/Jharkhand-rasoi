/** Port of Frontend/src/shared/utils/media.js */
import { BACKEND_ORIGIN } from "../config";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const FILE_LIKE_REGEX = /\.(png|jpe?g|webp|gif|bmp|svg|pdf|mp4|webm|mov|avi|mkv|bin)(\?.*)?$/i;
const UPLOADS_SEGMENT_REGEX = /(?:^|\/)(?:api\/v\d+\/)?uploads\//i;

export const PLACEHOLDER_URL = "";

const toUploadsPath = (rawPath) => {
  const trimmed = String(rawPath || "").trim();
  if (!trimmed) return "";
  const [withoutHash] = trimmed.split("#");
  const [pathnamePart, query = ""] = withoutHash.split("?");
  const normalizedPath = pathnamePart.replace(/\\/g, "/");
  if (/^\/?(assets|static)\//i.test(normalizedPath)) return "";
  const uploadsMatch = normalizedPath.match(UPLOADS_SEGMENT_REGEX);
  if (uploadsMatch) {
    const uploadIndex = uploadsMatch.index + uploadsMatch[0].lastIndexOf("uploads/");
    const uploadPath = `/${normalizedPath.slice(uploadIndex).replace(/^\/+/, "")}`;
    return `${uploadPath}${query ? `?${query}` : ""}`;
  }
  const fileName = normalizedPath.split("/").filter(Boolean).pop();
  if (!fileName || !FILE_LIKE_REGEX.test(fileName)) return "";
  return `/uploads/${fileName}${query ? `?${query}` : ""}`;
};

const parseUrl = (value) => {
  const m = String(value).match(/^(https?):\/\/([^/?#]+)([^?#]*)(\?[^#]*)?/i);
  if (!m) return null;
  return { hostname: m[2].split(":")[0], pathname: m[3] || "/", search: m[4] || "" };
};

export const getMediaUrl = (path) => {
  if (!path || typeof path !== "string") return PLACEHOLDER_URL;
  const trimmed = path.trim();
  if (!trimmed) return PLACEHOLDER_URL;
  if (trimmed.startsWith("blob:") || trimmed.startsWith("data:") || trimmed.startsWith("file:")) return trimmed;

  let normalizedUploadsPath = "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    const url = parseUrl(trimmed);
    if (!url) return trimmed;
    const isLocalHost = LOCAL_HOSTS.has(url.hostname);
    const looksLikeUpload = UPLOADS_SEGMENT_REGEX.test(url.pathname);
    if (!isLocalHost && !looksLikeUpload) return trimmed;
    normalizedUploadsPath = toUploadsPath(`${url.pathname}${url.search}`);
    if (!normalizedUploadsPath) return trimmed;
  } else {
    normalizedUploadsPath = toUploadsPath(trimmed);
    if (!normalizedUploadsPath) return trimmed;
  }
  return `${BACKEND_ORIGIN}${normalizedUploadsPath}`;
};

/** Web OptimizedImage: Cloudinary transform for a width. Keeps same URL rules. */
export const getOptimizedImageUrl = (src, width = 800) => {
  const url = getMediaUrl(src);
  if (!url || !/^https?:\/\//.test(url)) return url;
  if (/xv4gkshv/i.test(url)) return url;
  if (/res\.cloudinary\.com/i.test(url) && /\/image\/upload\//i.test(url)) {
    const hasTransform = /\/image\/upload\/(?:f_|q_|w_|h_|c_|dpr_|g_)/i.test(url);
    if (!hasTransform) return url.replace("/image/upload/", `/image/upload/f_auto,q_80,w_${width}/`);
  }
  return url;
};
