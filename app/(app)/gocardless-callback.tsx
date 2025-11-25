import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/context/theme-provider';
import { useSupabase } from '@/context/supabase-provider';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react-native';

export default function GoCardlessCallback() {
  const router = useRouter();
  const { theme } = useTheme();
  const { supabase, user } = useSupabase();
  const params = useLocalSearchParams<{ code?: string; state?: string; error?: string }>();

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'needs_verification'>('loading');
  const [message, setMessage] = useState('Connecting your GoCardless account...');
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);

  useEffect(() => {
    handleOAuthCallback();
  }, []);

  const handleOAuthCallback = async () => {
    try {
      // Check for OAuth errors
      if (params.error) {
        throw new Error(`OAuth error: ${params.error}`);
      }

      // Validate required parameters
      if (!params.code) {
        throw new Error('No authorization code received');
      }

      if (!user) {
        throw new Error('User not authenticated');
      }

      console.log('[GoCardless] Processing OAuth callback', {
        hasCode: !!params.code,
        hasState: !!params.state,
      });

      setMessage('Exchanging authorization code...');

      // Call edge function to exchange code for access token
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        throw new Error('No active session');
      }

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/gocardless-exchange-token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.session.access_token}`,
            'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
          },
          body: JSON.stringify({
            code: params.code,
            state: params.state || '',
            environment: 'sandbox', // TODO: Make this configurable
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to exchange authorization code');
      }

      const data = await response.json();

      console.log('[GoCardless] Token exchange successful', {
        verificationStatus: data.creditor?.verification_status,
      });

      // Check verification status
      const verification = data.creditor?.verification_status;
      setVerificationStatus(verification);

      if (verification === 'action_required') {
        setStatus('needs_verification');
        setMessage('Account connected! Please complete verification to start accepting payments.');

        // Redirect to verification after a short delay
        setTimeout(() => {
          router.replace('/gocardless-onboarding');
        }, 2000);
      } else if (verification === 'in_review') {
        setStatus('success');
        setMessage('Account connected! Your account is under review by GoCardless.');

        // Redirect back to payment options
        setTimeout(() => {
          router.replace('/payment-options');
        }, 3000);
      } else if (verification === 'successful') {
        setStatus('success');
        setMessage('GoCardless account connected successfully! You can now accept payments.');

        // Redirect back to payment options
        setTimeout(() => {
          router.replace('/payment-options');
        }, 3000);
      } else {
        // Unknown status
        setStatus('success');
        setMessage('Account connected. Please check your verification status.');

        setTimeout(() => {
          router.replace('/payment-options');
        }, 3000);
      }

    } catch (error) {
      console.error('[GoCardless] Callback error:', error);
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Failed to connect GoCardless account');

      // Show alert and redirect back
      setTimeout(() => {
        Alert.alert(
          'Connection Failed',
          'Failed to connect your GoCardless account. Please try again.',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/payment-options'),
            },
          ]
        );
      }, 1000);
    }
  };

  const getIcon = () => {
    switch (status) {
      case 'success':
        return <CheckCircle size={64} color="#22C55E" />;
      case 'error':
        return <XCircle size={64} color="#EF4444" />;
      case 'needs_verification':
        return <AlertTriangle size={64} color="#F59E0B" />;
      default:
        return null;
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    iconContainer: {
      marginBottom: 24,
    },
    message: {
      fontSize: 18,
      color: theme.foreground,
      textAlign: 'center',
      marginBottom: 16,
      lineHeight: 24,
    },
    statusText: {
      fontSize: 14,
      color: theme.mutedForeground,
      textAlign: 'center',
      marginTop: 8,
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
          <View style={styles.iconContainer}>
            {getIcon()}
          </View>
          <Text style={styles.message}>{message}</Text>
          {verificationStatus && (
            <Text style={styles.statusText}>
              Verification status: {verificationStatus.replace('_', ' ')}
            </Text>
          )}
        </>
      )}
    </View>
  );
}
