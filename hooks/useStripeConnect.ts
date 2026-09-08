import { useCallback, useEffect, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '@/config/supabase';

/**
 * supabase-js collapses every non-2xx from an edge function into the same
 * generic "Edge Function returned a non-2xx status code", discarding the JSON
 * body that says what actually went wrong. The real message is on
 * error.context, which is a Response that has to be read.
 */
async function functionErrorMessage(error: any, fallback: string): Promise<string> {
  try {
    const body = await error?.context?.json?.();
    if (body?.error) return body.error as string;
  } catch {
    // Body already consumed or not JSON — fall through.
  }
  return error?.message ?? fallback;
}

/**
 * What the user should actually be told. Derived server-side from Stripe's
 * four-valued capability status plus who each outstanding requirement is
 * blocked on.
 *
 * "verifying" is the one that matters: Stripe says onboarding is done, the
 * capability is still activating, and there is nothing the user can do. Showing
 * them a "finish setup" button here sends them back to Stripe to press a button
 * that changes nothing.
 */
export type ConnectPhase = "active" | "verifying" | "action_required" | "unsupported";

export type StripeConnectState = {
  /** An account exists at Stripe for this user. Says nothing about whether it works. */
  connected: boolean;
  state: ConnectPhase | null;
  /** The only flag that may gate a pay button: the account can actually take money. */
  canAcceptPayments: boolean;
  /** Raw capability status, e.g. 'active' | 'pending' | 'inactive'. */
  status: string | null;
  requirementsOutstanding: boolean;
};

export type StripeConnectResult = StripeConnectState & { error: string | null };

/**
 * Whether the first read from Stripe has landed. Before it has, the state is
 * still IDLE, and IDLE is indistinguishable from a genuinely disconnected
 * account — rendering it shows "Off" for a beat on every mount, then flips to
 * "On". Callers should show a placeholder until this is true rather than
 * publish a value they are about to contradict.
 */
export type StripeConnectHydration = { hydrated: boolean };

const IDLE: StripeConnectState = {
  connected: false,
  state: null,
  canAcceptPayments: false,
  status: null,
  requirementsOutstanding: false,
};

/**
 * "verifying" resolves on Stripe's schedule with nothing for the user to do —
 * in practice tens of seconds. Without polling the row sits on "Verifying" until
 * the screen is remounted, which reads as broken.
 *
 * Capped rather than indefinite: if it has not cleared in three minutes it is no
 * longer a quick activation, and hammering Stripe adds nothing. The next mount
 * picks it up.
 */
const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 3 * 60 * 1_000;

/**
 * Drives Stripe-hosted Connect onboarding.
 *
 * Onboarding MUST run in a real browser (SFSafariViewController / Chrome Custom
 * Tabs), which is what openAuthSessionAsync gives us. Stripe does not support
 * its hosted flows inside an embedded WebView — a react-native-webview version
 * of this silently fails.
 *
 * refresh() and connect() both RETURN the outcome as well as setting state.
 * Callers must use the returned value: reading the hook's state straight after
 * awaiting is a stale closure and gives the previous render's values.
 */
export function useStripeConnect() {
  const [state, setState] = useState<StripeConnectState>(IDLE);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<StripeConnectResult> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('stripe-connect-status');
      if (fnError) throw new Error(await functionErrorMessage(fnError, 'Could not check your Stripe status.'));
      const next: StripeConnectState = {
        connected: !!data?.connected,
        state: (data?.state as ConnectPhase) ?? null,
        canAcceptPayments: !!data?.canAcceptPayments,
        status: data?.status ?? null,
        requirementsOutstanding: !!data?.requirementsOutstanding,
      };
      setState(next);
      return { ...next, error: null };
    } catch (e: any) {
      const message = e?.message ?? 'Could not check your Stripe status.';
      setError(message);
      setState(IDLE);
      return { ...IDLE, error: message };
    } finally {
      setLoading(false);
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll only while verifying. Any other state is either terminal or waiting on
  // the user, and polling those would be a request loop that never resolves.
  useEffect(() => {
    if (state.state !== "verifying") return;

    const startedAt = Date.now();
    const id = setInterval(() => {
      if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
        clearInterval(id);
        return;
      }
      refresh();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(id);
  }, [state.state, refresh]);

  const connect = useCallback(async (): Promise<StripeConnectResult> => {
    setConnecting(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('stripe-connect-start');
      if (fnError) throw new Error(await functionErrorMessage(fnError, 'Could not start Stripe setup.'));
      if (!data?.url) throw new Error('Stripe did not return an onboarding link.');

      // Derived from the `scheme` in app.json, so this stays correct if the app
      // is renamed. Must match APP_RETURN_SCHEME on the edge function.
      const returnUrl = Linking.createURL('stripe-connect');
      await WebBrowser.openAuthSessionAsync(data.url, returnUrl);

      // The browser closing means the user left the flow, not that they finished
      // it — the return URL carries no state. Stripe is the only source of truth.
      return await refresh();
    } catch (e: any) {
      const message = e?.message ?? 'Could not start Stripe setup.';
      setError(message);
      return { ...IDLE, error: message };
    } finally {
      setConnecting(false);
    }
  }, [refresh]);

  return { ...state, loading, hydrated, connecting, error, connect, refresh };
}

/** Human-readable status for the payments screen row. */
export function describeStripeStatus(
  s: Pick<StripeConnectState, 'connected' | 'canAcceptPayments' | 'state'>,
): string {
  if (s.canAcceptPayments) return 'On';
  if (!s.connected) return 'Off';
  switch (s.state) {
    case 'verifying': return 'Verifying';
    case 'unsupported': return 'Unavailable';
    default: return 'Setup incomplete';
  }
}
