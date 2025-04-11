import { useState } from "react";
import { View, TouchableOpacity, ActivityIndicator } from "react-native";
import { Link, useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { H1, Muted } from "@/components/ui/typography";
import { useSupabase } from "@/context/supabase-provider";
import { useTheme } from "@/context/theme-provider";
import { colors } from "@/constants/colors";

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
	const { theme, isLightMode } = useTheme();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
	const [isLoading, setIsLoading] = useState(false);
	const [generalError, setGeneralError] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [confirmPasswordError, setConfirmPasswordError] = useState("");

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
		<View style={{ flex: 1, backgroundColor: theme.background }}>
			<TouchableOpacity
				onPress={() => router.back()}
				className="p-4 absolute top-12 left-4 z-10"
			>
				<Text>
					<ChevronLeft size={24} color={theme.foreground} />
				</Text>
			</TouchableOpacity>
			<View className="flex-1 gap-4 web:m-4">
				<H1 className="self-start" style={{ color: theme.foreground }}>Sign Up - Test Change</H1>
				<Muted className="self-start" style={{ color: theme.mutedForeground }}>
					Saving the world from admin, one meeting at a time.
				</Muted>

				{generalError ? (
					<View className="bg-red-500/10 p-3 rounded-lg">
						<Text className="text-red-500">{generalError}</Text>
					</View>
				) : null}

				<View className="gap-4">
					<View>
						<Text style={{ color: theme.foreground }} className="mb-1.5">
							Email
						</Text>
						<Input
							value={email}
							onChangeText={setEmail}
							placeholder="Enter your email"
							keyboardType="email-address"
							autoCapitalize="none"
							style={{ backgroundColor: theme.card, color: theme.foreground }}
							placeholderTextColor={theme.mutedForeground}
						/>
						{errors.email ? (
							<Text className="text-red-500 mt-1">{errors.email}</Text>
						) : null}
					</View>

					<View>
						<Text style={{ color: theme.foreground }} className="mb-1.5">
							Password
						</Text>
						<Input
							value={password}
							onChangeText={setPassword}
							placeholder="Create a password"
							secureTextEntry
							style={{ backgroundColor: theme.card, color: theme.foreground }}
							placeholderTextColor={theme.mutedForeground}
						/>
						{errors.password ? (
							<Text className="text-red-500 mt-1">{errors.password}</Text>
						) : null}
					</View>

					<View>
						<Text style={{ color: theme.foreground }} className="mb-1.5">
							Confirm Password
						</Text>
						<Input
							value={confirmPassword}
							onChangeText={setConfirmPassword}
							placeholder="Confirm password"
							secureTextEntry
							style={{ backgroundColor: theme.card, color: theme.foreground }}
							placeholderTextColor={theme.mutedForeground}
						/>
						{confirmPasswordError ? (
							<Text className="text-red-500 mt-1">{confirmPasswordError}</Text>
						) : null}
					</View>
				</View>

				<Button
					onPress={handleSignUp}
					className="mt-4"
					style={{ backgroundColor: theme.primary }}
					disabled={isLoading}
				>
					{isLoading ? (
						<ActivityIndicator size="small" color="#fff" />
					) : (
						<Text style={{ color: theme.primaryForeground }}>Sign Up</Text>
					)}
				</Button>

				<View className="flex-row justify-center mt-4">
					<Text style={{ color: theme.mutedForeground }}>Already have an account? </Text>
					<Link href="/sign-in" asChild>
						<TouchableOpacity>
							<Text style={{ color: theme.primary }}>Sign In</Text>
						</TouchableOpacity>
					</Link>
				</View>
			</View>
		</View>
	);
}
