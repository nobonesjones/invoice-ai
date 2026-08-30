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

// Creates (or reuses) the caller's connected account and returns a Stripe-hosted
// onboarding URL for the app to open in a browser sheet.
//
// Configuration is the Accounts v2 "SaaS platform with payments" shape:
//   dashboard: full, fees_collector: stripe, losses_collector: stripe.
// The user is merchant of record and pays their own Stripe fees; Stripe absorbs
// negative balances. No application fee is ever taken.

serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { user, error: authError } = await requireUser(req);
    if (!user) return json({ error: authError }, 401);

    // "web" | "web-dev" | "app" — decides which surface Stripe returns to.
    // Only these three literals are honoured and each maps to a server-side env
    // var. A caller-supplied return_url is deliberately not accepted: that is an
    // open redirect, and Stripe onboarding is the last traffic you want bounced
    // to someone else's page. "web-dev" exists so the return leg is testable on
    // localhost; leave WEB_RETURN_URL_DEV unset in production and it fails shut.
    const reqBody = await req.json().catch(() => ({}));
    const surface = reqBody?.surface === "web"
      ? "web"
      : reqBody?.surface === "web-dev"
      ? "web-dev"
      : "app";
    const targetParam = surface === "app" ? "" : `&target=${surface}`;

    const stripe = stripeClient();
    const db = serviceClient();

    const returnBase = Deno.env.get("STRIPE_CONNECT_RETURN_URL");
    if (!returnBase) return json({ error: "STRIPE_CONNECT_RETURN_URL is not set" }, 500);

    // Fetched together rather than in sequence. business_settings is only needed
    // when creating a new account, but the extra read costs less than the round
    // trip it saves on the slow path, and this endpoint's latency is what the
    // user stares at after clicking Connect.
    const [{ data: options }, { data: business }] = await Promise.all([
      db.from("payment_options")
        .select("id, stripe_account_id")
        .eq("user_id", user.id)
        .maybeSingle(),
      db.from("business_settings")
        .select("business_name, business_email, business_phone, business_website, region")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    let accountId = options?.stripe_account_id ?? null;

    if (!accountId) {

      // Prefill has exactly one chance: once an account link is created, KYC
      // fields become unwritable. Anything missing here, the user types by hand.
      const body: Record<string, any> = {
        dashboard: "full",
        contact_email: business?.business_email ?? user.email ?? undefined,
        display_name: business?.business_name ?? undefined,
        configuration: {
          merchant: { capabilities: { card_payments: { requested: true } } },
        },
        defaults: {
          responsibilities: {
            fees_collector: "stripe",
            losses_collector: "stripe",
          },
        },
        include: ["configuration.merchant", "identity", "requirements"],
      };

      // The account's country is permanent. Because we request the card_payments
      // capability, Stripe locks the country at creation whether or not we send
      // one — so omitting it does NOT let the user pick during onboarding, it
      // silently pins them to the platform's country. A UAE business would end up
      // with an account it can never correct.
      //
      // So: refuse rather than guess. business_settings.region can be null, and
      // signup offers an "Other" option that stores the literal string OTHER,
      // which is not a country.
      const country = normaliseCountry(business?.region);
      if (!country) {
        return json({
          error: "Set your business country in Settings before connecting Stripe.",
          reason: "missing_country",
        }, 409);
      }

      body.identity = {
        country,
        ...(business?.business_name || business?.business_website
          ? {
            business_details: {
              ...(business.business_name ? { registered_name: business.business_name } : {}),
              ...(business.business_website ? { url: business.business_website } : {}),
            },
          }
          : {}),
      };

      const account = await stripe.v2.core.accounts.create(body as any);
      accountId = account.id;

      const { error: upsertError } = await db
        .from("payment_options")
        .upsert(
          {
            ...(options?.id ? { id: options.id } : {}),
            user_id: user.id,
            stripe_account_id: accountId,
            stripe_card_payments_status: cardPaymentsStatus(account),
            stripe_onboarding_started_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );

      // The account exists at Stripe now. If we cannot record the id we would
      // orphan it and create a second one on the next attempt, so fail loudly.
      if (upsertError) {
        console.error("Failed to persist stripe_account_id", accountId, upsertError);
        return json({ error: "Could not save your Stripe account. Please try again." }, 500);
      }
    }

    // v2 account links nest everything under use_case and take a `configurations`
    // array. The v1 shape (top-level refresh_url/return_url/type) is a different
    // endpoint and does not apply to a v2 account.
    const link = await stripe.v2.core.accountLinks.create({
      account: accountId,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          configurations: ["merchant"],
          refresh_url: `${returnBase}?status=refresh${targetParam}`,
          return_url: `${returnBase}?status=return${targetParam}`,
          // Collect everything up front so the user isn't sent back for a second
          // round the first time an invoice needs paying.
          collection_options: { fields: "eventually_due" },
        },
      },
    });

    // Single-use and expires in minutes. Never send it anywhere but back to the
    // authenticated app — link previewers in messaging clients burn it on sight.
    return json({ url: link.url, accountId });
  } catch (err) {
    console.error("stripe-connect-start failed", err);
    return json({ error: (err as Error).message ?? "Unexpected error" }, 500);
  }
});

/**
 * business_settings.region holds whatever each surface happened to write, and
 * they disagree. The mobile app's Tax & Currency screen stores the display NAME
 * ("United Kingdom"), the website has stored ISO codes and, in older rows,
 * continent names. None of that is Stripe-ready.
 *
 * Rather than migrate two surfaces' worth of historic rows, normalise here:
 * accept an alpha-2 code or a known country name, reject everything else. This
 * is the only place both surfaces pass through.
 */
const COUNTRY_NAMES: Record<string, string> = {
  "UNITED STATES": "us",
  "UNITED STATES OF AMERICA": "us",
  "USA": "us",
  "CANADA": "ca",
  "UNITED KINGDOM": "gb",
  "GREAT BRITAIN": "gb",
  "UK": "gb",
  "AUSTRALIA": "au",
  "GERMANY": "de",
  "FRANCE": "fr",
  "JAPAN": "jp",
  "INDIA": "in",
  "BRAZIL": "br",
  "SOUTH AFRICA": "za",
  "UNITED ARAB EMIRATES": "ae",
  "UAE": "ae",
  "IRELAND": "ie",
  "NEW ZEALAND": "nz",
  "SINGAPORE": "sg",
  "NETHERLANDS": "nl",
  "SPAIN": "es",
  "ITALY": "it",
};

function normaliseCountry(region: string | null | undefined): string | null {
  if (!region) return null;
  const trimmed = region.trim().toUpperCase();

  // "Other" is a real option in both signup flows and is not a country.
  if (trimmed === "OTHER") return null;

  if (/^[A-Z]{2}$/.test(trimmed)) return trimmed.toLowerCase();

  return COUNTRY_NAMES[trimmed] ?? null;
}
