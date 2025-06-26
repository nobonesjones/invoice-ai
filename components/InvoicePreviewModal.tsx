import React, { useCallback, useRef, forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Alert, Modal, SafeAreaView, ScrollView, Animated } from 'react-native';
import { GestureHandlerRootView, PanGestureHandler, State } from 'react-native-gesture-handler';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetModalProvider,
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { colors } from '@/constants/colors';
import { useColorScheme } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { Send, Mail, FileText, Link2, X as XIcon } from 'lucide-react-native';
import { useCanvasRef } from '@shopify/react-native-skia';
import { useSupabase } from '@/context/supabase-provider';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import { InvoiceDesignSelector } from '@/components/InvoiceDesignSelector';
import { useInvoiceDesign, useInvoiceDesignForInvoice } from '@/hooks/useInvoiceDesign';
import { ColorSelector } from '@/components/ColorSelector';
import { SegmentedControl } from '@/components/SegmentedControl';

export interface InvoicePreviewModalRef {
  present: () => void;
  dismiss: () => void;
}

interface InvoicePreviewModalProps {
  invoiceData?: any;
  businessSettings?: any;
  clientData?: any;
  invoiceId?: string; // Add invoice ID for individual design management
  onClose?: () => void;
  // New props for settings mode
  mode?: 'preview' | 'settings';
  onDesignSaved?: (designId: string, accentColor: string) => void;
  initialDesign?: string;
  initialAccentColor?: string;
}

export const InvoicePreviewModal = forwardRef<InvoicePreviewModalRef, InvoicePreviewModalProps>(
  ({ invoiceData, businessSettings, clientData, invoiceId, onClose, mode, onDesignSaved, initialDesign, initialAccentColor }, ref) => {
    const colorScheme = useColorScheme();
    const isLightMode = colorScheme === 'light';
    const themeColors = colors[colorScheme || 'light'];
    
    const [isVisible, setIsVisible] = useState(false);
    const { supabase, user } = useSupabase();
    
    // Tab state for design/color selection
    const [activeTab, setActiveTab] = useState<'design' | 'color'>('design');
    
    // Swipe gesture state
    const [isMinimized, setIsMinimized] = useState(false);
    const translateY = useRef(new Animated.Value(0)).current;
    const gestureRef = useRef<PanGestureHandler>(null);
    
    // Design selection hook - use invoice-specific hook if we have an invoice ID
    const {
      currentDesign,
      availableDesigns,
      currentAccentColor,
      isLoading: isDesignLoading,
      selectDesign,
      selectAccentColor,
      saveToInvoice,
      updateDefaultForNewInvoices,
    } = useInvoiceDesignForInvoice(
      invoiceId,
      mode === 'settings' ? initialDesign : invoiceData?.invoice_design,
      mode === 'settings' ? initialAccentColor : invoiceData?.accent_color
    );
    
    // Send modal refs and setup
    const sendInvoiceModalRef = useRef<BottomSheetModal>(null);
    const skiaInvoiceRef = useCanvasRef();
    const sendInvoiceSnapPoints = useMemo(() => ['35%', '50%'], []);

    // Gesture handler for swipe functionality
    const onGestureEvent = Animated.event(
      [{ nativeEvent: { translationY: translateY } }],
      { useNativeDriver: true }
    );

    const onHandlerStateChange = useCallback((event: any) => {
      if (event.nativeEvent.oldState === State.ACTIVE) {
        const { translationY, velocityY } = event.nativeEvent;
        
        // Determine if should minimize or expand based on gesture
        const shouldMinimize = translationY > 50 || velocityY > 500;
        const shouldExpand = translationY < -50 || velocityY < -500;
        
        if (shouldMinimize && !isMinimized) {
          // Minimize - slide down
          setIsMinimized(true);
          Animated.spring(translateY, {
            toValue: 120, // Height to slide down
            useNativeDriver: true,
            tension: 100,
            friction: 8,
          }).start();
        } else if (shouldExpand && isMinimized) {
          // Expand - slide up
          setIsMinimized(false);
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 8,
          }).start();
        } else {
          // Return to current state
          Animated.spring(translateY, {
            toValue: isMinimized ? 120 : 0,
            useNativeDriver: true,
            tension: 100,
            friction: 8,
          }).start();
        }
      }
    }, [isMinimized, translateY]);

    useImperativeHandle(ref, () => ({
      present: () => setIsVisible(true),
      dismiss: () => setIsVisible(false),
    }));

    const handleClose = useCallback(() => {
      setIsVisible(false);
      onClose?.();
    }, [onClose]);

    // Handle discarding changes and closing modal
    const handleDiscard = useCallback(() => {
      // Reset to original design if user had made changes
      // For now, just close the modal without saving
      setIsVisible(false);
      onClose?.();
    }, [onClose]);

    // Handle saving design changes and closing modal
    const handleSave = useCallback(async () => {
      try {
        if (mode === 'settings') {
          // In settings mode, call the callback instead of saving to database
          onDesignSaved?.(currentDesign.id, currentAccentColor);
        } else if (invoiceId) {
          // Save design and color to specific invoice
          const success = await saveToInvoice(invoiceId, currentDesign.id, currentAccentColor);
          if (success) {
            console.log('Invoice design and color saved successfully');
            // Also update default for new invoices
            await updateDefaultForNewInvoices(currentDesign.id, currentAccentColor);
          }
        } else {
          // For new invoices, just update the default
          const success = await updateDefaultForNewInvoices(currentDesign.id, currentAccentColor);
          if (success) {
            console.log('Default design and color preferences saved successfully');
          }
        }
      } catch (error) {
        console.error('Error saving design preference:', error);
      } finally {
        // Close modal regardless of save success/failure
        setIsVisible(false);
        onClose?.();
      }
    }, [mode, onDesignSaved, invoiceId, currentDesign.id, currentAccentColor, saveToInvoice, updateDefaultForNewInvoices, onClose]);

    // Send modal handlers
    const handleOpenSendModal = useCallback(() => {
      sendInvoiceModalRef.current?.present();
    }, []);

    const handleCloseSendModal = useCallback(() => {
      sendInvoiceModalRef.current?.dismiss();
    }, []);

    // Send handlers
    const handleSendByEmail = async () => {
      if (!invoiceData || !businessSettings) {
        Alert.alert('Error', 'Invoice or business data is not available.');
        return;
      }

      if (!supabase) {
        Alert.alert('Error', 'Unable to send invoice at this time.');
        return;
      }

      try {
        console.log('[Modal handleSendByEmail] Generating PDF for invoice:', invoiceData.invoice_number);
        
        const image = skiaInvoiceRef.current?.makeImageSnapshot();
        
        if (!image) {
          throw new Error('Failed to create image snapshot from invoice canvas');
        }
        
        const bytes = image.encodeToBytes();
        
        const chunkSize = 8192;
        let binaryString = '';
        
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.slice(i, i + chunkSize);
          binaryString += String.fromCharCode.apply(null, Array.from(chunk));
        }
        
        const base64String = btoa(binaryString);
        
        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              @page {
                margin: 0;
                size: ${image.width()}px ${image.height()}px;
              }
              body {
                margin: 0;
                padding: 0;
                width: ${image.width()}px;
                height: ${image.height()}px;
                overflow: hidden;
              }
              .invoice-image {
                width: ${image.width()}px;
                height: ${image.height()}px;
                display: block;
                object-fit: none;
              }
            </style>
          </head>
          <body>
            <img src="data:image/png;base64,${base64String}" class="invoice-image" alt="Invoice ${invoiceData.invoice_number}" />
          </body>
          </html>
        `;
        
        const { uri } = await Print.printToFileAsync({
          html: htmlContent,
          base64: false,
        });

        // Update invoice status to sent
        const { error: updateError } = await supabase
          .from('invoices')
          .update({ status: 'sent' })
          .eq('id', invoiceData.id);

        if (updateError) {
          console.error('[Modal handleSendByEmail] Error updating status:', updateError);
          Alert.alert('Error', 'Failed to update invoice status.');
          return;
        }

        // Log the send activity
        const { error: activityError } = await supabase
          .from('invoice_activities')
          .insert({
            invoice_id: invoiceData.id,
            user_id: user?.id,
            activity_type: 'sent',
            description: `Invoice ${invoiceData.invoice_number} was sent via email`,
            activity_data: { 
              invoice_number: invoiceData.invoice_number, 
              send_method: 'email' 
            }
          });

        if (activityError) {
          console.warn('[Modal handleSendByEmail] Failed to log activity:', activityError);
        }

        await Sharing.shareAsync(uri, { 
          mimeType: 'application/pdf', 
          dialogTitle: 'Send Invoice via Email' 
        });

        handleCloseSendModal();
        
      } catch (error: any) {
        console.error('[Modal handleSendByEmail] Error:', error);
        Alert.alert('Error', `Failed to prepare invoice for email: ${error.message}`);
      }
    };

    const handleSendLink = async () => {
      if (!invoiceData || !supabase) {
        Alert.alert('Error', 'Unable to send invoice at this time.');
        return;
      }

      try {
        const { error: updateError } = await supabase
          .from('invoices')
          .update({ status: 'sent' })
          .eq('id', invoiceData.id);

        if (updateError) {
          console.error('[Modal handleSendLink] Error updating status:', updateError);
          Alert.alert('Error', 'Failed to update invoice status.');
          return;
        }

        // Log the send activity
        const { error: activityError } = await supabase
          .from('invoice_activities')
          .insert({
            invoice_id: invoiceData.id,
            user_id: user?.id,
            activity_type: 'sent',
            description: `Invoice ${invoiceData.invoice_number} was sent via link`,
            activity_data: { 
              invoice_number: invoiceData.invoice_number, 
              send_method: 'link' 
            }
          });

        if (activityError) {
          console.warn('[Modal handleSendLink] Failed to log activity:', activityError);
        }

        Alert.alert('Link Shared', 'Invoice link has been shared.');
        handleCloseSendModal();
      } catch (error: any) {
        console.error('[Modal handleSendLink] Error:', error);
        Alert.alert('Error', 'An unexpected error occurred while sharing the invoice link.');
      }
    };

    const handleSendPDF = async () => {
      if (!invoiceData || !businessSettings) {
        Alert.alert('Error', 'Cannot export PDF - invoice data not loaded');
        return;
      }

      try {
        console.log('[Modal handleSendPDF] Generating PDF for invoice:', invoiceData.invoice_number);
        
        const image = skiaInvoiceRef.current?.makeImageSnapshot();
        
        if (!image) {
          throw new Error('Failed to create image snapshot from invoice canvas');
        }
        
        const imageBytes = image.encodeToBytes();
        const fileName = `invoice-${invoiceData.invoice_number}.pdf`;
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;
        
        const chunkSize = 8192;
        let binaryString = '';
        
        for (let i = 0; i < imageBytes.length; i += chunkSize) {
          const chunk = imageBytes.slice(i, i + chunkSize);
          binaryString += String.fromCharCode.apply(null, Array.from(chunk));
        }
        
        const base64String = btoa(binaryString);
        
        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              @page { margin: 0; }
              body { margin: 0; padding: 0; }
              img { width: 100%; height: auto; }
            </style>
          </head>
          <body>
            <img src="data:image/png;base64,${base64String}" alt="Invoice ${invoiceData.invoice_number}" />
          </body>
          </html>
        `;
        
        const { uri } = await Print.printToFileAsync({
          html: htmlContent,
          base64: false,
        });
        
        // Update invoice status to sent
        const { error: updateError } = await supabase
          .from('invoices')
          .update({ status: 'sent' })
          .eq('id', invoiceData.id);

        if (updateError) {
          console.error('[Modal handleSendPDF] Error updating status:', updateError);
          Alert.alert('Error', 'Failed to update invoice status.');
          return;
        }

        // Log the send activity (using the same pattern as other send functions)
        const { error: activityError } = await supabase
          .from('invoice_activities')
          .insert({
            invoice_id: invoiceData.id,
            user_id: user?.id,
            activity_type: 'sent',
            description: `Invoice ${invoiceData.invoice_number} was sent via PDF`,
            activity_data: { 
              invoice_number: invoiceData.invoice_number, 
              send_method: 'pdf' 
            }
          });

        if (activityError) {
          console.warn('[Modal handleSendPDF] Failed to log activity:', activityError);
        }

        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Share Invoice ${invoiceData.invoice_number} PDF`
        });
        
        handleCloseSendModal();
        
      } catch (error: any) {
        console.error('[Modal handleSendPDF] Error:', error);
        Alert.alert('PDF Export Error', `Failed to export PDF: ${error.message}`);
      }
    };

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

    const renderSendBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.5}
        />
      ),
      []
    );

    const snapPoints = React.useMemo(() => ["99%"], []);

    return (
      <>
        <Modal
          visible={isVisible}
          transparent={false}
          animationType="slide"
          presentationStyle="fullScreen"
        >
          <SafeAreaView style={[styles.container, { backgroundColor: 'white' }]}>
            <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
              <TouchableOpacity onPress={handleDiscard} style={styles.closeButton}>
                <Ionicons 
                  name="close" 
                  size={24} 
                  color={themeColors.foreground} 
                />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { color: themeColors.foreground }]}>
                {mode === 'settings' ? 'Default Design Settings' : 'Invoice Preview'}
              </Text>
              <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
                <Text style={[styles.saveButtonText, { color: '#22c55e' }]}>Save</Text>
              </TouchableOpacity>
            </View>

            <ScrollView 
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
                  {React.createElement(currentDesign.component, {
                    ref: skiaInvoiceRef,
                    renderSinglePage: 0,
                    style: {
                      width: 200,
                      height: 280,
                      backgroundColor: 'white',
                      borderRadius: 8,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 8 },
                      shadowOpacity: 0.25,
                      shadowRadius: 12,
                      elevation: 10,
                    },
                    invoice: invoiceData,
                    business: businessSettings,
                    client: clientData,
                    currencySymbol: businessSettings?.currency_symbol || '$',
                    accentColor: currentAccentColor,
                    displaySettings: {
                      show_business_logo: businessSettings?.show_business_logo ?? true,
                      show_business_name: businessSettings?.show_business_name ?? true,
                      show_business_address: businessSettings?.show_business_address ?? true,
                      show_business_tax_number: businessSettings?.show_business_tax_number ?? true,
                      show_notes_section: businessSettings?.show_notes_section ?? true,
                    }
                  })}
                </View>
              </View>
            </ScrollView>
          </SafeAreaView>

          {/* Quick Send Icon - positioned above design selector */}
          {invoiceData && businessSettings && mode !== 'settings' && (
            <TouchableOpacity
              onPress={handleOpenSendModal}
              style={styles.quickSendIcon}
              activeOpacity={0.8}
            >
              <Send size={20} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          {/* Design/Color Selector - Swipeable bottom panel */}
          <PanGestureHandler
            ref={gestureRef}
            onGestureEvent={onGestureEvent}
            onHandlerStateChange={onHandlerStateChange}
            activeOffsetY={[-10, 10]}
          >
            <Animated.View 
              style={[
                styles.designSelectorContainer,
                {
                  transform: [{ translateY: translateY }],
                }
              ]}
            >
              {/* Swipe indicator */}
              <View style={styles.swipeIndicator}>
                <View style={styles.swipeHandle} />
              </View>
              
              {/* Tab Selector Header */}
              <View style={styles.selectorHeader}>
                <SegmentedControl
                  options={['Choose Design', 'Choose Colour']}
                  selectedIndex={activeTab === 'design' ? 0 : 1}
                  onSelectionChange={(index) => setActiveTab(index === 0 ? 'design' : 'color')}
                  style={styles.tabSelectorBottom}
                />
              </View>
              
              {/* Content */}
              <View style={styles.selectorContent}>
                {activeTab === 'design' ? (
                  <InvoiceDesignSelector
                    designs={availableDesigns}
                    selectedDesignId={currentDesign.id}
                    onDesignSelect={selectDesign}
                    isLoading={isDesignLoading}
                  />
                ) : (
                  <ColorSelector
                                      selectedColor={currentAccentColor}
                  onColorSelect={selectAccentColor}
                  />
                )}
              </View>
            </Animated.View>
          </PanGestureHandler>
        </Modal>

        {/* Quick Send Modal */}
        <BottomSheetModal
          ref={sendInvoiceModalRef}
          index={0}
          snapPoints={sendInvoiceSnapPoints}
          backdropComponent={renderSendBackdrop}
          handleIndicatorStyle={{ backgroundColor: themeColors.foreground + '40' }}
          backgroundStyle={{ backgroundColor: 'white' }}
          onDismiss={() => console.log('Modal Send Invoice Modal Dismissed')}
        >
          <BottomSheetView style={{ flex: 1 }}>
            {/* Modal Header */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: themeColors.border,
              backgroundColor: 'white',
            }}>
              <Text style={{
                fontSize: 18,
                fontWeight: 'bold',
                color: themeColors.foreground,
                flex: 1,
                textAlign: 'center'
              }}>
                Send Invoice
              </Text>
              <TouchableOpacity onPress={handleCloseSendModal} style={{ padding: 4 }}>
                <XIcon size={24} color={themeColors.foreground + '80'} />
              </TouchableOpacity>
            </View>

            {/* Modal Options */}
            <TouchableOpacity 
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 16,
                paddingHorizontal: 16,
              }}
              onPress={handleSendByEmail}
            >
              <Mail size={22} color={themeColors.foreground} style={{ marginRight: 16 }} />
              <Text style={{ fontSize: 16, color: themeColors.foreground }}>Send by Email</Text>
            </TouchableOpacity>
            <View style={{ height: 1, backgroundColor: themeColors.border, marginLeft: 16 }} />

            <TouchableOpacity 
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 16,
                paddingHorizontal: 16,
              }}
              onPress={handleSendLink}
            >
              <Link2 size={22} color={themeColors.foreground} style={{ marginRight: 16 }} />
              <Text style={{ fontSize: 16, color: themeColors.foreground }}>Send Link</Text>
            </TouchableOpacity>
            <View style={{ height: 1, backgroundColor: themeColors.border, marginLeft: 16 }} />

            <TouchableOpacity 
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 16,
                paddingHorizontal: 16,
              }}
              onPress={handleSendPDF}
            >
              <FileText size={22} color={themeColors.foreground} style={{ marginRight: 16 }} />
              <Text style={{ fontSize: 16, color: themeColors.foreground }}>Send PDF</Text>
            </TouchableOpacity>
          </BottomSheetView>
        </BottomSheetModal>
      </>
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
    paddingVertical: 3,
    borderBottomWidth: 1,
    backgroundColor: 'white',
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
    paddingTop: -2,
    paddingBottom: Platform.OS === 'ios' ? 120 : 100, // Extra space for design section
    paddingHorizontal: 0,
  },
  previewContainer: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    flex: 1,
    width: '100%',
  },
  floatingButton: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 20,
    right: 20,
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  quickSendContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
  },
  inlineQuickSendButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 140,
    justifyContent: 'center',
  },
  designSelectorContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20, // Safe area padding
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
  },
  quickSendIcon: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 222 : 208, // Adjusted for new selector position
    right: 20,
    width: 44,
    height: 44,
    backgroundColor: '#22c55e',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  saveButton: {
    padding: 4,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  selectorHeader: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tabSelectorBottom: {
    width: 250,
  },
  selectorContent: {
    flex: 1,
  },
  swipeIndicator: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  swipeHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
  },
}); 