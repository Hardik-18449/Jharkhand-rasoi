import { Link, useLocation, useNavigate } from "react-router-dom"
import { useEffect, useState, useRef, useMemo } from "react"
import { ChevronDown, ShoppingCart, Wallet, Search, Mic, Bell, X } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import { Switch } from "@food/components/ui/switch"
import { useLocation as useLocationHook } from "@food/hooks/useLocation"
import { useCart } from "@food/context/CartContext"
import { useLocationSelector, useSearchOverlay } from "./UserLayout"
import { useProfile } from "@food/context/ProfileContext"
import { FaLocationDot } from "react-icons/fa6"
import { AnimatePresence, motion } from "framer-motion"
import { getCachedSettings, loadBusinessSettings } from "@food/utils/businessSettings"
import { getPublicLandingSettings } from "@food/api"
import { useAppLocation } from "@food/hooks/useAppLocation"
import { useAppLogo } from "@food/hooks/useAppLogo"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function DesktopNavbar({ showLogo = true }) {
    const location = useLocation()
    const navigate = useNavigate()
    const { location: userLocation, loading: locationLoading } = useLocationHook()
    const { getCartCount } = useCart()
    const { openLocationSelector } = useLocationSelector()
    const { setSearchValue } = useSearchOverlay()
    const { vegMode, setVegMode } = useProfile()
    const { zoneId } = useAppLocation()
    const [heroSearch, setHeroSearch] = useState("")
    const logoUrl = useAppLogo('user_app')
    const [companyName, setCompanyName] = useState(null)
    const [hasScrolledPastBanner, setHasScrolledPastBanner] = useState(false)
    const [under250PriceLimit, setUnder250PriceLimit] = useState(250)
    const [showDining, setShowDining] = useState(true)
    const navRef = useRef(null)
    const cartCount = getCartCount()
    

    // Show area if available, otherwise show city
    const areaName = userLocation?.area && userLocation?.area.trim() ? userLocation.area.trim() : null
    const cityName = userLocation?.city || "Indore"
    const fullAddress = userLocation?.address || userLocation?.formattedAddress || ""
    
    // Main location name: Show area
    const mainLocationName = useMemo(() => {
        let name = areaName || "Select Location"
        if (/^-?\d+(\.\d+)?$/.test(name.trim())) {
            return "Current Location"
        }
        return name
    }, [areaName])
    
    // Middle location: Show full address (base address) - Cleaned up
    const baseAddress = useMemo(() => {
        let addr = fullAddress || ""
        if (cityName) {
            addr = addr.replace(new RegExp(`,?\\s*${cityName}\\s*`, 'gi'), '').trim()
        }
        if (areaName && areaName.length > 3) {
            addr = addr.replace(new RegExp(`^${areaName},?\\s*`, 'i'), '').trim()
        }
        if (/^-?\d+\.\d+,\s*-?\\s*\d+\.\d+$/.test(fullAddress.trim()) || /^-?\d+\.\d+,\s*-?\\s*\d+\.\d+$/.test(addr.trim()) || !addr || addr === ",") {
            return "Pinpoint location"
        }
        return addr
    }, [fullAddress, cityName, areaName])
    
    // Bottom location: Show city
    const bottomCity = cityName

    const handleLocationClick = () => {
        // Open location selector overlay
        openLocationSelector()
    }

    // Check active routes - robust against trailing slashes
    const currentPath = (location.pathname || "/").replace(/\/+$/, "") || "/food/user"
    const isDining = currentPath === "/food/user/dining" || currentPath === "/food/dining"
    const isUnder250 = currentPath === "/food/user/under-250" || currentPath === "/food/under-250"
    const isProfile = currentPath.startsWith("/food/user/profile") || currentPath.startsWith("/food/profile")
    const isDelivery = !isDining && !isUnder250 && !isProfile
    const isBannerRoute = currentPath === "/food/user" || currentPath === "/food" || currentPath === "/food/user/under-250" || currentPath === "/food/under-250"
    
    // Load business settings company name
    useEffect(() => {
        const loadName = async () => {
            try {
                const cached = getCachedSettings()
                if (cached?.companyName) {
                    setCompanyName(cached.companyName)
                } else {
                    const settings = await loadBusinessSettings()
                    if (settings?.companyName) {
                        setCompanyName(settings.companyName)
                    }
                }
            } catch (error) {
                debugError('Error loading company name:', error)
            }
        }
        loadName()

        // Listen for business settings updates
        const handleSettingsUpdate = () => {
            const cached = getCachedSettings()
            if (cached?.companyName) {
                setCompanyName(cached.companyName)
            }
        }
        window.addEventListener('businessSettingsUpdated', handleSettingsUpdate)

        return () => {
            window.removeEventListener('businessSettingsUpdated', handleSettingsUpdate)
        }
    }, [])

// Scroll listener removed for performance


    // Fetch landing settings to get dynamic price limit
    useEffect(() => {
        let cancelled = false
        getPublicLandingSettings(zoneId || null)
            .then((settings) => {
                if (cancelled || !settings) return
                if (typeof settings.under250PriceLimit === 'number') {
                    setUnder250PriceLimit(settings.under250PriceLimit)
                }
                if (typeof settings.showDining === 'boolean') {
                    setShowDining(settings.showDining)
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setUnder250PriceLimit(250)
                    setShowDining(true)
                }
            })
        return () => { cancelled = true }
    }, [zoneId])

    return (
        <nav
            ref={navRef}
            className="hidden md:flex flex-col fixed top-0 left-0 right-0 z-50 py-1 bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 shadow-sm transition-colors duration-200"
        >
            {/* Top Row: Location - Search - Icons */}
            <div className="w-full border-b border-gray-100 dark:border-gray-800/80">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16 gap-4">
                        {/* Left: Logo & Location */}
                        <div className="flex items-center gap-4 lg:gap-6 flex-shrink-0">
                            {/* Logo */}
                            {showLogo && (
                                <Link to="/" className="flex items-center justify-center flex-shrink-0">
                                    {logoUrl ? (
                                        <img
                                            src={logoUrl}
                                            alt={companyName || "Company Logo"}
                                            className="h-10 w-auto md:h-14 lg:h-16 object-contain"
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none'
                                            }}
                                        />
                                    ) : (
                                        <span className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">
                                            {companyName || "Jharkhand Rasoi"}
                                        </span>
                                    )}
                                </Link>
                            )}

                            {/* Location Selector */}
                            <Button
                                variant="ghost"
                                onClick={handleLocationClick}
                                disabled={locationLoading}
                                className="h-auto px-0 py-0 hover:bg-transparent transition-colors flex-shrink-0"
                            >
                                {locationLoading ? (
                                    <span className="text-sm font-bold text-black dark:text-white">
                                        Loading...
                                    </span>
                                ) : (
                                    <div className="flex flex-col items-start min-w-0">
                                        <div className="flex items-center gap-1.5 lg:gap-2">
                                            <FaLocationDot
                                                className="h-5 w-5 lg:h-6 lg:w-6 text-black dark:text-white flex-shrink-0"
                                                fill="currentColor"
                                                strokeWidth={2}
                                            />
                                            <span className="text-sm lg:text-base font-bold text-black dark:text-white whitespace-nowrap">
                                                {mainLocationName}
                                            </span>
                                            <ChevronDown className="h-4 w-4 lg:h-5 lg:w-5 text-black dark:text-white flex-shrink-0" strokeWidth={2.5} />
                                        </div>
                                        {baseAddress && (
                                            <span className="text-[10px] lg:text-xs font-medium text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                                                {baseAddress}
                                            </span>
                                        )}
                                        <span className="text-[9px] lg:text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-none">
                                            {bottomCity}
                                        </span>
                                    </div>
                                )}
                            </Button>
                        </div>

                        {/* Center: Search Bar & Veg Mode */}
                        <div className="flex-1 max-w-2xl flex items-center gap-3 lg:gap-4">
                            {/* Search Bar (Unified single-layer padding, no double nested padding) */}
                            <div className="relative flex-1 group">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-black dark:group-focus-within:text-[#FEC600] transition-colors pointer-events-none" strokeWidth={2.5} />
                                <input
                                    type="text"
                                    value={heroSearch}
                                    onChange={(e) => {
                                        const nextValue = e.target.value
                                        setHeroSearch(nextValue)
                                        setSearchValue(nextValue)
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && heroSearch.trim()) {
                                            navigate(`/food/search?q=${encodeURIComponent(heroSearch.trim())}`)
                                        }
                                    }}
                                    placeholder="Search for restaurants, food..."
                                    className="w-full h-10 pl-10 pr-9 bg-gray-100/90 dark:bg-zinc-800/60 hover:bg-gray-100 dark:hover:bg-zinc-800 focus:bg-white dark:focus:bg-zinc-900 border border-gray-200/80 dark:border-zinc-700/80 focus:border-[#FEC600] focus:ring-2 focus:ring-[#FEC600]/25 rounded-xl text-sm font-medium text-gray-900 dark:text-white placeholder:text-gray-400 transition-all outline-none"
                                />
                                {heroSearch && (
                                    <button
                                        type="button"
                                        onClick={() => setHeroSearch("")}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-full transition-colors"
                                    >
                                        <span className="sr-only">Clear</span>
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* VEG MODE Toggle */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300 leading-none">VEG</span>
                                    <span className="text-[8px] font-bold text-gray-500 dark:text-gray-400 leading-none">MODE</span>
                                </div>
                                <Switch
                                    checked={vegMode}
                                    onCheckedChange={setVegMode}
                                    className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-gray-300 dark:data-[state=unchecked]:bg-gray-600 h-5 w-9"
                                />
                            </div>
                        </div>

                        {/* Right: Notifications, Wallet and Cart Icons */}
                        <div className="flex items-center gap-2 lg:gap-3 flex-shrink-0">
                            {/* Notifications Icon */}
                            <Link to="/food/user/notifications">
                                <Button
                                    variant="ghost"
                                    className="h-10 w-10 lg:h-12 lg:w-12 rounded-full p-0 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                    title="Notifications"
                                >
                                    <Bell className="!h-5 !w-5 lg:!h-6 lg:!w-6 text-gray-700 dark:text-gray-300" strokeWidth={2} />
                                </Button>
                            </Link>
                            {/* Wallet Icon */}
                            <Link to="/food/user/wallet">
                                <Button
                                    variant="ghost"
                                    className="h-12 w-12 lg:h-14 lg:w-14 rounded-full p-0 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                    title="Wallet"
                                >
                                    <Wallet className="!h-5 !w-5 lg:!h-6 lg:!w-6 text-gray-700 dark:text-gray-300" strokeWidth={2} />
                                </Button>
                            </Link>

                            {/* Cart Icon */}
                            <Link to="/food/user/cart">
                                <Button
                                    variant="ghost"
                                    className="relative h-12 w-12 lg:h-14 lg:w-14 rounded-full p-0 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                    title="Cart"
                                >
                                    <ShoppingCart className="!h-5 !w-5 lg:!h-6 lg:!w-6 text-gray-700 dark:text-gray-300" strokeWidth={2} />
                                    {cartCount > 0 && (
                                        <span className="absolute -top-1 -right-1 w-6 h-6 bg-[#FEC600] rounded-full flex items-center justify-center ring-2 ring-white dark:ring-gray-800">
                                            <span className="text-xs font-black text-black">{cartCount > 99 ? "99+" : cartCount}</span>
                                        </span>
                                    )}
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Row: Navigation Tabs & Veg Mode */}
            <div className="w-full pb-2">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-center h-12">
                        {/* Navigation Tabs - Centered with spacing */}
                        <div className="flex items-center space-x-24">
                            {/* Delivery Tab */}
                            <Link
                                to="/food/user/"
                                className={`flex flex-col items-center gap-1 px-2 py-1 transition-colors relative group ${isDelivery
                                    ? "text-black dark:text-white font-black"
                                    : "text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white"
                                    }`}
                            >
                                <span className="text-sm font-bold tracking-wide uppercase">Delivery</span>
                                {isDelivery && (
                                    <motion.div
                                        layoutId="navIndicator"
                                        className="absolute -bottom-3 left-0 right-0 h-0.5 bg-[#FACC15]"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ duration: 0.3 }}
                                    />
                                )}
                            </Link>

                            {/* Under 250 Tab */}
                            <Link
                                to="/food/user/under-250"
                                className={`flex flex-col items-center gap-1 px-2 py-1 transition-colors relative group ${isUnder250
                                    ? "text-black dark:text-white font-black"
                                    : "text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white"
                                    }`}
                            >
                                <span className="text-sm font-bold tracking-wide uppercase">Under ₹{under250PriceLimit}</span>
                                {isUnder250 && (
                                    <motion.div
                                        layoutId="navIndicator"
                                        className="absolute -bottom-3 left-0 right-0 h-0.5 bg-[#FACC15]"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ duration: 0.3 }}
                                    />
                                )}
                            </Link>

                            {/* Dining Tab */}
                            {showDining && (
                                <Link
                                    to="/food/user/dining"
                                    className={`flex flex-col items-center gap-1 px-2 py-1 transition-colors relative group ${isDining
                                        ? "text-black dark:text-white font-black"
                                        : "text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white"
                                        }`}
                                >
                                    <span className="text-sm font-bold tracking-wide uppercase">Dining</span>
                                    {isDining && (
                                        <motion.div
                                            layoutId="navIndicator"
                                            className="absolute -bottom-3 left-0 right-0 h-0.5 bg-[#FACC15]"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ duration: 0.3 }}
                                        />
                                    )}
                                </Link>
                            )}

                            {/* Profile Tab */}
                            <Link
                                to="/food/user/profile"
                                className={`flex flex-col items-center gap-1 px-2 py-1 transition-colors relative group ${isProfile
                                    ? "text-black dark:text-white font-black"
                                    : "text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white"
                                    }`}
                            >
                                <span className="text-sm font-bold tracking-wide uppercase">Profile</span>
                                {isProfile && (
                                    <motion.div
                                        layoutId="navIndicator"
                                        className="absolute -bottom-3 left-0 right-0 h-0.5 bg-[#FACC15]"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ duration: 0.3 }}
                                    />
                                )}
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    )
}






