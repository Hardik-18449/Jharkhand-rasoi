import React, { useState, useEffect } from "react";
import {
  Award,
  Crown,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Users,
  ShieldCheck,
  TrendingUp,
  Search,
  RefreshCw,
  AlertCircle,
  Check,
  Percent,
  Truck,
  Flame,
  ArrowRight,
  Star,
} from "lucide-react";
import { adminAPI } from "@food/api";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@food/components/ui/dialog";

const COLOR_PRESETS = [
  { name: "Gold", value: "#F59E0B" },
  { name: "Platinum Blue", value: "#3B82F6" },
  { name: "Emerald", value: "#10B981" },
  { name: "Purple Royal", value: "#8B5CF6" },
  { name: "Rose", value: "#F43F5E" },
];

export default function SubscriptionPlans() {
  const [activeTab, setActiveTab] = useState("plans"); // "plans" | "subscribers"
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subscribers, setSubscribers] = useState([]);
  const [loadingSubscribers, setLoadingSubscribers] = useState(false);
  const [subscribersPage, setSubscribersPage] = useState(1);
  const [subscribersTotalPages, setSubscribersTotalPages] = useState(1);
  const [subscriberSearch, setSubscriberSearch] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    badgeText: "VIP",
    badgeColor: "#F59E0B",
    price: "",
    originalPrice: "",
    durationDays: 30,
    priorityLevel: 1,
    freeDeliveryMinOrder: 149,
    discountPercent: 10,
    features: [
      "Priority Kitchen Cooking - Order Prepared First",
      "VIP Golden Badge on Profile & Orders",
      "Free Delivery on orders above ₹149",
      "Dedicated 24/7 VIP Customer Support"
    ],
    isActive: true,
    isPopular: false,
  });

  const [newFeatureText, setNewFeatureText] = useState("");

  useEffect(() => {
    fetchPlans();
  }, []);

  useEffect(() => {
    if (activeTab === "subscribers") {
      fetchSubscribers(subscribersPage);
    }
  }, [activeTab, subscribersPage]);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const res = await adminAPI.getSubscriptionPlans();
      const planData = res?.data?.data || res?.data || [];
      setPlans(Array.isArray(planData) ? planData : []);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load subscription plans");
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscribers = async (page = 1) => {
    try {
      setLoadingSubscribers(true);
      const res = await adminAPI.getSubscribers({ page, limit: 20 });
      const data = res?.data?.data || [];
      setSubscribers(Array.isArray(data) ? data : []);
      setSubscribersTotalPages(res?.data?.pagination?.totalPages || 1);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load subscribers");
    } finally {
      setLoadingSubscribers(false);
    }
  };

  const openCreateModal = () => {
    setEditingPlan(null);
    setFormData({
      name: "",
      description: "",
      badgeText: "VIP",
      badgeColor: "#F59E0B",
      price: "",
      originalPrice: "",
      durationDays: 30,
      priorityLevel: 1,
      freeDeliveryMinOrder: 149,
      discountPercent: 10,
      features: [
        "Priority Kitchen Cooking - Order Prepared First",
        "VIP Golden Badge on Profile & Orders",
        "Free Delivery on orders above ₹149",
        "Dedicated 24/7 VIP Customer Support"
      ],
      isActive: true,
      isPopular: false,
    });
    setNewFeatureText("");
    setIsModalOpen(true);
  };

  const openEditModal = (plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name || "",
      description: plan.description || "",
      badgeText: plan.badgeText || "VIP",
      badgeColor: plan.badgeColor || "#F59E0B",
      price: plan.price ?? "",
      originalPrice: plan.originalPrice ?? "",
      durationDays: plan.durationDays || 30,
      priorityLevel: plan.priorityLevel || 1,
      freeDeliveryMinOrder: plan.freeDeliveryMinOrder || 0,
      discountPercent: plan.discountPercent || 0,
      features: Array.isArray(plan.features) && plan.features.length > 0 ? [...plan.features] : [],
      isActive: plan.isActive !== false,
      isPopular: Boolean(plan.isPopular),
    });
    setNewFeatureText("");
    setIsModalOpen(true);
  };

  const handleTogglePopular = async (planId) => {
    try {
      const res = await adminAPI.togglePopularSubscriptionPlan(planId);
      toast.success(res?.data?.message || "Popular status updated");
      fetchPlans();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update popular status");
    }
  };

  const handleToggleStatus = async (planId) => {
    try {
      const res = await adminAPI.toggleSubscriptionPlan(planId);
      toast.success(res?.data?.message || "Status updated");
      fetchPlans();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update status");
    }
  };

  const handleDeletePlan = async (planId, name) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      const res = await adminAPI.deleteSubscriptionPlan(planId);
      toast.success(res?.data?.message || "Plan deleted successfully");
      fetchPlans();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete plan");
    }
  };

  const handleAddFeature = () => {
    const text = newFeatureText.trim();
    if (!text) return;
    setFormData((prev) => ({
      ...prev,
      features: [...prev.features, text],
    }));
    setNewFeatureText("");
  };

  const handleRemoveFeature = (index) => {
    setFormData((prev) => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index),
    }));
  };

  const handleSavePlan = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Plan name is required");
      return;
    }
    if (formData.price === "" || Number(formData.price) < 0) {
      toast.error("Valid plan price is required");
      return;
    }

    try {
      setIsSaving(true);
      const payload = {
        ...formData,
        price: Number(formData.price),
        originalPrice: Number(formData.originalPrice) || 0,
        durationDays: Number(formData.durationDays),
        priorityLevel: Number(formData.priorityLevel),
        freeDeliveryMinOrder: Number(formData.freeDeliveryMinOrder) || 0,
        discountPercent: Number(formData.discountPercent) || 0,
        isPopular: Boolean(formData.isPopular),
      };

      if (editingPlan) {
        await adminAPI.updateSubscriptionPlan(editingPlan._id, payload);
        toast.success("Subscription plan updated successfully");
      } else {
        await adminAPI.createSubscriptionPlan(payload);
        toast.success("Subscription plan created successfully");
      }
      setIsModalOpen(false);
      fetchPlans();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save plan");
    } finally {
      setIsSaving(false);
    }
  };

  // Stats calculation
  const totalPlans = plans.length;
  const activePlansCount = plans.filter((p) => p.isActive).length;
  const filteredSubscribers = subscribers.filter((s) => {
    if (!subscriberSearch.trim()) return true;
    const q = subscriberSearch.toLowerCase();
    return (
      s.userId?.name?.toLowerCase().includes(q) ||
      s.userId?.phone?.toLowerCase().includes(q) ||
      s.planName?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-white shadow-md shadow-amber-500/20">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                VIP Subscription Plans
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 font-medium">
                Create customer membership tiers with automatic high kitchen priority.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (activeTab === "plans") fetchPlans();
              else fetchSubscribers(subscribersPage);
            }}
            className="p-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-bold text-sm shadow-md hover:bg-primary/95 transition active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Add New Plan
          </button>
        </div>
      </div>

      {/* Highlights / Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Crown className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-gray-900">{totalPlans}</div>
            <div className="text-xs font-semibold text-gray-500">Total Plans Created</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-gray-900">{activePlansCount}</div>
            <div className="text-xs font-semibold text-gray-500">Active Live Plans</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-gray-900">{subscribers.length}</div>
            <div className="text-xs font-semibold text-gray-500">Subscribed VIP Users</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-yellow-500 rounded-2xl p-4 text-white shadow-md shadow-amber-500/15 flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
            <Flame className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="text-base font-black uppercase tracking-wide">Kitchen Priority</div>
            <div className="text-xs font-medium text-amber-100">VIP orders served 1st</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab("plans")}
          className={`pb-3 px-4 font-bold text-sm transition-colors relative ${
            activeTab === "plans" ? "text-primary" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Membership Plans ({plans.length})
          {activeTab === "plans" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />
          )}
        </button>

        <button
          onClick={() => setActiveTab("subscribers")}
          className={`pb-3 px-4 font-bold text-sm transition-colors relative ${
            activeTab === "subscribers" ? "text-primary" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Subscribed Customers ({subscribers.length})
          {activeTab === "subscribers" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />
          )}
        </button>
      </div>

      {/* TAB 1: SUBSCRIPTION PLANS */}
      {activeTab === "plans" && (
        <div>
          {loading ? (
            <div className="py-20 text-center">
              <RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
              <p className="text-gray-500 text-sm font-medium">Loading subscription plans...</p>
            </div>
          ) : plans.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center shadow-sm">
              <Crown className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-gray-900 mb-1">No Subscription Plans Found</h3>
              <p className="text-xs text-gray-500 mb-4 max-w-sm mx-auto">
                Create subscription tiers so your customers can enjoy VIP treatment and automatic kitchen queue priority.
              </p>
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold"
              >
                <Plus className="h-3.5 w-3.5" />
                Create First Plan
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <div
                  key={plan._id}
                  className={`bg-white rounded-3xl border transition-all duration-200 shadow-sm hover:shadow-md overflow-hidden flex flex-col ${
                    plan.isPopular
                      ? "border-amber-400 ring-2 ring-amber-200"
                      : plan.isActive ? "border-gray-200" : "border-gray-200 opacity-60 bg-gray-50/50"
                  }`}
                >
                  {plan.isPopular && (
                    <div className="bg-gradient-to-r from-amber-500 to-yellow-500 text-black text-[10px] font-black uppercase text-center py-1 tracking-wider">
                      Most Popular Choice
                    </div>
                  )}
                  {/* Plan Top Banner */}
                  <div
                    className="p-5 text-white flex items-center justify-between"
                    style={{
                      backgroundColor: plan.badgeColor || "#F59E0B",
                    }}
                  >
                    <div>
                      <span className="inline-block text-[11px] font-black uppercase tracking-wider bg-black/25 px-2.5 py-0.5 rounded-full mb-1.5">
                        {plan.badgeText || "VIP"}
                      </span>
                      <h3 className="text-lg font-black">{plan.name}</h3>
                    </div>

                    <div className="text-right">
                      <div className="text-2xl font-black">₹{plan.price}</div>
                      {plan.originalPrice > plan.price && (
                        <div className="text-xs line-through opacity-80">
                          ₹{plan.originalPrice}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Plan Body */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      {plan.description && (
                        <p className="text-xs text-gray-500 mb-4">{plan.description}</p>
                      )}

                      {/* Quick Meta Pills */}
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        <div className="bg-amber-50 rounded-xl p-2.5 border border-amber-100/60">
                          <div className="flex items-center gap-1.5 text-amber-700 text-[11px] font-bold">
                            <Flame className="h-3.5 w-3.5" />
                            Kitchen Priority
                          </div>
                          <div className="text-xs font-black text-amber-900 mt-0.5">
                            Rank #{plan.priorityLevel || 1} (Serve First)
                          </div>
                        </div>

                        <div className="bg-blue-50 rounded-xl p-2.5 border border-blue-100/60">
                          <div className="flex items-center gap-1.5 text-blue-700 text-[11px] font-bold">
                            <Clock className="h-3.5 w-3.5" />
                            Duration
                          </div>
                          <div className="text-xs font-black text-blue-900 mt-0.5">
                            {plan.durationDays} Days
                          </div>
                        </div>
                      </div>

                      {/* Free Delivery & Discount Tag */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        {plan.freeDeliveryMinOrder === 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-50 text-green-700 border border-green-200 text-[11px] font-bold">
                            <Truck className="h-3 w-3" />
                            Unlimited Free Delivery
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-50 text-green-700 border border-green-200 text-[11px] font-bold">
                            <Truck className="h-3 w-3" />
                            Free Delivery &gt; ₹{plan.freeDeliveryMinOrder}
                          </span>
                        )}

                        {plan.discountPercent > 0 && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 text-[11px] font-bold">
                            <Percent className="h-3 w-3" />
                            {plan.discountPercent}% VIP Discount
                          </span>
                        )}
                      </div>

                      {/* Features List */}
                      <div className="space-y-2 pt-2 border-t border-gray-100">
                        <div className="text-[11px] font-black uppercase text-gray-400 tracking-wider">
                          Included Perks
                        </div>
                        {plan.features?.map((feat, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs text-gray-700">
                            <Check className="h-3.5 w-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
                            <span>{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(plan._id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                            plan.isActive
                              ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {plan.isActive ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Active
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3.5 w-3.5" />
                              Inactive
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTogglePopular(plan._id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                            plan.isPopular
                              ? "bg-amber-100 text-amber-900 border border-amber-300"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                          }`}
                          title={plan.isPopular ? "Currently Most Popular Choice (Click to unset)" : "Set as Most Popular Choice"}
                        >
                          <Star className={`h-3.5 w-3.5 ${plan.isPopular ? "fill-amber-500 text-amber-500" : ""}`} />
                          {plan.isPopular ? "Popular" : "Set Popular"}
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openEditModal(plan)}
                          className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition"
                          title="Edit Plan"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePlan(plan._id, plan.name)}
                          className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 transition"
                          title="Delete Plan"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SUBSCRIBED CUSTOMERS */}
      {activeTab === "subscribers" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Subscriber Search Bar */}
          <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search subscriber by name, phone or plan..."
                value={subscriberSearch}
                onChange={(e) => setSubscriberSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {loadingSubscribers ? (
            <div className="py-20 text-center">
              <RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
              <p className="text-gray-500 text-sm font-medium">Loading subscribed users...</p>
            </div>
          ) : filteredSubscribers.length === 0 ? (
            <div className="p-12 text-center text-gray-500 text-sm font-medium">
              No subscribed users found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50/75 border-b border-gray-100 text-gray-500 uppercase tracking-wider font-bold">
                  <tr>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Subscription Plan</th>
                    <th className="py-3 px-4">Priority Rank</th>
                    <th className="py-3 px-4">Price Paid</th>
                    <th className="py-3 px-4">Subscribed At</th>
                    <th className="py-3 px-4">Expires At</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                  {filteredSubscribers.map((sub) => {
                    const isExpired = new Date(sub.expiresAt) <= new Date();
                    return (
                      <tr key={sub._id} className="hover:bg-gray-50/50 transition">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-gray-900">{sub.userId?.name || "Customer"}</div>
                          <div className="text-[11px] text-gray-500">{sub.userId?.phone || "-"}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                            
                            {sub.planName}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 text-xs font-black text-amber-600">
                            <Flame className="h-3 w-3" />
                            Level {sub.priorityLevel || 1}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-gray-900">
                          ₹{sub.pricePaid}
                        </td>
                        <td className="py-3.5 px-4 text-gray-500">
                          {new Date(sub.startDate || sub.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={isExpired ? "text-rose-600 font-bold" : "text-gray-900"}>
                            {new Date(sub.expiresAt).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              isExpired
                                ? "bg-rose-50 text-rose-600 border border-rose-100"
                                : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                            }`}
                          >
                            {isExpired ? "Expired" : "Active VIP"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT PLAN MODAL */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-gray-900 flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              {editingPlan ? "Edit Subscription Plan" : "Create Subscription Plan"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSavePlan} className="space-y-4 pt-2">
            {/* Plan Name & Badge Text */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Plan Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. VIP Gold Pass"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Badge Text (Shown on Kitchen Orders)
                </label>
                <input
                  type="text"
                  placeholder="e.g. VIP Gold"
                  value={formData.badgeText}
                  onChange={(e) => setFormData({ ...formData, badgeText: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:outline-none"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Description
              </label>
              <input
                type="text"
                placeholder="Short tagline about the plan benefits"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:outline-none"
              />
            </div>

            {/* Price, Original Price, Duration */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Price (₹) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  placeholder="99"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Original / Strike Price (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="199"
                  value={formData.originalPrice}
                  onChange={(e) => setFormData({ ...formData, originalPrice: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Duration (Days) *
                </label>
                <select
                  value={formData.durationDays}
                  onChange={(e) => setFormData({ ...formData, durationDays: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:outline-none bg-white"
                >
                  <option value={7}>7 Days (1 Week)</option>
                  <option value={30}>30 Days (1 Month)</option>
                  <option value={90}>90 Days (3 Months)</option>
                  <option value={180}>180 Days (6 Months)</option>
                  <option value={365}>365 Days (1 Year)</option>
                </select>
              </div>
            </div>

            {/* Kitchen Priority & Badge Color */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                  <Flame className="h-3.5 w-3.5 text-amber-500" />
                  Kitchen Preparation Priority Level
                </label>
                <select
                  value={formData.priorityLevel}
                  onChange={(e) => setFormData({ ...formData, priorityLevel: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:outline-none bg-white"
                >
                  <option value={1}>Level 1 - VIP Priority (Served Before Normal)</option>
                  <option value={2}>Level 2 - High VIP Priority (Kitchen Top Queue)</option>
                  <option value={3}>Level 3 - Supreme Elite Priority (Immediate Cooking)</option>
                </select>
                <p className="text-[10px] text-gray-400 mt-1">
                  Higher levels automatically sort to the very top in restaurant POS and kitchen screens.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Badge Theme Color
                </label>
                <div className="flex items-center gap-2 mt-1">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, badgeColor: c.value })}
                      className={`h-7 w-7 rounded-full border-2 transition ${
                        formData.badgeColor === c.value
                          ? "border-gray-900 scale-110 shadow-sm"
                          : "border-transparent"
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    />
                  ))}
                  <input
                    type="color"
                    value={formData.badgeColor}
                    onChange={(e) => setFormData({ ...formData, badgeColor: e.target.value })}
                    className="h-7 w-7 rounded-lg cursor-pointer border border-gray-200"
                  />
                </div>
              </div>
            </div>

            {/* Delivery & Discount Thresholds */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Free Delivery Min Order (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="149 (0 = free on all orders)"
                  value={formData.freeDeliveryMinOrder}
                  onChange={(e) => setFormData({ ...formData, freeDeliveryMinOrder: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:outline-none"
                />
                <p className="text-[10px] text-gray-400 mt-1">Set 0 for unlimited free delivery without minimum.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Extra VIP Discount (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="10"
                  value={formData.discountPercent}
                  onChange={(e) => setFormData({ ...formData, discountPercent: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:outline-none"
                />
              </div>
            </div>

            {/* Features Bullet Points */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Plan Features / Perks
              </label>
              <div className="space-y-2 mb-2">
                {formData.features.map((feat, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded-xl border border-gray-200 text-xs"
                  >
                    <span className="flex items-center gap-2 text-gray-800">
                      <Check className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                      {feat}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFeature(idx)}
                      className="text-gray-400 hover:text-rose-500 p-1"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add another perk, e.g. Free Dessert on orders above ₹299"
                  value={newFeatureText}
                  onChange={(e) => setNewFeatureText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddFeature();
                    }
                  }}
                  className="flex-1 px-3.5 py-2 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddFeature}
                  className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition"
                >
                  Add Perk
                </button>
              </div>
            </div>

            {/* Active Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="h-4 w-4 text-primary rounded border-gray-300 focus:ring-primary"
                />
                <label htmlFor="isActive" className="text-xs font-bold text-gray-700 cursor-pointer">
                  Active
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isPopular"
                  checked={formData.isPopular}
                  onChange={(e) => setFormData({ ...formData, isPopular: e.target.checked })}
                  className="h-4 w-4 text-amber-500 rounded border-gray-300 focus:ring-amber-400"
                />
                <label htmlFor="isPopular" className="text-xs font-bold text-gray-700 cursor-pointer flex items-center gap-1.5">
                  <span>Feature as &quot;Most Popular Choice&quot;</span>
                  <span className="text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-semibold">
                    Highlights on user app
                  </span>
                </label>
              </div>
            </div>

            {/* Modal Actions */}
            <DialogFooter className="pt-4 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 bg-primary text-white rounded-xl text-xs font-bold shadow-md hover:bg-primary/95 transition disabled:opacity-50"
              >
                {isSaving ? "Saving..." : editingPlan ? "Update Plan" : "Create Plan"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
