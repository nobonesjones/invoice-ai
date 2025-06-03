import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import {
	Image,
	Platform,
	View,
	Alert,
	StyleSheet,
} from "react-native";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, Muted } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { useTheme } from "@/context/theme-provider";
import { useSupabase } from "@/context/supabase-provider";
import { useOnboarding } from "@/context/onboarding-provider";
import { AuthModal } from "@/components/auth/auth-modal";

export default function WelcomeScreen() {
	const router = useRouter();
	const { theme } = useTheme();
	const { session } = useSupabase();
	const { saveOnboardingData } = useOnboarding();
	const [authModalVisible, setAuthModalVisible] = useState(false);

	const handleContinue = () => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		setAuthModalVisible(true);
	};

	const handleSignUp = () => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		setAuthModalVisible(true);
	};

	const handleAuthSuccess = async () => {
		setAuthModalVisible(false);
		
		// Save onboarding data if user is now authenticated with their REAL account
		if (session?.user?.id) {
			try {
				await saveOnboardingData(session.user.id);
				console.log('[Welcome] Onboarding data saved successfully to real user account:', session.user.id);
			} catch (error) {
				console.error('[Welcome] Error saving onboarding data:', error);
				// Don't block the flow if onboarding data save fails
			}
		}
		
		// The app will automatically navigate based on auth state
	};

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
				{/* Sign up with Google Button */}
				<Button
					onPress={handleContinue}
					className={cn("mb-4")}
					style={[
						{
							backgroundColor: "#FFFFFF",
							borderWidth: 1,
							borderColor: "#E0E0E0",
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

				{/* Email Sign Up Button */}
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

				{/* Sign In Link */}
				<View className="flex-row justify-center mt-4">
					<Text style={{ color: theme.mutedForeground }}>
						Already have an account?{" "}
					</Text>
					<Button
						onPress={handleContinue}
						style={{ padding: 0, minHeight: 0 }}
					>
						<Text style={{ color: theme.primary, fontWeight: "600" }}>
							Sign In
						</Text>
					</Button>
				</View>
			</View>

			{/* Auth Modal */}
			<AuthModal
				visible={authModalVisible}
				onClose={() => setAuthModalVisible(false)}
				onSuccess={handleAuthSuccess}
			/>
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
