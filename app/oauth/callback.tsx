import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

// No-op route to gracefully consume the deep link path `superinvoice://oauth/callback`
// We handle tokens via WebBrowser.openAuthSessionAsync callbacks; this prevents
// expo-router from navigating to an auth screen before our handlers run.
export default function OAuthCallbackSwallow() {
  const router = useRouter();
  useEffect(() => {
    // Immediately no-op; optionally navigate to a safe neutral route if needed
    // router.replace('/');
  }, []);
  return <View />;
}

