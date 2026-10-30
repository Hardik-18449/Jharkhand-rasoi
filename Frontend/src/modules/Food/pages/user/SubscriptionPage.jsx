import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import { userAPI } from "@food/api";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@food/components/ui/dialog";

// Helper to guarantee no emojis are rendered on this page
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

  // Subscribe Modal
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [plansRes, mySubRes] = await Promise.allSettled([
        userAPI.getPublicSubscriptionPlans(),
        userAPI.getMySubscription(),
      ]);

      if (plansRes.status === "fulfilled") {
        const pList = plansRes.value?.data?.data || plansRes.value?.data || [];
        setPlans(Array.isArray(pList) ? pList : []);
      }

      if (mySubRes.status === "fulfilled") {
        setMySub(mySubRes.value?.data?.data || null);
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

    try {
      setIsSubscribing(true);
      const res = await userAPI.subscribePlan({
        planId: selectedPlan._id,
        paymentMethod: "wallet",
      });

      toast.success(res?.data?.message || `Welcome to ${cleanText(selectedPlan.name)}!`);
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

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      {/* Top App Bar */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30 px-4 py-3 shadow-xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-700 hover:text-gray-900"
          >
            <ChevronLeft className="h-5 w-5" />
            Back
          </button>
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" />
            <span className="text-sm font-black text-gray-900 tracking-tight">
              VIP Priority Club
            </span>
          </div>
          <div className="w-12" />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-6 space-y-6">
        {/* HERO BANNER */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 via-slate-900 to-amber-950 p-6 sm:p-8 text-white shadow-xl">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
          <div className="relative z-10 space-y-3 max-w-xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-black uppercase tracking-wider">
              <Sparkles className="h-3.5 w-3.5" />
              VIP Member Exclusives
            </span>

            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white leading-tight">
              Serve First. Eat Fast. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500">
                Cooked with Top Priority.
              </span>
            </h1>

            <p className="text-xs sm:text-sm text-gray-300 font-medium leading-relaxed">
              Whenever you place an order as a VIP member, restaurants prepare, pack, and serve your food
              before all regular orders.
            </p>

            {/* Quick Badges Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 border border-white/10 text-center">
                <Flame className="h-5 w-5 text-amber-400 mx-auto mb-1" />
                <div className="text-[11px] font-black">Serve 1st</div>
                <div className="text-[9px] text-gray-300">Kitchen Priority</div>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 border border-white/10 text-center">
                <Truck className="h-5 w-5 text-emerald-400 mx-auto mb-1" />
                <div className="text-[11px] font-black">Free Delivery</div>
                <div className="text-[9px] text-gray-300">On eligible orders</div>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 border border-white/10 text-center">
                <Percent className="h-5 w-5 text-purple-400 mx-auto mb-1" />
                <div className="text-[11px] font-black">Extra 10-20%</div>
                <div className="text-[9px] text-gray-300">VIP Discounts</div>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 border border-white/10 text-center">
                <Crown className="h-5 w-5 text-yellow-400 mx-auto mb-1" />
                <div className="text-[11px] font-black">VIP Badge</div>
                <div className="text-[9px] text-gray-300">Priority Status</div>
              </div>
            </div>
          </div>
        </div>

        {/* ACTIVE VIP PASS CARD (If User has an active subscription) */}
        {mySub?.isSubscribed && (
          <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 rounded-3xl p-5 text-black shadow-lg border border-amber-300 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-black uppercase tracking-wider bg-black/20 text-white px-2.5 py-0.5 rounded-full">
                    {cleanText(mySub.badgeText) || "VIP Active"}
                  </span>
                  <span className="text-xs font-bold text-amber-950">
                    Priority Rank #{mySub.priorityLevel || 1}
                  </span>
                </div>
                <h2 className="text-xl font-black text-gray-950">
                  {cleanText(mySub.planName) || "VIP Pass Member"}
                </h2>
                <p className="text-xs text-amber-950 font-medium mt-0.5">
                  Your orders are automatically marked as <strong>High Priority</strong> in all restaurant kitchens.
                </p>
              </div>

              <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-3 sm:text-right border border-white/50">
                <div className="text-[10px] font-bold text-gray-500 uppercase">Membership Validity</div>
                <div className="text-sm font-black text-gray-900">
                  {mySub.daysRemaining} Days Left
                </div>
                <div className="text-[10px] text-gray-500">
                  Expires {new Date(mySub.expiresAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PLAN SELECTION HEADER */}
        <div className="text-center pt-2">
          <h2 className="text-xl font-black text-gray-900 tracking-tight">
            Choose Your VIP Pass
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Instant activation with priority queue status in all restaurant POS and kitchens.
          </p>
        </div>

        {/* PLANS GRID */}
        {loading ? (
          <div className="py-16 text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
            <p className="text-xs text-gray-500 font-medium">Fetching VIP membership passes...</p>
          </div>
        ) : plans.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-gray-100 shadow-sm">
            <Crown className="h-10 w-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-gray-700">VIP Plans Updating</p>
            <p className="text-xs text-gray-400 mt-1">Please check back in a few minutes.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {plans.map((plan) => {
              const isPopular = Boolean(plan.isPopular);
              const isCurrentPlan = mySub?.isSubscribed && mySub?.planName === plan.name;
              const cleanedBadge = cleanText(plan.badgeText) || "VIP";
              const cleanedName = cleanText(plan.name) || plan.name;
              const cleanedDesc = cleanText(plan.description) || plan.description;

              return (
                <div
                  key={plan._id}
                  className={`bg-white rounded-3xl border transition-all duration-200 shadow-sm flex flex-col justify-between relative overflow-hidden ${
                    isPopular
                      ? "border-amber-400 ring-2 ring-amber-200 shadow-md"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {isPopular && (
                    <div className="bg-gradient-to-r from-amber-500 to-yellow-500 text-black text-[10px] font-black uppercase text-center py-1 tracking-wider">
                      Most Popular Choice
                    </div>
                  )}

                  <div className="p-5 flex-1 space-y-4">
                    {/* Header */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: plan.badgeColor || "#F59E0B" }}
                        >
                          {cleanedBadge}
                        </span>
                        <span className="text-[11px] font-bold text-gray-400">
                          {plan.durationDays} Days
                        </span>
                      </div>

                      <h3 className="text-lg font-black text-gray-900">{cleanedName}</h3>
                      {cleanedDesc && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                          {cleanedDesc}
                        </p>
                      )}
                    </div>

                    {/* Price */}
                    <div className="flex items-baseline gap-2 pt-2 border-t border-gray-100">
                      <span className="text-3xl font-black text-gray-900">
                        ₹{plan.price}
                      </span>
                      {plan.originalPrice > plan.price && (
                        <span className="text-sm font-bold text-gray-400 line-through">
                          ₹{plan.originalPrice}
                        </span>
                      )}
                      <span className="text-xs text-gray-400 font-medium">
                        / {plan.durationDays >= 365 ? "year" : plan.durationDays >= 90 ? "3 months" : "month"}
                      </span>
                    </div>

                    {/* Kitchen Priority Banner */}
                    <div className="bg-amber-50 rounded-2xl p-3 border border-amber-100 flex items-center gap-2.5">
                      <Flame className="h-5 w-5 text-amber-600 flex-shrink-0" />
                      <div>
                        <div className="text-[11px] font-black text-amber-900">
                          Priority Preparation Rank #{plan.priorityLevel || 1}
                        </div>
                        <div className="text-[10px] text-amber-700 font-medium">
                          Served first before all standard orders
                        </div>
                      </div>
                    </div>

                    {/* Features List */}
                    <div className="space-y-2 pt-2">
                      {plan.features?.map((feat, fIdx) => {
                        const cleanedFeat = cleanText(feat);
                        if (!cleanedFeat) return null;
                        return (
                          <div key={fIdx} className="flex items-start gap-2 text-xs text-gray-700 font-medium">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                            <span>{cleanedFeat}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* CTA Button */}
                  <div className="p-5 pt-0">
                    <button
                      onClick={() => handleOpenSubscribe(plan)}
                      className={`w-full py-3 px-4 rounded-2xl font-bold text-xs shadow-md transition active:scale-95 flex items-center justify-center gap-2 ${
                        isPopular
                          ? "bg-gradient-to-r from-amber-500 to-yellow-500 text-black hover:opacity-95"
                          : "bg-gray-900 text-white hover:bg-black"
                      }`}
                    >
                      {isCurrentPlan ? "Extend Subscription" : "Join VIP Priority Club"}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* GUARANTEE BOX */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="space-y-0.5">
            <h4 className="text-sm font-black text-gray-900">
              Kitchen Priority Guarantee
            </h4>
            <p className="text-xs text-gray-500 font-medium">
              Every order you place displays a high-priority VIP tag on restaurant screens and POS so kitchen staff start
              preparing your food right away.
            </p>
          </div>
        </div>
      </div>

      {/* CONFIRMATION / PURCHASE MODAL */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-gray-900 flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              Confirm VIP Pass
            </DialogTitle>
          </DialogHeader>

          {selectedPlan && (
            <div className="space-y-4 pt-2">
              {/* Plan Card Summary */}
              <div
                className="p-4 rounded-2xl text-white shadow-sm"
                style={{ backgroundColor: selectedPlan.badgeColor || "#F59E0B" }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase bg-black/20 px-2 py-0.5 rounded-full">
                    {cleanText(selectedPlan.badgeText) || "VIP"}
                  </span>
                  <span className="text-xs font-bold">{selectedPlan.durationDays} Days</span>
                </div>
                <div className="text-xl font-black mt-1">{cleanText(selectedPlan.name)}</div>
                <div className="text-2xl font-black mt-2">₹{selectedPlan.price}</div>
              </div>

              {/* Kitchen Priority Alert */}
              <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3 flex items-start gap-2.5">
                <Flame className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900">
                  <span className="font-black block">High Kitchen Priority Included</span>
                  Your orders will automatically be tagged <strong>VIP PRIORITY - SERVE FIRST</strong> on
                  kitchen preparation queues.
                </div>
              </div>

              {/* Payment Method Notice */}
              <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-200 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-gray-700 flex items-center gap-1.5">
                    <Wallet className="h-4 w-4 text-primary" />
                    Payment from Wallet Balance
                  </span>
                  <span className="font-black text-gray-900">₹{selectedPlan.price}</span>
                </div>
                <p className="text-[11px] text-gray-500 font-medium">
                  Instant activation. Amount will be deducted from your wallet.
                </p>
              </div>

              {/* Modal Buttons */}
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
                  disabled={isSubscribing}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-black text-xs font-black shadow-md hover:opacity-95 transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubscribing ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Activating...
                    </>
                  ) : (
                    <>
                      <Zap className="h-3.5 w-3.5 fill-black" />
                      Pay ₹{selectedPlan.price} & Activate VIP
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
