import { useEffect, useRef } from 'react';
import { View, Text } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { InteractionManager } from 'react-native';
import { supabase } from '@/config/supabase';

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

        // Close any open modals and wait for animations
        router.dismissAll?.();
        await new Promise(res => InteractionManager.runAfterInteractions(res));

        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id;
        if (!userId) {
          router.replace('/(auth)/onboarding-1');
          return;
        }
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('onboarding_completed')
          .eq('id', userId)
          .maybeSingle();
        if (profile?.onboarding_completed) {
          router.replace('/(app)/(protected)');
        } else {
          router.replace('/(auth)/onboarding-1');
        }
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
