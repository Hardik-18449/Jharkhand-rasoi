import React, { useEffect, useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Link, useNavigate } from "react-router-dom"
import {
  Smartphone,
  ArrowRight,
  Loader2,
  Headphones,
  RotateCcw,
  Edit2,
  CheckCircle2,
  Sparkles
} from "lucide-react"
import { toast } from "sonner"
import { authAPI, userAPI } from "@food/api"
import { setAuthData } from "@food/utils/auth"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@food/components/ui/dialog"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import { Label } from "@food/components/ui/label"
import { useCompanyName } from "@food/hooks/useCompanyName"

// Food dishes for the animated conveyor gliding from LEFT to RIGHT
const TOP_WAVE_DISHES = [
  { name: "Deluxe Biryani", img: "/food/chicken_biryani_deluxe.png", tag: "Bestseller" },
  { name: "Fried Rice & Noodles", img: "/food/chicken_fried_rice.png", tag: "Special" },
  { name: "Crispy Snack", img: "/food/chicken_65_crispy.png", tag: "Crispy" },
  { name: "Paneer Tikka", img: "/food/paneer_tikka_masala.png", tag: "Popular" },
  { name: "Mushroom Manchurian", img: "/food/mushroom_manchurian.png", tag: "Hot & Spicy" },
]

const BOTTOM_WAVE_DISHES = [
  { name: "Aromatic Veg Biryani", img: "/food/veg_biryani_aromatic.png", tag: "Pure Veg" },
  { name: "Masala Kulcha", img: "/food/masala_kulcha.png", tag: "Clay Oven" },
  { name: "Royal Biryani", img: "/food/mutton_biryani_royal.png", tag: "Chef's Cut" },
  { name: "Kerala Fish Curry", img: "/food/fish_curry_kerala.png", tag: "Coastal Delight" },
  { name: "Spicy Prawns", img: "/food/prawns_biryani_spicy.png", tag: "Seafood" },
]

export default function UnifiedOTPFastLogin() {
  const RESEND_COOLDOWN_SECONDS = 60
  const [phoneNumber, setPhoneNumber] = useState(() => sessionStorage.getItem("draft_phone_login") || "")
  const [otp, setOtp] = useState("")
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [showNameModal, setShowNameModal] = useState(false)
  const [newName, setNewName] = useState("")
  const [isUpdatingName, setIsUpdatingName] = useState(false)
  const [tempAuth, setTempAuth] = useState(null)
  const [pendingVerify, setPendingVerify] = useState(null)
  const navigate = useNavigate()
  const submitting = useRef(false)
  const companyName = useCompanyName() || "Jharkhand Rasoi"

  const normalizedPhone = () => {
    const digits = String(phoneNumber).replace(/\D/g, "").slice(-15)
    return digits.length >= 8 ? digits : ""
  }

  const handleSendOTP = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    const phone = normalizedPhone()
    if (phone.length < 10) {
      toast.error("Please enter a valid 10-digit phone number")
      return
    }
    if (submitting.current) return
    submitting.current = true
    setLoading(true)
    try {
      await authAPI.sendOTP(phoneNumber, "login", null)
      setOtp("")
      setStep(2)
      setResendTimer(RESEND_COOLDOWN_SECONDS)
      toast.success("OTP sent successfully!")
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to send OTP."
      toast.error(msg)
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  const handleResendOTP = async () => {
    const phone = normalizedPhone()
    if (phone.length < 10) {
      toast.error("Please enter a valid phone number")
      return
    }
    if (resendTimer > 0 || submitting.current) return
    submitting.current = true
    setLoading(true)
    try {
      await authAPI.sendOTP(phoneNumber, "login", null)
      setOtp("")
      setResendTimer(RESEND_COOLDOWN_SECONDS)
      toast.success("OTP resent successfully.")
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to resend OTP."
      toast.error(msg)
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  const handleEditNumber = () => {
    setStep(1)
    setOtp("")
    setResendTimer(0)
    setPendingVerify(null)
    setShowNameModal(false)
    setNewName("")
  }

  const handleVerifyOTP = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    const otpDigits = String(otp).replace(/\D/g, "").slice(0, 6)
    if (otpDigits.length !== 6) {
      toast.error("Please enter the 6-digit OTP")
      return
    }
    if (submitting.current) return
    submitting.current = true
    setLoading(true)
    let fcmToken = null
    let platform = "web"
    try {
      try {
        if (typeof window !== "undefined") {
          if (window.flutter_inappwebview) {
            platform = "mobile"
            const handlerNames = ["getFcmToken", "getFCMToken", "getPushToken", "getFirebaseToken"]
            for (const handlerName of handlerNames) {
              try {
                const t = await window.flutter_inappwebview.callHandler(handlerName, { module: "user" })
                if (t && typeof t === "string" && t.length > 20) {
                  fcmToken = t.trim()
                  break
                }
              } catch (e) {}
            }
          } else {
            fcmToken = localStorage.getItem("fcm_web_registered_token_user") || null
          }
        }
      } catch (e) {
        console.warn("Failed to get FCM token during login", e)
      }

      const response = await authAPI.verifyOTP(phoneNumber, otpDigits, "login", null, null, "user", null, null, fcmToken, platform)
      const data = response?.data?.data || response?.data || {}
      const needsName = data.needsName === true || data.isNewUser === true || (data.user && (!data.user.name || String(data.user.name).trim().length === 0 || String(data.user.name).toLowerCase() === "null"))

      if (needsName) {
        setPendingVerify({ phone: phoneNumber, otp: otpDigits, fcmToken, platform })
        setShowNameModal(true)
        return
      }

      const accessToken = data.accessToken
      const refreshToken = data.refreshToken || null
      const user = data.user

      if (!accessToken || !user) {
        throw new Error("Invalid response from server")
      }

      setAuthData("user", accessToken, user, refreshToken)
      toast.success("Welcome back!")
      navigate("/food/user", { replace: true })
    } catch (err) {
      const status = err?.response?.status
      let msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Invalid OTP. Please try again."
      const nameRequired = /name\s+is\s+required.*first[- ]?time|first[- ]?time.*name\s+is\s+required|first[- ]?time\s*sign\s*up/i.test(String(msg))
      if (nameRequired) {
        setPendingVerify({ phone: phoneNumber, otp: otpDigits, fcmToken, platform })
        setShowNameModal(true)
        return
      }
      if (status === 401) {
        if (/deactivat(ed|e)/i.test(String(msg))) {
          msg = "Your account is deactivated. Please contact support."
        } else {
          msg = "Invalid or expired code, or account not active."
        }
      }
      toast.error(msg)
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  const handleNameSubmit = async (e) => {
    e.preventDefault()
    if (!newName.trim()) {
      toast.error("Please enter your name")
      return
    }

    try {
      setIsUpdatingName(true)
      if (pendingVerify) {
        const response = await authAPI.verifyOTP(
          pendingVerify.phone,
          pendingVerify.otp,
          "login",
          newName.trim(),
          null,
          "user",
          null,
          null,
          pendingVerify.fcmToken,
          pendingVerify.platform,
        )
        const data = response?.data?.data || response?.data || {}
        const accessToken = data.accessToken
        const refreshToken = data.refreshToken || null
        const user = data.user

        setAuthData("user", accessToken, user, refreshToken)
        setPendingVerify(null)
        toast.success(`Welcome, ${newName.trim()}!`)
        setShowNameModal(false)
        navigate("/food/user", { replace: true })
        return
      }

      await userAPI.updateProfile({ name: newName.trim() })
      const updatedUser = { ...tempAuth.user, name: newName.trim() }
      setAuthData("user", tempAuth.accessToken, updatedUser, tempAuth.refreshToken)

      toast.success(`Welcome, ${newName.trim()}!`)
      setShowNameModal(false)
      navigate("/food/user", { replace: true })
    } catch (err) {
      toast.error("Failed to update name. You can skip this for now or try again.")
      console.error(err)
    } finally {
      setIsUpdatingName(false)
    }
  }

  useEffect(() => {
    if (step !== 2 || resendTimer <= 0) return
    const intervalId = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(intervalId)
  }, [step, resendTimer])

  return (
    <div className="relative min-h-screen w-full bg-white flex flex-col justify-between overflow-hidden selection:bg-amber-400 selection:text-black font-sans">
      
      {/* Inline styles for Left-to-Right Continuous Marquee Animation */}
      <style>{`
        @keyframes marqueeMoveLeftToRight {
          0% {
            transform: translateX(-50%);
          }
          100% {
            transform: translateX(0%);
          }
        }
        @keyframes floatGentleBob {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-6px) rotate(3deg);
          }
        }
        @keyframes floatReverseBob {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(6px) rotate(-3deg);
          }
        }
        .animate-marquee-left-to-right {
          animation: marqueeMoveLeftToRight 28s linear infinite;
        }
        .animate-marquee-left-to-right-slow {
          animation: marqueeMoveLeftToRight 34s linear infinite;
        }
        .animate-bob {
          animation: floatGentleBob 3.5s ease-in-out infinite;
        }
        .animate-reverse-bob {
          animation: floatReverseBob 4s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-marquee-left-to-right,
          .animate-marquee-left-to-right-slow,
          .animate-bob,
          .animate-reverse-bob {
            animation: none !important;
          }
        }
      `}</style>

      {/* ========================================================= */}
      {/* TOP SECTION: Organic Curved Wave + Icons Moving Left to Right */}
      {/* ========================================================= */}
      <div className="relative w-full h-[180px] sm:h-[220px] md:h-[260px] overflow-hidden select-none">
        {/* SVG Top Wave with System Theme Yellow (#FEC600) Gradient */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <svg
            viewBox="0 0 1440 280"
            className="w-full h-full object-cover"
            preserveAspectRatio="none"
            fill="none"
          >
            <defs>
              <linearGradient id="jhTopWaveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#F59E0B" />
                <stop offset="40%" stopColor="#FEC600" />
                <stop offset="75%" stopColor="#FEC600" />
                <stop offset="100%" stopColor="#FBBF24" />
              </linearGradient>
            </defs>
            <path
              d="M0,0 L1440,0 L1440,150 C1120,200 820,130 460,195 C220,238 90,265 0,270 Z"
              fill="url(#jhTopWaveGrad)"
            />
          </svg>
        </div>

        {/* Anchored Hero Dish on Top Left (Like the Noodle Bowl in RedGo Reference) */}
        <motion.div
          animate={{
            y: [-6, 6, -6],
            rotate: [-2, 3, -2],
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-4 sm:top-6 left-4 sm:left-10 md:left-16 z-20 pointer-events-none"
        >
          <div className="relative group cursor-pointer pointer-events-auto">
            <img
              src="/food/chicken_biryani_deluxe.png"
              alt="Signature Delicacy"
              className="w-20 h-20 sm:w-26 sm:h-26 md:w-32 md:h-32 object-contain drop-shadow-[0_14px_22px_rgba(0,0,0,0.22)] transition-transform duration-300 group-hover:scale-110"
              onError={(e) => {
                e.target.onerror = null
                e.target.src = "/logo.png"
              }}
            />
          </div>
        </motion.div>

        {/* Continuous Stream of Food Dishes Gliding from LEFT to RIGHT */}
        <div className="absolute top-5 sm:top-8 inset-x-0 z-10 overflow-hidden pointer-events-none">
          <div className="flex w-max animate-marquee-left-to-right">
            {/* Duplicated List for seamless infinite looping */}
            {[...TOP_WAVE_DISHES, ...TOP_WAVE_DISHES].map((dish, idx) => (
              <div
                key={`top-dish-${idx}`}
                className="flex items-center gap-2 mx-6 sm:mx-10 shrink-0"
              >
                <div className={`relative ${idx % 2 === 0 ? "animate-bob" : "animate-reverse-bob"}`}>
                  <img
                    src={dish.img}
                    alt={dish.name}
                    className="w-16 h-16 sm:w-22 sm:h-22 md:w-26 md:h-26 object-contain drop-shadow-[0_12px_18px_rgba(0,0,0,0.18)]"
                    onError={(e) => {
                      e.target.onerror = null
                      e.target.style.display = "none"
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top-Right Support Button */}
        <div className="absolute top-4 right-4 sm:right-6 z-30">
          <Link
            to="/user/auth/support"
            className="bg-black/10 hover:bg-black/20 text-black backdrop-blur-md px-3.5 py-1.5 rounded-full border border-black/15 shadow-xs flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase transition-all active:scale-95"
            title="Customer Support"
          >
            <Headphones className="w-3.5 h-3.5 text-black" strokeWidth={2.5} />
            <span className="hidden sm:inline">SUPPORT</span>
          </Link>
        </div>
      </div>

      {/* ========================================================= */}
      {/* CENTER CONTENT: Crisp Form Card (Exact RedGo Layout & Theme) */}
      {/* ========================================================= */}
      <div className="relative z-20 w-full max-w-[420px] mx-auto px-6 py-4 sm:py-6 flex flex-col items-center justify-center text-center">
        
        {/* Brand Logo */}
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, type: "spring", bounce: 0.3 }}
          className="mb-3 relative"
        >
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white shadow-[0_8px_24px_rgba(0,0,0,0.08)] border border-amber-300/60 flex items-center justify-center overflow-hidden p-2 group">
            <img
              src="/logo.png"
              alt={`${companyName} Logo`}
              className="w-full h-full object-contain select-none transition-transform duration-300 group-hover:scale-105"
              onError={(e) => {
                e.target.onerror = null
                e.target.src = "/favicon.ico"
              }}
            />
          </div>
        </motion.div>

        {/* Subtitle (Exact text as RedGo reference) */}
        <p className="text-gray-500 font-medium text-sm sm:text-[15px] mb-5 sm:mb-6">
          {step === 1 ? "Login or signup with your phone number" : "Enter verification code"}
        </p>

        {/* STEP 1: Phone Number Input Form */}
        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.form
              key="login-step-phone"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              onSubmit={handleSendOTP}
              className="w-full flex flex-col items-center"
            >
              {/* Phone Input Pill */}
              <div className="w-full h-12 sm:h-13 bg-white rounded-full border border-gray-200 shadow-xs focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-300/40 flex items-center px-4 transition-all duration-200">
                <span className="text-gray-900 font-bold text-sm sm:text-base pr-3 shrink-0 select-none">
                  +91
                </span>
                <div className="h-5 w-[1px] bg-gray-200 shrink-0 mr-3" />
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                  autoFocus
                  value={phoneNumber}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 10)
                    setPhoneNumber(val)
                    sessionStorage.setItem("draft_phone_login", val)
                  }}
                  maxLength={10}
                  placeholder="Mobile number"
                  className="w-full bg-transparent border-none outline-none text-gray-900 font-semibold text-sm sm:text-base placeholder:text-gray-400 placeholder:font-normal p-0"
                />
              </div>

              {/* Main "Log in" CTA Button (System Theme Yellow with Bold Black Text) */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 sm:h-13 rounded-full bg-[#FEC600] hover:bg-amber-400 active:scale-[0.98] text-black font-extrabold text-sm sm:text-base shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 mt-4 cursor-pointer disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-black" />
                ) : (
                  <span>Log in</span>
                )}
              </button>

              {/* Secondary "Skip for now →" Pill (Navigates to /food/user) */}
              <button
                type="button"
                onClick={() => navigate("/food/user")}
                className="mt-3.5 px-6 py-2 rounded-full bg-black hover:bg-gray-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer"
              >
                <span>Skip for now</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              {/* Legal Footer Links */}
              <div className="mt-6 text-center space-y-1">
                <p className="text-[11px] sm:text-xs text-gray-400 font-medium">
                  By continuing, you agree to our
                </p>
                <div className="flex items-center justify-center gap-2 text-[10px] sm:text-[11px] font-bold text-gray-500 tracking-wider">
                  <Link
                    to="/profile/terms"
                    className="hover:text-black transition-colors uppercase"
                  >
                    TERMS
                  </Link>
                  <span>•</span>
                  <Link
                    to="/profile/privacy"
                    className="hover:text-black transition-colors uppercase"
                  >
                    PRIVACY
                  </Link>
                  <span>•</span>
                  <Link
                    to="/user/auth/support"
                    className="hover:text-black transition-colors uppercase"
                  >
                    SUPPORT
                  </Link>
                </div>
              </div>
            </motion.form>
          ) : (
            /* STEP 2: 6-Digit OTP Verification Form */
            <motion.form
              key="login-step-otp"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              onSubmit={handleVerifyOTP}
              className="w-full flex flex-col items-center"
            >
              {/* Sent to Number info + Edit Button */}
              <div className="flex items-center justify-center gap-2 mb-4 text-xs sm:text-sm text-gray-600 font-medium">
                <span>Code sent to <strong>+91 {phoneNumber}</strong></span>
                <button
                  type="button"
                  onClick={handleEditNumber}
                  className="p-1 hover:bg-gray-100 rounded-full text-gray-700 transition-colors"
                  title="Change phone number"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 6 Digit Input Boxes */}
              <div className="flex justify-between gap-2 sm:gap-2.5 w-full mb-3">
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <input
                    key={index}
                    id={`otp-input-${index}`}
                    type="tel"
                    inputMode="numeric"
                    maxLength={1}
                    required
                    autoFocus={index === 0}
                    value={otp[index] || ""}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(-1)
                      const newOtp = otp.split("")
                      newOtp[index] = val || ""
                      const combined = newOtp.join("").slice(0, 6)
                      setOtp(combined)
                      if (index < 5 && val) {
                        document.getElementById(`otp-input-${index + 1}`)?.focus()
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace") {
                        if (!otp[index] && index > 0) {
                          document.getElementById(`otp-input-${index - 1}`)?.focus()
                        } else {
                          const newOtp = otp.split("")
                          newOtp[index] = ""
                          setOtp(newOtp.join(""))
                        }
                      }
                    }}
                    onPaste={(e) => {
                      e.preventDefault()
                      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)
                      setOtp(pasted)
                      if (pasted.length === 6) {
                        document.getElementById("otp-input-5")?.focus()
                      }
                    }}
                    className="w-11 h-13 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-bold bg-white border border-gray-200 rounded-xl shadow-xs text-gray-900 focus:border-[#FEC600] focus:ring-2 focus:ring-[#FEC600]/30 outline-none transition-all"
                  />
                ))}
              </div>

              {/* Timer and Change Number */}
              <div className="flex items-center justify-between w-full text-xs text-gray-500 font-medium px-1 mb-2">
                {resendTimer > 0 ? (
                  <span>Resend code in <strong className="text-gray-800">{resendTimer}s</strong></span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    disabled={loading}
                    className="text-amber-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" /> Resend OTP
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleEditNumber}
                  className="text-gray-600 hover:text-gray-900 font-medium cursor-pointer"
                >
                  Change Number
                </button>
              </div>

              {/* Verify & Login Button */}
              <button
                type="submit"
                disabled={loading || otp.replace(/\D/g, "").length !== 6}
                className="w-full h-12 sm:h-13 rounded-full bg-[#FEC600] hover:bg-amber-400 active:scale-[0.98] text-black font-extrabold text-sm sm:text-base shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 mt-3 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-black" />
                ) : (
                  <>
                    <span>Verify &amp; Continue</span>
                    <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                  </>
                )}
              </button>

              {/* Back to Login link */}
              <button
                type="button"
                onClick={handleEditNumber}
                className="mt-3 text-xs font-semibold text-gray-500 hover:text-black transition-colors"
              >
                ← Back to Login
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      {/* ========================================================= */}
      {/* BOTTOM SECTION: Organic Curved Wave + Icons Moving Left to Right */}
      {/* ========================================================= */}
      <div className="relative w-full h-[180px] sm:h-[220px] md:h-[260px] overflow-hidden select-none">
        {/* SVG Bottom Wave with System Theme Yellow (#FEC600) Gradient */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <svg
            viewBox="0 0 1440 280"
            className="w-full h-full object-cover"
            preserveAspectRatio="none"
            fill="none"
          >
            <defs>
              <linearGradient id="jhBottomWaveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#FBBF24" />
                <stop offset="45%" stopColor="#FEC600" />
                <stop offset="85%" stopColor="#F59E0B" />
                <stop offset="100%" stopColor="#D97706" />
              </linearGradient>
            </defs>
            <path
              d="M0,280 L1440,280 L1440,80 C1180,135 880,240 520,225 C260,215 100,245 0,255 Z"
              fill="url(#jhBottomWaveGrad)"
            />
          </svg>
        </div>

        {/* Anchored Hero Dish on Bottom Right (Like the Pasta Dish in RedGo Reference) */}
        <motion.div
          animate={{
            y: [6, -6, 6],
            rotate: [2, -3, 2],
          }}
          transition={{
            duration: 5.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute bottom-4 sm:bottom-6 right-4 sm:right-10 md:right-16 z-20 pointer-events-none"
        >
          <div className="relative group cursor-pointer pointer-events-auto">
            <img
              src="/food/paneer_tikka_masala.png"
              alt="Gourmet Dish"
              className="w-20 h-20 sm:w-26 sm:h-26 md:w-32 md:h-32 object-contain drop-shadow-[0_14px_22px_rgba(0,0,0,0.22)] transition-transform duration-300 group-hover:scale-110"
              onError={(e) => {
                e.target.onerror = null
                e.target.src = "/logo.png"
              }}
            />
          </div>
        </motion.div>

        {/* Continuous Stream of Food Dishes Gliding from LEFT to RIGHT */}
        <div className="absolute bottom-5 sm:bottom-8 inset-x-0 z-10 overflow-hidden pointer-events-none">
          <div className="flex w-max animate-marquee-left-to-right-slow">
            {/* Duplicated List for seamless infinite looping */}
            {[...BOTTOM_WAVE_DISHES, ...BOTTOM_WAVE_DISHES].map((dish, idx) => (
              <div
                key={`bottom-dish-${idx}`}
                className="flex items-center gap-2 mx-6 sm:mx-10 shrink-0"
              >
                <div className={`relative ${idx % 2 === 0 ? "animate-reverse-bob" : "animate-bob"}`}>
                  <img
                    src={dish.img}
                    alt={dish.name}
                    className="w-16 h-16 sm:w-22 sm:h-22 md:w-26 md:h-26 object-contain drop-shadow-[0_12px_18px_rgba(0,0,0,0.18)]"
                    onError={(e) => {
                      e.target.onerror = null
                      e.target.style.display = "none"
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL: New User Profile Name Input */}
      {/* ========================================================= */}
      <Dialog open={showNameModal} onOpenChange={setShowNameModal}>
        <DialogContent className="sm:max-w-md bg-white rounded-3xl p-6 shadow-2xl border-0">
          <DialogTitle className="text-xl font-extrabold text-gray-900 text-center flex items-center justify-center gap-1.5">
            <span>Welcome to {companyName}!</span>
            <Sparkles className="w-5 h-5 text-amber-500 fill-amber-500" />
          </DialogTitle>
          <DialogDescription className="text-center text-gray-600 text-sm mt-1">
            What should we call you? Please enter your name to complete your profile.
          </DialogDescription>
          <form onSubmit={handleNameSubmit} className="space-y-4 mt-4">
            <div className="space-y-1.5 text-left">
              <Label htmlFor="user-name" className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Full Name
              </Label>
              <Input
                id="user-name"
                placeholder="e.g. John Doe"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-12 rounded-xl bg-gray-50 border-gray-200 text-gray-900 font-semibold focus:border-[#FEC600] focus:ring-1 focus:ring-[#FEC600]/20"
                autoFocus
                required
              />
            </div>
            <Button
              type="submit"
              disabled={isUpdatingName || !newName.trim()}
              className="w-full h-12 rounded-xl bg-[#FEC600] hover:bg-amber-400 text-black font-extrabold text-base shadow-md transition-all cursor-pointer"
            >
              {isUpdatingName ? (
                <Loader2 className="w-5 h-5 animate-spin text-black" />
              ) : (
                `Continue to ${companyName}`
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
