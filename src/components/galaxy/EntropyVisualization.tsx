/**
 * EntropyVisualization Component - Sector Entropy Color Tinting System
 * 
 * Provides visual representation of entropy levels across galactic sectors
 * using background color tinting from blue (low entropy) to red (high entropy).
 * Integrates with SectorBoundary component for cohesive visual experience.
 */

import React, { useMemo } from 'react';
import { Path, G, Defs, LinearGradient, Stop, RadialGradient } from 'react-native-svg';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import { GalacticSector, ViewportState } from '../../types/galaxy';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface EntropyVisualizationProps {
  sector: GalacticSector;
  viewportState: ViewportState;
  isVisible: boolean;
  showIntensiveEffects?: boolean; // For high entropy sectors
}

interface MultiSectorEntropyProps {
  sectors: GalacticSector[];
  viewportState: ViewportState;
  entropyThreshold?: number; // Only show entropy above this level
  maxRenderCount?: number;
}

// Configuration for entropy visualization
const ENTROPY_CONFIG = {
  colors: {
    lowEntropy: '#3B82F6',    // Blue for low entropy (0.0-0.3)
    mediumEntropy: '#8B5CF6', // Purple for medium entropy (0.3-0.6)  
    highEntropy: '#EF4444',   // Red for high entropy (0.6-1.0)
    criticalEntropy: '#DC2626', // Dark red for critical entropy (0.9+)
  },
  opacity: {
    base: 0.15 as const,      // Base tinting opacity
    highEntropy: 0.25 as const, // Enhanced opacity for high entropy
    critical: 0.35 as const,  // Maximum opacity for critical entropy
  },
  effects: {
    pulseThreshold: 0.7,      // Entropy level where pulsing starts
    waveThreshold: 0.8,       // Entropy level where wave effects start
    particleThreshold: 0.9,   // Entropy level where particle effects start
  },
  gradientSteps: 5,           // Number of gradient stops for smooth transitions
} as const;

/**
 * Simple color interpolation helper
 */
function interpolateHexColor(ratio: number, colorA: string, colorB: string): string {
  // Convert hex to RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  };

  const rgbA = hexToRgb(colorA);
  const rgbB = hexToRgb(colorB);

  // Interpolate
  const r = Math.round(rgbA.r + (rgbB.r - rgbA.r) * ratio);
  const g = Math.round(rgbA.g + (rgbB.g - rgbA.g) * ratio);
  const b = Math.round(rgbA.b + (rgbB.b - rgbA.b) * ratio);

  // Convert back to hex
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Calculate entropy color based on entropy level
 */
function getEntropyColor(entropy: number): string {
  const { colors } = ENTROPY_CONFIG;
  
  if (entropy <= 0.3) {
    // Blue to purple transition
    const ratio = entropy / 0.3;
    return interpolateHexColor(ratio, colors.lowEntropy, colors.mediumEntropy);
  } else if (entropy <= 0.6) {
    // Purple to red transition
    const ratio = (entropy - 0.3) / 0.3;
    return interpolateHexColor(ratio, colors.mediumEntropy, colors.highEntropy);
  } else if (entropy <= 0.9) {
    // Red to dark red transition
    const ratio = (entropy - 0.6) / 0.3;
    return interpolateHexColor(ratio, colors.highEntropy, colors.criticalEntropy);
  } else {
    // Critical entropy - pure dark red
    return colors.criticalEntropy;
  }
}

/**
 * Calculate entropy opacity based on entropy level and effects
 */
function getEntropyOpacity(entropy: number, showIntensiveEffects: boolean = false): number {
  const { opacity } = ENTROPY_CONFIG;
  
  let baseOpacity = opacity.base;
  
  if (entropy > 0.6) {
    baseOpacity = opacity.highEntropy;
  }
  
  if (entropy > 0.9) {
    baseOpacity = opacity.critical;
  }
  
  // Apply scaling based on entropy level
  const entropyScale = Math.min(1, entropy * 2); // Double effect for low entropy
  const finalOpacity = baseOpacity * entropyScale;
  
  // Intensive effects increase opacity
  if (showIntensiveEffects && entropy > ENTROPY_CONFIG.effects.pulseThreshold) {
    return Math.min(opacity.critical, finalOpacity * 1.3);
  }
  
  return finalOpacity;
}

/**
 * Generate SVG path for sector polygon
 */
function generateSectorPath(vertices: Array<{x: number, y: number}>): string {
  if (vertices.length < 3) return '';
  
  let path = `M ${vertices[0].x} ${vertices[0].y}`;
  
  for (let i = 1; i < vertices.length; i++) {
    path += ` L ${vertices[i].x} ${vertices[i].y}`;
  }
  
  path += ' Z';
  return path;
}

/**
 * Single sector entropy visualization
 */
export const EntropyVisualizationComponent: React.FC<EntropyVisualizationProps> = ({
  sector,
  viewportState,
  isVisible,
  showIntensiveEffects = false,
}) => {
  // Transform sector vertices to screen coordinates (always run hook)
  const screenVertices = useMemo(() => {
    if (!sector.vertices || sector.vertices.length === 0) return [];
    return sector.vertices.map(vertex => ({
      x: vertex.x * viewportState.scale + viewportState.translateX,
      y: vertex.y * viewportState.scale + viewportState.translateY,
    }));
  }, [sector.vertices, viewportState]);

  // Generate path for the sector (always run hook)
  const sectorPath = useMemo(() => {
    return generateSectorPath(screenVertices);
  }, [screenVertices]);

  // Calculate colors and opacity (always run hook)
  const entropyColor = useMemo(() => {
    return getEntropyColor(sector.entropy);
  }, [sector.entropy]);

  const entropyOpacity = useMemo(() => {
    return getEntropyOpacity(sector.entropy, showIntensiveEffects);
  }, [sector.entropy, showIntensiveEffects]);

  // Calculate center point for gradient effects (always run hook)
  const centerPoint = useMemo(() => {
    const centerX = sector.center.x * viewportState.scale + viewportState.translateX;
    const centerY = sector.center.y * viewportState.scale + viewportState.translateY;
    return { x: centerX, y: centerY };
  }, [sector.center, viewportState]);

  // Early return AFTER all hooks
  if (!isVisible || sector.entropy < 0.05 || !sector.vertices || sector.vertices.length === 0) {
    return null;
  }

  // Gradient ID for this sector
  const gradientId = `entropy_gradient_${sector.id}`;
  
  // Special effects for high entropy sectors
  const hasSpecialEffects = showIntensiveEffects && sector.entropy > ENTROPY_CONFIG.effects.pulseThreshold;
  
  return (
    <G>
      {/* Gradient definition for entropy visualization */}
      <Defs>
        <RadialGradient
          id={gradientId}
          cx="50%"
          cy="50%"
          r="70%"
        >
          <Stop
            offset="0%"
            stopColor={entropyColor}
            stopOpacity={entropyOpacity * 1.5} // Stronger at center
          />
          <Stop
            offset="50%"
            stopColor={entropyColor}
            stopOpacity={entropyOpacity}
          />
          <Stop
            offset="100%"
            stopColor={entropyColor}
            stopOpacity={entropyOpacity * 0.3} // Fade at edges
          />
        </RadialGradient>
      </Defs>

      {/* Main entropy fill */}
      <AnimatedPath
        d={sectorPath}
        fill={hasSpecialEffects ? `url(#${gradientId})` : entropyColor}
        opacity={entropyOpacity}
        stroke="none"
      />

      {/* High entropy pulse effect */}
      {hasSpecialEffects && sector.entropy > ENTROPY_CONFIG.effects.waveThreshold && (
        <AnimatedPath
          d={sectorPath}
          fill="none"
          stroke={entropyColor}
          strokeWidth={Math.max(1, 2 / viewportState.scale)}
          strokeOpacity={entropyOpacity * 0.7}
          strokeDasharray={`${10 / viewportState.scale},${5 / viewportState.scale}`}
        />
      )}
    </G>
  );
};

/**
 * Multiple sector entropy visualization with performance optimization
 */
export const MultiSectorEntropyVisualization: React.FC<MultiSectorEntropyProps> = ({
  sectors,
  viewportState,
  entropyThreshold = 0.05,
  maxRenderCount = 30,
}) => {
  // Filter and prioritize sectors for rendering
  const visibleSectors = useMemo(() => {
    const viewportBounds = {
      minX: -viewportState.translateX / viewportState.scale,
      maxX: (-viewportState.translateX + 800) / viewportState.scale, // Assuming 800px width
      minY: -viewportState.translateY / viewportState.scale,
      maxY: (-viewportState.translateY + 600) / viewportState.scale, // Assuming 600px height
    };

    return sectors
      .filter(sector => {
        // Filter by entropy threshold
        if (sector.entropy < entropyThreshold) return false;
        
        // Check if sector bounds intersect with viewport
        return sector.bounds.minX < viewportBounds.maxX &&
               sector.bounds.maxX > viewportBounds.minX &&
               sector.bounds.minY < viewportBounds.maxY &&
               sector.bounds.maxY > viewportBounds.minY;
      })
      .sort((a, b) => {
        // Sort by entropy level (higher entropy = higher priority)
        const entropyPriority = b.entropy - a.entropy;
        
        // Secondary sort by distance from viewport center
        const viewportCenterX = -viewportState.translateX / viewportState.scale + (400 / viewportState.scale);
        const viewportCenterY = -viewportState.translateY / viewportState.scale + (300 / viewportState.scale);
        
        const distanceA = Math.hypot(a.center.x - viewportCenterX, a.center.y - viewportCenterY);
        const distanceB = Math.hypot(b.center.x - viewportCenterX, b.center.y - viewportCenterY);
        
        return entropyPriority !== 0 ? entropyPriority : distanceA - distanceB;
      })
      .slice(0, maxRenderCount);
  }, [sectors, viewportState, entropyThreshold, maxRenderCount]);

  return (
    <G>
      {visibleSectors.map(sector => (
        <EntropyVisualizationComponent
          key={sector.id}
          sector={sector}
          viewportState={viewportState}
          isVisible={true}
          showIntensiveEffects={sector.entropy > ENTROPY_CONFIG.effects.pulseThreshold}
        />
      ))}
    </G>
  );
};

/**
 * Entropy statistics and analysis utilities
 */
export function analyzeEntropyDistribution(sectors: GalacticSector[]): {
  averageEntropy: number;
  highEntropySectors: number;
  criticalEntropySectors: number;
  entropyHotspots: GalacticSector[];
  entropyColdSpots: GalacticSector[];
} {
  const totalEntropy = sectors.reduce((sum, sector) => sum + sector.entropy, 0);
  const averageEntropy = totalEntropy / sectors.length;
  
  const highEntropySectors = sectors.filter(s => s.entropy > 0.7).length;
  const criticalEntropySectors = sectors.filter(s => s.entropy > 0.9).length;
  
  // Find entropy hotspots (high entropy sectors)
  const entropyHotspots = sectors
    .filter(s => s.entropy > 0.8)
    .sort((a, b) => b.entropy - a.entropy)
    .slice(0, 10);
    
  // Find entropy cold spots (low entropy sectors)
  const entropyColdSpots = sectors
    .filter(s => s.entropy < 0.2)
    .sort((a, b) => a.entropy - b.entropy)
    .slice(0, 10);

  return {
    averageEntropy,
    highEntropySectors,
    criticalEntropySectors,
    entropyHotspots,
    entropyColdSpots,
  };
}

/**
 * Generate entropy render data for external systems
 */
export function generateEntropyRenderData(
  sectors: GalacticSector[],
  viewportState: ViewportState
): {
  visibleEntropyCount: number;
  averageVisibleEntropy: number;
  highEntropyCount: number;
  renderingLoad: number; // 0-1 scale
} {
  const visibleSectors = sectors.filter(sector => {
    const viewportBounds = {
      minX: -viewportState.translateX / viewportState.scale,
      maxX: (-viewportState.translateX + 800) / viewportState.scale,
      minY: -viewportState.translateY / viewportState.scale,
      maxY: (-viewportState.translateY + 600) / viewportState.scale,
    };

    return sector.bounds.minX < viewportBounds.maxX &&
           sector.bounds.maxX > viewportBounds.minX &&
           sector.bounds.minY < viewportBounds.maxY &&
           sector.bounds.maxY > viewportBounds.minY &&
           sector.entropy > 0.05;
  });

  const visibleEntropyCount = visibleSectors.length;
  const totalVisibleEntropy = visibleSectors.reduce((sum, s) => sum + s.entropy, 0);
  const averageVisibleEntropy = visibleEntropyCount > 0 ? totalVisibleEntropy / visibleEntropyCount : 0;
  const highEntropyCount = visibleSectors.filter(s => s.entropy > 0.7).length;
  
  // Calculate rendering load (more high-entropy sectors = higher load)
  const renderingLoad = Math.min(1, (visibleEntropyCount * averageVisibleEntropy) / 20);

  return {
    visibleEntropyCount,
    averageVisibleEntropy,
    highEntropyCount,
    renderingLoad,
  };
}

export default EntropyVisualizationComponent;