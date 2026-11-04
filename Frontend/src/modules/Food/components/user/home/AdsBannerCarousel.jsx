import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Megaphone, ChevronLeft, ChevronRight } from "lucide-react";

export default function AdsBannerCarousel({ advertisements = [], banners = [], data = [] }) {
  // Normalize ads list: can be passed via advertisements or fallback banners/data
  const items = React.useMemo(() => {
    if (Array.isArray(advertisements) && advertisements.length > 0) {
      return advertisements.map((ad) => ({
        title: ad.title || ad.name || "",
        posterUrl: ad.posterUrl || ad.image || ad.imageUrl || "",
      })).filter((item) => Boolean(item.posterUrl));
    }

    if (Array.isArray(banners) && banners.length > 0) {
      return banners.map((banner, idx) => ({
        title: data?.[idx]?.title || data?.[idx]?.name || "Special Offer",
        posterUrl: typeof banner === "string" ? banner : banner?.url || "",
      })).filter((item) => Boolean(item.posterUrl));
    }

    return [];
  }, [advertisements, banners, data]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const autoSlideIntervalRef = useRef(null);

  const startAutoSlide = () => {
    if (autoSlideIntervalRef.current) clearInterval(autoSlideIntervalRef.current);
    if (items.length <= 1) return;
    autoSlideIntervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 4500);
  };

  useEffect(() => {
    setCurrentIndex(0);
    startAutoSlide();
    return () => {
      if (autoSlideIntervalRef.current) clearInterval(autoSlideIntervalRef.current);
    };
  }, [items.length]);

  if (items.length === 0) return null;

  const currentItem = items[currentIndex];

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % items.length);
    startAutoSlide();
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
    startAutoSlide();
  };

  return (
    <div className="px-4 py-2 my-2 select-none">
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Megaphone className="w-4 h-4 sm:w-5 sm:h-5 text-primary animate-pulse" />
          Featured Offers & Updates
        </h2>
        {items.length > 1 && (
          <div className="flex gap-1.5 items-center">
            {items.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setCurrentIndex(idx);
                  startAutoSlide();
                }}
                aria-label={`Go to slide ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentIndex ? "w-4 bg-primary" : "w-1.5 bg-gray-300 dark:bg-gray-700"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      <div 
        className="relative w-full overflow-hidden h-[140px] sm:h-[180px] md:h-[220px] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 bg-gray-100 dark:bg-gray-900 group"
      >
        {/* Shimmer effect overlay */}
        <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden rounded-2xl">
          <motion.div
            animate={{
              x: ['-200%', '200%'],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              repeatDelay: 5,
              ease: "easeInOut"
            }}
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-20deg] w-[150%] h-full"
          />
        </div>

        <AnimatePresence mode="popLayout" initial={false}>
          <motion.img
            key={currentIndex}
            src={currentItem.posterUrl}
            alt={currentItem.title || "Advertisement"}
            initial={{ opacity: 0, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => {
              e.target.src = "https://placehold.co/800x400?text=Advertisement";
            }}
          />
        </AnimatePresence>
        
        {/* Gradient overlay for text contrast */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 via-black/30 to-transparent z-[5] pointer-events-none" />

        {/* Offer / Ad Name Badge (No navigation per request) */}
        {currentItem.title && (
          <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 z-10 max-w-[85%]">
            <span className="inline-block bg-black/70 backdrop-blur-md text-white text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-lg shadow border border-white/10 truncate">
              {currentItem.title}
            </span>
          </div>
        )}

        {/* Previous / Next buttons visible on hover if multiple items */}
        {items.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex items-center justify-center"
              aria-label="Previous advertisement"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex items-center justify-center"
              aria-label="Next advertisement"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
