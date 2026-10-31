import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import useRestaurantLenis from "@food/hooks/useRestaurantLenis"
import { ArrowLeft, ChevronUp, ChevronDown, Clock, CheckCircle2, Store } from "lucide-react"
import { Switch } from "@food/components/ui/switch"
import { MobileTimePicker } from "@mui/x-date-pickers/MobileTimePicker"
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider"
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs"
import dayjs from "dayjs"
import { useCompanyName } from "@food/hooks/useCompanyName"
import { restaurantAPI } from "@food/api"

const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

// Helper function to convert "HH:mm" string to Date object
const stringToTime = (timeString) => {
  if (!timeString || !timeString.includes(":")) {
    return dayjs().hour(9).minute(0)
  }
  const [hours, minutes] = timeString.split(":").map(Number)
  return dayjs().hour(hours || 9).minute(minutes || 0)
}

// Helper function to convert Date object to "HH:mm" string
const timeToString = (date) => {
  if (!date || !dayjs.isDayjs(date) || !date.isValid()) {
    return "09:00"
  }
  return date.format("HH:mm")
}

// Format time from 24-hour to 12-hour format for display
const formatTime12Hour = (time24) => {
  if (!time24) return "09:00 AM"
  const [hours, minutes] = time24.split(":").map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const hours12 = hours % 12 || 12
  const minutesStr = (minutes || 0).toString().padStart(2, '0')
  return `${hours12}:${minutesStr} ${period}`
}

const getDefaultDays = () => ({
  Monday: { isOpen: true, openingTime: "09:00", closingTime: "22:00" },
  Tuesday: { isOpen: true, openingTime: "09:00", closingTime: "22:00" },
  Wednesday: { isOpen: true, openingTime: "09:00", closingTime: "22:00" },
  Thursday: { isOpen: true, openingTime: "09:00", closingTime: "22:00" },
  Friday: { isOpen: true, openingTime: "09:00", closingTime: "22:00" },
  Saturday: { isOpen: true, openingTime: "09:00", closingTime: "22:00" },
  Sunday: { isOpen: true, openingTime: "09:00", closingTime: "22:00" },
})

export default function OutletTimings() {
  const companyName = useCompanyName()
  const navigate = useNavigate()
  const [expandedDay, setExpandedDay] = useState("Monday")
  const isInternalUpdate = useRef(false)
  const [days, setDays] = useState(getDefaultDays)
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSavedTime, setLastSavedTime] = useState(null)
  const saveTimerRef = useRef(null)

  // Use native smooth scroll inside RestaurantLayout (no window scroll-jacking)
  useRestaurantLenis()

  // Load from backend on mount
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        const res = await restaurantAPI.getOutletTimings()
        const outletTimings = res?.data?.data?.outletTimings || res?.data?.outletTimings
        if (mounted && outletTimings && typeof outletTimings === "object") {
          setDays({ ...getDefaultDays(), ...outletTimings })
        }
      } catch (error) {
        debugError("Error loading outlet timings from backend:", error)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  // Save to backend whenever days change (debounced)
  useEffect(() => {
    if (loading) return
    if (!isInternalUpdate.current) return // Only save if the user made a change
    
    setIsSaving(true)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      try {
        await restaurantAPI.saveOutletTimings(days)
        window.dispatchEvent(new Event("outletTimingsUpdated"))
        setLastSavedTime(new Date())
      } catch (error) {
        debugError("Error saving outlet timings to backend:", error)
      } finally {
        setIsSaving(false)
      }
    }, 600)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [days, loading])

  const toggleDay = (day) => {
    setExpandedDay(expandedDay === day ? null : day)
  }

  const toggleDayOpen = (day) => {
    isInternalUpdate.current = true
    setDays(prev => {
      const current = prev[day] || { isOpen: true, openingTime: "09:00", closingTime: "22:00" }
      const newOpen = !current.isOpen
      return {
        ...prev,
        [day]: {
          ...current,
          isOpen: newOpen,
          openingTime: newOpen ? (current.openingTime || "09:00") : "",
          closingTime: newOpen ? (current.closingTime || "22:00") : ""
        }
      }
    })
  }

  const handleTimeChange = (day, timeType, newTime) => {
    if (!newTime) {
      debugWarn('No time value received in handleTimeChange')
      return
    }
    
    isInternalUpdate.current = true
    const timeString = timeToString(newTime)
    
    if (!timeString || !timeString.includes(":")) {
      debugWarn('Invalid time string generated:', timeString)
      return
    }
    
    debugLog(`Time changed for ${day} - ${timeType}: ${timeString}`)
    
    setDays(prev => ({
      ...prev,
      [day]: {
        ...(prev[day] || {}),
        [timeType]: timeString
      }
    }))
  }

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate("/food/restaurant")
    }
  }

  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
  const openCount = dayNames.filter(d => days[d]?.isOpen).length

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-primary rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-gray-600">Loading outlet timings...</p>
      </div>
    )
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <div className="w-full min-h-full bg-gray-50/60 pb-16">
        {/* Responsive Page Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-xs">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={handleBack}
                className="p-2 -ml-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-700 hover:text-gray-900"
                aria-label="Go back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">Outlet Timings</h1>
                <p className="text-xs text-gray-500 hidden sm:block truncate">
                  Configure operating hours for {companyName || "your restaurant"}
                </p>
              </div>
            </div>

            {/* Auto-save status indicator */}
            <div className="flex items-center gap-2 shrink-0">
              {isSaving ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  Saving...
                </span>
              ) : lastSavedTime ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Saved
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-gray-500 bg-gray-100">
                  Auto-sync active
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Content Container (Constrained width on Desktop, full width on Mobile) */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Status Overview Card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <Store className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">{companyName || "Outlet"} Operating Hours</h2>
                <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                  Customers can only place orders during your active open hours
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-center">
              <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {openCount} / 7 Days Open
              </span>
            </div>
          </div>

          {/* Day-wise Accordion Cards */}
          <div className="space-y-3">
            {dayNames.map((day, index) => {
              const dayData = days[day] || { isOpen: true, openingTime: "09:00", closingTime: "22:00" }
              const isExpanded = expandedDay === day

              return (
                <div
                  key={day}
                  className={`bg-white border rounded-2xl overflow-hidden transition-all duration-200 shadow-xs ${
                    isExpanded ? "border-gray-300 ring-1 ring-gray-200" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {/* Day Header Row */}
                  <div
                    className={`w-full flex items-center justify-between px-4 sm:px-6 py-4 cursor-pointer select-none transition-colors ${
                      isExpanded ? "bg-gray-50/70" : "hover:bg-gray-50/40"
                    }`}
                    onClick={() => toggleDay(day)}
                  >
                    <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                      <div className="text-gray-500">
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-gray-700" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="text-base font-bold text-gray-900 block truncate">{day}</span>
                        <span className="text-xs text-gray-500 block truncate mt-0.5">
                          {dayData.isOpen
                            ? `${formatTime12Hour(dayData.openingTime)} – ${formatTime12Hour(dayData.closingTime)}`
                            : "Closed all day"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 ml-3" onClick={(e) => e.stopPropagation()}>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                        dayData.isOpen
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-gray-100 text-gray-500 border border-gray-200"
                      }`}>
                        {dayData.isOpen ? "Open" : "Closed"}
                      </span>
                      <Switch
                        checked={dayData.isOpen}
                        onCheckedChange={() => toggleDayOpen(day)}
                        className="data-[state=checked]:bg-emerald-600 data-[state=unchecked]:bg-gray-300"
                        aria-label={`Toggle open status for ${day}`}
                      />
                    </div>
                  </div>

                  {/* Expanded Content with 2-Column Responsive Grid on Desktop */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden border-t border-gray-100 bg-white"
                      >
                        <div className="p-4 sm:p-6">
                          {dayData.isOpen ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                              {/* Opening Time Box */}
                              <div className="bg-gray-50/80 rounded-xl p-4 border border-gray-200/80 space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-emerald-600" />
                                  Opening Time
                                </label>
                                <div className="bg-white rounded-lg border border-gray-200 px-3 py-1.5 shadow-2xs">
                                  <MobileTimePicker
                                    value={stringToTime(dayData.openingTime)}
                                    onChange={(newValue) => {
                                      if (newValue) handleTimeChange(day, "openingTime", newValue)
                                    }}
                                    onAccept={(newValue) => {
                                      if (newValue) handleTimeChange(day, "openingTime", newValue)
                                    }}
                                    slotProps={{
                                      textField: {
                                        variant: "standard",
                                        size: "small",
                                        InputProps: { disableUnderline: true },
                                        sx: {
                                          width: "100%",
                                          "& .MuiInputBase-input": {
                                            fontSize: "15px",
                                            fontWeight: "700",
                                            color: "#111827",
                                            padding: "6px 0",
                                          },
                                        },
                                      },
                                    }}
                                    format="hh:mm a"
                                  />
                                </div>
                                <p className="text-[11px] text-gray-500 font-medium">
                                  Currently: <span className="font-bold text-gray-800">{formatTime12Hour(dayData.openingTime)}</span>
                                </p>
                              </div>

                              {/* Closing Time Box */}
                              <div className="bg-gray-50/80 rounded-xl p-4 border border-gray-200/80 space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-amber-600" />
                                  Closing Time
                                </label>
                                <div className="bg-white rounded-lg border border-gray-200 px-3 py-1.5 shadow-2xs">
                                  <MobileTimePicker
                                    value={stringToTime(dayData.closingTime)}
                                    onChange={(newValue) => {
                                      if (newValue) handleTimeChange(day, "closingTime", newValue)
                                    }}
                                    onAccept={(newValue) => {
                                      if (newValue) handleTimeChange(day, "closingTime", newValue)
                                    }}
                                    slotProps={{
                                      textField: {
                                        variant: "standard",
                                        size: "small",
                                        InputProps: { disableUnderline: true },
                                        sx: {
                                          width: "100%",
                                          "& .MuiInputBase-input": {
                                            fontSize: "15px",
                                            fontWeight: "700",
                                            color: "#111827",
                                            padding: "6px 0",
                                          },
                                        },
                                      },
                                    }}
                                    format="hh:mm a"
                                  />
                                </div>
                                <p className="text-[11px] text-gray-500 font-medium">
                                  Currently: <span className="font-bold text-gray-800">{formatTime12Hour(dayData.closingTime)}</span>
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="py-6 px-4 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-center space-y-2">
                              <p className="text-sm font-semibold text-gray-600">This outlet is marked as closed on {day}</p>
                              <button
                                type="button"
                                onClick={() => toggleDayOpen(day)}
                                className="px-4 py-1.5 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                              >
                                Reopen {day}
                              </button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </LocalizationProvider>
  )
}
