/**
 * SectorBoundary Component - Galactic Sector Boundary Renderer
 * 
 * Renders sector boundaries with zoom-based visibility for the living galactic environment.
 * Shows subtle lines that become visible at zoom levels > 0.3x to help visualize galactic structure.
 */

import React, { useMemo } from 'react';
import { Path, G } from 'react-native-svg';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import { GalacticSector, SectorRenderInfo, ViewportState, Point2D } from '../../types/galaxy';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface SectorBoundaryProps {
  sector: GalacticSector;
  renderInfo: SectorRenderInfo;
  viewportState: ViewportState;
  showEntropyTinting?: boolean;
}

// Visual configuration for sector boundaries
const BOUNDARY_CONFIG = {
  defaultColor: '#6B7280', // Neutral gray for boundaries
  defaultOpacity: 0.3,
  minZoomForVisibility: 0.3,
  maxZoomForFullOpacity: 1.0,
  strokeWidth: 1,
  entropyTintingEnabled: true,
} as const;

export const SectorBoundaryComponent: React.FC<SectorBoundaryProps> = ({
  sector,
  renderInfo,
  viewportState,
  showEntropyTinting = true,
}) => {
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
    opacity: finalOpacity,
    strokeWidth: effectiveStrokeWidth,
  }));

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
 * Multi-Sector Boundary Renderer for performance optimization
 */
interface MultipleSectorBoundaryProps {
  sectors: GalacticSector[];
  renderInfoMap: Map<string, SectorRenderInfo>;
  viewportState: ViewportState;
  showEntropyTinting?: boolean;
  maxRenderedSectors?: number;
}

export const MultipleSectorBoundary: React.FC<MultipleSectorBoundaryProps> = ({
  sectors,
  renderInfoMap,
  viewportState,
  showEntropyTinting = true,
  maxRenderedSectors = 50, // Performance limit
}) => {
  // Sort sectors by importance (center of viewport, size, entropy)
  const prioritizedSectors = useMemo(() => {
    const viewportCenter = {
      x: -viewportState.translateX / viewportState.scale + (800 / viewportState.scale), // Assuming 800px screen width
      y: -viewportState.translateY / viewportState.scale + (600 / viewportState.scale), // Assuming 600px screen height
    };

    return sectors
      .filter(sector => {
        const renderInfo = renderInfoMap.get(sector.id);
        return renderInfo?.shouldRender && renderInfo?.shouldShowBoundary;
      })
      .sort((a, b) => {
        // Sort by distance from viewport center (closer = higher priority)
        const distanceA = Math.hypot(a.center.x - viewportCenter.x, a.center.y - viewportCenter.y);
        const distanceB = Math.hypot(b.center.x - viewportCenter.x, b.center.y - viewportCenter.y);
        
        // Secondary sort by entropy (higher entropy = more visual interest)
        const renderInfoA = renderInfoMap.get(a.id);
        const renderInfoB = renderInfoMap.get(b.id);
        const entropyPriorityA = (renderInfoA?.entropyOpacity || 0) * 1000;
        const entropyPriorityB = (renderInfoB?.entropyOpacity || 0) * 1000;
        
        return (distanceA - entropyPriorityA) - (distanceB - entropyPriorityB);
      })
      .slice(0, maxRenderedSectors); // Limit for performance
  }, [sectors, renderInfoMap, viewportState, maxRenderedSectors]);

  return (
    <G>
      {prioritizedSectors.map(sector => {
        const renderInfo = renderInfoMap.get(sector.id);
        if (!renderInfo) return null;

        return (
          <SectorBoundaryComponent
            key={sector.id}
            sector={sector}
            renderInfo={renderInfo}
            viewportState={viewportState}
            showEntropyTinting={showEntropyTinting}
          />
        );
      })}
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