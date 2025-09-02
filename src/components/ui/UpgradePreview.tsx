import React from 'react';
import { View, Text } from 'react-native';
import { formatNumber } from '../../utils/numberFormatting';

type UpgradeCategory =
  | 'beaconEfficiency'
  | 'probeSystems'
  | 'offlineProcessing'
  | 'consciousness';

interface UpgradePreviewType {
  currentLevel: number;
  cost: number;
  currentValue: number;
  newValue: number;
  efficiencyScore: number;
  recommendation: 'highly_recommended' | 'recommended' | 'not_recommended';
  paybackTime?: number;
}

interface UpgradePreviewProps {
  category: UpgradeCategory;
  preview: UpgradePreviewType;
  compact?: boolean;
}

export const UpgradePreview: React.FC<UpgradePreviewProps> = ({
  category,
  preview,
  compact = false,
}) => {
  const getCategoryInfo = (category: UpgradeCategory) => {
    switch (category) {
      case 'beaconEfficiency':
        return {
          icon: '📡',
          name: 'Beacon Efficiency',
          color: 'text-amber-400',
          unit: '/min',
        };
      case 'probeSystems':
        return {
          icon: '🚀',
          name: 'Probe Systems',
          color: 'text-blue-400',
          unit: 's',
        };
      case 'offlineProcessing':
        return {
          icon: '⏰',
          name: 'Offline Processing',
          color: 'text-purple-400',
          unit: '/min',
        };
      case 'consciousness':
        return {
          icon: '🧠',
          name: 'Consciousness',
          color: 'text-pink-400',
          unit: '',
        };
    }
  };

  const categoryInfo = getCategoryInfo(category);
  const improvement = preview.newValue - preview.currentValue;
  const improvementPercent = Math.round(
    (improvement / preview.currentValue) * 100
  );

  if (compact) {
    return (
      <View className="bg-background/30 rounded-lg p-3">
        <View className="flex-row justify-between items-center mb-2">
          <Text className={`${categoryInfo.color} font-semibold text-sm`}>
            {categoryInfo.icon} {categoryInfo.name}
          </Text>
          <Text className="text-green-400 text-sm font-semibold">
            +{improvementPercent}%
          </Text>
        </View>

        <View className="flex-row justify-between items-center">
          <Text className="text-text/70 text-xs">
            {formatNumber(preview.currentValue)} →{' '}
            {formatNumber(preview.newValue)}
            {categoryInfo.unit}
          </Text>
          <Text className="text-accent text-xs font-semibold">
            {formatNumber(preview.cost)} QD
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="bg-background/50 rounded-xl p-4 border border-text/10">
      {/* Header */}
      <View className="flex-row justify-between items-center mb-4">
        <View className="flex-row items-center">
          <Text className="text-2xl mr-3">{categoryInfo.icon}</Text>
          <View>
            <Text className={`${categoryInfo.color} font-bold text-lg`}>
              {categoryInfo.name}
            </Text>
            <Text className="text-text/60 text-sm">
              Level {preview.currentLevel} → {preview.currentLevel + 1}
            </Text>
          </View>
        </View>

        <View className="items-end">
          <Text className="text-green-400 text-xl font-bold">
            +{improvementPercent}%
          </Text>
          <Text className="text-text/60 text-xs">improvement</Text>
        </View>
      </View>

      {/* Current vs New Values */}
      <View className="space-y-3 mb-4">
        <View className="flex-row justify-between items-center py-2 border-b border-text/10">
          <Text className="text-text/70 text-sm">Current</Text>
          <Text className="text-text font-semibold">
            {formatNumber(preview.currentValue)}
            {categoryInfo.unit}
          </Text>
        </View>

        <View className="flex-row justify-between items-center py-2 border-b border-text/10">
          <Text className="text-text/70 text-sm">After Upgrade</Text>
          <Text className="text-green-400 font-semibold">
            {formatNumber(preview.newValue)}
            {categoryInfo.unit}
          </Text>
        </View>

        <View className="flex-row justify-between items-center py-2">
          <Text className="text-text/70 text-sm">Improvement</Text>
          <Text className="text-green-400 font-bold">
            +{formatNumber(improvement)}
            {categoryInfo.unit}
          </Text>
        </View>
      </View>

      {/* Cost Analysis */}
      <View className="bg-surface/50 rounded-lg p-3 space-y-2">
        <View className="flex-row justify-between items-center">
          <Text className="text-text/70 text-sm">Upgrade Cost</Text>
          <Text className="text-accent font-semibold">
            {formatNumber(preview.cost)} QD
          </Text>
        </View>

        {preview.paybackTime && (
          <View className="flex-row justify-between items-center">
            <Text className="text-text/70 text-sm">Payback Time</Text>
            <Text className="text-text/80 text-sm">
              {preview.paybackTime < 60
                ? `${Math.ceil(preview.paybackTime)}s`
                : `${Math.ceil(preview.paybackTime / 60)}m`}
            </Text>
          </View>
        )}

        <View className="flex-row justify-between items-center">
          <Text className="text-text/70 text-sm">Efficiency Score</Text>
          <View className="flex-row items-center">
            <View
              className={`w-2 h-2 rounded-full mr-2 ${
                preview.efficiencyScore >= 0.8
                  ? 'bg-green-400'
                  : preview.efficiencyScore >= 0.6
                    ? 'bg-yellow-400'
                    : 'bg-red-400'
              }`}
            />
            <Text className="text-text/80 text-sm">
              {Math.round(preview.efficiencyScore * 100)}%
            </Text>
          </View>
        </View>
      </View>

      {/* Recommendation */}
      {preview.recommendation && (
        <View
          className={`mt-3 p-3 rounded-lg ${
            preview.recommendation === 'highly_recommended'
              ? 'bg-green-500/20 border border-green-500/30'
              : preview.recommendation === 'recommended'
                ? 'bg-yellow-500/20 border border-yellow-500/30'
                : 'bg-red-500/20 border border-red-500/30'
          }`}
        >
          <Text
            className={`text-center text-sm font-semibold ${
              preview.recommendation === 'highly_recommended'
                ? 'text-green-400'
                : preview.recommendation === 'recommended'
                  ? 'text-yellow-400'
                  : 'text-red-400'
            }`}
          >
            {preview.recommendation === 'highly_recommended' &&
              '⭐ Highly Recommended'}
            {preview.recommendation === 'recommended' && '👍 Recommended'}
            {preview.recommendation === 'not_recommended' &&
              '⚠️ Not Recommended'}
          </Text>
        </View>
      )}
    </View>
  );
};
