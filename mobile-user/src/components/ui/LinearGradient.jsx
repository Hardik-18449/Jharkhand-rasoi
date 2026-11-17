import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Rect } from "react-native-svg";

let id = 0;
/** Gradient background without expo-linear-gradient (keeps the dependency list to what section 9 needs). */
export function LinearGradient({ colors = ["#fff", "#000"], start = { x: 0, y: 0 }, end = { x: 1, y: 1 }, style, children, locations }) {
  const gid = React.useMemo(() => `lg-${id++}`, []);
  return (
    <View style={[{ overflow: "hidden" }, style]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <SvgGradient id={gid} x1={`${start.x * 100}%`} y1={`${start.y * 100}%`} x2={`${end.x * 100}%`} y2={`${end.y * 100}%`}>
            {colors.map((c, i) => (
              <Stop key={i} offset={`${(locations ? locations[i] : i / Math.max(1, colors.length - 1)) * 100}%`} stopColor={c} />
            ))}
          </SvgGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gid})`} />
      </Svg>
      {children}
    </View>
  );
}

export default LinearGradient;
