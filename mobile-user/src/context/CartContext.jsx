/** Port of web context/CartContext.jsx — same API and same localStorage key "cart". */
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { buildCartLineId } from "../utils/foodVariants";
import { getJSON, localStore } from "../utils/storage";
import { hasUserSession } from "../auth/session";
import { toast } from "../utils/toast";

const defaultCartContext = {
  _isProvider: false,
  cart: [],
  items: [],
  itemCount: 0,
  total: 0,
  lastAddEvent: null,
  lastRemoveEvent: null,
  addToCart: () => ({ ok: false }),
  removeFromCart: () => {},
  updateQuantity: () => {},
  getCartCount: () => 0,
  isInCart: () => false,
  getCartItem: () => null,
  clearCart: () => {},
  cleanCartForRestaurant: () => {},
  replaceCart: () => ({ ok: false, count: 0 }),
};

const CartContext = createContext(defaultCartContext);

const normalizeCartData = (rawCart) => {
  if (!Array.isArray(rawCart)) return [];
  return rawCart
    .filter((item) => item && typeof item === "object")
    .map((item, index) => {
      const parsedQuantity = Number(item.quantity);
      const parsedPrice = Number(item.price);
      const normalizedRestaurantName =
        typeof item.restaurant === "string" ? item.restaurant : typeof item.restaurant?.name === "string" ? item.restaurant.name : "";
      const normalizedRestaurantId = item.restaurantId || item.restaurant_id || item.restaurant?._id || item.restaurant?.restaurantId || null;
      const normalizedImage = item.image || item.imageUrl || item.product?.imageUrl || item.product?.image || "";
      const baseItemId = item.itemId || item.productId || item.foodId || item.baseItemId || item.menuItemId || item.id || item._id || `cart-item-${index}`;
      const variantId = item.variantId || item.variant?._id || item.variant?.id || "";
      const variantName = typeof item.variantName === "string" ? item.variantName : typeof item.variant?.name === "string" ? item.variant.name : "";
      const parsedVariantPrice = Number(item.variantPrice ?? item.variant?.price ?? item.price);
      const lineItemId = item.lineItemId || item.cartLineId || buildCartLineId(baseItemId, variantId);
      const normalizedAddons = Array.isArray(item.addons) ? item.addons : Array.isArray(item.selectedAddons) ? item.selectedAddons : [];
      return {
        ...item,
        id: lineItemId,
        lineItemId,
        itemId: String(baseItemId),
        productId: String(baseItemId),
        variantId: variantId ? String(variantId) : "",
        variantName,
        variantPrice: Number.isFinite(parsedVariantPrice) ? parsedVariantPrice : 0,
        addons: normalizedAddons,
        name: item.name || item.product?.name || "Item",
        quantity: Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? Math.floor(parsedQuantity) : 1,
        price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
        restaurant: normalizedRestaurantName,
        restaurantId: normalizedRestaurantId,
        image: normalizedImage,
        imageUrl: normalizedImage,
      };
    });
};

const resolveCartEntryId = (items, itemId, variantId = "") => {
  const normalizedItemId = String(itemId || "");
  const safeItems = Array.isArray(items) ? items : [];
  const directMatch = safeItems.find((item) => item.id === normalizedItemId);
  if (directMatch) return directMatch.id;
  const preferredId = buildCartLineId(normalizedItemId, variantId);
  const exactMatch = safeItems.find((item) => item.id === preferredId);
  if (exactMatch) return exactMatch.id;
  if (!variantId) {
    const legacyBaseMatch = safeItems.find(
      (item) => String(item.itemId || item.productId || item.id || "") === normalizedItemId && !String(item.variantId || "").trim(),
    );
    if (legacyBaseMatch) return legacyBaseMatch.id;
  }
  return preferredId;
};

const normalizeName = (name) => (name ? String(name).trim().toLowerCase() : "");

export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => normalizeCartData(getJSON("cart", [])));
  const [lastAddEvent, setLastAddEvent] = useState(null);
  const [lastRemoveEvent, setLastRemoveEvent] = useState(null);

  useEffect(() => {
    if (cart.length > 0 || hasUserSession()) localStore.setItem("cart", JSON.stringify(normalizeCartData(cart)));
  }, [cart]);

  const addToCart = (item, sourcePosition = null) => {
    if (item?.isAvailable === false || item?.isRestaurantOpen === false || item?.isOpen === false || item?.disabled === true) {
      const msg = "Restaurant is currently offline or timing is not available. Item cannot be added.";
      toast.error(msg);
      return { ok: false, error: msg, code: "RESTAURANT_CLOSED" };
    }
    const safeCart = normalizeCartData(cart);
    if (safeCart.length > 0) {
      const firstItemRestaurantId = safeCart[0]?.restaurantId;
      const firstItemRestaurantName = safeCart[0]?.restaurant;
      const firstN = normalizeName(firstItemRestaurantName);
      const newN = normalizeName(item?.restaurant);
      const hasNameMismatch = firstN && newN && firstN !== newN;
      const hasIdMismatch = !firstN && !newN && firstItemRestaurantId && item?.restaurantId && String(firstItemRestaurantId) !== String(item.restaurantId);
      if (hasNameMismatch || hasIdMismatch) {
        return {
          ok: false,
          error: `Cart already contains items from "${firstItemRestaurantName || "another restaurant"}". Please clear cart or complete order first.`,
          code: "RESTAURANT_MISMATCH",
        };
      }
    }
    if (!item?.restaurantId && !item?.restaurant) {
      return { ok: false, error: "Item is missing restaurant information. Please refresh the page.", code: "MISSING_RESTAURANT" };
    }

    setCart((prev) => {
      const safePrev = normalizeCartData(prev);
      if (safePrev.length > 0) {
        const firstN = normalizeName(safePrev[0]?.restaurant);
        const newN = normalizeName(item?.restaurant);
        if (firstN && newN) {
          if (firstN !== newN) return safePrev;
        } else if (safePrev[0]?.restaurantId && item?.restaurantId && safePrev[0].restaurantId !== item.restaurantId) {
          return safePrev;
        }
      }
      const existing = safePrev.find((i) => i.id === item.id);
      const fireAdd = () => {
        if (sourcePosition) {
          setLastAddEvent({ product: { id: item.id, name: item.name, imageUrl: item.image || item.imageUrl }, sourcePosition });
          setTimeout(() => setLastAddEvent(null), 1500);
        }
      };
      if (existing) {
        fireAdd();
        return safePrev.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      if (!item.restaurantId && !item.restaurant) return safePrev;
      fireAdd();
      return [...safePrev, { ...item, quantity: 1 }];
    });
    return { ok: true };
  };

  const fireRemove = (itemToRemove, sourcePosition, productInfo) => {
    if (itemToRemove && sourcePosition && productInfo) {
      setLastRemoveEvent({
        product: {
          id: productInfo.id || itemToRemove.id,
          name: productInfo.name || itemToRemove.name,
          imageUrl: productInfo.imageUrl || productInfo.image || itemToRemove.image || itemToRemove.imageUrl,
        },
        sourcePosition,
      });
      setTimeout(() => setLastRemoveEvent(null), 1500);
    }
  };

  const removeFromCart = (itemId, sourcePosition = null, productInfo = null) => {
    setCart((prev) => {
      const safePrev = normalizeCartData(prev);
      const resolvedItemId = resolveCartEntryId(safePrev, itemId);
      fireRemove(safePrev.find((i) => i.id === resolvedItemId), sourcePosition, productInfo);
      return safePrev.filter((i) => i.id !== resolvedItemId);
    });
  };

  const updateQuantity = (itemId, quantity, sourcePosition = null, productInfo = null) => {
    const safeCart = normalizeCartData(cart);
    const resolvedItemId = resolveCartEntryId(safeCart, itemId);
    if (quantity <= 0) {
      setCart((prev) => {
        const safePrev = normalizeCartData(prev);
        fireRemove(safePrev.find((i) => i.id === resolvedItemId), sourcePosition, productInfo);
        return safePrev.filter((i) => i.id !== resolvedItemId);
      });
      return;
    }
    setCart((prev) => {
      const safePrev = normalizeCartData(prev);
      const existingItem = safePrev.find((i) => i.id === resolvedItemId);
      if (existingItem && quantity < existingItem.quantity) fireRemove(existingItem, sourcePosition, productInfo);
      return safePrev.map((i) => (i.id === resolvedItemId ? { ...i, quantity } : i));
    });
  };

  const getCartCount = () => normalizeCartData(cart).reduce((total, item) => total + (item.quantity || 0), 0);
  const isInCart = (itemId, variantId = "") => {
    const safeCart = normalizeCartData(cart);
    return safeCart.some((i) => i.id === resolveCartEntryId(safeCart, itemId, variantId));
  };
  const getCartItem = (itemId, variantId = "") => {
    const safeCart = normalizeCartData(cart);
    return safeCart.find((i) => i.id === resolveCartEntryId(safeCart, itemId, variantId)) || null;
  };
  const clearCart = () => setCart([]);
  const replaceCart = (items) => {
    const normalizedItems = normalizeCartData(items).filter((item) => {
      const quantity = Number(item?.quantity);
      return item?.id && (item?.restaurantId || item?.restaurant) && Number.isFinite(quantity) && quantity > 0;
    });
    setCart(normalizedItems);
    return { ok: true, count: normalizedItems.length };
  };
  const cleanCartForRestaurant = (restaurantId, restaurantName) => {
    setCart((prev) => {
      const safePrev = normalizeCartData(prev);
      if (safePrev.length === 0) return safePrev;
      const targetN = normalizeName(restaurantName);
      return safePrev.filter((item) => {
        const itemN = normalizeName(item?.restaurant);
        if (targetN && itemN) return itemN === targetN;
        if (restaurantId && item?.restaurantId) return String(item.restaurantId) === String(restaurantId);
        return false;
      });
    });
  };

  // one-time cleanup of multi-restaurant carts from storage
  useEffect(() => {
    const safeCart = normalizeCartData(cart);
    if (safeCart.length !== cart.length) {
      setCart(safeCart);
      return;
    }
    if (safeCart.length === 0) return;
    const ids = [...new Set(safeCart.map((i) => i.restaurantId).filter(Boolean))];
    const names = [...new Set(safeCart.map((i) => i.restaurant).filter(Boolean))];
    const nameSet = new Set(names.map(normalizeName));
    if (ids.length > 1 || nameSet.size > 1) {
      const firstId = ids[0];
      const firstN = normalizeName(names[0]);
      setCart((prev) =>
        normalizeCartData(prev).filter((item) => {
          const itemN = normalizeName(item?.restaurant);
          if (firstN && itemN) return itemN === firstN;
          if (firstId && item?.restaurantId) return String(item.restaurantId) === String(firstId);
          return false;
        }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cartForAnimation = useMemo(() => {
    const safeCart = normalizeCartData(cart);
    return {
      items: safeCart.map((item) => ({ product: { id: item.id, name: item.name, imageUrl: item.image || item.imageUrl }, quantity: item.quantity || 1 })),
      itemCount: safeCart.reduce((t, i) => t + (i.quantity || 0), 0),
      total: safeCart.reduce((s, i) => s + (i.price || 0) * (i.quantity || 0), 0),
    };
  }, [cart]);

  const value = useMemo(
    () => ({
      _isProvider: true,
      cart,
      items: cartForAnimation.items,
      itemCount: cartForAnimation.itemCount,
      total: cartForAnimation.total,
      lastAddEvent,
      lastRemoveEvent,
      addToCart,
      removeFromCart,
      updateQuantity,
      getCartCount,
      isInCart,
      getCartItem,
      clearCart,
      cleanCartForRestaurant,
      replaceCart,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cart, cartForAnimation, lastAddEvent, lastRemoveEvent],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context || context._isProvider !== true) return defaultCartContext;
  return context;
}
