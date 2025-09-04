/**
 * SectorBoundary Component - Enhanced Galactic Sector Boundary Renderer
 * 
 * Renders sector boundaries with zoom-based visibility, smooth transitions, and hexagonal grid support.
 * Integrates with SectorOverlayManager for coordinated visual effects and performance optimization.
 * Shows boundaries at zoom >0.3x with opacity scaling and supports both regular and hexagonal grids.
 */

import React, { useMemo, useEffect } from 'react';
import { Path, G, Defs, Pattern, Circle } from 'react-native-svg';
import Animated, { 
  useAnimatedProps, 
  useSharedValue, 
  withSpring, 
  withTiming,
  interpolate,
  Extrapolate 
} from 'react-native-reanimated';
import { GalacticSector, SectorRenderInfo, ViewportState, Point2D } from '../../types/galaxy';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface SectorBoundaryProps {
  sector: GalacticSector;
  renderInfo: SectorRenderInfo;
  viewportState: ViewportState;
  showEntropyTinting?: boolean;
  enableTransitions?: boolean;
  gridType?: 'voronoi' | 'hexagonal';
  performanceMode?: boolean;
}

interface HexagonalGridProps {
  viewportState: ViewportState;
  gridSpacing: number;
  opacity: number;
  color: string;
  enableTransitions?: boolean;
}

// Enhanced visual configuration for sector boundaries
const BOUNDARY_CONFIG = {
  defaultColor: '#6B7280', // Neutral gray for boundaries
  defaultOpacity: 0.3,
  minZoomForVisibility: 0.3,
  maxZoomForFullOpacity: 1.0,
  strokeWidth: 1,
  entropyTintingEnabled: true,
  // Hexagonal grid settings
  hexagonal: {
    spacing: 150, // Distance between hex centers
    strokeWidth: 0.5,
    color: '#4B5563',
    opacity: 0.2,
    minZoomForVisibility: 0.3,
  },
  // Animation settings
  transitions: {
    duration: 500,
    easing: 'spring',
  },
} as const;

/**
 * Generate hexagonal grid points for a given viewport
 */
function generateHexagonalGridPoints(viewportState: ViewportState, spacing: number): Point2D[] {
  const bounds = {
    minX: -viewportState.translateX / viewportState.scale - 100,
    maxX: (-viewportState.translateX + 800) / viewportState.scale + 100,
    minY: -viewportState.translateY / viewportState.scale - 100,
    maxY: (-viewportState.translateY + 600) / viewportState.scale + 100,
  };

  const points: Point2D[] = [];
  const hexHeight = spacing * Math.sqrt(3);
  const hexWidth = spacing * 2;

  // Calculate grid offsets for hexagonal pattern
  const rowHeight = hexHeight * 0.75;
  const colWidth = hexWidth * 0.75;

  for (let row = Math.floor(bounds.minY / rowHeight); row <= Math.ceil(bounds.maxY / rowHeight); row++) {
    const y = row * rowHeight;
    const offsetX = (row % 2) * colWidth * 0.5; // Offset every other row

    for (let col = Math.floor((bounds.minX - offsetX) / colWidth); col <= Math.ceil((bounds.maxX - offsetX) / colWidth); col++) {
      const x = col * colWidth + offsetX;
      
      // Only add points within bounds
      if (x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY) {
        points.push({ x, y });
      }
    }
  }

  return points;
}

/**
 * Generate SVG path for a hexagon centered at given point
 */
function generateHexagonPath(center: Point2D, radius: number, viewportState: ViewportState): string {
  const points: Point2D[] = [];
  
  // Generate 6 vertices of hexagon
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3; // 60 degrees in radians
    const x = center.x + radius * Math.cos(angle);
    const y = center.y + radius * Math.sin(angle);
    
    // Transform to screen coordinates
    const screenX = x * viewportState.scale + viewportState.translateX;
    const screenY = y * viewportState.scale + viewportState.translateY;
    
    points.push({ x: screenX, y: screenY });
  }

  // Create path
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i].x} ${points[i].y}`;
  }
  path += ' Z';

  return path;
}

/**
 * Optimized Hexagonal Grid Overlay Component with improved performance
 */
const HexagonalGridOverlay: React.FC<HexagonalGridProps> = ({
  viewportState,
  gridSpacing,
  opacity,
  color,
  enableTransitions = true,
}) => {
  // Generate grid points for current viewport with performance optimization
  const gridData = useMemo(() => {
    const points = generateHexagonalGridPoints(viewportState, gridSpacing);
    
    // Aggressive performance limiting based on zoom level
    let maxHexagons: number;
    if (viewportState.scale < 0.5) {
      maxHexagons = 20; // Very few at low zoom
    } else if (viewportState.scale < 0.8) {
      maxHexagons = 35; // Moderate at medium zoom
    } else {
      maxHexagons = 50; // Full detail at high zoom
    }
    
    // Sort by distance to center and take closest ones
    const centerX = -viewportState.translateX / viewportState.scale + (400 / viewportState.scale);
    const centerY = -viewportState.translateY / viewportState.scale + (300 / viewportState.scale);
    
    const pointsWithDistance = points.map(point => ({
      point,
      distance: Math.hypot(point.x - centerX, point.y - centerY)
    }));
    
    pointsWithDistance.sort((a, b) => a.distance - b.distance);
    const visiblePoints = pointsWithDistance.slice(0, maxHexagons).map(item => item.point);
    
    // Calculate hex radius based on zoom with caching
    const hexRadius = (gridSpacing * 0.4) * Math.min(1, Math.max(0.25, viewportState.scale));
    
    return { points: visiblePoints, hexRadius };
  }, [viewportState.scale, viewportState.translateX, viewportState.translateY, gridSpacing]);

  // Animated opacity for smooth transitions
  const animatedOpacity = useSharedValue(opacity);

  useEffect(() => {
    if (enableTransitions) {
      animatedOpacity.value = withTiming(opacity, { duration: BOUNDARY_CONFIG.transitions.duration });
    } else {
      animatedOpacity.value = opacity;
    }
  }, [opacity, enableTransitions, animatedOpacity]);

  // Memoize stroke width calculation
  const strokeWidth = useMemo(() => {
    return Math.max(0.3, BOUNDARY_CONFIG.hexagonal.strokeWidth / Math.max(0.5, viewportState.scale));
  }, [viewportState.scale]);

  // Determine if we should use dashed lines for performance
  const useDashedLines = useMemo(() => {
    return viewportState.scale < 0.6;
  }, [viewportState.scale]);

  const animatedProps = useAnimatedProps(() => ({
    opacity: animatedOpacity.value,
  }));

  // Early return if no points to render
  if (gridData.points.length === 0 || opacity < 0.01) {
    return null;
  }

  return (
    <G>
      {gridData.points.map((point, index) => {
        const hexPath = generateHexagonPath(point, gridData.hexRadius, viewportState);
        
        return (
          <AnimatedPath
            key={`hex_${Math.round(point.x)}_${Math.round(point.y)}`} // Rounded for better key stability
            d={hexPath}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={useDashedLines ? "1,1" : undefined}
            animatedProps={animatedProps}
          />
        );
      })}
    </G>
  );
};

export const SectorBoundaryComponent: React.FC<SectorBoundaryProps> = ({
  sector,
  renderInfo,
  viewportState,
  showEntropyTinting = true,
  enableTransitions = true,
  gridType = 'voronoi',
  performanceMode = false,
}) => {
  // Animated values for smooth transitions
  const animatedOpacity = useSharedValue(renderInfo.boundaryOpacity);
  const animatedStrokeWidth = useSharedValue(BOUNDARY_CONFIG.strokeWidth);

  useEffect(() => {
    if (enableTransitions && !performanceMode) {
      animatedOpacity.value = withSpring(renderInfo.boundaryOpacity, {
        damping: 20,
        stiffness: 300,
      });
    } else {
      animatedOpacity.value = renderInfo.boundaryOpacity;
    }
  }, [renderInfo.boundaryOpacity, enableTransitions, performanceMode, animatedOpacity]);

  // Don't render if not visible or below zoom threshold
  if (!renderInfo.shouldRender || !renderInfo.shouldShowBoundary) {
    return null;
  }

  // Transform sector vertices to screen coordinates
  const screenVertices = useMemo(() => {
    return sector.vertices.map(vertex => ({
      x: vertex.x * viewportState.scale + viewportState.translateX,
      y: vertex.y * viewportState.scale + viewportState.translateY,
    }));
  }, [sector.vertices, viewportState]);

  // Generate SVG path for the sector boundary
  const boundaryPath = useMemo(() => {
    if (screenVertices.length < 3) return '';
    
    let path = `M ${screenVertices[0].x} ${screenVertices[0].y}`;
    
    for (let i = 1; i < screenVertices.length; i++) {
      path += ` L ${screenVertices[i].x} ${screenVertices[i].y}`;
    }
    
    path += ' Z'; // Close the path
    
    return path;
  }, [screenVertices]);

  // Calculate effective stroke width based on zoom
  const effectiveStrokeWidth = useMemo(() => {
    const baseWidth = BOUNDARY_CONFIG.strokeWidth;
    const zoomFactor = Math.max(0.5, Math.min(2, 1 / viewportState.scale));
    return baseWidth * zoomFactor;
  }, [viewportState.scale]);

  // Determine boundary color based on entropy (if enabled)
  const boundaryColor = useMemo(() => {
    if (!showEntropyTinting || !BOUNDARY_CONFIG.entropyTintingEnabled) {
      return BOUNDARY_CONFIG.defaultColor;
    }
    
    // Mix default color with entropy color
    const entropyInfluence = 0.3; // 30% influence from entropy
    return renderInfo.entropyColor || BOUNDARY_CONFIG.defaultColor;
  }, [showEntropyTinting, renderInfo.entropyColor]);

  // Calculate final opacity
  const finalOpacity = useMemo(() => {
    return renderInfo.boundaryOpacity * BOUNDARY_CONFIG.defaultOpacity;
  }, [renderInfo.boundaryOpacity]);

  // Animated props for smooth transitions
  const animatedProps = useAnimatedProps(() => ({
    opacity: enableTransitions ? animatedOpacity.value * BOUNDARY_CONFIG.defaultOpacity : finalOpacity,
    strokeWidth: animatedStrokeWidth.value,
  }));

  // Update stroke width based on zoom and performance mode
  useEffect(() => {
    const baseWidth = BOUNDARY_CONFIG.strokeWidth;
    const zoomFactor = performanceMode ? 1 : Math.max(0.5, Math.min(2, 1 / viewportState.scale));
    const newStrokeWidth = baseWidth * zoomFactor;

    if (enableTransitions && !performanceMode) {
      animatedStrokeWidth.value = withSpring(newStrokeWidth as 1, {
        damping: 25,
        stiffness: 400,
      });
    } else {
      animatedStrokeWidth.value = newStrokeWidth as 1;
    }
  }, [viewportState.scale, performanceMode, enableTransitions, animatedStrokeWidth]);

  // Background fill for entropy visualization (very subtle)
  const entropyBackground = useMemo(() => {
    if (!showEntropyTinting || renderInfo.entropyOpacity <= 0) {
      return null;
    }

    return (
      <AnimatedPath
        d={boundaryPath}
        fill={renderInfo.entropyColor}
        opacity={renderInfo.entropyOpacity}
        stroke="none"
      />
    );
  }, [boundaryPath, renderInfo.entropyColor, renderInfo.entropyOpacity, showEntropyTinting]);

  return (
    <G>
      {/* Entropy background tinting */}
      {entropyBackground}
      
      {/* Sector boundary lines */}
      <AnimatedPath
        d={boundaryPath}
        fill="none"
        stroke={boundaryColor}
        strokeDasharray={viewportState.scale < 0.5 ? "2,2" : undefined} // Dashed lines at low zoom
        strokeLinecap="round"
        strokeLinejoin="round"
        animatedProps={animatedProps}
      />
    </G>
  );
};

/**
 * Enhanced Multi-Sector Boundary Renderer with optimized performance and memory management
 */
interface MultipleSectorBoundaryProps {
  sectors: GalacticSector[];
  renderInfoMap: Map<string, SectorRenderInfo>;
  viewportState: ViewportState;
  showEntropyTinting?: boolean;
  maxRenderedSectors?: number;
  enableTransitions?: boolean;
  gridType?: 'voronoi' | 'hexagonal' | 'both';
  performanceMode?: boolean;
  showHexagonalGrid?: boolean;
}

export const MultipleSectorBoundary: React.FC<MultipleSectorBoundaryProps> = ({
  sectors,
  renderInfoMap,
  viewportState,
  showEntropyTinting = true,
  maxRenderedSectors = 35, // Reduced for better performance
  enableTransitions = true,
  gridType = 'voronoi',
  performanceMode = false,
  showHexagonalGrid = false,
}) => {
  // Determine effective performance mode based on scale and sector count
  const effectivePerformanceMode = useMemo(() => {
    return performanceMode || viewportState.scale < 0.3 || sectors.length > 80;
  }, [performanceMode, viewportState.scale, sectors.length]);

  // Optimized viewport bounds calculation with viewport culling
  const viewportBounds = useMemo(() => {
    const padding = effectivePerformanceMode ? 25 : 50; // Reduce padding in performance mode
    return {
      centerX: -viewportState.translateX / viewportState.scale + (400 / viewportState.scale),
      centerY: -viewportState.translateY / viewportState.scale + (300 / viewportState.scale),
      minX: -viewportState.translateX / viewportState.scale - padding,
      maxX: (-viewportState.translateX + 800) / viewportState.scale + padding,
      minY: -viewportState.translateY / viewportState.scale - padding,
      maxY: (-viewportState.translateY + 600) / viewportState.scale + padding,
    };
  }, [viewportState, effectivePerformanceMode]);

  // Optimized sector filtering and prioritization
  const prioritizedSectors = useMemo(() => {
    const effectiveMaxSectors = effectivePerformanceMode 
      ? Math.floor(maxRenderedSectors * 0.7) 
      : maxRenderedSectors;

    return sectors
      .filter(sector => {
        // Early rejection for sectors outside viewport
        if (sector.bounds.minX > viewportBounds.maxX || 
            sector.bounds.maxX < viewportBounds.minX ||
            sector.bounds.minY > viewportBounds.maxY || 
            sector.bounds.maxY < viewportBounds.minY) {
          return false;
        }

        const renderInfo = renderInfoMap.get(sector.id);
        return renderInfo?.shouldRender && renderInfo?.shouldShowBoundary;
      })
      .map(sector => {
        // Pre-calculate distance for sorting
        const distance = Math.hypot(
          sector.center.x - viewportBounds.centerX, 
          sector.center.y - viewportBounds.centerY
        );
        const renderInfo = renderInfoMap.get(sector.id);
        const entropyPriority = (renderInfo?.entropyOpacity || 0) * 500; // Reduced weight
        
        return {
          sector,
          distance,
          priority: entropyPriority - distance, // Combined priority score
        };
      })
      .sort((a, b) => b.priority - a.priority) // Sort by combined priority
      .slice(0, effectiveMaxSectors)
      .map(item => item.sector);
  }, [sectors, renderInfoMap, viewportBounds, maxRenderedSectors, effectivePerformanceMode]);

  // Optimized hexagonal grid opacity calculation
  const hexGridOpacity = useMemo(() => {
    if (!showHexagonalGrid || 
        viewportState.scale < BOUNDARY_CONFIG.hexagonal.minZoomForVisibility ||
        effectivePerformanceMode) {
      return 0;
    }
    
    const opacityScale = Math.max(0, Math.min(1, (viewportState.scale - 0.3) * 1.5));
    return BOUNDARY_CONFIG.hexagonal.opacity * opacityScale * 0.8; // Slightly reduced
  }, [showHexagonalGrid, viewportState.scale, effectivePerformanceMode]);

  // Group sectors by rendering complexity for batching
  const sectorBatches = useMemo(() => {
    const simple: GalacticSector[] = [];
    const complex: GalacticSector[] = [];

    prioritizedSectors.forEach(sector => {
      const renderInfo = renderInfoMap.get(sector.id);
      const hasEntropyTinting = showEntropyTinting && (renderInfo?.entropyOpacity || 0) > 0.1;
      
      if (effectivePerformanceMode || !hasEntropyTinting) {
        simple.push(sector);
      } else {
        complex.push(sector);
      }
    });

    return { simple, complex };
  }, [prioritizedSectors, renderInfoMap, showEntropyTinting, effectivePerformanceMode]);

  return (
    <G>
      {/* Hexagonal grid overlay (if enabled and not in performance mode) */}
      {(gridType === 'hexagonal' || gridType === 'both') && 
       showHexagonalGrid && 
       hexGridOpacity > 0 && 
       !effectivePerformanceMode && (
        <HexagonalGridOverlay
          viewportState={viewportState}
          gridSpacing={BOUNDARY_CONFIG.hexagonal.spacing}
          opacity={hexGridOpacity}
          color={BOUNDARY_CONFIG.hexagonal.color}
          enableTransitions={enableTransitions}
        />
      )}

      {/* Render simple sectors first (batch rendering for performance) */}
      {(gridType === 'voronoi' || gridType === 'both') && (
        <G key="simple-boundaries">
          {sectorBatches.simple.map(sector => {
            const renderInfo = renderInfoMap.get(sector.id);
            if (!renderInfo) return null;

            return (
              <SectorBoundaryComponent
                key={sector.id}
                sector={sector}
                renderInfo={renderInfo}
                viewportState={viewportState}
                showEntropyTinting={false} // Simplified rendering
                enableTransitions={enableTransitions && !effectivePerformanceMode}
                performanceMode={effectivePerformanceMode}
                gridType="voronoi"
              />
            );
          })}
        </G>
      )}

      {/* Render complex sectors with full effects */}
      {(gridType === 'voronoi' || gridType === 'both') && !effectivePerformanceMode && (
        <G key="complex-boundaries">
          {sectorBatches.complex.map(sector => {
            const renderInfo = renderInfoMap.get(sector.id);
            if (!renderInfo) return null;

            return (
              <SectorBoundaryComponent
                key={sector.id}
                sector={sector}
                renderInfo={renderInfo}
                viewportState={viewportState}
                showEntropyTinting={showEntropyTinting}
                enableTransitions={enableTransitions}
                performanceMode={false}
                gridType="voronoi"
              />
            );
          })}
        </G>
      )}
    </G>
  );
};

/**
 * Utility function to generate sector boundary render data
 */
export function generateSectorBoundaryRenderData(
  sectors: GalacticSector[],
  viewportState: ViewportState,
  sectorRenderInfo: Map<string, SectorRenderInfo>
): {
  visibleSectors: GalacticSector[];
  boundaryCount: number;
  entropyTintedCount: number;
  averageOpacity: number;
} {
  const visibleSectors = sectors.filter(sector => {
    const renderInfo = sectorRenderInfo.get(sector.id);
    return renderInfo?.shouldRender && renderInfo?.shouldShowBoundary;
  });

  const boundaryCount = visibleSectors.length;
  const entropyTintedCount = visibleSectors.filter(sector => {
    const renderInfo = sectorRenderInfo.get(sector.id);
    return (renderInfo?.entropyOpacity || 0) > 0.05;
  }).length;

  const totalOpacity = visibleSectors.reduce((sum, sector) => {
    const renderInfo = sectorRenderInfo.get(sector.id);
    return sum + (renderInfo?.boundaryOpacity || 0);
  }, 0);

  const averageOpacity = boundaryCount > 0 ? totalOpacity / boundaryCount : 0;

  return {
    visibleSectors,
    boundaryCount,
    entropyTintedCount,
    averageOpacity,
  };
}

export default SectorBoundaryComponent;