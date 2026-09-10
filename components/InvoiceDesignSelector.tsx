import React from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  StyleSheet, 
  Image,
  Platform 
} from 'react-native';
import { InvoiceDesign } from '@/constants/invoiceDesigns';
import { colors } from '@/constants/colors';
import { useColorScheme } from 'react-native';

interface InvoiceDesignSelectorProps {
  designs: InvoiceDesign[];
  selectedDesignId: string;
  onDesignSelect: (designId: string) => void;
  isLoading?: boolean;
}

/**
 * A miniature of each layout, drawn with Views so it needs no image assets and
 * stays in step with the renderer's seven layouts. The point is that the seven
 * tiles look as different from each other as the documents do; a shared
 * "band + lines" placeholder made every design read as the same invoice.
 */
const DesignThumbnail: React.FC<{ design: InvoiceDesign }> = ({ design }) => {
  const p = design.colorScheme.primary;
  const a = design.colorScheme.accent;
  const ink = '#111827';
  const grey = '#9CA3AF';
  const line = (w: string | number, c = grey, h = 3) => (
    <View style={{ width: w as any, height: h, borderRadius: 1, backgroundColor: c }} />
  );
  const rule = (c = ink, h = 1) => <View style={{ height: h, backgroundColor: c, alignSelf: 'stretch' }} />;
  const rows = (
    <View style={{ gap: 4, marginTop: 8 }}>
      {line('100%', ink)}
      {line('70%')}
      {line('85%')}
    </View>
  );
  const totalPill = (c: string, rounded = true) => (
    <View style={{ alignSelf: 'flex-end', width: '55%', height: 7, borderRadius: rounded ? 2 : 0, backgroundColor: c, marginTop: 8 }} />
  );

  switch (design.id) {
    case 'clean':
      return (
        <View style={thumbStyles.sheet}>
          <View style={{ height: 24, backgroundColor: p }} />
          <View style={{ padding: 7 }}>
            {rows}
            {totalPill(p)}
          </View>
        </View>
      );
    case 'wave':
      return (
        <View style={thumbStyles.sheet}>
          <View style={{ height: 30, backgroundColor: p, overflow: 'hidden' }}>
            <View style={{ position: 'absolute', left: -20, right: -20, bottom: -14, height: 22, backgroundColor: '#fff', borderTopLeftRadius: 60, borderTopRightRadius: 60, transform: [{ rotate: '-4deg' }] }} />
          </View>
          <View style={{ padding: 7 }}>
            {rows}
            {totalPill(p)}
          </View>
        </View>
      );
    case 'classic':
      return (
        <View style={[thumbStyles.sheet, { padding: 7, alignItems: 'center' }]}>
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: ink }} />
          {line(28, ink, 3)}
          <View style={{ alignSelf: 'stretch', marginTop: 5, gap: 1.5 }}>{rule(p)}{rule(p)}</View>
          <View style={{ alignSelf: 'stretch', marginTop: 7, borderWidth: 1, borderColor: '#94A3B8' }}>
            <View style={{ height: 6, backgroundColor: p }} />
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 2, height: 22, borderRightWidth: 1, borderColor: '#CBD5E1' }} />
              <View style={{ flex: 1, height: 22 }} />
            </View>
          </View>
          {totalPill(p, false)}
        </View>
      );
    case 'modern':
      return (
        <View style={[thumbStyles.sheet, { flexDirection: 'row' }]}>
          <View style={{ width: 24, backgroundColor: p, padding: 4, gap: 4 }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#fff' }} />
            {line('100%', 'rgba(255,255,255,.7)', 2)}
            {line('70%', 'rgba(255,255,255,.7)', 2)}
          </View>
          <View style={{ flex: 1, padding: 6 }}>
            <View style={{ alignSelf: 'flex-end', width: 22, height: 5, backgroundColor: p, borderRadius: 1 }} />
            {rows}
            <View style={{ marginTop: 8 }}>{rule(ink, 1.5)}</View>
          </View>
        </View>
      );
    case 'simple':
      return (
        <View style={[thumbStyles.sheet, { padding: 7 }]}>
          <View style={{ width: 34, height: 6, backgroundColor: ink, opacity: 0.85 }} />
          <View style={{ marginTop: 8 }}>{rule('#D1D5DB')}</View>
          {rows}
          <View style={{ marginTop: 10 }}>{rule(ink, 1.5)}</View>
        </View>
      );
    case 'swiss':
      return (
        <View style={[thumbStyles.sheet, { padding: 7 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <View style={{ width: 6, height: 6, backgroundColor: a }} />
            <View style={{ width: 40, height: 11, backgroundColor: ink }} />
          </View>
          <View style={{ marginTop: 5 }}>{rule(ink, 2.5)}</View>
          {rows}
          <View style={{ marginTop: 10 }}>{rule(ink, 1.5)}</View>
        </View>
      );
    case 'ledger':
    default:
      return (
        <View style={[thumbStyles.sheet, { padding: 7, alignItems: 'center' }]}>
          {rule(ink)}
          <View style={{ width: 9, height: 9, backgroundColor: ink, marginTop: 5 }} />
          {line(26, ink, 2)}
          <View style={{ alignSelf: 'stretch', marginTop: 5, gap: 1.5 }}>{rule(ink)}{rule(ink)}</View>
          <View style={{ alignSelf: 'stretch', marginTop: 7, borderWidth: 1, borderColor: ink }}>
            <View style={{ height: 6, backgroundColor: '#F0FDF4', borderBottomWidth: 1, borderColor: ink }} />
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 2, height: 20, borderRightWidth: 1, borderColor: ink }} />
              <View style={{ flex: 1, height: 20 }} />
            </View>
          </View>
        </View>
      );
  }
};

const thumbStyles = StyleSheet.create({
  sheet: {
    width: 80,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
});

export const InvoiceDesignSelector: React.FC<InvoiceDesignSelectorProps> = ({
  designs,
  selectedDesignId,
  onDesignSelect,
  isLoading = false,
}) => {
  const colorScheme = useColorScheme();
  const themeColors = colors[colorScheme || 'light'];

  const styles = getStyles(themeColors);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={[styles.title, { color: themeColors.foreground }]}>
          Loading designs...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
      >
        {designs.map((design) => {
          const isSelected = design.id === selectedDesignId;
          
          return (
            <TouchableOpacity
              key={design.id}
              style={[
                styles.designItem,
                isSelected && styles.selectedDesignItem,
                { borderColor: isSelected ? design.colorScheme.primary : themeColors.border }
              ]}
              onPress={() => onDesignSelect(design.id)}
              activeOpacity={0.7}
            >
              <DesignThumbnail design={design} />

              {/* Design name */}
              <Text 
                style={[
                  styles.designName,
                  { color: isSelected ? design.colorScheme.primary : themeColors.foreground }
                ]}
              >
                {design.displayName}
              </Text>
              
              {/* Selection indicator */}
              {isSelected && (
                <View 
                  style={[
                    styles.selectionIndicator,
                    { backgroundColor: design.colorScheme.primary }
                  ]}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const getStyles = (themeColors: any) => StyleSheet.create({
  container: {
    paddingTop: 5, // Reduced from 31 to 5 to minimize area above templates
    paddingBottom: 20, // Increased bottom padding to extend area down
    paddingHorizontal: 5, // Reduced from 20 to 5 to minimize space on sides
    backgroundColor: 'white',
    minHeight: 220, // Ensure container has minimum height to fill space
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: -2,
    textAlign: 'left',
  },
  scrollView: {
    flexGrow: 0,
    height: 200, // Increased from 140 to 200 to make templates area bigger
  },
  scrollContent: {
    paddingRight: 10,
  },
  designItem: {
    marginRight: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 12,
    padding: 8,
    backgroundColor: 'transparent', // Remove pink from individual template items
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  selectedDesignItem: {
    borderWidth: 3,
    ...Platform.select({
      ios: {
        shadowOpacity: 0.2,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  thumbnail: {
    width: 80,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  thumbnailContent: {
    flex: 1,
    padding: 6,
  },
  thumbnailHeader: {
    height: 10,
    borderRadius: 2,
    marginBottom: 6,
  },
  thumbnailBody: {
    flex: 1,
    justifyContent: 'center',
    gap: 3,
  },
  thumbnailLine: {
    height: 3,
    borderRadius: 1,
    marginBottom: 3,
  },
  thumbnailLineShort: {
    width: '70%',
  },
  thumbnailFooter: {
    height: 8,
    borderRadius: 2,
    marginTop: 6,
  },
  designName: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  selectionIndicator: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: 'white',
  },
}); 