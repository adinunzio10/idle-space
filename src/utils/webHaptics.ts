import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export class WebCompatibleHaptics {
  static async impactAsync(style: Haptics.ImpactFeedbackStyle): Promise<void> {
    if (Platform.OS !== 'web') {
      return Haptics.impactAsync(style);
    }

    // Web fallback - use navigator.vibrate if available
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        // Map haptic styles to vibration patterns
        const vibrationMap = {
          [Haptics.ImpactFeedbackStyle.Light]: 10,
          [Haptics.ImpactFeedbackStyle.Medium]: 25,
          [Haptics.ImpactFeedbackStyle.Heavy]: 50,
        };

        const duration = vibrationMap[style as keyof typeof vibrationMap] || 25;
        navigator.vibrate(duration);
      } catch (_error) {
        // Silently fail if vibration isn't supported
      }
    }
  }

  static async notificationAsync(type: Haptics.NotificationFeedbackType): Promise<void> {
    if (Platform.OS !== 'web') {
      return Haptics.notificationAsync(type);
    }

    // Web fallback
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        const vibrationMap = {
          [Haptics.NotificationFeedbackType.Success]: [50, 50, 50],
          [Haptics.NotificationFeedbackType.Warning]: [100, 100, 100],
          [Haptics.NotificationFeedbackType.Error]: [200, 100, 200],
        };

        const pattern = vibrationMap[type as keyof typeof vibrationMap] || [50];
        navigator.vibrate(pattern);
      } catch (error) {
        // Silently fail if vibration isn't supported
      }
    }
  }

  static async selectionAsync(): Promise<void> {
    if (Platform.OS !== 'web') {
      return Haptics.selectionAsync();
    }

    // Web fallback
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(10);
      } catch (error) {
        // Silently fail if vibration isn't supported
      }
    }
  }
}

// Export compatible style constants
export const ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle;
export const NotificationFeedbackType = Haptics.NotificationFeedbackType;
