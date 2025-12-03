/**
 * Currency Formatter Utility
 * Formats numbers with locale-appropriate thousand separators and decimal points
 */

// Map currency codes to their locales for proper formatting
const CURRENCY_LOCALE_MAP: Record<string, string> = {
  // Major currencies
  'USD': 'en-US',  // 1,000.00
  'GBP': 'en-GB',  // 1,000.00
  'CAD': 'en-CA',  // 1,000.00
  'AUD': 'en-AU',  // 1,000.00
  'NZD': 'en-NZ',  // 1,000.00

  // European currencies
  'EUR': 'de-DE',  // 1.000,00 (German standard for Euro)
  'CHF': 'de-CH',  // 1'000.00 (Swiss)
  'NOK': 'nb-NO',  // 1 000,00 (Norwegian)
  'SEK': 'sv-SE',  // 1 000,00 (Swedish)
  'DKK': 'da-DK',  // 1.000,00 (Danish)

  // Eastern European
  'PLN': 'pl-PL',  // 1 000,00 (Polish)
  'CZK': 'cs-CZ',  // 1 000,00 (Czech)
  'HUF': 'hu-HU',  // 1 000,00 (Hungarian)
  'RON': 'ro-RO',  // 1.000,00 (Romanian)
  'BGN': 'bg-BG',  // 1 000,00 (Bulgarian)

  // Middle East & South Asia
  'AED': 'ar-AE',  // 1,000.00 (UAE)
  'INR': 'en-IN',  // 1,00,000.00 (Indian - special grouping)
  'PKR': 'en-PK',  // 1,000.00 (Pakistani)
};

/**
 * Format a number as currency with locale-appropriate separators
 * @param amount - The number to format
 * @param currencyCode - ISO currency code (e.g., 'USD', 'EUR')
 * @param minimumFractionDigits - Minimum decimal places (default: 2)
 * @param maximumFractionDigits - Maximum decimal places (default: 2)
 * @returns Formatted string with thousand separators (e.g., "1,000.00" or "1.000,00")
 */
export function formatCurrency(
  amount: number,
  currencyCode: string = 'USD',
  minimumFractionDigits: number = 2,
  maximumFractionDigits: number = 2
): string {
  try {
    // Get the appropriate locale for this currency
    const locale = CURRENCY_LOCALE_MAP[currencyCode.toUpperCase()] || 'en-US';

    // Use Intl.NumberFormat for locale-aware formatting
    const formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits,
      maximumFractionDigits,
      useGrouping: true, // Enable thousand separators
    });

    return formatter.format(amount);
  } catch (error) {
    // Fallback to simple formatting if Intl fails
    console.warn('[formatCurrency] Intl.NumberFormat failed, using fallback:', error);
    return amount.toFixed(minimumFractionDigits);
  }
}

/**
 * Format currency with symbol prefix
 * @param amount - The number to format
 * @param currencySymbol - Symbol to prefix (e.g., '$', '£', '€')
 * @param currencyCode - ISO currency code
 * @returns Formatted string with symbol (e.g., "$1,000.00")
 */
export function formatCurrencyWithSymbol(
  amount: number,
  currencySymbol: string,
  currencyCode: string = 'USD'
): string {
  const formattedAmount = formatCurrency(amount, currencyCode);
  return `${currencySymbol}${formattedAmount}`;
}

/**
 * Simple formatting for backward compatibility
 * Uses comma separators in US/UK style
 * @deprecated Use formatCurrency for locale-aware formatting
 */
export function formatWithCommas(amount: number, decimals: number = 2): string {
  return formatCurrency(amount, 'USD', decimals, decimals);
}
