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
  // Store beacon data to prevent loss during re-renders
  const [stableBeacon, setStableBeacon] = React.useState<Beacon | undefined>(undefined);
  
  React.useEffect(() => {
    if (beacon && isVisible) {
      console.log('[BeaconDetailsModal] Setting stable beacon:', beacon);
      setStableBeacon(beacon);
    } else if (!isVisible) {
      // Clear when modal closes
      setStableBeacon(undefined);
    }
  }, [beacon, isVisible]);
  // Calculate beacon stats and information
  const beaconStats = useMemo(() => {
    const activeBeacon = stableBeacon || beacon;
    
    if (!activeBeacon) {
      console.log('[BeaconDetailsModal] No beacon provided');
      return null;
    }

    console.log('[BeaconDetailsModal] Beacon data:', activeBeacon);

    // Handle different beacon data structures
    const beaconType = activeBeacon.type || 'pioneer';
    const beaconLevel = activeBeacon.level || 1;
    const beaconConnections = activeBeacon.connections || [];
    const beaconPosition = activeBeacon.position || { x: 0, y: 0 };

    return {
      type: beaconType,
      level: beaconLevel,
      connections: Array.isArray(beaconConnections) ? beaconConnections.length : 0,
      position: `(${beaconPosition.x.toFixed(1)}, ${beaconPosition.y.toFixed(1)})`,
      // Mock data - would come from actual calculations
      resourceGeneration: beaconLevel * 10,
      efficiency: Math.min(100, beaconLevel * 15 + (Array.isArray(beaconConnections) ? beaconConnections.length : 0) * 5),
      upgradeCost: beaconLevel * 50,
      nextLevelBonus: (beaconLevel + 1) * 10 - beaconLevel * 10
    };
  }, [stableBeacon, beacon]);

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
    const activeBeacon = stableBeacon || beacon;
    if (!activeBeacon || !beaconStats || !gameController) return;
    
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
            try {
              const beaconUpgradeManager = gameController.getBeaconUpgradeManager?.();
              const beaconManager = gameController.getBeaconManager();
              const resourceManager = gameController.getResourceManager();
              
              if (!beaconUpgradeManager || !resourceManager) {
                Alert.alert('Error', 'Upgrade system not available.');
                return;
              }

              // Check if player can afford the upgrade
              if (resourceManager.getResource('quantumData') < beaconStats.upgradeCost) {
                Alert.alert(
                  'Insufficient Resources',
                  `You need ${formatNumber(beaconStats.upgradeCost)} Quantum Data but only have ${formatNumber(resourceManager.getResource('quantumData'))}.`
                );
                return;
              }

              // Get the actual beacon entity
              const beaconEntity = beaconManager.getBeacon(activeBeacon.id);
              if (!beaconEntity) {
                Alert.alert('Error', 'Beacon not found.');
                return;
              }

              // Spend resources and upgrade beacon
              const success = resourceManager.spendResource('quantumData', beaconStats.upgradeCost);
              if (success && beaconUpgradeManager.levelUpBeacon(beaconEntity)) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('Upgrade Complete', 'Beacon has been upgraded successfully!');
                onClose();
              } else {
                // Refund resources if upgrade failed
                resourceManager.addResource('quantumData', beaconStats.upgradeCost);
                Alert.alert('Upgrade Failed', 'Unable to upgrade beacon. Please try again.');
              }
            } catch (error) {
              console.error('Error upgrading beacon:', error);
              Alert.alert('Error', 'An error occurred while upgrading the beacon.');
            }
          }
        }
      ]
    );
  };

  const handleDeleteBeacon = () => {
    const activeBeacon = stableBeacon || beacon;
    if (!activeBeacon) return;
    
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

  const activeBeacon = stableBeacon || beacon;
  
  if (!activeBeacon || !beaconStats) {
    return (
      <BaseModal
        isVisible={isVisible}
        onClose={onClose}
        title="Beacon Details"
      >
        <View className="items-center py-8">
          <Text className="text-text/60 text-center text-lg mb-4">
            Loading beacon data...
          </Text>
          <Text className="text-text/40 text-center text-sm">
            Debug: {activeBeacon ? 'Has beacon' : 'No beacon'} | {beaconStats ? 'Has stats' : 'No stats'}
          </Text>
        </View>
      </BaseModal>
    );
  }

  const typeInfo = getBeaconTypeInfo((stableBeacon || beacon)?.type || 'pioneer');

  return (
    <BaseModal
      isVisible={isVisible}
      onClose={onClose}
      title="Beacon Details"
      maxHeight={500}
    >
      <View className="space-y-6">
        {/* DEBUG: Show raw data */}
        <View className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
          <Text className="text-red-400 font-semibold text-sm mb-2">DEBUG INFO:</Text>
          <Text className="text-text/80 text-xs mb-1">
            Beacon: {beacon ? 'EXISTS' : 'NULL'}
          </Text>
          <Text className="text-text/80 text-xs mb-1">
            BeaconStats: {beaconStats ? 'EXISTS' : 'NULL'}
          </Text>
          {(stableBeacon || beacon) && (
            <Text className="text-text/80 text-xs">
              Raw: {JSON.stringify(stableBeacon || beacon, null, 2)}
            </Text>
          )}
        </View>
        {/* Simple Test Content */}
        <View className="items-center mb-4">
          <Text className="text-text text-xl font-bold mb-2">
            SIMPLE TEST CONTENT
          </Text>
          {(stableBeacon || beacon) && beaconStats && (
            <>
              <Text className="text-primary text-lg">
                {beaconStats.type} Beacon
              </Text>
              <Text className="text-text/70">
                Level {beaconStats.level} at {beaconStats.position}
              </Text>
              <Text className="text-accent">
                {beaconStats.connections} connections
              </Text>
            </>
          )}
        </View>

        {/* Temporarily Simplified - Test Basic Display */}
        {(stableBeacon || beacon) && beaconStats && (
          <View className="space-y-4">
            <View className="bg-background/50 rounded-lg p-4">
              <Text className="text-text font-semibold text-lg mb-3">Basic Information</Text>
              <Text className="text-text">Level: {beaconStats.level}</Text>
              <Text className="text-text">Type: {beaconStats.type}</Text>
              <Text className="text-text">Position: {beaconStats.position}</Text>
              <Text className="text-text">Connections: {beaconStats.connections}</Text>
            </View>
            
            <TouchableOpacity
              onPress={handleUpgradeBeacon}
              className="bg-primary px-4 py-3 rounded-lg"
            >
              <Text className="text-white font-semibold text-center">
                Upgrade Beacon (Cost: {formatNumber(beaconStats.upgradeCost)} QD)
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </BaseModal>
  );
};