import { BaseModule } from './BaseModule';
import { ModuleCategory, ModuleContext, ModuleRenderResult } from './types';

export interface PerformanceStrategy {
  name: string;
  description: string;
  apply(context: ModuleContext): void;
  revert(context: ModuleContext): void;
  isApplicable(context: ModuleContext): boolean;
}

export abstract class PerformanceModule extends BaseModule {
  readonly category: ModuleCategory = 'performance';

  protected strategies: PerformanceStrategy[] = [];
  protected activeStrategies = new Set<string>();
  protected performanceTargetFps = 60;
  protected performanceThresholds = {
    critical: 20,  // FPS below which aggressive measures are taken
    warning: 40,   // FPS below which warnings are issued
    optimal: 55,   // FPS above which optimizations can be relaxed
  };

  protected async onInitialize(context: ModuleContext): Promise<void> {
    await this.initializePerformanceSystem(context);
    this.registerPerformanceStrategies();
  }

  protected async onEnable(): Promise<void> {
    await this.enablePerformanceMonitoring();
  }

  protected async onDisable(): Promise<void> {
    await this.disablePerformanceMonitoring();
    this.revertAllStrategies();
  }

  protected async onCleanup(): Promise<void> {
    await this.cleanupPerformanceSystem();
  }

  protected onUpdate(context: ModuleContext): void {
    this.monitorPerformance(context);
    this.adaptPerformanceStrategies(context);
  }

  protected onRender(context: ModuleContext): ModuleRenderResult {
    // Performance modules typically don't render visual elements
    // but may render debug overlays or performance indicators
    const elements = this.renderPerformanceOverlay(context);
    
    return {
      elements,
      shouldContinueRendering: true,
      performanceImpact: 'low',
    };
  }

  // Performance strategy management
  protected registerStrategy(strategy: PerformanceStrategy): void {
    this.strategies.push(strategy);
  }

  protected applyStrategy(strategyName: string, context: ModuleContext): void {
    const strategy = this.strategies.find(s => s.name === strategyName);
    if (!strategy || this.activeStrategies.has(strategyName)) return;

    if (strategy.isApplicable(context)) {
      strategy.apply(context);
      this.activeStrategies.add(strategyName);
      this.logDebug(`Applied performance strategy: ${strategyName}`);
    }
  }

  protected revertStrategy(strategyName: string, context: ModuleContext): void {
    const strategy = this.strategies.find(s => s.name === strategyName);
    if (!strategy || !this.activeStrategies.has(strategyName)) return;

    strategy.revert(context);
    this.activeStrategies.delete(strategyName);
    this.logDebug(`Reverted performance strategy: ${strategyName}`);
  }

  protected revertAllStrategies(): void {
    // Note: We can't provide context here, so strategies should be self-contained for revert
    for (const strategyName of this.activeStrategies) {
      const strategy = this.strategies.find(s => s.name === strategyName);
      if (strategy) {
        try {
          strategy.revert({} as ModuleContext); // Empty context for cleanup
        } catch (error) {
          console.error(`Error reverting strategy ${strategyName}:`, error);
        }
      }
    }
    this.activeStrategies.clear();
  }

  // Performance monitoring
  protected monitorPerformance(context: ModuleContext): void {
    const currentFps = this.metrics.averageFps;
    
    // Issue warnings or take action based on performance thresholds
    if (currentFps < this.performanceThresholds.critical) {
      this.handleCriticalPerformance(context);
    } else if (currentFps < this.performanceThresholds.warning) {
      this.handleWarningPerformance(context);
    } else if (currentFps > this.performanceThresholds.optimal) {
      this.handleOptimalPerformance(context);
    }
  }

  protected adaptPerformanceStrategies(context: ModuleContext): void {
    // Automatically apply/revert strategies based on current performance
    for (const strategy of this.strategies) {
      const shouldApply = strategy.isApplicable(context);
      const isActive = this.activeStrategies.has(strategy.name);
      
      if (shouldApply && !isActive) {
        this.applyStrategy(strategy.name, context);
      } else if (!shouldApply && isActive) {
        this.revertStrategy(strategy.name, context);
      }
    }
  }

  // Performance response handlers
  protected handleCriticalPerformance(context: ModuleContext): void {
    this.logDebug(`Critical performance detected: ${this.metrics.averageFps} FPS`);
    // Subclasses can override to implement critical performance responses
  }

  protected handleWarningPerformance(context: ModuleContext): void {
    this.logDebug(`Warning performance detected: ${this.metrics.averageFps} FPS`);
    // Subclasses can override to implement warning performance responses
  }

  protected handleOptimalPerformance(context: ModuleContext): void {
    // Subclasses can override to implement optimal performance responses
    // (e.g., re-enable visual effects, increase quality)
  }

  // Abstract methods for subclasses
  protected abstract initializePerformanceSystem(context: ModuleContext): Promise<void> | void;
  protected abstract enablePerformanceMonitoring(): Promise<void> | void;
  protected abstract disablePerformanceMonitoring(): Promise<void> | void;
  protected abstract cleanupPerformanceSystem(): Promise<void> | void;
  protected abstract registerPerformanceStrategies(): void;
  
  // Optional hooks
  protected renderPerformanceOverlay(context: ModuleContext): React.ReactNode[] { return []; }
}