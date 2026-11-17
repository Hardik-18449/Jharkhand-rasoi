import { useEffect, useState } from "react";
import { getCachedSettings, loadBusinessSettings } from "../utils/businessSettings";
import { localStore } from "../utils/storage";
import { addAppListener } from "../utils/events";

const resolveLogoFromSettings = (settings) => (settings ? settings.userLogo?.url || settings.logo?.url || null : null);
const readDynamicLogo = () => resolveLogoFromSettings(getCachedSettings()) || localStore.getItem("user_app_logo") || null;

export function useAppLogo() {
  const [logo, setLogo] = useState(() => readDynamicLogo());
  useEffect(() => {
    let cancelled = false;
    const syncLogo = async () => {
      const cachedLogo = readDynamicLogo();
      if (cachedLogo) {
        if (!cancelled) setLogo(cachedLogo);
        return;
      }
      const settings = await loadBusinessSettings();
      if (!cancelled) setLogo(resolveLogoFromSettings(settings) || readDynamicLogo());
    };
    syncLogo();
    const off1 = addAppListener("themeLoaded", syncLogo);
    const off2 = addAppListener("businessSettingsUpdated", syncLogo);
    return () => {
      cancelled = true;
      off1();
      off2();
    };
  }, []);
  return logo;
}
