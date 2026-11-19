# MEMORY — mobile-delivery (Jharkhand Rasoi delivery partner app, Expo/Android)

## 1. What this app is
- Native Android conversion of the **delivery partner** role of the Jharkhand Rasoi MERN web app.
- Converted from: web `../Frontend/src/modules/DeliveryV2/*` (DeliveryHomeV2, OrdersV2, PocketV2, HistoryV2, ProfileV2, modals, store, hooks, utils), `Food/hooks/useDeliveryNotifications.js`, `Food/utils/orderDispatchId.js`, `services/api` (`deliveryAPI`, delivery OTP). Backend untouched.
- Scaffold copied from `../mobile-restaurant` (itself from `../mobile-user`).

## 2. Inputs
| | Value | From |
|---|---|---|
| App name | Jharkhand Rasoi Delivery | assumption A1 |
| Package | `com.jharkhandrasoi.delivery` | `google-services.json` |
| API / socket | `https://jharkhandrasoi.com/api/v1` / `https://jharkhandrasoi.com` | `.env` |
| Maps | `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` (native map + Directions) | `.env` |
| Colours | header `#FEC600`, accent `#FF5500`, bg `#FAF5F0` | `DeliveryV2/deliveryTheme.css` |
| JWT role | `DELIVERY_PARTNER` | web `utils/auth.js` |

## 3. Stack additions vs restaurant app
react-native-maps (Google), expo-location + expo-task-manager (foreground-service background location), expo-keep-awake, expo-image-picker (shift selfie). No zustand: `src/delivery/store.js` re-implements the web store with `useSyncExternalStore` (only `isOnline` persisted, key `delivery-v2-online-pref`).

## 4. Structure
```
app/_layout.jsx           providers (DeliveryNotificationProvider), imports locationTracking (task registration), splash
app/index.jsx             gate → /login or /(tabs)
app/login|otp|pending-verification|notifications|terms|privacy.jsx   (reused from restaurant app, delivery endpoints/text)
app/(tabs)/_layout.jsx    Home / Earnings / Orders / Profile (orange active, order badge)
app/(tabs)/index.jsx      DeliveryHomeV2 feed: header + online switch, map, offers, trip panels, verification, summary, SOS
app/(tabs)/orders.jsx     OrdersV2 (offers, active deliveries, delivered)
app/(tabs)/pocket.jsx     PocketV2 + PocketBalanceV2 withdraw
app/(tabs)/profile.jsx    ProfileV2 (+ logout → offline, stop tracking)
app/history.jsx           HistoryV2
src/delivery/             store.js, orderUtils.js (pure web helpers), DeliveryNotificationContext.jsx (socket + alert),
                          useTrip.js (useOrderManager + useProximityCheck), useOffers.js (queue actions),
                          locationTracking.js (background GPS task), LiveMap.jsx, TripModals.jsx, ActionSlider.jsx
```

## 5. Trip flow (same API as web)
offer (socket `new_order` / `new_order_available` / resync `pending_offers` / 15–45 s poll `orders/available`) → accept `PATCH orders/:id/accept`
→ PICKING_UP → `reached-pickup` → REACHED_PICKUP → (`request-pickup-otp` + 4-digit OTP | skip) `confirm-pickup` → PICKED_UP
→ `reached-drop` → REACHED_DROP → `verify-drop-otp` → payment (cash | `payment-qr` + poll `payment-status`) → `complete` → COMPLETED summary.
Pass = `PATCH orders/:id/pass`. Offer timer 60 s → auto-pass. Geofence auto-arrival at 100 m. Range lock 1500 m.
Live location: socket `join-tracking` + `update-location` (10 m / 4 s) + availability PATCH every 45 s.

## 6. Deviations (also in CONVERSION_CHECKLIST.md)
- D1 Signup (SignupStep1/2, documents) on the website (pending screen opens it).
- D2 Firebase RTDB offer listener + `writeDeliveryLocation` not used; socket + REST recovery/polling deliver offers, socket carries tracking.
- D3 Profile details / bank / documents / support tickets / ID card open the web dashboard.
- D4 Earnings shows real data only (web showed invented fallback trips / weekly bars / 14.5 h when its non-existent `getHistory` call failed).
- D5 Cash deposit not offered (web called non-existent `initiateDeposit`).
- D6 Dev simulation mode (web DEV only) not carried.
- D7 Native background location (foreground service) replaces web wake-lock / silent-audio keep-alive.

## 7. Build (Windows, mirror D:\jr3)
Same as mobile-restaurant MEMORY §8 with `D:\jr3`. After every prebuild/sync re-check `D:\jr3\android\local.properties` (`cmake.dir=D:/Android/Sdk/cmake/3.31.6`) and `reactNativeArchitectures=arm64-v8a,armeabi-v7a`. Minify off.

## 8. Known issues / status
- `google-services.json` (project jharkhandrasoi12, contains delivery + restaurant + user apps) added 2026-11-19 → FCM push enabled. Add the release keystore SHA-1 in Firebase once a signing key exists.
- Debug-signed APK. No delivery test account → logged-in screens Built, not tested.
- 2026-11-19: D: drive (43 GB) filled up during the build ("LLVM ERROR: No space left on device" from llvm-strip, ninja hung). Fix: delete regenerable build dirs in the other mirrors (`android/app/build`, `android/.gradle`, `node_modules/*/android/{build,.cxx}`) before building. Each mirror's build output is ~5 GB.
