/** Port of components/user/StickyCartCard.jsx — floating cart FAB above the bottom nav. */
import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { ShoppingCart } from "lucide-react-native";
import Txt from "./ui/Txt";
import { useCart } from "../context/CartContext";
import { palette } from "../theme";

export default function StickyCartCard({ bottom = 24 }) {
  const router = useRouter();
  const { getCartCount } = useCart();
  const cartCount = getCartCount();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, { toValue: cartCount > 0 ? 1 : 0, stiffness: 350, damping: 24, useNativeDriver: true }).start();
  }, [cartCount, anim]);

  if (!cartCount || cartCount <= 0) return null;
  return (
    <Animated.View style={[styles.wrap, { bottom, opacity: anim, transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]}>
      <Pressable onPress={() => router.push("/cart")} style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.95 }] }]}>
        <ShoppingCart size={24} color={palette.white} />
        <Animated.View style={styles.badge}>
          <Txt weight={800} style={styles.badgeText}>
            {cartCount > 99 ? "99+" : cartCount}
          </Txt>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", right: 16, zIndex: 60 },
  fab: { width: 56, height: 56, borderRadius: 28, backgroundColor: palette.orange500, borderWidth: 2, borderColor: palette.white, alignItems: "center", justifyContent: "center", shadowColor: "#f97316", shadowOpacity: 0.45, shadowRadius: 25, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  badge: { position: "absolute", top: -4, right: -4, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: palette.black, borderWidth: 2, borderColor: palette.white, alignItems: "center", justifyContent: "center" },
  badgeText: { fontSize: 11, color: palette.white },
});
