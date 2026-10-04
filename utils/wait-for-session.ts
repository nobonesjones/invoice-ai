import { supabase } from '@/config/supabase';

export async function waitForSupabaseSession(timeoutMs = 15000): Promise<boolean> {
  const start = Date.now();
  // Fast path
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.user?.id) return true;
  } catch {}

  return new Promise<boolean>((resolve) => {
    let done = false;
    const finish = (ok: boolean) => { if (!done) { done = true; resolve(ok); } };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id) {
        try { sub.subscription.unsubscribe(); } catch {}
        finish(true);
      }
    });

    const poll = setInterval(async () => {
      if (Date.now() - start > timeoutMs) {
        clearInterval(poll);
        try { sub.subscription.unsubscribe(); } catch {}
        finish(false);
        return;
      }
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user?.id) {
          clearInterval(poll);
          try { sub.subscription.unsubscribe(); } catch {}
          finish(true);
        }
      } catch {}
    }, 300);
  });
}

