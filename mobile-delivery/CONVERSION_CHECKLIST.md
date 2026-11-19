# Conversion checklist — delivery partner app

Status: **Verified** (device), **Built, not tested**, **Blocked**, **Web** (opens web dashboard).

## 0. Assumptions
- A1 App name "Jharkhand Rasoi Delivery". A2 Package `com.jharkhandrasoi.delivery`. A3 Phone layout only.

## 1. Screens
| Web | Native | Status |
|---|---|---|
| auth/SignIn, OTP | app/login.jsx, app/otp.jsx | Built, not tested |
| auth/Welcome, SignupStep1/2 | pending-verification → web signup (D1) | Web |
| DeliveryHomeV2 (feed) + LiveMap + modals | app/(tabs)/index.jsx + src/delivery/* | Built, not tested |
| OrdersV2 | app/(tabs)/orders.jsx | Built, not tested |
| PocketV2 + PocketBalanceV2 (withdraw) | app/(tabs)/pocket.jsx | Built, not tested |
| HistoryV2 | app/history.jsx | Built, not tested |
| ProfileV2 | app/(tabs)/profile.jsx | Built, not tested |
| NotificationsV2 | app/notifications.jsx | Built, not tested |
| Terms / Privacy | app/terms.jsx, app/privacy.jsx | Built, not tested |
| ProfileDetails/Bank/Docs, Support tickets, ID card, Payout/Statements/Deductions/Limit settlement/Cash limit pages | Profile links → web (D3) | Web |

## 2. Features
| Feature | Status |
|---|---|
| Online switch + GPS + shift selfie + availability PATCH | Built, not tested |
| Background location (foreground service) + socket tracking emit | Built, not tested |
| Offers: socket, resync pending offers, poll, queue, 60 s auto-pass, claimed/cancelled/reassigned | Built, not tested |
| Accept / reached pickup / pickup OTP / picked up / reached drop / drop OTP / cash / QR / complete | Built, not tested |
| Geofence auto-arrival, range lock | Built, not tested |
| Admin force online/offline, admin notifications, auto-killed reason | Built, not tested |
| Push (FCM) | Built, not tested |

## 3. Verification
- `eslint app src`: 0 errors. API-method scan: 0 undefined calls. `expo export --platform android`: OK.

## 4. Deviations
D1–D7 in MEMORY.md §6.
