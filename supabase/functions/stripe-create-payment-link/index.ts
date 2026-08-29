// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { json, preflight, requireUser, serviceClient, stripeClient } from "../_shared/stripe.ts";

// Creates a durable, single-use Stripe Payment Link for one invoice, as a direct
// charge on the user's connected account. No application fee is taken.
//
// Payment Links rather than Checkout Sessions: a Checkout Session expires within
// 24 hours of creation, and invoices routinely get paid days after they are sent.

// Stable label so these can be compared as one integration in the Stripe
// Dashboard. It identifies the integration, not the individual link.
const INTEGRATION_IDENTIFIER = "supainvoice_invoice_pay_kqmwzrtb";

// Currencies with no minor unit — the amount is passed as-is rather than x100.
const ZERO_DECIMAL = new Set([
  "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga",
  "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
]);

serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { user, error: authError } = await requireUser(req);
    if (!user) return json({ error: authError }, 401);

    const { invoiceId } = await req.json().catch(() => ({}));
    if (!invoiceId) return json({ error: "invoiceId is required" }, 400);

    const db = serviceClient();

    // Scope by user_id as well as id. The service role bypasses RLS, so without
    // this any authenticated user could mint a link against another user's invoice.
    const { data: invoice } = await db
      .from("invoices")
      .select("id, invoice_number, total_amount, stripe_payment_link_url, paid_at")
      .eq("id", invoiceId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!invoice) return json({ error: "Invoice not found" }, 404);
    if (invoice.paid_at) return json({ error: "This invoice is already paid" }, 409);

    // Links are single-use and durable, so reuse rather than minting duplicates
    // for the same invoice.
    if (invoice.stripe_payment_link_url) {
      return json({ url: invoice.stripe_payment_link_url, reused: true });
    }

    const { data: options } = await db
      .from("payment_options")
      .select("stripe_account_id, stripe_card_payments_status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!options?.stripe_account_id) {
      return json({ error: "Connect Stripe before adding card payments to an invoice." }, 409);
    }
    if (options.stripe_card_payments_status !== "active") {
      return json({
        error: "Your Stripe account can't take card payments yet. Finish setup first.",
        status: options.stripe_card_payments_status,
      }, 409);
    }

    const { data: business } = await db
      .from("business_settings")
      .select("currency_code, business_name")
      .eq("user_id", user.id)
      .maybeSingle();

    // Deliberately not defaulting. Guessing the currency would charge a real
    // client the right number in the wrong money.
    const currency = business?.currency_code?.toLowerCase();
    if (!currency) {
      return json({ error: "Set your currency in business settings before taking card payments." }, 409);
    }

    const total = Number(invoice.total_amount);
    if (!Number.isFinite(total) || total <= 0) {
      return json({ error: "This invoice has no payable total." }, 400);
    }
    const unitAmount = ZERO_DECIMAL.has(currency)
      ? Math.round(total)
      : Math.round(total * 100);

    const stripe = stripeClient();
    const link = await stripe.paymentLinks.create(
      {
        line_items: [{
          quantity: 1,
          price_data: {
            currency,
            unit_amount: unitAmount,
            product_data: {
              name: `Invoice ${invoice.invoice_number}`,
              ...(business?.business_name ? { description: business.business_name } : {}),
            },
          },
        }],
        // An invoice is payable once. Without this the same link could be paid
        // repeatedly by anyone who still has it.
        restrictions: { completed_sessions: { limit: 1 } },
        metadata: { invoice_id: invoice.id, user_id: user.id },
        after_completion: {
          type: "hosted_confirmation",
          hosted_confirmation: {
            custom_message: `Thanks — your payment for invoice ${invoice.invoice_number} has been received.`,
          },
        },
        // payment_method_types is deliberately omitted so Stripe serves dynamic
        // payment methods and picks what converts best for each payer.
      } as any,
      // Direct charge: the connected account is merchant of record.
      { stripeAccount: options.stripe_account_id },
    );

    const { error: updateError } = await db
      .from("invoices")
      .update({
        stripe_payment_link_id: link.id,
        stripe_payment_link_url: link.url,
      })
      .eq("id", invoice.id);

    if (updateError) {
      // The link is live at Stripe. If we cannot record it we would mint a second
      // one next time, so surface it rather than silently duplicating.
      console.error("Failed to persist payment link", link.id, updateError);
      return json({ error: "Could not save the payment link. Please try again." }, 500);
    }

    return json({ url: link.url, reused: false, integration: INTEGRATION_IDENTIFIER });
  } catch (err) {
    console.error("stripe-create-payment-link failed", err);
    return json({ error: (err as Error).message ?? "Unexpected error" }, 500);
  }
});
