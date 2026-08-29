import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Bounces the browser back into the app after Stripe-hosted onboarding.
//
// Why this exists: Stripe requires return_url and refresh_url to be HTTPS in
// live mode, so a custom scheme like invoicefly:// cannot be given to Stripe
// directly. Stripe returns here, and this page redirects to the app scheme,
// which is what closes the auth session on both iOS and Android.
//
// Public by design — no JWT. It carries no secrets and performs no writes; the
// app calls stripe-connect-status afterwards to find out what actually happened.

serve((req) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") === "refresh" ? "refresh" : "return";

  // Two surfaces share this endpoint: the mobile app returns to a custom scheme,
  // the website to a normal URL. The destination is chosen by a fixed env var,
  // never by a caller-supplied URL — accepting one would make this an open
  // redirect, and Stripe onboarding traffic is exactly what you don't want
  // bounced to an attacker's page.
  let target: string;
  const requested = url.searchParams.get("target");
  if (requested === "web" || requested === "web-dev") {
    // Fails shut when the var is absent, which is what production wants for
    // "web-dev": no var, no localhost redirect.
    const envVar = requested === "web-dev" ? "WEB_RETURN_URL_DEV" : "WEB_RETURN_URL";
    const webUrl = Deno.env.get(envVar);
    if (!webUrl) {
      return new Response(`${envVar} is not set`, { status: 500 });
    }
    const sep = webUrl.includes("?") ? "&" : "?";
    target = `${webUrl}${sep}status=${status}`;
  } else {
    const scheme = Deno.env.get("APP_RETURN_SCHEME");
    if (!scheme) {
      return new Response("APP_RETURN_SCHEME is not set", { status: 500 });
    }
    target = `${scheme}://stripe-connect?status=${status}`;
  }

  // Meta refresh plus an explicit link: a custom-scheme redirect via Location is
  // unreliable across in-app browsers, and the link is the fallback if the
  // automatic hop is blocked.
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="refresh" content="0;url=${target}">
    <title>Returning to the app…</title>
    <style>
      body { font-family: -apple-system, system-ui, sans-serif; text-align: center;
             padding: 3rem 1.5rem; color: #1a1a1a; }
      a { display: inline-block; margin-top: 1.5rem; padding: 0.9rem 1.5rem;
          background: #635bff; color: #fff; border-radius: 8px;
          text-decoration: none; font-weight: 600; }
    </style>
  </head>
  <body>
    <p>Returning you to the app…</p>
    <a href="${target}">Tap here if nothing happens</a>
    <script>location.replace(${JSON.stringify(target)});</script>
  </body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});
