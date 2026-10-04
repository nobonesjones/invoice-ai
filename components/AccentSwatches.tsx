// A row of colour dots: brand first when the logo has one, then the design's
// curated six, then a "+" for custom. The chosen dot wears a ring in its own
// colour. Custom is not handled here; the parent opens the precise panel and
// tells this row whether it is open so the "+" can show as selected.
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Check, Plus } from 'lucide-react-native';

import { useTheme } from '@/context/theme-provider';
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
  customOpen: boolean;
  onToggleCustom: () => void;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export const AccentSwatches: React.FC<Props> = ({ swatches, brandColor, selected, onSelect, customOpen, onToggleCustom }) => {
  const { isLightMode } = useTheme();
  const theme = isLightMode ? colors.light : colors.dark;

  const all = useMemo<Swatch[]>(
    () => [...(brandColor ? [{ name: 'Your brand', color: brandColor }] : []), ...swatches],
    [swatches, brandColor],
  );
  const isPreset = all.some((s) => same(s.color, selected));
  const selectedName = all.find((s) => same(s.color, selected))?.name ?? 'Custom';

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {all.map((s) => {
        const on = same(s.color, selected) && !customOpen;
        return (
          <TouchableOpacity
            key={s.name + s.color}
            onPress={() => onSelect(s.color)}
            activeOpacity={0.8}
            accessibilityLabel={s.name}
            style={[styles.ring, on && { borderColor: s.color }]}
          >
            <View style={[styles.dot, { backgroundColor: s.color }]}>{on && <Check size={15} color="#fff" strokeWidth={3} />}</View>
          </TouchableOpacity>
        );
      })}
      <TouchableOpacity
        onPress={onToggleCustom}
        activeOpacity={0.8}
        accessibilityLabel="Custom colour"
        style={[styles.ring, (customOpen || !isPreset) && { borderColor: selected }]}
      >
        <View style={[styles.dot, !isPreset || customOpen ? { backgroundColor: selected } : { backgroundColor: theme.muted, borderWidth: 1, borderColor: theme.border }]}>
          {!isPreset || customOpen ? <Check size={15} color="#fff" strokeWidth={3} /> : <Plus size={16} color={theme.mutedForeground} strokeWidth={2.5} />}
        </View>
      </TouchableOpacity>
      <Text style={[styles.caption, { color: theme.mutedForeground }]}>{customOpen ? 'Custom' : selectedName}</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 4, gap: 6 },
  ring: { width: 40, height: 40, borderRadius: 20, borderWidth: 2.5, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  dot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  caption: { fontSize: 12, fontWeight: '500', marginLeft: 6 },
});
