import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Animated,
  TouchableWithoutFeedback,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

interface BaseOverlayProps {
  isVisible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  showCloseButton?: boolean;
  animationType?: 'slide' | 'fade' | 'none';
  animationDuration?: number;
  backdropOpacity?: number;
  swipeDirection?:
    | 'up'
    | 'down'
    | 'left'
    | 'right'
    | ('up' | 'down' | 'left' | 'right')[];
  onSwipeComplete?: () => void;
  maxHeight?: number;
  fullScreen?: boolean;
  testID?: string;
  zIndex?: number;
  position?: { x: number; y: number }; // For coordinate-based animations
  enableScrollView?: boolean; // Whether to wrap content in ScrollView
  showScrollIndicator?: boolean; // Whether to show scroll indicators
}

export const BaseOverlay: React.FC<BaseOverlayProps> = ({
  isVisible,
  onClose,
  title,
  children,
  showCloseButton = true,
  animationType = 'slide',
  animationDuration = 300,
  backdropOpacity = 0.5,
  swipeDirection = 'down',
  onSwipeComplete,
  maxHeight,
  fullScreen = false,
  testID,
  zIndex = 1000,
  position,
  enableScrollView = true,
  showScrollIndicator = false,
}) => {
  const insets = useSafeAreaInsets();
  const screenData = Dimensions.get('window');

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(screenData.height)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  // Gesture handling
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible) {
      // Animate in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: animationDuration,
          useNativeDriver: true,
        }),
        animationType === 'slide'
          ? Animated.timing(slideAnim, {
              toValue: 0,
              duration: animationDuration,
              useNativeDriver: true,
            })
          : Animated.timing(scaleAnim, {
              toValue: 1,
              duration: animationDuration,
              useNativeDriver: true,
            }),
      ]).start();
    } else {
      // Animate out
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: animationDuration * 0.8,
          useNativeDriver: true,
        }),
        animationType === 'slide'
          ? Animated.timing(slideAnim, {
              toValue: screenData.height,
              duration: animationDuration * 0.8,
              useNativeDriver: true,
            })
          : Animated.timing(scaleAnim, {
              toValue: 0.8,
              duration: animationDuration * 0.8,
              useNativeDriver: true,
            }),
      ]).start();
    }
  }, [isVisible, animationType, animationDuration, fadeAnim, slideAnim, scaleAnim, screenData.height]);

  const handleClose = () => {
    // Haptic feedback on close
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const handleSwipeComplete = () => {
    if (onSwipeComplete) {
      onSwipeComplete();
    } else {
      handleClose();
    }
  };

  const handleBackdropPress = () => {
    handleClose();
  };

  // Handle pan gesture for swipe to dismiss
  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationY: translateY } }],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === State.END) {
      const { translationY, velocityY } = event.nativeEvent;

      // Determine if should dismiss based on swipe distance and velocity
      const shouldDismiss = translationY > 100 || velocityY > 500;

      if (
        shouldDismiss &&
        (swipeDirection === 'down' ||
          (Array.isArray(swipeDirection) && swipeDirection.includes('down')))
      ) {
        Animated.timing(translateY, {
          toValue: screenData.height,
          duration: 250,
          useNativeDriver: true,
        }).start(handleSwipeComplete);
      } else {
        // Spring back to original position
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      }
    }
  };

  const getOverlayStyle = () => {
    const baseStyle = {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex,
    };

    if (fullScreen) {
      return {
        ...baseStyle,
        justifyContent: 'flex-end' as const,
      };
    }

    return {
      ...baseStyle,
      justifyContent: 'center' as const,
      paddingHorizontal: 20,
    };
  };

  const getContentHeight = () => {
    if (fullScreen) {
      return screenData.height;
    }

    if (maxHeight) {
      return Math.min(maxHeight, screenData.height * 0.9);
    }

    return screenData.height * 0.7; // Default to 70% of screen height
  };

  const getContentTransform = () => {
    const transforms = [];

    if (animationType === 'slide') {
      transforms.push({ translateY: slideAnim });
      if (
        swipeDirection === 'down' ||
        (Array.isArray(swipeDirection) && swipeDirection.includes('down'))
      ) {
        transforms.push({ translateY });
      }
    } else {
      transforms.push({ scale: scaleAnim });
    }

    // Add coordinate-based animation if position is provided
    if (position) {
      // This would be for animating from a specific point (like a beacon position)
      // For now, we'll keep it simple but this is where coordinate interpolation would go
    }

    return transforms;
  };

  if (!isVisible) {
    return null;
  }

  return (
    <View style={getOverlayStyle()}>
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'black',
            opacity: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, backdropOpacity],
            }),
          }}
        />
      </TouchableWithoutFeedback>

      {/* Content Container */}
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
        enabled={
          swipeDirection === 'down' ||
          (Array.isArray(swipeDirection) && swipeDirection.includes('down'))
        }
      >
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: getContentTransform(),
            ...(fullScreen ? {} : { marginHorizontal: 20 }),
          }}
        >
          <View
            className="bg-surface rounded-xl overflow-hidden"
            style={{
              maxHeight: getContentHeight(),
              paddingTop: fullScreen
                ? insets.top + (StatusBar.currentHeight || 0)
                : 0,
              paddingBottom: Math.max(insets.bottom, 10),
            }}
            accessible={isVisible}
            importantForAccessibility={
              isVisible ? 'auto' : 'no-hide-descendants'
            }
          >
            {/* Overlay Header */}
            {(title || showCloseButton) && (
              <View className="flex-row justify-between items-center px-6 py-4 border-b border-text/10">
                <View className="flex-1">
                  {title && (
                    <Text className="text-text text-xl font-bold">{title}</Text>
                  )}
                </View>

                {showCloseButton && (
                  <TouchableOpacity
                    onPress={handleClose}
                    className="w-10 h-10 rounded-full bg-text/10 justify-center items-center ml-4"
                    accessibilityLabel="Close Overlay"
                    accessibilityRole="button"
                    testID={
                      testID ? `${testID}-close-button` : 'overlay-close-button'
                    }
                  >
                    <Text className="text-text text-lg font-semibold">×</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Swipe Indicator */}
            {swipeDirection && !fullScreen && (
              <View className="items-center py-2">
                <View className="w-12 h-1 bg-text/30 rounded-full" />
              </View>
            )}

            {/* Overlay Content */}
            {enableScrollView ? (
              <ScrollView
                style={{
                  maxHeight: getContentHeight() - 100, // Leave room for header
                }}
                contentContainerStyle={{
                  paddingHorizontal: 24,
                  paddingVertical: 16,
                  flexGrow: 1,
                }}
                showsVerticalScrollIndicator={showScrollIndicator}
                keyboardShouldPersistTaps="handled"
                testID={
                  testID ? `${testID}-scroll-view` : 'overlay-scroll-view'
                }
              >
                {children}
              </ScrollView>
            ) : (
              <View
                style={{
                  paddingHorizontal: 24,
                  paddingVertical: 16,
                  maxHeight: getContentHeight() - 100, // Leave room for header
                  overflow: 'hidden',
                }}
              >
                {children}
              </View>
            )}
          </View>
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
};
