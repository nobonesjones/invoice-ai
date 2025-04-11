import { Stack } from "expo-router";

import { colors } from "@/constants/colors";
import { useColorScheme } from "@/lib/useColorScheme";

export const unstable_settings = {
	initialRouteName: "(auth)",
};

export default function AppLayout() {
	// Use light mode throughout the app
	const colorScheme = "light";

	return (
		<Stack screenOptions={{ headerShown: false, gestureEnabled: true }}>
			<Stack.Screen 
				name="(protected)" 
				options={{
					gestureEnabled: true,
					gestureDirection: "horizontal"
				}}
			/>
			<Stack.Screen name="welcome" />
			<Stack.Screen name="(auth)" options={{ headerShown: false }} />
			<Stack.Screen
				name="modal"
				options={{
					presentation: "modal",
					headerShown: true,
					headerTitle: "Modal",
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
