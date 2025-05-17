import { X } from "lucide-react-native";
import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import Modal from "react-native-modal";

import { Text } from "@/components/ui/text";
import { H3 } from "@/components/ui/typography";
import { useTheme } from "@/context/theme-provider";

interface ContactUsModalProps {
	isVisible: boolean;
	onClose: () => void;
}

export const ContactUsModal: React.FC<ContactUsModalProps> = ({
	isVisible,
	onClose,
}) => {
	const { theme } = useTheme();

	return (
		<Modal
			isVisible={isVisible}
			onBackdropPress={onClose}
			onSwipeComplete={onClose}
			swipeDirection="down"
			style={styles.modal}
			animationInTiming={500}
			animationOutTiming={500}
			useNativeDriver
			hideModalContentWhileAnimating
		>
			<View style={[styles.contentContainer, { backgroundColor: theme.card }]}>
				{/* Header with Title and Close Button */}
				<View style={styles.header}>
					<H3 style={{ color: theme.foreground }}>Contact Us</H3>
					<TouchableOpacity
						onPress={onClose}
						hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
					>
						<X size={24} color={theme.mutedForeground} />
					</TouchableOpacity>
				</View>

				{/* Coming Soon Text */}
				<View style={styles.bodyContent}>
					<Text
						style={[styles.comingSoonText, { color: theme.mutedForeground }]}
					>
						Contact Us Coming Soon
					</Text>
					{/* You could add contact info or a form here later */}
				</View>
			</View>
		</Modal>
	);
};

const styles = StyleSheet.create({
	modal: {
		justifyContent: "flex-end",
		margin: 0,
	},
	contentContainer: {
		// Adjust height as needed, maybe less than 50% for just text?
		height: "30%",
		borderTopLeftRadius: 20,
		borderTopRightRadius: 20,
		paddingHorizontal: 16,
		paddingTop: 16,
		paddingBottom: 20,
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 16,
	},
	bodyContent: {
		flex: 1, // Center content vertically
		justifyContent: "center",
		alignItems: "center",
	},
	comingSoonText: {
		textAlign: "center",
		fontSize: 16,
	},
});
