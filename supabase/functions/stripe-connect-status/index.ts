// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  cardPaymentsStatus,
  json,
  preflight,
  requireUser,
  serviceClient,
  stripeClient,
} from "../_shared/stripe.ts";

// Reads the caller's connected account from Stripe and writes the current
// capability status back to payment_options.
//
// Called after the user returns from onboarding, and on entering the payments
// screen. The return_url carries no state and returning does NOT mean onboarding
// finished — this is the only way to know whether the account can take money.

serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { user, error: authError } = await requireUser(req);
    if (!user) return json({ error: authError }, 401);

    const db = serviceClient();
    const { data: options } = await db
      .from("payment_options")
      .select("id, stripe_account_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!options?.stripe_account_id) {
      return json({ connected: false, canAcceptPayments: false, status: null });
    }

    const stripe = stripeClient();
    const account: any = await stripe.v2.core.accounts.retrieve(
      options.stripe_account_id,
      { include: ["configuration.merchant", "requirements"] } as any,
    );

    const status = cardPaymentsStatus(account);
    const canAcceptPayments = status === "active";

    await db
      .from("payment_options")
      .update({
        stripe_card_payments_status: status,
        ...(canAcceptPayments ? { stripe_connected_at: new Date().toISOString() } : {}),
      })
      .eq("user_id", user.id);

    // Requirements carry who is blocked: 'stripe' means Stripe is verifying and
    // the user can do nothing, 'user' means they must supply something. Counting
    // all entries alike is what produces "finish onboarding" prompts for accounts
    // where there is nothing left to finish.
    const entries: any[] = account?.requirements?.entries ?? [];
    const awaitingUser = entries.filter((e) => e.awaiting_action_from === "user");

    // Capability status is 'active' | 'pending' | 'restricted' | 'unsupported'.
    // Only 'active' can take money, but the other three mean very different
    // things to a user and must not share one message.
    let state: "active" | "verifying" | "action_required" | "unsupported";
    if (canAcceptPayments) {
      state = "active";
    } else if (status === "unsupported") {
      state = "unsupported";
    } else if (awaitingUser.length > 0) {
      state = "action_required";
    } else {
      // pending or restricted with nothing owed by the user: Stripe is working.
      state = "verifying";
    }

    return json({
      connected: true,
      canAcceptPayments,
      status,
      state,
      // For rendering "Connected · sandbox" with the account id, mirroring how
      // the GoCardless row shows its creditor ID.
      accountId: options.stripe_account_id,
      livemode: account?.livemode ?? false,
      // Only requirements the USER can act on. Empty while Stripe verifies.
      requirementsOutstanding: awaitingUser.length > 0,
      requirementsAwaitingUser: awaitingUser.length,
      requirementsAwaitingStripe: entries.length - awaitingUser.length,
    });
  } catch (err) {
    console.error("stripe-connect-status failed", err);
    return json({ error: (err as Error).message ?? "Unexpected error" }, 500);
  }
});
