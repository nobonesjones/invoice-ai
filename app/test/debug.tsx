import React from 'react';
import { ScrollView, View, Text, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function DebugScreen() {
  const [logs, setLogs] = React.useState<{ ts: string; level: string; msg: string }[]>([]);
  const [env, setEnv] = React.useState<Record<string, string | undefined>>({});
  const [lastCrash, setLastCrash] = React.useState<{ ts: string; isFatal: boolean; message: string; stack?: string; recentLogs?: any[] } | null>(null);

  const refresh = React.useCallback(() => {
    try {
      // @ts-ignore
      const items = global.__LOG_BUFFER__?.read?.() ?? [];
      setLogs(items);
    } catch {}
    setEnv({
      EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
      EXPO_PUBLIC_ANON_KEY: process.env.EXPO_PUBLIC_ANON_KEY ? 'set' : 'missing',
      EXPO_PUBLIC_ENABLE_PROMISE_HARDENING: process.env.EXPO_PUBLIC_ENABLE_PROMISE_HARDENING,
    });
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('__LAST_CRASH__');
        setLastCrash(raw ? JSON.parse(raw) : null);
      } catch {}
    })();
  }, []);

  React.useEffect(() => {
    refresh();
    const t = setInterval(refresh, 1500);
    return () => clearInterval(t);
  }, [refresh]);

  const clear = () => {
    try {
      // @ts-ignore
      global.__LOG_BUFFER__?.clear?.();
    } catch {}
    refresh();
  };

  const clearCrash = async () => {
    try { await AsyncStorage.removeItem('__LAST_CRASH__'); } catch {}
    setLastCrash(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0b0b0b' }}>
      <View style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#333' }}>
        <Text style={{ color: 'white', fontSize: 18, fontWeight: '600' }}>Debug</Text>
        <Text style={{ color: '#bbb', marginTop: 6 }}>Env</Text>
        {Object.entries(env).map(([k, v]) => (
          <Text key={k} style={{ color: '#9acd32' }}>{k}: {String(v)}</Text>
        ))}
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
          <TouchableOpacity onPress={refresh} style={{ padding: 8, backgroundColor: '#1e90ff', borderRadius: 6 }}>
            <Text style={{ color: 'white' }}>Refresh</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={clear} style={{ padding: 8, backgroundColor: '#ff6347', borderRadius: 6 }}>
            <Text style={{ color: 'white' }}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
        {lastCrash && (
          <View style={{ marginBottom: 12, borderWidth: 1, borderColor: '#444', borderRadius: 8, padding: 10 }}>
            <Text style={{ color: '#ff6b6b', fontWeight: '700' }}>Last Crash</Text>
            <Text style={{ color: '#bbb' }}>{lastCrash.ts} fatal={String(lastCrash.isFatal)}</Text>
            <Text style={{ color: '#ff9f43', marginTop: 4 }}>{lastCrash.message}</Text>
            {!!lastCrash.stack && <Text style={{ color: '#999', marginTop: 4 }}>{lastCrash.stack.split('\n').slice(0,5).join('\n')}</Text>}
            <TouchableOpacity onPress={clearCrash} style={{ marginTop: 8, padding: 6, backgroundColor: '#555', borderRadius: 6, alignSelf: 'flex-start' }}>
              <Text style={{ color: 'white' }}>Clear crash</Text>
            </TouchableOpacity>
          </View>
        )}
        {logs.length === 0 ? (
          <Text style={{ color: '#888' }}>No logs yet…</Text>
        ) : (
          logs.slice().reverse().map((l, i) => (
            <Text key={i} style={{ color: l.level === 'error' ? '#ff6b6b' : l.level === 'warn' ? '#ffd166' : '#e0e0e0', marginBottom: 4 }}>
              {l.ts} [{l.level}] {l.msg}
            </Text>
          ))
        )}
      </ScrollView>
    </View>
  );
}
