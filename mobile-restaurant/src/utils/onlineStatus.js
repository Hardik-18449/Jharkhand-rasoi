/** web DeliverySettings syncStatusLocally: persist + notify header ("restaurantStatusChanged"). */
import { dispatchAppEvent } from "./events";
import { localStore } from "./storage";

export const ONLINE_STATUS_KEY = "restaurant_online_status";
export const syncOnlineStatus = (isOnline) => {
  localStore.setItem(ONLINE_STATUS_KEY, JSON.stringify(Boolean(isOnline)));
  dispatchAppEvent("restaurantStatusChanged", { isOnline: Boolean(isOnline) });
};
