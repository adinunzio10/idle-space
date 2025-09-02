import React, { useState } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { GalaxyMapView } from '../components/galaxy/GalaxyMapView';
import { EnhancedGameHUD } from '../components/ui/FloatingResourceDisplay';
import {
  ExpandableFloatingActionButton,
  FABAction,
} from '../components/ui/ExpandableFloatingActionButton';
import { GameState } from '../storage/schemas/GameState';
import { ProbeInstance } from '../types/probe';
import { Beacon } from '../types/galaxy';
import { BeaconType } from '../types/beacon';
import { ProbeType } from '../types/probe';
import { Point2D } from '../types/galaxy';
import { RootStackParamList } from '../navigation/AppNavigator';

type MainScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Main'
>;

interface MainScreenProps {
  gameState: GameState | null;
  gameController: any;
  probes: ProbeInstance[];
  isInitialized: boolean;
  error: string | null;
}

export const MainScreen: React.FC<MainScreenProps> = ({
  gameState,
  gameController,
  probes,
  isInitialized,
  error,
}) => {
  const navigation = useNavigation<MainScreenNavigationProp>();
  const insets = useSafeAreaInsets();
  const screenData = Dimensions.get('window');
  
  // State for galaxy map interaction
  const [selectedBeaconType, setSelectedBeaconType] =
    useState<BeaconType>('pioneer');
  const [selectedBeaconId, setSelectedBeaconId] = useState<string | null>(null);
  const [beaconVersion, setBeaconVersion] = useState(0);
  const [lastPlacement, setLastPlacement] = useState<{
    position: { x: number; y: number } | null;
    timestamp: number;
  }>({ position: null, timestamp: 0 });

  const handleSaveGame = async () => {
    try {
      await gameController.saveGame();
    } catch (err) {
      console.error('Failed to save game:', err);
    }
  };

  const handleAddResources = () => {
    const resourceManager = gameController.getResourceManager();
    resourceManager.addResource('quantumData', 100);
  };

  const handleResetGameData = () => {
    // Clear all beacons
    gameController.clearAllBeacons();

    // Clear all probes
    const probeManager = gameController.getProbeManager();
    probeManager.clear();

    // Reset quantum data to a small amount for testing
    const resourceManager = gameController.getResourceManager();
    resourceManager.setResource('quantumData', 500);

    console.log('Reset all game data for debugging');
  };

  // Handle probe launch
  const handleProbeLaunch = (type: ProbeType) => {
    console.log('[MainScreen] Launching probe:', type);
    try {
      const probeManager = gameController.getProbeManager();

      // Generate random target position within galaxy bounds
      const targetPosition: Point2D = {
        x: Math.random() * 1800 + 100, // 100-1900 to stay within bounds
        y: Math.random() * 1800 + 100,
      };

      // Launch position from center of screen
      const launchPosition: Point2D = {
        x: screenData.width / 2,
        y: screenData.height / 2,
      };

      const result = probeManager.queueProbe(
        type,
        targetPosition,
        1,
        launchPosition,
        true
      );

      if (result.success) {
        console.log(`[MainScreen] Successfully queued ${type} probe`);
      } else {
        console.warn(
          `[MainScreen] Failed to queue ${type} probe:`,
          result.error
        );
      }
    } catch (error) {
      console.error(`[MainScreen] Error launching ${type} probe:`, error);
    }
  };

  // Define FAB actions
  const primaryAction: FABAction = {
    id: 'main',
    icon: '🚀',
    label: 'Launch Probe',
    onPress: () => handleProbeLaunch('pioneer'),
    backgroundColor: '#4F46E5',
  };

  const secondaryActions: FABAction[] = [
    {
      id: 'pioneer-probe',
      icon: '🔍',
      label: 'Pioneer Probe',
      onPress: () => handleProbeLaunch('pioneer'),
      backgroundColor: '#4F46E5',
    },
    {
      id: 'harvester-probe',
      icon: '⚡',
      label: 'Harvester Probe',
      onPress: () => handleProbeLaunch('harvester'),
      backgroundColor: '#7C3AED',
    },
    {
      id: 'architect-probe',
      icon: '🏗️',
      label: 'Architect Probe',
      onPress: () => handleProbeLaunch('architect'),
      backgroundColor: '#F59E0B',
    },
  ];

  const navigationActions: FABAction[] = [
    {
      id: 'upgrades',
      icon: '⬆️',
      label: 'Upgrades',
      onPress: () => navigation.navigate('Upgrades'),
      backgroundColor: '#4F46E5',
    },
    {
      id: 'patterns',
      icon: '🔷',
      label: 'Pattern Gallery',
      onPress: () => navigation.navigate('PatternGallery'),
      backgroundColor: '#7C3AED',
    },
    {
      id: 'statistics',
      icon: '📊',
      label: 'Statistics',
      onPress: () => navigation.navigate('Statistics'),
      backgroundColor: '#4F46E5',
    },
    {
      id: 'settings',
      icon: '⚙️',
      label: 'Settings',
      onPress: () => navigation.navigate('Settings'),
      backgroundColor: '#6B7280',
    },
  ];

  if (error) {
    return (
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View className="flex-1 bg-background items-center justify-center p-4">
            <Text className="text-red-500 text-xl font-semibold mb-4">
              Error
            </Text>
            <Text className="text-text/80 text-base text-center">{error}</Text>
            <StatusBar style="light" />
          </View>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    );
  }

  // Convert GameState beacons to Beacon[] format expected by GalaxyMapView
  const getBeaconsForMap = (): Beacon[] => {
    if (!gameState) return [];

    return Object.values(gameState.beacons).map(beacon => ({
      id: beacon.id,
      position: { x: beacon.x, y: beacon.y },
      level: beacon.level,
      type: beacon.type,
      connections: [...beacon.connections],
    }));
  };

  const handleBeaconSelect = (beacon: Beacon) => {
    console.log('Selected beacon:', beacon);
    setSelectedBeaconId(beacon.id);
  };

  const handleMapPress = (position: { x: number; y: number }) => {
    // Check for duplicate placement attempts (safety check)
    const now = Date.now();
    if (
      lastPlacement.position &&
      Math.abs(lastPlacement.position.x - position.x) < 0.1 &&
      Math.abs(lastPlacement.position.y - position.y) < 0.1 &&
      now - lastPlacement.timestamp < 200
    ) {
      console.warn('Duplicate placement attempt prevented:', position);
      return;
    }

    // Check if player can afford beacon placement before attempting
    if (!gameController.canAffordBeaconPlacement()) {
      const cost = gameController.getBeaconPlacementCost();
      console.warn(
        `Cannot place beacon: need ${cost.quantumData} Quantum Data`
      );
      return;
    }

    const result = gameController.placeBeacon(position, selectedBeaconType);

    if (result.success) {
      // Track successful placement
      setLastPlacement({ position, timestamp: now });
      setBeaconVersion(prev => prev + 1); // Force re-render
      console.log(
        `Successfully placed ${selectedBeaconType} beacon at cost ${gameController.getBeaconPlacementCost().quantumData} QD`
      );
    } else {
      console.error('Failed to place beacon:', result.error);
    }
  };

  const selectedBeacon =
    selectedBeaconId && gameState
      ? getBeaconsForMap().find(b => b.id === selectedBeaconId) || null
      : null;

  if (!isInitialized) {
    return (
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View className="flex-1 bg-background items-center justify-center">
            <Text className="text-text text-xl font-semibold">
              Signal Garden
            </Text>
            <Text className="text-text/80 text-base mt-2">
              Initializing save system...
            </Text>
            <StatusBar style="light" />
          </View>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View className="flex-1 bg-background">
          {/* Floating Resource HUD at the top */}
          <EnhancedGameHUD
            resourceManager={gameController.getResourceManager()}
            position="top"
            compact={false}
            showDetailed={false}
          />

          {/* Full-screen Galaxy Map */}
          <GalaxyMapView
            width={screenData.width}
            height={screenData.height}
            beacons={getBeaconsForMap()}
            probes={probes}
            onBeaconSelect={handleBeaconSelect}
            onMapPress={handleMapPress}
            showDebugOverlay={false}
            selectedBeacon={selectedBeacon}
            beaconUpdateTrigger={beaconVersion}
          />

          {/* Floating Beacon Type Selector */}
          <View
            className="absolute bottom-0 left-4 right-4 z-40 mb-32"
            style={{
              paddingBottom: insets.bottom,
            }}
          >
            <View className="bg-surface/90 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3">
              {(() => {
                const cost = gameController.getBeaconPlacementCost();
                const canAfford = gameController.canAffordBeaconPlacement();
                const currentQD = gameController
                  .getResourceManager()
                  .getResource('quantumData')
                  .toNumber();

                return (
                  <>
                    <Text className="text-text/80 text-sm mb-1">
                      Beacon Type - Cost: {cost.quantumData} QD
                    </Text>
                    <Text
                      className={`text-xs mb-2 ${
                        canAfford ? 'text-primary' : 'text-red-400'
                      }`}
                    >
                      {canAfford
                        ? `✓ Affordable (${Math.floor(currentQD)} QD)`
                        : `⚠️ Need ${cost.quantumData - Math.floor(currentQD)} more QD`}
                    </Text>
                  </>
                );
              })()}
              <View className="flex-row space-x-2">
                <TouchableOpacity
                  onPress={() => setSelectedBeaconType('pioneer')}
                  className={`px-3 py-2 rounded-lg border ${
                    selectedBeaconType === 'pioneer'
                      ? 'bg-primary border-primary'
                      : 'bg-surface border-text/20'
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      selectedBeaconType === 'pioneer'
                        ? 'text-white'
                        : 'text-text'
                    }`}
                  >
                    🔍 Pioneer
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setSelectedBeaconType('harvester')}
                  className={`px-3 py-2 rounded-lg border ${
                    selectedBeaconType === 'harvester'
                      ? 'bg-secondary border-secondary'
                      : 'bg-surface border-text/20'
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      selectedBeaconType === 'harvester'
                        ? 'text-white'
                        : 'text-text'
                    }`}
                  >
                    ⚡ Harvester
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setSelectedBeaconType('architect')}
                  className={`px-3 py-2 rounded-lg border ${
                    selectedBeaconType === 'architect'
                      ? 'bg-accent border-accent'
                      : 'bg-surface border-text/20'
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      selectedBeaconType === 'architect'
                        ? 'text-white'
                        : 'text-text'
                    }`}
                  >
                    🏗️ Architect
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Primary FAB for Probe Launches */}
          <ExpandableFloatingActionButton
            primaryAction={primaryAction}
            secondaryActions={secondaryActions}
            position="bottomRight"
            expansionPattern="radial"
            size="medium"
            testID="probe-launch-fab"
          />

          {/* Secondary FAB for Navigation */}
          <ExpandableFloatingActionButton
            primaryAction={{
              id: 'menu',
              icon: '☰',
              label: 'Menu',
              onPress: () => {},
              backgroundColor: '#6B7280',
            }}
            secondaryActions={navigationActions}
            position="bottomLeft"
            expansionPattern="arc"
            size="medium"
            testID="navigation-fab"
          />

          <StatusBar style="light" />
        </View>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
};
