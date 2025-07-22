import { Tables } from '../../types/database.types';

export interface PdfInvoiceLineItem extends Tables<'invoice_line_items'> {}

interface PageInfo {
  pageNumber: number;
  totalPages: number;
  isLastPage: boolean;
}

export interface PaginatedItemsResult {
  pages: PdfInvoiceLineItem[][];
  hasMultiplePages: boolean;
  totalPages: number;
}

// Configuration for pagination
const ITEMS_PER_PAGE = 12; // Reduced from unlimited to fit better on page
const MIN_ITEMS_FOR_PAGINATION = 8; // Only paginate if more than this many items

/**
 * Split invoice line items across multiple pages for better PDF formatting
 */
export function paginateInvoiceItems(items: PdfInvoiceLineItem[]): PaginatedItemsResult {
  if (!items || items.length === 0) {
    return {
      pages: [[]],
      hasMultiplePages: false,
      totalPages: 1
    };
  }

  console.log('[Pagination] Input items:', items.length);

  // If we have fewer items than the threshold, keep everything on one page
  if (items.length <= MIN_ITEMS_FOR_PAGINATION) {
    console.log('[Pagination] Below threshold, using single page');
    return {
      pages: [items],
      hasMultiplePages: false,
      totalPages: 1
    };
  }

  // Split items into pages
  const pages: PdfInvoiceLineItem[][] = [];
  
  for (let i = 0; i < items.length; i += ITEMS_PER_PAGE) {
    const pageItems = items.slice(i, i + ITEMS_PER_PAGE);
    pages.push(pageItems);
  }

  console.log('[Pagination] Created', pages.length, 'pages with', pages.map(p => p.length), 'items each');

  return {
    pages,
    hasMultiplePages: pages.length > 1,
    totalPages: pages.length
  };
}

/**
 * Generate HTML for a table header (repeated on each page)
 */
export function generateTableHeader(): string {
  return `
    <thead>
      <tr>
        <th class="col-qty">QTY</th>
        <th class="col-desc">DESCRIPTION</th>
        <th class="col-price">PRICE</th>
        <th class="col-total">TOTAL</th>
      </tr>
    </thead>
  `;
}

/**
 * Generate HTML for line items on a specific page
 */
export function generatePageItems(
  items: PdfInvoiceLineItem[], 
  formatCurrency: (amount: number | null | undefined, symbol: string) => string,
  currencySymbol: string,
  pageInfo: PageInfo
): string {
  if (!items || items.length === 0) {
    return '<tr><td colspan="4" style="text-align: center; padding: 5mm; font-style: italic; color: #666;">No line items.</td></tr>';
  }

  let itemsHtml = '';
  
  items.forEach(item => {
    itemsHtml += `
      <tr>
        <td class="col-qty">${item.quantity}</td>
        <td class="col-desc">
          ${item.item_name || 'N/A'}
          ${item.item_description ? `<span class="item-description-pdf">${item.item_description.replace(/\n/g, '<br>')}</span>` : ''}
        </td>
        <td class="col-price">${formatCurrency(item.unit_price, currencySymbol)}</td>
        <td class="col-total">${formatCurrency(item.total_price, currencySymbol)}</td>
      </tr>
    `;
  });

  return itemsHtml;
}

/**
 * Generate HTML for page subtotal (shown on each page except the last)
 */
export function generatePageSubtotal(
  pageItems: PdfInvoiceLineItem[],
  formatCurrency: (amount: number | null | undefined, symbol: string) => string,
  currencySymbol: string,
  pageInfo: PageInfo
): string {
  // Only show page subtotal if there are multiple pages and this isn't the last page
  if (pageInfo.totalPages <= 1 || pageInfo.isLastPage) {
    return '';
  }

  const pageSubtotal = pageItems.reduce((sum, item) => sum + (item.total_price || 0), 0);

  return `
    <div class="page-subtotal" style="text-align: right; margin-top: 5mm; padding: 2mm 0; border-top: 1px solid #eee;">
      <strong>Page ${pageInfo.pageNumber} Subtotal: ${formatCurrency(pageSubtotal, currencySymbol)}</strong>
    </div>
  `;
}

/**
 * Additional CSS styles needed for pagination
 */
export function getPaginationStyles(): string {
  return `
    /* Pagination styles */
    .page-break {
      page-break-before: always;
      padding-top: 30mm; /* Add padding to push content down on subsequent pages */
    }
    
    .page-subtotal {
      font-size: 11px;
      color: #333;
    }
    
    .line-items-page {
      margin-bottom: 5mm;
      min-height: auto;
      position: relative; /* For absolute positioning of page numbers */
    }
    
    /* Page number styling */
    .page-number {
      position: absolute;
      bottom: -15mm;
      right: 0;
      font-size: 10px;
      color: #666;
      font-weight: normal;
    }
    
    /* Prevent unnecessary page breaks */
    .line-items {
      page-break-inside: auto;
      margin-bottom: 0;
    }
    
    .line-items table {
      page-break-inside: auto;
      margin-bottom: 0;
    }
    
    .line-items tbody {
      page-break-inside: auto;
    }
    
    .line-items tr {
      page-break-inside: avoid;
    }
    
    /* Ensure summary section stays together when possible */
    .summary-section {
      page-break-inside: avoid;
      margin-top: 15mm; /* Increased spacing between line items and summary */
    }
    
    /* Avoid empty pages */
    .line-items-page:empty {
      display: none;
    }
  `;
} 