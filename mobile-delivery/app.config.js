// Expo app config — delivery partner app. Public values come from .env (EXPO_PUBLIC_*). Secrets never go here.
const fs = require("fs");
const path = require("path");

const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";
// FCM needs a google-services.json that contains this package. Until it exists the app builds without push.
const gsPath = path.join(__dirname, "google-services.json");
const hasGoogleServices = fs.existsSync(gsPath) && fs.readFileSync(gsPath, "utf8").includes("com.jharkhandrasoi.delivery");

module.exports = {
  expo: {
    name: "Jharkhand Rasoi Delivery",
    slug: "jharkhand-rasoi-delivery",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    scheme: "jharkhandrasoidelivery",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    android: {
      package: "com.jharkhandrasoi.delivery",
      versionCode: 1,
      ...(hasGoogleServices ? { googleServicesFile: "./google-services.json" } : {}),
      adaptiveIcon: {
        foregroundImage: "./assets/android-icon-foreground.png",
        backgroundColor: "#ffffff",
      },
      softwareKeyboardLayoutMode: "resize",
      permissions: [
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_BACKGROUND_LOCATION",
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.FOREGROUND_SERVICE_LOCATION",
        "android.permission.POST_NOTIFICATIONS",
        "android.permission.VIBRATE",
        "android.permission.CAMERA",
        "android.permission.INTERNET",
        "android.permission.WAKE_LOCK",
      ],
      blockedPermissions: ["android.permission.RECORD_AUDIO"],
      config: {
        googleMaps: { apiKey: googleMapsApiKey },
      },
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "Jharkhand Rasoi Delivery shares your live location with the customer and restaurant while you are delivering an order.",
          locationWhenInUsePermission: "Jharkhand Rasoi Delivery uses your location to find orders near you and guide you to the restaurant and customer.",
          isAndroidBackgroundLocationEnabled: true,
          isAndroidForegroundServiceEnabled: true,
        },
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: "#FEC600",
          sounds: ["./assets/audio/alert.mp3"],
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "Jharkhand Rasoi Delivery needs photo access to upload documents.",
          cameraPermission: "Jharkhand Rasoi Delivery needs the camera for your shift-start selfie.",
        },
      ],
      ["expo-audio", { microphonePermission: false }],
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
