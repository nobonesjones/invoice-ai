// telegram-webhook — the founder replied on Telegram; deliver it to the user.
//
// Telegram calls this for every update in the bot's chat. A reply to one of
// the forwarded messages (Telegram's "reply" feature) is matched by the
// forwarded message id; a message starting with "#CODE " is matched by the
// thread's short code. Anything else gets a short hint back. The matched
// text is inserted as an owner message, which reaches the app over realtime
// and as a push notification.
//
// Also answers /start with the chat id, which is how OWNER_TELEGRAM_CHAT_ID
// gets discovered when the bot is first set up.
//
// Secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET (set on the Telegram
// side with setWebhook's secret_token), OWNER_TELEGRAM_CHAT_ID.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendTelegramMessage, escapeHtml } from "../_shared/telegram.ts";
import { sendPush } from "../_shared/push.ts";

const OWNER_DISPLAY_NAME = Deno.env.get("SUPPORT_OWNER_NAME") ?? "Harry";

const ok = () => new Response("ok", { status: 200 });

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const expected = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
  if (!expected || req.headers.get("x-telegram-bot-api-secret-token") !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!botToken) return new Response("Not configured", { status: 500 });

  let update: any;
  try {
    update = await req.json();
  } catch {
    return ok(); // Telegram retries on non-2xx; a bad body will never improve.
  }

  const msg = update?.message ?? update?.edited_message;
  if (!msg || typeof msg.text !== "string") return ok();
  const chatId = String(msg.chat?.id ?? "");
  const text: string = msg.text.trim();

  if (text === "/start" || text === "/id") {
    await sendTelegramMessage(botToken, chatId, `This chat's id is <code>${escapeHtml(chatId)}</code>. Set it as OWNER_TELEGRAM_CHAT_ID.`);
    return ok();
  }

  const ownerChatId = Deno.env.get("OWNER_TELEGRAM_CHAT_ID");
  if (!ownerChatId || chatId !== String(ownerChatId)) return ok(); // strangers are ignored, quietly

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // 1. Reply to a forwarded message → that message's thread.
  let threadId: string | null = null;
  let userId: string | null = null;
  let body = text;
  const replyToId: number | undefined = msg.reply_to_message?.message_id;
  if (replyToId) {
    const { data: original } = await db
      .from("support_messages")
      .select("thread_id, user_id")
      .eq("telegram_message_id", replyToId)
      .maybeSingle();
    if (original) {
      threadId = original.thread_id;
      userId = original.user_id;
    }
  }

  // 2. "#CODE your reply" → thread by short code.
  if (!threadId) {
    const m = /^#?([A-Za-z0-9]{6})\s+([\s\S]+)$/.exec(text);
    if (m) {
      const { data: thread } = await db
        .from("support_threads")
        .select("id, user_id")
        .eq("short_code", m[1].toUpperCase())
        .maybeSingle();
      if (thread) {
        threadId = thread.id;
        userId = thread.user_id;
        body = m[2].trim();
      }
    }
  }

  if (!threadId || !userId) {
    await sendTelegramMessage(
      botToken,
      chatId,
      "I couldn't tell who that was for. Reply to one of the messages above, or start with the thread code, e.g. <code>#AB12CD thanks, fixed</code>.",
    );
    return ok();
  }

  const { data: inserted, error } = await db
    .from("support_messages")
    .insert({ thread_id: threadId, user_id: userId, sender: "owner", body, telegram_message_id: msg.message_id })
    .select("id")
    .single();
  if (error) {
    console.error("[telegram-webhook] insert failed", error);
    await sendTelegramMessage(botToken, chatId, "That didn't save. Try again in a moment.", { replyToMessageId: msg.message_id });
    return ok();
  }

  const delivered = await sendPush(
    db,
    userId,
    {
      title: `${OWNER_DISPLAY_NAME} replied`,
      body: body.length > 140 ? body.slice(0, 137) + "…" : body,
      data: { type: "support_reply", threadId },
    },
    "telegram-webhook",
  );

  await sendTelegramMessage(
    botToken,
    chatId,
    delivered > 0 ? "✓ Sent to their phone" : "✓ Saved · they'll see it next time they open the app",
    { replyToMessageId: msg.message_id },
  );
  console.log("[telegram-webhook] owner reply", inserted?.id, "push", delivered);
  return ok();
});
