import numeral from 'numeral';

export class NumberFormatter {
  static formatResource(value: number, precision: number = 1): string {
    if (value < 1000) {
      return Math.floor(value).toString();
    }

    if (value < 1000000) {
      return numeral(value).format('0.0a').toUpperCase();
    }

    if (value < 1000000000000) {
      return numeral(value).format('0.0a').toUpperCase();
    }

    return this.formatScientific(value, precision);
  }

  static formatScientific(value: number, precision: number = 2): string {
    if (value === 0) return '0';

    const exponent = Math.floor(Math.log10(Math.abs(value)));
    const mantissa = value / Math.pow(10, exponent);

    return `${mantissa.toFixed(precision)}e${exponent}`;
  }

  static formatTime(seconds: number): string {
    if (seconds < 60) {
      return `${Math.ceil(seconds)}s`;
    }

    if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.ceil(seconds % 60);
      return remainingSeconds > 0
        ? `${minutes}m ${remainingSeconds}s`
        : `${minutes}m`;
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  static formatCompact(value: number): string {
    if (value < 1000) return Math.floor(value).toString();
    return numeral(value).format('0.0a').toUpperCase();
  }

  static formatPercentage(value: number, precision: number = 1): string {
    return `${(value * 100).toFixed(precision)}%`;
  }

  static parseFormatted(formatted: string): number {
    const result = numeral(formatted).value();
    return result || 0;
  }
}
