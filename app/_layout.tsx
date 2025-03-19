import "../global.css";

import { Slot } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { SupabaseProvider } from "@/context/supabase-provider";

export default function AppLayout() {
	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<SupabaseProvider>
				<Slot />
			</SupabaseProvider>
		</GestureHandlerRootView>
	);
}
