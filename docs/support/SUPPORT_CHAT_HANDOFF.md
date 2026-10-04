# Support chat → Telegram: backend setup

The app side is done (Settings → Help → "Chat with Harry"). This is what the
backend agent needs to do to make messages reach Harry's phone and replies
come back. Everything is committed under `supabase/`.

## 1. Telegram bot (Harry, 2 minutes)

1. In Telegram, open **@BotFather** → `/newbot` → pick a name (e.g. "SuperInvoice Support") and a username. Copy the **bot token**.
2. Open the new bot's chat and press **Start**. The chat id comes back in step 4.

## 2. Secrets on the Supabase project

```
supabase secrets set TELEGRAM_BOT_TOKEN=<from BotFather>
supabase secrets set TELEGRAM_WEBHOOK_SECRET=<random 32+ chars>
supabase secrets set SUPPORT_NOTIFY_WEBHOOK_SECRET=<random 32+ chars>
supabase secrets set SUPPORT_OWNER_NAME=Harry
```
`OWNER_TELEGRAM_CHAT_ID` is set in step 4 once known.

## 3. Deploy the two functions

```
supabase functions deploy support-notify --no-verify-jwt
supabase functions deploy telegram-webhook --no-verify-jwt
```
Both authenticate with their own secrets, not a Supabase JWT, so `--no-verify-jwt` is required.

## 4. Point Telegram at the webhook, discover the chat id

```
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d url=https://wzpuzqzsjdizmpiobsuo.supabase.co/functions/v1/telegram-webhook \
  -d secret_token=<TELEGRAM_WEBHOOK_SECRET> \
  -d allowed_updates='["message"]'
```
Then Harry sends `/start` to the bot. It replies with the chat id. Set it:
```
supabase secrets set OWNER_TELEGRAM_CHAT_ID=<id>
```
(Function secrets are read at request time; no redeploy needed.)

## 5. Apply the migration

`supabase/migrations/20260911090000_support_chat.sql`. Before applying,
substitute `__SUPPORT_NOTIFY_SECRET__` with the real
`SUPPORT_NOTIFY_WEBHOOK_SECRET` value, as was done for invoice-paid and
estimate-responded. It creates `support_threads`, `support_messages`, RLS,
the bookkeeping trigger, the `net.http_post` webhook trigger, and adds
`support_messages` to the `supabase_realtime` publication.

## 6. Verify

1. In the app: Settings → Chat with Harry → send "test".
2. Telegram shows: 💬 business name, email, the text, `#CODE`.
3. Reply to that Telegram message (swipe-reply). The bot answers "✓ Sent to their phone" (or "✓ Saved" if the user has no push token yet).
4. The app shows the reply instantly if open (realtime), and a push arrives if the device is registered.

Fallback if reply-to isn't used: type `#CODE your reply`.

## Notes

- Push to the user needs `push_tokens` rows, which the app registers via `usePushNotifications` (needs the EAS build with the notifications entitlement; until then realtime still works while the app is open).
- Owner replies are inserted with the service role; users cannot insert `sender = 'owner'` rows (RLS).
- Messages from any Telegram chat other than `OWNER_TELEGRAM_CHAT_ID` are ignored, except `/start` and `/id` which echo the chat id.
