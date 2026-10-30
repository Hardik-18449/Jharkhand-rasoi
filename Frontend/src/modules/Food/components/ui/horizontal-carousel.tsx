"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { cn } from "@food/utils/utils"

interface HorizontalCarouselProps {
  children: React.ReactNode
  className?: string
  containerClassName?: string
  showControls?: boolean
  controlsPosition?: "top-right" | "top-left" | "bottom-center" | "top-center"
  header?: React.ReactNode
}

export function HorizontalCarousel({
  children,
  className,
  containerClassName,
  showControls = true,
  controlsPosition = "top-right",
  header,
}: HorizontalCarouselProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null)

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 400
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      })
    }
  }

  const controlsClass = {
    "top-right": "absolute top-0 right-0 flex items-center gap-2",
    "top-left": "absolute top-0 left-0 flex items-center gap-2",
    "bottom-center": "absolute bottom-0 left-1/2 -translate-x-1/2 flex items-center gap-2",
    "top-center": "absolute top-0 left-1/2 -translate-x-1/2 flex items-center gap-2",
  }[controlsPosition]

  return (
    <div className={cn("relative", className)}>
      {(header || showControls) && (
        <div className="flex items-center justify-between mb-4">
          {header && <div className="flex items-center gap-3">{header}</div>}
          {showControls && (
            <div className={cn("flex items-center gap-2", controlsPosition === "top-left" && "ml-auto")}>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 bg-white/90 backdrop-blur-sm shadow-lg hover:bg-white rounded-full border border-gray-200"
                onClick={() => scroll("left")}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 bg-white/90 backdrop-blur-sm shadow-lg hover:bg-white rounded-full border border-gray-200"
                onClick={() => scroll("right")}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          )}
        </div>
      )}
      <div
        ref={scrollRef}
        className={cn(
          "flex gap-5 overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth px-1 sm:px-2 py-4 sm:py-6 overscroll-x-contain",
          containerClassName
        )}
        style={{ 
          scrollbarWidth: "none", 
          msOverflowStyle: "none",
          WebkitOverflowScrolling: "touch",
          height: "min-content"
        }}
      >
        {children}
      </div>
    </div>
  )
}
