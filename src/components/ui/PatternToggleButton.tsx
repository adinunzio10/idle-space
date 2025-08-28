import React, { memo } from 'react';
import { View, Text } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  interpolate,
  runOnJS,
  useDerivedValue,
} from 'react-native-reanimated';

interface PatternToggleButtonProps {
  patternCount: number;
  isMapVisualizationsVisible: boolean;
  onToggleVisualizations: () => void;
  onOpenPopup: () => void;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

export const PatternToggleButton: React.FC<PatternToggleButtonProps> = memo(({
  patternCount,
  isMapVisualizationsVisible,
  onToggleVisualizations,
  onOpenPopup,
  position = 'bottom-right',
}) => {
  const scaleValue = useSharedValue(1);
  const pulseValue = useSharedValue(0);
  
  // Convert React prop to shared value for worklet access
  const isVisibleShared = useDerivedValue(() => isMapVisualizationsVisible);

  // Start pulsing animation when new patterns are detected
  React.useEffect(() => {
    if (patternCount > 0 && !isMapVisualizationsVisible) {
      pulseValue.value = withRepeat(
        withTiming(1, { duration: 1500 }),
        -1,
        true
      );
    } else {
      pulseValue.value = withTiming(0, { duration: 300 });
    }
  }, [patternCount, isMapVisualizationsVisible, pulseValue]);

  // Gesture handling for tap and long press
  const tapGesture = Gesture.Tap()
    .onStart(() => {
      scaleValue.value = withSpring(0.9, { damping: 15, stiffness: 400 });
    })
    .onEnd(() => {
      scaleValue.value = withSpring(1, { damping: 15, stiffness: 400 });
      runOnJS(onToggleVisualizations)();
    });

  const longPressGesture = Gesture.LongPress()
    .minDuration(500)
    .onStart(() => {
      scaleValue.value = withSpring(0.85, { damping: 15, stiffness: 400 });
    })
    .onEnd(() => {
      scaleValue.value = withSpring(1, { damping: 15, stiffness: 400 });
      runOnJS(onOpenPopup)();
    });

  const combinedGesture = Gesture.Exclusive(longPressGesture, tapGesture);

  // Animated styles
  const buttonStyle = useAnimatedStyle(() => {
    const pulseScale = interpolate(pulseValue.value, [0, 1], [1, 1.1]);
    const glowOpacity = interpolate(pulseValue.value, [0, 1], [0.3, 0.8]);
    
    // Include active button styles when visible
    const activeStyles = isVisibleShared.value ? {
      backgroundColor: '#4F46E5',
      borderColor: '#6366F1',
    } : {};
    
    return {
      transform: [{ scale: scaleValue.value * pulseScale }],
      shadowOpacity: isVisibleShared.value ? 0.8 : glowOpacity,
      ...activeStyles,
    };
  });

  const glowStyle = useAnimatedStyle(() => {
    const glowScale = interpolate(pulseValue.value, [0, 1], [1, 1.3]);
    const glowOpacity = interpolate(pulseValue.value, [0, 1], [0, 0.4]);
    
    return {
      transform: [{ scale: glowScale }],
      opacity: glowOpacity,
    };
  });

  if (patternCount === 0) {
    return null;
  }

  return (
    <View style={[styles.container, styles[`container_${position}`]]}>
      {/* Glow effect */}
      <Animated.View style={[styles.glow, glowStyle]} />
      
      {/* Main button */}
      <GestureDetector gesture={combinedGesture}>
        <Animated.View style={[
          styles.button,
          buttonStyle
        ]}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>⬢</Text>
          </View>
          
          {/* Badge with pattern count */}
          {patternCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {patternCount > 9 ? '9+' : patternCount}
              </Text>
            </View>
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
});

PatternToggleButton.displayName = 'PatternToggleButton';

const styles = {
  container: {
    position: 'absolute' as const,
    zIndex: 1000,
  },

  container_bottomRight: {
    bottom: 20,
    right: 20,
  },

  'container_bottom-right': {
    bottom: 20,
    right: 20,
  },

  'container_bottom-left': {
    bottom: 20,
    left: 20,
  },

  'container_top-right': {
    top: 80,
    right: 20,
  },

  'container_top-left': {
    top: 80,
    left: 20,
  },

  glow: {
    position: 'absolute' as const,
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 32,
    backgroundColor: '#4F46E5',
  },

  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1F2937',
    borderWidth: 2,
    borderColor: '#374151',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 8,
  },

  buttonActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#6366F1',
    shadowOpacity: 0.6,
  },

  iconContainer: {
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },

  icon: {
    fontSize: 24,
    color: '#F9FAFB',
    fontWeight: 'bold' as const,
  },

  badge: {
    position: 'absolute' as const,
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },

  badgeText: {
    fontSize: 12,
    fontWeight: 'bold' as const,
    color: '#FFFFFF',
  },
};

export default PatternToggleButton;