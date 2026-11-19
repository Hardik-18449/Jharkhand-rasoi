/**
 * Animated launch splash ("delivery rider" theme) shown after the native logo splash while the app boots.
 * White background (logo artwork is on white) → logo pops in with a pulsing yellow glow, food items drop one by one
 * into a bouncing shopping bag, a delivery bike rides along a dashed road, "Gearing up for your next delivery…" with
 * animated dots and a yellow progress bar. Shown for at least MIN_MS, then fades out (onDone).
 */
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, View } from "react-native";
import { Bike, ShoppingBag, Pizza, Hamburger, IceCreamCone, Soup, Coffee } from "lucide-react-native";
import Txt from "./ui/Txt";
import { palette } from "../theme";

const logo = require("../../assets/splash-icon.png");
const MIN_MS = 2400;
const BRAND = "#FEC600"; // delivery header yellow
const FOODS = [Pizza, Hamburger, Soup, IceCreamCone, Coffee];
const STEP_MS = 420;

export default function AppSplash({ ready, onDone }) {
  const [minElapsed, setMinElapsed] = useState(false);
  const [dots, setDots] = useState(1);
  const [foodIndex, setFoodIndex] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.6)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const drop = useRef(new Animated.Value(0)).current;
  const bagBounce = useRef(new Animated.Value(0)).current;
  const ride = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoScale, { toValue: 1, friction: 5, tension: 70, useNativeDriver: true }),
      Animated.timing(logoOpacity, { toValue: 1, duration: 420, useNativeDriver: true }),
    ]).start();
    const g = Animated.loop(Animated.sequence([Animated.timing(glow, { toValue: 1, duration: 1100, useNativeDriver: true }), Animated.timing(glow, { toValue: 0, duration: 1100, useNativeDriver: true })]));
    const r = Animated.loop(Animated.timing(ride, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }));
    g.start();
    r.start();
    Animated.timing(progress, { toValue: 0.85, duration: MIN_MS, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    const t = setTimeout(() => setMinElapsed(true), MIN_MS);
    const d = setInterval(() => setDots((x) => (x % 3) + 1), 420);
    return () => {
      g.stop();
      r.stop();
      clearTimeout(t);
      clearInterval(d);
    };
  }, [logoScale, logoOpacity, glow, ride, progress]);

  // Food drops into the bag one after another; bag bounces on each landing
  useEffect(() => {
    drop.setValue(0);
    const a = Animated.sequence([
      Animated.timing(drop, { toValue: 1, duration: STEP_MS - 60, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.sequence([Animated.timing(bagBounce, { toValue: 1, duration: 90, useNativeDriver: true }), Animated.spring(bagBounce, { toValue: 0, friction: 3, useNativeDriver: true })]),
    ]);
    a.start(() => setFoodIndex((i) => (i + 1) % FOODS.length));
    return () => a.stop();
  }, [foodIndex, drop, bagBounce]);

  useEffect(() => {
    if (!ready || !minElapsed) return;
    Animated.timing(progress, { toValue: 1, duration: 250, useNativeDriver: false }).start(() => {
      Animated.timing(fade, { toValue: 0, duration: 380, useNativeDriver: true }).start(() => onDone?.());
    });
  }, [ready, minElapsed, progress, fade, onDone]);

  const Food = FOODS[foodIndex];
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: fade }]} pointerEvents="none">
      <View style={styles.center}>
        <Animated.View style={[styles.glow, { opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.55] }), transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] }) }] }]} />
        <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
          <Image source={logo} style={styles.logo} resizeMode="contain" />
        </Animated.View>
      </View>

      <View style={styles.bagArea}>
        <Animated.View
          style={[
            styles.food,
            {
              opacity: drop.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 1, 1, 0] }),
              transform: [{ translateY: drop.interpolate({ inputRange: [0, 1], outputRange: [-34, 26] }) }, { rotate: drop.interpolate({ inputRange: [0, 1], outputRange: ["-20deg", "15deg"] }) }],
            },
          ]}
        >
          <Food size={22} color="#ea580c" strokeWidth={2} />
        </Animated.View>
        <Animated.View style={{ transform: [{ scaleY: bagBounce.interpolate({ inputRange: [0, 1], outputRange: [1, 0.88] }) }, { scaleX: bagBounce.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }}>
          <View style={styles.bag}>
            <ShoppingBag size={34} color={palette.gray900} strokeWidth={1.8} />
          </View>
        </Animated.View>
      </View>

      <View style={styles.road}>
        <View style={styles.dashes}>
          {Array.from({ length: 10 }).map((_, i) => (
            <View key={i} style={styles.dash} />
          ))}
        </View>
        <Animated.View style={[styles.bike, { transform: [{ translateX: ride.interpolate({ inputRange: [0, 1], outputRange: [-20, 196] }) }] }]}>
          <Bike size={26} color={palette.gray900} strokeWidth={2} />
        </Animated.View>
      </View>

      <Txt weight={700} style={styles.title}>
        Gearing up for your next delivery{".".repeat(dots)}
        <Txt style={{ color: "transparent" }}>{".".repeat(3 - dots)}</Txt>
      </Txt>
      <View style={styles.bar}>
        <Animated.View style={[styles.barFill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }]} />
      </View>
      <Txt weight={800} style={styles.tagline}>RIDE • DELIVER • EARN</Txt>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: palette.white, alignItems: "center", justifyContent: "center", zIndex: 999, elevation: 999 },
  center: { width: 220, height: 220, alignItems: "center", justifyContent: "center" },
  glow: { position: "absolute", width: 210, height: 210, borderRadius: 105, backgroundColor: BRAND },
  logo: { width: 180, height: 180 },
  bagArea: { marginTop: 24, height: 96, width: 120, alignItems: "center", justifyContent: "flex-end" },
  food: { position: "absolute", top: 4, width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff7ed", borderWidth: 1, borderColor: "#fed7aa", alignItems: "center", justifyContent: "center", zIndex: 2 },
  bag: { width: 64, height: 58, borderRadius: 16, backgroundColor: BRAND, alignItems: "center", justifyContent: "center" },
  road: { marginTop: 18, width: 220, height: 34, justifyContent: "flex-end" },
  dashes: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 2, marginBottom: 2 },
  dash: { width: 14, height: 3, borderRadius: 2, backgroundColor: palette.gray200 },
  bike: { position: "absolute", left: 0, bottom: 6 },
  title: { marginTop: 22, fontSize: 16, color: palette.gray800 },
  bar: { marginTop: 14, width: 200, height: 6, borderRadius: 3, backgroundColor: palette.gray100, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 3, backgroundColor: BRAND },
  tagline: { position: "absolute", bottom: 48, fontSize: 11, letterSpacing: 4, color: palette.gray400 },
});
