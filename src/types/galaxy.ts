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

export interface GestureVelocity {
  x: number;
  y: number;
}

export interface GestureState {
  isActive: boolean;
  velocity: GestureVelocity;
  focalPoint?: Point2D;
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
  probes?: import('./probe').ProbeInstance[];
  onBeaconSelect?: (beacon: Beacon) => void;
  onMapPress?: (position: Point2D) => void;
  showDebugOverlay?: boolean;
  selectedBeacon?: Beacon | null;
  beaconUpdateTrigger?: number;
}

export interface RenderingConfig {
  maxVisibleBeacons: number;
  lodThreshold: number;
  clusteringEnabled: boolean;
  performanceMode: boolean;
}

export interface BeaconCluster {
  id: string;
  position: Point2D;
  beacons: Beacon[];
  level: number; // Combined level of all beacons
  radius: number; // Visual radius of cluster
}

export interface LODRenderInfo {
  level: number;
  renderMode: 'full' | 'standard' | 'simplified' | 'clustered';
  size: number;
  showAnimations: boolean;
  showEffects: boolean;
}

export interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  strength: number; // 1-5 scale, affects visual thickness
  isActive: boolean; // Whether data is currently flowing
  patterns: PatternType[]; // Geometric patterns this connection participates in
}

export interface ConnectionRenderInfo {
  shouldRender: boolean;
  lineWidth: number;
  opacity: number;
  showAnimation: boolean;
  showFlow: boolean;
  isPatternConnection: boolean;
  patternColor?: string;
}

export type PatternType = 'triangle' | 'square' | 'pentagon' | 'hexagon';

export interface GeometricPattern {
  id: string;
  type: PatternType;
  beaconIds: string[];
  connectionIds: string[];
  center: Point2D;
  bonus: number; // Multiplier from this pattern
  isComplete: boolean;
  renderInfo?: PatternRenderInfo;
}

export interface PatternRenderInfo {
  shouldRender: boolean;
  isVisible: boolean;
  screenBounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  estimatedScreenSize: number; // Approximate size in screen pixels
  lodLevel: number; // Level of detail for this pattern
  animationState: PatternAnimationState;
  visualPriority: number; // 0-10, higher = more important to render
  lastUpdateFrame: number;
}

export interface PatternAnimationState {
  formationProgress: number; // 0-1, pattern formation animation
  isAnimating: boolean;
  hasFormed: boolean; // Whether formation animation has completed
  pulsePhase: number; // 0-1, continuous pulse for active patterns
  glowIntensity: number; // 0-1, glow effect intensity
  shimmerProgress: number; // 0-1, shimmer animation for complex patterns
  bonusFlashActive: boolean; // Whether bonus flash effect is active
  particlesActive: boolean; // Whether particle effects are active
  lastAnimationUpdate: number; // Timestamp of last animation update
}

export interface PatternOverlapInfo {
  overlapsWithPatterns: string[]; // IDs of overlapping patterns
  overlapType: 'none' | 'vertex' | 'edge' | 'partial' | 'nested' | 'identical';
  overlapSeverity: number; // 0-1, how much this pattern overlaps
  renderOrder: number; // Z-index for overlapping patterns
  blendMode: 'normal' | 'multiply' | 'overlay' | 'soft-light';
}

export interface RenderingState {
  zoom: number;
  visibleBeacons: Beacon[];
  clusters: BeaconCluster[];
  connections: Connection[];
  patterns: GeometricPattern[];
  lodLevel: number;
  shouldCluster: boolean;
  performanceMode: boolean;
}
