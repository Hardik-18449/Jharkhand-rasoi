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
  X,
  ChevronDown,
  ChevronUp,
  Star,
  Award,
  HelpCircle,
  TrendingUp,
  UtensilsCrossed,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import confetti from "canvas-confetti";
import { userAPI } from "@food/api";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@food/components/ui/dialog";

// Helper to guarantee strictly no emojis are rendered
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

  // Savings Calculator frequency: orders per month
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

    // Check wallet balance
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

      // Trigger celebration confetti
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#F59E0B", "#FBBF24", "#10B981", "#3B82F6"],
        });
      } catch (e) {
        // ignore if confetti fails
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

  // Best/Popular plan calculation for sticky CTA
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
    const minutesSaved = ordersPerMonth * 15; // 15 mins saved per order in kitchen queue
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
      a: "When you place an order as a VIP member, your order is highlighted on the restaurant's POS system with a 'VIP PRIORITY - SERVE FIRST' tag. Chefs prepare and pack your order ahead of all regular queued orders, cutting down preparation wait time significantly.",
    },
    {
      q: "Can I combine VIP perks with restaurant coupon codes?",
      a: "Yes! Your VIP benefits (including Kitchen Priority and Free Delivery on eligible orders) work seamlessly alongside existing restaurant promo codes and ongoing discount vouchers.",
    },
    {
      q: "How do I pay for my VIP Membership?",
      a: "Subscriptions are paid instantly using your in-app Wallet balance. If your wallet balance is insufficient, you can easily top up your wallet with 1-click and then activate your pass immediately.",
    },
    {
      q: "Is VIP membership valid across all partner restaurants?",
      a: "Yes, your VIP status is linked directly to your user account and is automatically active at every restaurant and kitchen partner listed on Jharkhand Rasoi.",
    },
    {
      q: "What happens when my VIP pass expires?",
      a: "You can renew or extend your VIP pass at any time before or after expiration with a single tap. If you extend early, your new days will automatically be added on top of your existing remaining days.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#0A0D14] text-slate-100 pb-28 select-none">
      {/* 1. TOP APP BAR */}
      <div className="bg-[#0D111A]/90 backdrop-blur-xl border-b border-amber-500/20 sticky top-0 z-40 px-4 py-3 shadow-lg shadow-black/40">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full border border-white/10 transition"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 p-0.5 shadow-sm shadow-amber-500/30 flex items-center justify-center">
              <div className="w-full h-full bg-gray-950 rounded-full flex items-center justify-center">
                <Crown className="h-3.5 w-3.5 text-amber-400" />
              </div>
            </div>
            <span className="text-sm font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400">
              VIP PRIORITY CLUB
            </span>
          </div>

          <button
            onClick={() => navigate("/user/wallet")}
            className="flex items-center gap-1.5 text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-full transition"
            title="View or Recharge Wallet"
          >
            <Wallet className="h-3.5 w-3.5 text-amber-400" />
            <span>₹{walletBalance.toLocaleString("en-IN")}</span>
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pt-6 space-y-10">
        {/* 2. ULTRA-LUXURY HERO BANNER */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#131926] via-[#0E131F] to-[#0A0D14] border border-amber-500/30 p-6 sm:p-10 shadow-2xl shadow-amber-500/5">
          {/* Subtle Ambient Radial Lighting */}
          <div className="absolute top-0 right-0 -mt-16 -mr-16 h-72 w-72 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -mb-16 -ml-16 h-72 w-72 rounded-full bg-yellow-500/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="space-y-4 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border border-amber-500/40 text-amber-300 text-xs font-black tracking-widest uppercase shadow-sm">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                <span>Executive Dining Privilege</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-[1.15]">
                Skip The Kitchen Wait. <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-500">
                  Cooked & Served First.
                </span>
              </h1>

              <p className="text-xs sm:text-sm text-gray-300 font-medium leading-relaxed">
                Join our private VIP dining tier. The moment you place an order, our partner kitchens prioritize your meal over regular tickets, delivering boiling-hot freshness in record time.
              </p>

              {/* Privilege Highlights Ribbon */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
                <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-center hover:border-amber-400/40 transition">
                  <Flame className="h-5 w-5 text-amber-400 mx-auto mb-1.5" />
                  <div className="text-xs font-black text-white">Top Priority #1</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Cooked First</div>
                </div>

                <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-center hover:border-emerald-400/40 transition">
                  <Truck className="h-5 w-5 text-emerald-400 mx-auto mb-1.5" />
                  <div className="text-xs font-black text-white">Free Delivery</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Eligible Orders</div>
                </div>

                <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-center hover:border-purple-400/40 transition">
                  <Percent className="h-5 w-5 text-purple-400 mx-auto mb-1.5" />
                  <div className="text-xs font-black text-white">Up to 20% OFF</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">VIP Discounts</div>
                </div>

                <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-center hover:border-yellow-400/40 transition">
                  <Crown className="h-5 w-5 text-yellow-400 mx-auto mb-1.5" />
                  <div className="text-xs font-black text-white">VIP Badge</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Profile & Orders</div>
                </div>
              </div>
            </div>

            {/* Visual VIP Digital Card Mockup */}
            <div className="w-full md:w-80 flex-shrink-0">
              <div className="relative rounded-3xl bg-gradient-to-br from-amber-500/20 via-yellow-600/10 to-transparent p-1 shadow-2xl">
                <div className="rounded-[22px] bg-gradient-to-br from-gray-950 via-[#161C2C] to-black p-6 border border-amber-500/40 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

                  <div className="flex items-center justify-between mb-6">
                    <span className="text-[11px] font-black uppercase tracking-widest text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/30">
                      JHARKHAND RASOI
                    </span>
                    <Crown className="h-5 w-5 text-amber-400" />
                  </div>

                  <div className="space-y-1 mb-8">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Membership Pass
                    </div>
                    <div className="text-xl font-black text-white">
                      VIP ELITE CLUB
                    </div>
                    <div className="text-xs font-medium text-amber-300/80">
                      High Priority Kitchen Queue
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-white/10 text-xs">
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-gray-400 font-bold">
                        Kitchen Status
                      </div>
                      <div className="text-xs font-black text-emerald-400 flex items-center gap-1 mt-0.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        Serve First Enabled
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] uppercase tracking-wider text-gray-400 font-bold">
                        Access Rank
                      </div>
                      <div className="text-xs font-black text-amber-400 mt-0.5">
                        Priority #1
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. ACTIVE MEMBERSHIP BADGE (If User Already Subscribed) */}
        {mySub?.isSubscribed && (
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 p-6 text-black shadow-xl shadow-amber-500/20 border border-amber-300">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black uppercase tracking-widest bg-black text-amber-300 px-3 py-1 rounded-full">
                    {cleanText(mySub.badgeText) || "VIP PASS"} ACTIVE
                  </span>
                  <span className="text-xs font-extrabold text-amber-950 bg-black/10 px-2.5 py-0.5 rounded-full">
                    Priority Rank #{mySub.priorityLevel || 1}
                  </span>
                </div>
                <h2 className="text-2xl font-black text-gray-950 tracking-tight">
                  {cleanText(mySub.planName) || "VIP Pass Member"}
                </h2>
                <p className="text-xs text-amber-950 font-semibold max-w-xl">
                  Your orders are automatically tagged <strong>VIP PRIORITY - SERVE FIRST</strong> on restaurant POS and kitchen display systems.
                </p>
              </div>

              <div className="bg-black/90 rounded-2xl p-4 text-white sm:text-right border border-white/10 shadow-md">
                <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                  Validity Remaining
                </div>
                <div className="text-2xl font-black text-white mt-0.5">
                  {mySub.daysRemaining} Days
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">
                  Expires {new Date(mySub.expiresAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. PLANS SELECTION (THE CORE CONVERSION HERO) */}
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-widest">
              <Award className="h-4 w-4" />
              <span>Select Your Privilege Pass</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Choose The Plan That Suits You
            </h2>
            <p className="text-xs sm:text-sm text-gray-400 max-w-xl mx-auto font-medium">
              Immediate activation. High priority cooking queue on every order with Jharkhand Rasoi restaurants.
            </p>
          </div>

          {loading ? (
            <div className="py-20 text-center space-y-3">
              <RefreshCw className="h-8 w-8 animate-spin text-amber-400 mx-auto" />
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">
                Loading VIP passes...
              </p>
            </div>
          ) : plans.length === 0 ? (
            <div className="bg-white/5 rounded-3xl p-10 text-center border border-white/10 max-w-md mx-auto">
              <Crown className="h-12 w-12 text-gray-500 mx-auto mb-3" />
              <p className="text-base font-bold text-white">VIP Passes Updating</p>
              <p className="text-xs text-gray-400 mt-1">
                New seasonal VIP club passes are currently being refreshed. Please check back shortly.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
              {plans.map((plan) => {
                const isPopular = Boolean(plan.isPopular);
                const isCurrentPlan = mySub?.isSubscribed && mySub?.planName === plan.name;
                const cleanedBadge = cleanText(plan.badgeText) || "VIP";
                const cleanedName = cleanText(plan.name) || plan.name;
                const cleanedDesc = cleanText(plan.description) || plan.description;

                // Daily cost calculation
                const perDayCost = plan.durationDays > 0 ? (plan.price / plan.durationDays).toFixed(1) : 0;
                // Discount calculation
                const discountPercent =
                  plan.originalPrice > plan.price
                    ? Math.round(((plan.originalPrice - plan.price) / plan.originalPrice) * 100)
                    : null;

                return (
                  <div
                    key={plan._id}
                    className={`relative rounded-3xl transition-all duration-300 flex flex-col justify-between overflow-hidden group ${
                      isPopular
                        ? "bg-gradient-to-b from-[#1E2638] via-[#141A28] to-[#0D121D] border-2 border-amber-400 ring-4 ring-amber-500/20 shadow-2xl shadow-amber-500/10 md:-translate-y-2"
                        : "bg-gradient-to-b from-[#141924] to-[#0E131C] border border-white/10 hover:border-amber-400/40 shadow-xl"
                    }`}
                  >
                    {/* MOST POPULAR CHOICE TOP RIBBON */}
                    {isPopular && (
                      <div className="bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-gray-950 font-black text-[11px] uppercase tracking-wider py-1.5 px-4 text-center flex items-center justify-center gap-1.5 shadow-md">
                        <Sparkles className="h-3.5 w-3.5 fill-gray-950" />
                        <span>Most Popular Choice</span>
                        <Sparkles className="h-3.5 w-3.5 fill-gray-950" />
                      </div>
                    )}

                    <div className="p-6 sm:p-7 flex-1 space-y-5">
                      {/* Badge & Duration */}
                      <div className="flex items-center justify-between">
                        <span
                          className="text-[10px] font-black uppercase px-3 py-1 rounded-full text-white shadow-sm"
                          style={{ backgroundColor: plan.badgeColor || "#F59E0B" }}
                        >
                          {cleanedBadge}
                        </span>

                        <div className="flex items-center gap-1 text-xs font-bold text-gray-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
                          <Clock className="h-3 w-3 text-amber-400" />
                          <span>{plan.durationDays} Days</span>
                        </div>
                      </div>

                      {/* Plan Name & Tagline */}
                      <div>
                        <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                          {cleanedName}
                        </h3>
                        {cleanedDesc ? (
                          <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                            {cleanedDesc}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400 mt-1">
                            Full VIP kitchen priority access & express benefits.
                          </p>
                        )}
                      </div>

                      {/* Pricing Section */}
                      <div className="pt-2 border-t border-white/10 space-y-1">
                        <div className="flex items-baseline gap-2.5">
                          <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                            ₹{plan.price}
                          </span>
                          {plan.originalPrice > plan.price && (
                            <span className="text-sm font-bold text-gray-500 line-through">
                              ₹{plan.originalPrice}
                            </span>
                          )}
                          {discountPercent && (
                            <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                              Save {discountPercent}%
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] font-semibold text-amber-400/90 flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          <span>Just ₹{perDayCost}/day • Pays for itself in 2 orders</span>
                        </div>
                      </div>

                      {/* Kitchen Priority Banner */}
                      <div className="bg-amber-500/10 rounded-2xl p-3.5 border border-amber-500/20 flex items-start gap-3">
                        <div className="h-8 w-8 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0 text-amber-400 mt-0.5">
                          <Flame className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-xs font-black text-amber-300">
                            Kitchen Priority Rank #{plan.priorityLevel || 1}
                          </div>
                          <div className="text-[11px] text-gray-300 font-medium leading-snug mt-0.5">
                            Orders flagged VIP on chef screens & cooked before standard queue.
                          </div>
                        </div>
                      </div>

                      {/* Features List */}
                      <div className="space-y-2.5 pt-2">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                          Included Privileges:
                        </div>
                        {plan.features?.map((feat, fIdx) => {
                          const cleanedFeat = cleanText(feat);
                          if (!cleanedFeat) return null;
                          return (
                            <div
                              key={fIdx}
                              className="flex items-start gap-2.5 text-xs text-gray-200 font-medium"
                            >
                              <div className="h-4 w-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5">
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
                        className={`w-full py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-wider transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 shadow-lg ${
                          isPopular
                            ? "bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-gray-950 hover:brightness-105 shadow-amber-500/20"
                            : "bg-white text-gray-950 hover:bg-gray-100 shadow-white/5"
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

        {/* 5. VISUAL PROCESS: HOW KITCHEN PRIORITY WORKS */}
        <div className="rounded-3xl bg-gradient-to-b from-[#131824] to-[#0D111A] border border-white/10 p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-1">
            <span className="text-xs font-black uppercase tracking-widest text-amber-400">
              Behind The Scenes
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-white">
              How Your Kitchen Priority Actually Works
            </h3>
            <p className="text-xs text-gray-400 max-w-lg mx-auto">
              We engineered a direct link between customer checkout and restaurant kitchen displays.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-2 relative">
              <div className="text-[10px] font-black uppercase text-amber-400 bg-amber-500/10 w-fit px-2 py-0.5 rounded">
                Step 01
              </div>
              <div className="h-10 w-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Zap className="h-5 w-5" />
              </div>
              <h4 className="text-sm font-black text-white">Order Instant Tagging</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                When you tap order, our system attaches a cryptographically verified VIP Priority token to your ticket.
              </p>
            </div>

            <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-2 relative">
              <div className="text-[10px] font-black uppercase text-amber-400 bg-amber-500/10 w-fit px-2 py-0.5 rounded">
                Step 02
              </div>
              <div className="h-10 w-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Flame className="h-5 w-5" />
              </div>
              <h4 className="text-sm font-black text-white">Restaurant POS Alert</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                The restaurant tablet flashes a golden &quot;VIP PRIORITY - SERVE FIRST&quot; banner with an urgent audio bell.
              </p>
            </div>

            <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-2 relative">
              <div className="text-[10px] font-black uppercase text-amber-400 bg-amber-500/10 w-fit px-2 py-0.5 rounded">
                Step 03
              </div>
              <div className="h-10 w-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <UtensilsCrossed className="h-5 w-5" />
              </div>
              <h4 className="text-sm font-black text-white">Top of Cooking Queue</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Chefs place your order in the active pans immediately, jumping ahead of regular queued online tickets.
              </p>
            </div>

            <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-2 relative">
              <div className="text-[10px] font-black uppercase text-emerald-400 bg-emerald-500/10 w-fit px-2 py-0.5 rounded">
                Step 04
              </div>
              <div className="h-10 w-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Truck className="h-5 w-5" />
              </div>
              <h4 className="text-sm font-black text-white">Hot &amp; Fast Handover</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Rider collects boiling-fresh food without standing in waiting lines, racing straight to your door.
              </p>
            </div>
          </div>
        </div>

        {/* 6. INTERACTIVE SAVINGS CALCULATOR */}
        <div className="rounded-3xl bg-gradient-to-br from-[#121622] via-[#0E121B] to-[#0A0D14] border border-amber-500/30 p-6 sm:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-black uppercase tracking-widest text-amber-400">
                ROI Calculator
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-white mt-1">
                See How Much You Save Every Month
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Calculate your direct return on investment with a VIP Club pass.
              </p>
            </div>

            {/* Orders Frequency Selector */}
            <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-2xl border border-white/10 self-start md:self-auto">
              {[2, 4, 8, 12].map((num) => (
                <button
                  key={num}
                  onClick={() => setOrdersPerMonth(num)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition ${
                    ordersPerMonth === num
                      ? "bg-amber-400 text-gray-950 shadow-md"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {num} orders/mo
                </button>
              ))}
            </div>
          </div>

          {/* Calculator Output Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="bg-white/5 rounded-2xl p-5 border border-white/10 space-y-1">
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                Monthly Delivery Savings
              </div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-400">
                ₹{calculatedSavings.monthlyDeliverySaved}
              </div>
              <div className="text-[10px] text-gray-400">
                ₹50 avg delivery fee saved per order
              </div>
            </div>

            <div className="bg-white/5 rounded-2xl p-5 border border-white/10 space-y-1">
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                Monthly VIP Discounts
              </div>
              <div className="text-2xl sm:text-3xl font-black text-purple-400">
                ₹{calculatedSavings.monthlyDiscountSaved}
              </div>
              <div className="text-[10px] text-gray-400">
                10-20% extra member-exclusive discounts
              </div>
            </div>

            <div className="bg-gradient-to-br from-amber-500/20 via-yellow-500/10 to-transparent rounded-2xl p-5 border border-amber-500/40 space-y-1">
              <div className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                Total Yearly Savings
              </div>
              <div className="text-2xl sm:text-3xl font-black text-amber-400">
                ₹{calculatedSavings.totalYearlySaved.toLocaleString("en-IN")}
              </div>
              <div className="text-[10px] text-amber-200/80">
                Plus ~{calculatedSavings.minutesSaved} mins saved in kitchen waiting time!
              </div>
            </div>
          </div>
        </div>

        {/* 7. SIDE-BY-SIDE: REGULAR VS VIP COMPARISON TABLE */}
        <div className="rounded-3xl bg-[#0D111A] border border-white/10 overflow-hidden shadow-xl">
          <div className="p-6 sm:p-8 pb-4 text-center">
            <span className="text-xs font-black uppercase tracking-widest text-amber-400">
              The Clear Difference
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-white mt-1">
              Regular Order vs VIP Member
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-y border-white/10 bg-white/5">
                  <th className="py-4 px-6 font-bold text-gray-400 uppercase tracking-wider">
                    Privilege
                  </th>
                  <th className="py-4 px-6 font-bold text-gray-400 uppercase tracking-wider w-1/3">
                    Standard Customer
                  </th>
                  <th className="py-4 px-6 font-black text-amber-400 uppercase tracking-wider w-1/3 bg-amber-500/10">
                    VIP Club Member
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-medium">
                <tr>
                  <td className="py-4 px-6 text-white font-bold">Kitchen Queue Position</td>
                  <td className="py-4 px-6 text-gray-400">Standard queue (behind earlier orders)</td>
                  <td className="py-4 px-6 text-amber-300 font-bold bg-amber-500/5 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    Priority #1 Cooked First
                  </td>
                </tr>

                <tr>
                  <td className="py-4 px-6 text-white font-bold">Delivery Charges</td>
                  <td className="py-4 px-6 text-gray-400">Standard ₹40 - ₹80 per order</td>
                  <td className="py-4 px-6 text-emerald-400 font-bold bg-amber-500/5 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    Zero Free Delivery on eligible orders
                  </td>
                </tr>

                <tr>
                  <td className="py-4 px-6 text-white font-bold">Extra Member Discount</td>
                  <td className="py-4 px-6 text-gray-400">None (regular coupons only)</td>
                  <td className="py-4 px-6 text-amber-300 font-bold bg-amber-500/5 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    Extra 10% - 20% OFF on select menus
                  </td>
                </tr>

                <tr>
                  <td className="py-4 px-6 text-white font-bold">VIP Profile Badge</td>
                  <td className="py-4 px-6 text-gray-400">Standard badge</td>
                  <td className="py-4 px-6 text-amber-300 font-bold bg-amber-500/5 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    Gold Crown Badge on Profile &amp; Orders
                  </td>
                </tr>

                <tr>
                  <td className="py-4 px-6 text-white font-bold">Customer Support Desk</td>
                  <td className="py-4 px-6 text-gray-400">Standard queue support</td>
                  <td className="py-4 px-6 text-amber-300 font-bold bg-amber-500/5 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    24/7 Dedicated VIP Priority Helpline
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 8. MEMBER TESTIMONIALS (SOCIAL PROOF - ZERO EMOJIS) */}
        <div className="space-y-6">
          <div className="text-center space-y-1">
            <span className="text-xs font-black uppercase tracking-widest text-amber-400">
              Trusted By Foodies
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-white">
              What Our VIP Members Say
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#121622] rounded-3xl p-6 border border-white/10 space-y-3">
              <div className="flex items-center gap-1 text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-amber-400" />
                ))}
              </div>
              <p className="text-xs text-gray-300 leading-relaxed font-medium">
                &quot;The Kitchen Priority is genuinely noticeable. My Friday night dinner order used to take 50 minutes, now it arrives hot in 22 minutes because the chef cooked it right away.&quot;
              </p>
              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-white">Ananya Sen</div>
                  <div className="text-[10px] text-gray-400">Ranchi • VIP Gold Member</div>
                </div>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Verified
                </span>
              </div>
            </div>

            <div className="bg-[#121622] rounded-3xl p-6 border border-white/10 space-y-3">
              <div className="flex items-center gap-1 text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-amber-400" />
                ))}
              </div>
              <p className="text-xs text-gray-300 leading-relaxed font-medium">
                &quot;Free delivery on every single weekend order paid for my entire 3-month subscription in just the first week. Plus the VIP badge looks great on the profile.&quot;
              </p>
              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-white">Vikram Malhotra</div>
                  <div className="text-[10px] text-gray-400">Jamshedpur • Annual VIP Member</div>
                </div>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Verified
                </span>
              </div>
            </div>

            <div className="bg-[#121622] rounded-3xl p-6 border border-white/10 space-y-3">
              <div className="flex items-center gap-1 text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-amber-400" />
                ))}
              </div>
              <p className="text-xs text-gray-300 leading-relaxed font-medium">
                &quot;Ordering for office lunches everyday was getting expensive with delivery fees. VIP Club completely resolved that and our food arrives faster than anyone else&apos;s.&quot;
              </p>
              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-white">Rohit Verma</div>
                  <div className="text-[10px] text-gray-400">Dhanbad • VIP Member</div>
                </div>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Verified
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 9. FREQUENTLY ASKED QUESTIONS (ACCORDION) */}
        <div className="rounded-3xl bg-[#0D111A] border border-white/10 p-6 sm:p-8 space-y-4">
          <div className="text-center space-y-1 pb-2">
            <span className="text-xs font-black uppercase tracking-widest text-amber-400">
              Clear Answers
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-white">
              Frequently Asked Questions
            </h3>
          </div>

          <div className="space-y-3 max-w-3xl mx-auto">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl bg-white/5 border border-white/5 overflow-hidden transition"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-4 text-left flex items-center justify-between gap-3 text-xs sm:text-sm font-bold text-white hover:text-amber-300 transition"
                  >
                    <span>{faq.q}</span>
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 text-amber-400 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 text-xs text-gray-300 leading-relaxed font-medium border-t border-white/5 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 10. GUARANTEE FOOTNOTE */}
        <div className="rounded-3xl bg-white/5 border border-white/10 p-6 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <div className="h-12 w-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="space-y-0.5">
            <h4 className="text-sm font-black text-white">
              100% Kitchen Priority &amp; Satisfaction Promise
            </h4>
            <p className="text-xs text-gray-400 font-medium">
              Every single order placed under your VIP membership triggers a top-priority dispatch sequence at restaurant partner terminals.
            </p>
          </div>
        </div>
      </div>

      {/* 11. MOBILE FLOATING ACTION BAR (STICKY BOTTOM QUICK CONVERT) */}
      {popularPlan && !loading && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0D111A]/95 backdrop-blur-xl border-t border-amber-500/30 p-3 shadow-2xl">
          <div className="flex items-center justify-between gap-3 max-w-md mx-auto">
            <div>
              <div className="text-[10px] font-black uppercase text-amber-400 tracking-wider flex items-center gap-1">
                <Crown className="h-3 w-3" />
                <span>{cleanText(popularPlan.name)}</span>
              </div>
              <div className="text-sm font-black text-white flex items-baseline gap-1.5">
                <span>₹{popularPlan.price}</span>
                <span className="text-[10px] font-normal text-gray-400">
                  / {popularPlan.durationDays} Days
                </span>
              </div>
            </div>

            <button
              onClick={() => handleOpenSubscribe(popularPlan)}
              className="bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-gray-950 font-black text-xs uppercase tracking-wider px-5 py-3 rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition"
            >
              Get VIP Pass
            </button>
          </div>
        </div>
      )}

      {/* 12. CONFIRMATION / PURCHASE MODAL */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md bg-[#101420] text-white border border-amber-500/30 rounded-3xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-400" />
              <span>Activate VIP Pass</span>
            </DialogTitle>
          </DialogHeader>

          {selectedPlan && (
            <div className="space-y-4 pt-2">
              {/* Selected Plan Summary Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-transparent border border-amber-500/30 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase bg-amber-400 text-gray-950 px-2.5 py-0.5 rounded-full">
                    {cleanText(selectedPlan.badgeText) || "VIP"}
                  </span>
                  <span className="text-xs font-bold text-amber-300">
                    {selectedPlan.durationDays} Days Validity
                  </span>
                </div>
                <div className="text-xl font-black text-white pt-1">
                  {cleanText(selectedPlan.name)}
                </div>
                <div className="flex items-baseline gap-2 pt-1">
                  <span className="text-2xl font-black text-amber-400">
                    ₹{selectedPlan.price}
                  </span>
                  {selectedPlan.originalPrice > selectedPlan.price && (
                    <span className="text-xs font-bold text-gray-500 line-through">
                      ₹{selectedPlan.originalPrice}
                    </span>
                  )}
                </div>
              </div>

              {/* Kitchen Priority Guarantee Callout */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 flex items-start gap-2.5">
                <Flame className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-200">
                  <span className="font-bold text-white block">
                    Priority Preparation Rank #{selectedPlan.priorityLevel || 1}
                  </span>
                  Your orders will be tagged <strong>VIP PRIORITY - SERVE FIRST</strong> on restaurant POS screens.
                </div>
              </div>

              {/* Wallet Balance Verification */}
              <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 font-bold flex items-center gap-1.5">
                    <Wallet className="h-4 w-4 text-amber-400" />
                    Available Wallet Balance:
                  </span>
                  <span className="font-black text-white">
                    ₹{walletBalance.toLocaleString("en-IN")}
                  </span>
                </div>

                {walletBalance >= (selectedPlan.price || 0) ? (
                  <div className="text-[11px] font-bold text-emerald-400 flex items-center gap-1 pt-1 border-t border-white/5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Balance sufficient. Instant activation.</span>
                  </div>
                ) : (
                  <div className="space-y-2 pt-1 border-t border-white/5">
                    <div className="text-[11px] font-bold text-rose-400 flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" />
                      <span>
                        Need ₹{(selectedPlan.price || 0) - walletBalance} more to activate.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate("/user/wallet")}
                      className="w-full py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs border border-amber-500/30 flex items-center justify-center gap-1.5 transition"
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
                  className="px-4 py-2.5 rounded-xl border border-white/10 text-xs font-bold text-gray-300 hover:bg-white/5 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSubscribe}
                  disabled={isSubscribing || walletBalance < (selectedPlan.price || 0)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-gray-950 text-xs font-black shadow-lg shadow-amber-500/20 hover:brightness-105 transition disabled:opacity-50 flex items-center gap-1.5"
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
