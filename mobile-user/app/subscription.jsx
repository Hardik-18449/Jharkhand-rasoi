/** VIP subscription — port of pages/user/SubscriptionPage.jsx (wallet or Razorpay). */
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Crown, Flame, Truck, Percent, ShieldCheck, Wallet, ArrowLeft, Zap, RefreshCw, Check, ChevronDown, ChevronUp, Award, AlertCircle, CreditCard } from "lucide-react-native";
import Txt from "../src/components/ui/Txt";
import Screen from "../src/components/ui/Screen";
import BottomSheet from "../src/components/ui/BottomSheet";
import Confetti from "../src/components/Confetti";
import { userAPI } from "../src/api";
import { initRazorpayPayment } from "../src/utils/razorpay";
import { useCompanyName } from "../src/hooks/useCompanyName";
import { toast } from "../src/utils/toast";
import { palette } from "../src/theme";

const THEMES = [
  { pill: ["#FFCE85", "#291700"], title: "#FFB84D" },
  { pill: ["#FFD2D7", "#1E0408"], title: "#FF8093" },
  { pill: ["#A7D1ED", "#051C2C"], title: "#85C4F0" },
  { pill: ["#D8F872", "#132300"], title: "#C2F53E" },
  { pill: ["#C4B5FD", "#1E0845"], title: "#A78BFA" },
  { pill: ["#A7F3D0", "#022C22"], title: "#6EE7B7" },
];
const cleanText = (s) =>
  !s || typeof s !== "string"
    ? ""
    : s
        .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1FA00}-\u{1FAFF}]|[⭐★✨⚡🔥🎉👑💎🚀🛵?]/gu, "")
        .replace(/\s+/g, " ")
        .trim();
const FAQS = [
  ["How does Restaurant Kitchen Priority work?", "When you place an order as a VIP member, your order is flagged as High Priority on the restaurant's POS system. Chefs cook and pack your food ahead of standard queued orders, reducing your preparation wait time."],
  ["Can I combine VIP perks with restaurant coupon codes?", "Yes. Your VIP benefits (including Kitchen Priority, Free Delivery on eligible orders, and member cashbacks) work seamlessly alongside any restaurant promo codes applied at checkout."],
  ["How do I pay for my VIP Membership?", "Subscriptions are paid instantly using your Jharkhand Rasoi Wallet balance. If your balance is low, you can recharge your wallet with one tap and activate your VIP pass immediately."],
  ["Is VIP membership valid across all partner restaurants?", "Yes, your VIP status is linked directly to your user account and applies automatically across all partner restaurants and kitchens on Jharkhand Rasoi."],
  ["What happens when my VIP pass expires?", "You can renew or extend your pass at any time. When extending early, the new days are automatically added on top of your existing remaining validity."],
];
const STEPS = [
  ["1", "VIP Tag Attached", "Your order is tagged High Priority as soon as payment is confirmed.", "rgba(254,198,0,0.1)", palette.amber600],
  ["2", "Kitchen POS Alert", "The restaurant terminal rings with an urgent VIP Serve First banner.", "#fffbeb", palette.amber600],
  ["3", "Prepared First", "Chefs place your food in active cooking pans ahead of standard orders.", palette.orange50, palette.orange600],
  ["4", "Express Handover", "Delivery partner collects piping hot food without waiting delays.", "#ecfdf5", palette.emerald600],
];
const PRIVS = [
  [Flame, "Top Kitchen Priority", "Never wait behind standard online orders during lunch and dinner rushes.", "#fffbeb", palette.amber600],
  [Truck, "Free Delivery", "Pay zero delivery fees on all orders meeting the minimum order amount.", "#ecfdf5", palette.emerald600],
  [Percent, "Exclusive Discounts", "Extra member-only cashbacks and discounts stackable on top of coupons.", "#fdf2f8", "#db2777"],
  [Crown, "Gold VIP Badge", "Distinguished VIP badge displayed on your profile and live order tracking screen.", "#fefce8", "#ca8a04"],
];
const BENEFITS = [
  [Flame, "Kitchen Priority", "Cooked First"],
  [Truck, "Free Delivery", "Eligible orders"],
  [Percent, "Extra Discounts", "Up to 20% OFF"],
  [Award, "VIP Badge", "Profile & Orders"],
];

export default function SubscriptionScreen() {
  const router = useRouter();
  const companyName = useCompanyName() || "Jharkhand Rasoi";
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mySub, setMySub] = useState(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("online");
  const [openFaq, setOpenFaq] = useState(null);
  const [celebrate, setCelebrate] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [p, s, w] = await Promise.allSettled([userAPI.getPublicSubscriptionPlans(), userAPI.getMySubscription(), userAPI.getWallet()]);
      if (p.status === "fulfilled") {
        const l = p.value?.data?.data || p.value?.data || [];
        setPlans(Array.isArray(l) ? [...l].sort((a, b) => (b.isPopular ? 1 : 0) - (a.isPopular ? 1 : 0)) : []);
      }
      if (s.status === "fulfilled") setMySub(s.value?.data?.data || null);
      if (w.status === "fulfilled") setWalletBalance(Number((w.value?.data?.data?.wallet || w.value?.data?.wallet)?.balance) || 0);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    loadData();
  }, []);
  const burst = () => {
    setCelebrate(true);
    setTimeout(() => setCelebrate(false), 3000);
  };

  const openSubscribe = (plan) => {
    setSelectedPlan(plan);
    setPaymentMethod(walletBalance >= (plan.price || 0) ? "wallet" : "online");
    setIsModalOpen(true);
  };
  const confirm = async () => {
    if (!selectedPlan) return;
    if (paymentMethod === "wallet") {
      if (walletBalance < (selectedPlan.price || 0)) {
        toast.error(`Insufficient wallet balance (₹${walletBalance}). Please choose Online Payment or recharge wallet.`);
        setPaymentMethod("online");
        return;
      }
      try {
        setIsSubscribing(true);
        const r = await userAPI.subscribePlan({ planId: selectedPlan._id, paymentMethod: "wallet" });
        burst();
        toast.success(r?.data?.message || `Welcome to ${cleanText(selectedPlan.name)}! VIP benefits active.`);
        setIsModalOpen(false);
        loadData();
      } catch (e) {
        const m = e?.response?.data?.message || e?.message || "Failed to activate subscription";
        toast.error(cleanText(m) || m);
      } finally {
        setIsSubscribing(false);
      }
      return;
    }
    try {
      setIsSubscribing(true);
      const o = await userAPI.createSubscriptionRazorpayOrder({ planId: selectedPlan._id });
      const { razorpay } = o?.data?.data || o?.data || {};
      if (!razorpay?.orderId || !razorpay?.key) throw new Error("Failed to initialize payment gateway. Please try again or use wallet.");
      let u = {};
      try {
        const ur = await userAPI.getProfile();
        u = ur?.data?.data?.user || ur?.data?.user || {};
      } catch {}
      const plan = selectedPlan;
      await initRazorpayPayment({
        key: razorpay.key,
        amount: razorpay.amount,
        currency: razorpay.currency || "INR",
        order_id: razorpay.orderId,
        name: companyName,
        description: `${cleanText(plan.name)} VIP Membership`,
        prefill: { name: u.name || "", email: u.email || "", contact: String(u.phone || "").replace(/\D/g, "").slice(-10) },
        notes: { type: "subscription_purchase", planId: String(plan._id) },
        handler: async (resp) => {
          try {
            setIsSubscribing(true);
            const r = await userAPI.subscribePlan({ planId: plan._id, paymentMethod: "razorpay", razorpayPaymentId: resp.razorpay_payment_id, razorpayOrderId: resp.razorpay_order_id, razorpaySignature: resp.razorpay_signature });
            burst();
            toast.success(r?.data?.message || `Welcome to ${cleanText(plan.name)}! VIP membership active.`);
            setIsModalOpen(false);
            loadData();
          } catch (e) {
            toast.error(e?.response?.data?.message || e?.message || "Payment verification failed");
          } finally {
            setIsSubscribing(false);
          }
        },
        onError: (e) => {
          setIsSubscribing(false);
          if (e?.description) toast.error(e.description);
        },
        onClose: () => setIsSubscribing(false),
      });
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Failed to initialize online payment");
      setIsSubscribing(false);
    }
  };

  const sp = selectedPlan;
  const insufficient = sp && paymentMethod === "wallet" && walletBalance < (sp.price || 0);

  return (
    <Screen bg={palette.white}>
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" }}><ArrowLeft size={20} color={palette.gray700} /></Pressable>
          <Crown size={20} color={palette.amber500} fill={palette.amber500} />
          <Txt weight={700} style={{ fontSize: 18, color: palette.gray900 }}>VIP Subscription</Txt>
        </View>
        <Pressable onPress={() => router.push("/wallet")} style={styles.walletPill}>
          <Wallet size={16} color={palette.amber600} />
          <Txt weight={700} style={{ fontSize: 12, color: palette.gray900 }}>₹{walletBalance.toLocaleString("en-IN")}</Txt>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingVertical: 24, gap: 24, paddingBottom: 40 }}>
        <View style={styles.hero}>
          <View style={styles.heroPill}>
            <Crown size={14} color={palette.black} fill={palette.black} />
            <Txt weight={700} style={{ fontSize: 12, color: palette.black, letterSpacing: 1 }}>{`${companyName} VIP Club`.toUpperCase()}</Txt>
          </View>
          <Txt weight={800} style={{ fontSize: 24, color: palette.black, lineHeight: 30, marginTop: 12 }}>Cooked First &amp; Served Faster.</Txt>
          <Txt weight={500} style={{ fontSize: 12, color: "rgba(0,0,0,0.85)", lineHeight: 18, marginTop: 12 }}>Join the VIP tier to get priority cooking in restaurant kitchens, free delivery on eligible orders, and member-exclusive discounts.</Txt>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, paddingTop: 12 }}>
            {BENEFITS.map(([Icon, t, s]) => (
              <View key={t} style={styles.benefit}>
                <Icon size={16} color={palette.black} />
                <Txt weight={700} style={{ fontSize: 12, color: palette.black, marginTop: 4 }}>{t}</Txt>
                <Txt weight={500} style={{ fontSize: 10, color: "rgba(0,0,0,0.8)" }}>{s}</Txt>
              </View>
            ))}
          </View>
        </View>

        {mySub?.isSubscribed ? (
          <View style={styles.activeCard}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ backgroundColor: palette.amber500, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}><Txt weight={800} style={{ fontSize: 10, color: palette.black, letterSpacing: 1 }}>{(cleanText(mySub.badgeText) || "VIP").toUpperCase()} ACTIVE</Txt></View>
              <Txt weight={700} style={{ fontSize: 12, color: "#78350f" }}>Kitchen Priority Rank #{mySub.priorityLevel || 1}</Txt>
            </View>
            <Txt weight={700} style={{ fontSize: 18, color: palette.gray900, marginTop: 4 }}>{cleanText(mySub.planName) || "VIP Pass Member"}</Txt>
            <Txt weight={500} style={{ fontSize: 12, color: palette.gray600, marginTop: 4 }}>Your orders are automatically marked <Txt weight={700} style={{ fontSize: 12 }}>VIP PRIORITY - SERVE FIRST</Txt> on restaurant kitchen screens.</Txt>
            <View style={styles.validity}>
              <Txt weight={700} style={{ fontSize: 10, color: palette.gray500, letterSpacing: 1 }}>MEMBERSHIP VALIDITY</Txt>
              <Txt weight={800} style={{ fontSize: 18, color: palette.gray900 }}>{mySub.daysRemaining} Days Remaining</Txt>
              <Txt weight={400} style={{ fontSize: 10, color: palette.gray500 }}>Expires {new Date(mySub.expiresAt).toLocaleDateString()}</Txt>
            </View>
          </View>
        ) : null}

        <View style={{ gap: 16 }}>
          <View>
            <Txt weight={700} style={{ fontSize: 20, color: palette.gray900 }}>Choose Your VIP Plan</Txt>
            <Txt weight={400} style={{ fontSize: 12, color: palette.gray500, marginTop: 2 }}>Instant activation with kitchen priority queue across all restaurant partners.</Txt>
          </View>
          {loading ? (
            <View style={{ paddingVertical: 64, alignItems: "center", gap: 8 }}>
              <ActivityIndicator color={palette.yellow} size="large" />
              <Txt weight={600} style={{ fontSize: 12, color: palette.gray500 }}>Loading VIP plans...</Txt>
            </View>
          ) : plans.length === 0 ? (
            <View style={styles.emptyPlans}>
              <Crown size={40} color={palette.gray300} />
              <Txt weight={700} style={{ fontSize: 14, color: palette.gray800, marginTop: 8 }}>VIP Plans Updating</Txt>
              <Txt weight={400} style={{ fontSize: 12, color: palette.gray500, marginTop: 4, textAlign: "center" }}>New seasonal plans are currently being refreshed. Please check back shortly.</Txt>
            </View>
          ) : (
            plans.map((plan, i) => {
              const th = THEMES[i % THEMES.length];
              const current = mySub?.isSubscribed && mySub?.planName === plan.name;
              const name = cleanText(plan.name) || plan.name;
              const disc = plan.originalPrice > plan.price ? Math.round(((plan.originalPrice - plan.price) / plan.originalPrice) * 100) : null;
              const dur = plan.durationDays >= 365 ? "1 year" : plan.durationDays >= 60 ? `${Math.round(plan.durationDays / 30)} months` : `${plan.durationDays || 30} days`;
              const Bullet = ({ children }) => (
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Txt weight={900} style={{ fontSize: 16, color: "rgba(255,255,255,0.6)", lineHeight: 20 }}>•</Txt>
                  <Txt weight={500} style={{ fontSize: 14, color: "#e5e7eb", flex: 1, lineHeight: 20 }}>{children}</Txt>
                </View>
              );
              return (
                <View key={plan._id} style={styles.planCard}>
                  <View style={{ alignSelf: "flex-start", backgroundColor: th.pill[0], paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6, marginBottom: 16 }}>
                    <Txt weight={900} style={{ fontSize: 12, color: th.pill[1] }}>{plan.isPopular ? `₹${plan.price} for ${dur}` : disc ? `Save ${disc}%` : `₹${plan.price} for ${dur}`}</Txt>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <Crown size={14} color={palette.amber400} fill={palette.amber400} />
                    <Txt weight={700} style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", letterSpacing: 1 }}>VIP CLUB</Txt>
                  </View>
                  <Txt weight={900} style={{ fontSize: 26, color: th.title, marginBottom: 8 }}>{name}</Txt>
                  <Txt weight={900} style={{ fontSize: 14, color: palette.white }}>₹{plan.price} for {dur}</Txt>
                  <Txt weight={500} style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
                    {plan.originalPrice > plan.price ? (
                      <>
                        <Txt weight={500} style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", textDecorationLine: "line-through" }}>₹{plan.originalPrice}</Txt> Save {disc}%
                      </>
                    ) : (
                      "Cancel or extend anytime"
                    )}
                  </Txt>
                  <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.1)", marginVertical: 16 }} />
                  <View style={{ gap: 10, marginBottom: 24 }}>
                    <Bullet>Kitchen Priority Cooking (Rank #{plan.priorityLevel || 1})</Bullet>
                    <Bullet>{plan.freeDeliveryMinOrder > 0 ? `Free delivery on orders above ₹${plan.freeDeliveryMinOrder}` : "Free delivery on all eligible orders"}</Bullet>
                    {plan.discountPercent > 0 ? <Bullet>Extra {plan.discountPercent}% OFF on partner restaurants</Bullet> : null}
                    {(plan.features || []).map((f, k) => (cleanText(f) ? <Bullet key={k}>{cleanText(f)}</Bullet> : null))}
                    <Bullet>One-time payment via UPI, Cards, Netbanking or Wallet</Bullet>
                  </View>
                  <Pressable onPress={() => openSubscribe(plan)} style={{ borderRadius: 999, paddingVertical: 14, alignItems: "center", backgroundColor: th.pill[0] }}>
                    <Txt weight={900} style={{ fontSize: 14, color: th.pill[1], letterSpacing: 1 }}>{(current ? "Current Plan" : `Get ${name}`).toUpperCase()}</Txt>
                  </Pressable>
                  <Txt weight={400} style={{ marginTop: 12, fontSize: 11, color: "rgba(255,255,255,0.5)", textAlign: "center", lineHeight: 16 }}>₹{plan.price} for {plan.durationDays} days. Valid on all orders. Cancel anytime. Terms apply.</Txt>
                </View>
              );
            })
          )}
        </View>

        <View style={{ gap: 16 }}>
          <View>
            <Txt weight={700} style={{ fontSize: 18, color: palette.gray900 }}>How Kitchen Priority Works</Txt>
            <Txt weight={400} style={{ fontSize: 12, color: palette.gray500 }}>Your order travels through a fast-track preparation sequence.</Txt>
          </View>
          {STEPS.map(([n, t, d, bg, fg]) => (
            <View key={n} style={styles.infoCard}>
              <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}><Txt weight={700} style={{ fontSize: 12, color: fg }}>{n}</Txt></View>
              <Txt weight={700} style={{ fontSize: 14, color: palette.gray900 }}>{t}</Txt>
              <Txt weight={400} style={{ fontSize: 12, color: palette.gray500 }}>{d}</Txt>
            </View>
          ))}
        </View>

        <View style={{ gap: 16 }}>
          <View>
            <Txt weight={700} style={{ fontSize: 18, color: palette.gray900 }}>VIP Membership Privileges</Txt>
            <Txt weight={400} style={{ fontSize: 12, color: palette.gray500 }}>Everything included with your VIP pass.</Txt>
          </View>
          {PRIVS.map(([Icon, t, d, bg, fg]) => (
            <View key={t} style={styles.infoCard}>
              <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}><Icon size={16} color={fg} /></View>
              <Txt weight={700} style={{ fontSize: 14, color: palette.gray900 }}>{t}</Txt>
              <Txt weight={400} style={{ fontSize: 12, color: palette.gray500 }}>{d}</Txt>
            </View>
          ))}
        </View>

        <View style={{ gap: 16 }}>
          <View>
            <Txt weight={700} style={{ fontSize: 18, color: palette.gray900 }}>Frequently Asked Questions</Txt>
            <Txt weight={400} style={{ fontSize: 12, color: palette.gray500 }}>Answers to common questions about VIP membership.</Txt>
          </View>
          <View style={{ gap: 8 }}>
            {FAQS.map(([q, a], idx) => {
              const open = openFaq === idx;
              return (
                <View key={idx} style={styles.faq}>
                  <Pressable onPress={() => setOpenFaq(open ? null : idx)} style={{ padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <Txt weight={700} style={{ fontSize: 12, color: palette.gray900, flex: 1 }}>{q}</Txt>
                    {open ? <ChevronUp size={16} color={palette.amber600} /> : <ChevronDown size={16} color={palette.gray400} />}
                  </Pressable>
                  {open ? (
                    <View style={{ paddingHorizontal: 16, paddingBottom: 16, paddingTop: 12, borderTopWidth: 1, borderColor: palette.gray50 }}>
                      <Txt weight={500} style={{ fontSize: 12, color: palette.gray600, lineHeight: 18 }}>{a}</Txt>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>

        <View style={[styles.infoCard, { flexDirection: "row", alignItems: "center", gap: 14 }]}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(254,198,0,0.1)", alignItems: "center", justifyContent: "center" }}><ShieldCheck size={20} color={palette.amber600} /></View>
          <View style={{ flex: 1 }}>
            <Txt weight={700} style={{ fontSize: 12, color: palette.gray900 }}>100% Kitchen Priority Guarantee</Txt>
            <Txt weight={500} style={{ fontSize: 11, color: palette.gray500 }}>Every order placed during your active membership triggers a priority alert on partner restaurant POS terminals.</Txt>
          </View>
        </View>
      </ScrollView>

      <BottomSheet visible={isModalOpen} onClose={() => !isSubscribing && setIsModalOpen(false)} maxHeightRatio={0.92}>
        {sp ? (
          <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(245,158,11,0.1)", alignItems: "center", justifyContent: "center" }}><Crown size={18} color={palette.amber500} fill={palette.amber500} /></View>
              <Txt weight={900} style={{ fontSize: 18, color: palette.gray900 }}>Confirm VIP Pass</Txt>
            </View>
            <View style={[styles.planSummary, { backgroundColor: sp.badgeColor || "#7e3866" }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ backgroundColor: "rgba(0,0,0,0.25)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", paddingHorizontal: 10, paddingVertical: 2, borderRadius: 999 }}><Txt weight={800} style={{ fontSize: 10, color: palette.white, letterSpacing: 1 }}>{(cleanText(sp.badgeText) || "VIP").toUpperCase()}</Txt></View>
                <View style={{ backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 10, paddingVertical: 2, borderRadius: 999 }}><Txt weight={700} style={{ fontSize: 12, color: palette.white }}>{sp.durationDays} Days Validity</Txt></View>
              </View>
              <Txt weight={900} style={{ fontSize: 18, color: palette.white, marginTop: 8 }}>{cleanText(sp.name)}</Txt>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                <Txt weight={900} style={{ fontSize: 26, color: palette.white }}>₹{sp.price}</Txt>
                {sp.originalPrice > sp.price ? (
                  <>
                    <Txt weight={700} style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", textDecorationLine: "line-through" }}>₹{sp.originalPrice}</Txt>
                    <View style={{ backgroundColor: palette.white, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}><Txt weight={800} style={{ fontSize: 10, color: palette.black }}>Save {Math.round(((sp.originalPrice - sp.price) / sp.originalPrice) * 100)}%</Txt></View>
                  </>
                ) : null}
              </View>
            </View>
            <View style={styles.callout}>
              <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "rgba(245,158,11,0.2)", alignItems: "center", justifyContent: "center" }}><Flame size={16} color={palette.amber500} fill={palette.amber500} /></View>
              <Txt weight={400} style={{ flex: 1, fontSize: 12, color: "#451a03", lineHeight: 17 }}>
                <Txt weight={800} style={{ fontSize: 12, color: "#78350f" }}>Priority Preparation Rank #{sp.priorityLevel || 1}{"\n"}</Txt>
                Your orders will be tagged <Txt weight={700} style={{ fontSize: 12 }}>VIP PRIORITY - COOK &amp; SERVE FIRST</Txt> on restaurant POS screens.
              </Txt>
            </View>
            <Txt weight={700} style={{ fontSize: 11, color: palette.gray500, letterSpacing: 1 }}>CHOOSE PAYMENT METHOD</Txt>
            {[
              ["online", CreditCard, "Pay Online (UPI / Card)", "Google Pay, PhonePe, Paytm, Cards, Netbanking", palette.emerald500, palette.white, ["Instant", "#d1fae5", "#047857"]],
              ["wallet", Wallet, "Jharkhand Rasoi Wallet", null, palette.amber500, palette.black, walletBalance >= (sp.price || 0) ? ["Sufficient", palette.green100, palette.green700] : ["Low Balance", "#fef3c7", "#b45309"]],
            ].map(([id, Icon, title, sub, accent, onAccent, badge]) => {
              const on = paymentMethod === id;
              return (
                <Pressable key={id} onPress={() => setPaymentMethod(id)} style={[styles.payOpt, on && { borderColor: accent, backgroundColor: id === "online" ? "rgba(16,185,129,0.05)" : "rgba(245,158,11,0.05)" }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: on ? accent : palette.gray200, alignItems: "center", justifyContent: "center" }}><Icon size={20} color={on ? onAccent : palette.gray700} /></View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <Txt weight={700} style={{ fontSize: 13, color: palette.gray900 }}>{title}</Txt>
                        <View style={{ backgroundColor: badge[1], paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999 }}><Txt weight={800} style={{ fontSize: 10, color: badge[2] }}>{badge[0]}</Txt></View>
                      </View>
                      <Txt weight={500} style={{ fontSize: 11, color: palette.gray500 }}>
                        {sub || (
                          <>
                            Available Balance: <Txt weight={700} style={{ fontSize: 11, color: palette.gray900 }}>₹{walletBalance.toLocaleString("en-IN")}</Txt>
                          </>
                        )}
                      </Txt>
                    </View>
                  </View>
                  <View style={[styles.radio, on && { borderColor: accent, backgroundColor: accent }]}>{on ? <Check size={12} color={onAccent} strokeWidth={3} /> : null}</View>
                </Pressable>
              );
            })}
            {insufficient ? (
              <View style={styles.need}>
                <Txt weight={500} style={{ fontSize: 12, color: "#78350f", flex: 1 }}>Need ₹{(sp.price || 0) - walletBalance} more in wallet.</Txt>
                <Pressable onPress={() => setPaymentMethod("online")}><Txt weight={700} style={{ fontSize: 12, color: palette.emerald600 }}>Pay Online Instead →</Txt></Pressable>
              </View>
            ) : null}
            <Pressable disabled={isSubscribing || insufficient} onPress={confirm} style={[styles.confirm, (isSubscribing || insufficient) && { opacity: 0.5 }]}>
              {isSubscribing ? <RefreshCw size={16} color={palette.black} /> : insufficient ? <AlertCircle size={16} color={palette.black} /> : <Zap size={16} color={palette.black} fill={palette.black} />}
              <Txt weight={900} style={{ fontSize: 14, color: palette.black }}>
                {isSubscribing ? "Processing Activation..." : paymentMethod === "online" ? `Pay ₹${sp.price} via Online & Join VIP` : walletBalance >= (sp.price || 0) ? `Pay ₹${sp.price} from Wallet & Join VIP` : "Wallet Insufficient - Choose Online"}
              </Txt>
            </Pressable>
            <Pressable onPress={() => setIsModalOpen(false)} style={{ height: 40, alignItems: "center", justifyContent: "center" }}>
              <Txt weight={700} style={{ fontSize: 12, color: palette.gray500 }}>Cancel</Txt>
            </Pressable>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <ShieldCheck size={14} color={palette.emerald500} />
              <Txt weight={500} style={{ fontSize: 10, color: palette.gray400 }}>100% Secure • Instant Kitchen Priority Guaranteed</Txt>
            </View>
          </ScrollView>
        ) : null}
      </BottomSheet>
      {celebrate ? <Confetti count={90} colors={["#FEC600", "#F59E0B", "#10B981", "#3B82F6"]} loop={false} duration={[1500, 2800]} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, backgroundColor: palette.white, borderBottomWidth: 1, borderColor: palette.gray100 },
  walletPill: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: palette.gray50, borderWidth: 1, borderColor: palette.gray200 },
  hero: { borderRadius: 16, backgroundColor: palette.yellow, padding: 24, borderWidth: 1, borderColor: "rgba(254,198,0,0.4)" },
  heroPill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.1)", borderWidth: 1, borderColor: "rgba(0,0,0,0.15)" },
  benefit: { width: "47%", backgroundColor: "rgba(0,0,0,0.1)", borderRadius: 12, padding: 10, alignItems: "center", borderWidth: 1, borderColor: "rgba(0,0,0,0.15)" },
  activeCard: { borderRadius: 16, borderWidth: 1, borderColor: "#fcd34d", backgroundColor: "rgba(245,158,11,0.12)", padding: 20 },
  validity: { marginTop: 16, backgroundColor: palette.white, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: palette.gray200 },
  emptyPlans: { padding: 32, alignItems: "center", borderWidth: 1, borderStyle: "dashed", borderColor: palette.gray300, borderRadius: 16 },
  planCard: { borderRadius: 16, backgroundColor: "#1e1e1e", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", padding: 24, paddingTop: 20, elevation: 6 },
  infoCard: { borderRadius: 16, padding: 16, borderWidth: 1, borderColor: palette.gray100, backgroundColor: palette.white, gap: 8, elevation: 1 },
  faq: { borderRadius: 12, borderWidth: 1, borderColor: palette.gray100, backgroundColor: palette.white, overflow: "hidden" },
  planSummary: { padding: 16, borderRadius: 16, gap: 4 },
  callout: { flexDirection: "row", gap: 10, backgroundColor: "rgba(245,158,11,0.1)", borderWidth: 1, borderColor: "rgba(245,158,11,0.25)", borderRadius: 16, padding: 12 },
  payOpt: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderRadius: 16, borderWidth: 2, borderColor: palette.gray200, backgroundColor: "rgba(249,250,251,0.5)" },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: palette.gray300, alignItems: "center", justifyContent: "center" },
  need: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fffbeb", borderWidth: 1, borderColor: "#fde68a", borderRadius: 12, padding: 12 },
  confirm: { height: 48, borderRadius: 16, backgroundColor: palette.amber500, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 12 },
});
