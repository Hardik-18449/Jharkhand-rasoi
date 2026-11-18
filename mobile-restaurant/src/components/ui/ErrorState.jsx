import React from "react";
import { View, StyleSheet } from "react-native";
import { AlertCircle, WifiOff } from "lucide-react-native";
import Txt from "./Txt";
import Button from "./Button";
import { palette } from "../../theme";

/** Error / retry state (web: error card with "Try Again" button). */
export default function ErrorState({ message = "Something went wrong", onRetry, retryLabel = "Try Again", network = false, style, compact = false }) {
  const Icon = network ? WifiOff : AlertCircle;
  return (
    <View style={[styles.wrap, compact && { paddingVertical: 24 }, style]}>
      <View style={styles.iconWrap}>
        <Icon size={28} color={palette.red500} />
      </View>
      <Txt weight={600} style={styles.msg}>
        {message}
      </Txt>
      {onRetry ? <Button title={retryLabel} onPress={onRetry} variant="black" size="sm" style={{ marginTop: 14 }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", paddingVertical: 48, paddingHorizontal: 24 },
  iconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: palette.red50, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  msg: { textAlign: "center", color: palette.gray700, fontSize: 14 },
});
