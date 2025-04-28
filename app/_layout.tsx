import 'react-native-gesture-handler';
import "../global.css";

import { Slot } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Host } from 'react-native-portalize';

import { SupabaseProvider } from "@/context/supabase-provider";
import { ThemeProvider, useTheme } from "@/context/theme-provider";

// Inner component to access theme context
function RootLayoutContent() {
	const { isLightMode } = useTheme();

	// console.log(`[_layout RootLayoutContent] Rendering. isLightMode: ${isLightMode}`);

	return (
		<Slot />
	);
}

export default function AppLayout() {
	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<Host>
				<SupabaseProvider>
					<ThemeProvider>
						<RootLayoutContent />
					</ThemeProvider>
				</SupabaseProvider>
			</Host>
		</GestureHandlerRootView>
	);
}
