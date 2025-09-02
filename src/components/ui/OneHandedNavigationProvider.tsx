import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { Dimensions, AccessibilityInfo, Platform } from 'react-native';
import { AccessibilityHelper } from '../../utils/accessibility';

// One-handed navigation configuration
interface NavigationConfig {
  thumbReachZone: {
    height: number; // Height from bottom that's easily reachable
    bottomPadding: number; // Safe padding from bottom edge
  };
  accessibilityMode: {
    screenReaderEnabled: boolean;
    reduceMotionEnabled: boolean;
    largeTextEnabled: boolean;
    highContrastEnabled: boolean;
  };
  deviceInfo: {
    screenWidth: number;
    screenHeight: number;
    isSmallDevice: boolean; // < 375px width
    isTablet: boolean; // > 768px width
  };
}

interface OneHandedContextType {
  config: NavigationConfig;
  isElementInReachZone: (elementBottom: number) => boolean;
  getThumbReachableStyles: () => object;
  announceNavigation: (message: string) => void;
  refreshConfig: () => Promise<void>;
}

const OneHandedNavigationContext = createContext<OneHandedContextType | null>(
  null
);

export const useOneHandedNavigation = () => {
  const context = useContext(OneHandedNavigationContext);
  if (!context) {
    throw new Error(
      'useOneHandedNavigation must be used within OneHandedNavigationProvider'
    );
  }
  return context;
};

interface OneHandedNavigationProviderProps {
  children: ReactNode;
}

export const OneHandedNavigationProvider: React.FC<
  OneHandedNavigationProviderProps
> = ({ children }) => {
  const [config, setConfig] = useState<NavigationConfig>(() => {
    const { width, height } = Dimensions.get('window');

    return {
      thumbReachZone: {
        height: height * 0.65, // Bottom 65% of screen is reachable
        bottomPadding: Platform.OS === 'ios' ? 34 : 16, // Account for home indicator
      },
      accessibilityMode: {
        screenReaderEnabled: false,
        reduceMotionEnabled: false,
        largeTextEnabled: false,
        highContrastEnabled: false,
      },
      deviceInfo: {
        screenWidth: width,
        screenHeight: height,
        isSmallDevice: width < 375,
        isTablet: width > 768,
      },
    };
  });

  const refreshConfig = async () => {
    const { width, height } = Dimensions.get('window');
    const screenReaderEnabled =
      await AccessibilityHelper.isScreenReaderEnabled();
    const reduceMotionEnabled =
      await AccessibilityHelper.isReduceMotionEnabled();

    setConfig(prev => ({
      ...prev,
      deviceInfo: {
        screenWidth: width,
        screenHeight: height,
        isSmallDevice: width < 375,
        isTablet: width > 768,
      },
      accessibilityMode: {
        ...prev.accessibilityMode,
        screenReaderEnabled,
        reduceMotionEnabled,
        // Note: largeTextEnabled and highContrastEnabled would need platform-specific checks
        largeTextEnabled: false, // TODO: Implement system font scale detection
        highContrastEnabled: false, // TODO: Implement system contrast detection
      },
      thumbReachZone: {
        height: height * (screenReaderEnabled ? 0.75 : 0.65), // More space for screen reader users
        bottomPadding: Platform.OS === 'ios' ? 34 : 16,
      },
    }));
  };

  useEffect(() => {
    refreshConfig();

    // Listen for accessibility changes
    const cleanup = AccessibilityHelper.initializeListeners({
      onScreenReaderChange: enabled => {
        setConfig(prev => ({
          ...prev,
          accessibilityMode: {
            ...prev.accessibilityMode,
            screenReaderEnabled: enabled,
          },
          thumbReachZone: {
            ...prev.thumbReachZone,
            height: prev.deviceInfo.screenHeight * (enabled ? 0.75 : 0.65),
          },
        }));

        if (enabled) {
          AccessibilityHelper.announceForAccessibility(
            'Screen reader enabled. Interface optimized for accessibility navigation.'
          );
        }
      },
      onReduceMotionChange: enabled => {
        setConfig(prev => ({
          ...prev,
          accessibilityMode: {
            ...prev.accessibilityMode,
            reduceMotionEnabled: enabled,
          },
        }));
      },
    });

    // Listen for orientation changes
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setConfig(prev => ({
        ...prev,
        deviceInfo: {
          screenWidth: window.width,
          screenHeight: window.height,
          isSmallDevice: window.width < 375,
          isTablet: window.width > 768,
        },
        thumbReachZone: {
          ...prev.thumbReachZone,
          height:
            window.height *
            (prev.accessibilityMode.screenReaderEnabled ? 0.75 : 0.65),
        },
      }));
    });

    return () => {
      cleanup();
      subscription?.remove?.();
    };
  }, []);

  const isElementInReachZone = (elementBottom: number): boolean => {
    const reachableTop =
      config.deviceInfo.screenHeight - config.thumbReachZone.height;
    return elementBottom >= reachableTop;
  };

  const getThumbReachableStyles = () => {
    const { deviceInfo, thumbReachZone } = config;

    return {
      // Ensure important controls are in the bottom 65% of screen
      thumbZoneHeight: thumbReachZone.height,
      thumbZonePadding: thumbReachZone.bottomPadding,

      // Responsive spacing based on device size
      horizontalPadding: deviceInfo.isSmallDevice
        ? 16
        : deviceInfo.isTablet
          ? 32
          : 20,
      verticalSpacing: deviceInfo.isSmallDevice ? 12 : 16,

      // Touch target sizes for accessibility
      minTouchTarget: config.accessibilityMode.screenReaderEnabled ? 48 : 44,

      // Font scaling for readability
      baseFontSize: config.accessibilityMode.largeTextEnabled ? 18 : 16,
      smallFontSize: config.accessibilityMode.largeTextEnabled ? 16 : 14,
      largeFontSize: config.accessibilityMode.largeTextEnabled ? 24 : 20,
    };
  };

  const announceNavigation = (message: string) => {
    if (config.accessibilityMode.screenReaderEnabled) {
      AccessibilityHelper.announceForAccessibility(message);
    }
  };

  return (
    <OneHandedNavigationContext.Provider
      value={{
        config,
        isElementInReachZone,
        getThumbReachableStyles,
        announceNavigation,
        refreshConfig,
      }}
    >
      {children}
    </OneHandedNavigationContext.Provider>
  );
};

// Helper hook for styling components with accessibility and one-handed navigation
export const useAccessibleStyling = () => {
  const { config, getThumbReachableStyles } = useOneHandedNavigation();
  const styles = getThumbReachableStyles();

  return {
    ...styles,
    // Accessibility-aware colors
    getColor: (
      baseColor: string,
      type: 'text' | 'background' | 'border' = 'text'
    ) => {
      if (!config.accessibilityMode.highContrastEnabled) {
        return baseColor;
      }

      // High contrast mode adjustments
      switch (type) {
        case 'text':
          return baseColor.includes('text-text') ? '#FFFFFF' : baseColor;
        case 'background':
          return baseColor.includes('bg-background') ? '#000000' : baseColor;
        case 'border':
          return baseColor.includes('border-text') ? '#FFFFFF' : baseColor;
        default:
          return baseColor;
      }
    },

    // Accessibility-aware animations
    getAnimationConfig: (baseConfig: any) => ({
      ...baseConfig,
      duration: config.accessibilityMode.reduceMotionEnabled
        ? baseConfig.duration * 0.3 // Reduce animation duration
        : baseConfig.duration,
      useNativeDriver: !config.accessibilityMode.screenReaderEnabled, // Avoid conflicts
    }),

    // Screen reader optimized props
    getAccessibilityProps: (elementConfig: {
      label?: string;
      hint?: string;
      role?: string;
      state?: any;
      value?: any;
    }) => {
      if (!config.accessibilityMode.screenReaderEnabled) {
        // Return minimal props if screen reader is not enabled
        return {
          accessibilityLabel: elementConfig.label,
          accessibilityRole: elementConfig.role,
        };
      }

      // Full accessibility props for screen reader users
      return AccessibilityHelper.getAccessibilityProps(elementConfig);
    },
  };
};
