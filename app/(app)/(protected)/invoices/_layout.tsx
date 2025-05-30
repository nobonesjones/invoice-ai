import { Stack } from "expo-router";
import React from "react";

export default function InvoicesStackLayout() {
	return (
		<Stack screenOptions={{ headerShown: false }}>
			<Stack.Screen name="index" />
			<Stack.Screen
				name="create"
				options={{
					headerShown: true, // This will be overridden by create.tsx's Stack.Screen options
					presentation: "card", // Changed from 'modal'
					// @ts-ignore - tabBarVisible is a custom option we're using
					tabBarVisible: false, // Context API handles this now, but leaving for now
				}}
			/>
			{/* Screen for viewing a single invoice */}
			<Stack.Screen 
				name="invoice-viewer" 
				options={{
					// headerShown: false, // Already set globally for the stack
					// @ts-ignore - tabBarVisible is a custom option for parent navigator
					tabBarVisible: false 
				}}
			/>
		</Stack>
	);
}
