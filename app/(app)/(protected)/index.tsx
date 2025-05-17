import { useRouter } from "expo-router";
import { CircleUserRound } from "lucide-react-native";
import { View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "@/context/theme-provider";

export default function Home() {
	const router = useRouter();
	const { theme } = useTheme();

	return (
		<SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
			<View
				style={{
					paddingHorizontal: 16,
					paddingVertical: 16,
					flexDirection: "row",
					justifyContent: "flex-end",
					alignItems: "center",
				}}
			>
				<Pressable onPress={() => router.push("/profile")}>
					{({ pressed }) => (
						<CircleUserRound
							color={theme.foreground}
							size={32}
							style={{ opacity: pressed ? 0.7 : 1 }}
						/>
					)}
				</Pressable>
			</View>
		</SafeAreaView>
	);
}
