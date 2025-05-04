import { useRouter } from "expo-router";
import { View, StyleSheet, Image, SafeAreaView, Alert, Text } from "react-native";

import { Button } from '@/components/ui/button';
import { H1, Muted } from '@/components/ui/typography';
import { useTheme } from "@/context/theme-provider";
import * as Haptics from 'expo-haptics'; 
import { supabase } from '@/config/supabase'; 
import { cn } from '@/lib/utils'; 

export default function WelcomeScreen() {
	const router = useRouter();
	const { theme } = useTheme();

	const handleContinue = () => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		router.push('/(auth)/login');
	};

	const handleSignUp = () => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		router.push('/(auth)/sign-up'); 
	};

	// Function to handle Google Sign-In
	async function signInWithGoogle() {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		try {
			const { data, error } = await supabase.auth.signInWithOAuth({
				provider: 'google',
				options: {
					// Optional: If you need specific scopes
					// scopes: 'https://www.googleapis.com/auth/calendar',
				},
			});

			if (error) {
				console.error('Google Sign-In Error:', error.message);
				Alert.alert('Sign In Error', error.message || 'An unexpected error occurred.');
			}
			// If successful, Supabase handles the redirect/callback
			// You might want to add loading state handling here
		} catch (catchError: any) {
			console.error('Caught error during Google Sign-In:', catchError);
			Alert.alert('Sign In Error', catchError.message || 'An unexpected error occurred.');
		}
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
          className={cn('mb-4 flex-row items-center justify-center')} 
          style={{ backgroundColor: '#FFFFFF' }} 
        >
          <Image source={require('../../assets/google.png')} style={styles.googleLogo} />
          <Text style={{ color: '#000000', marginLeft: 12, fontWeight: '600', marginBottom: -2 }}>Sign up with Google</Text>
        </Button>

				{/* Email Sign Up Button (Outline Style) */}
        <Button
          onPress={handleSignUp} 
          className="flex-row items-center justify-center" 
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
		padding: 16, 
		gap: 16, 
	},
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 16, 
    paddingBottom: 40, 
  },
  googleLogo: {
    width: 22, 
    height: 22, 
  }
});
