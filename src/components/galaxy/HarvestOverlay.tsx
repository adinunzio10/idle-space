/**
 * HarvestOverlay Component - Resource Collection Interface
 * 
 * Provides visual overlay for resource collection from dying and dead star systems.
 * Highlights harvestable resources when players zoom beyond 0.5x and enables
 * touch interactions for resource collection.
 */

import React, { useMemo } from 'react';
import { Circle, G, Text, Rect } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, withRepeat, withTiming } from 'react-native-reanimated';
import { StarSystem, ViewportState } from '../../types/galaxy';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

interface HarvestOverlayProps {
  starSystem: StarSystem;
  viewportState: ViewportState;
  isActive: boolean; // Whether harvest overlay should be visible
  onHarvest?: (starSystem: StarSystem, resourceType: 'stellarEssence' | 'voidFragments') => void;
}

interface ResourceIndicatorProps {
  position: { x: number; y: number };
  resourceType: 'stellarEssence' | 'voidFragments';
  amount: number;
  isHighlighted: boolean;
  onPress?: () => void;
}

// Visual configuration for harvest overlay
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
  },
  animations: {
    pulse: {
      scale: { from: 1, to: 1.3 },
      opacity: { from: 0.6, to: 0.2 },
    },
  },
} as const;

/**
 * Resource indicator showing type and amount of harvestable resources
 */
const ResourceIndicator: React.FC<ResourceIndicatorProps> = ({
  position,
  resourceType,
  amount,
  isHighlighted,
  onPress,
}) => {
  const config = HARVEST_CONFIG.resourceIndicatorSize;
  const color = HARVEST_CONFIG.colors[resourceType];
  
  // Center the indicator on the position
  const indicatorX = position.x - config.width / 2;
  const indicatorY = position.y - config.height / 2 - 30; // Offset above the star

  return (
    <G onPress={onPress}>
      {/* Background */}
      <Rect
        x={indicatorX}
        y={indicatorY}
        width={config.width}
        height={config.height}
        rx={4}
        fill={HARVEST_CONFIG.colors.background}
        stroke={isHighlighted ? HARVEST_CONFIG.colors.highlight : color}
        strokeWidth={isHighlighted ? 2 : 1}
        opacity={0.9}
      />
      
      {/* Resource text */}
      <Text
        x={position.x}
        y={indicatorY + 14}
        fill={color}
        fontSize={10}
        fontWeight="bold"
        textAnchor="middle"
      >
        {amount}
      </Text>
    </G>
  );
};

export const HarvestOverlayComponent: React.FC<HarvestOverlayProps> = ({
  starSystem,
  viewportState,
  isActive,
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
  const screenPosition = useMemo(() => ({
    x: starSystem.position.x * viewportState.scale + viewportState.translateX,
    y: starSystem.position.y * viewportState.scale + viewportState.translateY,
  }), [starSystem.position, viewportState]);

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

  return (
    <G>
      {/* Pulsing highlight circle */}
      <AnimatedCircle
        cx={screenPosition.x}
        cy={screenPosition.y}
        fill="none"
        stroke={HARVEST_CONFIG.colors.highlight}
        strokeWidth={2}
        animatedProps={animatedHighlightProps}
      />

      {/* Stellar Essence indicator for dying stars */}
      {starSystem.state === 'dying' && starSystem.resources?.stellarEssence && (
        <ResourceIndicator
          position={screenPosition}
          resourceType="stellarEssence"
          amount={starSystem.resources.stellarEssence}
          isHighlighted={true}
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
  onHarvest?: (starSystem: StarSystem, resourceType: 'stellarEssence' | 'voidFragments') => void;
}

export const MultipleHarvestOverlay: React.FC<MultipleHarvestOverlayProps> = ({
  starSystems,
  viewportState,
  isOverlayActive,
  maxOverlays = 20, // Performance limit
  onHarvest,
}) => {
  // Filter and prioritize harvestable star systems
  const harvestableStars = useMemo(() => {
    if (!isOverlayActive || viewportState.scale < HARVEST_CONFIG.minZoomForOverlay) {
      return [];
    }

    // Filter for stars with resources in the viewport
    const viewportBounds = {
      minX: -viewportState.translateX / viewportState.scale,
      maxX: (-viewportState.translateX + 800) / viewportState.scale, // Assuming 800px width
      minY: -viewportState.translateY / viewportState.scale,
      maxY: (-viewportState.translateY + 600) / viewportState.scale, // Assuming 600px height
    };

    return starSystems
      .filter(star => {
        // Must have resources
        if (!star.resources) return false;
        
        // Must be dying or dead
        if (star.state === 'healthy') return false;
        
        // Must be in viewport
        return star.position.x >= viewportBounds.minX &&
               star.position.x <= viewportBounds.maxX &&
               star.position.y >= viewportBounds.minY &&
               star.position.y <= viewportBounds.maxY;
      })
      .sort((a, b) => {
        // Prioritize by resource amount (higher = better)
        const resourcesA = (a.resources?.stellarEssence || 0) + (a.resources?.voidFragments || 0);
        const resourcesB = (b.resources?.stellarEssence || 0) + (b.resources?.voidFragments || 0);
        return resourcesB - resourcesA;
      })
      .slice(0, maxOverlays);
  }, [starSystems, viewportState, isOverlayActive, maxOverlays]);

  return (
    <G>
      {harvestableStars.map(starSystem => (
        <HarvestOverlayComponent
          key={starSystem.id}
          starSystem={starSystem}
          viewportState={viewportState}
          isActive={true}
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