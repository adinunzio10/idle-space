import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback } from 'react';
import { AccessibilityHelper } from '../utils/accessibility';
import { useOneHandedNavigation } from '../components/ui/OneHandedNavigationProvider';
import type { RootStackParamList } from '../navigation/AppNavigator';
import * as Haptics from 'expo-haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const useAccessibleNavigation = () => {
  const navigation = useNavigation<NavigationProp>();
  const { config, announceNavigation } = useOneHandedNavigation();

  const navigateWithAccessibility = useCallback((
    screenName: keyof RootStackParamList,
    params?: any,
    options?: {
      haptic?: boolean;
      announcement?: string;
      replace?: boolean;
    }
  ) => {
    const { haptic = true, announcement, replace = false } = options || {};

    // Provide haptic feedback
    if (haptic && !config.accessibilityMode.reduceMotionEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // Navigate
    if (replace) {
      navigation.replace(screenName, params);
    } else {
      navigation.navigate(screenName, params);
    }

    // Announce navigation for screen readers
    const message = announcement || `Navigated to ${screenName.toString().replace(/([A-Z])/g, ' $1').toLowerCase()} screen`;
    announceNavigation(message);
  }, [navigation, config.accessibilityMode.reduceMotionEnabled, announceNavigation]);

  const goBackWithAccessibility = useCallback((options?: {
    haptic?: boolean;
    announcement?: string;
  }) => {
    const { haptic = true, announcement = 'Went back to previous screen' } = options || {};

    // Provide haptic feedback
    if (haptic && !config.accessibilityMode.reduceMotionEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (navigation.canGoBack()) {
      navigation.goBack();
      announceNavigation(announcement);
    }
  }, [navigation, config.accessibilityMode.reduceMotionEnabled, announceNavigation]);

  const getScreenTitle = useCallback((routeName: string): string => {
    const titleMap: Record<string, string> = {
      'Main': 'Signal Garden Home',
      'GalaxyMap': 'Galaxy Map - Interactive beacon network view',
      'Settings': 'Settings - Game preferences and options',
      'Statistics': 'Statistics - Game progress and analytics',
      'PatternGallery': 'Pattern Gallery - Discovered geometric formations',
      'ProbeManager': 'Probe Manager - Deployment and tracking'
    };

    return titleMap[routeName] || routeName;
  }, []);

  const announceScreenChange = useCallback((routeName: string) => {
    const title = getScreenTitle(routeName);
    announceNavigation(`Now viewing: ${title}`);
  }, [getScreenTitle, announceNavigation]);

  const getNavigationInstructions = useCallback((): string => {
    if (!config.accessibilityMode.screenReaderEnabled) {
      return '';
    }

    return 'Use swipe gestures to navigate between elements. ' +
           'Double-tap to activate buttons. ' +
           'Three-finger swipe to go back. ' +
           'Swipe left or right with two fingers to navigate between screens.';
  }, [config.accessibilityMode.screenReaderEnabled]);

  const createAccessibleButton = useCallback((
    label: string,
    onPress: () => void,
    options?: {
      hint?: string;
      disabled?: boolean;
      role?: string;
    }
  ) => {
    const { hint, disabled = false, role = 'button' } = options || {};

    return {
      onPress: () => {
        if (!disabled) {
          if (!config.accessibilityMode.reduceMotionEnabled) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          onPress();
        }
      },
      disabled,
      ...AccessibilityHelper.getAccessibilityProps({
        label,
        hint: hint || `Activates ${label.toLowerCase()}`,
        role,
        state: { disabled }
      }),
      // Ensure minimum touch target size for accessibility
      style: {
        minWidth: config.accessibilityMode.screenReaderEnabled ? 48 : 44,
        minHeight: config.accessibilityMode.screenReaderEnabled ? 48 : 44,
      }
    };
  }, [config.accessibilityMode]);

  const createAccessibleTabBar = useCallback((tabs: Array<{
    key: string;
    title: string;
    isActive: boolean;
    onPress: () => void;
  }>) => {
    return tabs.map(tab => ({
      ...tab,
      ...AccessibilityHelper.getAccessibilityProps({
        label: `${tab.title} tab`,
        hint: tab.isActive 
          ? `${tab.title} tab, currently selected` 
          : `Switches to ${tab.title} tab`,
        role: 'tab',
        state: { selected: tab.isActive }
      }),
      onPress: () => {
        if (!tab.isActive) {
          if (!config.accessibilityMode.reduceMotionEnabled) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          tab.onPress();
          announceNavigation(`Selected ${tab.title} tab`);
        }
      }
    }));
  }, [config.accessibilityMode.reduceMotionEnabled, announceNavigation]);

  // Navigation shortcuts optimized for one-handed use
  const navigationShortcuts = {
    // Quick access to main screens
    toHome: () => navigateWithAccessibility('Main', undefined, { 
      announcement: 'Returned to Signal Garden home screen' 
    }),
    toGalaxyMap: () => navigateWithAccessibility('GalaxyMap', undefined, { 
      announcement: 'Opened galaxy map - swipe to pan, pinch to zoom' 
    }),
    toSettings: () => navigateWithAccessibility('Settings', undefined, { 
      announcement: 'Opened settings - configure game preferences' 
    }),
    toStatistics: () => navigateWithAccessibility('Statistics', undefined, { 
      announcement: 'Opened statistics - view your game progress' 
    }),
    toPatterns: () => navigateWithAccessibility('PatternGallery', undefined, { 
      announcement: 'Opened pattern gallery - browse discovered formations' 
    }),
    
    // Contextual navigation with parameters - these would use modals instead of navigation
    // in the current architecture since BeaconDetails and ProbeDetails are modals
    toProbeManager: () => navigateWithAccessibility('ProbeManager', undefined, {
      announcement: 'Opened probe manager - deploy and track probes'
    })
  };

  return {
    // Core navigation
    navigate: navigateWithAccessibility,
    goBack: goBackWithAccessibility,
    
    // Screen utilities
    getScreenTitle,
    announceScreenChange,
    getNavigationInstructions,
    
    // Accessibility helpers
    createAccessibleButton,
    createAccessibleTabBar,
    
    // Quick navigation shortcuts
    shortcuts: navigationShortcuts,
    
    // Current state
    canGoBack: navigation.canGoBack(),
    currentRoute: navigation.getState()?.routes[navigation.getState()?.index || 0]?.name || 'Unknown'
  };
};