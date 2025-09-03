import { config as loadEnv } from "dotenv";

// Load environment variables from .env/.env.production on CI
loadEnv();

export default ({ config: expoConfig }) => {
  return {
    ...expoConfig,
    ios: {
      ...(expoConfig.ios || {}),
      infoPlist: {
        ...(expoConfig.ios?.infoPlist || {}),
        NSLocalNetworkUsageDescription:
          'Allow local network to connect to the development server during debugging.',
        NSBonjourServices: [
          '_expo-development-server._tcp',
          '_expo-development-client._tcp',
          '_http._tcp',
          '_https._tcp',
        ],
      },
    },
    extra: {
      ...expoConfig.extra,
      // Explicitly pass through all public env needed at runtime
      EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
      EXPO_PUBLIC_ANON_KEY: process.env.EXPO_PUBLIC_ANON_KEY,
      EXPO_PUBLIC_SUPERWALL_API_KEY: process.env.EXPO_PUBLIC_SUPERWALL_API_KEY,
      EXPO_PUBLIC_REVENUECAT_API_KEY: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY,
      EXPO_PUBLIC_MIXPANEL_TOKEN: process.env.EXPO_PUBLIC_MIXPANEL_TOKEN,
      EXPO_PUBLIC_USE_EXPERIMENTAL_AI: process.env.EXPO_PUBLIC_USE_EXPERIMENTAL_AI,
      EXPO_PUBLIC_GEMINI_API_KEY: process.env.EXPO_PUBLIC_GEMINI_API_KEY,
      EXPO_PUBLIC_DISABLE_ANALYTICS: process.env.EXPO_PUBLIC_DISABLE_ANALYTICS,
    },
  };
};
