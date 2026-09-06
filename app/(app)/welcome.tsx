import { Redirect } from "expo-router";

/**
 * Legacy starter-template welcome screen ("Supastarter").
 *
 * The screen it used to render was left over from the expo-supabase-starter
 * template and was never part of the SuperInvoice flow. Nothing navigates here,
 * but the route stayed registered in the (app) stack, so it was still reachable
 * and — because the root auth guard used to exempt it — nothing bounced you off
 * it once you landed. This redirect closes that hole.
 *
 * The original component is recoverable from git history if it is ever needed.
 */
export default function WelcomeScreen() {
	return <Redirect href="/(auth)/onboarding-1" />;
}
