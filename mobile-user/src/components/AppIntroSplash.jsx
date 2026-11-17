/** Port of components/user/AppIntroSplash.jsx — admin intro ads shown once per app session. Videos play via expo-video is not installed; video ads fall back to skipping (web plays muted video). */
import React, { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import Txt from "./ui/Txt";
import { publicAPI } from "../api";
import { getMediaUrl } from "../utils/media";
import { sessionStore } from "../utils/storage";
import { palette } from "../theme";

const seen = () => sessionStore.getItem("appIntroSeen");
const markSeen = () => sessionStore.setItem("appIntroSeen", "true");

export default function AppIntroSplash({ onComplete }) {
  const router = useRouter();
  const [screens, setScreens] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (seen()) {
      onComplete();
      return undefined;
    }
    const failsafe = setTimeout(() => {
      markSeen();
      onComplete();
    }, 6000);
    publicAPI
      .getAppIntroAds()
      .then((res) => {
        const list = res.data?.success && Array.isArray(res.data.data) ? res.data.data.filter((s) => s?.mediaType !== "video" && s?.mediaUrl) : [];
        if (list.length > 0) setScreens(list);
        else {
          markSeen();
          onComplete();
        }
      })
      .catch(() => {
        markSeen();
        onComplete();
      })
      .finally(() => setLoading(false));
    return () => clearTimeout(failsafe);
  }, [onComplete]);

  useEffect(() => {
    if (screens.length > 0 && currentIndex < screens.length) {
      const duration = (screens[currentIndex].duration || 3) * 1000;
      const timer = setTimeout(() => {
        if (currentIndex < screens.length - 1) setCurrentIndex((p) => p + 1);
        else {
          markSeen();
          onComplete();
        }
      }, duration);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [currentIndex, screens, onComplete]);

  if (seen() || loading || screens.length === 0) return null;
  const currentScreen = screens[currentIndex];
  const linked = currentScreen?.restaurantId;
  const targetSlug = typeof linked === "object" ? linked?.slug || linked?._id : linked;
  const restaurantName = typeof linked === "object" ? linked?.restaurantName || linked?.onboarding?.step1?.restaurantName || "Restaurant" : "Restaurant";
  const finish = () => {
    markSeen();
    onComplete();
  };
  const handleAdClick = () => {
    if (targetSlug) {
      finish();
      router.push(`/restaurants/${targetSlug}`);
    }
  };

  return (
    <Modal visible transparent={false} animationType="fade" statusBarTranslucent onRequestClose={finish}>
      <View style={styles.root}>
        <Pressable onPress={handleAdClick} style={StyleSheet.absoluteFill}>
          <Image source={{ uri: getMediaUrl(currentScreen.mediaUrl) }} style={StyleSheet.absoluteFill} contentFit="contain" onError={finish} />
        </Pressable>
        {targetSlug ? (
          <Pressable onPress={handleAdClick} style={styles.visit}>
            <Txt weight={600} style={{ color: palette.white, fontSize: 14 }}>
              Visit {restaurantName}
            </Txt>
            <ChevronRight size={16} color={palette.white} />
          </Pressable>
        ) : null}
        <Pressable onPress={finish} style={styles.skip}>
          <Txt weight={500} style={{ color: palette.white, fontSize: 13 }}>
            Skip
          </Txt>
        </Pressable>
        <View style={styles.dots}>
          {screens.map((_, idx) => (
            <View key={idx} style={[styles.dot, idx === currentIndex && styles.dotActive]} />
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.black },
  visit: { position: "absolute", bottom: 64, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999, backgroundColor: palette.orange500 },
  skip: { position: "absolute", top: 48, right: 24, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.4)" },
  dots: { position: "absolute", bottom: 24, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.5)" },
  dotActive: { width: 24, backgroundColor: palette.white },
});
