/**
 * Native push — replaces web firebaseMessaging.js (web push) and the Flutter-bridge FCM path.
 * - Registers the FCM device token with the backend using the same contract the WebView wrapper used:
 *   POST /fcm-tokens/device/save { fcmToken, pushPlatform:"mobile", devicePlatform:"android" } (after login)
 * - Foreground: toast + inbox refresh; tapped (background/killed): deep-link to the order/notifications screen.
 */
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { restaurantAPI as userAPI } from "../api";
import { getModuleFcmToken, getModuleToken, setModuleFcmToken } from "../auth/session";
import { toast } from "../utils/toast";
import { dispatchNotificationInboxRefresh } from "../hooks/useNotificationInbox";
import { dispatchAppEvent } from "../utils/events";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let cachedDeviceToken = null;

export async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "New orders & updates",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#FEC600",
  });
}

/** Ask permission (only when called — i.e. after login, like web's first registration) and get FCM token. */
export async function getFcmDeviceToken({ ask = true } = {}) {
  if (!Device.isDevice) return null;
  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted" && ask) {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== "granted") return null;
    await ensureAndroidChannel();
    const tokenData = await Notifications.getDevicePushTokenAsync();
    const token = String(tokenData?.data || "").trim();
    if (token.length >= 20) cachedDeviceToken = token;
    return cachedDeviceToken;
  } catch {
    return null;
  }
}

/** Register (or re-register when changed) with the backend. Safe to call often. */
export async function registerPushDevice({ ask = true } = {}) {
  if (!getModuleToken()) return null;
  const token = await getFcmDeviceToken({ ask });
  if (!token) return null;
  try {
    await userAPI.savePushDevice({ fcmToken: token, pushPlatform: "mobile", devicePlatform: Platform.OS });
    setModuleFcmToken(token);
    return token;
  } catch {
    return null;
  }
}

export async function unregisterPushDevice() {
  const token = getModuleFcmToken() || cachedDeviceToken;
  if (!token) return;
  try {
    await userAPI.removePushDevice({ fcmToken: token, pushPlatform: "mobile", devicePlatform: Platform.OS });
  } catch {}
}

function extractData(notification) {
  const content = notification?.request?.content || {};
  const data = content.data || {};
  return { title: content.title || data.title || "Notification", body: content.body || data.message || data.body || "", data };
}

export function routeForNotificationData(data = {}) {
  const orderId = data.orderMongoId || data.orderId || data.order_id;
  const type = String(data.type || data.category || "").toLowerCase();
  if (orderId && (!type || /order|delivery/.test(type))) return `/orders/${orderId}`;
  if (data.link && typeof data.link === "string" && data.link.startsWith("/")) return data.link.replace(/^\/food\/restaurant/, "").replace(/^\/restaurant/, "") || "/";
  return "/notifications";
}

/** Attach listeners; returns cleanup. `navigate(path)` is supplied by the root layout. */
export function attachNotificationListeners(navigate) {
  const received = Notifications.addNotificationReceivedListener((notification) => {
    const { title, body, data } = extractData(notification);
    toast.message(title, { description: body, duration: 6000 });
    dispatchNotificationInboxRefresh();
    dispatchAppEvent("pushNotificationReceived", { title, body, data });
    if (data?.orderId || data?.orderMongoId) {
      dispatchAppEvent("orderStatusNotification", {
        orderMongoId: data.orderMongoId,
        orderId: data.orderId,
        status: data.orderStatus || data.status,
        orderStatus: data.orderStatus || data.status,
        title,
        message: body,
        timestamp: new Date().toISOString(),
      });
    }
  });
  const responded = Notifications.addNotificationResponseReceivedListener((response) => {
    const { data } = extractData(response?.notification);
    navigate(routeForNotificationData(data));
  });
  // App opened from killed state by tapping a notification
  Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (response) {
        const { data } = extractData(response.notification);
        setTimeout(() => navigate(routeForNotificationData(data)), 400);
      }
    })
    .catch(() => {});
  return () => {
    received.remove();
    responded.remove();
  };
}

/** Token refresh (FCM rotates tokens) → re-save. */
export function attachTokenRefreshListener() {
  try {
    const sub = Notifications.addPushTokenListener((tokenData) => {
      const token = String(tokenData?.data || "").trim();
      if (token && token !== getModuleFcmToken()) registerPushDevice({ ask: false });
    });
    return () => sub.remove();
  } catch {
    return () => {};
  }
}
