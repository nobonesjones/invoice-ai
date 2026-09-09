// PDF and logo helpers for the invoice document. The PDF is the document printed
// at A4 by WebKit; the document paginates itself, so native margins are zero.
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import { renderInvoiceHtml, type InvoiceDocument } from '@/supabase/functions/_shared/invoice-doc/render';

export const A4_PRINT = { width: 595, height: 842, margins: { top: 0, bottom: 0, left: 0, right: 0 } } as const;

/** Print and preview must not depend on the network, so the logo travels as a data URI. */
export async function fetchLogoDataUri(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  try {
    const ext = (url.split('?')[0].split('.').pop() || 'png').toLowerCase();
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : ext === 'webp' ? 'image/webp' : 'image/png';
    const target = `${FileSystem.cacheDirectory}invoice-doc-logo-${hash(url)}.${ext}`;
    const info = await FileSystem.getInfoAsync(target);
    if (!info.exists) {
      const res = await FileSystem.downloadAsync(url, target);
      if (res.status !== 200) return null;
    }
    const b64 = await FileSystem.readAsStringAsync(target, { encoding: FileSystem.EncodingType.Base64 });
    return `data:${mime};base64,${b64}`;
  } catch {
    return null;
  }
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

export async function renderInvoicePdf(doc: InvoiceDocument): Promise<{ uri: string }> {
  const html = renderInvoiceHtml(doc, { mode: 'print' });
  const { uri } = await Print.printToFileAsync({ html, ...A4_PRINT });
  return { uri };
}

export async function renderInvoicePdfBase64(doc: InvoiceDocument): Promise<{ uri: string; base64: string }> {
  const { uri } = await renderInvoicePdf(doc);
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  return { uri, base64 };
}

/** Copies the PDF to a stable, nicely named file for the share sheet. */
export async function renderInvoicePdfNamed(doc: InvoiceDocument, fileName: string): Promise<{ uri: string }> {
  const { uri } = await renderInvoicePdf(doc);
  const target = `${FileSystem.documentDirectory}${fileName}`;
  await FileSystem.deleteAsync(target, { idempotent: true });
  await FileSystem.moveAsync({ from: uri, to: target });
  return { uri: target };
}

/** Opens the iOS print sheet with the document at A4. */
export async function printInvoice(doc: InvoiceDocument): Promise<void> {
  const html = renderInvoiceHtml(doc, { mode: 'print' });
  await Print.printAsync({ html, ...A4_PRINT });
}
