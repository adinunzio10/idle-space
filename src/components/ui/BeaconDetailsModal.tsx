import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { BaseModal } from './BaseModal';
import { Beacon } from '../../types/galaxy';
import { formatNumber } from '../../utils/numberFormatting';
import * as Haptics from 'expo-haptics';

interface BeaconDetailsModalProps {
  isVisible: boolean;
  beacon?: Beacon;
  onClose: () => void;
  gameController?: any;
}

export const BeaconDetailsModal: React.FC<BeaconDetailsModalProps> = ({
  isVisible,
  beacon,
  onClose,
  gameController
}) => {
  // Calculate beacon stats and information
  const beaconStats = useMemo(() => {
    if (!beacon) return null;

    return {
      type: beacon.type,
      level: beacon.level,
      connections: beacon.connections.length,
      position: `(${beacon.position.x.toFixed(1)}, ${beacon.position.y.toFixed(1)})`,
      // Mock data - would come from actual calculations
      resourceGeneration: beacon.level * 10,
      efficiency: Math.min(100, beacon.level * 15 + beacon.connections.length * 5),
      upgradeCost: beacon.level * 50,
      nextLevelBonus: (beacon.level + 1) * 10 - beacon.level * 10
    };
  }, [beacon]);

  const getBeaconTypeInfo = (type: string) => {
    switch (type) {
      case 'pioneer':
        return {
          emoji: '🚀',
          name: 'Pioneer Beacon',
          description: 'Explores new regions and establishes connections',
          color: 'text-primary'
        };
      case 'harvester':
        return {
          emoji: '⛏️',
          name: 'Harvester Beacon',
          description: 'Optimized for resource generation',
          color: 'text-secondary'
        };
      case 'architect':
        return {
          emoji: '🏗️',
          name: 'Architect Beacon',
          description: 'Enables complex pattern formations',
          color: 'text-accent'
        };
      default:
        return {
          emoji: '📡',
          name: 'Beacon',
          description: 'Signal transmission node',
          color: 'text-text'
        };
    }
  };

  const handleUpgradeBeacon = () => {
    if (!beacon || !beaconStats) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    Alert.alert(
      'Upgrade Beacon',
      `Upgrade ${beaconStats.type} beacon to level ${beaconStats.level + 1}?\n\nCost: ${formatNumber(beaconStats.upgradeCost)} Quantum Data\nBonus: +${beaconStats.nextLevelBonus} resource generation`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Upgrade',
          style: 'default',
          onPress: () => {
            // TODO: Implement actual upgrade logic through gameController
            Alert.alert('Upgrade Complete', 'Beacon has been upgraded!');
            onClose();
          }
        }
      ]
    );
  };

  const handleDeleteBeacon = () => {
    if (!beacon) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    Alert.alert(
      'Delete Beacon',
      'Are you sure you want to delete this beacon? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // TODO: Implement actual delete logic through gameController
            Alert.alert('Beacon Deleted', 'The beacon has been removed.');
            onClose();
          }
        }
      ]
    );
  };

  if (!beacon || !beaconStats) {
    return (
      <BaseModal
        isVisible={isVisible}
        onClose={onClose}
        title="Error"
      >
        <Text className="text-text/60 text-center">
          No beacon data available.
        </Text>
      </BaseModal>
    );
  }

  const typeInfo = getBeaconTypeInfo(beacon.type);

  return (
    <BaseModal
      isVisible={isVisible}
      onClose={onClose}
      title="Beacon Details"
      maxHeight={600}
    >
      <View className="space-y-6">
        {/* Beacon Header */}
        <View className="items-center mb-2">
          <Text className="text-4xl mb-2">{typeInfo.emoji}</Text>
          <Text className={`${typeInfo.color} text-xl font-bold`}>
            {typeInfo.name}
          </Text>
          <Text className="text-text/60 text-center mt-1">
            {typeInfo.description}
          </Text>
        </View>

        {/* Basic Stats */}
        <View className="bg-background/50 rounded-lg p-4">
          <Text className="text-text font-semibold text-lg mb-3">Basic Information</Text>
          
          <View className="space-y-2">
            <View className="flex-row justify-between">
              <Text className="text-text/70">Level</Text>
              <Text className="text-text font-semibold">{beaconStats.level}</Text>
            </View>
            
            <View className="flex-row justify-between">
              <Text className="text-text/70">Position</Text>
              <Text className="text-text font-semibold">{beaconStats.position}</Text>
            </View>
            
            <View className="flex-row justify-between">
              <Text className="text-text/70">Connections</Text>
              <Text className="text-text font-semibold">{beaconStats.connections}</Text>
            </View>
          </View>
        </View>

        {/* Performance Stats */}
        <View className="bg-background/50 rounded-lg p-4">
          <Text className="text-text font-semibold text-lg mb-3">Performance</Text>
          
          <View className="space-y-2">
            <View className="flex-row justify-between">
              <Text className="text-text/70">Resource Generation</Text>
              <Text className="text-primary font-semibold">
                {formatNumber(beaconStats.resourceGeneration)}/min
              </Text>
            </View>
            
            <View className="flex-row justify-between">
              <Text className="text-text/70">Efficiency</Text>
              <Text className="text-green-400 font-semibold">
                {beaconStats.efficiency}%
              </Text>
            </View>
          </View>
        </View>

        {/* Upgrade Information */}
        <View className="bg-background/50 rounded-lg p-4">
          <Text className="text-text font-semibold text-lg mb-3">Upgrade Options</Text>
          
          <View className="space-y-2 mb-4">
            <View className="flex-row justify-between">
              <Text className="text-text/70">Next Level</Text>
              <Text className="text-text font-semibold">{beaconStats.level + 1}</Text>
            </View>
            
            <View className="flex-row justify-between">
              <Text className="text-text/70">Upgrade Cost</Text>
              <Text className="text-accent font-semibold">
                {formatNumber(beaconStats.upgradeCost)} QD
              </Text>
            </View>
            
            <View className="flex-row justify-between">
              <Text className="text-text/70">Bonus Gain</Text>
              <Text className="text-green-400 font-semibold">
                +{beaconStats.nextLevelBonus}/min
              </Text>
            </View>
          </View>
          
          <TouchableOpacity
            onPress={handleUpgradeBeacon}
            className="bg-primary px-4 py-3 rounded-lg mb-3"
          >
            <Text className="text-white font-semibold text-center">
              Upgrade Beacon
            </Text>
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View className="space-y-3">
          <TouchableOpacity
            onPress={() => {
              // TODO: Implement beacon specialization
              Alert.alert('Coming Soon', 'Beacon specialization will be available in a future update.');
            }}
            className="bg-secondary/20 border border-secondary/30 px-4 py-3 rounded-lg"
          >
            <Text className="text-secondary font-semibold text-center">
              Customize Specialization
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={handleDeleteBeacon}
            className="bg-red-500/20 border border-red-500/30 px-4 py-3 rounded-lg"
          >
            <Text className="text-red-400 font-semibold text-center">
              Delete Beacon
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </BaseModal>
  );
};