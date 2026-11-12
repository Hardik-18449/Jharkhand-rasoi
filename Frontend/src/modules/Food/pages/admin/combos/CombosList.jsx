import { useEffect, useMemo, useState } from "react"
import { Eye, Loader2, Search, Trash2, Pencil } from "lucide-react"
import { Switch } from "@food/components/ui/switch"
import { adminAPI, uploadAPI } from "@food/api"
import { toast } from "sonner"
import { getImageValidationError } from '@/shared/utils/uploadErrors.js'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@food/components/ui/dialog"
import { PLACEHOLDER_URL, getPlaceholderImage } from "@/shared/utils/media.js"

const debugError = (...args) => {}

const RUPEE = "₹"

const getItemCreatedMs = (item = {}) => {
  const direct = [item.requestedAt, item.createdAt, item.updatedAt]
    .map((v) => new Date(v).getTime())
    .find((ms) => Number.isFinite(ms) && ms > 0)
  return direct || 0
}

const formatComboId = (id) => {
  if (!id) return "COMBO000000"
  const digits = String(id).match(/\d+/g)
  const combined = digits ? digits.join("") : ""
  const lastDigits = combined ? combined.slice(-6).padStart(6, "0") : "000000"
  return `COMBO${lastDigits}`
}

const getPayload = (combo) => combo?.published || combo?.draft || {}
const getComboTitle = (combo) => combo?.draft?.name || combo?.published?.name || "Unnamed Combo"
const getComboImage = (combo) =>
  combo?.draft?.image ||
  combo?.draft?.images?.[0] ||
  combo?.published?.image ||
  combo?.published?.images?.[0] ||
  PLACEHOLDER_URL

const money = (v) => `${RUPEE}${Number(v || 0).toFixed(2)}`

const describeItems = (items = []) =>
  (Array.isArray(items) ? items : [])
    .map((it) => `${it.quantity || 1} x ${it.name}${it.variantName ? ` (${it.variantName})` : ""}`)
    .join(", ")

const STATUS_STYLES = {
  approved: "bg-green-100 text-green-700",
  pending: "bg-amber-100 text-amber-700",
  rejected: "bg-red-100 text-red-700",
}

export default function CombosList() {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [combos, setCombos] = useState([])
  const [loading, setLoading] = useState(true)
  const [submittingAction, setSubmittingAction] = useState(false)

  const [selectedCombo, setSelectedCombo] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [editingCombo, setEditingCombo] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({ name: "", comboPrice: "", description: "", isAvailable: true })
  const [editImagePreview, setEditImagePreview] = useState("")
  const [editImageFile, setEditImageFile] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectReason, setRejectReason] = useState("")

  const fetchCombos = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getRestaurantCombos({
        approvalStatus: statusFilter === "all" ? undefined : statusFilter,
        search: searchQuery?.trim() ? searchQuery.trim() : undefined,
        limit: 200,
        page: 1,
      })
      const data = response?.data?.data?.combos || response?.data?.combos || []
      setCombos(Array.isArray(data) ? data : [])
    } catch (error) {
      debugError("Error fetching combos:", error)
      toast.error("Failed to load restaurant combos")
      setCombos([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(fetchCombos, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, statusFilter])

  const sortedCombos = useMemo(() => {
    const result = Array.isArray(combos) ? [...combos] : []
    result.sort((a, b) => getItemCreatedMs(b) - getItemCreatedMs(a))
    return result
  }, [combos])

  const handleViewDetails = (combo) => {
    setSelectedCombo(combo)
    setShowDetailModal(true)
  }

  const handleEdit = (combo) => {
    const p = combo?.draft || {}
    setEditingCombo(combo)
    setEditForm({
      name: p.name || "",
      comboPrice: p.comboPrice ?? "",
      description: p.description || "",
      isAvailable: combo?.isAvailable !== false,
    })
    setEditImagePreview(p.image || (Array.isArray(p.images) && p.images[0]) || "")
    setEditImageFile(null)
    setShowEditModal(true)
  }

  const handleSaveEdit = async () => {
    const id = editingCombo?.id || editingCombo?._id
    if (!id) return
    if (!editForm.name.trim()) {
      toast.error("Name is required")
      return
    }
    const priceNum = Number(editForm.comboPrice)
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      toast.error("Enter a valid combo price")
      return
    }
    const originalPrice = Number(editingCombo?.draft?.originalPrice || 0)
    if (originalPrice > 0 && priceNum > originalPrice) {
      toast.error(`Combo price cannot exceed the items total (${money(originalPrice)})`)
      return
    }
    try {
      setSubmittingAction(true)
      let imageUrl = editImagePreview || ""
      if (editImageFile) {
        const imageValidationError = getImageValidationError(editImageFile)
        if (imageValidationError) {
          toast.error(imageValidationError)
          setSubmittingAction(false)
          return
        }
        const uploadRes = await uploadAPI.uploadMedia(editImageFile, { folder: "tuggo/admin/combos" })
        imageUrl = uploadRes?.data?.data?.url || uploadRes?.data?.url || imageUrl
      }

      const res = await adminAPI.updateRestaurantCombo(String(id), {
        name: editForm.name.trim(),
        comboPrice: priceNum,
        description: editForm.description.trim(),
        isAvailable: editForm.isAvailable,
        image: imageUrl,
        images: imageUrl ? [imageUrl] : [],
      })
      const updated = res?.data?.data?.combo
      setCombos((prev) =>
        (prev || []).map((c) => (String(c.id || c._id) === String(id) ? (updated || c) : c)),
      )
      toast.success("Combo updated")
      setShowEditModal(false)
      setEditingCombo(null)
      setEditImageFile(null)
    } catch (error) {
      debugError("Update combo failed:", error)
      toast.error(error?.response?.data?.message || "Failed to update combo")
    } finally {
      setSubmittingAction(false)
    }
  }

  const handleToggleAvailability = async (combo, isAvailable) => {
    const id = combo?.id || combo?._id
    try {
      await adminAPI.updateRestaurantCombo(String(id), { isAvailable })
      setCombos((prev) => (prev || []).map((c) => (String(c.id || c._id) === String(id) ? { ...c, isAvailable } : c)))
      toast.success(`Combo ${isAvailable ? "enabled" : "paused"}`)
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update combo")
    }
  }

  const handleApprove = async (combo) => {
    const id = combo?.id || combo?._id
    try {
      setSubmittingAction(true)
      await adminAPI.approveRestaurantCombo(String(id))
      toast.success("Combo approved")
      await fetchCombos()
      setShowDetailModal(false)
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to approve combo")
    } finally {
      setSubmittingAction(false)
    }
  }

  const confirmReject = async () => {
    const id = rejectTarget?.id || rejectTarget?._id
    if (!id) return
    if (!rejectReason.trim()) {
      toast.error("Please provide a rejection reason")
      return
    }
    try {
      setSubmittingAction(true)
      await adminAPI.rejectRestaurantCombo(String(id), rejectReason.trim())
      toast.success("Combo rejected")
      setRejectTarget(null)
      setRejectReason("")
      setShowDetailModal(false)
      await fetchCombos()
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to reject combo")
    } finally {
      setSubmittingAction(false)
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    const id = pendingDelete?.id || pendingDelete?._id
    try {
      setSubmittingAction(true)
      await adminAPI.rejectRestaurantCombo(String(id), "Removed by admin")
      setCombos((prev) => (prev || []).filter((c) => String(c.id || c._id) !== String(id)))
      toast.success("Combo removed")
    } catch (error) {
      debugError("Delete combo failed:", error)
      toast.error(error?.response?.data?.message || "Failed to remove combo")
    } finally {
      setSubmittingAction(false)
      setPendingDelete(null)
    }
  }

  const renderStatus = (status) => (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ${STATUS_STYLES[status] || "bg-slate-100 text-slate-700"}`}>
      {status || "pending"}
    </span>
  )

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Restaurant combo offers</h1>
            <div className="text-sm text-slate-500 mt-1">
              Combo packs (for example pizza + burger + cold drink) submitted by restaurants. Approve, edit or pause them here.
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search combos or restaurant..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-2.5 px-3 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div className="text-sm text-slate-600">
            Showing <span className="font-semibold">{sortedCombos.length}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["SL", "Image", "Combo", "Restaurant", "Includes", "Price", "Status", "Live", "Action"].map((h) => (
                  <th
                    key={h}
                    className={`px-4 py-4 text-[10px] font-bold text-slate-700 uppercase tracking-wider ${h === "Action" ? "text-center" : "text-left"}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
                      <p className="text-sm text-slate-500">Loading combos...</p>
                    </div>
                  </td>
                </tr>
              ) : sortedCombos.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-20 text-center">
                    <p className="text-lg font-semibold text-slate-700 mb-1">No Data Found</p>
                    <p className="text-sm text-slate-500">No combos match your search</p>
                  </td>
                </tr>
              ) : (
                sortedCombos.map((combo, index) => {
                  const p = combo?.draft || {}
                  const status = String(combo.approvalStatus || "pending").toLowerCase()
                  return (
                    <tr key={String(combo.id || combo._id)} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-slate-700">{index + 1}</td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100">
                          <img
                            src={getComboImage(combo)}
                            alt={getComboTitle(combo)}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.src = PLACEHOLDER_URL
                            }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-slate-900">{getComboTitle(combo)}</span>
                          <span className="text-xs text-slate-500">ID #{formatComboId(combo.id || combo._id)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-sm text-slate-900">{combo?.restaurant?.name || "-"}</span>
                          {combo?.restaurant?.ownerPhone ? (
                            <span className="text-xs text-slate-500">{combo.restaurant.ownerPhone}</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-4 max-w-xs">
                        <span className="text-xs text-slate-700 line-clamp-2">{describeItems(p.items) || "-"}</span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-slate-900">{money(p.comboPrice)}</span>
                          {Number(p.originalPrice) > Number(p.comboPrice) ? (
                            <span className="text-xs text-slate-400 line-through">{money(p.originalPrice)}</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">{renderStatus(status)}</td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <Switch
                          checked={combo.isAvailable !== false}
                          disabled={status !== "approved"}
                          onCheckedChange={(checked) => handleToggleAvailability(combo, checked)}
                        />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2 flex-wrap">
                          <button
                            onClick={() => handleViewDetails(combo)}
                            className="p-1.5 rounded text-blue-600 hover:bg-blue-50 transition-colors"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {status === "pending" ? (
                            <>
                              <button
                                onClick={() => handleApprove(combo)}
                                disabled={submittingAction}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => {
                                  setRejectTarget(combo)
                                  setRejectReason("")
                                }}
                                disabled={submittingAction}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </>
                          ) : null}
                          <button
                            onClick={() => handleEdit(combo)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                            Edit
                          </button>
                          {status === "approved" ? (
                            <button
                              onClick={() => setPendingDelete(combo)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                              Remove
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-xl p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b border-slate-200 bg-slate-50">
            <DialogTitle className="text-lg font-semibold text-slate-900">Combo Details</DialogTitle>
          </DialogHeader>
          {selectedCombo && (() => {
            const p = selectedCombo.draft || getPayload(selectedCombo)
            const status = String(selectedCombo.approvalStatus || "pending").toLowerCase()
            const savings = Math.max(0, Number(p.originalPrice || 0) - Number(p.comboPrice || 0))
            return (
              <div className="p-6 space-y-5">
                <div className="flex items-center gap-4">
                  <img
                    src={getComboImage(selectedCombo)}
                    alt={getComboTitle(selectedCombo)}
                    className="w-20 h-20 rounded-xl object-cover border border-slate-200"
                    onError={(e) => {
                      e.target.src = getPlaceholderImage({ width: 64, height: 64, text: "Combo" })
                    }}
                  />
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{getComboTitle(selectedCombo)}</p>
                    <p className="text-sm text-slate-500 mt-0.5">ID #{formatComboId(selectedCombo.id || selectedCombo._id)}</p>
                    <div className="mt-1">{renderStatus(status)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <p>
                    <span className="font-semibold text-slate-700">Restaurant:</span>{" "}
                    <span className="text-slate-900">{selectedCombo?.restaurant?.name || "-"}</span>
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">Combo price:</span>{" "}
                    <span className="text-slate-900">{money(p.comboPrice)}</span>
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">Items total:</span>{" "}
                    <span className="text-slate-900">{money(p.originalPrice)}</span>
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">Customer saves:</span>{" "}
                    <span className="text-green-700 font-semibold">{money(savings)}</span>
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">Type:</span>{" "}
                    <span className="text-slate-900">{p.foodType || "-"}</span>
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">Available:</span>{" "}
                    <span className="text-slate-900">{selectedCombo?.isAvailable !== false ? "Yes" : "No"}</span>
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Includes ({(p.items || []).length} items)
                  </p>
                  <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
                    {(p.items || []).map((it, idx) => (
                      <div key={`${it.foodId}-${idx}`} className="flex items-center justify-between px-3 py-2 text-sm">
                        <span className="text-slate-800">
                          {it.quantity || 1} x {it.name}
                          {it.variantName ? <span className="text-slate-500"> ({it.variantName})</span> : null}
                        </span>
                        <span className="text-slate-500">{money(Number(it.unitPrice || 0) * Number(it.quantity || 1))}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {p.description ? (
                  <p className="text-sm text-slate-700 leading-relaxed">
                    <span className="font-semibold text-slate-800">Description:</span> {p.description}
                  </p>
                ) : null}
                {status === "rejected" && selectedCombo.rejectionReason ? (
                  <p className="text-sm text-red-600">
                    <span className="font-semibold">Rejection reason:</span> {selectedCombo.rejectionReason}
                  </p>
                ) : null}

                {status === "pending" ? (
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRejectTarget(selectedCombo)
                        setRejectReason("")
                      }}
                      disabled={submittingAction}
                      className="px-4 py-2 text-sm font-medium text-white bg-amber-500 rounded-md hover:bg-amber-600 disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprove(selectedCombo)}
                      disabled={submittingAction}
                      className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
                    >
                      {submittingAction ? "Working..." : "Approve"}
                    </button>
                  </div>
                ) : null}
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b border-slate-200 bg-slate-50">
            <DialogTitle className="text-lg font-semibold text-slate-900">Edit Combo</DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              {editImagePreview ? (
                <img
                  src={editImagePreview}
                  alt="Preview"
                  className="w-16 h-16 rounded-md object-cover border"
                  onError={(e) => (e.target.style.display = "none")}
                />
              ) : (
                <div className="w-16 h-16 rounded-md border border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-500">
                  No image
                </div>
              )}
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Change Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    setEditImageFile(file)
                    setEditImagePreview(URL.createObjectURL(file))
                  }}
                  className="text-sm"
                />
                <p className="text-xs text-slate-500">PNG, JPG, WEBP up to 5MB</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Combo price{" "}
                {editingCombo?.draft?.originalPrice ? (
                  <span className="text-xs text-slate-500">(items total {money(editingCombo.draft.originalPrice)})</span>
                ) : null}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={editForm.comboPrice}
                onChange={(e) => setEditForm((prev) => ({ ...prev, comboPrice: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
            <div className="rounded-md bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
              <span className="font-semibold text-slate-700">Includes:</span>{" "}
              {describeItems(editingCombo?.draft?.items) || "-"}
              <p className="mt-1 text-[11px] text-slate-500">
                The restaurant chooses the dishes in a combo. Ask them to edit the combo to change its items.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={editForm.isAvailable}
                onCheckedChange={(checked) => setEditForm((prev) => ({ ...prev, isAvailable: checked }))}
              />
              <span className="text-sm text-slate-700">Available</span>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowEditModal(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={submittingAction}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submittingAction ? "Saving..." : "Save"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject */}
      <Dialog open={Boolean(rejectTarget)} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent className="max-w-md w-full rounded-xl p-0 overflow-hidden shadow-xl">
          <div className="px-5 py-4 border-b border-slate-200">
            <DialogTitle className="text-lg font-semibold text-slate-900">Reject combo</DialogTitle>
          </div>
          <div className="px-5 py-4 space-y-2">
            <p className="text-sm text-slate-700">
              Tell the restaurant why <span className="font-semibold">{getComboTitle(rejectTarget)}</span> is being rejected.
            </p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Rejection reason"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
          </div>
          <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2 bg-slate-50">
            <button
              type="button"
              onClick={() => setRejectTarget(null)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmReject}
              disabled={submittingAction}
              className="px-4 py-2 text-sm font-medium text-white bg-amber-500 rounded-md hover:bg-amber-600 disabled:opacity-50"
            >
              {submittingAction ? "Rejecting..." : "Reject"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove */}
      <Dialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent className="max-w-md w-full rounded-xl p-0 overflow-hidden shadow-xl">
          <div className="px-5 py-4 border-b border-slate-200">
            <DialogTitle className="text-lg font-semibold text-slate-900">Remove combo?</DialogTitle>
          </div>
          <div className="px-5 pt-4 pb-2">
            <p className="text-sm text-slate-700">
              The combo will be taken off the user app and marked as rejected for the restaurant.
            </p>
          </div>
          <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2 bg-slate-50">
            <button
              type="button"
              onClick={() => setPendingDelete(null)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100"
            >
              No
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={submittingAction}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              {submittingAction ? "Removing..." : "Yes, remove"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
