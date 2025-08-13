import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_API_URL || 'https://wzpuzqzsjdizmpiobsuo.supabase.co';
const supabaseKey = process.env.EXPO_PUBLIC_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6cHV6cXpzamRpem1waW9ic3VvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2MjE3OTIsImV4cCI6MjA2MjE5Nzc5Mn0._XypJP5hEZT06UfA1uuHY5-TvsKzj5JnwjGa3LMKnyI';

console.log('Supabase Config Debug:');
console.log('EXPO_PUBLIC_API_URL:', supabaseUrl);
console.log('EXPO_PUBLIC_ANON_KEY:', supabaseKey ? 'SET' : 'NOT SET');

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables:');
  console.error('EXPO_PUBLIC_API_URL:', supabaseUrl);
  console.error('EXPO_PUBLIC_ANON_KEY:', supabaseKey);
  throw new Error("Missing Supabase URL or Key. Check your .env file and restart Expo.");
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
