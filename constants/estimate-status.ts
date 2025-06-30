export const ESTIMATE_STATUSES = {
  DRAFT: 'draft',
  SENT: 'sent',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  EXPIRED: 'expired',
  CONVERTED: 'converted',
  CANCELLED: 'cancelled',
} as const;

export type EstimateStatus = typeof ESTIMATE_STATUSES[keyof typeof ESTIMATE_STATUSES];

export interface EstimateStatusConfig {
  label: string;
  color: string;
  backgroundColor: string;
  description: string;
}

// Function to get estimate status config
export const getEstimateStatusConfig = (status: EstimateStatus): EstimateStatusConfig => {
  return ESTIMATE_STATUS_CONFIG[status] || ESTIMATE_STATUS_CONFIG[ESTIMATE_STATUSES.DRAFT];
};

// Function to check if estimate should be automatically marked as expired
export const shouldAutoMarkExpired = (currentStatus: EstimateStatus, validUntilDate: string | null): boolean => {
  if (currentStatus !== ESTIMATE_STATUSES.SENT || !validUntilDate) {
    return false;
  }
  
  const now = new Date();
  const validUntil = new Date(validUntilDate);
  return now > validUntil;
};

export const ESTIMATE_STATUS_CONFIG: Record<EstimateStatus, EstimateStatusConfig> = {
  [ESTIMATE_STATUSES.DRAFT]: {
    label: 'Draft',
    color: '#6B7280', // Gray
    backgroundColor: '#F3F4F6',
    description: 'Estimate is being created or edited',
  },
  [ESTIMATE_STATUSES.SENT]: {
    label: 'Sent',
    color: '#2563EB', // Blue
    backgroundColor: '#DBEAFE', 
    description: 'Estimate has been sent to client',
  },
  [ESTIMATE_STATUSES.ACCEPTED]: {
    label: 'Accepted',
    color: '#059669', // Green
    backgroundColor: '#D1FAE5',
    description: 'Estimate has been accepted by client',
  },
  [ESTIMATE_STATUSES.DECLINED]: {
    label: 'Declined',
    color: '#DC2626', // Red
    backgroundColor: '#FEE2E2',
    description: 'Estimate has been declined by client',
  },
  [ESTIMATE_STATUSES.EXPIRED]: {
    label: 'Expired',
    color: '#D97706', // Orange
    backgroundColor: '#FED7AA',
    description: 'Estimate has passed its valid until date',
  },
  [ESTIMATE_STATUSES.CONVERTED]: {
    label: 'Converted',
    color: '#7C3AED', // Purple
    backgroundColor: '#EDE9FE',
    description: 'Estimate has been converted to an invoice',
  },
  [ESTIMATE_STATUSES.CANCELLED]: {
    label: 'Cancelled',
    color: '#6B7280', // Gray
    backgroundColor: '#F3F4F6',
    description: 'Estimate has been cancelled',
  },
};

// Helper functions

// Get all available statuses for selection
export const getAllEstimateStatuses = (): EstimateStatus[] => {
  return Object.values(ESTIMATE_STATUSES);
};

// Get all statuses except the current one for selection
export const getAvailableEstimateStatusOptions = (currentStatus: EstimateStatus): EstimateStatus[] => {
  return getAllEstimateStatuses().filter(status => status !== currentStatus);
};

// Get available transitions based on estimate business logic
export const getAvailableEstimateTransitions = (currentStatus: EstimateStatus): EstimateStatus[] => {
  switch (currentStatus) {
    case ESTIMATE_STATUSES.DRAFT:
      return [ESTIMATE_STATUSES.SENT, ESTIMATE_STATUSES.CANCELLED];
    case ESTIMATE_STATUSES.SENT:
      return [ESTIMATE_STATUSES.ACCEPTED, ESTIMATE_STATUSES.DECLINED, ESTIMATE_STATUSES.EXPIRED, ESTIMATE_STATUSES.CANCELLED];
    case ESTIMATE_STATUSES.ACCEPTED:
      return [ESTIMATE_STATUSES.CONVERTED, ESTIMATE_STATUSES.CANCELLED];
    case ESTIMATE_STATUSES.DECLINED:
      return [ESTIMATE_STATUSES.SENT, ESTIMATE_STATUSES.CANCELLED]; // Can resend after decline
    case ESTIMATE_STATUSES.EXPIRED:
      return [ESTIMATE_STATUSES.SENT, ESTIMATE_STATUSES.CANCELLED]; // Can resend after expiry
    case ESTIMATE_STATUSES.CONVERTED:
      return []; // Final state - no transitions
    case ESTIMATE_STATUSES.CANCELLED:
      return [ESTIMATE_STATUSES.DRAFT]; // Can reactivate cancelled estimates
    default:
      return [];
  }
};

// Business logic checks
export const canTransitionToEstimateStatus = (fromStatus: EstimateStatus, toStatus: EstimateStatus): boolean => {
  const availableTransitions = getAvailableEstimateTransitions(fromStatus);
  return availableTransitions.includes(toStatus);
};

// Business logic helpers
export const isEstimateEditable = (status: EstimateStatus): boolean => {
  return status === ESTIMATE_STATUSES.DRAFT || status === ESTIMATE_STATUSES.CANCELLED;
};

export const isEstimateDeletable = (status: EstimateStatus): boolean => {
  return status === ESTIMATE_STATUSES.DRAFT || status === ESTIMATE_STATUSES.CANCELLED;
};

export const canSendEstimateToClient = (status: EstimateStatus): boolean => {
  return status === ESTIMATE_STATUSES.DRAFT || 
         status === ESTIMATE_STATUSES.DECLINED || 
         status === ESTIMATE_STATUSES.EXPIRED;
};

export const canConvertToInvoice = (status: EstimateStatus): boolean => {
  return status === ESTIMATE_STATUSES.ACCEPTED;
};

export const canClientRespond = (status: EstimateStatus): boolean => {
  return status === ESTIMATE_STATUSES.SENT;
};

// Auto-status helpers

// Utility functions for estimate lifecycle
export const getEstimateLifecycleStage = (status: EstimateStatus): 'creation' | 'pending' | 'responded' | 'final' => {
  switch (status) {
    case ESTIMATE_STATUSES.DRAFT:
      return 'creation';
    case ESTIMATE_STATUSES.SENT:
      return 'pending';
    case ESTIMATE_STATUSES.ACCEPTED:
    case ESTIMATE_STATUSES.DECLINED:
    case ESTIMATE_STATUSES.EXPIRED:
      return 'responded';
    case ESTIMATE_STATUSES.CONVERTED:
    case ESTIMATE_STATUSES.CANCELLED:
      return 'final';
    default:
      return 'creation';
  }
};

export const getNextSuggestedAction = (status: EstimateStatus): string => {
  switch (status) {
    case ESTIMATE_STATUSES.DRAFT:
      return 'Send to client';
    case ESTIMATE_STATUSES.SENT:
      return 'Waiting for client response';
    case ESTIMATE_STATUSES.ACCEPTED:
      return 'Convert to invoice';
    case ESTIMATE_STATUSES.DECLINED:
      return 'Revise and resend';
    case ESTIMATE_STATUSES.EXPIRED:
      return 'Update dates and resend';
    case ESTIMATE_STATUSES.CONVERTED:
      return 'View invoice';
    case ESTIMATE_STATUSES.CANCELLED:
      return 'Reactivate or create new';
    default:
      return 'Manage estimate';
  }
}; 