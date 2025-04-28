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
import { colors } from "@/constants/colors";
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
			className="flex-1 p-4"
			style={{ backgroundColor: colors.light.background }}
			edges={["bottom"]}
		>
			<TouchableOpacity
				onPress={() => router.back()}
				className="mb-4"
			>
				<Text>
					<ChevronLeft size={24} color={colors.light.foreground} />
				</Text>
			</TouchableOpacity>

			<View className="flex-1 gap-4 web:m-4">
				<View className="w-full">
					<H1 className="self-start mb-4" style={{ color: colors.light.foreground }}>Sign Up</H1>
					<Muted className="self-start mb-2.5" style={{ color: colors.light.mutedForeground }}>
						Saving the world from admin, one meeting at a time.
					</Muted>

					{generalError ? (
						<View className="bg-red-500/10 p-3 rounded-lg">
							<Text className="text-red-500">{generalError}</Text>
						</View>
					) : null}

					<View className="gap-4">
						<View>
							<Text style={{ color: colors.light.foreground }} className="mb-1.5">
								Email
							</Text>
							<Input
								value={email}
								onChangeText={setEmail}
								placeholder="Enter your email"
								keyboardType="email-address"
								autoCapitalize="none"
								style={{ backgroundColor: colors.light.card, color: colors.light.foreground, borderColor: colors.light.border, borderWidth: 1 }}
								placeholderTextColor={colors.light.mutedForeground}
							/>
							{errors.email ? (
								<Text className="text-red-500 mt-1">{errors.email}</Text>
							) : null}
						</View>

						<View>
							<Text style={{ color: colors.light.foreground }} className="mb-1.5">
								Password
							</Text>
							<Input
								value={password}
								onChangeText={setPassword}
								placeholder="Create a password"
								secureTextEntry
								style={{ backgroundColor: colors.light.card, color: colors.light.foreground, borderColor: colors.light.border, borderWidth: 1 }}
								placeholderTextColor={colors.light.mutedForeground}
							/>
							{errors.password ? (
								<Text className="text-red-500 mt-1">{errors.password}</Text>
							) : null}
						</View>

						<View>
							<Text style={{ color: colors.light.foreground }} className="mb-1.5">
								Confirm Password
							</Text>
							<Input
								value={confirmPassword}
								onChangeText={setConfirmPassword}
								placeholder="Confirm password"
								secureTextEntry
								style={{ backgroundColor: colors.light.card, color: colors.light.foreground, borderColor: colors.light.border, borderWidth: 1 }}
								placeholderTextColor={colors.light.mutedForeground}
							/>
							{confirmPasswordError ? (
								<Text className="text-red-500 mt-1">{confirmPasswordError}</Text>
							) : null}
						</View>
					</View>

					<View className="flex-row justify-center mt-4">
						<Text style={{ color: colors.light.mutedForeground }}>Already have an account? </Text>
						<Link href="/sign-in" asChild>
							<TouchableOpacity>
								<Text style={{ color: colors.light.primary }}>Sign In</Text>
							</TouchableOpacity>
						</Link>
					</View>
				</View>
			</View>

			<Button
				onPress={handleSignUp}
				className="web:m-4"
				style={{ backgroundColor: colors.light.primary }}
				disabled={isLoading}
			>
				{isLoading ? (
					<ActivityIndicator size="small" color={colors.light.primaryForeground} />
				) : (
					<Text style={{ color: colors.light.primaryForeground }}>Sign Up</Text>
				)}
			</Button>
		</SafeAreaView>
	);
}
