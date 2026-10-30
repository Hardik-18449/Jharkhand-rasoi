import React, { useEffect, useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Link, useNavigate } from "react-router-dom"
import { Phone, Loader2, X, User, Pencil, ArrowRight } from "lucide-react"
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
  const RESEND_COOLDOWN_SECONDS = 59
  const OTP_LENGTH = 6
  const companyName = useCompanyName() || "Jharkhand Rasoi"

  const defaultTestPhone =
    import.meta.env.VITE_USE_DEFAULT_TEST_PHONE === "true"
      ? String(import.meta.env.VITE_DEFAULT_TEST_PHONE || "").replace(/\D/g, "").slice(0, 10)
      : (typeof window !== "undefined" ? sessionStorage.getItem("draft_phone_login") || "" : "")

  const [phoneNumber, setPhoneNumber] = useState(defaultTestPhone)
  const [otp, setOtp] = useState("")
  const [otpError, setOtpError] = useState("")
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [showNameModal, setShowNameModal] = useState(false)
  const [newName, setNewName] = useState("")
  const [isUpdatingName, setIsUpdatingName] = useState(false)
  const [tempAuth, setTempAuth] = useState(null)
  const [pendingVerify, setPendingVerify] = useState(null)
  const [showRestorePopup, setShowRestorePopup] = useState(false)
  const [deletedAccountData, setDeletedAccountData] = useState(null)
  const [blockTimer, setBlockTimer] = useState(0)
  const navigate = useNavigate()
  const submitting = useRef(false)

  // iOS only opens the soft-keyboard from a focus() that happens *inside* a
  // user gesture. This hidden input is focused synchronously on the "Log in"
  // tap so the keyboard opens, then focus is transferred to the OTP boxes once
  // they mount (focus transfer keeps the keyboard up on iOS).
  const focusKeeperRef = useRef(null)
  const keyboardPrimedRef = useRef(false)

  // --- PERSISTENCE LOGIC START ---
  const SESSION_KEY = "user_auth_session_data"

  // Rehydrate state on mount
  useEffect(() => {
    const savedState = sessionStorage.getItem(SESSION_KEY)
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState)
        if (parsed.phoneNumber) setPhoneNumber(parsed.phoneNumber)
        if (parsed.step) setStep(parsed.step)
        if (parsed.showNameModal !== undefined) setShowNameModal(parsed.showNameModal)
        if (parsed.newName) setNewName(parsed.newName)
        if (parsed.tempAuth) setTempAuth(parsed.tempAuth)
        if (parsed.pendingVerify) setPendingVerify(parsed.pendingVerify)
        if (parsed.showRestorePopup !== undefined) setShowRestorePopup(parsed.showRestorePopup)
        if (parsed.deletedAccountData) setDeletedAccountData(parsed.deletedAccountData)

        // Resume Resend Timer
        if (parsed.resendExpiresAt) {
          const remaining = Math.max(0, Math.floor((parsed.resendExpiresAt - Date.now()) / 1000))
          if (remaining > 0) setResendTimer(remaining)
        }

        // Resume Block Timer
        if (parsed.blockExpiresAt) {
          const remaining = Math.max(0, Math.floor((parsed.blockExpiresAt - Date.now()) / 1000))
          if (remaining > 0) {
            setBlockTimer(remaining)
            if (parsed.step === 1) setStep(2) // Ensure we show step 2 if blocked
          }
        }
      } catch (e) {
        console.error("Failed to rehydrate login state", e)
      }
    }
  }, [])

  // Persist state on change
  useEffect(() => {
    if (step === 1 && !phoneNumber && !blockTimer && !showNameModal && !showRestorePopup) {
      return
    }

    const stateToSave = {
      phoneNumber,
      step,
      showNameModal,
      newName,
      tempAuth,
      pendingVerify,
      showRestorePopup,
      deletedAccountData,
      resendExpiresAt: resendTimer > 0 ? Date.now() + (resendTimer * 1000) : null,
      blockExpiresAt: blockTimer > 0 ? Date.now() + (blockTimer * 1000) : null,
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(stateToSave))
  }, [phoneNumber, step, showNameModal, newName, tempAuth, pendingVerify, showRestorePopup, deletedAccountData, resendTimer === 0, blockTimer === 0])

  // Combined cleanup helper
  const clearSessionData = () => {
    sessionStorage.removeItem(SESSION_KEY)
  }
  // --- PERSISTENCE LOGIC END ---

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

    // Prime the keyboard inside the tap gesture so iOS keeps it open while we
    // navigate to the OTP step (Android focuses fine on mount).
    if (focusKeeperRef.current) {
      focusKeeperRef.current.focus()
      keyboardPrimedRef.current = true
    }
    submitting.current = true
    setLoading(true)
    try {
      await authAPI.sendOTP(phoneNumber, "login", null)
      setOtp("")
      setOtpError("")
      setBlockTimer(0)
      setStep(2)
      setResendTimer(RESEND_COOLDOWN_SECONDS)
      toast.success("OTP sent successfully!")
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to send OTP."
      const lowerMsg = msg.toLowerCase()
      const isBlocked =
        lowerMsg.includes("blocked") ||
        lowerMsg.includes("too many attempts") ||
        lowerMsg.includes("try again after")

      if (isBlocked) {
        let totalSeconds = 180 // default 3 mins
        const timeMatch = msg.match(/(\d+)(?::(\d+))?/)
        if (timeMatch) {
          const mins = parseInt(timeMatch[1])
          const secs = timeMatch[2] ? parseInt(timeMatch[2]) : 0
          totalSeconds = (mins * 60) + secs
        }

        setBlockTimer(totalSeconds)
        setStep(2)
        return
      }
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
    if (resendTimer > 0 || blockTimer > 0 || submitting.current) return
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
      const lowerMsg = msg.toLowerCase()
      const isBlocked =
        lowerMsg.includes("blocked") ||
        lowerMsg.includes("too many attempts") ||
        lowerMsg.includes("try again after")

      if (isBlocked) {
        let totalSeconds = 180
        const timeMatch = msg.match(/(\d+)(?::(\d+))?/)
        if (timeMatch) {
          const mins = parseInt(timeMatch[1])
          const secs = timeMatch[2] ? parseInt(timeMatch[2]) : 0
          totalSeconds = (mins * 60) + secs
        }

        setBlockTimer(totalSeconds)
        return
      }
      toast.error(msg)
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  const handleEditNumber = () => {
    setShowNameModal(false)
    setShowRestorePopup(false)
    setDeletedAccountData(null)
    setPendingVerify(null)
    setBlockTimer(0) // Clear block timer when changing number
    setOtpError("") // Clear error
    setOtp("") // Clear inputs
    setStep(1)
    setResendTimer(0)

    if (step === 2) {
      // Naturally triggers popstate listener which pops the navigation state
      window.history.back()
    }
  }

  const handleVerifyOTP = async (e, customOtp = null) => {
    if (e && e.preventDefault) e.preventDefault()
    const code = typeof customOtp === "string" ? customOtp : otp
    const otpDigits = String(code).replace(/\D/g, "").slice(0, OTP_LENGTH)
    if (otpDigits.length !== OTP_LENGTH) {
      toast.error(`Please enter the ${OTP_LENGTH}-digit OTP`)
      return
    }
    await processVerify(phoneNumber, otpDigits)
  }

  const processVerify = async (phone, otpCode, confirmAction = null) => {
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
            try {
              const t = await window.flutter_inappwebview.callHandler("getFcmToken", { module: "user" })
              if (t && typeof t === "string" && t.length > 20) fcmToken = t.trim()
            } catch (e) { }
          } else {
            fcmToken = localStorage.getItem("fcm_web_registered_token_user") || null
          }
        }
      } catch (e) {
        console.warn("Failed to get FCM token during login", e)
      }

      const response = await authAPI.verifyOTP(
        phone,
        otpCode,
        "login",
        null,
        null,
        "user",
        null,
        null,
        fcmToken,
        platform,
        null,
        confirmAction
      )
      const data = response?.data?.data || response?.data || {}

      // Handle deleted account found
      if (data.deletedAccountFound) {
        setDeletedAccountData(data)
        setShowRestorePopup(true)
        setLoading(false)
        submitting.current = false
        return
      }

      // Handle name required (Success response with flag)
      if (data.needsName) {
        setShowRestorePopup(false)
        setPendingVerify({
          phone: phoneNumber,
          otp: otpCode,
          fcmToken,
          platform,
          confirmAction // Preserve the action for subsequent name submission
        })
        setShowNameModal(true)
        setLoading(false)
        submitting.current = false
        return
      }

      const accessToken = data.accessToken
      const refreshToken = data.refreshToken || null
      const user = data.user

      if (!accessToken || !user) {
        throw new Error("Invalid parameters from server")
      }

      setAuthData("user", accessToken, user, refreshToken)

      // If user has no name, show name modal instead of immediate navigation
      if (!user.name || user.name.trim() === "") {
        setTempAuth({ accessToken, user, refreshToken })
        setShowNameModal(true)
      } else {
        clearSessionData()
        toast.success("Welcome back!")
        navigate("/food/user", { replace: true })
      }
    } catch (err) {
      const status = err?.response?.status
      let msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Invalid OTP. Please try again."

      // Clear OTP inputs on failure
      setOtp("")
      setTimeout(() => {
        document.getElementById("otp-0")?.focus()
      }, 50)

      if (msg.toLowerCase().includes("blocked") || msg.toLowerCase().includes("too many attempts")) {
        const timeMatch = msg.match(/(\d+)(?::(\d+))?/)
        if (timeMatch) {
          const mins = parseInt(timeMatch[1])
          const secs = timeMatch[2] ? parseInt(timeMatch[2]) : 0
          setBlockTimer((mins * 60) + secs)
          msg = "" // Clear msg so only block UI displays
        }
      }

      // Legacy check for string-based name requirement (backward compatibility)
      const nameRequired = /name\s+is\s+required.*first[- ]?time|first[- ]?time.*name\s+is\s+required|first[- ]?time\s*sign\s*up/i.test(String(msg))
      if (nameRequired) {
        setShowRestorePopup(false)
        setPendingVerify({
          phone: phoneNumber,
          otp: otpCode,
          fcmToken,
          platform,
          confirmAction
        })
        setShowNameModal(true)
        return
      }

      if (status === 401 && msg) {
        if (/deactivat(ed|e)/i.test(String(msg))) {
          msg = "Your account is deactivated. Please contact support."
          toast.error(msg)
        } else {
          setOtpError("Invalid OTP")
        }
      } else if (msg) {
        toast.error(msg)
      }
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
          null, // _token
          pendingVerify.confirmAction // Pass preserved action
        )
        const data = response?.data?.data || response?.data || {}
        const accessToken = data.accessToken
        const refreshToken = data.refreshToken || null
        const user = data.user

        setAuthData("user", accessToken, user, refreshToken)
        setPendingVerify(null)
        clearSessionData()
        setShowNameModal(false)
        toast.success(`Welcome to ${companyName}!`)
        navigate("/food/user", { replace: true })
        return
      }

      // Call update profile API
      await userAPI.updateProfile({ name: newName.trim() })

      // Update local storage and auth data with the new name
      const updatedUser = { ...tempAuth.user, name: newName.trim() }
      setAuthData("user", tempAuth.accessToken, updatedUser, tempAuth.refreshToken)

      clearSessionData()
      setShowNameModal(false)
      toast.success(`Welcome to ${companyName}!`)
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

  useEffect(() => {
    if (blockTimer <= 0) return
    const intervalId = setInterval(() => {
      setBlockTimer((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(intervalId)
  }, [blockTimer])

  useEffect(() => {
    if (step === 2) {
      const focusFirst = () => {
        const el = document.getElementById("otp-0")
        if (el) {
          el.focus()
          el.click()
        }
      }
      if (keyboardPrimedRef.current) {
        keyboardPrimedRef.current = false
        requestAnimationFrame(focusFirst)
        return
      }
      setTimeout(focusFirst, 250)
    }
  }, [step])

  // Intercept hardware back button to return to step 1 instead of leaving page
  useEffect(() => {
    const handlePopState = () => {
      if (step === 2) {
        if (blockTimer > 0) {
          window.history.pushState({ otpStep: true }, "")
          return
        }
        setShowNameModal(false)
        setShowRestorePopup(false)
        setDeletedAccountData(null)
        setPendingVerify(null)
        setNewName("")
        setStep(1)
        setOtp("")
        setOtpError("")
        setResendTimer(0)
      }
    }

    if (step === 2) {
      window.history.pushState({ otpStep: true }, "")
      window.addEventListener("popstate", handlePopState)
    }

    return () => {
      window.removeEventListener("popstate", handlePopState)
    }
  }, [step, blockTimer > 0])

  const formatResendTimer = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }

  // When an input is focused the mobile soft-keyboard opens and shrinks the viewport
  const handleInputFocusScroll = (e) => {
    const el = e.currentTarget
    setTimeout(() => {
      el?.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 300)
  }

  return (
    <div className="h-screen h-[100dvh] max-h-screen bg-white dark:bg-[#0a0a0a] flex flex-col relative overflow-hidden font-['Poppins']">
      <style>
        {`
          @keyframes floatDish1 {
            0%, 100% { transform: translateX(0vw) translateY(0px) rotate(0deg); }
            50% { transform: translateX(25vw) translateY(-15px) rotate(8deg); }
          }
          @keyframes floatDish2 {
            0%, 100% { transform: translateX(0vw) translateY(0px) rotate(0deg); }
            50% { transform: translateX(-25vw) translateY(-15px) rotate(-8deg); }
          }
          .animate-float-dish-1 {
            animation: floatDish1 12s ease-in-out infinite;
          }
          .animate-float-dish-2 {
            animation: floatDish2 12s ease-in-out infinite;
          }
        `}
      </style>

      {/* Top Wave (Jharkhand Rasoi Brand Yellow) */}
      <div className="absolute top-0 left-0 w-full h-[40vh] pointer-events-none z-0 transform scale-[1.05] origin-center">
        <svg viewBox="0 0 1440 320" className="w-full h-full block" preserveAspectRatio="none" overflow="visible">
          <defs>
            <linearGradient id="topYellowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#FEC600" />
            </linearGradient>
          </defs>
          <path
            fill="url(#topYellowGrad)"
            d="M -50,-50 L -50,280 C 200,100 800,100 1490,100 L 1490,-50 Z"
            filter="drop-shadow(0px 6px 18px rgba(245,158,11,0.25))"
          />
        </svg>
        <img
          src="/food_dish.png"
          alt="Delicious food"
          className="absolute top-[8%] left-[5%] w-[14vh] h-[14vh] md:w-[130px] md:h-[130px] object-contain animate-float-dish-1 drop-shadow-xl"
        />
      </div>

      {/* Bottom Wave (Jharkhand Rasoi Brand Yellow) */}
      <div className="absolute bottom-0 left-0 w-full h-[50vh] pointer-events-none z-0 transform scale-[1.05] origin-center">
        <svg viewBox="0 0 1440 320" className="w-full h-full block" preserveAspectRatio="none" overflow="visible">
          <defs>
            <linearGradient id="botYellowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FEC600" />
              <stop offset="100%" stopColor="#EAB308" />
            </linearGradient>
          </defs>
          <path
            fill="url(#botYellowGrad)"
            d="M -50,370 L -50,220 C 640,220 1240,220 1490,40 L 1490,370 Z"
            filter="drop-shadow(0px -6px 18px rgba(245,158,11,0.25))"
          />
        </svg>
        <img
          src="/food_dish_2.png"
          alt="Delicious food"
          className="absolute bottom-[8%] right-[5%] w-[18vh] h-[18vh] md:w-[160px] md:h-[160px] object-contain animate-float-dish-2 drop-shadow-2xl"
        />
      </div>

      {/* Hidden keyboard-keeper: focused on the "Log in" tap so iOS keeps the soft-keyboard open */}
      <input
        ref={focusKeeperRef}
        type="tel"
        inputMode="numeric"
        tabIndex={-1}
        aria-label="Keyboard focus keeper"
        readOnly
        className="absolute opacity-0 w-px h-px -z-10 pointer-events-none"
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-6 pb-20 relative z-10 overflow-hidden">
        <div className={`w-full max-w-sm flex flex-col my-auto ${step === 2 ? "relative -top-4" : ""}`}>

          {/* Logo & Header */}
          <div className="mb-6 mt-1 text-center flex flex-col items-center">
            <img
              src="/logo.png"
              alt={companyName}
              className="h-32 sm:h-36 md:h-40 w-auto object-contain drop-shadow-md transition-transform hover:scale-105 duration-300"
            />
            <div className="text-sm text-gray-500 dark:text-gray-400 font-medium flex items-center justify-center gap-1.5 mt-1">
              {step === 1 ? (
                <span>Login or signup with your phone number</span>
              ) : (
                <>
                  <span>We've sent a code to +91 {phoneNumber}</span>
                  <button
                    onClick={handleEditNumber}
                    className="p-1.5 ml-1 bg-gradient-to-r from-amber-400 to-[#FEC600] hover:from-amber-500 hover:to-yellow-500 rounded-[10px] text-black shadow-md shadow-amber-500/20 transition-all hover:scale-105 active:scale-95"
                    aria-label="Edit phone number"
                  >
                    <Pencil className="w-4 h-4" strokeWidth={2.5} />
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="relative">
            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.form
                  key="step-1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  onSubmit={handleSendOTP}
                  className="space-y-6"
                >
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                      <span className="text-sm font-semibold text-gray-600 dark:text-gray-400 pr-3 border-r border-gray-300 dark:border-gray-600">+91</span>
                    </div>
                    <input
                      type="tel"
                      required
                      autoFocus
                      onFocus={handleInputFocusScroll}
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      maxLength={10}
                      className="block w-full pl-20 pr-6 py-3.5 bg-gray-50 dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 shadow-sm text-gray-900 dark:text-white rounded-full outline-none transition-all duration-300 placeholder:text-gray-400 font-medium text-base focus:bg-white dark:focus:bg-gray-900 focus:border-[#FEC600] focus:ring-4 focus:ring-[#FEC600]/20 hover:border-gray-400"
                      placeholder="Mobile number"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || phoneNumber.length < 10}
                    className="w-full py-3.5 bg-gradient-to-r from-amber-400 via-[#FEC600] to-yellow-400 hover:from-amber-500 hover:to-yellow-500 disabled:opacity-50 text-black rounded-full font-extrabold text-base shadow-[0_8px_20px_rgba(254,198,0,0.35)] disabled:shadow-none transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin text-black" />
                    ) : (
                      "Log in"
                    )}
                  </button>
                </motion.form>
              ) : (
                <motion.form
                  key="step-2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  onSubmit={handleVerifyOTP}
                  className="space-y-6"
                >
                  {otpError && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-red-600 dark:text-red-500 text-[15px] font-bold text-center tracking-wide -mt-7 mb-6"
                    >
                      {otpError}
                    </motion.div>
                  )}

                  <div className="flex justify-center gap-2 sm:gap-2.5">
                    {Array.from({ length: OTP_LENGTH }).map((_, index) => (
                      <input
                        key={index}
                        id={`otp-${index}`}
                        type="tel"
                        inputMode="numeric"
                        required
                        disabled={loading || blockTimer > 0}
                        autoFocus={index === 0}
                        value={otp[index] || ""}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "").slice(-1)
                          if (index === 0 && val) {
                            setOtpError("")
                          }
                          if (!val) return
                          const newOtp = otp.split("")
                          newOtp[index] = val
                          const combined = newOtp.join("").slice(0, OTP_LENGTH)
                          setOtp(combined)
                          if (index < OTP_LENGTH - 1 && val) {
                            document.getElementById(`otp-${index + 1}`)?.focus()
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Backspace") {
                            if (!otp[index] && index > 0) {
                              document.getElementById(`otp-${index - 1}`)?.focus()
                            } else {
                              const newOtp = otp.split("")
                              newOtp[index] = ""
                              setOtp(newOtp.join(""))
                            }
                          }
                        }}
                        onPaste={(e) => {
                          e.preventDefault()
                          const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH)
                          if (pasted) {
                            setOtp(pasted)
                            setOtpError("")
                            const targetIdx = Math.min(pasted.length, OTP_LENGTH - 1)
                            document.getElementById(`otp-${targetIdx}`)?.focus()
                          }
                        }}
                        className={`w-11 h-13 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-black bg-gray-50 dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 shadow-sm rounded-2xl outline-none transition-all duration-300 text-gray-900 dark:text-white focus:bg-white dark:focus:bg-gray-900 focus:border-[#FEC600] focus:ring-4 focus:ring-[#FEC600]/20 hover:border-gray-400 ${
                          blockTimer > 0 ? "opacity-50 cursor-not-allowed border-red-400 bg-red-50 text-red-800" : ""
                        }`}
                        placeholder="•"
                      />
                    ))}
                  </div>

                  <div className="flex flex-col items-center gap-4">
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      {blockTimer > 0 ? (
                        <span className="text-gray-400 uppercase tracking-wider font-extrabold">Resend SMS</span>
                      ) : resendTimer > 0 ? (
                        <span className="text-gray-400 font-extrabold">
                          Resend SMS in <span className="text-slate-800 dark:text-slate-200 font-black">{formatResendTimer(resendTimer)}</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleResendOTP}
                          className="text-slate-800 dark:text-slate-200 hover:text-amber-600 dark:hover:text-[#FEC600] hover:underline font-extrabold"
                        >
                          Didn't receive SMS? Resend SMS
                        </button>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || otp.length < OTP_LENGTH || blockTimer > 0}
                    className="w-full py-3.5 bg-gradient-to-r from-amber-400 via-[#FEC600] to-yellow-400 hover:from-amber-500 hover:to-yellow-500 disabled:opacity-50 text-black rounded-full font-extrabold text-base shadow-[0_8px_20px_rgba(254,198,0,0.35)] disabled:shadow-none transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-4 cursor-pointer"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2 text-black">
                        <Loader2 className="w-5 h-5 animate-spin text-black" />
                        Verifying...
                      </span>
                    ) : (
                      "Verify & Continue"
                    )}
                  </button>

                  {blockTimer > 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center w-fit mx-auto px-6 py-2.5 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-100 dark:border-red-900/50 mt-4">
                      <p className="text-[11px] font-bold text-red-600 uppercase tracking-wider">
                        Too many failed attempts
                      </p>
                      <p className="text-sm font-bold text-red-600">
                        Try again after {Math.floor((blockTimer - 1) / 60)}:{String((blockTimer - 1) % 60).padStart(2, "0")}
                      </p>
                    </motion.div>
                  )}
                </motion.form>
              )}
            </AnimatePresence>
          </div>

          {/* Skip Now Button - only on login step, not OTP */}
          {step === 1 && blockTimer <= 0 && (
            <div className="mt-5 flex justify-center w-full">
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem("user_authenticated", "false")
                  clearSessionData()
                  navigate("/food/user")
                }}
                className="flex items-center justify-center gap-1.5 px-8 py-[7.5px] bg-neutral-900 hover:bg-black text-[#FEC600] rounded-full shadow-[0_4px_14px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-all duration-200 active:scale-95 cursor-pointer group"
              >
                <span className="text-[13px] font-bold tracking-wide" style={{ fontFamily: "'Poppins', sans-serif" }}>Skip for now</span>
                <ArrowRight className="w-3.5 h-3.5 opacity-80 group-hover:translate-x-0.5 transition-transform duration-150 mt-px" strokeWidth={2.5} />
              </button>
            </div>
          )}

          {/* Footer Info - only on login step, not OTP */}
          {step === 1 && (
            <div className="mt-8 text-center">
              <p className="text-[11px] text-gray-400/80 font-medium leading-relaxed max-w-[320px] mx-auto">
                By continuing, you agree to our <br />
                <Link to="/user/profile/terms" state={{ from: "/user/auth/login" }} className="text-gray-400 hover:text-amber-600 transition-colors uppercase tracking-wider font-semibold">TERMS</Link>
                <span className="mx-2 text-gray-400/80 font-bold">•</span>
                <Link to="/user/profile/privacy" state={{ from: "/user/auth/login" }} className="text-gray-400 hover:text-amber-600 transition-colors uppercase tracking-wider font-semibold">PRIVACY</Link>
                <span className="mx-2 text-gray-400/80 font-bold">•</span>
                <Link to="/user/profile/support-info" state={{ from: "/user/auth/login" }} className="text-gray-400 hover:text-amber-600 transition-colors uppercase tracking-wider font-semibold">SUPPORT</Link>
              </p>
            </div>
          )}

        </div>
      </div>

      {/* Name Collection Modal */}
      <Dialog
        open={showNameModal}
        onOpenChange={(open) => {
          if (!open) return
          setShowNameModal(true)
        }}
      >
        <DialogContent
          className="sm:max-w-[425px] rounded-3xl border-none p-0 overflow-hidden bg-white dark:bg-[#1a1a1a]"
          showCloseButton={false}
        >
          <div className="bg-gradient-to-br from-amber-400 via-[#FEC600] to-yellow-500 p-8 text-center relative">
            <button
              onClick={handleEditNumber}
              className="absolute top-4 right-4 p-2 bg-black/10 hover:bg-black/20 backdrop-blur-md rounded-xl text-black transition-all active:scale-95 z-20 cursor-pointer"
              aria-label="Close and return to login"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-white/20 rounded-full blur-2xl" />
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-20 h-20 bg-white/40 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-4 border border-white/60 shadow-inner"
            >
              <User className="w-10 h-10 text-black" />
            </motion.div>
            <DialogTitle className="text-2xl font-black text-black mb-2">Almost there!</DialogTitle>
            <DialogDescription className="text-black/80 font-medium">
              We'd love to know your name to personalize your experience.
            </DialogDescription>
          </div>

          <form onSubmit={handleNameSubmit} className="p-8 pt-6 space-y-6">
            <div className="space-y-4">
              <Label htmlFor="name" className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">
                Full Name
              </Label>
              <div className="relative group">
                <Input
                  id="name"
                  value={newName}
                  onChange={(e) => {
                    const filteredValue = e.target.value.replace(/[^a-zA-Z\s]/g, "")
                    setNewName(filteredValue)
                  }}
                  placeholder="Enter your name"
                  className="pl-4 h-14 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-[#FEC600] focus:border-[#FEC600] transition-all group-hover:border-[#FEC600]/40 font-medium"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                type="submit"
                disabled={isUpdatingName}
                className="w-full h-14 bg-gradient-to-r from-amber-400 via-[#FEC600] to-yellow-400 hover:from-amber-500 hover:to-yellow-500 text-black rounded-2xl font-black text-lg shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                {isUpdatingName ? (
                  <Loader2 className="h-5 w-5 animate-spin text-black" />
                ) : (
                  "Complete Profile"
                )}
              </Button>
              {!pendingVerify ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowNameModal(false)
                    navigate("/food/user", { replace: true })
                  }}
                  className="text-sm text-gray-400 hover:text-gray-600 transition-colors py-2 cursor-pointer font-medium"
                >
                  Skip for now
                </button>
              ) : (
                <p className="text-xs text-gray-400 text-center font-medium">Name is required to complete signup.</p>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Restore/New Account Popup */}
      <AnimatePresence>
        {showRestorePopup && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-sm bg-white dark:bg-[#1a1a1a] rounded-3xl shadow-2xl overflow-hidden p-8 text-center border border-gray-100 dark:border-gray-800 relative z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={handleEditNumber}
                className="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-gray-400 hover:text-gray-600 transition-all active:scale-95 cursor-pointer"
                aria-label="Close and return to login"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-20 h-20 bg-[#FEC600]/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Phone className="h-10 w-10 text-amber-600" />
              </div>

              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Account Found!</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed text-sm">
                A deleted account for <span className="font-bold text-gray-900 dark:text-white">+91 {phoneNumber}</span> was found.
                Do you want to restore your old data or start fresh with a new account?
              </p>

              <div className="space-y-4">
                <button
                  onClick={async () => {
                    await processVerify(phoneNumber, otp, "restore")
                    setShowRestorePopup(false)
                  }}
                  className="w-full h-14 bg-gradient-to-r from-amber-400 via-[#FEC600] to-yellow-400 hover:from-amber-500 hover:to-yellow-500 text-black font-extrabold rounded-2xl shadow-xl shadow-amber-500/20 transition-all active:scale-[0.98] cursor-pointer"
                >
                  Restore My Account
                </button>
                <button
                  onClick={async () => {
                    await processVerify(phoneNumber, otp, "new")
                    setShowRestorePopup(false)
                  }}
                  className="w-full h-14 border-2 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all active:scale-[0.98] cursor-pointer"
                >
                  Create New Account
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
