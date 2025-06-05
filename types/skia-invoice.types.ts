import { SkFont, SkImage } from '@shopify/react-native-skia';
import { Invoice } from './invoice.types';
import { Business } from './business.types';

// Skia-specific rendering types
export interface SkiaInvoiceProps {
  invoice: Invoice;
  business: Business;
  currencySymbol: string;
  onExportPDF?: () => Promise<void>;
  pageWidth?: number;
  pageHeight?: number;
}

// Text rendering configuration
export interface SkiaTextConfig {
  x: number;
  y: number;
  text: string;
  font: SkFont;
  color: string;
  align?: 'left' | 'center' | 'right';
  maxWidth?: number;
}

// Rectangle/shape rendering configuration
export interface SkiaRectConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  strokeColor?: string;
  strokeWidth?: number;
  borderRadius?: number;
}

// Image rendering configuration
export interface SkiaImageConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  image: SkImage;
  fit?: 'contain' | 'cover' | 'stretch';
}

// Layout calculation results
export interface SkiaLayoutMetrics {
  pageWidth: number;
  pageHeight: number;
  contentWidth: number;
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  sections: {
    header: { x: number; y: number; width: number; height: number };
    meta: { x: number; y: number; width: number; height: number };
    table: { x: number; y: number; width: number; height: number };
    footer: { x: number; y: number; width: number; height: number };
  };
  columns: {
    qty: { x: number; width: number };
    desc: { x: number; width: number };
    price: { x: number; width: number };
    total: { x: number; width: number };
  };
}

// Page information for multi-page invoices
export interface SkiaPageInfo {
  pageNumber: number;
  totalPages: number;
  itemsOnPage: number;
  isFirstPage: boolean;
  isLastPage: boolean;
  pageSubtotal?: number;
  runningTotal?: number;
}

// Pagination configuration
export interface SkiaPaginationConfig {
  itemsPerPage: number;
  minItemsForPagination: number;
  showPageNumbers: boolean;
  showContinuationHeaders: boolean;
  showRunningSubtotals: boolean;
}

// Font loading and management
export interface SkiaFontSet {
  regular: SkFont;
  bold: SkFont;
  italic?: SkFont;
  boldItalic?: SkFont;
}

// Export configuration
export interface SkiaExportConfig {
  format: 'pdf' | 'png' | 'jpg';
  quality?: number;
  dpi?: number;
  backgroundColor?: string;
}

// Render context passed down through rendering tree
export interface SkiaRenderContext {
  layout: SkiaLayoutMetrics;
  fonts: SkiaFontSet;
  pageInfo: SkiaPageInfo;
  config: SkiaPaginationConfig;
  currentY: number; // Current Y position for content flow
}

export default SkiaInvoiceProps; 