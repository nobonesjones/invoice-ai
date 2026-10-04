// support-notify — a user wrote in the app; put it on the founder's phone.
//
// Invoked by a Database Webhook on `support_messages` INSERT (sender = 'user').
// Sends the message to the founder's Telegram chat with who it is from and the
// thread's short code, then records the Telegram message id on the row so a
// Telegram "reply" to it can be routed back (see telegram-webhook).
//
// Secrets: SUPPORT_NOTIFY_WEBHOOK_SECRET, TELEGRAM_BOT_TOKEN, OWNER_TELEGRAM_CHAT_ID.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendTelegramMessage, escapeHtml } from "../_shared/telegram.ts";

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: {
    id: string;
    thread_id: string;
    user_id: string;
    sender: "user" | "owner";
    body: string;
    telegram_message_id: number | null;
  } | null;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const expectedSecret = Deno.env.get("SUPPORT_NOTIFY_WEBHOOK_SECRET");
  if (!expectedSecret) return json({ error: "Not configured" }, 500);
  if (req.headers.get("x-support-notify-secret") !== expectedSecret) return json({ error: "Unauthorized" }, 401);

  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const ownerChatId = Deno.env.get("OWNER_TELEGRAM_CHAT_ID");
  if (!botToken || !ownerChatId) {
    console.error("[support-notify] TELEGRAM_BOT_TOKEN / OWNER_TELEGRAM_CHAT_ID not set");
    return json({ error: "Telegram not configured" }, 500);
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const record = payload.record;
  if (payload.type !== "INSERT" || payload.table !== "support_messages" || !record) {
    return json({ skipped: "not a support_messages insert" });
  }
  if (record.sender !== "user") return json({ skipped: "owner message" });
  if (record.telegram_message_id) return json({ skipped: "already forwarded" });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const [{ data: thread }, { data: biz }, { data: authUser }, { count: priorCount }] = await Promise.all([
    db.from("support_threads").select("short_code").eq("id", record.thread_id).maybeSingle(),
    db.from("business_settings").select("business_name").eq("user_id", record.user_id).maybeSingle(),
    db.auth.admin.getUserById(record.user_id),
    db.from("support_messages").select("id", { count: "exact", head: true }).eq("thread_id", record.thread_id),
  ]);

  const email = authUser?.user?.email ?? "unknown email";
  const name = biz?.business_name || authUser?.user?.user_metadata?.full_name || "A user";
  const code = thread?.short_code ?? "??????";
  const isFirst = (priorCount ?? 1) <= 1;

  const text =
    `💬 <b>${escapeHtml(name)}</b>${isFirst ? " (new)" : ""}\n` +
    `<i>${escapeHtml(email)}</i>\n\n` +
    `${escapeHtml(record.body)}\n\n` +
    `<code>#${code}</code> · reply to this message to answer`;

  const sent = await sendTelegramMessage(botToken, ownerChatId, text);
  if (!sent.ok) {
    console.error("[support-notify] telegram send failed", sent.error);
    return json({ error: "Telegram send failed", detail: sent.error }, 502);
  }

  await db.from("support_messages").update({ telegram_message_id: sent.messageId }).eq("id", record.id);
  return json({ ok: true, telegram_message_id: sent.messageId });
});
