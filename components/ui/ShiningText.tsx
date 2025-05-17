import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import React, { useRef, useEffect } from "react";
import {
	Animated,
	Text,
	StyleSheet,
	View,
	StyleProp,
	TextStyle,
	useColorScheme,
} from "react-native";

import { useTheme } from "@/context/theme-provider";
import { cn } from "@/lib/utils";

interface ShiningTextProps {
	text: string;
	className?: string;
	style?: StyleProp<TextStyle>;
	numberOfLines?: number;
}

const ShiningText: React.FC<ShiningTextProps> = ({
	text,
	className,
	style,
	numberOfLines,
}) => {
	const animatedValue = useRef(new Animated.Value(0)).current;
	const colorScheme = useColorScheme();
	const { theme } = useTheme();

	useEffect(() => {
		Animated.loop(
			Animated.sequence([
				Animated.timing(animatedValue, {
					toValue: 1,
					duration: 1500,
					useNativeDriver: true,
				}),
				Animated.delay(2000),
			]),
		).start();
	}, [animatedValue]);

	const translateX = animatedValue.interpolate({
		inputRange: [0, 1],
		outputRange: [-500, 500], // Increased range for full traversal
	});

	// Tweak dark mode gradient further
	const gradientColors =
		colorScheme === "dark"
			? (["#FFFFFF", "#555555", "#FFFFFF"] as const) // Dark Mode: White -> Dark Gray -> White (darker shine)
			: (["#000000", "#FFFFFF", "#000000"] as const); // Light Mode: Black -> Bright White -> Black

	const textStyle = StyleSheet.flatten([styles.baseText, style]);

	return (
		<View style={styles.container}>
			<MaskedView
				style={styles.maskedView}
				maskElement={
					<Text
						className={cn(className)}
						style={textStyle}
						numberOfLines={numberOfLines}
					>
						{text}
					</Text>
				}
			>
				<Text
					className={cn(className)}
					style={textStyle}
					numberOfLines={numberOfLines}
					aria-hidden
				>
					{text}
				</Text>
				<Animated.View
					style={[styles.gradientContainer, { transform: [{ translateX }] }]}
				>
					<LinearGradient
						colors={gradientColors}
						start={{ x: 0, y: 0.5 }}
						end={{ x: 1, y: 0.5 }}
						style={styles.gradient}
					/>
				</Animated.View>
			</MaskedView>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		alignItems: "center",
	},
	maskedView: {
		height: "auto",
		alignSelf: "center",
	},
	baseText: {
		backgroundColor: "transparent",
	},
	gradientContainer: {
		...StyleSheet.absoluteFillObject,
	},
	gradient: {
		width: "100%",
		height: "100%",
	},
});

export default ShiningText;
