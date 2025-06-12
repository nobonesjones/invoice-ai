import React, { forwardRef, useMemo } from 'react';
import { Canvas, Rect, Text, Skia, matchFont, Circle, Paragraph, TextAlign, useImage, Image } from '@shopify/react-native-skia';
import { View, Platform } from 'react-native';

interface SkiaInvoiceCanvasWorkingProps {
  invoice?: any;
  business?: any;
  client?: any;
  currencySymbol?: string;
  style?: any;
}

const SkiaInvoiceCanvasWorking = forwardRef((props: SkiaInvoiceCanvasWorkingProps, ref: any) => {
  const { 
    invoice, 
    business, 
    client, 
    currencySymbol = '£',
    style
  } = props;

  console.log('[SkiaInvoiceCanvasWorking] Rendering beautiful working invoice...');

  // Use proven working font creation
  const fonts = useMemo(() => {
    const fontFamily = Platform.select({ 
      ios: "Helvetica", 
      android: "sans-serif",
      default: "sans-serif" 
    });

    try {
      return {
        small: matchFont({
          fontFamily,
          fontSize: 8,
          fontStyle: "normal" as const,
          fontWeight: "normal" as const,
        }),
        body: matchFont({
          fontFamily,
          fontSize: 10,
          fontStyle: "normal" as const,
          fontWeight: "normal" as const,
        }),
        bodyBold: matchFont({
          fontFamily,
          fontSize: 10,
          fontStyle: "normal" as const,
          fontWeight: "bold" as const,
        }),
        title: matchFont({
          fontFamily,
          fontSize: 16,
          fontStyle: "normal" as const,
          fontWeight: "bold" as const,
        }),
      };
    } catch (e) {
      console.log('[SkiaInvoiceCanvasWorking] Font creation failed:', e);
      return { small: null, body: null, bodyBold: null, title: null };
    }
  }, []);

  // Get real invoice data
  const lineItems = invoice?.invoice_line_items || [];
  const logoImage = useImage(business?.business_logo_url);

  // Create header paragraphs using proven working pattern
  const headerParagraphs = useMemo(() => {
    try {
      const invoiceParagraph = Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Right,
      })
      .pushStyle({ 
        color: Skia.Color('black'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 16,
        fontStyle: { weight: 700 }
      })
      .addText('INVOICE')
      .build();

      const refParagraph = Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Right,
      })
      .pushStyle({ 
        color: Skia.Color('black'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 10, 
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
        fontSize: 10, 
        fontStyle: { weight: 400 }
      })
      .addText(`Date: ${invoice?.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')}`)
      .build();

      return { invoiceParagraph, refParagraph, dateParagraph };
    } catch (e) {
      console.log('[SkiaInvoiceCanvasWorking] Header paragraph creation failed:', e);
      return null;
    }
  }, [invoice?.invoice_number, invoice?.invoice_date]);

  return (
    <View style={[{ width: 370, height: 500 }, style]}>
      <Canvas style={{ width: 370, height: 500 }}>
        {/* White background */}
        <Rect x={0} y={0} width={370} height={500} color="white" />
        
        {/* Border */}
        <Rect x={10} y={10} width={350} height={480} stroke="black" strokeWidth={1} color="transparent" />

        {/* === HEADER SECTION === */}
        
        {/* Business Logo or Initials */}
        {logoImage && business?.business_logo_url ? (
          <Image 
            image={logoImage} 
            x={25} 
            y={25} 
            width={60} 
            height={60} 
            fit="contain"
          />
        ) : (
          <>
            <Circle cx={55} cy={55} r={30} color="#FF6B35" />
            {fonts.title && (
              <Text 
                x={45} 
                y={65} 
                text={business?.business_name?.charAt(0) || 'B'} 
                font={fonts.title} 
                color="white" 
              />
            )}
          </>
        )}

        {/* Invoice Title and Details - Right Aligned */}
        {headerParagraphs && (
          <>
            <Paragraph paragraph={headerParagraphs.invoiceParagraph} x={200} y={25} width={160} />
            <Paragraph paragraph={headerParagraphs.refParagraph} x={200} y={45} width={160} />
            <Paragraph paragraph={headerParagraphs.dateParagraph} x={200} y={60} width={160} />
          </>
        )}

        {/* === BUSINESS INFO === */}
        {fonts.bodyBold && (
          <>
            <Text x={25} y={110} text="From:" font={fonts.bodyBold} color="black" />
            <Text x={25} y={125} text={business?.business_name || 'Your Business'} font={fonts.bodyBold} color="black" />
          </>
        )}
        
        {fonts.body && business?.business_address && (
          <>
            <Text x={25} y={140} text={business.business_address.split('\n')[0] || ''} font={fonts.body} color="black" />
            <Text x={25} y={155} text={business.business_address.split('\n')[1] || ''} font={fonts.body} color="black" />
          </>
        )}

        {/* === CLIENT INFO === */}
        {fonts.bodyBold && (
          <>
            <Text x={200} y={110} text="Bill To:" font={fonts.bodyBold} color="black" />
            <Text x={200} y={125} text={client?.name || invoice?.client_name || 'Client Name'} font={fonts.bodyBold} color="black" />
          </>
        )}

        {fonts.body && client?.email && (
          <Text x={200} y={140} text={client.email} font={fonts.body} color="black" />
        )}

        {/* === LINE ITEMS TABLE === */}
        
        {/* Table header background */}
        <Rect x={25} y={180} width={320} height={20} color="#E8F5E8" />
        
        {/* Table headers */}
        {fonts.bodyBold && (
          <>
            <Text x={30} y={195} text="QTY" font={fonts.bodyBold} color="black" />
            <Text x={70} y={195} text="DESCRIPTION" font={fonts.bodyBold} color="black" />
            <Text x={250} y={195} text="PRICE" font={fonts.bodyBold} color="black" />
            <Text x={300} y={195} text="TOTAL" font={fonts.bodyBold} color="black" />
          </>
        )}

        {/* Line items */}
        {fonts.body && lineItems.map((item: any, index: number) => {
          const rowY = 215 + (index * 18);
          
          return (
            <React.Fragment key={index}>
              <Text 
                x={30} 
                y={rowY} 
                text={item.quantity?.toString() || '1'} 
                font={fonts.body} 
                color="black" 
              />
              <Text 
                x={70} 
                y={rowY} 
                text={item.item_name || 'Service'} 
                font={fonts.body} 
                color="black" 
              />
              <Text 
                x={250} 
                y={rowY} 
                text={`${currencySymbol}${item.unit_price?.toFixed(2) || '0.00'}`} 
                font={fonts.body} 
                color="black" 
              />
              <Text 
                x={300} 
                y={rowY} 
                text={`${currencySymbol}${item.total_price?.toFixed(2) || '0.00'}`} 
                font={fonts.body} 
                color="black" 
              />
            </React.Fragment>
          );
        })}

        {/* === TOTALS SECTION === */}
        <Rect x={220} y={350} width={125} height={80} stroke="#ddd" strokeWidth={1} color="#fafafa" />
        
        {fonts.bodyBold && (
          <>
            <Text x={230} y={370} text="Subtotal:" font={fonts.body} color="black" />
            <Text x={290} y={370} text={`${currencySymbol}${invoice?.subtotal_amount?.toFixed(2) || invoice?.total_amount?.toFixed(2) || '0.00'}`} font={fonts.body} color="black" />
            
            <Text x={230} y={390} text="Tax:" font={fonts.body} color="black" />
            <Text x={290} y={390} text={`${currencySymbol}${invoice?.tax_amount?.toFixed(2) || '0.00'}`} font={fonts.body} color="black" />
            
            <Text x={230} y={415} text="Total:" font={fonts.bodyBold} color="black" />
            <Text x={290} y={415} text={`${currencySymbol}${invoice?.total_amount?.toFixed(2) || '0.00'}`} font={fonts.bodyBold} color="black" />
          </>
        )}

        {/* === FOOTER === */}
        {fonts.body && (
          <Text x={25} y={460} text="Thank you for your business!" font={fonts.body} color="#666" />
        )}
      </Canvas>
    </View>
  );
});

SkiaInvoiceCanvasWorking.displayName = "SkiaInvoiceCanvasWorking";

export { SkiaInvoiceCanvasWorking }; 