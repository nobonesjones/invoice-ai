import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_API_URL as string;
const supabaseKey = process.env.EXPO_PUBLIC_API_KEY as string;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase URL or Key. Check your .env file.");
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
	auth: {
		storage: AsyncStorage,
		autoRefreshToken: true,
		persistSession: true,
		detectSessionInUrl: false,
	},
});

// Handle AppState changes for auth refresh - properly managed to prevent memory leaks
const handleAppStateChange = (state: string) => {
	if (state === "active") {
		supabase.auth.startAutoRefresh();
	} else {
		supabase.auth.stopAutoRefresh();
	}
};

const subscription = AppState.addEventListener("change", handleAppStateChange);

// Export cleanup function for proper memory management
export const cleanupSupabase = () => {
	if (subscription?.remove) {
		subscription.remove();
	} else {
		AppState.removeEventListener("change", handleAppStateChange);
	}
};
