import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { X, Sparkles, Crown } from "lucide-react";
import { isModuleAuthenticated } from "@food/utils/auth";
import { userAPI } from "@/services/api";
import chefMascot from "@food/assets/chef-mascot.png";

export default function VipSubscriptionModal() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [planPrice, setPlanPrice] = useState(99);
  const [planDuration, setPlanDuration] = useState("1 month");

  // Free 360° swipe: card follows the finger on both axes
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  // Direction the card flies off in when dismissed (default: slides down a little and fades)
  const [exitDir, setExitDir] = useState({ x: 0, y: 60 });
  // Backdrop fades as the card is dragged further from the center
  const backdropOpacity = useTransform([x, y], ([lx, ly]) =>
    Math.max(0.2, 1 - Math.hypot(lx, ly) / 350)
  );

  const cardVariants = {
    hidden: { opacity: 0, scale: 0.9, y: 30 },
    show: {
      opacity: 1,
      scale: 1,
      x: 0,
      y: 0,
      rotate: 0,
      transition: { type: "spring", damping: 26, stiffness: 320 },
    },
    exit: (d) => ({
      opacity: 0,
      x: d?.x ?? 0,
      y: d?.y ?? 60,
      rotate: (d?.x ?? 0) * 0.015,
      transition: { duration: 0.35, ease: "easeIn" },
    }),
  };

  useEffect(() => {
    let isMounted = true;

    const checkAndTriggerModal = async () => {
      try {
        const isUser = isModuleAuthenticated("user");

        if (isUser) {
          try {
            const subRes = await userAPI.getMySubscription();
            const subData = subRes?.data?.data || subRes?.data;
            const isActive =
              subData &&
              (subData.status === "active" ||
                (subData.endDate && new Date(subData.endDate) > new Date()));

            if (isActive) {
              return;
            }
          } catch {
            // Subscription check non-fatal
          }

          const todayStr = new Date().toISOString().slice(0, 10);
          const lastShown = localStorage.getItem("jr_vip_modal_last_shown_date");
          if (lastShown === todayStr) {
            return;
          }

          localStorage.setItem("jr_vip_modal_last_shown_date", todayStr);
        } else {
          const sessionShown = sessionStorage.getItem("jr_vip_modal_session_shown");
          if (sessionShown === "true") {
            return;
          }

          sessionStorage.setItem("jr_vip_modal_session_shown", "true");
        }

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
          // Default fallback values
        }

        setTimeout(() => {
          if (isMounted) {
            x.set(0);
            y.set(0);
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
  }, [x, y]);

  const handleClose = () => {
    setExitDir({ x: 0, y: 60 });
    setIsOpen(false);
  };

  const handleSwipeEnd = (_, info) => {
    const dist = Math.hypot(info.offset.x, info.offset.y);
    const speed = Math.hypot(info.velocity.x, info.velocity.y);
    if (dist > 110 || speed > 500) {
      // Fly off in the direction of the throw (fast flick) or the drag
      const useVelocity = speed > 500;
      const vx = useVelocity ? info.velocity.x : info.offset.x;
      const vy = useVelocity ? info.velocity.y : info.offset.y;
      const len = Math.hypot(vx, vy) || 1;
      setExitDir({ x: (vx / len) * 900, y: (vy / len) * 900 });
      setIsOpen(false);
    }
  };

  const handleGoToSubscription = () => {
    setIsOpen(false);
    navigate("/user/subscription");
  };

  return (
    <AnimatePresence custom={exitDir}>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={handleClose}
            className="fixed inset-0"
          >
            <motion.div
              style={{ opacity: backdropOpacity }}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            />
          </motion.div>

          <div className="relative w-full max-w-[380px] sm:max-w-[400px] z-10 my-auto flex flex-col items-center">
            <motion.div
              drag
              dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
              dragElastic={0.7}
              dragSnapToOrigin
              onDragEnd={handleSwipeEnd}
              style={{ x, y }}
              variants={cardVariants}
              custom={exitDir}
              initial="hidden"
              animate="show"
              exit="exit"
              whileDrag={{ cursor: "grabbing" }}
              className="relative w-full overflow-hidden rounded-[32px] bg-gradient-to-b from-[#F25A05] via-[#E84E00] to-[#C93800] p-6 sm:p-7 text-white shadow-2xl border border-white/20 select-none touch-none"
            >
              <div className="flex justify-center -mt-2 mb-3 sm:hidden">
                <div className="w-10 h-1 rounded-full bg-white/40" />
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="absolute top-4 right-4 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/20 text-white/90 hover:bg-black/40 hover:text-white transition-all active:scale-90"
                aria-label="Close"
              >
                <X className="h-4 w-4" strokeWidth={2.5} />
              </button>

              <div className="relative w-full flex items-center justify-between px-2 pt-1 pb-4">
                <div className="relative">
                  <div className="w-16 h-12 relative flex items-center justify-center">
                    <div className="relative rotate-[-30deg]">
                      <div className="w-10 h-6 bg-gradient-to-r from-orange-400 via-amber-300 to-purple-600 rounded-l-full rounded-r-md border border-white/30 shadow-md flex items-center justify-center">
                        <div className="w-2 h-full bg-white/40 skew-x-12" />
                      </div>
                      <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-0 h-0 border-y-[12px] border-y-transparent border-r-[14px] border-r-red-500" />
                      <span className="absolute -right-2 top-1 text-[10px] text-yellow-200 animate-pulse">
                        ✦
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-black/30 border border-white/25 shadow-inner p-2">
                  <img
                    src={chefMascot}
                    alt="Jharkhand Rasoi"
                    className="w-full h-full object-contain filter drop-shadow"
                  />
                </div>

                <div className="relative flex items-end justify-center w-16 h-12">
                  <div className="relative flex flex-col items-center">
                    <div className="w-2.5 h-3.5 bg-gradient-to-t from-yellow-500 via-yellow-200 to-white rounded-full animate-bounce shadow-[0_0_12px_#ffb703]" />
                    <div className="w-8 h-8 rounded-md bg-gradient-to-b from-purple-500 to-purple-700 border border-white/20 shadow-md flex items-center justify-center">
                      <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                    </div>
                  </div>
                  <span className="absolute -top-1 -right-1 text-xs text-yellow-200 animate-spin">
                    ✨
                  </span>
                </div>
              </div>

              <h2 className="text-2xl sm:text-[27px] font-black text-center text-white leading-[1.18] tracking-tight drop-shadow-sm mt-1">
                Come back to VIP Club for ₹{planPrice} for {planDuration}.
              </h2>

              <p className="mt-3.5 text-xs sm:text-[13px] text-center text-white/95 font-medium leading-relaxed max-w-[320px] mx-auto">
                Don&apos;t let delivery charges hold you back. Enjoy ₹0 Delivery Fee, exclusive restaurant discounts, and priority orders.
              </p>

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
