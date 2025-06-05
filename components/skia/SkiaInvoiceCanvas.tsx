import React, { useMemo } from 'react';
import { Canvas, Rect, Text, Skia, matchFont, Circle, Paragraph, TextAlign, Image, useImage } from '@shopify/react-native-skia';
import { View, StyleSheet, Platform } from 'react-native';

interface SkiaInvoiceCanvasProps {
  invoice?: any;
  business?: any;
  client?: any;
  currencySymbol?: string;
  style?: any;
}

const SkiaInvoiceCanvas: React.FC<SkiaInvoiceCanvasProps> = ({ 
  invoice, 
  business, 
  client, 
  currencySymbol = '£',
  style 
}) => {
  console.log('[SkiaInvoiceCanvas] Rendering Real Invoice INV-710231');

  // Original design dimensions: maxWidth: 370, compact mobile-first
  const canvasWidth = 370;
  const canvasHeight = 520; // Increased for content

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

  // Create right-aligned paragraphs using Skia's TextAlign.Right
  const rightAlignedParagraphs = useMemo(() => {
    if (!fonts.medium) return null;
    
    try {
      // Header paragraphs
      const invoiceParagraph = Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Right,
      })
      .pushStyle({ 
        color: Skia.Color('black'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 13, 
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
        fontSize: 9, 
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
        fontSize: 9, 
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
        fontSize: 9, 
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
        fontSize: 9, 
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
        fontSize: 9, 
        fontStyle: { weight: 700 }
      })
      .addText(`${currencySymbol}${(invoice?.total_amount || 480.00).toFixed(2)}`)
      .build();

      return { 
        invoiceParagraph, 
        refParagraph, 
        dateParagraph, 
        dueParagraph, 
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
        totalValueParagraph
      };
    } catch (e) {
      console.log('Paragraph creation failed:', e);
      return null;
    }
  }, [fonts.medium, invoice, business, client, hasDiscount, discountAmount]);

  // REAL INVOICE DATA for INV-710231
  const businessName = "Hello mate";
  const businessAddress = "101\nBeefy Road\nRochester\nUk";
  const businessEmail = "mrbill@gmail.com";
  const businessPhone = "01686698541";
  
  const clientName = "Chill Free Ltd";
  const clientEmail = "harrisonjbj@gmail.com";
  
  const invoiceNumber = "INV-710231";
  const invoiceDate = "2025-06-03";
  const dueDate = "In 7 days"; // due_date_option: net_7
  
  // Logo handling
  const logoImage = useImage(business?.business_logo_url);
  
  // Dynamic line items from invoice data
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
  
  const subtotal = 400.00;
  const taxRate = 20;
  const taxAmount = 80.00;
  const total = 480.00;
  const bankDetails = "Bank Transfer\nNew Bank\n123456\n12-12-32\nHSBC";

  // Original design colors
  const colors = {
    background: '#fff',
    text: 'black',
    border: '#eee',
    greenAccent: 'rgba(76, 175, 80, 0.15)', // Original green background
    shadow: '#f0f0f0',
    orange: '#ff8c00' // For logo
  };

  if (!fonts.body || !fonts.title || !fonts.small) {
    console.log('[SkiaInvoiceCanvas] Fonts not available, skipping render');
    return <View style={[styles.container, style]} />;
  }

  // EXACT column positions based on original design analysis
  const padding = 20;
  const tableX = padding;
  const tableWidth = canvasWidth - (padding * 2);
  
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

  // Calculate footer positioning
  const footerY = 365;

  // Calculate dynamic positioning for Payment Methods based on notes
  const notesLineCount = invoice?.notes ? invoice.notes.split('\n').filter(line => line.trim()).length : 0;
  const notesHeight = invoice?.notes ? (15 + (notesLineCount * 12) + 10) : 0; // Header + lines + spacing
  const paymentMethodsY = footerY + 20 + notesHeight;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.pageContainer}>
        <Canvas style={{ width: canvasWidth, height: canvasHeight }}>
          {/* Container background */}
          <Rect x={0} y={0} width={canvasWidth} height={canvasHeight} color={colors.background} />
          <Rect x={10} y={10} width={canvasWidth - 20} height={canvasHeight - 20} color="transparent" strokeColor={colors.shadow} strokeWidth={1} />
          
          {/* === HEADER SECTION === */}
          
          {/* Left: Business Logo */}
          {logoImage ? (
            <Image 
              image={logoImage} 
              x={27} 
              y={22} 
              width={65} 
              height={65} 
              fit="contain"
            />
          ) : (
            <>
              {/* Fallback logo with "H" text */}
              <Circle cx={59} cy={55} r={32} color={colors.orange} />
              <Text x={51} y={64} text="H" font={fonts.title} color="white" />
            </>
          )}
          
          {/* Right: Invoice title and RIGHT-ALIGNED details using Paragraph */}
          {/* Remove old text element - now using paragraph */}
          
          {/* RIGHT-ALIGNED paragraphs using Skia's TextAlign.Right */}
          {rightAlignedParagraphs && (
            <>
              <Paragraph paragraph={rightAlignedParagraphs.invoiceParagraph} x={220} y={30} width={130} />
              <Paragraph paragraph={rightAlignedParagraphs.refParagraph} x={220} y={50} width={130} />
              <Paragraph paragraph={rightAlignedParagraphs.dateParagraph} x={220} y={65} width={130} />
              <Paragraph paragraph={rightAlignedParagraphs.dueParagraph} x={220} y={80} width={130} />
            </>
          )}
          
          {/* === META SECTION === */}
          
          {/* Left: From section */}
          {rightAlignedParagraphs && (
            <>
              <Paragraph paragraph={rightAlignedParagraphs.fromLabelParagraph} x={27} y={125} width={200} />
              <Paragraph paragraph={rightAlignedParagraphs.businessNameParagraph} x={27} y={137} width={200} />
              <Paragraph paragraph={rightAlignedParagraphs.businessAddress1Paragraph} x={27} y={149} width={200} />
              <Paragraph paragraph={rightAlignedParagraphs.businessAddress2Paragraph} x={27} y={161} width={200} />
              <Paragraph paragraph={rightAlignedParagraphs.businessAddress3Paragraph} x={27} y={173} width={200} />
              <Paragraph paragraph={rightAlignedParagraphs.businessAddress4Paragraph} x={27} y={185} width={200} />
            </>
          )}
          
          {/* Right: Bill To section using RIGHT-ALIGNED paragraphs */}
          {rightAlignedParagraphs && (
            <>
              <Paragraph paragraph={rightAlignedParagraphs.billToParagraph} x={220} y={125} width={130} />
              <Paragraph paragraph={rightAlignedParagraphs.clientNameParagraph} x={220} y={137} width={130} />
              <Paragraph paragraph={rightAlignedParagraphs.clientAddress1Paragraph} x={220} y={149} width={130} />
              <Paragraph paragraph={rightAlignedParagraphs.clientAddress2Paragraph} x={220} y={161} width={130} />
              <Paragraph paragraph={rightAlignedParagraphs.clientAddress3Paragraph} x={220} y={173} width={130} />
              <Paragraph paragraph={rightAlignedParagraphs.clientTaxNumberParagraph} x={220} y={185} width={130} />
            </>
          )}
          
          {/* === LINE ITEMS TABLE === */}
          {/* Table header with green background */}
          <Rect x={tableX} y={250} width={tableWidth + 5} height={25} color={colors.greenAccent} />
          
          {/* Table headers - PERFECTLY ALIGNED */}
          <Text x={qtyX + 10} y={267} text="QTY" font={fonts.bodyBold} color={colors.text} />
          <Text x={descX + 5} y={267} text="DESCRIPTION" font={fonts.bodyBold} color={colors.text} />
          <Text x={priceX + 35} y={267} text="PRICE" font={fonts.bodyBold} color={colors.text} />
          <Text x={totalX + 32} y={267} text="TOTAL" font={fonts.bodyBold} color={colors.text} />
          
          {/* Line Items - PERFECTLY ALIGNED WITH PROPER SPACING */}
          {lineItems.map((item: any, index: number) => {
            const rowY = 285 + (index * 25);
            
            return (
              <React.Fragment key={index}>
                {/* Row separator line */}
                <Rect x={tableX} y={rowY + 20} width={tableWidth + 5} height={1} color={colors.border} />
                
                {/* QTY - center aligned in column */}
                <Text 
                  x={qtyX + 15} 
                  y={rowY + 13} 
                  text={item.quantity.toString()} 
                  font={fonts.body} 
                  color={colors.text} 
                />
                
                {/* Description - left aligned */}
                <Text 
                  x={descX + 5} 
                  y={rowY + 13} 
                  text={item.item_name} 
                  font={fonts.body} 
                  color={colors.text} 
                />
                
                {/* Price - aligned directly under PRICE header - REGULAR WEIGHT */}
                <Text 
                  x={priceX + 35} 
                  y={rowY + 13} 
                  text={`${currencySymbol}${item.unit_price.toFixed(2)}`} 
                  font={fonts.body} 
                  color={colors.text} 
                />
                
                {/* Total - aligned directly under TOTAL header - REGULAR WEIGHT */}
                <Text 
                  x={totalX + 32} 
                  y={rowY + 13} 
                  text={`${currencySymbol}${item.total_price.toFixed(2)}`} 
                  font={fonts.body} 
                  color={colors.text} 
                />
              </React.Fragment>
            );
          })}
          
          {/* === FOOTER SECTION === */}
          
          {/* Left: Notes and Payment Methods */}
          {invoice?.notes && (
            <>
              <Text x={27} y={footerY + 20} text="Terms, Instructions & Notes" font={fonts.bodyBold} color={colors.text} />
              {invoice.notes.split('\n').filter(line => line.trim()).map((line, index) => (
                <Text 
                  key={index}
                  x={27} 
                  y={footerY + 35 + (index * 12)} 
                  text={line.trim()} 
                  font={fonts.body} 
                  color={colors.text} 
                />
              ))}
            </>
          )}
          
          {/* Payment Methods - Dynamic based on invoice flags */}
          {(invoice?.stripe_active || invoice?.paypal_active || invoice?.bank_account_active) && (
            <>
              <Text x={27} y={paymentMethodsY} text="Payment Methods" font={fonts.bodyBold} color={colors.text} />
              
              {/* Stripe Payment Method */}
              {invoice?.stripe_active && (
                <>
                  <Text x={27} y={paymentMethodsY + 12} text="Pay Online" font={fonts.body} color={colors.text} />
                  <Text x={27} y={paymentMethodsY + 24} text="www.stripelink.com" font={fonts.body} color={colors.text} />
                </>
              )}
              
              {/* PayPal Payment Method */}
              {invoice?.paypal_active && (
                <>
                  <Text x={27} y={paymentMethodsY + (invoice?.stripe_active ? 35 : 12)} text="Pay with PayPal" font={fonts.body} color={colors.text} />
                  <Text x={27} y={paymentMethodsY + (invoice?.stripe_active ? 47 : 24)} text={business?.paypal_email || 'nobones@gmail.com'} font={fonts.body} color={colors.text} />
                </>
              )}
              
              {/* Bank Transfer Payment Method */}
              {invoice?.bank_account_active && (
                <>
                  {(() => {
                    const baseY = paymentMethodsY + 12 + 
                      (invoice?.stripe_active ? 35 : 0) + 
                      (invoice?.paypal_active ? 35 : 0);
                    
                    const bankDetails = business?.bank_details || 'Bank 1\n1 2457 5 6 5 500598 32\nU EA';
                    const bankLines = bankDetails.split('\n');
                    
                    return (
                      <>
                        <Text x={27} y={baseY} text="Bank Transfer" font={fonts.body} color={colors.text} />
                        {bankLines.map((line, index) => (
                          <Text 
                            key={index}
                            x={27} 
                            y={baseY + 12 + (index * 8)} 
                            text={line.trim()} 
                            font={fonts.body} 
                            color={colors.text} 
                          />
                        ))}
                      </>
                    );
                  })()}
                </>
              )}
            </>
          )}
          
          {/* Right: Totals section aligned with Terms section */}
          
          {rightAlignedParagraphs && (
            <>
              {/* Subtotal row */}
              <Paragraph paragraph={rightAlignedParagraphs.subtotalLabelParagraph} x={220} y={footerY + 20} width={70} />
              <Paragraph paragraph={rightAlignedParagraphs.subtotalValueParagraph} x={290} y={footerY + 20} width={60} />
              
              {/* Discount row */}
              {rightAlignedParagraphs.discountLabelParagraph && (
                <>
                  <Paragraph paragraph={rightAlignedParagraphs.discountLabelParagraph} x={220} y={footerY + 40} width={70} />
                  <Paragraph paragraph={rightAlignedParagraphs.discountValueParagraph} x={290} y={footerY + 40} width={60} />
                </>
              )}
              
              {/* Tax row */}
              <Paragraph paragraph={rightAlignedParagraphs.taxLabelParagraph} x={220} y={footerY + 60} width={70} />
              <Paragraph paragraph={rightAlignedParagraphs.taxValueParagraph} x={290} y={footerY + 60} width={60} />
            </>
          )}
          
          {/* Grand Total Box with green background - aligned with Terms section */}
          <Rect x={220} y={footerY + (hasDiscount ? 90 : 70)} width={135} height={20} color={colors.greenAccent} />
          
          {rightAlignedParagraphs && (
            <>
              <Paragraph paragraph={rightAlignedParagraphs.totalLabelParagraph} x={220} y={footerY + (hasDiscount ? 95 : 75)} width={70} />
              <Paragraph paragraph={rightAlignedParagraphs.totalValueParagraph} x={288} y={footerY + (hasDiscount ? 95 : 75)} width={65} />
            </>
          )}
        </Canvas>
      </View>
    </View>
  );
};

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
    justifyContent: 'center',
    alignItems: 'center'
  }
});

export default SkiaInvoiceCanvas; 