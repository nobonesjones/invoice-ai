import { config } from 'dotenv';

// Load environment variables from .env file
config();

export default ({ config: expoConfig }) => {
  return {
    ...expoConfig,
    extra: {
      ...expoConfig.extra,
      EXPO_PUBLIC_GEMINI_API_KEY: process.env.EXPO_PUBLIC_GEMINI_API_KEY,
    },
  };
};
