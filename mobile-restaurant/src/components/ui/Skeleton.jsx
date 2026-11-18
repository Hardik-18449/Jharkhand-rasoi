import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet } from "react-native";

/** shadcn Skeleton: bg-accent rounded animate-pulse */
export default function Skeleton({ style, width, height, radius = 8, color = "#e5e7eb" }) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[styles.base, { opacity, width, height, borderRadius: radius, backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({ base: { backgroundColor: "#e5e7eb" } });
