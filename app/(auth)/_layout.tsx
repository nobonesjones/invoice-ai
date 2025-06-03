import { Stack } from "expo-router";
import React from "react";

export default function AuthLayout() {
	return (
		<Stack
			screenOptions={{
				headerShown: false, // Hide the header for all screens in this stack
			}}
			initialRouteName="onboarding-1" // Start with the first onboarding screen
		>
			<Stack.Screen name="onboarding-1" />
			<Stack.Screen name="onboarding-2" />
			<Stack.Screen name="onboarding-3" />
			<Stack.Screen name="onboarding-4" />
			<Stack.Screen name="onboarding-5" />
			<Stack.Screen name="onboarding-6" />
			<Stack.Screen name="onboarding-7" />
			<Stack.Screen name="onboarding-8" />
		</Stack>
	);
}
