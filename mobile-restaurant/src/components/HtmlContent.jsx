/** Native renderer for admin-authored HTML (web used dangerouslySetInnerHTML + Tailwind `prose`). No WebView. */
import React from "react";
import { Linking, useWindowDimensions } from "react-native";
import RenderHTML from "react-native-render-html";
import { fonts, palette } from "../theme";

const tagsStyles = {
  body: { color: palette.gray600, fontFamily: fonts.regular, fontSize: 15, lineHeight: 26 },
  p: { marginTop: 0, marginBottom: 14 },
  h1: { fontFamily: fonts.black, color: palette.gray900, fontSize: 26, marginBottom: 12 },
  h2: { fontFamily: fonts.black, color: palette.gray900, fontSize: 22, marginBottom: 10, marginTop: 18 },
  h3: { fontFamily: fonts.black, color: palette.gray900, fontSize: 18, marginBottom: 8, marginTop: 16 },
  h4: { fontFamily: fonts.bold, color: palette.gray900, fontSize: 16, marginBottom: 6 },
  strong: { fontFamily: fonts.bold, color: palette.gray900 },
  b: { fontFamily: fonts.bold, color: palette.gray900 },
  a: { color: "#CB202D", textDecorationLine: "underline" },
  li: { color: palette.gray600, marginBottom: 6 },
  ul: { marginBottom: 14 },
  ol: { marginBottom: 14 },
};
const systemFonts = Object.values(fonts);

export default function HtmlContent({ html, baseStyle }) {
  const { width } = useWindowDimensions();
  return (
    <RenderHTML
      contentWidth={width - 80}
      source={{ html: String(html || "") }}
      tagsStyles={tagsStyles}
      baseStyle={baseStyle}
      systemFonts={systemFonts}
      renderersProps={{ a: { onPress: (_e, href) => href && Linking.openURL(href).catch(() => {}) } }}
      defaultTextProps={{ selectable: true }}
    />
  );
}
