import React from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { palette } from "../../theme";
import Txt from "./Txt";

/** Loader2 spinner equivalents. `full` = centered in page. */
export default function Spinner({ size = "small", color = palette.yellow, full = false, label, style }) {
  if (!full) return <ActivityIndicator size={size} color={color} style={style} />;
  return (
    <View style={[styles.full, style]}>
      <ActivityIndicator size="large" color={color} />
      {label ? (
        <Txt weight={500} style={styles.label}>
          {label}
        </Txt>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  label: { marginTop: 12, color: palette.gray500, fontSize: 13 },
});
