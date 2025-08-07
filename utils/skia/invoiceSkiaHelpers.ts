import { SkFont, SkRect, Skia } from '@shopify/react-native-skia';
import { 
  SkiaLayoutMetrics, 
  SkiaTextConfig, 
  SkiaRectConfig, 
  SkiaPageInfo,
  SkiaFontSet 
} from '../../types/skia-invoice.types';
import { INVOICE_DESIGN_TOKENS, LAYOUT_HELPERS } from '../../app/design-tokens/invoice-design-tokens';

// Standard page dimensions (A4 in points at 150 DPI)
export const PAGE_DIMENSIONS = {
  A4_WIDTH: 595,
  A4_HEIGHT: 842,
  MARGINS: INVOICE_DESIGN_TOKENS.spacing.pageMargin
};

/**
 * Calculate layout metrics for invoice rendering
 */
export const calculateLayoutMetrics = (
  pageWidth: number = PAGE_DIMENSIONS.A4_WIDTH,
  pageHeight: number = PAGE_DIMENSIONS.A4_HEIGHT
): SkiaLayoutMetrics => {
  const margins = {
    top: PAGE_DIMENSIONS.MARGINS,
    right: PAGE_DIMENSIONS.MARGINS,
    bottom: PAGE_DIMENSIONS.MARGINS,
    left: PAGE_DIMENSIONS.MARGINS
  };

  const contentWidth = pageWidth - margins.left - margins.right;
  
  // Calculate section dimensions based on design tokens
  const headerHeight = 60;
  const metaHeight = 80;
  const footerHeight = 120;
  const tableHeight = pageHeight - margins.top - margins.bottom - headerHeight - metaHeight - footerHeight;

  const sections = {
    header: {
      x: margins.left,
      y: margins.top,
      width: contentWidth,
      height: headerHeight
    },
    meta: {
      x: margins.left,
      y: margins.top + headerHeight + INVOICE_DESIGN_TOKENS.spacing.sectionMargin,
      width: contentWidth,
      height: metaHeight
    },
    table: {
      x: margins.left,
      y: margins.top + headerHeight + metaHeight + (INVOICE_DESIGN_TOKENS.spacing.sectionMargin * 2),
      width: contentWidth,
      height: tableHeight
    },
    footer: {
      x: margins.left,
      y: pageHeight - margins.bottom - footerHeight,
      width: contentWidth,
      height: footerHeight
    }
  };

  // Calculate table column positions using design tokens
  const columns = LAYOUT_HELPERS.calculateTableColumns(contentWidth);

  return {
    pageWidth,
    pageHeight,
    contentWidth,
    margins,
    sections,
    columns
  };
};

/**
 * Create font set for rendering
 */
export const createFontSet = async (): Promise<SkiaFontSet> => {
  try {
    // In React Native Skia, create fonts with just the size - uses system default
    const regularFont = Skia.Font(undefined, INVOICE_DESIGN_TOKENS.typography.text.fontSize);
    const boldFont = Skia.Font(undefined, INVOICE_DESIGN_TOKENS.typography.label.fontSize);
    
    return {
      regular: regularFont,
      bold: boldFont
    };
  } catch (error) {
    console.error('[createFontSet] Error creating fonts:', error);
    throw error;
  }
};

/**
 * Render text with proper alignment and wrapping
 */
export const renderText = (config: SkiaTextConfig) => {
  const { x, y, text, font, color, align = 'left', maxWidth } = config;
  
  // Calculate text width
  const textWidth = font.measureText(text).width;
  
  let finalX = x;
  if (align === 'center' && maxWidth) {
    finalX = x + (maxWidth - textWidth) / 2;
  } else if (align === 'right' && maxWidth) {
    finalX = x + maxWidth - textWidth;
  }

  return {
    x: finalX,
    y,
    text,
    font,
    color
  };
};

/**
 * Render rectangle with optional rounded corners
 */
export const renderRect = (config: SkiaRectConfig) => {
  const { x, y, width, height, color, strokeColor, strokeWidth, borderRadius } = config;
  
  const rect = Skia.XYWHRect(x, y, width, height);
  
  return {
    rect,
    color,
    strokeColor,
    strokeWidth,
    borderRadius
  };
};

/**
 * Calculate text height for multi-line text
 */
export const calculateTextHeight = (
  text: string, 
  font: SkFont, 
  maxWidth: number, 
  lineHeight: number = 1.2
): number => {
  if (!text || typeof text !== 'string') {
    return font.getSize() * lineHeight;
  }
  const words = text.split(' ');
  let currentLine = '';
  let lines = 1;

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.measureText(testLine).width;
    
    if (testWidth > maxWidth && currentLine) {
      lines++;
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  const fontSize = font.getSize();
  return lines * fontSize * lineHeight;
};

/**
 * Split text into multiple lines that fit within maxWidth
 */
export const wrapText = (
  text: string, 
  font: SkFont, 
  maxWidth: number
): string[] => {
  if (!text || typeof text !== 'string') {
    return [''];
  }
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.measureText(testLine).width;
    
    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
};

/**
 * Format currency value using the provided symbol
 */
export const formatCurrency = (amount: number, currencySymbol: string): string => {
  return `${currencySymbol}${amount.toFixed(2)}`;
};

/**
 * Calculate page information for pagination
 */
export const calculatePageInfo = (
  totalItems: number,
  itemsPerPage: number,
  currentPage: number
): SkiaPageInfo => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const itemsOnPage = Math.min(itemsPerPage, totalItems - startIndex);

  return {
    pageNumber: currentPage,
    totalPages,
    itemsOnPage,
    isFirstPage: currentPage === 1,
    isLastPage: currentPage === totalPages
  };
};

/**
 * Create color from hex string
 */
export const hexToSkiaColor = (hex: string): number => {
  // Remove # if present
  const cleanHex = hex.replace('#', '');
  
  // Convert to ARGB format
  if (cleanHex.length === 6) {
    return parseInt(`FF${cleanHex}`, 16);
  } else if (cleanHex.length === 8) {
    return parseInt(cleanHex, 16);
  }
  
  // Default to black if invalid
  return 0xFF000000;
};

/**
 * Calculate Y position for next content after current section
 */
export const getNextY = (currentY: number, contentHeight: number, spacing: number = 0): number => {
  return currentY + contentHeight + spacing;
};

export default {
  calculateLayoutMetrics,
  createFontSet,
  renderText,
  renderRect,
  calculateTextHeight,
  wrapText,
  formatCurrency,
  calculatePageInfo,
  hexToSkiaColor,
  getNextY,
  PAGE_DIMENSIONS
}; 