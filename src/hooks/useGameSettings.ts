import { useEffect } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { GameController } from '../core/GameController';
import { AudioManager } from '../core/AudioManager';
import { AccessibilityManager } from '../utils/AccessibilityManager';
import { batteryOptimizationManager } from '../utils/performance/BatteryOptimizationManager';

/**
 * Hook that synchronizes settings with all game systems
 * This ensures that changes in settings are applied to the game systems
 */
export const useGameSettings = (gameController: GameController | null) => {
  const { settings } = useSettings();

  useEffect(() => {
    if (!gameController) return;

    // Update auto-save interval when setting changes
    gameController.updateAutoSaveInterval(settings.autoSaveInterval);
  }, [gameController, settings.autoSaveInterval]);

  useEffect(() => {
    if (!gameController) return;

    // Update offline generation setting when it changes
    gameController.setOfflineGenerationEnabled(settings.offlineGenerationEnabled);
  }, [gameController, settings.offlineGenerationEnabled]);

  // Sync audio settings
  useEffect(() => {
    const audioManager = AudioManager.getInstance();
    audioManager.updateSettings({
      soundEnabled: settings.soundEnabled,
      musicEnabled: settings.musicEnabled,
      soundVolume: 1.0,
      musicVolume: 0.7,
    });
  }, [settings.soundEnabled, settings.musicEnabled]);

  // Sync accessibility settings
  useEffect(() => {
    const accessibilityManager = AccessibilityManager.getInstance();
    accessibilityManager.updateSettings({
      largeTextEnabled: settings.largeTextEnabled,
      highContrastEnabled: settings.highContrastEnabled,
      reduceAnimationsEnabled: settings.reduceAnimationsEnabled,
    });
  }, [settings.largeTextEnabled, settings.highContrastEnabled, settings.reduceAnimationsEnabled]);

  // Initialize and sync battery optimization settings
  useEffect(() => {
    const initializeBatteryOptimization = async () => {
      try {
        // Initialize the battery optimization manager
        await batteryOptimizationManager.initialize();
        
        // Sync settings with battery optimization manager
        batteryOptimizationManager.updateConfig({
          enabled: settings.batteryOptimizationEnabled,
          lowBatteryThreshold: settings.lowBatteryThreshold,
          criticalBatteryThreshold: Math.max(0.05, settings.lowBatteryThreshold - 0.15),
          adaptiveFrameRate: settings.adaptiveFrameRateEnabled,
          backgroundThrottling: settings.backgroundThrottlingEnabled,
          visualEffectsReduction: true,
          batteryEfficientMode: settings.batteryEfficientModeEnabled,
        });
      } catch (error) {
        console.warn('[useGameSettings] Failed to initialize battery optimization:', error);
      }
    };

    initializeBatteryOptimization();
  }, [
    settings.batteryOptimizationEnabled,
    settings.adaptiveFrameRateEnabled,
    settings.lowBatteryThreshold,
    settings.batteryEfficientModeEnabled,
    settings.backgroundThrottlingEnabled,
  ]);

  return {
    // Return current settings for components that need them
    settings,
  };
};