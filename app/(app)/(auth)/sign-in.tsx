import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { useForm } from "react-hook-form";
import { ActivityIndicator, TouchableOpacity, View, Alert } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import * as z from "zod";
import { useState } from "react";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormInput } from "@/components/ui/form";
import { Text } from "@/components/ui/text";
import { H1, Muted } from "@/components/ui/typography";
import { useSupabase } from "@/context/supabase-provider";
import { colors } from "@/constants/colors";

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

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			email: "",
			password: "",
		},
	});

	async function onSubmit(data: z.infer<typeof formSchema>) {
		try {
			// Clear any previous errors
			setSignInError(null);
			
			await signInWithPassword(data.email, data.password);
			form.reset();
		} catch (error: Error | any) {
			console.log("Login error:", error.message);
			
			// Set user-friendly error message
			if (error.message.includes("Invalid login")) {
				setSignInError("Invalid email or password. Please try again.");
			} else {
				setSignInError(error.message || "An error occurred during sign in. Please try again.");
			}
		}
	}

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
				<Text style={{ color: colors.light.foreground }}>
					<ChevronLeft size={24} color={colors.light.foreground} className="opacity-60" />
				</Text>
			</TouchableOpacity>
			<View className="flex-1 gap-4 web:m-4">
				<H1 className="self-start" style={{ color: colors.light.foreground }}>Sign In</H1>
				<Muted className="self-start" style={{ color: colors.light.mutedForeground }}>
					Welcome back! Sign in to continue.
				</Muted>
				
				{/* Display sign-in error if any */}
				{signInError && (
					<View className="bg-red-100 p-3 rounded-md mb-2">
						<Text style={{ color: colors.light.destructive }}>{signInError}</Text>
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
									style={{
										backgroundColor: colors.light.card,
										borderColor: colors.light.border,
										borderWidth: 1,
										padding: 10,
										color: colors.light.foreground,
									}}
									labelStyle={{ color: colors.light.foreground }}
									placeholderTextColor={colors.light.mutedForeground}
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
									style={{
										backgroundColor: colors.light.card,
										borderColor: colors.light.border,
										borderWidth: 1,
										padding: 10,
										color: colors.light.foreground,
									}}
									labelStyle={{ color: colors.light.foreground }}
									placeholderTextColor={colors.light.mutedForeground}
									{...field}
								/>
							)}
						/>
					</View>
				</Form>
			</View>
			<Button
				size="default"
				variant="default"
				onPress={form.handleSubmit(onSubmit)}
				disabled={form.formState.isSubmitting}
				className="web:m-4"
				style={{ backgroundColor: colors.light.primary }}
			>
				{form.formState.isSubmitting ? (
					<ActivityIndicator size="small" color={colors.light.primaryForeground} />
				) : (
					<Text style={{ color: colors.light.primaryForeground }}>Sign In</Text>
				)}
			</Button>
		</SafeAreaView>
	);
}
