import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Upload, X, Check, Camera, Image as ImageIcon, RefreshCw, AlertCircle } from "lucide-react"
import { deliveryAPI, uploadAPI } from "@food/api"
import { toast } from "sonner"
import { openCamera } from "@food/utils/imageUploadUtils"
import { compressImage, validateImageFile } from "@/shared/utils/imageCompressor.js"
import useDeliveryBackNavigation from "../../hooks/useDeliveryBackNavigation"

const DOCUMENT_LABELS = {
  profilePhoto: "Profile Photo",
  aadharFrontPhoto: "Aadhar Card (Front)",
  aadharBackPhoto: "Aadhar Card (Back)",
  panPhoto: "PAN Card Photo",
  drivingLicenseFrontPhoto: "Driving License (Front)",
  drivingLicenseBackPhoto: "Driving License (Back)",
  rcPhoto: "RC (Registration Certificate)"
}

const createEmptyUploadedDocs = () => ({
  profilePhoto: null,
  aadharFrontPhoto: null,
  aadharBackPhoto: null,
  panPhoto: null,
  drivingLicenseFrontPhoto: null,
  drivingLicenseBackPhoto: null,
  rcPhoto: null
})

// IndexedDB helpers for persistent file/URL storage
const DELIVERY_FILES_DB = "DeliverySignupFiles"
const FILES_STORE = "files"

const openDeliveryFilesDB = () => {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DELIVERY_FILES_DB, 1)
      request.onupgradeneeded = (e) => {
        const db = e.target.result
        if (!db.objectStoreNames.contains(FILES_STORE)) {
          db.createObjectStore(FILES_STORE)
        }
      }
      request.onsuccess = (e) => resolve(e.target.result)
      request.onerror = (e) => reject(e.target.error)
    } catch (err) {
      reject(err)
    }
  })
}

const saveFileToDB = async (key, file) => {
  if (!file) return
  try {
    const db = await openDeliveryFilesDB()
    const tx = db.transaction(FILES_STORE, "readwrite")
    tx.objectStore(FILES_STORE).put(file, key)
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => reject(tx.error || new Error("IndexedDB write transaction failed"))
      tx.onabort = () => reject(tx.error || new Error("IndexedDB write transaction aborted"))
    })
  } catch (err) {
    console.error("IndexedDB save failed:", err)
  }
}

const getFileFromDB = async (key) => {
  try {
    const db = await openDeliveryFilesDB()
    const tx = db.transaction(FILES_STORE, "readonly")
    const request = tx.objectStore(FILES_STORE).get(key)
    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => resolve(null)
    })
  } catch (err) {
    console.error("IndexedDB load failed:", err)
    return null
  }
}

const deleteFileFromDB = async (key) => {
  try {
    const db = await openDeliveryFilesDB()
    const tx = db.transaction(FILES_STORE, "readwrite")
    tx.objectStore(FILES_STORE).delete(key)
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => reject(tx.error || new Error("IndexedDB delete transaction failed"))
      tx.onabort = () => reject(tx.error || new Error("IndexedDB delete transaction aborted"))
    })
  } catch (err) {
    console.error("IndexedDB delete failed:", err)
  }
}

const clearAllFilesFromDB = async () => {
  try {
    const db = await openDeliveryFilesDB()
    const tx = db.transaction(FILES_STORE, "readwrite")
    tx.objectStore(FILES_STORE).clear()
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => reject(tx.error || new Error("IndexedDB clear transaction failed"))
      tx.onabort = () => reject(tx.error || new Error("IndexedDB clear transaction aborted"))
    })
  } catch (err) {
    console.error("IndexedDB clear failed:", err)
  }
}

const sanitizeUploadedDocValue = (value) => {
  if (!value) return null
  if (typeof value === "string") {
    return value.startsWith("blob:") ? null : { url: value }
  }
  if (typeof value === "object") {
    const url = typeof value.url === "string" ? value.url : ""
    if (url.startsWith("blob:")) return null
    return url ? value : null
  }
  return null
}

const sanitizeUploadedDocs = (docs) => ({
  profilePhoto: sanitizeUploadedDocValue(docs?.profilePhoto),
  aadharFrontPhoto: sanitizeUploadedDocValue(docs?.aadharFrontPhoto),
  aadharBackPhoto: sanitizeUploadedDocValue(docs?.aadharBackPhoto),
  panPhoto: sanitizeUploadedDocValue(docs?.panPhoto),
  drivingLicenseFrontPhoto: sanitizeUploadedDocValue(docs?.drivingLicenseFrontPhoto),
  drivingLicenseBackPhoto: sanitizeUploadedDocValue(docs?.drivingLicenseBackPhoto),
  rcPhoto: sanitizeUploadedDocValue(docs?.rcPhoto)
})

const getFriendlyRegistrationError = (error) => {
  const rawMessage =
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.userMessage ||
    error?.message ||
    ""

  const lower = rawMessage.toLowerCase()

  if (/E11000 duplicate key error/i.test(rawMessage) || lower.includes("already registered") || lower.includes("duplicate")) {
    if (lower.includes("vehicle")) {
      return "This vehicle number is already registered. Please use a different vehicle number."
    }
    if (lower.includes("pan")) {
      return "This PAN number is already registered."
    }
    if (lower.includes("aadhar")) {
      return "This Aadhar number is already registered."
    }
    if (lower.includes("license") || lower.includes("driving")) {
      return "This driving license number is already registered."
    }
    if (lower.includes("phone")) {
      return "This phone number is already registered. Please login instead."
    }
    return "This account detail is already registered. Please check your information."
  }

  return rawMessage || "Failed to register. Please try again."
}

export default function SignupStep2() {
  const navigate = useNavigate()
  const goBack = useDeliveryBackNavigation()

  const fileInputRefs = useRef({
    profilePhoto: null,
    aadharFrontPhoto: null,
    aadharBackPhoto: null,
    panPhoto: null,
    drivingLicenseFrontPhoto: null,
    drivingLicenseBackPhoto: null,
    rcPhoto: null
  })

  const [documents, setDocuments] = useState({
    profilePhoto: null,
    aadharFrontPhoto: null,
    aadharBackPhoto: null,
    panPhoto: null,
    drivingLicenseFrontPhoto: null,
    drivingLicenseBackPhoto: null,
    rcPhoto: null
  })

  const [uploadedDocs, setUploadedDocs] = useState(() => {
    const saved = localStorage.getItem("deliverySignupDocs")
    if (saved) {
      try {
        return sanitizeUploadedDocs(JSON.parse(saved))
      } catch (e) {
        console.error("Error parsing saved docs:", e)
      }
    }
    return createEmptyUploadedDocs()
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploading, setUploading] = useState({})
  const [uploadErrors, setUploadErrors] = useState({})
  const [isSuccess, setIsSuccess] = useState(false)

  // Hydrate files/URLs from IndexedDB on load
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" })
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0

    const loadFiles = async () => {
      const [prof, aadharFront, aadharBack, pan, dlFront, dlBack, rc] = await Promise.all([
        getFileFromDB("profilePhoto"),
        getFileFromDB("aadharFrontPhoto"),
        getFileFromDB("aadharBackPhoto"),
        getFileFromDB("panPhoto"),
        getFileFromDB("drivingLicenseFrontPhoto"),
        getFileFromDB("drivingLicenseBackPhoto"),
        getFileFromDB("rcPhoto")
      ])

      const docMap = {
        profilePhoto: prof,
        aadharFrontPhoto: aadharFront,
        aadharBackPhoto: aadharBack,
        panPhoto: pan,
        drivingLicenseFrontPhoto: dlFront,
        drivingLicenseBackPhoto: dlBack,
        rcPhoto: rc
      }

      setDocuments(prev => ({
        ...prev,
        ...(prof && { profilePhoto: prof }),
        ...(aadharFront && { aadharFrontPhoto: aadharFront }),
        ...(aadharBack && { aadharBackPhoto: aadharBack }),
        ...(pan && { panPhoto: pan }),
        ...(dlFront && { drivingLicenseFrontPhoto: dlFront }),
        ...(dlBack && { drivingLicenseBackPhoto: dlBack }),
        ...(rc && { rcPhoto: rc })
      }))

      // For any item that is already a server URL, mark as uploaded
      setUploadedDocs(prev => {
        const next = { ...prev }
        Object.entries(docMap).forEach(([k, v]) => {
          if (v && typeof v === "string" && (v.startsWith("http://") || v.startsWith("https://") || v.startsWith("/uploads/"))) {
            next[k] = { url: v }
          }
        })
        return next
      })
    }
    loadFiles()
  }, [])

  // Save uploaded docs metadata to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("deliverySignupDocs", JSON.stringify(uploadedDocs))
  }, [uploadedDocs])

  const getPreviewSrc = (docType) => {
    const uploaded = uploadedDocs[docType]
    if (typeof uploaded === "string") return uploaded
    if (uploaded?.url) return uploaded.url

    const localFile = documents[docType]
    if (typeof localFile === "string") {
      return localFile
    }
    return null
  }

  // Core Progressive / One-By-One Upload Handler
  const handleUploadSingleFile = async (docType, rawFile) => {
    if (!rawFile) return

    const validationErr = validateImageFile(rawFile, { maxInputMb: 20 })
    if (validationErr) {
      toast.error(validationErr)
      return
    }

    const label = DOCUMENT_LABELS[docType] || docType

    setUploading(prev => ({ ...prev, [docType]: true }))
    setUploadErrors(prev => ({ ...prev, [docType]: null }))

    try {
      // 1. Client-side compression: resize down to max 1280px WebP, target size <= 2MB
      const compressed = await compressImage(rawFile, {
        maxDimension: 1280,
        quality: 0.8,
        targetMaxBytes: 2 * 1024 * 1024,
        filenamePrefix: `delivery-${docType}`
      })

      // 2. Set instant local preview
      setDocuments(prev => ({ ...prev, [docType]: compressed.dataUrl }))

      // 3. Upload immediately to single upload endpoint
      const response = await uploadAPI.uploadMedia(compressed.file, { folder: "delivery" })
      const serverUrl = response?.data?.data?.url || response?.data?.url

      if (!serverUrl) {
        throw new Error("No URL returned from server")
      }

      // 4. Save server URL in state & storage
      setUploadedDocs(prev => ({
        ...prev,
        [docType]: { url: serverUrl, sizeKb: compressed.sizeKb }
      }))
      setDocuments(prev => ({ ...prev, [docType]: serverUrl }))
      await saveFileToDB(docType, serverUrl)

      setUploading(prev => ({ ...prev, [docType]: false }))
      toast.success(`${label} uploaded successfully (${compressed.sizeKb} KB)`)
    } catch (err) {
      console.error(`Upload error for ${docType}:`, err)
      setUploading(prev => ({ ...prev, [docType]: false }))
      const msg = err?.response?.data?.message || err?.userMessage || err?.message || "Upload failed. Please try again."
      setUploadErrors(prev => ({ ...prev, [docType]: msg }))
      toast.error(`Failed to upload ${label}: ${msg}`)
    }
  }

  const handleTakeCameraPhoto = (docType, label) => {
    openCamera({
      onSelectFile: (file) => handleUploadSingleFile(docType, file),
      fileNamePrefix: `signup-${docType}`
    })
  }

  const handlePickFromGallery = (docType) => {
    fileInputRefs.current[docType]?.click()
  }

  const handleRemove = async (docType) => {
    setDocuments(prev => ({ ...prev, [docType]: null }))
    setUploadedDocs(prev => ({ ...prev, [docType]: null }))
    setUploadErrors(prev => ({ ...prev, [docType]: null }))
    await deleteFileFromDB(docType)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // 1. Guard against in-flight uploads
    const isAnyUploading = Object.values(uploading).some(Boolean)
    if (isAnyUploading) {
      toast.error("Please wait for all documents to finish uploading.")
      return
    }

    const raw = localStorage.getItem("deliverySignupDetails")
    if (!raw) {
      toast.error("Session expired. Please start from Create Account.")
      navigate("/food/delivery/signup", { replace: true })
      return
    }

    let details
    try {
      details = JSON.parse(raw)
    } catch {
      toast.error("Invalid session. Please start from Create Account.")
      navigate("/food/delivery/signup", { replace: true })
      return
    }

    // 2. Validate all required documents are uploaded
    const requiredList = [
      { key: "profilePhoto", label: "Profile Photo" },
      { key: "aadharFrontPhoto", label: "Aadhar Card (Front)" },
      { key: "aadharBackPhoto", label: "Aadhar Card (Back)" },
      { key: "panPhoto", label: "PAN Card Photo" },
      { key: "rcPhoto", label: "RC (Registration Certificate)" }
    ]

    for (const req of requiredList) {
      const url = uploadedDocs[req.key]?.url || (typeof documents[req.key] === "string" && (documents[req.key].startsWith("http") || documents[req.key].startsWith("/uploads/")) ? documents[req.key] : null)
      if (!url) {
        // If they have a local dataUrl from previous session, auto-upload it now
        if (documents[req.key] && typeof documents[req.key] === "string" && documents[req.key].startsWith("data:")) {
          try {
            toast.info(`Uploading ${req.label}...`)
            await handleUploadSingleFile(req.key, documents[req.key])
            continue
          } catch {
            toast.error(`Please upload ${req.label}`)
            return
          }
        }
        toast.error(`${req.label} is required and must be uploaded`)
        return
      }
    }

    // Try to get FCM token before registering
    let fcmToken = null
    let platform = "web"
    try {
      if (typeof window !== "undefined") {
        if (window.flutter_inappwebview) {
          platform = "mobile"
          const handlerNames = ["getFcmToken", "getFCMToken", "getPushToken", "getFirebaseToken"]
          for (const handlerName of handlerNames) {
            try {
              const t = await window.flutter_inappwebview.callHandler(handlerName, { module: "delivery" })
              if (t && typeof t === "string" && t.length > 20) {
                fcmToken = t.trim()
                break
              }
            } catch (e) {}
          }
        } else {
          fcmToken = localStorage.getItem("fcm_web_registered_token_delivery") || null
        }
      }
    } catch (e) {
      console.warn("Failed to get FCM token during signup", e)
    }

    // 3. Build clean lightweight JSON payload with already-uploaded URLs
    const payload = {
      name: details.name || "",
      phone: String(details.phone || "").replace(/\D/g, "").slice(0, 15),
      email: details.email ? String(details.email).trim() : undefined,
      ref: details.ref ? String(details.ref).trim() : undefined,
      countryCode: details.countryCode || "+91",
      address: details.address || "",
      city: details.city || "",
      state: details.state || "",
      vehicleType: details.vehicleType || "bike",
      vehicleName: details.vehicleName || "",
      vehicleNumber: details.vehicleNumber || "",
      drivingLicenseNumber: details.drivingLicenseNumber ? details.drivingLicenseNumber.trim() : undefined,
      panNumber: details.panNumber ? details.panNumber.toUpperCase().trim() : undefined,
      aadharNumber: details.aadharNumber ? details.aadharNumber.replace(/\D/g, "") : undefined,
      profilePhoto: uploadedDocs.profilePhoto?.url || documents.profilePhoto,
      aadharFrontPhoto: uploadedDocs.aadharFrontPhoto?.url || documents.aadharFrontPhoto,
      aadharBackPhoto: uploadedDocs.aadharBackPhoto?.url || documents.aadharBackPhoto,
      panPhoto: uploadedDocs.panPhoto?.url || documents.panPhoto,
      drivingLicenseFrontPhoto: uploadedDocs.drivingLicenseFrontPhoto?.url || documents.drivingLicenseFrontPhoto || "",
      drivingLicenseBackPhoto: uploadedDocs.drivingLicenseBackPhoto?.url || documents.drivingLicenseBackPhoto || "",
      rcPhoto: uploadedDocs.rcPhoto?.url || documents.rcPhoto,
      fcmToken,
      platform
    }

    const isCompleteProfile = localStorage.getItem("deliveryNeedsRegistration") === "true"

    setIsSubmitting(true)

    try {
      const response = isCompleteProfile
        ? await deliveryAPI.register(payload)
        : await deliveryAPI.completeProfile(payload)

      if (response?.data?.success) {
        localStorage.removeItem("deliverySignupDetails")
        localStorage.removeItem("deliverySignupDocs")
        await clearAllFilesFromDB()
        localStorage.removeItem("deliveryNeedsRegistration")
        setIsSuccess(true)
      } else {
        toast.error(response?.data?.message || "Failed to submit registration.")
      }
    } catch (error) {
      console.error("Delivery signup error:", error)
      const friendlyMessage = getFriendlyRegistrationError(error)
      toast.error(friendlyMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const DocumentUpload = ({ docType, label, required = true }) => {
    const uploaded = uploadedDocs[docType]
    const isUploading = uploading[docType]
    const uploadError = uploadErrors[docType]
    const src = getPreviewSrc(docType)
    const isReady = Boolean(uploaded?.url)

    return (
      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm transition-all hover:border-gray-300">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-semibold text-gray-800">
            {label} {required && <span className="text-red-500">*</span>}
          </label>
          {isReady && uploaded?.sizeKb && (
            <span className="text-[11px] font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded">
              {uploaded.sizeKb} KB
            </span>
          )}
        </div>

        {isReady ? (
          <div className="relative">
            {src ? (
              <img
                src={src}
                alt={label}
                className="w-full h-48 object-cover rounded-lg border border-gray-100"
              />
            ) : (
              <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00B761]"></div>
              </div>
            )}
            <button
              type="button"
              onClick={() => handleRemove(docType)}
              className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors shadow-md active:scale-95"
              title="Remove photo"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="absolute bottom-2 left-2 bg-[#00B761] text-white px-3 py-1 rounded-full flex items-center gap-1.5 text-xs font-bold shadow-md">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>Uploaded</span>
            </div>
          </div>
        ) : (
          <div className={`flex flex-col items-center justify-center w-full min-h-[180px] border-2 border-dashed rounded-xl transition-all px-4 py-4 ${
            uploadError ? "border-red-300 bg-red-50/30" : "border-gray-200 bg-gray-50/50 hover:border-[#00B761]"
          }`}>
            <div className="flex flex-col items-center justify-center mb-3">
              {isUploading ? (
                <>
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#00B761] border-t-transparent mb-2"></div>
                  <p className="text-sm font-semibold text-gray-700">Compressing & Uploading...</p>
                  <p className="text-xs text-gray-400 mt-0.5">Optimizing under 2MB for fast upload</p>
                </>
              ) : uploadError ? (
                <>
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mb-2">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  </div>
                  <p className="text-xs font-semibold text-red-600 text-center max-w-[240px] mb-1">
                    {uploadError}
                  </p>
                  <p className="text-[11px] text-gray-400">Tap below to retry</p>
                </>
              ) : (
                <>
                  <Upload className="w-7 h-7 text-gray-400 mb-2" />
                  <p className="text-sm font-semibold text-gray-700">Upload document</p>
                  <p className="text-xs text-gray-400 mt-0.5">PNG, JPG, WebP up to 2MB (Auto-compressed)</p>
                </>
              )}
            </div>

            {!isUploading && (
              <div className="w-full grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleTakeCameraPhoto(docType, label)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-gray-900 text-white text-xs font-bold cursor-pointer hover:bg-black transition-all active:scale-95 shadow-sm"
                >
                  <Camera className="w-4 h-4" />
                  <span>Take Photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePickFromGallery(docType)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#00B761] text-white text-xs font-bold cursor-pointer hover:bg-[#00A055] transition-all active:scale-95 shadow-sm shadow-[#00B761]/20"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>Gallery</span>
                </button>
              </div>
            )}

            <input
              ref={(node) => {
                fileInputRefs.current[docType] = node
              }}
              type="file"
              className="hidden"
              accept=".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif"
              onClick={(e) => {
                e.target.value = ""
              }}
              onChange={(e) => {
                const selectedFile = e.target.files[0]
                if (selectedFile) {
                  handleUploadSingleFile(docType, selectedFile)
                }
                e.target.value = ""
              }}
              disabled={isUploading}
            />
          </div>
        )}
      </div>
    )
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-xl border border-gray-100">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <Check className="w-10 h-10 text-[#00B761]" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">Profile Under Review</h2>
          <p className="text-gray-500 font-medium leading-relaxed mb-8">
            Your documents and profile have been submitted successfully. It is currently under review by the admin team. We will notify you once approved.
          </p>
          <button
            onClick={() => navigate("/food/delivery/login", { replace: true })}
            className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold text-base hover:bg-black transition-all active:scale-95 shadow-lg shadow-gray-900/20"
          >
            Back to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center gap-4 border-b border-gray-200 sticky top-0 z-20">
        <button
          onClick={goBack}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors active:scale-95"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="text-base font-bold text-gray-900">Upload Documents</h1>
          <p className="text-xs text-gray-500">Step 2 of 2: Document Verification</p>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-5 max-w-md mx-auto">
        <div className="mb-5 bg-emerald-50 border border-emerald-200 rounded-xl p-3.5">
          <h2 className="text-sm font-bold text-emerald-950 mb-1">Fast & Optimized Uploads</h2>
          <p className="text-xs text-emerald-800 leading-relaxed">
            Photos are automatically compressed to under 2MB and uploaded securely one-by-one.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <DocumentUpload docType="profilePhoto" label="Profile Photo" required={true} />
          <DocumentUpload docType="aadharFrontPhoto" label="Aadhar Card (Front)" required={true} />
          <DocumentUpload docType="aadharBackPhoto" label="Aadhar Card (Back)" required={true} />
          <DocumentUpload docType="panPhoto" label="PAN Card Photo" required={true} />
          
          <DocumentUpload docType="drivingLicenseFrontPhoto" label="Driving License (Front)" required={false} />
          <DocumentUpload docType="drivingLicenseBackPhoto" label="Driving License (Back)" required={false} />
          
          <DocumentUpload docType="rcPhoto" label="RC (Registration Certificate)" required={true} />

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-4 rounded-xl font-bold text-white text-base transition-all mt-6 shadow-lg active:scale-95 ${
              isSubmitting
                ? "bg-gray-400 cursor-not-allowed shadow-none"
                : "bg-[#00B761] hover:bg-[#00A055] shadow-[#00B761]/30 cursor-pointer"
            }`}
          >
            {isSubmitting ? "Submitting Registration..." : "Complete Signup"}
          </button>
        </form>
      </div>
    </div>
  )
}
