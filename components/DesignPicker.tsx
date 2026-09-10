// Design and colour in one place: tiles on top, the selected design's swatches
// underneath, and an explicit "use for all new invoices" switch.
//
// Before this the two lived on separate tabs, so a colour was chosen blind to
// the design and the tiles never showed it. Now the selected tile recolours as
// the swatch changes, and the swatches on offer are the ones that design was
// drawn for, plus the business's own brand colour when the logo has one.
import React from 'react';
import { View, Text, Switch, StyleSheet, useColorScheme } from 'react-native';

import { InvoiceDesignSelector } from '@/components/InvoiceDesignSelector';
import { ColorSelector } from '@/components/ColorSelector';
import { colors } from '@/constants/colors';
import type { InvoiceDesign } from '@/constants/invoiceDesigns';

interface DesignPickerProps {
  designs: InvoiceDesign[];
  selectedDesign: InvoiceDesign;
  onDesignSelect: (designId: string) => void;
  accentColor: string;
  onAccentSelect: (color: string) => void;
  brandColor?: string | null;
  isLoading?: boolean;
  /** Hidden in settings mode, where the choice is the default by definition. */
  showDefaultToggle?: boolean;
  applyAsDefault?: boolean;
  onApplyAsDefaultChange?: (value: boolean) => void;
}

export const DesignPicker: React.FC<DesignPickerProps> = ({
  designs,
  selectedDesign,
  onDesignSelect,
  accentColor,
  onAccentSelect,
  brandColor,
  isLoading,
  showDefaultToggle = true,
  applyAsDefault = true,
  onApplyAsDefaultChange,
}) => {
  const scheme = useColorScheme();
  const themeColors = colors[scheme || 'light'];

  return (
    <View style={styles.container}>
      <InvoiceDesignSelector
        designs={designs}
        selectedDesignId={selectedDesign.id}
        onDesignSelect={onDesignSelect}
        isLoading={isLoading}
        accentColor={accentColor}
      />
      <View style={styles.swatches}>
        <ColorSelector
          compact
          selectedColor={accentColor}
          onColorSelect={onAccentSelect}
          brandColor={brandColor}
          options={selectedDesign.swatches.map((s) => ({ id: s.name.toLowerCase(), name: s.name, color: s.color }))}
        />
      </View>
      {showDefaultToggle && (
        <View style={styles.toggleRow}>
          <Text style={[styles.toggleLabel, { color: themeColors.foreground }]}>Use for all new invoices</Text>
          <Switch
            value={applyAsDefault}
            onValueChange={onApplyAsDefaultChange}
            trackColor={{ true: accentColor, false: '#d1d5db' }}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: 'white' },
  swatches: { paddingTop: 2, paddingBottom: 6 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
  },
  toggleLabel: { fontSize: 14, fontWeight: '500' },
});
