# CONVERSION_CHECKLIST — Jharkhand Rasoi **User App** (React web → Expo Android)

Status legend: **Verified** (ran and saw it work) · **Built, not tested** (code written and compiles into the Android bundle; needs a device test) · **Blocked** (cannot finish; reason + what is needed) · **Left out** (no phone-width entry point on web — confirm scope)

> "Compiles" = included in a successful `npx expo export --platform android` (Hermes bundle, 9 MB, 0 errors) and passes `expo lint` with 0 errors. No Android SDK/emulator exists on this machine, so **no screen has been run on a device yet**.

---

## 0. Discovered inputs

| Item | Value | Source file |
|---|---|---|
| Target app | **user** | user instruction |
| Web frontend | `Frontend/` (Vite + React 19) | repo |
| Backend | `Backend/` (Node/Express/MongoDB) — read-only, **no code changes made** | repo |
| Flutter wrapper | none in repo (incl. git history) | repo search |
| App name | **Jharkhand Rasoi** | `Frontend/public/manifest.json` |
| Android package | **`com.jharkhandrasoi.user`** | `mobile-user/google-services.json` (user supplied) |
| Firebase project | `jharkhandrasoi12` | `google-services.json` |
| Version | 1.0.0 / versionCode 1 | `Frontend/package.json` |
| Icon / splash | `brandlogo.png` on white | web PWA manifest + `AppIntroSplash` |
| API base | `https://jharkhandrasoi.com/api/v1` (`/health` → UP) | user + `Frontend/.env` |
| Socket.IO | `https://jharkhandrasoi.com`, path `/socket.io/` | web `utils/socketOrigin.js` |
| Maps / Razorpay key id / Firebase public values | `mobile-user/.env` (copied from `Frontend/.env`) — **Razorpay key id is empty there; backend returns `razorpay.key` per order, which is what the app uses** | `.env` |
| Fonts | Poppins, Outfit, Inter | `Frontend/index.html` |
| Test login | phone **6261387233**, OTP **123456** — appended to `DEFAULT_TEST_PHONE` in `Backend/.env`; **live server still rejects it (not redeployed)** | `Backend/.env` |
| Expo account | not logged in | `npx eas-cli whoami` |
| Android SDK / emulator | not installed | local check |

### Assumptions
- A1: No wrapper → package from `google-services.json`, name/icon from PWA manifest, version 1.0.0.
- A2: `jharkhandrasoi.com` is production (user confirmed).
- A3: Push contract = web wrapper path: `POST /fcm-tokens/device/save { fcmToken, pushPlatform:"mobile", devicePlatform:"android" }`.
- A4: Scope = screens reachable at phone width (web user layout + bottom nav). Desktop-navbar-only screens are **Left out** (list below) — **please confirm**.

---

## 1. Screens

Guard: **P** = web `ProtectedRoute` → native `RequireAuth`; **–** = public.

| Web route | Guard | Web file | Native route (`app/`) | Status |
|---|---|---|---|---|
| `/user/auth/login` | – | `modules/auth/pages/Login.jsx` | `login.jsx` | Built, not tested |
| `/user/auth/support` | – | `modules/auth/pages/PublicSupport.jsx` | `support-public.jsx` | Built, not tested (see D6) |
| `/food/user` Home | – | `pages/user/Home.jsx` | `(tabs)/index.jsx` | Built, not tested |
| `/food/user/under-250` | – | `Under250.jsx` | `(tabs)/under-250.jsx` | Built, not tested |
| `/food/user/orders` | P | `orders/Orders.jsx` | `(tabs)/orders.jsx` | Built, not tested |
| `/food/user/profile` | P | `profile/Profile.jsx` | `(tabs)/profile.jsx` | Built, not tested |
| `/food/user/restaurants/:slug` | – | `restaurants/RestaurantDetails.jsx` | `restaurants/[slug].jsx` | Built, not tested |
| `/food/user/cart` | – | `cart/Cart.jsx` (COD / wallet / Razorpay) | `cart.jsx` | Built, not tested |
| `/food/user/address-selector` | – | `cart/AddressSelectorPage.jsx` | `address-selector.jsx` | Built, not tested |
| `/food/user/orders/:orderId` | P | `orders/OrderTracking.jsx` + `components/user/DeliveryTrackingMap.jsx` | `orders/[orderId]/index.jsx` + `src/components/DeliveryTrackingMap.jsx` | Built, not tested |
| `/food/user/orders/:orderId/details` | P | `orders/UserOrderDetails.jsx` (+ PDF invoice) | `orders/[orderId]/details.jsx` + `src/utils/invoicePdf.js` | Built, not tested |
| `/food/user/complaints/submit/:orderId` | P | `complaints/SubmitComplaint.jsx` | `complaints/submit/[orderId].jsx` | Built, not tested |
| `/food/user/search` | – | `search/ProfessionalSearch.jsx` (+ voice) | `search.jsx` + `src/hooks/useVoiceSearch.js` | Built, not tested |
| `/food/user/categories` | – | `Categories.jsx` | `categories.jsx` | Built, not tested |
| `/food/user/category/:category` | – | `CategoryPage.jsx` | `category/[category].jsx` | Built, not tested |
| `/food/user/gourmet` | – | `Gourmet.jsx` | `gourmet.jsx` | Built, not tested |
| `/food/user/offers` | – | `Offers.jsx` | `offers.jsx` | Built, not tested |
| `/food/user/subscription`, `/vip` | – | `SubscriptionPage.jsx` | `subscription.jsx` | Built, not tested |
| `/food/user/wallet` | P | `Wallet.jsx` + `AddMoneyModal.jsx` | `wallet.jsx` + `src/components/AddMoneySheet.jsx` | Built, not tested |
| `/food/user/notifications` | P | `Notifications.jsx` | `notifications.jsx` | Built, not tested (see D5) |
| `/food/user/profile/edit` | P | `profile/EditProfile.jsx` | `profile/edit.jsx` | Built, not tested |
| `/food/user/profile/coupons` | P | `profile/Coupons.jsx` | `profile/coupons.jsx` | Built, not tested |
| `/food/user/profile/refer-earn` | P | `profile/ReferEarn.jsx` | `profile/refer-earn.jsx` | Built, not tested |
| `/food/user/profile/favorites` | P | `profile/Favorites.jsx` | `profile/favorites.jsx` | Built, not tested |
| `/food/user/profile/support` | P | `profile/Support.jsx` | `profile/support.jsx` | Built, not tested |
| `/food/user/profile/about` | P | `profile/About.jsx` | `profile/about.jsx` | Built, not tested |
| `/food/user/profile/report-safety-emergency` | P | `profile/ReportSafetyEmergency.jsx` | `profile/report-safety-emergency.jsx` | Built, not tested |
| `/food/user/profile/{terms,privacy,refund,shipping,cancellation}` | – | `profile/Terms.jsx` … | `profile/*.jsx` → `src/components/LegalPage.jsx` | Built, not tested |

### Left out — no phone-width entry point (confirm scope)
`Dining` + all `dining/*` and table-booking pages, `MyBookings` (`/bookings`, `/profile/dining-bookings`) — only linked from the desktop navbar; the web bottom nav has no Dining tab. · `Collections`, `CollectionDetail`, `Coffee`, `ProductDetail`, `Restaurants` index — no links from phone screens. · `cart/Checkout`, `cart/SelectAddress` — Cart places the order itself. · `profile/Payments`, `AddPayment`, `EditPayment`, `Accessibility`, `Logout` page — not linked from Profile. · `Help`, `OrderHelp`, `orders/:id/invoice` — invoice/help only reachable from Help (not linked). · `AuthCallback` (OAuth disabled), legacy `SignIn`/`OTP` (all links go to the one-page Login).

---

## 2. APIs (live `https://jharkhandrasoi.com/api/v1`, payloads as sent by the app)

| Area | Endpoint(s) | Status |
|---|---|---|
| Health | `GET /health` | **Verified** (200 UP) |
| Landing | `GET /food/landing/settings/public`, `/food/hero-banners/public`, `/food/explore-icons/public`, `/food/hero-banners/gourmet/public`, `/app-config/user_app` | **Verified** (200, shapes match parsers) |
| Catalogue | `GET /food/restaurant/categories/public`, `/food/restaurant/restaurants`, `/food/restaurant/foods/public`, `/food/restaurant/offers`, `/food/search/unified` | **Verified** (200) |
| Settings / pages | `GET /food/admin/business-settings/public`, `/food/admin/fee-settings/public`, `/food/pages/:key`, `/food/subscriptions/plans` | **Verified** (200; `pages/terms` returns `data:null` → handled) |
| Auth | `POST /food/auth/user/request-otp {phone}` | **Verified** (200 "OTP sent") |
| Auth | `POST /food/auth/user/verify-otp {phone, otp, platform:"mobile"}` | **Blocked** — live server answers "Invalid OTP" for 6261387233/123456: server `.env` not updated/restarted |
| Everything that needs a user token (profile, addresses, wallet, orders calculate/create/verify-payment/cancel/ratings, support tickets, safety reports, referrals, notifications inbox, FCM save, subscriptions subscribe, profile image upload) | see `src/api/index.js` (same paths/payloads as web) | **Blocked** (same reason) |
| Socket.IO events `order_status_update`, `order_state`, `delivery_drop_otp`, `admin_notification`, `location-update`; emits `join-tracking`/`leave-tracking`/`resync` | | **Blocked** (needs a logged-in user + live order) |

---

## 3. Native replacements

| Web | Native |
|---|---|
| react-router-dom | expo-router |
| localStorage / sessionStorage | SecureStore (tokens/user) + AsyncStorage mirrored in memory (`src/utils/storage.js`); session = memory |
| Tailwind / Radix / MUI / shadcn | StyleSheet + `src/theme.js` + `src/components/ui/*` |
| framer-motion / CSS keyframes | `Animated` (RN core) |
| lucide-react | lucide-react-native |
| sonner | react-native-toast-message (sonner-style facade `src/utils/toast.js`) |
| @react-google-maps/api (map, Directions) | react-native-maps (Google) + Directions **REST** (same key) |
| navigator.geolocation | expo-location (foreground only) |
| Razorpay checkout.js | react-native-razorpay (`src/utils/razorpay.js`, same `initRazorpayPayment` contract) |
| jspdf + autotable | expo-print (HTML→PDF) + expo-sharing |
| `<input type=file>` / ImageSourcePicker | expo-image-picker (camera / gallery sheet) |
| MUI DatePicker | @react-native-community/datetimepicker |
| `<select>` / `<datalist>` | option bottom-sheets / search + tap list |
| `dangerouslySetInnerHTML` (legal pages) | react-native-render-html (native views, **no WebView**) |
| Web Speech API | expo-speech-recognition (Android recognizer) |
| HTML5 Audio (order sound) | expo-audio |
| canvas-confetti | `src/components/Confetti.jsx` (Animated) |
| navigator.clipboard / share | expo-clipboard / RN Share |
| firebase web push | expo-notifications (FCM device token) + google-services.json |
| Meta Pixel | not carried (browser-only analytics) |

---

## 4. Deviations from web (deliberate — please review)
- **D1 Broken assets:** 15 PNGs + 6 JPEGs in `Frontend/src/modules/Food/assets` are corrupted **in git itself** (line-ending conversion turned every CR/LF/CRLF into CRLF inside the binaries; unrecoverable). They are broken on the website too. In the app they are `null` (nothing rendered) — files: `bikelogo, circleicon, collectionspagebanner, explore/{collection,giftcard,gourmet,offers,top10}, fssai, groumetpagebanner, loginbanner, offerpagebanner, referralbonuscardbg, tiptransfericon, top10pagebanner` (.png) and `category-icons/{bazaar,food,hotel,quick,swadeshi,taxi}` (.jpg); also `offerimage.png` (unused). **Re-supply originals** and add `*.png binary` / `*.jpg binary` to `.gitattributes`.
- **D2** 14 JPEGs named `.png` were renamed to `.jpg` (Android's resource compiler rejects them).
- **D3** Cart date/time scheduling: web `<input type=date>` (today…tomorrow) + `<select>` → "Today / Tomorrow" chips + hour-slot chips (same constraint, same slots).
- **D4** Gourmet distance: web reads an undefined `location` (always falls back to "1.2 km"); app uses the user's location as intended.
- **D5** Notifications: web seeds 2 hard-coded demo notifications ("Order #12345 confirmed", "50% off") when storage is empty; app starts empty.
- **D6** PublicSupport (target of Login "SUPPORT"; the web link points to a missing route): web falls back to another brand's contact (`switcheatsofficial@gmail.com`, `8919142335`, "© Switcheats"); app shows only business-settings contact + company name.
- **D7** Login SUPPORT link → `/support-public` (web link `/user/profile/support-info` does not exist).
- **D8** Web bugs not reproduced: RestaurantDetails filter sheet crash (`hasFoodAddons` undefined), "Recommended for you" never populated, `getInventoryByRestaurantId` undefined.

---

## 5. Checks

| Check | Result |
|---|---|
| `npx expo export --platform android` | **Verified** — success, `index-*.hbc` 9 MB |
| `npx expo lint` | **Verified** — 0 errors, 201 warnings (React Compiler advisory rules set to warn — patterns ported 1:1 from web, React Compiler not enabled; see `eslint.config.js`). One real bug found by lint and fixed: Support ticket textarea remounted on every keystroke. |
| `npx expo-doctor` | **Verified** — 20/20 checks pass (after adding `expo-asset`, patch-bumping expo/expo-router/expo-file-system; `react-native-render-html` excluded from the directory check: pure JS, no native code) |
| Public API calls | **Verified** (table §2) |
| Logged-in API calls | **Blocked** (test OTP not live on server) |
| EAS production APK | **Blocked** — Expo account not logged in on this machine |

---

## 6. Device test list (run on a real Android phone after the first APK)
1. Fresh install → splash → location permission prompt → Home loads restaurants for your zone (or "out of service" screen).
2. Login with 6261387233 / 123456 (after server update) → lands on Home; kill app → reopen → still logged in.
3. Notification permission prompt (Android 13+); backend shows a new `/fcm-tokens` device row.
4. Home: categories rail, banners, filters, veg mode, explore icons → Offers / Gourmet / Collections link.
5. Restaurant page: add/remove items, variants sheet, combos, search, MENU sheet, Cart pill.
6. Address selector: current location, add new (map drag + search), edit, delete, select saved.
7. Cart: coupon apply/remove, tip, schedule, recipient edit, cutlery, note; place **COD** order → success screen + sound → tracking.
8. Place a **Razorpay test** order (card 4111 1111 1111 1111) → verify → tracking; also cancel the Razorpay sheet → order auto-cancelled toast.
9. Tracking: status header updates, live rider marker + route once a rider accepts, handover OTP card, call buttons, 65 s cancel button, instructions, rating after delivery.
10. Order details → Invoice PDF opens share sheet; Reorder; Restaurant Complaint submit.
11. Wallet: add money via Razorpay test → balance updates; Subscription purchase via wallet and online.
12. Profile: edit (photo from camera + gallery, DOB picker, gender), favorites, coupons copy, refer & earn share, support ticket, safety report, About → legal pages render HTML.
13. Search: text results, category chips, recent history, **voice search** (mic permission prompt → spoken query).
14. Push: send an order status change from admin with app in foreground (toast), background (system notification) and killed (tap opens the order).
15. Android back button: closes sheets/dialogs first, then navigates back; on Home exits app.
16. Offline: turn on airplane mode → screens show error toasts/states, no crash; turn off → pull/refresh works.
