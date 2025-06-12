import React, { useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetModalProvider,
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { colors } from '@/constants/colors';
import { useColorScheme } from 'react-native';
import SkiaInvoiceCanvas from '@/components/skia/SkiaInvoiceCanvas';
import { Ionicons } from '@expo/vector-icons';

export interface InvoicePreviewModalRef {
  present: () => void;
  dismiss: () => void;
}

interface InvoicePreviewModalProps {
  invoiceData?: any;
  businessSettings?: any;
  clientData?: any;
  onClose?: () => void;
}

export const InvoicePreviewModal = forwardRef<InvoicePreviewModalRef, InvoicePreviewModalProps>(
  ({ invoiceData, businessSettings, clientData, onClose }, ref) => {
    const colorScheme = useColorScheme();
    const isLightMode = colorScheme === 'light';
    const themeColors = colors[colorScheme || 'light'];
    
    const bottomSheetModalRef = useRef<BottomSheetModal>(null);

    useImperativeHandle(ref, () => ({
      present: () => bottomSheetModalRef.current?.present(),
      dismiss: () => bottomSheetModalRef.current?.dismiss(),
    }));

    const handleSheetChanges = useCallback((index: number) => {
      console.log('handleSheetChanges', index);
      if (index === -1) {
        onClose?.();
      }
    }, [onClose]);

    const handleClose = useCallback(() => {
      bottomSheetModalRef.current?.dismiss();
    }, []);

    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.6}
          enableTouchThrough={false}
        />
      ),
      []
    );

    const snapPoints = React.useMemo(() => ["90%"], []);

    return (
      <BottomSheetModal
        ref={bottomSheetModalRef}
        index={0}
        snapPoints={snapPoints}
        onChange={handleSheetChanges}
        enableDynamicSizing={false}
        backgroundStyle={{ backgroundColor: 'white' }}
        handleIndicatorStyle={{ backgroundColor: themeColors.text + '40' }}
        backdropComponent={renderBackdrop}
        enablePanDownToClose={true}
        enableContentPanningGesture={false}
      >
        <BottomSheetView style={[styles.container, { backgroundColor: 'white' }]}>
          {/* Header with close button */}
          <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
            <View style={styles.headerSpacer} />
            <Text style={[styles.headerTitle, { color: themeColors.text }]}>
              Invoice Preview
            </Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons 
                name="close" 
                size={24} 
                color={themeColors.text} 
              />
            </TouchableOpacity>
          </View>

          {/* Scrollable content with invoice preview */}
          <BottomSheetScrollView 
            contentContainerStyle={[
              styles.scrollContent,
              { backgroundColor: 'white' }
            ]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.previewContainer}>
              <View style={{
                transform: [{ scale: 0.882 }],
                marginLeft: -175,
              }}>
                <SkiaInvoiceCanvas
                  renderSinglePage={0}
                  style={{
                    width: 200,
                    height: 280,
                    backgroundColor: 'white',
                    borderRadius: 8,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.25,
                    shadowRadius: 12,
                    elevation: 10,
                  }}
                  invoice={invoiceData}
                  businessSettings={businessSettings}
                  clientData={clientData}
                />
              </View>
            </View>
          </BottomSheetScrollView>
        </BottomSheetView>
      </BottomSheetModal>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  headerSpacer: {
    width: 32, // Same width as close button to balance the title in the center
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    paddingHorizontal: 0,
  },
  previewContainer: {
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
}); 