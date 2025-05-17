import "react-native-gesture-handler"; // This must be the first import
import "../global.css";

import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Host } from "react-native-portalize";

import { TabBarVisibilityProvider } from "@/context/TabBarVisibilityContext";
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
		const inAppProtectedRoute =
			segments[0] === "(app)" && segments[1] === "(protected)";
		// Check if the current route is the welcome screen
		const isWelcomeScreen =
			segments[0] === "(app)" &&
			segments.length === 2 &&
			segments[1] === "welcome";
		const isInProtectedGroup = inAppProtectedRoute;

		console.log("[Auth Effect] Running Effect..."); // Log start
		console.log("[Auth Effect] Session:", session ? "Exists" : "null"); // Log session state
		console.log("[Auth Effect] Segments:", JSON.stringify(segments)); // Log current route segments
		console.log("[Auth Effect] inAuthGroup:", inAuthGroup); // Log if in auth group
		console.log("[Auth Effect] isInProtectedGroup:", isInProtectedGroup); // Log if in protected group

		if (session && !inAppProtectedRoute) {
			// User is logged in but not in the main protected area.
			// Redirect to the main protected route (e.g., home screen).
			console.log("[Auth Effect] Redirecting to /(app)/(protected)"); // Log redirection case 1
			router.replace("/(app)/(protected)");
		} else if (
			!session &&
			!(inAuthGroup || inAppAuthGroup || isWelcomeScreen)
		) {
			// User is not logged in AND is not on any allowed auth/onboarding/welcome screen.
			// Redirect to the start of the onboarding flow.
			console.log("[Auth Effect] Redirecting to /(auth)/onboarding-1"); // Log redirection case 2
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
						<BottomSheetModalProvider>
							<TabBarVisibilityProvider>
								<RootLayoutNav />
							</TabBarVisibilityProvider>
						</BottomSheetModalProvider>
					</ThemeProvider>
				</SupabaseProvider>
			</Host>
		</GestureHandlerRootView>
	);
}
