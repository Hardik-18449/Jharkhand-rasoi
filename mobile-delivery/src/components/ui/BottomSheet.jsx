import React, { useEffect, useRef } from "react";
import { Animated, Modal, Pressable, StyleSheet, View, KeyboardAvoidingView, Platform, BackHandler } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { palette, radius } from "../../theme";

/**
 * Bottom sheet / dialog replacement for Radix Dialog and in-page fixed modals.
 * `position`: "bottom" (sheet) | "center" (dialog). Android back closes it (section 10).
 */
export default function BottomSheet({ visible, onClose, children, position = "bottom", dismissable = true, maxHeightRatio = 0.9, contentStyle, bg = palette.white, rounded = true }) {
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: visible ? 1 : 0, duration: 220, useNativeDriver: true }).start();
  }, [visible, anim]);

  useEffect(() => {
    if (!visible) return undefined;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (dismissable) onClose?.();
      return true;
    });
    return () => sub.remove();
  }, [visible, dismissable, onClose]);

  if (!visible) return null;
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [position === "bottom" ? 300 : 40, 0] });

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={() => dismissable && onClose?.()}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.fill}>
        <Pressable style={styles.backdrop} onPress={() => dismissable && onClose?.()}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.6)", opacity: anim }]} />
        </Pressable>
        <View pointerEvents="box-none" style={[styles.fill, position === "bottom" ? styles.bottomWrap : styles.centerWrap]}>
          <Animated.View
            style={[
              position === "bottom" ? styles.sheet : styles.dialog,
              { backgroundColor: bg, opacity: anim, transform: [{ translateY }], maxHeight: `${Math.round(maxHeightRatio * 100)}%` },
              position === "bottom" && { paddingBottom: Math.max(insets.bottom, 12) },
              position === "bottom" && rounded && { borderTopLeftRadius: radius["3xl"], borderTopRightRadius: radius["3xl"] },
              contentStyle,
            ]}
          >
            {children}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject },
  bottomWrap: { justifyContent: "flex-end" },
  centerWrap: { justifyContent: "center", alignItems: "center", padding: 16 },
  sheet: { width: "100%" },
  dialog: { width: "100%", maxWidth: 480, borderRadius: 24, overflow: "hidden" },
});
