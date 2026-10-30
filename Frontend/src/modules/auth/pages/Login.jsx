import React, { useEffect, useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Link, useNavigate } from "react-router-dom"
import {
  ArrowRight,
  Loader2,
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
    <div className="relative h-screen h-[100dvh] max-h-screen w-full bg-white flex flex-col justify-between overflow-hidden select-none selection:bg-amber-400 selection:text-black font-sans">
      
      {/* ========================================================= */}
      {/* TOP CURVED WAVE (Exact RedGo Curve, System Yellow Theme) */}
      {/* Single Image: food_dish.png moving from LEFT then RIGHT */}
      {/* ========================================================= */}
      <div className="relative w-full h-[18vh] sm:h-[22vh] min-h-[110px] max-h-[175px] shrink-0 overflow-hidden pointer-events-none">
        
        {/* SVG Top Wave */}
        <div className="absolute inset-0 z-0">
          <svg
            viewBox="0 0 1440 220"
            className="w-full h-full object-cover"
            preserveAspectRatio="none"
            fill="none"
          >
            <defs>
              <linearGradient id="jhTopWave" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#F59E0B" />
                <stop offset="35%" stopColor="#FEC600" />
                <stop offset="75%" stopColor="#FEC600" />
                <stop offset="100%" stopColor="#FBBF24" />
              </linearGradient>
            </defs>
            <path
              d="M0,0 L1440,0 L1440,110 Q720,150 0,200 Z"
              fill="url(#jhTopWave)"
            />
          </svg>
        </div>

        {/* Single Image: /food_dish.png (Goes from Left to Right and back) */}
        <motion.div
          animate={{
            x: [0, 80, 0],
            y: [0, -6, 0],
            rotate: [-2, 3, -2],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-2 sm:top-3 md:top-5 left-4 sm:left-10 md:left-20 z-10 pointer-events-auto cursor-pointer"
        >
          <img
            src="/food_dish.png"
            alt="Delicious Noodle Bowl"
            className="w-16 h-16 sm:w-22 sm:h-22 md:w-28 md:h-28 object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.18)] transition-transform duration-300 hover:scale-105"
            onError={(e) => {
              e.target.onerror = null
              e.target.src = "/logo.png"
            }}
          />
        </motion.div>
      </div>

      {/* ========================================================= */}
      {/* CENTER LOGIN FORM (Clean, Non-Scrollable, RedGo Aligned) */}
      {/* ========================================================= */}
      <div className="relative z-20 flex-1 flex flex-col items-center justify-center w-full max-w-[440px] sm:max-w-[480px] md:max-w-[500px] mx-auto px-6 py-2 text-center shrink-0">
        
        {/* Brand Logo (Jharkhand Rasoi) */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="mb-2 sm:mb-3"
        >
          <img
            src="/logo.png"
            alt={`${companyName} Logo`}
            className="h-16 sm:h-20 md:h-22 w-auto max-w-[240px] object-contain select-none"
            onError={(e) => {
              e.target.onerror = null
              e.target.src = "/favicon.ico"
            }}
          />
        </motion.div>

        {/* Subtitle (Exact RedGo text) */}
        <p className="text-gray-500 font-medium text-sm sm:text-base mb-5 sm:mb-6 select-none">
          {step === 1 ? "Login or signup with your phone number" : "Enter verification code"}
        </p>

        {/* Step 1: Phone Entry Form */}
        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.form
              key="form-step-phone"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              onSubmit={handleSendOTP}
              className="w-full flex flex-col items-center"
            >
              {/* Phone Input Pill (Enlarged & Spacious) */}
              <div className="w-full h-13 sm:h-14 bg-white rounded-full border border-gray-200 shadow-2xs focus-within:border-[#FEC600] focus-within:ring-2 focus-within:ring-[#FEC600]/30 flex items-center px-5 transition-all duration-200">
                <span className="text-gray-800 font-bold text-base sm:text-lg pr-3.5 shrink-0 select-none">
                  +91
                </span>
                <div className="h-6 w-[1.5px] bg-gray-200 shrink-0 mr-3.5" />
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
                  className="w-full bg-transparent border-none outline-none text-gray-900 font-medium text-base sm:text-lg placeholder:text-gray-400 p-0"
                />
              </div>

              {/* Main "Log in" Button (Enlarged, System Theme Yellow with Bold Black Text) */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-13 sm:h-14 rounded-full bg-[#FEC600] hover:bg-amber-400 active:scale-[0.98] text-black font-black text-base sm:text-lg tracking-wide shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-2 mt-4 cursor-pointer disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-black" />
                ) : (
                  <span>Log in</span>
                )}
              </button>

              {/* Secondary "Skip for now →" Button */}
              <button
                type="button"
                onClick={() => navigate("/food/user")}
                className="mt-3.5 px-6 sm:px-7 py-2 sm:py-2.5 rounded-full bg-black hover:bg-gray-800 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-2xs active:scale-95 transition-all cursor-pointer"
              >
                <span>Skip for now</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Legal Footer Links (Exact RedGo Format) */}
              <div className="mt-6 sm:mt-7 text-center space-y-1">
                <p className="text-xs sm:text-[13px] text-gray-400 font-medium">
                  By continuing, you agree to our
                </p>
                <div className="flex items-center justify-center gap-2.5 text-[11px] sm:text-xs font-bold text-gray-500 tracking-wider">
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
            /* Step 2: 6-Digit OTP Verification Form (Enlarged) */
            <motion.form
              key="form-step-otp"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              onSubmit={handleVerifyOTP}
              className="w-full flex flex-col items-center"
            >
              {/* Sent to Number info + Edit Button */}
              <div className="flex items-center justify-center gap-2 mb-4 text-sm text-gray-600 font-medium">
                <span>Code sent to <strong>+91 {phoneNumber}</strong></span>
                <button
                  type="button"
                  onClick={handleEditNumber}
                  className="p-1 hover:bg-gray-100 rounded-full text-gray-700 transition-colors"
                  title="Change phone number"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>

              {/* 6 Digit Input Boxes (Enlarged) */}
              <div className="flex justify-between gap-2 sm:gap-3 w-full mb-4">
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
                    className="w-11 h-13 sm:w-13 sm:h-15 md:w-14 md:h-16 text-center text-xl sm:text-2xl font-black bg-white border border-gray-200 rounded-2xl shadow-2xs text-gray-900 focus:border-[#FEC600] focus:ring-2 focus:ring-[#FEC600]/30 outline-none transition-all"
                  />
                ))}
              </div>

              {/* Resend Timer / Link */}
              <div className="flex items-center justify-between w-full text-xs sm:text-sm text-gray-500 font-medium px-1 mb-2">
                {resendTimer > 0 ? (
                  <span>Resend code in <strong className="text-gray-800">{resendTimer}s</strong></span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    disabled={loading}
                    className="text-amber-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Resend OTP
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

              {/* Verify & Login Button (Enlarged) */}
              <button
                type="submit"
                disabled={loading || otp.replace(/\D/g, "").length !== 6}
                className="w-full h-13 sm:h-14 rounded-full bg-[#FEC600] hover:bg-amber-400 active:scale-[0.98] text-black font-black text-base sm:text-lg shadow-xs transition-all flex items-center justify-center gap-2 mt-3 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-black" />
                ) : (
                  <>
                    <span>Verify &amp; Continue</span>
                    <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                  </>
                )}
              </button>

              {/* Back to Login Link */}
              <button
                type="button"
                onClick={handleEditNumber}
                className="mt-3 text-xs sm:text-sm font-semibold text-gray-500 hover:text-black transition-colors"
              >
                ← Back to Login
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      {/* ========================================================= */}
      {/* BOTTOM CURVED WAVE (Exact RedGo Curve, System Yellow Theme)*/}
      {/* Single Image: food_dish_2.png moving in OPPOSITE direction */}
      {/* ========================================================= */}
      <div className="relative w-full h-[18vh] sm:h-[22vh] min-h-[110px] max-h-[175px] shrink-0 overflow-hidden pointer-events-none">
        
        {/* SVG Bottom Wave */}
        <div className="absolute inset-0 z-0">
          <svg
            viewBox="0 0 1440 220"
            className="w-full h-full object-cover"
            preserveAspectRatio="none"
            fill="none"
          >
            <defs>
              <linearGradient id="jhBottomWave" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#FBBF24" />
                <stop offset="45%" stopColor="#FEC600" />
                <stop offset="85%" stopColor="#F59E0B" />
                <stop offset="100%" stopColor="#D97706" />
              </linearGradient>
            </defs>
            <path
              d="M0,220 L1440,220 L1440,70 Q720,180 0,205 Z"
              fill="url(#jhBottomWave)"
            />
          </svg>
        </div>

        {/* Single Image: /food_dish_2.png (Goes in OPPOSITE direction: Right to Left then back) */}
        <motion.div
          animate={{
            x: [0, -80, 0],
            y: [0, 6, 0],
            rotate: [2, -3, 2],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute bottom-2 sm:bottom-3 md:bottom-5 right-4 sm:right-10 md:right-20 z-10 pointer-events-auto cursor-pointer"
        >
          <img
            src="/food_dish_2.png"
            alt="Gourmet Pasta Dish"
            className="w-16 h-16 sm:w-22 sm:h-22 md:w-28 md:h-28 object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.18)] transition-transform duration-300 hover:scale-105"
            onError={(e) => {
              e.target.onerror = null
              e.target.src = "/logo.png"
            }}
          />
        </motion.div>
      </div>

      {/* ========================================================= */}
      {/* MODAL: New User Profile Name Input                        */}
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
