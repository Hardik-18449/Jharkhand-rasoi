const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]

const normalizeDay = (value) => {
  if (!value || typeof value !== "string") return null
  const trimmed = value.trim().toLowerCase()
  const match = DAY_NAMES.find((day) => day.toLowerCase() === trimmed)
  if (match) return match

  const abbreviatedMatch = DAY_NAMES.find((day) =>
    day.toLowerCase().startsWith(trimmed.slice(0, 3))
  )
  return abbreviatedMatch || null
}

const parseTimeToMinutes = (timeValue) => {
  if (!timeValue || typeof timeValue !== "string") return null
  const raw = timeValue.trim()
  if (!raw) return null

  const normalized = raw.toLowerCase()
  const meridiemMatch = normalized.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]m)$/)
  if (meridiemMatch) {
    let hour = Number(meridiemMatch[1])
    const minute = Number(meridiemMatch[2])
    const period = meridiemMatch[3]

    if (Number.isNaN(hour) || Number.isNaN(minute) || minute < 0 || minute > 59) return null

    if (period === "pm" && hour < 12) hour += 12
    if (period === "am" && hour === 12) hour = 0
    if (hour < 0 || hour > 23) return null
    return hour * 60 + minute
  }

  const twentyFourHourMatch = normalized.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (!twentyFourHourMatch) return null

  const hour = Number(twentyFourHourMatch[1])
  const minute = Number(twentyFourHourMatch[2])
  if (Number.isNaN(hour) || Number.isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null
  }

  return hour * 60 + minute
}

const getTodayTiming = (restaurant, dayName) => {
  // Format 1: Nested timings array (from separate API call: { outletTimings: { timings: [...] } })
  const outletTimingsArray = restaurant?.outletTimings?.timings
  if (Array.isArray(outletTimingsArray)) {
    const exact = outletTimingsArray.find((entry) => normalizeDay(entry?.day) === dayName)
    if (exact) return exact
  }

  // Format 2: Direct flat array from backend $lookup (outletTimings: [{day, isOpen, openingTime, closingTime}, ...])
  if (Array.isArray(restaurant?.outletTimings)) {
    const exact = restaurant.outletTimings.find((entry) => normalizeDay(entry?.day) === dayName)
    if (exact) return exact
  }

  // Format 3: Object keyed by day name ({ Monday: { isOpen, openingTime, closingTime }, ... })
  const outletTimingsObject = restaurant?.outletTimings
  if (outletTimingsObject && typeof outletTimingsObject === "object" && !Array.isArray(outletTimingsObject)) {
    const direct = outletTimingsObject[dayName]
    if (direct && typeof direct === "object") return direct
  }

  return null
}

const isWithinTimeWindow = (nowMinutes, openingMinutes, closingMinutes) => {
  if (openingMinutes === null || closingMinutes === null) return true
  if (openingMinutes === closingMinutes) return true

  if (closingMinutes > openingMinutes) {
    return nowMinutes >= openingMinutes && nowMinutes <= closingMinutes
  }

  return nowMinutes >= openingMinutes || nowMinutes <= closingMinutes
}

const getMinutesUntilClosing = (nowMinutes, openingMinutes, closingMinutes) => {
  if (openingMinutes === null || closingMinutes === null) return null
  if (!isWithinTimeWindow(nowMinutes, openingMinutes, closingMinutes)) return null

  if (closingMinutes > openingMinutes) {
    return closingMinutes - nowMinutes
  }

  if (nowMinutes <= closingMinutes) {
    return closingMinutes - nowMinutes
  }

  return (24 * 60 - nowMinutes) + closingMinutes
}

const formatTimeLabel = (timeValue) => {
  const totalMinutes = parseTimeToMinutes(timeValue)
  if (totalMinutes === null) return timeValue || null

  const hours24 = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const period = hours24 >= 12 ? "PM" : "AM"
  const hours12 = hours24 % 12 || 12

  return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`
}

const formatClosingCountdown = (minutesUntilClose, closingTime) => {
  if (minutesUntilClose === null || minutesUntilClose === undefined) return null
  if (minutesUntilClose > 120) return null // Hide if more than 2 hours remaining

  if (minutesUntilClose <= 0) {
    const closingLabel = formatTimeLabel(closingTime)
    return closingLabel ? `Closes at ${closingLabel}` : null
  }

  if (minutesUntilClose < 60) {
    return `Closes in ${minutesUntilClose} min`
  }

  const hours = Math.floor(minutesUntilClose / 60)
  const minutes = minutesUntilClose % 60

  if (minutes === 0) {
    return `Closes in ${hours}h`
  }

  return `Closes in ${hours}h ${minutes}m`
}

export const getRestaurantAvailabilityStatus = (restaurant, now = new Date(), options = {}) => {
  if (!restaurant) {
    return {
      isOpen: false,
      isActive: false,
      isAcceptingOrders: false,
      isWithinTimings: false,
      reason: "missing-restaurant",
    }
  }

  const ignoreOperationalStatus = options?.ignoreOperationalStatus === true
  const isActive = restaurant.isActive !== false
  const isAcceptingOrders = restaurant.isAcceptingOrders !== false

  if (!ignoreOperationalStatus && !isActive) {
    return {
      isOpen: false,
      isActive,
      isAcceptingOrders,
      isWithinTimings: false,
      reason: "inactive",
    }
  }

  if (!ignoreOperationalStatus && !isAcceptingOrders) {
    return {
      isOpen: false,
      isActive,
      isAcceptingOrders,
      isWithinTimings: false,
      reason: "not-accepting-orders",
    }
  }

  const dayName = DAY_NAMES[now.getDay()]
  const todayTiming = getTodayTiming(restaurant, dayName)

  // Legacy openDays can get stale; enforce only when no explicit outlet timing exists for today.
  const openDays = Array.isArray(restaurant.openDays) ? restaurant.openDays : []
  if (!todayTiming && openDays.length > 0) {
    const normalizedOpenDays = new Set(openDays.map((day) => normalizeDay(day)).filter(Boolean))
    if (normalizedOpenDays.size > 0 && !normalizedOpenDays.has(dayName)) {
      return {
        isOpen: false,
        isActive,
        isAcceptingOrders,
        isWithinTimings: false,
        reason: "closed-day",
      }
    }
  }

  if (todayTiming?.isOpen === false) {
    return {
      isOpen: false,
      isActive,
      isAcceptingOrders,
      isWithinTimings: false,
      reason: "day-closed",
    }
  }

  const openingTime =
    todayTiming?.openingTime ||
    restaurant?.deliveryTimings?.openingTime ||
    restaurant?.openingTime ||
    null
  const closingTime =
    todayTiming?.closingTime ||
    restaurant?.deliveryTimings?.closingTime ||
    restaurant?.closingTime ||
    null

  const openingMinutes = parseTimeToMinutes(openingTime)
  const closingMinutes = parseTimeToMinutes(closingTime)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const hasExplicitWindow = Boolean(openingTime || closingTime)
  // If a restaurant provides only one side of the window, treat timings as not enforced
  // (prevents accidental "offline" due to partial data).
  const isWithinTimings = hasExplicitWindow
    ? (openingMinutes !== null && closingMinutes !== null
      ? isWithinTimeWindow(nowMinutes, openingMinutes, closingMinutes)
      : true)
    : true
  const minutesUntilClose = isWithinTimings
    ? getMinutesUntilClosing(nowMinutes, openingMinutes, closingMinutes)
    : null

  return {
    isOpen: isWithinTimings,
    isActive,
    isAcceptingOrders,
    isWithinTimings,
    openingTime,
    closingTime,
    minutesUntilClose,
    closingCountdownLabel: isWithinTimings
      ? formatClosingCountdown(minutesUntilClose, closingTime)
      : null,
    reason: isWithinTimings
      ? (isAcceptingOrders ? "open" : "open-by-timings")
      : (hasExplicitWindow ? "outside-hours" : "no-timings"),
  }
}


/**
 * Calculates distance between two coordinates in kilometers using Haversine formula
 */
export const haversineDistanceKm = (lat1, lng1, lat2, lng2) => {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null
  const numLat1 = Number(lat1)
  const numLng1 = Number(lng1)
  const numLat2 = Number(lat2)
  const numLng2 = Number(lng2)
  if (!Number.isFinite(numLat1) || !Number.isFinite(numLng1) || !Number.isFinite(numLat2) || !Number.isFinite(numLng2)) return null
  if (numLat1 === 0 && numLng1 === 0) return null
  if (numLat2 === 0 && numLng2 === 0) return null

  const R = 6371 // Earth's radius in kilometers
  const dLat = ((numLat2 - numLat1) * Math.PI) / 180
  const dLng = ((numLng2 - numLng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((numLat1 * Math.PI) / 180) *
      Math.cos((numLat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export const extractAddressCoordinates = (address) => {
  if (!address) return null
  if (Array.isArray(address.location?.coordinates) && address.location.coordinates.length === 2) {
    const lng = Number(address.location.coordinates[0])
    const lat = Number(address.location.coordinates[1])
    if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
      return { lat, lng }
    }
  }
  const lat = Number(address.latitude ?? address.lat)
  const lng = Number(address.longitude ?? address.lng)
  if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
    return { lat, lng }
  }
  return null
}

export const extractRestaurantCoordinates = (restaurant) => {
  if (!restaurant) return null
  if (Array.isArray(restaurant.location?.coordinates) && restaurant.location.coordinates.length === 2) {
    const lng = Number(restaurant.location.coordinates[0])
    const lat = Number(restaurant.location.coordinates[1])
    if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
      return { lat, lng }
    }
  }
  const lat = Number(restaurant.latitude ?? restaurant.lat)
  const lng = Number(restaurant.longitude ?? restaurant.lng)
  if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
    return { lat, lng }
  }
  return null
}

/** Standard maximum food delivery radius in kilometers */
export const MAX_DELIVERY_RADIUS_KM = 30

/**
 * Checks whether an address is deliverable for a given restaurant.
 * @param {Object} address
 * @param {Object} restaurant
 * @param {number} [maxRadiusKm=MAX_DELIVERY_RADIUS_KM]
 * @returns {{ isDeliverable: boolean, distanceKm: number | null, reason: string | null }}
 */
export const checkAddressDeliverability = (address, restaurant, maxRadiusKm = MAX_DELIVERY_RADIUS_KM) => {
  if (!restaurant) return { isDeliverable: true, distanceKm: null, reason: null }
  if (!address) return { isDeliverable: false, distanceKm: null, reason: "No address selected" }

  const addrCoords = extractAddressCoordinates(address)
  const restCoords = extractRestaurantCoordinates(restaurant)

  if (addrCoords && restCoords) {
    const distanceKm = haversineDistanceKm(restCoords.lat, restCoords.lng, addrCoords.lat, addrCoords.lng)
    if (Number.isFinite(distanceKm)) {
      if (distanceKm > maxRadiusKm) {
        return {
          isDeliverable: false,
          distanceKm,
          reason: `Out of delivery zone (${distanceKm.toFixed(1)} km away). Restaurant cannot deliver here.`
        }
      }
      return {
        isDeliverable: true,
        distanceKm,
        reason: null
      }
    }
  }

  // Fallback to city check if coordinates are unavailable
  const restCity = restaurant.city ? String(restaurant.city).trim().toLowerCase() : ""
  const addrCity = address.city ? String(address.city).trim().toLowerCase() : ""
  if (restCity && addrCity && restCity !== addrCity) {
    return {
      isDeliverable: false,
      distanceKm: null,
      reason: `Out of delivery zone (${address.city}). Restaurant is located in ${restaurant.city}.`
    }
  }

  return { isDeliverable: true, distanceKm: null, reason: null }
}
