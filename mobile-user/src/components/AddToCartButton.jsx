/** Port of components/user/AddToCartButton.jsx */
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { Plus, Minus, ShoppingCart } from "lucide-react-native";
import Txt from "./ui/Txt";
import { useCart } from "../context/CartContext";
import { isModuleAuthenticated } from "../auth/session";
import { toast } from "../utils/toast";
import { palette } from "../theme";

export default function AddToCartButton({ item, style }) {
  const { addToCart, isInCart, getCartItem, updateQuantity } = useCart();
  const inCart = isInCart(item?.id);
  const cartItem = getCartItem(item?.id);
  const router = useRouter();
  const pathname = usePathname();

  const isUnavailable = item?.isAvailable === false || item?.isRestaurantOpen === false || item?.isOpen === false || item?.disabled === true;

  const handleAddToCart = () => {
    if (isUnavailable) {
      toast.error("Restaurant is currently offline or timing is not available.");
      return;
    }
    if (!isModuleAuthenticated()) {
      toast.error("Please login to add items to cart");
      router.push({ pathname: "/login", params: { from: pathname } });
      return;
    }
    addToCart(item);
  };

  if (isUnavailable) {
    return (
      <View style={[styles.closed, style]}>
        <Txt weight={700} style={{ fontSize: 12, color: palette.gray400 }}>
          Closed
        </Txt>
      </View>
    );
  }

  if (inCart) {
    return (
      <View style={[styles.qtyWrap, style]}>
        <Pressable onPress={() => updateQuantity(item.id, (cartItem?.quantity || 0) - 1)} style={styles.qtyBtn} hitSlop={6}>
          <Minus size={16} color={palette.black} />
        </Pressable>
        <Txt weight={700} style={styles.qty}>
          {cartItem?.quantity || 0}
        </Txt>
        <Pressable onPress={() => updateQuantity(item.id, (cartItem?.quantity || 0) + 1)} style={styles.qtyBtn} hitSlop={6}>
          <Plus size={16} color={palette.black} />
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable onPress={handleAddToCart} style={({ pressed }) => [styles.add, pressed && { transform: [{ scale: 0.95 }] }, style]}>
      <ShoppingCart size={16} color={palette.white} strokeWidth={2.75} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  closed: { height: 32, paddingHorizontal: 10, borderRadius: 8, backgroundColor: palette.gray100, alignItems: "center", justifyContent: "center" },
  qtyWrap: { flexDirection: "row", alignItems: "center", backgroundColor: palette.yellow, borderRadius: 6, height: 32 },
  qtyBtn: { width: 26, height: 32, alignItems: "center", justifyContent: "center" },
  qty: { minWidth: 16, textAlign: "center", fontSize: 14, color: palette.black, paddingHorizontal: 4 },
  add: { height: 32, paddingHorizontal: 12, borderRadius: 8, backgroundColor: palette.black, alignItems: "center", justifyContent: "center" },
});
