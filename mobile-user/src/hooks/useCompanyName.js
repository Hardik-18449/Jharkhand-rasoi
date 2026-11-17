import { useEffect, useState } from "react";
import { getCachedSettings, loadBusinessSettings } from "../utils/businessSettings";
import { addAppListener } from "../utils/events";

export const useCompanyName = () => {
  const [companyName, setCompanyName] = useState(() => getCachedSettings()?.companyName || "Jharkhand Rasoi");
  useEffect(() => {
    const cached = getCachedSettings();
    if (!cached?.companyName) {
      loadBusinessSettings()
        .then((s) => s?.companyName && setCompanyName(s.companyName))
        .catch(() => {});
    } else setCompanyName(cached.companyName);
    return addAppListener("businessSettingsUpdated", () => {
      const updated = getCachedSettings();
      if (updated?.companyName) setCompanyName(updated.companyName);
    });
  }, []);
  return companyName;
};
