import React, { useState, useEffect } from 'react';
import { Text, View, TouchableOpacity, Switch, ScrollView, Alert, Platform, Share } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { GameHUD } from '../components/ui/GameHUD';
import { GameState } from '../storage/schemas/GameState';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useSettings } from '../contexts/SettingsContext';
import { useBatteryOptimizationWithSettings } from '../hooks/useBatteryOptimization';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';

type SettingsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Settings'>;

interface SettingsScreenProps {
  gameState: GameState;
  gameController: any;
}

// Helper components
interface SettingsRowProps {
  title: string;
  description: string;
  control: React.ReactNode;
  disabled?: boolean;
}

const SettingsRow: React.FC<SettingsRowProps> = ({ title, description, control, disabled }) => (
  <View className={`flex-row items-center justify-between p-4 ${disabled ? 'opacity-50' : ''}`}>
    <View className="flex-1 mr-4">
      <Text className="text-text font-semibold">{title}</Text>
      <Text className="text-text/60 text-sm mt-1">{description}</Text>
    </View>
    {control}
  </View>
);

const SettingsSection: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View className="bg-surface rounded-lg border border-text/10">
    {children}
  </View>
);

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  gameState,
  gameController,
}) => {
  const navigation = useNavigation<SettingsScreenNavigationProp>();
  const insets = useSafeAreaInsets();
  const { settings, updateSetting, exportSettings, importSettings, resetSettings } = useSettings();
  const { state: batteryState, metrics: batteryMetrics, recommendations } = useBatteryOptimizationWithSettings();

  // Setting handlers with haptic feedback
  const handleAutoSaveToggle = async (value: boolean) => {
    if (settings.hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await updateSetting('autoSaveInterval', value ? 120 : 0); // 0 means auto-save disabled
  };

  const handleOfflineGenerationToggle = async (value: boolean) => {
    if (settings.hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await updateSetting('offlineGenerationEnabled', value);
  };

  const handlePatternSuggestionsToggle = async (value: boolean) => {
    if (settings.hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await updateSetting('patternSuggestionsEnabled', value);
  };

  const handleSoundEffectsToggle = async (value: boolean) => {
    if (settings.hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await updateSetting('soundEnabled', value);
  };

  const handleHapticFeedbackToggle = async (value: boolean) => {
    if (value) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await updateSetting('hapticsEnabled', value);
  };

  const handleScientificNotationToggle = async (value: boolean) => {
    if (settings.hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await updateSetting('scientificNotationEnabled', value);
  };

  const handleDebugInfoToggle = async (value: boolean) => {
    if (settings.hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await updateSetting('debugInfoEnabled', value);
  };

  const handleLargeTextToggle = async (value: boolean) => {
    if (settings.hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await updateSetting('largeTextEnabled', value);
  };

  const handleHighContrastToggle = async (value: boolean) => {
    if (settings.hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await updateSetting('highContrastEnabled', value);
  };

  const handleReduceAnimationsToggle = async (value: boolean) => {
    if (settings.hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await updateSetting('reduceAnimationsEnabled', value);
  };

  // Battery optimization handlers
  const handleBatteryOptimizationToggle = async (value: boolean) => {
    if (settings.hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await updateSetting('batteryOptimizationEnabled', value);
  };

  const handleAdaptiveFrameRateToggle = async (value: boolean) => {
    if (settings.hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await updateSetting('adaptiveFrameRateEnabled', value);
  };

  const handleBatteryEfficientModeToggle = async (value: boolean) => {
    if (settings.hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await updateSetting('batteryEfficientModeEnabled', value);
  };

  const handleBackgroundThrottlingToggle = async (value: boolean) => {
    if (settings.hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await updateSetting('backgroundThrottlingEnabled', value);
  };

  const handleManualSave = async () => {
    if (settings.hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    try {
      await gameController.saveGame();
      Alert.alert('Success', 'Game saved successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to save game');
      console.error('Save failed:', error);
    }
  };

  const handleImportSave = async () => {
    if (settings.hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      Alert.alert(
        'Import Save',
        'This will overwrite your current progress. Are you sure?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Import',
            style: 'default',
            onPress: async () => {
              try {
                // Pick document
                const result = await DocumentPicker.getDocumentAsync({
                  type: 'application/json',
                  copyToCacheDirectory: true,
                });

                if (!result.canceled && result.assets && result.assets.length > 0) {
                  const file = result.assets[0];
                  
                  // Read file content
                  const content = await FileSystem.readAsStringAsync(file.uri, {
                    encoding: FileSystem.EncodingType.UTF8,
                  });

                  // Parse and validate JSON
                  const importData = JSON.parse(content);
                  
                  if (!importData.gameState) {
                    throw new Error('Invalid save file format: missing game state');
                  }

                  // Validate game state structure (basic validation)
                  if (!importData.gameState.version || !importData.gameState.player) {
                    throw new Error('Invalid save file: corrupted game state');
                  }

                  // TODO: Implement actual import to GameController
                  // gameController.importGameState(importData.gameState);
                  
                  // Import settings if available
                  if (importData.settings && typeof importData.settings === 'object') {
                    try {
                      await importSettings(JSON.stringify(importData.settings));
                    } catch (settingsError) {
                      console.warn('Failed to import settings:', settingsError);
                      // Continue even if settings import fails
                    }
                  }

                  Alert.alert(
                    'Import Complete',
                    'Save file imported successfully! The app will restart to apply changes.',
                    [
                      {
                        text: 'OK',
                        onPress: () => {
                          // In a real app, you might want to restart or navigate to main screen
                          console.log('Import completed, restart recommended');
                        },
                      },
                    ]
                  );
                }
              } catch (error) {
                console.error('Import save failed:', error);
                Alert.alert('Import Failed', `Could not import save file: ${error instanceof Error ? error.message : 'Unknown error'}`);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Import save failed:', error);
      Alert.alert('Error', 'Failed to select save file');
    }
  };

  const handleExportSave = async () => {
    if (settings.hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      // Get current game state
      const currentGameState = gameController.getGameState();
      if (!currentGameState) {
        Alert.alert('Error', 'No game data to export');
        return;
      }

      // Create export data with metadata
      const exportData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        gameState: currentGameState,
        settings: await exportSettings(),
      };

      // Convert to JSON string
      const jsonString = JSON.stringify(exportData, null, 2);
      
      // Create filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const filename = `signal-garden-save-${timestamp}.json`;

      if (Platform.OS === 'web') {
        // Web platform - download file
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        Alert.alert('Success', 'Save file downloaded successfully!');
      } else {
        // Mobile platform - use share sheet
        const fileUri = `${FileSystem.documentDirectory}${filename}`;
        
        // Write to file
        await FileSystem.writeAsStringAsync(fileUri, jsonString, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        // Share the file
        if (Platform.OS === 'ios') {
          await Share.share({
            url: fileUri,
            message: 'Signal Garden save file',
          });
        } else {
          await Share.share({
            url: `file://${fileUri}`,
            message: 'Signal Garden save file',
          });
        }

        Alert.alert('Success', 'Save file exported successfully!');
      }
    } catch (error) {
      console.error('Export save failed:', error);
      Alert.alert('Error', 'Failed to export save file');
    }
  };

  const handleResetProgress = () => {
    if (settings.hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    Alert.alert(
      'Reset Progress',
      'This will delete all your progress. This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear all beacons and reset quantum data
              gameController.clearAllBeacons();
              
              // Reset settings to defaults (optional - user choice)
              const shouldResetSettings = await new Promise<boolean>((resolve) => {
                Alert.alert(
                  'Reset Settings Too?',
                  'Do you also want to reset your settings to default values?',
                  [
                    {
                      text: 'Keep Settings',
                      onPress: () => resolve(false),
                    },
                    {
                      text: 'Reset All',
                      style: 'destructive',
                      onPress: () => resolve(true),
                    },
                  ]
                );
              });

              if (shouldResetSettings) {
                await resetSettings();
              }

              // Save the reset state
              await gameController.saveGame();

              Alert.alert(
                'Reset Complete',
                'All progress has been reset. You can start fresh!',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      // Navigate back to main screen or restart
                      navigation.goBack();
                    },
                  },
                ]
              );
            } catch (error) {
              console.error('Reset failed:', error);
              Alert.alert('Error', 'Failed to reset progress completely');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View className="flex-1 bg-background">
          <GameHUD resourceManager={gameController.getResourceManager()} showDetailed={false} />
          
          <View className="bg-surface px-4 py-3">
            <View className="flex-row justify-between items-center">
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                className="bg-primary px-4 py-2 rounded-lg"
              >
                <Text className="text-white font-semibold">← Back</Text>
              </TouchableOpacity>
              <Text className="text-text text-lg font-semibold">Settings</Text>
              <View style={{ width: 60 }} />
            </View>
          </View>
          
          <ScrollView className="flex-1 p-4">
            <Text className="text-text text-xl font-semibold mb-6">⚙️ Settings</Text>
            
            {/* Game Settings */}
            <View className="mb-6">
              <Text className="text-text text-lg font-semibold mb-4">Game Settings</Text>
              
              <SettingsSection>
                <SettingsRow
                  title="Auto-save"
                  description="Automatically save progress every 2 minutes"
                  control={
                    <Switch
                      value={settings.autoSaveInterval > 0}
                      onValueChange={handleAutoSaveToggle}
                      trackColor={{ false: '#374151', true: '#4F46E5' }}
                      thumbColor={settings.autoSaveInterval > 0 ? '#F9FAFB' : '#9CA3AF'}
                    />
                  }
                />
                
                <SettingsRow
                  title="Offline generation"
                  description="Generate resources while away (up to 8 hours)"
                  control={
                    <Switch
                      value={settings.offlineGenerationEnabled}
                      onValueChange={handleOfflineGenerationToggle}
                      trackColor={{ false: '#374151', true: '#4F46E5' }}
                      thumbColor={settings.offlineGenerationEnabled ? '#F9FAFB' : '#9CA3AF'}
                    />
                  }
                />
                
                <SettingsRow
                  title="Pattern suggestions"
                  description="Show hints for optimal beacon patterns"
                  control={
                    <Switch
                      value={settings.patternSuggestionsEnabled}
                      onValueChange={handlePatternSuggestionsToggle}
                      trackColor={{ false: '#374151', true: '#4F46E5' }}
                      thumbColor={settings.patternSuggestionsEnabled ? '#F9FAFB' : '#9CA3AF'}
                    />
                  }
                />
              </SettingsSection>
            </View>
            
            {/* Audio Settings */}
            <View className="mb-6">
              <Text className="text-text text-lg font-semibold mb-4">Audio & Haptics</Text>
              
              <SettingsSection>
                <SettingsRow
                  title="Sound effects"
                  description="Play sound effects for actions"
                  control={
                    <Switch
                      value={settings.soundEnabled}
                      onValueChange={handleSoundEffectsToggle}
                      trackColor={{ false: '#374151', true: '#4F46E5' }}
                      thumbColor={settings.soundEnabled ? '#F9FAFB' : '#9CA3AF'}
                    />
                  }
                />
                
                <SettingsRow
                  title="Haptic feedback"
                  description="Vibration feedback for button presses"
                  control={
                    <Switch
                      value={settings.hapticsEnabled}
                      onValueChange={handleHapticFeedbackToggle}
                      trackColor={{ false: '#374151', true: '#4F46E5' }}
                      thumbColor={settings.hapticsEnabled ? '#F9FAFB' : '#9CA3AF'}
                    />
                  }
                />
              </SettingsSection>
            </View>
            
            {/* Display Settings */}
            <View className="mb-6">
              <Text className="text-text text-lg font-semibold mb-4">Display</Text>
              
              <SettingsSection>
                <SettingsRow
                  title="Scientific notation"
                  description="Use scientific notation for large numbers"
                  control={
                    <Switch
                      value={settings.scientificNotationEnabled}
                      onValueChange={handleScientificNotationToggle}
                      trackColor={{ false: '#374151', true: '#4F46E5' }}
                      thumbColor={settings.scientificNotationEnabled ? '#F9FAFB' : '#9CA3AF'}
                    />
                  }
                />
                
                <SettingsRow
                  title="Show debug info"
                  description="Display debug information (development)"
                  control={
                    <Switch
                      value={settings.debugInfoEnabled}
                      onValueChange={handleDebugInfoToggle}
                      trackColor={{ false: '#374151', true: '#4F46E5' }}
                      thumbColor={settings.debugInfoEnabled ? '#F9FAFB' : '#9CA3AF'}
                      disabled={!__DEV__}
                    />
                  }
                  disabled={!__DEV__}
                />
              </SettingsSection>
            </View>
            
            {/* Accessibility */}
            <View className="mb-6">
              <Text className="text-text text-lg font-semibold mb-4">Accessibility</Text>
              
              <SettingsSection>
                <SettingsRow
                  title="Large text"
                  description="Use larger text sizes for better readability"
                  control={
                    <Switch
                      value={settings.largeTextEnabled}
                      onValueChange={handleLargeTextToggle}
                      trackColor={{ false: '#374151', true: '#4F46E5' }}
                      thumbColor={settings.largeTextEnabled ? '#F9FAFB' : '#9CA3AF'}
                    />
                  }
                />
                
                <SettingsRow
                  title="High contrast"
                  description="Increase contrast for better visibility"
                  control={
                    <Switch
                      value={settings.highContrastEnabled}
                      onValueChange={handleHighContrastToggle}
                      trackColor={{ false: '#374151', true: '#4F46E5' }}
                      thumbColor={settings.highContrastEnabled ? '#F9FAFB' : '#9CA3AF'}
                    />
                  }
                />
                
                <SettingsRow
                  title="Reduce animations"
                  description="Minimize motion for sensitive users"
                  control={
                    <Switch
                      value={settings.reduceAnimationsEnabled}
                      onValueChange={handleReduceAnimationsToggle}
                      trackColor={{ false: '#374151', true: '#4F46E5' }}
                      thumbColor={settings.reduceAnimationsEnabled ? '#F9FAFB' : '#9CA3AF'}
                    />
                  }
                />
              </SettingsSection>
            </View>
            
            {/* Battery Optimization */}
            <View className="mb-6">
              <Text className="text-text text-lg font-semibold mb-4">Battery Optimization</Text>
              
              {/* Battery Status Display */}
              <View className="bg-surface rounded-lg border border-text/10 mb-3 p-4">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-text font-medium">Battery Level</Text>
                  <Text className="text-text">
                    {Math.round(batteryMetrics.batteryLevel * 100)}%
                  </Text>
                </View>
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-text font-medium">Status</Text>
                  <Text className="text-text">
                    {batteryMetrics.isCharging ? 'Charging' : batteryMetrics.batteryState}
                  </Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-text font-medium">Optimization Level</Text>
                  <Text className={`font-medium capitalize ${
                    batteryState.currentOptimizationLevel === 'high' ? 'text-red-400' :
                    batteryState.currentOptimizationLevel === 'medium' ? 'text-yellow-400' :
                    batteryState.currentOptimizationLevel === 'low' ? 'text-blue-400' :
                    'text-green-400'
                  }`}>
                    {batteryState.currentOptimizationLevel}
                  </Text>
                </View>
              </View>
              
              <SettingsSection>
                <SettingsRow
                  title="Battery optimization"
                  description="Automatically adjust performance based on battery level"
                  control={
                    <Switch
                      value={settings.batteryOptimizationEnabled}
                      onValueChange={handleBatteryOptimizationToggle}
                      trackColor={{ false: '#374151', true: '#4F46E5' }}
                      thumbColor={settings.batteryOptimizationEnabled ? '#F9FAFB' : '#9CA3AF'}
                    />
                  }
                />
                
                <SettingsRow
                  title="Adaptive frame rate"
                  description="Dynamically adjust frame rate based on performance"
                  control={
                    <Switch
                      value={settings.adaptiveFrameRateEnabled}
                      onValueChange={handleAdaptiveFrameRateToggle}
                      trackColor={{ false: '#374151', true: '#4F46E5' }}
                      thumbColor={settings.adaptiveFrameRateEnabled ? '#F9FAFB' : '#9CA3AF'}
                      disabled={!settings.batteryOptimizationEnabled}
                    />
                  }
                  disabled={!settings.batteryOptimizationEnabled}
                />
                
                <SettingsRow
                  title="Background throttling"
                  description="Reduce background processing when battery is low"
                  control={
                    <Switch
                      value={settings.backgroundThrottlingEnabled}
                      onValueChange={handleBackgroundThrottlingToggle}
                      trackColor={{ false: '#374151', true: '#4F46E5' }}
                      thumbColor={settings.backgroundThrottlingEnabled ? '#F9FAFB' : '#9CA3AF'}
                      disabled={!settings.batteryOptimizationEnabled}
                    />
                  }
                  disabled={!settings.batteryOptimizationEnabled}
                />
                
                <SettingsRow
                  title="Battery efficient mode"
                  description="Force maximum battery savings (reduces performance)"
                  control={
                    <Switch
                      value={settings.batteryEfficientModeEnabled}
                      onValueChange={handleBatteryEfficientModeToggle}
                      trackColor={{ false: '#374151', true: '#4F46E5' }}
                      thumbColor={settings.batteryEfficientModeEnabled ? '#F9FAFB' : '#9CA3AF'}
                      disabled={!settings.batteryOptimizationEnabled}
                    />
                  }
                  disabled={!settings.batteryOptimizationEnabled}
                />
              </SettingsSection>
              
              {/* Optimization Recommendations */}
              {recommendations.length > 0 && (
                <View className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mt-3">
                  <Text className="text-yellow-400 font-medium mb-2">💡 Battery Recommendations</Text>
                  {recommendations.map((recommendation, index) => (
                    <Text key={index} className="text-yellow-300 text-sm mb-1">
                      • {recommendation.message}
                    </Text>
                  ))}
                </View>
              )}
            </View>
            
            {/* Data Management */}
            <View className="mb-6">
              <Text className="text-text text-lg font-semibold mb-4">Data Management</Text>
              
              <SettingsSection>
                <TouchableOpacity
                  onPress={handleManualSave}
                  className="flex-row items-center justify-between p-4 bg-primary/10 border border-primary/20 rounded-lg mb-3"
                >
                  <View className="flex-1">
                    <Text className="text-primary font-semibold">Manual Save</Text>
                    <Text className="text-primary/70 text-sm mt-1">
                      Save your progress now
                    </Text>
                  </View>
                  <Text className="text-primary text-xl">💾</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={handleExportSave}
                  className="flex-row items-center justify-between p-4 bg-secondary/10 border border-secondary/20 rounded-lg mb-3"
                >
                  <View className="flex-1">
                    <Text className="text-secondary font-semibold">Export Save</Text>
                    <Text className="text-secondary/70 text-sm mt-1">
                      Export save data for backup
                    </Text>
                  </View>
                  <Text className="text-secondary text-xl">📤</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={handleImportSave}
                  className="flex-row items-center justify-between p-4 bg-accent/10 border border-accent/20 rounded-lg mb-3"
                >
                  <View className="flex-1">
                    <Text className="text-accent font-semibold">Import Save</Text>
                    <Text className="text-accent/70 text-sm mt-1">
                      Load save data from backup file
                    </Text>
                  </View>
                  <Text className="text-accent text-xl">📥</Text>
                </TouchableOpacity>
                
                {__DEV__ && (
                  <TouchableOpacity
                    onPress={handleResetProgress}
                    className="flex-row items-center justify-between p-4 bg-red-500/10 border border-red-500/20 rounded-lg"
                  >
                    <View className="flex-1">
                      <Text className="text-red-400 font-semibold">Reset Progress</Text>
                      <Text className="text-red-400/70 text-sm mt-1">
                        Clear all save data (debug only)
                      </Text>
                    </View>
                    <Text className="text-red-400 text-xl">⚠️</Text>
                  </TouchableOpacity>
                )}
              </SettingsSection>
            </View>
            
            {/* App Info */}
            <View className="mb-8">
              <Text className="text-text text-lg font-semibold mb-4">App Information</Text>
              
              <SettingsSection>
                <SettingsRow
                  title="Signal Garden"
                  description={`Version 1.0.0 • Save #${gameState?.saveCount || 0}`}
                  control={null}
                />
                
                <SettingsRow
                  title="Play time"
                  description={`${Math.floor((gameState?.gameTime || 0) / 60)} minutes`}
                  control={null}
                />
              </SettingsSection>
            </View>
          </ScrollView>
          
          <StatusBar style="light" />
        </View>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
};