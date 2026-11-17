/**
 * Native port of web utils/razorpay.js `initRazorpayPayment`.
 * Uses react-native-razorpay (native Checkout SDK). Options mirror the web call:
 * { key, amount, currency, order_id, name, description, prefill, notes, handler, onError, onClose }.
 * Android reports a user-dismissed sheet as error code 0 (PAYMENT_CANCELED) → mapped to onClose (web parity).
 * Key comes from the backend create-order response; nothing secret lives in the app.
 */
import { NativeModules, TurboModuleRegistry } from "react-native";
import { palette } from "../theme";

// Loaded lazily: the native SDK only exists in the EAS/dev build, not in Expo Go.
const hasNativeRazorpay = () => {
  try {
    return Boolean(TurboModuleRegistry.get?.("RNRazorpayCheckout") || NativeModules.RNRazorpayCheckout);
  } catch {
    return Boolean(NativeModules.RNRazorpayCheckout);
  }
};

const isCancel = (err) => {
  const code = Number(err?.code);
  const desc = String(err?.description || err?.error?.description || "").toLowerCase();
  return code === 0 || desc.includes("cancel");
};

const parseErrorDescription = (err) => {
  const raw = err?.description;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed?.error?.description || parsed?.description || raw;
    } catch {
      return raw;
    }
  }
  return err?.error?.description || err?.message || "Payment failed. Please try again.";
};

export async function initRazorpayPayment({ key, amount, currency = "INR", order_id, name, description, prefill = {}, notes = {}, handler, onError, onClose }) {
  const options = {
    key,
    amount: String(amount),
    currency,
    order_id,
    name: name || "",
    description: description || "",
    prefill: {
      name: prefill.name || "",
      email: prefill.email || "",
      contact: prefill.contact || "",
    },
    notes,
    theme: { color: palette.yellow },
  };
  if (!hasNativeRazorpay()) {
    await onError?.({ code: "NATIVE_MODULE_MISSING", description: "Online payment is not available in this build. Please install the app build (APK).", message: "Online payment is not available in this build." });
    return;
  }
  const RazorpayCheckout = require("react-native-razorpay").default;
  try {
    const data = await RazorpayCheckout.open(options);
    await handler?.(data);
  } catch (err) {
    if (isCancel(err)) {
      await onClose?.();
      return;
    }
    await onError?.({ code: err?.code, description: parseErrorDescription(err), message: parseErrorDescription(err) });
  }
}

export default initRazorpayPayment;
