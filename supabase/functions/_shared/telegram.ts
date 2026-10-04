// Thin Telegram Bot API client shared by support-notify (out) and
// telegram-webhook (in). One bot, one chat: the founder's phone.

const API = "https://api.telegram.org";

export interface TelegramSendResult {
  ok: boolean;
  messageId: number | null;
  error?: string;
}

export async function sendTelegramMessage(
  botToken: string,
  chatId: string | number,
  text: string,
  opts: { replyToMessageId?: number | null } = {},
): Promise<TelegramSendResult> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };
  if (opts.replyToMessageId) {
    body.reply_parameters = { message_id: opts.replyToMessageId, allow_sending_without_reply: true };
  }
  const res = await fetch(`${API}/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) {
    return { ok: false, messageId: null, error: json.description ?? `HTTP ${res.status}` };
  }
  return { ok: true, messageId: json.result?.message_id ?? null };
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
