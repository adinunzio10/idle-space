import { LODRenderInfo, Beacon, ViewportState } from '../../types/galaxy';
import { RENDERING_CONFIG, LOD_LEVELS } from '../../constants/rendering';

/**
 * Calculate the appropriate LOD level based on zoom
 */
export function calculateLODLevel(zoom: number): number {
  for (const lodLevel of LOD_LEVELS) {
    if (zoom >= lodLevel.minZoom && zoom < lodLevel.maxZoom) {
      return lodLevel.level;
    }
  }
  return LOD_LEVELS[LOD_LEVELS.length - 1].level; // Default to lowest level
}

/**
 * Get render information for a given zoom level
 */
export function getLODRenderInfo(zoom: number, bias: number = 0): LODRenderInfo {
  // Apply bias to zoom - positive bias = higher quality, negative bias = lower quality
  const adjustedZoom = zoom * Math.pow(2, bias);
  const level = calculateLODLevel(adjustedZoom);
  const lodConfig = LOD_LEVELS[level];
  
  let size: number;
  let showAnimations: boolean;
  let showEffects: boolean;
  
  switch (lodConfig.renderMode) {
    case 'full':
      size = RENDERING_CONFIG.BEACON_SIZES.FULL;
      showAnimations = true;
      showEffects = true;
      break;
    case 'standard':
      size = RENDERING_CONFIG.BEACON_SIZES.STANDARD;
      showAnimations = false;
      showEffects = true;
      break;
    case 'simplified':
      size = RENDERING_CONFIG.BEACON_SIZES.SIMPLIFIED;
      showAnimations = false;
      showEffects = false;
      break;
    case 'clustered':
      size = RENDERING_CONFIG.BEACON_SIZES.CLUSTER;
      showAnimations = false;
      showEffects = false;
      break;
    default:
      size = RENDERING_CONFIG.BEACON_SIZES.STANDARD;
      showAnimations = false;
      showEffects = false;
  }
  
  return {
    level,
    renderMode: lodConfig.renderMode,
    size,
    showAnimations,
    showEffects,
  };
}

/**
 * Determine if clustering should be enabled based on beacon count and zoom
 */
export function shouldEnableClustering(
  beacons: Beacon[],
  zoom: number,
  viewportState: ViewportState
): boolean {
  // Always cluster at very low zoom levels
  if (zoom <= RENDERING_CONFIG.LOD_LEVELS.CLUSTERING) {
    return true;
  }
  
  // Cluster if we have too many visible beacons
  if (beacons.length > RENDERING_CONFIG.PERFORMANCE.MAX_VISIBLE_BEACONS) {
    return true;
  }
  
  // Cluster if beacon density is too high
  const viewportArea = (viewportState.bounds.maxX - viewportState.bounds.minX) * 
                      (viewportState.bounds.maxY - viewportState.bounds.minY);
  const density = beacons.length / viewportArea;
  
  return density > RENDERING_CONFIG.PERFORMANCE.CLUSTERING_DENSITY_THRESHOLD;
}

/**
 * Calculate adaptive hit radius based on zoom level
 */
export function calculateHitRadius(zoom: number): number {
  const baseRadius = RENDERING_CONFIG.INTERACTION.HIT_RADIUS_BASE;
  const minRadius = RENDERING_CONFIG.INTERACTION.HIT_RADIUS_MIN;
  const maxRadius = RENDERING_CONFIG.INTERACTION.HIT_RADIUS_MAX;
  
  // Inverse relationship with zoom - bigger hit area when zoomed out
  const adaptiveRadius = baseRadius / Math.max(zoom, 0.1);
  
  return Math.max(minRadius, Math.min(maxRadius, adaptiveRadius));
}

/**
 * Get the visual size multiplier for a beacon based on its level
 */
export function getBeaconLevelScale(level: number): number {
  // Each level increases size by 10%
  return 1 + (level - 1) * 0.1;
}

/**
 * Determine if a beacon should show level indicators
 */
export function shouldShowLevelIndicators(zoom: number, level: number): boolean {
  const renderInfo = getLODRenderInfo(zoom);
  return renderInfo.showEffects && level > 1;
}

/**
 * Calculate performance metrics for current render state
 */
export interface PerformanceMetrics {
  visibleBeacons: number;
  clusteredBeacons: number;
  renderMode: string;
  lodLevel: number;
  estimatedRenderTime: number; // in milliseconds
}

export function calculatePerformanceMetrics(
  totalBeacons: number,
  visibleBeacons: number,
  clusteredBeacons: number,
  lodLevel: number
): PerformanceMetrics {
  const renderMode = LOD_LEVELS[lodLevel]?.renderMode || 'unknown';
  
  // Rough estimate of render time based on beacon count and LOD level
  let renderTimePerBeacon: number;
  switch (renderMode) {
    case 'full':
      renderTimePerBeacon = 0.5; // ms per beacon with full effects
      break;
    case 'standard':
      renderTimePerBeacon = 0.2;
      break;
    case 'simplified':
      renderTimePerBeacon = 0.1;
      break;
    case 'clustered':
      renderTimePerBeacon = 0.05;
      break;
    default:
      renderTimePerBeacon = 0.2;
  }
  
  const effectiveBeacons = Math.max(0, visibleBeacons - clusteredBeacons);
  const clusterRenderTime = clusteredBeacons * 0.05; // Clusters are cheap to render
  const beaconRenderTime = effectiveBeacons * renderTimePerBeacon;
  
  return {
    visibleBeacons,
    clusteredBeacons,
    renderMode,
    lodLevel,
    estimatedRenderTime: beaconRenderTime + clusterRenderTime,
  };
}