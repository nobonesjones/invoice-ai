import { useState } from "react";
import { View, TouchableOpacity, ActivityIndicator, useColorScheme as useDeviceColorScheme } from "react-native";
import { Link, useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { H1, Muted } from "@/components/ui/typography";
import { useSupabase } from "@/context/supabase-provider";
import { SafeAreaView } from "@/components/safe-area-view";

const signUpSchema = z.object({
	email: z.string().email("Please enter a valid email address"),
	password: z
		.string()
		.min(8, "Password must be at least 8 characters")
		.max(64, "Password must be less than 64 characters"),
});

export default function SignUp() {
	const router = useRouter();
	const { signUp } = useSupabase();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
	const [isLoading, setIsLoading] = useState(false);
	const [generalError, setGeneralError] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [confirmPasswordError, setConfirmPasswordError] = useState("");

	const deviceColorScheme = useDeviceColorScheme() ?? 'light';
	const isDeviceLightMode = deviceColorScheme === 'light';

	const validateForm = () => {
		try {
			signUpSchema.parse({ email, password });
			setErrors({});
			if (password !== confirmPassword) {
				setConfirmPasswordError("Passwords do not match");
			} else {
				setConfirmPasswordError("");
			}
			return true;
		} catch (error) {
			if (error instanceof z.ZodError) {
				const fieldErrors: { email?: string; password?: string } = {};
				error.errors.forEach((err) => {
					const path = err.path[0];
					if (path === "email" || path === "password") {
						fieldErrors[path] = err.message;
					}
				});
				setErrors(fieldErrors);
			}
			return false;
		}
	};

	const handleSignUp = async () => {
		setGeneralError("");
		if (!validateForm()) return;

		try {
			setIsLoading(true);
			await signUp(email, password);
			// Success is handled by the Supabase provider
		} catch (error: any) {
			console.error("Error signing up:", error);
			setGeneralError(error.message || "An error occurred during sign up");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<SafeAreaView
			className={`flex-1 p-4 bg-background ${!isDeviceLightMode ? 'dark' : ''}`}
			edges={["bottom"]}
		>
			<TouchableOpacity
				onPress={() => router.back()}
				className="mb-4"
			>
				<Text className="text-foreground">
					<ChevronLeft size={24} className="text-foreground" />
				</Text>
			</TouchableOpacity>

			<View className="flex-1 gap-4 web:m-4">
				<View className="w-full">
					<H1 className="self-start mb-4 text-foreground">Sign Up</H1>
					<Muted className="self-start mb-2.5 text-muted-foreground">
						Saving the world from admin, one meeting at a time.
					</Muted>

					{generalError ? (
						<View className="bg-destructive/10 p-3 rounded-lg">
							<Text className="text-destructive">{generalError}</Text>
						</View>
					) : null}

					<View className="gap-4">
						<View>
							<Text className="mb-1.5 text-foreground">
								Email
							</Text>
							<Input
								value={email}
								onChangeText={setEmail}
								placeholder="Enter your email"
								keyboardType="email-address"
								autoCapitalize="none"
								className="bg-card border border-border text-foreground p-2.5 placeholder:text-muted-foreground"
							/>
							{errors.email ? (
								<Text className="text-destructive mt-1">{errors.email}</Text>
							) : null}
						</View>

						<View>
							<Text className="mb-1.5 text-foreground">
								Password
							</Text>
							<Input
								value={password}
								onChangeText={setPassword}
								placeholder="Create a password"
								secureTextEntry
								className="bg-card border border-border text-foreground p-2.5 placeholder:text-muted-foreground"
							/>
							{errors.password ? (
								<Text className="text-destructive mt-1">{errors.password}</Text>
							) : null}
						</View>

						<View>
							<Text className="mb-1.5 text-foreground">
								Confirm Password
							</Text>
							<Input
								value={confirmPassword}
								onChangeText={setConfirmPassword}
								placeholder="Confirm password"
								secureTextEntry
								className="bg-card border border-border text-foreground p-2.5 placeholder:text-muted-foreground"
							/>
							{confirmPasswordError ? (
								<Text className="text-destructive mt-1">{confirmPasswordError}</Text>
							) : null}
						</View>
					</View>

					<View className="flex-row justify-center mt-4">
						<Text className="text-muted-foreground">Already have an account? </Text>
						<Link href="/sign-in" asChild>
							<TouchableOpacity>
								<Text className="text-primary">Sign In</Text>
							</TouchableOpacity>
						</Link>
					</View>
				</View>
			</View>

			<Button
				onPress={handleSignUp}
				className="web:m-4 bg-primary dark:bg-white"
				disabled={isLoading}
			>
				{isLoading ? (
					<ActivityIndicator size="small" className="text-primary-foreground dark:text-black" />
				) : (
					<Text className="text-primary-foreground dark:text-black">Sign Up</Text>
				)}
			</Button>
		</SafeAreaView>
	);
}
