import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';

type Check = {
  name: string;
  run: () => Promise<{ status: string; detail?: string }>; 
};

const timeout = (ms: number) => new Promise((res) => setTimeout(res, ms));

const ConnectivityScreen = () => {
  const [results, setResults] = useState<Record<string, { status: string; detail?: string }>>({});
  const [running, setRunning] = useState(false);

  const checks: Check[] = [
    {
      name: 'Internet 204',
      run: async () => {
        try {
          const controller = new AbortController();
          const t = setTimeout(() => controller.abort(), 6000);
          const r = await fetch('https://www.google.com/generate_204', { signal: controller.signal });
          clearTimeout(t);
          return { status: String(r.status) };
        } catch (e: any) {
          return { status: 'ERR', detail: e?.message || String(e) };
        }
      },
    },
    {
      name: 'Supabase health',
      run: async () => {
        const base = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') || '';
        if (!base) return { status: 'NO_URL' };
        try {
          const controller = new AbortController();
          const t = setTimeout(() => controller.abort(), 6000);
          const r = await fetch(`${base}/auth/v1/health`, { signal: controller.signal });
          clearTimeout(t);
          return { status: String(r.status) };
        } catch (e: any) {
          return { status: 'ERR', detail: e?.message || String(e) };
        }
      },
    },
    {
      name: 'Functions preflight',
      run: async () => {
        const base = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') || '';
        if (!base) return { status: 'NO_URL' };
        try {
          const controller = new AbortController();
          const t = setTimeout(() => controller.abort(), 6000);
          const r = await fetch(`${base}/functions/v1/ai-chat`, { method: 'OPTIONS', signal: controller.signal });
          clearTimeout(t);
          return { status: String(r.status) };
        } catch (e: any) {
          return { status: 'ERR', detail: e?.message || String(e) };
        }
      },
    },
  ];

  const runAll = async () => {
    setRunning(true);
    const out: Record<string, { status: string; detail?: string }> = {};
    for (const c of checks) {
      out[c.name] = { status: '…' };
      setResults({ ...out });
      out[c.name] = await c.run();
      setResults({ ...out });
      await timeout(100);
    }
    setRunning(false);
  };

  useEffect(() => { runAll(); }, []);

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '600', marginBottom: 12 }}>Connectivity Check</Text>
      <Text style={{ marginBottom: 8 }}>API URL: {process.env.EXPO_PUBLIC_API_URL || '(missing)'}</Text>
      {Object.entries(results).map(([k, v]) => (
        <View key={k} style={{ paddingVertical: 10, borderBottomWidth: 1, borderColor: '#eee' }}>
          <Text style={{ fontWeight: '600' }}>{k}</Text>
          <Text>Status: {v.status}</Text>
          {v.detail ? <Text>Detail: {v.detail}</Text> : null}
        </View>
      ))}
      <Pressable onPress={runAll} disabled={running} style={{ marginTop: 16, padding: 12, backgroundColor: '#111', borderRadius: 6, opacity: running ? 0.6 : 1 }}>
        <Text style={{ color: 'white', textAlign: 'center' }}>{running ? 'Running…' : 'Re-run checks'}</Text>
      </Pressable>
    </ScrollView>
  );
};

export default ConnectivityScreen;

