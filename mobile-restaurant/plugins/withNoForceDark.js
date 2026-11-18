/**
 * MIUI / Android 10+ "force dark" repaints light-only apps (dark cards, invisible text).
 * The design is light-only (web restaurant panel), so opt out: <item name="android:forceDarkAllowed">false</item> in AppTheme.
 */
const { withAndroidStyles } = require("expo/config-plugins");

module.exports = function withNoForceDark(config) {
  return withAndroidStyles(config, (cfg) => {
    const styles = cfg.modResults.resources.style || [];
    const appTheme = styles.find((s) => s.$?.name === "AppTheme");
    if (appTheme) {
      appTheme.item = (appTheme.item || []).filter((i) => i.$?.name !== "android:forceDarkAllowed");
      appTheme.item.push({ $: { name: "android:forceDarkAllowed", "tools:targetApi": "29" }, _: "false" });
    }
    return cfg;
  });
};
