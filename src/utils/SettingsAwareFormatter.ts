import { NumberFormatter, NumberFormatOptions } from './numberFormatting';
import BigNumber from 'bignumber.js';

// Default settings for when settings context is not available
const DEFAULT_FORMATTING_SETTINGS = {
  scientificNotationEnabled: false,
  largeTextEnabled: false,
  reduceAnimationsEnabled: false,
};

/**
 * Settings-aware number formatter that respects user preferences
 * This formatter automatically applies scientific notation and accessibility settings
 */
export class SettingsAwareFormatter {
  /**
   * Format a number based on current user settings
   */
  static format(
    value: number | BigNumber,
    settings: typeof DEFAULT_FORMATTING_SETTINGS = DEFAULT_FORMATTING_SETTINGS,
    baseOptions: NumberFormatOptions = {}
  ): string {
    const options: NumberFormatOptions = {
      ...baseOptions,
      useScientific: settings.scientificNotationEnabled,
      forAccessibility: settings.largeTextEnabled, // Use accessibility format for large text
    };

    return NumberFormatter.format(value, options);
  }

  /**
   * Format a resource value with settings awareness
   */
  static formatResource(
    value: number | BigNumber,
    resourceName?: string,
    settings: typeof DEFAULT_FORMATTING_SETTINGS = DEFAULT_FORMATTING_SETTINGS,
    baseOptions: NumberFormatOptions = {}
  ): string {
    const options: NumberFormatOptions = {
      ...baseOptions,
      useScientific: settings.scientificNotationEnabled,
      forAccessibility: settings.largeTextEnabled,
    };

    return NumberFormatter.formatResource(value, resourceName, options);
  }

  /**
   * Format a percentage with settings awareness
   */
  static formatPercentage(
    value: number,
    settings: typeof DEFAULT_FORMATTING_SETTINGS = DEFAULT_FORMATTING_SETTINGS,
    baseOptions: NumberFormatOptions = {}
  ): string {
    const options: NumberFormatOptions = {
      ...baseOptions,
      forAccessibility: settings.largeTextEnabled,
    };

    return NumberFormatter.formatPercentage(value, options);
  }

  /**
   * Format a duration with settings awareness
   */
  static formatDuration(
    seconds: number,
    settings: typeof DEFAULT_FORMATTING_SETTINGS = DEFAULT_FORMATTING_SETTINGS
  ): string {
    const options = {
      forAccessibility: settings.largeTextEnabled,
    };

    return NumberFormatter.formatDuration(seconds, options);
  }

  /**
   * Get animation duration based on animation settings
   * Returns duration in milliseconds
   */
  static getAnimationDuration(
    baseDuration: number,
    settings: typeof DEFAULT_FORMATTING_SETTINGS = DEFAULT_FORMATTING_SETTINGS
  ): number {
    if (settings.reduceAnimationsEnabled) {
      return Math.max(baseDuration * 0.1, 50); // Reduce to 10% with minimum 50ms
    }
    return baseDuration;
  }

  /**
   * Get whether animations should be enabled
   */
  static shouldAnimate(
    settings: typeof DEFAULT_FORMATTING_SETTINGS = DEFAULT_FORMATTING_SETTINGS
  ): boolean {
    return !settings.reduceAnimationsEnabled;
  }

  /**
   * Get animation configuration object for React Native Reanimated
   */
  static getAnimationConfig(
    baseDuration: number = 300,
    settings: typeof DEFAULT_FORMATTING_SETTINGS = DEFAULT_FORMATTING_SETTINGS
  ) {
    const duration = this.getAnimationDuration(baseDuration, settings);
    const shouldAnimate = this.shouldAnimate(settings);

    return {
      duration: shouldAnimate ? duration : 0,
      dampingRatio: shouldAnimate ? 0.8 : 1,
      stiffness: shouldAnimate ? 100 : 1000,
      mass: shouldAnimate ? 1 : 0.1,
    };
  }
}

// Convenience exports
export type FormattingSettings = typeof DEFAULT_FORMATTING_SETTINGS;

/**
 * Hook-friendly formatter that can be used in React components
 */
export const createSettingsFormatter = (settings: FormattingSettings) => ({
  format: (value: number | BigNumber, options?: NumberFormatOptions) =>
    SettingsAwareFormatter.format(value, settings, options),

  formatResource: (
    value: number | BigNumber,
    resourceName?: string,
    options?: NumberFormatOptions
  ) =>
    SettingsAwareFormatter.formatResource(
      value,
      resourceName,
      settings,
      options
    ),

  formatPercentage: (value: number, options?: NumberFormatOptions) =>
    SettingsAwareFormatter.formatPercentage(value, settings, options),

  formatDuration: (seconds: number) =>
    SettingsAwareFormatter.formatDuration(seconds, settings),

  getAnimationDuration: (baseDuration: number) =>
    SettingsAwareFormatter.getAnimationDuration(baseDuration, settings),

  shouldAnimate: () => SettingsAwareFormatter.shouldAnimate(settings),

  getAnimationConfig: (baseDuration?: number) =>
    SettingsAwareFormatter.getAnimationConfig(baseDuration, settings),
});
