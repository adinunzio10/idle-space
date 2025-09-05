import React, { memo, useMemo, useCallback } from 'react';
import { G } from 'react-native-svg';

import { GeometricPattern, Beacon, ViewportState } from '../../types/galaxy';
import { BonusCalculationResult } from '../../types/bonuses';
import {
  PATTERN_VISUAL_CONFIG,
  PATTERN_PERFORMANCE,
  PATTERN_OVERLAP,
} from '../../constants/patterns';
import { calculateVisibleBounds } from '../../utils/spatial/viewport';
import PatternOverlay from './PatternOverlay';

interface PatternRendererProps {
  patterns: GeometricPattern[];
  beacons: Beacon[];
  viewportState: ViewportState;
  screenWidth: number;
  screenHeight: number;
  bonusCalculationResult?: BonusCalculationResult;
  qualitySettings: {
    enableAnimations: boolean;
    enableParticles: boolean;
    maxPatterns: number;
  };
  onPatternPress?: (pattern: GeometricPattern) => void;
}

export const PatternRenderer: React.FC<PatternRendererProps> = memo(
  ({
    patterns,
    beacons,
    viewportState,
    screenWidth,
    screenHeight,
    bonusCalculationResult,
    qualitySettings,
    onPatternPress,
  }) => {
    // Calculate current LOD level based on zoom
    const lodLevel = useMemo(() => {
      const { scale } = viewportState;

      if (scale >= PATTERN_VISUAL_CONFIG.LOD_SETTINGS.FULL_DETAIL.minZoom) {
        return 4; // Full detail
      } else if (scale >= PATTERN_VISUAL_CONFIG.LOD_SETTINGS.STANDARD.minZoom) {
        return 3; // Standard
      } else if (
        scale >= PATTERN_VISUAL_CONFIG.LOD_SETTINGS.SIMPLIFIED.minZoom
      ) {
        return 2; // Simplified
      } else {
        return 1; // Hidden
      }
    }, [viewportState]);

    // Get current LOD settings
    const lodSettings = useMemo(() => {
      switch (lodLevel) {
        case 4:
          return PATTERN_VISUAL_CONFIG.LOD_SETTINGS.FULL_DETAIL;
        case 3:
          return PATTERN_VISUAL_CONFIG.LOD_SETTINGS.STANDARD;
        case 2:
          return PATTERN_VISUAL_CONFIG.LOD_SETTINGS.SIMPLIFIED;
        default:
          return PATTERN_VISUAL_CONFIG.LOD_SETTINGS.HIDDEN;
      }
    }, [lodLevel]);

    // Calculate visible bounds for culling
    const visibleBounds = useMemo(() => {
      return calculateVisibleBounds(screenWidth, screenHeight, viewportState);
    }, [screenWidth, screenHeight, viewportState]);

    // Filter and sort patterns for rendering
    const visiblePatterns = useMemo(() => {
      if (lodLevel < 2) return []; // Hidden LOD

      // Filter patterns that are visible on screen
      const patternsInView = patterns.filter(pattern => {
        // Get beacon positions for this pattern
        const patternBeacons = pattern.beaconIds
          .map(id => beacons.find(b => b.id === id))
          .filter(Boolean) as Beacon[];

        if (patternBeacons.length === 0) return false;

        // Check if any beacon is within the visible bounds (with margin)
        const margin = PATTERN_PERFORMANCE.CULLING_MARGIN;
        return patternBeacons.some(beacon => {
          return (
            beacon.position.x >= visibleBounds.minX - margin &&
            beacon.position.x <= visibleBounds.maxX + margin &&
            beacon.position.y >= visibleBounds.minY - margin &&
            beacon.position.y <= visibleBounds.maxY + margin
          );
        });
      });

      // Limit total patterns for performance
      const maxPatterns = Math.min(
        qualitySettings.maxPatterns,
        PATTERN_PERFORMANCE.MAX_ANIMATED_PATTERNS
      );

      // Sort by importance (higher value patterns first, then by size)
      const sortedPatterns = patternsInView.sort((a, b) => {
        const aComplexity = PATTERN_PERFORMANCE.COMPLEXITY[a.type];
        const bComplexity = PATTERN_PERFORMANCE.COMPLEXITY[b.type];

        if (aComplexity !== bComplexity) {
          return bComplexity - aComplexity; // Higher complexity first
        }

        // Secondary sort by pattern size (larger patterns first)
        return b.beaconIds.length - a.beaconIds.length;
      });

      return sortedPatterns.slice(0, maxPatterns);
    }, [
      patterns,
      beacons,
      lodLevel,
      qualitySettings.maxPatterns,
      visibleBounds,
    ]);

    // Group overlapping patterns for visual handling
    const patternGroups = useMemo(() => {
      const groups: { patterns: GeometricPattern[]; zIndex: number }[] = [];
      const processed = new Set<string>();

      visiblePatterns.forEach(pattern => {
        if (processed.has(pattern.id)) return;

        // Find overlapping patterns
        const overlapping = visiblePatterns.filter(other => {
          if (other.id === pattern.id || processed.has(other.id)) return false;

          // Check if patterns share any beacons (simple overlap detection)
          return pattern.beaconIds.some(beaconId =>
            other.beaconIds.includes(beaconId)
          );
        });

        // Create group with all overlapping patterns
        const groupPatterns = [pattern, ...overlapping];
        groupPatterns.forEach(p => processed.add(p.id));

        // Determine z-index based on highest priority pattern in group
        const maxZIndex = Math.max(
          ...groupPatterns.map(p => PATTERN_OVERLAP.Z_INDEX_PRIORITY[p.type])
        );

        groups.push({
          patterns: groupPatterns.sort(
            (a, b) =>
              PATTERN_OVERLAP.Z_INDEX_PRIORITY[b.type] -
              PATTERN_OVERLAP.Z_INDEX_PRIORITY[a.type]
          ),
          zIndex: maxZIndex,
        });
      });

      // Sort groups by z-index
      return groups.sort((a, b) => a.zIndex - b.zIndex);
    }, [visiblePatterns]);

    // Get bonus information for a pattern
    const getPatternBonusInfo = useCallback(
      (pattern: GeometricPattern) => {
        if (!bonusCalculationResult) return { isActive: false, multiplier: 0 };

        // Find pattern bonus breakdown
        const patternBreakdown = bonusCalculationResult.patternBreakdown.find(
          breakdown => breakdown.patternId === pattern.id
        );

        if (!patternBreakdown) return { isActive: false, multiplier: 0 };

        return {
          isActive: patternBreakdown.effectiveBonus > 1,
          multiplier: patternBreakdown.effectiveBonus,
        };
      },
      [bonusCalculationResult]
    );

    // Handle pattern press with overlap handling
    const handlePatternPress = useCallback(
      (pattern: GeometricPattern) => {
        onPatternPress?.(pattern);
      },
      [onPatternPress]
    );

    // Don't render anything if no patterns or hidden LOD
    if (visiblePatterns.length === 0 || lodLevel < 2) {
      return null;
    }

    return (
      <G>
        {patternGroups.map((group, groupIndex) => (
          <G key={`pattern-group-${groupIndex}`}>
            {group.patterns.map((pattern, patternIndex) => {
              const bonusInfo = getPatternBonusInfo(pattern);
              const isOverlapping = group.patterns.length > 1;

              return (
                <PatternOverlay
                  key={pattern.id}
                  pattern={pattern}
                  beacons={beacons}
                  viewportState={viewportState}
                  isActive={bonusInfo.isActive}
                  bonusMultiplier={bonusInfo.multiplier}
                  onPress={handlePatternPress}
                  lodLevel={lodLevel}
                  enableAnimations={
                    qualitySettings.enableAnimations &&
                    lodSettings.enableAnimations
                  }
                />
              );
            })}
          </G>
        ))}
      </G>
    );
  }
);

PatternRenderer.displayName = 'PatternRenderer';

/**
 * Hook for pattern renderer quality settings based on performance
 */
export const usePatternRenderingQuality = (
  patternCount: number,
  scale: number,
  devicePerformance: 'low' | 'medium' | 'high' = 'medium'
) => {
  return useMemo(() => {
    // Base quality settings
    let settings = {
      enableAnimations: true,
      enableParticles: true,
      maxPatterns: PATTERN_PERFORMANCE.MAX_ANIMATED_PATTERNS,
    };

    // Adjust based on pattern count
    if (patternCount > 15) {
      settings.enableParticles = false;
    }

    if (patternCount > 25) {
      settings.enableAnimations = false;
      settings.maxPatterns = 15 as 20;
    }

    // Adjust based on zoom level
    if (scale < 0.5) {
      settings.enableParticles = false;
      settings.enableAnimations = false;
    }

    // Adjust based on device performance
    switch (devicePerformance) {
      case 'low':
        settings.enableParticles = false;
        settings.maxPatterns = Math.min(settings.maxPatterns, 10) as 20;
        if (patternCount > 10) {
          settings.enableAnimations = false;
        }
        break;

      case 'medium':
        settings.maxPatterns = Math.min(settings.maxPatterns, 15) as 20;
        break;

      case 'high':
        // No additional restrictions
        break;
    }

    return settings;
  }, [patternCount, scale, devicePerformance]);
};

/**
 * Performance monitoring for pattern rendering
 */
export const usePatternRenderingMetrics = () => {
  const metricsRef = React.useRef({
    framesRendered: 0,
    totalPatterns: 0,
    averageRenderTime: 0,
    lastFrameTime: 0,
  });

  const recordFrame = useCallback((patternCount: number) => {
    const now = Date.now();
    const frameTime = now - metricsRef.current.lastFrameTime;

    metricsRef.current.framesRendered++;
    metricsRef.current.totalPatterns += patternCount;
    metricsRef.current.averageRenderTime =
      (metricsRef.current.averageRenderTime + frameTime) / 2;
    metricsRef.current.lastFrameTime = now;
  }, []);

  const getMetrics = useCallback(() => {
    return { ...metricsRef.current };
  }, []);

  const resetMetrics = useCallback(() => {
    metricsRef.current = {
      framesRendered: 0,
      totalPatterns: 0,
      averageRenderTime: 0,
      lastFrameTime: Date.now(),
    };
  }, []);

  return { recordFrame, getMetrics, resetMetrics };
};

export default PatternRenderer;
