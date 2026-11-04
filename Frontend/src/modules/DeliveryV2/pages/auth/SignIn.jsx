import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone,
  ShieldCheck,
  Bike,
  Package,
  ChevronLeft,
  AlertCircle,
  Clock,
  Navigation,
  Headphones,
  ArrowRight,
  Check,
  Zap,
  Loader2,
  ShieldQuestion
} from 'lucide-react';
import { deliveryAPI } from '@food/api';
import { setAuthData as storeAuthData, clearModuleAuth } from '@food/utils/auth';
import { registerWebPushForCurrentModule } from '@food/utils/firebaseMessaging';
import { useAppLogo } from '@food/hooks/useAppLogo';
import logoNew from '@/assets/brandlogo.png';
import { toast } from 'sonner';

const DEFAULT_COUNTRY_CODE = "+91";

export default function DeliverySignIn() {
  const navigate = useNavigate();
  const logoUrl = useAppLogo('delivery_app') || logoNew;

  // Navigation states: 'LOGIN' | 'OTP' | 'SUCCESS'
  const [currentScreen, setCurrentScreen] = useState('LOGIN');

  // Input states
  const [phoneNumber, setPhoneNumber] = useState(() => {
    const draft = localStorage.getItem("delivery_draft_phone");
    if (draft) return draft;
    const stored = localStorage.getItem("deliveryAuthData");
    if (stored) {
      try {
        const data = JSON.parse(stored);
        return data.phone ? data.phone.replace("+91", "").trim() : "";
      } catch (e) {
        return "";
      }
    }
    return "";
  });

  // 6 Digit OTP array
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(30);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorShake, setErrorShake] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // 6 Input refs for OTP
  const inputRefs = [
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null)
  ];

  // Resend Countdown
  useEffect(() => {
    let interval = null;
    if (isTimerActive && timer > 0) {
      interval = setInterval(() => setTimer((t) => t - 1), 1000);
    } else if (timer === 0) {
      setIsTimerActive(false);
    }
    return () => clearInterval(interval);
  }, [isTimerActive, timer]);

  // Shake trigger with solid error
  const triggerShake = (msg) => {
    setErrorMessage(msg);
    setErrorShake(true);
    setTimeout(() => setErrorShake(false), 500);
  };

  // Validate clean 10-digit Indian number
  const validatePhone = (num) => {
    const digits = num.replace(/\D/g, "");
    return digits.length === 10 && ["6", "7", "8", "9"].includes(digits[0]);
  };

  // Handle Send OTP
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    const cleaned = phoneNumber.replace(/\D/g, "").slice(-10);
    if (!validatePhone(cleaned)) {
      triggerShake('Please enter a valid 10-digit Indian mobile number');
      return;
    }

    setErrorMessage('');
    setIsLoading(true);

    try {
      clearModuleAuth("delivery");
      const res = await deliveryAPI.sendOTP(cleaned, "login");

      const authData = {
        method: "phone",
        phone: cleaned,
        isSignUp: false,
        purpose: "login",
        module: "delivery",
      };
      localStorage.setItem("deliveryAuthData", JSON.stringify(authData));
      localStorage.setItem("delivery_draft_phone", cleaned);

      // Auto-populate static/dev OTP if returned in response (e.g. test phones)
      const serverOtp = res?.data?.data?.otp || res?.data?.otp;
      if (serverOtp && String(serverOtp).length === 6) {
        setOtpDigits(String(serverOtp).split(''));
      }

      setIsLoading(false);
      setCurrentScreen('OTP');
      setTimer(30);
      setIsTimerActive(true);
      setTimeout(() => inputRefs[0]?.current?.focus(), 300);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Failed to send verification code. Please try again.";
      triggerShake(msg);
      setIsLoading(false);
    }
  };

  // Handle OTP Digit Input
  const handleOtpChange = (index, val) => {
    const digitsOnly = val.replace(/\D/g, "");
    if (!digitsOnly && val !== "") return;

    const nextDigits = [...otpDigits];
    nextDigits[index] = digitsOnly.slice(-1);
    setOtpDigits(nextDigits);

    if (digitsOnly && index < 5) {
      inputRefs[index + 1]?.current?.focus();
    }
  };

  // Handle Backspace in OTP
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        inputRefs[index - 1]?.current?.focus();
      }
    }
  };

  // Handle Full Paste of 6-digit OTP
  const handlePaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasteData) return;

    const nextDigits = ['', '', '', '', '', ''];
    for (let i = 0; i < pasteData.length; i++) {
      nextDigits[i] = pasteData[i];
    }
    setOtpDigits(nextDigits);
    const nextFocusIndex = Math.min(pasteData.length, 5);
    inputRefs[nextFocusIndex]?.current?.focus();
  };

  // Verify OTP
  const handleVerifyOtp = async () => {
    const code = otpDigits.join('');
    if (code.length < 6) {
      triggerShake('Please enter the complete 6-digit verification code');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    const cleaned = phoneNumber.replace(/\D/g, "").slice(-10);

    try {
      let fcmToken = null;
      try {
        fcmToken = localStorage.getItem("delivery_fcm_token") || null;
      } catch (_) {}

      const res = await deliveryAPI.verifyOTP(cleaned, code, "login", "", fcmToken, "web");
      const authResData = res?.data?.data || res?.data || {};

      if (authResData.pendingApproval === true) {
        localStorage.removeItem("deliveryAuthData");
        setIsLoading(false);
        triggerShake(
          authResData.message ||
          (authResData.isRejected
            ? `Application rejected: ${authResData.rejectionReason || 'Contact support'}`
            : "Your account is pending admin verification. You will be notified once approved.")
        );
        return;
      }

      if (authResData.needsRegistration === true) {
        localStorage.removeItem("deliveryAuthData");
        localStorage.setItem("deliveryNeedsRegistration", "true");
        const details = {
          name: "",
          phone: cleaned,
          countryCode: "+91",
        };
        localStorage.setItem("deliverySignupDetails", JSON.stringify(details));
        setIsLoading(false);
        navigate("/food/delivery/signup/details", { replace: true });
        return;
      }

      const accessToken = authResData?.accessToken || authResData?.token;
      const user = authResData?.user;
      const refreshToken = authResData?.refreshToken || null;

      if (!accessToken || !user) {
        throw new Error("Invalid response from server");
      }

      // Store tokens and auth state properly
      storeAuthData("delivery", accessToken, user, refreshToken);
      window.dispatchEvent(new Event("deliveryAuthChanged"));

      // Register web push in background
      try {
        registerWebPushForCurrentModule("delivery").catch(() => {});
      } catch (_) {}

      setIsLoading(false);
      setCurrentScreen('SUCCESS');

      // Seamless navigate to delivery home
      setTimeout(() => {
        navigate('/food/delivery', { replace: true });
      }, 700);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Invalid verification code. Please check and try again.";
      triggerShake(msg);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0D13] text-white flex flex-col items-center justify-center p-3 sm:p-6 relative overflow-hidden font-sans selection:bg-orange-500/30 selection:text-orange-200">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.15, 0.25, 0.15],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-orange-600/30 rounded-full blur-[120px]"
        />
        <motion.div
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.1, 0.2, 0.1],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-amber-600/20 rounded-full blur-[130px]"
        />
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: `radial-gradient(circle at 1.5px 1.5px, #ffffff 1px, transparent 0)`,
            backgroundSize: '28px 28px',
          }}
        />
      </div>

      {/* Main Container Card Shell */}
      <div className="relative z-10 w-full max-w-[420px] transition-all duration-300">
        <div className="w-full bg-[#12161F] border border-neutral-800/80 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] relative overflow-hidden flex flex-col rounded-[36px] sm:rounded-[42px] ring-1 ring-white/10 shadow-[0_0_50px_rgba(249,115,22,0.1)]">

          {/* ========================================================= */}
          {/* 1. THE FLOATING ORANGE CURVED HEADER (From Figma Design) */}
          {/* ========================================================= */}
          <div className="relative w-full h-[250px] select-none overflow-hidden flex-shrink-0">
            {/* Morphing & Floating Orange Wave Container */}
            <motion.div
              animate={{
                y: [-6, 6, -6],
                rotate: [0, 0.8, -0.8, 0],
                scale: [1, 1.015, 1],
              }}
              transition={{
                duration: 5.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="absolute -top-[55px] -left-[20%] w-[140%] h-[340px] pointer-events-none"
            >
              <svg
                viewBox="0 0 500 400"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full h-full preserve-3d filter drop-shadow-[0_15px_30px_rgba(249,115,22,0.4)]"
              >
                <defs>
                  <linearGradient id="orangeGlowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FF7A00" />
                    <stop offset="45%" stopColor="#FF5500" />
                    <stop offset="100%" stopColor="#E03800" />
                  </linearGradient>
                  <linearGradient id="accentCurveGrad" x1="20%" y1="0%" x2="80%" y2="100%">
                    <stop offset="0%" stopColor="#FFA64D" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#FF5500" stopOpacity="0.1" />
                  </linearGradient>
                </defs>

                <motion.path
                  animate={{
                    d: [
                      "M0 0 H500 V230 C420 270 340 180 230 220 C130 255 60 320 0 300 Z",
                      "M0 0 H500 V240 C430 260 330 190 220 230 C120 270 50 310 0 310 Z",
                      "M0 0 H500 V230 C420 270 340 180 230 220 C130 255 60 320 0 300 Z"
                    ]
                  }}
                  transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
                  fill="url(#accentCurveGrad)"
                  opacity="0.3"
                />

                <motion.path
                  animate={{
                    d: [
                      "M0 0 H500 V160 C400 160 320 215 220 250 C120 285 50 340 0 350 Z",
                      "M0 0 H500 V170 C390 150 310 225 210 260 C110 295 40 330 0 360 Z",
                      "M0 0 H500 V160 C400 160 320 215 220 250 C120 285 50 340 0 350 Z",
                    ],
                  }}
                  transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                  fill="url(#orangeGlowGrad)"
                />

                <circle cx="90" cy="190" r="60" fill="white" fillOpacity="0.06" />
                <circle cx="340" cy="110" r="45" fill="white" fillOpacity="0.04" />
              </svg>
            </motion.div>

            {/* Ambient Delivery Micro Icons */}
            <motion.div
              animate={{ y: [-4, 6, -4], x: [-2, 3, -2], rotate: [0, 8, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute top-12 right-8 text-white/35 pointer-events-none"
            >
              <Package className="w-6 h-6 stroke-[1.5]" />
            </motion.div>

            <motion.div
              animate={{ y: [-5, 7, -5], scale: [1, 1.1, 1] }}
              transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
              className="absolute bottom-14 right-8 text-white/25 pointer-events-none"
            >
              <Navigation className="w-5 h-5 stroke-[1.5] rotate-45" />
            </motion.div>

            {/* Back Navigation Button */}
            {currentScreen !== 'LOGIN' && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => {
                  setCurrentScreen('LOGIN');
                  setErrorMessage('');
                }}
                className="absolute top-10 left-6 z-20 w-9 h-9 rounded-full bg-black/30 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:bg-black/50 transition-colors shadow-md cursor-pointer"
                title="Go back"
              >
                <ChevronLeft className="w-5 h-5" />
              </motion.button>
            )}

            {/* Brand Title & Logo */}
            <div className="absolute top-10 left-6 z-10 max-w-[260px]">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white mb-2 shadow-lg shadow-black/10 overflow-hidden"
              >
                <img src={logoUrl} alt="Jharkhand Rasoi" className="w-9 h-9 object-contain" />
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="text-xl font-black tracking-tight text-white leading-tight drop-shadow-sm font-sans"
              >
                Jharkhand Rasoi<br />
                <span className="text-orange-100 font-extrabold text-base">Delivery Partner</span>
              </motion.h2>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-[11px] text-orange-100/90 font-medium tracking-wide mt-0.5 drop-shadow-xs"
              >
                Drive, Deliver &amp; Earn on schedule
              </motion.p>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 2. BODY CONTENT: SCREENS (LOGIN -> OTP -> SUCCESS) */}
          {/* ========================================================= */}
          <div className="px-6 pb-6 pt-1 flex-1 flex flex-col justify-between relative z-10">
            <AnimatePresence mode="wait">
              
              {/* SCREEN 1: PHONE NUMBER INPUT */}
              {currentScreen === 'LOGIN' && (
                <motion.div
                  key="screen-login"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-4"
                >
                  <div className="space-y-0.5">
                    <h3 className="text-base font-bold text-white tracking-tight">
                      Partner Sign In
                    </h3>
                    <p className="text-xs text-neutral-400">
                      Enter your mobile number to sign in or register
                    </p>
                  </div>

                  {/* Phone Input with Animated Error Shake */}
                  <motion.form
                    onSubmit={handleSendOtp}
                    animate={errorShake ? { x: [-10, 10, -8, 8, -4, 4, 0] } : {}}
                    transition={{ duration: 0.4 }}
                    className="space-y-4"
                  >
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider flex items-center justify-between">
                        <span>Mobile Number</span>
                        <span className="text-emerald-400 font-normal lowercase flex items-center gap-1 text-[10px]">
                          <Zap className="w-2.5 h-2.5" /> Instant OTP
                        </span>
                      </label>

                      <div className="flex items-center rounded-2xl bg-[#090C12] border border-neutral-800 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20 transition-all p-1 shadow-inner">
                        {/* Country Code Pill */}
                        <div className="flex items-center space-x-1.5 px-3 py-2 bg-[#161B24] border-r border-neutral-800 rounded-xl text-neutral-200 text-xs font-semibold">
                          <span className="font-bold">+91</span>
                        </div>

                        {/* Clean Number Input: Digits only, max 10 */}
                        <input
                          type="tel"
                          inputMode="numeric"
                          maxLength={10}
                          placeholder="Enter 10-digit number"
                          value={phoneNumber}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                            setPhoneNumber(val);
                            if (errorMessage) setErrorMessage('');
                          }}
                          className="w-full bg-transparent px-3 py-2.5 text-base text-white placeholder-neutral-600 focus:outline-none font-bold tracking-wider"
                          autoFocus
                        />
                      </div>
                    </div>

                    {/* SOLID COLOR ERROR ALERT */}
                    {errorMessage && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="flex items-center space-x-2 text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 px-3 py-2.5 rounded-xl font-medium"
                      >
                        <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                        <span>{errorMessage}</span>
                      </motion.div>
                    )}

                    {/* SEND OTP BUTTON */}
                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      disabled={isLoading || phoneNumber.replace(/\D/g, "").length < 10}
                      className="w-full relative group overflow-hidden rounded-2xl py-3.5 px-4 bg-gradient-to-r from-[#FF6600] to-[#FF4500] font-bold text-white text-sm shadow-lg shadow-orange-600/30 hover:shadow-orange-600/50 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? (
                        <div className="flex items-center space-x-2">
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>Sending Verification Code...</span>
                        </div>
                      ) : (
                        <>
                          <span>SEND OTP</span>
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </motion.button>
                  </motion.form>
                </motion.div>
              )}

              {/* SCREEN 2: 6-DIGIT OTP VERIFICATION */}
              {currentScreen === 'OTP' && (
                <motion.div
                  key="screen-otp"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-4"
                >
                  <div className="space-y-0.5">
                    <h3 className="text-base font-bold text-white tracking-tight">
                      Verify OTP
                    </h3>
                    <p className="text-xs text-neutral-400">
                      Enter the 6-digit code sent to{' '}
                      <span className="text-neutral-200 font-semibold">+91 {phoneNumber}</span>
                    </p>
                  </div>

                  {/* 6 Digit Input Boxes */}
                  <motion.div
                    animate={errorShake ? { x: [-10, 10, -8, 8, -4, 4, 0] } : {}}
                    transition={{ duration: 0.4 }}
                    className="space-y-3.5"
                  >
                    <div className="flex justify-between items-center gap-1.5 my-1" onPaste={handlePaste}>
                      {otpDigits.map((digit, idx) => (
                        <input
                          key={idx}
                          ref={inputRefs[idx]}
                          type="tel"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(idx, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(idx, e)}
                          className={`w-11 h-14 text-center text-xl font-extrabold rounded-2xl bg-[#090C12] border transition-all duration-200 outline-none ${
                            digit
                              ? 'border-orange-500 text-orange-400 shadow-[0_0_12px_rgba(255,102,0,0.25)] ring-1 ring-orange-500/50'
                              : 'border-neutral-800 text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20'
                          }`}
                        />
                      ))}
                    </div>

                    {/* SOLID COLOR ERROR ALERT */}
                    {errorMessage && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center justify-center space-x-1.5 text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 py-2.5 px-3 rounded-xl font-medium"
                      >
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{errorMessage}</span>
                      </motion.div>
                    )}

                    {/* Countdown and Resend */}
                    <div className="flex items-center justify-between text-xs px-1 text-neutral-400">
                      <div className="flex items-center space-x-1.5">
                        <Clock className="w-3.5 h-3.5 text-neutral-500" />
                        <span>
                          Resend in{' '}
                          <span className="font-mono text-neutral-200">
                            00:{timer < 10 ? `0${timer}` : timer}
                          </span>
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={isTimerActive || isLoading}
                        className={`font-semibold transition-colors ${
                          isTimerActive
                            ? 'text-neutral-600 cursor-not-allowed'
                            : 'text-orange-400 hover:text-orange-300 underline underline-offset-2 cursor-pointer'
                        }`}
                      >
                        Resend Code
                      </button>
                    </div>

                    {/* VERIFY BUTTON */}
                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleVerifyOtp}
                      disabled={isLoading || otpDigits.join('').length < 6}
                      className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#00D084] to-[#00A86B] font-bold text-black text-sm shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? (
                        <div className="flex items-center space-x-2">
                          <Loader2 className="w-4 h-4 animate-spin text-black" />
                          <span>Verifying Passcode...</span>
                        </div>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                          <span>VERIFY &amp; CONTINUE</span>
                        </>
                      )}
                    </motion.button>
                  </motion.div>
                </motion.div>
              )}

              {/* SCREEN 3: VERIFIED TRANSITION */}
              {currentScreen === 'SUCCESS' && (
                <motion.div
                  key="screen-success"
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4 py-4 text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.25, 1] }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center mx-auto text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.35)]"
                  >
                    <Check className="w-8 h-8 stroke-[3]" />
                  </motion.div>

                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-white tracking-tight">
                      Authentication Successful
                    </h3>
                    <p className="text-xs text-neutral-400">
                      Redirecting to Delivery Partner Dashboard...
                    </p>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>

            {/* Bottom Footer Info */}
            <div className="pt-4 border-t border-neutral-800/60 mt-4">
              <div className="flex items-center justify-between text-[11px] text-neutral-400">
                <span className="flex items-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Encrypted Login</span>
                </span>
                <Link
                  to="/food/delivery/support"
                  className="flex items-center space-x-1 hover:text-white transition-colors"
                >
                  <Headphones className="w-3.5 h-3.5 text-orange-400" />
                  <span>24/7 Support</span>
                </Link>
              </div>

              <p className="text-[10px] text-neutral-500 text-center mt-2.5 leading-relaxed">
                By continuing, you agree to Jharkhand Rasoi Partner{' '}
                <Link to="/food/delivery/profile/terms" className="text-neutral-400 underline hover:text-white">Terms</Link>
                {' & '}
                <Link to="/food/delivery/profile/privacy" className="text-neutral-400 underline hover:text-white">Privacy Policy</Link>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
