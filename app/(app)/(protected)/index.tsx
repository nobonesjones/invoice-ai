import { useRouter } from "expo-router";
import { useEffect } from "react";

export default function Home() {
	const router = useRouter();

	useEffect(() => {
		// Redirect to AI screen on app launch
		router.replace("/(app)/(protected)/ai");
	}, []);

	// This component will only be visible momentarily during redirect
	return null;
}

