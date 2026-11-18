import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import Txt from "./Txt";
import { palette } from "../../theme";
import { useColors } from "../../context/ThemeContext";

/**
 * Common sticky page header used by most inner pages on web:
 * white bar, back arrow (ArrowLeft, p-2 hover:bg-gray-100 rounded-full), bold title, optional right slot.
 */
export default function PageHeader({ title, subtitle, onBack, right, style, titleStyle, transparent = false, dark = false, center = false }) {
  const router = useRouter();
  const colors = useColors();
  const handleBack = () => {
    if (onBack) return onBack();
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };
  const fg = dark ? palette.white : colors.text;
  return (
    <View style={[styles.bar, { backgroundColor: transparent ? "transparent" : colors.card, borderBottomColor: colors.navBorder, borderBottomWidth: transparent ? 0 : 1 }, style]}>
      <Pressable onPress={handleBack} hitSlop={8} style={({ pressed }) => [styles.back, pressed && { backgroundColor: dark ? "rgba(255,255,255,0.15)" : palette.gray100 }]}>
        <ArrowLeft size={22} color={fg} strokeWidth={2.2} />
      </Pressable>
      <View style={[styles.titleWrap, center && { alignItems: "center", marginRight: 40 }]}>
        {typeof title === "string" ? (
          <Txt weight={700} numberOfLines={1} style={[styles.title, { color: fg }, titleStyle]}>
            {title}
          </Txt>
        ) : (
          title
        )}
        {subtitle ? (
          <Txt weight={500} numberOfLines={1} style={[styles.subtitle, { color: dark ? "rgba(255,255,255,0.8)" : colors.textSecondary }]}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, height: 56 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  titleWrap: { flex: 1, marginLeft: 4 },
  title: { fontSize: 17 },
  subtitle: { fontSize: 11, marginTop: 1 },
  right: { flexDirection: "row", alignItems: "center", gap: 8 },
});
