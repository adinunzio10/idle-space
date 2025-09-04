/**
 * SectorStateRenderer - Visual State Treatment for Galactic Sectors
 * 
 * Renders distinct visual treatments for sector states (healthy/dying/dead) with
 * animations, tinting, and special effects. Integrates with SectorOverlayManager
 * for coordinated state visualization across the galaxy map.
 */

import React, { useMemo, useEffect } from 'react';
import { Path, G, Defs, RadialGradient, Stop, Circle, Rect } from 'react-native-svg';
import Animated, { 
  useAnimatedProps, 
  useSharedValue, 
  withSpring, 
  withTiming,
  withRepeat,
  interpolate,
  Extrapolate,
  useFrameCallback,
} from 'react-native-reanimated';
import { GalacticSector, ViewportState } from '../../types/galaxy';
import { SectorStateInfo } from '../../utils/galaxy/SectorOverlayManager';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

interface SectorStateRendererProps {
  sector: GalacticSector;
  stateInfo: SectorStateInfo;
  viewportState: ViewportState;
  enableAnimations?: boolean;
  performanceMode?: boolean;
  lodLevel?: number;
}

interface MultipleSectorStateRendererProps {
  sectorStates: Map<string, SectorStateInfo>;
  viewportState: ViewportState;
  enableAnimations?: boolean;
  performanceMode?: boolean;
  maxRenderedStates?: number;
}

// Visual configuration for sector state rendering
const STATE_CONFIG = {
  healthy: {
    color: '#3B82F6', // Subtle blue tint
    opacity: 0.1,
    pulseIntensity: 0,
    particleCount: 0,
    glowRadius: 0,
  },
  dying: {
    color: '#F59E0B', // Orange/amber
    highEntropyColor: '#EF4444', // Red for high entropy dying sectors
    opacity: 0.2,
    pulseIntensity: 0.6,
    particleCount: 8,
    glowRadius: 15,
    pulseSpeed: 2000, // 2 second pulse cycle
  },
  dead: {
    color: '#1F2937', // Dark purple/black
    opacity: 0.3,
    pulseIntensity: 0,
    particleCount: 15,
    glowRadius: 0,
    staticEffectIntensity: 0.4,
    staticEffectSpeed: 150, // Fast static effect
  },
  // Animation settings
  animations: {
    transitionDuration: 800,
    pulseDuration: 2000,
    staticDuration: 150,
    particleDuration: 3000,
  },
} as const;

/**
 * Generate SVG path for sector polygon
 */
function generateSectorStatePath(sector: GalacticSector, viewportState: ViewportState): string {
  if (!sector.vertices || sector.vertices.length < 3) return '';
  
  const screenVertices = sector.vertices.map(vertex => ({
    x: vertex.x * viewportState.scale + viewportState.translateX,
    y: vertex.y * viewportState.scale + viewportState.translateY,
  }));
  
  let path = `M ${screenVertices[0].x} ${screenVertices[0].y}`;
  for (let i = 1; i < screenVertices.length; i++) {
    path += ` L ${screenVertices[i].x} ${screenVertices[i].y}`;
  }
  path += ' Z';
  
  return path;
}

/**
 * Get color for dying sector based on entropy
 */
function getDyingSectorColor(entropy: number): string {
  if (entropy > 0.5) {
    // Interpolate from orange to red
    const ratio = (entropy - 0.5) / 0.5;
    const r = Math.floor(239 + (239 - 239) * ratio);
    const g = Math.floor(158 - (158 - 68) * ratio);
    const b = Math.floor(11 + (68 - 11) * ratio);
    return `rgb(${r}, ${g}, ${b})`;
  }
  return STATE_CONFIG.dying.color;
}

/**
 * Pulsing Effect Component for dying sectors
 */
const PulsingEffect: React.FC<{
  sector: GalacticSector;
  viewportState: ViewportState;
  color: string;
  intensity: number;
  enabled: boolean;
}> = ({ sector, viewportState, color, intensity, enabled }) => {
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(intensity);

  useEffect(() => {
    if (enabled && intensity > 0) {
      // Start pulsing animation
      pulseScale.value = withRepeat(
        withTiming(1.1, { duration: STATE_CONFIG.animations.pulseDuration }),
        -1,
        true
      );
      
      pulseOpacity.value = withRepeat(
        withTiming(intensity * 0.3, { duration: STATE_CONFIG.animations.pulseDuration }),
        -1,
        true
      );
    } else {
      pulseScale.value = 1;
      pulseOpacity.value = 0;
    }
  }, [enabled, intensity, pulseScale, pulseOpacity]);

  const sectorPath = useMemo(() => 
    generateSectorStatePath(sector, viewportState), 
    [sector, viewportState]
  );

  const animatedProps = useAnimatedProps(() => ({
    opacity: pulseOpacity.value,
    transform: `scale(${pulseScale.value})`,
  }));

  if (!enabled || intensity <= 0) return null;

  return (
    <AnimatedPath
      d={sectorPath}
      fill={color}
      stroke="none"
      animatedProps={animatedProps}
    />
  );
};

/**
 * Static Effect Component for dead sectors
 */
const StaticEffect: React.FC<{
  sector: GalacticSector;
  viewportState: ViewportState;
  intensity: number;
  enabled: boolean;
}> = ({ sector, viewportState, intensity, enabled }) => {
  const staticOpacity = useSharedValue(0);
  const noiseOffset = useSharedValue(0);

  useEffect(() => {
    if (enabled && intensity > 0) {
      // Animate static effect
      staticOpacity.value = withRepeat(
        withTiming(intensity, { duration: STATE_CONFIG.animations.staticDuration }),
        -1,
        false
      );
      
      // Animate noise pattern offset
      noiseOffset.value = withRepeat(
        withTiming(1, { duration: STATE_CONFIG.animations.staticDuration * 3 }),
        -1,
        false
      );
    } else {
      staticOpacity.value = 0;
      noiseOffset.value = 0;
    }
  }, [enabled, intensity, staticOpacity, noiseOffset]);

  const centerPoint = useMemo(() => ({
    x: sector.center.x * viewportState.scale + viewportState.translateX,
    y: sector.center.y * viewportState.scale + viewportState.translateY,
  }), [sector.center, viewportState]);

  const animatedProps = useAnimatedProps(() => ({
    opacity: staticOpacity.value,
  }));

  if (!enabled || intensity <= 0) return null;

  // Create static effect with small rectangles
  const staticElements = [];
  const elementCount = Math.floor(intensity * 20);
  
  for (let i = 0; i < elementCount; i++) {
    const angle = (i / elementCount) * Math.PI * 2;
    const radius = 30 + Math.random() * 40;
    const x = centerPoint.x + Math.cos(angle) * radius;
    const y = centerPoint.y + Math.sin(angle) * radius;
    const size = 1 + Math.random() * 2;
    
    staticElements.push(
      <AnimatedRect
        key={`static_${i}`}
        x={x - size / 2}
        y={y - size / 2}
        width={size}
        height={size}
        fill="#9CA3AF"
        animatedProps={animatedProps}
      />
    );
  }

  return <G>{staticElements}</G>;
};

/**
 * Main Sector State Renderer Component
 */
export const SectorStateRendererComponent: React.FC<SectorStateRendererProps> = ({
  sector,
  stateInfo,
  viewportState,
  enableAnimations = true,
  performanceMode = false,
  lodLevel = 3,
}) => {
  const { state, visualTreatment } = stateInfo;
  
  // Animated values for smooth state transitions
  const fillOpacity = useSharedValue(visualTreatment.opacity);
  const fillColor = useSharedValue(visualTreatment.color);

  useEffect(() => {
    if (enableAnimations && !performanceMode) {
      fillOpacity.value = withSpring(visualTreatment.opacity, {
        damping: 20,
        stiffness: 200,
      });
    } else {
      fillOpacity.value = visualTreatment.opacity;
    }
  }, [visualTreatment.opacity, enableAnimations, performanceMode, fillOpacity]);

  // Generate sector path - DEBUGGING: Remove memoization to see if sector data is changing
  const sectorPath = generateSectorStatePath(sector, viewportState);
  
  // DEBUG: Component not rendering - issue is elsewhere

  // Calculate effective color based on state and entropy
  const effectiveColor = useMemo(() => {
    if (state === 'dying') {
      return getDyingSectorColor(sector.entropy);
    }
    return visualTreatment.color;
  }, [state, sector.entropy, visualTreatment.color]);

  // Gradient ID for this sector
  const gradientId = `sector_state_gradient_${sector.id}`;

  // Main fill animated props
  const mainFillProps = useAnimatedProps(() => ({
    opacity: fillOpacity.value,
  }));

  // Don't render if opacity is too low or sector has no vertices
  if (visualTreatment.opacity < 0.01 || !sector.vertices || sector.vertices.length < 3) {
    return null;
  }

  // DISABLED: Viewport culling to test if this is causing disappearing elements
  // const viewportBounds = {
  //   minX: -viewportState.translateX / viewportState.scale - 800,
  //   maxX: (-viewportState.translateX + 800) / viewportState.scale + 800,
  //   minY: -viewportState.translateY / viewportState.scale - 600,
  //   maxY: (-viewportState.translateY + 600) / viewportState.scale + 600,
  // };
  // if (sector.center.x < viewportBounds.minX || 
  //     sector.center.x > viewportBounds.maxX ||
  //     sector.center.y < viewportBounds.minY || 
  //     sector.center.y > viewportBounds.maxY) {
  //   return null;
  // }

  // DISABLED: Performance mode to test if LOD is causing issues
  // if (performanceMode || lodLevel < 2) {
  //   return (
  //     <AnimatedPath
  //       d={sectorPath}
  //       fill={effectiveColor}
  //       stroke="none"
  //       animatedProps={mainFillProps}
  //     />
  //   );
  // }

  return (
    <G>
      {/* Gradient definition for enhanced visual treatment */}
      <Defs>
        <RadialGradient
          id={gradientId}
          cx="50%"
          cy="50%"
          r="60%"
        >
          <Stop
            offset="0%"
            stopColor={effectiveColor}
            stopOpacity={visualTreatment.opacity * 1.2}
          />
          <Stop
            offset="70%"
            stopColor={effectiveColor}
            stopOpacity={visualTreatment.opacity}
          />
          <Stop
            offset="100%"
            stopColor={effectiveColor}
            stopOpacity={visualTreatment.opacity * 0.3}
          />
        </RadialGradient>
      </Defs>

      {/* Main sector state fill - temporarily simplified to debug panning issues */}
      <AnimatedPath
        d={sectorPath}
        fill={effectiveColor}
        stroke="none"
        animatedProps={mainFillProps}
      />

      {/* Pulsing effect for dying sectors */}
      {state === 'dying' && enableAnimations && (
        <PulsingEffect
          sector={sector}
          viewportState={viewportState}
          color={effectiveColor}
          intensity={STATE_CONFIG.dying.pulseIntensity}
          enabled={visualTreatment.hasAnimation}
        />
      )}

      {/* Static effect for dead sectors */}
      {state === 'dead' && enableAnimations && (
        <StaticEffect
          sector={sector}
          viewportState={viewportState}
          intensity={STATE_CONFIG.dead.staticEffectIntensity}
          enabled={visualTreatment.hasAnimation}
        />
      )}
    </G>
  );
};

/**
 * Multiple Sector State Renderer for performance optimization
 */
export const MultipleSectorStateRenderer: React.FC<MultipleSectorStateRendererProps> = ({
  sectorStates,
  viewportState,
  enableAnimations = true,
  performanceMode = false,
  maxRenderedStates = 25, // Reduced for better panning performance
}) => {
  // Convert map to array and sort by priority
  const prioritizedStates = useMemo(() => {
    const states = Array.from(sectorStates.entries());
    
    return states
      .sort(([, a], [, b]) => {
        // Priority: dying > dead > healthy
        const statePriority = { dying: 3, dead: 2, healthy: 1 };
        const priorityDiff = statePriority[b.state] - statePriority[a.state];
        
        if (priorityDiff !== 0) return priorityDiff;
        
        // Secondary sort by entropy (higher = more interesting)
        return b.sector.entropy - a.sector.entropy;
      })
      .slice(0, maxRenderedStates);
  }, [sectorStates, maxRenderedStates]);

  // Calculate LOD level based on zoom and performance
  const lodLevel = useMemo(() => {
    if (performanceMode) return 1;
    
    const scale = viewportState.scale;
    if (scale < 0.5) return 0;
    if (scale < 1.0) return 1;
    if (scale < 2.0) return 2;
    return 3;
  }, [viewportState.scale, performanceMode]);

  return (
    <G>
      {prioritizedStates.map(([sectorId, stateInfo]) => (
        <SectorStateRendererComponent
          key={sectorId}
          sector={stateInfo.sector}
          stateInfo={stateInfo}
          viewportState={viewportState}
          enableAnimations={enableAnimations}
          performanceMode={performanceMode}
          lodLevel={lodLevel}
        />
      ))}
    </G>
  );
};

/**
 * Utility function to analyze sector state distribution
 */
export function analyzeSectorStateDistribution(sectorStates: Map<string, SectorStateInfo>): {
  healthyCount: number;
  dyingCount: number;
  deadCount: number;
  totalSectors: number;
  averageEntropy: number;
  statePercentages: {
    healthy: number;
    dying: number;
    dead: number;
  };
} {
  const states = Array.from(sectorStates.values());
  
  const healthyCount = states.filter(s => s.state === 'healthy').length;
  const dyingCount = states.filter(s => s.state === 'dying').length;
  const deadCount = states.filter(s => s.state === 'dead').length;
  const totalSectors = states.length;
  
  const totalEntropy = states.reduce((sum, s) => sum + s.sector.entropy, 0);
  const averageEntropy = totalSectors > 0 ? totalEntropy / totalSectors : 0;
  
  const statePercentages = {
    healthy: totalSectors > 0 ? (healthyCount / totalSectors) * 100 : 0,
    dying: totalSectors > 0 ? (dyingCount / totalSectors) * 100 : 0,
    dead: totalSectors > 0 ? (deadCount / totalSectors) * 100 : 0,
  };

  return {
    healthyCount,
    dyingCount,
    deadCount,
    totalSectors,
    averageEntropy,
    statePercentages,
  };
}

/**
 * Get sector state color for UI components
 */
export function getSectorStateColor(state: 'healthy' | 'dying' | 'dead', entropy: number = 0.5): string {
  switch (state) {
    case 'healthy':
      return STATE_CONFIG.healthy.color;
    case 'dying':
      return getDyingSectorColor(entropy);
    case 'dead':
      return STATE_CONFIG.dead.color;
    default:
      return '#6B7280'; // Neutral gray
  }
}

export default SectorStateRendererComponent;