// estimate-responded — the one place "the client answered" turns into things
// the owner sees. Mirrors invoice-paid.
//
// Invoked by the estimate_responded_webhook trigger on `estimates` UPDATE.
// It does not care how the estimate came to be accepted or declined: the
// hosted page's Accept/Decline buttons and an in-app status change land here
// the same way.
//
// On the transition into accepted or declined it:
//   1. claims the estimate via estimates.responded_notified_at (so webhook
//      retries cannot double-send);
//   2. emails the owner "accepted"/"declined" with a link to the hosted page;
//   3. pushes to the owner's registered devices.
//
// Env:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (provided by the platform)
//   RESEND_API_KEY
//   ESTIMATE_RESPONDED_WEBHOOK_SECRET — must equal the x-estimate-responded-secret
//                                       header set by the database trigger.
//   SHARE_BASE_URL (optional)         — defaults to https://invoices.getsuperinvoice.com

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: Record<string, any> | null;
  old_record: Record<string, any> | null;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** business_settings.currency_code is stored either as "AED" or "AED - UAE Dirham". */
function currencyCodeOf(raw: string | null | undefined): string {
  const code = (raw ?? "USD").split(" ")[0].trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : "USD";
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// share link
// ---------------------------------------------------------------------------

function newShareToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let out = "";
  for (const b of bytes) out += chars[b % chars.length];
  return out;
}

async function ensureShareToken(db: any, estimate: any): Promise<string | null> {
  const nowIso = new Date().toISOString();
  const { data: existing } = await db
    .from("estimate_shares")
    .select("share_token, expires_at")
    .eq("estimate_id", estimate.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(5);

  const live = (existing ?? []).find(
    (s: any) => !s.expires_at || s.expires_at > nowIso,
  );
  if (live) return live.share_token;

  const token = newShareToken();
  const { error } = await db.from("estimate_shares").insert({
    estimate_id: estimate.id,
    user_id: estimate.user_id,
    share_token: token,
    is_active: true,
    expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (error) {
    console.error("[estimate-responded] could not create share", error);
    return null;
  }
  return token;
}

// ---------------------------------------------------------------------------
// email
// ---------------------------------------------------------------------------

const EMAIL_FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

function emailShell(inner: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:${EMAIL_FONT};background-color:#f3f4f6;">
  <table role="presentation" style="width:100%;border-collapse:collapse;">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" style="width:600px;max-width:100%;background-color:#ffffff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
        ${inner}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function statusBadge(accepted: boolean): string {
  return accepted
    ? `<div style="display:inline-block;padding:6px 14px;border-radius:999px;background:#d1fae5;color:#065f46;font-weight:600;font-size:13px;letter-spacing:.04em;">ACCEPTED</div>`
    : `<div style="display:inline-block;padding:6px 14px;border-radius:999px;background:#fee2e2;color:#991b1b;font-weight:600;font-size:13px;letter-spacing:.04em;">DECLINED</div>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;padding:14px 28px;background:#10b981;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px;">${label}</a>`;
}

function ownerEmail(opts: {
  accepted: boolean;
  label: string; // "Estimate" | "Quote"
  clientName: string;
  estimateNumber: string;
  amount: string;
  respondedOn: string;
  shareUrl: string | null;
}): string {
  const { accepted, label, clientName, estimateNumber, amount, respondedOn, shareUrl } = opts;
  const headline = accepted ? `${label} accepted` : `${label} declined`;
  const sub = `${escapeHtml(clientName)} ${accepted ? "accepted" : "declined"} ${label.toLowerCase()} ${escapeHtml(estimateNumber)}`;
  const next = accepted
    ? "Convert it to an invoice from the app when you're ready."
    : "You can revise and resend it from the app.";
  return emailShell(`
    <tr><td style="padding:40px 40px 24px;text-align:center;border-bottom:1px solid #e5e7eb;">
      ${statusBadge(accepted)}
      <h1 style="margin:16px 0 0;font-size:24px;color:#1f2937;">${escapeHtml(headline)}</h1>
      <p style="margin:8px 0 0;color:#6b7280;font-size:14px;">${sub}</p>
    </td></tr>
    <tr><td style="padding:32px 40px;text-align:center;">
      <div style="font-size:36px;font-weight:700;color:${accepted ? "#065f46" : "#991b1b"};">${escapeHtml(amount)}</div>
      <div style="margin-top:8px;color:#6b7280;font-size:14px;">${escapeHtml(respondedOn)}</div>
      <p style="margin:16px 0 0;color:#6b7280;font-size:14px;">${next}</p>
      ${shareUrl ? `<div style="margin-top:28px;">${button(shareUrl, `View ${label.toLowerCase()}`)}</div>` : ""}
    </td></tr>
    <tr><td style="padding:20px 40px 32px;text-align:center;color:#9ca3af;font-size:12px;border-top:1px solid #e5e7eb;">
      SuperInvoice
    </td></tr>
  `);
}

async function sendEmail(apiKey: string, payload: Record<string, unknown>): Promise<string | null> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("[estimate-responded] resend error", res.status, text);
    return null;
  }
  const data = await res.json();
  return data?.id ?? null;
}

// ---------------------------------------------------------------------------
// push
// ---------------------------------------------------------------------------

async function sendPush(
  db: any,
  userId: string,
  message: { title: string; body: string; data: Record<string, unknown> },
): Promise<number> {
  const { data: tokens } = await db.from("push_tokens").select("token").eq("user_id", userId);
  const list: string[] = (tokens ?? []).map((t: any) => t.token).filter(Boolean);
  if (list.length === 0) return 0;

  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(list.map((to) => ({ to, sound: "default", ...message }))),
  });
  if (!res.ok) {
    console.error("[estimate-responded] expo push error", res.status, await res.text());
    return 0;
  }
  const { data } = await res.json();
  let delivered = 0;
  const dead: string[] = [];
  (data ?? []).forEach((ticket: any, i: number) => {
    if (ticket.status === "ok") delivered++;
    else if (ticket.details?.error === "DeviceNotRegistered") dead.push(list[i]);
  });
  if (dead.length) {
    await db.from("push_tokens").delete().in("token", dead);
  }
  return delivered;
}

// ---------------------------------------------------------------------------
// handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const expectedSecret = Deno.env.get("ESTIMATE_RESPONDED_WEBHOOK_SECRET");
  if (!expectedSecret) {
    console.error("[estimate-responded] ESTIMATE_RESPONDED_WEBHOOK_SECRET is not set");
    return json({ error: "Not configured" }, 500);
  }
  if (req.headers.get("x-estimate-responded-secret") !== expectedSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const record = payload.record;
  const old = payload.old_record;
  if (payload.type !== "UPDATE" || payload.table !== "estimates" || !record) {
    return json({ skipped: "not an estimates update" });
  }
  const accepted = record.status === "accepted";
  const declined = record.status === "declined";
  if ((!accepted && !declined) || old?.status === record.status) {
    return json({ skipped: "not a transition into accepted/declined" });
  }
  if (record.responded_notified_at) {
    return json({ skipped: "already notified" });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const SHARE_BASE_URL = Deno.env.get("SHARE_BASE_URL") ?? "https://invoices.getsuperinvoice.com";
  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  // Claim before doing anything visible: two deliveries must not both email.
  const { data: claimed } = await db
    .from("estimates")
    .update({ responded_notified_at: new Date().toISOString() })
    .eq("id", record.id)
    .is("responded_notified_at", null)
    .select("id");
  if (!claimed || claimed.length === 0) {
    return json({ skipped: "claimed by another delivery" });
  }

  const release = () =>
    db.from("estimates").update({ responded_notified_at: null }).eq("id", record.id);

  try {
    const [{ data: estimate }, { data: biz }, { data: authUser }] = await Promise.all([
      db.from("estimates").select("*, client:clients(*)").eq("id", record.id).single(),
      db.from("business_settings").select("business_name, business_email, currency_code, estimate_terminology").eq("user_id", record.user_id).maybeSingle(),
      db.auth.admin.getUserById(record.user_id),
    ]);
    if (!estimate) {
      await release();
      return json({ error: "Estimate not found" }, 404);
    }

    const label = biz?.estimate_terminology === "quote" ? "Quote" : "Estimate";
    const currency = currencyCodeOf(biz?.currency_code);
    const amount = formatMoney(Number(estimate.total_amount ?? 0), currency);
    const respondedOn = new Date().toLocaleDateString("en-GB", {
      day: "numeric", month: "long", year: "numeric",
    });
    const ownerEmailAddr: string | null = biz?.business_email || authUser?.user?.email || null;
    const clientName: string = estimate.client?.name || "Your client";
    const estimateNumber: string = estimate.estimate_number || estimate.id;

    const token = await ensureShareToken(db, estimate);
    const shareUrl = token ? `${SHARE_BASE_URL}/estimate/${token}` : null;

    const result = { owner_email: null as string | null, push: 0, share: !!token };

    if (RESEND_API_KEY && ownerEmailAddr) {
      result.owner_email = await sendEmail(RESEND_API_KEY, {
        from: "SuperInvoice <invoices@getsuperinvoice.com>",
        to: [ownerEmailAddr],
        subject: accepted
          ? `${clientName} accepted ${label.toLowerCase()} ${estimateNumber} — ${amount}`
          : `${clientName} declined ${label.toLowerCase()} ${estimateNumber}`,
        html: ownerEmail({ accepted, label, clientName, estimateNumber, amount, respondedOn, shareUrl }),
      });
    } else if (!RESEND_API_KEY) {
      console.warn("[estimate-responded] RESEND_API_KEY not set; skipping email");
    }

    result.push = await sendPush(db, record.user_id, {
      title: accepted ? `${label} accepted` : `${label} declined`,
      body: `${clientName} ${accepted ? "accepted" : "declined"} ${label.toLowerCase()} ${estimateNumber}${accepted ? ` — ${amount}` : ""}`,
      data: { type: "estimate_responded", estimateId: estimate.id, status: record.status },
    });

    if (!result.owner_email && result.push === 0) {
      await release();
      return json({ error: "No notification could be delivered", ...result }, 502);
    }

    console.log("[estimate-responded] done", estimate.id, record.status, result);
    return json({ ok: true, status: record.status, ...result });
  } catch (e) {
    console.error("[estimate-responded] failed", e);
    await release();
    return json({ error: (e as Error).message ?? "Unknown error" }, 500);
  }
});
