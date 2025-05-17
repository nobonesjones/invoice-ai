import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { ChevronLeft } from "lucide-react-native";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
	ActivityIndicator,
	TouchableOpacity,
	View,
	Alert,
	useColorScheme as useDeviceColorScheme,
	Platform,
	Image,
} from "react-native";
import * as z from "zod";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormInput } from "@/components/ui/form";
import { Text } from "@/components/ui/text";
import { H1, Muted } from "@/components/ui/typography";
import { supabase } from "@/config/supabase";
import { useSupabase } from "@/context/supabase-provider";

WebBrowser.maybeCompleteAuthSession();

const formSchema = z.object({
	email: z.string().email("Please enter a valid email address."),
	password: z
		.string()
		.min(8, "Please enter at least 8 characters.")
		.max(64, "Please enter fewer than 64 characters."),
});

export default function SignIn() {
	const router = useRouter();
	const { signInWithPassword } = useSupabase();
	const [signInError, setSignInError] = useState<string | null>(null);
	const [isGoogleLoading, setIsGoogleLoading] = useState(false);
	const deviceColorScheme = useDeviceColorScheme() ?? "light";
	const isDeviceLightMode = deviceColorScheme === "light";

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			email: "",
			password: "",
		},
	});

	async function onSubmit(data: z.infer<typeof formSchema>) {
		try {
			setSignInError(null);
			await signInWithPassword(data.email, data.password);
			form.reset();
		} catch (error: Error | any) {
			console.log("Login error:", error.message);
			if (error.message.includes("Invalid login")) {
				setSignInError("Invalid email or password. Please try again.");
			} else {
				setSignInError(
					error.message ||
						"An error occurred during sign in. Please try again.",
				);
			}
		}
	}

	async function handleGoogleSignIn() {
		setIsGoogleLoading(true);
		try {
			const explicitRedirectTo = "expo-supabase-starter://oauth/callback";
			const { data, error } = await supabase.auth.signInWithOAuth({
				provider: "google",
				options: {
					redirectTo: explicitRedirectTo,
				},
			});

			if (error) {
				console.error("Google Sign-In Error:", error.message);
				Alert.alert(
					"Sign In Error",
					error.message || "An unexpected error occurred.",
				);
				setIsGoogleLoading(false);
				return;
			}

			if (data?.url) {
				const result = await WebBrowser.openAuthSessionAsync(
					data.url,
					explicitRedirectTo,
				);
				if (result.type === "success" && result.url) {
					const params = new URLSearchParams(result.url.split("#")[1]);
					const access_token = params.get("access_token");
					const refresh_token = params.get("refresh_token");
					if (access_token && refresh_token) {
						const { error: setError } = await supabase.auth.setSession({
							access_token,
							refresh_token,
						});
						if (setError) {
							console.error("Error setting session manually:", setError);
							Alert.alert("Session Error", "Could not set user session.");
						}
					} else {
						Alert.alert(
							"Sign In Error",
							"Could not process authentication response.",
						);
					}
				}
			} else {
				Alert.alert("Sign In Error", "Could not get authentication URL.");
			}
		} catch (catchError: any) {
			console.error(
				"Caught error during Google Sign-In:",
				JSON.stringify(catchError, null, 2),
			);
			Alert.alert(
				"Sign In Error",
				catchError.message || "An unexpected error occurred.",
			);
		} finally {
			setIsGoogleLoading(false);
		}
	}

	return (
		<SafeAreaView
			style={{ flex: 1, padding: 16, backgroundColor: "#FFFFFF" }}
			edges={["bottom"]}
		>
			<TouchableOpacity onPress={() => router.back()} className="mb-4">
				<Text className="text-foreground">
					<ChevronLeft size={24} className="text-foreground opacity-60" />
				</Text>
			</TouchableOpacity>
			<View className="flex-1 gap-4 web:m-4">
				<H1 className="self-start text-foreground">Sign In</H1>
				<Muted className="self-start text-muted-foreground">
					Welcome back! Sign in to continue.
				</Muted>

				{/* Sign In With Google Button */}
				<Button
					onPress={handleGoogleSignIn}
					disabled={isGoogleLoading || form.formState.isSubmitting}
					style={[
						{
							backgroundColor: "#FFFFFF",
							borderWidth: 1,
							borderColor: "#E0E0E0",
							flexDirection: "row",
							alignItems: "center",
							justifyContent: "center",
							marginTop: 20,
							paddingVertical: 12,
						},
						Platform.OS === "ios"
							? {
									shadowColor: "#000",
									shadowOffset: { width: 0, height: 4 },
									shadowOpacity: 0.3,
									shadowRadius: 5,
								}
							: {
									elevation: 8,
								},
					]}
				>
					{isGoogleLoading ? (
						<ActivityIndicator size="small" color="#000000" />
					) : (
						<>
							<Image
								source={require("@/assets/google.png")}
								style={{ width: 20, height: 20, marginRight: 10 }}
							/>
							<Text style={{ color: "#000000", fontWeight: "600" }}>
								Sign In With Google
							</Text>
						</>
					)}
				</Button>

				{/* OR Divider */}
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						marginTop: 30,
						marginBottom: 20,
					}}
				>
					<View
						style={{
							flex: 1,
							height: 1,
							borderBottomWidth: 1,
							borderColor: "#EEEEEE",
							borderStyle: "dashed",
						}}
					/>
					<Text
						style={{ paddingHorizontal: 10, color: "#888888", fontSize: 14 }}
					>
						OR
					</Text>
					<View
						style={{
							flex: 1,
							height: 1,
							borderBottomWidth: 1,
							borderColor: "#EEEEEE",
							borderStyle: "dashed",
						}}
					/>
				</View>

				{signInError && (
					<View className="bg-destructive/10 p-3 rounded-md mb-2">
						<Text className="text-destructive">{signInError}</Text>
					</View>
				)}

				<Form {...form}>
					<View className="gap-4">
						<FormField
							control={form.control}
							name="email"
							render={({ field }) => (
								<FormInput
									label="Email"
									placeholder="Email"
									autoCapitalize="none"
									autoComplete="email"
									autoCorrect={false}
									keyboardType="email-address"
									className="bg-card border border-border text-foreground p-2.5 placeholder:text-muted-foreground"
									{...field}
								/>
							)}
						/>
						<FormField
							control={form.control}
							name="password"
							render={({ field }) => (
								<FormInput
									label="Password"
									placeholder="Password"
									autoCapitalize="none"
									autoCorrect={false}
									secureTextEntry
									className="bg-card border border-border text-foreground p-2.5 placeholder:text-muted-foreground"
									{...field}
								/>
							)}
						/>
						<Button
							onPress={form.handleSubmit(onSubmit)}
							disabled={form.formState.isSubmitting || isGoogleLoading}
							style={[
								{
									backgroundColor: "#FFFFFF",
									borderWidth: 1,
									borderColor: "#E0E0E0",
								},
								Platform.OS === "ios"
									? {
											shadowColor: "#000",
											shadowOffset: { width: 0, height: 4 },
											shadowOpacity: 0.3,
											shadowRadius: 5,
										}
									: {
											elevation: 8,
										},
							]}
						>
							{form.formState.isSubmitting ? (
								<ActivityIndicator size="small" color="#000000" />
							) : (
								<Text style={{ color: "#000000", fontWeight: "600" }}>
									Sign In
								</Text>
							)}
						</Button>
					</View>
				</Form>
			</View>
		</SafeAreaView>
	);
}
