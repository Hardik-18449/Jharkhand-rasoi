/** Port of web context/UserNotificationContext.jsx + hooks/useUserNotifications.js */
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { userAPI } from "../api";
import { toast } from "../utils/toast";
import { dispatchNotificationInboxRefresh } from "../hooks/useNotificationInbox";
import { acquireUserSocket, releaseUserSocket, subscribeUserSocketConnection } from "../utils/userSocketManager";
import { addAppListener, dispatchAppEvent } from "../utils/events";
import { getCurrentRoutePath } from "../utils/routeState";

export const UserNotificationContext = createContext(null);
export const useUserNotificationContext = () => useContext(UserNotificationContext);

const DROP_OTP_DEDUPE_MS = 15000;
const ORDER_STATUS_DEDUPE_MS = 4000;

function useUserNotificationsInner() {
  const [isConnected, setIsConnected] = useState(false);
  const [userId, setUserId] = useState(null);
  const lastDropOtpToastRef = useRef({ key: "", at: 0 });
  const lastOrderStatusToastRef = useRef({ key: "", at: 0 });

  useEffect(() => {
    const fetchUserId = async () => {
      try {
        const response = await userAPI.getProfile();
        if (response.data?.success && response.data.data?.user) {
          const user = response.data.data.user;
          setUserId(user._id?.toString() || user.userId || user.id);
        }
      } catch {
        setUserId(null);
      }
    };
    fetchUserId();
    return addAppListener("userAuthChanged", fetchUserId);
  }, []);

  useEffect(() => {
    if (!userId) return undefined;
    const sock = acquireUserSocket(userId);
    if (!sock) return undefined;
    const unsubConnection = subscribeUserSocketConnection(setIsConnected);

    const onOrderStatus = (data) => {
      const title = data.title || `Order #${data.orderId || "Update"}`;
      const message = data.message || `Your order status is now ${String(data.orderStatus || "").replace(/_/g, " ")}`;
      const isImportant =
        String(data.orderStatus).includes("cancel") ||
        ["confirmed", "preparing", "ready_for_pickup", "ready", "reached_pickup", "picked_up", "reached_drop", "delivered", "dead"].includes(data.orderStatus);
      const isOrderTrackingScreen = String(getCurrentRoutePath() || "").includes("/orders/");
      const statusKey = `${String(data.orderId || "")}:${String(data.orderStatus || "")}`;
      const now = Date.now();
      const isDuplicate = statusKey && statusKey === lastOrderStatusToastRef.current.key && now - lastOrderStatusToastRef.current.at < ORDER_STATUS_DEDUPE_MS;
      if (isImportant && !isOrderTrackingScreen && !isDuplicate) {
        lastOrderStatusToastRef.current = { key: statusKey, at: now };
        toast.message(title, { description: message, duration: 6000 });
      }
      dispatchAppEvent("orderStatusNotification", {
        orderMongoId: data.orderMongoId,
        orderId: data.orderId,
        status: data.orderStatus,
        orderStatus: data.orderStatus,
        title,
        message,
        deliveryState: data.deliveryState,
        deliveryVerification: data.deliveryVerification,
        dispatch: data.dispatch,
        deliveryPartner: data.deliveryPartner,
        deliveryPartnerId: data.deliveryPartnerId,
        timestamp: new Date().toISOString(),
      });
    };
    const onOrderState = (activeOrder) => {
      if (!activeOrder) return;
      dispatchAppEvent("orderStatusNotification", {
        orderMongoId: activeOrder.orderMongoId || activeOrder._id,
        orderId: activeOrder.orderId || activeOrder.order_id,
        status: activeOrder.orderStatus || activeOrder.status,
        orderStatus: activeOrder.orderStatus || activeOrder.status,
        deliveryState: activeOrder.deliveryState,
        deliveryVerification: activeOrder.deliveryVerification,
        dispatch: activeOrder.dispatch,
        resynced: true,
        timestamp: new Date().toISOString(),
      });
    };
    const onDropOtp = (payload) => {
      const otp = payload?.otp != null ? String(payload.otp) : "";
      const orderId = payload?.orderId != null ? String(payload.orderId) : "";
      const message = payload?.message != null ? String(payload.message) : "";
      const otpKey = `${orderId}:${otp}`;
      const now = Date.now();
      const last = lastDropOtpToastRef.current;
      if (otpKey && otpKey === last.key && now - last.at < DROP_OTP_DEDUPE_MS) return;
      lastDropOtpToastRef.current = { key: otpKey, at: now };
      dispatchAppEvent("deliveryDropOtp", { orderMongoId: payload?.orderMongoId, orderId, otp, message });
      const parts = [message, otp ? `OTP: ${otp}` : ""].filter(Boolean);
      toast.message(orderId ? `Order ${orderId}` : "Delivery OTP", { description: parts.join(" — ") || "Handover OTP from your delivery partner.", duration: 12000 });
    };
    const onAdminNotification = (payload) => {
      toast.message(payload?.title || "Notification", { description: payload?.message || "New broadcast notification received.", duration: 8000 });
      dispatchNotificationInboxRefresh();
    };

    sock.on("order_status_update", onOrderStatus);
    sock.on("order_state", onOrderState);
    sock.on("delivery_drop_otp", onDropOtp);
    sock.on("admin_notification", onAdminNotification);
    return () => {
      sock.off("order_status_update", onOrderStatus);
      sock.off("order_state", onOrderState);
      sock.off("delivery_drop_otp", onDropOtp);
      sock.off("admin_notification", onAdminNotification);
      unsubConnection();
      releaseUserSocket();
    };
  }, [userId]);

  return { isConnected };
}

export const UserNotificationProvider = ({ children }) => {
  const existing = useContext(UserNotificationContext);
  const notifications = useUserNotificationsInner();
  // Web nests this provider twice (providers.jsx + UserLayout); the inner one reuses the outer value.
  return <UserNotificationContext.Provider value={existing || notifications}>{children}</UserNotificationContext.Provider>;
};

export const useUserNotifications = () => useContext(UserNotificationContext) || { isConnected: false };
