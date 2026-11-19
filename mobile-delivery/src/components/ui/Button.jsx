import React from "react";
import { ActivityIndicator, Pressable, StyleSheet } from "react-native";
import Txt from "./Txt";
import { palette, radius } from "../../theme";

/**
 * Button with the variants used by the user app:
 * primary (yellow gradient-ish solid #FEC600, black text), dark (black bg, yellow/white text), outline, ghost, destructive.
 */
export default function Button({ title, children, onPress, variant = "primary", size = "md", disabled, loading, style, textStyle, icon, iconRight, fullWidth, rounded = "full", weight = 700 }) {
  const v = VARIANTS[variant] || VARIANTS.primary;
  const s = SIZES[size] || SIZES.md;
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: v.bg, borderColor: v.border, borderWidth: v.border ? 1.5 : 0, height: s.h, paddingHorizontal: s.px, borderRadius: radius[rounded] ?? radius.full },
        fullWidth && { alignSelf: "stretch" },
        isDisabled && { opacity: 0.5 },
        pressed && !isDisabled && { transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text} />
      ) : (
        <>
          {icon}
          {title != null ? (
            <Txt weight={weight} style={[{ color: v.text, fontSize: s.fs }, icon ? { marginLeft: 8 } : null, textStyle]}>
              {title}
            </Txt>
          ) : (
            children
          )}
          {iconRight}
        </>
      )}
    </Pressable>
  );
}

const VARIANTS = {
  primary: { bg: palette.yellow, text: palette.black, border: null },
  dark: { bg: palette.neutral900, text: palette.yellow, border: null },
  black: { bg: palette.black, text: palette.white, border: null },
  outline: { bg: "transparent", text: palette.gray700, border: palette.gray200 },
  ghost: { bg: "transparent", text: palette.gray700, border: null },
  destructive: { bg: palette.red500, text: palette.white, border: null },
  secondary: { bg: palette.gray100, text: palette.gray900, border: null },
  white: { bg: palette.white, text: palette.gray900, border: palette.gray200 },
};
const SIZES = {
  sm: { h: 36, px: 14, fs: 13 },
  md: { h: 44, px: 20, fs: 15 },
  lg: { h: 52, px: 24, fs: 16 },
  xl: { h: 56, px: 28, fs: 17 },
};

const styles = StyleSheet.create({
  base: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
});
