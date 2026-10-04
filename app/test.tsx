import React, { useMemo } from 'react';
import { View, Text, Button, Platform } from 'react-native';
import { useAnalytics } from '@/hooks/useAnalytics';

export default function TestPage() {
  const analytics = useAnalytics();
  const tokenInfo = useMemo(() => {
    const token = process.env.EXPO_PUBLIC_MIXPANEL_TOKEN || '';
    const masked = token ? `${token.slice(0, 6)}...${token.slice(-4)}` : 'NONE';
    return { present: !!token, masked };
  }, []);

  return (
    <View style={{ padding: 20, backgroundColor: 'white', flex: 1 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
        Test Page Working!
      </Text>
      <Text style={{ fontSize: 16 }}>
        This is a simple test page to verify routing is working correctly.
      </Text>
      <Text style={{ fontSize: 14, marginTop: 20, color: 'gray' }}>
        If you can see this, the Expo Router web routing is functioning.
      </Text>

      <View style={{ marginTop: 30 }}>
        <Text style={{ fontSize: 18, fontWeight: '600' }}>Analytics Debug</Text>
        <Text style={{ marginTop: 8 }}>Token present: {String(tokenInfo.present)}</Text>
        <Text>Token (masked): {tokenInfo.masked}</Text>
        <Button
          title="Send Analytics Test Event"
          onPress={() => {
            analytics.trackEvent('Manual Analytics Test', {
              token_present: tokenInfo.present,
              token_prefix: tokenInfo.masked.slice(0, 10),
              platform: Platform.OS,
              environment: __DEV__ ? 'development' : 'production',
            });
          }}
        />
        <View style={{ height: 12 }} />
        <Button
          title="Run Emergency Debug Test"
          onPress={() => analytics.emergencyDebugTest()}
        />
      </View>
    </View>
  );
}
