import * as Random from 'expo-random';
import * as Crypto from 'expo-crypto';
import { decode as atob } from 'base-64';

// Secure, cryptographically-strong nonce generator (URL-safe charset)
export async function generateNonce(length: number = 32): Promise<string> {
  const bytes = await Random.getRandomBytesAsync(length);
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._';
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += charset[bytes[i] % charset.length];
  }
  return out;
}

// Vetted SHA-256 using expo-crypto, hex lowercase
export async function sha256Hex(input: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
}

export function decodeJwtPayload(jwt: string): any | null {
  try {
    const parts = jwt.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4 ? '===='.slice(base64.length % 4) : '';
    const json = atob(base64 + pad);
    return JSON.parse(json);
  } catch {
    return null;
  }
}
