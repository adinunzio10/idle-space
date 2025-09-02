import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BaseModal } from './BaseModal';

interface MilestoneChoiceModalProps {
  isVisible: boolean;
  milestone: any | null;
  onChoice: (milestone: any, choice: string) => void;
  onDismiss: () => void;
}

export const MilestoneChoiceModal: React.FC<MilestoneChoiceModalProps> = ({
  isVisible,
  milestone,
  onChoice,
  onDismiss,
}) => {
  if (!milestone) return null;

  const choiceOptions: any[] = []; // milestone?.choices || [];

  const handleChoice = (choice: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onChoice(milestone, choice);
  };

  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDismiss();
  };

  return (
    <BaseModal
      isVisible={isVisible}
      onClose={handleDismiss}
      title="Consciousness Expansion"
      maxHeight={600}
      showCloseButton={false}
    >
      <View className="space-y-6">
        {/* Milestone Header */}
        <View className="items-center mb-4">
          <Text className="text-4xl mb-3">🧠</Text>
          <Text className="text-text text-xl font-bold text-center">
            {milestone.name}
          </Text>
          <Text className="text-primary text-lg font-semibold text-center mt-1">
            {milestone.beaconThreshold} Beacons Milestone
          </Text>
          <Text className="text-text/70 text-sm text-center mt-2">
            {milestone.description}
          </Text>
        </View>

        {/* Achievement Celebration */}
        <View className="bg-primary/20 border border-primary/30 rounded-xl p-4 items-center">
          <Text className="text-primary text-2xl mb-2">🎉</Text>
          <Text className="text-text font-semibold text-base text-center">
            Milestone Achieved!
          </Text>
          <Text className="text-text/70 text-sm text-center mt-1">
            Your consciousness network has reached a new threshold. Choose your expansion path:
          </Text>
        </View>

        {/* Choice Options */}
        <View className="space-y-4">
          <Text className="text-text font-semibold text-lg text-center mb-2">
            Choose Your Path
          </Text>
          
          <Text className="text-text/60 text-center">
            Milestone choices will be available in a future update.
          </Text>
        </View>

        {/* Warning */}
        <View className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-3">
          <View className="flex-row items-center mb-2">
            <Text className="text-yellow-400 text-lg mr-2">⚠️</Text>
            <Text className="text-yellow-400 font-semibold text-sm">
              Permanent Decision
            </Text>
          </View>
          <Text className="text-text/80 text-xs">
            This choice cannot be changed. Choose the path that best aligns with your expansion strategy.
          </Text>
        </View>

        {/* Decide Later Button */}
        <TouchableOpacity
          onPress={handleDismiss}
          className="bg-surface border border-text/20 rounded-lg py-3"
        >
          <Text className="text-text/70 text-center font-semibold">
            Decide Later
          </Text>
        </TouchableOpacity>
      </View>
    </BaseModal>
  );
};

