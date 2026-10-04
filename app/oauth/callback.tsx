import { useEffect, useRef } from 'react';
import { View, Text } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/config/supabase';
import { waitForSupabaseSession } from '@/utils/wait-for-session';

export default function OAuthCallback() {
  const router = useRouter();
  const doneRef = useRef(false);
  const params = useLocalSearchParams<Record<string, string | string[]>>();

  useEffect(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    (async () => {
      try {
        // Try to parse from both search params and hash fragment patterns
        const code = (params.code as string) || undefined;
        const access_token = (params.access_token as string) || undefined;
        const refresh_token = (params.refresh_token as string) || undefined;

        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
        } else if (code) {
          await supabase.auth.exchangeCodeForSession({ authCode: code });
        }

        // Immediately route like email flow; but ensure session is actually ready
        try { router.dismissAll?.(); } catch {}
        try { await waitForSupabaseSession(8000); } catch {}
        router.replace('/(app)/(protected)');
        return;
      } catch {
        router.replace('/(auth)/onboarding-1');
      }
    })();
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Finishing sign-in…</Text>
    </View>
  );
}
