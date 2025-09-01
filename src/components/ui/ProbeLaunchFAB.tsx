import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming,
  runOnJS 
} from 'react-native-reanimated';
import { ProbeType, PROBE_TYPE_CONFIG, PROBE_DISPLAY_ORDER } from '../../types/probe';
import { Point2D } from '../../types/galaxy';
import { useResources } from '../../core/ResourceContext';

interface ProbeLaunchFABProps {
  onProbeSelect: (type: ProbeType, position: Point2D) => void;
  position?: 'bottomRight' | 'bottomLeft';
  launchPosition: Point2D; // Where to launch probes from (usually galaxy center)
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

// Add debug log at module level to verify import
console.warn('🚨 [ProbeLaunchFAB] MODULE LOADED - SHOULD BE VISIBLE!');

export const ProbeLaunchFAB: React.FC<ProbeLaunchFABProps> = ({
  onProbeSelect,
  position = 'bottomRight',
  launchPosition,
}) => {
  console.warn('🚨 [ProbeLaunchFAB] COMPONENT RENDERING!');
  console.log('[ProbeLaunchFAB] Props received:', { position, launchPosition });
  
  const insets = useSafeAreaInsets();
  console.log('[ProbeLaunchFAB] Got safe area insets:', insets);
  
  const { canAfford, formatResourceValue } = useResources();
  console.log('[ProbeLaunchFAB] Got resources context');
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Animation values
  const fabScale = useSharedValue(1);
  const fabRotation = useSharedValue(0);
  const menuOpacity = useSharedValue(0);
  const menuScale = useSharedValue(0.8);
  
  // Individual probe button animations
  const probeButtonScales = PROBE_DISPLAY_ORDER.reduce((acc, type) => {
    acc[type] = useSharedValue(0.8);
    return acc;
  }, {} as Record<ProbeType, any>);
  
  const probeButtonTranslateY = PROBE_DISPLAY_ORDER.reduce((acc, type) => {
    acc[type] = useSharedValue(20);
    return acc;
  }, {} as Record<ProbeType, any>);

  const handleFABPress = useCallback(() => {
    // Haptic feedback for main button
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    
    if (newExpanded) {
      // Expand animations
      fabRotation.value = withSpring(45, { damping: 15, stiffness: 300 });
      menuOpacity.value = withTiming(1, { duration: 200 });
      menuScale.value = withSpring(1, { damping: 15, stiffness: 300 });
      
      // Stagger probe button animations
      PROBE_DISPLAY_ORDER.forEach((type, index) => {
        // Use setTimeout for staggered animations since withSpring doesn't support delay
        setTimeout(() => {
          probeButtonScales[type].value = withSpring(1, { 
            damping: 15, 
            stiffness: 300
          });
          probeButtonTranslateY[type].value = withSpring(0, { 
            damping: 15, 
            stiffness: 300
          });
        }, index * 50);
      });
    } else {
      // Collapse animations
      fabRotation.value = withSpring(0, { damping: 15, stiffness: 300 });
      menuOpacity.value = withTiming(0, { duration: 150 });
      menuScale.value = withSpring(0.8, { damping: 15, stiffness: 300 });
      
      // Reset probe button animations
      PROBE_DISPLAY_ORDER.forEach((type) => {
        probeButtonScales[type].value = withSpring(0.8, { damping: 15, stiffness: 300 });
        probeButtonTranslateY[type].value = withSpring(20, { damping: 15, stiffness: 300 });
      });
    }
  }, [isExpanded, fabRotation, menuOpacity, menuScale, probeButtonScales, probeButtonTranslateY]);

  const handleProbeTypeSelect = useCallback((type: ProbeType) => {
    const config = PROBE_TYPE_CONFIG[type];
    
    if (!canAfford(config.cost)) {
      // Error haptic for insufficient resources
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    
    // Success haptic for valid selection
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Close the menu
    setIsExpanded(false);
    fabRotation.value = withSpring(0, { damping: 15, stiffness: 300 });
    menuOpacity.value = withTiming(0, { duration: 150 });
    menuScale.value = withSpring(0.8, { damping: 15, stiffness: 300 });
    
    // Reset probe button animations
    PROBE_DISPLAY_ORDER.forEach((probeType) => {
      probeButtonScales[probeType].value = withSpring(0.8, { damping: 15, stiffness: 300 });
      probeButtonTranslateY[probeType].value = withSpring(20, { damping: 15, stiffness: 300 });
    });
    
    // Launch the probe
    onProbeSelect(type, launchPosition);
  }, [canAfford, onProbeSelect, launchPosition, fabRotation, menuOpacity, menuScale, probeButtonScales, probeButtonTranslateY]);

  // Main FAB animated style
  const fabAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: fabScale.value },
        { rotate: `${fabRotation.value}deg` }
      ],
    };
  });

  // Menu container animated style
  const menuAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: menuOpacity.value,
      transform: [{ scale: menuScale.value }],
    };
  });

  // Create animated styles for all probe types upfront (must be at top level)
  const probeButtonAnimatedStyles = PROBE_DISPLAY_ORDER.reduce((acc, type) => {
    acc[type] = useAnimatedStyle(() => ({
      opacity: menuOpacity.value,
      transform: [
        { scale: probeButtonScales[type].value },
        { translateY: probeButtonTranslateY[type].value }
      ],
    }));
    return acc;
  }, {} as Record<ProbeType, any>);

  // Position style based on prop
  const getPositionStyle = () => {
    // Debug logging for safe area insets
    console.log('[ProbeLaunchFAB] Safe area insets:', insets);
    console.log('[ProbeLaunchFAB] Position calculation - bottom will be:', 30 + insets.bottom);
    
    const baseStyle = {
      position: 'absolute' as const,
      bottom: 30 + insets.bottom, // Use safe area insets properly
      zIndex: 9999, // Higher z-index to ensure visibility
    };
    
    const finalStyle = position === 'bottomLeft' 
      ? { ...baseStyle, left: 20 }
      : { ...baseStyle, right: 20 };
      
    console.log('[ProbeLaunchFAB] Final position style:', finalStyle);
    console.log('[ProbeLaunchFAB] Final position calculated as:', finalStyle);
    
    return finalStyle;
  };

  const formatCost = (cost: Partial<Record<string, number>>) => {
    return Object.entries(cost)
      .map(([resource, amount]) => `${amount} ${resource.toUpperCase()}`)
      .join(', ');
  };

  console.log('[ProbeLaunchFAB] About to render component');
  console.log('[ProbeLaunchFAB] Position style will be:', getPositionStyle());

  return (
    <View style={[getPositionStyle(), { 
      backgroundColor: 'rgba(255, 0, 0, 0.8)', // Bright red background
      padding: 10,
      borderRadius: 20,
      borderWidth: 5,
      borderColor: 'yellow' // Yellow border
    }]}>
      {/* Probe Type Selection Menu */}
      {isExpanded && (
        <Animated.View
          style={[
            {
              position: 'absolute',
              bottom: 70, // Above the main FAB
              right: position === 'bottomLeft' ? 0 : -160, // Adjusted offset for better visibility
              left: position === 'bottomRight' ? 20 : undefined, // Ensure menu doesn't go off-screen
              width: 180, // Fixed width instead of minWidth
            },
            menuAnimatedStyle
          ]}
          pointerEvents={isExpanded ? 'auto' : 'none'}
        >
          {PROBE_DISPLAY_ORDER.map((type, index) => {
            const config = PROBE_TYPE_CONFIG[type];
            const affordable = canAfford(config.cost);
            
            return (
              <AnimatedTouchableOpacity
                key={type}
                style={[
                  {
                    backgroundColor: affordable ? config.color : '#6B7280',
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.25,
                    shadowRadius: 4,
                    elevation: 5,
                    borderWidth: 1,
                    borderColor: affordable ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                  },
                  probeButtonAnimatedStyles[type]
                ]}
                onPress={() => handleProbeTypeSelect(type)}
                disabled={!affordable}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 20, marginRight: 8 }}>
                  {config.icon}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ 
                    color: '#FFFFFF', 
                    fontWeight: 'bold', 
                    fontSize: 14,
                    textTransform: 'capitalize',
                    opacity: affordable ? 1 : 0.6
                  }}>
                    {type}
                  </Text>
                  <Text style={{ 
                    color: '#FFFFFF', 
                    fontSize: 10, 
                    opacity: affordable ? 0.8 : 0.4,
                    marginTop: 2
                  }}>
                    {formatCost(config.cost)}
                  </Text>
                  <Text style={{ 
                    color: '#FFFFFF', 
                    fontSize: 10, 
                    opacity: affordable ? 0.6 : 0.4,
                    marginTop: 1
                  }}>
                    {config.deploymentTime}s deploy
                  </Text>
                </View>
                {!affordable && (
                  <Text style={{ 
                    color: '#EF4444', 
                    fontSize: 10, 
                    fontWeight: 'bold' 
                  }}>
                    ❌
                  </Text>
                )}
              </AnimatedTouchableOpacity>
            );
          })}
        </Animated.View>
      )}

      {/* Main FAB */}
      <AnimatedTouchableOpacity
        style={[
          {
            width: 60, // Standard FAB size
            height: 60,
            borderRadius: 30,
            backgroundColor: '#4F46E5',
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
            borderWidth: 3, // Thicker border
            borderColor: '#FFFFFF', // Bright white border for visibility
            zIndex: 9999, // Ensure it's above everything
          },
          fabAnimatedStyle
        ]}
        onPress={() => {
          console.log('[ProbeLaunchFAB] FAB PRESSED - Button is working!');
          handleFABPress();
        }}
        onPressIn={() => {
          fabScale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
        }}
        onPressOut={() => {
          fabScale.value = withSpring(1, { damping: 15, stiffness: 300 });
        }}
        activeOpacity={0.8}
        accessibilityLabel="Launch Probe"
        accessibilityHint="Tap to expand probe launch menu"
        accessibilityRole="button"
      >
        <Text style={{ fontSize: 28, color: '#FFFFFF' }}>
          {isExpanded ? '✕' : '🚀'}
        </Text>
      </AnimatedTouchableOpacity>
    </View>
  );
};