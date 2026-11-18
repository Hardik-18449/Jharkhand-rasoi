import React, { useState } from "react";
import { View } from "react-native";
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Rect } from "react-native-svg";

let id = 0;
/**
 * Gradient background without expo-linear-gradient (keeps the dependency list to what section 9 needs).
 * The Svg is sized from onLayout (numeric px): with "100%" sizes Fabric kept the first measured size,
 * so the gradient covered only part of views whose size changed after mount (e.g. the VIP card).
 * A solid background of the middle colour fills the view until it is measured.
 */
export function LinearGradient({ colors = ["#fff", "#000"], start = { x: 0, y: 0 }, end = { x: 1, y: 1 }, style, children, locations }) {
  const gid = React.useMemo(() => `lg-${id++}`, []);
  const [size, setSize] = useState(null);
  const fallback = colors[Math.floor((colors.length - 1) / 2)] || "transparent";
  const onLayout = (e) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => (prev && Math.abs(prev.width - width) < 0.5 && Math.abs(prev.height - height) < 0.5 ? prev : { width, height }));
  };
  return (
    <View style={[{ overflow: "hidden" }, !size && { backgroundColor: fallback }, style]} onLayout={onLayout}>
      {size && size.width > 0 && size.height > 0 ? (
        <Svg style={{ position: "absolute", left: 0, top: 0 }} width={size.width} height={size.height} pointerEvents="none">
          <Defs>
            <SvgGradient id={gid} x1={`${start.x * 100}%`} y1={`${start.y * 100}%`} x2={`${end.x * 100}%`} y2={`${end.y * 100}%`}>
              {colors.map((c, i) => (
                <Stop key={i} offset={`${(locations ? locations[i] : i / Math.max(1, colors.length - 1)) * 100}%`} stopColor={c} />
              ))}
            </SvgGradient>
          </Defs>
          <Rect x="0" y="0" width={size.width} height={size.height} fill={`url(#${gid})`} />
        </Svg>
      ) : null}
      {children}
    </View>
  );
}

export default LinearGradient;
