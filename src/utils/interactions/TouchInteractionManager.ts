/**
 * TouchInteractionManager - Resource Harvesting Touch Interactions
 * 
 * Handles touch/tap interactions for resource collection with visual feedback
 * and state updates. Integrates with the HarvestOverlay system for seamless
 * resource collection experience.
 */

import { StarSystem, ViewportState } from '../../types/galaxy';

export interface TouchInteractionConfig {
  /** Touch target radius for star systems */
  touchRadius: number;
  /** Minimum time between touches (debounce) */
  touchDebounceMs: number;
  /** Visual feedback duration */
  feedbackDurationMs: number;
  /** Haptic feedback enabled */
  hapticFeedback: boolean;
  /** Double-tap detection window */
  doubleTapWindowMs: number;
  /** Long press duration threshold */
  longPressDurationMs: number;
}

export interface TouchEvent {
  id: string;
  position: { x: number; y: number };
  timestamp: number;
  type: 'tap' | 'double_tap' | 'long_press' | 'drag_start' | 'drag_move' | 'drag_end';
  target?: StarSystem;
  duration?: number;
}

export interface HarvestResult {
  success: boolean;
  starSystemId: string;
  resourceType: 'stellarEssence' | 'voidFragments';
  amount: number;
  newStarSystemState?: StarSystem;
}

export interface VisualFeedback {
  id: string;
  position: { x: number; y: number };
  type: 'harvest_success' | 'harvest_fail' | 'touch_ripple' | 'resource_popup';
  duration: number;
  data?: any; // Additional data for specific feedback types
}

/**
 * Main touch interaction manager for resource harvesting
 */
export class TouchInteractionManager {
  private config: TouchInteractionConfig;
  private starSystems: Map<string, StarSystem>;
  private lastTouchTime: number = 0;
  private lastTouchPosition: { x: number; y: number } | null = null;
  private pendingTouch: TouchEvent | null = null;
  private doubleTapTimer: NodeJS.Timeout | null = null;
  private longPressTimer: NodeJS.Timeout | null = null;
  private isDragging: boolean = false;
  private visualFeedbacks: VisualFeedback[] = [];
  private touchEventId: number = 0;

  // Event callbacks
  private onHarvestCallback?: (result: HarvestResult) => void;
  private onVisualFeedbackCallback?: (feedback: VisualFeedback) => void;
  private onTouchEventCallback?: (event: TouchEvent) => void;

  constructor(
    starSystems: StarSystem[],
    config?: Partial<TouchInteractionConfig>
  ) {
    this.starSystems = new Map(starSystems.map(s => [s.id, s]));
    this.config = {
      touchRadius: 30,
      touchDebounceMs: 100,
      feedbackDurationMs: 1000,
      hapticFeedback: true,
      doubleTapWindowMs: 300,
      longPressDurationMs: 500,
      ...config
    };
  }

  /**
   * Set callback for harvest events
   */
  public setHarvestCallback(callback: (result: HarvestResult) => void): void {
    this.onHarvestCallback = callback;
  }

  /**
   * Set callback for visual feedback events
   */
  public setVisualFeedbackCallback(callback: (feedback: VisualFeedback) => void): void {
    this.onVisualFeedbackCallback = callback;
  }

  /**
   * Set callback for touch events
   */
  public setTouchEventCallback(callback: (event: TouchEvent) => void): void {
    this.onTouchEventCallback = callback;
  }

  /**
   * Handle touch start event
   */
  public handleTouchStart(
    screenX: number,
    screenY: number,
    viewportState: ViewportState
  ): void {
    const now = Date.now();
    
    // Convert screen coordinates to world coordinates
    const worldX = (screenX - viewportState.translateX) / viewportState.scale;
    const worldY = (screenY - viewportState.translateY) / viewportState.scale;

    // Check for double-tap
    const isDoubleTap = this.lastTouchPosition &&
      this.lastTouchTime &&
      now - this.lastTouchTime < this.config.doubleTapWindowMs &&
      this.distanceBetweenPoints(
        { x: screenX, y: screenY },
        this.lastTouchPosition
      ) < this.config.touchRadius;

    if (isDoubleTap && this.doubleTapTimer) {
      clearTimeout(this.doubleTapTimer);
      this.doubleTapTimer = null;
      this.handleDoubleTap(screenX, screenY, worldX, worldY);
      return;
    }

    // Store touch info for potential double-tap
    this.lastTouchTime = now;
    this.lastTouchPosition = { x: screenX, y: screenY };

    // Find target star system
    const targetStar = this.findStarSystemAt(worldX, worldY, viewportState);

    // Create touch event
    const touchEvent: TouchEvent = {
      id: `touch_${++this.touchEventId}`,
      position: { x: screenX, y: screenY },
      timestamp: now,
      type: 'tap',
      target: targetStar
    };

    this.pendingTouch = touchEvent;

    // Start long press timer
    this.longPressTimer = setTimeout(() => {
      if (this.pendingTouch && !this.isDragging) {
        this.handleLongPress(touchEvent);
      }
    }, this.config.longPressDurationMs);

    // Set up double-tap detection timer
    this.doubleTapTimer = setTimeout(() => {
      if (this.pendingTouch && !this.isDragging) {
        this.handleSingleTap(this.pendingTouch, worldX, worldY);
      }
      this.doubleTapTimer = null;
      this.pendingTouch = null;
    }, this.config.doubleTapWindowMs);

    // Create touch ripple effect
    this.createVisualFeedback({
      id: `ripple_${touchEvent.id}`,
      position: { x: screenX, y: screenY },
      type: 'touch_ripple',
      duration: 300
    });
  }

  /**
   * Handle touch end event
   */
  public handleTouchEnd(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    if (this.isDragging) {
      this.isDragging = false;
      
      if (this.pendingTouch) {
        const dragEndEvent: TouchEvent = {
          ...this.pendingTouch,
          type: 'drag_end',
          timestamp: Date.now(),
          duration: Date.now() - this.pendingTouch.timestamp
        };
        
        this.emitTouchEvent(dragEndEvent);
      }
    }
  }

  /**
   * Handle touch move event (for drag detection)
   */
  public handleTouchMove(
    screenX: number,
    screenY: number,
    deltaX: number,
    deltaY: number
  ): void {
    const dragDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    if (dragDistance > this.config.touchRadius && !this.isDragging) {
      this.isDragging = true;
      
      // Cancel pending tap/double-tap
      if (this.doubleTapTimer) {
        clearTimeout(this.doubleTapTimer);
        this.doubleTapTimer = null;
      }
      
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }

      if (this.pendingTouch) {
        const dragStartEvent: TouchEvent = {
          ...this.pendingTouch,
          type: 'drag_start',
          timestamp: Date.now()
        };
        
        this.emitTouchEvent(dragStartEvent);
      }
    }

    if (this.isDragging && this.pendingTouch) {
      const dragMoveEvent: TouchEvent = {
        ...this.pendingTouch,
        type: 'drag_move',
        position: { x: screenX, y: screenY },
        timestamp: Date.now()
      };
      
      this.emitTouchEvent(dragMoveEvent);
    }
  }

  /**
   * Handle single tap
   */
  private handleSingleTap(
    touchEvent: TouchEvent,
    worldX: number,
    worldY: number
  ): void {
    if (touchEvent.target && this.canHarvestStarSystem(touchEvent.target)) {
      this.attemptHarvest(touchEvent.target, touchEvent.position);
    }

    this.emitTouchEvent(touchEvent);
  }

  /**
   * Handle double tap
   */
  private handleDoubleTap(
    screenX: number,
    screenY: number,
    worldX: number,
    worldY: number
  ): void {
    const targetStar = this.findStarSystemAt(worldX, worldY, 
      { scale: 1, translateX: 0, translateY: 0, bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 } }
    );

    const doubleTapEvent: TouchEvent = {
      id: `double_tap_${++this.touchEventId}`,
      position: { x: screenX, y: screenY },
      timestamp: Date.now(),
      type: 'double_tap',
      target: targetStar
    };

    // Double-tap can harvest multiple resources or provide enhanced harvest
    if (targetStar && this.canHarvestStarSystem(targetStar)) {
      this.attemptEnhancedHarvest(targetStar, doubleTapEvent.position);
    }

    this.emitTouchEvent(doubleTapEvent);
  }

  /**
   * Handle long press
   */
  private handleLongPress(touchEvent: TouchEvent): void {
    const longPressEvent: TouchEvent = {
      ...touchEvent,
      type: 'long_press',
      timestamp: Date.now(),
      duration: Date.now() - touchEvent.timestamp
    };

    // Long press can show detailed information or provide special actions
    if (longPressEvent.target) {
      this.showStarSystemDetails(longPressEvent.target, longPressEvent.position);
    }

    this.emitTouchEvent(longPressEvent);
  }

  /**
   * Find star system at given world coordinates
   */
  private findStarSystemAt(
    worldX: number,
    worldY: number,
    viewportState: ViewportState
  ): StarSystem | undefined {
    const touchRadiusInWorld = this.config.touchRadius / viewportState.scale;
    
    for (const starSystem of this.starSystems.values()) {
      const distance = this.distanceBetweenPoints(
        { x: worldX, y: worldY },
        starSystem.position
      );
      
      if (distance <= touchRadiusInWorld + starSystem.radius) {
        return starSystem;
      }
    }
    
    return undefined;
  }

  /**
   * Check if star system can be harvested
   */
  private canHarvestStarSystem(starSystem: StarSystem): boolean {
    // Can harvest dying stars (stellar essence) or dead stars (void fragments)
    if (starSystem.state === 'healthy') return false;
    
    // Must have resources available
    const hasResources = starSystem.resources && (
      (starSystem.state === 'dying' && starSystem.resources.stellarEssence! > 0) ||
      (starSystem.state === 'dead' && starSystem.resources.voidFragments! > 0)
    );
    
    return !!hasResources;
  }

  /**
   * Attempt to harvest resources from star system
   */
  private attemptHarvest(starSystem: StarSystem, screenPosition: { x: number; y: number }): void {
    if (!this.canHarvestStarSystem(starSystem)) {
      this.createFailureFeedback(screenPosition);
      return;
    }

    let resourceType: 'stellarEssence' | 'voidFragments';
    let amount: number;

    if (starSystem.state === 'dying' && starSystem.resources?.stellarEssence) {
      resourceType = 'stellarEssence';
      amount = Math.min(5, starSystem.resources.stellarEssence); // Harvest up to 5 at a time
    } else if (starSystem.state === 'dead' && starSystem.resources?.voidFragments) {
      resourceType = 'voidFragments';
      amount = Math.min(3, starSystem.resources.voidFragments); // Harvest up to 3 at a time
    } else {
      this.createFailureFeedback(screenPosition);
      return;
    }

    // Update star system resources
    const updatedStarSystem = { ...starSystem };
    if (resourceType === 'stellarEssence') {
      updatedStarSystem.resources!.stellarEssence! -= amount;
    } else {
      updatedStarSystem.resources!.voidFragments! -= amount;
    }

    // Update internal state
    this.starSystems.set(starSystem.id, updatedStarSystem);

    // Create harvest result
    const harvestResult: HarvestResult = {
      success: true,
      starSystemId: starSystem.id,
      resourceType,
      amount,
      newStarSystemState: updatedStarSystem
    };

    // Emit harvest event
    if (this.onHarvestCallback) {
      this.onHarvestCallback(harvestResult);
    }

    // Create success feedback
    this.createSuccessFeedback(screenPosition, resourceType, amount);
    
    // Haptic feedback if enabled
    if (this.config.hapticFeedback) {
      this.triggerHapticFeedback('light');
    }
  }

  /**
   * Attempt enhanced harvest (double-tap bonus)
   */
  private attemptEnhancedHarvest(starSystem: StarSystem, screenPosition: { x: number; y: number }): void {
    if (!this.canHarvestStarSystem(starSystem)) {
      this.createFailureFeedback(screenPosition);
      return;
    }

    // Enhanced harvest gives 50% more resources
    let resourceType: 'stellarEssence' | 'voidFragments';
    let amount: number;

    if (starSystem.state === 'dying' && starSystem.resources?.stellarEssence) {
      resourceType = 'stellarEssence';
      amount = Math.min(8, Math.floor(starSystem.resources.stellarEssence * 1.5)); // Enhanced harvest
    } else if (starSystem.state === 'dead' && starSystem.resources?.voidFragments) {
      resourceType = 'voidFragments';
      amount = Math.min(5, Math.floor(starSystem.resources.voidFragments * 1.5)); // Enhanced harvest
    } else {
      this.createFailureFeedback(screenPosition);
      return;
    }

    // Update star system (same logic as regular harvest)
    const updatedStarSystem = { ...starSystem };
    if (resourceType === 'stellarEssence') {
      updatedStarSystem.resources!.stellarEssence! -= amount;
    } else {
      updatedStarSystem.resources!.voidFragments! -= amount;
    }

    this.starSystems.set(starSystem.id, updatedStarSystem);

    const harvestResult: HarvestResult = {
      success: true,
      starSystemId: starSystem.id,
      resourceType,
      amount,
      newStarSystemState: updatedStarSystem
    };

    if (this.onHarvestCallback) {
      this.onHarvestCallback(harvestResult);
    }

    // Enhanced success feedback
    this.createSuccessFeedback(screenPosition, resourceType, amount, true);
    
    if (this.config.hapticFeedback) {
      this.triggerHapticFeedback('medium');
    }
  }

  /**
   * Show detailed star system information
   */
  private showStarSystemDetails(starSystem: StarSystem, screenPosition: { x: number; y: number }): void {
    this.createVisualFeedback({
      id: `details_${starSystem.id}_${Date.now()}`,
      position: screenPosition,
      type: 'resource_popup',
      duration: 3000,
      data: {
        starSystem,
        showDetails: true
      }
    });
  }

  /**
   * Create success visual feedback
   */
  private createSuccessFeedback(
    position: { x: number; y: number },
    resourceType: 'stellarEssence' | 'voidFragments',
    amount: number,
    enhanced: boolean = false
  ): void {
    this.createVisualFeedback({
      id: `success_${Date.now()}`,
      position,
      type: 'harvest_success',
      duration: this.config.feedbackDurationMs,
      data: { resourceType, amount, enhanced }
    });
  }

  /**
   * Create failure visual feedback
   */
  private createFailureFeedback(position: { x: number; y: number }): void {
    this.createVisualFeedback({
      id: `failure_${Date.now()}`,
      position,
      type: 'harvest_fail',
      duration: this.config.feedbackDurationMs / 2
    });
  }

  /**
   * Create visual feedback
   */
  private createVisualFeedback(feedback: VisualFeedback): void {
    this.visualFeedbacks.push(feedback);
    
    if (this.onVisualFeedbackCallback) {
      this.onVisualFeedbackCallback(feedback);
    }

    // Auto-remove feedback after duration
    setTimeout(() => {
      this.visualFeedbacks = this.visualFeedbacks.filter(f => f.id !== feedback.id);
    }, feedback.duration);
  }

  /**
   * Emit touch event
   */
  private emitTouchEvent(event: TouchEvent): void {
    if (this.onTouchEventCallback) {
      this.onTouchEventCallback(event);
    }
  }

  /**
   * Calculate distance between two points
   */
  private distanceBetweenPoints(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Trigger haptic feedback (platform-specific implementation needed)
   */
  private triggerHapticFeedback(type: 'light' | 'medium' | 'heavy'): void {
    // Implementation depends on platform (React Native Haptics library)
    console.log(`Haptic feedback: ${type}`);
  }

  /**
   * Update star systems data
   */
  public updateStarSystems(starSystems: StarSystem[]): void {
    this.starSystems.clear();
    starSystems.forEach(s => this.starSystems.set(s.id, s));
  }

  /**
   * Get active visual feedbacks
   */
  public getActiveVisualFeedbacks(): VisualFeedback[] {
    return [...this.visualFeedbacks];
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<TouchInteractionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    if (this.doubleTapTimer) {
      clearTimeout(this.doubleTapTimer);
    }
    
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
    }

    this.visualFeedbacks = [];
    this.starSystems.clear();
  }
}