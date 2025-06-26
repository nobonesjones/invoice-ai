import React, { useMemo, forwardRef, RefObject } from 'react';
import { Canvas, Rect, Text, Skia, matchFont, Circle, Paragraph, TextAlign, Image, useImage, Group } from '@shopify/react-native-skia';
import { View, StyleSheet, Platform } from 'react-native';

interface SkiaInvoiceCanvasProps {
  invoice?: any;
  business?: any;
  client?: any;
  currencySymbol?: string;
  style?: any;
  renderSinglePage?: number; // NEW: If provided, only render this specific page (0-indexed)
  exportPageNumber?: number; // NEW: For export - render only this page (1-indexed) at standard size
  accentColor?: string; // NEW: Dynamic accent color for customization
  displaySettings?: {
    show_business_logo?: boolean;
    show_business_name?: boolean;
    show_business_address?: boolean;
    show_business_tax_number?: boolean;
    show_notes_section?: boolean;
  };
}

const SkiaInvoiceCanvasModern = forwardRef((props: SkiaInvoiceCanvasProps, ref: any) => {
  const { 
    invoice, 
    business, 
    client, 
    currencySymbol = '£',
    style,
    renderSinglePage,
    exportPageNumber,
    accentColor = '#14B8A6', // Default turquoise
    displaySettings = {
      show_business_logo: true,
      show_business_name: true,
      show_business_address: true,
      show_business_tax_number: true,
      show_notes_section: true,
    }
  } = props;
  console.log('[SkiaInvoiceCanvasModern] Rendering Modern Design');

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
  console.log('[SkiaInvoiceCanvas] DEBUG: devicePixelRatio =', devicePixelRatio);
  
  // Try larger canvas for better text quality
  const renderScale = 2; // 2x larger canvas for crisp text
  const baseCanvasWidth = renderSinglePage !== undefined ? (style?.width || 200) * renderScale : (style?.width || 370); // Respect style prop
  const baseCanvasHeight = renderSinglePage !== undefined ? (style?.height || 250) * renderScale : (style?.height || 560); // Respect style prop
  
  console.log('[SkiaInvoiceCanvas] DEBUG - renderSinglePage:', renderSinglePage);
  console.log('[SkiaInvoiceCanvas] DEBUG - style?.width:', style?.width);
  console.log('[SkiaInvoiceCanvas] DEBUG - style?.height:', style?.height);
  console.log('[SkiaInvoiceCanvas] DEBUG - baseCanvasWidth:', baseCanvasWidth);
  console.log('[SkiaInvoiceCanvas] DEBUG - baseCanvasHeight:', baseCanvasHeight);
  
  // COORDINATE OFFSET: No offset needed for smaller Canvas
  const OFFSET_X = 0; // No left margin needed
  const OFFSET_RIGHT = 0; // No right margin needed  
  const USABLE_WIDTH = baseCanvasWidth;
  
  console.log('[SkiaInvoiceCanvas] Canvas fix - Original:', baseCanvasWidth, 'Usable:', USABLE_WIDTH, 'Offset:', OFFSET_X);
  
  const canvasWidth = baseCanvasWidth;
  // Reduce individual page section height for multi-page invoices to fit better in PDF
  const canvasHeight = actualNeedsPagination ? 480 : baseCanvasHeight; // 80px shorter sections for multi-page
  
  // Pagination calculations with original spacing
  const itemRowHeight = 20;
  const tableHeaderY = 180;
  const tableHeaderHeight = 25;
  const firstItemY = 210;
  const footerStartY = 410; // Back to original footer position that looked good
  
  // Calculate how many items fit on first page
  const availableSpaceFirstPage = footerStartY - firstItemY;
  const maxItemsFirstPage = Math.floor(availableSpaceFirstPage / itemRowHeight); // Restored proper calculation - was: 5
  
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
    },
    {
      quantity: 2,
      item_name: "Web Development",
      item_description: "Frontend development services",
      unit_price: 150.00,
      total_price: 300.00
    },
    {
      quantity: 1,
      item_name: "UI/UX Design",
      item_description: "User interface design",
      unit_price: 120.00,
      total_price: 120.00
    },
    {
      quantity: 3,
      item_name: "Consulting",
      item_description: "Technical consulting",
      unit_price: 80.00,
      total_price: 240.00
    },
    {
      quantity: 1,
      item_name: "Project Management",
      item_description: "Project oversight",
      unit_price: 100.00,
      total_price: 100.00
    },
    {
      quantity: 2,
      item_name: "Testing",
      item_description: "Quality assurance",
      unit_price: 60.00,
      total_price: 120.00
    },
    {
      quantity: 1,
      item_name: "Deployment",
      item_description: "Production deployment",
      unit_price: 90.00,
      total_price: 90.00
    },
    {
      quantity: 4,
      item_name: "Training",
      item_description: "User training sessions",
      unit_price: 50.00,
      total_price: 200.00
    },
    {
      quantity: 1,
      item_name: "Documentation",
      item_description: "Technical documentation",
      unit_price: 70.00,
      total_price: 70.00
    },
    {
      quantity: 2,
      item_name: "Maintenance",
      item_description: "Ongoing maintenance",
      unit_price: 40.00,
      total_price: 80.00
    },
    {
      quantity: 1,
      item_name: "Security Audit",
      item_description: "Security assessment",
      unit_price: 130.00,
      total_price: 130.00
    },
    {
      quantity: 3,
      item_name: "Performance Optimization",
      item_description: "Speed improvements",
      unit_price: 85.00,
      total_price: 255.00
    },
    {
      quantity: 1,
      item_name: "Database Migration",
      item_description: "Data migration services",
      unit_price: 110.00,
      total_price: 110.00
    },
    {
      quantity: 2,
      item_name: "API Integration",
      item_description: "Third-party API setup",
      unit_price: 95.00,
      total_price: 190.00
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
  const actualNeedsPagination = false ? false : (totalItems > adjustedMaxItemsFirstPage); // TEMP: Always enable pagination for testing
  const actualFirstPageItems = false ? lineItems : lineItems.slice(0, adjustedMaxItemsFirstPage); // TEMP: Always enable pagination for testing
  const actualRemainingItems = false ? [] : lineItems.slice(adjustedMaxItemsFirstPage); // TEMP: Always enable pagination for testing
  
  // Calculate number of pages with adjusted logic
  const totalPages = actualNeedsPagination ? 
    1 + Math.ceil(actualRemainingItems.length / itemsPerSubsequentPage) : 1;
  
  // Calculate total canvas height for all pages
  const separatorHeight = actualNeedsPagination ? 30 * (totalPages - 1) : 0; // 30px separator between each page
  
  // EXPORT MODE: Override canvas dimensions and pagination for export
  let finalCanvasHeight = totalCanvasHeight;
  let exportFirstPageItems = actualFirstPageItems;
  let exportRemainingItems = actualRemainingItems;
  let showExportFooter = false;
  
  if (exportPageNumber) {
    console.log(`[SkiaInvoiceCanvas] EXPORT MODE: Rendering page ${exportPageNumber} of ${totalPages}`);
    
    // Force standard single-page canvas size for export
    finalCanvasHeight = 560; // Standard single page height
    
    if (exportPageNumber === 1) {
      // Page 1: header + first page items only (no footer)
      exportFirstPageItems = actualFirstPageItems;
      exportRemainingItems = [];
      showExportFooter = false;
    } else if (exportPageNumber <= totalPages) {
      // Page 2+: header + specific page items + footer (on last page only)
      const pageIndex = exportPageNumber - 2; // Page 2 = index 0, Page 3 = index 1, etc.
      const startIndex = pageIndex * itemsPerSubsequentPage;
      const endIndex = startIndex + itemsPerSubsequentPage;
      const thisPageItems = actualRemainingItems.slice(startIndex, endIndex);
      
      exportFirstPageItems = thisPageItems; // Render these as "first page" items
      exportRemainingItems = [];
      showExportFooter = (exportPageNumber === totalPages); // Only show footer on last page
      
      console.log(`[SkiaInvoiceCanvas] EXPORT PAGE ${exportPageNumber}: items ${startIndex}-${endIndex}, showFooter=${showExportFooter}`);
    }
  }
  
  // EXPORT TEST: Force single page if renderSinglePage is provided, otherwise use pagination logic
  const totalCanvasHeight = exportPageNumber ? finalCanvasHeight : // Use export height if in export mode
    (false ? baseCanvasHeight : // TEMP: Always enable pagination for testing
    (actualNeedsPagination ? 
      ((totalPages * canvasHeight) + separatorHeight + 30) : 
      (totalItems >= 12 ? 800 : 560)));
  
  console.log(`[SkiaInvoiceCanvas] PAGINATION: Items=${totalItems}, IsTwoPage=${isTwoPageInvoice}, MaxFirst=${adjustedMaxItemsFirstPage}, Pages=${totalPages}, Compact=${isCompactMode}, Scale=${scaleFactor}`);
  console.log(`[SkiaInvoiceCanvas] HEIGHT: base=${canvasHeight}, final=${totalCanvasHeight} (matching display exactly)`);
  console.log(`[SkiaInvoiceCanvas] HEIGHT DEBUG:`, {
    actualNeedsPagination,
    totalPages,
    canvasHeight,
    separatorHeight,
    calculation: actualNeedsPagination ? ((totalPages * canvasHeight) + separatorHeight + 30) : (totalItems >= 12 ? 800 : 560),
    'totalPages * canvasHeight': totalPages * canvasHeight,
    'final formula': `((${totalPages} * ${canvasHeight}) + ${separatorHeight} + 30) = ${((totalPages * canvasHeight) + separatorHeight + 30)}`
  });
  console.log(`[SkiaInvoiceCanvas] RENDER_SINGLE_PAGE: ${renderSinglePage}, actualNeedsPagination: ${actualNeedsPagination}, actualFirstPageItems: ${actualFirstPageItems.length}`);
  console.log(`[SkiaInvoiceCanvas] PAGINATION DEBUG:`, {
    availableSpaceFirstPage,
    itemRowHeight,
    maxItemsFirstPage,
    scaledRowHeight,
    itemsPerSubsequentPage,
    totalItems,
    actualRemainingItems: actualRemainingItems.length,
    'footerStartY - firstItemY': footerStartY - firstItemY
  });
  console.log(`[SkiaInvoiceCanvas] BORDER: canvasWidth=${canvasWidth}, totalCanvasHeight=${totalCanvasHeight}, borderRect should be: x=10.5, y=10.5, width=${canvasWidth - 21}, height=${totalCanvasHeight - 21}`);
  console.log(`[SkiaInvoiceCanvas] BORDER: canvasWidth=${canvasWidth}, totalCanvasHeight=${totalCanvasHeight}, borderRect: x=10.5, y=10.5, width=${canvasWidth - 21}, height=${totalCanvasHeight - 21}`);

  // Calculate discount values outside useMemo so they can be used in both places
  const hasDiscount = invoice?.discount_value && invoice?.discount_value > 0;
  const discountAmount = hasDiscount ? (
    invoice.discount_type === 'percentage' 
      ? (invoice.subtotal_amount || 400.00) * (invoice.discount_value / 100)
      : invoice.discount_value
  ) : 0;

  // Create exact font system matching original design typography with fallbacks
  const fonts = useMemo(() => {
      const fontFamily = Platform.select({ 
        ios: "Helvetica", 
        android: "sans-serif",
        default: "sans-serif" 
      });

    // Helper function to create font with fallback
    const createFontWithFallback = (fontSize: number, fontWeight: "normal" | "bold" = "normal") => {
      // Try multiple font families as fallbacks
      const fallbackFonts = Platform.select({
        ios: ["Helvetica", "Arial", "system"],
        android: ["sans-serif", "Roboto", "system"],
        default: ["sans-serif", "Arial", "serif", "system"]
      });

      for (const fallbackFont of fallbackFonts) {
        try {
          return matchFont({
            fontFamily: fallbackFont,
            fontSize,
            fontStyle: "normal" as const,
            fontWeight: fontWeight as const,
          });
        } catch (e) {
          console.log(`[SkiaInvoiceCanvas] Font ${fallbackFont} failed for ${fontSize}px ${fontWeight}:`, e);
          continue;
        }
      }

      // If all fonts fail, try one last fallback without any font family
      try {
        console.log(`[SkiaInvoiceCanvas] All fonts failed for ${fontSize}px ${fontWeight}, trying system default`);
        return matchFont({
          fontSize,
          fontStyle: "normal" as const,
          fontWeight: fontWeight as const,
        });
      } catch (e) {
        console.log(`[SkiaInvoiceCanvas] Even system default failed, this might be a Skia issue:`, e);
        return null;
      }
    };
      
      return {
        // Original: fontSize: 6, itemSubtitle + textPlaceholder
      tiny: createFontWithFallback(7),
        // Original: fontSize: 7, tableHeader + lineItemCellText  
      small: createFontWithFallback(8),
        // Bold version for table headers
      smallBold: createFontWithFallback(8, "bold"),
        // Original: fontSize: 8, label + text + paymentTermsHeader/Body
      body: createFontWithFallback(9),
        // Original: fontSize: 8, bold labels
      bodyBold: createFontWithFallback(9, "bold"),
        // Original: fontSize: 9, headerTextDetail
      medium: createFontWithFallback(10),
        // Original: fontSize: 10, businessNameText + clientNameText + logoPlaceholder
      large: createFontWithFallback(11, "bold"),
        // Original: fontSize: 16, invoiceLabel  
      title: createFontWithFallback(17, "bold")
      };
  }, []);

  // Scaled fonts for compact mode (9-11 items)
  const scaledFonts = useMemo(() => {
    if (!isCompactMode) return fonts;
    
      const fontFamily = Platform.select({ 
        ios: "Helvetica", 
        android: "sans-serif",
        default: "sans-serif" 
      });
      
    // Helper function to create scaled font with fallback
    const createScaledFontWithFallback = (fontSize: number, fontWeight: "normal" | "bold" = "normal") => {
      // Try multiple font families as fallbacks
      const fallbackFonts = Platform.select({
        ios: ["Helvetica", "Arial", "system"],
        android: ["sans-serif", "Roboto", "system"],
        default: ["sans-serif", "Arial", "serif", "system"]
      });

      for (const fallbackFont of fallbackFonts) {
        try {
          return matchFont({
            fontFamily: fallbackFont,
            fontSize: Math.round(fontSize * scaleFactor),
          fontStyle: "normal" as const,
            fontWeight: fontWeight as const,
          });
        } catch (e) {
          console.log(`[SkiaInvoiceCanvas] Scaled font ${fallbackFont} failed for ${fontSize}px ${fontWeight}:`, e);
          continue;
        }
      }

      // If all fonts fail, try one last fallback without any font family
      try {
        console.log(`[SkiaInvoiceCanvas] All scaled fonts failed for ${fontSize}px ${fontWeight}, trying system default`);
        return matchFont({
          fontSize: Math.round(fontSize * scaleFactor),
          fontStyle: "normal" as const,
          fontWeight: fontWeight as const,
        });
      } catch (e) {
        console.log(`[SkiaInvoiceCanvas] Even system default failed for scaled font, this might be a Skia issue:`, e);
        return null;
      }
    };
    
    return {
      // Scale down fonts by 25% for compact mode
      tiny: createScaledFontWithFallback(7), // 5px
      small: createScaledFontWithFallback(8), // 6px
      smallBold: createScaledFontWithFallback(8, "bold"), // 6px
      body: createScaledFontWithFallback(9), // 7px
      bodyBold: createScaledFontWithFallback(9, "bold"), // 7px
        // Keep header fonts normal size
        medium: fonts.medium,
        large: fonts.large,
        title: fonts.title
      };
  }, [fonts, isCompactMode, scaleFactor]);

  // Create right-aligned paragraphs using Skia's TextAlign.Right
  const rightAlignedParagraphs = useMemo(() => {
    
    try {
      // Header paragraphs
      const invoiceParagraph = Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Right,
      })
      .pushStyle({ 
        color: Skia.Color('white'), // Changed from black to white
        fontFamilies: ['Helvetica'], 
        fontSize: 32, // Made even bigger for maximum impact
        fontStyle: { weight: 700 }
      })
      .addText(`INVOICE`)
      .build();

      const refParagraph = Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Left,
      })
      .pushStyle({ 
        color: Skia.Color('black'), // Changed back to black for body display
        fontFamilies: ['Helvetica'], 
        fontSize: 10, 
        fontStyle: { weight: 400 }
      })
      .addText(`Ref: ${invoice?.invoice_number || 'INV-000000'}`)
      .build();

      const dateParagraph = Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Left,
      })
      .pushStyle({ 
        color: Skia.Color('black'), // Changed back to black for body display
        fontFamilies: ['Helvetica'], 
        fontSize: 10, 
        fontStyle: { weight: 400 }
      })
      .addText(`Date: ${invoice?.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('en-GB') : '03/06/2025'}`)
      .build();

      const dueParagraph = Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Left,
      })
      .pushStyle({ 
        color: Skia.Color('black'), // Changed back to black for body display
        fontFamilies: ['Helvetica'], 
        fontSize: 10, 
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
        textAlign: TextAlign.Left,
      })
      .pushStyle({ 
        color: Skia.Color('black'), // Changed back to black for body display
        fontFamilies: ['Helvetica'], 
        fontSize: 10, 
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
        fontSize: 10, 
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
        fontSize: 10, 
        fontStyle: { weight: 700 }
      })
      .addText(`${client?.name || 'Chill Free Ltd'}`)
      .build();

      // Client address paragraphs - handle both newline and comma-separated formats
      const getClientAddressLines = (address: string | null | undefined): string[] => {
        if (!address) return ['', '', ''];
        
        // If address contains newlines, split on those
        if (address.includes('\n')) {
          const lines = address.split('\n');
          return [
            lines[0] || '',
            lines[1] || '',
            lines[2] || ''
          ];
        }
        
        // If address contains commas, split on those and trim whitespace
        if (address.includes(',')) {
          const lines = address.split(',').map(line => line.trim());
          return [
            lines[0] || '',
            lines[1] || '',
            lines[2] || ''
          ];
        }
        
        // Single line address
        return [address, '', ''];
      };

      const clientAddressLines = getClientAddressLines(client?.address_client);

      const clientAddress1Paragraph = Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Right,
      })
      .pushStyle({ 
        color: Skia.Color('black'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 10, 
        fontStyle: { weight: 400 }
      })
      .addText(clientAddressLines[0])
      .build();

      const clientAddress2Paragraph = Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Right,
      })
      .pushStyle({ 
        color: Skia.Color('black'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 10, 
        fontStyle: { weight: 400 }
      })
      .addText(clientAddressLines[1])
      .build();

      const clientAddress3Paragraph = Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Right,
      })
      .pushStyle({ 
        color: Skia.Color('black'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 10, 
        fontStyle: { weight: 400 }
      })
      .addText(clientAddressLines[2])
      .build();

      const clientTaxNumberParagraph = Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Right,
      })
      .pushStyle({ 
        color: Skia.Color('black'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 10, 
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
        fontSize: 10, 
        fontStyle: { weight: 700 }
      })
      .addText(`From:`)
      .build();

      const businessNameParagraph = Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Right,
      })
      .pushStyle({ 
        color: Skia.Color('white'), // Changed to white for header display
        fontFamilies: ['Helvetica'], 
        fontSize: 16, // Made bigger for prominence in header
        fontStyle: { weight: 700 }
      })
      .addText(`${displaySettings.show_business_name ? (business?.business_name || 'Hello mate') : ''}`)
      .build();

      // Business address for header - single line, same width as INVOICE, smaller text
      const businessAddressHeaderParagraph = Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Right,
      })
      .pushStyle({ 
        color: Skia.Color('white'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 8, 
        fontStyle: { weight: 400 }
      })
      .addText(`${displaySettings.show_business_address && business?.business_address ? business.business_address.replace(/\n/g, ', ') : ''}`)
      .build();

      const businessAddress1Paragraph = Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Left,
      })
      .pushStyle({ 
        color: Skia.Color('black'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 10, 
        fontStyle: { weight: 400 }
      })
      .addText(`${displaySettings.show_business_address && business?.business_address ? business.business_address.split('\n')[0] || '' : ''}`)
      .build();

      const businessAddress2Paragraph = Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Left,
      })
      .pushStyle({ 
        color: Skia.Color('black'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 10, 
        fontStyle: { weight: 400 }
      })
      .addText(`${displaySettings.show_business_address && business?.business_address ? business.business_address.split('\n')[1] || '' : ''}`)
      .build();

      const businessAddress3Paragraph = Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Left,
      })
      .pushStyle({ 
        color: Skia.Color('black'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 10, 
        fontStyle: { weight: 400 }
      })
      .addText(`${displaySettings.show_business_address && business?.business_address ? business.business_address.split('\n')[2] || '' : ''}`)
      .build();

      const businessAddress4Paragraph = Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Left,
      })
      .pushStyle({ 
        color: Skia.Color('black'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 10, 
        fontStyle: { weight: 400 }
      })
      .addText(`${displaySettings.show_business_address && business?.business_address ? business.business_address.split('\n')[3] || '' : ''}`)
      .build();

      const businessTaxNumberParagraph = Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Left,
      })
      .pushStyle({ 
        color: Skia.Color('black'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 10, 
        fontStyle: { weight: 400 }
      })
      .addText(`${displaySettings.show_business_tax_number && business?.tax_number ? `${business?.tax_name || 'Tax'}: ${business.tax_number}` : ''}`)
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
        color: Skia.Color('white'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 10, 
        fontStyle: { weight: 700 }
      })
      .addText(`Total:`)
      .build();

      const totalValueParagraph = Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Right,
      })
      .pushStyle({ 
        color: Skia.Color('white'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 10, 
        fontStyle: { weight: 400 }
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
        businessAddressHeaderParagraph,
        businessAddress1Paragraph,
        businessAddress2Paragraph,
        businessAddress3Paragraph,
        businessAddress4Paragraph,
        businessTaxNumberParagraph,
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

  // Modern design colors - Light black theme with header block
  const colors = {
    background: '#fff',
    text: 'black',
    border: '#eee',
    greenAccent: accentColor, // Dynamic accent color from props
    shadow: '#f0f0f0',
    orange: accentColor, // Dynamic accent color for logo instead of orange
    headerBlock: '#333333' // Light black header block
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
    <View style={[
      styles.container, 
      renderSinglePage !== undefined && { 
        padding: 0, 
        margin: 0, 
        backgroundColor: 'transparent',
        flex: 0,
        width: baseCanvasWidth / renderScale,
        height: baseCanvasHeight / renderScale
      },
      !renderSinglePage && style,
      actualNeedsPagination && { minHeight: totalCanvasHeight + 40 } // Allow container to grow for multi-page
    ]}>
      <View style={[
        styles.pageContainer, 
        renderSinglePage !== undefined && { 
          flex: 0, 
          alignItems: 'stretch', 
          padding: 0, 
          margin: 0, 
          backgroundColor: 'transparent',
          width: baseCanvasWidth / renderScale,
          height: baseCanvasHeight / renderScale
        },
        actualNeedsPagination && { flex: 0, minHeight: totalCanvasHeight + 20 } // Remove flex constraint for multi-page
      ]}>
        <Canvas 
          style={{ width: canvasWidth, height: totalCanvasHeight, backgroundColor: 'transparent' }} 
          ref={ref}
          mode="default"
        >
          {/* === PAGE 1 === */}
          {/* Container background */}
          <Rect x={0} y={0} width={canvasWidth} height={canvasHeight} color={colors.background} />
          
          {/* === MODERN HEADER BLOCK === */}
          {/* Large header block spanning full width */}
          <Rect x={0} y={0} width={canvasWidth} height={95} color={colors.headerBlock} />

          {/* Slim turquoise accent line under header */}
          <Rect x={0} y={95} width={canvasWidth} height={3} color={colors.greenAccent} />
          
          {/* === HEADER SECTION === */}
          
          {/* Left: Business Logo - Centered in header block */}
          {displaySettings.show_business_logo && (
            logoImage && business?.business_logo_url ? (
              <Image 
                image={logoImage} 
                x={OFFSET_X + 27} 
                y={15} 
                width={65} 
                height={65} 
                fit="contain"
              />
            ) : (
              <>
                {/* Fallback logo with dynamic business initials - Centered in header block */}
                <Circle cx={OFFSET_X + 59} cy={47} r={32} color={colors.orange} />
                <Text 
                  x={OFFSET_X + (businessInitials.length === 1 ? 51 : 45)} 
                  y={56} 
                  text={businessInitials} 
                  font={businessInitials.length === 1 ? scaledFonts.title : scaledFonts.large} 
                  color="white" 
                />
              </>
            )
          )}
          
          {/* Right: Invoice title and RIGHT-ALIGNED details using Paragraph */}
          {/* Remove old text element - now using paragraph */}
          
          {/* INVOICE title in header with business name and address below */}
          {rightAlignedParagraphs && (
            <>
              {/* Large right-aligned INVOICE title - Centered in header */}
              <Paragraph paragraph={rightAlignedParagraphs.invoiceParagraph} x={OFFSET_X + 180} y={25} width={190} />
              {/* Business name under INVOICE in header - Centered */}
              <Paragraph paragraph={rightAlignedParagraphs.businessNameParagraph} x={OFFSET_X + 180} y={60} width={190} />
              {/* Business address under business name in header - single line */}
              <Paragraph paragraph={rightAlignedParagraphs.businessAddressHeaderParagraph} x={OFFSET_X + 180} y={75} width={190} />
            </>
          )}
          
          {/* Left side details aligned with client name - Ref, Date, Due, Sales Tax */}
          {rightAlignedParagraphs && (
            <>
              {/* Ref - aligned with Client Name */}
              <Paragraph paragraph={rightAlignedParagraphs.refParagraph} x={OFFSET_X + 27} y={115} width={150} />
              {/* Date */}
              <Paragraph paragraph={rightAlignedParagraphs.dateParagraph} x={OFFSET_X + 27} y={127} width={150} />
              {/* Due */}
              <Paragraph paragraph={rightAlignedParagraphs.dueParagraph} x={OFFSET_X + 27} y={139} width={150} />
              {/* Sales Tax (Business Tax Number) */}
              {rightAlignedParagraphs.businessTaxNumberParagraph && (
                <Paragraph paragraph={rightAlignedParagraphs.businessTaxNumberParagraph} x={OFFSET_X + 27} y={151} width={150} />
              )}
            </>
          )}
          
          {/* PO Number - conditional, after sales tax */}
          {rightAlignedParagraphs && rightAlignedParagraphs.poParagraph && (
            <Paragraph paragraph={rightAlignedParagraphs.poParagraph} x={OFFSET_X + 27} y={163} width={150} />
          )}
          
          {/* === META SECTION === */}
          
          {/* Right: Bill To section with 5px more padding */}
          {rightAlignedParagraphs && (
            <>
              <Paragraph paragraph={rightAlignedParagraphs.billToParagraph} x={OFFSET_X + 240} y={108} width={130} />
              <Paragraph paragraph={rightAlignedParagraphs.clientNameParagraph} x={OFFSET_X + 240} y={120} width={130} />
              <Paragraph paragraph={rightAlignedParagraphs.clientAddress1Paragraph} x={OFFSET_X + 240} y={132} width={130} />
              <Paragraph paragraph={rightAlignedParagraphs.clientAddress2Paragraph} x={OFFSET_X + 240} y={144} width={130} />
              <Paragraph paragraph={rightAlignedParagraphs.clientAddress3Paragraph} x={OFFSET_X + 240} y={156} width={130} />
              <Paragraph paragraph={rightAlignedParagraphs.clientTaxNumberParagraph} x={OFFSET_X + 240} y={168} width={130} />
            </>
          )}
          
          {/* === LINE ITEMS TABLE - PAGE 1 === */}
                     {/* Table header with green background - Full width */}
           <Rect x={0} y={195} width={canvasWidth} height={18} color={colors.greenAccent} />
           
           {/* Table headers - PERFECTLY ALIGNED */}
           {scaledFonts.bodyBold && (
             <>
           <Text x={qtyX + 20} y={208} text="QTY" font={scaledFonts.bodyBold} color="white" />
           <Text x={descX + 30} y={208} text="DESCRIPTION" font={scaledFonts.bodyBold} color="white" />
           <Text x={priceX + 65} y={208} text="PRICE" font={scaledFonts.bodyBold} color="white" />
           <Text x={totalX + 62} y={208} text="TOTAL" font={scaledFonts.bodyBold} color="white" />
             </>
           )}
          
          {/* Line items for the first page */}
          {exportFirstPageItems.map((item: any, index: number) => {
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
                  x={qtyX + 10} 
                  y={rowY + textOffsetY - 4} 
                  width={30} 
                />
                
                {/* Description - left aligned using Paragraph */}
                <Paragraph 
                  paragraph={nameParagraph} 
                  x={descX + 30} 
                  y={rowY + textOffsetY - 4} 
                  width={160} 
                />
                
                {/* Item description subtitle - smaller gray text */}
                {item.item_description && (
                  <Text 
                    x={descX + 30 + (item.item_name.length * 6)} 
                    y={rowY + textOffsetY} 
                    text={` (${item.item_description})`} 
                    font={scaledFonts.tiny} 
                    color="#999" 
                  />
                )}
                
                {/* Price - left aligned using Paragraph */}
                <Paragraph 
                  paragraph={priceParagraph} 
                  x={priceX + 65} 
                  y={rowY + textOffsetY - 4} 
                  width={80} 
                />
                
                {/* Total - left aligned using Paragraph */}
                <Paragraph 
                  paragraph={totalParagraph} 
                  x={totalX + 62} 
                  y={rowY + textOffsetY - 4} 
                  width={80} 
                />
              </React.Fragment>
            );
          })}

          {/* Page number for current page */}
          {actualNeedsPagination && (
            <Text 
              x={canvasWidth - 65} 
              y={canvasHeight - 35} 
              text={exportPageNumber ? `Page ${exportPageNumber}` : "Page 1"} 
              font={scaledFonts.bodyBold} 
              color="black" 
            />
          )}

          {/* === SUBSEQUENT PAGES (Page 2+) === */}
          {!exportPageNumber && actualNeedsPagination && exportRemainingItems.length > 0 && (() => {
            const pages = [];
            let remainingItems = [...exportRemainingItems];
            let currentPage = 2;
            
            while (remainingItems.length > 0) {
              const itemsThisPage = remainingItems.slice(0, itemsPerSubsequentPage);
              remainingItems = remainingItems.slice(itemsPerSubsequentPage);
              
              // Calculate Y offset for this page
              const pageYOffset = (currentPage - 1) * (canvasHeight + 30); // 30px separator
              const pageHeaderY = pageYOffset + 40; // Start headers 40px from top of page
              const pageFirstItemY = pageYOffset + 65; // Items start below headers
              
              pages.push(
                <React.Fragment key={`page-${currentPage}`}>
                  {/* Page background */}
                  <Rect x={0} y={pageYOffset} width={canvasWidth} height={canvasHeight} color={colors.background} />
                  
                  {/* Page separator line */}
                  <Rect x={0} y={pageYOffset - 15} width={canvasWidth} height={1} color="#ddd" />
                  
                  {/* Table header for this page */}
                  <Rect x={tableX + 15} y={pageHeaderY} width={tableWidth - 35} height={18} color={colors.greenAccent} />
                  <Text x={qtyX + 20} y={pageHeaderY + 13} text="QTY" font={scaledFonts.bodyBold} color="white" />
                  <Text x={descX + 30} y={pageHeaderY + 13} text="DESCRIPTION" font={scaledFonts.bodyBold} color="white" />
                  <Text x={priceX + 65} y={pageHeaderY + 13} text="PRICE" font={scaledFonts.bodyBold} color="white" />
                  <Text x={totalX + 62} y={pageHeaderY + 13} text="TOTAL" font={scaledFonts.bodyBold} color="white" />
                  
                  {/* Line items for this page */}
                  {itemsThisPage.map((item: any, index: number) => {
                    const rowY = pageFirstItemY + (index * scaledRowHeight);
                    
                    // Create paragraphs for this page's items
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
                      <React.Fragment key={`page-${currentPage}-item-${index}`}>
                        <Paragraph paragraph={qtyParagraph} x={qtyX + 10} y={rowY + textOffsetY - 4} width={30} />
                        <Paragraph paragraph={nameParagraph} x={descX + 30} y={rowY + textOffsetY - 4} width={160} />
                        {item.item_description && (
                          <Text 
                            x={descX + 30 + (item.item_name.length * 6)} 
                            y={rowY + textOffsetY} 
                            text={` (${item.item_description})`} 
                            font={scaledFonts.tiny} 
                            color="#999" 
                          />
                        )}
                        <Paragraph paragraph={priceParagraph} x={priceX + 65} y={rowY + textOffsetY - 4} width={80} />
                        <Paragraph paragraph={totalParagraph} x={totalX + 62} y={rowY + textOffsetY - 4} width={80} />
                      </React.Fragment>
                    );
                  })}
                  
                  {/* Page number */}
                  <Text x={canvasWidth - 65} y={pageYOffset + canvasHeight - 35} text={`Page ${currentPage}`} font={scaledFonts.bodyBold} color="black" />
                </React.Fragment>
              );
              
              currentPage++;
            }
            
            return pages;
          })()}

          {/* === FOOTER SECTION === */}
          {(() => {
            // Calculate footer position based on pagination and export mode
            if (!actualNeedsPagination || (exportPageNumber && showExportFooter)) {
              // Single page - render footer normally, OR export mode with footer enabled
              return (
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
                  
                  {/* Totals section for single page */}
                  {rightAlignedParagraphs ? (
                    <>
                      {/* Subtotal row */}
                      <Paragraph paragraph={rightAlignedParagraphs.subtotalLabelParagraph} x={totalX - 31} y={footerY + 15} width={70} />
                      <Paragraph paragraph={rightAlignedParagraphs.subtotalValueParagraph} x={totalX + 29} y={footerY + 15} width={60} />
                      
                      {/* Discount row (conditional) */}
                      {rightAlignedParagraphs.discountLabelParagraph ? (
                        <>
                          <Paragraph paragraph={rightAlignedParagraphs.discountLabelParagraph} x={totalX - 31} y={footerY + 35} width={70} />
                          <Paragraph paragraph={rightAlignedParagraphs.discountValueParagraph} x={totalX + 29} y={footerY + 35} width={60} />
                        </>
                      ) : null}
                      
                      {/* Tax row - adjusts position based on discount presence */}
                      <Paragraph paragraph={rightAlignedParagraphs.taxLabelParagraph} x={totalX - 31} y={footerY + (hasDiscount ? 55 : 35)} width={70} />
                      <Paragraph paragraph={rightAlignedParagraphs.taxValueParagraph} x={totalX + 29} y={footerY + (hasDiscount ? 55 : 35)} width={60} />
                      
                      {/* Paid row (conditional - between VAT and Balance Due) */}
                      {rightAlignedParagraphs.paidLabelParagraph ? (
                        <>
                          <Paragraph paragraph={rightAlignedParagraphs.paidLabelParagraph} x={totalX - 31} y={footerY + (hasDiscount ? 75 : 55)} width={70} />
                          <Paragraph paragraph={rightAlignedParagraphs.paidValueParagraph} x={totalX + 29} y={footerY + (hasDiscount ? 75 : 55)} width={60} />
                          
                          {/* Balance Due row (directly under Paid) */}
                          <Paragraph paragraph={rightAlignedParagraphs.balanceDueLabelParagraph} x={totalX - 31} y={footerY + (hasDiscount ? 95 : 75)} width={70} />
                          <Paragraph paragraph={rightAlignedParagraphs.balanceDueValueParagraph} x={totalX + 29} y={footerY + (hasDiscount ? 95 : 75)} width={60} />
                        </>
                      ) : null}
                    </>
                  ) : null}
                  
                  {/* Grand Total Box with green background - positioned after Balance Due line if present */}
                  <Rect x={totalX - 33} y={footerY + (hasDiscount ? 95 : 75) + (rightAlignedParagraphs?.paidLabelParagraph ? 25 : 10)} width={127} height={20} color={colors.greenAccent} />
                  
                  {rightAlignedParagraphs ? (
                    <>
                      <Paragraph paragraph={rightAlignedParagraphs.totalLabelParagraph} x={totalX - 31} y={footerY + (hasDiscount ? 100 : 80) + (rightAlignedParagraphs?.paidLabelParagraph ? 25 : 10)} width={70} />
                      <Paragraph paragraph={rightAlignedParagraphs.totalValueParagraph} x={totalX + 27} y={footerY + (hasDiscount ? 100 : 80) + (rightAlignedParagraphs?.paidLabelParagraph ? 25 : 10)} width={65} />
                    </>
                  ) : null}
                </>
              );
            } else {
              // Multi-page - render footer on last page
              const lastPageYOffset = (totalPages - 1) * (canvasHeight + 30);
              const lastPageItemsCount = exportRemainingItems.length % itemsPerSubsequentPage || itemsPerSubsequentPage;
              const lastPageFooterY = lastPageYOffset + 65 + (lastPageItemsCount * scaledRowHeight) + 30;
              const lastPageNotesHeight = invoice?.notes ? (15 + (invoice.notes.split('\n').filter((line: string) => line.trim()).length * 12) + 10) : 0;
              const lastPagePaymentMethodsY = lastPageFooterY + 20 + lastPageNotesHeight;
              
              return (
                <>
                  {/* Notes on last page */}
                  {invoice?.notes && (
                    <>
                      <Text x={27} y={lastPageFooterY + 15} text="Terms, Instructions & Notes" font={scaledFonts.bodyBold} color={colors.text} />
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
                            y={lastPageFooterY + 27 + (index * 12)} 
                            text={line} 
                            font={scaledFonts.body} 
                            color={colors.text} 
                          />
                        ));
                      })()}
                    </>
                  )}
                  
                  {/* Payment Methods on last page */}
                  {(invoice?.stripe_active || invoice?.paypal_active || invoice?.bank_account_active) && (
                    <>
                      <Text x={27} y={lastPagePaymentMethodsY} text="Payment Methods" font={scaledFonts.bodyBold} color={colors.text} />
                      
                      {/* Stripe Payment Method */}
                      {invoice?.stripe_active && (
                        <>
                          <Text x={27} y={lastPagePaymentMethodsY + 14} text="Pay Online" font={scaledFonts.body} color={colors.text} />
                          
                          {/* Add Visa icon - inline with Pay Online text */}
                          {visaIcon && (
                            <Image 
                              image={visaIcon} 
                              x={85} 
                              y={lastPagePaymentMethodsY + 6} 
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
                              y={lastPagePaymentMethodsY + 6} 
                              width={24} 
                              height={14} 
                              fit="contain"
                            />
                          )}
                          
                          <Text x={27} y={lastPagePaymentMethodsY + 26} text="www.stripelink.com" font={scaledFonts.body} color={colors.text} />
                        </>
                      )}
                      
                      {/* PayPal Payment Method */}
                      {invoice?.paypal_active && (
                        <>
                          <Text x={27} y={lastPagePaymentMethodsY + (invoice?.stripe_active ? 40 : 14)} text="Pay with PayPal" font={scaledFonts.body} color={colors.text} />
                          
                          {/* PayPal icon inline with text */}
                          {paypalIcon && (
                            <Image 
                              image={paypalIcon} 
                              x={109} 
                              y={lastPagePaymentMethodsY + (invoice?.stripe_active ? 32 : 6)} 
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
                                y={lastPagePaymentMethodsY + (invoice?.stripe_active ? 52 : 26)} 
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
                            const baseY = lastPagePaymentMethodsY + 14 + 
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
                  
                  {/* Totals section on last page */}
                  {rightAlignedParagraphs ? (
                    <>
                      {/* Subtotal row */}
                      <Paragraph paragraph={rightAlignedParagraphs.subtotalLabelParagraph} x={totalX - 31} y={lastPageFooterY + 15} width={70} />
                      <Paragraph paragraph={rightAlignedParagraphs.subtotalValueParagraph} x={totalX + 29} y={lastPageFooterY + 15} width={60} />
                      
                      {/* Discount row (conditional) */}
                      {rightAlignedParagraphs.discountLabelParagraph ? (
                        <>
                          <Paragraph paragraph={rightAlignedParagraphs.discountLabelParagraph} x={totalX - 31} y={lastPageFooterY + 35} width={70} />
                          <Paragraph paragraph={rightAlignedParagraphs.discountValueParagraph} x={totalX + 29} y={lastPageFooterY + 35} width={60} />
                        </>
                      ) : null}
                      
                      {/* Tax row - adjusts position based on discount presence */}
                      <Paragraph paragraph={rightAlignedParagraphs.taxLabelParagraph} x={totalX - 31} y={lastPageFooterY + (hasDiscount ? 55 : 35)} width={70} />
                      <Paragraph paragraph={rightAlignedParagraphs.taxValueParagraph} x={totalX + 29} y={lastPageFooterY + (hasDiscount ? 55 : 35)} width={60} />
                      
                      {/* Paid row (conditional - between VAT and Balance Due) */}
                      {rightAlignedParagraphs.paidLabelParagraph ? (
                        <>
                          <Paragraph paragraph={rightAlignedParagraphs.paidLabelParagraph} x={totalX - 31} y={lastPageFooterY + (hasDiscount ? 75 : 55)} width={70} />
                          <Paragraph paragraph={rightAlignedParagraphs.paidValueParagraph} x={totalX + 29} y={lastPageFooterY + (hasDiscount ? 75 : 55)} width={60} />
                          
                          {/* Balance Due row (directly under Paid) */}
                          <Paragraph paragraph={rightAlignedParagraphs.balanceDueLabelParagraph} x={totalX - 31} y={lastPageFooterY + (hasDiscount ? 95 : 75)} width={70} />
                          <Paragraph paragraph={rightAlignedParagraphs.balanceDueValueParagraph} x={totalX + 29} y={lastPageFooterY + (hasDiscount ? 95 : 75)} width={60} />
                        </>
                      ) : null}
                    </>
                  ) : null}
                  
                  {/* Grand Total Box with green background on last page */}
                  <Rect x={totalX - 33} y={lastPageFooterY + (hasDiscount ? 95 : 75) + (rightAlignedParagraphs?.paidLabelParagraph ? 25 : 10)} width={127} height={20} color={colors.greenAccent} />
                  
                  {rightAlignedParagraphs ? (
                    <>
                      <Paragraph paragraph={rightAlignedParagraphs.totalLabelParagraph} x={totalX - 31} y={lastPageFooterY + (hasDiscount ? 100 : 80) + (rightAlignedParagraphs?.paidLabelParagraph ? 25 : 10)} width={70} />
                      <Paragraph paragraph={rightAlignedParagraphs.totalValueParagraph} x={totalX + 27} y={lastPageFooterY + (hasDiscount ? 100 : 80) + (rightAlignedParagraphs?.paidLabelParagraph ? 25 : 10)} width={65} />
                    </>
                  ) : null}
                </>
              );
            }
          })()}
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

export default SkiaInvoiceCanvasModern;