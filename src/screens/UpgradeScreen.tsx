import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useUpgrades } from '../contexts/UpgradeContext';
import { useResources } from '../core/ResourceContext';
import { UpgradePreview } from '../components/ui/UpgradePreview';
import { MilestoneChoiceOverlay } from '../components/ui/MilestoneChoiceOverlay';
import { formatNumber } from '../utils/numberFormatting';
// Simple category definitions for the UI
const UPGRADE_CATEGORIES = [
  'beaconEfficiency',
  'probeSystems',
  'offlineProcessing',
  'consciousness',
] as const;
type UpgradeCategory = (typeof UPGRADE_CATEGORIES)[number];

export const UpgradeScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const {
    upgradeManager,
    milestoneProgress,
    availableMilestone,
    purchaseUpgrade,
    makeMilestoneChoice,
    getUpgradePreview,
    dismissMilestone,
    loading,
    error,
  } = useUpgrades();
  const { resources } = useResources();

  const [selectedCategory, setSelectedCategory] =
    useState<UpgradeCategory | null>(null);
  const [showMilestoneOverlay, setShowMilestoneOverlay] = useState(false);
  const [purchasingCategory, setPurchasingCategory] =
    useState<UpgradeCategory | null>(null);

  React.useEffect(() => {
    if (availableMilestone) {
      setShowMilestoneOverlay(true);
    }
  }, [availableMilestone]);

  const handlePurchaseUpgrade = async (category: UpgradeCategory) => {
    if (!upgradeManager || purchasingCategory) return;

    const preview = getUpgradePreview(category);
    if (!preview) return;

    // Check if player can afford
    if (resources.quantumData < preview.cost) {
      Alert.alert(
        'Insufficient Resources',
        `You need ${formatNumber(preview.cost)} Quantum Data but only have ${formatNumber(resources.quantumData)}.`
      );
      return;
    }

    setPurchasingCategory(category);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const success = await purchaseUpgrade(category);

      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Upgrade Complete!',
          `${category} has been upgraded successfully.`
        );
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          'Upgrade Failed',
          'Unable to complete the upgrade. Please try again.'
        );
      }
    } catch (err) {
      console.error('Purchase error:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'An error occurred during the upgrade.');
    } finally {
      setPurchasingCategory(null);
    }
  };

  const handleMilestoneChoice = async (milestone: any, choice: string) => {
    const success = await makeMilestoneChoice(milestone, choice);

    if (success) {
      setShowMilestoneOverlay(false);
      Alert.alert(
        'Consciousness Expanded!',
        'Your choice has been applied to your network.'
      );
    } else {
      Alert.alert(
        'Error',
        'Failed to apply milestone choice. Please try again.'
      );
    }
  };

  const handleDismissMilestone = () => {
    dismissMilestone();
    setShowMilestoneOverlay(false);
  };

  if (loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Text className="text-text text-lg">Loading upgrade system...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-background items-center justify-center p-4">
        <Text className="text-red-400 text-lg font-semibold mb-2">Error</Text>
        <Text className="text-text/70 text-center">{error}</Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="bg-primary px-6 py-3 rounded-lg mt-4"
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="bg-surface px-4 py-3 border-b border-text/10">
        <View className="flex-row justify-between items-center">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="bg-primary px-4 py-2 rounded-lg"
          >
            <Text className="text-white font-semibold">← Back</Text>
          </TouchableOpacity>
          <Text className="text-text text-lg font-semibold">Upgrades</Text>
          <View style={{ width: 72 }} />
        </View>
      </View>

      <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
        {/* Milestone Progress */}
        {milestoneProgress.nextMilestone && (
          <View className="mb-6">
            <Text className="text-text font-semibold text-base mb-3">
              🧠 Consciousness Expansion Progress
            </Text>

            <View className="bg-surface rounded-xl p-4 border border-purple-500/20">
              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-text/80 text-sm">
                  {milestoneProgress.currentBeacons} /{' '}
                  {milestoneProgress.nextMilestone.beaconThreshold} Beacons
                </Text>
                <Text className="text-purple-400 font-semibold text-sm">
                  {Math.round(milestoneProgress.progress * 100)}%
                </Text>
              </View>

              {/* Progress Bar */}
              <View className="bg-background rounded-full h-3 overflow-hidden mb-3">
                <View
                  className="bg-purple-400 h-full rounded-full"
                  style={{ width: `${milestoneProgress.progress * 100}%` }}
                />
              </View>

              <Text className="text-text/70 text-sm text-center">
                Next: {milestoneProgress.nextMilestone.name}
              </Text>

              {availableMilestone && (
                <TouchableOpacity
                  onPress={() => setShowMilestoneOverlay(true)}
                  className="bg-purple-500 px-4 py-2 rounded-lg mt-3"
                >
                  <Text className="text-white font-semibold text-center">
                    🎉 Milestone Available!
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Upgrade Categories */}
        <View className="space-y-4">
          <Text className="text-text font-semibold text-lg">
            Upgrade Categories
          </Text>

          {UPGRADE_CATEGORIES.map(category => {
            const preview = getUpgradePreview(category);
            const currentLevel = 0; // upgradeManager?.getUpgradeLevel(category) || 0;
            const canAfford =
              preview &&
              typeof preview.cost === 'number' &&
              resources.quantumData >= preview.cost;
            const isPurchasing = purchasingCategory === category;

            if (!preview) return null;

            return (
              <View key={category} className="space-y-2">
                <UpgradeCategoryCard
                  category={category}
                  currentLevel={currentLevel}
                  preview={preview}
                  canAfford={!!canAfford}
                  isPurchasing={isPurchasing}
                  onPurchase={() => handlePurchaseUpgrade(category)}
                  onTogglePreview={() =>
                    setSelectedCategory(
                      selectedCategory === category ? null : category
                    )
                  }
                  isExpanded={selectedCategory === category}
                />
              </View>
            );
          })}
        </View>

        {/* Current Resources */}
        <View className="mt-6 bg-background/50 rounded-lg p-4">
          <Text className="text-text font-semibold text-base mb-2">
            Available Resources
          </Text>
          <Text className="text-primary text-xl font-bold">
            {formatNumber(resources.quantumData)} Quantum Data
          </Text>
        </View>
      </ScrollView>

      {/* Milestone Choice Overlay */}
      <MilestoneChoiceOverlay
        isVisible={showMilestoneOverlay}
        milestone={availableMilestone}
        onChoice={handleMilestoneChoice}
        onDismiss={handleDismissMilestone}
      />
    </View>
  );
};

interface UpgradeCategoryCardProps {
  category: UpgradeCategory;
  currentLevel: number;
  preview: any;
  canAfford: boolean;
  isPurchasing: boolean;
  onPurchase: () => void;
  onTogglePreview: () => void;
  isExpanded: boolean;
}

const UpgradeCategoryCard: React.FC<UpgradeCategoryCardProps> = ({
  category,
  currentLevel,
  preview,
  canAfford,
  isPurchasing,
  onPurchase,
  onTogglePreview,
  isExpanded,
}) => {
  const getCategoryInfo = (category: UpgradeCategory) => {
    switch (category) {
      case 'beaconEfficiency':
        return {
          icon: '📡',
          name: 'Beacon Efficiency',
          color: 'text-amber-400',
        };
      case 'probeSystems':
        return { icon: '🚀', name: 'Probe Systems', color: 'text-blue-400' };
      case 'offlineProcessing':
        return {
          icon: '⏰',
          name: 'Offline Processing',
          color: 'text-purple-400',
        };
      case 'consciousness':
        return { icon: '🧠', name: 'Consciousness', color: 'text-pink-400' };
    }
  };

  const categoryInfo = getCategoryInfo(category);

  return (
    <View className="bg-surface rounded-xl border border-text/10 overflow-hidden">
      {/* Main Card */}
      <TouchableOpacity
        onPress={onTogglePreview}
        className="p-4"
        activeOpacity={0.8}
      >
        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center flex-1">
            <Text className="text-2xl mr-3">{categoryInfo.icon}</Text>
            <View className="flex-1">
              <Text className={`${categoryInfo.color} font-bold text-base`}>
                {categoryInfo.name}
              </Text>
              <Text className="text-text/60 text-sm">
                Level {currentLevel} • Next: {formatNumber(preview.cost)} QD
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={onPurchase}
            disabled={!canAfford || isPurchasing}
            className={`px-4 py-2 rounded-lg ${
              canAfford && !isPurchasing ? 'bg-primary' : 'bg-text/20'
            }`}
          >
            <Text
              className={`font-semibold text-center ${
                canAfford && !isPurchasing ? 'text-white' : 'text-text/40'
              }`}
            >
              {isPurchasing ? 'Upgrading...' : 'Upgrade'}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {/* Expanded Preview */}
      {isExpanded && (
        <View className="px-4 pb-4 border-t border-text/10">
          <UpgradePreview category={category} preview={preview} />
        </View>
      )}
    </View>
  );
};
