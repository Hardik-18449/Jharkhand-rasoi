import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  Bike,
  CreditCard,
  FileText,
  PhoneCall,
  Headphones,
  ShieldCheck,
  ChevronRight,
  LogOut,
  Star,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowLeft,
  Share2
} from "lucide-react";
import { deliveryAPI } from "@food/api";
import { API_BASE_URL } from "@food/api/config";
import { toast } from "sonner";
import { clearModuleAuth } from "@food/utils/auth";
import { registerWebPushForCurrentModule } from "@food/utils/firebaseMessaging";

export const ProfileV2 = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [logoutSubmitting, setLogoutSubmitting] = useState(false);

  const normalizeImageUrl = (imageUrl) => {
    if (typeof imageUrl !== 'string' || !imageUrl) return '';
    if (imageUrl.startsWith('http')) return imageUrl;
    
    let backendOrigin = '';
    if (API_BASE_URL && API_BASE_URL.startsWith('http')) {
       backendOrigin = API_BASE_URL.replace(/\/api(\/v\d+)?\/?$/i, '').replace(/\/+$/, '');
    } else if (typeof window !== 'undefined') {
       backendOrigin = window.location.origin;
    } else {
       backendOrigin = 'http://localhost:5000';
    }
    
    return `${backendOrigin}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
  };

  useEffect(() => {
    registerWebPushForCurrentModule("/food/delivery").catch(() => {});
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const response = await deliveryAPI.getProfile();
        if (response?.data?.success && response?.data?.data?.profile) {
          setProfile(response.data.data.profile);
        }
      } catch (error) {
        toast.error("Failed to load profile data");
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleLogout = async () => {
    if (logoutSubmitting) return;
    setShowLogoutConfirm(false);
    try {
      setLogoutSubmitting(true);
      let fcmToken = localStorage.getItem("fcm_web_registered_token_delivery") || null;
      await deliveryAPI.logout(null, fcmToken, "web").catch(() => {});
    } catch (_) {}
    clearModuleAuth("delivery");
    localStorage.removeItem("app:isOnline");
    toast.success("Logged out successfully");
    navigate("/food/delivery/login", { replace: true });
    setLogoutSubmitting(false);
  };

  const partnerId = profile?._id 
    ? `JR-${String(profile._id).slice(-6).toUpperCase()}` 
    : (profile?.id ? `JR-${String(profile.id).slice(-6).toUpperCase()}` : "JR-DP");

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FB] flex flex-col items-center justify-center font-sans">
        <div className="w-10 h-10 border-4 border-[#FF5500] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-bold text-gray-500">Loading Profile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FB] pb-32 font-sans text-gray-900 scrollbar-hide">
      
      {/* 1. FIGMA PROFILE HERO HEADER (Orange Curved Gradient) */}
      <div className="relative bg-gradient-to-b from-[#FF5500] to-[#E64A00] text-white pt-8 pb-14 px-6 rounded-b-[36px] shadow-lg shadow-orange-500/15 overflow-hidden">
        {/* Background Ambient circles */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none -mr-16 -mt-16" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full blur-xl pointer-events-none -ml-12 -mb-12" />

        <div className="relative z-10 flex items-center justify-between mb-6">
          <button 
            onClick={() => navigate('/food/delivery/feed')}
            className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-black tracking-tight text-white">Profile</h1>
          <div className="w-9 h-9" /> {/* Spacer */}
        </div>

        {/* Rider Avatar + Name + Partner ID */}
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="relative mb-3">
            <div className="w-22 h-22 rounded-full p-1 bg-white/30 backdrop-blur-md shadow-xl">
              <img
                src={normalizeImageUrl(profile?.profileImage || profile?.profilePhoto) || "/delivery_avatar.png"}
                alt={profile?.name || "Delivery Partner"}
                className="w-full h-full rounded-full object-cover bg-white"
                onError={(e) => {
                  e.target.src = "https://cdn-icons-png.flaticon.com/512/2950/2950150.png";
                }}
              />
            </div>
            <div className="absolute bottom-1 right-1 w-5 h-5 bg-emerald-500 border-2 border-white rounded-full" title="Active" />
          </div>

          <h2 className="text-xl font-black text-white leading-tight">
            {profile?.name || "Jharkhand Rasoi Partner"}
          </h2>
          <p className="text-xs font-semibold text-orange-100/90 mt-0.5 tracking-wider uppercase">
            {partnerId} • {profile?.phone || "+91 8000000000"}
          </p>
        </div>

        {/* 3 Metric Stats Capsules (Figma) */}
        <div className="relative z-10 grid grid-cols-3 gap-2.5 mt-6 max-w-sm mx-auto">
          <div className="bg-white/15 backdrop-blur-md rounded-2xl py-2.5 px-3 text-center border border-white/20">
            <div className="flex items-center justify-center gap-1 text-amber-300 font-black text-sm">
              <Star className="w-3.5 h-3.5 fill-current" />
              <span>{profile?.rating ? Number(profile.rating).toFixed(1) : "4.8"}</span>
            </div>
            <span className="text-[10px] text-white/80 font-bold uppercase tracking-wider block mt-0.5">Rating</span>
          </div>

          <div className="bg-white/15 backdrop-blur-md rounded-2xl py-2.5 px-3 text-center border border-white/20">
            <p className="font-black text-sm text-white">
              {profile?.totalOrders || profile?.deliveredOrdersCount || "120+"}
            </p>
            <span className="text-[10px] text-white/80 font-bold uppercase tracking-wider block mt-0.5">Trips</span>
          </div>

          <div className="bg-white/15 backdrop-blur-md rounded-2xl py-2.5 px-3 text-center border border-white/20">
            <p className="font-black text-sm text-emerald-300">
              {profile?.onTimeDeliveryRate ? `${profile.onTimeDeliveryRate}%` : "98%"}
            </p>
            <span className="text-[10px] text-white/80 font-bold uppercase tracking-wider block mt-0.5">On-Time</span>
          </div>
        </div>
      </div>

      {/* 2. SETTINGS & OPTIONS LIST (Figma Clean Cards) */}
      <div className="px-4 sm:px-6 -mt-6 relative z-20 space-y-3 max-w-md mx-auto">

        {/* Personal Details */}
        <div 
          onClick={() => navigate("/food/delivery/profile/details")}
          className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-all hover:border-orange-200"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#FF5500] flex items-center justify-center font-bold">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900">Personal Information</h4>
              <p className="text-[11px] text-gray-400 font-medium">Name, phone, email & city</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-300" />
        </div>

        {/* Vehicle Details */}
        <div 
          onClick={() => navigate("/food/delivery/profile/details")}
          className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-all hover:border-orange-200"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Bike className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900">Vehicle Details</h4>
              <p className="text-[11px] text-gray-400 font-medium">
                {profile?.vehicleType ? `${profile.vehicleType.toUpperCase()} • ${profile?.vehicleNumber || 'Registered'}` : 'Motorcycle / Electric'}
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-300" />
        </div>

        {/* Bank & Payouts */}
        <div 
          onClick={() => navigate("/food/delivery/profile/bank")}
          className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-all hover:border-orange-200"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900">Bank &amp; Payouts</h4>
              <p className="text-[11px] text-gray-400 font-medium">Bank account, IFSC &amp; UPI</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-300" />
        </div>

        {/* Document Verification */}
        <div 
          onClick={() => navigate("/food/delivery/profile/docs")}
          className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-all hover:border-orange-200"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-gray-900">Document Verification</h4>
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">Verified</span>
              </div>
              <p className="text-[11px] text-gray-400 font-medium">Aadhaar, DL &amp; RC Book</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-300" />
        </div>

        {/* 24/7 Helpline & Support */}
        <div 
          onClick={() => navigate("/food/delivery/support")}
          className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-all hover:border-orange-200"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900">24/7 Partner Support</h4>
              <p className="text-[11px] text-gray-400 font-medium">Helpline, tickets &amp; order issues</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-300" />
        </div>

        {/* Terms & Privacy */}
        <div 
          onClick={() => navigate("/food/delivery/profile/terms")}
          className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-all hover:border-orange-200"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-gray-50 text-gray-600 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900">Terms &amp; Privacy Policy</h4>
              <p className="text-[11px] text-gray-400 font-medium">Delivery terms and legal notice</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-300" />
        </div>

        {/* Log Out Button */}
        <div className="pt-2">
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full bg-rose-50 border border-rose-100 hover:bg-rose-100/60 rounded-2xl p-4 flex items-center justify-between text-rose-600 font-bold text-sm transition-colors cursor-pointer active:scale-[0.99]"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-100/80 text-rose-600 flex items-center justify-center font-bold">
                <LogOut className="w-5 h-5" />
              </div>
              <span className="font-bold">Log Out</span>
            </div>
            <ChevronRight className="w-5 h-5 text-rose-400" />
          </button>
        </div>

        {/* Version & Build */}
        <p className="text-center text-[10px] font-semibold text-gray-400 pt-3 pb-6">
          Jharkhand Rasoi Delivery Partner v2.4 • Secured
        </p>

      </div>

      {/* Logout Confirmation Dialog */}
      {showLogoutConfirm && (
        <div 
          className="fixed inset-0 bg-black/60 z-[1000] flex items-center justify-center px-4"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div 
            className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 text-center border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-100">
              <LogOut className="w-7 h-7" />
            </div>
            <h3 className="text-base font-black text-gray-900 mb-1">Confirm Log Out</h3>
            <p className="text-xs text-gray-500 mb-6">Are you sure you want to sign out of your delivery partner account?</p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 h-12 rounded-2xl border border-gray-200 text-gray-700 font-bold text-sm active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                disabled={logoutSubmitting}
                className="flex-1 h-12 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-lg shadow-rose-600/30 active:scale-95 transition-all disabled:opacity-60"
              >
                {logoutSubmitting ? "Logging out..." : "Log Out"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ProfileV2;
