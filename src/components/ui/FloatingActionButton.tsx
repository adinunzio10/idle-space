import React, { useState } from 'react';
import { TouchableOpacity, Text, ViewStyle, AccessibilityInfo } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withSequence,
  runOnJS 
} from 'react-native-reanimated';

interface FloatingActionButtonProps {
  onPress: () => void;
  icon?: string;
  label?: string;
  disabled?: boolean;
  style?: ViewStyle;
  position?: 'bottomRight' | 'bottomCenter' | 'bottomLeft';
  size?: 'small' | 'medium' | 'large';
  backgroundColor?: string;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  onPress,
  icon = '🚀',
  label,
  disabled = false,
  style,
  position = 'bottomRight',
  size = 'large',
  backgroundColor,
  testID,
  accessibilityLabel,
  accessibilityHint
}) => {
  const insets = useSafeAreaInsets();
  const [isPressed, setIsPressed] = useState(false);
  
  // Animation values
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);
  
  // Size configurations
  const sizeConfig = {
    small: { width: 48, height: 48, fontSize: 16 },
    medium: { width: 56, height: 56, fontSize: 18 },
    large: { width: 64, height: 64, fontSize: 20 }
  };
  
  const config = sizeConfig[size];
  
  // Position configurations
  const getPositionStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      position: 'absolute',
      bottom: insets.bottom + 20,
      zIndex: 1000,
    };
    
    switch (position) {
      case 'bottomLeft':
        return { ...baseStyle, left: 20 };
      case 'bottomCenter':
        return { ...baseStyle, alignSelf: 'center', left: '50%', marginLeft: -config.width / 2 };
      case 'bottomRight':
      default:
        return { ...baseStyle, right: 20 };
    }
  };
  
  // Background color logic
  const getBackgroundColor = () => {
    if (backgroundColor) return backgroundColor;
    if (disabled) return '#6B7280'; // gray-500
    return '#4F46E5'; // primary color
  };
  
  const handlePressIn = () => {
    if (disabled) return;
    
    setIsPressed(true);
    
    // Haptic feedback - light impact for press start
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Scale down animation
    scale.value = withSpring(0.95, {
      damping: 15,
      stiffness: 300,
    });
    
    translateY.value = withSpring(2, {
      damping: 15,
      stiffness: 300,
    });
  };
  
  const handlePressOut = () => {
    setIsPressed(false);
    
    // Scale back up animation
    scale.value = withSpring(1, {
      damping: 15,
      stiffness: 300,
    });
    
    translateY.value = withSpring(0, {
      damping: 15,
      stiffness: 300,
    });
  };
  
  const handlePress = () => {
    if (disabled) return;
    
    // Success haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Bounce animation
    scale.value = withSequence(
      withSpring(0.9, { damping: 15, stiffness: 300 }),
      withSpring(1.05, { damping: 15, stiffness: 300 }),
      withSpring(1, { damping: 15, stiffness: 300 })
    );
    
    // Call the onPress function after a brief delay to feel responsive
    setTimeout(() => {
      runOnJS(onPress)();
    }, 50);
  };
  
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: scale.value },
        { translateY: translateY.value }
      ],
    };
  });
  
  return (
    <AnimatedTouchableOpacity
      style={[
        {
          width: config.width,
          height: config.height,
          borderRadius: config.width / 2,
          backgroundColor: getBackgroundColor(),
          justifyContent: 'center',
          alignItems: 'center',
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: 4,
          },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
          borderWidth: disabled ? 0 : 2,
          borderColor: disabled ? 'transparent' : 'rgba(255, 255, 255, 0.2)',
        },
        getPositionStyle(),
        animatedStyle,
        style,
      ]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.8}
      testID={testID}
      accessibilityLabel={accessibilityLabel || label || 'Action Button'}
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <Text 
        style={{
          fontSize: config.fontSize,
          color: disabled ? '#9CA3AF' : '#FFFFFF',
          fontWeight: 'bold',
          textAlign: 'center',
        }}
      >
        {icon}
      </Text>
      
      {label && size !== 'small' && (
        <Text 
          style={{
            fontSize: 10,
            color: disabled ? '#9CA3AF' : '#FFFFFF',
            fontWeight: '600',
            marginTop: 2,
            textAlign: 'center',
          }}
        >
          {label}
        </Text>
      )}
    </AnimatedTouchableOpacity>
  );
};