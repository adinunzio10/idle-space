export interface Point2D {
  x: number;
  y: number;
}

export interface ViewportBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface ViewportState {
  translateX: number;
  translateY: number;
  scale: number;
  bounds: ViewportBounds;
}

export interface Beacon {
  id: string;
  position: Point2D;
  level: number;
  type: 'pioneer' | 'harvester' | 'architect';
  connections: string[]; // IDs of connected beacons
}

export interface GalaxyMapProps {
  width: number;
  height: number;
  beacons: Beacon[];
  onBeaconSelect?: (beacon: Beacon) => void;
  onMapPress?: (position: Point2D) => void;
}

export interface RenderingConfig {
  maxVisibleBeacons: number;
  lodThreshold: number;
  clusteringEnabled: boolean;
  performanceMode: boolean;
}