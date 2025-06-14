import React, { forwardRef, useMemo } from 'react';
import { Canvas, Rect, Text, Skia, matchFont, Circle, Paragraph, TextAlign, useImage, Image } from '@shopify/react-native-skia';
import { View, Platform } from 'react-native';

interface SkiaInvoiceCanvasSimpleProps {
  invoice?: any;
  business?: any;
  client?: any;
  currencySymbol?: string;
  style?: any;
  accentColor?: string; // NEW: Dynamic accent color for customization
}

const SkiaInvoiceCanvasSimple = forwardRef((props: SkiaInvoiceCanvasSimpleProps, ref: any) => {
  const { 
    invoice, 
    business, 
    client, 
    currencySymbol = '£',
    style,
    accentColor = '#14B8A6' // Default turquoise
  } = props;

  console.log('[SkiaInvoiceCanvasSimple] Starting FULL INVOICE render test...');

  // Since basic Skia works, let's test the actual invoice logic that might break
  
  // Test the exact data processing from SkiaInvoiceCanvas
  const lineItems = invoice?.invoice_line_items || [
    {
      quantity: 1,
      item_name: "Test Service",
      item_description: "Test Description", 
      unit_price: 100.00,
      total_price: 100.00
    }
  ];

  // Test pagination logic (this might be the culprit!)
  const totalItems = lineItems.length;
  const itemRowHeight = 20;
  const firstItemY = 210;
  const footerStartY = 410;
  const availableSpaceFirstPage = footerStartY - firstItemY;
  const maxItemsFirstPage = Math.floor(availableSpaceFirstPage / itemRowHeight);
  const needsPagination = totalItems > maxItemsFirstPage;
  
  console.log('[SkiaInvoiceCanvasSimple] Pagination test:', {
    totalItems,
    maxItemsFirstPage, 
    needsPagination
  });

  // Test progressive features to find what breaks
  
  // 1. Basic fonts (this worked)
  const basicFont = useMemo(() => {
    try {
      return matchFont({
        fontFamily: Platform.select({ 
          ios: "Helvetica", 
          android: "sans-serif",
          default: "Arial" 
        }),
        fontSize: 12,
        fontStyle: "normal" as const,
        fontWeight: "normal" as const,
      });
    } catch (e) {
      console.log('[SkiaInvoiceCanvasSimple] Basic font failed:', e);
      return null;
    }
  }, []);

  // 2. Test useImage hook (this might be the culprit)
  const logoImage = useImage(business?.business_logo_url);
  console.log('[SkiaInvoiceCanvasSimple] Logo image:', logoImage ? 'loaded' : 'none');

  // 3. Test Paragraph creation (another suspect)
  const testParagraph = useMemo(() => {
    try {
      return Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Left,
      })
      .pushStyle({ 
        color: Skia.Color('black'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 14, 
        fontStyle: { weight: 400 }
      })
      .addText('Test Paragraph')
      .build();
    } catch (e) {
      console.log('[SkiaInvoiceCanvasSimple] Paragraph creation failed:', e);
      return null;
    }
  }, []);

  // 4. Test the exact font creation from SkiaInvoiceCanvas (THIS IS THE SUSPECT!)
  const complexFonts = useMemo(() => {
    console.log('[SkiaInvoiceCanvasSimple] Testing complex font creation...');
    
    const fontFamily = Platform.select({ 
      ios: "Helvetica", 
      android: "sans-serif",
      default: "sans-serif" 
    });

    try {
      const fonts = {
        tiny: matchFont({
          fontFamily,
          fontSize: 7,
          fontStyle: "normal" as const,
          fontWeight: "normal" as const,
        }),
        body: matchFont({
          fontFamily,
          fontSize: 9,
          fontStyle: "normal" as const,
          fontWeight: "normal" as const,
        }),
        bodyBold: matchFont({
          fontFamily,
          fontSize: 9,
          fontStyle: "normal" as const,
          fontWeight: "bold" as const,
        }),
      };
      console.log('[SkiaInvoiceCanvasSimple] Complex fonts created successfully');
      return fonts;
    } catch (e) {
      console.log('[SkiaInvoiceCanvasSimple] Complex font creation failed:', e);
      return { tiny: null, body: null, bodyBold: null };
    }
  }, []);

  // 5. Test complex paragraph building like in the real component
  const complexParagraphs = useMemo(() => {
    console.log('[SkiaInvoiceCanvasSimple] Testing complex paragraph creation...');
    
    try {
      const invoiceParagraph = Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Right,
      })
      .pushStyle({ 
        color: Skia.Color('black'), 
        fontFamilies: ['Helvetica'], 
        fontSize: 10,
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
        fontSize: 10, 
        fontStyle: { weight: 400 }
      })
      .addText(`Ref: ${invoice?.invoice_number || 'INV-000000'}`)
      .build();

      console.log('[SkiaInvoiceCanvasSimple] Complex paragraphs created successfully');
      return { invoiceParagraph, refParagraph };
    } catch (e) {
      console.log('[SkiaInvoiceCanvasSimple] Complex paragraph creation failed:', e);
      return null;
    }
  }, [invoice?.invoice_number]);

  return (
    <View style={[{ width: 370, height: 400 }, style]}>
      <Canvas style={{ width: 370, height: 400 }}>
        {/* Simple background */}
        <Rect x={0} y={0} width={370} height={400} color="white" />
        
        {/* Basic text (this worked) */}
        {basicFont && (
          <>
            <Text 
              x={20} 
              y={40} 
              text={`Invoice #${invoice?.invoice_number || 'TEST'}`} 
              font={basicFont} 
              color="black" 
            />
            <Text 
              x={20} 
              y={60} 
              text={`Client: ${invoice?.client_name || 'Test Client'}`} 
              font={basicFont} 
              color="black" 
            />
            <Text 
              x={20} 
              y={80} 
              text={`Total: ${currencySymbol}${invoice?.total_amount || '100.00'}`} 
              font={basicFont} 
              color="black" 
            />
          </>
        )}

        {/* Test Circle component */}
        <Circle cx={300} cy={50} r={20} color="orange" />
        
        {/* Test logo image if available */}
        {logoImage && business?.business_logo_url && (
          <Image 
            image={logoImage} 
            x={250} 
            y={80} 
            width={40} 
            height={40} 
            fit="contain"
          />
        )}

        {/* Test Paragraph component */}
        {testParagraph && (
          <Paragraph 
            paragraph={testParagraph} 
            x={20} 
            y={120} 
            width={200} 
          />
        )}

        {/* Test complex fonts */}
        {complexFonts.body && (
          <Text 
            x={20} 
            y={140} 
            text="Complex font working" 
            font={complexFonts.body} 
            color="blue" 
          />
        )}

        {/* Test complex paragraphs */}
        {complexParagraphs?.invoiceParagraph && (
          <Paragraph 
            paragraph={complexParagraphs.invoiceParagraph} 
            x={150} 
            y={120} 
            width={130} 
          />
        )}
        
        {complexParagraphs?.refParagraph && (
          <Paragraph 
            paragraph={complexParagraphs.refParagraph} 
            x={150} 
            y={140} 
            width={130} 
          />
        )}
        
        {/* Test actual line item rendering */}
        {complexFonts.body && lineItems.map((item: any, index: number) => {
          const rowY = 200 + (index * 20);
          
          return (
            <React.Fragment key={index}>
              <Text 
                x={30} 
                y={rowY} 
                text={item.quantity.toString()} 
                font={complexFonts.tiny} 
                color="black" 
              />
              <Text 
                x={60} 
                y={rowY} 
                text={item.item_name} 
                font={complexFonts.body} 
                color="black" 
              />
              <Text 
                x={200} 
                y={rowY} 
                text={`${currencySymbol}${item.unit_price.toFixed(2)}`} 
                font={complexFonts.body} 
                color="black" 
              />
            </React.Fragment>
          );
        })}

        {/* Status indicator */}
        <Rect x={20} y={300} width={200} height={30} color="lightgreen" />
        {basicFont && (
          <Text 
            x={25} 
            y={320} 
            text="Line Items Render Test Working" 
            font={basicFont} 
            color="black" 
          />
        )}
      </Canvas>
    </View>
  );
});

SkiaInvoiceCanvasSimple.displayName = "SkiaInvoiceCanvasSimple";

export { SkiaInvoiceCanvasSimple }; 