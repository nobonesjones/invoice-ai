/**
 * Design Tokens extracted from InvoiceTemplateOne.tsx
 * This preserves the exact visual design for migration to Skia
 */

export const INVOICE_DESIGN_TOKENS = {
  // Typography - exact font sizes and weights from current system
  typography: {
    // Header Section
    invoiceLabel: { 
      fontSize: 14, 
      fontWeight: 'bold' as const,
      color: 'black'
    },
    logoPlaceholder: {
      fontSize: 12,
      fontWeight: 'bold' as const,
      color: 'black'
    },
    
    // Business/Client Info
    businessNameText: { 
      fontSize: 10, 
      fontWeight: 'bold' as const,
      color: 'black',
      marginBottom: 1
    },
    clientNameText: {
      fontSize: 10, 
      fontWeight: 'bold' as const,
      color: 'black',
      marginBottom: 2
    },
    label: {
      fontSize: 8,
      fontWeight: 'bold' as const,
      color: 'black',
      marginBottom: 4
    },
    text: {
      fontSize: 8,
      color: 'black',
      lineHeight: 11,
      marginBottom: 1
    },
    
    // Table Section
    tableHeader: { 
      fontSize: 7, 
      fontWeight: 'bold' as const,
      color: 'black'
    },
    lineItemText: { 
      fontSize: 7, 
      color: 'black'
    },
    itemSubtitle: {
      fontSize: 6, 
      color: 'black',
      marginTop: 2
    },
    
    // Footer/Totals Section
    totalsText: { 
      fontSize: 8,
      color: 'black'
    },
    grandTotalText: {
      fontSize: 8, 
      fontWeight: 'bold' as const,
      color: 'black'
    },
    paymentTermsHeader: {
      fontSize: 8,
      fontWeight: 'bold' as const,
      color: 'black',
      marginBottom: 2
    },
    paymentTermsBody: {
      fontSize: 8,
      color: 'black',
      fontStyle: 'italic' as const,
      marginTop: 2
    },
    paymentMethodText: {
      fontSize: 8,
      color: 'black',
      fontStyle: 'italic' as const
    },
    discountPercentageText: {
      fontSize: 6,
      color: 'black',
      fontWeight: 'normal' as const,
      marginLeft: 2
    },
    pageIndicatorText: {
      fontSize: 12,
      fontWeight: 'bold' as const,
      color: 'black'
    },
    placeholderText: {
      fontSize: 9, 
      color: 'black',
      fontStyle: 'italic' as const,
      marginTop: 2
    }
  },
  
  // Layout dimensions - exact measurements from current styles
  layout: {
    // Page container
    pageContainer: {
      minHeight: 600,
      backgroundColor: '#fff',
      marginBottom: 30,
      borderRadius: 8,
      padding: 15,
      shadow: {
        color: '#000',
        offset: { width: 0, height: 4 },
        opacity: 0.15,
        radius: 6,
        elevation: 4
      }
    },
    
    // Page break styling
    pageBreak: {
      marginTop: 60,
      paddingTop: 20,
      borderTopWidth: 2,
      borderStyle: 'dashed' as const,
      shadow: {
        color: '#000',
        offset: { width: 0, height: -2 },
        opacity: 0.1,
        radius: 3,
        elevation: 2
      }
    },
    
    // Header section layout
    header: {
      marginBottom: 12,
      logo: {
        maxWidth: 100,
        maxHeight: 50
      }
    },
    
    // Meta section (business/client info)
    metaSection: {
      marginBottom: 12
    },
    
    // Table layout - exact column proportions
    table: {
      marginBottom: 20,
      columns: {
        qty: { flex: 1, paddingHorizontal: 5, textAlign: 'center' as const },
        desc: { flex: 4, paddingHorizontal: 5 },
        price: { flex: 2, paddingHorizontal: 5, textAlign: 'right' as const },
        total: { flex: 2, paddingHorizontal: 5, textAlign: 'right' as const }
      },
      row: {
        paddingVertical: 8,
        borderBottomWidth: 1
      },
      header: {
        paddingVertical: 8,
        borderBottomWidth: 1
      }
    },
    
    // Footer section
    footer: {
      marginTop: 20,
      paddingTop: 10,
      borderTopWidth: 1,
      layout: {
        left: { flex: 1.5 },
        right: { flex: 1 }
      }
    },
    
    // Totals section
    totals: {
      totalLine: {
        paddingVertical: 3
      },
      grandTotalBox: {
        paddingVertical: 5,
        borderBottomWidth: 1
      }
    },
    
    // Payment icons
    paymentIcons: {
      width: 16,
      height: 10,
      marginLeft: 2
    }
  },
  
  // Colors - exact color values from current system
  colors: {
    primary: '#007bff',
    text: 'black',
    mutedText: 'black',
    border: '#eee',
    pageBreakBorder: '#ddd',
    
    // Table colors
    tableHeaderBg: 'rgba(76, 175, 80, 0.15)',
    grandTotalBg: 'rgba(76, 175, 80, 0.15)',
    
    // Page colors
    pageBackground: '#fff',
    highlightBackground: '#f0f8ff',
    
    // Shadow colors
    shadowColor: '#000'
  },
  
  // Spacing system - consistent spacing values
  spacing: {
    xs: 1,
    sm: 2,
    md: 4,
    lg: 8,
    xl: 12,
    xxl: 20,
    pageMargin: 15,
    sectionMargin: 12
  },
  
  // Border specifications
  borders: {
    thin: 1,
    medium: 2,
    radius: 8
  }
};

// Layout calculation helpers
export const LAYOUT_HELPERS = {
  // Calculate table column widths based on flex values
  calculateTableColumns: (totalWidth: number) => {
    const totalFlex = 1 + 4 + 2 + 2; // qty + desc + price + total
    return {
      qty: { x: 0, width: totalWidth * (1 / totalFlex) },
      desc: { x: totalWidth * (1 / totalFlex), width: totalWidth * (4 / totalFlex) },
      price: { x: totalWidth * (5 / totalFlex), width: totalWidth * (2 / totalFlex) },
      total: { x: totalWidth * (7 / totalFlex), width: totalWidth * (2 / totalFlex) }
    };
  },
  
  // Calculate header layout (60/40 split)
  calculateHeaderColumns: (totalWidth: number) => {
    return {
      left: { x: 0, width: totalWidth * 0.6 },
      right: { x: totalWidth * 0.6, width: totalWidth * 0.4 }
    };
  },
  
  // Calculate footer layout (60/40 split)
  calculateFooterColumns: (totalWidth: number) => {
    return {
      left: { x: 0, width: totalWidth * 0.6 },
      right: { x: totalWidth * 0.6, width: totalWidth * 0.4 }
    };
  }
};

export default INVOICE_DESIGN_TOKENS; 