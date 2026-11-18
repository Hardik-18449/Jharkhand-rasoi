import React from "react";
import { Text } from "react-native";
import { fonts } from "../../theme";

/** Text with Poppins by default (web :root font). weight maps to loaded font files. */
const WEIGHT_TO_FONT = {
  300: fonts.light,
  400: fonts.regular,
  500: fonts.medium,
  600: fonts.semibold,
  700: fonts.bold,
  800: fonts.extrabold,
  900: fonts.black,
  light: fonts.light,
  normal: fonts.regular,
  medium: fonts.medium,
  semibold: fonts.semibold,
  bold: fonts.bold,
  extrabold: fonts.extrabold,
  black: fonts.black,
};

export function fontFor(weight = 400, family = "poppins") {
  if (family === "outfit") {
    const map = { 400: fonts.outfit, 500: fonts.outfitMedium, 600: fonts.outfitSemibold, 700: fonts.outfitBold, 800: fonts.outfitExtrabold, 900: fonts.outfitBlack };
    return map[weight] || map[Math.min(900, Math.max(400, Math.round(Number(weight) / 100) * 100))] || fonts.outfit;
  }
  if (family === "inter") {
    const map = { 400: fonts.inter, 500: fonts.interMedium, 600: fonts.interSemibold, 700: fonts.interBold };
    return map[weight] || fonts.inter;
  }
  return WEIGHT_TO_FONT[weight] || fonts.regular;
}

export default function Txt({ weight = 400, family = "poppins", style, children, ...rest }) {
  return (
    <Text {...rest} style={[{ fontFamily: fontFor(weight, family), color: "#1e1e1e" }, style]}>
      {children}
    </Text>
  );
}
