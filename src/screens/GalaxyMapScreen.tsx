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
import { GalaxyMapModular } from '../components/galaxy/GalaxyMapModular';
import { GameHUD } from '../components/ui/GameHUD';
import { BeaconSpecializationOverlay } from '../components/ui/BeaconSpecializationOverlay';
import { useStrategicOverlays } from '../components/ui/OverlayManager';
import { ProbeManagerUI } from '../components/ui/ProbeManagerUI';
import { ProbeLaunchFAB } from '../components/ui/ProbeLaunchFAB';
import { PatternToggleButton } from '../components/ui/PatternToggleButton';
import {
  PerformanceOverlay,
  usePerformanceOverlay,
} from '../components/debug/PerformanceOverlay';
import { GameState } from '../storage/schemas/GameState';
import { ProbeInstance } from '../types/probe';
import { Beacon } from '../types/galaxy';
import { BeaconType, BeaconSpecialization } from '../types/beacon';
import { RootStackParamList } from '../navigation/AppNavigator';
import { ProbeType } from '../types/probe';
import { Point2D, StarSystem, GalacticSector } from '../types/galaxy';
import { fpsMonitor } from '../utils/performance/FPSMonitor';

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

type GalaxyMapScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'GalaxyMap'
>;

interface GalaxyMapScreenProps {
  gameState: GameState;
  gameController: any;
  probes: ProbeInstance[];
}

export const GalaxyMapScreen: React.FC<GalaxyMapScreenProps> = ({
  gameState,
  gameController,
  probes,
}) => {
  console.log('[GalaxyMapScreen] Component rendering...');
  const navigation = useNavigation<GalaxyMapScreenNavigationProp>();
  
  // Generate test data once and keep it stable
  const [testStarSystems] = React.useState(() => {
    const systems = generateTestStarSystems(150);
    console.log(`[GalaxyMapScreen] Generated ${systems.length} test star systems`);
    return systems;
  });
  const [testSectors] = React.useState(() => {
    const sectors = generateTestSectors(30);
    console.log(`[GalaxyMapScreen] Generated ${sectors.length} test sectors`);
    return sectors;
  });
  const insets = useSafeAreaInsets();
  const screenData = Dimensions.get('window');
  const headerHeight = 140 + insets.top;

  // Use overlay system
  const { showBeaconDetails } = useStrategicOverlays();

  const [selectedBeaconType, setSelectedBeaconType] =
    useState<BeaconType>('pioneer');
  const [showSpecializationOverlay, setShowSpecializationOverlay] =
    useState(false);
  const [selectedBeaconForUpgrade, setSelectedBeaconForUpgrade] = useState<
    string | null
  >(null);
  const [showDebugOverlay, setShowDebugOverlay] = useState(false);
  const [useModularMap, setUseModularMap] = useState(false);
  const [selectedBeaconId, setSelectedBeaconId] = useState<string | null>(null);
  const [beaconVersion, setBeaconVersion] = useState(0);
  const [showProbeManager, setShowProbeManager] = useState(false);
  const [lastPlacement, setLastPlacement] = useState<{
    position: { x: number; y: number } | null;
    timestamp: number;
  }>({ position: null, timestamp: 0 });

  // Track beacon count to detect external beacon changes (like reset)
  const [previousBeaconCount, setPreviousBeaconCount] = useState(0);
  const [forceUpdateKey, setForceUpdateKey] = useState(0);
  const [, forceRerender] = useState({});

  // Performance monitoring
  const performanceOverlay = usePerformanceOverlay();

  // Initialize FPS monitoring when component mounts
  React.useEffect(() => {
    fpsMonitor.start();
    return () => {
      fpsMonitor.stop();
    };
  }, []);

  // Monitor beacon count changes to detect external beacon changes (like reset)
  React.useEffect(() => {
    if (!gameState) return;
    
    const currentBeaconCount = Object.keys(gameState.beacons).length;
    
    // If beacon count changed significantly (not just +1 from manual placement)
    if (previousBeaconCount !== currentBeaconCount) {
      // Check if it's a major change (like reset) vs normal placement
      const isSignificantChange = Math.abs(currentBeaconCount - previousBeaconCount) > 1 || currentBeaconCount === 0;
      
      if (isSignificantChange) {
        console.log(`[GalaxyMapScreen] Significant beacon count change detected: ${previousBeaconCount} -> ${currentBeaconCount}, forcing immediate update`);
        setBeaconVersion(prev => prev + 1); // Force map re-render
        setForceUpdateKey(prev => prev + 1); // Additional force update
        forceRerender({}); // Force component re-render
        
        // Force multiple updates to break through caching
        setTimeout(() => {
          setBeaconVersion(prev => prev + 1);
          setForceUpdateKey(prev => prev + 1);
          forceRerender({});
        }, 10);
        
        setTimeout(() => {
          setBeaconVersion(prev => prev + 1);
          forceRerender({});
        }, 100);
      }
      
      setPreviousBeaconCount(currentBeaconCount);
    }
  }, [gameState, previousBeaconCount]);

  // Handle probe launch from FAB
  const handleProbeLaunch = (type: ProbeType, launchPosition: Point2D) => {
    console.log('[GalaxyMapScreen] handleProbeLaunch called with:', {
      type,
      launchPosition,
    });
    try {
      const probeManager = gameController.getProbeManager();

      // Generate random target position within galaxy bounds
      const targetPosition: Point2D = {
        x: Math.random() * 1800 + 100, // 100-1900 to stay within bounds
        y: Math.random() * 1800 + 100,
      };

      const result = probeManager.queueProbe(
        type,
        targetPosition,
        1,
        launchPosition,
        true
      );

      if (result.success) {
        console.log(`[GalaxyMapScreen] Successfully queued ${type} probe`);
      } else {
        console.warn(
          `[GalaxyMapScreen] Failed to queue ${type} probe:`,
          result.error
        );
      }
    } catch (error) {
      console.error(`[GalaxyMapScreen] Error launching ${type} probe:`, error);
    }
  };

  const handleBeaconSelect = (beacon: Beacon) => {
    console.log('Selected beacon:', beacon);
    setSelectedBeaconId(beacon.id);
    showBeaconDetails(beacon);
  };

  const handleSpecializationSelect = (
    beaconId: string,
    specialization: BeaconSpecialization
  ) => {
    console.log(`Specializing beacon ${beaconId} with ${specialization}`);
    // TODO: Implement beacon specialization in GameController
    setShowSpecializationOverlay(false);
    setSelectedBeaconForUpgrade(null);
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
      // Could add a toast notification here in the future
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
      // Could add a toast notification here in the future
    }
  };

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

  // Create a memoized beacon list that updates when gameState changes
  const beaconsForMap = React.useMemo(() => {
    return getBeaconsForMap();
  }, [gameState?.beacons, beaconVersion, forceUpdateKey]);

  const selectedBeacon =
    selectedBeaconId && gameState
      ? beaconsForMap.find(b => b.id === selectedBeaconId) || null
      : null;

  if (showProbeManager) {
    return (
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View className="flex-1 bg-background">
            <GameHUD
              resourceManager={gameController.getResourceManager()}
              showDetailed={false}
            />
            <ProbeManagerUI
              probeManager={gameController.getProbeManager()}
              onClose={() => setShowProbeManager(false)}
            />
          </View>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View className="flex-1 bg-background">
          <GameHUD
            resourceManager={gameController.getResourceManager()}
            showDetailed={false}
          />

          <View className="bg-surface px-4 py-3">
            {/* Header */}
            <View className="flex-row justify-between items-center">
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                className="bg-primary px-4 py-2 rounded-lg"
              >
                <Text className="text-white font-semibold">← Back</Text>
              </TouchableOpacity>
              <View className="flex-row items-center space-x-3">
                <Text className="text-text text-lg font-semibold">
                  Galaxy Map
                </Text>
                {__DEV__ && (
                  <View className="flex-row space-x-2">
                    <TouchableOpacity
                      onPress={() => setShowDebugOverlay(!showDebugOverlay)}
                      className={`px-2 py-1 rounded border ${
                        showDebugOverlay
                          ? 'bg-accent/20 border-accent'
                          : 'bg-surface border-text/20'
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          showDebugOverlay ? 'text-accent' : 'text-text/60'
                        }`}
                      >
                        DEBUG
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={performanceOverlay.toggle}
                      className={`px-2 py-1 rounded border ${
                        performanceOverlay.visible
                          ? 'bg-green-500/20 border-green-500'
                          : 'bg-surface border-text/20'
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          performanceOverlay.visible
                            ? 'text-green-400'
                            : 'text-text/60'
                        }`}
                      >
                        FPS
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setUseModularMap(!useModularMap)}
                      className={`px-2 py-1 rounded border ${
                        useModularMap
                          ? 'bg-blue-500/20 border-blue-500'
                          : 'bg-surface border-text/20'
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          useModularMap
                            ? 'text-blue-400'
                            : 'text-text/60'
                        }`}
                      >
                        MOD
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>

            {/* Beacon Type Selection */}
            <View className="pb-4">
              {(() => {
                const cost = gameController.getBeaconPlacementCost();
                const canAfford = gameController.canAffordBeaconPlacement();
                const currentQD = gameController
                  .getResourceManager()
                  .getResource('quantumData')
                  .toNumber();

                return (
                  <>
                    <Text className="text-text/80 text-sm mb-1 px-4">
                      Select Beacon Type - Cost: {cost.quantumData} QD
                    </Text>
                    <Text
                      className={`text-xs mb-2 px-4 ${canAfford ? 'text-primary' : 'text-red-400'}`}
                    >
                      {canAfford
                        ? `✓ Affordable (You have ${Math.floor(currentQD)} QD)`
                        : `⚠️ Need ${cost.quantumData - Math.floor(currentQD)} more QD`}
                    </Text>
                  </>
                );
              })()}
              <View className="flex-row space-x-2 px-4">
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
                    Pioneer
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
                    Harvester
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
                    Architect
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {useModularMap ? (
            <GalaxyMapModular
              width={screenData.width}
              height={screenData.height - headerHeight}
              beacons={beaconsForMap}
              starSystems={(() => {
                console.log(`[GalaxyMapScreen] Passing ${testStarSystems?.length || 0} star systems to GalaxyMapModular`);
                return testStarSystems;
              })()}
              sectors={(() => {
                console.log(`[GalaxyMapScreen] Passing ${testSectors?.length || 0} sectors to GalaxyMapModular`);
                return testSectors;
              })()}
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
              height={screenData.height - headerHeight}
              beacons={beaconsForMap}
              onBeaconSelect={handleBeaconSelect}
              onMapPress={handleMapPress}
              selectedBeacon={selectedBeacon}
            />
          )}

          <StatusBar style="light" />

          {/* FABs positioned inside main view container */}
          <ProbeLaunchFAB
            onProbeSelect={handleProbeLaunch}
            position="bottomLeft"
            launchPosition={{ x: 1000, y: 1000 }}
          />

          <PatternToggleButton position="bottom-right" />
        </View>

        {/* Performance overlay */}
        <PerformanceOverlay
          visible={performanceOverlay.visible}
          position={performanceOverlay.position}
          compact={performanceOverlay.compact}
          onToggle={performanceOverlay.toggle}
        />

        <BeaconSpecializationOverlay
          isVisible={showSpecializationOverlay}
          beaconId={selectedBeaconForUpgrade || ''}
          beaconLevel={selectedBeacon?.level || 1}
          onSelectSpecialization={handleSpecializationSelect}
          onClose={() => {
            setShowSpecializationOverlay(false);
            setSelectedBeaconForUpgrade(null);
          }}
        />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
};
