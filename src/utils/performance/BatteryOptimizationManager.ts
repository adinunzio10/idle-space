import * as Battery from 'expo-battery';
import { AppState, AppStateStatus } from 'react-native';
import { fpsMonitor, ReactNativePerformanceMonitor } from './FPSMonitor';

export interface BatteryOptimizationConfig {
  enabled: boolean;
  lowBatteryThreshold: number; // Battery percentage (0-1)
  criticalBatteryThreshold: number; // Battery percentage (0-1)
  adaptiveFrameRate: boolean;
  backgroundThrottling: boolean;
  visualEffectsReduction: boolean;
  batteryEfficientMode: boolean;
}

export interface BatteryOptimizationState {
  batteryLevel: number;
  batteryState: Battery.BatteryState;
  isLowPowerMode: boolean;
  isBatteryOptimized: boolean;
  currentOptimizationLevel: 'none' | 'low' | 'medium' | 'high';
  targetFrameRate: number;
  visualEffectsEnabled: boolean;
  backgroundProcessingScale: number;
}

export interface BatteryMetrics {
  batteryLevel: number;
  batteryState: string;
  isCharging: boolean;
  estimatedTimeRemaining?: number;
  powerConsumption: 'low' | 'medium' | 'high';
  optimizationLevel: string;
  performanceImpact: number; // 0-1 scale
}

type BatteryOptimizationCallback = (state: BatteryOptimizationState) => void;

/**
 * Battery Optimization Manager for Signal Garden
 * Monitors battery level and adjusts game performance accordingly
 */
export class BatteryOptimizationManager {
  private static instance: BatteryOptimizationManager | null = null;
  
  private config: BatteryOptimizationConfig = {
    enabled: true,
    lowBatteryThreshold: 0.25, // 25%
    criticalBatteryThreshold: 0.10, // 10%
    adaptiveFrameRate: true,
    backgroundThrottling: true,
    visualEffectsReduction: true,
    batteryEfficientMode: false,
  };
  
  private state: BatteryOptimizationState = {
    batteryLevel: 1.0,
    batteryState: Battery.BatteryState.UNKNOWN,
    isLowPowerMode: false,
    isBatteryOptimized: false,
    currentOptimizationLevel: 'none',
    targetFrameRate: 60,
    visualEffectsEnabled: true,
    backgroundProcessingScale: 1.0,
  };
  
  private callbacks: Set<BatteryOptimizationCallback> = new Set();
  private isInitialized: boolean = false;
  private updateTimer: NodeJS.Timeout | null = null;
  private batteryUpdateSubscription: any = null;
  private appStateSubscription: any = null;
  private performanceMonitor: ReactNativePerformanceMonitor;
  
  // Performance tracking
  private performanceHistory: Array<{ timestamp: number; fps: number; batteryLevel: number }> = [];
  private lastPerformanceUpdate: number = 0;
  
  private constructor() {
    this.performanceMonitor = fpsMonitor;
  }
  
  static getInstance(): BatteryOptimizationManager {
    if (!BatteryOptimizationManager.instance) {
      BatteryOptimizationManager.instance = new BatteryOptimizationManager();
    }
    return BatteryOptimizationManager.instance;
  }
  
  /**
   * Initialize battery optimization system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      // Check if battery API is available
      const batteryLevel = await Battery.getBatteryLevelAsync();
      const batteryState = await Battery.getBatteryStateAsync();
      const isLowPowerMode = await Battery.isLowPowerModeEnabledAsync();
      
      this.state.batteryLevel = batteryLevel;
      this.state.batteryState = batteryState;
      this.state.isLowPowerMode = isLowPowerMode;
      
      // Set up battery level monitoring
      this.batteryUpdateSubscription = Battery.addBatteryLevelListener(this.handleBatteryLevelChange);
      
      // Set up app state monitoring
      this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
      
      // Set up performance monitoring integration
      this.performanceMonitor.addCallback(this.handlePerformanceUpdate);
      
      // Start periodic updates
      this.startPeriodicUpdates();
      
      // Initial optimization assessment
      await this.assessOptimizationNeeds();
      
      this.isInitialized = true;
      console.log('[BatteryOptimization] Initialized successfully');
      
    } catch (error) {
      console.warn('[BatteryOptimization] Failed to initialize:', error);
      // Continue with limited functionality
      this.isInitialized = true;
    }
  }
  
  /**
   * Shutdown battery optimization
   */
  shutdown(): void {
    if (this.batteryUpdateSubscription) {
      this.batteryUpdateSubscription.remove();
    }
    
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
    
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
    
    this.performanceMonitor.removeCallback(this.handlePerformanceUpdate);
    
    this.callbacks.clear();
    this.isInitialized = false;
  }
  
  /**
   * Update battery optimization configuration
   */
  updateConfig(updates: Partial<BatteryOptimizationConfig>): void {
    this.config = { ...this.config, ...updates };
    
    if (this.isInitialized) {
      this.assessOptimizationNeeds();
    }
  }
  
  /**
   * Get current battery optimization state
   */
  getState(): BatteryOptimizationState {
    return { ...this.state };
  }
  
  /**
   * Get battery metrics for monitoring
   */
  getMetrics(): BatteryMetrics {
    return {
      batteryLevel: this.state.batteryLevel,
      batteryState: this.getBatteryStateString(),
      isCharging: this.state.batteryState === Battery.BatteryState.CHARGING,
      estimatedTimeRemaining: this.estimateTimeRemaining(),
      powerConsumption: this.assessPowerConsumption(),
      optimizationLevel: this.state.currentOptimizationLevel,
      performanceImpact: this.calculatePerformanceImpact(),
    };
  }
  
  /**
   * Add callback for battery optimization state changes
   */
  addCallback(callback: BatteryOptimizationCallback): void {
    this.callbacks.add(callback);
  }
  
  /**
   * Remove callback
   */
  removeCallback(callback: BatteryOptimizationCallback): void {
    this.callbacks.delete(callback);
  }
  
  /**
   * Force battery-efficient mode on/off
   */
  setBatteryEfficientMode(enabled: boolean): void {
    this.config.batteryEfficientMode = enabled;
    this.assessOptimizationNeeds();
  }
  
  /**
   * Get optimization recommendations based on current state
   */
  getOptimizationRecommendations(): Array<{
    type: 'framerate' | 'visuals' | 'background' | 'general';
    message: string;
    impact: 'low' | 'medium' | 'high';
  }> {
    const recommendations = [];
    
    if (this.state.batteryLevel < this.config.lowBatteryThreshold) {
      recommendations.push({
        type: 'framerate' as const,
        message: 'Reduce frame rate to 30fps to save battery',
        impact: 'medium' as const,
      });
      
      recommendations.push({
        type: 'visuals' as const,
        message: 'Disable visual effects and animations',
        impact: 'high' as const,
      });
    }
    
    if (this.state.batteryLevel < this.config.criticalBatteryThreshold) {
      recommendations.push({
        type: 'background' as const,
        message: 'Severely limit background processing',
        impact: 'high' as const,
      });
      
      recommendations.push({
        type: 'general' as const,
        message: 'Enable battery-efficient mode',
        impact: 'high' as const,
      });
    }
    
    const fps = this.performanceMonitor.getCurrentFPS();
    if (fps < 45 && this.state.batteryLevel < 0.5) {
      recommendations.push({
        type: 'general' as const,
        message: 'Poor performance detected - enable battery optimization',
        impact: 'medium' as const,
      });
    }
    
    return recommendations;
  }
  
  /**
   * Handle battery level changes
   */
  private handleBatteryLevelChange = ({ batteryLevel }: { batteryLevel: number }) => {
    const previousLevel = this.state.batteryLevel;
    this.state.batteryLevel = batteryLevel;
    
    // Significant battery level change triggers reassessment
    if (Math.abs(batteryLevel - previousLevel) > 0.05) {
      this.assessOptimizationNeeds();
    }
  };
  
  /**
   * Handle app state changes
   */
  private handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (nextAppState === 'background' && this.config.backgroundThrottling) {
      // Increase background processing throttling
      this.state.backgroundProcessingScale = Math.min(0.5, this.state.backgroundProcessingScale);
      this.notifyCallbacks();
    } else if (nextAppState === 'active') {
      // Restore normal processing when app becomes active
      this.assessOptimizationNeeds();
    }
  };
  
  /**
   * Handle performance updates from FPS monitor
   */
  private handlePerformanceUpdate = (fps: number, frameTime: number) => {
    const now = Date.now();
    
    // Only update every 5 seconds to avoid excessive processing
    if (now - this.lastPerformanceUpdate < 5000) return;
    
    this.performanceHistory.push({
      timestamp: now,
      fps,
      batteryLevel: this.state.batteryLevel,
    });
    
    // Keep only last 10 minutes of data
    const cutoff = now - (10 * 60 * 1000);
    this.performanceHistory = this.performanceHistory.filter(entry => entry.timestamp > cutoff);
    
    this.lastPerformanceUpdate = now;
    
    // Adaptive optimization based on performance trends
    if (this.config.adaptiveFrameRate) {
      this.adaptFrameRateBasedOnPerformance(fps);
    }
  };
  
  /**
   * Start periodic battery and optimization updates
   */
  private startPeriodicUpdates(): void {
    this.updateTimer = setInterval(async () => {
      try {
        // Update battery state
        const batteryState = await Battery.getBatteryStateAsync();
        const isLowPowerMode = await Battery.isLowPowerModeEnabledAsync();
        
        this.state.batteryState = batteryState;
        this.state.isLowPowerMode = isLowPowerMode;
        
        // Periodic optimization assessment
        this.assessOptimizationNeeds();
        
      } catch (error) {
        console.warn('[BatteryOptimization] Periodic update failed:', error);
      }
    }, 30000); // Update every 30 seconds
  }
  
  /**
   * Assess optimization needs based on current conditions
   */
  private assessOptimizationNeeds(): void {
    const previousOptimizationLevel = this.state.currentOptimizationLevel;
    const previousTargetFrameRate = this.state.targetFrameRate;
    const previousVisualEffectsEnabled = this.state.visualEffectsEnabled;
    const previousBackgroundProcessingScale = this.state.backgroundProcessingScale;
    
    // Determine optimization level
    if (this.config.batteryEfficientMode || 
        this.state.batteryLevel < this.config.criticalBatteryThreshold ||
        this.state.isLowPowerMode) {
      this.state.currentOptimizationLevel = 'high';
    } else if (this.state.batteryLevel < this.config.lowBatteryThreshold) {
      this.state.currentOptimizationLevel = 'medium';
    } else {
      const avgFps = this.getAverageFPS();
      if (avgFps < 45 && this.state.batteryLevel < 0.5) {
        this.state.currentOptimizationLevel = 'low';
      } else {
        this.state.currentOptimizationLevel = 'none';
      }
    }
    
    // Apply optimizations based on level
    switch (this.state.currentOptimizationLevel) {
      case 'high':
        this.state.targetFrameRate = 30;
        this.state.visualEffectsEnabled = false;
        this.state.backgroundProcessingScale = 0.25;
        break;
      case 'medium':
        this.state.targetFrameRate = 45;
        this.state.visualEffectsEnabled = false;
        this.state.backgroundProcessingScale = 0.5;
        break;
      case 'low':
        this.state.targetFrameRate = 50;
        this.state.visualEffectsEnabled = true;
        this.state.backgroundProcessingScale = 0.75;
        break;
      case 'none':
      default:
        this.state.targetFrameRate = 60;
        this.state.visualEffectsEnabled = true;
        this.state.backgroundProcessingScale = 1.0;
        break;
    }
    
    this.state.isBatteryOptimized = this.state.currentOptimizationLevel !== 'none';
    
    // Notify callbacks if significant changes occurred
    if (previousOptimizationLevel !== this.state.currentOptimizationLevel ||
        previousTargetFrameRate !== this.state.targetFrameRate ||
        previousVisualEffectsEnabled !== this.state.visualEffectsEnabled ||
        Math.abs(previousBackgroundProcessingScale - this.state.backgroundProcessingScale) > 0.1) {
      this.notifyCallbacks();
    }
  }
  
  /**
   * Adapt frame rate based on performance trends
   */
  private adaptFrameRateBasedOnPerformance(currentFps: number): void {
    if (!this.config.adaptiveFrameRate) return;
    
    const avgFps = this.getAverageFPS();
    
    // If consistently below target, reduce target frame rate
    if (avgFps < this.state.targetFrameRate - 10 && this.state.batteryLevel < 0.8) {
      this.state.targetFrameRate = Math.max(30, this.state.targetFrameRate - 5);
    }
    // If consistently above target and battery is good, can increase target
    else if (avgFps > this.state.targetFrameRate + 5 && this.state.batteryLevel > 0.6) {
      this.state.targetFrameRate = Math.min(60, this.state.targetFrameRate + 5);
    }
  }
  
  /**
   * Get average FPS from recent performance history
   */
  private getAverageFPS(): number {
    if (this.performanceHistory.length === 0) return 60;
    
    const recentEntries = this.performanceHistory.slice(-5); // Last 5 entries
    const avgFps = recentEntries.reduce((sum, entry) => sum + entry.fps, 0) / recentEntries.length;
    return avgFps;
  }
  
  /**
   * Estimate remaining battery time based on current usage
   */
  private estimateTimeRemaining(): number | undefined {
    if (this.performanceHistory.length < 2) return undefined;
    
    const now = Date.now();
    const recentEntries = this.performanceHistory.slice(-5);
    
    if (recentEntries.length < 2) return undefined;
    
    const timeSpan = recentEntries[recentEntries.length - 1].timestamp - recentEntries[0].timestamp;
    const batteryDrop = recentEntries[0].batteryLevel - recentEntries[recentEntries.length - 1].batteryLevel;
    
    if (batteryDrop <= 0 || timeSpan <= 0) return undefined;
    
    const drainRate = batteryDrop / (timeSpan / 1000 / 60); // % per minute
    const estimatedMinutes = this.state.batteryLevel / drainRate;
    
    return estimatedMinutes > 0 ? estimatedMinutes : undefined;
  }
  
  /**
   * Assess current power consumption level
   */
  private assessPowerConsumption(): 'low' | 'medium' | 'high' {
    const fps = this.getAverageFPS();
    
    if (fps >= 55 && this.state.visualEffectsEnabled) {
      return 'high';
    } else if (fps >= 40) {
      return 'medium';
    } else {
      return 'low';
    }
  }
  
  /**
   * Calculate performance impact of current optimizations
   */
  private calculatePerformanceImpact(): number {
    let impact = 0;
    
    // Frame rate impact
    const frameRateReduction = (60 - this.state.targetFrameRate) / 60;
    impact += frameRateReduction * 0.4;
    
    // Visual effects impact
    if (!this.state.visualEffectsEnabled) {
      impact += 0.3;
    }
    
    // Background processing impact
    const backgroundReduction = 1.0 - this.state.backgroundProcessingScale;
    impact += backgroundReduction * 0.3;
    
    return Math.min(1.0, impact);
  }
  
  /**
   * Get battery state as human-readable string
   */
  private getBatteryStateString(): string {
    switch (this.state.batteryState) {
      case Battery.BatteryState.UNPLUGGED:
        return 'unplugged';
      case Battery.BatteryState.CHARGING:
        return 'charging';
      case Battery.BatteryState.FULL:
        return 'full';
      default:
        return 'unknown';
    }
  }
  
  /**
   * Notify all registered callbacks
   */
  private notifyCallbacks(): void {
    this.callbacks.forEach(callback => {
      try {
        callback(this.state);
      } catch (error) {
        console.warn('[BatteryOptimization] Callback error:', error);
      }
    });
  }
}

/**
 * Global battery optimization manager instance
 */
export const batteryOptimizationManager = BatteryOptimizationManager.getInstance();

/**
 * React hook for battery optimization monitoring
 */
import * as React from 'react';

export function useBatteryOptimization() {
  const [state, setState] = React.useState(() => batteryOptimizationManager.getState());
  const [metrics, setMetrics] = React.useState(() => batteryOptimizationManager.getMetrics());

  React.useEffect(() => {
    const callback = (newState: BatteryOptimizationState) => {
      setState(newState);
      setMetrics(batteryOptimizationManager.getMetrics());
    };

    batteryOptimizationManager.addCallback(callback);
    
    // Initialize if not already done
    batteryOptimizationManager.initialize();

    return () => {
      batteryOptimizationManager.removeCallback(callback);
    };
  }, []);

  return { state, metrics };
}