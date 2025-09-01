import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { BaseModal } from './BaseModal';
import * as Haptics from 'expo-haptics';

interface QuickInfoModalProps {
  isVisible: boolean;
  title: string;
  message: string;
  onClose: () => void;
  actionText?: string;
  onAction?: () => void;
  type?: 'info' | 'tip' | 'warning' | 'success' | 'error';
}

export const QuickInfoModal: React.FC<QuickInfoModalProps> = ({
  isVisible,
  title,
  message,
  onClose,
  actionText,
  onAction,
  type = 'info'
}) => {
  const getTypeConfig = () => {
    switch (type) {
      case 'tip':
        return {
          emoji: '💡',
          titleColor: 'text-accent',
          backgroundColor: 'bg-accent/10',
          borderColor: 'border-accent/30'
        };
      case 'warning':
        return {
          emoji: '⚠️',
          titleColor: 'text-yellow-400',
          backgroundColor: 'bg-yellow-400/10',
          borderColor: 'border-yellow-400/30'
        };
      case 'success':
        return {
          emoji: '✅',
          titleColor: 'text-green-400',
          backgroundColor: 'bg-green-400/10',
          borderColor: 'border-green-400/30'
        };
      case 'error':
        return {
          emoji: '❌',
          titleColor: 'text-red-400',
          backgroundColor: 'bg-red-400/10',
          borderColor: 'border-red-400/30'
        };
      default: // info
        return {
          emoji: 'ℹ️',
          titleColor: 'text-primary',
          backgroundColor: 'bg-primary/10',
          borderColor: 'border-primary/30'
        };
    }
  };

  const handleAction = () => {
    if (onAction) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onAction();
    }
    onClose();
  };

  const config = getTypeConfig();

  return (
    <BaseModal
      isVisible={isVisible}
      onClose={onClose}
      title={title}
      maxHeight={400}
      animationType="fade"
      showCloseButton={false}
    >
      <View className="items-center space-y-6">
        {/* Icon */}
        <View className={`${config.backgroundColor} ${config.borderColor} border rounded-full p-4`}>
          <Text className="text-4xl">{config.emoji}</Text>
        </View>

        {/* Message */}
        <View className="items-center space-y-3">
          <Text className={`${config.titleColor} font-bold text-lg text-center`}>
            {title}
          </Text>
          <Text className="text-text/80 text-center leading-6">
            {message}
          </Text>
        </View>

        {/* Action Buttons */}
        <View className="w-full space-y-3">
          {actionText && onAction && (
            <TouchableOpacity
              onPress={handleAction}
              className={`${config.backgroundColor} ${config.borderColor} border px-6 py-3 rounded-lg`}
            >
              <Text className={`${config.titleColor} font-semibold text-center`}>
                {actionText}
              </Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onClose();
            }}
            className="bg-surface border border-text/20 px-6 py-3 rounded-lg"
          >
            <Text className="text-text font-semibold text-center">
              {actionText && onAction ? 'Cancel' : 'OK'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </BaseModal>
  );
};