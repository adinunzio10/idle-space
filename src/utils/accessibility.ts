import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Accessibility utility for enhanced screen reader support and inclusive design
 */
export class AccessibilityHelper {
  private static screenReaderEnabled: boolean | null = null;
  private static reduceMotionEnabled: boolean | null = null;

  /**
   * Check if screen reader is currently enabled
   */
  static async isScreenReaderEnabled(): Promise<boolean> {
    try {
      if (this.screenReaderEnabled === null) {
        this.screenReaderEnabled =
          await AccessibilityInfo.isScreenReaderEnabled();
      }
      return this.screenReaderEnabled;
    } catch (error) {
      console.warn('Failed to check screen reader status:', error);
      return false;
    }
  }

  /**
   * Check if reduce motion is enabled (respects user's system preferences)
   */
  static async isReduceMotionEnabled(): Promise<boolean> {
    try {
      if (this.reduceMotionEnabled === null) {
        this.reduceMotionEnabled =
          await AccessibilityInfo.isReduceMotionEnabled();
      }
      return this.reduceMotionEnabled;
    } catch (error) {
      console.warn('Failed to check reduce motion status:', error);
      return false;
    }
  }

  /**
   * Initialize accessibility listeners
   */
  static initializeListeners(
    callbacks: {
      onScreenReaderChange?: (enabled: boolean) => void;
      onReduceMotionChange?: (enabled: boolean) => void;
    } = {}
  ): () => void {
    const { onScreenReaderChange, onReduceMotionChange } = callbacks;

    const screenReaderListener = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      (enabled: boolean) => {
        this.screenReaderEnabled = enabled;
        onScreenReaderChange?.(enabled);
      }
    );

    const reduceMotionListener = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled: boolean) => {
        this.reduceMotionEnabled = enabled;
        onReduceMotionChange?.(enabled);
      }
    );

    // Return cleanup function
    return () => {
      screenReaderListener?.remove?.();
      reduceMotionListener?.remove?.();
    };
  }

  /**
   * Announce text to screen reader
   */
  static announceForAccessibility(
    message: string,
    options: { queue?: boolean } = {}
  ): void {
    const { queue = false } = options;

    if (Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(message);
    } else {
      // Android approach
      AccessibilityInfo.announceForAccessibility(message);
    }
  }

  /**
   * Generate comprehensive accessibility props for UI components
   */
  static getAccessibilityProps(config: {
    label?: string;
    hint?: string;
    role?: string;
    state?: {
      disabled?: boolean;
      selected?: boolean;
      checked?: boolean | 'mixed';
      expanded?: boolean;
      busy?: boolean;
    };
    value?: {
      min?: number;
      max?: number;
      now?: number;
      text?: string;
    };
    liveRegion?: 'none' | 'polite' | 'assertive';
  }) {
    const { label, hint, role, state, value, liveRegion = 'none' } = config;

    const props: any = {};

    // Basic accessibility properties
    if (label) props.accessibilityLabel = label;
    if (hint) props.accessibilityHint = hint;
    if (role) props.accessibilityRole = role;
    if (liveRegion !== 'none') props.accessibilityLiveRegion = liveRegion;

    // State properties
    if (state) {
      if (state.disabled !== undefined)
        props.accessibilityState = {
          ...props.accessibilityState,
          disabled: state.disabled,
        };
      if (state.selected !== undefined)
        props.accessibilityState = {
          ...props.accessibilityState,
          selected: state.selected,
        };
      if (state.checked !== undefined)
        props.accessibilityState = {
          ...props.accessibilityState,
          checked: state.checked,
        };
      if (state.expanded !== undefined)
        props.accessibilityState = {
          ...props.accessibilityState,
          expanded: state.expanded,
        };
      if (state.busy !== undefined)
        props.accessibilityState = {
          ...props.accessibilityState,
          busy: state.busy,
        };
    }

    // Value properties for progress indicators, sliders, etc.
    if (value) {
      const accessibilityValue: any = {};
      if (value.min !== undefined) accessibilityValue.min = value.min;
      if (value.max !== undefined) accessibilityValue.max = value.max;
      if (value.now !== undefined) accessibilityValue.now = value.now;
      if (value.text !== undefined) accessibilityValue.text = value.text;

      if (Object.keys(accessibilityValue).length > 0) {
        props.accessibilityValue = accessibilityValue;
      }
    }

    return props;
  }

  /**
   * Create semantic descriptions for game elements
   */
  static describeGameElement(
    type: 'beacon' | 'probe' | 'resource' | 'button',
    details: any
  ): string {
    switch (type) {
      case 'beacon':
        const { level, type: beaconType, connections } = details;
        return `${beaconType} beacon, level ${level}, ${connections} connections`;

      case 'probe':
        const { status, destination, type: probeType } = details;
        return `${probeType} probe, ${status}, destination ${destination}`;

      case 'resource':
        const { name, amount, rate } = details;
        let description = `${name}: ${amount}`;
        if (rate) description += `, generating ${rate} per second`;
        return description;

      case 'button':
        const { action, cost, available } = details;
        let buttonDesc = `${action} button`;
        if (cost) buttonDesc += `, costs ${cost}`;
        if (available !== undefined)
          buttonDesc += available ? ', available' : ', unavailable';
        return buttonDesc;

      default:
        return 'Game element';
    }
  }

  /**
   * Format complex UI states for screen readers
   */
  static describeUIState(state: {
    screen?: string;
    mode?: string;
    selections?: string[];
    progress?: { current: number; total: number; task: string };
  }): string {
    const { screen, mode, selections, progress } = state;

    const parts: string[] = [];

    if (screen) parts.push(`Currently on ${screen} screen`);
    if (mode) parts.push(`In ${mode} mode`);
    if (selections && selections.length > 0) {
      parts.push(`Selected: ${selections.join(', ')}`);
    }
    if (progress) {
      parts.push(
        `${progress.task}: ${progress.current} of ${progress.total} complete`
      );
    }

    return parts.join('. ');
  }

  /**
   * Create accessible focus management helpers
   */
  static createFocusManager() {
    let previousFocus: any = null;

    return {
      storeFocus: (element: any) => {
        previousFocus = element;
      },

      restoreFocus: () => {
        if (previousFocus?.focus) {
          previousFocus.focus();
        }
        previousFocus = null;
      },

      setFocusTo: (element: any) => {
        if (element?.focus) {
          element.focus();
        }
      },
    };
  }

  /**
   * Validate if content meets accessibility standards
   */
  static validateAccessibility(element: {
    hasLabel?: boolean;
    hasRole?: boolean;
    isInteractive?: boolean;
    hasContrast?: boolean;
    hasFocusState?: boolean;
  }): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (element.isInteractive) {
      if (!element.hasLabel)
        issues.push('Interactive element missing accessibility label');
      if (!element.hasRole)
        issues.push('Interactive element missing accessibility role');
      if (!element.hasFocusState)
        issues.push('Interactive element missing focus state');
    }

    if (!element.hasContrast)
      issues.push('Element may not meet contrast requirements');

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Reset cached accessibility states (useful for testing or manual refresh)
   */
  static reset(): void {
    this.screenReaderEnabled = null;
    this.reduceMotionEnabled = null;
  }
}

/**
 * Hook-like utility for accessibility features in functional components
 */
export const useAccessibility = () => {
  return {
    isScreenReaderEnabled: AccessibilityHelper.isScreenReaderEnabled,
    isReduceMotionEnabled: AccessibilityHelper.isReduceMotionEnabled,
    announce: AccessibilityHelper.announceForAccessibility,
    getProps: AccessibilityHelper.getAccessibilityProps,
    describe: AccessibilityHelper.describeGameElement,
    validateA11y: AccessibilityHelper.validateAccessibility,
  };
};

// Export constants for common accessibility values
export const AccessibilityRoles = {
  BUTTON: 'button' as const,
  LINK: 'link' as const,
  IMAGE: 'image' as const,
  TEXT: 'text' as const,
  HEADER: 'header' as const,
  SEARCH: 'search' as const,
  TAB: 'tab' as const,
  TABLIST: 'tablist' as const,
  MENU: 'menu' as const,
  MENUITEM: 'menuitem' as const,
  PROGRESSBAR: 'progressbar' as const,
  ADJUSTABLE: 'adjustable' as const,
  SWITCH: 'switch' as const,
  CHECKBOX: 'checkbox' as const,
  RADIO: 'radio' as const,
};

export const AccessibilityTraits = {
  NONE: 'none' as const,
  BUTTON: 'button' as const,
  LINK: 'link' as const,
  HEADER: 'header' as const,
  SEARCH: 'search' as const,
  IMAGE: 'image' as const,
  SELECTED: 'selected' as const,
  PLAYS_SOUND: 'playsSound' as const,
  KEYBOARD_KEY: 'keyboardKey' as const,
  STATIC_TEXT: 'staticText' as const,
  SUMMARY_ELEMENT: 'summaryElement' as const,
  NOT_ENABLED: 'notEnabled' as const,
  UPDATES_FREQUENTLY: 'updatesFrequently' as const,
  STARTS_MEDIA_SESSION: 'startsMediaSession' as const,
  ADJUSTABLE: 'adjustable' as const,
  ALLOWS_DIRECT_INTERACTION: 'allowsDirectInteraction' as const,
  CAUSES_PAGE_TURN: 'causesPageTurn' as const,
};
