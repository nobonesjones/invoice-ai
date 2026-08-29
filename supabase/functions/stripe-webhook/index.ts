// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { cardPaymentsStatus, serviceClient, stripeClient } from "../_shared/stripe.ts";

// Stripe Connect webhook. Registered with "Events from: Connected accounts"
// (connect: true) so it receives direct-charge events from users' accounts.
//
// This is the source of truth for payment status. The payer can close the tab
// before any confirmation page loads, and some payment methods settle days
// later, so nothing may depend on the success page.
//
// Public endpoint (verify_jwt = false in config.toml). The signature check below
// is what authenticates it — there is no other gate.

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  // Accounts v2 splits event routing across two destinations — connected-account
  // events (direct charges) and platform-account events (v2.core.account.*) —
  // and each destination has its own signing secret. Comma-separate them.
  const secrets = (Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (secrets.length === 0) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return new Response("Server misconfigured", { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing stripe-signature", { status: 400 });

  // Must be the raw body; parsing first would break the signature.
  const payload = await req.text();

  let stripe: ReturnType<typeof stripeClient>;
  try {
    stripe = stripeClient();
  } catch (err) {
    // Signature verification itself doesn't need the API key, but the handlers
    // below do. Fail here with something readable rather than an opaque 500.
    console.error("Cannot build Stripe client:", (err as Error).message);
    return new Response("Server misconfigured: STRIPE_SECRET_KEY is not set", { status: 500 });
  }

  let event: any = null;
  for (const secret of secrets) {
    try {
      // constructEventAsync, not constructEvent — Deno has WebCrypto only, and
      // the synchronous variant cannot verify there.
      event = await stripe.webhooks.constructEventAsync(payload, signature, secret);
      break;
    } catch {
      // Try the next destination's secret before giving up.
    }
  }

  if (!event) {
    console.error("Signature verification failed against all configured secrets");
    return new Response("Invalid signature", { status: 400 });
  }

  const db = serviceClient();

  // Idempotency gate. Stripe retries on any non-2xx and can redeliver after a
  // success, so without this a redelivered completion marks an invoice paid twice.
  const { error: seenError } = await db.from("stripe_events").insert({
    id: event.id,
    type: event.type,
    account_id: event.account ?? null,
  });

  if (seenError) {
    // 23505 = unique violation: already handled. Anything else is a real failure,
    // and returning non-2xx asks Stripe to retry.
    if (seenError.code === "23505") return new Response("Already processed", { status: 200 });
    console.error("Could not record event", event.id, seenError);
    return new Response("Storage error", { status: 500 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object;

        // The completed event fires while delayed-notification methods are still
        // unpaid. Marking an invoice paid here would credit payments that later
        // fail, and never credit the ones that succeed.
        if (session.payment_status === "unpaid") break;

        await markInvoicePaid(db, session);
        break;
      }

      case "checkout.session.async_payment_failed": {
        const session = event.data.object;
        console.warn("Async payment failed for session", session.id, "link", session.payment_link);
        break;
      }

      case "account.updated":
      case "v2.core.account.updated": {
        await refreshAccountStatus(db, event.account ?? event.data?.object?.id);
        break;
      }

      case "account.application.deauthorized": {
        // The user disconnected the platform. Their stored account id is dead;
        // clearing it stops the app offering a pay button backed by nothing.
        if (event.account) {
          await db
            .from("payment_options")
            .update({
              stripe_account_id: null,
              stripe_card_payments_status: null,
              stripe_connected_at: null,
            })
            .eq("stripe_account_id", event.account);
        }
        break;
      }
    }

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("Handler failed for", event.id, err);
    // Roll back the idempotency marker so Stripe's retry can have another go —
    // otherwise the redelivery is swallowed as "already processed" and the side
    // effect never happens.
    await db.from("stripe_events").delete().eq("id", event.id);
    return new Response("Handler error", { status: 500 });
  }
});

async function markInvoicePaid(db: any, session: any) {
  const linkId = typeof session.payment_link === "string"
    ? session.payment_link
    : session.payment_link?.id;

  const invoiceId = session.metadata?.invoice_id ?? null;
  if (!linkId && !invoiceId) {
    console.warn("Session", session.id, "has no payment_link or invoice metadata");
    return;
  }

  const amountMinor = session.amount_total ?? 0;
  const zeroDecimal = ["bif","clp","djf","gnf","jpy","kmf","krw","mga",
                       "pyg","rwf","ugx","vnd","vuv","xaf","xof","xpf"];
  const amount = zeroDecimal.includes((session.currency ?? "").toLowerCase())
    ? amountMinor
    : amountMinor / 100;

  const query = db
    .from("invoices")
    .update({
      paid_at: new Date().toISOString(),
      amount_paid: amount,
      status: "paid",
      stripe_checkout_session_id: session.id,
    })
    // Only the first settlement wins; a redelivery must not overwrite paid_at.
    .is("paid_at", null);

  const { error } = linkId
    ? await query.eq("stripe_payment_link_id", linkId)
    : await query.eq("id", invoiceId);

  if (error) throw error;
}

async function refreshAccountStatus(db: any, accountId: string | undefined) {
  if (!accountId) return;
  const account: any = await stripeClient().v2.core.accounts.retrieve(
    accountId,
    { include: ["configuration.merchant"] } as any,
  );
  const status = cardPaymentsStatus(account);
  const { error } = await db
    .from("payment_options")
    .update({
      stripe_card_payments_status: status,
      ...(status === "active" ? { stripe_connected_at: new Date().toISOString() } : {}),
    })
    .eq("stripe_account_id", accountId);
  if (error) throw error;
}
