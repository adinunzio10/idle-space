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
import { GalaxyMapCore } from '../components/galaxy/GalaxyMapCore';
import GalaxyMapModular from '../components/galaxy/GalaxyMapModular';
import { EnhancedGameHUD } from '../components/ui/FloatingResourceDisplay';
import {
  ExpandableFloatingActionButton,
  FABAction,
} from '../components/ui/ExpandableFloatingActionButton';
import {
  PerformanceOverlay,
  usePerformanceOverlay,
} from '../components/debug/PerformanceOverlay';
import DebugOverlay from '../components/debug/DebugOverlay';
import { GameState } from '../storage/schemas/GameState';
import { ProbeInstance } from '../types/probe';
import { Point2D, StarSystem, GalacticSector } from '../types/galaxy';
import { Beacon } from '../types/galaxy';
import { BeaconType } from '../types/beacon';
import { ProbeType } from '../types/probe';
import { RootStackParamList } from '../navigation/AppNavigator';

// Test data generation for StarSystemModule and SectorModule
function generateTestStarSystems(count: number): StarSystem[] {
  const systems: StarSystem[] = [];
  
  for (let i = 0; i < count; i++) {
    systems.push({
      id: `test-star-${i}`,
      position: {
        x: Math.random() * 2000,
        y: Math.random() * 2000,
      },
      state: Math.random() > 0.8 ? 'dying' : Math.random() > 0.9 ? 'dead' : 'healthy',
      radius: 0.5 + Math.random() * 2,
      brightness: 0.3 + Math.random() * 0.7,
      type: Math.random() > 0.7 ? 'background' : 'main',
      entropy: Math.random() * 0.8,
    });
  }
  
  return systems;
}

function generateTestSectors(count: number): GalacticSector[] {
  const sectors: GalacticSector[] = [];
  
  for (let i = 0; i < count; i++) {
    const centerX = Math.random() * 1800 + 100;
    const centerY = Math.random() * 1800 + 100;
    const size = 50 + Math.random() * 100;
    
    sectors.push({
      id: `test-sector-${i}`,
      center: { x: centerX, y: centerY },
      bounds: {
        minX: centerX - size,
        maxX: centerX + size,
        minY: centerY - size,
        maxY: centerY + size,
      },
      vertices: [
        { x: centerX - size, y: centerY - size },
        { x: centerX + size, y: centerY - size },
        { x: centerX + size, y: centerY + size },
        { x: centerX - size, y: centerY + size },
      ],
      entropy: Math.random(),
      entropyLevel: Math.random(),
      starSystemIds: [],
      neighboringSectors: [],
    });
  }
  
  return sectors;
}

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
  
  // Generate test data once and keep it stable
  const [testStarSystems] = React.useState(() => generateTestStarSystems(150));
  const [testSectors] = React.useState(() => generateTestSectors(30));
  const insets = useSafeAreaInsets();
  const screenData = Dimensions.get('window');
  
  // State for galaxy map interaction
  const [selectedBeaconType, setSelectedBeaconType] =
    useState<BeaconType>('pioneer');
  const [selectedBeaconId, setSelectedBeaconId] = useState<string | null>(null);
  const [beaconVersion, setBeaconVersion] = useState(0);
  
  // Debug controls
  const [showDebugOverlay, setShowDebugOverlay] = useState(false);
  const [useModularMap, setUseModularMap] = useState(false);
  
  // Performance monitoring hook
  const performanceOverlay = usePerformanceOverlay();
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
          {useModularMap ? (
            <GalaxyMapModular
              width={screenData.width}
              height={screenData.height}
              beacons={getBeaconsForMap()}
              starSystems={testStarSystems}
              sectors={testSectors}
              onBeaconSelect={handleBeaconSelect}
              onMapPress={handleMapPress}
              selectedBeacon={selectedBeacon}
              enabledModules={[]} // Enable all modules
              performanceMode={false}
              debugMode={showDebugOverlay}
            />
          ) : (
            <GalaxyMapCore
              width={screenData.width}
              height={screenData.height}
              beacons={getBeaconsForMap()}
              onBeaconSelect={handleBeaconSelect}
              onMapPress={handleMapPress}
              selectedBeacon={selectedBeacon}
            />
          )}

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

          {/* Debug Controls - Top Right */}
          {__DEV__ && (
            <View className="absolute top-12 right-4 z-50">
              <View className="flex-row space-x-2">
                <TouchableOpacity
                  onPress={performanceOverlay.toggle}
                  className={`px-2 py-1 rounded border ${
                    performanceOverlay.visible
                      ? 'bg-green-500/20 border-green-500'
                      : 'bg-black/50 border-white/20'
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      performanceOverlay.visible
                        ? 'text-green-400'
                        : 'text-white/60'
                    }`}
                  >
                    FPS
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowDebugOverlay(!showDebugOverlay)}
                  className={`px-2 py-1 rounded border ${
                    showDebugOverlay
                      ? 'bg-yellow-500/20 border-yellow-500'
                      : 'bg-black/50 border-white/20'
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      showDebugOverlay
                        ? 'text-yellow-400'
                        : 'text-white/60'
                    }`}
                  >
                    DEBUG
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setUseModularMap(!useModularMap)}
                  className={`px-2 py-1 rounded border ${
                    useModularMap
                      ? 'bg-blue-500/20 border-blue-500'
                      : 'bg-black/50 border-white/20'
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      useModularMap
                        ? 'text-blue-400'
                        : 'text-white/60'
                    }`}
                  >
                    MOD
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <StatusBar style="light" />
        </View>

        {/* Performance overlay */}
        <PerformanceOverlay
          visible={performanceOverlay.visible}
          position="top-left"  // Move to top-left to avoid blocking debug controls
          compact={false}      // Allow expansion - starts compact but can expand
          onToggle={performanceOverlay.toggle}
        />

        {/* Simple Debug Info - shows beacon count */}
        {showDebugOverlay && (
          <View 
            className="absolute bottom-20 right-4 bg-black/80 rounded-lg p-3 z-50"
            style={{ marginRight: 80 }} // Give space for right FAB
          >
            <Text className="text-white text-sm font-bold mb-2">Debug Info</Text>
            <Text className="text-green-400 text-xs font-mono">
              Beacons: {getBeaconsForMap().length}
            </Text>
            <Text className="text-blue-400 text-xs font-mono">
              Mode: {useModularMap ? 'Modular' : 'Core'}
            </Text>
            {selectedBeacon && (
              <Text className="text-yellow-400 text-xs font-mono">
                Selected: {selectedBeacon.id}
              </Text>
            )}
            
            {/* Debug Actions */}
            <View className="mt-3 space-y-2">
              {/* Resource Controls */}
              <View className="flex-row space-x-2">
                <TouchableOpacity
                  onPress={() => {
                    try {
                      const resourceManager = gameController.getResourceManager();
                      resourceManager.addResource('quantumData', 1000000000000); // 1 trillion
                      console.log('[Debug] Added 1T Quantum Data for testing');
                    } catch (error) {
                      console.error('[Debug] Failed to add quantum data:', error);
                    }
                  }}
                  className="bg-green-600 px-3 py-1 rounded flex-1"
                >
                  <Text className="text-white text-xs font-bold text-center">+1T QD</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={() => {
                    try {
                      const resourceManager = gameController.getResourceManager();
                      // Set to JavaScript's max safe integer (way beyond any beacon cost)
                      resourceManager.setResource('quantumData', Number.MAX_SAFE_INTEGER);
                      console.log('[Debug] Set Quantum Data to MAX_SAFE_INTEGER:', Number.MAX_SAFE_INTEGER);
                    } catch (error) {
                      console.error('[Debug] Failed to set infinite resources:', error);
                    }
                  }}
                  className="bg-red-600 px-3 py-1 rounded flex-1"
                >
                  <Text className="text-white text-xs font-bold text-center">∞ QD</Text>
                </TouchableOpacity>
              </View>
              
              {/* Beacon Controls */}
              <TouchableOpacity
                onPress={() => {
                  try {
                    // Bypass cost system - create beacons directly in game state
                    let successCount = 0;
                    const currentGameState = gameController.getGameState();
                    
                    for (let i = 0; i < 20; i++) {
                      const randomPos = {
                        x: Math.random() * 1800 + 100,
                        y: Math.random() * 1800 + 100,
                      };
                      
                      // Generate a unique beacon ID
                      const beaconId = `debug-beacon-${Date.now()}-${i}`;
                      
                      // Create beacon object directly
                      const newBeacon = {
                        id: beaconId,
                        x: randomPos.x,
                        y: randomPos.y,
                        type: 'pioneer' as const,
                        level: 1,
                        connections: [] as string[],
                        createdAt: Date.now(),
                        lastResourceGeneration: Date.now(),
                      };
                      
                      // Add directly to game state beacons
                      currentGameState.beacons[beaconId] = newBeacon;
                      successCount++;
                    }
                    
                    // Force game state update
                    setBeaconVersion(prev => prev + 1);
                    console.log(`[Debug] Created ${successCount}/20 beacons directly (bypassing costs)`);
                  } catch (error) {
                    console.error('[Debug] Failed to create beacons:', error);
                  }
                }}
                className="bg-purple-600 px-3 py-1 rounded"
              >
                <Text className="text-white text-xs font-bold text-center">+20 FREE Beacons</Text>
              </TouchableOpacity>
              
              {/* Clear Controls */}
              <TouchableOpacity
                onPress={() => {
                  try {
                    // Clear all beacons for performance testing
                    gameController.clearAllBeacons();
                    setBeaconVersion(prev => prev + 1);
                    console.log('[Debug] Cleared all beacons - back to clean state');
                  } catch (error) {
                    console.error('[Debug] Failed to clear beacons:', error);
                  }
                }}
                className="bg-red-800 px-3 py-1 rounded"
              >
                <Text className="text-white text-xs font-bold text-center">🗑️ Clear All Beacons</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
};
