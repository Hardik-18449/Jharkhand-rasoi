/** Port of pages/user/profile/Shipping.jsx */
import React from "react";
import { Truck } from "lucide-react-native";
import LegalPage from "../../src/components/LegalPage";

export default function ShippingScreen() {
  return <LegalPage pageKey="shipping" defaultTitle="Shipping Policy" subtitle="Jharkhand Rasoi Ecosystem" EmptyIcon={Truck} />;
}
