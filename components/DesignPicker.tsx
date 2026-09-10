// Design and colour in one place: tiles on top, the selected design's swatches
// underneath. Compact by default so more of the invoice shows; tapping "+" on
// the swatch row unfolds the precise colour panel and the "use for all new
// invoices" switch, and tells the parent so the sheet can rise to fit.
import React, { useEffect, useState } from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';

import { InvoiceDesignSelector } from '@/components/InvoiceDesignSelector';
import { AccentSwatches } from '@/components/AccentSwatches';
import { CustomColorPanel } from '@/components/CustomColorPanel';
import { useTheme } from '@/context/theme-provider';
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
  /** Fired when the custom panel opens or closes, so the sheet can grow. */
  onExpandedChange?: (expanded: boolean) => void;
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
  onExpandedChange,
}) => {
  const { isLightMode } = useTheme();
  const themeColors = isLightMode ? colors.light : colors.dark;
  const [customOpen, setCustomOpen] = useState(false);

  useEffect(() => {
    onExpandedChange?.(customOpen);
  }, [customOpen, onExpandedChange]);

  return (
    <View style={{ backgroundColor: themeColors.card }}>
      <InvoiceDesignSelector
        designs={designs}
        selectedDesignId={selectedDesign.id}
        onDesignSelect={(id) => {
          setCustomOpen(false);
          onDesignSelect(id);
        }}
        isLoading={isLoading}
        accentColor={accentColor}
      />
      <AccentSwatches
        swatches={selectedDesign.swatches}
        brandColor={brandColor}
        selected={accentColor}
        onSelect={(hex) => {
          setCustomOpen(false);
          onAccentSelect(hex);
        }}
        customOpen={customOpen}
        onToggleCustom={() => setCustomOpen((v) => !v)}
      />
      {customOpen && (
        <>
          <CustomColorPanel value={accentColor} onChange={onAccentSelect} />
          {showDefaultToggle && (
            <View style={[styles.toggleRow, { borderTopColor: themeColors.border }]}>
              <Text style={[styles.toggleLabel, { color: themeColors.foreground }]}>Use for all new invoices</Text>
              <Switch
                value={applyAsDefault}
                onValueChange={onApplyAsDefaultChange}
                trackColor={{ true: accentColor, false: themeColors.border }}
              />
            </View>
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  toggleLabel: { fontSize: 14, fontWeight: '500' },
});
