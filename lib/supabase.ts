import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_API_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_API_KEY;

if (!supabaseUrl) {
  throw new Error("Supabase URL is not defined. Please set EXPO_PUBLIC_API_URL in your .env file.");
}

if (!supabaseAnonKey) {
  throw new Error("Supabase anon key is not defined. Please set EXPO_PUBLIC_API_KEY in your .env file.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
