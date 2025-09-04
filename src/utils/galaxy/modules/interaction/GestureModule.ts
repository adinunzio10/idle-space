import { InteractionModule, InteractionResult } from '../InteractionModule';
import { ModuleContext } from '../types';
import { Point2D, Beacon } from '../../../../types/galaxy';

export class GestureModule extends InteractionModule {
  readonly id = 'gesture-handling';
  readonly name = 'Gesture Handling';
  readonly version = '1.0.0';

  // Gesture state
  private activeGestures = new Set<string>();
  private gestureHistory: { type: string; timestamp: number }[] = [];

  protected async initializeInteractionHandlers(context: ModuleContext): Promise<void> {
    this.logDebug('Initializing gesture handlers');
  }

  protected async enableInteractionHandlers(): Promise<void> {
    this.logDebug('Enabling gesture handlers');
  }

  protected async disableInteractionHandlers(): Promise<void> {
    this.logDebug('Disabling gesture handlers');
    this.activeGestures.clear();
  }

  protected async cleanupInteractionHandlers(): Promise<void> {
    this.logDebug('Cleaning up gesture handlers');
    this.gestureHistory = [];
  }

  protected updateInteractionState(context: ModuleContext): void {
    // Clean up old gesture history
    const now = Date.now();
    this.gestureHistory = this.gestureHistory.filter(
      entry => now - entry.timestamp < 1000
    );
  }

  // Implement parent class abstract methods
  protected onGestureStart(gestureType: 'pan' | 'pinch' | 'tap', point: Point2D): InteractionResult {
    if (this.activeGestures.has(gestureType)) {
      return { handled: false };
    }

    this.activeGestures.add(gestureType);
    this.gestureHistory.push({
      type: `${gestureType}:start`,
      timestamp: Date.now(),
    });

    this.logDebug(`Gesture started: ${gestureType}`, point);

    return {
      handled: true,
      data: { gestureType, point },
    };
  }

  protected onGestureUpdate(gestureType: 'pan' | 'pinch' | 'tap', data: any): InteractionResult {
    if (!this.activeGestures.has(gestureType)) {
      return { handled: false };
    }

    // Track gesture frequency for performance monitoring
    const recentGestures = this.gestureHistory.filter(
      entry => Date.now() - entry.timestamp < 100
    ).length;

    // If too many gestures, suggest throttling
    const shouldThrottle = recentGestures > 10;

    return {
      handled: true,
      data: { gestureType, shouldThrottle, ...data },
    };
  }

  protected onGestureEnd(gestureType: 'pan' | 'pinch' | 'tap', data: any): InteractionResult {
    this.activeGestures.delete(gestureType);
    this.gestureHistory.push({
      type: `${gestureType}:end`,
      timestamp: Date.now(),
    });

    this.logDebug(`Gesture ended: ${gestureType}`, data);

    return {
      handled: true,
      data: { gestureType, ...data },
    };
  }

  // Implement GalaxyMapModule interface methods
  onBeaconSelect?(beacon: Beacon, screenPoint?: Point2D): InteractionResult {
    this.logDebug(`Beacon selected: ${beacon.id}`, { beacon, screenPoint });
    
    return {
      handled: true,
      data: { beacon, screenPoint },
    };
  }

  onMapPress?(galaxyPoint: Point2D, screenPoint?: Point2D): InteractionResult {
    this.logDebug(`Map pressed`, { galaxyPoint, screenPoint });
    
    return {
      handled: true,
      data: { galaxyPoint, screenPoint },
    };
  }

  // Gesture state queries
  isGestureActive(gestureType: 'pan' | 'pinch' | 'tap'): boolean {
    return this.activeGestures.has(gestureType);
  }

  getActiveGestures(): string[] {
    return Array.from(this.activeGestures);
  }

  getGestureFrequency(): number {
    const recent = this.gestureHistory.filter(
      entry => Date.now() - entry.timestamp < 1000
    );
    return recent.length;
  }

  // Performance monitoring
  shouldThrottleGestures(): boolean {
    return this.getGestureFrequency() > 20; // More than 20 gestures per second
  }
}