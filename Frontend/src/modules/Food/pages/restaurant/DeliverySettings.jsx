import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import { motion, AnimatePresence } from "framer-motion"
import useRestaurantLenis from "@food/hooks/useRestaurantLenis"
import {
  ArrowLeft,
  Truck,
  CheckCircle,
  AlertCircle,
  Plus,
  Trash2,
  Phone,
  Bike,
  Users,
  Radio,
  ShieldCheck,
  RefreshCw,
  Info
} from "lucide-react"
import { Switch } from "@food/components/ui/switch"
import { Card, CardContent } from "@food/components/ui/card"
import { restaurantAPI } from "@food/api"
import RestaurantModal from "@food/components/restaurant/RestaurantModal"

const debugError = (...args) => {}

const DELIVERY_STATUS_KEY = "restaurant_delivery_status"
const RESTAURANT_ONLINE_STATUS_KEY = "restaurant_online_status"

export default function DeliverySettings() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()

  // Accepting orders status
  const [deliveryStatus, setDeliveryStatus] = useState(false)
  const [showWarning, setShowWarning] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingStatus, setPendingStatus] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)

  // Dedicated delivery settings
  const [openForPublicDelivery, setOpenForPublicDelivery] = useState(true)
  const [dedicatedRiders, setDedicatedRiders] = useState([])
  const [loadingDedicated, setLoadingDedicated] = useState(false)
  const [savingDispatchToggle, setSavingDispatchToggle] = useState(false)

  // Add rider modal & form state
  const [showAddRiderModal, setShowAddRiderModal] = useState(false)
  const [addingRider, setAddingRider] = useState(false)
  const [riderForm, setRiderForm] = useState({
    name: "",
    phone: "",
    vehicleType: "Motorcycle",
    vehicleNumber: "",
  })

  // Delete rider confirmation
  const [riderToDelete, setRiderToDelete] = useState(null)
  const [deletingRider, setDeletingRider] = useState(false)

  // Feedback Toast
  const [showSuccessToast, setShowSuccessToast] = useState(false)
  const [toastMessage, setToastMessage] = useState("")

  const showToast = (message) => {
    setToastMessage(message)
    setShowSuccessToast(true)
    setTimeout(() => setShowSuccessToast(false), 3500)
  }

  // Native smooth scrolling within RestaurantLayout
  useRestaurantLenis()

  const syncStatusLocally = (status) => {
    const value = Boolean(status)
    try {
      localStorage.setItem(DELIVERY_STATUS_KEY, JSON.stringify(value))
      localStorage.setItem(RESTAURANT_ONLINE_STATUS_KEY, JSON.stringify(value))
    } catch (error) {
      debugError("Error saving delivery status locally:", error)
    }
    window.dispatchEvent(
      new CustomEvent("restaurantStatusChanged", {
        detail: { isOnline: value },
      })
    )
  }

  // Load basic restaurant status & dedicated delivery overview
  const loadDeliveryOverview = useCallback(async () => {
    try {
      setLoadingDedicated(true)
      const [restRes, dedicatedRes] = await Promise.all([
        restaurantAPI.getCurrentRestaurant().catch(() => null),
        restaurantAPI.getDedicatedRiders().catch(() => null),
      ])

      const restaurant =
        restRes?.data?.data?.restaurant || restRes?.data?.restaurant || null
      if (restaurant) {
        const nextStatus = restaurant?.isAcceptingOrders === true
        setDeliveryStatus(nextStatus)
        syncStatusLocally(nextStatus)
      }

      if (dedicatedRes?.data?.success) {
        const data = dedicatedRes.data.data || {}
        setDedicatedRiders(data.riders || [])
        setOpenForPublicDelivery(data.deliverySettings?.openForPublicDelivery !== false)
      }
    } catch (err) {
      debugError("Error loading delivery settings:", err)
    } finally {
      setLoadingDedicated(false)
    }
  }, [])

  useEffect(() => {
    loadDeliveryOverview()
  }, [loadDeliveryOverview])

  // Toggle order acceptance status
  const handleDeliveryStatusChange = (checked) => {
    if (savingStatus) return
    if (!checked && deliveryStatus) {
      setPendingStatus(checked)
      setShowConfirmDialog(true)
      return
    }
    void saveDeliveryStatusToBackend(checked)
  }

  const saveDeliveryStatusToBackend = async (status) => {
    const previousStatus = deliveryStatus
    const nextStatus = Boolean(status)
    try {
      setSavingStatus(true)
      setDeliveryStatus(nextStatus)
      syncStatusLocally(nextStatus)
      await restaurantAPI.updateAcceptingOrders(nextStatus)
      showToast(nextStatus ? "Delivery is ON - You're receiving orders" : "Delivery is OFF - Not receiving orders")
    } catch (error) {
      setDeliveryStatus(previousStatus)
      syncStatusLocally(previousStatus)
      showToast(error?.response?.data?.message || "Error updating delivery status")
    } finally {
      setSavingStatus(false)
    }
  }

  // Toggle Public vs Dedicated dispatch mode
  const handleToggleDispatchMode = async (checked) => {
    if (savingDispatchToggle) return
    const prev = openForPublicDelivery
    try {
      setSavingDispatchToggle(true)
      setOpenForPublicDelivery(checked)
      const res = await restaurantAPI.updateDeliveryDispatchSettings({
        openForPublicDelivery: checked,
      })
      if (res?.data?.success) {
        showToast(
          checked
            ? "Open for All: Platform zone riders can now also receive orders"
            : "Dedicated Only: Orders are now restricted exclusively to your own delivery boys"
        )
      }
    } catch (err) {
      setOpenForPublicDelivery(prev)
      showToast(err?.response?.data?.message || "Failed to update delivery dispatch setting")
    } finally {
      setSavingDispatchToggle(false)
    }
  }

  // Add dedicated rider
  const handleAddRiderSubmit = async (e) => {
    e.preventDefault()
    if (!riderForm.name.trim()) {
      showToast("Please enter rider name")
      return
    }
    const cleanPhone = riderForm.phone.replace(/\D/g, "").slice(-10)
    if (cleanPhone.length !== 10) {
      showToast("Please enter a valid 10-digit mobile number")
      return
    }

    try {
      setAddingRider(true)
      const res = await restaurantAPI.addDedicatedRider({
        name: riderForm.name.trim(),
        phone: cleanPhone,
        vehicleType: riderForm.vehicleType,
        vehicleNumber: riderForm.vehicleNumber.trim().toUpperCase(),
      })
      if (res?.data?.success) {
        showToast("Delivery partner added successfully!")
        setShowAddRiderModal(false)
        setRiderForm({
          name: "",
          phone: "",
          vehicleType: "Motorcycle",
          vehicleNumber: "",
        })
        loadDeliveryOverview()
      }
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to add delivery partner")
    } finally {
      setAddingRider(false)
    }
  }

  // Remove dedicated rider
  const handleRemoveRider = async () => {
    if (!riderToDelete) return
    try {
      setDeletingRider(true)
      const res = await restaurantAPI.removeDedicatedRider(riderToDelete._id)
      if (res?.data?.success) {
        showToast("Delivery partner unlinked successfully")
        setRiderToDelete(null)
        loadDeliveryOverview()
      }
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to remove delivery partner")
    } finally {
      setDeletingRider(false)
    }
  }

  const onlineRidersCount = dedicatedRiders.filter((r) => r.availabilityStatus === "online").length

  return (
    <div className="restaurant-page min-h-full bg-gray-50 pb-16">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button
            onClick={goBack}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-6 h-6 text-gray-900" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">Delivery & Rider Settings</h1>
            <p className="text-xs text-gray-500">Manage orders acceptance and personal delivery partners</p>
          </div>
          <button
            onClick={loadDeliveryOverview}
            disabled={loadingDedicated}
            className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loadingDedicated ? "animate-spin text-orange-600" : ""}`} />
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Section 1: Order Acceptance Status */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-orange-50 text-orange-600 rounded-xl">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Delivery Acceptance</h2>
                  <p className="text-xs text-gray-500">Turn delivery ordering on or off for customers</p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 pt-2 border-t border-gray-100">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 mb-1">
                    {deliveryStatus ? "Accepting Delivery Orders" : "Delivery Currently Offline"}
                  </p>
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        deliveryStatus ? "bg-emerald-500 animate-pulse" : "bg-gray-400"
                      }`}
                    />
                    <span className="text-xs text-gray-500">
                      {deliveryStatus ? "Store is visible and accepting orders" : "Customers cannot place orders right now"}
                    </span>
                  </div>
                </div>
                <Switch
                  checked={deliveryStatus}
                  onCheckedChange={handleDeliveryStatusChange}
                  disabled={savingStatus}
                  className="data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-gray-300"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Section 2: Dispatch Mode (Dedicated vs Public Riders) */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.05 }}>
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2.5 rounded-xl ${openForPublicDelivery ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"}`}>
                  <Radio className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h2 className="text-base font-bold text-gray-900">Delivery Dispatch Policy</h2>
                  <p className="text-xs text-gray-500">Configure who can deliver your restaurant orders</p>
                </div>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                    openForPublicDelivery
                      ? "bg-blue-100 text-blue-800"
                      : "bg-purple-100 text-purple-800"
                  }`}
                >
                  {openForPublicDelivery ? "Open for All" : "Dedicated Only"}
                </span>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">
                    Open Delivery for All Platform Riders
                  </p>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    {openForPublicDelivery ? (
                      <span className="text-gray-600">
                        Orders can be delivered by <strong>any available delivery rider in your zone</strong>. Your own delivery boys are prioritized first.
                      </span>
                    ) : (
                      <span className="text-purple-700 font-medium">
                        Orders will <strong>ONLY be visible and dispatched to your personal delivery boys</strong>. Other riders in the zone cannot see or take your orders.
                      </span>
                    )}
                  </p>
                </div>
                <Switch
                  checked={openForPublicDelivery}
                  onCheckedChange={handleToggleDispatchMode}
                  disabled={savingDispatchToggle}
                  className="data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-purple-600"
                />
              </div>

              {!openForPublicDelivery && dedicatedRiders.length === 0 && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Warning:</strong> You have selected "Dedicated Only" delivery, but have not registered any delivery partners yet. Add a rider below to avoid delivery delays.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Section 3: Personal Delivery Partners List */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.1 }}>
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-gray-900" />
                    <h2 className="text-base font-bold text-gray-900">Personal Delivery Partners</h2>
                    <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                      {dedicatedRiders.length}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {onlineRidersCount} of {dedicatedRiders.length} riders currently online
                  </p>
                </div>

                <button
                  onClick={() => setShowAddRiderModal(true)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Delivery Partner
                </button>
              </div>

              {/* Rider List or Empty State */}
              {dedicatedRiders.length === 0 ? (
                <div className="text-center py-10 px-4 border border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                  <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mx-auto mb-3">
                    <Bike className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 mb-1">No Personal Riders Added</h3>
                  <p className="text-xs text-gray-500 max-w-md mx-auto mb-4">
                    Have your own in-house delivery staff? Add them here so customer orders are automatically offered to your own riders.
                  </p>
                  <button
                    onClick={() => setShowAddRiderModal(true)}
                    className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 text-xs font-semibold rounded-lg shadow-xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-orange-600" />
                    Register Your First Rider
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {dedicatedRiders.map((rider) => {
                    const isOnline = rider.availabilityStatus === "online"
                    return (
                      <div
                        key={rider._id}
                        className="p-3.5 rounded-xl border border-gray-200 bg-white hover:border-gray-300 transition-all flex items-start justify-between gap-3 shadow-xs"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                            isOnline ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"
                          }`}>
                            <Bike className="w-5 h-5" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-gray-900 truncate">
                                {rider.name}
                              </h4>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                                  isOnline
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-emerald-500 animate-pulse" : "bg-gray-400"}`} />
                                {isOnline ? "Online" : "Offline"}
                              </span>
                            </div>

                            <p className="text-xs text-gray-600 flex items-center gap-1.5 mt-1">
                              <Phone className="w-3 h-3 text-gray-400 shrink-0" />
                              <a href={`tel:${rider.phone}`} className="hover:underline text-gray-700">
                                {rider.phone}
                              </a>
                            </p>

                            <p className="text-[11px] text-gray-500 mt-1">
                              {rider.vehicleType || "Bike"}
                              {rider.vehicleNumber && ` • ${rider.vehicleNumber}`}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => setRiderToDelete(rider)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                          title="Unlink Delivery Boy"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Information Footnote */}
              <div className="mt-5 p-3.5 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-900 leading-relaxed">
                  <strong>How rider login works:</strong> Registered delivery partners simply open the Delivery Partner App/Portal at{" "}
                  <code className="bg-blue-100/80 px-1.5 py-0.5 rounded text-[11px] font-mono text-blue-950 font-semibold">
                    /delivery/login
                  </code>{" "}
                  and log in using their 10-digit mobile number with OTP. They switch their toggle to "Online" to begin receiving orders.
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Modal: Add Dedicated Rider */}
      <RestaurantModal
        open={showAddRiderModal}
        onClose={() => setShowAddRiderModal(false)}
        size="md"
        title="Add Personal Delivery Partner"
      >
        <form onSubmit={handleAddRiderSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Rider Full Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Ramesh Kumar"
              value={riderForm.name}
              onChange={(e) => setRiderForm({ ...riderForm, name: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Mobile Number (10 Digits) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-semibold text-gray-500">+91</span>
              <input
                type="tel"
                required
                maxLength={10}
                placeholder="9876543210"
                value={riderForm.phone}
                onChange={(e) => setRiderForm({ ...riderForm, phone: e.target.value.replace(/\D/g, "") })}
                className="w-full pl-11 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none tracking-wider"
              />
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              The rider will receive OTP on this number when logging in to the Delivery portal.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Vehicle Type
              </label>
              <select
                value={riderForm.vehicleType}
                onChange={(e) => setRiderForm({ ...riderForm, vehicleType: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none bg-white"
              >
                <option value="Motorcycle">Motorcycle</option>
                <option value="Scooter">Scooter</option>
                <option value="Bicycle">Bicycle</option>
                <option value="Electric Vehicle">Electric Vehicle</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Vehicle Plate Number
              </label>
              <input
                type="text"
                placeholder="JH-01-AB-1234"
                value={riderForm.vehicleNumber}
                onChange={(e) => setRiderForm({ ...riderForm, vehicleNumber: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none uppercase"
              />
            </div>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
            <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <span>
              This rider will be pre-approved and linked directly to your outlet.
            </span>
          </div>

          <div className="flex gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setShowAddRiderModal(false)}
              className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addingRider}
              className="flex-1 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1.5"
            >
              {addingRider ? "Adding..." : "Add Rider"}
            </button>
          </div>
        </form>
      </RestaurantModal>

      {/* Modal: Confirm Delete Rider */}
      <RestaurantModal
        open={Boolean(riderToDelete)}
        onClose={() => setRiderToDelete(null)}
        size="sm"
        showClose={false}
      >
        <div className="flex flex-col items-center text-center -mt-2">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-3">
            <Trash2 className="w-7 h-7 text-red-600" />
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-1">
            Unlink Delivery Partner?
          </h3>
          <p className="text-xs text-gray-600 mb-5">
            Are you sure you want to remove <strong>{riderToDelete?.name}</strong> ({riderToDelete?.phone}) from your restaurant? They will no longer receive your exclusive orders.
          </p>

          <div className="flex gap-2.5 w-full">
            <button
              onClick={() => setRiderToDelete(null)}
              className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleRemoveRider}
              disabled={deletingRider}
              className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              {deletingRider ? "Removing..." : "Yes, Remove"}
            </button>
          </div>
        </div>
      </RestaurantModal>

      {/* Modal: Turn Off Delivery Confirmation */}
      <RestaurantModal
        open={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        size="sm"
        showClose={false}
      >
        <div className="flex flex-col items-center text-center -mt-2">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-3">
            <AlertCircle className="w-7 h-7 text-red-600" />
          </div>

          <h3 className="text-base font-bold text-gray-900 mb-1">
            Turn Off Delivery?
          </h3>
          <p className="text-xs text-gray-600 mb-5">
            Customers will not be able to place delivery orders from your restaurant. You can turn delivery back on anytime.
          </p>

          <div className="flex gap-2.5 w-full">
            <button
              onClick={() => setShowConfirmDialog(false)}
              className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setShowConfirmDialog(false)
                void saveDeliveryStatusToBackend(false)
              }}
              className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              Turn Off
            </button>
          </div>
        </div>
      </RestaurantModal>

      {/* Floating Success Toast */}
      <AnimatePresence>
        {showSuccessToast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] px-4 max-w-md w-full"
          >
            <div className="bg-gray-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
              <p className="text-xs font-medium flex-1">{toastMessage}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
