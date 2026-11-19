/** Port of DeliveryV2/pages/TermsAndConditionsPage.jsx (GET /food/pages/terms). */
import React from "react";
import { FileText } from "lucide-react-native";
import LegalPage from "../src/components/LegalPage";

export default function TermsScreen() {
  return <LegalPage pageKey="terms" defaultTitle="Terms and Conditions" subtitle="Jharkhand Rasoi Policy" EmptyIcon={FileText} />;
}
