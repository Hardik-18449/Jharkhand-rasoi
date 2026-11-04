import React from 'react'

/**
 * PageLoader: Lightweight non-blocking fallback for route loading.
 * Shows a subtle, instant top loader bar + small centered indicator so the page never appears as a broken blank white screen.
 */
export default function PageLoader() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-xs pointer-events-none">
      <div className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-400 via-amber-500 to-orange-600 animate-pulse" />
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-full border-3 border-orange-500/20 border-t-orange-500 animate-spin" />
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wide uppercase">
          Loading...
        </span>
      </div>
    </div>
  )
}
