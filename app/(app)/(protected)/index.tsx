import { useRouter } from "expo-router";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "react-native";
import { useEffect, useState } from "react";

import { useTheme } from "@/context/theme-provider";

export default function Home() {
	const router = useRouter();
	const { theme } = useTheme();
	const [isMounted, setIsMounted] = useState(false);

	useEffect(() => {
		// Wait for component to mount before attempting navigation
		setIsMounted(true);
	}, []);

	useEffect(() => {
		if (isMounted) {
			// Add a small delay to ensure navigation is ready
			const timer = setTimeout(() => {
				router.replace("/(app)/(protected)/ai");
			}, 100);
			
			return () => clearTimeout(timer);
		}
	}, [isMounted, router]);

	return (
		<SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
			<View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
				{/* Loading state while redirecting */}
				<Text style={{color: theme.foreground, fontSize: 18}}>Loading...</Text>
			</View>
		</SafeAreaView>
	);
}

