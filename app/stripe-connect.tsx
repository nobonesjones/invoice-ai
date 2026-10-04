import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { Text } from "@/components/ui/text";
import { useTheme } from "@/context/theme-provider";

/**
 * Landing point for Stripe-hosted Connect onboarding.
 *
 * Stripe requires HTTPS return URLs, so it cannot redirect to a custom scheme
 * directly. It returns to the stripe-connect-return edge function, which 302s
 * to `${APP_RETURN_SCHEME}://stripe-connect?status=…` — that scheme must match
 * `expo.scheme` in app.json ("superinvoice").
 *
 * Nothing is read from the query string on purpose. The return leg carries no
 * proof of anything: a user can reach it having completed onboarding, having
 * abandoned it, or by pressing back. Stripe is the only source of truth, and
 * useStripeConnect re-reads it on the payments screen. So this screen just
 * hands the user back and lets that refresh decide what to show.
 */
export default function StripeConnectReturn() {
	const router = useRouter();
	const { theme } = useTheme();

	useEffect(() => {
		router.replace("/(app)/payment-options");
	}, [router]);

	return (
		<View style={[styles.container, { backgroundColor: theme.background }]}>
			<ActivityIndicator size="large" color={theme.primary} />
			<Text style={[styles.label, { color: theme.mutedForeground }]}>
				Finishing Stripe setup…
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
	label: { fontSize: 15 },
});
