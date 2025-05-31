# Invoice Status System

## Overview

The Invoice Status System provides a comprehensive workflow for managing invoice states throughout their lifecycle. This system gives users **maximum flexibility** to set any status they want, while providing helpful guidance and confirmations for potentially impactful changes.

## Status Types

### Available Statuses

1. **Draft** (`draft`)
   - Default status for new invoices
   - Invoice is being created or edited
   - Can transition to: **Any status**

2. **Sent** (`sent`)
   - Invoice has been sent to the client
   - Client can view and pay the invoice
   - Can transition to: **Any status**

3. **Paid** (`paid`)
   - Invoice has been fully paid
   - Can transition to: **Any status** (user may need to reopen for corrections)

4. **Overdue** (`overdue`)
   - Invoice is past the due date
   - Can transition to: **Any status**

5. **Partial** (`partial`)
   - Invoice has been partially paid
   - Can transition to: **Any status**

6. **Cancelled** (`cancelled`)
   - Invoice has been cancelled
   - Can transition to: **Any status**

## Implementation Architecture

### Core Files

- `constants/invoice-status.ts` - Status definitions, configurations, and helper functions
- `components/StatusBadge.tsx` - Visual status indicator component
- `components/StatusSelectorSheet.tsx` - Status change interface
- `hooks/useInvoiceStatusUpdater.ts` - Automatic status updates (e.g., overdue)

### Status Configuration

Each status has:
- **Label**: Human-readable display name
- **Color**: Primary color for the status
- **Background Color**: Background color for badges
- **Description**: Explanation of what the status means

### User Freedom Philosophy

#### Maximum Flexibility
- Users can change any invoice to any status at any time
- No strict business rules prevent status transitions
- Helpful confirmations for potentially impactful changes

#### Smart Warnings
- Editing non-draft invoices shows a warning but allows the action
- Cancelling invoices shows confirmation with reassurance it can be undone
- Sending draft invoices shows confirmation about client visibility

#### Automatic Helpers
- `sent` invoices can still automatically become `overdue` when past due date
- Users can override automatic status changes at any time
- Updates run every 5 minutes via `useInvoiceStatusUpdater` hook

## User Interface

### Status Display
- Uses `StatusBadge` component with consistent colors across the app
- Badges are clickable in invoice viewer to open status selector
- Different sizes available: small, medium, large

### Status Changes
- `StatusSelectorSheet` shows **all available statuses** except the current one
- Minimal confirmations - only for potentially confusing actions
- No restrictions on transitions - complete user freedom
- Clear descriptions help users understand each status

### Visual Indicators
- Draft: Gray (not yet sent)
- Sent: Blue (active, awaiting payment)
- Paid: Green (successful completion)
- Overdue: Red (requires attention)
- Partial: Orange (in progress)
- Cancelled: Gray (inactive)

## Integration Points

### Invoice List (`app/(app)/(protected)/invoices/index.tsx`)
- Displays status badges instead of text
- Automatic status updates on focus
- Filters invoices by status for analytics

### Invoice Viewer (`app/(app)/(protected)/invoices/invoice-viewer.tsx`)
- Interactive status badge in header
- Edit button always available with smart warnings for non-draft invoices
- Send/resend button adapts to current status

### Invoice Creation (`app/(app)/(protected)/invoices/create.tsx`)
- Always saves as draft initially
- Proper status handling in edit mode
- Users can edit invoices in any status with appropriate warnings

### Database Schema
```sql
-- Status field in invoices table
status TEXT NOT NULL DEFAULT 'draft'
-- Supports: 'draft', 'sent', 'paid', 'overdue', 'partial', 'cancelled'
```

## Usage Examples

### Checking if Invoice is Editable (Now Advisory)
```typescript
import { isEditable } from '@/constants/invoice-status';

if (isEditable(invoice.status)) {
  // Edit directly
} else {
  // Show warning but allow editing
  Alert.alert('Edit Warning', 'This may affect the invoice status...');
}
```

### Status Changes (Now Fully Flexible)
```typescript
import { getAvailableStatusOptions } from '@/constants/invoice-status';

// Get all statuses user can change to (all except current)
const availableStatuses = getAvailableStatusOptions(currentStatus);
// Returns: all statuses except the current one
```

### Using Status Badge
```typescript
import { StatusBadge } from '@/components/StatusBadge';

<StatusBadge status={invoice.status} size="medium" />
```

### Automatic Status Updates
```typescript
import { useInvoiceStatusUpdater } from '@/hooks/useInvoiceStatusUpdater';

// In your component
useInvoiceStatusUpdater(); // Handles overdue detection automatically
```

## Migration Notes

### From Strict Rules to User Freedom
The previous system:
- Enforced strict business rule transitions
- Blocked users from certain actions
- Limited flexibility

The new system:
- Gives users complete freedom
- Uses warnings instead of blocks
- Maintains helpful guidance

### Database Compatibility
- No database changes needed
- All existing statuses remain valid
- System remains backward compatible

## Best Practices

1. **Trust users** - provide guidance but allow flexibility
2. **Use helpful confirmations** for potentially confusing actions
3. **Use status badges** consistently throughout the UI
4. **Provide clear descriptions** of what each status means
5. **Log status changes** for audit purposes when needed
6. **Keep automatic helpers** but allow user overrides

## User Experience Guidelines

### When to Show Confirmations
- ✅ Cancelling invoices (with reassurance it can be undone)
- ✅ Sending draft invoices (explains client visibility)
- ❌ Most other status changes (let users work freely)

### When to Show Warnings
- ✅ Editing non-draft invoices (but allow the action)
- ✅ Potentially confusing status combinations
- ❌ Standard workflow actions

### When to Allow Freely
- ✅ Any status to any status transitions
- ✅ Editing invoices in any status
- ✅ Deleting appropriate invoices
- ✅ User-driven status corrections

## Future Enhancements

- Status change history tracking
- Custom status workflows per business type
- Bulk status operations
- Integration with payment processors for automatic updates
- User-defined status meanings and colors 