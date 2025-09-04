import React from 'react';
import { BaseModule } from './BaseModule';
import { ModuleCategory, ModuleContext, ModuleRenderResult } from './types';
import { ViewportState } from '../../../types/galaxy';

export abstract class RenderingModule extends BaseModule {
  readonly category: ModuleCategory = 'rendering';

  // Rendering-specific configuration
  protected lodEnabled = true;
  protected cullingEnabled = true;
  protected lastRenderFrame = 0;
  protected skipFrameThreshold = 3; // Skip rendering every N frames when performance is low

  protected async onInitialize(context: ModuleContext): Promise<void> {
    await this.initializeRenderingResources(context);
  }

  protected async onEnable(): Promise<void> {
    await this.enableRendering();
  }

  protected async onDisable(): Promise<void> {
    await this.disableRendering();
  }

  protected async onCleanup(): Promise<void> {
    await this.cleanupRenderingResources();
  }

  protected onUpdate(context: ModuleContext): void {
    // Update rendering state based on viewport changes
    this.updateRenderingState(context);
    
    // Update any animations or time-based effects
    this.updateAnimations(context);
    
    // Perform any necessary culling or LOD calculations
    this.updateLevelOfDetail(context);
  }

  protected onRender(context: ModuleContext): ModuleRenderResult {
    // Check if we should skip this frame for performance
    if (this.shouldSkipRenderingFrame(context)) {
      return {
        elements: [],
        shouldContinueRendering: true,
        performanceImpact: 'low',
      };
    }

    // Perform rendering
    const elements = this.renderElements(context);
    const performanceImpact = this.calculatePerformanceImpact(context, elements.length);

    this.lastRenderFrame = context.frameCount;

    return {
      elements,
      shouldContinueRendering: true,
      performanceImpact,
    };
  }

  // Abstract methods for subclasses to implement
  protected abstract initializeRenderingResources(context: ModuleContext): Promise<void> | void;
  protected abstract enableRendering(): Promise<void> | void;
  protected abstract disableRendering(): Promise<void> | void;
  protected abstract cleanupRenderingResources(): Promise<void> | void;
  protected abstract renderElements(context: ModuleContext): React.ReactNode[];
  
  // Optional hooks with default implementations
  protected updateRenderingState(context: ModuleContext): void {}
  protected updateAnimations(context: ModuleContext): void {}
  protected updateLevelOfDetail(context: ModuleContext): void {}

  // Rendering utilities
  protected shouldSkipRenderingFrame(context: ModuleContext): boolean {
    // Base skip frame logic
    if (super.shouldSkipFrame(context)) return true;
    
    // Skip if we just rendered recently and performance is poor
    if (this.config.performanceMode && 
        context.frameCount - this.lastRenderFrame < this.skipFrameThreshold) {
      return this.metrics.averageFps < 45;
    }

    return false;
  }

  protected calculatePerformanceImpact(context: ModuleContext, elementCount: number): 'low' | 'medium' | 'high' {
    if (elementCount === 0) return 'low';
    if (elementCount < 10) return 'low';
    if (elementCount < 50) return 'medium';
    return 'high';
  }

  protected isElementVisible(
    elementPosition: { x: number; y: number },
    elementSize: number,
    viewport: ViewportState
  ): boolean {
    if (!this.cullingEnabled) return true;

    const margin = elementSize * 2; // Add margin for smooth transitions
    return (
      elementPosition.x + margin >= viewport.bounds.minX &&
      elementPosition.x - margin <= viewport.bounds.maxX &&
      elementPosition.y + margin >= viewport.bounds.minY &&
      elementPosition.y - margin <= viewport.bounds.maxY
    );
  }

  protected getLODLevel(
    elementPosition: { x: number; y: number },
    viewport: ViewportState
  ): number {
    if (!this.lodEnabled) return 1;

    // Calculate distance from viewport center
    const centerX = (viewport.bounds.minX + viewport.bounds.maxX) / 2;
    const centerY = (viewport.bounds.minY + viewport.bounds.maxY) / 2;
    const distance = Math.sqrt(
      Math.pow(elementPosition.x - centerX, 2) + Math.pow(elementPosition.y - centerY, 2)
    );

    // Adjust LOD based on zoom and distance
    const normalizedDistance = distance / viewport.scale;
    
    if (viewport.scale > 2) return 3; // High zoom = high detail
    if (viewport.scale > 1) return 2; // Medium zoom = medium detail
    if (normalizedDistance > 500) return 0; // Far away = no detail
    return 1; // Default detail
  }

  // Performance helper methods
  protected enableLOD(): void {
    this.lodEnabled = true;
  }

  protected disableLOD(): void {
    this.lodEnabled = false;
  }

  protected enableCulling(): void {
    this.cullingEnabled = true;
  }

  protected disableCulling(): void {
    this.cullingEnabled = false;
  }
}