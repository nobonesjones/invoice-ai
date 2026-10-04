// The user's side of the support chat: one thread per user, messages in
// order, live updates when the founder replies, and a send that shows the
// message immediately rather than after the round trip.
import { useCallback, useEffect, useRef, useState } from "react";

import { useSupabase } from "@/context/supabase-provider";

export interface SupportMessage {
  id: string;
  sender: "user" | "owner";
  body: string;
  created_at: string;
  pending?: boolean;
  failed?: boolean;
}

export function useSupportChat() {
  const { supabase, user } = useSupabase();
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const threadRef = useRef<string | null>(null);

  // Find or start this user's thread, then load its messages.
  useEffect(() => {
    if (!supabase || !user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        let { data: thread, error: readErr } = await supabase
          .from("support_threads")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (readErr) throw readErr;
        if (!thread) {
          const { data: created, error: insErr } = await supabase
            .from("support_threads")
            .insert({ user_id: user.id })
            .select("id")
            .single();
          if (insErr) throw insErr;
          thread = created;
        }
        if (cancelled || !thread) return;
        threadRef.current = thread.id;
        setThreadId(thread.id);

        const { data: rows, error: msgErr } = await supabase
          .from("support_messages")
          .select("id, sender, body, created_at")
          .eq("thread_id", thread.id)
          .order("created_at", { ascending: true })
          .limit(500);
        if (msgErr) throw msgErr;
        if (!cancelled) setMessages((rows ?? []) as SupportMessage[]);
      } catch (e: any) {
        console.error("[SupportChat] load failed", e);
        if (!cancelled) setError(e?.message ?? "Could not load chat");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, user?.id]);

  // Live replies. Needs support_messages in the realtime publication.
  useEffect(() => {
    if (!supabase || !threadId) return;
    const channel = supabase
      .channel(`support:${threadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `thread_id=eq.${threadId}` },
        (payload: any) => {
          const row = payload.new as SupportMessage;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
          if (row.sender === "owner") markRead();
        },
      )
      .subscribe((status: string) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") console.warn(`[SupportChat] realtime ${status}`);
      });
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, threadId]);

  const markRead = useCallback(async () => {
    const id = threadRef.current;
    if (!supabase || !id) return;
    await supabase.from("support_threads").update({ user_unread_count: 0 }).eq("id", id);
  }, [supabase]);

  useEffect(() => {
    if (threadId) markRead();
  }, [threadId, markRead]);

  const send = useCallback(
    async (body: string) => {
      const text = body.trim();
      const id = threadRef.current;
      if (!supabase || !user?.id || !id || !text) return;

      const tempId = `tmp-${Date.now()}`;
      const optimistic: SupportMessage = { id: tempId, sender: "user", body: text, created_at: new Date().toISOString(), pending: true };
      setMessages((prev) => [...prev, optimistic]);

      const { data, error: insErr } = await supabase
        .from("support_messages")
        .insert({ thread_id: id, user_id: user.id, sender: "user", body: text })
        .select("id, sender, body, created_at")
        .single();

      setMessages((prev) => {
        if (insErr || !data) return prev.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m));
        // The realtime echo may already have added the real row.
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        return withoutTemp.some((m) => m.id === data.id) ? withoutTemp : [...withoutTemp, data as SupportMessage];
      });
      if (insErr) console.error("[SupportChat] send failed", insErr);
    },
    [supabase, user?.id],
  );

  const retry = useCallback(
    (failedId: string) => {
      const m = messages.find((x) => x.id === failedId);
      if (!m) return;
      setMessages((prev) => prev.filter((x) => x.id !== failedId));
      send(m.body);
    },
    [messages, send],
  );

  return { messages, loading, error, send, retry, ready: !!threadId };
}
