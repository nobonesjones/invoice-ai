# Skia Migration Plan
**Goal:** Replace current React Native + HTML dual system with unified Skia rendering that produces pixel-perfect screen-to-PDF matching.
NO DUMMY OR HARDCODED DATA WONCE WE HAVE TH EBAIC STRUCTURE IN PLACE, DO NOT PUT HARD CODED DATA WE WANT THIS TO WORK THE SAME AS THE @INVOICE-VIEWER WORKS. 

## **Current System Analysis**
- ✅ **Screen:** `InvoiceTemplateOne.tsx` (React Native components)
- ✅ **PDF:** `generateInvoiceTemplateOneHtml.ts` (HTML string generation)
- ❌ **Problem:** Two separate codebases for same visual design
- ❌ **Issue:** Constant manual synchronization required
- ❌ **Result:** Screen and PDF never perfectly match

## **Target System**
- ✅ **Unified:** Single Skia Canvas component renders both screen AND PDF
- ✅ **Exact:** Pixel-perfect matching between screen and PDF
- ✅ **Scalable:** Adding new invoice designs requires single implementation
- ✅ **Maintainable:** One codebase, one design system

---

## **Phase 1: Design Preservation ✅ COMPLETED**

### ✅ Step 1.1: Design Token Extraction
**Status:** COMPLETED - Created `app/design-tokens/invoice-design-tokens.ts`

**What was captured:**
- All typography specifications (14 different text styles)
- Layout dimensions and proportions (table columns, spacing)
- Color palette and shadow specifications
- Border styles and measurements
- Helper functions for layout calculations

### 📋 Step 1.2: Take Reference Screenshots
**Next Action Required:**
```bash
# Take high-resolution screenshots of current invoices
# Different states: draft, sent, paid
# Different item counts: 5 items, 12 items, 15+ items (pagination)
# Save to: docs/design-reference/screenshots/
```

### 📋 Step 1.3: Create Layout Specifications
**File to create:** `docs/design-reference/layout-measurements.md`
- Document exact pixel measurements
- Table column widths at different screen sizes
- Page break logic specifications
- Footer positioning rules

---

## **Phase 2: Skia Environment Setup ✅ COMPLETED**

### ✅ Step 2.1: Install Dependencies
**Status:** COMPLETED
```bash
npx expo install @shopify/react-native-skia
```

### ✅ Step 2.2: Create Skia Infrastructure
**Status:** COMPLETED - Created all foundation files:
- ✅ `types/skia-invoice.types.ts` - Complete type definitions
- ✅ `utils/skia/invoiceSkiaHelpers.ts` - Drawing utilities and helpers
- ✅ `components/skia/SkiaInvoiceCanvas.tsx` - Main canvas component
- ✅ Basic layout calculation functions
- ✅ Font management system
- ✅ Color and measurement utilities

### ✅ Step 2.3: Create Test Environment
**Status:** COMPLETED - Created `app/(app)/(protected)/skia-test.tsx`
- ✅ Side-by-side comparison interface
- ✅ Sample invoice data (5 items and 15 items for pagination)
- ✅ Test controls and switches
- ✅ Testing checklist and status tracking
- ✅ Export test functionality placeholder

---

## **Phase 3: Skia Component Recreation 🟡 IN PROGRESS**

### ✅ Step 3.1: Basic Canvas Setup
**Status:** COMPLETED
- ✅ Canvas rendering with correct dimensions
- ✅ Page background and basic structure
- ✅ Multi-page support with pagination
- ✅ Loading states and error handling

### 🟡 Step 3.2: Header Section Recreation
**Status:** IN PROGRESS - Basic structure done, needs refinement
- ✅ "INVOICE" label placement
- ✅ Logo placeholder positioning
- 📋 **Need to add:** Business logo loading from URL
- 📋 **Need to add:** Invoice number and date positioning
- 📋 **Need to improve:** Font sizes to match design tokens exactly

### 🟡 Step 3.3: Meta Section Recreation
**Status:** IN PROGRESS - Basic structure done, needs completion
- ✅ Two-column layout (60/40 split)
- ✅ "FROM:" and "TO:" labels
- ✅ Business and client name display
- 📋 **Need to add:** Complete address formatting
- 📋 **Need to add:** Email, phone, website display
- 📋 **Need to add:** Invoice metadata (date, due date, number)

### 📋 Step 3.4: Table Section Recreation
**Status:** PARTIALLY DONE - Basic table structure created
- ✅ Table header with correct column widths
- ✅ Row rendering with data
- ✅ Alternating row backgrounds
- ✅ Basic pagination support
- 📋 **Need to improve:** Font sizes to match exactly
- 📋 **Need to add:** Item descriptions with line wrapping
- 📋 **Need to add:** Tax calculations per line
- 📋 **Need to add:** Discount handling

### 📋 Step 3.5: Footer Section Recreation
**Status:** BASIC STRUCTURE DONE - Needs complete implementation
- ✅ Footer border and positioning
- ✅ Basic totals display
- 📋 **Need to add:** Complete totals breakdown (subtotal, tax, discounts)
- 📋 **Need to add:** Payment terms and notes
- 📋 **Need to add:** Payment method icons
- 📋 **Need to add:** Grand total highlighting

### 📋 Step 3.6: Page Break Logic
**Status:** BASIC STRUCTURE DONE - Needs refinement
- ✅ Multi-page rendering
- ✅ Page numbering
- 📋 **Need to add:** Continuation headers
- 📋 **Need to add:** Running subtotals
- 📋 **Need to improve:** Content overflow detection

---

## **Phase 4: PDF Export Integration**

### 📋 Step 4.1: Skia PDF Export
```typescript
// Export Skia canvas to PDF bytes
const exportToPDF = async (canvas: SkiaCanvas) => {
  const image = canvas.makeImageSnapshot();
  const pdfData = await generatePDFFromImage(image);
  return pdfData;
};
```

### 📋 Step 4.2: File System Integration
- Integration with existing `expo-file-system`
- Sharing functionality preservation
- Print functionality preservation

---

## **Phase 5: Integration & Testing**

### 📋 Step 5.1: Component Replacement
**Files to update:**
- `InvoiceTemplateOne.tsx` → Replace with Skia version
- `generateInvoiceTemplateOneHtml.ts` → Delete (no longer needed)
- `invoice-viewer.tsx` → Update to use Skia component

### 📋 Step 5.2: Pagination System Update
**Files to update:**
- `utils/invoicePagination.ts` → Adapt for Skia rendering
- Remove HTML-specific pagination logic
- Integrate with Skia canvas pagination

### 📋 Step 5.3: Testing & Validation
- Side-by-side comparison with old system
- PDF output verification
- Performance testing
- Cross-platform compatibility

---

## **Phase 6: Cleanup & Documentation**

### 📋 Step 6.1: Remove Old System
**Files to delete:**
- `generateInvoiceTemplateOneHtml.ts`
- HTML template generation utilities
- Related HTML-specific types

### 📋 Step 6.2: Update Documentation
- Component usage examples
- Design token modification guide
- Adding new invoice templates guide

---

## **Migration Strategy**

### **Parallel Development**
1. Keep current system working during migration
2. Build Skia system alongside existing system
3. Test Skia system thoroughly before switching
4. Feature flag for gradual rollout

### **Risk Mitigation**
- Preserve all current files until Skia system is proven
- Comprehensive testing at each phase
- Rollback plan if issues arise
- User acceptance testing with real invoices

### **Success Criteria**
- [ ] Pixel-perfect matching between screen and PDF
- [ ] Performance equal to or better than current system
- [ ] All existing features preserved
- [ ] Pagination working correctly
- [ ] Invoice sharing functionality intact
- [ ] Print and export functionality working

---

## **Expected Timeline**

**Phase 1:** ✅ **1 day** (COMPLETED)
**Phase 2:** ✅ **2 days** (COMPLETED)
**Phase 3:** 🟡 **4-5 days** (IN PROGRESS - 40% complete)
**Phase 4:** 📋 **1-2 days** (PDF integration)
**Phase 5:** 📋 **2-3 days** (Integration & testing)
**Phase 6:** 📋 **1 day** (Cleanup)

**Total: 11-14 days** (2-3 weeks part-time)

---

## **Next Immediate Actions**

### **Priority 1: Complete Header Section (Step 3.2)**
1. **Load business logo from URL** using Skia Image loading
2. **Add invoice metadata** (number, date, due date) with exact positioning
3. **Fine-tune typography** to match design tokens exactly

### **Priority 2: Complete Meta Section (Step 3.3)**
1. **Add complete address formatting** with line breaks
2. **Add email, phone, website display**
3. **Position invoice metadata** correctly

### **Priority 3: Enhance Table Section (Step 3.4)**
1. **Implement text wrapping** for long descriptions
2. **Add tax calculations** per line item
3. **Improve font sizing** to match current system exactly

Ready to proceed with Priority 1? 🚀

## **How to Test Current Progress**

1. **Navigate to the test screen:**
   ```
   Go to: (app)/(protected)/skia-test
   ```

2. **Compare side-by-side:**
   - Toggle between 5-item and 15-item invoices
   - Compare Current System vs New Skia System
   - Check typography, spacing, and layout alignment

3. **Test pagination:**
   - Enable "Show long invoice (15 items)" 
   - Verify 2-page layout matches current system

4. **Visual inspection checklist:**
   - Typography sizes and weights
   - Column proportions and alignment
   - Color consistency
   - Border and spacing accuracy 