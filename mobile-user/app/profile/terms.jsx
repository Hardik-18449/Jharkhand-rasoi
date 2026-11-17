/** Port of pages/user/profile/Terms.jsx */
import React from "react";
import { FileText } from "lucide-react-native";
import LegalPage from "../../src/components/LegalPage";

export default function TermsScreen() {
  return <LegalPage pageKey="terms" defaultTitle="Terms of Service" subtitle="Jharkhand Rasoi Policy" EmptyIcon={FileText} />;
}
