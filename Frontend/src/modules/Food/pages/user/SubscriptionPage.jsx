import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Crown,
  Sparkles,
  Flame,
  Truck,
  Percent,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Wallet,
  ArrowRight,
  ChevronLeft,
  Zap,
  RefreshCw,
  Check,
  ChevronDown,
  ChevronUp,
  Star,
  Award,
  TrendingUp,
  UtensilsCrossed,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import confetti from "canvas-confetti";
import { userAPI } from "@food/api";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@food/components/ui/dialog";

// Helper to guarantee strictly zero emojis are rendered on this page
const cleanText = (str) => {
  if (!str || typeof str !== "string") return "";
  return str
    .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1FA00}-\u{1FAFF}]|[⭐★✨⚡🔥🎉👑💎🚀🛵?]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
};

export default function SubscriptionPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mySub, setMySub] = useState(null);
  const [walletBalance, setWalletBalance] = useState(0);

  // Subscribe Modal
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  // Savings Calculator frequency
  const [ordersPerMonth, setOrdersPerMonth] = useState(4);

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
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#F59E0B", "#FBBF24", "#10B981", "#3B82F6"],
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

  const popularPlan = useMemo(() => {
    return plans.find((p) => p.isPopular) || plans[0] || null;
  }, [plans]);

  // Savings Calculator
  const calculatedSavings = useMemo(() => {
    const avgDeliveryFee = 50;
    const avgDiscountPerOrder = 45;
    const monthlyDeliverySaved = ordersPerMonth * avgDeliveryFee;
    const monthlyDiscountSaved = ordersPerMonth * avgDiscountPerOrder;
    const totalMonthlySaved = monthlyDeliverySaved + monthlyDiscountSaved;
    const totalYearlySaved = totalMonthlySaved * 12;
    const minutesSaved = ordersPerMonth * 15;
    return {
      monthlyDeliverySaved,
      monthlyDiscountSaved,
      totalMonthlySaved,
      totalYearlySaved,
      minutesSaved,
    };
  }, [ordersPerMonth]);

  const faqs = [
    {
      q: "How does Restaurant Kitchen Priority work?",
      a: "When you place an order with your active VIP pass, restaurant kitchen screens and POS systems receive an instant 'VIP PRIORITY - SERVE FIRST' alert. Chefs prepare and package your food ahead of standard queued orders, reducing your kitchen waiting time.",
    },
    {
      q: "Can I combine VIP perks with restaurant coupon codes?",
      a: "Yes! Your VIP benefits (such as Kitchen Priority, Free Delivery, and member cashbacks) work seamlessly alongside any restaurant promo codes or seasonal discounts available at checkout.",
    },
    {
      q: "How do I pay for my VIP Membership?",
      a: "Subscriptions are activated instantly using your Jharkhand Rasoi Wallet balance. If your balance is low, you can recharge your wallet with one tap and activate your VIP pass immediately.",
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
    <div className="min-h-screen bg-[#F9F9FB] text-gray-900 pb-28 select-none">
      {/* 1. TOP APP BAR (Consistent with App Light Theme) */}
      <div className="bg-white/90 backdrop-blur-md border-b border-gray-100 sticky top-0 z-40 px-4 py-3 shadow-xs">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-full transition"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-400 p-0.5 shadow-xs flex items-center justify-center">
              <div className="w-full h-full bg-white rounded-full flex items-center justify-center">
                <Crown className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
              </div>
            </div>
            <span className="text-sm font-black tracking-tight text-gray-900">
              VIP PRIORITY CLUB
            </span>
          </div>

          <button
            onClick={() => navigate("/user/wallet")}
            className="flex items-center gap-1.5 text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1.5 rounded-full transition shadow-xs"
            title="View or Recharge Wallet"
          >
            <Wallet className="h-3.5 w-3.5 text-amber-600" />
            <span>₹{walletBalance.toLocaleString("en-IN")}</span>
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pt-6 space-y-8">
        {/* 2. REFINED LUXURY HERO BANNER */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gray-950 via-slate-900 to-amber-950 text-white p-6 sm:p-9 shadow-xl">
          <div className="absolute top-0 right-0 -mt-12 -mr-12 h-64 w-64 rounded-full bg-amber-500/20 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -mb-12 -ml-12 h-64 w-64 rounded-full bg-yellow-500/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3.5 max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black uppercase tracking-wider">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                <span>VIP Priority Privilege</span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white leading-tight">
                Skip The Kitchen Wait. <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500">
                  Cooked &amp; Served First.
                </span>
              </h1>

              <p className="text-xs sm:text-sm text-gray-300 font-medium leading-relaxed">
                Whenever you order as a VIP member, partner kitchens receive a high-priority dispatch signal and cook your meal ahead of regular tickets.
              </p>

              {/* 4 Privilege Highlight Chips */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 border border-white/10 text-center">
                  <div className="h-7 w-7 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-1">
                    <Flame className="h-4 w-4" />
                  </div>
                  <div className="text-[11px] font-black text-white">Top Priority #1</div>
                  <div className="text-[9px] text-gray-300">Cooked First</div>
                </div>

                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 border border-white/10 text-center">
                  <div className="h-7 w-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-1">
                    <Truck className="h-4 w-4" />
                  </div>
                  <div className="text-[11px] font-black text-white">Free Delivery</div>
                  <div className="text-[9px] text-gray-300">On eligible orders</div>
                </div>

                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 border border-white/10 text-center">
                  <div className="h-7 w-7 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center mx-auto mb-1">
                    <Percent className="h-4 w-4" />
                  </div>
                  <div className="text-[11px] font-black text-white">Up to 20% OFF</div>
                  <div className="text-[9px] text-gray-300">VIP Cashbacks</div>
                </div>

                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 border border-white/10 text-center">
                  <div className="h-7 w-7 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center justify-center mx-auto mb-1">
                    <Crown className="h-4 w-4" />
                  </div>
                  <div className="text-[11px] font-black text-white">VIP Badge</div>
                  <div className="text-[9px] text-gray-300">Profile &amp; Orders</div>
                </div>
              </div>
            </div>

            {/* VIP Pass Preview Card */}
            <div className="w-full md:w-72 flex-shrink-0">
              <div className="rounded-2xl bg-gradient-to-br from-amber-500/30 to-yellow-600/10 p-0.5 shadow-xl">
                <div className="rounded-[15px] bg-[#121622] p-5 border border-amber-500/40 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">
                      VIP PASS
                    </span>
                    <Crown className="h-4 w-4 text-amber-400" />
                  </div>

                  <div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase">Membership Tier</div>
                    <div className="text-lg font-black text-white">PRIORITY CLUB</div>
                    <div className="text-xs text-amber-300/80 font-medium">Kitchen Express Queue</div>
                  </div>

                  <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[11px]">
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Active Priority
                    </span>
                    <span className="text-gray-400 font-medium">Instant Activation</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. ACTIVE MEMBERSHIP BADGE (If Already Subscribed) */}
        {mySub?.isSubscribed && (
          <div className="rounded-3xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 p-5 text-gray-950 shadow-md border border-amber-300">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-black text-amber-300 px-2.5 py-0.5 rounded-full">
                    {cleanText(mySub.badgeText) || "VIP PASS"} ACTIVE
                  </span>
                  <span className="text-xs font-black text-amber-950 bg-black/10 px-2.5 py-0.5 rounded-full">
                    Priority Rank #{mySub.priorityLevel || 1}
                  </span>
                </div>
                <h2 className="text-xl font-black text-gray-950 tracking-tight">
                  {cleanText(mySub.planName) || "VIP Member"}
                </h2>
                <p className="text-xs text-amber-950 font-semibold">
                  Your orders are automatically marked <strong>VIP PRIORITY - SERVE FIRST</strong> on restaurant screens.
                </p>
              </div>

              <div className="bg-white/90 backdrop-blur-md rounded-2xl p-3 sm:text-right border border-white/60 shadow-xs">
                <div className="text-[10px] font-bold text-gray-600 uppercase">Validity Remaining</div>
                <div className="text-xl font-black text-gray-950">{mySub.daysRemaining} Days Left</div>
                <div className="text-[10px] text-gray-500">Expires {new Date(mySub.expiresAt).toLocaleDateString()}</div>
              </div>
            </div>
          </div>
        )}

        {/* 4. REDESIGNED PLAN CARDS (Matching Clean App Theme) */}
        <div className="space-y-5">
          <div className="text-center space-y-1">
            <span className="text-xs font-black uppercase tracking-widest text-amber-600 flex items-center justify-center gap-1.5">
              <Award className="h-4 w-4" />
              <span>Choose Your VIP Pass</span>
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
              Select Your Privilege Plan
            </h2>
            <p className="text-xs text-gray-500 max-w-md mx-auto font-medium">
              Instant activation with kitchen priority status across all Jharkhand Rasoi restaurant partners.
            </p>
          </div>

          {loading ? (
            <div className="py-16 text-center space-y-2">
              <RefreshCw className="h-7 w-7 animate-spin text-amber-500 mx-auto" />
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                Loading VIP plans...
              </p>
            </div>
          ) : plans.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-gray-100 shadow-sm max-w-md mx-auto">
              <Crown className="h-10 w-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-gray-800">VIP Plans Updating</p>
              <p className="text-xs text-gray-400 mt-1">
                New seasonal VIP club passes are currently being refreshed.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              {plans.map((plan) => {
                const isPopular = Boolean(plan.isPopular);
                const isCurrentPlan = mySub?.isSubscribed && mySub?.planName === plan.name;
                const cleanedBadge = cleanText(plan.badgeText) || "VIP";
                const cleanedName = cleanText(plan.name) || plan.name;
                const cleanedDesc = cleanText(plan.description) || plan.description;

                const perDayCost = plan.durationDays > 0 ? (plan.price / plan.durationDays).toFixed(1) : 0;
                const discountPercent =
                  plan.originalPrice > plan.price
                    ? Math.round(((plan.originalPrice - plan.price) / plan.originalPrice) * 100)
                    : null;

                return (
                  <div
                    key={plan._id}
                    className={`bg-white rounded-3xl transition-all duration-200 flex flex-col justify-between overflow-hidden relative ${
                      isPopular
                        ? "border-2 border-amber-400 ring-4 ring-amber-100 shadow-xl md:-translate-y-1.5"
                        : "border border-gray-200 hover:border-amber-300 shadow-sm hover:shadow-md"
                    }`}
                  >
                    {/* MOST POPULAR CHOICE TOP RIBBON */}
                    {isPopular && (
                      <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-gray-950 font-black text-[11px] uppercase tracking-wider py-1.5 px-4 text-center flex items-center justify-center gap-1.5 shadow-xs">
                        <Sparkles className="h-3.5 w-3.5 fill-gray-950" />
                        <span>Most Popular Choice</span>
                        <Sparkles className="h-3.5 w-3.5 fill-gray-950" />
                      </div>
                    )}

                    <div className="p-6 flex-1 space-y-4">
                      {/* Badge & Duration */}
                      <div className="flex items-center justify-between">
                        <span
                          className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full text-white shadow-xs"
                          style={{ backgroundColor: plan.badgeColor || "#F59E0B" }}
                        >
                          {cleanedBadge}
                        </span>

                        <div className="flex items-center gap-1 text-xs font-bold text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full">
                          <Clock className="h-3 w-3 text-amber-500" />
                          <span>{plan.durationDays} Days</span>
                        </div>
                      </div>

                      {/* Plan Name & Tagline */}
                      <div>
                        <h3 className="text-xl font-black text-gray-900 tracking-tight">
                          {cleanedName}
                        </h3>
                        {cleanedDesc ? (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                            {cleanedDesc}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-500 mt-1">
                            Full VIP priority access and express restaurant preparation.
                          </p>
                        )}
                      </div>

                      {/* Price Section */}
                      <div className="pt-2 border-t border-gray-100 space-y-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-black text-gray-950 tracking-tight">
                            ₹{plan.price}
                          </span>
                          {plan.originalPrice > plan.price && (
                            <span className="text-sm font-bold text-gray-400 line-through">
                              ₹{plan.originalPrice}
                            </span>
                          )}
                          {discountPercent && (
                            <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              Save {discountPercent}%
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] font-semibold text-amber-700 flex items-center gap-1">
                          <TrendingUp className="h-3 w-3 text-amber-600" />
                          <span>Just ₹{perDayCost}/day • Pays for itself in 2 orders</span>
                        </div>
                      </div>

                      {/* Kitchen Priority Banner */}
                      <div className="bg-amber-50/80 rounded-2xl p-3 border border-amber-200/80 flex items-start gap-2.5">
                        <div className="h-7 w-7 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Flame className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-xs font-black text-amber-950">
                            Kitchen Priority Rank #{plan.priorityLevel || 1}
                          </div>
                          <div className="text-[11px] text-amber-800 font-medium leading-snug">
                            Orders cooked first before standard customer tickets.
                          </div>
                        </div>
                      </div>

                      {/* Features List */}
                      <div className="space-y-2 pt-2">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          Included Benefits:
                        </div>
                        {plan.features?.map((feat, fIdx) => {
                          const cleanedFeat = cleanText(feat);
                          if (!cleanedFeat) return null;
                          return (
                            <div
                              key={fIdx}
                              className="flex items-start gap-2 text-xs text-gray-700 font-medium"
                            >
                              <div className="h-4 w-4 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <Check className="h-2.5 w-2.5 stroke-[3]" />
                              </div>
                              <span className="leading-snug">{cleanedFeat}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* CTA Button */}
                    <div className="p-6 pt-0">
                      <button
                        onClick={() => handleOpenSubscribe(plan)}
                        className={`w-full py-3.5 px-4 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 shadow-sm ${
                          isPopular
                            ? "bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-gray-950 hover:brightness-105 shadow-amber-200"
                            : "bg-gray-900 text-white hover:bg-black"
                        }`}
                      >
                        <span>{isCurrentPlan ? "Extend VIP Pass" : "Unlock VIP Pass"}</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 5. PROCESS FLOW: HOW KITCHEN PRIORITY WORKS */}
        <div className="rounded-3xl bg-white border border-gray-100 p-6 sm:p-8 space-y-6 shadow-xs">
          <div className="text-center space-y-1">
            <span className="text-xs font-black uppercase tracking-widest text-amber-600">
              Kitchen Workflow
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-gray-900">
              How Kitchen Priority Works
            </h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              A direct link between customer checkout and restaurant kitchen displays.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-50/70 rounded-2xl p-4 border border-gray-100 space-y-2">
              <div className="text-[10px] font-black uppercase text-amber-700 bg-amber-100/70 w-fit px-2 py-0.5 rounded">
                Step 01
              </div>
              <div className="h-9 w-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                <Zap className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-black text-gray-900">VIP Tag Attached</h4>
              <p className="text-xs text-gray-600 leading-relaxed font-medium">
                Your order is instantly marked with a high-priority VIP badge at checkout.
              </p>
            </div>

            <div className="bg-slate-50/70 rounded-2xl p-4 border border-gray-100 space-y-2">
              <div className="text-[10px] font-black uppercase text-amber-700 bg-amber-100/70 w-fit px-2 py-0.5 rounded">
                Step 02
              </div>
              <div className="h-9 w-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                <Flame className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-black text-gray-900">POS Alert Rings</h4>
              <p className="text-xs text-gray-600 leading-relaxed font-medium">
                Restaurant screens flash &quot;VIP PRIORITY - SERVE FIRST&quot; with an audio chime.
              </p>
            </div>

            <div className="bg-slate-50/70 rounded-2xl p-4 border border-gray-100 space-y-2">
              <div className="text-[10px] font-black uppercase text-amber-700 bg-amber-100/70 w-fit px-2 py-0.5 rounded">
                Step 03
              </div>
              <div className="h-9 w-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                <UtensilsCrossed className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-black text-gray-900">Cooked First</h4>
              <p className="text-xs text-gray-600 leading-relaxed font-medium">
                Chefs place your order in the active pans ahead of regular customer orders.
              </p>
            </div>

            <div className="bg-slate-50/70 rounded-2xl p-4 border border-gray-100 space-y-2">
              <div className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-100/70 w-fit px-2 py-0.5 rounded">
                Step 04
              </div>
              <div className="h-9 w-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <Truck className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-black text-gray-900">Fast Express Handover</h4>
              <p className="text-xs text-gray-600 leading-relaxed font-medium">
                Delivery partner collects hot food without restaurant waiting delay.
              </p>
            </div>
          </div>
        </div>

        {/* 6. INTERACTIVE SAVINGS CALCULATOR */}
        <div className="rounded-3xl bg-white border border-gray-100 p-6 sm:p-8 space-y-5 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-black uppercase tracking-widest text-amber-600">
                Savings Calculator
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-gray-900 mt-1">
                How Much Will You Save?
              </h3>
              <p className="text-xs text-gray-500">
                Calculate your estimated monthly return on a VIP pass.
              </p>
            </div>

            {/* Frequency Pills */}
            <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-2xl self-start md:self-auto">
              {[2, 4, 8, 12].map((num) => (
                <button
                  key={num}
                  onClick={() => setOrdersPerMonth(num)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    ordersPerMonth === num
                      ? "bg-amber-500 text-gray-950 font-black shadow-xs"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {num} orders/mo
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            <div className="bg-emerald-50/60 rounded-2xl p-4 border border-emerald-100 space-y-1">
              <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                Monthly Delivery Savings
              </div>
              <div className="text-2xl font-black text-emerald-700">
                ₹{calculatedSavings.monthlyDeliverySaved}
              </div>
              <div className="text-[10px] text-emerald-600 font-medium">
                Avg ₹50 delivery fee saved per order
              </div>
            </div>

            <div className="bg-purple-50/60 rounded-2xl p-4 border border-purple-100 space-y-1">
              <div className="text-[11px] font-bold text-purple-800 uppercase tracking-wider">
                Monthly VIP Discounts
              </div>
              <div className="text-2xl font-black text-purple-700">
                ₹{calculatedSavings.monthlyDiscountSaved}
              </div>
              <div className="text-[10px] text-purple-600 font-medium">
                10-20% extra member-only discounts
              </div>
            </div>

            <div className="bg-amber-50/80 rounded-2xl p-4 border border-amber-200/80 space-y-1">
              <div className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">
                Estimated Yearly Savings
              </div>
              <div className="text-2xl font-black text-amber-700">
                ₹{calculatedSavings.totalYearlySaved.toLocaleString("en-IN")}
              </div>
              <div className="text-[10px] text-amber-800 font-medium">
                Plus ~{calculatedSavings.minutesSaved} mins saved in kitchen wait!
              </div>
            </div>
          </div>
        </div>

        {/* 7. COMPARISON TABLE: REGULAR VS VIP */}
        <div className="rounded-3xl bg-white border border-gray-100 overflow-hidden shadow-xs">
          <div className="p-6 pb-4 text-center">
            <span className="text-xs font-black uppercase tracking-widest text-amber-600">
              The Difference
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-gray-900 mt-1">
              Regular Order vs VIP Member
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-y border-gray-100 bg-gray-50/70">
                  <th className="py-3.5 px-6 font-bold text-gray-500 uppercase tracking-wider">
                    Privilege
                  </th>
                  <th className="py-3.5 px-6 font-bold text-gray-500 uppercase tracking-wider w-1/3">
                    Regular Customer
                  </th>
                  <th className="py-3.5 px-6 font-black text-amber-800 uppercase tracking-wider w-1/3 bg-amber-50/60">
                    VIP Member
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                <tr>
                  <td className="py-3.5 px-6 text-gray-900 font-bold">Kitchen Queue Position</td>
                  <td className="py-3.5 px-6 text-gray-500">Standard queue (behind earlier tickets)</td>
                  <td className="py-3.5 px-6 text-amber-900 font-bold bg-amber-50/30 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    Priority #1 Cooked First
                  </td>
                </tr>

                <tr>
                  <td className="py-3.5 px-6 text-gray-900 font-bold">Delivery Fee</td>
                  <td className="py-3.5 px-6 text-gray-500">Standard ₹40 - ₹80 per order</td>
                  <td className="py-3.5 px-6 text-emerald-700 font-bold bg-amber-50/30 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    Zero Free Delivery on eligible orders
                  </td>
                </tr>

                <tr>
                  <td className="py-3.5 px-6 text-gray-900 font-bold">Extra Member Discounts</td>
                  <td className="py-3.5 px-6 text-gray-500">None (standard coupons only)</td>
                  <td className="py-3.5 px-6 text-amber-900 font-bold bg-amber-50/30 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    Extra 10% - 20% OFF on select menus
                  </td>
                </tr>

                <tr>
                  <td className="py-3.5 px-6 text-gray-900 font-bold">App Identity Badge</td>
                  <td className="py-3.5 px-6 text-gray-500">Standard user</td>
                  <td className="py-3.5 px-6 text-amber-900 font-bold bg-amber-50/30 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    Gold Crown Badge on Profile &amp; Orders
                  </td>
                </tr>

                <tr>
                  <td className="py-3.5 px-6 text-gray-900 font-bold">VIP Customer Support</td>
                  <td className="py-3.5 px-6 text-gray-500">Standard queue</td>
                  <td className="py-3.5 px-6 text-amber-900 font-bold bg-amber-50/30 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    24/7 Dedicated Priority Line
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 8. MEMBER REVIEWS (SOCIAL PROOF - ZERO EMOJIS) */}
        <div className="space-y-4">
          <div className="text-center space-y-1">
            <span className="text-xs font-black uppercase tracking-widest text-amber-600">
              Verified Feedback
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-gray-900">
              What VIP Members Say
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-xs space-y-2.5">
              <div className="flex items-center gap-1 text-amber-500">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-xs text-gray-600 leading-relaxed font-medium">
                &quot;The Kitchen Priority is very noticeable. My Friday dinner order used to take 50 minutes, now it arrives hot in 22 minutes because the chef cooked it right away.&quot;
              </p>
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-gray-900">Ananya Sen</div>
                  <div className="text-[10px] text-gray-400">Ranchi • VIP Member</div>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Verified
                </span>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-xs space-y-2.5">
              <div className="flex items-center gap-1 text-amber-500">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-xs text-gray-600 leading-relaxed font-medium">
                &quot;Free delivery on every single weekend order paid for my entire subscription in just the first week. Plus the VIP badge looks great on the profile.&quot;
              </p>
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-gray-900">Vikram Malhotra</div>
                  <div className="text-[10px] text-gray-400">Jamshedpur • VIP Member</div>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Verified
                </span>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-xs space-y-2.5">
              <div className="flex items-center gap-1 text-amber-500">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-xs text-gray-600 leading-relaxed font-medium">
                &quot;Ordering for office lunches everyday was getting expensive with delivery fees. VIP Club completely resolved that and our food arrives faster than anyone else&apos;s.&quot;
              </p>
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-gray-900">Rohit Verma</div>
                  <div className="text-[10px] text-gray-400">Dhanbad • VIP Member</div>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Verified
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 9. FREQUENTLY ASKED QUESTIONS (ACCORDION) */}
        <div className="rounded-3xl bg-white border border-gray-100 p-6 sm:p-8 space-y-4 shadow-xs">
          <div className="text-center space-y-1 pb-1">
            <span className="text-xs font-black uppercase tracking-widest text-amber-600">
              Clear Answers
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-gray-900">
              Frequently Asked Questions
            </h3>
          </div>

          <div className="space-y-2.5 max-w-3xl mx-auto">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl bg-gray-50/70 border border-gray-100 overflow-hidden transition"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-4 text-left flex items-center justify-between gap-3 text-xs sm:text-sm font-bold text-gray-900 hover:text-amber-700 transition"
                  >
                    <span>{faq.q}</span>
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 text-amber-600 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 text-xs text-gray-600 leading-relaxed font-medium border-t border-gray-100 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 10. GUARANTEE FOOTNOTE */}
        <div className="rounded-3xl bg-white border border-gray-100 p-5 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left shadow-xs">
          <div className="h-11 w-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="space-y-0.5">
            <h4 className="text-sm font-black text-gray-900">
              100% Kitchen Priority &amp; Satisfaction Guarantee
            </h4>
            <p className="text-xs text-gray-500 font-medium">
              Every single order placed under your VIP membership triggers top-priority dispatch on partner kitchen POS screens.
            </p>
          </div>
        </div>
      </div>

      {/* 11. MOBILE FLOATING ACTION BAR (STICKY BOTTOM QUICK CONVERT) */}
      {popularPlan && !loading && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200 p-3 shadow-lg">
          <div className="flex items-center justify-between gap-3 max-w-md mx-auto">
            <div>
              <div className="text-[10px] font-black uppercase text-amber-600 tracking-wider flex items-center gap-1">
                <Crown className="h-3 w-3" />
                <span>{cleanText(popularPlan.name)}</span>
              </div>
              <div className="text-sm font-black text-gray-950 flex items-baseline gap-1.5">
                <span>₹{popularPlan.price}</span>
                <span className="text-[10px] font-normal text-gray-500">
                  / {popularPlan.durationDays} Days
                </span>
              </div>
            </div>

            <button
              onClick={() => handleOpenSubscribe(popularPlan)}
              className="bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-gray-950 font-black text-xs uppercase tracking-wider px-5 py-3 rounded-xl shadow-md active:scale-95 transition"
            >
              Get VIP Pass
            </button>
          </div>
        </div>
      )}

      {/* 12. CONFIRMATION / PURCHASE MODAL */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md bg-white text-gray-900 border border-gray-100 rounded-3xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-gray-900 flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500 fill-amber-500" />
              <span>Activate VIP Pass</span>
            </DialogTitle>
          </DialogHeader>

          {selectedPlan && (
            <div className="space-y-4 pt-2">
              {/* Selected Plan Summary Card */}
              <div
                className="p-4 rounded-2xl text-white shadow-xs space-y-1"
                style={{ backgroundColor: selectedPlan.badgeColor || "#F59E0B" }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase bg-black/20 px-2.5 py-0.5 rounded-full">
                    {cleanText(selectedPlan.badgeText) || "VIP"}
                  </span>
                  <span className="text-xs font-bold text-white/90">
                    {selectedPlan.durationDays} Days Validity
                  </span>
                </div>
                <div className="text-xl font-black text-white pt-1">
                  {cleanText(selectedPlan.name)}
                </div>
                <div className="flex items-baseline gap-2 pt-1">
                  <span className="text-2xl font-black text-white">
                    ₹{selectedPlan.price}
                  </span>
                  {selectedPlan.originalPrice > selectedPlan.price && (
                    <span className="text-xs font-bold text-white/70 line-through">
                      ₹{selectedPlan.originalPrice}
                    </span>
                  )}
                </div>
              </div>

              {/* Kitchen Priority Guarantee Callout */}
              <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3 flex items-start gap-2.5">
                <Flame className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900">
                  <span className="font-bold text-amber-950 block">
                    Priority Preparation Rank #{selectedPlan.priorityLevel || 1}
                  </span>
                  Your orders will be tagged <strong>VIP PRIORITY - SERVE FIRST</strong> on restaurant POS screens.
                </div>
              </div>

              {/* Wallet Balance Verification */}
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 font-bold flex items-center gap-1.5">
                    <Wallet className="h-4 w-4 text-amber-600" />
                    Available Wallet Balance:
                  </span>
                  <span className="font-black text-gray-900">
                    ₹{walletBalance.toLocaleString("en-IN")}
                  </span>
                </div>

                {walletBalance >= (selectedPlan.price || 0) ? (
                  <div className="text-[11px] font-bold text-emerald-700 flex items-center gap-1 pt-1 border-t border-gray-200">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Balance sufficient. Instant activation.</span>
                  </div>
                ) : (
                  <div className="space-y-2 pt-1 border-t border-gray-200">
                    <div className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" />
                      <span>
                        Need ₹{(selectedPlan.price || 0) - walletBalance} more to activate.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate("/user/wallet")}
                      className="w-full py-2 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs border border-amber-200 flex items-center justify-center gap-1.5 transition"
                    >
                      <span>Recharge Wallet</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <DialogFooter className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSubscribe}
                  disabled={isSubscribing || walletBalance < (selectedPlan.price || 0)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-gray-950 text-xs font-black shadow-md hover:brightness-105 transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubscribing ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Activating...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="h-3.5 w-3.5 fill-gray-950" />
                      <span>Pay ₹{selectedPlan.price} &amp; Join VIP</span>
                    </>
                  )}
                </button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
