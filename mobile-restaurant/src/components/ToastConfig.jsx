import React from "react";
import { View, StyleSheet } from "react-native";
import { CheckCircle2, AlertCircle, Info } from "lucide-react-native";
import Txt from "./ui/Txt";
import { palette, shadows } from "../theme";

/** sonner "richColors" look: white card, colored icon, bold title, muted description. */
function ToastCard({ text1, text2, color, Icon }) {
  return (
    <View style={[styles.card, shadows.lg]}>
      <Icon size={20} color={color} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        {text1 ? (
          <Txt weight={700} style={[styles.title, { color: palette.gray900 }]} numberOfLines={2}>
            {text1}
          </Txt>
        ) : null}
        {text2 ? (
          <Txt weight={500} style={styles.desc} numberOfLines={3}>
            {text2}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}

export const toastConfig = {
  success: (p) => <ToastCard {...p} color={palette.green600} Icon={CheckCircle2} />,
  error: (p) => <ToastCard {...p} color={palette.red500} Icon={AlertCircle} />,
  info: (p) => <ToastCard {...p} color={palette.gray700} Icon={Info} />,
};

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.white,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    width: "90%",
    borderWidth: 1,
    borderColor: palette.gray100,
  },
  title: { fontSize: 13 },
  desc: { fontSize: 12, color: palette.gray500, marginTop: 2 },
});
