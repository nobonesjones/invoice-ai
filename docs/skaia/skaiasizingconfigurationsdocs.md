# Skia Canvas Sizing & PDF Export Configuration Documentation

## Overview
This document details the exact configuration for implementing a Skia-based invoice canvas with perfect screen-to-PDF export matching. The setup ensures that what users see on screen matches exactly what gets exported to PDF.

## Critical Text Clarity Fixes

### High DPI/DevicePixelRatio Support
**Problem**: All text appears blurred/pixelated in PDF exports due to devicePixelRatio scaling issues.

**Solution**: Implement proper devicePixelRatio handling:

```typescript
// 1. Get devicePixelRatio
const devicePixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

// 2. Scale canvas content with Group transform
<Canvas style={{ width: baseCanvasWidth, height: totalCanvasHeight }}>
  <Group transform={[{ scale: devicePixelRatio }]}>
    {/* All canvas content here */}
  </Group>
</Canvas>

// 3. Scale font sizes by devicePixelRatio
const fonts = {
  body: matchFont({
    fontFamily: "Helvetica",
    fontSize: 9 * devicePixelRatio, // Scale fonts for crisp rendering
    fontWeight: "normal"
  })
};
```

### Research Sources
- **GitHub Issue**: react-native-skia #750 - Quality of RNSkia rendering on high-DPI devices
- **Google Groups**: Canvas-kit text rendering on high-DPI devices
- **Solution**: `canvas.scale(devicePixelRatio, devicePixelRatio)` equivalent in React Native Skia

## Core Architecture

### Canvas Dimensions
```typescript
// Fixed dimensions for consistent export
const displayWidth = 200;  // Canvas width in pixels
const displayHeight = 259; // Canvas height in pixels

// These dimensions are used for both:
// 1. Canvas rendering size
// 2. PDF export size
const a4ExportWidth = displayWidth;
const a4ExportHeight = displayHeight;
```

### Display Scaling
```typescript
// Transform scale for better screen visibility
const displayScale = 1.84; // Final scale for perfect fit to red border lines

// Style configuration for scaled display
<View style={{
  transform: [{ scale: displayScale }],
  alignSelf: 'center',
  marginTop: 150, // Moved down 50px to avoid covering export buttons
}}>
  <SkiaInvoiceCanvas {...props} />
</View>
```

## Canvas Configuration

### SkiaInvoiceCanvas Setup
```typescript
<SkiaInvoiceCanvas
  ref={a4ExportRef}
  invoice={invoice}
  client={client}
  business={businessSettings}
  currencySymbol={currencySymbol}
  renderSinglePage={0}  // Critical: forces single page mode
  style={{ 
    width: 200,   // Fixed width for compact export
    height: 259   // Fixed height for perfect aspect ratio
  }}
/>
```

### Critical Props
- `renderSinglePage={0}` - Forces single page rendering (prevents pagination)
- `style.width: 200` - Fixed width ensures consistent export size
- `style.height: 259` - Fixed height maintains aspect ratio

## Border Implementation

### CRITICAL: Use Solid Rectangles, NOT Strokes
```typescript
// ✅ CORRECT: Solid rectangle borders
<Rect x={0} y={0} width={canvasWidth} height={2} color="black" />        // Top
<Rect x={0} y={0} width={2} height={totalHeight} color="black" />        // Left  
<Rect x={canvasWidth - 2} y={0} width={2} height={totalHeight} color="black" /> // Right
<Rect x={0} y={totalHeight - 2} width={canvasWidth} height={2} color="black" /> // Bottom

// ❌ WRONG: Stroke borders (cause clipping issues)
<Rect rect={...} style="stroke" strokeWidth={2} color="black" />
```

### Why Solid Rectangles Work
- Skia Canvas has issues rendering strokes at canvas edges
- Solid rectangles render properly across full canvas width/height
- Edge-to-edge positioning (x=0, width=canvasWidth) works perfectly

## PDF Export Process

### Image Snapshot Configuration
```typescript
const imageSnapshot = await ref.current?.makeImageSnapshot();
if (imageSnapshot) {
  const base64Data = imageSnapshot.encodeToBase64();
  // Use base64Data for PDF generation
}
```

### HTML Template for PDF
```html
<!DOCTYPE html>
<html>
<body style="margin: 0; padding: 0;">
  <img src="data:image/png;base64,${base64Data}" 
       style="width: 100%; height: 100%; object-fit: contain;" />
</body>
</html>
```

### Critical: Zero Margins
- `margin: 0; padding: 0;` in HTML template prevents extra spacing
- Results in exact canvas size = PDF size matching

## Key Measurements

### Exact Dimensions
- **Canvas Internal**: 200×259px
- **Display Visual**: ~369×476px (with 1.84× transform scale)
- **PDF Export**: 200×259px (matches internal canvas)

### Border Positioning
```typescript
// Edge-to-edge borders for full coverage
const borderTop = { x: 0, y: 0, width: 200, height: 2 };
const borderLeft = { x: 0, y: 0, width: 2, height: 259 };
const borderRight = { x: 198, y: 0, width: 2, height: 259 };
const borderBottom = { x: 0, y: 257, width: 200, height: 2 };
```

### Font Scaling
```typescript
// From section optimized for compact size
const fontSize = 8; // Perfect balance: visible but compact
const lineSpacing = 8; // Reduced from 12px for tighter layout
```

## Critical Implementation Notes

### DO NOT Use
- ❌ Stroke-based borders (`style="stroke"`)
- ❌ Container padding/margins in export mode  
- ❌ Variable canvas dimensions based on content
- ❌ Font sizes below 8px (causes blur in PDF)

### ALWAYS Use
- ✅ Solid rectangle borders
- ✅ Fixed canvas dimensions (200×259px)
- ✅ `renderSinglePage={0}` prop
- ✅ Transform scaling for display only
- ✅ Zero margins in HTML template
- ✅ DevicePixelRatio scaling for crisp text

### Troubleshooting

#### Text Still Blurry?
1. ✅ Verify devicePixelRatio scaling is applied
2. ✅ Check Group transform wrapper is present
3. ✅ Ensure font sizes are scaled by devicePixelRatio
4. ✅ Confirm minimum font size is 8px or higher

#### Wrong PDF Size?
1. Check `style.width/height` props on SkiaInvoiceCanvas
2. Verify `renderSinglePage={0}` is set
3. Confirm HTML template has zero margins

#### Missing Borders?
1. Verify using solid Rect elements, not strokes
2. Check edge-to-edge positioning (x=0, width=canvasWidth)
3. Ensure border height matches totalCanvasHeight

## Step-by-Step Recreation Guide

### 1. Create Export Test Page
```typescript
// app/(app)/(protected)/invoices/export-test.tsx
export default function ExportTest() {
  return (
    <View style={{ transform: [{ scale: 1.84 }], alignSelf: 'center', marginTop: 150 }}>
      <SkiaInvoiceCanvas 
        renderSinglePage={0}
        style={{ width: 200, height: 259 }}
        {...otherProps}
      />
    </View>
  );
}
```

### 2. Implement Canvas with DevicePixelRatio
```typescript
const devicePixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

return (
  <Canvas style={{ width: 200, height: 259 }}>
    <Group transform={[{ scale: devicePixelRatio }]}>
      {/* All content here */}
    </Group>
  </Canvas>
);
```

### 3. Add Solid Rectangle Borders
```typescript
<Rect x={0} y={0} width={200} height={2} color="black" />
<Rect x={0} y={0} width={2} height={259} color="black" />
<Rect x={198} y={0} width={2} height={259} color="black" />
<Rect x={0} y={257} width={200} height={2} color="black" />
```

### 4. Configure PDF Export
```typescript
const generatePDF = async () => {
  const imageSnapshot = await ref.current?.makeImageSnapshot();
  const base64Data = imageSnapshot.encodeToBase64();
  
  const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <body style="margin: 0; padding: 0;">
      <img src="data:image/png;base64,${base64Data}" 
           style="width: 100%; height: 100%; object-fit: contain;" />
    </body>
    </html>
  `;
  
  // Generate PDF from HTML
};
```

## Final Result
- ✅ Perfect screen-to-PDF matching
- ✅ Crisp, professional text rendering  
- ✅ Edge-to-edge borders
- ✅ Compact 200×259px PDF size
- ✅ 1.84× display scaling for optimal visibility
- ✅ Zero export/display discrepancies
