/** Native share: system share sheet first (web navigator.share), copy-link fallback. */
import { Share } from "react-native";
import * as Clipboard from "expo-clipboard";
import { toast } from "../../utils/toast";

export async function shareLink({ title, text, url }) {
  try {
    await Share.share({ title, message: [text, url].filter(Boolean).join(" "), url });
    return true;
  } catch {
    try {
      await Clipboard.setStringAsync(url || text || "");
      toast.success("Link copied to clipboard!");
      return true;
    } catch {
      toast.error("Failed to share link");
      return false;
    }
  }
}

export const WEB_ORIGIN = "https://jharkhandrasoi.com";
