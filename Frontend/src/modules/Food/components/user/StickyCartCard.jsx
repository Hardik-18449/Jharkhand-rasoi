import { Link } from "react-router-dom"
import { ShoppingCart } from "lucide-react"
import { useCart } from "@food/context/CartContext"
import { motion, AnimatePresence } from "framer-motion"

export default function StickyCartCard() {
  const { getCartCount } = useCart()
  const cartCount = getCartCount()

  // Don't render if cart is empty
  if (!cartCount || cartCount <= 0) return null

  const cardVariants = {
    initial: {
      opacity: 0,
      scale: 0.6,
      y: 20,
    },
    animate: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 350,
        damping: 24,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.6,
      y: 20,
      transition: {
        duration: 0.2,
      },
    },
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed bottom-[calc(76px+max(env(safe-area-inset-bottom,0px),12px))] md:bottom-8 right-4 md:right-6 z-[60] flex justify-end pointer-events-none"
        initial="initial"
        animate="animate"
        exit="exit"
        variants={cardVariants}
      >
        <Link
          to="/food/user/cart"
          aria-label="View Cart"
          className="pointer-events-auto bg-orange-500 hover:bg-orange-600 shadow-[0_8px_25px_rgba(249,115,22,0.45)] border-2 border-white dark:border-zinc-800 text-white rounded-full flex items-center justify-center w-14 h-14 transition-all transform hover:scale-105 active:scale-95 group relative"
        >
          <ShoppingCart className="h-6 w-6 text-white" />
          <span className="absolute -top-1 -right-1 bg-black text-white text-[11px] font-black px-1.5 py-0.5 rounded-full min-w-[20px] h-[20px] flex items-center justify-center border-2 border-white dark:border-zinc-900 shadow-md">
            {cartCount > 99 ? "99+" : cartCount}
          </span>
        </Link>
      </motion.div>
    </AnimatePresence>
  )
}
