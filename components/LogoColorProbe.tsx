// A 1x1 hidden WebView that samples the dominant colour of a logo.
//
// Mount it once, anywhere under the signed-in tree. useLogoBrandColor hands it a
// data URI; it decodes the image on a canvas, ignores transparent, near-white,
// near-black and washed-out pixels, buckets what is left by hue, and returns the
// average colour of the strongest bucket nudged into a range that prints well.
//
// Falls back to null (no brand swatch) for logos with no usable colour, and
// silently does nothing when the WebView module is not in this build.
import React, { useEffect, useState } from 'react';
import { View, UIManager } from 'react-native';
import { registerLogoProbe, resolveLogoColor } from '@/hooks/useLogoBrandColor';

let WebViewComponent: React.ComponentType<any> | null = null;
try {
  WebViewComponent = require('react-native-webview').WebView;
} catch {
  WebViewComponent = null;
}
const hasNativeWebView = !!WebViewComponent && !!UIManager.getViewManagerConfig?.('RNCWebView');

const PROBE_JS = `
(function () {
  function post(hex) { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ hex: hex })); }
  function toHex(r, g, b) { return '#' + [r, g, b].map(function (v) { return Math.round(v).toString(16).padStart(2, '0'); }).join(''); }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return [h, s, l];
  }
  function hslToRgb(h, s, l) {
    function f(p, q, t) { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1/6) return p + (q - p) * 6 * t; if (t < 1/2) return q; if (t < 2/3) return p + (q - p) * (2/3 - t) * 6; return p; }
    if (s === 0) return [l * 255, l * 255, l * 255];
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    return [f(p, q, h + 1/3) * 255, f(p, q, h) * 255, f(p, q, h - 1/3) * 255];
  }
  var img = new Image();
  img.onload = function () {
    try {
      var N = 72;
      var c = document.createElement('canvas'); c.width = N; c.height = N;
      var ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, N, N);
      var data = ctx.getImageData(0, 0, N, N).data;
      var bins = [];
      for (var i = 0; i < 24; i++) bins.push({ w: 0, r: 0, g: 0, b: 0 });
      for (var p = 0; p < data.length; p += 4) {
        var a = data[p + 3]; if (a < 128) continue;
        var r = data[p], g = data[p + 1], b = data[p + 2];
        var hsl = rgbToHsl(r, g, b);
        if (hsl[1] < 0.28 || hsl[2] < 0.12 || hsl[2] > 0.9) continue;
        var w = hsl[1] * (1 - Math.abs(hsl[2] - 0.5));
        var bin = bins[Math.min(23, Math.floor(hsl[0] * 24))];
        bin.w += w; bin.r += r * w; bin.g += g * w; bin.b += b * w;
      }
      var best = null;
      for (var k = 0; k < bins.length; k++) if (!best || bins[k].w > best.w) best = bins[k];
      if (!best || best.w < 4) { post(null); return; }
      var hsl2 = rgbToHsl(best.r / best.w, best.g / best.w, best.b / best.w);
      // Nudge into a range that reads as ink on white and carries white text.
      var l = Math.min(0.52, Math.max(0.3, hsl2[2]));
      var s = Math.max(0.45, hsl2[1]);
      var rgb = hslToRgb(hsl2[0], s, l);
      post(toHex(rgb[0], rgb[1], rgb[2]));
    } catch (e) { post(null); }
  };
  img.onerror = function () { post(null); };
  img.src = window.__LOGO__;
})();
true;
`;

export const LogoColorProbe: React.FC = () => {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    registerLogoProbe(setUri);
    return () => registerLogoProbe(null);
  }, []);

  if (!uri || !WebViewComponent || !hasNativeWebView) return null;
  const WebView = WebViewComponent;
  const html = `<!doctype html><html><body><script>window.__LOGO__=${JSON.stringify(uri)};</script></body></html>`;

  return (
    <View style={{ position: 'absolute', width: 1, height: 1, opacity: 0, left: -10, top: -10 }} pointerEvents="none">
      <WebView
        key={uri}
        source={{ html }}
        originWhitelist={['*']}
        injectedJavaScript={PROBE_JS}
        javaScriptEnabled
        onMessage={(e: any) => {
          try {
            const { hex } = JSON.parse(e.nativeEvent.data);
            resolveLogoColor(uri, typeof hex === 'string' ? hex : null);
          } catch {
            resolveLogoColor(uri, null);
          }
        }}
        onError={() => resolveLogoColor(uri, null)}
        style={{ width: 1, height: 1 }}
      />
    </View>
  );
};
