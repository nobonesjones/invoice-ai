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
              {/* Thumbnail placeholder - will be replaced with actual thumbnails */}
              <View 
                style={[
                  styles.thumbnail,
                  { backgroundColor: design.colorScheme.background }
                ]}
              >
                {/* Placeholder design preview */}
                <View style={styles.thumbnailContent}>
                  <View 
                    style={[
                      styles.thumbnailHeader,
                      { backgroundColor: design.colorScheme.primary }
                    ]} 
                  />
                  <View style={styles.thumbnailBody}>
                    <View 
                      style={[
                        styles.thumbnailLine,
                        { backgroundColor: design.colorScheme.text }
                      ]} 
                    />
                    <View 
                      style={[
                        styles.thumbnailLine,
                        styles.thumbnailLineShort,
                        { backgroundColor: design.colorScheme.mutedText }
                      ]} 
                    />
                    <View 
                      style={[
                        styles.thumbnailLine,
                        styles.thumbnailLineShort,
                        { backgroundColor: design.colorScheme.mutedText }
                      ]} 
                    />
                  </View>
                  <View 
                    style={[
                      styles.thumbnailFooter,
                      { backgroundColor: design.colorScheme.accent }
                    ]} 
                  />
                </View>
              </View>
              
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