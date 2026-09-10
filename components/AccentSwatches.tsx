// A row of colour dots. Tap one and it is the accent; the chosen dot wears a
// ring in its own colour. "Your brand" leads when the logo has a colour, then
// the design's curated swatches, then a "+" that unfolds two sliders (hue and
// shade) for anything else.
//
// Replaces a 4-column grid of named circles and a 280-cell HSV mosaic with an
// opacity slider. An invoice accent is one solid colour; two sliders and a
// live dot are all that choice needs.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, useColorScheme } from 'react-native';
import Slider from '@react-native-community/slider';
import { Check, Plus } from 'lucide-react-native';
import { colors } from '@/constants/colors';

export interface Swatch {
  name: string;
  color: string;
}

interface Props {
  swatches: Swatch[];
  brandColor?: string | null;
  selected: string;
  onSelect: (hex: string) => void;
}

// ---------- colour maths ----------

function hexToHsl(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h * 360, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const f = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const hh = (h % 360) / 360;
  let r: number, g: number, b: number;
  if (s === 0) r = g = b = l;
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = f(p, q, hh + 1 / 3);
    g = f(p, q, hh);
    b = f(p, q, hh - 1 / 3);
  }
  return '#' + [r, g, b].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// ---------- component ----------

export const AccentSwatches: React.FC<Props> = ({ swatches, brandColor, selected, onSelect }) => {
  const scheme = useColorScheme();
  const theme = colors[scheme || 'light'];

  const all = useMemo<Swatch[]>(
    () => [...(brandColor ? [{ name: 'Your brand', color: brandColor }] : []), ...swatches],
    [swatches, brandColor],
  );
  const isPreset = all.some((s) => same(s.color, selected));

  // Custom panel state. Seeded from the current colour so opening it does not
  // jump; kept open while the selection is not one of the dots.
  const [open, setOpen] = useState(false);
  const seed = hexToHsl(selected) ?? [220, 0.7, 0.45];
  const [hue, setHue] = useState(seed[0]);
  const [shade, setShade] = useState(seed[2]);
  useEffect(() => {
    if (!open) {
      const hsl = hexToHsl(selected);
      if (hsl) {
        setHue(hsl[0]);
        setShade(hsl[2]);
      }
    }
  }, [selected, open]);

  const custom = hslToHex(hue, 0.65, Math.min(0.62, Math.max(0.22, shade)));
  const selectedName = all.find((s) => same(s.color, selected))?.name ?? 'Custom';

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {all.map((s) => {
          const on = same(s.color, selected);
          return (
            <TouchableOpacity
              key={s.name + s.color}
              onPress={() => {
                setOpen(false);
                onSelect(s.color);
              }}
              activeOpacity={0.8}
              accessibilityLabel={s.name}
              style={[styles.ring, on && { borderColor: s.color }]}
            >
              <View style={[styles.dot, { backgroundColor: s.color }]}>{on && <Check size={14} color="#fff" strokeWidth={3} />}</View>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          onPress={() => setOpen((v) => !v)}
          activeOpacity={0.8}
          accessibilityLabel="Custom colour"
          style={[styles.ring, (open || !isPreset) && { borderColor: selected }]}
        >
          <View style={[styles.dot, !isPreset ? { backgroundColor: selected } : { backgroundColor: theme.muted, borderWidth: 1, borderColor: theme.border }]}>
            {!isPreset ? <Check size={14} color="#fff" strokeWidth={3} /> : <Plus size={16} color={theme.mutedForeground} strokeWidth={2.5} />}
          </View>
        </TouchableOpacity>
        <Text style={[styles.caption, { color: theme.mutedForeground }]}>{selectedName}</Text>
      </ScrollView>

      {open && (
        <View style={styles.panel}>
          <View style={[styles.preview, { backgroundColor: custom }]} />
          <View style={{ flex: 1 }}>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={359}
              value={hue}
              onValueChange={(v: number) => {
                setHue(v);
                onSelect(hslToHex(v, 0.65, Math.min(0.62, Math.max(0.22, shade))));
              }}
              minimumTrackTintColor={custom}
              maximumTrackTintColor={theme.border}
              thumbTintColor={custom}
            />
            <Slider
              style={styles.slider}
              minimumValue={0.22}
              maximumValue={0.62}
              value={shade}
              onValueChange={(v: number) => {
                setShade(v);
                onSelect(hslToHex(hue, 0.65, v));
              }}
              minimumTrackTintColor={hslToHex(hue, 0.65, 0.25)}
              maximumTrackTintColor={hslToHex(hue, 0.65, 0.62)}
              thumbTintColor={custom}
            />
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, gap: 8 },
  ring: { width: 38, height: 38, borderRadius: 19, borderWidth: 2.5, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  dot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  caption: { fontSize: 12, fontWeight: '500', marginLeft: 4 },
  panel: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 6 },
  preview: { width: 40, height: 40, borderRadius: 20 },
  slider: { height: 28 },
});
