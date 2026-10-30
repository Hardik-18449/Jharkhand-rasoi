import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Crown,
  Flame,
  Truck,
  Percent,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Wallet,
  ArrowRight,
  ArrowLeft,
  Zap,
  RefreshCw,
  Check,
  ChevronDown,
  ChevronUp,
  Award,
  UtensilsCrossed,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import confetti from "canvas-confetti";
import { userAPI } from "@food/api";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@food/components/ui/dialog";
import { Button } from "@food/components/ui/button";
import { Card, CardContent } from "@food/components/ui/card";
import { Badge } from "@food/components/ui/badge";
import AnimatedPage from "@food/components/user/AnimatedPage";
import { useCompanyName } from "@food/hooks/useCompanyName";
import useAppBackNavigation from "@food/hooks/useAppBackNavigation";

// Helper to guarantee strictly no emojis are rendered on this page
const cleanText = (str) => {
  if (!str || typeof str !== "string") return "";
  return str
    .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1FA00}-\u{1FAFF}]|[⭐★✨⚡🔥🎉👑💎🚀🛵?]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
};

export default function SubscriptionPage() {
  const companyName = useCompanyName() || "Jharkhand Rasoi";
  const navigate = useNavigate();
  const goBack = useAppBackNavigation();

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mySub, setMySub] = useState(null);
  const [walletBalance, setWalletBalance] = useState(0);

  // Subscribe Modal
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  // FAQs open state
  const [openFaq, setOpenFaq] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [plansRes, mySubRes, walletRes] = await Promise.allSettled([
        userAPI.getPublicSubscriptionPlans(),
        userAPI.getMySubscription(),
        userAPI.getWallet(),
      ]);

      if (plansRes.status === "fulfilled") {
        const pList = plansRes.value?.data?.data || plansRes.value?.data || [];
        const sorted = Array.isArray(pList)
          ? [...pList].sort((a, b) => (b.isPopular ? 1 : 0) - (a.isPopular ? 1 : 0))
          : [];
        setPlans(sorted);
      }

      if (mySubRes.status === "fulfilled") {
        setMySub(mySubRes.value?.data?.data || null);
      }

      if (walletRes.status === "fulfilled") {
        const wData = walletRes.value?.data?.data?.wallet || walletRes.value?.data?.wallet;
        setWalletBalance(Number(wData?.balance) || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSubscribe = (plan) => {
    setSelectedPlan(plan);
    setIsModalOpen(true);
  };

  const handleConfirmSubscribe = async () => {
    if (!selectedPlan) return;

    if (walletBalance < (selectedPlan.price || 0)) {
      toast.error(
        `Insufficient wallet balance. You need ₹${selectedPlan.price - walletBalance} more to activate this plan.`
      );
      return;
    }

    try {
      setIsSubscribing(true);
      const res = await userAPI.subscribePlan({
        planId: selectedPlan._id,
        paymentMethod: "wallet",
      });

      try {
        confetti({
          particleCount: 90,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#7e3866", "#F59E0B", "#10B981", "#3B82F6"],
        });
      } catch (e) {
        // ignore confetti errors
      }

      toast.success(res?.data?.message || `Welcome to ${cleanText(selectedPlan.name)}! VIP benefits active.`);
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Failed to activate subscription";
      toast.error(cleanText(msg) || msg);
      if (msg.toLowerCase().includes("insufficient") || msg.toLowerCase().includes("wallet")) {
        setTimeout(() => {
          if (window.confirm("Would you like to recharge your wallet now?")) {
            navigate("/user/wallet");
          }
        }, 600);
      }
    } finally {
      setIsSubscribing(false);
    }
  };

  const faqs = [
    {
      q: "How does Restaurant Kitchen Priority work?",
      a: "When you place an order as a VIP member, your order is flagged as High Priority on the restaurant's POS system. Chefs cook and pack your food ahead of standard queued orders, reducing your preparation wait time.",
    },
    {
      q: "Can I combine VIP perks with restaurant coupon codes?",
      a: "Yes. Your VIP benefits (including Kitchen Priority, Free Delivery on eligible orders, and member cashbacks) work seamlessly alongside any restaurant promo codes applied at checkout.",
    },
    {
      q: "How do I pay for my VIP Membership?",
      a: "Subscriptions are paid instantly using your Jharkhand Rasoi Wallet balance. If your balance is low, you can recharge your wallet with one tap and activate your VIP pass immediately.",
    },
    {
      q: "Is VIP membership valid across all partner restaurants?",
      a: "Yes, your VIP status is linked directly to your user account and applies automatically across all partner restaurants and kitchens on Jharkhand Rasoi.",
    },
    {
      q: "What happens when my VIP pass expires?",
      a: "You can renew or extend your pass at any time. When extending early, the new days are automatically added on top of your existing remaining validity.",
    },
  ];

  return (
    <AnimatedPage className="min-h-screen bg-white dark:bg-[#0a0a0a]">
      {/* 1. TOP APP BAR (System Standard) */}
      <div className="bg-white dark:bg-[#1a1a1a] sticky top-0 z-20 border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between px-4 sm:px-6 md:px-8 py-3.5 md:py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={goBack}
                className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5 md:h-6 md:w-6 text-gray-700 dark:text-white" />
              </button>
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-500 fill-amber-500" />
                <h1 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">
                  VIP Subscription
                </h1>
              </div>
            </div>

            <Link
              to="/user/wallet"
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 transition"
              title="View or Recharge Wallet"
            >
              <Wallet className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold text-gray-900 dark:text-white">
                ₹{walletBalance.toLocaleString("en-IN")}
              </span>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8 space-y-6 md:space-y-8">
        {/* 2. HERO BANNER (Admin Dynamic Theme Yellow with Black Text) */}
        <div className="relative overflow-hidden rounded-2xl bg-primary text-primary-foreground p-6 md:p-8 shadow-sm border border-primary/40">
          <div className="relative z-10 max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/10 text-black border border-black/15 text-xs font-bold uppercase tracking-wider">
              <Crown className="h-3.5 w-3.5 text-black fill-black" />
              <span>{companyName} VIP Club</span>
            </div>

            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-black leading-tight">
              Cooked First &amp; Served Faster.
            </h2>

            <p className="text-xs sm:text-sm text-black/85 font-medium leading-relaxed">
              Join the VIP tier to get priority cooking in restaurant kitchens, free delivery on eligible orders, and member-exclusive discounts.
            </p>

            {/* Quick Benefits Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
              <div className="bg-black/10 hover:bg-black/15 rounded-xl p-2.5 text-center border border-black/15 transition-colors">
                <Flame className="h-4 w-4 text-black mx-auto mb-1" />
                <div className="text-xs font-bold text-black">Kitchen Priority</div>
                <div className="text-[10px] text-black/80 font-medium">Cooked First</div>
              </div>

              <div className="bg-black/10 hover:bg-black/15 rounded-xl p-2.5 text-center border border-black/15 transition-colors">
                <Truck className="h-4 w-4 text-black mx-auto mb-1" />
                <div className="text-xs font-bold text-black">Free Delivery</div>
                <div className="text-[10px] text-black/80 font-medium">Eligible orders</div>
              </div>

              <div className="bg-black/10 hover:bg-black/15 rounded-xl p-2.5 text-center border border-black/15 transition-colors">
                <Percent className="h-4 w-4 text-black mx-auto mb-1" />
                <div className="text-xs font-bold text-black">Extra Discounts</div>
                <div className="text-[10px] text-black/80 font-medium">Up to 20% OFF</div>
              </div>

              <div className="bg-black/10 hover:bg-black/15 rounded-xl p-2.5 text-center border border-black/15 transition-colors">
                <Award className="h-4 w-4 text-black mx-auto mb-1" />
                <div className="text-xs font-bold text-black">VIP Badge</div>
                <div className="text-[10px] text-black/80 font-medium">Profile &amp; Orders</div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. ACTIVE MEMBERSHIP STATUS (If user is currently subscribed) */}
        {mySub?.isSubscribed && (
          <Card className="bg-gradient-to-r from-amber-500/10 via-amber-400/15 to-yellow-500/10 rounded-2xl border border-amber-300 dark:border-amber-600/30 p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge className="bg-amber-500 text-black font-extrabold text-[10px] uppercase tracking-wider">
                    {cleanText(mySub.badgeText) || "VIP"} ACTIVE
                  </Badge>
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-300">
                    Kitchen Priority Rank #{mySub.priorityLevel || 1}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {cleanText(mySub.planName) || "VIP Pass Member"}
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-300 font-medium">
                  Your orders are automatically marked <strong>VIP PRIORITY - SERVE FIRST</strong> on restaurant kitchen screens.
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl p-3 sm:text-right border border-gray-200 dark:border-gray-700 shadow-xs">
                <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">
                  Membership Validity
                </div>
                <div className="text-lg font-extrabold text-gray-900 dark:text-white">
                  {mySub.daysRemaining} Days Remaining
                </div>
                <div className="text-[10px] text-gray-500">
                  Expires {new Date(mySub.expiresAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* 4. SUBSCRIPTION PLANS SECTION */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                Choose Your VIP Plan
              </h2>
              <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Instant activation with kitchen priority queue across all restaurant partners.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center space-y-2">
              <RefreshCw className="h-7 w-7 animate-spin text-primary mx-auto" />
              <p className="text-xs text-gray-500 font-semibold">Loading VIP plans...</p>
            </div>
          ) : plans.length === 0 ? (
            <Card className="p-8 text-center border-dashed rounded-2xl">
              <Crown className="h-10 w-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                VIP Plans Updating
              </p>
              <p className="text-xs text-gray-500 mt-1">
                New seasonal plans are currently being refreshed. Please check back shortly.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {plans.map((plan) => {
                const isPopular = Boolean(plan.isPopular);
                const isCurrentPlan = mySub?.isSubscribed && mySub?.planName === plan.name;
                const cleanedBadge = cleanText(plan.badgeText) || "VIP";
                const cleanedName = cleanText(plan.name) || plan.name;
                const cleanedDesc = cleanText(plan.description) || plan.description;

                const discountPercent =
                  plan.originalPrice > plan.price
                    ? Math.round(((plan.originalPrice - plan.price) / plan.originalPrice) * 100)
                    : null;

                return (
                  <Card
                    key={plan._id}
                    className={`rounded-2xl transition-all duration-200 flex flex-col justify-between overflow-hidden relative ${
                      isPopular
                        ? "border-2 border-amber-400 shadow-md ring-2 ring-amber-300/30"
                        : "border border-gray-200 dark:border-gray-800 hover:border-gray-300 shadow-xs"
                    }`}
                  >
                    {/* RECOMMENDED CHOICE BANNER */}
                    {isPopular && (
                      <div className="bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-300 text-black text-xs font-black uppercase tracking-wider py-1.5 px-4 text-center flex items-center justify-center gap-1.5 shadow-xs">
                        <Crown className="h-3.5 w-3.5 fill-black text-black" />
                        <span>Recommended Choice</span>
                      </div>
                    )}

                    <CardContent className="p-5 md:p-6 flex-1 space-y-4">
                      {/* Plan Header */}
                      <div className="flex items-center justify-between">
                        <Badge
                          className="font-bold text-[10px] uppercase text-white shadow-xs"
                          style={{ backgroundColor: plan.badgeColor || "#7e3866" }}
                        >
                          {cleanedBadge}
                        </Badge>

                        <div className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 rounded-full">
                          <Clock className="h-3 w-3 text-primary" />
                          <span>{plan.durationDays} Days</span>
                        </div>
                      </div>

                      {/* Name & Desc */}
                      <div>
                        <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">
                          {cleanedName}
                        </h3>
                        {cleanedDesc ? (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                            {cleanedDesc}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Full VIP priority access and kitchen queue privileges.
                          </p>
                        )}
                      </div>

                      {/* Pricing */}
                      <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-extrabold text-gray-900 dark:text-white">
                            ₹{plan.price}
                          </span>
                          {plan.originalPrice > plan.price && (
                            <span className="text-sm font-semibold text-gray-400 line-through">
                              ₹{plan.originalPrice}
                            </span>
                          )}
                          {discountPercent && (
                            <span className="text-[11px] font-bold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 px-2 py-0.5 rounded-full">
                              Save {discountPercent}%
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                          {plan.durationDays >= 365
                            ? "Full year access"
                            : plan.durationDays >= 90
                            ? "3 months validity"
                            : "30 days validity"}
                        </div>
                      </div>

                      {/* Kitchen Priority Callout */}
                      <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-xl p-3 flex items-start gap-2.5">
                        <Flame className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                        <div className="text-xs text-gray-700 dark:text-gray-200">
                          <span className="font-bold text-primary block">
                            Kitchen Priority Rank #{plan.priorityLevel || 1}
                          </span>
                          Orders cooked first before standard customer tickets.
                        </div>
                      </div>

                      {/* Features List */}
                      <div className="space-y-2 pt-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          Plan Benefits:
                        </div>
                        {plan.features?.map((feat, fIdx) => {
                          const cleanedFeat = cleanText(feat);
                          if (!cleanedFeat) return null;
                          return (
                            <div
                              key={fIdx}
                              className="flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300 font-medium"
                            >
                              <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5 stroke-[2.5]" />
                              <span>{cleanedFeat}</span>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>

                    {/* CTA Button */}
                    <div className="p-5 pt-0">
                      <Button
                        onClick={() => handleOpenSubscribe(plan)}
                        className={`w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-xs ${
                          isPopular
                            ? "bg-amber-400 hover:bg-amber-500 text-black font-extrabold shadow-xs"
                            : "bg-gray-900 hover:bg-black text-white dark:bg-white dark:text-gray-950 dark:hover:bg-gray-100"
                        }`}
                      >
                        <span>{isCurrentPlan ? "Extend Plan" : "Get VIP Pass"}</span>
                        <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* 5. HOW KITCHEN PRIORITY WORKS (Clean 4-Step Flow) */}
        <div className="space-y-4 pt-2">
          <div className="space-y-0.5">
            <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">
              How Kitchen Priority Works
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Your order travels through a fast-track preparation sequence.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <Card className="rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-xs space-y-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                1
              </div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">VIP Tag Attached</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Your order is tagged High Priority as soon as payment is confirmed.
              </p>
            </Card>

            <Card className="rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-xs space-y-2">
              <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center font-bold text-xs">
                2
              </div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">Kitchen POS Alert</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                The restaurant terminal rings with an urgent VIP Serve First banner.
              </p>
            </Card>

            <Card className="rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-xs space-y-2">
              <div className="h-8 w-8 rounded-lg bg-orange-50 dark:bg-orange-950/40 text-orange-600 flex items-center justify-center font-bold text-xs">
                3
              </div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">Prepared First</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Chefs place your food in active cooking pans ahead of standard orders.
              </p>
            </Card>

            <Card className="rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-xs space-y-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center font-bold text-xs">
                4
              </div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">Express Handover</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Delivery partner collects piping hot food without waiting delays.
              </p>
            </Card>
          </div>
        </div>

        {/* 6. FOUR CORE VIP PRIVILEGES */}
        <div className="space-y-4 pt-2">
          <div className="space-y-0.5">
            <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">
              VIP Membership Privileges
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Everything included with your VIP pass.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <Card className="rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-xs space-y-2">
              <div className="h-9 w-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
                <Flame className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">Top Kitchen Priority</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Never wait behind standard online orders during lunch and dinner rushes.
              </p>
            </Card>

            <Card className="rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-xs space-y-2">
              <div className="h-9 w-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                <Truck className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">Free Delivery</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Pay zero delivery fees on all orders meeting the minimum order amount.
              </p>
            </Card>

            <Card className="rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-xs space-y-2">
              <div className="h-9 w-9 rounded-xl bg-pink-50 dark:bg-pink-950/40 text-pink-600 flex items-center justify-center">
                <Percent className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">Exclusive Discounts</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Extra member-only cashbacks and discounts stackable on top of coupons.
              </p>
            </Card>

            <Card className="rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-xs space-y-2">
              <div className="h-9 w-9 rounded-xl bg-yellow-50 dark:bg-yellow-950/40 text-yellow-600 flex items-center justify-center">
                <Crown className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">Gold VIP Badge</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Distinguished VIP badge displayed on your profile and live order tracking screen.
              </p>
            </Card>
          </div>
        </div>

        {/* 7. FREQUENTLY ASKED QUESTIONS */}
        <div className="space-y-4 pt-2">
          <div className="space-y-0.5">
            <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">
              Frequently Asked Questions
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Answers to common questions about VIP membership.
            </p>
          </div>

          <div className="space-y-2 max-w-3xl">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <Card
                  key={idx}
                  className="rounded-xl border border-gray-100 dark:border-gray-800 shadow-xs overflow-hidden"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-4 text-left flex items-center justify-between gap-3 text-xs sm:text-sm font-bold text-gray-900 dark:text-white hover:text-primary transition-colors"
                  >
                    <span>{faq.q}</span>
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 text-primary flex-shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 text-xs text-gray-600 dark:text-gray-300 leading-relaxed font-medium border-t border-gray-50 dark:border-gray-800 pt-3">
                      {faq.a}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>

        {/* 8. GUARANTEE STRIP */}
        <Card className="rounded-2xl p-4 border border-gray-100 dark:border-gray-800 flex items-center gap-3.5 shadow-xs">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white">
              100% Kitchen Priority Guarantee
            </h4>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
              Every order placed during your active membership triggers a priority alert on partner restaurant POS terminals.
            </p>
          </div>
        </Card>
      </div>

      {/* 9. CONFIRMATION / PURCHASE MODAL */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500 fill-amber-500" />
              <span>Confirm VIP Pass</span>
            </DialogTitle>
          </DialogHeader>

          {selectedPlan && (
            <div className="space-y-4 pt-2">
              {/* Selected Plan Summary Card */}
              <div
                className="p-4 rounded-xl text-white shadow-xs space-y-1"
                style={{ backgroundColor: selectedPlan.badgeColor || "#7e3866" }}
              >
                <div className="flex items-center justify-between">
                  <Badge className="bg-black/20 text-white font-bold text-[10px] uppercase">
                    {cleanText(selectedPlan.badgeText) || "VIP"}
                  </Badge>
                  <span className="text-xs font-semibold text-white/90">
                    {selectedPlan.durationDays} Days Validity
                  </span>
                </div>
                <div className="text-lg font-bold text-white pt-1">
                  {cleanText(selectedPlan.name)}
                </div>
                <div className="flex items-baseline gap-2 pt-0.5">
                  <span className="text-2xl font-extrabold text-white">
                    ₹{selectedPlan.price}
                  </span>
                  {selectedPlan.originalPrice > selectedPlan.price && (
                    <span className="text-xs font-semibold text-white/70 line-through">
                      ₹{selectedPlan.originalPrice}
                    </span>
                  )}
                </div>
              </div>

              {/* Kitchen Priority Callout */}
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex items-start gap-2.5">
                <Flame className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 dark:text-amber-300">
                  <span className="font-bold block">
                    Priority Preparation Rank #{selectedPlan.priorityLevel || 1}
                  </span>
                  Your orders will be tagged <strong>VIP PRIORITY - SERVE FIRST</strong> on restaurant POS screens.
                </div>
              </div>

              {/* Wallet Balance Verification */}
              <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-3.5 border border-gray-200 dark:border-gray-700 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400 font-semibold flex items-center gap-1.5">
                    <Wallet className="h-4 w-4 text-primary" />
                    Wallet Balance:
                  </span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    ₹{walletBalance.toLocaleString("en-IN")}
                  </span>
                </div>

                {walletBalance >= (selectedPlan.price || 0) ? (
                  <div className="text-[11px] font-semibold text-green-600 dark:text-green-400 flex items-center gap-1 pt-1 border-t border-gray-200 dark:border-gray-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Balance sufficient. Instant activation.</span>
                  </div>
                ) : (
                  <div className="space-y-2 pt-1 border-t border-gray-200 dark:border-gray-700">
                    <div className="text-[11px] font-semibold text-red-600 dark:text-red-400 flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" />
                      <span>
                        Need ₹{(selectedPlan.price || 0) - walletBalance} more to activate.
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/user/wallet")}
                      className="w-full text-xs font-bold text-primary border-primary/30 hover:bg-primary/5 flex items-center justify-center gap-1.5"
                    >
                      <span>Recharge Wallet</span>
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <DialogFooter className="pt-2 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmSubscribe}
                  disabled={isSubscribing || walletBalance < (selectedPlan.price || 0)}
                  className="bg-primary hover:bg-primary/90 text-black rounded-xl text-xs font-extrabold shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubscribing ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-black" />
                      <span>Activating...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="h-3.5 w-3.5 fill-black text-black" />
                      <span>Pay ₹{selectedPlan.price} &amp; Join VIP</span>
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AnimatedPage>
  );
}
