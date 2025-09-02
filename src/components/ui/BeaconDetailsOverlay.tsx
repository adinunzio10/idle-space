import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { BaseOverlay } from './BaseOverlay';
import { Beacon } from '../../types/galaxy';
import { formatNumber } from '../../utils/numberFormatting';
import * as Haptics from 'expo-haptics';

interface BeaconDetailsOverlayProps {
  isVisible: boolean;
  beacon?: Beacon;
  onClose: () => void;
  gameController?: any;
  zIndex?: number;
}

export const BeaconDetailsOverlay: React.FC<BeaconDetailsOverlayProps> = ({
  isVisible,
  beacon,
  onClose,
  gameController,
  zIndex = 1000,
}) => {
  // Calculate beacon stats and information
  const beaconStats = useMemo(() => {
    if (!beacon) {
      return null;
    }

    // Handle different beacon data structures
    const beaconType = beacon.type || 'pioneer';
    const beaconLevel = beacon.level || 1;
    const beaconConnections = beacon.connections || [];
    const beaconPosition = beacon.position || { x: 0, y: 0 };

    const stats = {
      type: beaconType,
      level: beaconLevel,
      connections: Array.isArray(beaconConnections)
        ? beaconConnections.length
        : 0,
      position: `(${beaconPosition.x.toFixed(1)}, ${beaconPosition.y.toFixed(1)})`,
      // Mock data - would come from actual calculations
      resourceGeneration: beaconLevel * 10,
      efficiency: Math.min(
        100,
        beaconLevel * 15 +
          (Array.isArray(beaconConnections) ? beaconConnections.length : 0) * 5
      ),
      upgradeCost: beaconLevel * 50,
      nextLevelBonus: (beaconLevel + 1) * 10 - beaconLevel * 10,
    };
    return stats;
  }, [beacon]);

  const getBeaconTypeInfo = (type: string) => {
    switch (type) {
      case 'pioneer':
        return {
          emoji: '🚀',
          name: 'Pioneer Beacon',
          description: 'Explores new regions and establishes connections',
          color: 'text-primary',
        };
      case 'harvester':
        return {
          emoji: '⛏️',
          name: 'Harvester Beacon',
          description: 'Optimized for resource generation',
          color: 'text-secondary',
        };
      case 'architect':
        return {
          emoji: '🏗️',
          name: 'Architect Beacon',
          description: 'Enables complex pattern formations',
          color: 'text-accent',
        };
      default:
        return {
          emoji: '📡',
          name: 'Beacon',
          description: 'Signal transmission node',
          color: 'text-text',
        };
    }
  };

  const handleUpgradeBeacon = () => {
    if (!beacon || !beaconStats || !gameController) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert(
      'Upgrade Beacon',
      `Upgrade ${beaconStats.type} beacon to level ${beaconStats.level + 1}?\n\nCost: ${formatNumber(beaconStats.upgradeCost)} Quantum Data\nBonus: +${beaconStats.nextLevelBonus} resource generation`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Upgrade',
          style: 'default',
          onPress: () => {
            try {
              const beaconUpgradeManager =
                gameController.getBeaconUpgradeManager?.();
              const beaconManager = gameController.getBeaconManager();
              const resourceManager = gameController.getResourceManager();

              if (!beaconUpgradeManager || !resourceManager) {
                Alert.alert('Error', 'Upgrade system not available.');
                return;
              }

              // Check if player can afford the upgrade
              if (
                resourceManager.getResource('quantumData') <
                beaconStats.upgradeCost
              ) {
                Alert.alert(
                  'Insufficient Resources',
                  `You need ${formatNumber(beaconStats.upgradeCost)} Quantum Data but only have ${formatNumber(resourceManager.getResource('quantumData'))}.`
                );
                return;
              }

              // Get the actual beacon entity
              const beaconEntity = beaconManager.getBeacon(beacon.id);
              if (!beaconEntity) {
                Alert.alert('Error', 'Beacon not found.');
                return;
              }

              // Spend resources and upgrade beacon
              const success = resourceManager.spendResource(
                'quantumData',
                beaconStats.upgradeCost
              );
              if (success && beaconUpgradeManager.levelUpBeacon(beaconEntity)) {
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success
                );
                Alert.alert(
                  'Upgrade Complete',
                  'Beacon has been upgraded successfully!'
                );
                onClose();
              } else {
                // Refund resources if upgrade failed
                resourceManager.addResource(
                  'quantumData',
                  beaconStats.upgradeCost
                );
                Alert.alert(
                  'Upgrade Failed',
                  'Unable to upgrade beacon. Please try again.'
                );
              }
            } catch (error) {
              console.error('Error upgrading beacon:', error);
              Alert.alert(
                'Error',
                'An error occurred while upgrading the beacon.'
              );
            }
          },
        },
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
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // TODO: Implement actual delete logic through gameController
            Alert.alert('Beacon Deleted', 'The beacon has been removed.');
            onClose();
          },
        },
      ]
    );
  };

  if (!beacon || !beaconStats) {
    return (
      <BaseOverlay
        isVisible={isVisible}
        onClose={onClose}
        title="Beacon Details"
        zIndex={zIndex}
      >
        <View className="items-center py-8">
          <Text className="text-text/60 text-center text-lg">
            Loading beacon data...
          </Text>
        </View>
      </BaseOverlay>
    );
  }

  const typeInfo = getBeaconTypeInfo(beacon.type || 'pioneer');

  return (
    <BaseOverlay
      isVisible={isVisible}
      onClose={onClose}
      title="Beacon Details"
      zIndex={zIndex}
    >
      <View style={{ gap: 24 }}>
        {/* Beacon Header */}
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 32, marginBottom: 8 }}>
            {typeInfo.emoji}
          </Text>
          <Text
            style={{
              fontSize: 20,
              fontWeight: 'bold',
              marginBottom: 4,
              color: '#4F46E5',
            }}
          >
            {typeInfo.name}
          </Text>
          <Text style={{ color: '#9CA3AF', textAlign: 'center' }}>
            {typeInfo.description}
          </Text>
        </View>

        {/* Beacon Stats */}
        <View style={{ gap: 16 }}>
          <View
            style={{
              backgroundColor: 'rgba(17, 24, 39, 0.5)',
              borderRadius: 8,
              padding: 16,
            }}
          >
            <Text
              style={{
                color: '#F9FAFB',
                fontWeight: '600',
                fontSize: 18,
                marginBottom: 12,
              }}
            >
              Beacon Information
            </Text>
            <View style={{ gap: 8 }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                }}
              >
                <Text style={{ color: '#9CA3AF' }}>Level</Text>
                <Text style={{ color: '#F9FAFB', fontWeight: '600' }}>
                  {beaconStats.level}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                }}
              >
                <Text style={{ color: '#9CA3AF' }}>Position</Text>
                <Text style={{ color: '#F9FAFB', fontWeight: '600' }}>
                  {beaconStats.position}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                }}
              >
                <Text style={{ color: '#9CA3AF' }}>Connections</Text>
                <Text style={{ color: '#F9FAFB', fontWeight: '600' }}>
                  {beaconStats.connections}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                }}
              >
                <Text style={{ color: '#9CA3AF' }}>Efficiency</Text>
                <Text style={{ color: '#F59E0B', fontWeight: '600' }}>
                  {beaconStats.efficiency}%
                </Text>
              </View>
            </View>
          </View>

          {/* Resource Generation */}
          <View
            style={{
              backgroundColor: 'rgba(79, 70, 229, 0.1)',
              borderWidth: 1,
              borderColor: 'rgba(79, 70, 229, 0.3)',
              borderRadius: 8,
              padding: 16,
            }}
          >
            <Text
              style={{ color: '#4F46E5', fontWeight: '600', marginBottom: 8 }}
            >
              Resource Generation
            </Text>
            <Text style={{ color: '#F9FAFB' }}>
              +{formatNumber(beaconStats.resourceGeneration)} Quantum Data/sec
            </Text>
          </View>

          {/* Upgrade Section */}
          <View style={{ gap: 12 }}>
            <TouchableOpacity
              onPress={handleUpgradeBeacon}
              style={{
                backgroundColor: '#4F46E5',
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: 8,
              }}
            >
              <Text
                style={{
                  color: 'white',
                  fontWeight: '600',
                  textAlign: 'center',
                }}
              >
                Upgrade to Level {beaconStats.level + 1}
              </Text>
              <Text
                style={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  textAlign: 'center',
                  fontSize: 14,
                  marginTop: 4,
                }}
              >
                Cost: {formatNumber(beaconStats.upgradeCost)} Quantum Data
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleDeleteBeacon}
              style={{
                backgroundColor: 'rgba(220, 38, 38, 0.2)',
                borderWidth: 1,
                borderColor: 'rgba(239, 68, 68, 0.3)',
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: 8,
              }}
            >
              <Text
                style={{
                  color: '#F87171',
                  fontWeight: '600',
                  textAlign: 'center',
                }}
              >
                Delete Beacon
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </BaseOverlay>
  );
};
