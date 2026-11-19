import React from "react";
import { View, StyleSheet } from "react-native";
import Txt from "./Txt";
import Button from "./Button";
import { palette } from "../../theme";

export default function EmptyState({ icon, title, description, actionLabel, onAction, style, children }) {
  return (
    <View style={[styles.wrap, style]}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      {title ? (
        <Txt weight={700} style={styles.title}>
          {title}
        </Txt>
      ) : null}
      {description ? (
        <Txt weight={500} style={styles.desc}>
          {description}
        </Txt>
      ) : null}
      {children}
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} style={{ marginTop: 16 }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", paddingVertical: 48, paddingHorizontal: 24 },
  icon: { marginBottom: 16 },
  title: { fontSize: 18, color: palette.gray900, textAlign: "center" },
  desc: { fontSize: 13, color: palette.gray500, textAlign: "center", marginTop: 6, maxWidth: 300 },
});
