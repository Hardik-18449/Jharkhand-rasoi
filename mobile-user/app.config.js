// Expo app config. Public values come from .env (EXPO_PUBLIC_*). Secrets never go here.
const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";

module.exports = {
  expo: {
    name: "Jharkhand Rasoi",
    slug: "jharkhand-rasoi-user",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    scheme: "jharkhandrasoi",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    android: {
      package: "com.jharkhandrasoi.user",
      versionCode: 1,
      googleServicesFile: "./google-services.json",
      adaptiveIcon: {
        foregroundImage: "./assets/android-icon-foreground.png",
        backgroundColor: "#ffffff",
      },
      softwareKeyboardLayoutMode: "resize",
      permissions: [
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.POST_NOTIFICATIONS",
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO",
        "android.permission.INTERNET",
      ],
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
          locationWhenInUsePermission:
            "Jharkhand Rasoi uses your location to show restaurants that deliver to you.",
          isAndroidBackgroundLocationEnabled: false,
        },
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: "#FEC600",
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "Jharkhand Rasoi needs photo access to set your profile picture.",
          cameraPermission: "Jharkhand Rasoi needs the camera to take your profile picture.",
        },
      ],
      [
        "expo-build-properties",
        {
          android: {
            usesCleartextTraffic: false,
            // R8 shrinking (on by default in SDK 58) stripped androidx.work's WorkDatabase → instant crash on launch.
            enableMinifyInReleaseBuilds: false,
            enableShrinkResourcesInReleaseBuilds: false,
          },
        },
      ],
      "expo-font",
      "./plugins/withNoForceDark",
      [
        "expo-speech-recognition",
        {
          microphonePermission: "Jharkhand Rasoi uses the microphone for voice search.",
          speechRecognitionPermission: "Jharkhand Rasoi uses speech recognition for voice search.",
          androidSpeechServicePackages: ["com.google.android.googlequicksearchbox"],
        },
      ],
    ],
    experiments: { typedRoutes: false },
    extra: {
      eas: { projectId: "3cf8d0bc-2ec1-4720-b8dd-52e779d6a8c0" },
    },
    owner: "appzeto",
  },
};
