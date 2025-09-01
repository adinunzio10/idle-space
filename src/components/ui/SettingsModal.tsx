import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Switch } from 'react-native';
import { BaseModal } from './BaseModal';
import { GameController } from '../../core/GameController';
import * as Haptics from 'expo-haptics';

interface SettingsModalProps {
  isVisible: boolean;
  onClose: () => void;
  gameController: GameController;
}

interface SettingItem {
  id: string;
  label: string;
  description: string;
  type: 'toggle' | 'button' | 'info';
  value?: boolean;
  onPress?: () => void;
  onToggle?: (value: boolean) => void;
  buttonText?: string;
  infoText?: string;
  disabled?: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isVisible,
  onClose,
  gameController,
}) => {
  const [hapticFeedback, setHapticFeedback] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  const [debugMode, setDebugMode] = useState(__DEV__);
  
  const handleSaveGame = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await gameController.saveGame();
      // Could show a success toast here
    } catch (error) {
      console.error('Failed to save game:', error);
      // Could show an error toast here
    }
  };
  
  const handleResetGame = () => {
    // This would need confirmation dialog in a real implementation
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    // gameController.resetGame();
    console.log('Reset game would be implemented here with confirmation');
  };
  
  const settings: SettingItem[] = [
    {
      id: 'haptic-feedback',
      label: 'Haptic Feedback',
      description: 'Enable vibration feedback for UI interactions',
      type: 'toggle',
      value: hapticFeedback,
      onToggle: (value) => {
        setHapticFeedback(value);
        if (value) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }
    },
    {
      id: 'auto-save',
      label: 'Auto Save',
      description: 'Automatically save game progress every 2 minutes',
      type: 'toggle',
      value: autoSave,
      onToggle: (value) => {
        setAutoSave(value);
        // Would implement auto-save toggle logic here
      }
    },
    {
      id: 'manual-save',
      label: 'Manual Save',
      description: 'Save your current game progress',
      type: 'button',
      buttonText: 'Save Now',
      onPress: handleSaveGame
    },
    {
      id: 'debug-mode',
      label: 'Debug Mode',
      description: 'Show debug information and developer tools',
      type: 'toggle',
      value: debugMode,
      onToggle: setDebugMode,
      disabled: !__DEV__ // Only available in development
    },
    {
      id: 'version-info',
      label: 'Version',
      description: 'Signal Garden v1.0.0',
      type: 'info',
      infoText: 'Built with React Native & Expo'
    },
    {
      id: 'reset-game',
      label: 'Reset Game',
      description: 'Clear all progress and start over (requires confirmation)',
      type: 'button',
      buttonText: 'Reset',
      onPress: handleResetGame
    }
  ];
  
  const renderToggleSetting = (setting: SettingItem) => (
    <View key={setting.id} className="flex-row justify-between items-center p-4 bg-background rounded-lg mb-3">
      <View className="flex-1 pr-4">
        <Text className="text-text font-semibold mb-1">{setting.label}</Text>
        <Text className="text-text/60 text-sm">{setting.description}</Text>
      </View>
      <Switch
        value={setting.value}
        onValueChange={setting.onToggle}
        disabled={setting.disabled}
        trackColor={{ false: '#374151', true: '#4F46E5' }}
        thumbColor={setting.value ? '#FFFFFF' : '#9CA3AF'}
        ios_backgroundColor="#374151"
      />
    </View>
  );
  
  const renderButtonSetting = (setting: SettingItem) => (
    <View key={setting.id} className="p-4 bg-background rounded-lg mb-3">
      <View className="mb-3">
        <Text className="text-text font-semibold mb-1">{setting.label}</Text>
        <Text className="text-text/60 text-sm">{setting.description}</Text>
      </View>
      <TouchableOpacity
        onPress={() => {
          if (hapticFeedback) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          setting.onPress?.();
        }}
        className={`px-4 py-2 rounded-lg ${
          setting.id === 'reset-game' 
            ? 'bg-red-600 border border-red-500' 
            : 'bg-primary'
        }`}
        disabled={setting.disabled}
      >
        <Text className="text-white font-semibold text-center">
          {setting.buttonText}
        </Text>
      </TouchableOpacity>
    </View>
  );
  
  const renderInfoSetting = (setting: SettingItem) => (
    <View key={setting.id} className="p-4 bg-background rounded-lg mb-3">
      <Text className="text-text font-semibold mb-1">{setting.label}</Text>
      <Text className="text-text/60 text-sm mb-2">{setting.description}</Text>
      {setting.infoText && (
        <Text className="text-text/40 text-xs">{setting.infoText}</Text>
      )}
    </View>
  );
  
  const renderSetting = (setting: SettingItem) => {
    switch (setting.type) {
      case 'toggle':
        return renderToggleSetting(setting);
      case 'button':
        return renderButtonSetting(setting);
      case 'info':
        return renderInfoSetting(setting);
      default:
        return null;
    }
  };
  
  return (
    <BaseModal
      isVisible={isVisible}
      onClose={onClose}
      title="Settings"
      testID="settings-modal"
      swipeDirection="down"
    >
      <View className="flex-1">
        <Text className="text-text/80 text-sm mb-6 text-center">
          Customize your Signal Garden experience
        </Text>
        
        {settings.map(renderSetting)}
        
        {/* Additional App Info */}
        <View className="mt-6 p-4 bg-background rounded-lg">
          <Text className="text-text/60 text-xs text-center">
            Signal Garden is an open-source idle game built with React Native.
            {'\n'}
            Your progress is saved locally on your device.
          </Text>
        </View>
      </View>
    </BaseModal>
  );
};