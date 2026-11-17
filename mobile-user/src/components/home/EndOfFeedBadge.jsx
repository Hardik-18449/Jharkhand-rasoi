/** Port of components/user/home/EndOfFeedBadge.jsx */
import React from "react";
import { Image, StyleSheet, View } from "react-native";
import Txt from "../ui/Txt";
import { localImages } from "../../constants/images";
import { palette } from "../../theme";

export default function EndOfFeedBadge({ style }) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.row}>
        <View style={styles.line} />
        <View style={styles.badge}>
          <Image source={localImages.brandlogo} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
        </View>
        <View style={styles.line} />
      </View>
      <Txt weight={800} style={styles.caption}>
        THAT'S ALL FOR NOW
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", paddingVertical: 40, paddingHorizontal: 16, alignItems: "center" },
  row: { width: "100%", maxWidth: 384, flexDirection: "row", alignItems: "center" },
  line: { flex: 1, height: 1, backgroundColor: palette.gray300 },
  badge: { marginHorizontal: 14, width: 56, height: 56, borderRadius: 28, backgroundColor: "#181818", borderWidth: 2, borderColor: "rgba(55,65,81,0.8)", padding: 10, overflow: "hidden" },
  caption: { marginTop: 14, fontSize: 12, color: palette.gray500, letterSpacing: 3, textAlign: "center" },
});
