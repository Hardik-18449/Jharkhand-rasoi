/** Profile — port of pages/user/profile/Profile.jsx */
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { ArrowLeft, Crown, ChevronRight, Wallet, Tag, User, Leaf, Palette, Bookmark, Building2, Moon, Sun, Check, Info, AlertTriangle, Settings as SettingsIcon, Power, ShoppingCart, MapPin, Share2, Trash2, Bell } from "lucide-react-native";
import Screen from "../../src/components/ui/Screen";
import Txt from "../../src/components/ui/Txt";
import BottomSheet from "../../src/components/ui/BottomSheet";
import Button from "../../src/components/ui/Button";
import RequireAuth from "../../src/components/RequireAuth";
import { useProfile } from "../../src/context/ProfileContext";
import { useLocationSelector } from "../../src/context/SearchOverlayContext";
import { useTheme } from "../../src/context/ThemeContext";
import { useCompanyName } from "../../src/hooks/useCompanyName";
import { authAPI, userAPI } from "../../src/api";
import { clearModuleAuth, getModuleFcmToken } from "../../src/auth/session";
import { registerPushDevice, unregisterPushDevice } from "../../src/push/notifications";
import { localStore } from "../../src/utils/storage";
import { getMediaUrl } from "../../src/utils/media";
import { toast } from "../../src/utils/toast";
import { palette, fonts } from "../../src/theme";

const USER_SESSION_PREFERENCE_KEYS = ["userVegMode", "food-under-250-filters"];
const profilePageCache = { referralReward: null, walletBalance: null };
const WEB_ORIGIN = "https://jharkhandrasoi.com";

function Row({ icon, label, sub, right, onPress, iconBg = palette.gray100, labelColor = palette.gray900, style }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { transform: [{ translateX: 2 }] }, style]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
        <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>{icon}</View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt weight={500} style={{ fontSize: 16, color: labelColor }}>{label}</Txt>
          {sub ? <Txt weight={400} numberOfLines={1} style={{ fontSize: 12, color: palette.gray500 }}>{sub}</Txt> : null}
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {right}
        <ChevronRight size={20} color={palette.gray400} />
      </View>
    </Pressable>
  );
}

function SectionTitle({ children }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8, paddingHorizontal: 4 }}>
      <View style={{ width: 4, height: 16, backgroundColor: palette.yellow, borderRadius: 2 }} />
      <Txt weight={600} style={{ fontSize: 16, color: palette.gray900 }}>{children}</Txt>
    </View>
  );
}

function ProfileInner() {
  const router = useRouter();
  const { userProfile, vegMode, setVegMode, getDefaultAddress, addresses } = useProfile();
  const { openLocationSelector } = useLocationSelector();
  const companyName = useCompanyName();
  const { theme: appearance, setTheme: setAppearance } = useTheme();
  const defaultAddress = getDefaultAddress?.();
  const savedAddressSummary = defaultAddress
    ? [defaultAddress.street, defaultAddress.additionalDetails, defaultAddress.city, defaultAddress.state, defaultAddress.zipCode].filter(Boolean).join(", ")
    : "No address saved. Tap to save Home, Work, or Other.";

  const [vegModeOpen, setVegModeOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [referralReward, setReferralReward] = useState(() => profilePageCache.referralReward || 0);
  const [walletBalance, setWalletBalance] = useState(() => profilePageCache.walletBalance || 0);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1);
  const [deleteCaptcha, setDeleteCaptcha] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTestingNotification, setIsTestingNotification] = useState(false);

  useEffect(() => {
    registerPushDevice({ ask: true }).catch(() => {});
  }, []);

  const handleVegModeUpdate = (next) => {
    setVegMode(next);
    localStore.setItem("userVegMode", String(next));
  };

  const avatarInitial = userProfile?.name?.charAt(0)?.toUpperCase() || userProfile?.phone?.charAt(1)?.toUpperCase() || "U";
  const displayName = userProfile?.name || userProfile?.phone || "User";
  const hasValidEmail = userProfile?.email && userProfile.email.trim() !== "" && userProfile.email.includes("@");

  const profileCompletion = (() => {
    if (!userProfile) return 0;
    const isDateFilled = (d) => {
      if (!d) return false;
      if (d instanceof Date) return !isNaN(d.getTime());
      if (typeof d === "string") {
        const t = d.trim();
        if (!t || t === "null" || t === "undefined") return false;
        return !isNaN(new Date(t).getTime());
      }
      return false;
    };
    const hasName = !!(userProfile.name && typeof userProfile.name === "string" && userProfile.name.trim());
    const hasPhone = !!(userProfile.phone && typeof userProfile.phone === "string" && userProfile.phone.trim());
    const hasImage = !!(userProfile.profileImage && typeof userProfile.profileImage === "string" && userProfile.profileImage.trim() && userProfile.profileImage !== "null" && userProfile.profileImage !== "undefined");
    const validGenders = ["male", "female", "other", "prefer-not-to-say"];
    const hasGender = !!(userProfile.gender && typeof userProfile.gender === "string" && validGenders.includes(userProfile.gender.trim().toLowerCase()));
    const done = [hasName, hasPhone || hasValidEmail, hasImage, isDateFilled(userProfile.dateOfBirth), hasGender].filter(Boolean).length;
    return Math.round((done / 5) * 100);
  })();
  const isComplete = profileCompletion === 100;

  useEffect(() => {
    if (profilePageCache.referralReward !== null) return undefined;
    let mounted = true;
    userAPI
      .getReferralStats()
      .then((res) => {
        const finalReward = Number(res?.data?.data?.stats?.rewardAmount) || 0;
        if (mounted) setReferralReward(finalReward);
        profilePageCache.referralReward = finalReward;
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    if (profilePageCache.walletBalance !== null) return undefined;
    let mounted = true;
    userAPI
      .getWallet()
      .then((res) => {
        const w = res?.data?.data?.wallet || res?.data?.wallet;
        const bal = Number(w?.balance);
        const finalBal = Number.isFinite(bal) ? bal : 0;
        if (mounted) setWalletBalance(finalBal);
        profilePageCache.walletBalance = finalBal;
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const refId = userProfile?._id || userProfile?.id || userProfile?.referralCode || "";
  const referralLink = refId ? `${WEB_ORIGIN}/food/user/auth/login?ref=${encodeURIComponent(String(refId))}` : "";
  const handleShareReferral = async () => {
    if (!referralLink) return;
    const rewardText = referralReward > 0 ? `₹${referralReward}` : "rewards";
    const shareText = `Join ${companyName} and earn ${rewardText}.`;
    try {
      await Share.share({ title: `${companyName} referral`, message: `${shareText} ${referralLink}`, url: referralLink });
    } catch {}
  };

  const clearLocal = () => {
    clearModuleAuth();
    ["accessToken", "user_authenticated", "user_user", "user", "cart", "userOrders", ...USER_SESSION_PREFERENCE_KEYS].forEach((k) => localStore.removeItem(k));
    profilePageCache.referralReward = null;
    profilePageCache.walletBalance = null;
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      try {
        const fcmToken = getModuleFcmToken();
        await unregisterPushDevice();
        if (fcmToken) {
          try {
            await userAPI.removeFcmToken(fcmToken, { platform: "mobile" });
          } catch {}
        }
        await authAPI.logout(null, fcmToken, "mobile");
      } catch {}
    } finally {
      clearLocal();
      setIsLoggingOut(false);
      router.replace("/login");
    }
  };

  const handleDeleteAccount = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await userAPI.deleteAccount();
      toast.success("Account deleted successfully");
      clearLocal();
      router.replace("/login");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete account. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTestNotification = async () => {
    if (isTestingNotification) return;
    setIsTestingNotification(true);
    try {
      const token = await registerPushDevice({ ask: true });
      if (!token) {
        toast.error("Notification permission is blocked. Please allow notifications in app settings and retry.");
        return;
      }
      const response = await userAPI.testFcmNotification();
      const details = response?.data?.data || {};
      const successCount = details?.successCount || 0;
      const failureCount = details?.failureCount || 0;
      if (successCount > 0) toast.success(`Test sent! Delivered: ${successCount}${failureCount > 0 ? `, Failed: ${failureCount}` : ""}`);
      else if (details?.noTokens || (successCount === 0 && failureCount === 0)) toast.error("No registered push devices found. Please ensure notification permissions are allowed in your app.");
      else toast.error(`Test failed to deliver. Delivered: 0, Failed: ${failureCount}`);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to send test notification");
    } finally {
      setIsTestingNotification(false);
    }
  };

  const profileImg = userProfile?.profileImage && String(userProfile.profileImage).trim() ? getMediaUrl(String(userProfile.profileImage)) : null;

  return (
    <Screen bg="#f5f5f5">
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 96 }} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.navigate("/")} hitSlop={8} style={{ width: 32, height: 32, justifyContent: "center", marginBottom: 16 }}>
          <ArrowLeft size={20} color={palette.black} />
        </Pressable>

        <View style={[styles.card, { padding: 16, paddingTop: 12 }]}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 16 }}>
            <View style={styles.avatar}>
              {profileImg ? <Image source={{ uri: profileImg }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Txt weight={600} style={{ fontSize: 24, color: palette.black }}>{avatarInitial}</Txt>}
            </View>
            <View style={{ flex: 1, paddingTop: 4 }}>
              <Txt weight={700} style={{ fontSize: 20, color: palette.black, marginBottom: 4 }}>{displayName}</Txt>
              {hasValidEmail ? <Txt weight={400} style={{ fontSize: 14, color: palette.black, marginBottom: 4 }}>{userProfile.email}</Txt> : null}
              {userProfile?.phone ? <Txt weight={400} style={{ fontSize: 14, color: hasValidEmail ? palette.gray600 : palette.black, marginBottom: 12 }}>{userProfile.phone}</Txt> : null}
              {!hasValidEmail && !userProfile?.phone ? <Txt weight={400} style={{ fontSize: 14, color: palette.gray500, marginBottom: 12 }}>Not available</Txt> : null}
            </View>
          </View>
        </View>

        <View style={{ gap: 8, marginVertical: 12 }}>
          <Row icon={<Wallet size={20} color={palette.gray700} />} label={`${companyName} Money`} onPress={() => router.push("/wallet")} right={<Txt weight={600} style={{ fontSize: 16, color: palette.green600 }}>₹{Number(walletBalance || 0).toFixed(0)}</Txt>} />
          <Pressable onPress={() => router.push("/subscription")} style={[styles.row, styles.vipRow]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
              <View style={[styles.iconWrap, { backgroundColor: palette.amber500 }]}><Crown size={20} color={palette.white} /></View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Txt weight={700} style={{ fontSize: 16, color: palette.gray900 }}>VIP Priority Pass</Txt>
                  <View style={{ backgroundColor: palette.amber500, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                    <Txt weight={800} style={{ fontSize: 10, color: palette.black }}>SERVE 1ST</Txt>
                  </View>
                </View>
                <Txt weight={500} style={{ fontSize: 12, color: "#92400e" }}>Kitchen Priority • Free Delivery • VIP Perks</Txt>
              </View>
            </View>
            <ChevronRight size={20} color={palette.amber600} />
          </Pressable>
          <Row icon={<Tag size={20} color={palette.gray700} />} label="Your coupons" onPress={() => router.push("/profile/coupons")} />
          <Row icon={<ShoppingCart size={20} color={palette.gray700} />} label="Your cart" onPress={() => router.push("/cart")} />
          <Pressable onPress={() => router.push("/profile/refer-earn")} style={[styles.row, { flexDirection: "column", alignItems: "stretch" }]}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={styles.iconWrap}><Tag size={20} color={palette.gray700} /></View>
                <Txt weight={500} style={{ fontSize: 16, color: palette.gray900 }}>Refer & Earn</Txt>
              </View>
              {referralReward > 0 ? (
                <View style={{ backgroundColor: palette.green100, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}>
                  <Txt weight={600} style={{ fontSize: 12, color: palette.green700 }}>Earn ₹{referralReward}</Txt>
                </View>
              ) : null}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Txt weight={400} style={{ fontSize: 12, color: palette.gray500, flex: 1 }}>Invite a friend. Reward is added to your wallet when they sign up.</Txt>
              <Pressable onPress={handleShareReferral} disabled={!referralLink} style={{ flexDirection: "row", alignItems: "center", gap: 4, marginLeft: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                <Share2 size={14} color={palette.black} />
                <Txt weight={500} style={{ fontSize: 12, color: palette.black }}>Refer</Txt>
              </Pressable>
            </View>
          </Pressable>
          <Row icon={<MapPin size={20} color={palette.gray700} />} label="Saved addresses" sub={savedAddressSummary} onPress={openLocationSelector} right={<View style={styles.countPill}><Txt weight={500} style={{ fontSize: 12, color: palette.gray700 }}>{addresses?.length || 0}</Txt></View>} />
          <Row
            icon={<User size={20} color={palette.gray700} />}
            label="Your profile"
            onPress={() => router.push("/profile/edit")}
            right={
              <View style={[styles.countPill, isComplete ? { backgroundColor: palette.yellow } : { backgroundColor: "#7e386615", borderWidth: 1, borderColor: "rgba(254,198,0,0.1)" }]}>
                <Txt weight={500} style={{ fontSize: 12, color: palette.black }}>{profileCompletion}% completed</Txt>
              </View>
            }
          />
          <Row icon={<Leaf size={20} color={palette.gray700} />} label="Veg Mode" onPress={() => setVegModeOpen(true)} right={<Txt weight={500} style={{ fontSize: 16, color: palette.gray900 }}>{vegMode ? "ON" : "OFF"}</Txt>} />
          <Row icon={<Palette size={20} color={palette.gray700} />} label="Appearance" onPress={() => setAppearanceOpen(true)} right={<Txt weight={500} style={{ fontSize: 16, color: palette.gray900, textTransform: "capitalize" }}>{appearance}</Txt>} />
        </View>

        <View style={{ marginBottom: 12 }}>
          <SectionTitle>Collections</SectionTitle>
          <Row icon={<Bookmark size={20} color={palette.gray700} />} label="Your collections" onPress={() => router.push("/profile/favorites")} />
        </View>
        <View style={{ marginBottom: 12 }}>
          <SectionTitle>Food Orders</SectionTitle>
          <Row icon={<Building2 size={20} color={palette.gray700} />} label="Your orders" onPress={() => router.navigate("/orders")} />
        </View>
        <View style={{ marginBottom: 32 }}>
          <SectionTitle>More</SectionTitle>
          <View style={{ gap: 8 }}>
            <Row icon={<SettingsIcon size={20} color={palette.gray700} />} label="Help & Support" onPress={() => router.push("/profile/support")} />
            <Row icon={<Info size={20} color={palette.gray700} />} label="About" onPress={() => router.push("/profile/about")} />
            <Row icon={<AlertTriangle size={20} color={palette.gray700} />} label="Report a safety emergency" onPress={() => router.push("/profile/report-safety-emergency")} />
            <Row icon={<Bell size={20} color={palette.blue500} />} iconBg={palette.blue50} label={isTestingNotification ? "Sending test..." : "Test Notification"} onPress={handleTestNotification} />
            <Row icon={<Power size={20} color={palette.gray700} />} label={isLoggingOut ? "Logging out..." : "Log out"} onPress={() => !isLoggingOut && setLogoutConfirmOpen(true)} />
            <Row
              icon={<Trash2 size={20} color={palette.red500} />}
              iconBg={palette.red50}
              label="Delete Account"
              labelColor={palette.red500}
              onPress={() => {
                setDeleteStep(1);
                setDeleteCaptcha("");
                setDeleteAccountOpen(true);
              }}
            />
          </View>
        </View>
      </ScrollView>

      {/* Veg mode dialog */}
      <BottomSheet visible={vegModeOpen} onClose={() => setVegModeOpen(false)} position="center" contentStyle={{ borderRadius: 16 }}>
        <View style={{ padding: 20, paddingBottom: 12 }}>
          <Txt weight={700} style={{ fontSize: 18, color: palette.gray900 }}>Veg Mode</Txt>
          <Txt weight={400} style={{ fontSize: 14, color: palette.gray500 }}>Filter restaurants and dishes based on your dietary preferences</Txt>
        </View>
        <View style={{ paddingHorizontal: 20, paddingBottom: 20, gap: 8 }}>
          <Pressable onPress={() => { handleVegModeUpdate(true); setVegModeOpen(false); }} style={[styles.option, vegMode && { borderColor: palette.green600, backgroundColor: palette.green50 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={[styles.radio, vegMode && { borderColor: palette.green600, backgroundColor: palette.green600 }]}>{vegMode ? <Check size={12} color={palette.white} /> : null}</View>
              <View>
                <Txt weight={500} style={{ fontSize: 14, color: palette.gray900 }}>Veg Mode ON</Txt>
                <Txt weight={400} style={{ fontSize: 12, color: palette.gray500 }}>Show only vegetarian options</Txt>
              </View>
            </View>
            <Leaf size={20} color={vegMode ? palette.green600 : palette.gray400} />
          </Pressable>
          <Pressable onPress={() => { handleVegModeUpdate(false); setVegModeOpen(false); }} style={[styles.option, !vegMode && { borderColor: palette.secondary, backgroundColor: "#fdfafc" }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={[styles.radio, !vegMode && { borderColor: palette.neutral900, backgroundColor: palette.neutral900 }]}>{!vegMode ? <Check size={12} color={palette.white} /> : null}</View>
              <View>
                <Txt weight={500} style={{ fontSize: 14, color: palette.gray900 }}>Veg Mode OFF</Txt>
                <Txt weight={400} style={{ fontSize: 12, color: palette.gray500 }}>Show all options</Txt>
              </View>
            </View>
          </Pressable>
        </View>
      </BottomSheet>

      {/* Appearance dialog */}
      <BottomSheet visible={appearanceOpen} onClose={() => setAppearanceOpen(false)} position="center" contentStyle={{ borderRadius: 16 }}>
        <View style={{ padding: 20, paddingBottom: 12 }}>
          <Txt weight={700} style={{ fontSize: 18, color: palette.gray900 }}>Appearance</Txt>
          <Txt weight={400} style={{ fontSize: 14, color: palette.gray500 }}>Choose your preferred theme</Txt>
        </View>
        <View style={{ paddingHorizontal: 20, paddingBottom: 20, gap: 8 }}>
          {[["light", "Light", "Default light theme", Sun, palette.yellow500], ["dark", "Dark", "Dark theme", Moon, palette.gray600]].map(([id, label, sub, Icon, color]) => (
            <Pressable key={id} onPress={() => { setAppearance(id); setAppearanceOpen(false); }} style={[styles.option, { justifyContent: "flex-start", gap: 12 }, appearance === id && { borderColor: palette.yellow, backgroundColor: "#fdfafc" }]}>
              <View style={[styles.radio, appearance === id && { borderColor: palette.yellow, backgroundColor: palette.yellow }]}>{appearance === id ? <Check size={12} color={palette.white} /> : null}</View>
              <Icon size={20} color={color} />
              <View>
                <Txt weight={500} style={{ fontSize: 14, color: palette.gray900 }}>{label}</Txt>
                <Txt weight={400} style={{ fontSize: 12, color: palette.gray500 }}>{sub}</Txt>
              </View>
            </Pressable>
          ))}
        </View>
      </BottomSheet>

      {/* Logout confirm */}
      <BottomSheet visible={logoutConfirmOpen} onClose={() => setLogoutConfirmOpen(false)} position="center" contentStyle={{ borderRadius: 16, padding: 20 }}>
        <Txt weight={700} style={{ fontSize: 18, color: palette.gray900 }}>Log out?</Txt>
        <Txt weight={400} style={{ fontSize: 14, color: palette.gray500, marginTop: 4 }}>Are you sure you want to log out?</Txt>
        <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
          <Button title="No" variant="outline" rounded="xl" onPress={() => setLogoutConfirmOpen(false)} disabled={isLoggingOut} style={{ flex: 1 }} />
          <Button title={isLoggingOut ? "Logging out..." : "Yes"} variant="destructive" rounded="xl" onPress={() => { setLogoutConfirmOpen(false); handleLogout(); }} disabled={isLoggingOut} style={{ flex: 1 }} />
        </View>
      </BottomSheet>

      {/* Delete account */}
      <BottomSheet visible={deleteAccountOpen} onClose={() => setDeleteAccountOpen(false)} position="center" contentStyle={{ borderRadius: 16 }}>
        {deleteStep === 1 ? (
          <View style={{ padding: 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <View style={{ backgroundColor: palette.red100, borderRadius: 999, padding: 10 }}><AlertTriangle size={24} color={palette.red500} /></View>
              <Txt weight={700} style={{ fontSize: 18, color: palette.gray900 }}>Delete Account?</Txt>
            </View>
            <View style={{ backgroundColor: palette.red50, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: palette.red100 }}>
              <Txt weight={600} style={{ fontSize: 14, color: palette.red600, marginBottom: 8 }}>⚠️ This action is permanent and cannot be undone!</Txt>
              {["Your profile, addresses, and preferences will be deleted", "Wallet balance will be forfeited", "Order history will be anonymized", "Referral rewards will be lost", "You can sign up again as a new user with the same number"].map((t) => (
                <Txt key={t} weight={400} style={{ fontSize: 12, color: "rgba(239,68,68,0.8)", marginBottom: 6 }}>• {t}</Txt>
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Button title="Cancel" variant="outline" rounded="xl" onPress={() => setDeleteAccountOpen(false)} style={{ flex: 1 }} />
              <Button title="Continue" variant="destructive" rounded="xl" onPress={() => setDeleteStep(2)} style={{ flex: 1 }} />
            </View>
          </View>
        ) : (
          <View style={{ padding: 20 }}>
            <Txt weight={700} style={{ fontSize: 18, color: palette.gray900, marginBottom: 8 }}>Confirm Deletion</Txt>
            <Txt weight={400} style={{ fontSize: 14, color: palette.gray500, marginBottom: 16 }}>
              Type <Txt weight={700} style={{ fontSize: 14, color: palette.red500 }}>DELETE MY ACCOUNT</Txt> to confirm.
            </Txt>
            <TextInput value={deleteCaptcha} onChangeText={setDeleteCaptcha} placeholder="Type here..." placeholderTextColor={palette.gray400} autoFocus autoCapitalize="characters" style={styles.captcha} />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Button title="Back" variant="outline" rounded="xl" onPress={() => { setDeleteStep(1); setDeleteCaptcha(""); }} style={{ flex: 1 }} />
              <Button title={isDeleting ? "Deleting..." : "Delete Forever"} variant="destructive" rounded="xl" disabled={deleteCaptcha.trim() !== "DELETE MY ACCOUNT" || isDeleting} onPress={handleDeleteAccount} style={{ flex: 1 }} />
            </View>
          </View>
        )}
      </BottomSheet>
    </Screen>
  );
}

export default function ProfileScreen() {
  return (
    <RequireAuth>
      <ProfileInner />
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: palette.white, borderRadius: 16, elevation: 1 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(254,198,0,0.2)", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  row: { backgroundColor: palette.white, borderRadius: 12, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", elevation: 1 },
  vipRow: { backgroundColor: "#fff7e0", borderWidth: 1, borderColor: "rgba(252,211,77,0.6)" },
  iconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: palette.gray100, alignItems: "center", justifyContent: "center" },
  countPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: palette.gray100 },
  option: { width: "100%", padding: 12, borderRadius: 12, borderWidth: 2, borderColor: palette.gray200, backgroundColor: palette.white, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: palette.gray300, alignItems: "center", justifyContent: "center" },
  captcha: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: palette.gray200, backgroundColor: palette.gray50, fontFamily: fonts.medium, fontSize: 14, color: palette.gray900, marginBottom: 16 },
});
