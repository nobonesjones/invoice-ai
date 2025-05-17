import { Stack } from "expo-router";
import { useColorScheme } from "react-native"; // Import useColorScheme

import { colors } from "@/constants/colors";

export const unstable_settings = {
	initialRouteName: "sign-up",
};

export default function AuthLayout() {
	const deviceColorScheme = useColorScheme() ?? "light"; // Get device scheme

	return (
		<Stack
			screenOptions={{
				headerShown: false,
				// Use device scheme for header background and tint color
				headerStyle: {
					backgroundColor: "#FFFFFF", // Set header background to white
				},
				headerTintColor: "#000000", // Set header tint (back arrow, title) to black
			}}
		>
			{/* Sign Up Screen */}
			<Stack.Screen
				name="sign-up"
				options={{
					headerShown: true, // Keep header bar space
					headerTitle: "", // Hide title text
					gestureEnabled: false,
				}}
			/>
			{/* Sign In Screen */}
			<Stack.Screen
				name="sign-in"
				options={{
					presentation: "modal",
					headerShown: true,
					headerTitle: "", // Hide title text
					gestureEnabled: true,
				}}
			/>
		</Stack>
	);
}
