# Conversion checklist — restaurant app

Status values: **Verified** (checked on device), **Built, not tested**, **Blocked** (needs something external), **Web** (opens web dashboard).

## 0. Assumptions
- A1 App name "Jharkhand Rasoi Restaurant".
- A2 Package `com.jharkhandrasoi.restaurant` (registered in Firebase by the owner).
- A3 Phone layout only (web desktop sidebar not carried).

## 1. Screens
| Web page | Native | Status |
|---|---|---|
| auth/Login.jsx | app/login.jsx | Built, not tested |
| auth/OTP.jsx | app/otp.jsx | Built, not tested |
| auth/VerificationPending.jsx | app/pending-verification.jsx | Built, not tested |
| auth/Welcome, Signup, ForgotPassword, Onboarding | — registration on web (D1) | Web |
| OrdersMain.jsx (+ popup, lists, search) | app/(tabs)/index.jsx | Built, not tested |
| OrderDetails.jsx | app/orders/[id].jsx | Built, not tested |
| AllOrdersPage.jsx | app/orders-history.jsx | Built, not tested |
| Inventory.jsx (stock, recommended, add-on/combo availability) | app/(tabs)/inventory.jsx | Built, not tested |
| Inventory.jsx add/edit dish, ItemDetailsPage, add-on/combo forms | — (D2) | Web |
| Feedback.jsx | app/(tabs)/feedback.jsx | Built, not tested |
| ExploreMore.jsx | app/(tabs)/explore.jsx | Built, not tested |
| DeliverySettings.jsx | app/delivery-settings.jsx | Built, not tested |
| Notifications.jsx | app/notifications.jsx | Built, not tested |
| TermsAndConditionsPage / PrivacyPolicyPage | app/terms.jsx, app/privacy.jsx | Built, not tested |
| GlobalPickupOtpModal | src/components/PickupOtpModal.jsx | Built, not tested |
| RestaurantBlockGuard | app/(tabs)/_layout.jsx | Built, not tested |
| OutletInfo, OutletTimings, DaySlots, MenuCategoriesPage, Promocodes, ZoneSetup, RestaurantSupport, ShareFeedback, HubFinance, FinanceDetails, WithdrawalHistory, UpdateBankDetails, EditOwner, EditCuisines, EditRestaurantAddress, PhoneNumbersPage, FssaiDetails/Update, RatingsReviews, DishRatings, DownloadReport, ManageOutlets, FranchiseOperations, RushHour, Hyperpure | Explore → web page (D3) | Web |

## 2. Features
| Feature | Status |
|---|---|
| Socket new_order + ring loop + vibration | Built, not tested |
| 8 s REST poll fallback / foreground refresh | Built, not tested |
| Accept with prep time (slide), reject reasons, 3-min auto-reject | Built, not tested |
| Cancel / admin-assigned event dismisses popup | Built, not tested |
| Mark ready (manual + auto at ETA), resend rider notification | Built, not tested |
| Pickup OTP modal | Built, not tested |
| Online/offline (availability) | Built, not tested |
| Push notifications (FCM) | Built, not tested |

## 3. Verification
- `npx expo export --platform android`: OK.
- `eslint app src`: 0 errors.
- APK build: see MEMORY.md §8.

## 4. Deviations
D1–D5 in MEMORY.md §7.
