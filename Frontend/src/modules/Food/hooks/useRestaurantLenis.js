import { useEffect } from "react"

/**
 * RestaurantLayout locks document scroll; pages must not use default Lenis().
 * Native overflow on #restaurant-main-scroll handles scrolling.
 * This hook actively cleans up any rogue Lenis instance / classes and guarantees
 * smooth native scrolling on #restaurant-main-scroll and the sidebar.
 */
export default function useRestaurantLenis() {
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const main = document.getElementById("restaurant-main-scroll")

    // Remove any Lenis classes left on html or body
    html.classList.remove("lenis", "lenis-smooth", "lenis-scrolling", "lenis-stopped")
    body.classList.remove("lenis", "lenis-smooth", "lenis-scrolling", "lenis-stopped")

    // Reset any inline overrides on window or main
    if (main) {
      main.style.overflowY = "auto"
      main.style.pointerEvents = "auto"
      main.style.webkitOverflowScrolling = "touch"
    }

    return () => {
      html.classList.remove("lenis", "lenis-smooth", "lenis-scrolling", "lenis-stopped")
      body.classList.remove("lenis", "lenis-smooth", "lenis-scrolling", "lenis-stopped")
    }
  }, [])
}
