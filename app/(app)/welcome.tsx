import { useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";

import { Image } from "@/components/image";
import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, Muted } from "@/components/ui/typography";
import { useTheme } from "@/context/theme-provider";

export default function WelcomeScreen() {
	const router = useRouter();
	const { theme } = useTheme();

	return (
		<SafeAreaView 
			style={{ backgroundColor: theme.background }}
			className="flex flex-1 p-4"
		>
			<View className="flex flex-1 items-center justify-center gap-y-4 web:m-4">
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
			<View className="flex flex-col gap-y-4 web:m-4">
				<Button
					onPress={() => {
						router.push("/(app)/(auth)/sign-up");
					}}
					style={{ backgroundColor: theme.primary }}
					className="mb-4"
				>
					<Text style={{ color: theme.primaryForeground }}>Sign Up</Text>
				</Button>
				<Button
					onPress={() => {
						router.push("/(app)/(auth)/sign-in");
					}}
					style={{ backgroundColor: theme.secondary }}
				>
					<Text style={{ color: theme.secondaryForeground }}>Sign In</Text>
				</Button>
			</View>
		</SafeAreaView>
	);
}
