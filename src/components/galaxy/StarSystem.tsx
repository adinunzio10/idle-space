import React, { useMemo } from 'react';
import { Circle, G, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { StarSystem, StarSystemRenderInfo, ViewportState } from '../../types/galaxy';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface StarSystemComponentProps {
  starSystem: StarSystem;
  renderInfo: StarSystemRenderInfo;
  viewportState: ViewportState;
  onPress?: (starSystem: StarSystem) => void;
}

// Star system visual configuration based on state
const STAR_SYSTEM_COLORS = {
  healthy: '#E5E7EB', // Dim white
  dying: ['#F59E0B', '#EF4444'], // Orange to red gradient
  dead: '#374151', // Dark gray
} as const;

const ANIMATION_CONFIG = {
  dying: {
    duration: 2000,
    easing: Easing.inOut(Easing.sin),
  },
  dead: {
    duration: 0, // No animation
  },
  healthy: {
    duration: 4000, // Very slow pulse
    easing: Easing.inOut(Easing.ease),
  },
} as const;

export const StarSystemComponent: React.FC<StarSystemComponentProps> = ({
  starSystem,
  renderInfo,
  viewportState,
  onPress,
}) => {
  // Don't render if not visible or below LOD threshold
  if (!renderInfo.shouldRender || renderInfo.opacity <= 0) {
    return null;
  }

  // Calculate screen position based on viewport
  const screenPosition = useMemo(() => {
    const screenPos = {
      x: starSystem.position.x * viewportState.scale + viewportState.translateX,
      y: starSystem.position.y * viewportState.scale + viewportState.translateY,
    };
    
    // DEBUG: Track coordinate transformation during panning
    console.log(`[DEBUG:StarSystem] ${starSystem.id} - worldPos(${starSystem.position.x.toFixed(1)}, ${starSystem.position.y.toFixed(1)}) | viewport(scale:${viewportState.scale.toFixed(2)}, translate:${viewportState.translateX.toFixed(1)},${viewportState.translateY.toFixed(1)}) | screenPos(${screenPos.x.toFixed(1)}, ${screenPos.y.toFixed(1)}) - ${Date.now()}`);
    
    return screenPos;
  }, [starSystem.position, viewportState, starSystem.id]);

  // Calculate effective radius based on zoom and LOD
  const effectiveRadius = useMemo(() => {
    const baseRadius = starSystem.radius * renderInfo.screenSize * 0.01;
    return Math.max(1, Math.min(20, baseRadius)); // Clamp between 1-20px
  }, [starSystem.radius, renderInfo.screenSize]);

  // Animation values for pulsing effect
  const pulseOpacity = useSharedValue(1);
  const pulseScale = useSharedValue(1);

  // Initialize animations based on star system state
  React.useEffect(() => {
    if (!renderInfo.showAnimation) {
      pulseOpacity.value = 1;
      pulseScale.value = 1;
      return;
    }

    switch (starSystem.state) {
      case 'dying':
        // Intense pulsing for dying stars
        pulseOpacity.value = withRepeat(
          withTiming(0.3, ANIMATION_CONFIG.dying),
          -1,
          true
        );
        pulseScale.value = withRepeat(
          withTiming(1.3, ANIMATION_CONFIG.dying),
          -1,
          true
        );
        break;
      
      case 'healthy':
        // Gentle pulsing for healthy stars
        pulseOpacity.value = withRepeat(
          withTiming(0.7, ANIMATION_CONFIG.healthy),
          -1,
          true
        );
        pulseScale.value = withRepeat(
          withTiming(1.1, ANIMATION_CONFIG.healthy),
          -1,
          true
        );
        break;
      
      case 'dead':
      default:
        // No animation for dead stars
        pulseOpacity.value = 1;
        pulseScale.value = 1;
        break;
    }
  }, [starSystem.state, renderInfo.showAnimation, pulseOpacity, pulseScale]);

  // Animated props for the main star circle
  const animatedMainProps = useAnimatedProps(() => ({
    opacity: renderInfo.showAnimation ? pulseOpacity.value * renderInfo.opacity : renderInfo.opacity,
    r: effectiveRadius * (renderInfo.showAnimation ? pulseScale.value : 1),
  }));

  // Animated props for the glow effect (always defined to avoid conditional hooks)
  const animatedGlowProps = useAnimatedProps(() => ({
    opacity: pulseOpacity.value * 0.1,
    r: effectiveRadius * 2 * pulseScale.value,
  }));

  // Get colors for the current state
  const getStarSystemColors = () => {
    switch (starSystem.state) {
      case 'healthy':
        return {
          primary: STAR_SYSTEM_COLORS.healthy,
          secondary: STAR_SYSTEM_COLORS.healthy,
        };
      case 'dying':
        return {
          primary: STAR_SYSTEM_COLORS.dying[0], // Orange
          secondary: STAR_SYSTEM_COLORS.dying[1], // Red
        };
      case 'dead':
        return {
          primary: STAR_SYSTEM_COLORS.dead,
          secondary: STAR_SYSTEM_COLORS.dead,
        };
      default:
        return {
          primary: STAR_SYSTEM_COLORS.healthy,
          secondary: STAR_SYSTEM_COLORS.healthy,
        };
    }
  };

  const colors = getStarSystemColors();
  const gradientId = useMemo(() => 
    `starSystem_${starSystem.id}_${starSystem.state}_${viewportState.scale.toFixed(2)}_${viewportState.translateX.toFixed(0)}_${viewportState.translateY.toFixed(0)}`
  , [starSystem.id, starSystem.state, viewportState.scale, viewportState.translateX, viewportState.translateY]);

  // Handle press events
  const handlePress = () => {
    if (onPress) {
      onPress(starSystem);
    }
  };

  // For high LOD, render with gradient and effects
  if (renderInfo.lodLevel >= 2) {
    return (
      <G>
        <Defs>
          <RadialGradient
            id={gradientId}
            cx={screenPosition.x}
            cy={screenPosition.y}
            r={effectiveRadius}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0%" stopColor={colors.primary} stopOpacity={starSystem.brightness} />
            <Stop offset="70%" stopColor={colors.secondary} stopOpacity={starSystem.brightness * 0.6} />
            <Stop offset="100%" stopColor={colors.secondary} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        
        {/* Outer glow effect for dying stars */}
        {starSystem.state === 'dying' && renderInfo.showAnimation && (
          <AnimatedCircle
            cx={screenPosition.x}
            cy={screenPosition.y}
            r={effectiveRadius * 2}
            fill={colors.secondary}
            opacity={0.1}
            animatedProps={animatedGlowProps}
          />
        )}
        
        {/* Main star system circle */}
        <AnimatedCircle
          cx={screenPosition.x}
          cy={screenPosition.y}
          fill={starSystem.state === 'dying' ? `url(#${gradientId})` : colors.primary}
          animatedProps={animatedMainProps}
          onPress={handlePress}
        />
        
        {/* Inner core for dying stars */}
        {starSystem.state === 'dying' && (
          <Circle
            cx={screenPosition.x}
            cy={screenPosition.y}
            r={effectiveRadius * 0.3}
            fill={colors.secondary}
            opacity={starSystem.brightness}
          />
        )}
      </G>
    );
  }
  
  // For lower LOD, render simple circle
  return (
    <AnimatedCircle
      cx={screenPosition.x}
      cy={screenPosition.y}
      fill={colors.primary}
      animatedProps={animatedMainProps}
      onPress={handlePress}
    />
  );
};

export default StarSystemComponent;