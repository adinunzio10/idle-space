import numeral from 'numeral';
import BigNumber from 'bignumber.js';

export interface NumberFormatOptions {
  precision?: number;
  useScientific?: boolean;
  useShortNotation?: boolean;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  forAccessibility?: boolean; // Formats numbers for screen readers
}

/**
 * Comprehensive number formatting utility with BigNumber support
 * and accessibility features for screen readers
 */
export class NumberFormatter {
  private static readonly SUFFIXES = [
    { value: 1e12, suffix: 'T', name: 'trillion' },
    { value: 1e9, suffix: 'B', name: 'billion' },
    { value: 1e6, suffix: 'M', name: 'million' },
    { value: 1e3, suffix: 'K', name: 'thousand' },
  ];

  /**
   * Format a number for display with various options
   */
  static format(
    value: number | BigNumber,
    options: NumberFormatOptions = {}
  ): string {
    const {
      precision = 2,
      useScientific = false,
      useShortNotation = true,
      minimumFractionDigits = 0,
      maximumFractionDigits = precision,
      forAccessibility = false,
    } = options;

    const numericValue = value instanceof BigNumber ? value.toNumber() : value;

    // Handle special cases
    if (numericValue === 0) return '0';
    if (!isFinite(numericValue)) return '∞';
    if (isNaN(numericValue)) return 'NaN';

    // For accessibility, use verbose number formats
    if (forAccessibility) {
      return this.formatForAccessibility(numericValue, precision);
    }

    // Scientific notation for very large numbers
    if (
      useScientific &&
      (Math.abs(numericValue) >= 1e15 || Math.abs(numericValue) < 0.001)
    ) {
      return numericValue.toExponential(precision);
    }

    // Short notation (K, M, B, T)
    if (useShortNotation && Math.abs(numericValue) >= 1000) {
      return numeral(numericValue)
        .format('0.00a')
        .replace(/\.?0+([a-zA-Z])$/, '$1');
    }

    // Standard number formatting
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(numericValue);

    return formatted;
  }

  /**
   * Format numbers specifically for screen readers with full word descriptions
   */
  static formatForAccessibility(value: number, precision: number = 2): string {
    const absValue = Math.abs(value);

    if (absValue === 0) return 'zero';
    if (absValue < 1000) return Math.floor(value).toString();

    // Find appropriate suffix
    for (const { value: threshold, name } of this.SUFFIXES) {
      if (absValue >= threshold) {
        const scaledValue = value / threshold;
        const rounded =
          Math.round(scaledValue * Math.pow(10, precision)) /
          Math.pow(10, precision);

        if (rounded === 1) {
          return `one ${name}`;
        }

        return `${rounded} ${name}`;
      }
    }

    return value.toString();
  }

  /**
   * Format currency or resource values
   */
  static formatResource(
    value: number | BigNumber,
    resourceName?: string,
    options: NumberFormatOptions = {}
  ): string {
    const formattedNumber = this.format(value, options);

    if (resourceName) {
      return `${formattedNumber} ${resourceName}`;
    }

    return formattedNumber;
  }

  /**
   * Format percentages
   */
  static formatPercentage(
    value: number,
    options: NumberFormatOptions = {}
  ): string {
    const { precision = 1, forAccessibility = false } = options;

    const percentage = value * 100;
    const formatted = this.format(percentage, { ...options, precision });

    if (forAccessibility) {
      return `${formatted} percent`;
    }

    return `${formatted}%`;
  }

  /**
   * Format time durations in a human-readable way
   */
  static formatDuration(
    seconds: number,
    options: { forAccessibility?: boolean } = {}
  ): string {
    const { forAccessibility = false } = options;

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    if (forAccessibility) {
      const parts: string[] = [];
      if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
      if (minutes > 0)
        parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
      if (remainingSeconds > 0 || parts.length === 0) {
        parts.push(
          `${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}`
        );
      }

      return parts.join(', ');
    }

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  }

  /**
   * Get the appropriate accessibility label for a number
   */
  static getAccessibilityLabel(
    value: number | BigNumber,
    context: string = 'value'
  ): string {
    const accessibleNumber = this.format(value, { forAccessibility: true });
    return `${context}: ${accessibleNumber}`;
  }

  /**
   * Create a progress description for screen readers
   */
  static formatProgress(
    current: number,
    total: number,
    options: { includePercentage?: boolean; context?: string } = {}
  ): string {
    const { includePercentage = true, context = 'Progress' } = options;

    const percentage = total > 0 ? (current / total) * 100 : 0;
    const currentFormatted = this.format(current, { forAccessibility: true });
    const totalFormatted = this.format(total, { forAccessibility: true });

    let description = `${context}: ${currentFormatted} of ${totalFormatted}`;

    if (includePercentage) {
      description += ` (${this.formatPercentage(percentage / 100, { forAccessibility: true })})`;
    }

    return description;
  }
}

/**
 * Convenience function for quick number formatting
 */
export const formatNumber = (
  value: number | BigNumber,
  options?: NumberFormatOptions
): string => NumberFormatter.format(value, options);

/**
 * Convenience function for resource formatting
 */
export const formatResource = (
  value: number | BigNumber,
  resourceName?: string,
  options?: NumberFormatOptions
): string => NumberFormatter.formatResource(value, resourceName, options);

/**
 * Convenience function for accessibility formatting
 */
export const formatForScreenReader = (value: number | BigNumber): string =>
  NumberFormatter.format(value, { forAccessibility: true });
