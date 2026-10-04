import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Router } from 'expo-router';
import { supabase } from '@/config/supabase';

type Stopper = { stop: () => void };

async function logAuth(event: string, extra?: Record<string, any>) {
  try {
    const key = '__AUTH_LOG__';
    const now = new Date().toISOString();
    const entry = { ts: now, event, ...(extra || {}) };
    const raw = (await AsyncStorage.getItem(key)) || '[]';
    const arr = JSON.parse(raw);
    arr.push(entry);
    // keep last 200 entries
    while (arr.length > 200) arr.shift();
    await AsyncStorage.setItem(key, JSON.stringify(arr));
  } catch {}
}

export function startAuthWatchdog(opts: {
  tag: string;
  router: Router;
  loadingSetter?: (v: boolean) => void;
  timeoutMs?: number;
}): Stopper {
  const { tag, router, loadingSetter } = opts;
  const timeoutMs = opts.timeoutMs ?? 10000; // 10s hard stop (silent)
  let stopped = false;
  let interval: any;
  let timeout: any;

  logAuth('watchdog.start', { tag, timeoutMs }).catch(() => {});

  const check = async () => {
    if (stopped) return;
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user?.id) {
        logAuth('watchdog.session_detected', { tag }).catch(() => {});
        if (loadingSetter) try { loadingSetter(false); } catch {}
        try { router.replace('/(app)/(protected)'); } catch {}
        stop();
      }
    } catch {}
  };

  interval = setInterval(check, 800);
  // Also check on resume
  const sub = AppState.addEventListener('change', (s) => {
    if (s === 'active') check();
  });

  timeout = setTimeout(async () => {
    if (stopped) return;
    logAuth('watchdog.timeout', { tag }).catch(() => {});
    // final check; only route if session exists
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user?.id) {
        if (loadingSetter) try { loadingSetter(false); } catch {}
        try { router.replace('/(app)/(protected)'); } catch {}
      } else {
        if (loadingSetter) try { loadingSetter(false); } catch {}
      }
    } catch {
      if (loadingSetter) try { loadingSetter(false); } catch {}
    }
    stop();
  }, timeoutMs);

  function stop() {
    if (stopped) return;
    stopped = true;
    try { clearInterval(interval); } catch {}
    try { clearTimeout(timeout); } catch {}
    try { sub.remove(); } catch {}
    logAuth('watchdog.stop', { tag }).catch(() => {});
  }

  return { stop };
}
