import { useEffect, useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { AccessibilityManager, AccessibilityState } from '../utils/AccessibilityManager';

/**
 * Hook that integrates accessibility manager with settings
 * Provides real-time accessibility state and theme adjustments
 */
export const useAccessibility = () => {
  const { settings } = useSettings();
  const [accessibilityState, setAccessibilityState] = useState<AccessibilityState>({
    isScreenReaderEnabled: false,
    fontScale: 1,
    isHighContrastEnabled: false,
    isReduceAnimationsEnabled: false,
    isLargeTextEnabled: false,
  });

  const accessibilityManager = AccessibilityManager.getInstance();

  // Update accessibility manager when settings change
  useEffect(() => {
    accessibilityManager.updateSettings({
      largeTextEnabled: settings.largeTextEnabled,
      highContrastEnabled: settings.highContrastEnabled,
      reduceAnimationsEnabled: settings.reduceAnimationsEnabled,
    });
  }, [
    accessibilityManager,
    settings.largeTextEnabled,
    settings.highContrastEnabled,
    settings.reduceAnimationsEnabled,
  ]);

  // Subscribe to accessibility state changes
  useEffect(() => {
    const unsubscribe = accessibilityManager.addListener(setAccessibilityState);
    
    // Get initial state
    setAccessibilityState(accessibilityManager.getState());
    
    return unsubscribe;
  }, [accessibilityManager]);

  // Get theme adjustments based on current accessibility state
  const themeAdjustments = accessibilityManager.getThemeAdjustments();

  return {
    accessibilityState,
    themeAdjustments,
    // Utility functions
    getTextSizeMultiplier: () => accessibilityManager.getTextSizeMultiplier(),
    shouldReduceAnimations: () => accessibilityManager.shouldReduceAnimations(),
    getMinTouchTargetSize: () => accessibilityManager.getMinTouchTargetSize(),
    generateAccessibilityLabel: accessibilityManager.generateAccessibilityLabel.bind(accessibilityManager),
    createAccessibilityHint: accessibilityManager.createAccessibilityHint.bind(accessibilityManager),
  };
};