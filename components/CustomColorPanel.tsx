// The "get it exactly right" colour panel: a hue slider and a saturation /
// brightness square you drag on, with a live swatch and the hex beside it.
// No native module: the square is two gradients and a PanResponder.
import React, { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, PanResponder, LayoutChangeEvent } from 'react-native';
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '@/context/theme-provider';
import { colors } from '@/constants/colors';

interface Props {
  value: string;
  onChange: (hex: string) => void;
}

// ---------- colour maths (HSV) ----------

function hexToHsv(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max ? d / max : 0, max];
}

export function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return '#' + [r, g, b].map((ch) => Math.round((ch + m) * 255).toString(16).padStart(2, '0')).join('');
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

// ---------- component ----------

export const CustomColorPanel: React.FC<Props> = ({ value, onChange }) => {
  const { isLightMode } = useTheme();
  const theme = isLightMode ? colors.light : colors.dark;

  const seed = hexToHsv(value) ?? [220, 0.7, 0.8];
  const [h, setH] = useState(seed[0]);
  const [s, setS] = useState(seed[1]);
  const [v, setV] = useState(seed[2]);
  const size = useRef({ w: 1, h: 1 });

  const hex = hsvToHex(h, s, v);
  const hueOnly = hsvToHex(h, 1, 1);

  const emit = (nh: number, ns: number, nv: number) => onChange(hsvToHex(nh, ns, nv));

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => pick(e.nativeEvent.locationX, e.nativeEvent.locationY),
        onPanResponderMove: (e) => pick(e.nativeEvent.locationX, e.nativeEvent.locationY),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [h],
  );

  function pick(x: number, y: number) {
    const ns = clamp01(x / size.current.w);
    const nv = clamp01(1 - y / size.current.h);
    setS(ns);
    setV(nv);
    emit(h, ns, nv);
  }

  const onLayout = (e: LayoutChangeEvent) => {
    size.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <View style={[styles.preview, { backgroundColor: hex }]} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.hex, { color: theme.foreground }]}>{hex.toUpperCase()}</Text>
          <Text style={[styles.hint, { color: theme.mutedForeground }]}>Drag on the square, slide for hue</Text>
        </View>
      </View>

      <View style={styles.square} onLayout={onLayout} {...pan.panHandlers}>
        <LinearGradient colors={['#ffffff', hueOnly]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={['rgba(0,0,0,0)', '#000000']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
        <View
          pointerEvents="none"
          style={[
            styles.marker,
            { left: `${s * 100}%` as any, top: `${(1 - v) * 100}%` as any, backgroundColor: hex, borderColor: v > 0.6 && s < 0.5 ? '#111827' : '#ffffff' },
          ]}
        />
      </View>

      <View style={styles.hueRow}>
        <LinearGradient
          colors={['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ff0000']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.hueTrack}
        />
        <Slider
          style={styles.hueSlider}
          minimumValue={0}
          maximumValue={359.99}
          value={h}
          onValueChange={(nh: number) => {
            setH(nh);
            emit(nh, s, v);
          }}
          minimumTrackTintColor="transparent"
          maximumTrackTintColor="transparent"
          thumbTintColor={hueOnly}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, gap: 12 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  preview: { width: 44, height: 44, borderRadius: 22 },
  hex: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  hint: { fontSize: 12, marginTop: 2 },
  square: { height: 150, borderRadius: 12, overflow: 'hidden' },
  marker: { position: 'absolute', width: 22, height: 22, borderRadius: 11, borderWidth: 2.5, marginLeft: -11, marginTop: -11 },
  hueRow: { height: 32, justifyContent: 'center' },
  hueTrack: { position: 'absolute', left: 8, right: 8, height: 10, borderRadius: 5 },
  hueSlider: { height: 32 },
});
