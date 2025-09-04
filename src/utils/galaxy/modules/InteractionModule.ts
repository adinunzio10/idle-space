import { BaseModule } from './BaseModule';
import { ModuleCategory, ModuleContext, ModuleRenderResult } from './types';
import { Point2D, Beacon } from '../../../types/galaxy';

export interface InteractionResult {
  handled: boolean;
  preventDefault?: boolean;
  data?: any;
}

export abstract class InteractionModule extends BaseModule {
  readonly category: ModuleCategory = 'interaction';

  // Interaction-specific state
  protected isActive = false;
  protected lastInteractionTime = 0;
  protected interactionCooldown = 100; // ms between interactions

  protected async onInitialize(context: ModuleContext): Promise<void> {
    await this.initializeInteractionHandlers(context);
  }

  protected async onEnable(): Promise<void> {
    this.isActive = true;
    await this.enableInteractionHandlers();
  }

  protected async onDisable(): Promise<void> {
    this.isActive = false;
    await this.disableInteractionHandlers();
  }

  protected async onCleanup(): Promise<void> {
    await this.cleanupInteractionHandlers();
  }

  protected onUpdate(context: ModuleContext): void {
    this.updateInteractionState(context);
  }

  protected onRender(context: ModuleContext): ModuleRenderResult {
    // Interaction modules typically don't render visual elements
    // but may render debug overlays or interaction hints
    const elements = this.renderInteractionHints(context);
    
    return {
      elements,
      shouldContinueRendering: true,
      performanceImpact: 'low',
    };
  }

  // Interaction event handlers (to be called by parent component)
  handleBeaconSelect(beacon: Beacon, screenPoint: Point2D): InteractionResult {
    if (!this.canHandleInteraction()) {
      return { handled: false };
    }

    this.lastInteractionTime = Date.now();
    if (this.onBeaconSelect) {
      return this.onBeaconSelect(beacon, screenPoint);
    }
    return { handled: false };
  }

  handleMapPress(galaxyPoint: Point2D, screenPoint: Point2D): InteractionResult {
    if (!this.canHandleInteraction()) {
      return { handled: false };
    }

    this.lastInteractionTime = Date.now();
    if (this.onMapPress) {
      return this.onMapPress(galaxyPoint, screenPoint);
    }
    return { handled: false };
  }

  handleGestureStart(gestureType: 'pan' | 'pinch' | 'tap', point: Point2D): InteractionResult {
    if (!this.canHandleInteraction()) {
      return { handled: false };
    }

    return this.onGestureStart(gestureType, point);
  }

  handleGestureUpdate(gestureType: 'pan' | 'pinch' | 'tap', data: any): InteractionResult {
    if (!this.isActive) {
      return { handled: false };
    }

    return this.onGestureUpdate(gestureType, data);
  }

  handleGestureEnd(gestureType: 'pan' | 'pinch' | 'tap', data: any): InteractionResult {
    if (!this.isActive) {
      return { handled: false };
    }

    const result = this.onGestureEnd(gestureType, data);
    this.lastInteractionTime = Date.now();
    return result;
  }

  // Protected helper methods
  protected canHandleInteraction(): boolean {
    return (
      this.config.enabled &&
      this.isActive &&
      Date.now() - this.lastInteractionTime >= this.interactionCooldown
    );
  }

  // Abstract methods for subclasses
  protected abstract initializeInteractionHandlers(context: ModuleContext): Promise<void> | void;
  protected abstract enableInteractionHandlers(): Promise<void> | void;
  protected abstract disableInteractionHandlers(): Promise<void> | void;
  protected abstract cleanupInteractionHandlers(): Promise<void> | void;

  // Optional hooks with default implementations
  protected updateInteractionState(context: ModuleContext): void {}
  protected renderInteractionHints(context: ModuleContext): React.ReactNode[] { return []; }
  
  onBeaconSelect?(beacon: Beacon, screenPoint?: Point2D): InteractionResult {
    return { handled: false };
  }
  
  onMapPress?(galaxyPoint: Point2D, screenPoint?: Point2D): InteractionResult {
    return { handled: false };
  }
  
  protected onGestureStart(gestureType: 'pan' | 'pinch' | 'tap', point: Point2D): InteractionResult {
    return { handled: false };
  }
  
  protected onGestureUpdate(gestureType: 'pan' | 'pinch' | 'tap', data: any): InteractionResult {
    return { handled: false };
  }
  
  protected onGestureEnd(gestureType: 'pan' | 'pinch' | 'tap', data: any): InteractionResult {
    return { handled: false };
  }
}