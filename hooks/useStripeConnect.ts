import { useCallback, useEffect, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';

export type StripeConnectState = {
  /** An account exists at Stripe for this user. Says nothing about whether it works. */
  connected: boolean;
  /** The only flag that may gate a pay button: the account can actually take money. */
  canAcceptPayments: boolean;
  /** Raw capability status, e.g. 'active' | 'pending' | 'inactive'. */
  status: string | null;
  requirementsOutstanding: boolean;
};

export type StripeConnectResult = StripeConnectState & { error: string | null };

const IDLE: StripeConnectState = {
  connected: false,
  canAcceptPayments: false,
  status: null,
  requirementsOutstanding: false,
};

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
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<StripeConnectResult> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('stripe-connect-status');
      if (fnError) throw fnError;
      const next: StripeConnectState = {
        connected: !!data?.connected,
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
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const connect = useCallback(async (): Promise<StripeConnectResult> => {
    setConnecting(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('stripe-connect-start');
      if (fnError) throw fnError;
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

  return { ...state, loading, connecting, error, connect, refresh };
}

/** Human-readable status for the payments screen. */
export function describeStripeStatus(s: Pick<StripeConnectState, 'connected' | 'canAcceptPayments'>): string {
  if (s.canAcceptPayments) return 'On';
  if (s.connected) return 'Setup incomplete';
  return 'Off';
}
