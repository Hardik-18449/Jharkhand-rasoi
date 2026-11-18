/**
 * Animated launch splash ("preparing food" theme) shown after the native splash while the app boots.
 * White background (logo artwork is on white) → logo pops in with a pulsing yellow glow, cooking pot with rising steam
 * and flickering flame, bouncing food icons, "Preparing your kitchen…" with animated dots and a crimson progress bar.
 * Shown for at least MIN_MS, then fades out (onDone).
 */
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, View } from "react-native";
import { CookingPot, Flame, Pizza, Soup, Salad, Coffee, Sandwich } from "lucide-react-native";
import Txt from "./ui/Txt";
import { palette, rt } from "../theme";

const logo = require("../../assets/splash-icon.png");
const MIN_MS = 2200;
const FOODS = [Pizza, Soup, Salad, Sandwich, Coffee];

function Steam({ delay, x }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([Animated.delay(delay), Animated.timing(v, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }), Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true })]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, delay]);
  return (
    <Animated.View
      style={[
        styles.steam,
        {
          left: x,
          opacity: v.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 0.7, 0.35, 0] }),
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -26] }) }, { scaleX: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.6, 1] }) }],
        },
      ]}
    />
  );
}

function BouncingFood({ Icon, index }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(index * 140),
        Animated.timing(v, { toValue: 1, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 380, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.delay((FOODS.length - index) * 140),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, index]);
  return (
    <Animated.View style={[styles.food, { transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) }] }]}>
      <Icon size={18} color={rt.primary} strokeWidth={2} />
    </Animated.View>
  );
}

export default function AppSplash({ ready, onDone }) {
  const [minElapsed, setMinElapsed] = useState(false);
  const [dots, setDots] = useState(1);
  const fade = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.6)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const flame = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoScale, { toValue: 1, friction: 5, tension: 70, useNativeDriver: true }),
      Animated.timing(logoOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
    ]).start();
    const g = Animated.loop(Animated.sequence([Animated.timing(glow, { toValue: 1, duration: 1100, useNativeDriver: true }), Animated.timing(glow, { toValue: 0, duration: 1100, useNativeDriver: true })]));
    const f = Animated.loop(Animated.sequence([Animated.timing(flame, { toValue: 1, duration: 260, useNativeDriver: true }), Animated.timing(flame, { toValue: 0, duration: 300, useNativeDriver: true })]));
    g.start();
    f.start();
    Animated.timing(progress, { toValue: 0.85, duration: MIN_MS, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    const t = setTimeout(() => setMinElapsed(true), MIN_MS);
    const d = setInterval(() => setDots((x) => (x % 3) + 1), 420);
    return () => {
      g.stop();
      f.stop();
      clearTimeout(t);
      clearInterval(d);
    };
  }, [logoScale, logoOpacity, glow, flame, progress]);

  useEffect(() => {
    if (!ready || !minElapsed) return;
    Animated.timing(progress, { toValue: 1, duration: 250, useNativeDriver: false }).start(() => {
      Animated.timing(fade, { toValue: 0, duration: 380, useNativeDriver: true }).start(() => onDone?.());
    });
  }, [ready, minElapsed, progress, fade, onDone]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: fade }]} pointerEvents="none">
      <View style={styles.center}>
        <Animated.View style={[styles.glow, { opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.6] }), transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] }) }] }]} />
        <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
          <Image source={logo} style={styles.logo} resizeMode="contain" />
        </Animated.View>
      </View>

      <View style={styles.potWrap}>
        <View style={styles.steamArea}>
          <Steam delay={0} x={14} />
          <Steam delay={450} x={28} />
          <Steam delay={900} x={42} />
        </View>
        <CookingPot size={44} color={palette.gray800} strokeWidth={1.8} />
        <Animated.View style={{ marginTop: -2, transform: [{ scaleY: flame.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] }) }], opacity: flame.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }) }}>
          <Flame size={20} color="#f97316" fill="#fdba74" />
        </Animated.View>
      </View>

      <View style={styles.foods}>
        {FOODS.map((Icon, i) => (
          <BouncingFood key={i} Icon={Icon} index={i} />
        ))}
      </View>

      <Txt weight={700} style={styles.title}>
        Preparing your kitchen{".".repeat(dots)}
        <Txt style={{ color: "transparent" }}>{".".repeat(3 - dots)}</Txt>
      </Txt>
      <View style={styles.bar}>
        <Animated.View style={[styles.barFill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }]} />
      </View>
      <Txt weight={800} style={styles.tagline}>RESTAURANT PARTNER</Txt>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: palette.white, alignItems: "center", justifyContent: "center", zIndex: 999, elevation: 999 },
  center: { width: 220, height: 220, alignItems: "center", justifyContent: "center" },
  glow: { position: "absolute", width: 210, height: 210, borderRadius: 105, backgroundColor: "#FEC600" },
  logo: { width: 180, height: 180 },
  potWrap: { marginTop: 28, alignItems: "center" },
  steamArea: { width: 60, height: 28, marginBottom: -6 },
  steam: { position: "absolute", bottom: 0, width: 4, height: 16, borderRadius: 2, backgroundColor: palette.gray300 },
  foods: { flexDirection: "row", gap: 14, marginTop: 18 },
  food: { width: 34, height: 34, borderRadius: 17, backgroundColor: rt.primarySoft, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: rt.border },
  title: { marginTop: 26, fontSize: 16, color: palette.gray800 },
  bar: { marginTop: 14, width: 200, height: 6, borderRadius: 3, backgroundColor: palette.gray100, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 3, backgroundColor: rt.primary },
  tagline: { position: "absolute", bottom: 48, fontSize: 11, letterSpacing: 4, color: palette.gray400 },
});
