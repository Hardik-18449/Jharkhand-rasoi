/** Port of pages/user/profile/Refund.jsx */
import React from "react";
import { Receipt } from "lucide-react-native";
import LegalPage from "../../src/components/LegalPage";

export default function RefundScreen() {
  return <LegalPage pageKey="refund" defaultTitle="Refund Policy" subtitle="Jharkhand Rasoi Ecosystem" EmptyIcon={Receipt} />;
}
