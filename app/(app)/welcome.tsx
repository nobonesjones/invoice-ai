import { useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";

import { Image } from "@/components/image";
import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, Muted } from "@/components/ui/typography";
import { colors } from "@/constants/colors";

export default function WelcomeScreen() {
	const router = useRouter();

	return (
		<SafeAreaView 
			style={{ backgroundColor: colors.light.background }}
			className="flex flex-1 p-4"
		>
			<View className="flex flex-1 items-center justify-center gap-y-4 web:m-4">
				<Image
					source={require("@/assets/summiticon.png")}
					className="w-24 h-24 rounded-3xl"
					resizeMode="contain"
				/>
				<H1 style={{ color: colors.light.foreground }} className="text-center">Welcome To Majlis</H1>
				<Muted style={{ color: colors.light.mutedForeground }} className="text-center">
					Saving the world from admin, one meeting at a time.
				</Muted>
			</View>
			<View className="flex flex-col gap-y-4 web:m-4">
				<Button
					size="default"
					variant="default"
					onPress={() => {
						router.push("/sign-up");
					}}
					style={{ backgroundColor: colors.light.primary }}
				>
					<Text style={{ color: colors.light.primaryForeground }}>Sign Up</Text>
				</Button>
				<Button
					size="default"
					variant="secondary"
					onPress={() => {
						router.push("/sign-in");
					}}
					style={{ backgroundColor: colors.light.secondary }}
				>
					<Text style={{ color: colors.light.secondaryForeground }}>Sign In</Text>
				</Button>
			</View>
		</SafeAreaView>
	);
}
