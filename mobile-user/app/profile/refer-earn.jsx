/** Port of pages/user/profile/ReferEarn.jsx */
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, Share2, Users, Wallet, CircleCheck, Clock3, CircleX } from "lucide-react-native";
import Txt from "../../src/components/ui/Txt";
import Screen from "../../src/components/ui/Screen";
import Button from "../../src/components/ui/Button";
import RequireAuth from "../../src/components/RequireAuth";
import { shareLink, WEB_ORIGIN } from "../../src/components/ui/ShareSheet";
import { useCompanyName } from "../../src/hooks/useCompanyName";
import { useProfile } from "../../src/context/ProfileContext";
import { userAPI } from "../../src/api";
import { toast } from "../../src/utils/toast";
import { palette } from "../../src/theme";

const R = "₹";
const statusMeta = {
  credited: { label: "Credited", Icon: CircleCheck, bg: palette.green100, fg: palette.green700 },
  pending: { label: "Pending", Icon: Clock3, bg: "#fef3c7", fg: "#b45309" },
  rejected: { label: "Rejected", Icon: CircleX, bg: palette.red100, fg: "#b91c1c" },
};

function ReferEarnScreen() {
  const router = useRouter();
  const { userProfile } = useProfile();
  const companyName = useCompanyName();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ referralCount: 0, totalReferralEarnings: 0, rewardAmount: 0, totalInvited: 0, creditedCount: 0, pendingCount: 0, rejectedCount: 0 });
  const [invited, setInvited] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const r = await userAPI.getReferralDetails();
        const s = r?.data?.data?.stats || {};
        const inv = r?.data?.data?.invitedFriends || [];
        if (!cancelled) {
          setStats({
            referralCount: Number(s.referralCount) || 0,
            totalReferralEarnings: Number(s.totalReferralEarnings) || 0,
            rewardAmount: Number(s.rewardAmount) || 0,
            totalInvited: Number(s.totalInvited) || 0,
            creditedCount: Number(s.creditedCount) || 0,
            pendingCount: Number(s.pendingCount) || 0,
            rejectedCount: Number(s.rejectedCount) || 0,
          });
          setInvited(Array.isArray(inv) ? inv : []);
        }
      } catch {
        if (!cancelled) {
          setInvited([]);
          toast.error("Failed to load referral details");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refId = userProfile?._id || userProfile?.id || userProfile?.referralCode || "";
  const referralLink = refId ? `${WEB_ORIGIN}/food/user/auth/login?ref=${encodeURIComponent(String(refId))}` : "";
  const shareText = useMemo(() => `Join ${companyName} and earn ${stats.rewardAmount > 0 ? `${R}${stats.rewardAmount}` : "rewards"}.`, [companyName, stats.rewardAmount]);
  const handleShare = async () => {
    if (!referralLink) return toast.error("Referral link unavailable");
    try {
      await shareLink({ title: `${companyName} referral`, text: shareText, url: referralLink });
    } catch {
      toast.error("Unable to share right now");
    }
    return undefined;
  };

  const StatCard = ({ Icon, label, value }) => (
    <View style={[styles.card, { flex: 1, padding: 12, marginBottom: 0 }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Icon size={14} color={palette.gray500} />
        <Txt weight={400} style={{ fontSize: 11, color: palette.gray500 }}>{label}</Txt>
      </View>
      <Txt weight={700} style={{ fontSize: 20, color: palette.gray900, marginTop: 4 }}>{value}</Txt>
    </View>
  );

  return (
    <Screen bg="#f5f5f5">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 96 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/profile"))} style={{ width: 32, height: 32, justifyContent: "center" }}><ArrowLeft size={20} color={palette.black} /></Pressable>
          <Txt weight={700} style={{ fontSize: 20, color: palette.black }}>Refer & Earn</Txt>
        </View>
        <View style={styles.card}>
          <Txt weight={400} style={{ fontSize: 14, color: palette.gray600 }}>Invite friends and earn when they sign up.</Txt>
          <View style={{ marginTop: 12, flexDirection: "row", gap: 8 }}>
            <View style={styles.tile}>
              <Txt weight={400} style={{ fontSize: 11, color: palette.gray500 }}>Reward per invite</Txt>
              <Txt weight={700} style={{ fontSize: 18, color: palette.amber600 }}>{R}{stats.rewardAmount}</Txt>
            </View>
            <View style={styles.tile}>
              <Txt weight={400} style={{ fontSize: 11, color: palette.gray500 }}>Referral earnings</Txt>
              <Txt weight={700} style={{ fontSize: 18, color: palette.green600 }}>{R}{stats.totalReferralEarnings}</Txt>
            </View>
          </View>
          <Button title="Share Invite" rounded="xl" size="lg" disabled={!referralLink} onPress={handleShare} icon={<Share2 size={16} color={palette.black} />} style={{ marginTop: 12 }} />
        </View>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
          <StatCard Icon={Users} label="Invited" value={stats.totalInvited} />
          <StatCard Icon={CircleCheck} label="Credited" value={stats.creditedCount} />
          <StatCard Icon={Wallet} label="Total" value={`${R}${stats.totalReferralEarnings}`} />
        </View>
        <View style={styles.card}>
          <Txt weight={600} style={{ fontSize: 14, color: palette.gray900, marginBottom: 12 }}>Invited Friends Status</Txt>
          {loading ? (
            <Txt weight={400} style={styles.muted}>Loading referrals...</Txt>
          ) : invited.length === 0 ? (
            <Txt weight={400} style={styles.muted}>No invited friends yet. Share your referral to start earning.</Txt>
          ) : (
            <View style={{ gap: 8 }}>
              {invited.map((it) => {
                const m = statusMeta[it?.status] || statusMeta.pending;
                const d = it?.invitedAt ? new Date(it.invitedAt) : null;
                return (
                  <View key={it?.id || it?.refereeId} style={styles.friend}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Txt weight={600} numberOfLines={1} style={{ fontSize: 14, color: palette.gray900 }}>{it?.name || "Friend"}</Txt>
                      <Txt weight={400} style={{ fontSize: 12, color: palette.gray500, marginTop: 2 }}>{it?.phone || "Phone hidden"}</Txt>
                      <Txt weight={400} style={{ fontSize: 11, color: palette.gray500, marginTop: 4 }}>Invited on {d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString() : "-"}</Txt>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: m.bg }}>
                        <m.Icon size={12} color={m.fg} />
                        <Txt weight={500} style={{ fontSize: 11, color: m.fg }}>{m.label}</Txt>
                      </View>
                      <Txt weight={400} style={{ fontSize: 12, marginTop: 8, color: palette.gray700 }}>Earned: {R}{Number(it?.earnedAmount) || 0}</Txt>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

export default function ReferEarnRoute() {
  return (
    <RequireAuth>
      <ReferEarnScreen />
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: palette.white, borderRadius: 16, padding: 16, marginBottom: 12, elevation: 1 },
  tile: { flex: 1, borderRadius: 12, backgroundColor: palette.gray50, padding: 12 },
  muted: { fontSize: 14, color: palette.gray500 },
  friend: { flexDirection: "row", justifyContent: "space-between", gap: 12, borderRadius: 12, borderWidth: 1, borderColor: palette.gray200, padding: 12 },
});
