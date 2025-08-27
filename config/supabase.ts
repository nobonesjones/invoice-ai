import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";

// Both env vars are now required - no hardcoded fallbacks
const supabaseUrl = process.env.EXPO_PUBLIC_API_URL;
const supabaseKey = process.env.EXPO_PUBLIC_ANON_KEY;

// Add safety checks
if (!supabaseUrl) {
  throw new Error("EXPO_PUBLIC_API_URL is not set. Please check your .env file.");
}

if (!supabaseKey) {
  throw new Error("EXPO_PUBLIC_ANON_KEY is not set. Please check your .env file.");
}


export const supabase = createClient(supabaseUrl, supabaseKey, {
	auth: {
		storage: AsyncStorage,
		autoRefreshToken: true,
		persistSession: true,
		detectSessionInUrl: false,
	},
});

AppState.addEventListener("change", (state) => {
	if (state === "active") {
		supabase.auth.startAutoRefresh();
	} else {
		supabase.auth.stopAutoRefresh();
	}
});
