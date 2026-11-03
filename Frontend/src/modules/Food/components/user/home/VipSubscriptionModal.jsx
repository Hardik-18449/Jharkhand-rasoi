import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Crown } from "lucide-react";
import { isModuleAuthenticated } from "@food/utils/auth";
import { userAPI } from "@/services/api";
import chefMascot from "@food/assets/chef-mascot.png";

export default function VipSubscriptionModal() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [planPrice, setPlanPrice] = useState(99);
  const [planDuration, setPlanDuration] = useState("1 month");

  useEffect(() => {
    let isMounted = true;

    const checkAndTriggerModal = async () => {
      try {
        const isUser = isModuleAuthenticated("user");

        if (isUser) {
          // 1. If logged in, check if user is already an active subscriber
          try {
            const subRes = await userAPI.getMySubscription();
            const subData = subRes?.data?.data || subRes?.data;
            const isActive =
              subData &&
              (subData.status === "active" ||
                (subData.endDate && new Date(subData.endDate) > new Date()));

            if (isActive) {
              // Active subscriber -> NEVER show ad
              return;
            }
          } catch {
            // Ignore API check errors and proceed to frequency check
          }

          // 2. Logged in non-subscriber: Show only 1 time in a day
          const todayStr = new Date().toISOString().slice(0, 10);
          const lastShown = localStorage.getItem("jr_vip_modal_last_shown_date");
          if (lastShown === todayStr) {
            return;
          }

          // Not shown today -> record today's date and show after delay
          localStorage.setItem("jr_vip_modal_last_shown_date", todayStr);
        } else {
          // 3. Guest (not logged in): Show every time user opens the app, but NOT on reload
          const sessionShown = sessionStorage.getItem("jr_vip_modal_session_shown");
          if (sessionShown === "true") {
            // Page reloaded in current session -> do not show again
            return;
          }

          // Fresh session -> record in sessionStorage and show
          sessionStorage.setItem("jr_vip_modal_session_shown", "true");
        }

        // Fetch lowest/popular subscription plan price for dynamic display
        try {
          const plansRes = await userAPI.getPublicSubscriptionPlans();
          const plans = Array.isArray(plansRes?.data?.data)
            ? plansRes.data.data
            : Array.isArray(plansRes?.data)
            ? plansRes.data
            : [];
          if (plans.length > 0) {
            const activePlans = plans.filter((p) => p.isActive !== false && p.price > 0);
            const popular = activePlans.find((p) => p.isPopular) || activePlans[0];
            if (popular && isMounted) {
              setPlanPrice(popular.price);
              if (popular.durationDays) {
                setPlanDuration(
                  popular.durationDays >= 365
                    ? "1 year"
                    : `${Math.round(popular.durationDays / 30)} month`
                );
              }
            }
          }
        } catch {
          // Use default ₹99
        }

        // Gentle delay after page mount so screen is fully interactive
        setTimeout(() => {
          if (isMounted) {
            setIsOpen(true);
          }
        }, 1100);
      } catch (err) {
        console.warn("VIP modal check error:", err);
      }
    };

    checkAndTriggerModal();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleGoToSubscription = () => {
    setIsOpen(false);
    navigate("/user/subscription");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/85 backdrop-blur-sm"
          />

          {/* Modal Container with swipe gesture */}
          <div className="relative w-full max-w-[380px] sm:max-w-[400px] z-10 my-auto flex flex-col items-center">
            <motion.div
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.5}
              onDragEnd={(_, info) => {
                if (info.offset.y > 90 || info.velocity.y > 350) {
                  handleClose();
                }
              }}
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
              className="relative w-full overflow-hidden rounded-[32px] bg-gradient-to-b from-[#F25A05] via-[#E84E00] to-[#C93800] p-6 sm:p-7 text-white shadow-2xl border border-white/20 select-none"
            >
              {/* Top Swipe Bar indicator (mobile) */}
              <div className="flex justify-center -mt-2 mb-3 sm:hidden">
                <div className="w-10 h-1 rounded-full bg-white/40" />
              </div>

              {/* Close Button Top Right */}
              <button
                type="button"
                onClick={handleClose}
                className="absolute top-4 right-4 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/20 text-white/90 hover:bg-black/40 hover:text-white transition-all active:scale-90"
                aria-label="Close"
              >
                <X className="h-4 w-4" strokeWidth={2.5} />
              </button>

              {/* Top Graphic Illustration (Festive Fireworks & Candle / Crown SVG) */}
              <div className="relative w-full flex items-center justify-between px-2 pt-1 pb-4">
                {/* Festive Rocket / Cracker */}
                <div className="relative">
                  <div className="w-16 h-12 relative flex items-center justify-center">
                    {/* Stylized Rocket Firework */}
                    <div className="relative rotate-[-30deg]">
                      <div className="w-10 h-6 bg-gradient-to-r from-orange-400 via-amber-300 to-purple-600 rounded-l-full rounded-r-md border border-white/30 shadow-md flex items-center justify-center">
                        <div className="w-2 h-full bg-white/40 skew-x-12" />
                      </div>
                      {/* Rocket nose cone */}
                      <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-0 h-0 border-y-[12px] border-y-transparent border-r-[14px] border-r-red-500" />
                      {/* Sparks */}
                      <span className="absolute -right-2 top-1 text-[10px] text-yellow-200 animate-pulse">
                        ✦
                      </span>
                    </div>
                  </div>
                </div>

                {/* Chef Mascot Brand Logo */}
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-black/30 border border-white/25 shadow-inner p-2">
                  <img
                    src={chefMascot}
                    alt="Jharkhand Rasoi"
                    className="w-full h-full object-contain filter drop-shadow"
                  />
                </div>

                {/* Glowing Candle & Sparks */}
                <div className="relative flex items-end justify-center w-16 h-12">
                  <div className="relative flex flex-col items-center">
                    {/* Flame */}
                    <div className="w-2.5 h-3.5 bg-gradient-to-t from-yellow-500 via-yellow-200 to-white rounded-full animate-bounce shadow-[0_0_12px_#ffb703]" />
                    {/* Candle body */}
                    <div className="w-8 h-8 rounded-md bg-gradient-to-b from-purple-500 to-purple-700 border border-white/20 shadow-md flex items-center justify-center">
                      <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                    </div>
                  </div>
                  {/* Floating sparkles */}
                  <span className="absolute -top-1 -right-1 text-xs text-yellow-200 animate-spin">
                    ✨
                  </span>
                </div>
              </div>

              {/* Main Headline */}
              <h2 className="text-2xl sm:text-[27px] font-black text-center text-white leading-[1.18] tracking-tight drop-shadow-sm mt-1">
                Come back to VIP Club for ₹{planPrice} for {planDuration}.
              </h2>

              {/* Subtitle / Mini Details */}
              <p className="mt-3.5 text-xs sm:text-[13px] text-center text-white/95 font-medium leading-relaxed max-w-[320px] mx-auto">
                Don&apos;t let delivery charges hold you back. Enjoy ₹0 Delivery Fee, exclusive restaurant discounts, and priority orders.
              </p>

              {/* Primary CTA Button */}
              <div className="mt-6 w-full">
                <button
                  type="button"
                  onClick={handleGoToSubscription}
                  className="w-full py-3.5 px-6 rounded-full bg-[#FFDE31] hover:bg-[#FDD835] text-black font-black text-sm sm:text-base uppercase tracking-wider shadow-lg shadow-black/25 transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Crown className="w-4 h-4 fill-black text-black" />
                  <span>REJOIN VIP AT ₹{planPrice}</span>
                </button>
              </div>

              {/* Terms / Disclaimer */}
              <p className="mt-4 text-[10px] sm:text-[11px] text-center text-white/80 leading-normal max-w-[310px] mx-auto">
                Welcome back offer for VIP plan. Redeemable on all approved restaurants across your city.{" "}
                <span
                  onClick={handleGoToSubscription}
                  className="underline cursor-pointer hover:text-white"
                >
                  Terms apply.
                </span>
              </p>
            </motion.div>

            {/* Bottom "dismiss" button like Spotify screenshot */}
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClose}
              className="mt-3 py-2 px-6 text-sm font-bold text-white/80 hover:text-white tracking-wider cursor-pointer transition-colors uppercase active:scale-95"
            >
              dismiss
            </motion.button>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
