# MEMORY — mobile-restaurant (Jharkhand Rasoi restaurant partner app, Expo/Android)

## 1. What this app is
- Native Android conversion of the **restaurant** role of the Jharkhand Rasoi MERN web app.
- Converted from: web `../Frontend/src/modules/Food/pages/restaurant/*`, `components/restaurant/*`, `hooks/useRestaurantNotifications.js`, `hooks/usePaginatedRestaurantOrders.js`, `services/api` (`restaurantAPI`, restaurant OTP in `auth.js`). Backend `../Backend` untouched.
- Scaffold (UI kit, storage, toast, theme, fonts, build setup) copied from `../mobile-user` and adapted.

## 2. Discovered inputs
| | Value | From |
|---|---|---|
| App name | Jharkhand Rasoi Restaurant | assumption A1 (web title "Restaurant Partner") |
| Package | `com.jharkhandrasoi.restaurant` | `mobile-restaurant/google-services.json` |
| Version | 1.0.0 (versionCode 1) | user app |
| API base / socket | `https://jharkhandrasoi.com/api/v1` / `https://jharkhandrasoi.com` | `.env` (`EXPO_PUBLIC_*`) |
| Brand colour | `#B80B3D` (strong `#66001D`, soft `#fdf2f5`) | `components/restaurant/restaurantTheme.css` |

## 3. Stack
Same as mobile-user (Expo SDK 58, RN 0.88, Expo Router, Hermes, New Arch). Removed: maps, razorpay, speech recognition, location, print/sharing. Uses: axios, socket.io-client, expo-secure-store, AsyncStorage, expo-notifications, expo-audio (order ring loop), @react-native-community/datetimepicker, expo-image, lucide icons.

## 4. Structure
```
app/
  _layout.jsx            providers (Theme, RestaurantNotificationProvider), push, PickupOtpModal, session-expiry → /login
  index.jsx              gate: not logged in → /login; onboarding incomplete → /pending-verification?mode=onboarding; else tabs
  login.jsx, otp.jsx, pending-verification.jsx
  (tabs)/_layout.jsx     RestaurantBlockGuard (30 s) + crimson bottom bar (Orders/Inventory/Feedback/Explore)
  (tabs)/index.jsx       OrdersMain: banners, status chips, lists, new-order popup (accept/reject/auto-reject), search
  (tabs)/inventory.jsx   menu stock toggles + stock rules, recommended, add-ons/combos availability
  (tabs)/feedback.jsx    complaints + reviews
  (tabs)/explore.jsx     hub: online switch, sections, profile, logout, delete account
  orders/[id].jsx, orders-history.jsx, delivery-settings.jsx, notifications.jsx, terms.jsx, privacy.jsx
src/
  api/client.js          restaurantClient (Bearer, refresh via /food/auth/refresh-token, no zone headers)
  api/index.js           restaurantAPI (same endpoints/normalisation as web), notificationAPI, publicAPI
  auth/session.js        SecureStore keys restaurant_accessToken / restaurant_refreshToken / restaurant_user; role RESTAURANT
  context/RestaurantNotificationContext.jsx   socket + 8 s poll + ring loop + order queue + pickup OTP (web useRestaurantNotifications)
  components/RestaurantHeader.jsx, components/orders/{OrderCard,OrdersList,NewOrderPopup}.jsx, PickupOtpModal.jsx
  hooks/usePaginatedRestaurantOrders.js, hooks/useNotificationInbox.js
  utils/onlineStatus.js  "restaurant_online_status" + "restaurantStatusChanged" event
```

## 5. Auth
Phone OTP: `POST /food/auth/restaurant/request-otp {phone}` → `verify-otp {phone, otp, fcmToken?, platform:"mobile"}`.
Result: `needsRegistration` → web registration notice; `pendingApproval` → pending screen; else `accessToken + user` → `setAuthData`. Logout: remove push device → `POST /food/auth/logout` → clear.

## 6. Real-time orders
- Socket: `join-restaurant <restaurantId>`; events `new_order`, `order_status_update`, `pickup_otp_reveal`, `play_notification_sound`, `new_dining_booking`, `food_approval_status`, `notification`, `admin_notification`.
- Poll fallback every 8 s (`status=confirmed` → alert + queue; cancellation + pickup-OTP fallbacks), foreground refresh on AppState active.
- Popup: 180 s countdown → auto-reject "No response from restaurant (Auto-rejected)"; accept = `PATCH …/status {orderStatus:"preparing"}` (400 → "confirmed"); reject = `cancelled_by_restaurant` + note.
- Ring: `assets/audio/restaurant_order_ring.wav` every 6 s up to 2 min + vibration; mute button.

## 7. Web → native decisions (also in CONVERSION_CHECKLIST.md §4)
- D1 Registration/onboarding (web Onboarding.jsx 4 steps, documents, bank) stays on the website — app opens `${origin}/food/restaurant/onboarding`.
- D2 Creating/editing dishes, add-ons, combos stays on web; app does stock/availability/recommended.
- D3 Explore links not yet native open the web dashboard page (marked "Web"): outlet info/timings, menu categories, promo codes, zone setup, support, share feedback, payout/invoices/bank details, edit owner.
- D4 Web "Reverify" button calls a non-existent `restaurantAPI.reverify` → not shown; rejection reasons shown with "contact support".
- D5 Thermal-receipt print (web window.print) not carried.
- Order details opens as a screen (web: bottom sheet + /orders/:id page).

## 8. Commands
```
cd mobile-restaurant
npx expo export --platform android        # JS check
npx expo prebuild --platform android --no-install
# Local build (Windows, short path mirror D:\jr2 — same setup as mobile-user/MEMORY.md §9)
robocopy "D:\Projects\Jharkhand-rasoi\mobile-restaurant" "D:\jr2" /MIR /XD "<repo>\mobile-restaurant\android\build" "<repo>\mobile-restaurant\android\app\build" "<repo>\mobile-restaurant\.expo" "<repo>\mobile-restaurant\dist" "D:\jr2\android" /XF *.apk
# Use FULL paths in /XD: a bare "dist" also skips node_modules/**/dist (e.g. @jridgewell/gen-mapping) → settings.gradle autolinking fails.
# "D:\jr2\android" is excluded so local.properties / gradle.properties edits survive; after a new prebuild copy android/ once by hand.
cd D:\jr2\android; .\gradlew.bat assembleRelease -Pandroid.enableMinifyInReleaseBuilds=false -Pandroid.enableShrinkResourcesInReleaseBuilds=false
adb install -r app\build\outputs\apk\release\app-release.apk
```
`D:\jr2\android\local.properties`: `sdk.dir=D:/Android/Sdk`, `cmake.dir=D:/Android/Sdk/cmake/3.31.6`; `gradle.properties`: `reactNativeArchitectures=arm64-v8a,armeabi-v7a`. **Re-check both after every prebuild/sync** — if missing, Gradle falls back to CMake 3.22.1 (ninja long-path failure) and builds 4 ABIs. Minify must stay off.

## 9. Known issues / status
- `google-services.json` (Firebase project jharkhandrasoi12, has both restaurant + user Android apps) added 2026-11-18 → FCM push enabled. Add the release keystore SHA-1 in Firebase once a signing key exists.
- APK is debug-signed (no restaurant keystore yet). EAS project not created (`eas init` needed for cloud builds).
- No restaurant test account → logged-in screens are "Built, not tested" until a test phone/OTP is provided.
