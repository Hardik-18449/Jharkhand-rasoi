/** Port of pages/restaurant/PrivacyPolicyPage.jsx (GET /food/pages/privacy). */
import React from "react";
import { Shield } from "lucide-react-native";
import LegalPage from "../src/components/LegalPage";

export default function PrivacyScreen() {
  return <LegalPage pageKey="privacy" defaultTitle="Privacy Policy" subtitle="Jharkhand Rasoi Policy" EmptyIcon={Shield} />;
}
