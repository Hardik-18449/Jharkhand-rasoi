/**
 * Entry gate — web ProtectedRoute(requiredRole="restaurant") + RestaurantBlockGuard + OrdersMain onboarding check.
 * Not logged in → /login. Logged in → check restaurant: onboarding incomplete → web registration, blocked → message, else Orders tab.
 */
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { Redirect } from "expo-router";
import Spinner from "../src/components/ui/Spinner";
import { isModuleAuthenticated } from "../src/auth/session";
import { restaurantAPI } from "../src/api";

const isOnboardingComplete = (r) => {
  if (!r) return true;
  const steps = Number(r?.onboarding?.completedSteps);
  if (Number.isFinite(steps) && steps > 0 && steps < 4) return false;
  return true;
};

export default function Index() {
  const authed = isModuleAuthenticated();
  const [target, setTarget] = useState(authed ? null : "/login");

  useEffect(() => {
    if (!authed) return undefined;
    let cancelled = false;
    restaurantAPI
      .getCurrentRestaurant({ noCache: true })
      .then((res) => {
        if (cancelled) return;
        const r = res?.data?.data?.restaurant || res?.data?.restaurant;
        if (!isOnboardingComplete(r)) setTarget("/pending-verification?mode=onboarding");
        else setTarget("/(tabs)");
      })
      .catch(() => !cancelled && setTarget("/(tabs)"));
    return () => {
      cancelled = true;
    };
  }, [authed]);

  if (!target) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}>
        <Spinner />
      </View>
    );
  }
  return <Redirect href={target} />;
}
