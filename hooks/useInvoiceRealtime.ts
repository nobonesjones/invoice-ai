import { useEffect, useRef } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

import { useSupabase } from "@/context/supabase-provider";

type InvoiceRow = Record<string, any>;
type Change = RealtimePostgresChangesPayload<InvoiceRow>;

/**
 * Re-run `onChange` whenever one of this user's invoices changes on the server.
 *
 * Until now the app only ever learned about a change when a screen regained
 * focus, so an invoice paid through Stripe while the owner was looking at it
 * stayed "Sent" on screen until they navigated away and back. This closes that
 * gap: the Stripe webhook, a GoCardless webhook, or another device marking it
 * paid all show up live.
 *
 * Pass `invoiceId` to narrow the subscription to one invoice (the viewer);
 * leave it out to hear about every invoice the user owns (the list).
 *
 * Requires the `invoices` table to be in the `supabase_realtime` publication.
 * If it is not, the channel simply never fires — nothing breaks, the app just
 * falls back to the focus-time refresh it has always had.
 */
export function useInvoiceRealtime(
  onChange: (change: Change) => void,
  opts: { invoiceId?: string | null; enabled?: boolean } = {},
) {
  const { supabase, user } = useSupabase();
  const { invoiceId, enabled = true } = opts;

  // Keep the latest callback in a ref so the subscription is created once per
  // (user, invoice) rather than torn down on every render of the caller.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!enabled || !supabase || !user?.id) return;
    if (opts.invoiceId === null) return; // explicitly waiting for an id

    const filter = invoiceId ? `id=eq.${invoiceId}` : `user_id=eq.${user.id}`;
    const name = `invoices:${invoiceId ?? user.id}`;

    const channel = supabase
      .channel(name)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invoices", filter },
        (payload: Change) => {
          onChangeRef.current(payload);
        },
      )
      .subscribe((status: string) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          // Not fatal: focus-time refresh still works. Logged so a missing
          // realtime publication is diagnosable from Metro.
          console.warn(`[InvoiceRealtime] ${name} ${status}`);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, user?.id, invoiceId, enabled]);
}
