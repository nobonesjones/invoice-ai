-- Support chat: a direct line from every user to the founder.
--
-- One thread per user, plain messages underneath. A message from the user
-- fires the support-notify edge function, which forwards it to the founder's
-- Telegram; a reply there comes back through telegram-webhook and lands as an
-- owner message, which the app hears about over realtime and by push.
--
-- The webhook function embeds the SUPPORT_NOTIFY_WEBHOOK_SECRET value. The
-- committed copy carries a placeholder; the applied copy substitutes the real
-- secret (same one set on the support-notify edge function).

CREATE TABLE IF NOT EXISTS public.support_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Short handle the founder can type in Telegram to address a thread.
  short_code text NOT NULL UNIQUE DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
  last_message_at timestamptz,
  last_message_preview text,
  last_sender text,
  user_unread_count integer NOT NULL DEFAULT 0,
  owner_unread_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.support_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender text NOT NULL CHECK (sender IN ('user', 'owner')),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  -- Telegram message id of the forwarded copy (user messages) or of the reply
  -- it came from (owner messages). Lets a Telegram "reply" find its thread.
  telegram_message_id bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_messages_thread_created_idx
  ON public.support_messages (thread_id, created_at);
CREATE INDEX IF NOT EXISTS support_messages_telegram_idx
  ON public.support_messages (telegram_message_id) WHERE telegram_message_id IS NOT NULL;

ALTER TABLE public.support_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Users see and start their own thread, and can zero their unread counter.
DROP POLICY IF EXISTS support_threads_select_own ON public.support_threads;
CREATE POLICY support_threads_select_own ON public.support_threads
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS support_threads_insert_own ON public.support_threads;
CREATE POLICY support_threads_insert_own ON public.support_threads
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS support_threads_update_own ON public.support_threads;
CREATE POLICY support_threads_update_own ON public.support_threads
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Users read every message on their thread and write only as themselves.
-- Owner messages are written by the edge function with the service role.
DROP POLICY IF EXISTS support_messages_select_own ON public.support_messages;
CREATE POLICY support_messages_select_own ON public.support_messages
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS support_messages_insert_own ON public.support_messages;
CREATE POLICY support_messages_insert_own ON public.support_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id AND sender = 'user');

-- Thread bookkeeping on every message: preview, counters, ordering.
CREATE OR REPLACE FUNCTION public.on_support_message_inserted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.support_threads
  SET last_message_at = NEW.created_at,
      last_message_preview = left(NEW.body, 140),
      last_sender = NEW.sender,
      user_unread_count = CASE WHEN NEW.sender = 'owner' THEN user_unread_count + 1 ELSE user_unread_count END,
      owner_unread_count = CASE WHEN NEW.sender = 'user' THEN owner_unread_count + 1 ELSE 0 END
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_support_message_inserted ON public.support_messages;
CREATE TRIGGER trg_on_support_message_inserted
  AFTER INSERT ON public.support_messages
  FOR EACH ROW EXECUTE FUNCTION public.on_support_message_inserted();

-- Forward user messages to the founder. Same shape as the invoice-paid and
-- estimate-responded webhooks so the edge function can share their parsing.
CREATE OR REPLACE FUNCTION public.support_notify_webhook_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://wzpuzqzsjdizmpiobsuo.supabase.co/functions/v1/support-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-support-notify-secret', '__SUPPORT_NOTIFY_SECRET__'
    ),
    body := jsonb_build_object(
      'type', tg_op,
      'table', tg_table_name,
      'schema', tg_table_schema,
      'record', to_jsonb(new)
    ),
    timeout_milliseconds := 5000
  );
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS support_notify_webhook ON public.support_messages;
CREATE TRIGGER support_notify_webhook
  AFTER INSERT ON public.support_messages
  FOR EACH ROW
  WHEN (new.sender = 'user')
  EXECUTE FUNCTION public.support_notify_webhook_fn();

-- The app listens for owner replies live.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'support_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
  END IF;
END $$;
