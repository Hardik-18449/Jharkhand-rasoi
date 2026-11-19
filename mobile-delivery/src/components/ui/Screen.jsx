import React from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "../../context/ThemeContext";

/** Page container: background + top safe-area (bottom handled by tab bar / page padding). */
export default function Screen({ children, style, bg, edges = ["top"], padTop = true }) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  return (
    <View
      style={[
        styles.root,
        { backgroundColor: bg || colors.userBg, paddingTop: padTop && edges.includes("top") ? insets.top : 0, paddingBottom: edges.includes("bottom") ? insets.bottom : 0 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
