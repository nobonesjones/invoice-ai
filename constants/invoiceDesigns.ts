import React from 'react';
import SkiaInvoiceCanvas from '@/components/skia/SkiaInvoiceCanvas';

// Define the structure for invoice design templates
export interface InvoiceDesign {
  id: string;
  name: string;
  displayName: string;
  description: string;
  thumbnail: string; // Path to static thumbnail image
  component: React.ComponentType<any>; // The Skia canvas component
  colorScheme: {
    primary: string;
    accent: string;
    text: string;
    mutedText: string;
    background: string;
    border: string;
  };
  layoutConfig: {
    headerPosition: 'top' | 'center' | 'split';
    sectionsLayout: 'standard' | 'side-by-side' | 'centered';
    spacing: 'compact' | 'normal' | 'spacious';
  };
}

// Color schemes for different designs
export const COLOR_SCHEMES = {
  classic: {
    primary: '#2563EB', // Blue
    accent: '#3B82F6',
    text: '#1F2937',
    mutedText: '#6B7280',
    background: '#FFFFFF',
    border: '#E5E7EB',
  },
  modern: {
    primary: '#059669', // Green
    accent: '#10B981',
    text: '#111827',
    mutedText: '#6B7280',
    background: '#FFFFFF',
    border: '#D1D5DB',
  },
  professional: {
    primary: '#1E40AF', // Navy
    accent: '#3730A3',
    text: '#1F2937',
    mutedText: '#6B7280',
    background: '#FFFFFF',
    border: '#D1D5DB',
  },
  creative: {
    primary: '#7C3AED', // Purple
    accent: '#8B5CF6',
    text: '#1F2937',
    mutedText: '#6B7280',
    background: '#FFFFFF',
    border: '#E5E7EB',
  },
  minimal: {
    primary: '#000000', // Black
    accent: '#374151',
    text: '#111827',
    mutedText: '#9CA3AF',
    background: '#FFFFFF',
    border: '#F3F4F6',
  },
} as const;

// Registry of available invoice designs
export const INVOICE_DESIGNS: InvoiceDesign[] = [
  {
    id: 'classic',
    name: 'classic',
    displayName: 'Classic',
    description: 'Traditional business invoice with blue accents',
    thumbnail: '/assets/invoice-designs/classic-thumb.png',
    component: SkiaInvoiceCanvas, // Current default
    colorScheme: COLOR_SCHEMES.classic,
    layoutConfig: {
      headerPosition: 'top',
      sectionsLayout: 'standard',
      spacing: 'normal',
    },
  },
  {
    id: 'modern',
    name: 'modern',
    displayName: 'Modern',
    description: 'Clean and contemporary with green accents',
    thumbnail: '/assets/invoice-designs/modern-thumb.png',
    component: SkiaInvoiceCanvas, // Will be replaced with ModernSkiaInvoiceCanvas
    colorScheme: COLOR_SCHEMES.modern,
    layoutConfig: {
      headerPosition: 'center',
      sectionsLayout: 'side-by-side',
      spacing: 'normal',
    },
  },
  // Additional designs will be added here
  // {
  //   id: 'professional',
  //   name: 'professional',
  //   displayName: 'Professional',
  //   description: 'Formal business style with navy theme',
  //   thumbnail: '/assets/invoice-designs/professional-thumb.png',
  //   component: ProfessionalSkiaInvoiceCanvas,
  //   colorScheme: COLOR_SCHEMES.professional,
  //   layoutConfig: {
  //     headerPosition: 'center',
  //     sectionsLayout: 'centered',
  //     spacing: 'spacious',
  //   },
  // },
];

// Default design
export const DEFAULT_DESIGN_ID = 'classic';

// Helper functions for design management
export const getDesignById = (id: string): InvoiceDesign | undefined => {
  return INVOICE_DESIGNS.find(design => design.id === id);
};

export const getDefaultDesign = (): InvoiceDesign => {
  return getDesignById(DEFAULT_DESIGN_ID) || INVOICE_DESIGNS[0];
};

export const getAllDesigns = (): InvoiceDesign[] => {
  return INVOICE_DESIGNS;
};

// Required sections that must be present in all designs
export const REQUIRED_INVOICE_SECTIONS = [
  'header', // Invoice title, number, dates
  'from', // Business information
  'to', // Client information  
  'items', // Line items table
  'subtotals', // Subtotal, tax, discount calculations
  'total', // Final total amount
  'terms', // Payment terms and notes
  'payments', // Payment methods (if enabled)
] as const;

export type RequiredInvoiceSection = typeof REQUIRED_INVOICE_SECTIONS[number];

// Validation function to ensure all required sections are implemented
export const validateDesignSections = (designId: string): boolean => {
  // This will be implemented when we create the actual design components
  // For now, return true as we're using the base component
  return true;
}; 