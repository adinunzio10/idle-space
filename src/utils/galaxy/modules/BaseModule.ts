import {
  GalaxyMapModule,
  ModuleCategory,
  ModuleConfiguration,
  ModulePerformanceMetrics,
  ModuleContext,
  ModuleRenderResult,
} from './types';

export abstract class BaseModule implements GalaxyMapModule {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly version: string;
  abstract readonly category: ModuleCategory;
  readonly dependencies: string[] = [];

  config: ModuleConfiguration = {
    enabled: true,
    priority: 5,
    performanceMode: false,
    debugMode: false,
  };

  metrics: ModulePerformanceMetrics = {
    renderTime: 0,
    lastFrameTime: 0,
    averageFps: 60,
    skipFrames: 0,
  };

  private isInitialized = false;
  private frameHistory: number[] = [];

  async initialize(context: ModuleContext): Promise<void> {
    if (this.isInitialized) return;
    
    await this.onInitialize(context);
    this.isInitialized = true;
    this.logDebug(`Module ${this.name} initialized`);
  }

  async enable(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error(`Module ${this.name} must be initialized before enabling`);
    }
    
    this.config.enabled = true;
    await this.onEnable();
    this.logDebug(`Module ${this.name} enabled`);
  }

  async disable(): Promise<void> {
    this.config.enabled = false;
    await this.onDisable();
    this.logDebug(`Module ${this.name} disabled`);
  }

  async cleanup(): Promise<void> {
    await this.onCleanup();
    this.isInitialized = false;
    this.logDebug(`Module ${this.name} cleaned up`);
  }

  update(context: ModuleContext): void {
    if (!this.config.enabled) return;
    
    const startTime = performance.now();
    this.onUpdate(context);
    
    this.updatePerformanceMetrics(startTime);
  }

  render(context: ModuleContext): ModuleRenderResult {
    if (!this.config.enabled) {
      return {
        elements: [],
        shouldContinueRendering: false,
        performanceImpact: 'low',
      };
    }

    if (this.shouldSkipFrame(context)) {
      this.metrics.skipFrames++;
      return {
        elements: [],
        shouldContinueRendering: true,
        performanceImpact: 'low',
      };
    }

    const startTime = performance.now();
    const result = this.onRender(context);
    
    this.updatePerformanceMetrics(startTime);
    return result;
  }

  updateConfig(newConfig: Partial<ModuleConfiguration>): void {
    this.config = { ...this.config, ...newConfig };
    this.onConfigUpdate(this.config);
    this.logDebug(`Module ${this.name} config updated`, newConfig);
  }

  getPerformanceMetrics(): ModulePerformanceMetrics {
    return { ...this.metrics };
  }

  shouldSkipFrame(context: ModuleContext): boolean {
    // Skip frames if performance mode is enabled and FPS is low
    if (this.config.performanceMode && this.metrics.averageFps < 30) {
      return context.frameCount % 2 === 0; // Skip every other frame
    }
    
    // Skip frames if render time is consistently high
    if (this.metrics.renderTime > 16.67) { // > 60fps budget
      return context.frameCount % 3 === 0; // Skip 2 out of 3 frames
    }
    
    return false;
  }

  private updatePerformanceMetrics(startTime: number): void {
    const now = performance.now();
    this.metrics.renderTime = now - startTime;
    this.metrics.lastFrameTime = now;
    
    // Update FPS calculation with rolling average
    this.frameHistory.push(this.metrics.renderTime);
    if (this.frameHistory.length > 30) {
      this.frameHistory.shift();
    }
    
    const avgRenderTime = this.frameHistory.reduce((a, b) => a + b, 0) / this.frameHistory.length;
    this.metrics.averageFps = Math.min(60, 1000 / Math.max(16.67, avgRenderTime));
  }

  protected logDebug(message: string, data?: any): void {
    if (this.config.debugMode) {
      console.log(`[${this.name}] ${message}`, data || '');
    }
  }

  // Abstract methods that subclasses must implement
  protected abstract onInitialize(context: ModuleContext): Promise<void> | void;
  protected abstract onEnable(): Promise<void> | void;
  protected abstract onDisable(): Promise<void> | void;
  protected abstract onCleanup(): Promise<void> | void;
  protected abstract onUpdate(context: ModuleContext): void;
  protected abstract onRender(context: ModuleContext): ModuleRenderResult;
  
  // Optional hooks
  protected onConfigUpdate(config: ModuleConfiguration): void {}
}