// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "android/*", "ios/*", ".expo/*"],
  },
  {
    rules: {
      // HTML-entity rule is for the DOM; React Native <Text> renders apostrophes literally.
      "react/no-unescaped-entities": "off",
      // React Compiler advisory rules. The React Compiler is not enabled in this app and these
      // patterns are ported 1:1 from the web code (which works). Kept visible as warnings.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/static-components": "warn",
      // expo-notifications re-exports AndroidImportance via `export *`, which this rule cannot follow.
      "import/namespace": "off",
    },
  },
]);
