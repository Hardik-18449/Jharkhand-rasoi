/** Port of components/user/AddMoneyModal.jsx (wallet top-up via native Razorpay). */
import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";
import { IndianRupee, X } from "lucide-react-native";
import Txt from "./ui/Txt";
import BottomSheet from "./ui/BottomSheet";
import { userAPI } from "../api";
import { initRazorpayPayment } from "../utils/razorpay";
import { getCompanyNameAsync } from "../utils/businessSettings";
import { toast } from "../utils/toast";
import { palette, fonts } from "../theme";

const R = "₹";
const quickAmounts = [100, 250, 500, 1000, 2000, 5000];

export default function AddMoneySheet({ open, onOpenChange, onSuccess }) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const busy = loading || processing;

  const onAmount = (t) => {
    const v = t.replace(/[^0-9.]/g, "");
    if (v === "" || (parseFloat(v) >= 1 && parseFloat(v) <= 50000)) setAmount(v);
  };
  const handleClose = () => {
    if (!busy) {
      setAmount("");
      onOpenChange(false);
    }
  };
  const handleAddMoney = async () => {
    const n = parseFloat(amount);
    if (!amount || isNaN(n) || n < 1) return toast.error(`Please enter a valid amount (minimum ${R}1)`);
    if (n > 50000) return toast.error(`Maximum amount is ${R}50,000`);
    try {
      setLoading(true);
      const r = await userAPI.createWalletTopupOrder(n);
      const { razorpay } = r.data.data;
      if (!razorpay || !razorpay.orderId || !razorpay.key) throw new Error("Failed to initialize payment gateway");
      setLoading(false);
      onOpenChange(false);
      setProcessing(true);
      let u = {};
      try {
        const pr = await userAPI.getProfile();
        u = pr?.data?.data?.user || pr?.data?.user || {};
      } catch {}
      const company = await getCompanyNameAsync();
      await initRazorpayPayment({
        key: razorpay.key,
        amount: razorpay.amount,
        currency: razorpay.currency || "INR",
        order_id: razorpay.orderId,
        name: company,
        description: `Wallet Top-up - ${R}${n.toFixed(2)}`,
        prefill: { name: u.name || "", email: u.email || "", contact: String(u.phone || "").replace(/\D/g, "").slice(-10) },
        notes: { type: "wallet_topup", amount: n.toString() },
        handler: async (resp) => {
          try {
            await userAPI.verifyWalletTopupPayment({ razorpayOrderId: resp.razorpay_order_id, razorpayPaymentId: resp.razorpay_payment_id, razorpaySignature: resp.razorpay_signature, amount: n });
            toast.success(`${R}${n} added to wallet successfully!`);
            setAmount("");
            onSuccess?.();
          } catch (e) {
            toast.error(e?.response?.data?.message || "Payment verification failed. Please contact support.");
          } finally {
            setProcessing(false);
          }
        },
        onError: (e) => {
          toast.error(e?.description || "Payment failed. Please try again.");
          setProcessing(false);
        },
        onClose: () => setProcessing(false),
      });
    } catch (e) {
      const d = e?.response?.data;
      toast.error(d?.message || d?.error || (typeof d === "string" ? d : null) || e?.message || "Failed to initialize payment. Please try again.");
      setLoading(false);
      setProcessing(false);
    }
    return undefined;
  };

  return (
    <BottomSheet visible={open} onClose={handleClose} position="center" dismissable={!busy}>
      <View style={{ padding: 20, width: 340 }}>
        <Pressable disabled={busy} onPress={handleClose} style={{ position: "absolute", right: 12, top: 12, padding: 8, zIndex: 2 }}><X size={20} color={palette.gray400} /></Pressable>
        <View style={{ alignItems: "center", paddingHorizontal: 24 }}>
          <Txt weight={700} style={{ fontSize: 20, color: palette.gray900, textAlign: "center" }}>Add Money to Wallet</Txt>
          <Txt weight={400} style={{ fontSize: 14, color: palette.gray600, textAlign: "center", marginTop: 4 }}>Enter the amount you want to add to your wallet</Txt>
        </View>
        <View style={{ gap: 24, paddingTop: 20 }}>
          <View style={{ gap: 8 }}>
            <Txt weight={500} style={{ fontSize: 14, color: palette.gray700 }}>Enter Amount</Txt>
            <View style={{ justifyContent: "center" }}>
              <IndianRupee size={20} color={palette.gray400} style={{ position: "absolute", left: 12, zIndex: 1 }} />
              <TextInput value={amount} onChangeText={onAmount} editable={!busy} keyboardType="decimal-pad" placeholder="Enter amount" placeholderTextColor={palette.gray400} style={styles.input} />
            </View>
            <Txt weight={400} style={{ fontSize: 12, color: palette.gray500 }}>Minimum: {R}1 | Maximum: {R}50,000</Txt>
          </View>
          <View style={{ gap: 8 }}>
            <Txt weight={500} style={{ fontSize: 14, color: palette.gray700 }}>Quick Select</Txt>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {quickAmounts.map((q) => {
                const sel = amount === String(q);
                return (
                  <Pressable key={q} disabled={busy} onPress={() => setAmount(String(q))} style={[styles.quick, sel && { backgroundColor: palette.yellow, borderColor: palette.yellow }]}>
                    <Txt weight={500} style={{ fontSize: 14, color: palette.gray900 }}>{R}{q}</Txt>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <Pressable disabled={!amount || busy || parseFloat(amount) < 1} onPress={handleAddMoney} style={[styles.add, (!amount || busy) && { opacity: 0.5 }]}>
            {busy ? <ActivityIndicator size="small" color={palette.white} /> : null}
            <Txt weight={600} style={{ fontSize: 16, color: palette.white }}>{busy ? (loading ? "Processing..." : "Opening Payment Gateway...") : `Add ${R}${amount || "0"}`}</Txt>
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  input: { height: 48, borderWidth: 1, borderColor: palette.gray300, borderRadius: 8, paddingLeft: 40, paddingRight: 12, fontFamily: fonts.regular, fontSize: 18, color: palette.gray900 },
  quick: { width: "31%", height: 40, borderRadius: 8, borderWidth: 1, borderColor: palette.gray300, alignItems: "center", justifyContent: "center" },
  add: { height: 48, borderRadius: 8, backgroundColor: palette.green600, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
});
