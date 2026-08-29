import Stripe from "https://esm.sh/stripe@22.6.0?target=deno";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// The API version is deliberately not pinned here. The SDK sends the version it
// was built against, which is the one its typed v2 methods match. Overriding it
// to a version string copied from a docs page is how you get silent shape drift.
export function stripeClient(): Stripe {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key, {
    // Deno has no Node crypto; the SDK needs the WebCrypto provider for webhook
    // signature verification.
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("EXPO_PUBLIC_API_URL")!,
    Deno.env.get("SERVICE_KEY")!,
  );
}

/**
 * Resolves the caller's user from their JWT. Every Connect function must do this
 * before touching an account — the service-role client bypasses RLS, so without
 * an explicit identity check any caller could act as any user.
 */
export async function requireUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return { user: null, error: "Missing Authorization header" };

  const supabase = createClient(
    Deno.env.get("EXPO_PUBLIC_API_URL")!,
    Deno.env.get("SERVICE_KEY")!,
  );
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { user: null, error: "Invalid or expired token" };
  return { user: data.user, error: null };
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    },
  });
}

export function preflight() {
  return new Response("ok", {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    },
  });
}

/**
 * True only when the connected account can actually take money.
 *
 * This reads the v2 capability path, NOT the deprecated v1 `charges_enabled`
 * boolean. An account can be fully "onboarded" with card_payments still pending.
 */
// deno-lint-ignore no-explicit-any
export function cardPaymentsStatus(account: any): string | null {
  return account?.configuration?.merchant?.capabilities?.card_payments?.status ?? null;
}
