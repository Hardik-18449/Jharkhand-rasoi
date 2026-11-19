/**
 * Root layout — web equivalents: DeliveryV2Router.jsx + DeliveryNotificationProvider + ProtectedRoute (session expiry → login).
 * Importing locationTracking registers the background location task at startup (required by expo-task-manager).
 */
import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, AppState } from "react-native";
import { Stack, useRouter, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import ToastLib from "react-native-toast-message";
import { useFonts, Poppins_300Light, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold, Poppins_800ExtraBold } from "@expo-google-fonts/poppins";
import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold, Outfit_800ExtraBold, Outfit_900Black } from "@expo-google-fonts/outfit";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";

import { hydrateStorage, cleanupExpiredScopedEntries } from "../src/utils/storage";
import { bootstrapSession, isModuleAuthenticated, clearModuleAuth } from "../src/auth/session";
import { addAppListener } from "../src/utils/events";
import { ThemeProvider } from "../src/context/ThemeContext";
import { DeliveryNotificationProvider } from "../src/delivery/DeliveryNotificationContext";
import { useDeliveryStore } from "../src/delivery/store";
import "../src/delivery/locationTracking";
import ErrorBoundary from "../src/components/ErrorBoundary";
import AppSplash from "../src/components/AppSplash";
import { toastConfig } from "../src/components/ToastConfig";
import { attachNotificationListeners, attachTokenRefreshListener, registerPushDevice } from "../src/push/notifications";
import { loadBusinessSettings } from "../src/utils/businessSettings";
import { palette } from "../src/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

const PUBLIC_ROUTES = ["/login", "/otp", "/pending-verification", "/terms", "/privacy"];

function AppServices() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const navigate = (path) => {
      try {
        if (isModuleAuthenticated()) router.push(path);
      } catch {}
    };
    const offListeners = attachNotificationListeners(navigate);
    const offRefresh = attachTokenRefreshListener();
    return () => {
      offListeners();
      offRefresh();
    };
  }, [router]);

  // Push registration after login (web: registerWebPushForCurrentModule in RestaurantLayout)
  useEffect(() => {
    if (isModuleAuthenticated()) registerPushDevice({ ask: true });
    return addAppListener("deliveryAuthChanged", () => {
      if (isModuleAuthenticated()) registerPushDevice({ ask: true });
    });
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active" && isModuleAuthenticated()) registerPushDevice({ ask: false });
    });
    return () => sub.remove();
  }, []);

  // Session refresh failed → login (web ProtectedRoute requiredRole="restaurant")
  useEffect(
    () =>
      addAppListener("authRefreshFailed", () => {
        clearModuleAuth();
        if (!PUBLIC_ROUTES.includes(pathname)) router.replace("/login");
      }),
    [pathname, router],
  );

  return null;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Poppins_300Light,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
    Outfit_900Black,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [booted, setBooted] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([hydrateStorage(), bootstrapSession()]);
        useDeliveryStore.actions.hydrate();
        cleanupExpiredScopedEntries({ storage: "local" });
        loadBusinessSettings().catch(() => {});
      } finally {
        setBooted(true);
      }
    })();
  }, []);

  // Native splash (logo) → animated "preparing your kitchen" splash as soon as fonts are ready; app loads underneath.
  const onLayoutRootView = useCallback(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);
  const onSplashDone = useCallback(() => setSplashDone(true), []);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={styles.fill} onLayout={onLayoutRootView}>
      {booted ? (
      <SafeAreaProvider>
        <ThemeProvider>
          <ErrorBoundary>
            <DeliveryNotificationProvider>
              <View style={styles.fill}>
                <StatusBar style="dark" />
                <AppServices />
                <Stack screenOptions={{ headerShown: false, animation: "slide_from_right", contentStyle: { backgroundColor: palette.white } }}>
                  <Stack.Screen name="index" options={{ animation: "none" }} />
                  <Stack.Screen name="(tabs)" options={{ animation: "none" }} />
                  <Stack.Screen name="login" options={{ animation: "fade" }} />
                </Stack>
              </View>
            </DeliveryNotificationProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </SafeAreaProvider>
      ) : null}
      <ToastLib config={toastConfig} />
      {!splashDone ? <AppSplash ready={booted} onDone={onSplashDone} /> : null}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
