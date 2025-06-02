import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
	View,
	Text,
	StyleSheet,
	SafeAreaView,
	useColorScheme as useDeviceColorScheme,
	Animated,
} from "react-native";

import ShiningText from "@/components/ui/ShiningText";
import { Button } from "@/components/ui/button";
import { StepIndicator } from "@/components/ui/step-indicator";
import { P } from "@/components/ui/typography";
import { colors } from "@/constants/colors";

export default function OnboardingScreen3() {
	const router = useRouter();
	const deviceColorScheme = useDeviceColorScheme() ?? "light";
	const isDeviceLightMode = deviceColorScheme === "light";

	const translateY = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		const bounce = Animated.sequence([
			Animated.timing(translateY, {
				toValue: 5,
				duration: 1500,
				useNativeDriver: true,
			}),
			Animated.timing(translateY, {
				toValue: 0,
				duration: 1500,
				useNativeDriver: true,
			}),
		]);

		Animated.loop(bounce).start();
	}, [translateY]);

	const handleNext = () => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		router.replace("/(app)/soft-paywall");
	};

	return (
		<SafeAreaView
			className={`flex-1 bg-background ${!isDeviceLightMode ? "dark" : ""}`}
		>
			<View style={styles.container}>
				<StepIndicator currentStep={3} totalSteps={3} />

				<View style={styles.box}>
					<Animated.View
						style={{
							width: "100%",
							height: "100%",
							transform: [{ translateY }],
						}}
					>
						<View className="w-full h-full bg-gray-300 rounded-lg" />
					</Animated.View>
				</View>

				<View style={styles.textContainer}>
					<ShiningText
						text="Onboarding 3"
						className="text-3xl font-bold text-center text-foreground mb-4"
						numberOfLines={1}
					/>
					<P
						style={[
							styles.description,
							{ color: colors[deviceColorScheme].mutedForeground },
						]}
					>
						The best thing about the app...
					</P>
				</View>

				<View style={styles.spacer} />

				{/* Action Button */}
				<Button
					onPress={handleNext}
					className="w-full dark:bg-white dark:text-primary"
				>
					Get Started
				</Button>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
	},
	container: {
		flex: 1,
		padding: 20,
		alignItems: "center",
		justifyContent: "space-between",
		paddingBottom: 40,
	},
	box: {
		width: "100%",
		height: 300,
		justifyContent: "center",
		alignItems: "center",
		marginBottom: 20,
		borderRadius: 10,
		padding: 10,
		marginTop: 30,
		overflow: "hidden",
	},
	description: {
		textAlign: "center",
		fontSize: 16,
		marginBottom: 20,
	},
	textContainer: {
		alignItems: "center",
		paddingHorizontal: 20,
		marginBottom: 30,
		marginTop: 60,
	},
	spacer: {
		flex: 1,
	},
});
