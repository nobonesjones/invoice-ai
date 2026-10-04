import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/context/theme-provider';
import { CheckCircle, XCircle, Clock } from 'lucide-react-native';
import { Button } from '@/components/ui/button';

export default function PaymentComplete() {
  const router = useRouter();
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ invoice_id?: string }>();

  const [status, setStatus] = useState<'loading' | 'paid' | 'pending' | 'failed'>('loading');
  const [message, setMessage] = useState('Checking payment status...');

  useEffect(() => {
    checkPaymentStatus();
  }, []);

  const checkPaymentStatus = async () => {
    if (!params.invoice_id) {
      setStatus('failed');
      setMessage('Invalid payment request');
      return;
    }

    try {
      const response = await fetch(
        'https://wzpuzqzsjdizmpiobsuo.supabase.co/functions/v1/gocardless-check-payment',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.EXPO_PUBLIC_ANON_KEY!,
          },
          body: JSON.stringify({
            invoice_id: params.invoice_id,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check payment status');
      }

      if (data.status === 'paid') {
        setStatus('paid');
        setMessage('Payment successful! Thank you for your payment.');
      } else if (data.status === 'pending') {
        setStatus('pending');
        setMessage('Payment is being processed. You will receive a confirmation once complete.');
      } else {
        setStatus('failed');
        setMessage('Payment not completed. Please try again or contact support.');
      }
    } catch (err) {
      console.error('[GoCardless] Payment status check error:', err);
      setStatus('failed');
      setMessage(err instanceof Error ? err.message : 'Failed to check payment status');
    }
  };

  const getIcon = () => {
    switch (status) {
      case 'paid':
        return <CheckCircle size={64} color="#22C55E" />;
      case 'pending':
        return <Clock size={64} color="#F59E0B" />;
      case 'failed':
        return <XCircle size={64} color="#EF4444" />;
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
    button: {
      marginTop: 24,
      minWidth: 200,
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

          {status === 'paid' || status === 'failed' ? (
            <Button
              variant="default"
              onPress={() => router.back()}
              style={styles.button}
            >
              <Text>Close</Text>
            </Button>
          ) : null}

          {status === 'pending' && (
            <Button
              variant="outline"
              onPress={checkPaymentStatus}
              style={styles.button}
            >
              <Text>Check Again</Text>
            </Button>
          )}
        </>
      )}
    </View>
  );
}
