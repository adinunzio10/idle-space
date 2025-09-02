import { AccessibilityInfo, Dimensions, PixelRatio } from 'react-native';

export interface AccessibilitySettings {
  largeTextEnabled: boolean;
  highContrastEnabled: boolean;
  reduceAnimationsEnabled: boolean;
}

export interface AccessibilityState {
  isScreenReaderEnabled: boolean;
  fontScale: number;
  isHighContrastEnabled: boolean;
  isReduceAnimationsEnabled: boolean;
  isLargeTextEnabled: boolean;
}

/**
 * Manages accessibility features and integrates with system settings
 */
export class AccessibilityManager {
  private static instance: AccessibilityManager | null = null;
  private listeners: ((state: AccessibilityState) => void)[] = [];
  private screenReaderSubscription: any = null;
  private currentState: AccessibilityState = {
    isScreenReaderEnabled: false,
    fontScale: 1,
    isHighContrastEnabled: false,
    isReduceAnimationsEnabled: false,
    isLargeTextEnabled: false,
  };

  private constructor() {}

  static getInstance(): AccessibilityManager {
    if (!AccessibilityManager.instance) {
      AccessibilityManager.instance = new AccessibilityManager();
    }
    return AccessibilityManager.instance;
  }

  async initialize(): Promise<void> {
    try {
      console.log('[AccessibilityManager] Initializing...');

      // Check initial system accessibility state
      const isScreenReaderEnabled =
        await AccessibilityInfo.isScreenReaderEnabled();
      const fontScale = PixelRatio.getFontScale();

      this.currentState = {
        ...this.currentState,
        isScreenReaderEnabled,
        fontScale,
      };

      // Set up listeners for system accessibility changes
      const screenReaderSubscription = AccessibilityInfo.addEventListener(
        'screenReaderChanged',
        this.handleScreenReaderChange
      );
      // Store the subscription for cleanup
      this.screenReaderSubscription = screenReaderSubscription;

      console.log('[AccessibilityManager] Initialized successfully');
    } catch (error) {
      console.error('[AccessibilityManager] Failed to initialize:', error);
    }
  }

  /**
   * Update accessibility settings from user preferences
   */
  updateSettings(settings: AccessibilitySettings): void {
    const newState: AccessibilityState = {
      ...this.currentState,
      isHighContrastEnabled: settings.highContrastEnabled,
      isReduceAnimationsEnabled: settings.reduceAnimationsEnabled,
      isLargeTextEnabled: settings.largeTextEnabled,
    };

    this.currentState = newState;
    this.notifyListeners();

    console.log('[AccessibilityManager] Settings updated:', settings);
  }

  /**
   * Get current accessibility state
   */
  getState(): AccessibilityState {
    return { ...this.currentState };
  }

  /**
   * Subscribe to accessibility state changes
   */
  addListener(callback: (state: AccessibilityState) => void): () => void {
    this.listeners.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Get text size multiplier based on accessibility settings
   */
  getTextSizeMultiplier(): number {
    let multiplier = this.currentState.fontScale;

    if (this.currentState.isLargeTextEnabled) {
      multiplier *= 1.2; // Additional 20% increase when large text is enabled
    }

    return Math.max(multiplier, 1); // Ensure minimum of 1x
  }

  /**
   * Get contrast multiplier for colors
   */
  getContrastMultiplier(): number {
    return this.currentState.isHighContrastEnabled ? 1.5 : 1;
  }

  /**
   * Check if animations should be reduced
   */
  shouldReduceAnimations(): boolean {
    return this.currentState.isReduceAnimationsEnabled;
  }

  /**
   * Get accessibility-friendly touch target size
   */
  getMinTouchTargetSize(): number {
    const baseSize = 44; // iOS/Android minimum recommended size
    return Math.floor(baseSize * this.getTextSizeMultiplier());
  }

  /**
   * Generate accessibility label for complex UI elements
   */
  generateAccessibilityLabel(
    element: string,
    value?: number | string,
    context?: string,
    state?: string
  ): string {
    const parts: string[] = [element];

    if (value !== undefined) {
      parts.push(String(value));
    }

    if (context) {
      parts.push(context);
    }

    if (state) {
      parts.push(state);
    }

    return parts.join(', ');
  }

  /**
   * Create accessibility hint for interactive elements
   */
  createAccessibilityHint(action: string, result?: string): string {
    if (result) {
      return `${action} to ${result}`;
    }
    return action;
  }

  /**
   * Get theme adjustments for accessibility
   */
  getThemeAdjustments() {
    const contrast = this.getContrastMultiplier();
    const textScale = this.getTextSizeMultiplier();

    return {
      // Color adjustments for high contrast
      textColorOpacity: Math.min(1, 0.87 * contrast),
      secondaryTextOpacity: Math.min(1, 0.6 * contrast),
      borderOpacity: Math.min(1, 0.12 * contrast),

      // Size adjustments for large text
      baseFontSize: Math.floor(14 * textScale),
      smallFontSize: Math.floor(12 * textScale),
      largeFontSize: Math.floor(16 * textScale),
      titleFontSize: Math.floor(20 * textScale),

      // Spacing adjustments
      touchTargetSize: this.getMinTouchTargetSize(),
      paddingMultiplier: Math.min(textScale, 1.3), // Cap padding growth
    };
  }

  private handleScreenReaderChange = (isEnabled: boolean) => {
    this.currentState = {
      ...this.currentState,
      isScreenReaderEnabled: isEnabled,
    };
    this.notifyListeners();
    console.log('[AccessibilityManager] Screen reader changed:', isEnabled);
  };

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.currentState);
      } catch (error) {
        console.error('[AccessibilityManager] Error in listener:', error);
      }
    });
  }

  async shutdown(): Promise<void> {
    console.log('[AccessibilityManager] Shutting down...');
    if (this.screenReaderSubscription) {
      this.screenReaderSubscription.remove();
      this.screenReaderSubscription = null;
    }
    this.listeners.length = 0;
  }
}
