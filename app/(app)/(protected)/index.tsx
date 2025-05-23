import { useRouter } from "expo-router";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "react-native"; // Added missing import

import { useTheme } from "@/context/theme-provider";

export default function Home() {
	const router = useRouter();
	const { theme } = useTheme();

	return (
		<SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
			<View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
				{/* You can add new home screen content here if needed */}
				<Text style={{color: theme.foreground, fontSize: 18}}>Home Screen Content</Text>
			</View>
		</SafeAreaView>
	);
}

