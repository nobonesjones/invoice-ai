import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";

export default function Home() {
	const router = useRouter();

	// Use useFocusEffect instead of useEffect to ensure navigation is ready
	useFocusEffect(
		useCallback(() => {
			// Small delay to ensure the component is fully mounted
			const timer = setTimeout(() => {
				router.replace("/(app)/(protected)/ai");
			}, 100);

			return () => clearTimeout(timer);
		}, [router])
	);

	// This component will only be visible momentarily during redirect
	return null;
}

