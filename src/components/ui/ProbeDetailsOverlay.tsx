import React, { useMemo, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { BaseOverlay } from './BaseOverlay';
import { ProbeInstance } from '../../types/probe';
import { formatNumber } from '../../utils/numberFormatting';
import * as Haptics from 'expo-haptics';

interface ProbeDetailsOverlayProps {
  isVisible: boolean;
  probe?: ProbeInstance;
  onClose: () => void;
  gameController?: any;
  zIndex?: number;
}

export const ProbeDetailsOverlay: React.FC<ProbeDetailsOverlayProps> = ({
  isVisible,
  probe,
  onClose,
  gameController,
  zIndex = 1000,
}) => {
  const [refreshTime, setRefreshTime] = useState(Date.now());

  // Auto-refresh probe status every 2 seconds
  useEffect(() => {
    if (!isVisible || !probe) return;

    const interval = setInterval(() => {
      setRefreshTime(Date.now());
    }, 2000);

    return () => clearInterval(interval);
  }, [isVisible, probe]);

  // Calculate probe stats and information
  const probeStats = useMemo(() => {
    if (!probe) return null;

    const now = Date.now();
    const deployedTime = now - probe.createdAt;
    const totalTravelTime = probe.deploymentStartedAt
      ? probe.deploymentStartedAt - probe.createdAt
      : 30000; // Default 30s
    const estimatedArrival = probe.createdAt + totalTravelTime;
    const remainingTime = Math.max(0, estimatedArrival - now);
    const progress = Math.min(1, probe.travelProgress * 100);

    return {
      type: probe.type,
      status: probe.status,
      deployedTime: deployedTime / 1000, // Convert to seconds
      estimatedArrival,
      remainingTime: remainingTime / 1000, // Convert to seconds
      progress: progress,
      targetPosition: `(${probe.targetPosition.x.toFixed(1)}, ${probe.targetPosition.y.toFixed(1)})`,
      isArrived: remainingTime <= 0,
      // Mock additional stats - would come from actual calculations
      fuelUsed: Math.floor(progress * 100),
      efficiency: Math.min(100, 85 + Math.random() * 15),
      signalStrength: Math.max(20, 100 - (deployedTime / 1000) * 0.1),
    };
  }, [probe, refreshTime]);

  const getProbeTypeInfo = (type: string) => {
    switch (type) {
      case 'pioneer':
        return {
          emoji: '🚀',
          name: 'Pioneer Probe',
          description: 'Fast exploration and initial beacon deployment',
          color: 'text-primary',
          specialties: ['Quick deployment', 'Long range', 'Basic scanning'],
        };
      case 'harvester':
        return {
          emoji: '⛏️',
          name: 'Harvester Probe',
          description: 'Optimized for resource-rich beacon placement',
          color: 'text-secondary',
          specialties: [
            'Resource detection',
            'Efficient deployment',
            'Area analysis',
          ],
        };
      case 'architect':
        return {
          emoji: '🏗️',
          name: 'Architect Probe',
          description: 'Precision placement for complex patterns',
          color: 'text-accent',
          specialties: [
            'Pattern analysis',
            'Precise positioning',
            'Network optimization',
          ],
        };
      default:
        return {
          emoji: '🛸',
          name: 'Probe',
          description: 'Beacon deployment vehicle',
          color: 'text-text',
          specialties: ['Basic deployment'],
        };
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'traveling':
        return {
          text: 'En Route',
          color: 'text-blue-400',
          description: 'Traveling to target position',
        };
      case 'deploying':
        return {
          text: 'Deploying',
          color: 'text-yellow-400',
          description: 'Setting up beacon at target location',
        };
      case 'completed':
        return {
          text: 'Completed',
          color: 'text-green-400',
          description: 'Mission accomplished successfully',
        };
      case 'failed':
        return {
          text: 'Failed',
          color: 'text-red-400',
          description: 'Mission encountered an error',
        };
      default:
        return {
          text: 'Unknown',
          color: 'text-text/60',
          description: 'Status unknown',
        };
    }
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) {
      return `${Math.floor(seconds)}s`;
    } else if (seconds < 3600) {
      return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  };

  const handleRecallProbe = () => {
    if (!probe) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert(
      'Recall Probe',
      'Are you sure you want to recall this probe? It will return without deploying a beacon.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Recall',
          style: 'destructive',
          onPress: () => {
            // TODO: Implement actual recall logic through gameController
            Alert.alert(
              'Probe Recalled',
              'The probe has been recalled and is returning.'
            );
            onClose();
          },
        },
      ]
    );
  };

  const handleBoostProbe = () => {
    if (!probe) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert(
      'Boost Probe',
      'Use Chronos Particles to accelerate this probe?\n\nCost: 1 Chronos Particle\nEffect: Instant arrival',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Boost',
          style: 'default',
          onPress: () => {
            // TODO: Implement actual boost logic through gameController
            Alert.alert(
              'Probe Boosted',
              'The probe has arrived at its destination!'
            );
            onClose();
          },
        },
      ]
    );
  };

  if (!probe || !probeStats) {
    return (
      <BaseOverlay
        isVisible={isVisible}
        onClose={onClose}
        title="Error"
        zIndex={zIndex}
      >
        <Text className="text-text/60 text-center">
          No probe data available.
        </Text>
      </BaseOverlay>
    );
  }

  const typeInfo = getProbeTypeInfo(probe.type);
  const statusInfo = getStatusInfo(probe.status);

  return (
    <BaseOverlay
      isVisible={isVisible}
      onClose={onClose}
      title="Probe Details"
      maxHeight={700}
      zIndex={zIndex}
    >
      <View className="space-y-6">
        {/* Probe Header */}
        <View className="items-center mb-2">
          <Text className="text-4xl mb-2">{typeInfo.emoji}</Text>
          <Text className={`${typeInfo.color} text-xl font-bold`}>
            {typeInfo.name}
          </Text>
          <Text className="text-text/60 text-center mt-1">
            {typeInfo.description}
          </Text>
        </View>

        {/* Status Display */}
        <View className="bg-background/50 rounded-lg p-4">
          <Text className="text-text font-semibold text-lg mb-3">
            Mission Status
          </Text>

          <View className="items-center mb-4">
            <View
              className={`px-3 py-2 rounded-full mb-2`}
              style={{
                backgroundColor: statusInfo.color.replace('text-', '') + '20',
              }}
            >
              <Text className={`${statusInfo.color} font-bold`}>
                {statusInfo.text}
              </Text>
            </View>
            <Text className="text-text/60 text-center text-sm">
              {statusInfo.description}
            </Text>
          </View>

          {!probeStats.isArrived && (
            <View className="mb-4">
              <View className="flex-row justify-between mb-2">
                <Text className="text-text/70">Progress</Text>
                <Text className="text-text font-semibold">
                  {probeStats.progress.toFixed(1)}%
                </Text>
              </View>
              <View className="bg-text/20 rounded-full h-2 mb-2">
                <View
                  className="bg-primary rounded-full h-2"
                  style={{ width: `${probeStats.progress}%` }}
                />
              </View>
              <Text className="text-text/60 text-center text-xs">
                ETA: {formatTime(probeStats.remainingTime)}
              </Text>
            </View>
          )}
        </View>

        {/* Mission Details */}
        <View className="bg-background/50 rounded-lg p-4">
          <Text className="text-text font-semibold text-lg mb-3">
            Mission Details
          </Text>

          <View className="space-y-2">
            <View className="flex-row justify-between">
              <Text className="text-text/70">Target Position</Text>
              <Text className="text-text font-semibold">
                {probeStats.targetPosition}
              </Text>
            </View>

            <View className="flex-row justify-between">
              <Text className="text-text/70">Mission Time</Text>
              <Text className="text-text font-semibold">
                {formatTime(probeStats.deployedTime)}
              </Text>
            </View>

            <View className="flex-row justify-between">
              <Text className="text-text/70">Fuel Used</Text>
              <Text className="text-text font-semibold">
                {probeStats.fuelUsed}%
              </Text>
            </View>

            <View className="flex-row justify-between">
              <Text className="text-text/70">Signal Strength</Text>
              <Text className="text-green-400 font-semibold">
                {probeStats.signalStrength.toFixed(0)}%
              </Text>
            </View>
          </View>
        </View>

        {/* Probe Capabilities */}
        <View className="bg-background/50 rounded-lg p-4">
          <Text className="text-text font-semibold text-lg mb-3">
            Capabilities
          </Text>

          <View className="space-y-1">
            {typeInfo.specialties.map((specialty, index) => (
              <View key={index} className="flex-row items-center">
                <Text className="text-primary mr-2">•</Text>
                <Text className="text-text/70">{specialty}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Action Buttons */}
        <View className="space-y-3">
          {!probeStats.isArrived && probe.status === 'traveling' && (
            <>
              <TouchableOpacity
                onPress={handleBoostProbe}
                className="bg-accent/20 border border-accent/30 px-4 py-3 rounded-lg"
              >
                <Text className="text-accent font-semibold text-center">
                  ⚡ Boost Probe (1 CP)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleRecallProbe}
                className="bg-red-500/20 border border-red-500/30 px-4 py-3 rounded-lg"
              >
                <Text className="text-red-400 font-semibold text-center">
                  📡 Recall Probe
                </Text>
              </TouchableOpacity>
            </>
          )}

          {probeStats.isArrived && (
            <View className="bg-green-400/20 border border-green-400/30 px-4 py-3 rounded-lg">
              <Text className="text-green-400 font-semibold text-center">
                ✅ Mission Complete
              </Text>
              <Text className="text-green-400/70 text-center text-sm mt-1">
                Beacon deployed successfully
              </Text>
            </View>
          )}
        </View>
      </View>
    </BaseOverlay>
  );
};
