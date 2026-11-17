/** Falling-confetti overlay (replaces web canvas-confetti / CSS confettiFall keyframes). */
import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, Easing, StyleSheet, View } from "react-native";

const { width: SW, height: SH } = Dimensions.get("window");

export default function Confetti({ count = 40, colors = ["#FEC600", "#F59E0B", "#10B981", "#3B82F6"], size = 8, round = true, loop = true, duration = [2000, 4000] }) {
  const pieces = useRef(
    Array.from({ length: count }).map(() => ({
      left: Math.random() * SW,
      color: colors[Math.floor(Math.random() * colors.length)],
      duration: duration[0] + Math.random() * (duration[1] - duration[0]),
      delay: Math.random() * 1500,
      rot: Math.random() * 360,
      v: new Animated.Value(0),
    })),
  ).current;
  useEffect(() => {
    const anims = pieces.map((p) => {
      const seq = Animated.sequence([Animated.delay(p.delay), Animated.timing(p.v, { toValue: 1, duration: p.duration, easing: Easing.linear, useNativeDriver: true })]);
      return loop ? Animated.loop(seq) : seq;
    });
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [pieces, loop]);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 999 }]}>
      {pieces.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: "absolute",
            left: p.left,
            top: 0,
            width: size,
            height: size,
            borderRadius: round ? size : 2,
            backgroundColor: p.color,
            opacity: p.v.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
            transform: [
              { translateY: p.v.interpolate({ inputRange: [0, 1], outputRange: [-SH * 0.1, SH * 1.1] }) },
              { rotate: p.v.interpolate({ inputRange: [0, 1], outputRange: [`${p.rot}deg`, `${p.rot + 720}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}
