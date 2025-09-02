import { useEffect } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { 
  batteryOptimizationManager,
  BatteryOptimizationState,
  BatteryMetrics
} from '../utils/performance/BatteryOptimizationManager';
import { useBatteryOptimization as useBaseBatteryOptimization } from '../utils/performance/BatteryOptimizationManager';

/**
 * Enhanced battery optimization hook that integrates with app settings
 */
export function useBatteryOptimizationWithSettings() {
  const { settings } = useSettings();
  const { state, metrics } = useBaseBatteryOptimization();

  // Sync settings with battery optimization manager
  useEffect(() => {
    if (!batteryOptimizationManager) return;

    const config = {
      enabled: settings.batteryOptimizationEnabled,
      lowBatteryThreshold: settings.lowBatteryThreshold,
      criticalBatteryThreshold: Math.max(0.05, settings.lowBatteryThreshold - 0.15), // 15% below low threshold
      adaptiveFrameRate: settings.adaptiveFrameRateEnabled,
      backgroundThrottling: settings.backgroundThrottlingEnabled,
      visualEffectsReduction: true, // Always enable when optimizing
      batteryEfficientMode: settings.batteryEfficientModeEnabled,
    };

    batteryOptimizationManager.updateConfig(config);
  }, [
    settings.batteryOptimizationEnabled,
    settings.adaptiveFrameRateEnabled,
    settings.lowBatteryThreshold,
    settings.batteryEfficientModeEnabled,
    settings.backgroundThrottlingEnabled,
  ]);

  return {
    state,
    metrics,
    isOptimizationEnabled: settings.batteryOptimizationEnabled,
    recommendations: batteryOptimizationManager.getOptimizationRecommendations(),
  };
}

/**
 * Hook for battery-aware visual effects
 * Returns whether visual effects should be enabled based on battery state
 */
export function useBatteryAwareVisualEffects() {
  const { state } = useBatteryOptimizationWithSettings();

  return {
    enableVisualEffects: state.visualEffectsEnabled,
    enableParticleEffects: state.visualEffectsEnabled && state.batteryLevel > 0.3,
    enableGlowEffects: state.visualEffectsEnabled && state.batteryLevel > 0.2,
    enableAnimations: state.visualEffectsEnabled || state.currentOptimizationLevel === 'none',
    animationScale: state.currentOptimizationLevel === 'high' ? 0.5 : 1.0,
  };
}

/**
 * Hook for battery-aware performance settings
 * Returns performance settings adjusted for battery state
 */
export function useBatteryAwarePerformance() {
  const { state } = useBatteryOptimizationWithSettings();

  return {
    targetFrameRate: state.targetFrameRate,
    backgroundProcessingScale: state.backgroundProcessingScale,
    shouldThrottleUpdates: state.currentOptimizationLevel !== 'none',
    updateInterval: state.currentOptimizationLevel === 'high' ? 2000 : 1000, // ms
    enableLOD: state.currentOptimizationLevel !== 'none',
    lodDistance: state.currentOptimizationLevel === 'high' ? 0.5 : 0.75, // multiplier for LOD distances
  };
}