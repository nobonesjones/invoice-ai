import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Bounces the browser back to whichever surface started Connect onboarding.
//
// Why this exists: Stripe requires return_url and refresh_url to be HTTPS in
// live mode, so a custom app scheme cannot be handed to Stripe directly.
//
// Everything here is a 302. An earlier version served an HTML interstitial with
// a meta-refresh and a JS fallback, which did not work: the Supabase edge
// runtime rewrites the Content-Type to text/plain regardless of what the handler
// sets, so the browser printed the markup instead of running it and the user was
// stranded on a page of source. A redirect has no body to mis-render.
//
// Custom schemes in a Location header are what ASWebAuthenticationSession and
// Chrome Custom Tabs already watch for — it is the standard OAuth callback
// mechanism, and how expo-web-browser's openAuthSessionAsync detects completion.
//
// Public by design — no JWT. Stripe redirects the user here with no Authorization
// header. It holds no secrets, reads nothing, and writes nothing; the client
// calls stripe-connect-status afterwards to find out what actually happened.

serve((req) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") === "refresh" ? "refresh" : "return";
  const requested = url.searchParams.get("target");

  // The destination is always chosen by a server-side env var, never by a
  // caller-supplied URL. Accepting one would make this an open redirect, and
  // Stripe onboarding traffic is the last thing you want bounced to someone
  // else's page.
  let destination: string;

  if (requested === "web" || requested === "web-dev") {
    // Fails shut when the var is absent — which is what production wants for
    // "web-dev": no var, no localhost redirect.
    const envVar = requested === "web-dev" ? "WEB_RETURN_URL_DEV" : "WEB_RETURN_URL";
    const webUrl = Deno.env.get(envVar);
    if (!webUrl) {
      return new Response(`${envVar} is not set`, { status: 500 });
    }
    const sep = webUrl.includes("?") ? "&" : "?";
    destination = `${webUrl}${sep}status=${status}`;
  } else {
    const scheme = Deno.env.get("APP_RETURN_SCHEME");
    if (!scheme) {
      return new Response("APP_RETURN_SCHEME is not set", { status: 500 });
    }
    destination = `${scheme}://stripe-connect?status=${status}`;
  }

  // Built by hand rather than with Response.redirect(), which validates the URL
  // and rejects non-http(s) schemes — exactly what the app path needs to emit.
  return new Response(null, {
    status: 302,
    headers: { Location: destination, "Cache-Control": "no-store" },
  });
});
