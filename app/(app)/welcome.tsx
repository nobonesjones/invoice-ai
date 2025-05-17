import { makeRedirectUri } from "expo-auth-session";
import * as Haptics from "expo-haptics";
import { useRouter, Link } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
	View,
	StyleSheet,
	SafeAreaView,
	Alert,
	Text,
	Image,
	Platform,
} from "react-native";

import { Button } from "@/components/ui/button";
import { H1, Muted } from "@/components/ui/typography";
import { supabase } from "@/config/supabase";
import { useTheme } from "@/context/theme-provider";
import { cn } from "@/lib/utils";

WebBrowser.maybeCompleteAuthSession();

export default function WelcomeScreen() {
	const router = useRouter();
	const { theme } = useTheme();

	const handleContinue = () => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		router.push({ pathname: "/(app)/(auth)/sign-in" });
	};

	const handleSignUp = () => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		router.push({ pathname: "/(app)/(auth)/sign-up" });
	};

	// Function to handle Google Sign-In
	async function signInWithGoogle() {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		try {
			// Explicitly define the redirect URI using the app's custom scheme
			const explicitRedirectTo = "expo-supabase-starter://oauth/callback";
			console.log("Passing redirectTo to Supabase:", explicitRedirectTo); // Log the URI being passed

			const { data, error } = await supabase.auth.signInWithOAuth({
				provider: "google",
				options: {
					redirectTo: explicitRedirectTo, // Use the explicitly defined URI
					// Optional: If you need specific scopes
					// scopes: 'https://www.googleapis.com/auth/calendar',
				},
			});

			// Log the data object regardless of error
			console.log(
				"Supabase signInWithOAuth data:",
				JSON.stringify(data, null, 2),
			);

			if (error) {
				console.error("Google Sign-In Error:", error.message);
				Alert.alert(
					"Sign In Error",
					error.message || "An unexpected error occurred.",
				);
				return; // Stop execution if there was an error getting the URL
			}

			// Manually open the auth URL if it exists
			if (data?.url) {
				console.log("Attempting to open URL with WebBrowser:", data.url);
				try {
					const result = await WebBrowser.openAuthSessionAsync(
						data.url,
						explicitRedirectTo, // Use the same redirect URI we told Supabase about
					);
					console.log(
						"WebBrowser.openAuthSessionAsync result:",
						JSON.stringify(result, null, 2),
					);

					// Manually set the session if the login was successful
					if (result.type === "success" && result.url) {
						// Extract tokens from the URL fragment
						const params = new URLSearchParams(result.url.split("#")[1]);
						const access_token = params.get("access_token");
						const refresh_token = params.get("refresh_token");

						if (access_token && refresh_token) {
							console.log("Attempting to set session manually...");
							const { error: setError } = await supabase.auth.setSession({
								access_token,
								refresh_token,
							});
							if (setError) {
								console.error("Error setting session manually:", setError);
								Alert.alert("Session Error", "Could not set user session.");
							} else {
								console.log("Session set manually successfully.");
								// The useEffect in _layout should now detect the session and redirect
							}
						} else {
							console.error("Could not extract tokens from redirect URL");
							Alert.alert(
								"Sign In Error",
								"Could not process authentication response.",
							);
						}
					} else if (result.type !== "cancel") {
						// Handle other non-cancel results if necessary
						console.warn(
							"WebBrowser result was not success or cancel:",
							result,
						);
					}
				} catch (webError: any) {
					console.error(
						"Error opening WebBrowser:",
						JSON.stringify(webError, null, 2),
					);
					Alert.alert(
						"Browser Error",
						webError.message || "Could not open authentication page.",
					);
				}
			} else {
				console.error("No URL received from Supabase signInWithOAuth");
				Alert.alert("Sign In Error", "Could not get authentication URL.");
			}
		} catch (catchError: any) {
			// Log the entire error object for more details
			console.error(
				"Caught error during Google Sign-In:",
				JSON.stringify(catchError, null, 2),
			);
			Alert.alert(
				"Sign In Error",
				catchError.message || "An unexpected error occurred.",
			);
		}
	}

	return (
		<SafeAreaView style={[styles.safeArea, { backgroundColor: "#FFFFFF" }]}>
			{/* Main Content Area with Padding */}
			<View style={styles.contentContainer}>
				{/* Updated to Image component */}
				<Image
					source={require("../../assets/rocketicon.png")}
					className="w-40 h-40 rounded-3xl"
				/>
				<H1 style={{ color: theme.foreground }} className="text-center">
					Supastarter
				</H1>
				<Muted style={{ color: theme.mutedForeground }} className="text-center">
					Sign up to this app because it's incredible.
				</Muted>
			</View>

			{/* Button Container with Padding */}
			<View style={styles.buttonContainer}>
				{/* Google Button (White BG, Black Text) */}
				<Button
					onPress={signInWithGoogle}
					className={cn("mb-4")}
					style={[
						{
							backgroundColor: "#FFFFFF",
							borderWidth: 1,
							borderColor: "#E0E0E0", // Light gray border for Google button
						},
						Platform.OS === "ios"
							? {
									shadowColor: "#000",
									shadowOffset: { width: 0, height: 2 },
									shadowOpacity: 0.1,
									shadowRadius: 3,
								}
							: {
									elevation: 3,
								},
					]}
				>
					<View className="flex-row items-center justify-center">
						<Image
							source={require("../../assets/google.png")}
							style={styles.googleLogo}
						/>
						<Text
							style={{ color: "#000000", marginLeft: 12, fontWeight: "600" }}
						>
							Sign up with Google
						</Text>
					</View>
				</Button>

				{/* Email Sign Up Button (Outline Style) */}
				<Button
					onPress={handleSignUp}
					className="flex-row items-center justify-center"
					style={[
						{
							backgroundColor: "transparent",
							borderColor: theme.border,
							borderWidth: 1,
						},
						Platform.OS === "ios"
							? {
									shadowColor: "#000",
									shadowOffset: { width: 0, height: 2 },
									shadowOpacity: 0.1,
									shadowRadius: 3,
								}
							: {
									elevation: 3,
								},
					]}
				>
					<Text style={{ color: theme.foreground, fontWeight: "600" }}>
						Sign up with Email
					</Text>
				</Button>

				{/* Added text and link: 'Have an account? Log In' */}
				<View style={{ alignItems: "center", marginTop: 24, marginBottom: 8 }}>
					<Text
						style={{
							color: theme.mutedForeground,
							fontSize: 14,
							textAlign: "center",
						}}
					>
						Have an account?{" "}
						<Link href="/(app)/(auth)/sign-in" asChild>
							<Text
								style={{
									color: theme.primary,
									fontWeight: "600",
									fontSize: 14,
								}}
							>
								Log In
							</Text>
						</Link>
					</Text>
				</View>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
		justifyContent: "flex-end", // Align children to the bottom
	},
	contentContainer: {
		flex: 1, // Expand upwards to fill available space
		justifyContent: "center",
		alignItems: "center",
		padding: 16,
		gap: 16,
		width: "100%", // Ensure it takes full width
	},
	buttonContainer: {
		width: "100%",
		paddingHorizontal: 16,
		paddingBottom: 0, // Removed padding from bottom
		marginTop: 24, // Space between contentContainer and buttonContainer (was 120)
	},
	googleLogo: {
		width: 22,
		height: 22,
	},
});
