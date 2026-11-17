/** Port of pages/user/profile/Cancellation.jsx */
import React from "react";
import { XCircle } from "lucide-react-native";
import LegalPage from "../../src/components/LegalPage";

export default function CancellationScreen() {
  return <LegalPage pageKey="cancellation" defaultTitle="Cancellation Policy" subtitle="Jharkhand Rasoi Ecosystem" EmptyIcon={XCircle} />;
}
