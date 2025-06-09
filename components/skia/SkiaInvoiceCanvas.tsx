import React, { useMemo, forwardRef, RefObject } from 'react';
import { Canvas, Rect, Text, Skia, matchFont, Circle, Paragraph, TextAlign, Image, useImage } from '@shopify/react-native-skia';
import { View, StyleSheet, Platform } from 'react-native';

interface SkiaInvoiceCanvasProps {
  invoice?: any;
  business?: any;
  client?: any;
  currencySymbol?: string;
  style?: any;
  renderSinglePage?: number; // NEW: If provided, only render this specific page (0-indexed)
}

const SkiaInvoiceCanvas = forwardRef((props: SkiaInvoiceCanvasProps, ref: any) => {
  const { 
    invoice, 
    business, 
    client, 
    currencySymbol = '£',
    style,
    renderSinglePage
  } = props;
  console.log('[SkiaInvoiceCanvas] Rendering Real Invoice INV-710231');

  // DEBUG: Add payment status logging
  console.log('[SkiaInvoiceCanvas] Payment Debug Info:', {
    invoice_id: invoice?.id,
    invoice_number: invoice?.invoice_number,
    paid_amount: invoice?.paid_amount,
    payment_date: invoice?.payment_date,
    payment_notes: invoice?.payment_notes,
    status: invoice?.status,
    total_amount: invoice?.total_amount
  });

  // CANVAS DIMENSIONS - control export size by limiting Canvas dimensions
  const devicePixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const baseCanvasWidth = renderSinglePage !== undefined ? 200 : (style?.width || 370); // Much smaller for export
  const baseCanvasHeight = renderSinglePage !== undefined ? (style?.height || 250) : (style?.height || 560); // Use style height for export
  
  // COORDINATE OFFSET: No offset needed for smaller Canvas
  const OFFSET_X = 0; // No left margin needed
  const OFFSET_RIGHT = 0; // No right margin needed  
  const USABLE_WIDTH = baseCanvasWidth;
  
  console.log('[SkiaInvoiceCanvas] Canvas fix - Original:', baseCanvasWidth, 'Usable:', USABLE_WIDTH, 'Offset:', OFFSET_X);
  
  const canvasWidth = baseCanvasWidth;
  const canvasHeight = baseCanvasHeight;
  
  // Pagination calculations with original spacing
  const itemRowHeight = 20;
  const tableHeaderY = 180;
  const tableHeaderHeight = 25;
  const firstItemY = 205;
  const footerStartY = 410; // Back to original footer position that looked good
  
  // Calculate how many items fit on first page
  const availableSpaceFirstPage = footerStartY - firstItemY;
  const maxItemsFirstPage = Math.floor(availableSpaceFirstPage / itemRowHeight);
  
  // Get dynamic line items from invoice data
  const lineItems = invoice?.invoice_line_items || [
    {
      quantity: 1,
      item_name: "Big winner",
      item_description: "Easy winner fm",
      unit_price: 200.00,
      total_price: 200.00
    },
    {
      quantity: 1,
      item_name: "Big winner", 
      item_description: "Easy winner fm",
      unit_price: 200.00,
      total_price: 200.00
    }
  ];
  
  // Pagination logic
  const totalItems = lineItems.length;
  const needsPagination = totalItems > maxItemsFirstPage;
  const firstPageItems = lineItems.slice(0, maxItemsFirstPage);
  const remainingItems = lineItems.slice(maxItemsFirstPage);
  
  // ADAPTIVE SCALING LOGIC for 9-11 items
  const isCompactMode = totalItems >= 9 && totalItems <= 11;
  const scaleFactor = isCompactMode ? 0.75 : 1.0; // 25% reduction for 9-11 items
  
  // Scaled dimensions
  const scaledRowHeight = Math.floor(itemRowHeight * scaleFactor); // 15px for compact, 20px normal
  const scaledFirstItemY = firstItemY;
  const scaledItemSpacing = scaledRowHeight;
  const textOffsetY = 13; // Consistent text positioning within each row
  
  // Calculate how many pages we'd need with current logic
  const itemsPerSubsequentPage = Math.floor((canvasHeight - 50) / scaledRowHeight);
  const preliminaryTotalPages = totalItems > maxItemsFirstPage ? 
    1 + Math.ceil((totalItems - maxItemsFirstPage) / itemsPerSubsequentPage) : 1;
  
  // Special case: if we have exactly 2 pages, allow 12 items on first page
  const isTwoPageInvoice = preliminaryTotalPages === 2;
  const adjustedMaxItemsFirstPage = isTwoPageInvoice ? 12 : (isCompactMode ? 11 : maxItemsFirstPage);
  
  // Recalculate pagination with adjusted logic - force single page for export test
  const actualNeedsPagination = renderSinglePage !== undefined ? false : (totalItems > adjustedMaxItemsFirstPage);
  const actualFirstPageItems = renderSinglePage !== undefined ? lineItems : lineItems.slice(0, adjustedMaxItemsFirstPage);
  const actualRemainingItems = renderSinglePage !== undefined ? [] : lineItems.slice(adjustedMaxItemsFirstPage);
  
  // Calculate number of pages with adjusted logic
  const totalPages = actualNeedsPagination ? 
    1 + Math.ceil(actualRemainingItems.length / itemsPerSubsequentPage) : 1;
  
  // Calculate total canvas height for all pages
  const separatorHeight = actualNeedsPagination ? 30 * (totalPages - 1) : 0; // 30px separator between each page
  
  // EXPORT TEST: Force single page if renderSinglePage is provided, otherwise use pagination logic
  const totalCanvasHeight = renderSinglePage !== undefined ? baseCanvasHeight : // Use base height for export
    (actualNeedsPagination ? 
      ((totalPages * canvasHeight) + separatorHeight + 30) : 
      (totalItems >= 12 ? 800 : 560));
  
  console.log(`[SkiaInvoiceCanvas] PAGINATION: Items=${totalItems}, IsTwoPage=${isTwoPageInvoice}, MaxFirst=${adjustedMaxItemsFirstPage}, Pages=${totalPages}, Compact=${isCompactMode}, Scale=${scaleFactor}`);
  console.log(`[SkiaInvoiceCanvas] HEIGHT: base=${canvasHeight}, final=${totalCanvasHeight} (matching display exactly)`);
  console.log(`[SkiaInvoiceCanvas] RENDER_SINGLE_PAGE: ${renderSinglePage}, actualNeedsPagination: ${actualNeedsPagination}, actualFirstPageItems: ${actualFirstPageItems.length}`);
  console.log(`[SkiaInvoiceCanvas] BORDER: canvasWidth=${canvasWidth}, totalCanvasHeight=${totalCanvasHeight}, borderRect should be: x=10.5, y=10.5, width=${canvasWidth - 21}, height=${totalCanvasHeight - 21}`);
  console.log(`[SkiaInvoiceCanvas] BORDER: canvasWidth=${canvasWidth}, totalCanvasHeight=${totalCanvasHeight}, borderRect: x=10.5, y=10.5, width=${canvasWidth - 21}, height=${totalCanvasHeight - 21}`);

  // Calculate discount values outside useMemo so they can be used in both places
  const hasDiscount = invoice?.discount_value && invoice?.discount_value > 0;
  const discountAmount = hasDiscount ? (
    invoice.discount_type === 'percentage' 
      ? (invoice.subtotal_amount || 400.00) * (invoice.discount_value / 100)
      : invoice.discount_value
  ) : 0;

  // Create exact font system matching original design typography
  const fonts = useMemo(() => {
    try {
      const fontFamily = Platform.select({ 
        ios: "Helvetica", 
        android: "sans-serif",
        default: "sans-serif" 
      });
      
      return {
        // Original: fontSize: 6, itemSubtitle + textPlaceholder
        tiny: matchFont({
          fontFamily,
          fontSize: 7,
          fontStyle: "normal" as const,
          fontWeight: "normal" as const,
        }),
        // Original: fontSize: 7, tableHeader + lineItemCellText  
        small: matchFont({
          fontFamily,
          fontSize: 8,
          fontStyle: "normal" as const,
          fontWeight: "normal" as const,
        }),
        // Bold version for table headers
        smallBold: matchFont({
          fontFamily,
          fontSize: 8,
          fontStyle: "normal" as const,
          fontWeight: "bold" as const,
        }),
        // Original: fontSize: 8, label + text + paymentTermsHeader/Body
        body: matchFont({
          fontFamily,
          fontSize: 9,
          fontStyle: "normal" as const,
          fontWeight: "normal" as const,
        }),
        // Original: fontSize: 8, bold labels
        bodyBold: matchFont({
          fontFamily,
          fontSize: 9,
          fontStyle: "normal" as const,
          fontWeight: "bold" as const,
        }),
        // Original: fontSize: 9, headerTextDetail
        medium: matchFont({
          fontFamily,
          fontSize: 10,
          fontStyle: "normal" as const,
          fontWeight: "normal" as const,
        }),
        // Original: fontSize: 10, businessNameText + clientNameText + logoPlaceholder
        large: matchFont({
          fontFamily,
          fontSize: 11,
          fontStyle: "normal" as const,
          fontWeight: "bold" as const,
        }),
        // Original: fontSize: 16, invoiceLabel  
        title: matchFont({
          fontFamily,
          fontSize: 17,
          fontStyle: "normal" as const,
          fontWeight: "bold" as const,
        })
      };
    } catch (e) {
      console.log('[SkiaInvoiceCanvas] Font creation failed:', e);
      return { tiny: null, small: null, smallBold: null, body: null, bodyBold: null, medium: null, large: null, title: null };
    }
  }, []);

  // Scaled fonts for compact mode (9-11 items)
  const scaledFonts = useMemo(() => {
    if (!isCompactMode || !fonts.body) return fonts;
    
    try {
      const fontFamily = Platform.select({ 
        ios: "Helvetica", 
        android: "sans-serif",
        default: "sans-serif" 
      });
      
      return {
        // Scale down fonts by 25% for compact mode
        tiny: matchFont({
          fontFamily,
          fontSize: Math.round(7 * scaleFactor), // 5px
          fontStyle: "normal" as const,
          fontWeight: "normal" as const,
        }),
        small: matchFont({
          fontFamily,
          fontSize: Math.round(8 * scaleFactor), // 6px
          fontStyle: "normal" as const,
          fontWeight: "normal" as const,
        }),
        smallBold: matchFont({
          fontFamily,
          fontSize: Math.round(8 * scaleFactor), // 6px
          fontStyle: "normal" as const,
          fontWeight: "bold" as const,
        }),
        body: matchFont({
          fontFamily,
          fontSize: Math.round(9 * scaleFactor), // 7px
          fontStyle: "normal" as const,
          fontWeight: "normal" as const,
        }),
        bodyBold: matchFont({
          fontFamily,
          fontSize: Math.round(9 * scaleFactor), // 7px
          fontStyle: "normal" as const,
          fontWeight: "bold" as const,
        }),
        // Keep header fonts normal size
        medium: fonts.medium,
        large: fonts.large,
        title: fonts.title
      };
    } catch (e) {
      console.log('[SkiaInvoiceCanvas] Scaled font creation failed:', e);
      return fonts;
    }
  }, [fonts, isCompactMode, scaleFactor]);

  // Create right-aligned paragraphs using Skia's TextAlign.Right
  const rightAlignedParagraphs = useMemo(() => {
    if (!scaledFonts.medium) return null;
    
    try {
      // Header paragraphs
      const invoiceParagraph = Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Right,
      })
      .pushStyle({ 
        color: Skia.Color('black'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 10, // Scaled down from 13 to 10
        fontStyle: { weight: 700 }
      })
      .addText(`INVOICE`)
      .build();

      const refParagraph = Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Right,
      })
      .pushStyle({ 
        color: Skia.Color('black'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 7, // Scaled down from 9 to 7
        fontStyle: { weight: 400 }
      })
      .addText(`Ref: ${invoice?.invoice_number || 'INV-000000'}`)
      .build();

      const dateParagraph = Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Right,
      })
      .pushStyle({ 
        color: Skia.Color('black'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 7, // Scaled down from 9 to 7
        fontStyle: { weight: 400 }
      })
      .addText(`Date: ${invoice?.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('en-GB') : '03/06/2025'}`)
      .build();

      const dueParagraph = Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Right,
      })
      .pushStyle({ 
        color: Skia.Color('black'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 7, // Scaled down from 9 to 7
        fontStyle: { weight: 400 }
      })
      .addText(`Due: ${
        invoice?.due_date ? new Date(invoice.due_date).toLocaleDateString('en-GB') :
        invoice?.due_date_option === 'on_receipt' ? 'On receipt' :
        invoice?.due_date_option === 'net_7' ? 'In 7 days' :
        invoice?.due_date_option === 'net_15' ? 'In 15 days' :
        invoice?.due_date_option === 'net_30' ? 'In 30 days' :
        'In 7 days'
      }`)
      .build();

      // PO Number paragraph (conditional)
      const poParagraph = invoice?.po_number ? Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Right,
      })
      .pushStyle({ 
        color: Skia.Color('black'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 7, // Scaled down from 9 to 7
        fontStyle: { weight: 400 }
      })
      .addText(`PO: ${invoice.po_number}`)
      .build() : null;

      // Client paragraphs
      const billToParagraph = Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Right,
      })
      .pushStyle({ 
        color: Skia.Color('black'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 9, 
        fontStyle: { weight: 700 }
      })
      .addText(`Bill To:`)
      .build();

      const clientNameParagraph = Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Right,
      })
      .pushStyle({ 
        color: Skia.Color('black'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 9, 
        fontStyle: { weight: 700 }
      })
      .addText(`${client?.name || 'Chill Free Ltd'}`)
      .build();

      // Client address paragraphs
      const clientAddress1Paragraph = Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Right,
      })
      .pushStyle({ 
        color: Skia.Color('black'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 9, 
        fontStyle: { weight: 400 }
      })
      .addText(`${client?.address_client?.split('\n')[0] || ''}`)
      .build();

      const clientAddress2Paragraph = Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Right,
      })
      .pushStyle({ 
        color: Skia.Color('black'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 9, 
        fontStyle: { weight: 400 }
      })
      .addText(`${client?.address_client?.split('\n')[1] || ''}`)
      .build();

      const clientAddress3Paragraph = Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Right,
      })
      .pushStyle({ 
        color: Skia.Color('black'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 9, 
        fontStyle: { weight: 400 }
      })
      .addText(`${client?.address_client?.split('\n')[2] || ''}`)
      .build();

      const clientTaxNumberParagraph = Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Right,
      })
      .pushStyle({ 
        color: Skia.Color('black'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 9, 
        fontStyle: { weight: 400 }
      })
      .addText(`${client?.tax_number ? `${business?.tax_name || 'Tax'}: ${client.tax_number}` : ''}`)
      .build();

      // From section paragraphs
      const fromLabelParagraph = Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Left,
      })
      .pushStyle({ 
        color: Skia.Color('black'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 9, 
        fontStyle: { weight: 700 }
      })
      .addText(`From:`)
      .build();

      const businessNameParagraph = Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Left,
      })
      .pushStyle({ 
        color: Skia.Color('black'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 9, 
        fontStyle: { weight: 700 }
      })
      .addText(`${business?.business_name || 'Hello mate'}`)
      .build();

      const businessAddress1Paragraph = Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Left,
      })
      .pushStyle({ 
        color: Skia.Color('black'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 9, 
        fontStyle: { weight: 400 }
      })
      .addText(`${business?.business_address?.split('\n')[0] || '101'}`)
      .build();

      const businessAddress2Paragraph = Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Left,
      })
      .pushStyle({ 
        color: Skia.Color('black'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 9, 
        fontStyle: { weight: 400 }
      })
      .addText(`${business?.business_address?.split('\n')[1] || 'Beefy Road'}`)
      .build();

      const businessAddress3Paragraph = Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Left,
      })
      .pushStyle({ 
        color: Skia.Color('black'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 9, 
        fontStyle: { weight: 400 }
      })
      .addText(`${business?.business_address?.split('\n')[2] || 'Rochester'}`)
      .build();

      const businessAddress4Paragraph = Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Left,
      })
      .pushStyle({ 
        color: Skia.Color('black'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 9, 
        fontStyle: { weight: 400 }
      })
      .addText(`${business?.business_address?.split('\n')[3] || 'Uk'}`)
      .build();

      // Totals paragraphs - separate labels and values for better spacing
      const subtotalLabelParagraph = Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Left,
      })
      .pushStyle({ 
        color: Skia.Color('black'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 9, 
        fontStyle: { weight: 700 }
      })
      .addText(`Subtotal:`)
      .build();

      const subtotalValueParagraph = Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Right,
      })
      .pushStyle({ 
        color: Skia.Color('black'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 9, 
        fontStyle: { weight: 400 }
      })
      .addText(`${currencySymbol}${(invoice?.subtotal_amount || 400.00).toFixed(2)}`)
      .build();

      // Discount paragraphs (conditional - only if discount exists)
      const discountLabelParagraph = hasDiscount ? Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Left,
      })
      .pushStyle({ 
        color: Skia.Color('black'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 9, 
        fontStyle: { weight: 700 }
      })
      .addText(`Discount${invoice.discount_type === 'percentage' ? ` (${invoice.discount_value}%)` : ''}:`)
      .build() : null;

      const discountValueParagraph = hasDiscount ? Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Right,
      })
      .pushStyle({ 
        color: Skia.Color('black'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 9, 
        fontStyle: { weight: 400 }
      })
      .addText(`-${currencySymbol}${discountAmount.toFixed(2)}`)
      .build() : null;

      const taxLabelParagraph = Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Left,
      })
      .pushStyle({ 
        color: Skia.Color('black'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 9, 
        fontStyle: { weight: 700 }
      })
      .addText(`${business?.tax_name || 'Tax'} (${invoice?.tax_percentage || 20}%):`)
      .build();

      const taxValueParagraph = Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Right,
      })
      .pushStyle({ 
        color: Skia.Color('black'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 9, 
        fontStyle: { weight: 400 }
      })
      .addText(`${currencySymbol}${(((invoice?.subtotal_amount || 400.00) - discountAmount) * ((invoice?.tax_percentage || 20) / 100)).toFixed(2)}`)
      .build();

      const totalLabelParagraph = Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Left,
      })
      .pushStyle({ 
        color: Skia.Color('black'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 10, // +1 bigger than other totals
        fontStyle: { weight: 700 }
      })
      .addText(`Total:`)
      .build();

      const totalValueParagraph = Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Right,
      })
      .pushStyle({ 
        color: Skia.Color('black'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 10, // +1 bigger than other totals
        fontStyle: { weight: 700 }
      })
      .addText(`${currencySymbol}${(invoice?.total_amount || 480.00).toFixed(2)}`)
      .build();

      // Payment status paragraphs (conditional - only if payment has been made)
      const hasPaidAmount = invoice?.paid_amount && invoice.paid_amount > 0;
      
      console.log('[SkiaInvoiceCanvas] Payment Status Debug:', {
        hasPaidAmount,
        paid_amount: invoice?.paid_amount,
        total_amount: invoice?.total_amount,
        balance_due: (invoice?.total_amount || 0) - (invoice?.paid_amount || 0)
      });
      
      const paidLabelParagraph = hasPaidAmount ? Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Left,
      })
      .pushStyle({ 
        color: Skia.Color('black'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 9, 
        fontStyle: { weight: 700 }
      })
      .addText(`Paid:`)
      .build() : null;

      const paidValueParagraph = hasPaidAmount ? Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Right,
      })
      .pushStyle({ 
        color: Skia.Color('#10B981'), // Green color for paid amount
        fontFamilies: ['Helvetica'], 
        fontSize: 9, 
        fontStyle: { weight: 400 }
      })
      .addText(`-${currencySymbol}${(invoice?.paid_amount || 0).toFixed(2)}`)
      .build() : null;

      // Balance Due as regular line item (conditional - only if payment exists)
      const balanceDueLabelParagraph = hasPaidAmount ? Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Left,
      })
      .pushStyle({ 
        color: Skia.Color('black'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 9, 
        fontStyle: { weight: 700 }
      })
      .addText(`Balance Due:`)
      .build() : null;

      const balanceDueValueParagraph = hasPaidAmount ? Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Right,
      })
      .pushStyle({ 
        color: Skia.Color('black'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 9, 
        fontStyle: { weight: 400 }
      })
      .addText(`${currencySymbol}${((invoice?.total_amount || 0) - (invoice?.paid_amount || 0)).toFixed(2)}`)
      .build() : null;

      return { 
        invoiceParagraph, 
        refParagraph, 
        dateParagraph, 
        dueParagraph, 
        poParagraph,
        billToParagraph, 
        clientNameParagraph, 
        clientAddress1Paragraph,
        clientAddress2Paragraph,
        clientAddress3Paragraph,
        clientTaxNumberParagraph,
        fromLabelParagraph,
        businessNameParagraph,
        businessAddress1Paragraph,
        businessAddress2Paragraph,
        businessAddress3Paragraph,
        businessAddress4Paragraph,
        subtotalLabelParagraph,
        subtotalValueParagraph,
        discountLabelParagraph,
        discountValueParagraph,
        taxLabelParagraph,
        taxValueParagraph,
        totalLabelParagraph,
        totalValueParagraph,
        paidLabelParagraph,
        paidValueParagraph,
        balanceDueLabelParagraph,
        balanceDueValueParagraph
      };
    } catch (e) {
      console.log('Paragraph creation failed:', e);
      return null;
    }
  }, [scaledFonts, invoice, business, client, hasDiscount, discountAmount]);

  // Logo handling
  const logoImage = useImage(business?.business_logo_url);
  
  // Payment card icons - using local assets
  const visaIcon = useImage(require('../../assets/visaicon.png'));
  const mastercardIcon = useImage(require('../../assets/mastercardicon.png'));
  const paypalIcon = useImage(require('../../assets/paypalicon.png'));

  // Original design colors
  const colors = {
    background: '#fff',
    text: 'black',
    border: '#eee',
    greenAccent: 'rgba(76, 175, 80, 0.15)', // Original green background
    shadow: '#f0f0f0',
    orange: '#ff8c00' // For logo
  };

  if (!scaledFonts.body || !scaledFonts.title || !scaledFonts.small) {
    console.log('[SkiaInvoiceCanvas] Fonts not available, skipping render');
    return <View style={[styles.container, style]} />;
  }

  // EXACT column positions with coordinate offset compensation
  const padding = renderSinglePage !== undefined ? 4 : 20; // Minimal padding for export test
  const tableX = OFFSET_X + padding;
  const tableWidth = USABLE_WIDTH - (padding * 2);
  
  // Column widths based on visual analysis of original
  const qtyWidth = 30;
  const descWidth = 160;
  const priceWidth = 80;
  const totalWidth = 80;
  
  // Column X positions
  const qtyX = tableX;
  const descX = qtyX + qtyWidth;
  const priceX = descX + descWidth;
  const totalX = priceX + priceWidth;

  // Format date helper
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-GB');
    } catch {
      return dateString;
    }
  };

  // Extract initials from business name
  const getBusinessInitials = (businessName: string): string => {
    if (!businessName) return 'B';
    
    const words = businessName.trim().split(/\s+/);
    if (words.length === 1) {
      // Single word - take first two characters
      return words[0].substring(0, 2).toUpperCase();
    } else {
      // Multiple words - take first letter of first two words
      return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
    }
  };

  const businessInitials = getBusinessInitials(business?.business_name || 'Hello mate');

  // Calculate footer positioning based on where line items actually end
  const lineItemsEndY = scaledFirstItemY + (actualFirstPageItems.length * scaledRowHeight) + 15; // 15px buffer
  const footerY = Math.max(lineItemsEndY, 350); // Minimum 350px to avoid overlap with meta section
  console.log(`[SkiaInvoiceCanvas] POSITIONING: lineItemsEndY=${lineItemsEndY}, footerY=${footerY}, items=${actualFirstPageItems.length}`);

  // Calculate dynamic positioning for Payment Methods based on notes
  const notesLineCount = invoice?.notes ? invoice.notes.split('\n').filter(line => line.trim()).length : 0;
  const singlePageNotesHeight = invoice?.notes ? (15 + (notesLineCount * 12) + 10) : 0; // Header + lines + spacing
  const paymentMethodsY = footerY + 20 + singlePageNotesHeight;

  return (
          <View style={[styles.container, style, renderSinglePage !== undefined && { padding: 0, margin: 0, backgroundColor: 'transparent' }]}>
      <View style={[styles.pageContainer, renderSinglePage !== undefined && { flex: 0, alignItems: 'stretch', padding: 0, margin: 0, backgroundColor: 'transparent' }]}>
        <Canvas 
          style={{ width: canvasWidth, height: totalCanvasHeight, backgroundColor: 'transparent' }} 
          ref={ref}
          mode="default"
        >
          {/* === PAGE 1 === */}
          {/* Container background */}
          <Rect x={0} y={0} width={canvasWidth} height={canvasHeight} color={colors.background} />
          

          
          {/* BORDER - Full canvas edge-to-edge border */}
            <Rect x={0} y={0} width={canvasWidth} height={2} color="black" />
            <Rect x={0} y={0} width={2} height={totalCanvasHeight} color="black" />
            <Rect x={canvasWidth - 2} y={0} width={2} height={totalCanvasHeight} color="black" />
            <Rect x={0} y={totalCanvasHeight - 2} width={canvasWidth} height={2} color="black" />
          
          {/* === HEADER SECTION === */}
          
          {/* Left: Business Logo */}
          {logoImage && business?.business_logo_url ? (
            <Image 
              image={logoImage} 
              x={OFFSET_X + 27} 
              y={22} 
              width={65} 
              height={65} 
              fit="contain"
            />
          ) : (
            <>
              {/* Fallback logo with dynamic business initials */}
              <Circle cx={OFFSET_X + 59} cy={55} r={32} color={colors.orange} />
              <Text 
                x={OFFSET_X + (businessInitials.length === 1 ? 51 : 45)} 
                y={64} 
                text={businessInitials} 
                font={businessInitials.length === 1 ? scaledFonts.title : scaledFonts.large} 
                color="white" 
              />
            </>
          )}
          
          {/* Right: Invoice title and RIGHT-ALIGNED details using Paragraph */}
          {/* Remove old text element - now using paragraph */}
          
          {/* RIGHT-ALIGNED paragraphs using Skia's TextAlign.Right */}
          {rightAlignedParagraphs && (
            <>
              <Paragraph paragraph={rightAlignedParagraphs.invoiceParagraph} x={OFFSET_X + 160} y={10} width={130} />
              <Paragraph paragraph={rightAlignedParagraphs.refParagraph} x={OFFSET_X + 160} y={30} width={130} />
              <Paragraph paragraph={rightAlignedParagraphs.dateParagraph} x={OFFSET_X + 160} y={45} width={130} />
              <Paragraph paragraph={rightAlignedParagraphs.dueParagraph} x={OFFSET_X + 160} y={60} width={130} />
            </>
          )}
          
          {/* PO Number - conditional */}
          {rightAlignedParagraphs && rightAlignedParagraphs.poParagraph && (
            <Paragraph paragraph={rightAlignedParagraphs.poParagraph} x={OFFSET_X + 160} y={75} width={130} />
          )}
          
          {/* === META SECTION === */}
          
          {/* Left: From section */}
          {rightAlignedParagraphs && (
            <>
              <Paragraph paragraph={rightAlignedParagraphs.fromLabelParagraph} x={OFFSET_X + 27} y={105} width={150} />
              <Paragraph paragraph={rightAlignedParagraphs.businessNameParagraph} x={OFFSET_X + 27} y={117} width={150} />
              <Paragraph paragraph={rightAlignedParagraphs.businessAddress1Paragraph} x={OFFSET_X + 27} y={129} width={150} />
              <Paragraph paragraph={rightAlignedParagraphs.businessAddress2Paragraph} x={OFFSET_X + 27} y={141} width={150} />
              <Paragraph paragraph={rightAlignedParagraphs.businessAddress3Paragraph} x={OFFSET_X + 27} y={153} width={150} />
              <Paragraph paragraph={rightAlignedParagraphs.businessAddress4Paragraph} x={OFFSET_X + 27} y={165} width={150} />
            </>
          )}
          
          {/* Right: Bill To section using RIGHT-ALIGNED paragraphs */}
          {rightAlignedParagraphs && (
            <>
              <Paragraph paragraph={rightAlignedParagraphs.billToParagraph} x={220} y={105} width={130} />
              <Paragraph paragraph={rightAlignedParagraphs.clientNameParagraph} x={220} y={117} width={130} />
              <Paragraph paragraph={rightAlignedParagraphs.clientAddress1Paragraph} x={220} y={129} width={130} />
              <Paragraph paragraph={rightAlignedParagraphs.clientAddress2Paragraph} x={220} y={141} width={130} />
              <Paragraph paragraph={rightAlignedParagraphs.clientAddress3Paragraph} x={220} y={153} width={130} />
              <Paragraph paragraph={rightAlignedParagraphs.clientTaxNumberParagraph} x={220} y={165} width={130} />
            </>
          )}
          
          {/* === LINE ITEMS TABLE - PAGE 1 === */}
          {/* Table header with green background */}
          <Rect x={tableX} y={180} width={tableWidth + 5} height={25} color={colors.greenAccent} />
          
          {/* Table headers - PERFECTLY ALIGNED */}
          <Text x={qtyX + 10} y={197} text="QTY" font={scaledFonts.bodyBold} color={colors.text} />
          <Text x={descX + 5} y={197} text="DESCRIPTION" font={scaledFonts.bodyBold} color={colors.text} />
          <Text x={priceX + 35} y={197} text="PRICE" font={scaledFonts.bodyBold} color={colors.text} />
          <Text x={totalX + 32} y={197} text="TOTAL" font={scaledFonts.bodyBold} color={colors.text} />
          
          {/* Line Items - First Page */}
          {actualFirstPageItems.map((item: any, index: number) => {
            const rowY = scaledFirstItemY + (index * scaledRowHeight);
            
            // Create paragraphs with same font as business address (fontSize: 9, weight: 400)
            const qtyParagraph = Skia.ParagraphBuilder.Make({
              textAlign: TextAlign.Center,
            })
            .pushStyle({ 
              color: Skia.Color('black'), 
              fontFamilies: ['Helvetica'], 
              fontSize: 9, 
              fontStyle: { weight: 400 }
            })
            .addText(item.quantity.toString())
            .build();

            const nameParagraph = Skia.ParagraphBuilder.Make({
              textAlign: TextAlign.Left,
            })
            .pushStyle({ 
              color: Skia.Color('black'), 
              fontFamilies: ['Helvetica'], 
              fontSize: 9, 
              fontStyle: { weight: 400 }
            })
            .addText(item.item_name)
            .build();

            const priceParagraph = Skia.ParagraphBuilder.Make({
              textAlign: TextAlign.Left,
            })
            .pushStyle({ 
              color: Skia.Color('black'), 
              fontFamilies: ['Helvetica'], 
              fontSize: 9, 
              fontStyle: { weight: 400 }
            })
            .addText(`${currencySymbol}${item.unit_price.toFixed(2)}`)
            .build();

            const totalParagraph = Skia.ParagraphBuilder.Make({
              textAlign: TextAlign.Left,
            })
            .pushStyle({ 
              color: Skia.Color('black'), 
              fontFamilies: ['Helvetica'], 
              fontSize: 9, 
              fontStyle: { weight: 400 }
            })
            .addText(`${currencySymbol}${item.total_price.toFixed(2)}`)
            .build();
            
            return (
              <React.Fragment key={index}>
                {/* QTY - center aligned in column using Paragraph */}
                <Paragraph 
                  paragraph={qtyParagraph} 
                  x={qtyX} 
                  y={rowY + textOffsetY - 4} 
                  width={30} 
                />
                
                {/* Description - left aligned using Paragraph */}
                <Paragraph 
                  paragraph={nameParagraph} 
                  x={descX + 5} 
                  y={rowY + textOffsetY - 4} 
                  width={160} 
                />
                
                {/* Item description subtitle - smaller gray text */}
                {item.item_description && (
                  <Text 
                    x={descX + 5 + (item.item_name.length * 6)} 
                    y={rowY + textOffsetY} 
                    text={` (${item.item_description})`} 
                    font={scaledFonts.tiny} 
                    color="#999" 
                  />
                )}
                
                {/* Price - left aligned using Paragraph */}
                <Paragraph 
                  paragraph={priceParagraph} 
                  x={priceX + 5} 
                  y={rowY + textOffsetY - 4} 
                  width={80} 
                />
                
                {/* Total - left aligned using Paragraph */}
                <Paragraph 
                  paragraph={totalParagraph} 
                  x={totalX + 5} 
                  y={rowY + textOffsetY - 4} 
                  width={80} 
                />
              </React.Fragment>
            );
          })}

          {/* === FOOTER SECTION (only on single page invoices) === */}
          {!actualNeedsPagination && (
            <>
              {/* Left: Notes and Payment Methods */}
              {invoice?.notes && (
                <>
                  <Text x={27} y={footerY + 15} text="Terms, Instructions & Notes" font={scaledFonts.bodyBold} color={colors.text} />
                  {(() => {
                    // Word wrapping function for terms/notes text
                    const wrapText = (text: string, maxWidth: number = 36) => {
                      const words = text.split(' ');
                      const lines = [];
                      let currentLine = '';
                      
                      for (const word of words) {
                        const testLine = currentLine ? `${currentLine} ${word}` : word;
                        if (testLine.length <= maxWidth) {
                          currentLine = testLine;
                        } else {
                          if (currentLine) {
                            lines.push(currentLine);
                            currentLine = word;
                          } else {
                            lines.push(word); // Single word longer than max width
                          }
                        }
                      }
                      if (currentLine) {
                        lines.push(currentLine);
                      }
                      return lines;
                    };
                    
                    // Process all notes text and wrap it
                    const allNotesText = invoice.notes.replace(/\n/g, ' ').trim();
                    const wrappedLines = wrapText(allNotesText, 36); // ~50% width constraint
                    
                    return wrappedLines.map((line, index) => (
                      <Text 
                        key={index}
                        x={27} 
                        y={footerY + 27 + (index * 12)} 
                        text={line} 
                        font={scaledFonts.body} 
                        color={colors.text} 
                      />
                    ));
                  })()}
                </>
              )}
              
              {/* Payment Methods - Dynamic based on invoice flags */}
              {(invoice?.stripe_active || invoice?.paypal_active || invoice?.bank_account_active) && (
                <>
                  <Text x={27} y={paymentMethodsY} text="Payment Methods" font={scaledFonts.bodyBold} color={colors.text} />
                  
                  {/* Stripe Payment Method */}
                  {invoice?.stripe_active && (
                    <>
                      <Text x={27} y={paymentMethodsY + 14} text="Pay Online" font={scaledFonts.body} color={colors.text} />
                      
                      {/* Add Visa icon - inline with Pay Online text */}
                      {visaIcon && (
                        <Image 
                          image={visaIcon} 
                          x={85} 
                          y={paymentMethodsY + 6} 
                          width={24} 
                          height={14} 
                          fit="contain"
                        />
                      )}
                      
                      {/* Add Mastercard icon - inline with Pay Online text */}
                      {mastercardIcon && (
                        <Image 
                          image={mastercardIcon} 
                          x={110} 
                          y={paymentMethodsY + 6} 
                          width={24} 
                          height={14} 
                          fit="contain"
                        />
                      )}
                      
                      <Text x={27} y={paymentMethodsY + 26} text="www.stripelink.com" font={scaledFonts.body} color={colors.text} />
                    </>
                  )}
                  
                  {/* PayPal Payment Method */}
                  {invoice?.paypal_active && (
                    <>
                      <Text x={27} y={paymentMethodsY + (invoice?.stripe_active ? 40 : 14)} text="Pay with PayPal" font={scaledFonts.body} color={colors.text} />
                      
                      {/* PayPal icon inline with text */}
                      {paypalIcon && (
                        <Image 
                          image={paypalIcon} 
                          x={109} 
                          y={paymentMethodsY + (invoice?.stripe_active ? 32 : 6)} 
                          width={24} 
                          height={16} 
                          fit="contain"
                        />
                      )}
                      
                      {(() => {
                        const paypalEmail = business?.paypal_email || 'nobones@gmail.com';
                        const constrainedEmail = paypalEmail.length > 25 ? paypalEmail.substring(0, 22) + '...' : paypalEmail;
                        return (
                          <Text 
                            key="paypal-email"
                            x={27} 
                            y={paymentMethodsY + (invoice?.stripe_active ? 52 : 26)} 
                            text={constrainedEmail} 
                            font={scaledFonts.body} 
                            color={colors.text} 
                          />
                        );
                      })()}
                    </>
                  )}
                  
                  {/* Bank Transfer Payment Method */}
                  {invoice?.bank_account_active && (
                    <>
                      {(() => {
                        const baseY = paymentMethodsY + 14 + 
                          (invoice?.stripe_active ? 26 : 0) + 
                          (invoice?.paypal_active ? 38 : 0);
                        
                        const bankDetails = business?.bank_details || 'Bank 1\n1 2457 5 6 5 500598 32\nU EA';
                        const bankLines = bankDetails.split('\n');
                        
                        return (
                          <>
                            <Text x={27} y={baseY} text="Bank Transfer" font={scaledFonts.bodyBold} color="black" />
                            {bankLines.map((line, index) => {
                              // Constrain bank details to 50% width and match terms spacing
                              const constrainedLine = line.trim().length > 25 ? line.trim().substring(0, 22) + '...' : line.trim();
                              return (
                                <Text 
                                  key={index}
                                  x={27} 
                                  y={baseY + 12 + (index * 12)} 
                                  text={constrainedLine} 
                                  font={scaledFonts.body} 
                                  color={colors.text} 
                                />
                              );
                            })}
                          </>
                        );
                      })()}
                    </>
                  )}
                </>
              )}
              
              {/* Right: Totals section aligned with Terms section */}
              
              {rightAlignedParagraphs ? (
                <>
                  {/* Subtotal row */}
                  <Paragraph paragraph={rightAlignedParagraphs.subtotalLabelParagraph} x={220} y={footerY + 15} width={70} />
                  <Paragraph paragraph={rightAlignedParagraphs.subtotalValueParagraph} x={290} y={footerY + 15} width={60} />
                  
                  {/* Discount row (conditional) */}
                  {rightAlignedParagraphs.discountLabelParagraph ? (
                    <>
                      <Paragraph paragraph={rightAlignedParagraphs.discountLabelParagraph} x={220} y={footerY + 35} width={70} />
                      <Paragraph paragraph={rightAlignedParagraphs.discountValueParagraph} x={290} y={footerY + 35} width={60} />
                    </>
                  ) : null}
                  
                  {/* Tax row - adjusts position based on discount presence */}
                  <Paragraph paragraph={rightAlignedParagraphs.taxLabelParagraph} x={220} y={footerY + (hasDiscount ? 55 : 35)} width={70} />
                  <Paragraph paragraph={rightAlignedParagraphs.taxValueParagraph} x={290} y={footerY + (hasDiscount ? 55 : 35)} width={60} />
                  
                  {/* Paid row (conditional - between VAT and Balance Due) */}
                  {rightAlignedParagraphs.paidLabelParagraph ? (
                    <>
                      <Paragraph paragraph={rightAlignedParagraphs.paidLabelParagraph} x={220} y={footerY + (hasDiscount ? 75 : 55)} width={70} />
                      <Paragraph paragraph={rightAlignedParagraphs.paidValueParagraph} x={290} y={footerY + (hasDiscount ? 75 : 55)} width={60} />
                      
                      {/* Balance Due row (directly under Paid) */}
                      <Paragraph paragraph={rightAlignedParagraphs.balanceDueLabelParagraph} x={220} y={footerY + (hasDiscount ? 95 : 75)} width={70} />
                      <Paragraph paragraph={rightAlignedParagraphs.balanceDueValueParagraph} x={290} y={footerY + (hasDiscount ? 95 : 75)} width={60} />
                    </>
                  ) : null}
                </>
              ) : null}
              
              {/* Grand Total Box with green background - positioned after Balance Due line if present */}
              <Rect x={220} y={footerY + (hasDiscount ? 95 : 75) + (rightAlignedParagraphs?.paidLabelParagraph ? 25 : 10)} width={135} height={20} color={colors.greenAccent} />
              
              {rightAlignedParagraphs ? (
                <>
                  <Paragraph paragraph={rightAlignedParagraphs.totalLabelParagraph} x={220} y={footerY + (hasDiscount ? 100 : 80) + (rightAlignedParagraphs?.paidLabelParagraph ? 25 : 10)} width={70} />
                  <Paragraph paragraph={rightAlignedParagraphs.totalValueParagraph} x={288} y={footerY + (hasDiscount ? 100 : 80) + (rightAlignedParagraphs?.paidLabelParagraph ? 25 : 10)} width={65} />
                </>
              ) : null}
            </>
          )}
        </Canvas>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f5f5f5',
    padding: 10,
    flex: 1
  },
  pageContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    padding: 0,
    flex: 1,
    alignItems: 'center'
  }
});

export default SkiaInvoiceCanvas;