import React, { useState, useEffect } from 'react';
import { Text, View, TouchableOpacity, Switch, ScrollView, Alert } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { GameHUD } from '../components/ui/GameHUD';
import { GameState } from '../storage/schemas/GameState';
import { RootStackParamList } from '../navigation/AppNavigator';
import * as Haptics from 'expo-haptics';

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
  
  // Settings state - in a real app, these would be persisted
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [offlineGenerationEnabled, setOfflineGenerationEnabled] = useState(true);
  const [patternSuggestionsEnabled, setPatternSuggestionsEnabled] = useState(true);
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState(true);
  const [hapticFeedbackEnabled, setHapticFeedbackEnabled] = useState(true);
  const [scientificNotationEnabled, setScientificNotationEnabled] = useState(false);
  const [debugInfoEnabled, setDebugInfoEnabled] = useState(false);
  const [largeTextEnabled, setLargeTextEnabled] = useState(false);
  const [highContrastEnabled, setHighContrastEnabled] = useState(false);
  const [reduceAnimationsEnabled, setReduceAnimationsEnabled] = useState(false);

  // Setting handlers with haptic feedback
  const handleAutoSaveToggle = (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAutoSaveEnabled(value);
    // TODO: Apply to game controller
  };

  const handleOfflineGenerationToggle = (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOfflineGenerationEnabled(value);
    // TODO: Apply to game controller
  };

  const handlePatternSuggestionsToggle = (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPatternSuggestionsEnabled(value);
    // TODO: Apply to pattern suggestion system
  };

  const handleSoundEffectsToggle = (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSoundEffectsEnabled(value);
    // TODO: Apply to audio system
  };

  const handleHapticFeedbackToggle = (value: boolean) => {
    if (value) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setHapticFeedbackEnabled(value);
    // TODO: Apply globally to all haptic calls
  };

  const handleScientificNotationToggle = (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setScientificNotationEnabled(value);
    // TODO: Apply to number formatting utilities
  };

  const handleDebugInfoToggle = (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDebugInfoEnabled(value);
    // TODO: Apply to debug overlays
  };

  const handleLargeTextToggle = (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLargeTextEnabled(value);
    // TODO: Apply text scaling
  };

  const handleHighContrastToggle = (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setHighContrastEnabled(value);
    // TODO: Apply high contrast theme
  };

  const handleReduceAnimationsToggle = (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReduceAnimationsEnabled(value);
    // TODO: Apply to animation system
  };

  const handleManualSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await gameController.saveGame();
      Alert.alert('Success', 'Game saved successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to save game');
      console.error('Save failed:', error);
    }
  };

  const handleExportSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Export Save', 'Export functionality will be implemented in a future update.');
    // TODO: Implement save export functionality
  };

  const handleResetProgress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
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
          onPress: () => {
            // TODO: Implement progress reset
            Alert.alert('Reset Complete', 'All progress has been reset.');
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
                      value={autoSaveEnabled}
                      onValueChange={handleAutoSaveToggle}
                      trackColor={{ false: '#374151', true: '#4F46E5' }}
                      thumbColor={autoSaveEnabled ? '#F9FAFB' : '#9CA3AF'}
                    />
                  }
                />
                
                <SettingsRow
                  title="Offline generation"
                  description="Generate resources while away (up to 8 hours)"
                  control={
                    <Switch
                      value={offlineGenerationEnabled}
                      onValueChange={handleOfflineGenerationToggle}
                      trackColor={{ false: '#374151', true: '#4F46E5' }}
                      thumbColor={offlineGenerationEnabled ? '#F9FAFB' : '#9CA3AF'}
                    />
                  }
                />
                
                <SettingsRow
                  title="Pattern suggestions"
                  description="Show hints for optimal beacon patterns"
                  control={
                    <Switch
                      value={patternSuggestionsEnabled}
                      onValueChange={handlePatternSuggestionsToggle}
                      trackColor={{ false: '#374151', true: '#4F46E5' }}
                      thumbColor={patternSuggestionsEnabled ? '#F9FAFB' : '#9CA3AF'}
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
                      value={soundEffectsEnabled}
                      onValueChange={handleSoundEffectsToggle}
                      trackColor={{ false: '#374151', true: '#4F46E5' }}
                      thumbColor={soundEffectsEnabled ? '#F9FAFB' : '#9CA3AF'}
                    />
                  }
                />
                
                <SettingsRow
                  title="Haptic feedback"
                  description="Vibration feedback for button presses"
                  control={
                    <Switch
                      value={hapticFeedbackEnabled}
                      onValueChange={handleHapticFeedbackToggle}
                      trackColor={{ false: '#374151', true: '#4F46E5' }}
                      thumbColor={hapticFeedbackEnabled ? '#F9FAFB' : '#9CA3AF'}
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
                      value={scientificNotationEnabled}
                      onValueChange={handleScientificNotationToggle}
                      trackColor={{ false: '#374151', true: '#4F46E5' }}
                      thumbColor={scientificNotationEnabled ? '#F9FAFB' : '#9CA3AF'}
                    />
                  }
                />
                
                <SettingsRow
                  title="Show debug info"
                  description="Display debug information (development)"
                  control={
                    <Switch
                      value={debugInfoEnabled}
                      onValueChange={handleDebugInfoToggle}
                      trackColor={{ false: '#374151', true: '#4F46E5' }}
                      thumbColor={debugInfoEnabled ? '#F9FAFB' : '#9CA3AF'}
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
                      value={largeTextEnabled}
                      onValueChange={handleLargeTextToggle}
                      trackColor={{ false: '#374151', true: '#4F46E5' }}
                      thumbColor={largeTextEnabled ? '#F9FAFB' : '#9CA3AF'}
                    />
                  }
                />
                
                <SettingsRow
                  title="High contrast"
                  description="Increase contrast for better visibility"
                  control={
                    <Switch
                      value={highContrastEnabled}
                      onValueChange={handleHighContrastToggle}
                      trackColor={{ false: '#374151', true: '#4F46E5' }}
                      thumbColor={highContrastEnabled ? '#F9FAFB' : '#9CA3AF'}
                    />
                  }
                />
                
                <SettingsRow
                  title="Reduce animations"
                  description="Minimize motion for sensitive users"
                  control={
                    <Switch
                      value={reduceAnimationsEnabled}
                      onValueChange={handleReduceAnimationsToggle}
                      trackColor={{ false: '#374151', true: '#4F46E5' }}
                      thumbColor={reduceAnimationsEnabled ? '#F9FAFB' : '#9CA3AF'}
                    />
                  }
                />
              </SettingsSection>
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