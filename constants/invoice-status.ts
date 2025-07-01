export const INVOICE_STATUSES = {
  DRAFT: 'draft',
  SENT: 'sent', 
  PAID: 'paid',
  OVERDUE: 'overdue',
  PARTIAL: 'partial',
  CANCELLED: 'cancelled',
  CREDITED: 'credited',
} as const;

export type InvoiceStatus = typeof INVOICE_STATUSES[keyof typeof INVOICE_STATUSES];

export interface StatusConfig {
  label: string;
  color: string;
  backgroundColor: string;
  description: string;
}

export const STATUS_CONFIG: Record<InvoiceStatus, StatusConfig> = {
  [INVOICE_STATUSES.DRAFT]: {
    label: 'Draft',
    color: '#6B7280', // Gray
    backgroundColor: '#F3F4F6',
    description: 'Invoice is being created or edited',
  },
  [INVOICE_STATUSES.SENT]: {
    label: 'Sent',
    color: '#2563EB', // Blue
    backgroundColor: '#DBEAFE', 
    description: 'Invoice has been sent to client',
  },
  [INVOICE_STATUSES.PAID]: {
    label: 'Paid',
    color: '#059669', // Green
    backgroundColor: '#D1FAE5',
    description: 'Invoice has been fully paid',
  },
  [INVOICE_STATUSES.OVERDUE]: {
    label: 'Overdue',
    color: '#DC2626', // Red
    backgroundColor: '#FEE2E2',
    description: 'Invoice is past due date',
  },
  [INVOICE_STATUSES.PARTIAL]: {
    label: 'Partial',
    color: '#D97706', // Orange
    backgroundColor: '#FED7AA',
    description: 'Invoice has been partially paid',
  },
  [INVOICE_STATUSES.CANCELLED]: {
    label: 'Cancelled',
    color: '#6B7280', // Gray
    backgroundColor: '#F3F4F6',
    description: 'Invoice has been cancelled',
  },
  [INVOICE_STATUSES.CREDITED]: {
    label: 'Credited',
    color: '#7C3AED', // Purple
    backgroundColor: '#EDE9FE',
    description: 'Invoice has been credited',
  },
};

// Helper functions
export const getStatusConfig = (status: InvoiceStatus): StatusConfig => {
  return STATUS_CONFIG[status] || STATUS_CONFIG[INVOICE_STATUSES.DRAFT];
};

// Get all available statuses for selection (now returns all statuses)
export const getAllStatuses = (): InvoiceStatus[] => {
  return Object.values(INVOICE_STATUSES);
};

// Get all statuses except the current one for selection
export const getAvailableStatusOptions = (currentStatus: InvoiceStatus): InvoiceStatus[] => {
  return getAllStatuses().filter(status => status !== currentStatus);
};

// Legacy function for backward compatibility - now just returns all statuses except current
export const getAvailableTransitions = (currentStatus: InvoiceStatus): InvoiceStatus[] => {
  return getAvailableStatusOptions(currentStatus);
};

// Simplified transition check - now always returns true for user freedom
export const canTransitionTo = (fromStatus: InvoiceStatus, toStatus: InvoiceStatus): boolean => {
  return fromStatus !== toStatus; // Can change to any status except the same one
};

// Business logic helpers - made more permissive
export const isEditable = (status: InvoiceStatus): boolean => {
  // Allow editing of draft and cancelled invoices by default, but users can override
  return status === INVOICE_STATUSES.DRAFT || status === INVOICE_STATUSES.CANCELLED;
};

export const isDeletable = (status: InvoiceStatus): boolean => {
  // Allow deletion of draft and cancelled invoices by default
  return status === INVOICE_STATUSES.DRAFT || status === INVOICE_STATUSES.CANCELLED;
};

export const canMarkAsPaid = (status: InvoiceStatus): boolean => {
  // Allow marking as paid from any status except already paid
  return status !== INVOICE_STATUSES.PAID;
};

export const canSendToClient = (status: InvoiceStatus): boolean => {
  // Allow sending from any status except already sent (unless resending)
  return true; // User freedom - they can send from any status
};

// Auto-status helpers - keep for automatic background processes
export const shouldAutoMarkOverdue = (status: InvoiceStatus, dueDate: string | null): boolean => {
  if (!dueDate || status !== INVOICE_STATUSES.SENT) return false;
  return new Date(dueDate) < new Date();
};

// Payment status helpers
export const calculatePaymentStatus = (paidAmount: number, totalAmount: number): InvoiceStatus => {
  if (paidAmount <= 0) {
    return INVOICE_STATUSES.SENT; // No payment = sent (assuming it was sent)
  } else if (paidAmount >= totalAmount) {
    return INVOICE_STATUSES.PAID; // Full payment = paid
  } else {
    return INVOICE_STATUSES.PARTIAL; // Partial payment = partial
  }
};

export const getPaymentPercentage = (paidAmount: number, totalAmount: number): number => {
  if (totalAmount <= 0) return 0;
  return Math.min((paidAmount / totalAmount) * 100, 100);
};

export const getRemainingAmount = (paidAmount: number, totalAmount: number): number => {
  return Math.max(totalAmount - paidAmount, 0);
};

export const isFullyPaid = (paidAmount: number, totalAmount: number): boolean => {
  return paidAmount >= totalAmount && totalAmount > 0;
};

export const isPartiallyPaid = (paidAmount: number, totalAmount: number): boolean => {
  return paidAmount > 0 && paidAmount < totalAmount;
}; 