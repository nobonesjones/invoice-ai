/**
 * Safe string utilities to prevent crashes from null/undefined string operations
 * This wraps all dangerous string methods with null checks
 */

export const safeString = {
  split: (str: any, separator: string | RegExp, limit?: number): string[] => {
    if (str === null || str === undefined || typeof str !== 'string') {
      return [];
    }
    return str.split(separator, limit);
  },

  includes: (str: any, searchString: string, position?: number): boolean => {
    if (str === null || str === undefined || typeof str !== 'string') {
      return false;
    }
    return str.includes(searchString, position);
  },

  startsWith: (str: any, searchString: string, position?: number): boolean => {
    if (str === null || str === undefined || typeof str !== 'string') {
      return false;
    }
    return str.startsWith(searchString, position);
  },

  endsWith: (str: any, searchString: string, length?: number): boolean => {
    if (str === null || str === undefined || typeof str !== 'string') {
      return false;
    }
    return str.endsWith(searchString, length);
  },

  toLowerCase: (str: any): string => {
    if (str === null || str === undefined || typeof str !== 'string') {
      return '';
    }
    return str.toLowerCase();
  },

  toUpperCase: (str: any): string => {
    if (str === null || str === undefined || typeof str !== 'string') {
      return '';
    }
    return str.toUpperCase();
  },

  trim: (str: any): string => {
    if (str === null || str === undefined || typeof str !== 'string') {
      return '';
    }
    return str.trim();
  },

  substring: (str: any, start: number, end?: number): string => {
    if (str === null || str === undefined || typeof str !== 'string') {
      return '';
    }
    return str.substring(start, end);
  },

  slice: (str: any, start?: number, end?: number): string => {
    if (str === null || str === undefined || typeof str !== 'string') {
      return '';
    }
    return str.slice(start, end);
  },

  indexOf: (str: any, searchValue: string, fromIndex?: number): number => {
    if (str === null || str === undefined || typeof str !== 'string') {
      return -1;
    }
    return str.indexOf(searchValue, fromIndex);
  },

  replace: (str: any, searchValue: string | RegExp, replaceValue: string): string => {
    if (str === null || str === undefined || typeof str !== 'string') {
      return '';
    }
    return str.replace(searchValue, replaceValue);
  },

  match: (str: any, regexp: string | RegExp): RegExpMatchArray | null => {
    if (str === null || str === undefined || typeof str !== 'string') {
      return null;
    }
    return str.match(regexp);
  },

  charAt: (str: any, index: number): string => {
    if (str === null || str === undefined || typeof str !== 'string') {
      return '';
    }
    return str.charAt(index);
  },

  charCodeAt: (str: any, index: number): number => {
    if (str === null || str === undefined || typeof str !== 'string') {
      return NaN;
    }
    return str.charCodeAt(index);
  },

  /**
   * Safe string with chaining support
   */
  safe: (str: any): {
    split: (separator: string | RegExp, limit?: number) => string[];
    includes: (searchString: string, position?: number) => boolean;
    startsWith: (searchString: string, position?: number) => boolean;
    endsWith: (searchString: string, length?: number) => boolean;
    toLowerCase: () => string;
    toUpperCase: () => string;
    trim: () => string;
    substring: (start: number, end?: number) => string;
    slice: (start?: number, end?: number) => string;
    indexOf: (searchValue: string, fromIndex?: number) => number;
    replace: (searchValue: string | RegExp, replaceValue: string) => string;
    match: (regexp: string | RegExp) => RegExpMatchArray | null;
    charAt: (index: number) => string;
    toString: () => string;
    valueOf: () => string;
  } => {
    const safeStr = str === null || str === undefined || typeof str !== 'string' ? '' : str;
    return {
      split: (separator: string | RegExp, limit?: number) => safeStr.split(separator, limit),
      includes: (searchString: string, position?: number) => safeStr.includes(searchString, position),
      startsWith: (searchString: string, position?: number) => safeStr.startsWith(searchString, position),
      endsWith: (searchString: string, length?: number) => safeStr.endsWith(searchString, length),
      toLowerCase: () => safeStr.toLowerCase(),
      toUpperCase: () => safeStr.toUpperCase(),
      trim: () => safeStr.trim(),
      substring: (start: number, end?: number) => safeStr.substring(start, end),
      slice: (start?: number, end?: number) => safeStr.slice(start, end),
      indexOf: (searchValue: string, fromIndex?: number) => safeStr.indexOf(searchValue, fromIndex),
      replace: (searchValue: string | RegExp, replaceValue: string) => safeStr.replace(searchValue, replaceValue),
      match: (regexp: string | RegExp) => safeStr.match(regexp),
      charAt: (index: number) => safeStr.charAt(index),
      toString: () => safeStr,
      valueOf: () => safeStr,
    };
  }
};

// Export for easy access
export const ss = safeString;