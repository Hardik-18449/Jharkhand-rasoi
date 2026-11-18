/**
 * Design tokens — the only place styling constants live.
 * Source: Frontend/src/shared/styles/global.css (:root + .user-app.dark) and Tailwind classes used in user screens.
 */
import { Platform } from "react-native";

export const fonts = {
  // Poppins = body (web :root font-family), Outfit = display, Inter = secondary
  regular: "Poppins_400Regular",
  light: "Poppins_300Light",
  medium: "Poppins_500Medium",
  semibold: "Poppins_600SemiBold",
  bold: "Poppins_700Bold",
  extrabold: "Poppins_800ExtraBold",
  black: "Poppins_800ExtraBold", // Poppins has no 900; web "font-black" falls back visually to 800
  outfit: "Outfit_400Regular",
  outfitMedium: "Outfit_500Medium",
  outfitSemibold: "Outfit_600SemiBold",
  outfitBold: "Outfit_700Bold",
  outfitExtrabold: "Outfit_800ExtraBold",
  outfitBlack: "Outfit_900Black",
  inter: "Inter_400Regular",
  interMedium: "Inter_500Medium",
  interSemibold: "Inter_600SemiBold",
  interBold: "Inter_700Bold",
};

export const lightColors = {
  background: "#F9F9FB",
  userBg: "#f5f5f5", // UserLayout bg
  foreground: "#1e1e1e",
  card: "#ffffff",
  cardForeground: "#1e1e1e",
  popover: "#ffffff",
  primary: "#FEC600",
  primaryForeground: "#000000",
  secondary: "#1a1a1a",
  secondaryForeground: "#ffffff",
  muted: "#f1f5f9",
  mutedForeground: "#64748b",
  accent: "#fef08a",
  destructive: "#ef4444",
  border: "#e2e8f0",
  input: "#e2e8f0",
  ring: "#FEC600",
  navBg: "#ffffff",
  navBorder: "#f3f4f6", // gray-100
  text: "#111827", // gray-900
  textSecondary: "#6b7280", // gray-500
  textMuted: "#9ca3af", // gray-400
  textSlate: "#64748b", // slate-500
};

export const darkColors = {
  ...lightColors,
  background: "#0A0A0A",
  userBg: "#0a0a0a",
  foreground: "#F3F4F6",
  card: "#141414",
  cardForeground: "#F3F4F6",
  popover: "#141414",
  secondary: "#000000",
  secondaryForeground: "#F3F4F6",
  muted: "#1f2937",
  mutedForeground: "#9ca3af",
  accent: "#1f2937",
  border: "#27272A",
  input: "#27272A",
  navBg: "#1a1a1a",
  navBorder: "#1f2937",
  text: "#ffffff",
  textSecondary: "#9ca3af",
  textMuted: "#6b7280",
  textSlate: "#9ca3af",
};

// Tailwind palette values used literally across the web user screens
export const palette = {
  white: "#ffffff",
  black: "#000000",
  yellow: "#FEC600",
  yellow400: "#facc15",
  yellow500: "#eab308",
  amber400: "#fbbf24",
  amber500: "#f59e0b",
  amber600: "#d97706",
  orange50: "#fff7ed",
  orange100: "#ffedd5",
  orange200: "#fed7aa",
  orange400: "#fb923c",
  orange500: "#f97316",
  orange600: "#ea580c",
  green50: "#f0fdf4",
  green100: "#dcfce7",
  green500: "#22c55e",
  green600: "#16a34a",
  green700: "#15803d",
  red50: "#fef2f2",
  red100: "#fee2e2",
  red400: "#f87171",
  red500: "#ef4444",
  red600: "#dc2626",
  blue50: "#eff6ff",
  blue100: "#dbeafe",
  blue500: "#3b82f6",
  blue600: "#2563eb",
  gray50: "#f9fafb",
  gray100: "#f3f4f6",
  gray200: "#e5e7eb",
  gray300: "#d1d5db",
  gray400: "#9ca3af",
  gray500: "#6b7280",
  gray600: "#4b5563",
  gray700: "#374151",
  gray800: "#1f2937",
  gray900: "#111827",
  slate100: "#f1f5f9",
  slate200: "#e2e8f0",
  slate500: "#64748b",
  slate800: "#1e293b",
  zinc800: "#27272a",
  zinc900: "#18181b",
  neutral900: "#171717",
  emerald500: "#10b981",
  emerald600: "#059669",
  purple500: "#a855f7",
  purple600: "#9333ea",
  pink500: "#ec4899",
  indigo500: "#6366f1",
};

export const radius = {
  sm: 6, // --radius - 4
  md: 8, // --radius - 2
  lg: 10, // --radius
  xl: 14, // --radius + 4
  "2xl": 16,
  "3xl": 24,
  full: 9999,
};

export const spacing = (n) => n * 4; // Tailwind unit

export const shadows = {
  sm: Platform.select({
    android: { elevation: 1 },
    default: { shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  }),
  md: Platform.select({
    android: { elevation: 3 },
    default: { shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 4 } },
  }),
  lg: Platform.select({
    android: { elevation: 6 },
    default: { shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 15, shadowOffset: { width: 0, height: 10 } },
  }),
  xl: Platform.select({
    android: { elevation: 10 },
    default: { shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 25, shadowOffset: { width: 0, height: 20 } },
  }),
  navTop: Platform.select({
    android: { elevation: 12 },
    default: { shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: -4 } },
  }),
};

export const text = {
  xs: { fontSize: 12, lineHeight: 16 },
  sm: { fontSize: 14, lineHeight: 20 },
  base: { fontSize: 16, lineHeight: 24 },
  lg: { fontSize: 18, lineHeight: 28 },
  xl: { fontSize: 20, lineHeight: 28 },
  "2xl": { fontSize: 24, lineHeight: 32 },
  "3xl": { fontSize: 30, lineHeight: 36 },
  "4xl": { fontSize: 36, lineHeight: 40 },
};

export const BOTTOM_NAV_HEIGHT = 64;

export const GRADIENT_YELLOW = ["#fbbf24", "#FEC600", "#facc15"]; // from-amber-400 via-[#FEC600] to-yellow-400

/** Restaurant panel tokens — from Frontend/src/modules/Food/components/restaurant/restaurantTheme.css (.restaurant-theme overrides bg-primary / text-primary / bg-black buttons). */
export const rt = {
  primary: "#B80B3D",
  primaryStrong: "#66001D",
  primarySoft: "#fdf2f5",
  surface: "#ffffff",
  border: "#f0ccd5",
  text: "#1f1f24",
  muted: "#6d6470",
  pageBg: "#f3f4f6", // bg-gray-100
  orderBrand: "#7e3866", // OrderCard brandColor
};
