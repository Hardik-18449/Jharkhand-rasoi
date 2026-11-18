# MEMORY — mobile-user (Jharkhand Rasoi user app, Expo/Android)

## 1. What this app is
- Native Android conversion of the **user** role of the Jharkhand Rasoi MERN web app.
- Converted from: web `../Frontend/src/modules/Food` (user pages under `pages/user`, `components/user`, `context`, `hooks`, `utils`) + `../Frontend/src/modules/auth` (login) + `../Frontend/src/services/api` (API layer). Backend: `../Backend` (read-only for this app). No Flutter wrapper existed in the repo.

## 2. Discovered inputs
| | Value | From |
|---|---|---|
| App name | Jharkhand Rasoi | `Frontend/public/manifest.json` |
| Package | `com.jharkhandrasoi.user` | `mobile-user/google-services.json` |
| Version | 1.0.0 | `Frontend/package.json` (no wrapper) |
| API base | `https://jharkhandrasoi.com/api/v1` | user + `Frontend/.env` (`VITE_VPS_UPLOAD_API_BASE_URL`) |
| Socket origin | `https://jharkhandrasoi.com` | derived like web `utils/socketOrigin.js` |
| Maps key, Razorpay key id, Firebase web config | `mobile-user/.env` (copied from `Frontend/.env`) | |
| Push | `mobile-user/google-services.json` (Firebase project `jharkhandrasoi12`) | |

## 3. Stack
- Expo SDK 58 (`expo ~58.0.25`), React Native 0.88, React 19.3, Node 26.13, JavaScript only, Expo Router (file routes in `app/`).
- Main libs: axios (API), socket.io-client (realtime), expo-secure-store (tokens), @react-native-async-storage/async-storage (cache/prefs), expo-location, react-native-maps, expo-notifications + expo-device (FCM push), expo-image-picker, expo-image, expo-font + @expo-google-fonts/{poppins,outfit,inter}, lucide-react-native + react-native-svg (icons), react-native-toast-message (sonner replacement), react-native-razorpay (payments), expo-print + expo-sharing + expo-file-system (invoice), expo-clipboard, @react-native-community/netinfo, react-native-reanimated + react-native-worklets (babel plugin `react-native-worklets/plugin`), dayjs, expo-audio (order-success sound), @react-native-community/datetimepicker, react-native-render-html (legal HTML, no WebView), expo-speech-recognition (voice search, config plugin in app.config.js).
- `.npmrc` has `legacy-peer-deps=true`: Expo CLI's optional `react-dom` peer conflicts with React 19.3.0; harmless for Android, needed so `npm install`/EAS install succeed.

## 4. Folder structure & conventions
```
mobile-user/
  app/                 expo-router routes (one file = one screen). (tabs)/ = bottom-nav screens.
  src/
    api/               client.js (axios + auth/refresh/zone headers), index.js (userAPI, orderAPI, …) — same names as web
    auth/              storage.js (SecureStore), session.js (isAuthenticated, setAuthData, clearAuth, events)
    context/           Cart, Profile, Location, Orders, Notifications, Theme, SearchOverlay — ported from web
    hooks/             ported hooks
    components/        shared UI (PageNavbar, BottomNav is the tab bar, StickyCartCard, OrderTrackingCard, ui/*)
    theme.js           all design tokens (colors, fonts, spacing, radius, shadows) — only source of styling constants
    utils/             storage.js (AsyncStorage namespaced like web `appStorage.js`), location, formatting
    push/              expo-notifications registration + handlers
    config.js          reads EXPO_PUBLIC_* env
  assets/              images copied from web (brandlogo, food dishes, category icons…), fonts via packages
```
- Naming: route files kebab-case; components PascalCase; one default export per screen.
- Add a screen: create `app/<path>.jsx`, wrap in `<Screen>` (safe-area + bg), use `useRouter()`; if protected wrap content in `<RequireAuth>`.
- Navigation paths mirror web minus `/food/user` prefix (web `/food/user/orders/:id` → `/orders/[orderId]`).

## 5. Auth
- Phone OTP, two calls (`request-otp`, `verify-otp`). Tokens + user saved in SecureStore (`user_accessToken`, `user_refreshToken`, `user_user`) by `src/auth/session.js`.
- An in-memory mirror of the tokens is loaded once at startup (`bootstrapSession()` in root layout) so sync checks (`isAuthenticated()`) work like web's localStorage reads.
- `RequireAuth` component = web `ProtectedRoute`: not authenticated → `router.replace('/login?from=<path>')`.
- 401 → one refresh with queued retries (same as web `axios.js`); on failure clear session + emit `authRefreshFailed` → app shows login on next protected screen. Logout = `POST /food/auth/logout` then clear.

## 6. API layer
- `src/api/client.js` exports `userClient` (30 s timeout, Bearer, `X-Zone-Id`/`X-User-Lat`/`X-User-Lng` from stored zone/location, refresh interceptor, `formatApiError` same messages as web). Never auto-retries writes.
- `src/api/index.js` re-creates web `authAPI`, `userAPI`, `orderAPI`, `restaurantAPI` (public subset), `diningAPI`, `zoneAPI`, `locationAPI`, `notificationAPI`, `supportAPI`, `searchAPI`, `publicAPI`, `advertisementAPI`, `uploadAPI`, `getPublic*` cached helpers with the same in-flight/TTL caches.
- Screens call these only; no raw axios in screens.

## 7. Web → native decisions
- Router: expo-router; tab bar reproduces web `BottomNavigation` (Home / Under ₹N / Orders / Profile; Under tab hidden when landing setting `showUnder250=false`). No Dining tab: web phone layout has none (Dining is desktop-navbar only). Scope rule: only screens reachable at phone width — left-out list in CONVERSION_CHECKLIST.md §1.
- Route map: `/restaurants/[slug]`, `/cart`, `/address-selector`, `/orders/[orderId]` (tracking), `/orders/[orderId]/details`, `/complaints/submit/[orderId]`, `/search`, `/categories`, `/category/[category]`, `/gourmet`, `/offers`, `/subscription`, `/wallet`, `/notifications`, `/profile/{edit,coupons,refer-earn,favorites,support,about,report-safety-emergency,terms,privacy,refund,shipping,cancellation}`, `/support-public`, `/login`.
- Live tracking: `src/components/DeliveryTrackingMap.jsx` — socket `location-update` via `useOrderLocationSubscription` (join/leave tracking rooms), Directions REST API for the base route and off-route recalcs (needs **Directions API** enabled on the Maps key).
- Shared bits added during porting: `CartPill`, `Confetti`, `AddMoneySheet`, `HtmlContent`, `LegalPage`, `utils/razorpay.js`, `utils/invoicePdf.js`, `utils/uploadErrors.js`, `hooks/useVoiceSearch.js`.
- Deliberate deviations from web are listed (D1–D8) in CONVERSION_CHECKLIST.md §4 — includes 21 web image assets that are corrupted in git and are `null` in `src/constants/images.js`.
- Storage: SecureStore for tokens/user, AsyncStorage for everything else (cart, location, zone, prefs, caches) with the web key namespace `food:v1:<scope>:<name>`.
- Styling: StyleSheet + `src/theme.js`; tokens copied from `Frontend/src/shared/styles/global.css` + Tailwind classes seen in components.
- Icons: lucide-react-native (same icon names as web).
- Toasts: react-native-toast-message, top position (web: sonner top-center).
- Maps: react-native-maps, Google provider, key from `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` via `app.config.js`.
- Location: expo-location foreground only (web only used foreground `getCurrentPosition`/`watchPosition`).
- Push: expo-notifications `getDevicePushTokenAsync()` (FCM) → `POST /fcm-tokens/device/save { fcmToken, pushPlatform:"mobile", devicePlatform:"android" }` (same as web's Flutter-bridge path). Foreground notifications show toast + refresh inbox; tapped notification deep-links to order if payload has orderId.
- Payments: react-native-razorpay native SDK with the same order flow (`/food/orders` → razorpay order → `verify-payment`).
- Invoice: expo-print → PDF → share sheet (web: jspdf/html2canvas download).
- Voice search: expo-speech-recognition (Android on-device recognizer, `RECORD_AUDIO` permission) — same UX as web Web Speech API.
- Redux dropped: user screens never read the store (only `LocationGuard` wrote to `locationSlice`).
- Dark mode: ThemeContext kept (light default, persisted `userAppTheme`).
- Meta Pixel analytics: not carried (web/browser-only; prompt forbids adding analytics; carrying is impossible without the browser SDK).

## 8. Backend changes
- None so far. (`Backend/.env` `DEFAULT_TEST_PHONE` got `6261387233` appended for testing — config only, not code.)

## 9. Commands
```
cd mobile-user
npm install
npx expo start                # dev (needs a dev build: npx expo run:android, or EAS development profile)
npx expo lint                 # lint
npx expo-doctor
npx expo export --platform android
eas login
eas build --platform android --profile production --non-interactive   # APK
```

### Local APK build (no Expo cloud) — Windows
- Tools: JDK 17 `D:\Android\jdk-17`, SDK `D:\Android\Sdk` (platform 37.0, build-tools 37.0.0, NDK 27.1.12297006, CMake 3.31.6). Windows `LongPathsEnabled=1` is required.
- Build from the short mirror `D:\jr` (C++ object paths exceed 260 chars from the repo path). `D:\jr\android\local.properties` = `sdk.dir=D:/Android/Sdk` + `cmake.dir=D:/Android/Sdk/cmake/3.31.6` (CMake 3.22.1's ninja is not long-path aware).
- Sync: `robocopy "D:\Projects\Jharkhand-rasoi\mobile-user" "D:\jr" /MIR /XD "<repo>\mobile-user\android" "D:\jr\android" "<repo>\mobile-user\.expo" "<repo>\mobile-user\dist" /XF *.apk` — use full paths in /XD; a bare `dist` also skips `node_modules/**/dist` on a fresh mirror and autolinking fails.
- Build: `cd D:\jr\android; .\gradlew.bat assembleRelease -Pandroid.enableMinifyInReleaseBuilds=false -Pandroid.enableShrinkResourcesInReleaseBuilds=false` → `app\build\outputs\apk\release\app-release.apk`. **Minify must stay off** (R8 strips androidx.work WorkDatabase → crash on launch); also set in app.config.js via expo-build-properties.
- Install/run: `adb install -r <apk>`; `adb shell monkey -p com.jharkhandrasoi.user -c android.intent.category.LAUNCHER 1`; logs `adb logcat`.
- Shell gotcha: this environment sets `NoDefaultCurrentDirectoryInExePath=1` → use `.\gradlew.bat` / `./gradlew.bat`, not bare `gradlew.bat`.
- Signing: without `mobile-user/keystore.properties` (gitignored; storeFile/storePassword/keyAlias/keyPassword for the EAS key `@appzeto__jharkhand-rasoi-user.jks`) the local APK is debug-signed and cannot update an EAS-signed install.

## 10. Known issues / status
- Expo not logged in → release build not run; see commands above. `eas.json` has `production` = APK.
- `.env` is gitignored, so EAS does not upload it: create EAS env vars for `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` (and any other `EXPO_PUBLIC_*` you need) before building. API/socket URLs are set in `eas.json` `production.env`.
- No Android SDK / emulator locally → every screen is "Built, not tested".
- Test phone 6261387233 / 123456 is rejected by the live server ("Invalid OTP") until the server's `.env` is updated and the backend restarted → all logged-in API checks Blocked.
- Razorpay key id is empty in `Frontend/.env`; the app uses `razorpay.key` returned by the backend per order (same as web).
- SHA-1 of the EAS keystore should be added to Firebase (`eas credentials` shows it) — FCM works without it.
- 21 web image assets are corrupted in git (see checklist D1) — re-supply originals.

## 11. Assumptions
- A1–A4 in `CONVERSION_CHECKLIST.md` §0.
