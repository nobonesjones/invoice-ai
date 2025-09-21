import React, { useMemo } from 'react';
import { View, Text, Button, Platform, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '@/context/theme-provider';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { ChevronLeft } from 'lucide-react-native';

export default function AnalyticsDebugScreen() {
  const { theme } = useTheme();
  const analytics = useAnalytics();
  const router = useRouter();
  const { setIsTabBarVisible } = useTabBarVisibility();

  useFocusEffect(
    React.useCallback(() => {
      setIsTabBarVisible(false);
      return () => {};
    }, [setIsTabBarVisible])
  );

  const tokenInfo = useMemo(() => {
    const token = process.env.EXPO_PUBLIC_MIXPANEL_TOKEN || '';
    const masked = token ? `${token.slice(0, 6)}...${token.slice(-4)}` : 'NONE';
    return { present: !!token, masked };
  }, []);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      <Stack.Screen 
        options={{ 
          headerShown: true, 
          title: 'Analytics Debug',
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.foreground,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: Platform.OS === 'ios' ? 16 : 0 }}>
              <ChevronLeft size={24} color={theme.foreground} />
            </TouchableOpacity>
          )
        }} 
      />
      <View style={[styles.container, { backgroundColor: theme.background }]}> 
        <Text style={[styles.title, { color: theme.foreground }]}>Analytics Debug</Text>
        <Text style={[styles.sub, { color: theme.mutedForeground }]}>Quick checks for Mixpanel connectivity</Text>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}> 
          <Text style={[styles.label, { color: theme.mutedForeground }]}>Token present</Text>
          <Text style={[styles.value, { color: theme.foreground }]}>{String(tokenInfo.present)}</Text>
          <Text style={[styles.label, { color: theme.mutedForeground, marginTop: 12 }]}>Token (masked)</Text>
          <Text style={[styles.value, { color: theme.foreground }]}>{tokenInfo.masked}</Text>
          <Text style={[styles.label, { color: theme.mutedForeground, marginTop: 12 }]}>Region</Text>
          <Text style={[styles.value, { color: theme.foreground }]}>EU (api-eu.mixpanel.com)</Text>
          <Text style={[styles.label, { color: theme.mutedForeground, marginTop: 12 }]}>Platform</Text>
          <Text style={[styles.value, { color: theme.foreground }]}>{Platform.OS}</Text>
        </View>

        <View style={styles.actions}>
          <View style={styles.buttonWrapper}>
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
          </View>
          <View style={styles.buttonWrapper}>
            <Button title="Run Emergency Debug Test" onPress={() => analytics.emergencyDebugTest()} />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  sub: { fontSize: 14, marginBottom: 16 },
  card: { borderRadius: 12, padding: 16, borderWidth: 1 },
  label: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.3 },
  value: { fontSize: 16, fontWeight: '600' },
  actions: { marginTop: 16 },
  buttonWrapper: { marginTop: 8 },
});
