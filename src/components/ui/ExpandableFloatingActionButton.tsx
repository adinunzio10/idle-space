import React, { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  ViewStyle,
  AccessibilityInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

export interface FABAction {
  id: string;
  icon: string;
  label: string;
  onPress: () => void;
  backgroundColor?: string;
  disabled?: boolean;
  testID?: string;
}

export interface ExpandableFloatingActionButtonProps {
  primaryAction: FABAction;
  secondaryActions?: FABAction[];
  position?: 'bottomRight' | 'bottomCenter' | 'bottomLeft';
  size?: 'small' | 'medium' | 'large';
  expansionPattern?: 'radial' | 'linear' | 'arc';
  disabled?: boolean;
  testID?: string;
}

const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

export const ExpandableFloatingActionButton: React.FC<
  ExpandableFloatingActionButtonProps
> = ({
  primaryAction,
  secondaryActions = [],
  position = 'bottomRight',
  size = 'large',
  expansionPattern = 'radial',
  disabled = false,
  testID,
}) => {
  const insets = useSafeAreaInsets();
  const [isExpanded, setIsExpanded] = useState(false);

  // Animation values
  const mainScale = useSharedValue(1);
  const mainRotation = useSharedValue(0);
  const expansionScale = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);

  // Size configurations
  const sizeConfig = {
    small: { width: 48, height: 48, fontSize: 16 },
    medium: { width: 56, height: 56, fontSize: 18 },
    large: { width: 64, height: 64, fontSize: 20 },
  };

  const config = sizeConfig[size];
  const secondarySize = Math.max(config.width - 20, 36); // Smaller secondary buttons

  // Position configurations
  const getMainPositionStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      position: 'absolute',
      bottom: insets.bottom + 28,
      zIndex: 1000,
    };

    switch (position) {
      case 'bottomLeft':
        return { ...baseStyle, left: 20 };
      case 'bottomCenter':
        return {
          ...baseStyle,
          alignSelf: 'center',
          left: '50%',
          marginLeft: -config.width / 2,
        };
      case 'bottomRight':
      default:
        return { ...baseStyle, right: 20 };
    }
  };

  // Calculate secondary button positions
  const getSecondaryPositions = (): ViewStyle[] => {
    if (!secondaryActions.length) return [];

    const positions: ViewStyle[] = [];
    const mainPos = getMainPositionStyle();
    const spacing = config.width + 16; // Space between buttons

    switch (expansionPattern) {
      case 'linear':
        secondaryActions.forEach((_, index) => {
          const offset = (index + 1) * spacing;
          if (position === 'bottomLeft') {
            positions.push({ ...mainPos, left: (mainPos.left as number) + offset });
          } else if (position === 'bottomRight') {
            positions.push({ ...mainPos, right: (mainPos.right as number) + offset });
          } else {
            // bottomCenter - expand horizontally both ways
            const isEven = index % 2 === 0;
            const pairIndex = Math.ceil((index + 1) / 2);
            const offset = pairIndex * spacing;
            positions.push({
              ...mainPos,
              left: '50%',
              marginLeft: isEven ? offset - secondarySize / 2 : -(offset + secondarySize / 2),
            });
          }
        });
        break;

      case 'arc':
        const arcRadius = spacing * 0.8;
        const arcAngle = Math.PI / secondaryActions.length; // Slightly more spread across semicircle
        
        secondaryActions.forEach((_, index) => {
          const angle = arcAngle * (index + 1) - Math.PI / 2; // Start from top
          const x = arcRadius * Math.cos(angle);
          const y = arcRadius * Math.sin(angle);
          
          if (position === 'bottomLeft') {
            positions.push({
              ...mainPos,
              left: (mainPos.left as number) + x + config.width / 2 - secondarySize / 2,
              bottom: (mainPos.bottom as number) - y + config.height / 2 - secondarySize / 2,
            });
          } else if (position === 'bottomRight') {
            positions.push({
              ...mainPos,
              right: (mainPos.right as number) - x + config.width / 2 - secondarySize / 2,
              bottom: (mainPos.bottom as number) - y + config.height / 2 - secondarySize / 2,
            });
          } else {
            positions.push({
              position: 'absolute',
              bottom: (mainPos.bottom as number) - y + config.height / 2 - secondarySize / 2,
              left: '50%',
              marginLeft: x - secondarySize / 2,
              zIndex: 999,
            });
          }
        });
        break;

      case 'radial':
      default:
        const radius = spacing * 0.85;
        let angleStep, startAngle;
        
        if (position === 'bottomRight') {
          // For bottom-right FAB, spread leftward
          angleStep = (Math.PI * 0.6) / Math.max(1, secondaryActions.length - 1); // 108 degrees
          startAngle = Math.PI * 0.7; // Start from upper-left, go counter-clockwise
        } else {
          // Default radial pattern for other positions
          angleStep = (Math.PI * 1.5) / Math.max(1, secondaryActions.length - 1); // 270 degrees
          startAngle = -Math.PI * 0.75; // Start from top-left
        }

        secondaryActions.forEach((_, index) => {
          const angle = startAngle + angleStep * index;
          const x = radius * Math.cos(angle);
          const y = radius * Math.sin(angle);

          if (position === 'bottomLeft') {
            positions.push({
              ...mainPos,
              left: (mainPos.left as number) + x + config.width / 2 - secondarySize / 2,
              bottom: (mainPos.bottom as number) - y + config.height / 2 - secondarySize / 2,
            });
          } else if (position === 'bottomRight') {
            positions.push({
              ...mainPos,
              right: (mainPos.right as number) - x + config.width / 2 - secondarySize / 2,
              bottom: (mainPos.bottom as number) - y + config.height / 2 - secondarySize / 2,
            });
          } else {
            positions.push({
              position: 'absolute',
              bottom: (mainPos.bottom as number) - y + config.height / 2 - secondarySize / 2,
              left: '50%',
              marginLeft: x - secondarySize / 2,
              zIndex: 999,
            });
          }
        });
        break;
    }

    return positions;
  };

  const handlePrimaryPress = () => {
    if (disabled) return;

    if (secondaryActions.length > 0) {
      // Toggle expansion
      toggleExpansion();
    } else {
      // Direct action
      handleAction(primaryAction);
    }
  };

  const handleAction = (action: FABAction) => {
    if (action.disabled) return;

    // Success haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Bounce animation
    mainScale.value = withSequence(
      withSpring(0.9, { damping: 15, stiffness: 300 }),
      withSpring(1.05, { damping: 15, stiffness: 300 }),
      withSpring(1, { damping: 15, stiffness: 300 })
    );

    // Close expansion if open
    if (isExpanded) {
      collapseActions();
    }

    // Call the action after a brief delay
    setTimeout(() => {
      action.onPress();
    }, 50);
  };

  const toggleExpansion = () => {
    if (isExpanded) {
      collapseActions();
    } else {
      expandActions();
    }
  };

  const expandActions = () => {
    setIsExpanded(true);

    // Light haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Main button rotation (if it's a + or similar)
    mainRotation.value = withSpring(45, { damping: 15, stiffness: 300 });

    // Backdrop fade in
    backdropOpacity.value = withTiming(0.3, { duration: 200 });

    // Scale in secondary buttons
    expansionScale.value = withSpring(1, {
      damping: 12,
      stiffness: 400,
    });
  };

  const collapseActions = () => {
    setIsExpanded(false);

    // Main button rotation back
    mainRotation.value = withSpring(0, { damping: 15, stiffness: 300 });

    // Backdrop fade out
    backdropOpacity.value = withTiming(0, { duration: 150 });

    // Scale out secondary buttons
    expansionScale.value = withTiming(0, { duration: 150 });
  };

  // Main button animated styles
  const mainAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: mainScale.value },
        { rotate: `${mainRotation.value}deg` },
      ],
    };
  });

  // Backdrop animated style
  const backdropAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: backdropOpacity.value,
    };
  });

  // Secondary button animated style
  const secondaryAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: expansionScale.value }],
      opacity: expansionScale.value,
    };
  });

  const secondaryPositions = getSecondaryPositions();

  return (
    <>
      {/* Backdrop */}
      {secondaryActions.length > 0 && (
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: '#000',
              zIndex: 998,
            },
            backdropAnimatedStyle,
          ]}
          pointerEvents={isExpanded ? 'auto' : 'none'}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={collapseActions}
            activeOpacity={1}
          />
        </Animated.View>
      )}

      {/* Secondary Action Buttons */}
      {secondaryActions.map((action, index) => (
        <Animated.View
          key={action.id}
          style={[
            secondaryPositions[index],
            secondaryAnimatedStyle,
          ]}
        >
          <TouchableOpacity
            style={[
              {
                width: secondarySize,
                height: secondarySize,
                borderRadius: secondarySize / 2,
                backgroundColor: action.backgroundColor || '#6B7280',
                justifyContent: 'center',
                alignItems: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 8,
                borderWidth: 2,
                borderColor: 'rgba(255, 255, 255, 0.2)',
              },
            ]}
            onPress={() => handleAction(action)}
            disabled={action.disabled}
            testID={action.testID}
            accessibilityLabel={action.label}
            accessibilityRole="button"
          >
            <Text
              style={{
                fontSize: Math.floor(config.fontSize * 0.8),
                color: action.disabled ? '#9CA3AF' : '#FFFFFF',
                fontWeight: 'bold',
              }}
            >
              {action.icon}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      ))}

      {/* Main Action Button */}
      <AnimatedTouchableOpacity
        style={[
          {
            width: config.width,
            height: config.height,
            borderRadius: config.width / 2,
            backgroundColor: primaryAction.backgroundColor || '#4F46E5',
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
            borderWidth: disabled ? 0 : 2,
            borderColor: disabled ? 'transparent' : 'rgba(255, 255, 255, 0.2)',
          },
          getMainPositionStyle(),
          mainAnimatedStyle,
        ]}
        onPress={handlePrimaryPress}
        disabled={disabled || primaryAction.disabled}
        testID={testID || primaryAction.testID}
        accessibilityLabel={primaryAction.label}
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || primaryAction.disabled, expanded: isExpanded }}
      >
        <Text
          style={{
            fontSize: config.fontSize,
            color: disabled ? '#9CA3AF' : '#FFFFFF',
            fontWeight: 'bold',
            textAlign: 'center',
          }}
        >
          {primaryAction.icon}
        </Text>
      </AnimatedTouchableOpacity>
    </>
  );
};