import { useCallback, useEffect, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '@/config/supabase';
import { functionErrorMessage } from '@/hooks/useStripeConnect';

/**
 * GoCardless's creditor verification statuses, as stored in
 * payment_options.gocardless_verification_status by the token exchange.
 *
 *   successful       — verified, can collect payments
 *   in_review        — GoCardless is checking the details; nothing for the user to do
 *   action_required  — GoCardless needs something more from the user
 */
export type GoCardlessVerification = 'successful' | 'in_review' | 'action_required';

export type GoCardlessConnectState = {
  /** An OAuth token is stored for this user. Says nothing about whether it works. */
  connected: boolean;
  verification: GoCardlessVerification | null;
  /** The only flag that may gate a pay button: the creditor can actually collect. */
  canAcceptPayments: boolean;
  environment: 'sandbox' | 'live' | null;
};

export type GoCardlessConnectResult = GoCardlessConnectState & { error: string | null };

const IDLE: GoCardlessConnectState = {
  connected: false,
  verification: null,
  canAcceptPayments: false,
  environment: null,
};

/**
 * Same rationale as the Stripe hook: "in_review" resolves on GoCardless's
 * schedule with nothing for the user to do, and without polling the row sits
 * on "Under review" until the screen is remounted.
 */
const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 3 * 60 * 1_000;

/**
 * The OAuth flow is driven by the `gocardless-payments-oauth` edge function,
 * which the payments screen and the callback route already call with these
 * actions. Its response for the URL is read leniently (`url` or `oauth_url`)
 * because the two shapes both exist in this codebase.
 */
const OAUTH_FUNCTION = 'gocardless-payments-oauth';
const ENVIRONMENT: 'sandbox' | 'live' = 'sandbox';
// Web bounce page that forwards to the app scheme (public/gocardless-callback.html).
const WEB_REDIRECT_URI = 'https://getsuperinvoice.com/gocardless-callback';

/**
 * Reads connection state off the user's own payment_options row. This needs
 * no edge function: the token exchange writes the row, and the row is what the
 * rest of the app (invoice creation, the payments screen) already trusts.
 */
async function readState(): Promise<GoCardlessConnectState> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) return IDLE;

  const { data, error } = await supabase
    .from('payment_options')
    .select('gocardless_connected, gocardless_verification_status, gocardless_environment')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return IDLE;

  const row = data as any;
  const verification = (row.gocardless_verification_status as GoCardlessVerification) ?? null;
  const connected = !!row.gocardless_connected;
  // The deployed gocardless-payments-oauth exchange writes gocardless_connected
  // but never gocardless_verification_status, so a null there means "not
  // reported", not "not verified". Only an explicit non-successful status
  // withholds payments; that matches what the web app gates on.
  const canAcceptPayments = connected && (verification === null || verification === 'successful');
  return {
    connected,
    verification,
    canAcceptPayments,
    environment: (row.gocardless_environment as 'sandbox' | 'live') ?? null,
  };
}

/**
 * Drives GoCardless OAuth onboarding, mirroring useStripeConnect.
 *
 * The consent page opens in a real browser via openAuthSessionAsync, which
 * closes itself when GoCardless redirects to our scheme. The redirect carries
 * the authorization code, so the exchange happens right here — the
 * gocardless-callback route remains as the cold-start fallback for a redirect
 * that arrives when the app was not running.
 *
 * refresh() and connect() both RETURN the outcome as well as setting state:
 * reading the hook's state straight after awaiting is a stale closure.
 */
export function useGoCardlessConnect() {
  const [state, setState] = useState<GoCardlessConnectState>(IDLE);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<GoCardlessConnectResult> => {
    setLoading(true);
    setError(null);
    try {
      const next = await readState();
      setState(next);
      return { ...next, error: null };
    } catch (e: any) {
      const message = e?.message ?? 'Could not check your GoCardless status.';
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

  // Poll only while GoCardless is reviewing. action_required waits on the user
  // and successful is terminal; polling either would never resolve.
  useEffect(() => {
    if (state.verification !== 'in_review') return;

    const startedAt = Date.now();
    const id = setInterval(() => {
      if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
        clearInterval(id);
        return;
      }
      refresh();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(id);
  }, [state.verification, refresh]);

  /** Exchange an authorization code for a token; the function writes payment_options. */
  const exchangeCode = useCallback(async (code: string, oauthState?: string | null) => {
    const { error: fnError } = await supabase.functions.invoke(OAUTH_FUNCTION, {
      body: {
        action: 'exchange-code',
        code,
        state: oauthState ?? undefined,
        redirect_uri: WEB_REDIRECT_URI,
        environment: ENVIRONMENT,
      },
    });
    if (fnError) throw new Error(await functionErrorMessage(fnError, 'GoCardless did not accept the authorization.'));
  }, []);

  const connect = useCallback(async (): Promise<GoCardlessConnectResult> => {
    setConnecting(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(OAUTH_FUNCTION, {
        body: { action: 'generate-oauth-url', redirect_uri: WEB_REDIRECT_URI, environment: ENVIRONMENT },
      });
      if (fnError) throw new Error(await functionErrorMessage(fnError, 'Could not start GoCardless setup.'));
      const url: string | undefined = data?.url ?? data?.oauth_url;
      if (!url) throw new Error('GoCardless did not return an authorization link.');

      // Derived from the `scheme` in app.json. The web bounce page forwards
      // GoCardless's redirect to this, which is what closes the browser.
      const returnUrl = Linking.createURL('gocardless-callback');
      const result = await WebBrowser.openAuthSessionAsync(url, returnUrl);

      if (result.type === 'success' && result.url) {
        const params = Linking.parse(result.url).queryParams ?? {};
        const oauthError = params.error as string | undefined;
        const code = params.code as string | undefined;
        if (oauthError) throw new Error(`GoCardless returned an error: ${oauthError}`);
        if (code) await exchangeCode(code, (params.state as string) ?? null);
      }
      // Dismissed, cancelled, or a success URL without a code: nothing to
      // exchange. Either way the row is the source of truth, so read it.
      return await refresh();
    } catch (e: any) {
      const message = e?.message ?? 'Could not start GoCardless setup.';
      setError(message);
      return { ...IDLE, error: message };
    } finally {
      setConnecting(false);
    }
  }, [exchangeCode, refresh]);

  const disconnect = useCallback(async (): Promise<GoCardlessConnectResult> => {
    setConnecting(true);
    setError(null);
    try {
      const { error: fnError } = await supabase.functions.invoke(OAUTH_FUNCTION, {
        body: { action: 'disconnect' },
      });
      if (fnError) throw new Error(await functionErrorMessage(fnError, 'Could not disconnect GoCardless.'));
      return await refresh();
    } catch (e: any) {
      const message = e?.message ?? 'Could not disconnect GoCardless.';
      setError(message);
      return { ...state, error: message };
    } finally {
      setConnecting(false);
    }
  }, [refresh, state]);

  return { ...state, loading, hydrated, connecting, error, connect, disconnect, exchangeCode, refresh };
}

/** Human-readable status for the payments screen row. */
export function describeGoCardlessStatus(
  s: Pick<GoCardlessConnectState, 'connected' | 'canAcceptPayments' | 'verification'>,
): string {
  if (s.canAcceptPayments) return 'On';
  if (!s.connected) return 'Off';
  switch (s.verification) {
    case 'in_review': return 'Verifying';
    case 'action_required': return 'Action needed';
    default: return 'Setup incomplete';
  }
}
