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
import { getDesignById, getDefaultDesign } from '@/constants/invoiceDesigns';
import { ColorSelector } from '@/components/ColorSelector';
import { SegmentedControl } from '@/components/SegmentedControl';
import { useItemCreationLimit } from '@/hooks/useItemCreationLimit';

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
  // Document type for proper labeling
  documentType?: 'invoice' | 'estimate';
  // Callback when save is completed successfully
  onSaveComplete?: () => void;
}

export const InvoicePreviewModal = forwardRef<InvoicePreviewModalRef, InvoicePreviewModalProps>(
  ({ invoiceData, businessSettings, clientData, invoiceId, onClose, mode, onDesignSaved, initialDesign, initialAccentColor, documentType = 'invoice', onSaveComplete }, ref) => {
    const colorScheme = useColorScheme();
    const isLightMode = colorScheme === 'light';
    const themeColors = colors[colorScheme || 'light'];
    const { supabase, user } = useSupabase();
    
    const styles = getStyles(themeColors);
    
    const [isVisible, setIsVisible] = useState(false);
    const mainModalRef = useRef<BottomSheetModal>(null);
    
    // Tab state for design/color selection
    const [activeTab, setActiveTab] = useState<'design' | 'color'>('design');
    const [showSendOptions, setShowSendOptions] = useState(false);
    
    // Swipe gesture state - now supports 3 positions
    const [modalPosition, setModalPosition] = useState<'normal' | 'minimized' | 'expanded'>('normal');
    const translateY = useRef(new Animated.Value(0)).current;
    const gestureRef = useRef<PanGestureHandler>(null);
    
    // Design selection hook - use invoice-specific hook if we have an invoice ID
    // Only use the hook for invoices, handle estimates manually
    const shouldUseHook = documentType !== 'estimate';
    const hookResult = useInvoiceDesignForInvoice(
      shouldUseHook ? invoiceId : undefined,
      mode === 'settings' ? initialDesign : (documentType === 'estimate' ? invoiceData?.estimate_template : invoiceData?.invoice_design),
      mode === 'settings' ? initialAccentColor : invoiceData?.accent_color
    );

    // For estimates, we'll manage state manually since the hook is invoice-specific
    const [estimateDesign, setEstimateDesign] = useState(() => {
      const designId = mode === 'settings' ? initialDesign : (documentType === 'estimate' ? invoiceData?.estimate_template : invoiceData?.invoice_design);
      return getDesignById(designId) || getDefaultDesign();
    });
    const [estimateAccentColor, setEstimateAccentColor] = useState(
      mode === 'settings' ? initialAccentColor : invoiceData?.accent_color || '#1E40AF'
    );

    // Use hook results for invoices, manual state for estimates
    const currentDesign = shouldUseHook ? hookResult.currentDesign : estimateDesign;
    const availableDesigns = hookResult.availableDesigns;
    const currentAccentColor = shouldUseHook ? hookResult.currentAccentColor : estimateAccentColor;
    const isDesignLoading = shouldUseHook ? hookResult.isLoading : false;
    const selectDesign = shouldUseHook ? hookResult.selectDesign : (designId: string) => {
      const design = getDesignById(designId);
      if (design) setEstimateDesign(design);
    };
    const selectAccentColor = shouldUseHook ? hookResult.selectAccentColor : setEstimateAccentColor;
    const saveToInvoice = hookResult.saveToInvoice;
    const updateDefaultForNewInvoices = hookResult.updateDefaultForNewInvoices;
    
    // Send modal refs and setup
    const skiaInvoiceRef = useCanvasRef();
    
    // Paywall setup
    const { checkAndShowPaywall } = useItemCreationLimit();

    // Gesture handler for swipe functionality
    const onGestureEvent = Animated.event(
      [{ nativeEvent: { translationY: translateY } }],
      { useNativeDriver: true }
    );

    const onHandlerStateChange = useCallback((event: any) => {
      if (event.nativeEvent.oldState === State.ACTIVE) {
        const { translationY, velocityY } = event.nativeEvent;
        
        // Define positions: expanded (-90), normal (0), minimized (120)
        const expandedPos = -90; // 30% higher up (90px up from normal)
        const normalPos = 0;
        const minimizedPos = 120;
        
        // Determine target position based on gesture
        let targetPosition: 'normal' | 'minimized' | 'expanded' = modalPosition;
        let targetValue = normalPos;
        
        if (modalPosition === 'normal') {
          if (translationY > 50 || velocityY > 500) {
            // Swipe down from normal -> minimize
            targetPosition = 'minimized';
            targetValue = minimizedPos;
          } else if (translationY < -50 || velocityY < -500) {
            // Swipe up from normal -> expand
            targetPosition = 'expanded';
            targetValue = expandedPos;
          }
        } else if (modalPosition === 'minimized') {
          if (translationY < -30 || velocityY < -300) {
            // Swipe up from minimized -> normal
            targetPosition = 'normal';
            targetValue = normalPos;
          }
        } else if (modalPosition === 'expanded') {
          if (translationY > 30 || velocityY > 300) {
            // Swipe down from expanded -> normal
            targetPosition = 'normal';
            targetValue = normalPos;
          }
        }
        
        // If no clear gesture, return to current position
        if (targetPosition === modalPosition) {
          targetValue = modalPosition === 'expanded' ? expandedPos : 
                      modalPosition === 'minimized' ? minimizedPos : normalPos;
        }
        
        // Update state and animate
        setModalPosition(targetPosition);
        Animated.spring(translateY, {
          toValue: targetValue,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }).start();
      }
    }, [modalPosition, translateY]);

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
        let saveSuccess = false;
        
        if (mode === 'settings') {
          // In settings mode, call the callback instead of saving to database
          onDesignSaved?.(currentDesign.id, currentAccentColor);
          saveSuccess = true;
        } else if (invoiceId) {
          if (documentType === 'estimate') {
            // Save design and color to specific estimate
            const { error: updateError } = await supabase.from('estimates')
              .update({
                estimate_template: currentDesign.id,
                accent_color: currentAccentColor,
              })
              .eq('id', invoiceId);
            
            if (!updateError) {
              console.log('Estimate design and color saved successfully');
              saveSuccess = true;
            } else {
              console.error('Error saving estimate design:', updateError);
            }
          } else {
            // Save design and color to specific invoice
            const success = await saveToInvoice(invoiceId, currentDesign.id, currentAccentColor);
            if (success) {
              console.log('Invoice design and color saved successfully');
              // Also update default for new invoices
              await updateDefaultForNewInvoices(currentDesign.id, currentAccentColor);
              saveSuccess = true;
            }
          }
        } else {
          // For new invoices, just update the default
          const success = await updateDefaultForNewInvoices(currentDesign.id, currentAccentColor);
          if (success) {
            console.log('Default design and color preferences saved successfully');
            saveSuccess = true;
          }
        }
        
        // Call onSaveComplete if save was successful
        if (saveSuccess) {
          onSaveComplete?.();
        }
      } catch (error) {
        console.error('Error saving design preference:', error);
      } finally {
        // Close modal regardless of save success/failure
        setIsVisible(false);
        onClose?.();
      }
    }, [mode, onDesignSaved, invoiceId, currentDesign.id, currentAccentColor, saveToInvoice, updateDefaultForNewInvoices, onClose, onSaveComplete, documentType, supabase]);


    // Send handlers
    const handleSendByEmail = async () => {
      // Check paywall first
      const canProceed = await checkAndShowPaywall();
      if (!canProceed) {
        return;
      }

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
        
      } catch (error: any) {
        console.error('[Modal handleSendByEmail] Error:', error);
        Alert.alert('Error', `Failed to prepare invoice for email: ${error.message}`);
      }
    };

    const handleSendLink = async () => {
      // Check paywall first
      const canProceed = await checkAndShowPaywall();
      if (!canProceed) {
        return;
      }

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
      } catch (error: any) {
        console.error('[Modal handleSendLink] Error:', error);
        Alert.alert('Error', 'An unexpected error occurred while sharing the invoice link.');
      }
    };

    const handleSendPDF = async () => {
      // Check paywall first
      const canProceed = await checkAndShowPaywall();
      if (!canProceed) {
        return;
      }

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
        
      } catch (error: any) {
        console.error('[Modal handleSendPDF] Error:', error);
        Alert.alert('PDF Export Error', `Failed to export PDF: ${error.message}`);
      }
    };



    return (
      <>
        <Modal
          visible={isVisible}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={handleClose}
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
                {mode === 'settings' 
                  ? 'Default Design Settings' 
                  : documentType === 'estimate' 
                    ? 'Preview' 
                    : 'Invoice Preview'
                }
              </Text>
              <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
                <Text style={[styles.saveButtonText, { color: '#22c55e' }]}>Save</Text>
              </TouchableOpacity>
            </View>

            <ScrollView 
              contentContainerStyle={[
                styles.scrollContent,
                { backgroundColor: themeColors.border }
              ]}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.previewContainer}>
                <View style={{
                  transform: [{ scale: 0.882 }],
                  marginLeft: -175,
                  position: 'relative',
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
                    documentType: documentType,
                    estimateTerminology: businessSettings?.estimate_terminology || 'estimate',
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
                      position: 'relative', // Changed from absolute
                      marginTop: 90, // 10 pixels higher
                    }
                  ]}
                >
                  {/* Swipe indicator */}
                  <View style={styles.swipeIndicator}>
                    <View style={styles.swipeHandle} />
                  </View>
                  
                  {/* Tab Selector Header */}
                  <View style={styles.selectorHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 10 }}>
                      <View style={{ flex: 1 }} />
                      <SegmentedControl
                        options={['Choose Design', 'Choose Colour']}
                        selectedIndex={activeTab === 'design' ? 0 : 1}
                        onSelectionChange={(index) => {
                          setActiveTab(index === 0 ? 'design' : 'color');
                          setShowSendOptions(false); // Hide send options when switching tabs
                        }}
                        style={[styles.tabSelectorBottom, { opacity: showSendOptions ? 0.6 : 1 }]}
                      />
                      <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        {/* Send Arrow - positioned to the right */}
                        {invoiceData && businessSettings && mode !== 'settings' && (
                          <TouchableOpacity
                            onPress={() => setShowSendOptions(!showSendOptions)}
                            style={{
                              marginRight: -15, // Move 10 more pixels to the right (was -5, now -15)
                              width: 36,
                              height: 36,
                              backgroundColor: showSendOptions ? '#22c55e' : '#f3f4f6',
                              borderRadius: 18,
                              justifyContent: 'center',
                              alignItems: 'center',
                              shadowColor: '#000',
                              shadowOffset: { width: 0, height: 1 },
                              shadowOpacity: 0.2,
                              shadowRadius: 2,
                              elevation: 2,
                            }}
                            activeOpacity={0.8}
                          >
                            <Send size={18} color={showSendOptions ? "#FFFFFF" : "#6b7280"} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                  
                  {/* Content */}
                  <View style={styles.selectorContent}>
                    {showSendOptions ? (
                      /* Send Options - compact to fit same space */
                      <View style={{ paddingHorizontal: 16, paddingVertical: 0, paddingTop: 8, paddingBottom: 20, backgroundColor: 'white' }}>
                        {/* Send Options Buttons - more compact */}
                        <TouchableOpacity 
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingVertical: 12,
                            paddingHorizontal: 16,
                            backgroundColor: 'white',
                            borderRadius: 12,
                            marginBottom: 8,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 3 },
                            shadowOpacity: 0.15,
                            shadowRadius: 6,
                            elevation: 4,
                          }}
                          onPress={() => {
                            handleSendByEmail();
                            setShowSendOptions(false);
                          }}
                        >
                          <Mail size={20} color={themeColors.foreground} style={{ marginRight: 12 }} />
                          <Text style={{ fontSize: 15, color: themeColors.foreground }}>Send by Email</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingVertical: 12,
                            paddingHorizontal: 16,
                            backgroundColor: 'white',
                            borderRadius: 12,
                            marginBottom: 8,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 3 },
                            shadowOpacity: 0.15,
                            shadowRadius: 6,
                            elevation: 4,
                          }}
                          onPress={() => {
                            handleSendLink();
                            setShowSendOptions(false);
                          }}
                        >
                          <Link2 size={20} color={themeColors.foreground} style={{ marginRight: 12 }} />
                          <Text style={{ fontSize: 15, color: themeColors.foreground }}>Send Link</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingVertical: 12,
                            paddingHorizontal: 16,
                            backgroundColor: 'white',
                            borderRadius: 12,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 3 },
                            shadowOpacity: 0.15,
                            shadowRadius: 6,
                            elevation: 4,
                          }}
                          onPress={() => {
                            handleSendPDF();
                            setShowSendOptions(false);
                          }}
                        >
                          <FileText size={20} color={themeColors.foreground} style={{ marginRight: 12 }} />
                          <Text style={{ fontSize: 15, color: themeColors.foreground }}>Send PDF</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      /* Design/Color Selectors */
                      <>
                        {activeTab === 'design' ? (
                          <View style={{ marginTop: 2, paddingTop: 0, marginBottom: -20, paddingBottom: 20, backgroundColor: 'white' }}>
                            <InvoiceDesignSelector
                              designs={availableDesigns}
                              selectedDesignId={currentDesign.id}
                              onDesignSelect={selectDesign}
                              isLoading={isDesignLoading}
                            />
                          </View>
                        ) : (
                          <View style={{ marginTop: 2, paddingTop: 0, marginBottom: -20, paddingBottom: 20, backgroundColor: 'white' }}>
                            <ColorSelector
                              selectedColor={currentAccentColor}
                              onColorSelect={selectAccentColor}
                            />
                          </View>
                        )}
                      </>
                    )}
                  </View>
                </Animated.View>
              </PanGestureHandler>
            </ScrollView>

          </SafeAreaView>
        </Modal>

      </>
    );
  }
);

const getStyles = (themeColors: any) => StyleSheet.create({
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
    paddingBottom: 10, // Add 10px back for spacing
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
    paddingBottom: 0, // Remove bottom padding to eliminate white space
    paddingTop: 0, // Removed all top padding (3px reduction)
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
    paddingTop: 0, // Reduced by 2 more pixels
    paddingBottom: 0, // Reduced by 4 more pixels  
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tabSelectorBottom: {
    width: 250,
  },
  selectorContent: {
    height: 150, // Fixed height instead of flex: 1
    backgroundColor: 'white',
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