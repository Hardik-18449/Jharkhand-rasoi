/** Port of DeliveryV2/components/ui/ActionSlider.jsx — swipe-to-confirm; confirms at ≥80 % travel; atomic lock; resets on failure. */
import React, { useEffect, useRef, useState } from "react";
import { Animated, PanResponder, StyleSheet, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import Txt from "../components/ui/Txt";
import { palette } from "../theme";

const HANDLE = 56;
const PAD = 6;

export default function ActionSlider({ label = "Slide to Confirm", onConfirm, disabled = false, color = palette.green600, successLabel = "Confirmed ✓" }) {
  const [width, setWidth] = useState(300);
  const [success, setSuccess] = useState(false);
  const x = useRef(new Animated.Value(0)).current;
  const busy = useRef(false);
  const maxTravel = Math.max(width - HANDLE - PAD * 2, 1);
  const maxRef = useRef(maxTravel);
  maxRef.current = maxTravel;
  const stateRef = useRef({ disabled, success });
  stateRef.current = { disabled, success };
  const confirmRef = useRef(onConfirm);
  confirmRef.current = onConfirm;

  useEffect(() => {
    if (disabled) {
      setSuccess(false);
      busy.current = false;
      x.setValue(0);
    }
  }, [disabled, x]);

  const reset = () => {
    busy.current = false;
    setSuccess(false);
    Animated.spring(x, { toValue: 0, useNativeDriver: false }).start();
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !stateRef.current.disabled && !stateRef.current.success && !busy.current,
      onMoveShouldSetPanResponder: () => !stateRef.current.disabled && !stateRef.current.success && !busy.current,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => x.setValue(Math.max(0, Math.min(g.dx, maxRef.current))),
      onPanResponderRelease: async (_, g) => {
        if (busy.current) return;
        if (g.dx / maxRef.current >= 0.8) {
          busy.current = true;
          setSuccess(true);
          Animated.timing(x, { toValue: maxRef.current, duration: 120, useNativeDriver: false }).start();
          try {
            await confirmRef.current?.();
          } catch {
            reset();
          }
        } else reset();
      },
      onPanResponderTerminate: () => reset(),
    }),
  ).current;

  const fillWidth = x.interpolate({ inputRange: [0, maxTravel], outputRange: [HANDLE + PAD, width], extrapolate: "clamp" });

  return (
    <View style={styles.track} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {!disabled ? <Animated.View style={[styles.fill, { backgroundColor: color, width: success ? width : fillWidth }]} /> : null}
      <View style={styles.labelWrap} pointerEvents="none">
        <Txt weight={700} style={[styles.label, { opacity: success ? 0 : 1, color: disabled ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.88)" }]}>{disabled ? "ACTION LOCKED" : String(label).toUpperCase()}</Txt>
      </View>
      {success ? (
        <View style={styles.labelWrap} pointerEvents="none">
          <Txt weight={700} style={[styles.label, { color: palette.white, fontSize: 14 }]}>{String(successLabel).toUpperCase()}</Txt>
        </View>
      ) : null}
      <Animated.View {...responder.panHandlers} style={[styles.handle, disabled && { backgroundColor: palette.gray200 }, { transform: [{ translateX: x }] }]}>
        <ChevronRight size={32} color={disabled ? palette.gray400 : success ? palette.green600 : "#030712"} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 68, borderRadius: 999, padding: PAD, backgroundColor: "#030712", overflow: "hidden", justifyContent: "center" },
  fill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 999 },
  labelWrap: { ...StyleSheet.absoluteFillObject, left: 76, right: 20, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 11, letterSpacing: 1.5, textAlign: "center" },
  handle: { width: HANDLE, height: HANDLE, borderRadius: HANDLE / 2, backgroundColor: palette.white, alignItems: "center", justifyContent: "center", elevation: 6 },
});
