/** Entry gate — web ProtectedRoute: not logged in → /login, else the home feed. */
import React from "react";
import { Redirect } from "expo-router";
import { isModuleAuthenticated } from "../src/auth/session";

export default function Index() {
  return <Redirect href={isModuleAuthenticated() ? "/(tabs)" : "/login"} />;
}
