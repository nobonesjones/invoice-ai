// Invoice preview (test). A throwaway screen to look at the new HTML invoice
// document on a real device before committing to the digital-first rebuild.
//
// "Open preview" shows the document in a WebView the way the real app will.
// That needs react-native-webview in the dev client; until the client is rebuilt
// the button explains that instead of crashing. "A4 pages" goes through the iOS
// print engine, which is exactly the PDF path, and "Share as PDF" writes the file.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Modal, UIManager } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { ChevronLeft, Eye, Share2, X, Printer } from 'lucide-react-native';
import { useSupabase } from '@/context/supabase-provider';
import { useTheme } from '@/context/theme-provider';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { Text } from '@/components/ui/text';
import { renderInvoiceHtml, type ThemeId } from '@/supabase/functions/_shared/invoice-doc/render';
import { buildTestDocument, type BusinessLike, type TestVariant } from '@/lib/invoice-doc/testDocument';

// The JS package is always installed; the native view only exists once the dev
// client has been rebuilt with it. Old architecture, so the view-manager registry
// is the reliable check.
let WebViewComponent: React.ComponentType<any> | null = null;
try {
  WebViewComponent = require('react-native-webview').WebView;
} catch {
  WebViewComponent = null;
}
const hasNativeWebView = !!WebViewComponent && !!UIManager.getViewManagerConfig?.('RNCWebView');

const THEMES: { id: ThemeId; label: string }[] = [
  { id: 'clean', label: 'Clean' },
  { id: 'classic', label: 'Classic' },
  { id: 'modern', label: 'Modern' },
  { id: 'simple', label: 'Simple' },
  { id: 'wave', label: 'Wave' },
];

const VARIANTS: { id: TestVariant; label: string; hint: string }[] = [
  { id: 'short', label: '1 item', hint: 'Paid, no notes' },
  { id: 'typical', label: '6 items', hint: 'Discount, part paid, bank details' },
  { id: 'long', label: '24 items', hint: 'Spills onto page 2' },
];

// A4 in points. Left/right margins are zero so the header cards can run wide;
// the template pads horizontally itself. Top/bottom are native so every page gets them.
const A4 = { width: 595, height: 842, margins: { top: 36, bottom: 36, left: 0, right: 0 } };

async function fetchLogoDataUri(url: string): Promise<string | null> {
  try {
    const ext = (url.split('?')[0].split('.').pop() || 'png').toLowerCase();
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : 'image/png';
    const target = `${FileSystem.cacheDirectory}invoice-doc-test-logo.${ext}`;
    const res = await FileSystem.downloadAsync(url, target);
    if (res.status !== 200) return null;
    const b64 = await FileSystem.readAsStringAsync(target, { encoding: FileSystem.EncodingType.Base64 });
    return `data:${mime};base64,${b64}`;
  } catch {
    return null;
  }
}

class WebViewBoundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function InvoiceDocTestScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { supabase, user } = useSupabase();
  const { setIsTabBarVisible } = useTabBarVisibility();

  const [themeId, setThemeId] = useState<ThemeId>('clean');
  const [variant, setVariant] = useState<TestVariant>('typical');
  const [business, setBusiness] = useState<BusinessLike | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'print' | 'share' | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setIsTabBarVisible(false);
      return () => setIsTabBarVisible(true);
    }, [setIsTabBarVisible]),
  );

  useEffect(() => {
    navigation.setOptions({
      header: () => (
        <SafeAreaView edges={['top']} style={{ backgroundColor: theme.background }}>
          <View style={[styles.headerContainer, { backgroundColor: theme.background }]}>
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, marginLeft: -8 }}>
              <ChevronLeft size={24} color={theme.foreground} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.foreground }]}>Invoice preview (test)</Text>
          </View>
        </SafeAreaView>
      ),
      headerShown: true,
    });
  }, [navigation, router, theme]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!user) return;
        const { data } = await supabase.from('business_settings').select('*').eq('user_id', user.id).maybeSingle();
        if (cancelled) return;
        setBusiness((data as BusinessLike) ?? null);
        const url = (data as { business_logo_url?: string | null } | null)?.business_logo_url;
        if (url) {
          const uri = await fetchLogoDataUri(url);
          if (!cancelled) setLogo(uri);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, user]);

  const doc = useMemo(() => buildTestDocument(variant, themeId, business, logo), [variant, themeId, business, logo]);
  const printHtml = useMemo(() => renderInvoiceHtml(doc, { mode: 'print' }), [doc]);
  const previewHtml = useMemo(() => renderInvoiceHtml(doc, { mode: 'preview' }), [doc]);

  const onPrintSheet = useCallback(async () => {
    setBusy('print');
    try {
      await Print.printAsync({ html: printHtml, ...A4 });
    } catch (e) {
      // Cancelling the print sheet rejects; that is not an error worth showing.
      const msg = e instanceof Error ? e.message : String(e);
      if (!/cancel|did not complete/i.test(msg)) Alert.alert('Preview failed', msg);
    } finally {
      setBusy(null);
    }
  }, [printHtml]);

  const onShare = useCallback(async () => {
    setBusy('share');
    try {
      const { uri } = await Print.printToFileAsync({ html: printHtml, ...A4 });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Invoice PDF (test)' });
    } catch (e) {
      Alert.alert('Share failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }, [printHtml]);

  const chip = (active: boolean) => [
    styles.chip,
    { borderColor: active ? theme.primary : theme.border, backgroundColor: active ? theme.primary : theme.card },
  ];
  const chipText = (active: boolean) => [styles.chipText, { color: active ? theme.primaryForeground : theme.foreground }];

  const rebuildNotice = (
    <View style={[styles.notice, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.noticeTitle, { color: theme.foreground }]}>In-app preview needs a rebuild</Text>
      <Text style={[styles.noticeBody, { color: theme.mutedForeground }]}>
        The WebView module was added to the project but this dev client was built before that. Rebuild the dev client once
        and this button will show the document exactly as the app will. Until then, use "A4 pages" below.
      </Text>
    </View>
  );

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.intro, { color: theme.mutedForeground }]}>
          First look at the new invoice document. One HTML file drives the app preview, the hosted page and the PDF.
          Your real business details, sample client and line items.
        </Text>

        <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>DESIGN</Text>
        <View style={styles.chipRow}>
          {THEMES.map((t) => (
            <TouchableOpacity key={t.id} style={chip(themeId === t.id)} onPress={() => setThemeId(t.id)}>
              <Text style={chipText(themeId === t.id)}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>SAMPLE</Text>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {VARIANTS.map((v, i) => (
            <TouchableOpacity
              key={v.id}
              onPress={() => setVariant(v.id)}
              style={[styles.row, i < VARIANTS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowLabel, { color: theme.foreground }]}>{v.label}</Text>
                <Text style={[styles.rowHint, { color: theme.mutedForeground }]}>{v.hint}</Text>
              </View>
              <View style={[styles.radio, { borderColor: variant === v.id ? theme.primary : theme.border }]}>
                {variant === v.id && <View style={[styles.radioDot, { backgroundColor: theme.primary }]} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={theme.primary} />
        ) : (
          <>
            {hasNativeWebView ? (
              <TouchableOpacity style={[styles.button, { backgroundColor: theme.primary }]} onPress={() => setShowPreview(true)}>
                <Eye size={20} color={theme.primaryForeground} />
                <Text style={[styles.buttonText, { color: theme.primaryForeground }]}>Open preview</Text>
              </TouchableOpacity>
            ) : (
              rebuildNotice
            )}
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary, { borderColor: theme.border, backgroundColor: theme.card }]}
              onPress={onPrintSheet}
              disabled={busy !== null}
            >
              {busy === 'print' ? <ActivityIndicator color={theme.foreground} /> : <Printer size={20} color={theme.foreground} />}
              <Text style={[styles.buttonText, { color: theme.foreground }]}>A4 pages (print sheet)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary, { borderColor: theme.border, backgroundColor: theme.card }]}
              onPress={onShare}
              disabled={busy !== null}
            >
              {busy === 'share' ? <ActivityIndicator color={theme.foreground} /> : <Share2 size={20} color={theme.foreground} />}
              <Text style={[styles.buttonText, { color: theme.foreground }]}>Share as PDF</Text>
            </TouchableOpacity>
            <Text style={[styles.note, { color: theme.mutedForeground }]}>
              Business: {business?.business_name || 'not found, using placeholder'}. Logo: {logo ? 'loaded' : 'none'}.
            </Text>
          </>
        )}
      </ScrollView>

      <Modal visible={showPreview} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setShowPreview(false)}>
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: '#eceff3' }}>
          <View style={[styles.previewBar, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setShowPreview(false)} style={{ padding: 8, marginLeft: -8 }}>
              <X size={24} color={theme.foreground} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.foreground }]}>{doc.document.number}</Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={onShare} style={{ padding: 8, marginRight: -8 }} disabled={busy !== null}>
              {busy === 'share' ? <ActivityIndicator color={theme.foreground} /> : <Share2 size={22} color={theme.foreground} />}
            </TouchableOpacity>
          </View>
          {WebViewComponent && hasNativeWebView ? (
            <WebViewBoundary fallback={rebuildNotice}>
              <WebViewComponent
                originWhitelist={['*']}
                source={{ html: previewHtml }}
                style={{ flex: 1, backgroundColor: '#eceff3' }}
                bounces
                showsVerticalScrollIndicator={false}
                setSupportMultipleWindows={false}
              />
            </WebViewBoundary>
          ) : (
            rebuildNotice
          )}
          <View style={[styles.previewChips, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
            {THEMES.map((t) => (
              <TouchableOpacity key={t.id} style={chip(themeId === t.id)} onPress={() => setThemeId(t.id)}>
                <Text style={chipText(themeId === t.id)}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  headerContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  headerTitle: { fontSize: 18, fontWeight: '600', marginLeft: 8 },
  intro: { fontSize: 14, lineHeight: 20, marginBottom: 20 },
  sectionLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.6, marginBottom: 8, marginLeft: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, borderWidth: 1 },
  chipText: { fontSize: 14, fontWeight: '600' },
  card: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', marginBottom: 24 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  rowLabel: { fontSize: 16, fontWeight: '500' },
  rowHint: { fontSize: 13, marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 12, height: 12, borderRadius: 6 },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, borderRadius: 12, marginBottom: 12 },
  buttonSecondary: { borderWidth: StyleSheet.hairlineWidth },
  buttonText: { fontSize: 16, fontWeight: '600' },
  note: { fontSize: 13, lineHeight: 18, marginTop: 8 },
  notice: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 16, marginBottom: 12 },
  noticeTitle: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  noticeBody: { fontSize: 14, lineHeight: 20 },
  previewBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  previewChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
