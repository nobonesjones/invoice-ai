import { Stack } from "expo-router";
import React from "react";

export const unstable_settings = {
	initialRouteName: "onboarding-1",
};

export default function AuthLayout() {
	return (
		<Stack
			screenOptions={{
				headerShown: false, // Hide the header for all screens in this stack
			}}
		/>
	);
}
