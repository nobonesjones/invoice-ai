import "../global.css";

import { Slot } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { SupabaseProvider } from "@/context/supabase-provider";
import { ThemeProvider } from "@/context/theme-provider";

export default function AppLayout() {
	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<SupabaseProvider>
				<ThemeProvider>
					<Slot />
				</ThemeProvider>
			</SupabaseProvider>
		</GestureHandlerRootView>
	);
}
