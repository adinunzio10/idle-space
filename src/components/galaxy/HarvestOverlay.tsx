/**
 * HarvestOverlay Component - Enhanced Resource Collection Interface with Highlighting
 * 
 * Advanced visual overlay for resource collection with glowing halos, void fragment icons,
 * enhanced highlighting system, and integration with SectorOverlayManager. Features
 * dynamic resource indicators, smart prioritization, and smooth animations.
 */

import React, { useMemo, useEffect } from 'react';
import { Circle, G, Text, Rect, Path, Polygon, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated, { 
  useSharedValue, 
  useAnimatedProps, 
  withRepeat, 
  withTiming,
  withSpring,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { StarSystem, ViewportState } from '../../types/galaxy';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);

interface HarvestOverlayProps {
  starSystem: StarSystem;
  viewportState: ViewportState;
  isActive: boolean; // Whether harvest overlay should be visible
  priority?: number; // Rendering priority (0-1)
  enableGlowEffects?: boolean;
  enableAnimations?: boolean;
  performanceMode?: boolean;
  onHarvest?: (starSystem: StarSystem, resourceType: 'stellarEssence' | 'voidFragments') => void;
}

interface ResourceIndicatorProps {
  position: { x: number; y: number };
  resourceType: 'stellarEssence' | 'voidFragments';
  amount: number;
  isHighlighted: boolean;
  priority: number;
  enableGlowEffects: boolean;
  enableAnimations: boolean;
  starSystemState: 'healthy' | 'dying' | 'dead';
  onPress?: () => void;
}

interface GlowingHaloProps {
  position: { x: number; y: number };
  radius: number;
  color: string;
  intensity: number;
  enableAnimation: boolean;
}

interface VoidFragmentIconProps {
  position: { x: number; y: number };
  size: number;
  opacity: number;
  enableAnimation: boolean;
}

// Enhanced visual configuration for harvest overlay with glow effects
const HARVEST_CONFIG = {
  minZoomForOverlay: 0.5,
  highlightRadius: 25,
  pulseAnimationDuration: 1500,
  resourceIndicatorSize: { width: 60, height: 20 },
  colors: {
    stellarEssence: '#F59E0B', // Orange/amber for stellar essence
    voidFragments: '#8B5CF6',  // Purple for void fragments
    highlight: '#10B981',      // Green for harvestable indication
    background: 'rgba(0, 0, 0, 0.7)', // Dark background for text
    // Glow effects
    dyingStarGlow: '#FCD34D',  // Warm yellow glow for dying stars
    deadStarGlow: '#A78BFA',   // Purple glow for dead stars
    // High priority indicators
    highPriorityRing: '#EF4444', // Red ring for high priority resources
    criticalIndicator: '#DC2626', // Dark red for critical resources
  },
  // Glow effect settings
  glow: {
    baseRadius: 30,
    maxRadius: 50,
    intensity: { low: 0.3, medium: 0.6, high: 1.0 },
    pulseSpeed: 2000, // milliseconds for full pulse cycle
    layers: 3, // Number of glow layers for depth
  },
  // Enhanced animations
  animations: {
    pulse: {
      scale: { from: 1, to: 1.3 },
      opacity: { from: 0.6, to: 0.2 },
    },
    glow: {
      radius: { from: 0.8, to: 1.2 },
      opacity: { from: 0.4, to: 0.8 },
    },
    voidFragment: {
      rotation: { speed: 3000 }, // milliseconds per rotation
      scale: { from: 0.9, to: 1.1 },
    },
    priority: {
      ring: { from: 1, to: 1.5 },
      duration: 1000,
    },
  },
  // Resource priority thresholds
  priority: {
    low: 0.3,     // 30% priority and below
    medium: 0.7,  // 70% priority and below
    high: 1.0,    // Above 70% priority
  },
  // Performance settings
  performance: {
    maxGlowLayers: { low: 1, medium: 2, high: 3 },
    animationQuality: { low: 0.5, medium: 0.8, high: 1.0 },
  },
} as const;

/**
 * Glowing Halo Component for dying stars
 */
const GlowingHalo: React.FC<GlowingHaloProps> = ({
  position,
  radius,
  color,
  intensity,
  enableAnimation,
}) => {
  const glowRadius = useSharedValue(radius);
  const glowOpacity = useSharedValue(intensity);

  useEffect(() => {
    if (enableAnimation) {
      glowRadius.value = withRepeat(
        withTiming(radius * HARVEST_CONFIG.animations.glow.radius.to, {
          duration: HARVEST_CONFIG.glow.pulseSpeed,
        }),
        -1,
        true
      );
      
      glowOpacity.value = withRepeat(
        withTiming(intensity * HARVEST_CONFIG.animations.glow.opacity.to, {
          duration: HARVEST_CONFIG.glow.pulseSpeed,
        }),
        -1,
        true
      );
    } else {
      glowRadius.value = radius;
      glowOpacity.value = intensity;
    }
  }, [enableAnimation, radius, intensity, glowRadius, glowOpacity]);

  const gradientId = useMemo(() => 
    `glow_${position.x.toFixed(1)}_${position.y.toFixed(1)}_${radius.toFixed(1)}`
  , [position.x, position.y, radius]);

  const animatedProps = useAnimatedProps(() => ({
    r: glowRadius.value,
    opacity: glowOpacity.value,
  }));

  return (
    <G>
      <Defs>
        <RadialGradient 
          id={gradientId} 
          cx={position.x} 
          cy={position.y} 
          r={radius}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0%" stopColor={color} stopOpacity={intensity} />
          <Stop offset="50%" stopColor={color} stopOpacity={intensity * 0.5} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      
      <AnimatedCircle
        cx={position.x}
        cy={position.y}
        fill={`url(#${gradientId})`}
        animatedProps={animatedProps}
      />
    </G>
  );
};

/**
 * Void Fragment Icon for dead star systems
 */
const VoidFragmentIcon: React.FC<VoidFragmentIconProps> = ({
  position,
  size,
  opacity,
  enableAnimation,
}) => {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (enableAnimation) {
      rotation.value = withRepeat(
        withTiming(360, { duration: HARVEST_CONFIG.animations.voidFragment.rotation.speed }),
        -1,
        false
      );
      
      scale.value = withRepeat(
        withTiming(HARVEST_CONFIG.animations.voidFragment.scale.to, {
          duration: HARVEST_CONFIG.glow.pulseSpeed,
        }),
        -1,
        true
      );
    } else {
      rotation.value = 0;
      scale.value = 1;
    }
  }, [enableAnimation, rotation, scale]);

  // Generate void fragment shape (hexagonal crystal)
  const points = useMemo(() => {
    const hexPoints: string[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const x = position.x + (size / 2) * Math.cos(angle);
      const y = position.y + (size / 2) * Math.sin(angle);
      hexPoints.push(`${x},${y}`);
    }
    return hexPoints.join(' ');
  }, [position, size]);

  const animatedProps = useAnimatedProps(() => ({
    opacity: opacity,
    transform: `rotate(${rotation.value}deg) scale(${scale.value})`,
  }));

  return (
    <AnimatedPolygon
      points={points}
      fill={HARVEST_CONFIG.colors.voidFragments}
      stroke={HARVEST_CONFIG.colors.deadStarGlow}
      strokeWidth={1}
      animatedProps={animatedProps}
    />
  );
};

/**
 * Enhanced Resource indicator with priority and glow effects
 */
const ResourceIndicator: React.FC<ResourceIndicatorProps> = ({
  position,
  resourceType,
  amount,
  isHighlighted,
  priority,
  enableGlowEffects,
  enableAnimations,
  starSystemState,
  onPress,
}) => {
  const config = HARVEST_CONFIG.resourceIndicatorSize;
  const color = HARVEST_CONFIG.colors[resourceType];
  
  // Priority-based styling
  const priorityLevel = priority > HARVEST_CONFIG.priority.medium ? 'high' 
                      : priority > HARVEST_CONFIG.priority.low ? 'medium' 
                      : 'low';
  
  const priorityColor = priorityLevel === 'high' ? HARVEST_CONFIG.colors.highPriorityRing
                      : priorityLevel === 'medium' ? HARVEST_CONFIG.colors.highlight
                      : color;
  
  // Animation values
  const priorityRingScale = useSharedValue(1);
  const backgroundOpacity = useSharedValue(0.9);
  
  useEffect(() => {
    if (enableAnimations && priorityLevel === 'high') {
      priorityRingScale.value = withRepeat(
        withTiming(HARVEST_CONFIG.animations.priority.ring.to, {
          duration: HARVEST_CONFIG.animations.priority.duration,
        }),
        -1,
        true
      );
    } else {
      priorityRingScale.value = 1;
    }
    
    backgroundOpacity.value = withSpring(isHighlighted ? 1.0 : 0.9);
  }, [enableAnimations, priorityLevel, isHighlighted, priorityRingScale, backgroundOpacity]);

  // Center the indicator on the position
  const indicatorX = position.x - config.width / 2;
  const indicatorY = position.y - config.height / 2 - 30; // Offset above the star

  const animatedBackgroundProps = useAnimatedProps(() => ({
    opacity: backgroundOpacity.value,
  }));

  const animatedRingProps = useAnimatedProps(() => ({
    transform: `scale(${priorityRingScale.value})`,
  }));

  return (
    <G onPress={onPress}>
      {/* Priority ring for high priority resources */}
      {priorityLevel === 'high' && enableAnimations && (
        <AnimatedCircle
          cx={position.x}
          cy={indicatorY + config.height / 2}
          r={config.width / 2 + 5}
          fill="none"
          stroke={HARVEST_CONFIG.colors.highPriorityRing}
          strokeWidth={2}
          opacity={0.6}
          animatedProps={animatedRingProps}
        />
      )}
      
      {/* Background with priority styling */}
      <AnimatedRect
        x={indicatorX}
        y={indicatorY}
        width={config.width}
        height={config.height}
        rx={4}
        fill={HARVEST_CONFIG.colors.background}
        stroke={priorityColor}
        strokeWidth={priorityLevel === 'high' ? 3 : isHighlighted ? 2 : 1}
        animatedProps={animatedBackgroundProps}
      />
      
      {/* Resource text with priority formatting */}
      <Text
        x={position.x}
        y={indicatorY + 14}
        fill={priorityColor}
        fontSize={priorityLevel === 'high' ? 11 : 10}
        fontWeight={priorityLevel === 'high' ? 'bold' : 'normal'}
        textAnchor="middle"
      >
        {priorityLevel === 'high' && '⚡'}{amount}
      </Text>
    </G>
  );
};

export const HarvestOverlayComponent: React.FC<HarvestOverlayProps> = ({
  starSystem,
  viewportState,
  isActive,
  priority = 0.5,
  enableGlowEffects = true,
  enableAnimations = true,
  performanceMode = false,
  onHarvest,
}) => {
  // Don't render if overlay is not active or star system has no resources
  if (!isActive || !starSystem.resources || viewportState.scale < HARVEST_CONFIG.minZoomForOverlay) {
    return null;
  }

  // Only show for dying (stellar essence) and dead (void fragments) stars
  if (starSystem.state === 'healthy') {
    return null;
  }

  // Calculate screen position
  const screenPosition = useMemo(() => {
    const screenPos = {
      x: starSystem.position.x * viewportState.scale + viewportState.translateX,
      y: starSystem.position.y * viewportState.scale + viewportState.translateY,
    };
    
    // DEBUG: Track harvest overlay coordinate transformation
    console.log(`[DEBUG:HarvestOverlay] ${starSystem.id} - worldPos(${starSystem.position.x.toFixed(1)}, ${starSystem.position.y.toFixed(1)}) | viewport(scale:${viewportState.scale.toFixed(2)}, translate:${viewportState.translateX.toFixed(1)},${viewportState.translateY.toFixed(1)}) | screenPos(${screenPos.x.toFixed(1)}, ${screenPos.y.toFixed(1)}) - ${Date.now()}`);
    
    return screenPos;
  }, [starSystem.position, viewportState, starSystem.id]);

  // Animation values for pulsing highlight
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.6);

  React.useEffect(() => {
    // Start pulsing animation when overlay becomes active
    pulseScale.value = withRepeat(
      withTiming(HARVEST_CONFIG.animations.pulse.scale.to, {
        duration: HARVEST_CONFIG.pulseAnimationDuration,
      }),
      -1,
      true
    );
    
    pulseOpacity.value = withRepeat(
      withTiming(HARVEST_CONFIG.animations.pulse.opacity.to, {
        duration: HARVEST_CONFIG.pulseAnimationDuration,
      }),
      -1,
      true
    );
  }, [pulseScale, pulseOpacity]);

  // Animated props for highlight circle
  const animatedHighlightProps = useAnimatedProps(() => ({
    r: HARVEST_CONFIG.highlightRadius * pulseScale.value,
    opacity: pulseOpacity.value,
  }));

  // Handle resource harvesting
  const handleHarvest = (resourceType: 'stellarEssence' | 'voidFragments') => {
    if (onHarvest && starSystem.resources?.[resourceType]) {
      onHarvest(starSystem, resourceType);
    }
  };

  // Calculate glow intensity based on priority and state
  const glowIntensity = useMemo(() => {
    const baseIntensity = starSystem.state === 'dying' 
      ? HARVEST_CONFIG.glow.intensity.medium
      : HARVEST_CONFIG.glow.intensity.high;
    
    return baseIntensity * priority;
  }, [starSystem.state, priority]);

  // Determine glow color
  const glowColor = starSystem.state === 'dying' 
    ? HARVEST_CONFIG.colors.dyingStarGlow
    : HARVEST_CONFIG.colors.deadStarGlow;

  return (
    <G>
      {/* Glowing halo effect */}
      {enableGlowEffects && !performanceMode && (
        <GlowingHalo
          position={screenPosition}
          radius={HARVEST_CONFIG.glow.baseRadius * Math.max(0.5, viewportState.scale)}
          color={glowColor}
          intensity={glowIntensity}
          enableAnimation={enableAnimations}
        />
      )}

      {/* Pulsing highlight circle */}
      <AnimatedCircle
        cx={screenPosition.x}
        cy={screenPosition.y}
        fill="none"
        stroke={HARVEST_CONFIG.colors.highlight}
        strokeWidth={2}
        animatedProps={animatedHighlightProps}
      />

      {/* Void Fragment icons for dead stars */}
      {starSystem.state === 'dead' && enableGlowEffects && (
        <VoidFragmentIcon
          position={{
            x: screenPosition.x + 20,
            y: screenPosition.y - 20,
          }}
          size={8 * Math.max(0.7, viewportState.scale)}
          opacity={0.8}
          enableAnimation={enableAnimations && !performanceMode}
        />
      )}

      {/* Stellar Essence indicator for dying stars */}
      {starSystem.state === 'dying' && starSystem.resources?.stellarEssence && (
        <ResourceIndicator
          position={screenPosition}
          resourceType="stellarEssence"
          amount={starSystem.resources.stellarEssence}
          isHighlighted={true}
          priority={priority}
          enableGlowEffects={enableGlowEffects}
          enableAnimations={enableAnimations && !performanceMode}
          starSystemState={starSystem.state}
          onPress={() => handleHarvest('stellarEssence')}
        />
      )}

      {/* Void Fragments indicator for dead stars */}
      {starSystem.state === 'dead' && starSystem.resources?.voidFragments && (
        <ResourceIndicator
          position={screenPosition}
          resourceType="voidFragments"
          amount={starSystem.resources.voidFragments}
          isHighlighted={true}
          priority={priority}
          enableGlowEffects={enableGlowEffects}
          enableAnimations={enableAnimations && !performanceMode}
          starSystemState={starSystem.state}
          onPress={() => handleHarvest('voidFragments')}
        />
      )}
    </G>
  );
};

/**
 * Multiple Harvest Overlays for efficient rendering
 */
interface MultipleHarvestOverlayProps {
  starSystems: StarSystem[];
  viewportState: ViewportState;
  isOverlayActive: boolean;
  maxOverlays?: number; // Performance limit
  enableGlowEffects?: boolean;
  enableAnimations?: boolean;
  performanceMode?: boolean;
  priorityWeighting?: 'resource' | 'proximity' | 'entropy'; // How to prioritize overlays
  onHarvest?: (starSystem: StarSystem, resourceType: 'stellarEssence' | 'voidFragments') => void;
}

export const MultipleHarvestOverlay: React.FC<MultipleHarvestOverlayProps> = ({
  starSystems,
  viewportState,
  isOverlayActive,
  maxOverlays = 20,
  enableGlowEffects = true,
  enableAnimations = true,
  performanceMode = false,
  priorityWeighting = 'resource',
  onHarvest,
}) => {
  // Filter and prioritize harvestable star systems with enhanced algorithm
  const harvestableStars = useMemo(() => {
    if (!isOverlayActive || viewportState.scale < HARVEST_CONFIG.minZoomForOverlay) {
      return [];
    }

    // Filter for stars with resources in the viewport
    const viewportBounds = {
      minX: -viewportState.translateX / viewportState.scale,
      maxX: (-viewportState.translateX + 800) / viewportState.scale,
      minY: -viewportState.translateY / viewportState.scale,
      maxY: (-viewportState.translateY + 600) / viewportState.scale,
    };

    const viewportCenter = {
      x: (viewportBounds.minX + viewportBounds.maxX) / 2,
      y: (viewportBounds.minY + viewportBounds.maxY) / 2,
    };

    return starSystems
      .filter(star => {
        // Must have resources
        if (!star.resources) return false;
        
        // Must be dying or dead
        if (star.state === 'healthy') return false;
        
        // Must be in viewport (with small buffer)
        const buffer = 50;
        return star.position.x >= viewportBounds.minX - buffer &&
               star.position.x <= viewportBounds.maxX + buffer &&
               star.position.y >= viewportBounds.minY - buffer &&
               star.position.y <= viewportBounds.maxY + buffer;
      })
      .map(star => {
        // Calculate priority based on weighting algorithm
        const resourceAmount = (star.resources?.stellarEssence || 0) + (star.resources?.voidFragments || 0);
        const distanceFromCenter = Math.hypot(
          star.position.x - viewportCenter.x,
          star.position.y - viewportCenter.y
        );
        const maxDistance = Math.hypot(
          viewportBounds.maxX - viewportBounds.minX,
          viewportBounds.maxY - viewportBounds.minY
        ) / 2;
        const proximityScore = 1 - Math.min(1, distanceFromCenter / maxDistance);
        const entropyScore = star.entropy || 0.5;

        let priority: number;
        switch (priorityWeighting) {
          case 'resource':
            priority = (resourceAmount / 20) * 0.6 + proximityScore * 0.3 + entropyScore * 0.1;
            break;
          case 'proximity':
            priority = proximityScore * 0.6 + (resourceAmount / 20) * 0.3 + entropyScore * 0.1;
            break;
          case 'entropy':
            priority = entropyScore * 0.6 + (resourceAmount / 20) * 0.2 + proximityScore * 0.2;
            break;
          default:
            priority = (resourceAmount / 20) * 0.5 + proximityScore * 0.3 + entropyScore * 0.2;
        }

        return { star, priority: Math.min(1, priority) };
      })
      .sort((a, b) => b.priority - a.priority)
      .slice(0, maxOverlays);
  }, [starSystems, viewportState, isOverlayActive, maxOverlays, priorityWeighting]);

  return (
    <G>
      {harvestableStars.map(({ star, priority }) => (
        <HarvestOverlayComponent
          key={star.id}
          starSystem={star}
          viewportState={viewportState}
          isActive={true}
          priority={priority}
          enableGlowEffects={enableGlowEffects && !performanceMode}
          enableAnimations={enableAnimations}
          performanceMode={performanceMode}
          onHarvest={onHarvest}
        />
      ))}
    </G>
  );
};

/**
 * Utility function to calculate total harvestable resources in viewport
 */
export function calculateHarvestableResources(
  starSystems: StarSystem[],
  viewportState: ViewportState
): {
  totalStellarEssence: number;
  totalVoidFragments: number;
  harvestableStarCount: number;
  dyingStarCount: number;
  deadStarCount: number;
} {
  const viewportBounds = {
    minX: -viewportState.translateX / viewportState.scale,
    maxX: (-viewportState.translateX + 800) / viewportState.scale,
    minY: -viewportState.translateY / viewportState.scale,
    maxY: (-viewportState.translateY + 600) / viewportState.scale,
  };

  let totalStellarEssence = 0;
  let totalVoidFragments = 0;
  let harvestableStarCount = 0;
  let dyingStarCount = 0;
  let deadStarCount = 0;

  starSystems.forEach(star => {
    // Check if star is in viewport
    const inViewport = star.position.x >= viewportBounds.minX &&
                      star.position.x <= viewportBounds.maxX &&
                      star.position.y >= viewportBounds.minY &&
                      star.position.y <= viewportBounds.maxY;

    if (!inViewport) return;

    if (star.state === 'dying') {
      dyingStarCount++;
      if (star.resources?.stellarEssence) {
        totalStellarEssence += star.resources.stellarEssence;
        harvestableStarCount++;
      }
    } else if (star.state === 'dead') {
      deadStarCount++;
      if (star.resources?.voidFragments) {
        totalVoidFragments += star.resources.voidFragments;
        harvestableStarCount++;
      }
    }
  });

  return {
    totalStellarEssence,
    totalVoidFragments,
    harvestableStarCount,
    dyingStarCount,
    deadStarCount,
  };
}

export default HarvestOverlayComponent;