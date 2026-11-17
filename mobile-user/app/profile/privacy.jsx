/** Port of pages/user/profile/Privacy.jsx */
import React from "react";
import { Lock } from "lucide-react-native";
import LegalPage from "../../src/components/LegalPage";

export default function PrivacyScreen() {
  return <LegalPage pageKey="privacy" defaultTitle="Privacy Policy" subtitle="Jharkhand Rasoi Policy" EmptyIcon={Lock} />;
}
