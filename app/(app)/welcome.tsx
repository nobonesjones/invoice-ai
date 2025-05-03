import { useRouter } from "expo-router";
import React from "react";
import { View, StyleSheet } from "react-native";

import { Image } from 'expo-image'; // Ensure Image is imported
import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { H1, Muted } from '@/components/ui/typography';
import * as Haptics from 'expo-haptics'; // Import Haptics
import { supabase } from '@/config/supabase'; // Import Supabase client
import { useTheme } from "@/context/theme-provider";
import { cn } from '@/lib/utils'; // Import cn

export default function WelcomeScreen() {
	const router = useRouter();
	const { theme } = useTheme();

	const handleContinue = () => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		router.push('/(auth)/login');
	};

	const handleSignUp = () => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		router.push('/(auth)/signup'); // Route to email signup
	};

	// Function to handle Google Sign-In
	async function signInWithGoogle() {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		const { data, error } = await supabase.auth.signInWithOAuth({
			provider: 'google',
			options: {
				// Optional: If you need specific scopes
				// scopes: 'https://www.googleapis.com/auth/calendar',
			},
		});
		if (error) {
			console.error('Error signing in with Google:', error.message);
			// Optionally show an alert to the user
			// Alert.alert('Error', error.message);
		} 
		// Supabase handles the redirect and session creation automatically on success
	}

	return (
		<SafeAreaView
			style={[styles.safeArea, { backgroundColor: theme.background }]}
		>
			{/* Main Content Area with Padding */}
			<View style={styles.contentContainer}>
				<Image
					source={require("@/assets/summiticon.png")}
					className="w-24 h-24 rounded-3xl"
					resizeMode="contain"
				/>
				<H1 style={{ color: theme.foreground }} className="text-center">EasyMinutes.ai</H1>
				<Muted style={{ color: theme.mutedForeground }} className="text-center">
					Saving the world from admin, one meeting at a time.
				</Muted>
			</View>

			{/* Button Container with Padding */}
			<View style={styles.buttonContainer}>
				{/* Google Button (White BG, Black Text) */}
				<Button
          onPress={signInWithGoogle}
          className={cn('mb-4 flex-row items-center justify-center')} // Removed border class
          style={{ backgroundColor: '#FFFFFF' }} // Always white background
        >
          <Image source={require('../../assets/google.png')} style={styles.googleLogo} />
          <Text style={{ color: '#000000', marginLeft: 12, fontWeight: '600', marginBottom: -2 }}>Sign up with Google</Text>
        </Button>

				{/* Email Sign Up Button (Outline Style) */}
        <Button
          onPress={handleSignUp} // Points to email signup flow
          className="flex-row items-center justify-center" // Base classes
          style={{
            backgroundColor: 'transparent',
            borderColor: theme.border,
            borderWidth: 1,
          }}
        >
          <Text style={{ color: theme.foreground, fontWeight: '600' }}>Sign up with Email</Text>
        </Button>

			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
	},
	contentContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		padding: 16, // Apply padding here instead of SafeAreaView
		gap: 16, // Corresponds to gap-y-4
	},
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 16, // Add horizontal padding back (matches parent p-4)
    paddingBottom: 40, // Use padding instead of absolute bottom
  },
  googleLogo: {
    width: 22, // Increased size
    height: 22, // Increased size
  }
});
