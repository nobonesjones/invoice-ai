import 'react-native-gesture-handler';
import "../global.css";

import { Slot, useRouter, useSegments } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Host } from 'react-native-portalize';
import { useEffect } from 'react';

import { SupabaseProvider, useSupabase } from "@/context/supabase-provider";
import { ThemeProvider, useTheme } from "@/context/theme-provider";

// Inner component to access theme and supabase context
function RootLayoutNav() {
	const { session, initialized } = useSupabase();
	const segments = useSegments();
	const router = useRouter();

	useEffect(() => {
		if (!initialized) return; // Wait until supabase is initialized

		// Check if the current route is within the initial onboarding/(auth) group
		const inAuthGroup = segments[0] === "(auth)";
		// Check if the current route is within the nested sign-in/(app)/(auth) group
		const inAppAuthGroup = segments[0] === "(app)" && segments[1] === "(auth)";
		// Check if the current route is within the main protected/(app)/(protected) group
		const inAppProtectedRoute = segments[0] === "(app)" && segments[1] === "(protected)";
		// Check if the current route is the welcome screen
		const isWelcomeScreen = segments[0] === "(app)" && segments.length === 2 && segments[1] === "welcome";

		if (session && !inAppProtectedRoute) {
			// User is logged in but not in the main protected area.
			// Redirect to the main protected route (e.g., home screen).
			router.replace("/(app)/(protected)");
		} else if (!session && !(inAuthGroup || inAppAuthGroup || isWelcomeScreen)) {
			// User is not logged in AND is not on any allowed auth/onboarding/welcome screen.
			// Redirect to the start of the onboarding flow.
			router.replace("/(auth)/onboarding-1");
		}
	}, [initialized, session, segments]);

	// Render the current route using Slot
	// Navigation is handled by the useEffect above
	return <Slot />;
}

export default function AppLayout() {
	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<Host>
				<SupabaseProvider>
					<ThemeProvider>
						<RootLayoutNav />
					</ThemeProvider>
				</SupabaseProvider>
			</Host>
		</GestureHandlerRootView>
	);
}
