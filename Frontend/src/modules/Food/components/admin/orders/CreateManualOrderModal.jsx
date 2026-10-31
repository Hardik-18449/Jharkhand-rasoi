import React, { useState, useEffect, useRef, useMemo, useCallback } from "react"
import {
  X,
  PhoneCall,
  Search,
  MapPin,
  UtensilsCrossed,
  Plus,
  Minus,
  Trash2,
  Loader2,
  CheckCircle2,
  Navigation,
  AlertCircle,
  Building2,
  Info,
  Clock,
  Check,
  RotateCcw,
} from "lucide-react"
import { toast } from "sonner"
import { adminAPI } from "@food/api"
import { getGoogleMapsApiKey } from "@food/utils/googleMapsApiKey"
import { Loader as GoogleMapsLoader } from "@googlemaps/js-api-loader"
import { flattenMenuItems, getMenuFromResponse } from "@food/utils/menuItems"

export default function CreateManualOrderModal({ isOpen, onClose, onOrderCreated }) {
  // Step 1: Customer Details
  const [customerPhone, setCustomerPhone] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [alternatePhone, setAlternatePhone] = useState("")
  const [isLookingUpCustomer, setIsLookingUpCustomer] = useState(false)
  const [customerLookupResult, setCustomerLookupResult] = useState(null)

  // Step 2: Location & Map
  const [landmarkSearch, setLandmarkSearch] = useState("")
  const [streetAddress, setStreetAddress] = useState("")
  const [landmarkNotes, setLandmarkNotes] = useState("")
  const [city, setCity] = useState("Ranchi")
  const [stateName, setStateName] = useState("Jharkhand")
  const [zipCode, setZipCode] = useState("")
  const [coordinates, setCoordinates] = useState([85.3096, 23.3441]) // [lng, lat]
  const [isMapLoading, setIsMapLoading] = useState(true)
  const [mapError, setMapError] = useState(null)

  const mapContainerRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markerRef = useRef(null)
  const autocompleteInputRef = useRef(null)
  const autocompleteRef = useRef(null)
  const geocoderRef = useRef(null)

  // Step 3: Restaurant Selection
  const [restaurants, setRestaurants] = useState([])
  const [isLoadingRestaurants, setIsLoadingRestaurants] = useState(false)
  const [restaurantSearch, setRestaurantSearch] = useState("")
  const [selectedRestaurant, setSelectedRestaurant] = useState(null)

  // Step 4: Menu Items & Cart
  const [menuItems, setMenuItems] = useState([])
  const [isLoadingMenu, setIsLoadingMenu] = useState(false)
  const [dishSearch, setDishSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [cartItems, setCartItems] = useState([]) // [{ item, quantity, notes }]

  // Step 5: Pricing & Submission
  const [isCalculatingPricing, setIsCalculatingPricing] = useState(false)
  const [pricingBreakdown, setPricingBreakdown] = useState(null)
  const [orderNote, setOrderNote] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ----------------------------------------------------
  // 1. Initial Load: Fetch Restaurants & Google Maps API
  // ----------------------------------------------------
  useEffect(() => {
    if (!isOpen) return

    let cancelled = false

    const loadData = async () => {
      // 1. Fetch Approved Restaurants
      try {
        setIsLoadingRestaurants(true)
        const res = await adminAPI.getRestaurants({ status: "approved" })
        if (!cancelled && res?.data?.data?.restaurants) {
          setRestaurants(res.data.data.restaurants)
        } else if (!cancelled && Array.isArray(res?.data?.restaurants)) {
          setRestaurants(res.data.restaurants)
        }
      } catch (err) {
        if (!cancelled) {
          toast.error("Failed to load restaurants list")
        }
      } finally {
        if (!cancelled) setIsLoadingRestaurants(false)
      }

      // 2. Load Google Maps
      try {
        setIsMapLoading(true)
        const apiKey = await getGoogleMapsApiKey()
        if (!apiKey) {
          setMapError("Google Maps API key not configured")
          setIsMapLoading(false)
          return
        }

        const loader = new GoogleMapsLoader({
          apiKey,
          version: "weekly",
          libraries: ["places", "geometry"],
        })
        await loader.load()

        if (!cancelled) {
          initGoogleMap()
        }
      } catch (err) {
        if (!cancelled) {
          setMapError("Failed to initialize Google Maps")
          setIsMapLoading(false)
        }
      }
    }

    loadData()

    return () => {
      cancelled = true
    }
  }, [isOpen])

  // ----------------------------------------------------
  // 2. Initialize Interactive Google Map & Autocomplete
  // ----------------------------------------------------
  const initGoogleMap = useCallback(() => {
    if (!mapContainerRef.current || !window.google?.maps) return

    const initialCenter = { lat: coordinates[1], lng: coordinates[0] }

    const map = new window.google.maps.Map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 14,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: true,
    })
    mapInstanceRef.current = map
    geocoderRef.current = new window.google.maps.Geocoder()

    // Add Draggable Pin Marker
    const marker = new window.google.maps.Marker({
      position: initialCenter,
      map,
      draggable: true,
      title: "Delivery Location (Drag to adjust)",
      animation: window.google.maps.Animation.DROP,
    })
    markerRef.current = marker

    // Marker Dragend Event
    marker.addListener("dragend", () => {
      const pos = marker.getPosition()
      if (!pos) return
      const lat = pos.lat()
      const lng = pos.lng()
      setCoordinates([lng, lat])
      reverseGeocode(lat, lng)
    })

    // Map Click Event (click to move pin)
    map.addListener("click", (e) => {
      if (!e.latLng) return
      const lat = e.latLng.lat()
      const lng = e.latLng.lng()
      marker.setPosition({ lat, lng })
      setCoordinates([lng, lat])
      reverseGeocode(lat, lng)
    })

    // Setup Places Autocomplete on Landmark Input
    if (autocompleteInputRef.current && window.google?.maps?.places) {
      const autocomplete = new window.google.maps.places.Autocomplete(
        autocompleteInputRef.current,
        {
          componentRestrictions: { country: "in" },
          fields: ["geometry", "formatted_address", "address_components", "name"],
        }
      )
      autocompleteRef.current = autocomplete

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace()
        if (!place || !place.geometry?.location) {
          toast.error("Please select a valid landmark from suggestions")
          return
        }

        const lat = place.geometry.location.lat()
        const lng = place.geometry.location.lng()

        map.setCenter({ lat, lng })
        map.setZoom(16)
        marker.setPosition({ lat, lng })
        setCoordinates([lng, lat])
        setStreetAddress(place.formatted_address || place.name || "")

        // Extract city, state, zip from place details
        if (place.address_components) {
          parseAddressComponents(place.address_components)
        }
      })
    }

    setIsMapLoading(false)
  }, [coordinates])

  // Helper: Reverse Geocode Coordinates to Address
  const reverseGeocode = (lat, lng) => {
    if (!geocoderRef.current) return
    geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === "OK" && results?.[0]) {
        const res = results[0]
        setStreetAddress(res.formatted_address || "")
        if (res.address_components) {
          parseAddressComponents(res.address_components)
        }
      }
    })
  }

  // Helper: Parse Google Address Components
  const parseAddressComponents = (components) => {
    let parsedCity = ""
    let parsedState = ""
    let parsedZip = ""
    components.forEach((c) => {
      if (c.types.includes("locality") || c.types.includes("administrative_area_level_2")) {
        if (!parsedCity) parsedCity = c.long_name
      }
      if (c.types.includes("administrative_area_level_1")) {
        parsedState = c.long_name
      }
      if (c.types.includes("postal_code")) {
        parsedZip = c.long_name
      }
    })
    if (parsedCity) setCity(parsedCity)
    if (parsedState) setStateName(parsedState)
    if (parsedZip) setZipCode(parsedZip)
  }

  // ----------------------------------------------------
  // 3. Customer Mobile Number Auto-Lookup
  // ----------------------------------------------------
  const handlePhoneChange = async (e) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 10)
    setCustomerPhone(val)

    if (val.length === 10) {
      try {
        setIsLookingUpCustomer(true)
        const res = await adminAPI.lookupCustomer(val)
        if (res?.data?.success && res.data.data?.exists) {
          const cust = res.data.data.customer
          setCustomerLookupResult(cust)
          if (!customerName && cust.name) {
            setCustomerName(cust.name)
          }
        } else {
          setCustomerLookupResult(null)
        }
      } catch (err) {
        // silent fail on lookup
      } finally {
        setIsLookingUpCustomer(false)
      }
    } else {
      setCustomerLookupResult(null)
    }
  }

  // Quick Apply Past Address
  const applyRecentAddress = (addr) => {
    if (!addr) return
    if (addr.street) setStreetAddress(addr.street)
    if (addr.additionalDetails) setLandmarkNotes(addr.additionalDetails)
    if (addr.city) setCity(addr.city)
    if (addr.state) setStateName(addr.state)
    if (addr.zipCode) setZipCode(addr.zipCode)

    if (addr.location?.coordinates?.length === 2) {
      const [lng, lat] = addr.location.coordinates
      setCoordinates([lng, lat])
      if (mapInstanceRef.current && markerRef.current) {
        mapInstanceRef.current.setCenter({ lat, lng })
        mapInstanceRef.current.setZoom(16)
        markerRef.current.setPosition({ lat, lng })
      }
    }
    toast.success("Applied customer's saved address!")
  }

  // ----------------------------------------------------
  // 4. Restaurant & Menu Fetching
  // ----------------------------------------------------
  const handleSelectRestaurant = async (restaurant) => {
    setSelectedRestaurant(restaurant)
    setCartItems([])
    setPricingBreakdown(null)

    // Center map around restaurant if customer hasn't dragged pin yet
    if (restaurant.location?.coordinates?.length === 2 && streetAddress === "") {
      const [rLng, rLat] = restaurant.location.coordinates
      setCoordinates([rLng, rLat])
      if (mapInstanceRef.current && markerRef.current) {
        mapInstanceRef.current.setCenter({ lat: rLat, lng: rLng })
        markerRef.current.setPosition({ lat: rLat, lng: rLng })
      }
    }

    try {
      setIsLoadingMenu(true)
      const res = await adminAPI.getRestaurantMenuById(restaurant._id)
      const rawMenu = getMenuFromResponse(res)
      const items = flattenMenuItems(rawMenu)
      setMenuItems(items)
      if (items.length === 0) {
        toast.warning("This restaurant currently has no active dishes listed")
      }
    } catch (err) {
      toast.error("Failed to load restaurant menu")
      setMenuItems([])
    } finally {
      setIsLoadingMenu(false)
    }
  }

  // Filtered Restaurants
  const filteredRestaurants = useMemo(() => {
    const q = restaurantSearch.trim().toLowerCase()
    if (!q) return restaurants
    return restaurants.filter(
      (r) =>
        r.restaurantName?.toLowerCase().includes(q) ||
        r.address?.city?.toLowerCase().includes(q)
    )
  }, [restaurants, restaurantSearch])

  // Categories in current menu
  const menuCategories = useMemo(() => {
    const cats = new Set(["All"])
    menuItems.forEach((item) => {
      if (item.category) cats.add(item.category)
    })
    return Array.from(cats)
  }, [menuItems])

  // Filtered dishes
  const filteredDishes = useMemo(() => {
    let list = menuItems
    if (selectedCategory !== "All") {
      list = list.filter((item) => item.category === selectedCategory)
    }
    if (dishSearch.trim()) {
      const q = dishSearch.trim().toLowerCase()
      list = list.filter((item) => item.name?.toLowerCase().includes(q))
    }
    return list
  }, [menuItems, selectedCategory, dishSearch])

  // ----------------------------------------------------
  // 5. Cart Actions
  // ----------------------------------------------------
  const handleAddToCart = (dish) => {
    setCartItems((prev) => {
      const existing = prev.find((c) => c.item.id === dish.id)
      if (existing) {
        return prev.map((c) =>
          c.item.id === dish.id ? { ...c, quantity: c.quantity + 1 } : c
        )
      }
      return [...prev, { item: dish, quantity: 1, notes: "" }]
    })
  }

  const handleUpdateQuantity = (dishId, delta) => {
    setCartItems((prev) =>
      prev
        .map((c) => {
          if (c.item.id === dishId) {
            const nextQty = c.quantity + delta
            return nextQty > 0 ? { ...c, quantity: nextQty } : null
          }
          return c
        })
        .filter(Boolean)
    )
  }

  const handleRemoveFromCart = (dishId) => {
    setCartItems((prev) => prev.filter((c) => c.item.id !== dishId))
  }

  const handleUpdateItemNote = (dishId, notes) => {
    setCartItems((prev) =>
      prev.map((c) => (c.item.id === dishId ? { ...c, notes } : c))
    )
  }

  // ----------------------------------------------------
  // 6. Live Pricing Calculation (Debounced)
  // ----------------------------------------------------
  useEffect(() => {
    if (!selectedRestaurant || cartItems.length === 0) {
      setPricingBreakdown(null)
      return
    }

    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        setIsCalculatingPricing(true)
        const itemsPayload = cartItems.map((c) => ({
          itemId: c.item.id,
          name: c.item.name,
          price: Number(c.item.price) || 0,
          quantity: c.quantity,
          isVeg: c.item.foodType?.toLowerCase() === "veg",
          notes: c.notes || "",
        }))

        const payload = {
          items: itemsPayload,
          restaurantId: selectedRestaurant._id,
          deliveryAddress: {
            location: {
              type: "Point",
              coordinates: [coordinates[0], coordinates[1]],
            },
          },
        }

        const res = await adminAPI.calculateManualOrder(payload)
        if (!cancelled && res?.data?.data) {
          setPricingBreakdown(res.data.data)
        }
      } catch (err) {
        // Fallback local calculation if backend calculation fails
        const subtotal = cartItems.reduce(
          (sum, c) => sum + (Number(c.item.price) || 0) * c.quantity,
          0
        )
        if (!cancelled) {
          setPricingBreakdown({
            subtotal,
            deliveryFee: 40,
            packagingFee: 15,
            tax: Math.round(subtotal * 0.05),
            total: subtotal + 40 + 15 + Math.round(subtotal * 0.05),
          })
        }
      } finally {
        if (!cancelled) setIsCalculatingPricing(false)
      }
    }, 350)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [selectedRestaurant, cartItems, coordinates])

  // ----------------------------------------------------
  // 7. Order Placement (COD Only)
  // ----------------------------------------------------
  const handlePlaceOrder = async () => {
    if (!customerPhone || customerPhone.length !== 10) {
      toast.error("Please enter a valid 10-digit mobile number")
      return
    }
    if (!customerName.trim()) {
      toast.error("Please enter the customer's full name")
      return
    }
    if (!streetAddress.trim()) {
      toast.error("Please search landmark or select location on map")
      return
    }
    if (!selectedRestaurant) {
      toast.error("Please select a restaurant")
      return
    }
    if (cartItems.length === 0) {
      toast.error("Please add at least one dish to the order")
      return
    }

    try {
      setIsSubmitting(true)

      const itemsPayload = cartItems.map((c) => ({
        itemId: c.item.id,
        name: c.item.name,
        price: Number(c.item.price) || 0,
        quantity: c.quantity,
        isVeg: c.item.foodType?.toLowerCase() === "veg",
        notes: c.notes || "",
      }))

      const payload = {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        restaurantId: selectedRestaurant._id,
        items: itemsPayload,
        address: {
          label: "Home",
          fullName: customerName.trim(),
          name: customerName.trim(),
          phone: customerPhone.trim(),
          street: streetAddress.trim(),
          additionalDetails: landmarkNotes.trim(),
          city: city || "Ranchi",
          state: stateName || "Jharkhand",
          zipCode: zipCode || "",
          location: {
            type: "Point",
            coordinates: [Number(coordinates[0]), Number(coordinates[1])],
          },
        },
        note: orderNote.trim()
          ? `[Phone Call Order] ${orderNote.trim()}`
          : "[Phone Call Order placed via Admin Dashboard]",
      }

      const res = await adminAPI.createManualOrder(payload)
      if (res?.data?.success) {
        toast.success("Phone order booked successfully! (Cash on Delivery)")
        onOrderCreated?.(res.data.data?.order || res.data.data)
        onClose()
      } else {
        toast.error(res?.data?.message || "Failed to place order")
      }
    } catch (err) {
      const errMsg =
        err?.response?.data?.message || err?.message || "Failed to place phone order"
      toast.error(errMsg)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-950 rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/70 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FEC600] flex items-center justify-center text-black shadow-sm">
              <PhoneCall className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                New Tele-Order (Phone-in Booking)
                <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                  COD Only
                </span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Create order for offline customer calling via phone • Pay on Delivery
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: 2 Columns */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Customer Details & Map Location (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            {/* Card 1: Caller Details */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-gray-200 dark:border-zinc-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <PhoneCall className="w-3.5 h-3.5 text-[#FEC600]" />
                  1. Customer Details
                </span>
                {customerLookupResult && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 border border-green-200">
                    <CheckCircle2 className="w-3 h-3 text-green-600" />
                    Returning Customer
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Mobile Number with live lookup */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">
                    Mobile Number*
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500">
                      +91
                    </span>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={handlePhoneChange}
                      placeholder="98765 43210"
                      maxLength={10}
                      className="w-full pl-11 pr-8 py-2 text-sm rounded-lg border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#FEC600] focus:border-[#FEC600]"
                    />
                    {isLookingUpCustomer && (
                      <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Customer Full Name */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">
                    Customer Full Name*
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter customer name"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#FEC600] focus:border-[#FEC600]"
                  />
                </div>
              </div>

              {/* Past Addresses Suggestions for Returning Customer */}
              {customerLookupResult?.recentAddresses?.length > 0 && (
                <div className="pt-2 border-t border-gray-100 dark:border-zinc-800">
                  <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 block mb-1.5">
                    Saved / Previous Addresses (Click to use):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {customerLookupResult.recentAddresses.slice(0, 3).map((addr, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => applyRecentAddress(addr)}
                        className="px-2.5 py-1 text-xs font-medium rounded-lg bg-gray-100 hover:bg-[#FEC600]/20 hover:border-[#FEC600] border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 text-gray-800 dark:text-gray-200 text-left transition-all active:scale-95 cursor-pointer max-w-full truncate"
                      >
                        📍 {addr.street || addr.additionalDetails || "Saved Address"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Card 2: Landmark Search & Interactive Map */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-gray-200 dark:border-zinc-800 shadow-sm space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#FEC600]" />
                  2. Landmark Search & Map Pin Drop
                </span>
                <span className="text-[11px] font-normal text-gray-500">
                  Drag pin to exact customer spot
                </span>
              </span>

              {/* Landmark Autocomplete Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  ref={autocompleteInputRef}
                  type="text"
                  value={landmarkSearch}
                  onChange={(e) => setLandmarkSearch(e.target.value)}
                  placeholder="Search Landmark, Colony, Chowk, Temple, Road..."
                  className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FEC600] focus:border-[#FEC600]"
                />
              </div>

              {/* Map Container */}
              <div className="relative w-full h-[220px] rounded-xl overflow-hidden border border-gray-200 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800">
                <div ref={mapContainerRef} className="w-full h-full" />
                {isMapLoading && (
                  <div className="absolute inset-0 bg-white/80 dark:bg-zinc-900/80 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-[#FEC600]" />
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                      Loading Map...
                    </span>
                  </div>
                )}
                {mapError && (
                  <div className="absolute inset-0 bg-amber-50/95 dark:bg-amber-950/90 flex flex-col items-center justify-center p-4 text-center">
                    <AlertCircle className="w-6 h-6 text-amber-600 mb-1" />
                    <span className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                      {mapError}
                    </span>
                    <span className="text-[10px] text-amber-700 mt-1">
                      You can still type the address manually below.
                    </span>
                  </div>
                )}
                {/* Floating Map Tip */}
                <div className="absolute bottom-2 left-2 z-10 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-md text-[10px] font-bold text-white shadow pointer-events-none flex items-center gap-1.5">
                  <Navigation className="w-3 h-3 text-[#FEC600]" />
                  Drag marker or click map to move delivery pin
                </div>
              </div>

              {/* Selected Street Address (Auto-filled from Pin) */}
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">
                  Selected Delivery Address (Auto-filled from Map Pin)*
                </label>
                <input
                  type="text"
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  placeholder="Address will be captured from map pin"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#FEC600]"
                />
              </div>

              {/* Specific Landmark Notes from Caller */}
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">
                  Specific Landmark Notes / Caller Directions
                </label>
                <input
                  type="text"
                  value={landmarkNotes}
                  onChange={(e) => setLandmarkNotes(e.target.value)}
                  placeholder="e.g. Opposite Durga Mandir, Yellow gate, House #14, 2nd floor"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FEC600]"
                />
              </div>

              {/* Coordinates Preview */}
              <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 pt-1">
                <span>
                  Pin Coordinates: Lat: {coordinates[1]?.toFixed(5)}, Lng:{" "}
                  {coordinates[0]?.toFixed(5)}
                </span>
                <span>City: {city}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Restaurant, Menu Items & Cart (5 cols) */}
          <div className="lg:col-span-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              {/* Card 3: Restaurant Selector */}
              <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-gray-200 dark:border-zinc-800 shadow-sm space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#FEC600]" />
                  3. Select Restaurant
                </span>

                <div className="relative">
                  <select
                    value={selectedRestaurant?._id || ""}
                    onChange={(e) => {
                      const found = restaurants.find((r) => r._id === e.target.value)
                      if (found) handleSelectRestaurant(found)
                    }}
                    disabled={isLoadingRestaurants}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#FEC600]"
                  >
                    <option value="">-- Choose Restaurant --</option>
                    {filteredRestaurants.map((rest) => (
                      <option key={rest._id} value={rest._id}>
                        {rest.restaurantName}{" "}
                        {rest.pureVegRestaurant ? "(Pure Veg)" : ""}{" "}
                        {rest.address?.city ? `• ${rest.address.city}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Card 4: Menu Items & Cart */}
              {selectedRestaurant && (
                <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-gray-200 dark:border-zinc-800 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                      <UtensilsCrossed className="w-3.5 h-3.5 text-[#FEC600]" />
                      4. Menu & Dishes
                    </span>
                    <span className="text-xs font-bold text-gray-500">
                      {menuItems.length} dishes available
                    </span>
                  </div>

                  {/* Dish Search */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="text"
                      value={dishSearch}
                      onChange={(e) => setDishSearch(e.target.value)}
                      placeholder="Search dish name..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FEC600]"
                    />
                  </div>

                  {/* Category Pills */}
                  {menuCategories.length > 1 && (
                    <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
                      {menuCategories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
                            selectedCategory === cat
                              ? "bg-[#FEC600] text-black"
                              : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Dishes Scrollable List */}
                  <div className="max-h-[160px] overflow-y-auto space-y-1.5 pr-1 border-t border-b border-gray-100 dark:border-zinc-800 py-1.5">
                    {isLoadingMenu ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="w-5 h-5 animate-spin text-[#FEC600]" />
                      </div>
                    ) : filteredDishes.length === 0 ? (
                      <div className="text-center py-4 text-xs text-gray-400">
                        No dishes found
                      </div>
                    ) : (
                      filteredDishes.map((dish) => {
                        const inCart = cartItems.find((c) => c.item.id === dish.id)
                        const isVeg = dish.foodType?.toLowerCase() === "veg"
                        return (
                          <div
                            key={dish.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-zinc-800/60 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              {/* Veg / Non-Veg dot */}
                              <div
                                className={`w-3.5 h-3.5 border flex items-center justify-center rounded-sm flex-shrink-0 ${
                                  isVeg ? "border-green-600" : "border-red-600"
                                }`}
                              >
                                <div
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    isVeg ? "bg-green-600" : "bg-red-600"
                                  }`}
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                  {dish.name}
                                </p>
                                <p className="text-[11px] font-extrabold text-[#FEC600] dark:text-[#FEC600]">
                                  ₹{dish.price}
                                </p>
                              </div>
                            </div>

                            {/* Quantity Controls */}
                            {inCart ? (
                              <div className="flex items-center gap-1.5 bg-[#FEC600] px-1.5 py-0.5 rounded-md">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateQuantity(dish.id, -1)}
                                  className="w-5 h-5 flex items-center justify-center text-black font-bold hover:bg-black/10 rounded"
                                >
                                  <Minus className="w-3 h-3 stroke-[3]" />
                                </button>
                                <span className="text-xs font-black text-black px-1">
                                  {inCart.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateQuantity(dish.id, 1)}
                                  className="w-5 h-5 flex items-center justify-center text-black font-bold hover:bg-black/10 rounded"
                                >
                                  <Plus className="w-3 h-3 stroke-[3]" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAddToCart(dish)}
                                className="px-2.5 py-1 rounded-md bg-white dark:bg-zinc-700 border border-gray-200 dark:border-zinc-600 text-xs font-extrabold text-black dark:text-white hover:bg-[#FEC600] hover:border-[#FEC600] hover:text-black transition-all active:scale-95 cursor-pointer flex-shrink-0"
                              >
                                + Add
                              </button>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>

                  {/* Cart Summary */}
                  {cartItems.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                        Order Basket ({cartItems.length} items):
                      </span>
                      <div className="space-y-1 max-h-[110px] overflow-y-auto pr-1">
                        {cartItems.map((c) => (
                          <div
                            key={c.item.id}
                            className="flex items-center justify-between text-xs py-1 border-b border-gray-100 dark:border-zinc-800"
                          >
                            <span className="font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[150px]">
                              {c.quantity}x {c.item.name}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-gray-900 dark:text-white">
                                ₹{(Number(c.item.price) || 0) * c.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveFromCart(c.item.id)}
                                className="text-red-500 hover:text-red-700 p-0.5 rounded cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Card 5: Bill Breakdown & Order Placement */}
            <div className="bg-gray-50 dark:bg-zinc-900 rounded-xl p-4 border border-gray-200 dark:border-zinc-800 space-y-3">
              {/* Billing Breakdown */}
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Item Subtotal:</span>
                  <span className="font-bold">
                    ₹{pricingBreakdown?.subtotal ?? 0}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>
                    Delivery Fee{" "}
                    {pricingBreakdown?.distanceKm
                      ? `(${pricingBreakdown.distanceKm.toFixed(1)} km)`
                      : ""}:
                  </span>
                  <span className="font-bold">
                    ₹{pricingBreakdown?.deliveryFee ?? 0}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Taxes & Packaging:</span>
                  <span className="font-bold">
                    ₹
                    {(pricingBreakdown?.tax || 0) +
                      (pricingBreakdown?.packagingFee || 0)}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-black text-gray-900 dark:text-white pt-2 border-t border-gray-200 dark:border-zinc-700">
                  <span>Total Amount (COD):</span>
                  <span className="text-base text-black dark:text-[#FEC600]">
                    ₹{pricingBreakdown?.total ?? 0}
                  </span>
                </div>
              </div>

              {/* Payment Mode (COD only badge) */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60">
                <span className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  💵 Payment Mode:
                </span>
                <span className="px-2 py-0.5 rounded-md text-xs font-black bg-[#FEC600] text-black">
                  Cash on Delivery (COD)
                </span>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-zinc-700 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePlaceOrder}
                  disabled={
                    isSubmitting ||
                    cartItems.length === 0 ||
                    !selectedRestaurant ||
                    !customerPhone ||
                    !customerName
                  }
                  className="flex-[2] py-2.5 rounded-xl bg-[#FEC600] hover:bg-[#e5b300] disabled:opacity-50 text-black font-extrabold text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                      Booking Order...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3] text-black" />
                      Place COD Order (₹{pricingBreakdown?.total ?? 0})
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
