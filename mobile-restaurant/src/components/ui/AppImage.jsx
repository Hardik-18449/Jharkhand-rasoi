import React, { useMemo, useState } from "react";
import { View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Store, UtensilsCrossed } from "lucide-react-native";
import { getOptimizedImageUrl } from "../../utils/media";

/**
 * Port of web OptimizedImage: lazy-ish loading via expo-image, placeholder (shop/food), error state.
 * `src` may be a remote url string, upload path, or a local `require()`.
 */
export default function AppImage({ src, style, contentFit = "cover", placeholderType = "food", width = 800, fallbackSrc, transition = 200, recyclingKey, onLoad, onError }) {
  const [error, setError] = useState(false);
  const source = useMemo(() => {
    if (!src) return null;
    if (typeof src === "number" || (typeof src === "object" && src?.uri == null && !src.url)) return src;
    const raw = typeof src === "object" ? src.uri || src.url : src;
    const url = getOptimizedImageUrl(raw, width);
    if (typeof url === "string" && /xv4gkshv/i.test(url) && fallbackSrc) return typeof fallbackSrc === "string" ? { uri: fallbackSrc } : fallbackSrc;
    return url ? { uri: url } : null;
  }, [src, width, fallbackSrc]);

  const showPlaceholder = !source || error;
  return (
    <View style={[styles.wrap, style]}>
      {showPlaceholder ? (
        <View style={styles.ph}>
          {placeholderType === "shop" ? <Store size={28} color="#cfcac2" strokeWidth={1.5} /> : <UtensilsCrossed size={28} color="#cfcac2" strokeWidth={1.5} />}
        </View>
      ) : (
        <Image
          source={source}
          style={StyleSheet.absoluteFill}
          contentFit={contentFit}
          transition={transition}
          cachePolicy="memory-disk"
          recyclingKey={recyclingKey}
          onLoad={onLoad}
          onError={(e) => {
            setError(true);
            onError?.(e);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: "hidden", backgroundColor: "#f7f5f2" },
  ph: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "#f7f5f2" },
});
