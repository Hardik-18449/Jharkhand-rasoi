import React, { forwardRef, useState } from "react";
import { TextInput, View, StyleSheet } from "react-native";
import { fonts, palette, radius } from "../../theme";
import Txt from "./Txt";

/** shadcn-like Input: h-12, rounded-xl, border gray-200, focus:border #FEC600 */
const Input = forwardRef(function Input({ style, containerStyle, left, right, label, error, height = 48, ...rest }, ref) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={containerStyle}>
      {label ? (
        <Txt weight={600} style={styles.label}>
          {label}
        </Txt>
      ) : null}
      <View style={[styles.wrap, { height, borderColor: error ? palette.red500 : focused ? palette.yellow : palette.gray200, backgroundColor: focused ? palette.white : "#f9fafb" }, style]}>
        {left ? <View style={styles.side}>{left}</View> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={palette.gray400}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          {...rest}
          style={[styles.input, rest.inputStyle]}
        />
        {right ? <View style={styles.side}>{right}</View> : null}
      </View>
      {error ? (
        <Txt weight={500} style={styles.error}>
          {error}
        </Txt>
      ) : null}
    </View>
  );
});

export default Input;

const styles = StyleSheet.create({
  label: { fontSize: 13, color: palette.gray700, marginBottom: 6 },
  wrap: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: radius.xl, paddingHorizontal: 14 },
  input: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: palette.gray900, paddingVertical: 0, height: "100%" },
  side: { marginHorizontal: 4, justifyContent: "center" },
  error: { fontSize: 12, color: palette.red500, marginTop: 4, marginLeft: 4 },
});
