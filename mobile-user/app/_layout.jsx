/**
 * Root layout — web equivalents: index.jsx + app/providers.jsx + App.jsx + modules/Food/routes.jsx (AuthInitializer, push registration).
 * Boots storage + session before rendering, loads fonts, mounts providers, Toast, error boundary, push listeners, Android back handling.
 */
import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, BackHandler, AppState } from "react-native";
import { Stack, useRouter, usePathname, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import ToastLib from "react-native-toast-message";
import { useFonts, Poppins_300Light, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold, Poppins_800ExtraBold } from "@expo-google-fonts/poppins";
import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold, Outfit_800ExtraBold, Outfit_900Black } from "@expo-google-fonts/outfit";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";

import { hydrateStorage, cleanupExpiredScopedEntries } from "../src/utils/storage";
import { bootstrapSession, isModuleAuthenticated } from "../src/auth/session";
import { setCurrentRoutePath } from "../src/utils/routeState";
import { addAppListener } from "../src/utils/events";
import { ThemeProvider } from "../src/context/ThemeContext";
import { CartProvider } from "../src/context/CartContext";
import { ProfileProvider } from "../src/context/ProfileContext";
import { LocationProvider } from "../src/context/LocationProvider";
import { OrdersProvider } from "../src/context/OrdersContext";
import { UserNotificationProvider } from "../src/context/UserNotificationContext";
import { SearchOverlayProvider } from "../src/context/SearchOverlayContext";
import ErrorBoundary from "../src/components/ErrorBoundary";
import { toastConfig } from "../src/components/ToastConfig";
import AppSplash from "../src/components/AppSplash";
import { attachNotificationListeners, attachTokenRefreshListener, registerPushDevice } from "../src/push/notifications";
import { loadBusinessSettings } from "../src/utils/businessSettings";
import { applyDynamicTheme } from "../src/utils/themeSettings";
import { palette } from "../src/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

function RouteTracker() {
  const pathname = usePathname();
  useEffect(() => {
    setCurrentRoutePath(pathname);
  }, [pathname]);
  return null;
}

/** Push registration (after login) + listeners + session-expiry redirect — web: routes.jsx registerWebPushForCurrentModule + authRefreshFailed. */
function AppServices() {
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();

  useEffect(() => {
    const navigate = (path) => {
      try {
        router.push(path);
      } catch {}
    };
    const offListeners = attachNotificationListeners(navigate);
    const offRefresh = attachTokenRefreshListener();
    return () => {
      offListeners();
      offRefresh();
    };
  }, [router]);

  useEffect(() => {
    if (isModuleAuthenticated()) registerPushDevice({ ask: true });
    const off = addAppListener("userAuthChanged", () => {
      if (isModuleAuthenticated()) registerPushDevice({ ask: true });
    });
    return off;
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && isModuleAuthenticated()) registerPushDevice({ ask: false });
    });
    return () => sub.remove();
  }, []);

  // Session refresh failed → protected screens send the user to login (web: ProtectedRoute re-evaluates on render)
  useEffect(() => {
    const PROTECTED = ["orders", "profile", "notifications", "wallet", "bookings", "complaints"];
    return addAppListener("authRefreshFailed", () => {
      const first = segments.find((s) => !s.startsWith("("));
      const isProtected = PROTECTED.includes(first) && !/^\/profile\/(terms|privacy|refund|shipping|cancellation)$/.test(pathname);
      if (isProtected) router.replace({ pathname: "/login", params: { from: pathname } });
    });
  }, [segments, pathname, router]);

  // Root screen: hardware back exits (web wrapper behaviour); inner screens handled by the stack
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (router.canGoBack()) return false;
      return false; // let Android close the app on the root screen
    });
    return () => sub.remove();
  }, [router]);

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
        cleanupExpiredScopedEntries({ storage: "local" });
        loadBusinessSettings().catch(() => {});
        applyDynamicTheme().catch(() => {});
      } finally {
        setBooted(true);
      }
    })();
  }, []);

  // Native splash (logo) → animated "ordering food" splash as soon as fonts are ready; app boots underneath.
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
            <UserNotificationProvider>
              <CartProvider>
                <ProfileProvider>
                  <LocationProvider>
                    <OrdersProvider>
                      <SearchOverlayProvider>
                        <View style={styles.fill}>
                          <StatusBar style="dark" />
                          <RouteTracker />
                          <AppServices />
                          <Stack
                            screenOptions={{
                              headerShown: false,
                              animation: "slide_from_right",
                              contentStyle: { backgroundColor: palette.white },
                            }}
                          >
                            <Stack.Screen name="(tabs)" options={{ animation: "none" }} />
                            <Stack.Screen name="login" options={{ animation: "fade" }} />
                            <Stack.Screen name="search" options={{ animation: "fade" }} />
                          </Stack>
                        </View>
                      </SearchOverlayProvider>
                    </OrdersProvider>
                  </LocationProvider>
                </ProfileProvider>
              </CartProvider>
            </UserNotificationProvider>
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
