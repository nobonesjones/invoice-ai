// The app's invoice preview: the shared HTML document in a WebView, shown as pages
// on a grey ground. The PDF is the same HTML printed, so what is on screen is what
// gets sent. Until the dev client is rebuilt with react-native-webview the native
// view does not exist, so this degrades to a notice instead of crashing.
import React, { useMemo } from 'react';
import { View, StyleSheet, UIManager, ActivityIndicator } from 'react-native';
import { Text } from '@/components/ui/text';
import { renderInvoiceHtml, type InvoiceDocument } from '@/supabase/functions/_shared/invoice-doc/render';

let WebViewComponent: React.ComponentType<any> | null = null;
try {
  WebViewComponent = require('react-native-webview').WebView;
} catch {
  WebViewComponent = null;
}
export const hasNativeWebView = !!WebViewComponent && !!UIManager.getViewManagerConfig?.('RNCWebView');

class Boundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function RebuildNotice({ color = '#6b7280' }: { color?: string }) {
  return (
    <View style={styles.notice}>
      <Text style={[styles.noticeTitle, { color }]}>Preview needs an app update</Text>
      <Text style={[styles.noticeBody, { color }]}>
        This build was made before the invoice preview was added. Update the app to see your invoice here. Sending and PDFs
        still work.
      </Text>
    </View>
  );
}

interface Props {
  doc: InvoiceDocument;
  style?: any;
  /** Grey ground behind the pages; defaults to the document's own. */
  background?: string;
}

export function InvoiceDocumentView({ doc, style, background = '#e5e7eb' }: Props) {
  const html = useMemo(() => renderInvoiceHtml(doc, { mode: 'preview' }), [doc]);
  if (!WebViewComponent || !hasNativeWebView) {
    return (
      <View style={[styles.fill, { backgroundColor: background }, style]}>
        <RebuildNotice />
      </View>
    );
  }
  const WebView = WebViewComponent;
  return (
    <Boundary fallback={<RebuildNotice />}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={[styles.fill, { backgroundColor: background }, style]}
        bounces
        showsVerticalScrollIndicator={false}
        setSupportMultipleWindows={false}
        startInLoadingState
        renderLoading={() => (
          <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: background }]}>
            <ActivityIndicator />
          </View>
        )}
      />
    </Boundary>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  notice: { padding: 24, alignItems: 'center', justifyContent: 'center', flex: 1 },
  noticeTitle: { fontSize: 16, fontWeight: '600', marginBottom: 6, textAlign: 'center' },
  noticeBody: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
});

export default InvoiceDocumentView;
