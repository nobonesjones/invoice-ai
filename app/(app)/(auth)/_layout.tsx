import { Stack } from "expo-router";

import { colors } from "@/constants/colors";
import { useColorScheme } from "@/lib/useColorScheme";

export const unstable_settings = {
	initialRouteName: "sign-up",
};

export default function AuthLayout() {
	// Force light mode for auth screens
	const colorScheme = "light";

	return (
		<Stack screenOptions={{ headerShown: false }}>
			<Stack.Screen
				name="sign-up"
				options={{
					headerShown: true,
					headerTitle: "Sign Up",
					headerStyle: {
						backgroundColor: colors.light.background,
					},
					headerTintColor: colors.light.foreground,
					gestureEnabled: false,
				}}
			/>
			<Stack.Screen
				name="sign-in"
				options={{
					presentation: "modal",
					headerShown: true,
					headerTitle: "Sign In",
					headerStyle: {
						backgroundColor: colors.light.background,
					},
					headerTintColor: colors.light.foreground,
					gestureEnabled: true,
				}}
			/>
		</Stack>
	);
}