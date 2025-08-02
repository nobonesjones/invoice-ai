import "react-native-gesture-handler"; // This must be the first import
import "../global.css";

import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Host } from "react-native-portalize";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { TabBarVisibilityProvider } from "@/context/TabBarVisibilityContext";
import { SupabaseProvider, useSupabase } from "@/context/supabase-provider";
import { ThemeProvider, useTheme } from "@/context/theme-provider";
import { UsageProvider } from "@/context/usage-provider";
import { OnboardingProvider } from "@/context/onboarding-provider";
import { PaywallProvider } from "@/context/paywall-provider";
import { SuperwallProvider } from "expo-superwall";

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
		// Check if the current route is within the public group (for shared invoices)
		const inPublicGroup = segments[0] === "(public)" || segments[0] === "shared" || segments[0] === "invoice" || segments[0] === "test";
		// Check if the current route is the welcome screen
		const isWelcomeScreen =
			segments[0] === "(app)" &&
			segments.length === 2 &&
			segments[1] === "welcome";
			
		// Check if the current route is the soft paywall screen
		const isSoftPaywallScreen =
			segments[0] === "(app)" &&
			segments.length === 2 &&
			segments[1] === "soft-paywall";

    // Check if the current route is account-details directly under (app)
    const isAccountDetailsScreen =
      segments[0] === "(app)" &&
      segments.length === 2 &&
      segments[1] === "account-details";

    // Check for new settings screens directly under (app)
    const isBusinessInformationScreen =
      segments[0] === "(app)" && segments.length === 2 && segments[1] === "business-information";
    const isInvoiceSettingsScreen =
      segments[0] === "(app)" && segments.length === 2 && segments[1] === "invoice-settings";
    const isTaxCurrencyScreen =
      segments[0] === "(app)" && segments.length === 2 && segments[1] === "tax-currency";
    const isAppLanguageScreen =
      segments[0] === "(app)" && segments.length === 2 && segments[1] === "app-language";
    const isCustomerSupportScreen =
      segments[0] === "(app)" && segments.length === 2 && segments[1] === "customer-support";
    const isPaymentOptionsScreen =
      segments[0] === "(app)" && segments.length === 2 && segments[1] === "payment-options";
    const isPaymentRemindersScreen =
      segments[0] === "(app)" && segments.length === 2 && segments[1] === "payment-reminders";

		const isInProtectedGroup = inAppProtectedRoute;

		// console.log("[Auth Effect] Running Effect..."); // Log start
		// console.log("[Auth Effect] Session:", session ? "Exists" : "null"); // Log session state
		// console.log("[Auth Effect] Segments:", JSON.stringify(segments)); // Log current route segments
		// console.log("[Auth Effect] inAuthGroup:", inAuthGroup); // Log if in auth group
		// console.log("[Auth Effect] inPublicGroup:", inPublicGroup); // Log if in public group
		// console.log("[Auth Effect] isInProtectedGroup:", isInProtectedGroup);
    // console.log("[Auth Effect] isAccountDetailsScreen:", isAccountDetailsScreen);
    // console.log("[Auth Effect] isBusinessInformationScreen:", isBusinessInformationScreen);
    // console.log("[Auth Effect] isInvoiceSettingsScreen:", isInvoiceSettingsScreen);
    // console.log("[Auth Effect] isTaxCurrencyScreen:", isTaxCurrencyScreen);
    // console.log("[Auth Effect] isAppLanguageScreen:", isAppLanguageScreen);
    // console.log("[Auth Effect] isCustomerSupportScreen:", isCustomerSupportScreen);
    // console.log("[Auth Effect] isPaymentOptionsScreen:", isPaymentOptionsScreen);
    // console.log("[Auth Effect] isPaymentRemindersScreen:", isPaymentRemindersScreen);

		if (session && 
        !inAppProtectedRoute && 
        !isAccountDetailsScreen &&
        !isBusinessInformationScreen &&
        !isInvoiceSettingsScreen &&
        !isTaxCurrencyScreen &&
        !isAppLanguageScreen &&
        !isCustomerSupportScreen &&
        !isPaymentOptionsScreen &&
        !isPaymentRemindersScreen &&
        !isSoftPaywallScreen
      ) { 
			// User is logged in but not in the main protected area OR any allowed app-level screens.
			// Redirect to the main protected route (e.g., home screen).
			// console.log("[Auth Effect] Redirecting to /(app)/(protected)"); // Log redirection case 1
			router.replace("/(app)/(protected)");
		} else if (
			!session &&
			!(inAuthGroup || inAppAuthGroup || inPublicGroup || isWelcomeScreen || isSoftPaywallScreen)
		) {
			// User is not logged in AND is not on any allowed auth/onboarding/welcome/public screen.
			// Redirect to the start of the onboarding flow.
			// console.log("[Auth Effect] Redirecting to /(auth)/onboarding-1"); // Log redirection case 2
			router.replace("/(auth)/onboarding-1");
		}
	}, [initialized, session, segments]);

	// Render the current route using Slot
	// Navigation is handled by the useEffect above
	return <Slot />;
}

export default function AppLayout() {
	return (
		<SafeAreaProvider>
			<GestureHandlerRootView style={{ flex: 1 }}>
				<Host>
					<SupabaseProvider>
						<ThemeProvider>
							<SuperwallProvider apiKeys={{ ios: process.env.EXPO_PUBLIC_SUPERWALL_API_KEY! }}>
								<PaywallProvider>
									<UsageProvider>
										<OnboardingProvider>
									<BottomSheetModalProvider>
										<TabBarVisibilityProvider>
											<RootLayoutNav />
										</TabBarVisibilityProvider>
									</BottomSheetModalProvider>
										</OnboardingProvider>
									</UsageProvider>
								</PaywallProvider>
							</SuperwallProvider>
						</ThemeProvider>
					</SupabaseProvider>
				</Host>
			</GestureHandlerRootView>
		</SafeAreaProvider>
	);
}
