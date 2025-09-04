/**
 * EntropyVisualization Component - Enhanced Sector Entropy Visualization with Particle Systems
 * 
 * Provides visual representation of entropy levels using background tinting, particle effects,
 * and animated entropy spread visualization between adjacent sectors. Features flowing dark
 * particles that represent entropy spreading through the galactic environment.
 */

import React, { useMemo, useEffect } from 'react';
import { Path, G, Defs, LinearGradient, Stop, RadialGradient, Circle } from 'react-native-svg';
import Animated, { 
  useAnimatedProps, 
  useSharedValue, 
  withTiming, 
  withRepeat,
  useFrameCallback,
} from 'react-native-reanimated';
import { GalacticSector, ViewportState } from '../../types/galaxy';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface EntropyVisualizationProps {
  sector: GalacticSector;
  viewportState: ViewportState;
  isVisible: boolean;
  showIntensiveEffects?: boolean; // For high entropy sectors
  enableParticleSystem?: boolean;
  neighboringSectors?: GalacticSector[]; // For particle flow between sectors
}

interface EntropyParticle {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  progress: number; // 0-1
  size: number;
  opacity: number;
  speed: number; // particles per second
  color: string;
  lifespan: number; // milliseconds
  createdAt: number;
}

interface EntropyFlowProps {
  fromSector: GalacticSector;
  toSector: GalacticSector;
  viewportState: ViewportState;
  intensity: number; // 0-1
  particleCount: number;
  enableAnimation?: boolean;
}

interface ParticleSystemProps {
  sector: GalacticSector;
  neighboringSectors: GalacticSector[];
  viewportState: ViewportState;
  entropy: number;
  enableAnimation?: boolean;
  particleQuality?: number; // 0-1, affects particle count
}

interface MultiSectorEntropyProps {
  sectors: GalacticSector[];
  viewportState: ViewportState;
  entropyThreshold?: number; // Only show entropy above this level
  maxRenderCount?: number;
  enableParticleSystem?: boolean;
  particleQuality?: number;
}

// Enhanced configuration for entropy visualization with particle systems
const ENTROPY_CONFIG = {
  colors: {
    lowEntropy: '#3B82F6',    // Blue for low entropy (0.0-0.3)
    mediumEntropy: '#8B5CF6', // Purple for medium entropy (0.3-0.6)  
    highEntropy: '#EF4444',   // Red for high entropy (0.6-1.0)
    criticalEntropy: '#DC2626', // Dark red for critical entropy (0.9+)
    // Particle colors
    particleLow: '#4338CA',   // Dark blue particles
    particleMedium: '#7C3AED', // Dark purple particles
    particleHigh: '#DC2626',  // Dark red particles
  },
  opacity: {
    base: 0.15 as const,      // Base tinting opacity
    highEntropy: 0.25 as const, // Enhanced opacity for high entropy
    critical: 0.35 as const,  // Maximum opacity for critical entropy
  },
  effects: {
    pulseThreshold: 0.7,      // Entropy level where pulsing starts
    waveThreshold: 0.8,       // Entropy level where wave effects start
    particleThreshold: 0.5,   // Entropy level where particle effects start (lowered)
  },
  gradientSteps: 5,           // Number of gradient stops for smooth transitions
  // Particle system configuration
  particles: {
    baseCount: 5,             // Base particle count per sector
    maxCount: 20,             // Maximum particles per sector
    baseSize: 1.5,            // Base particle size
    maxSize: 4,               // Maximum particle size
    baseSpeed: 0.3,           // Base particle speed (progress per second)
    maxSpeed: 1.2,            // Maximum particle speed
    lifespan: 3000,           // Particle lifespan in milliseconds
    spawnRate: 2,             // Particles spawned per second
    flowDistance: 100,        // Maximum flow distance between sectors
  },
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
  
  let baseOpacity: number = opacity.base;
  
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
function generateSectorPath(vertices: {x: number, y: number}[]): string {
  if (vertices.length < 3) return '';
  
  let path = `M ${vertices[0].x} ${vertices[0].y}`;
  
  for (let i = 1; i < vertices.length; i++) {
    path += ` L ${vertices[i].x} ${vertices[i].y}`;
  }
  
  path += ' Z';
  return path;
}

/**
 * Get particle color based on entropy level
 */
function getParticleColor(entropy: number): string {
  const { colors } = ENTROPY_CONFIG;
  
  if (entropy <= 0.3) {
    return colors.particleLow;
  } else if (entropy <= 0.6) {
    return colors.particleMedium;
  } else {
    return colors.particleHigh;
  }
}

/**
 * Calculate entropy flow intensity between two sectors
 */
function calculateEntropyFlowIntensity(fromSector: GalacticSector, toSector: GalacticSector): number {
  const entropyDifference = Math.abs(fromSector.entropy - toSector.entropy);
  const flowDirection = fromSector.entropy > toSector.entropy ? 1 : 0.3; // Stronger flow from high to low
  
  return Math.min(1, entropyDifference * 2) * flowDirection;
}

/**
 * Generate particle path between two sectors
 */
function generateParticlePath(fromSector: GalacticSector, toSector: GalacticSector): {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  controlX: number;
  controlY: number;
} {
  const startX = fromSector.center.x;
  const startY = fromSector.center.y;
  const endX = toSector.center.x;
  const endY = toSector.center.y;
  
  // Add slight curve to particle path
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;
  const perpX = -(endY - startY) / 10; // Perpendicular offset for curve
  const perpY = (endX - startX) / 10;
  
  return {
    startX,
    startY,
    endX,
    endY,
    controlX: midX + perpX,
    controlY: midY + perpY,
  };
}

/**
 * Calculate particle position along curved path
 */
function getParticlePosition(path: ReturnType<typeof generateParticlePath>, progress: number): {
  x: number;
  y: number;
} {
  // Quadratic Bezier curve calculation
  const t = Math.max(0, Math.min(1, progress));
  const oneMinusT = 1 - t;
  
  const x = oneMinusT * oneMinusT * path.startX + 
           2 * oneMinusT * t * path.controlX + 
           t * t * path.endX;
           
  const y = oneMinusT * oneMinusT * path.startY + 
           2 * oneMinusT * t * path.controlY + 
           t * t * path.endY;
  
  return { x, y };
}

/**
 * Entropy Flow Component - Renders particle flow between sectors
 */
const EntropyFlowComponent: React.FC<EntropyFlowProps> = ({
  fromSector,
  toSector,
  viewportState,
  intensity,
  particleCount,
  enableAnimation = true,
}) => {
  const particles = useMemo(() => {
    const particleArray: EntropyParticle[] = [];
    const path = generateParticlePath(fromSector, toSector);
    
    for (let i = 0; i < particleCount; i++) {
      const id = `particle_${fromSector.id}_${toSector.id}_${i}`;
      const progress = (i / particleCount) * 0.8; // Spread particles along path
      const size = ENTROPY_CONFIG.particles.baseSize + Math.random() * 2;
      const speed = ENTROPY_CONFIG.particles.baseSpeed + Math.random() * 0.3;
      
      particleArray.push({
        id,
        startX: path.startX,
        startY: path.startY,
        endX: path.endX,
        endY: path.endY,
        progress,
        size,
        opacity: intensity * 0.6 + Math.random() * 0.4,
        speed,
        color: getParticleColor(Math.max(fromSector.entropy, toSector.entropy)),
        lifespan: ENTROPY_CONFIG.particles.lifespan,
        createdAt: Date.now() - Math.random() * 2000, // Stagger creation times
      });
    }
    
    return particleArray;
  }, [fromSector, toSector, intensity, particleCount]);

  if (!enableAnimation || intensity < 0.1) return null;

  const path = generateParticlePath(fromSector, toSector);

  return (
    <G>
      {particles.map((particle) => {
        const position = getParticlePosition(path, particle.progress);
        const screenX = position.x * viewportState.scale + viewportState.translateX;
        const screenY = position.y * viewportState.scale + viewportState.translateY;
        const screenSize = particle.size * Math.max(0.5, viewportState.scale);
        
        // DEBUG: Track entropy particle coordinate transformation
        console.log(`[DEBUG:EntropyVisualization] ${particle.id} - worldPos(${position.x.toFixed(1)}, ${position.y.toFixed(1)}) | viewport(scale:${viewportState.scale.toFixed(2)}, translate:${viewportState.translateX.toFixed(1)},${viewportState.translateY.toFixed(1)}) | screenPos(${screenX.toFixed(1)}, ${screenY.toFixed(1)}) size:${screenSize.toFixed(1)} - ${Date.now()}`);
        
        return (
          <Circle
            key={particle.id}
            cx={screenX}
            cy={screenY}
            r={screenSize}
            fill={particle.color}
            opacity={particle.opacity * intensity}
          />
        );
      })}
    </G>
  );
};

/**
 * Particle System Component - Manages particles for a single sector
 */
const ParticleSystemComponent: React.FC<ParticleSystemProps> = ({
  sector,
  neighboringSectors,
  viewportState,
  entropy,
  enableAnimation = true,
  particleQuality = 1.0,
}) => {
  // Calculate particle flows to neighboring sectors
  const particleFlows = useMemo(() => {
    // Only show particles above threshold
    if (entropy < ENTROPY_CONFIG.effects.particleThreshold || !enableAnimation) {
      return [];
    }

    return neighboringSectors
      .map(neighbor => ({
        neighbor,
        intensity: calculateEntropyFlowIntensity(sector, neighbor),
        distance: Math.hypot(
          sector.center.x - neighbor.center.x,
          sector.center.y - neighbor.center.y
        ),
      }))
      .filter(flow => 
        flow.intensity > 0.2 && 
        flow.distance < ENTROPY_CONFIG.particles.flowDistance
      )
      .sort((a, b) => b.intensity - a.intensity)
      .slice(0, Math.ceil(3 * particleQuality)); // Limit flows for performance
  }, [sector, neighboringSectors, particleQuality, entropy, enableAnimation]);

  // Early return after hooks if no particles to show
  if (particleFlows.length === 0) {
    return null;
  }

  return (
    <G>
      {particleFlows.map(({ neighbor, intensity }) => {
        const particleCount = Math.ceil(
          (ENTROPY_CONFIG.particles.baseCount + 
           entropy * ENTROPY_CONFIG.particles.maxCount) * 
          particleQuality * 
          intensity
        );

        return (
          <EntropyFlowComponent
            key={`flow_${sector.id}_${neighbor.id}`}
            fromSector={sector}
            toSector={neighbor}
            viewportState={viewportState}
            intensity={intensity}
            particleCount={particleCount}
            enableAnimation={enableAnimation}
          />
        );
      })}
    </G>
  );
};

/**
 * Single sector entropy visualization with improved clipping and reduced artifacts
 */
export const EntropyVisualizationComponent: React.FC<EntropyVisualizationProps> = ({
  sector,
  viewportState,
  isVisible,
  showIntensiveEffects = false,
  enableParticleSystem = true,
  neighboringSectors = [],
}) => {
  // Transform sector vertices to screen coordinates (always run hook)
  const screenVertices = useMemo(() => {
    if (!sector.vertices || sector.vertices.length === 0) return [];
    const transformed = sector.vertices.map(vertex => ({
      x: vertex.x * viewportState.scale + viewportState.translateX,
      y: vertex.y * viewportState.scale + viewportState.translateY,
    }));
    
    // DEBUG: Track sector polygon coordinate transformation
    if (sector.vertices.length > 0) {
      console.log(`[DEBUG:EntropyVisualization] Sector ${sector.id} polygon - worldVertex0(${sector.vertices[0].x.toFixed(1)}, ${sector.vertices[0].y.toFixed(1)}) | viewport(scale:${viewportState.scale.toFixed(2)}, translate:${viewportState.translateX.toFixed(1)},${viewportState.translateY.toFixed(1)}) | screenVertex0(${transformed[0].x.toFixed(1)}, ${transformed[0].y.toFixed(1)}) entropy:${sector.entropy.toFixed(2)} - ${Date.now()}`);
    }
    
    return transformed;
  }, [sector.vertices, viewportState, sector.id, sector.entropy]);

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

  // Calculate bounding box for proper gradient sizing
  const boundingBox = useMemo(() => {
    if (screenVertices.length === 0) return { minX: 0, minY: 0, width: 0, height: 0 };
    
    const xs = screenVertices.map(v => v.x);
    const ys = screenVertices.map(v => v.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    
    return {
      minX,
      minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }, [screenVertices]);

  // Early return AFTER all hooks
  if (!isVisible || sector.entropy < 0.05 || !sector.vertices || sector.vertices.length === 0) {
    return null;
  }

  // Unique IDs for this sector's elements to prevent conflicts
  const gradientId = `entropy_gradient_${sector.id}`;
  
  // Special effects for high entropy sectors
  const hasSpecialEffects = showIntensiveEffects && sector.entropy > ENTROPY_CONFIG.effects.pulseThreshold;
  
  // More aggressive simple rendering to reduce artifacts
  const useSimpleRendering = viewportState.scale < 0.8 || sector.entropy < 0.2;
  
  return (
    <G>
      {/* Completely simplified entropy rendering - no gradients, no layers */}
      <AnimatedPath
        d={sectorPath}
        fill={entropyColor}
        opacity={entropyOpacity * 0.6} // Reduced opacity to make subtle
        stroke="none"
        fillRule="evenodd"
      />

      {/* Particle system temporarily disabled to debug artifacts */}
      {false && enableParticleSystem && neighboringSectors.length > 0 && !useSimpleRendering && (
        <ParticleSystemComponent
          sector={sector}
          neighboringSectors={neighboringSectors}
          viewportState={viewportState}
          entropy={sector.entropy}
          enableAnimation={showIntensiveEffects}
          particleQuality={showIntensiveEffects ? 0.8 : 0.4} // Reduced particle quality
        />
      )}
    </G>
  );
};

/**
 * Multiple sector entropy visualization with improved performance and artifact reduction
 */
export const MultiSectorEntropyVisualization: React.FC<MultiSectorEntropyProps> = ({
  sectors,
  viewportState,
  entropyThreshold = 0.05,
  maxRenderCount = 25, // Reduced for better performance
  enableParticleSystem = true,
  particleQuality = 0.6, // Reduced default particle quality
}) => {
  // Create sector lookup map for neighbor finding
  const sectorMap = useMemo(() => {
    if (!sectors || !Array.isArray(sectors)) {
      return new Map();
    }
    return new Map(sectors.map(sector => [sector.id, sector]));
  }, [sectors]);

  // Determine performance mode based on zoom and sector count
  const performanceMode = useMemo(() => {
    const sectorCount = sectors?.length || 0;
    return viewportState.scale < 0.4 || sectorCount > 100;
  }, [viewportState.scale, sectors]);

  // Filter and prioritize sectors for rendering with improved culling
  const visibleSectors = useMemo(() => {
    const viewportBounds = {
      minX: -viewportState.translateX / viewportState.scale - 50, // Add padding for smooth transitions
      maxX: (-viewportState.translateX + 800) / viewportState.scale + 50,
      minY: -viewportState.translateY / viewportState.scale - 50,
      maxY: (-viewportState.translateY + 600) / viewportState.scale + 50,
    };

    const effectiveMaxRenderCount = performanceMode ? Math.floor(maxRenderCount * 0.6) : maxRenderCount;
    const effectiveThreshold = performanceMode ? entropyThreshold * 1.5 : entropyThreshold;

    return sectors
      .filter(sector => {
        // Filter by entropy threshold
        if (sector.entropy < effectiveThreshold) return false;
        
        // Check if sector bounds intersect with viewport (with padding)
        return sector.bounds.minX < viewportBounds.maxX &&
               sector.bounds.maxX > viewportBounds.minX &&
               sector.bounds.minY < viewportBounds.maxY &&
               sector.bounds.maxY > viewportBounds.minY;
      })
      .sort((a, b) => {
        // Primary sort by entropy level (higher entropy = higher priority)
        const entropyPriority = b.entropy - a.entropy;
        
        // Secondary sort by distance from viewport center
        const viewportCenterX = -viewportState.translateX / viewportState.scale + (400 / viewportState.scale);
        const viewportCenterY = -viewportState.translateY / viewportState.scale + (300 / viewportState.scale);
        
        const distanceA = Math.hypot(a.center.x - viewportCenterX, a.center.y - viewportCenterY);
        const distanceB = Math.hypot(b.center.x - viewportCenterX, b.center.y - viewportCenterY);
        
        // Weight entropy more heavily for sorting
        return entropyPriority * 1000 + (distanceA - distanceB);
      })
      .slice(0, effectiveMaxRenderCount);
  }, [sectors, viewportState, entropyThreshold, maxRenderCount, performanceMode]);

  // Split sectors into layers to reduce overlap conflicts
  const sectorLayers = useMemo(() => {
    const layers: GalacticSector[][] = [[], [], []]; // Low, medium, high entropy layers
    
    visibleSectors.forEach(sector => {
      if (sector.entropy < 0.3) {
        layers[0].push(sector); // Low entropy
      } else if (sector.entropy < 0.7) {
        layers[1].push(sector); // Medium entropy
      } else {
        layers[2].push(sector); // High entropy
      }
    });
    
    return layers;
  }, [visibleSectors]);

  return (
    <G>
      {/* Render sectors in layers to reduce overlap artifacts */}
      {sectorLayers.map((layer, layerIndex) => (
        <G key={`entropy_layer_${layerIndex}`}>
          {layer.map(sector => {
            // Find neighboring sectors for this sector
            const neighboringSectors = enableParticleSystem && !performanceMode
              ? sector.neighboringSectors
                  .map(neighborId => sectorMap.get(neighborId))
                  .filter((neighbor): neighbor is GalacticSector => 
                    neighbor !== undefined && neighbor.entropy > entropyThreshold
                  )
                  .slice(0, performanceMode ? 2 : 3) // Limit neighbors based on performance mode
              : [];

            const effectiveParticleQuality = performanceMode 
              ? particleQuality * 0.5 
              : particleQuality;

            return (
              <EntropyVisualizationComponent
                key={sector.id}
                sector={sector}
                viewportState={viewportState}
                isVisible={true}
                showIntensiveEffects={sector.entropy > ENTROPY_CONFIG.effects.pulseThreshold && !performanceMode}
                enableParticleSystem={enableParticleSystem && !performanceMode}
                neighboringSectors={neighboringSectors}
              />
            );
          })}
        </G>
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
  if (!sectors || !Array.isArray(sectors) || sectors.length === 0) {
    return {
      averageEntropy: 0,
      highEntropySectors: 0,
      criticalEntropySectors: 0,
      entropyHotspots: [],
      entropyColdSpots: [],
    };
  }

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
  if (!sectors || !Array.isArray(sectors)) {
    return {
      visibleEntropyCount: 0,
      averageVisibleEntropy: 0,
      highEntropyCount: 0,
      renderingLoad: 0,
    };
  }

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