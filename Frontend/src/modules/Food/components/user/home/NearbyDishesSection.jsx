import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Utensils, Sparkles, ChevronRight, Store } from "lucide-react";
import { getPublicFoods } from "@/services/api";
import AddToCartButton from "@food/components/user/AddToCartButton";
import { getRestaurantAvailabilityStatus } from "@food/utils/restaurantAvailability";
import { toast } from "sonner";

export default function NearbyDishesSection({
  zoneId,
  backendOrigin = "",
}) {
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchDishes = async () => {
      try {
        setLoading(true);
        const params = { limit: 16 };
        if (zoneId) params.zoneId = zoneId;
        const res = await getPublicFoods(params);
        const items = Array.isArray(res?.foods)
          ? res.foods
          : Array.isArray(res?.data?.foods)
          ? res.data.foods
          : [];
        if (isMounted) {
          setDishes(items.filter((item) => item?.name && item?.price > 0));
        }
      } catch (err) {
        console.warn("Failed to fetch nearby dishes:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDishes();
    return () => {
      isMounted = false;
    };
  }, [zoneId]);

  if (!loading && dishes.length === 0) {
    return null;
  }

  const resolveImg = (src) => {
    if (!src || typeof src !== "string") return "/placeholder-food.jpg";
    if (/^(https?:|\/\/|data:|blob:)/i.test(src)) return src;
    return `${backendOrigin.replace(/\/$/, "")}${src.startsWith("/") ? src : `/${src}`}`;
  };

  return (
    <section className="mt-10 mb-8 px-4 sm:px-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-950/40 text-primary">
              <Utensils className="h-4 w-4" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight">
              Popular Dishes Nearby
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Discover and order favorite dishes directly from nearby restaurants
          </p>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {[...Array(8)].map((_, idx) => (
            <div
              key={idx}
              className="h-60 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse border border-gray-200/60 dark:border-gray-800"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {dishes.map((dish) => {
            const isVeg =
              dish.foodType === "Veg" ||
              dish.isVeg === true ||
              String(dish.categoryName || "").toLowerCase().includes("veg");
            const price = Number(dish.prepaidPrice || dish.price) || 0;
            const codPrice = Number(dish.codPrice) || 0;
            const hasCashlessDiscount = codPrice > price;

            const isRestaurantOpen = dish.restaurant
              ? getRestaurantAvailabilityStatus(dish.restaurant).isOpen
              : (dish.isRestaurantOpen !== false);
            const isDishAvailable = dish.isAvailable !== false && isRestaurantOpen;

            const cartItem = {
              id: String(dish.id || dish._id),
              name: dish.name,
              price: price,
              prepaidPrice: price,
              codPrice: codPrice > 0 ? codPrice : null,
              restaurantId: String(dish.restaurantId || ""),
              restaurant: dish.restaurantName || "Restaurant",
              restaurantSlug: dish.restaurantSlug || String(dish.restaurantId || ""),
              image: dish.image,
              foodType: dish.foodType || (isVeg ? "Veg" : "Non-Veg"),
              isVeg: isVeg,
              isAvailable: isDishAvailable,
              isRestaurantOpen: isRestaurantOpen,
            };

            const restaurantUrl = `/user/restaurants/${dish.restaurantSlug || dish.restaurantId}`;

            return (
              <div
                key={dish.id || dish._id}
                className={`group flex flex-col justify-between rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-[#1a1a1a] p-3 shadow-sm hover:shadow-md transition-all duration-200 ${!isDishAvailable ? 'opacity-80' : ''}`}
              >
                <div>
                  {/* Dish Image */}
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800 mb-2.5">
                    <img
                      src={resolveImg(dish.image)}
                      alt={dish.name}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src =
                          "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=60";
                      }}
                      className={`h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 ${!isDishAvailable ? 'filter blur-[2px] grayscale' : ''}`}
                      loading="lazy"
                    />

                    {/* Veg / Non-Veg Indicator */}
                    <div className="absolute top-2 left-2 rounded bg-white/95 dark:bg-gray-900/90 p-1 shadow-sm backdrop-blur-sm z-10">
                      <span
                        className={`flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border ${
                          isVeg ? "border-green-600" : "border-red-600"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            isVeg ? "bg-green-600" : "bg-red-600"
                          }`}
                        />
                      </span>
                    </div>

                    {!isDishAvailable ? (
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center rounded-xl z-10">
                        <span className="px-2.5 py-1 rounded-full bg-black/85 text-white text-[10px] font-black uppercase tracking-wider border border-white/20 shadow-sm">
                          Closed
                        </span>
                      </div>
                    ) : (
                      hasCashlessDiscount && (
                        <span className="absolute bottom-2 left-2 rounded-md bg-emerald-600/90 text-white text-[10px] font-bold px-1.5 py-0.5 shadow-sm">
                          Save ₹{codPrice - price} online
                        </span>
                      )
                    )}
                  </div>

                  {/* Title & Restaurant */}
                  <h3
                    className="font-bold text-sm sm:text-base text-gray-900 dark:text-white line-clamp-1 leading-snug"
                    title={dish.name}
                  >
                    {dish.name}
                  </h3>

                  {dish.restaurantName && (
                    <Link
                      to={restaurantUrl}
                      className="inline-flex items-center gap-1 text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 hover:text-primary transition-colors line-clamp-1 mt-0.5"
                    >
                      <Store className="h-3 w-3 flex-shrink-0" />
                      <span>{dish.restaurantName}</span>
                    </Link>
                  )}
                </div>

                {/* Footer with Price and Add Button */}
                <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-gray-100 dark:border-gray-800/60">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm sm:text-base font-black text-gray-900 dark:text-white">
                        ₹{price}
                      </span>
                      {hasCashlessDiscount && (
                        <span className="text-[10px] text-gray-400 line-through">
                          ₹{codPrice}
                        </span>
                      )}
                    </div>
                    {hasCashlessDiscount ? (
                      <span className="block text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                        Prepaid Price
                      </span>
                    ) : (
                      codPrice > 0 && (
                        <span className="block text-[9px] text-gray-400">
                          COD: ₹{codPrice}
                        </span>
                      )
                    )}
                  </div>

                  {isDishAvailable ? (
                    <AddToCartButton item={cartItem} />
                  ) : (
                    <button
                      type="button"
                      disabled
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toast.error("Restaurant is currently offline or timing is not available.");
                      }}
                      className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-gray-500 text-xs font-bold cursor-not-allowed flex items-center gap-1 select-none"
                    >
                      <span>Closed</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
