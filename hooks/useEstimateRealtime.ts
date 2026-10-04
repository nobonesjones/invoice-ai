import { useEffect, useRef } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

import { useSupabase } from "@/context/supabase-provider";

type EstimateRow = Record<string, any>;
type Change = RealtimePostgresChangesPayload<EstimateRow>;

/**
 * Re-run `onChange` whenever one of this user's estimates changes on the server.
 *
 * Mirrors useInvoiceRealtime. A client accepting or declining on the hosted
 * estimate page, or another device changing the status, shows up live instead
 * of on the next focus.
 *
 * Pass `estimateId` to narrow the subscription to one estimate (the viewer);
 * leave it out to hear about every estimate the user owns (the list).
 *
 * Requires the `estimates` table to be in the `supabase_realtime` publication.
 * If it is not, the channel simply never fires — nothing breaks, the app just
 * falls back to the focus-time refresh it has always had.
 */
export function useEstimateRealtime(
  onChange: (change: Change) => void,
  opts: { estimateId?: string | null; enabled?: boolean } = {},
) {
  const { supabase, user } = useSupabase();
  const { estimateId, enabled = true } = opts;

  // Keep the latest callback in a ref so the subscription is created once per
  // (user, estimate) rather than torn down on every render of the caller.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!enabled || !supabase || !user?.id) return;
    if (opts.estimateId === null) return; // explicitly waiting for an id

    const filter = estimateId ? `id=eq.${estimateId}` : `user_id=eq.${user.id}`;
    const name = `estimates:${estimateId ?? user.id}`;

    const channel = supabase
      .channel(name)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "estimates", filter },
        (payload: Change) => {
          onChangeRef.current(payload);
        },
      )
      .subscribe((status: string) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          // Not fatal: focus-time refresh still works. Logged so a missing
          // realtime publication is diagnosable from Metro.
          console.warn(`[EstimateRealtime] ${name} ${status}`);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, user?.id, estimateId, enabled]);
}
