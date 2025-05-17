import { Stack, useLocalSearchParams } from "expo-router";
import React from "react";
import { View, Text, StyleSheet, SafeAreaView } from "react-native";

import { colors } from "@/constants/colors";
import { useTheme } from "@/context/theme-provider";

export default function InvoiceDetailScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const { isLightMode } = useTheme();
	const themeColors = isLightMode ? colors.light : colors.dark;

	return (
		<SafeAreaView
			style={[styles.container, { backgroundColor: themeColors.background }]}
		>
			<Stack.Screen
				options={{
					headerTitle: `Invoice ${id}`,
					headerBackTitle: "Invoices",
					headerTintColor: themeColors.primary,
					headerTitleStyle: { color: themeColors.foreground },
					headerStyle: { backgroundColor: themeColors.background },
				}}
			/>
			<View style={styles.content}>
				<Text style={{ color: themeColors.foreground }}>
					Details for Invoice ID: {id}
				</Text>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	content: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: 16,
	},
});
