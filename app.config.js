import { config } from "dotenv";

// Load environment variables from .env file
config();

export default ({ config: expoConfig }) => {
  // Choose JS engine per env/profile; default to Hermes
  // - Set EXPO_JS_ENGINE=jsc to force JSC for builds
  // - EAS: you can also use EAS_BUILD_PROFILE to branch
  const engine = process.env.EXPO_JS_ENGINE
    ? process.env.EXPO_JS_ENGINE
    : (process.env.EAS_BUILD_PROFILE === 'jsc' ? 'jsc' : 'hermes');

  return {
    ...expoConfig,
    jsEngine: engine,
    newArchEnabled: false,
    ios: {
      ...(expoConfig.ios || {}),
      // This is honored by prebuild to sync Podfile.properties.json
      jsEngine: engine,
    },
    extra: {
      ...expoConfig.extra,
      EXPO_PUBLIC_GEMINI_API_KEY: process.env.EXPO_PUBLIC_GEMINI_API_KEY,
    },
  };
};
