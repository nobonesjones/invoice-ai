import { BottomSheetModalProvider } from "@gorhom/bottom-sheet"; // Import BottomSheetModalProvider
import * as Haptics from "expo-haptics"; // Import Haptics
import { Stack } from "expo-router";

import { colors } from "@/constants/colors";
import { useColorScheme } from "@/lib/useColorScheme";

// Function to trigger haptic feedback
const triggerHaptic = () => {
	Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

export const unstable_settings = {
	initialRouteName: "(auth)",
};

export default function AppLayout() {
	// Use light mode throughout the app
	const colorScheme = "light";

	return (
		<BottomSheetModalProvider>
			<Stack screenOptions={{ headerShown: false, gestureEnabled: true }}>
				<Stack.Screen
					name="(protected)"
					options={{
						headerShown: false, // Explicitly add for safeguard
						gestureEnabled: true,
						gestureDirection: "horizontal",
						// tabBarOnPress removed as it's not applicable here
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
		</BottomSheetModalProvider>
	);
}
