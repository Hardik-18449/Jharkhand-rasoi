/** Port of web context/ThemeContext.jsx (user app only: key "userAppTheme", default light). */
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { localStore } from "../utils/storage";
import { dispatchAppEvent } from "../utils/events";
import { darkColors, lightColors } from "../theme";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStore.getItem("userAppTheme") || "light");

  useEffect(() => {
    localStore.setItem("userAppTheme", theme);
    dispatchAppEvent("themeChanged", { theme });
  }, [theme]);

  const value = useMemo(
    () => ({ theme, setTheme, isDark: theme === "dark", colors: theme === "dark" ? darkColors : lightColors }),
    [theme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}

/** Safe variant: defaults to light when used outside the provider. */
export function useColors() {
  const ctx = useContext(ThemeContext);
  return ctx?.colors || lightColors;
}
