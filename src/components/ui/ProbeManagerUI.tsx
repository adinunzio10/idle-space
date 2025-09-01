import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ProbeManager } from '../../core/ProbeManager';
import { ProbeInstance, ProbeType, PROBE_TYPE_CONFIG } from '../../types/probe';
import { Point2D } from '../../types/galaxy';

interface ProbeManagerUIProps {
  probeManager: ProbeManager;
  onClose?: () => void;
}

interface ProbeQueueStatus {
  queuedProbes: ProbeInstance[];
  activeProbes: ProbeInstance[];
  totalProbes: number;
}

export const ProbeManagerUI: React.FC<ProbeManagerUIProps> = ({
  probeManager,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const [queueStatus, setQueueStatus] = useState<ProbeQueueStatus>({
    queuedProbes: [],
    activeProbes: [],
    totalProbes: 0,
  });
  const [accelerationCooldown, setAccelerationCooldown] = useState(false);

  useEffect(() => {
    // Set up probe updates
    const updateProbeStatus = (probes: ProbeInstance[]) => {
      setQueueStatus(probeManager.getQueueStatus());
    };

    const removeProbeUpdateCallback = probeManager.addProbeUpdateCallback(updateProbeStatus);

    // Initial load
    setQueueStatus(probeManager.getQueueStatus());

    // Update every second
    const interval = setInterval(() => {
      setQueueStatus(probeManager.getQueueStatus());
    }, 1000);

    return () => {
      clearInterval(interval);
      removeProbeUpdateCallback();
    };
  }, [probeManager]);

  const handleManualAcceleration = async () => {
    if (accelerationCooldown) return;

    try {
      // Apply haptic feedback
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const result = probeManager.accelerateNextLaunch();
      
      if (result.success) {
        // Success feedback
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        // Set cooldown (2 seconds)
        setAccelerationCooldown(true);
        setTimeout(() => {
          setAccelerationCooldown(false);
        }, 2000);
        
        console.log('[ProbeManagerUI] Manual acceleration applied successfully');
      } else {
        // Error feedback
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        console.warn('[ProbeManagerUI] Manual acceleration failed:', result.error);
      }
    } catch (error) {
      console.error('[ProbeManagerUI] Error during manual acceleration:', error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const launchDemoProbe = async (type: ProbeType) => {
    try {
      // Launch probe at random position for demo within galaxy bounds (0-2000)
      const randomPosition: Point2D = {
        x: Math.random() * 1800 + 100, // 100-1900 to stay within bounds
        y: Math.random() * 1800 + 100,
      };
      
      // Start position near the galaxy center for visibility
      const startPosition: Point2D = {
        x: 1000, // Center of 2000x2000 galaxy
        y: 1000,
      };

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const result = probeManager.queueProbe(type, randomPosition, 1, startPosition);
      
      if (result.success) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        console.log(`[ProbeManagerUI] Launched ${type} probe successfully`);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        console.warn(`[ProbeManagerUI] Failed to launch ${type} probe:`, result.error);
      }
    } catch (error) {
      console.error(`[ProbeManagerUI] Error launching ${type} probe:`, error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const formatTimeRemaining = (probe: ProbeInstance): string => {
    if (probe.status !== 'launching' || !probe.deploymentStartedAt) {
      return '-';
    }

    const config = PROBE_TYPE_CONFIG[probe.type];
    const adjustedTime = config.deploymentTime / probe.accelerationBonus;
    const elapsed = (Date.now() - probe.deploymentStartedAt) / 1000;
    const remaining = Math.max(0, adjustedTime - elapsed);
    
    return `${Math.ceil(remaining)}s`;
  };

  const getProgressPercentage = (probe: ProbeInstance): number => {
    return Math.round(probe.travelProgress * 100);
  };

  return (
    <View className="flex-1 bg-surface rounded-t-xl overflow-hidden">
      {/* Header */}
      <View 
        className="bg-surface px-4 py-3"
        style={{ paddingTop: insets.top + 12 }}
      >
        <View className="flex-row justify-between items-center">
          {onClose && (
            <TouchableOpacity
              onPress={onClose}
              className="bg-primary px-4 py-2 rounded-lg"
            >
              <Text className="text-white font-semibold">← Back</Text>
            </TouchableOpacity>
          )}
          <Text className="text-text text-lg font-semibold">Probe Manager</Text>
          <View style={{ width: 72 }} />
        </View>
        <Text className="text-text/60 text-sm mt-1">
          {queueStatus.totalProbes} probes • {queueStatus.queuedProbes.length} queued • {queueStatus.activeProbes.length} active
        </Text>
      </View>

      <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
        {/* Manual Acceleration Section */}
        <View className="mb-6">
          <Text className="text-text font-semibold text-base mb-3">Manual Acceleration</Text>
          
          <TouchableOpacity
            onPress={handleManualAcceleration}
            disabled={accelerationCooldown || queueStatus.queuedProbes.length === 0}
            className={`p-4 rounded-xl border-2 ${
              accelerationCooldown || queueStatus.queuedProbes.length === 0
                ? 'bg-surface/50 border-text/10'
                : 'bg-accent/20 border-accent/50'
            }`}
          >
            <View className="items-center">
              <Text className={`text-2xl mb-2 ${
                accelerationCooldown || queueStatus.queuedProbes.length === 0
                  ? 'opacity-50'
                  : ''
              }`}>
                ⚡
              </Text>
              <Text className={`font-semibold text-base ${
                accelerationCooldown || queueStatus.queuedProbes.length === 0
                  ? 'text-text/40'
                  : 'text-accent'
              }`}>
                {accelerationCooldown ? 'Cooling Down...' : 'Accelerate Next Launch'}
              </Text>
              <Text className={`text-sm mt-1 ${
                accelerationCooldown || queueStatus.queuedProbes.length === 0
                  ? 'text-text/30'
                  : 'text-text/70'
              }`}>
                2x Speed Boost
              </Text>
            </View>
          </TouchableOpacity>

          {queueStatus.queuedProbes.length === 0 && (
            <Text className="text-text/50 text-sm text-center mt-2">
              No probes in queue
            </Text>
          )}
        </View>

        {/* Quick Launch Section */}
        <View className="mb-6">
          <Text className="text-text font-semibold text-base mb-3">Quick Launch</Text>
          <View className="flex-row space-x-2">
            {Object.entries(PROBE_TYPE_CONFIG).map(([type, config]) => (
              <TouchableOpacity
                key={type}
                onPress={() => launchDemoProbe(type as ProbeType)}
                className="flex-1 p-3 bg-background rounded-lg border border-text/20"
              >
                <Text className="text-xl text-center mb-1">{config.icon}</Text>
                <Text className="text-text/80 text-xs text-center font-medium capitalize">
                  {type}
                </Text>
                <Text className="text-text/60 text-xs text-center mt-1">
                  {config.deploymentTime}s
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Active Probes Section */}
        {queueStatus.activeProbes.length > 0 && (
          <View className="mb-6">
            <Text className="text-text font-semibold text-base mb-3">Active Probes</Text>
            {queueStatus.activeProbes.map((probe) => (
              <View
                key={probe.id}
                className="bg-background p-3 rounded-lg mb-2 border border-text/10"
              >
                <View className="flex-row justify-between items-center mb-2">
                  <View className="flex-row items-center">
                    <Text className="text-lg mr-2">
                      {PROBE_TYPE_CONFIG[probe.type].icon}
                    </Text>
                    <View>
                      <Text className="text-text font-medium capitalize">
                        {probe.type}
                      </Text>
                      <Text className="text-text/60 text-xs">
                        Status: {probe.status}
                      </Text>
                    </View>
                  </View>
                  <View className="items-end">
                    <Text className="text-text/80 text-sm">
                      {getProgressPercentage(probe)}%
                    </Text>
                    <Text className="text-text/60 text-xs">
                      {formatTimeRemaining(probe)}
                    </Text>
                  </View>
                </View>
                
                {/* Progress Bar */}
                <View className="bg-text/10 rounded-full h-2 overflow-hidden">
                  <View 
                    className="bg-accent h-full rounded-full transition-all duration-1000"
                    style={{ width: `${getProgressPercentage(probe)}%` }}
                  />
                </View>
                
                {/* Acceleration Indicator */}
                {probe.accelerationBonus > 1 && (
                  <View className="flex-row items-center justify-center mt-2">
                    <Text className="text-accent text-xs font-semibold">
                      ⚡ {probe.accelerationBonus}x Speed Boost
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Queued Probes Section */}
        {queueStatus.queuedProbes.length > 0 && (
          <View className="mb-4">
            <Text className="text-text font-semibold text-base mb-3">Queue</Text>
            {queueStatus.queuedProbes.map((probe, index) => (
              <View
                key={probe.id}
                className="bg-background/50 p-3 rounded-lg mb-2 border border-text/5"
              >
                <View className="flex-row justify-between items-center">
                  <View className="flex-row items-center">
                    <Text className="text-lg mr-2 opacity-60">
                      {PROBE_TYPE_CONFIG[probe.type].icon}
                    </Text>
                    <View>
                      <Text className="text-text/80 font-medium capitalize">
                        {probe.type}
                      </Text>
                      <Text className="text-text/40 text-xs">
                        Position #{index + 1} in queue
                      </Text>
                    </View>
                  </View>
                  <View className="items-end">
                    <Text className="text-text/60 text-sm">
                      {PROBE_TYPE_CONFIG[probe.type].deploymentTime}s
                    </Text>
                    {probe.accelerationBonus > 1 && (
                      <Text className="text-accent text-xs font-semibold">
                        ⚡ {probe.accelerationBonus}x Ready
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {queueStatus.totalProbes === 0 && (
          <View className="items-center justify-center py-8">
            <Text className="text-text/40 text-base">No probes launched yet</Text>
            <Text className="text-text/30 text-sm mt-1">
              Use Quick Launch to get started
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};