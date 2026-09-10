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
import { useSupabase } from '@/context/supabase-provider';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as Clipboard from 'expo-clipboard';
import { InvoiceShareService } from '@/services/invoiceShareService';
import { InvoiceDocumentView } from '@/components/InvoiceDocumentView';
import { buildInvoiceDocument } from '@/lib/invoice-doc/buildInvoiceDocument';
import { fetchLogoDataUri, renderInvoicePdf } from '@/lib/invoice-doc/pdf';
import { InvoiceDesignSelector } from '@/components/InvoiceDesignSelector';
import { useInvoiceDesign, useInvoiceDesignForInvoice } from '@/hooks/useInvoiceDesign';
import { getDesignById, getDefaultDesign } from '@/constants/invoiceDesigns';
import { DesignPicker } from '@/components/DesignPicker';
import { LogoColorProbe } from '@/components/LogoColorProbe';
import { useLogoBrandColor } from '@/hooks/useLogoBrandColor';
import { router } from 'expo-router';

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

export const InvoicePreviewModal = forwardRef(
  (
    { invoiceData, businessSettings, clientData, invoiceId, onClose, mode, onDesignSaved, initialDesign, initialAccentColor, documentType = 'invoice', onSaveComplete }: InvoicePreviewModalProps,
    ref: React.Ref<InvoicePreviewModalRef>
  ) => {
    const colorScheme = useColorScheme();
    const isLightMode = colorScheme === 'light';
    // Ensure we have a valid color scheme, default to light if undefined/null
    const safeColorScheme = colorScheme === 'dark' ? 'dark' : 'light';
    const themeColors = colors[safeColorScheme];
    const { supabase, user } = useSupabase();
    
    const styles = getStyles(themeColors);
    
    const [isVisible, setIsVisible] = useState(false);
    
    // Reduced noisy logs for visibility changes
    React.useEffect(() => {
      // console.log('[InvoicePreviewModal] isVisible:', isVisible);
    }, [isVisible]);
    
    // Reduced noisy logs for invoiceData changes
    React.useEffect(() => {
      // console.log('[InvoicePreviewModal] invoiceData changed:', !!invoiceData);
    }, [invoiceData]);
    
    // Update estimate design and color when invoiceData changes (for estimates)
    React.useEffect(() => {
      if (documentType === 'estimate' && invoiceData) {
        // Reduced noisy logs
        
        // Update design
        const designId = mode === 'settings' ? initialDesign : invoiceData.estimate_template;
        const design = getDesignById(designId);
        if (design) {
          setEstimateDesign(design);
        }
        
        // Update accent color
        const accentColor = mode === 'settings' ? initialAccentColor : invoiceData.accent_color;
        if (accentColor) {
          setEstimateAccentColor(accentColor);
        }
      }
    }, [invoiceData, documentType, mode, initialDesign, initialAccentColor]);
    const mainModalRef = useRef<BottomSheetModal>(null);
    
    const [showSendOptions, setShowSendOptions] = useState(false);
    // Saving a design on one invoice used to silently become the business
    // default. It is now a visible choice, on by default so nothing changes
    // for anyone who never touches it.
    const [applyAsDefault, setApplyAsDefault] = useState(true);
    
    // Swipe gesture state - now supports 3 positions
    const [modalPosition, setModalPosition] = useState<'normal' | 'minimized' | 'expanded'>('normal');
    const translateY = useRef(new Animated.Value(0)).current;
    // The sheet sizes to its content now (tiles + swatches + toggle), so the
    // minimised offset is measured rather than assumed.
    const sheetHeightRef = useRef(260);
    const gestureRef = useRef<PanGestureHandler>(null);
    
    // Design selection hook - use invoice-specific hook if we have an invoice ID
    // Only use the hook for invoices, handle estimates manually
    const shouldUseHook = documentType !== 'estimate';
    const hookResult = useInvoiceDesignForInvoice(
      shouldUseHook ? invoiceId : undefined,
      shouldUseHook ? (mode === 'settings' ? initialDesign : invoiceData?.invoice_design) : undefined,
      shouldUseHook ? (mode === 'settings' ? initialAccentColor : invoiceData?.accent_color) : undefined
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

    // Switching design snaps the colour to that design's own default, unless
    // the user has chosen their brand colour, which belongs on every design.
    const handleDesignSelect = useCallback(
      (designId: string) => {
        selectDesign(designId);
        const next = getDesignById(designId);
        if (next && next.swatches.length && currentAccentColor.toLowerCase() !== (brandColorRef.current ?? '').toLowerCase()) {
          selectAccentColor(next.swatches[0].color);
        }
      },
      [selectDesign, selectAccentColor, currentAccentColor],
    );
    
    // Send modal refs and setup
    // The document being previewed, with the design and colour chosen in this modal.
    const [logoDataUri, setLogoDataUri] = useState<string | null>(null);
    const brandColor = useLogoBrandColor(logoDataUri);
    const brandColorRef = useRef<string | null>(null);
    brandColorRef.current = brandColor;
    React.useEffect(() => {
      let cancelled = false;
      fetchLogoDataUri(businessSettings?.business_logo_url).then((uri) => {
        if (!cancelled) setLogoDataUri(uri);
      });
      return () => {
        cancelled = true;
      };
    }, [businessSettings?.business_logo_url]);
    const previewDoc = useMemo(
      () =>
        invoiceData && businessSettings
          ? buildInvoiceDocument({
              type: documentType,
              row: invoiceData,
              client: clientData,
              business: businessSettings,
              designId: currentDesign.id,
              accentColor: currentAccentColor,
              terminology: businessSettings?.estimate_terminology || 'estimate',
              logoDataUri,
            })
          : null,
      [invoiceData, clientData, businessSettings, documentType, currentDesign.id, currentAccentColor, logoDataUri],
    );
    const requireDoc = () => {
      if (!previewDoc) throw new Error('Invoice is still loading');
      return previewDoc;
    };
    
    // Paywall setup removed – manual sending is now free

    // Gesture handler for swipe functionality
    const onGestureEvent = Animated.event(
      [{ nativeEvent: { translationY: translateY } }],
      { useNativeDriver: true }
    );

    const onHandlerStateChange = useCallback((event: any) => {
      if (event.nativeEvent.oldState === State.ACTIVE) {
        const { translationY, velocityY } = event.nativeEvent;
        
        const expandedPos = -90;
        const normalPos = 0;
        // Leave the handle and the "Design & colour" header peeking.
        const minimizedPos = Math.max(60, sheetHeightRef.current - 64);
        
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
      present: () => {
        // Reduced noisy logs
        setIsVisible(true);
      },
      dismiss: () => {
        // Reduced noisy logs
        setIsVisible(false);
      },
    }));

    // Note: Removed auto-close effect to prevent conflicts with manual modal control

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
      // Reduced noisy logs
      
      try {
        let saveSuccess = false;
        
        if (mode === 'settings') {
          console.log('[InvoicePreviewModal] Settings mode - calling onDesignSaved');
          // In settings mode, call the callback instead of saving to database
          onDesignSaved?.(currentDesign.id, currentAccentColor);
          saveSuccess = true;
        } else if (invoiceId) {
          if (documentType === 'estimate') {
            // Reduced noisy logs
            // Save design and color to specific estimate
            const { error: updateError } = await supabase.from('estimates')
              .update({
                estimate_template: currentDesign.id,
                accent_color: currentAccentColor,
              })
              .eq('id', invoiceId);
            
            if (!updateError) {
              // Reduced noisy logs
              saveSuccess = true;
            } else {
              console.error('[InvoicePreviewModal] Error saving estimate design:', updateError);
            }
          } else {
            // Reduced noisy logs
            // Save design and color to specific invoice
            const success = await saveToInvoice(invoiceId, currentDesign.id, currentAccentColor);
            if (success) {
              if (applyAsDefault) await updateDefaultForNewInvoices(currentDesign.id, currentAccentColor);
              saveSuccess = true;
            } else {
              console.log('[InvoicePreviewModal] Failed to save to invoice');
            }
          }
        } else {
          // Reduced noisy logs
          // For new invoices, just update the default
          const success = await updateDefaultForNewInvoices(currentDesign.id, currentAccentColor);
          if (success) {
            // Reduced noisy logs
            saveSuccess = true;
          } else {
            console.log('[InvoicePreviewModal] Failed to update defaults');
          }
        }
        
        // Reduced noisy logs
        
        // Call onSaveComplete callback if save was successful
        if (saveSuccess && onSaveComplete) {
          // Reduced noisy logs
          onSaveComplete();
        }
        
        // Close modal WITHOUT calling onClose callback for saves (prevents state conflicts)
        // Reduced noisy logs
        setIsVisible(false);
        // Reduced noisy logs
      } catch (error) {
        console.error('[InvoicePreviewModal] Error in handleSave:', error);
        // Close modal WITHOUT calling onClose for errors (prevents state conflicts)
        setIsVisible(false);
        // Reduced noisy logs
      }
      // Reduced noisy logs
    }, [mode, onDesignSaved, invoiceId, currentDesign.id, currentAccentColor, saveToInvoice, updateDefaultForNewInvoices, onClose, onSaveComplete, documentType, supabase, applyAsDefault]);


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
        
        const { uri } = await renderInvoicePdf(requireDoc());

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

      if (!invoiceData || !supabase || !user) {
        Alert.alert('Error', 'Unable to send invoice at this time.');
        return;
      }

      try {
        console.log('[Modal handleSendLink] Generating shareable PDF link for invoice:', invoiceData.id);
        
        // Generate shareable PDF link using the Skia canvas
        const result = await InvoiceShareService.generateShareLinkFromPdf(invoiceData.id, user.id, (await renderInvoicePdf(requireDoc())).uri, 30);

        if (!result.success) {
          Alert.alert('Error', result.error || 'Failed to generate share link');
          return;
        }

        console.log('[Modal handleSendLink] Share link generated:', result.shareUrl);

        // Update invoice status to sent
        const { error: updateError } = await supabase
          .from('invoices')
          .update({ status: 'sent' })
          .eq('id', invoiceData.id);

        if (updateError) {
          console.error('[Modal handleSendLink] Error updating status:', updateError);
          Alert.alert('Error', 'Failed to update invoice status.');
          return;
        }

        // Log the send activity with the share URL
        const { error: activityError } = await supabase
          .from('invoice_activities')
          .insert({
            invoice_id: invoiceData.id,
            user_id: user.id,
            activity_type: 'sent',
            description: `Invoice ${invoiceData.invoice_number} was sent via link`,
            activity_data: { 
              invoice_number: invoiceData.invoice_number, 
              send_method: 'link',
              share_url: result.shareUrl,
              expires_at: result.expiresAt
            }
          });

        if (activityError) {
          console.warn('[Modal handleSendLink] Failed to log activity:', activityError);
        }

        // Also log that a shareable link was created
        await supabase
          .from('invoice_activities')
          .insert({
            invoice_id: invoiceData.id,
            user_id: user.id,
            activity_type: 'link_generated',
            description: `Shareable link created for invoice ${invoiceData.invoice_number}`,
            activity_data: {
              share_url: result.shareUrl,
              expires_at: result.expiresAt,
              invoice_number: invoiceData.invoice_number
            }
          });

        // Copy link to clipboard and show share options
        await Clipboard.setString(result.shareUrl);
        Alert.alert(
          'Invoice Link Generated',
          `A shareable link has been created and copied to your clipboard. This link will expire in 30 days.\n\nLink: ${result.shareUrl}`,
          [
            { text: 'Share Link', onPress: () => shareInvoiceLink(result.shareUrl) },
            { text: 'OK', style: 'default' }
          ]
        );

      } catch (error: any) {
        console.error('[Modal handleSendLink] Error:', error);
        Alert.alert('Error', 'An unexpected error occurred while creating the shareable link.');
      }
    };

    const shareInvoiceLink = async (shareUrl: string) => {
      try {
        const shareMessage = shareUrl;
        
        // Create a temporary text file for sharing
        const fileName = `invoice-${invoiceData?.invoice_number}-link.txt`;
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;
        
        await FileSystem.writeAsStringAsync(fileUri, shareMessage);
        
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/plain',
          dialogTitle: `Share Invoice ${invoiceData?.invoice_number} Link`
        });
        
        // Clean up the temporary file
        await FileSystem.deleteAsync(fileUri, { idempotent: true });
        
      } catch (error) {
        console.error('[shareInvoiceLink] Error sharing link:', error);
        // Fallback to just sharing the URL string
        await Sharing.shareAsync(shareUrl);
      }
    };

    const handleSendPDF = async () => {

      if (!invoiceData || !businessSettings) {
        Alert.alert('Error', 'Cannot export PDF - invoice data not loaded');
        return;
      }

      try {
        console.log('[Modal handleSendPDF] Generating PDF for invoice:', invoiceData.invoice_number);
        
        const { uri } = await renderInvoicePdf(requireDoc());
        
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
          <SafeAreaView style={[styles.container, { backgroundColor: themeColors.card }]}>
            <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
              <TouchableOpacity 
                onPress={() => {
                  console.log('[InvoicePreviewModal] Close button pressed!');
                  handleDiscard();
                }}
                style={styles.closeButton}
              >
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
              <TouchableOpacity 
                onPress={() => {
                  console.log('[InvoicePreviewModal] Save button pressed!');
                  handleSave();
                }}
                style={styles.saveButton}
              >
                <Text style={[styles.saveButtonText, { color: '#22c55e' }]}>Save</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1, backgroundColor: themeColors.border }}>
              {previewDoc ? <InvoiceDocumentView doc={previewDoc} background={themeColors.border} /> : null}
            </View>

            {/* Design/Color Selector - Fixed bottom panel */}
            <PanGestureHandler
              ref={gestureRef}
              onGestureEvent={onGestureEvent}
              onHandlerStateChange={onHandlerStateChange}
              activeOffsetY={[-50, 50]}
              enabled={true}
            >
              <Animated.View 
                onLayout={(e) => { sheetHeightRef.current = e.nativeEvent.layout.height; }}
                style={[
                  styles.designSelectorContainer,
                  {
                    backgroundColor: themeColors.card,
                    transform: [{ translateY: translateY }],
                  }
                ]}
              >
                {/* Swipe indicator */}
                <View style={styles.swipeIndicator}>
                  <View style={styles.swipeHandle} />
                </View>
                
                {/* Tab Selector Header */}
                <View style={[styles.selectorHeader, { borderBottomColor: themeColors.border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 10 }}>
                    <View style={{ flex: 1 }} />
                    <Text style={{ fontSize: 15, fontWeight: '600', color: themeColors.foreground, opacity: showSendOptions ? 0.6 : 1 }}>
                      Design & colour
                    </Text>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      {/* Send Arrow - positioned to the right */}
                      {invoiceData && businessSettings && mode !== 'settings' && (
                        <TouchableOpacity
                          onPress={() => setShowSendOptions(!showSendOptions)}
                          style={{
                            marginRight: -15, // Move 10 more pixels to the right (was -5, now -15)
                            width: 36,
                            height: 36,
                            backgroundColor: showSendOptions ? '#22c55e' : themeColors.muted,
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
                          <Send size={18} color={showSendOptions ? "#FFFFFF" : themeColors.mutedForeground} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
                
                {/* Content */}
                <View style={[styles.selectorContent, { backgroundColor: themeColors.card }]}>
                  {showSendOptions ? (
                    /* Send Options - compact to fit same space */
                    <View style={{ paddingHorizontal: 16, paddingVertical: 0, paddingTop: 8, paddingBottom: 20, backgroundColor: themeColors.card }}>
                      {/* Send Options Buttons - more compact */}
                      <TouchableOpacity 
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: 12,
                          paddingHorizontal: 16,
                          backgroundColor: themeColors.muted,
                          borderRadius: 12,
                          marginBottom: 8,
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: colorScheme === 'dark' ? 0 : 0.08,
                          shadowRadius: 4,
                          elevation: colorScheme === 'dark' ? 0 : 2,
                        }}
                        onPress={() => {
                          handleSendByEmail();
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
                          backgroundColor: themeColors.muted,
                          borderRadius: 12,
                          marginBottom: 8,
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: colorScheme === 'dark' ? 0 : 0.08,
                          shadowRadius: 4,
                          elevation: colorScheme === 'dark' ? 0 : 2,
                        }}
                        onPress={() => {
                          handleSendLink();
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
                          backgroundColor: themeColors.muted,
                          borderRadius: 12,
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: colorScheme === 'dark' ? 0 : 0.08,
                          shadowRadius: 4,
                          elevation: colorScheme === 'dark' ? 0 : 2,
                        }}
                        onPress={() => {
                          handleSendPDF();
                        }}
                      >
                        <FileText size={20} color={themeColors.foreground} style={{ marginRight: 12 }} />
                        <Text style={{ fontSize: 15, color: themeColors.foreground }}>Send PDF</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    /* Design + colour in one place */
                    <View style={{ marginTop: 2, paddingBottom: 6, backgroundColor: themeColors.card }}>
                      <DesignPicker
                        designs={availableDesigns}
                        selectedDesign={currentDesign}
                        onDesignSelect={handleDesignSelect}
                        accentColor={currentAccentColor}
                        onAccentSelect={selectAccentColor}
                        brandColor={brandColor}
                        isLoading={isDesignLoading}
                        showDefaultToggle={mode !== 'settings'}
                        applyAsDefault={applyAsDefault}
                        onApplyAsDefaultChange={setApplyAsDefault}
                      />
                    </View>
                  )}
                </View>
              </Animated.View>
            </PanGestureHandler>
            <LogoColorProbe />

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
    backgroundColor: themeColors.card,
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
    bottom: 25,
    left: 0,
    right: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
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
  },
  tabSelectorBottom: {
    width: 250,
  },
  selectorContent: {
    // Sizes to its content: tiles, swatches, and the default switch.
  },
  swipeIndicator: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  swipeHandle: {
    width: 40,
    height: 4,
    backgroundColor: themeColors.border,
    borderRadius: 2,
  },
}); 
