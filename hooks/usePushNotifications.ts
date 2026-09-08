import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { useRouter } from "expo-router";

import { useSupabase } from "@/context/supabase-provider";

// EAS project id: needed by getExpoPushTokenAsync in a development build,
// where it cannot be inferred from the manifest. Read from app.json first so a
// project move only needs to change one place.
const EAS_PROJECT_ID: string | undefined =
  Constants.expoConfig?.extra?.eas?.projectId ??
  (Constants as any).easConfig?.projectId ??
  "d275f575-073b-4bde-8867-4d9b7387cc36";

// Show a notification even when the app is in the foreground. "You've been
// paid" is worth interrupting for, and the alternative is the owner opening
// the app to find out nothing arrived because they were already in it.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type PushData = { type?: string; invoiceId?: string };

/**
 * Registers this device for push and routes a tapped notification to the
 * thing it is about.
 *
 * Mount once, somewhere that is only rendered for a signed-in user. The token
 * is upserted into `push_tokens` keyed on the token itself, so the same device
 * signing in again updates its row rather than adding one. Permission is
 * asked for here if it has not been already (onboarding asks too, but a user
 * who skipped that step should still be able to get paid-notifications).
 */
export function usePushNotifications() {
  const { supabase, user } = useSupabase();
  const router = useRouter();
  const registeredFor = useRef<string | null>(null);

  // --- registration -------------------------------------------------------
  useEffect(() => {
    if (!supabase || !user?.id) return;
    if (registeredFor.current === user.id) return;

    let cancelled = false;

    (async () => {
      try {
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "Default",
            importance: Notifications.AndroidImportance.HIGH,
          });
        }

        const { status: existing } = await Notifications.getPermissionsAsync();
        let status = existing;
        if (existing !== "granted") {
          ({ status } = await Notifications.requestPermissionsAsync());
        }
        if (status !== "granted") {
          console.log("[Push] permission not granted; not registering");
          return;
        }

        const { data: token } = await Notifications.getExpoPushTokenAsync(
          EAS_PROJECT_ID ? { projectId: EAS_PROJECT_ID } : undefined,
        );
        if (cancelled || !token) return;

        const { error } = await supabase.from("push_tokens").upsert(
          {
            user_id: user.id,
            token,
            platform: Platform.OS,
            device_name: Constants.deviceName ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "token" },
        );
        if (error) {
          // A missing table (migration not yet applied) lands here. Not fatal:
          // the app works without push, it just cannot be told about payments.
          console.warn("[Push] could not save token:", error.message);
          return;
        }
        registeredFor.current = user.id;
        console.log("[Push] registered", token.slice(0, 24) + "…");
      } catch (e: any) {
        // Simulators and Expo Go throw here; a device without Google services
        // does too. None of those should surface to the user.
        console.log("[Push] registration skipped:", e?.message ?? e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, user?.id]);

  // --- tap handling -------------------------------------------------------
  useEffect(() => {
    const open = (data: PushData | undefined) => {
      if (data?.type === "invoice_paid" && data.invoiceId) {
        router.push(`/invoices/invoice-viewer?id=${data.invoiceId}` as any);
      }
    };

    // Warm: the app was running (foreground or background) when tapped.
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      open(response.notification.request.content.data as PushData);
    });

    // Cold: the tap launched the app. Only meaningful once there is a user to
    // route for, which is why this hook lives inside the signed-in tree.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) open(response.notification.request.content.data as PushData);
    });

    return () => sub.remove();
  }, [router]);
}
