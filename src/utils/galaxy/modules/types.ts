import { ViewportState, Point2D, Beacon, Connection, GeometricPattern, StarSystem, GalacticSector } from '../../../types/galaxy';

export interface ModulePerformanceMetrics {
  renderTime: number;
  lastFrameTime: number;
  averageFps: number;
  memoryUsage?: number;
  skipFrames: number;
}

export interface ModuleConfiguration {
  enabled: boolean;
  priority: number; // Higher priority modules render/update first
  performanceMode?: boolean;
  debugMode?: boolean;
  customSettings?: Record<string, any>;
}

export interface ModuleContext {
  viewport: ViewportState;
  screenDimensions: { width: number; height: number };
  beacons: Beacon[];
  connections: Connection[];
  patterns: GeometricPattern[];
  starSystems: StarSystem[];
  sectors: GalacticSector[];
  deltaTime: number;
  frameCount: number;
}

export interface ModuleRenderResult {
  elements: React.ReactNode[];
  shouldContinueRendering: boolean;
  nextUpdateTime?: number; // Suggested time for next update (ms)
  performanceImpact: 'low' | 'medium' | 'high';
}

export interface GalaxyMapModule {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly category: ModuleCategory;
  readonly dependencies: string[]; // IDs of required modules
  
  config: ModuleConfiguration;
  metrics: ModulePerformanceMetrics;
  
  // Lifecycle methods
  initialize(context: ModuleContext): Promise<void> | void;
  enable(): Promise<void> | void;
  disable(): Promise<void> | void;
  cleanup(): Promise<void> | void;
  
  // Update and render
  update(context: ModuleContext): void;
  render(context: ModuleContext): ModuleRenderResult;
  
  // Configuration
  updateConfig(newConfig: Partial<ModuleConfiguration>): void;
  
  // Performance and health
  getPerformanceMetrics(): ModulePerformanceMetrics;
  shouldSkipFrame(context: ModuleContext): boolean;
  
  // Event handling (optional)
  onBeaconSelect?(beacon: Beacon): void;
  onMapPress?(point: Point2D): void;
  onViewportChange?(viewport: ViewportState): void;
}

export type ModuleCategory = 
  | 'rendering' 
  | 'interaction' 
  | 'performance' 
  | 'data' 
  | 'effects' 
  | 'ui';

export interface ModuleRegistryEntry {
  module: GalaxyMapModule;
  isRegistered: boolean;
  lastInitTime?: number;
  initError?: string;
}

export interface ModuleDependencyInfo {
  moduleId: string;
  requiredBy: string[];
  requires: string[];
  canBeDisabled: boolean;
  circularDependencies: string[];
}

export interface ModuleEventPayload {
  moduleId: string;
  timestamp: number;
  data?: any;
}

export type ModuleEvent = 
  | 'module:initialized'
  | 'module:enabled' 
  | 'module:disabled'
  | 'module:error'
  | 'module:performance-warning'
  | 'viewport:changed'
  | 'beacon:selected'
  | 'map:pressed'
  | 'frame:rendered';

export interface ModuleEventBus {
  emit(event: ModuleEvent, payload: ModuleEventPayload): void;
  subscribe(event: ModuleEvent, callback: (payload: ModuleEventPayload) => void): () => void;
  unsubscribe(event: ModuleEvent, callback: (payload: ModuleEventPayload) => void): void;
}