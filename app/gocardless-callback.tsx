import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/context/theme-provider';
import { useSupabase } from '@/context/supabase-provider';
import { useGoCardlessConnect } from '@/hooks/useGoCardlessConnect';

/**
 * Cold-start landing for the GoCardless OAuth redirect.
 *
 * In the normal flow the payments screen opens the consent page in an auth
 * session, the redirect closes it, and the hook exchanges the code there —
 * this route never renders. It exists for the case where the redirect arrives
 * when the app was not running (the user switched apps mid-flow and the OS
 * killed us): then this is the first thing on screen, and it has to finish the
 * exchange itself before handing over to the payments screen.
 */
export default function GoCardlessCallback() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user } = useSupabase();
  const gocardless = useGoCardlessConnect();
  const params = useLocalSearchParams<{ code?: string; state?: string; error?: string }>();

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'needs_verification'>('loading');
  const [message, setMessage] = useState('Connecting your GoCardless account…');

  useEffect(() => {
    if (!user) return; // the auth guard will settle first
    let cancelled = false;

    (async () => {
      try {
        if (params.error) throw new Error(`GoCardless returned an error: ${params.error}`);
        if (!params.code) throw new Error('No authorization code received');

        await gocardless.exchangeCode(params.code, params.state ?? null);
        const result = await gocardless.refresh();
        if (cancelled) return;

        if (result.canAcceptPayments) {
          setStatus('success');
          setMessage('GoCardless connected. You can now take instant bank payments.');
        } else if (result.verification === 'in_review') {
          setStatus('success');
          setMessage('GoCardless connected. Your details are under review — bank payments switch on automatically.');
        } else {
          setStatus('needs_verification');
          setMessage('GoCardless connected. A few more details are needed before you can take payments.');
        }
      } catch (e) {
        if (cancelled) return;
        console.error('[GoCardless] Callback error:', e);
        setStatus('error');
        setMessage(e instanceof Error ? e.message : 'Failed to connect GoCardless');
      }
      // Either way the payments screen is where the user was heading; it
      // shows the live status and any next step.
      setTimeout(() => {
        if (!cancelled) router.replace('/(app)/payment-options');
      }, 2200);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, params.code]);

  const icon =
    status === 'success' ? <CheckCircle size={64} color="#22C55E" /> :
    status === 'error' ? <XCircle size={64} color="#EF4444" /> :
    status === 'needs_verification' ? <AlertTriangle size={64} color="#F59E0B" /> :
    null;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    iconContainer: { marginBottom: 24 },
    message: {
      fontSize: 18,
      color: theme.foreground,
      textAlign: 'center',
      marginBottom: 16,
      lineHeight: 24,
    },
  });

  return (
    <View style={styles.container}>
      {status === 'loading' ? (
        <>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.message, { marginTop: 20 }]}>{message}</Text>
        </>
      ) : (
        <>
          <View style={styles.iconContainer}>{icon}</View>
          <Text style={styles.message}>{message}</Text>
        </>
      )}
    </View>
  );
}
