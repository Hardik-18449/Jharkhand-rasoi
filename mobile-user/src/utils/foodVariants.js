const toArray = (value) => (Array.isArray(value) ? value : [])

export const normalizeFoodVariants = (value) =>
  toArray(value)
    .map((entry = {}, index) => {
      const id = String(entry?.id || entry?._id || `variant-${index}`)
      const name = String(entry?.name || "").trim()
      const price = Number(entry?.price)
      if (!name || !Number.isFinite(price) || price <= 0) return null

      return {
        id,
        _id: id,
        name,
        price,
      }
    })
    .filter(Boolean)

export const getFoodVariants = (item = {}) =>
  normalizeFoodVariants(item?.variants || item?.variations || [])

export const hasFoodVariants = (item = {}) => getFoodVariants(item).length > 0

export const getDefaultFoodVariant = (item = {}) => getFoodVariants(item)[0] || null

export const normalizeFoodAddons = (value) =>
  toArray(value)
    .map((entry = {}, index) => {
      const id = String(entry?.id || entry?._id || `addon-${index}`)
      const name = String(entry?.name || "").trim()
      const price = Number(entry?.price)
      if (!name || !Number.isFinite(price) || price < 0) return null

      return {
        id,
        _id: id,
        name,
        price,
      }
    })
    .filter(Boolean)

export const getFoodAddons = (item = {}) =>
  normalizeFoodAddons(item?.addons || [])

export const hasFoodAddons = (item = {}) => getFoodAddons(item).length > 0

export const getFoodDisplayPrice = (item = {}) => {
  const variants = getFoodVariants(item)
  if (variants.length > 0) {
    return Math.min(...variants.map((variant) => Number(variant.price) || 0))
  }

  const price = Number(item?.price)
  return Number.isFinite(price) ? price : 0
}

export const getFoodPriceLabel = (item = {}) => {
  const price = getFoodDisplayPrice(item)
  return hasFoodVariants(item) ? `Starting from ₹${Math.round(price)}` : `₹${Math.round(price)}`
}

export const buildCartLineId = (itemId, variantId = "", addonIds = []) => {
  const sortedAddons = Array.isArray(addonIds)
    ? [...addonIds].map(String).sort().join(",")
    : ""
  return `${String(itemId || "")}::${String(variantId || "base")}${sortedAddons ? `::${sortedAddons}` : ""}`
}
