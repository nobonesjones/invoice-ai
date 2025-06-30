# Estimates Implementation Plan

## 🎯 **Project Overview**

Transform the existing invoice system into a complete estimates feature with identical UX/UI but estimate-specific terminology, statuses, and business logic.

## 📊 **Current Invoice System Analysis**

### **Database Structure:**
- `invoices` table (main invoice data)
- `invoice_line_items` table (line item details)
- `invoice_shares` table (sharing functionality)
- `invoice_share_analytics` table (tracking analytics)

### **File Structure (18+ files):**
- `invoices/index.tsx` (Dashboard with filtering/search)
- `invoices/create.tsx` (Create/edit with full features)
- `invoices/invoice-viewer.tsx` (View/manage/send)
- `invoices/preview.tsx` (Preview before sending)
- 14+ supporting component sheets and utilities

### **Key Features:**
- Complete CRUD operations
- Status management (draft → sent → paid → overdue)
- Client integration with selection/creation
- Line items with quantities, prices, discounts
- Tax and discount calculations
- PDF generation and sharing
- Email sending functionality
- Payment tracking and management
- Multiple design templates (Skia-based)
- Analytics and activity logging

## 🏗️ **Implementation Strategy**

### **Approach: Smart Cloning with Adaptation**
1. **Clone & Rename**: Copy invoice components and rename for estimates
2. **Database Mapping**: Adapt for estimate-specific tables and fields
3. **Status Adaptation**: Replace invoice statuses with estimate statuses
4. **Business Logic**: Modify workflows for estimate lifecycle
5. **Terminology**: Update all text from "invoice" to "estimate"

## 📋 **Detailed Implementation Plan**

### **Phase 1: Foundation (Database & Types) ✅ COMPLETED**
- [x] Create estimates database tables
- [x] Create estimate status constants
- [x] Update TypeScript types

### **Phase 2: Core Directory Structure**
```bash
app/(app)/(protected)/estimates/
├── index.tsx                    # Dashboard (clone from invoices/index.tsx)
├── create.tsx                   # Create/Edit (clone from invoices/create.tsx)
├── estimate-viewer.tsx          # View/Manage (clone from invoices/invoice-viewer.tsx)
├── preview.tsx                  # Preview (clone from invoices/preview.tsx)
├── _layout.tsx                  # Layout (copy from invoices/_layout.tsx)
└── [Supporting Components]      # Clone all sheets and utilities
```

### **Phase 3: Supporting Components & Sheets**
Clone and adapt all invoice sheets:
- `NewClientSelectionSheet.tsx` → `EstimateClientSelectionSheet.tsx`
- `AddItemSheet.tsx` → `EstimateAddItemSheet.tsx`
- `EditInvoiceDetailsSheet.tsx` → `EditEstimateDetailsSheet.tsx`
- `SetDueDateSheet.tsx` → `SetValidUntilDateSheet.tsx`
- `SelectDiscountTypeSheet.tsx` → `EstimateDiscountTypeSheet.tsx`
- `EditInvoiceTaxSheet.tsx` → `EditEstimateTaxSheet.tsx`
- `MakePaymentSheet.tsx` → `EstimateConversionSheet.tsx` (convert to invoice)
- `InvoiceHistorySheet.tsx` → `EstimateHistorySheet.tsx`
- All other supporting sheets and utilities

### **Phase 4: Services & Utilities**
Create estimate-specific services:
- `services/estimateService.ts` (clone from invoice services)
- `services/estimateShareService.ts` (clone sharing functionality)
- `hooks/useEstimateActivityLogger.ts` (clone activity logging)
- `hooks/useEstimateStatusUpdater.ts` (clone status management)
- `utils/generateEstimateTemplateHtml.ts` (clone PDF generation)

### **Phase 5: Templates & Design Components**
Adapt Skia invoice templates for estimates:
- `components/skia/SkiaEstimateCanvas.tsx`
- `components/skia/SkiaEstimateCanvasModern.tsx`
- `components/skia/SkiaEstimateCanvasSimple.tsx`
- `components/EstimatePreviewModal.tsx`

## 🔄 **Workflow Mapping: Invoice → Estimate**

### **Dashboard Workflow:**
```
Invoice Dashboard → Estimate Dashboard
├── "Invoices" → "Estimates"
├── "Invoice Amount" → "Estimate Value"
├── "Paid Amount" → "Accepted Amount"
├── "Overdue Amount" → "Expired Amount"
├── Filter: "paid/overdue" → "accepted/expired"
└── Actions: Same navigation patterns
```

### **Creation Workflow:**
```
Create Invoice → Create Estimate
├── "Invoice Number" → "Estimate Number"
├── "Invoice Date" → "Estimate Date"
├── "Due Date" → "Valid Until Date"
├── Line items: Identical functionality
├── Tax/Discount: Identical functionality
└── Actions: "Save Invoice" → "Save Estimate"
```

### **Viewing Workflow:**
```
Invoice Viewer → Estimate Viewer
├── "Send Invoice" → "Send Estimate"
├── "Mark as Paid" → "Mark as Accepted/Declined"
├── "Payment Tracking" → "Conversion to Invoice"
├── Status badges: Estimate-specific colors
└── Actions: Estimate-specific options
```

## 📝 **Key Differences: Invoice vs Estimate**

### **Terminology Changes:**
| Invoice Term | Estimate Term |
|--------------|---------------|
| Invoice Number | Estimate Number |
| Invoice Date | Estimate Date |
| Due Date | Valid Until Date |
| Send Invoice | Send Estimate |
| Mark as Paid | Mark as Accepted |
| Payment Terms | Acceptance Terms |
| Overdue | Expired |
| Invoice Amount | Estimate Value |

### **Status Mapping:**
| Invoice Status | Estimate Status | Description |
|----------------|-----------------|-------------|
| Draft | Draft | Being created |
| Sent | Sent | Sent to client |
| Paid | Accepted | Client accepted |
| Overdue | Expired | Past valid date |
| Partial | Declined | Client declined |
| Cancelled | Cancelled | Cancelled estimate |
| N/A | Converted | Became an invoice |

### **Business Logic Changes:**
- **Payment Tracking** → **Acceptance Tracking**
- **Payment Methods** → **Conversion Options**
- **Due Date Alerts** → **Expiration Alerts**
- **Payment History** → **Response History**
- **Convert to Invoice** (new estimate-specific action)

## 🚀 **Implementation Phases**

### **Phase 1: Foundation ✅ COMPLETED**
- Database tables created
- Status constants defined
- TypeScript types ready

### **Phase 2: Core Files (Next)**
```bash
Priority Order:
1. Create estimates directory structure
2. Clone and adapt index.tsx (dashboard)
3. Clone and adapt create.tsx (creation)
4. Clone and adapt estimate-viewer.tsx (viewing)
5. Clone and adapt preview.tsx (preview)
```

### **Phase 3: Supporting Components**
- Clone all sheet components
- Adapt for estimate terminology
- Update business logic

### **Phase 4: Services & Integration**
- Clone services for estimates
- Update database queries
- Adapt sharing functionality

### **Phase 5: Templates & Polish**
- Adapt Skia templates
- Update PDF generation
- Polish UX/UI differences

### **Phase 6: Testing & Integration**
- Test all workflows
- Integration testing
- Bug fixes and polish

## 💡 **Smart Implementation Strategy**

### **Automated Cloning Approach:**
1. **File Cloning**: Copy entire invoice directory structure
2. **Mass Rename**: Use find/replace for terminology
3. **Database Adaptation**: Update all database references
4. **Status Logic**: Replace invoice status logic
5. **Business Rules**: Adapt estimate-specific workflows

### **Key Adaptation Points:**
- Database table references (`invoices` → `estimates`)
- Status constants imports
- Terminology in all UI text
- Business logic for estimate lifecycle
- Navigation routes and parameters

## 🎨 **UI/UX Considerations**

### **Visual Consistency:**
- Same design language and components
- Same color scheme (with status-specific colors)
- Same layout and navigation patterns
- Same interaction patterns

### **Terminology Accuracy:**
- Professional estimate language
- Clear client communication
- Appropriate business terminology
- Consistent labeling throughout

### **User Experience:**
- Familiar workflow for existing users
- Intuitive estimate-specific actions
- Clear status progression
- Smooth conversion to invoice flow

## 📊 **Success Metrics**

### **Technical Goals:**
- [ ] 100% feature parity with invoices
- [ ] Estimate-specific business logic
- [ ] Complete CRUD operations
- [ ] PDF generation and sharing
- [ ] Email functionality

### **User Experience Goals:**
- [ ] Intuitive estimate workflow
- [ ] Seamless navigation
- [ ] Clear status management
- [ ] Professional estimate presentation
- [ ] Smooth invoice conversion

## 🔄 **Next Steps**

1. **Execute Phase 2**: Create core estimate files
2. **Database Migration**: Run estimate tables migration
3. **Core Components**: Implement main estimate screens
4. **Incremental Testing**: Test each component as built
5. **Integration**: Connect all estimate workflows
6. **Polish**: Refine UX and fix edge cases

This plan provides a systematic approach to creating a complete estimates feature that maintains the same high-quality experience as the invoice system while providing estimate-specific functionality and terminology. 