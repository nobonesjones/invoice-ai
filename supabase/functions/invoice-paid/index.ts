// invoice-paid — the one place "an invoice got paid" turns into things people see.
//
// Invoked by a Database Webhook on `invoices` UPDATE. It does not care how the
// invoice came to be paid: the Stripe webhook, a GoCardless webhook, or the
// owner flipping the Paid toggle all land here, so every method gets the same
// experience with no per-method code.
//
// On the transition into paid it:
//   1. claims the invoice via invoices.paid_notified_at (so webhook retries and
//      concurrent deliveries cannot double-send);
//   2. makes sure a share link exists, so the payer's email can point at a
//      page that shows the invoice marked PAID — the app renders the invoice
//      PDF on the phone, so a server-side attachment is not an option;
//   3. emails the payer a thank-you with that link;
//   4. emails the owner "you've been paid";
//   5. pushes to the owner's registered devices.
//
// Each of 3–5 is independent: one failing does not stop the others, and the
// response says what went out. If nothing at all went out, the claim is
// released so the next delivery can try again.
//
// Env:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (provided by the platform)
//   RESEND_API_KEY
//   INVOICE_PAID_WEBHOOK_SECRET  — must equal the x-invoice-paid-secret header
//                                  configured on the Database Webhook.
//   SHARE_BASE_URL (optional)    — defaults to https://invoices.getsuperinvoice.com

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

// ---------------------------------------------------------------------------
// currency
// ---------------------------------------------------------------------------

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
  // Same alphabet and length as InvoiceShareService.generateUniqueToken in the
  // app, so tokens from either side look identical to the shared page.
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let out = "";
  for (const b of bytes) out += chars[b % chars.length];
  return out;
}

/**
 * Return a live share token for the invoice, creating one if none exists.
 * A share created here has no pdf_path — the shared page renders from the
 * row and only offers a PDF download when a path is present, so that is fine.
 */
async function ensureShareToken(db: any, invoice: any): Promise<string | null> {
  const nowIso = new Date().toISOString();
  const { data: existing } = await db
    .from("invoice_shares")
    .select("share_token, expires_at")
    .eq("invoice_id", invoice.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(5);

  const live = (existing ?? []).find(
    (s: any) => !s.expires_at || s.expires_at > nowIso,
  );
  if (live) return live.share_token;

  const token = newShareToken();
  const { error } = await db.from("invoice_shares").insert({
    invoice_id: invoice.id,
    user_id: invoice.user_id,
    share_token: token,
    is_active: true,
    // A paid invoice's receipt should stay reachable. A year is generous
    // without being forever.
    expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (error) {
    console.error("[invoice-paid] could not create share", error);
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
  // Mirrors the send-invoice template's frame so the thank-you reads as part
  // of the same conversation as the invoice that preceded it.
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

function paidBadge(): string {
  return `<div style="display:inline-block;padding:6px 14px;border-radius:999px;background:#d1fae5;color:#065f46;font-weight:600;font-size:13px;letter-spacing:.04em;">PAID</div>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;padding:14px 28px;background:#10b981;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px;">${label}</a>`;
}

function payerEmail(opts: {
  clientName: string;
  businessName: string;
  invoiceNumber: string;
  amount: string;
  paidOn: string;
  shareUrl: string | null;
}): string {
  const { clientName, businessName, invoiceNumber, amount, paidOn, shareUrl } = opts;
  return emailShell(`
    <tr><td style="padding:40px 40px 24px;text-align:center;border-bottom:1px solid #e5e7eb;">
      ${paidBadge()}
      <h1 style="margin:16px 0 0;font-size:24px;color:#1f2937;">Thank you, ${escapeHtml(clientName)}</h1>
      <p style="margin:8px 0 0;color:#6b7280;font-size:14px;">Your payment to ${escapeHtml(businessName)} has been received</p>
    </td></tr>
    <tr><td style="padding:32px 40px;">
      <table role="presentation" style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:8px;">
        <tr>
          <td style="padding:16px 20px;color:#6b7280;font-size:14px;">Invoice</td>
          <td style="padding:16px 20px;color:#1f2937;font-weight:500;text-align:right;">${escapeHtml(invoiceNumber)}</td>
        </tr>
        <tr>
          <td style="padding:0 20px 16px;color:#6b7280;font-size:14px;">Amount paid</td>
          <td style="padding:0 20px 16px;color:#1f2937;font-weight:600;text-align:right;font-size:18px;">${escapeHtml(amount)}</td>
        </tr>
        <tr>
          <td style="padding:0 20px 16px;color:#6b7280;font-size:14px;">Paid on</td>
          <td style="padding:0 20px 16px;color:#1f2937;font-weight:500;text-align:right;">${escapeHtml(paidOn)}</td>
        </tr>
      </table>
      ${
        shareUrl
          ? `<div style="text-align:center;margin-top:28px;">${button(shareUrl, "View paid invoice")}</div>
             <p style="margin:12px 0 0;text-align:center;color:#9ca3af;font-size:12px;">Keep this for your records.</p>`
          : ""
      }
    </td></tr>
    <tr><td style="padding:20px 40px 32px;text-align:center;color:#9ca3af;font-size:12px;border-top:1px solid #e5e7eb;">
      Sent on behalf of ${escapeHtml(businessName)} by SuperInvoice
    </td></tr>
  `);
}

function ownerEmail(opts: {
  businessName: string;
  clientName: string;
  invoiceNumber: string;
  amount: string;
  paidOn: string;
  method: string | null;
  shareUrl: string | null;
}): string {
  const { clientName, invoiceNumber, amount, paidOn, method, shareUrl } = opts;
  return emailShell(`
    <tr><td style="padding:40px 40px 24px;text-align:center;border-bottom:1px solid #e5e7eb;">
      ${paidBadge()}
      <h1 style="margin:16px 0 0;font-size:24px;color:#1f2937;">You've been paid</h1>
      <p style="margin:8px 0 0;color:#6b7280;font-size:14px;">${escapeHtml(clientName)} paid invoice ${escapeHtml(invoiceNumber)}</p>
    </td></tr>
    <tr><td style="padding:32px 40px;text-align:center;">
      <div style="font-size:36px;font-weight:700;color:#065f46;">${escapeHtml(amount)}</div>
      <div style="margin-top:8px;color:#6b7280;font-size:14px;">${escapeHtml(paidOn)}${method ? ` · ${escapeHtml(method)}` : ""}</div>
      ${shareUrl ? `<div style="margin-top:28px;">${button(shareUrl, "View invoice")}</div>` : ""}
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
    console.error("[invoice-paid] resend error", res.status, text);
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
    body: JSON.stringify(
      list.map((to) => ({ to, sound: "default", ...message })),
    ),
  });
  if (!res.ok) {
    console.error("[invoice-paid] expo push error", res.status, await res.text());
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
    // A token Expo has told us is gone will never work again; keeping it
    // just makes every future send slower and noisier.
    await db.from("push_tokens").delete().in("token", dead);
  }
  return delivered;
}

// ---------------------------------------------------------------------------
// handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const expectedSecret = Deno.env.get("INVOICE_PAID_WEBHOOK_SECRET");
  if (!expectedSecret) {
    console.error("[invoice-paid] INVOICE_PAID_WEBHOOK_SECRET is not set");
    return json({ error: "Not configured" }, 500);
  }
  if (req.headers.get("x-invoice-paid-secret") !== expectedSecret) {
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
  if (payload.type !== "UPDATE" || payload.table !== "invoices" || !record) {
    return json({ skipped: "not an invoices update" });
  }
  if (record.status !== "paid" || old?.status === "paid") {
    return json({ skipped: "not a transition into paid" });
  }
  if (record.paid_notified_at) {
    return json({ skipped: "already notified" });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const SHARE_BASE_URL = Deno.env.get("SHARE_BASE_URL") ?? "https://invoices.getsuperinvoice.com";
  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  // Claim before doing anything visible. Two deliveries of the same event
  // (webhook retry, or the trigger and the Stripe webhook racing) must not
  // both email the customer.
  const { data: claimed } = await db
    .from("invoices")
    .update({ paid_notified_at: new Date().toISOString() })
    .eq("id", record.id)
    .is("paid_notified_at", null)
    .select("id");
  if (!claimed || claimed.length === 0) {
    return json({ skipped: "claimed by another delivery" });
  }

  const release = () => db.from("invoices").update({ paid_notified_at: null }).eq("id", record.id);

  try {
    const [{ data: invoice }, { data: biz }, { data: authUser }] = await Promise.all([
      db.from("invoices").select("*, client:clients(*)").eq("id", record.id).single(),
      db.from("business_settings").select("business_name, business_email, currency_code").eq("user_id", record.user_id).maybeSingle(),
      db.auth.admin.getUserById(record.user_id),
    ]);
    if (!invoice) {
      await release();
      return json({ error: "Invoice not found" }, 404);
    }

    const currency = currencyCodeOf(biz?.currency_code);
    const amountNum = Number(invoice.paid_amount ?? invoice.total_amount ?? 0);
    const amount = formatMoney(amountNum, currency);
    const paidOn = new Date(invoice.payment_date ?? Date.now()).toLocaleDateString("en-GB", {
      day: "numeric", month: "long", year: "numeric",
    });
    const businessName: string = biz?.business_name || "Your supplier";
    const ownerEmailAddr: string | null = biz?.business_email || authUser?.user?.email || null;
    const clientName: string = invoice.client?.name || "there";
    const clientEmail: string | null = invoice.client?.email || null;
    const invoiceNumber: string = invoice.invoice_number || invoice.id;
    const method: string | null = invoice.payment_notes || null;

    const token = await ensureShareToken(db, invoice);
    const shareUrl = token ? `${SHARE_BASE_URL}?token=${token}` : null;

    const result = { payer_email: null as string | null, owner_email: null as string | null, push: 0, share: !!token };

    if (RESEND_API_KEY) {
      const from = `${businessName} <invoices@getsuperinvoice.com>`;
      const sends: Promise<void>[] = [];

      if (clientEmail) {
        sends.push(
          sendEmail(RESEND_API_KEY, {
            from,
            to: [clientEmail],
            ...(ownerEmailAddr ? { reply_to: ownerEmailAddr } : {}),
            subject: `Payment received — invoice ${invoiceNumber}`,
            html: payerEmail({ clientName, businessName, invoiceNumber, amount, paidOn, shareUrl }),
          }).then((id) => { result.payer_email = id; }),
        );
      }
      if (ownerEmailAddr) {
        sends.push(
          sendEmail(RESEND_API_KEY, {
            from: "SuperInvoice <invoices@getsuperinvoice.com>",
            to: [ownerEmailAddr],
            subject: `${clientName} paid ${amount} — invoice ${invoiceNumber}`,
            html: ownerEmail({ businessName, clientName, invoiceNumber, amount, paidOn, method, shareUrl }),
          }).then((id) => { result.owner_email = id; }),
        );
      }
      await Promise.all(sends);
    } else {
      console.warn("[invoice-paid] RESEND_API_KEY not set; skipping emails");
    }

    result.push = await sendPush(db, record.user_id, {
      title: "You've been paid",
      body: `${clientName} paid ${amount} for invoice ${invoiceNumber}`,
      data: { type: "invoice_paid", invoiceId: invoice.id },
    });

    if (!result.payer_email && !result.owner_email && result.push === 0) {
      // Nothing reached anyone. Give the next delivery a chance rather than
      // marking this invoice as handled.
      await release();
      return json({ error: "No notification could be delivered", ...result }, 502);
    }

    console.log("[invoice-paid] done", invoice.id, result);
    return json({ ok: true, ...result });
  } catch (e) {
    console.error("[invoice-paid] failed", e);
    await release();
    return json({ error: (e as Error).message ?? "Unknown error" }, 500);
  }
});
