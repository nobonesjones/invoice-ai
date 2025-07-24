# New Template Creation Plan

## Overview
This document outlines the standardized workflow for creating new invoice/estimate templates using React Native Skia. The goal is to enable rapid template creation while preserving proven sizing, positioning, and export functionality.

## Current Template Analysis

### Working Templates
- **Classic Template** (`SkiaInvoiceCanvas`): Traditional blue accents, standard layout, proven export sizing
- **Modern Template** (`SkiaInvoiceCanvasModern`): Dark header block with turquoise accents, full-width design

### Template to Replace
- **Simple Template** (`SkiaInvoiceCanvasSimple`): Basic testing template, non-standard sizing, missing dynamic elements

## Template Design Categories

### 1. Header Layout Styles
- **Classic Style**: Logo left, title/details right-aligned
- **Modern Style**: Full-width header block with centered elements
- **Side-by-Side**: Logo and title both centered horizontally
- **Minimalist**: Title only, logo small/corner placement

### 2. Address Section Layouts
- **Standard**: From address left, Bill To address right (Classic style)
- **Centered**: Both addresses centered with visual separation
- **Stacked**: From address at top, Bill To address below

### 3. Table Positioning Styles
- **Full Width**: Edge-to-edge table (Modern style)
- **Padded**: Table with left/right margins (Classic style)
- **Centered**: Narrower table with center alignment

## Required Dynamic Elements

All templates MUST include these elements (positioned based on design style):

### Header Elements
- `logoImage` or `businessInitials` fallback circle
- `documentTitle` (INVOICE/ESTIMATE/QUOTE based on type)
- `invoiceNumber` (Ref: INV-000000)
- `invoiceDate` (Date: DD/MM/YYYY)
- `dueDate` (Due: payment terms or specific date)
- `poNumber` (conditional - PO: number if provided)

### Address Elements
- **From Section:**
  - `businessName`
  - `businessAddress` (multi-line support)
  - `businessTaxNumber` (conditional with tax_name)
- **Bill To Section:**
  - `clientName`
  - `clientAddress` (multi-line support)
  - `clientTaxNumber` (conditional with tax_name)

### Table Elements
- Table headers: QTY, DESCRIPTION, PRICE, TOTAL
- Dynamic `lineItems` with pagination support
- Item descriptions as subtitle text
- **Totals Section:**
  - `subtotal`
  - `discount` (conditional - percentage or fixed)
  - `tax` (with tax_name and percentage)
  - `paidAmount` (conditional - green text)
  - `balanceDue` (conditional - if payment made)
  - `grandTotal` (highlighted background)

### Footer Elements
- `notes` (conditional - Terms, Instructions & Notes)
- **Payment Methods** (conditional based on flags):
  - Stripe payment (with Visa/Mastercard icons)
  - PayPal payment (with PayPal icon and email)
  - Bank transfer (with bank details)

## Template Configuration System

Each template should use a configuration object:

```typescript
const templateConfig = {
  headerStyle: 'modern' | 'classic' | 'centered' | 'minimal',
  addressLayout: 'standard' | 'centered' | 'stacked',
  tableStyle: 'full-width' | 'padded' | 'centered',
  colors: {
    primary: string,     // Main accent color
    accent: string,      // Secondary accent
    text: string,        // Main text color
    background: string,  // Background color
    headerBlock?: string // For modern style headers
  },
  spacing: 'compact' | 'normal' | 'spacious'
}
```

## Critical Sizing Standards

All templates MUST preserve these proven dimensions:

### Canvas Dimensions
- **Display Size**: 370�560px (with 1.84� transform scaling for visibility)
- **Export Size**: 200�259px (when `renderSinglePage={0}` prop is used)
- **Multi-page Height**: Dynamic based on line items + pagination

### Export Requirements
- `renderSinglePage={0}` forces single page mode
- `exportPageNumber` for multi-page PDF generation
- DevicePixelRatio scaling for crisp text rendering
- Zero margins in HTML template for PDF export

### Font System
Consistent font scaling with fallbacks:
- `tiny`: 7px (item descriptions)
- `small`: 8px (table headers, line items)
- `body`: 9px (main text)
- `medium`: 10px (details)
- `large`: 11px (names, bold labels)
- `title`: 17px (document title)

### Pagination Logic
- Proven pagination system from Classic/Modern templates
- Adaptive scaling for 9-11 items (compact mode)
- Multi-page support with headers on each page
- Footer only on last page

## Standardized Workflow

### Step 1: Design Brief
Client provides:
- Visual design concept/inspiration images
- Layout style preference (header, address, table styles)
- Color scheme and accent colors
- Any special design elements (borders, backgrounds, icons)

### Step 2: Template Configuration
Developer defines positioning config:
- Choose base template (Classic for standard, Modern for full-width)
- Set headerStyle, addressLayout, tableStyle
- Define color palette
- Set spacing preference

### Step 3: Clone Proven Base
- Clone appropriate base template (Classic or Modern)
- Preserve ALL sizing, export logic, pagination, and font systems
- Keep all dynamic element functionality intact

### Step 4: Apply Design Modifications
- Reposition dynamic elements according to layout style
- Apply color scheme and visual styling
- Add design-specific elements (backgrounds, borders, etc.)
- Modify ONLY visual presentation, not functionality

### Step 5: Validation Checklist
- [ ] All required dynamic elements present and positioned
- [ ] Export sizing preserved (200�259px with renderSinglePage)
- [ ] Display scaling correct (370�560px with 1.84� transform)
- [ ] Pagination logic working for multi-page invoices
- [ ] Font rendering crisp with DevicePixelRatio scaling
- [ ] Payment methods display correctly when enabled
- [ ] Conditional elements (PO, discounts, payments) working
- [ ] PDF export matches screen display exactly

## File Structure

New templates should follow this pattern:
```
components/skia/SkiaInvoiceCanvas[TemplateName].tsx
constants/invoiceDesigns.ts (add new design entry)
```

### Template Registration
Add to `constants/invoiceDesigns.ts`:
```typescript
{
  id: 'template-name',
  name: 'template-name',
  displayName: 'Template Name',
  description: 'Brief description of design style',
  thumbnail: '/assets/invoice-designs/template-name-thumb.png',
  component: SkiaInvoiceCanvasTemplateName,
  colorScheme: COLOR_SCHEMES.templateName,
  layoutConfig: {
    headerPosition: 'top' | 'center' | 'split',
    sectionsLayout: 'standard' | 'side-by-side' | 'centered',
    spacing: 'compact' | 'normal' | 'spacious',
  },
}
```

## Success Metrics

A successful template implementation should:
1. Render all dynamic elements correctly in their designated positions
2. Export to PDF with exact screen-to-PDF matching
3. Handle pagination seamlessly for long invoice lists
4. Display payment methods and conditional elements properly
5. Maintain consistent font rendering across devices
6. Follow the established color scheme and layout configuration

## Future Enhancements

- Template preview gallery for user selection
- Real-time color customization
- Layout configuration UI
- Template marketplace/sharing
- Custom template builder interface

---

*This plan ensures consistent, high-quality template creation while preserving the complex sizing and export logic that has been perfected in the existing Classic and Modern templates.*