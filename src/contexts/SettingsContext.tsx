import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlayerSettings as BasePlayerSettings } from '../storage/schemas/GameState';

// Extended settings interface to cover all UI settings
export interface AppSettings extends BasePlayerSettings {
  // Game settings
  offlineGenerationEnabled: boolean;
  patternSuggestionsEnabled: boolean;
  autoSaveInterval: number; // in seconds

  // Display settings
  scientificNotationEnabled: boolean;
  debugInfoEnabled: boolean;

  // Accessibility settings
  largeTextEnabled: boolean;
  highContrastEnabled: boolean;
  reduceAnimationsEnabled: boolean;
  animationSpeed: number; // multiplier (0.5 = slower, 2 = faster)

  // Additional settings
  version: number;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  // Base PlayerSettings
  soundEnabled: true,
  musicEnabled: true,
  hapticsEnabled: true,
  autoSaveInterval: 120, // 2 minutes default
  theme: 'dark',
  language: 'en',
  
  // Extended settings
  offlineGenerationEnabled: true,
  patternSuggestionsEnabled: true,
  scientificNotationEnabled: false,
  debugInfoEnabled: false,
  largeTextEnabled: false,
  highContrastEnabled: false,
  reduceAnimationsEnabled: false,
  animationSpeed: 1.0,
  version: 1,
};

interface SettingsContextType {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
  resetSettings: () => Promise<void>;
  isLoading: boolean;
  exportSettings: () => Promise<string>;
  importSettings: (settingsJson: string) => Promise<boolean>;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

const SETTINGS_STORAGE_KEY = '@signal_garden_settings';

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings from AsyncStorage on initialization
  useEffect(() => {
    const loadSettings = async () => {
      try {
        console.log('[SettingsContext] Loading settings from storage...');
        const storedSettings = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
        
        if (storedSettings) {
          const parsedSettings = JSON.parse(storedSettings) as AppSettings;
          
          // Merge with defaults to ensure all properties exist (for app updates)
          const mergedSettings: AppSettings = {
            ...DEFAULT_APP_SETTINGS,
            ...parsedSettings,
            version: DEFAULT_APP_SETTINGS.version, // Always use current version
          };
          
          setSettings(mergedSettings);
          console.log('[SettingsContext] Settings loaded successfully');
        } else {
          console.log('[SettingsContext] No stored settings found, using defaults');
          // Save defaults to storage
          await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(DEFAULT_APP_SETTINGS));
          setSettings(DEFAULT_APP_SETTINGS);
        }
      } catch (error) {
        console.error('[SettingsContext] Failed to load settings:', error);
        setSettings(DEFAULT_APP_SETTINGS);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  // Save settings to AsyncStorage
  const saveSettings = useCallback(async (newSettings: AppSettings) => {
    try {
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
      console.log('[SettingsContext] Settings saved successfully');
    } catch (error) {
      console.error('[SettingsContext] Failed to save settings:', error);
      throw error;
    }
  }, []);

  // Update a single setting
  const updateSetting = useCallback(async <K extends keyof AppSettings>(
    key: K, 
    value: AppSettings[K]
  ) => {
    try {
      const newSettings = { ...settings, [key]: value };
      setSettings(newSettings);
      await saveSettings(newSettings);
      console.log(`[SettingsContext] Updated setting: ${key} = ${value}`);
    } catch (error) {
      console.error(`[SettingsContext] Failed to update setting ${key}:`, error);
      // Revert settings on error
      setSettings(settings);
      throw error;
    }
  }, [settings, saveSettings]);

  // Update multiple settings
  const updateSettings = useCallback(async (updates: Partial<AppSettings>) => {
    try {
      const newSettings = { ...settings, ...updates };
      setSettings(newSettings);
      await saveSettings(newSettings);
      console.log('[SettingsContext] Updated multiple settings:', Object.keys(updates));
    } catch (error) {
      console.error('[SettingsContext] Failed to update settings:', error);
      // Revert settings on error
      setSettings(settings);
      throw error;
    }
  }, [settings, saveSettings]);

  // Reset settings to defaults
  const resetSettings = useCallback(async () => {
    try {
      setSettings(DEFAULT_APP_SETTINGS);
      await saveSettings(DEFAULT_APP_SETTINGS);
      console.log('[SettingsContext] Settings reset to defaults');
    } catch (error) {
      console.error('[SettingsContext] Failed to reset settings:', error);
      throw error;
    }
  }, [saveSettings]);

  // Export settings as JSON string
  const exportSettings = useCallback(async (): Promise<string> => {
    try {
      const exportData = {
        settings,
        exportedAt: new Date().toISOString(),
        appVersion: '1.0.0',
      };
      const jsonString = JSON.stringify(exportData, null, 2);
      console.log('[SettingsContext] Settings exported');
      return jsonString;
    } catch (error) {
      console.error('[SettingsContext] Failed to export settings:', error);
      throw error;
    }
  }, [settings]);

  // Import settings from JSON string
  const importSettings = useCallback(async (settingsJson: string): Promise<boolean> => {
    try {
      const importData = JSON.parse(settingsJson);
      
      if (!importData.settings) {
        throw new Error('Invalid settings format: missing settings object');
      }

      // Validate that imported settings have required properties
      const importedSettings = importData.settings as Partial<AppSettings>;
      const validatedSettings: AppSettings = {
        ...DEFAULT_APP_SETTINGS,
        ...importedSettings,
        version: DEFAULT_APP_SETTINGS.version, // Always use current version
      };

      setSettings(validatedSettings);
      await saveSettings(validatedSettings);
      console.log('[SettingsContext] Settings imported successfully');
      return true;
    } catch (error) {
      console.error('[SettingsContext] Failed to import settings:', error);
      return false;
    }
  }, [saveSettings]);

  const contextValue: SettingsContextType = {
    settings,
    updateSetting,
    updateSettings,
    resetSettings,
    isLoading,
    exportSettings,
    importSettings,
  };

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

// Hook for specific setting access with type safety
export const useSetting = <K extends keyof AppSettings>(key: K) => {
  const { settings, updateSetting } = useSettings();
  return [settings[key], (value: AppSettings[K]) => updateSetting(key, value)] as const;
};

// Hook for multiple settings access
export const useSettingsSubset = <K extends keyof AppSettings>(keys: K[]) => {
  const { settings } = useSettings();
  return keys.reduce((subset, key) => {
    subset[key] = settings[key];
    return subset;
  }, {} as Pick<AppSettings, K>);
};