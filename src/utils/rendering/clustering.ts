import { Beacon, BeaconCluster, Point2D } from '../../types/galaxy';
import { RENDERING_CONFIG } from '../../constants/rendering';

/**
 * Simple distance-based clustering algorithm for beacons
 */
export function clusterBeacons(beacons: Beacon[]): BeaconCluster[] {
  if (beacons.length === 0) return [];
  
  const clusters: BeaconCluster[] = [];
  const processed = new Set<string>();
  const maxDistance = RENDERING_CONFIG.PERFORMANCE.CLUSTER_MAX_DISTANCE;
  const minClusterSize = RENDERING_CONFIG.PERFORMANCE.CLUSTER_MIN_SIZE;
  
  for (const beacon of beacons) {
    if (processed.has(beacon.id)) continue;
    
    // Find all nearby beacons
    const nearbyBeacons: Beacon[] = [beacon];
    processed.add(beacon.id);
    
    for (const otherBeacon of beacons) {
      if (processed.has(otherBeacon.id)) continue;
      
      const distance = calculateDistance(beacon.position, otherBeacon.position);
      if (distance <= maxDistance) {
        nearbyBeacons.push(otherBeacon);
        processed.add(otherBeacon.id);
      }
    }
    
    // Only create cluster if we have enough beacons
    if (nearbyBeacons.length >= minClusterSize) {
      const cluster = createCluster(nearbyBeacons);
      clusters.push(cluster);
    } else {
      // Return individual beacons if cluster is too small
      for (const singleBeacon of nearbyBeacons) {
        processed.delete(singleBeacon.id);
      }
    }
  }
  
  return clusters;
}

/**
 * Advanced grid-based clustering for better performance with many beacons
 */
export function gridClusterBeacons(beacons: Beacon[], gridSize: number = 100): BeaconCluster[] {
  if (beacons.length === 0) return [];
  
  // Group beacons by grid cells
  const grid = new Map<string, Beacon[]>();
  
  for (const beacon of beacons) {
    const cellX = Math.floor(beacon.position.x / gridSize);
    const cellY = Math.floor(beacon.position.y / gridSize);
    const cellKey = `${cellX},${cellY}`;
    
    if (!grid.has(cellKey)) {
      grid.set(cellKey, []);
    }
    grid.get(cellKey)!.push(beacon);
  }
  
  // Create clusters from grid cells with enough beacons
  const clusters: BeaconCluster[] = [];
  const minClusterSize = RENDERING_CONFIG.PERFORMANCE.CLUSTER_MIN_SIZE;
  
  for (const [, cellBeacons] of grid) {
    if (cellBeacons.length >= minClusterSize) {
      const cluster = createCluster(cellBeacons);
      clusters.push(cluster);
    }
  }
  
  return clusters;
}

/**
 * Hierarchical clustering with different zoom levels
 */
export function hierarchicalCluster(
  beacons: Beacon[], 
  zoom: number
): { clusters: BeaconCluster[], remainingBeacons: Beacon[] } {
  // Adjust clustering aggressiveness based on zoom level
  let gridSize: number;
  
  if (zoom <= 0.1) {
    gridSize = 400; // Very aggressive clustering
  } else if (zoom <= 0.5) {
    gridSize = 200;
  } else if (zoom <= 1.0) {
    gridSize = 100;
  } else {
    gridSize = 50; // Minimal clustering at high zoom
  }
  
  const clusters = gridClusterBeacons(beacons, gridSize);
  
  // Find beacons that weren't clustered
  const clusteredBeaconIds = new Set<string>();
  for (const cluster of clusters) {
    for (const beacon of cluster.beacons) {
      clusteredBeaconIds.add(beacon.id);
    }
  }
  
  const remainingBeacons = beacons.filter(beacon => !clusteredBeaconIds.has(beacon.id));
  
  return { clusters, remainingBeacons };
}

/**
 * Create a cluster from a group of beacons
 */
function createCluster(beacons: Beacon[]): BeaconCluster {
  if (beacons.length === 0) {
    throw new Error('Cannot create cluster from empty beacon array');
  }
  
  // Calculate center position (centroid)
  const centerX = beacons.reduce((sum, b) => sum + b.position.x, 0) / beacons.length;
  const centerY = beacons.reduce((sum, b) => sum + b.position.y, 0) / beacons.length;
  
  // Calculate combined level (average)
  const combinedLevel = Math.round(
    beacons.reduce((sum, b) => sum + b.level, 0) / beacons.length
  );
  
  // Calculate cluster radius based on beacon spread
  const distances = beacons.map(beacon => 
    calculateDistance({ x: centerX, y: centerY }, beacon.position)
  );
  const maxDistance = Math.max(...distances);
  const radius = Math.max(20, Math.min(100, maxDistance + 10)); // Clamp to reasonable range
  
  // Generate unique cluster ID
  const sortedIds = beacons.map(b => b.id).sort();
  const clusterId = `cluster_${sortedIds.join('_')}`;
  
  return {
    id: clusterId,
    position: { x: centerX, y: centerY },
    beacons,
    level: combinedLevel,
    radius,
  };
}

/**
 * Calculate distance between two points
 */
function calculateDistance(point1: Point2D, point2: Point2D): number {
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Check if a point is within a cluster's bounds
 */
export function isPointInCluster(point: Point2D, cluster: BeaconCluster): boolean {
  const distance = calculateDistance(point, cluster.position);
  return distance <= cluster.radius;
}

/**
 * Get cluster statistics for debugging/optimization
 */
export interface ClusterStats {
  totalClusters: number;
  totalBeaconsInClusters: number;
  averageClusterSize: number;
  largestCluster: number;
  smallestCluster: number;
  compressionRatio: number; // How much we reduced the render count
}

export function getClusterStats(
  originalBeacons: number,
  clusters: BeaconCluster[]
): ClusterStats {
  if (clusters.length === 0) {
    return {
      totalClusters: 0,
      totalBeaconsInClusters: 0,
      averageClusterSize: 0,
      largestCluster: 0,
      smallestCluster: 0,
      compressionRatio: 1,
    };
  }
  
  const clusterSizes = clusters.map(c => c.beacons.length);
  const totalBeaconsInClusters = clusterSizes.reduce((sum, size) => sum + size, 0);
  const averageClusterSize = totalBeaconsInClusters / clusters.length;
  
  return {
    totalClusters: clusters.length,
    totalBeaconsInClusters,
    averageClusterSize,
    largestCluster: Math.max(...clusterSizes),
    smallestCluster: Math.min(...clusterSizes),
    compressionRatio: originalBeacons / (clusters.length + (originalBeacons - totalBeaconsInClusters)),
  };
}