/** sonner-compatible facade over react-native-toast-message (web: `toast.success/error/message/dismiss`). */
import ToastLib from "react-native-toast-message";

const show = (type, text1, opts = {}) => {
  const description = typeof opts === "string" ? opts : opts?.description;
  ToastLib.show({
    type,
    text1: String(text1 ?? ""),
    text2: description ? String(description) : undefined,
    position: "top",
    topOffset: 60,
    visibilityTime: Number(opts?.duration) || 4000,
    props: { id: opts?.id },
  });
};

export const toast = {
  success: (t, o) => show("success", t, o),
  error: (t, o) => show("error", t, o),
  info: (t, o) => show("info", t, o),
  message: (t, o) => show("info", t, o),
  warning: (t, o) => show("info", t, o),
  dismiss: () => ToastLib.hide(),
};

export default toast;
