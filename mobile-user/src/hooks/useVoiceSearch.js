/**
 * Native replacement for web hooks/useVoiceSearch (Web Speech API) using Android's speech recognizer
 * (expo-speech-recognition). The native module is loaded optionally so the app does not crash where it
 * is absent (e.g. Expo Go); there the mic shows "not available". In the EAS/dev build it is present.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { requireOptionalNativeModule } from "expo-modules-core";
import { toast } from "../utils/toast";

const SpeechModule = requireOptionalNativeModule("ExpoSpeechRecognition");

export function useVoiceSearch(onResult) {
  const [isListening, setIsListening] = useState(false);
  const cbRef = useRef(onResult);
  useEffect(() => {
    cbRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    if (!SpeechModule?.addListener) return undefined;
    const subs = [
      SpeechModule.addListener("start", () => setIsListening(true)),
      SpeechModule.addListener("end", () => setIsListening(false)),
      SpeechModule.addListener("result", (event) => {
        const transcript = event?.results?.[0]?.transcript;
        if (event?.isFinal && transcript) cbRef.current?.(transcript.trim());
      }),
      SpeechModule.addListener("error", (event) => {
        setIsListening(false);
        if (event?.error && event.error !== "aborted" && event.error !== "no-speech") toast.error("Voice search failed. Please try again.");
      }),
    ];
    return () => subs.forEach((s) => s?.remove?.());
  }, []);

  const startListening = useCallback(async () => {
    if (!SpeechModule) {
      toast.error("Voice search is not available in this build");
      return;
    }
    try {
      const perm = await SpeechModule.requestPermissionsAsync();
      if (!perm?.granted) {
        toast.error("Microphone permission is required for voice search");
        return;
      }
      SpeechModule.start({ lang: "en-IN", interimResults: false, maxAlternatives: 1, continuous: false });
    } catch {
      setIsListening(false);
      toast.error("Voice search is not available on this device");
    }
  }, []);

  const stopListening = useCallback(() => {
    try {
      SpeechModule?.stop?.();
    } catch {}
    setIsListening(false);
  }, []);

  return { isListening, startListening, stopListening };
}

export default useVoiceSearch;
