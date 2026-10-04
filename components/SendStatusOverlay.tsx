import React, { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, Easing, Modal, StyleSheet, View } from "react-native";
import { Check } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { useTheme } from "@/context/theme-provider";

export type SendStatus = "idle" | "sending" | "success";

type Props = {
	status: SendStatus;
	/** Headline while working, e.g. "Sending invoice". */
	sendingTitle?: string;
	/** Headline once done, e.g. "Invoice sent". */
	successTitle?: string;
	/** Context line, e.g. the recipient's email address. */
	detail?: string | null;
	/** Fired once the success state has been shown long enough to read. */
	onDone?: () => void;
	/** How long the success state stays up. */
	successDurationMs?: number;
};

/**
 * Blocking progress + confirmation for anything the app sends.
 *
 * Sending an invoice takes several seconds — it rasterises the canvas, builds a
 * PDF and uploads it — and until now nothing was shown for any of it. The
 * isSendingEmail flag existed but was never rendered, so the screen simply sat
 * there and the only feedback was an alert at the very end.
 *
 * Deliberately modal: sending twice because nothing appeared to happen would
 * email the customer twice.
 *
 * Kept generic (invoices, estimates, reminders) so every send in the app can
 * look the same rather than each screen inventing its own.
 */
export function SendStatusOverlay({
	status,
	sendingTitle = "Sending",
	successTitle = "Sent",
	detail,
	onDone,
	successDurationMs = 1600,
}: Props) {
	const { theme } = useTheme();
	const scale = useRef(new Animated.Value(0.8)).current;

	useEffect(() => {
		if (status !== "success") return;

		scale.setValue(0.8);
		Animated.spring(scale, {
			toValue: 1,
			friction: 5,
			tension: 90,
			useNativeDriver: true,
		}).start();

		const id = setTimeout(() => onDone?.(), successDurationMs);
		return () => clearTimeout(id);
	}, [status, onDone, successDurationMs, scale]);

	// Reset so a second send animates in again rather than appearing pre-grown.
	useEffect(() => {
		if (status === "sending") scale.setValue(0.8);
	}, [status, scale]);

	if (status === "idle") return null;

	const done = status === "success";

	return (
		<Modal transparent animationType="fade" visible statusBarTranslucent>
			<View style={styles.backdrop}>
				<View style={[styles.card, { backgroundColor: theme.background }]}>
					<View style={styles.iconWell}>
						{done ? (
							<Animated.View
								style={[styles.successCircle, { transform: [{ scale }] }]}
							>
								<Check size={30} color="#FFFFFF" strokeWidth={3} />
							</Animated.View>
						) : (
							<ActivityIndicator size="large" color={theme.primary} />
						)}
					</View>

					<Text style={[styles.title, { color: theme.foreground }]}>
						{done ? successTitle : sendingTitle}
					</Text>

					{detail ? (
						<Text style={[styles.detail, { color: theme.mutedForeground }]} numberOfLines={2}>
							{detail}
						</Text>
					) : null}
				</View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "rgba(0, 0, 0, 0.45)",
		paddingHorizontal: 40,
	},
	card: {
		width: "100%",
		maxWidth: 300,
		borderRadius: 20,
		paddingVertical: 28,
		paddingHorizontal: 24,
		alignItems: "center",
		gap: 6,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 8 },
		shadowOpacity: 0.18,
		shadowRadius: 20,
		elevation: 8,
	},
	iconWell: {
		height: 60,
		justifyContent: "center",
		marginBottom: 6,
	},
	successCircle: {
		width: 56,
		height: 56,
		borderRadius: 28,
		backgroundColor: "#28A745",
		alignItems: "center",
		justifyContent: "center",
	},
	title: {
		fontSize: 18,
		fontWeight: "700",
		textAlign: "center",
	},
	detail: {
		fontSize: 14,
		lineHeight: 19,
		textAlign: "center",
	},
});

export default SendStatusOverlay;
