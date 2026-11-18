/**
 * Single API client — port of web services/api/axios.js (`restaurantClient`).
 * - baseURL from config, 30 s timeout, Bearer token (restaurant module)
 * - 401 → one refresh (queued retries) → on failure clear session + `authRefreshFailed`
 * - 403 → `accessDenied` event, no logout; 429 passthrough
 * - never auto-retries POST/PUT/PATCH/DELETE (retry after refresh re-sends the same single request once, like web)
 */
import axios from "axios";
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "../config";
import {
  clearModuleAuth,
  getModuleRefreshToken,
  getModuleToken,
  setModuleAccessToken,
  setModuleRefreshToken,
} from "../auth/session";
import { dispatchAppEvent } from "../utils/events";

export function formatApiError(err) {
  if (err?.response) {
    const status = err.response.status;
    const responseData = err.response.data;
    const backendMessage =
      responseData && typeof responseData === "object" && !Array.isArray(responseData)
        ? responseData.message || responseData.error
        : null;
    let friendlyMessage = backendMessage || err.message;
    const isGeneric =
      !backendMessage ||
      friendlyMessage.includes("AxiosError") ||
      friendlyMessage.includes("Request failed with status code") ||
      friendlyMessage.includes("Unexpected token") ||
      friendlyMessage.includes("<html");
    if (status === 413) friendlyMessage = "File size is too large. Please upload an image under 2MB.";
    else if (status === 409) friendlyMessage = backendMessage || "This item or detail is already registered.";
    else if (isGeneric) {
      if (status === 400) friendlyMessage = "Invalid request. Please check your inputs.";
      else if (status === 401) friendlyMessage = "Unauthorized. Please login again.";
      else if (status === 403) friendlyMessage = "Access denied. You don't have permission.";
      else if (status === 404) friendlyMessage = "Requested data not found.";
      else if (status === 429) friendlyMessage = "Too many requests. Please wait a moment.";
      else if (status === 502) friendlyMessage = "Server is temporarily unavailable. Please try again in a moment.";
      else if (status >= 500)
        friendlyMessage = backendMessage && !backendMessage.includes("<html") ? backendMessage : "Server error. Please try again later.";
      else friendlyMessage = "An unexpected error occurred.";
    }
    if (!responseData || typeof responseData !== "object" || Array.isArray(responseData)) {
      err.response.data = { message: friendlyMessage, error: friendlyMessage, raw: responseData };
    } else {
      err.response.data.message = friendlyMessage;
      if (!err.response.data.error) err.response.data.error = friendlyMessage;
    }
    err.message = friendlyMessage;
  } else if (err?.code === "ECONNABORTED" || /timeout/i.test(String(err?.message))) {
    err.message = "Request timed out. Please check your internet connection.";
    err.isNetworkError = true;
  } else if (err?.request) {
    err.message = "Network error. Please check your internet connection.";
    err.isNetworkError = true;
  } else if (!err?.message) {
    err.message = "An unexpected error occurred.";
  }
  return err;
}

function createClient() {
  const client = axios.create({
    baseURL: API_BASE_URL,
    timeout: REQUEST_TIMEOUT_MS,
    headers: { "Content-Type": "application/json" },
  });

  let isRefreshing = false;
  let subscribers = [];
  const subscribeToRefresh = (cb) => subscribers.push(cb);
  const onRefreshed = (newToken) => {
    subscribers.forEach((cb) => cb(newToken));
    subscribers = [];
  };
  const onRefreshFailed = () => {
    clearModuleAuth();
    subscribers.forEach((cb) => cb(null));
    subscribers = [];
    dispatchAppEvent("authRefreshFailed", { module: "restaurant" });
  };

  client.interceptors.request.use((config) => {
    config.contextModule = "restaurant";
    if (config.data instanceof FormData) {
      if (config.headers && config.headers["Content-Type"]) delete config.headers["Content-Type"];
    }
    const token = getModuleToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    async (err) => {
      const original = err?.config;
      if (err?.response?.status === 429) return Promise.reject(err);
      if (err?.response?.status === 403) {
        dispatchAppEvent("accessDenied", { module: "restaurant" });
        return Promise.reject(formatApiError(err));
      }
      if (err?.response?.status !== 401 || !original || original._retry) {
        return Promise.reject(formatApiError(err));
      }
      const refreshToken = getModuleRefreshToken();
      if (!refreshToken) {
        onRefreshFailed();
        return Promise.reject(formatApiError(err));
      }
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          subscribeToRefresh((newToken) => {
            if (newToken) {
              original.headers.Authorization = `Bearer ${newToken}`;
              resolve(client(original));
            } else reject(formatApiError(err));
          });
        });
      }
      original._retry = true;
      isRefreshing = true;
      try {
        const { data } = await axios.post(`${API_BASE_URL}/food/auth/refresh-token`, { refreshToken }, { timeout: 10000 });
        const newAccessToken = data?.data?.accessToken || data?.accessToken;
        if (newAccessToken) {
          setModuleAccessToken(newAccessToken);
          const returnedRefreshToken = data?.data?.refreshToken || data?.refreshToken;
          if (returnedRefreshToken && typeof returnedRefreshToken === "string") setModuleRefreshToken(returnedRefreshToken);
          dispatchAppEvent("authRefreshed", { module: "restaurant", token: newAccessToken });
          onRefreshed(newAccessToken);
          original.headers.Authorization = `Bearer ${newAccessToken}`;
          return client(original);
        }
      } catch {
        onRefreshFailed();
        return Promise.reject(formatApiError(err));
      } finally {
        isRefreshing = false;
      }
      onRefreshFailed();
      return Promise.reject(formatApiError(err));
    },
  );
  return client;
}

export const restaurantClient = createClient();
/** Public endpoints use the same client (web used userClient; no user token exists in this app). */
export const userClient = restaurantClient;
export default restaurantClient;
