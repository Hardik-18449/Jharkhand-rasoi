// Expo app config — restaurant partner app. Public values come from .env (EXPO_PUBLIC_*). Secrets never go here.
const fs = require("fs");
const path = require("path");

// FCM needs a google-services.json registered for this package in Firebase. Until it exists,
// the app builds without it (push registration is skipped; socket + polling still deliver orders).
const googleServicesPath = path.join(__dirname, "google-services.json");
const hasGoogleServices = fs.existsSync(googleServicesPath);

module.exports = {
  expo: {
    name: "Jharkhand Rasoi Restaurant",
    slug: "jharkhand-rasoi-restaurant",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    scheme: "jharkhandrasoirestaurant",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    android: {
      package: "com.jharkhandrasoi.restaurant",
      versionCode: 1,
      ...(hasGoogleServices ? { googleServicesFile: "./google-services.json" } : {}),
      adaptiveIcon: {
        foregroundImage: "./assets/android-icon-foreground.png",
        backgroundColor: "#ffffff",
      },
      softwareKeyboardLayoutMode: "resize",
      permissions: [
        "android.permission.POST_NOTIFICATIONS",
        "android.permission.VIBRATE",
        "android.permission.CAMERA",
        "android.permission.INTERNET",
        "android.permission.WAKE_LOCK",
      ],
      blockedPermissions: ["android.permission.RECORD_AUDIO", "android.permission.ACCESS_FINE_LOCATION", "android.permission.ACCESS_COARSE_LOCATION"],
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: "#FEC600",
          sounds: ["./assets/audio/restaurant_order_ring.wav"],
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "Jharkhand Rasoi Restaurant needs photo access to upload dish and restaurant images.",
          cameraPermission: "Jharkhand Rasoi Restaurant needs the camera to take dish and restaurant photos.",
        },
      ],
      [
        "expo-audio",
        { microphonePermission: false },
      ],
      [
        "expo-build-properties",
        {
          android: {
            usesCleartextTraffic: false,
            // R8 shrinking stripped androidx.work's WorkDatabase in the user app → crash on launch. Keep off.
            enableMinifyInReleaseBuilds: false,
            enableShrinkResourcesInReleaseBuilds: false,
          },
        },
      ],
      "expo-font",
      "./plugins/withNoForceDark",
    ],
    experiments: { typedRoutes: false },
    extra: {},
  },
};
