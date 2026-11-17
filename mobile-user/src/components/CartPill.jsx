/** Port of components/user/AddToCartAnimation.jsx floating "Cart · N items" pill (fly-to-cart thumbnail kept as the pill pulse). */
import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { ShoppingCart, ChevronRight } from "lucide-react-native";
import Txt from "./ui/Txt";
import { useCart } from "../context/CartContext";
import { palette } from "../theme";

export default function CartPill({ bottom = 16 }) {
  const router = useRouter();
  const { itemCount, total } = useCart();
  const scale = useRef(new Animated.Value(1)).current;
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(enter, { toValue: itemCount > 0 ? 1 : 0, stiffness: 400, damping: 30, useNativeDriver: true }).start();
    if (itemCount > 0) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.08, duration: 150, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.04, duration: 100, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [itemCount, total, enter, scale]);

  if (itemCount <= 0) return null;
  return (
    <Animated.View pointerEvents="box-none" style={[styles.wrap, { bottom, opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }] }]}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable onPress={() => router.push("/cart")} style={styles.pill}>
          <View style={styles.icon}>
            <ShoppingCart size={14} color={palette.white} />
          </View>
          <View style={{ alignItems: "center", flex: 1 }}>
            <Txt weight={700} style={{ fontSize: 13, color: palette.white, lineHeight: 16 }}>Cart</Txt>
            <Txt weight={500} style={{ fontSize: 9, color: "rgba(255,255,255,0.9)" }}>
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </Txt>
          </View>
          <ChevronRight size={16} color={palette.white} style={{ marginLeft: 6 }} />
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 9999 },
  pill: { flexDirection: "row", alignItems: "center", minWidth: 130, paddingLeft: 8, paddingRight: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: palette.orange500, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", elevation: 8, shadowColor: "#ff6600", shadowOpacity: 0.45, shadowRadius: 15, shadowOffset: { width: 0, height: 4 } },
  icon: { backgroundColor: "rgba(255,255,255,0.2)", padding: 6, borderRadius: 999, marginRight: 10 },
});
