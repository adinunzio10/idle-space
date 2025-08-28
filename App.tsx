import { StatusBar } from 'expo-status-bar';
import { Text, View, TouchableOpacity, Dimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useState, useCallback } from 'react';
import './global.css';
import { GameController } from './src/core/GameController';
import { GameState } from './src/storage/schemas/GameState';
import { GalaxyMapView } from './src/components/galaxy/GalaxyMapView';
import { Beacon } from './src/types/galaxy';
import { BeaconType, BeaconSpecialization } from './src/types/beacon';
import { BeaconSpecializationModal } from './src/components/ui/BeaconSpecializationModal';
import { ProbeManagerUI } from './src/components/ui/ProbeManagerUI';
import { ProbeInstance } from './src/types/probe';

interface GalaxyMapScreenProps {
  onBack: () => void;
  beacons: Beacon[];
  probes: ProbeInstance[];
  onBeaconSelect: (beacon: Beacon) => void;
  onMapPress: (position: { x: number; y: number }) => void;
  selectedBeaconType: BeaconType;
  onBeaconTypeSelect: (type: BeaconType) => void;
  quantumData: number;
  showDebugOverlay: boolean;
  onToggleDebugOverlay: () => void;
  selectedBeacon?: Beacon | null;
  beaconVersion: number;
}

const GalaxyMapScreen: React.FC<GalaxyMapScreenProps> = ({
  onBack,
  beacons,
  probes,
  onBeaconSelect,
  onMapPress,
  selectedBeaconType,
  onBeaconTypeSelect,
  quantumData,
  showDebugOverlay,
  onToggleDebugOverlay,
  selectedBeacon = null,
  beaconVersion,
}) => {
  const insets = useSafeAreaInsets();
  const screenData = Dimensions.get('window');
  const headerHeight = 140 + insets.top; // Increased to accommodate beacon type selection

  
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View className="flex-1 bg-background">
        <View 
          className="bg-surface"
          style={{ paddingTop: insets.top + 16 }}
        >
          {/* Header */}
          <View className="flex-row justify-between items-center px-4 py-4">
            <TouchableOpacity
              onPress={onBack}
              className="bg-primary px-4 py-2 rounded-lg"
            >
              <Text className="text-white font-semibold">← Back</Text>
            </TouchableOpacity>
            <View className="flex-row items-center space-x-3">
              <Text className="text-text text-lg font-semibold">Galaxy Map</Text>
              {__DEV__ && (
                <TouchableOpacity
                  onPress={onToggleDebugOverlay}
                  className={`px-2 py-1 rounded border ${
                    showDebugOverlay 
                      ? 'bg-accent/20 border-accent' 
                      : 'bg-surface border-text/20'
                  }`}
                >
                  <Text className={`text-xs font-semibold ${
                    showDebugOverlay ? 'text-accent' : 'text-text/60'
                  }`}>
                    DEBUG
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <Text className="text-accent text-sm font-semibold">
              {Math.floor(quantumData)} QD
            </Text>
          </View>
          
          {/* Beacon Type Selection */}
          <View className="px-4 pb-4">
            <Text className="text-text/80 text-sm mb-2">Select Beacon Type (Cost: 50 QD)</Text>
            <View className="flex-row space-x-2">
              <TouchableOpacity
                onPress={() => onBeaconTypeSelect('pioneer')}
                className={`px-3 py-2 rounded-lg border ${
                  selectedBeaconType === 'pioneer' 
                    ? 'bg-primary border-primary' 
                    : 'bg-surface border-text/20'
                }`}
              >
                <Text className={`text-sm font-semibold ${
                  selectedBeaconType === 'pioneer' ? 'text-white' : 'text-text'
                }`}>
                  Pioneer
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={() => onBeaconTypeSelect('harvester')}
                className={`px-3 py-2 rounded-lg border ${
                  selectedBeaconType === 'harvester' 
                    ? 'bg-secondary border-secondary' 
                    : 'bg-surface border-text/20'
                }`}
              >
                <Text className={`text-sm font-semibold ${
                  selectedBeaconType === 'harvester' ? 'text-white' : 'text-text'
                }`}>
                  Harvester
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={() => onBeaconTypeSelect('architect')}
                className={`px-3 py-2 rounded-lg border ${
                  selectedBeaconType === 'architect' 
                    ? 'bg-accent border-accent' 
                    : 'bg-surface border-text/20'
                }`}
              >
                <Text className={`text-sm font-semibold ${
                  selectedBeaconType === 'architect' ? 'text-white' : 'text-text'
                }`}>
                  Architect
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        
        <GalaxyMapView
          width={screenData.width}
          height={screenData.height - headerHeight}
          beacons={beacons}
          probes={probes}
          onBeaconSelect={onBeaconSelect}
          onMapPress={onMapPress}
          showDebugOverlay={showDebugOverlay}
          selectedBeacon={selectedBeacon}
          beaconUpdateTrigger={beaconVersion}
        />
        
        <StatusBar style="light" />
      </View>
    </GestureHandlerRootView>
  );
};

export default function App() {
  const [gameController] = useState(() => GameController.getInstance());
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGalaxyMap, setShowGalaxyMap] = useState(false);
  const [selectedBeaconType, setSelectedBeaconType] = useState<BeaconType>('pioneer');
  const [showSpecializationModal, setShowSpecializationModal] = useState(false);
  const [selectedBeaconForUpgrade, setSelectedBeaconForUpgrade] = useState<string | null>(null);
  const [showDebugOverlay, setShowDebugOverlay] = useState(false);
  const [selectedBeaconId, setSelectedBeaconId] = useState<string | null>(null);
  const [beaconVersion, setBeaconVersion] = useState(0);
  const [showProbeManager, setShowProbeManager] = useState(false);
  const [probes, setProbes] = useState<ProbeInstance[]>([]);
  const [processedProbeIds] = useState(() => new Set<string>()); // Track probes that have already created beacons
  const [lastPlacement, setLastPlacement] = useState<{ position: { x: number; y: number } | null; timestamp: number }>({ position: null, timestamp: 0 });

  // Create stable callback references using useCallback
  const handleProbeUpdate = useCallback((updatedProbes: ProbeInstance[]) => {
    setProbes(updatedProbes);
  }, []);

  const handleProbeDeployment = useCallback((probe: ProbeInstance) => {
    // Check if we've already processed this probe
    if (processedProbeIds.has(probe.id)) {
      return;
    }
    
    
    // Mark probe as processed to prevent duplicates
    processedProbeIds.add(probe.id);
    
    // Create beacon at probe's target position using the probe's type with smart fallback
    const result = gameController.placeBeaconWithFallback(probe.targetPosition, probe.type);
    
    if (result.success && result.beacon) {
      // Update game state to show the new beacon
      const updatedState = gameController.getGameState();
      setGameState(updatedState);
      setBeaconVersion(prev => prev + 1); // Force re-render
      
      const finalPos = result.finalPosition || result.beacon.position;
      const wasRelocated = finalPos.x !== probe.targetPosition.x || finalPos.y !== probe.targetPosition.y;
      
      if (wasRelocated) {
        // TODO: Add visual notification for user about beacon relocation
      } else {
      }
    } else {
      console.error(`[App] Probe ${probe.id}: Failed to create beacon even with fallback positions - ${result.error}`);
      // Remove from processed set if beacon creation failed, so it can be retried
      processedProbeIds.delete(probe.id);
      // TODO: Add visual error notification for user
    }
  }, [gameController, processedProbeIds]);

  useEffect(() => {
    let mounted = true;
    let removeProbeUpdateCallback: (() => void) | null = null;
    let removeProbeDeployedCallback: (() => void) | null = null;

    const initializeGame = async () => {
      try {
        // CRITICAL FIX: Register probe callbacks BEFORE initializing ProbeManager
        const probeManager = gameController.getProbeManager();
        
        removeProbeUpdateCallback = probeManager.addProbeUpdateCallback(handleProbeUpdate);
        removeProbeDeployedCallback = probeManager.addProbeDeployedCallback(handleProbeDeployment);
        
        // Get initial probe state before starting processing
        const initialProbeStatus = probeManager.getQueueStatus();
        const allProbes = [...initialProbeStatus.queuedProbes, ...initialProbeStatus.activeProbes];
        if (mounted) {
          setProbes(allProbes);
        }
        
        // Now initialize GameController (which calls probeManager.initialize())
        await gameController.initialize();
        
        if (mounted) {
          const state = gameController.getGameState();
          setGameState(state);
          setBeaconVersion(prev => prev + 1); // Trigger beacon re-render
          setIsInitialized(true);
        }
      } catch (err) {
        console.error('Failed to initialize game:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to initialize game');
        }
      }
    };

    initializeGame();

    return () => {
      mounted = false;
      // Clean up callbacks before shutting down
      if (removeProbeUpdateCallback) {
        removeProbeUpdateCallback();
      }
      if (removeProbeDeployedCallback) {
        removeProbeDeployedCallback();
      }
      gameController.shutdown();
    };
  }, [gameController, handleProbeUpdate, handleProbeDeployment]);

  // Trigger beacon re-render when galaxy map becomes visible
  useEffect(() => {
    if (showGalaxyMap && gameState) {
      setBeaconVersion(prev => prev + 1);
    }
  }, [showGalaxyMap, gameState]);

  // Note: Probe callback registration moved to main initialization useEffect above

  const handleSaveGame = async () => {
    try {
      await gameController.saveGame();
      const updatedState = gameController.getGameState();
      setGameState(updatedState);
      setBeaconVersion(prev => prev + 1); // Trigger beacon re-render
    } catch (err) {
      console.error('Failed to save game:', err);
    }
  };

  const handleAddResources = () => {
    const resourceManager = gameController.getResourceManager();
    resourceManager.addResource('quantumData', 100);
    const updatedState = gameController.getGameState();
    setGameState(updatedState);
  };

  const handleBeaconSelect = (beacon: Beacon) => {
    console.log('Selected beacon:', beacon);
    setSelectedBeaconId(beacon.id);
    // TODO: Re-enable upgrade popup when upgrade system is implemented
    // setSelectedBeaconForUpgrade(beacon.id);
    // setShowSpecializationModal(true);
  };

  const handleSpecializationSelect = (beaconId: string, specialization: BeaconSpecialization) => {
    console.log(`Specializing beacon ${beaconId} with ${specialization}`);
    // TODO: Implement beacon specialization in GameController
    // For now, just refresh state
    const updatedState = gameController.getGameState();
    setGameState(updatedState);
  };

  const handleClearAllBeacons = () => {
    gameController.clearAllBeacons();
    const updatedState = gameController.getGameState();
    setGameState(updatedState);
    setBeaconVersion(prev => prev + 1); // Force re-render
    console.log('Cleared all beacons for debugging');
  };

  const handleResetGameData = () => {
    // Clear all beacons
    gameController.clearAllBeacons();
    
    // Clear all probes
    const probeManager = gameController.getProbeManager();
    probeManager.clear();
    
    // Reset quantum data to a small amount for testing
    const resourceManager = gameController.getResourceManager();
    resourceManager.setResource('quantumData', 500); // Give some resources for testing
    
    // Update UI state
    const updatedState = gameController.getGameState();
    setGameState(updatedState);
    setBeaconVersion(prev => prev + 1); // Force re-render
    setProbes([]); // Clear probe UI state
    
    console.log('Reset all game data for debugging');
  };

  const handleMapPress = (position: { x: number; y: number }) => {
    // Check for duplicate placement attempts (safety check)
    const now = Date.now();
    if (lastPlacement.position && 
        Math.abs(lastPlacement.position.x - position.x) < 0.1 && 
        Math.abs(lastPlacement.position.y - position.y) < 0.1 && 
        now - lastPlacement.timestamp < 200) {
      console.warn('Duplicate placement attempt prevented:', position);
      return;
    }

    const result = gameController.placeBeacon(position, selectedBeaconType);
    
    if (result.success) {
      // Track successful placement
      setLastPlacement({ position, timestamp: now });
      
      // Refresh game state to show the new beacon
      const updatedState = gameController.getGameState();
      setGameState(updatedState);
      setBeaconVersion(prev => prev + 1); // Force re-render
      console.log(`Placed ${selectedBeaconType} beacon at (${position.x}, ${position.y})`);
    } else {
      console.error('Failed to place beacon:', result.error);
      // TODO: Show error message to user
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
      connections: [...beacon.connections] // Create a fresh array to avoid reference issues
    }));
  };

  if (error) {
    return (
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View className="flex-1 bg-background items-center justify-center p-4">
            <Text className="text-red-500 text-xl font-semibold mb-4">Error</Text>
            <Text className="text-text/80 text-base text-center">{error}</Text>
            <StatusBar style="light" />
          </View>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    );
  }

  if (!isInitialized) {
    return (
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View className="flex-1 bg-background items-center justify-center">
            <Text className="text-text text-xl font-semibold">Signal Garden</Text>
            <Text className="text-text/80 text-base mt-2">
              Initializing save system...
            </Text>
            <StatusBar style="light" />
          </View>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    );
  }


  if (showGalaxyMap) {

    // Get the current selected beacon data from game state
    const selectedBeacon = selectedBeaconId && gameState 
      ? getBeaconsForMap().find(b => b.id === selectedBeaconId) || null
      : null;

    return (
      <SafeAreaProvider>
        <GalaxyMapScreen 
          onBack={() => setShowGalaxyMap(false)}
          beacons={getBeaconsForMap()}
          probes={probes}
          onBeaconSelect={handleBeaconSelect}
          onMapPress={handleMapPress}
          selectedBeaconType={selectedBeaconType}
          onBeaconTypeSelect={setSelectedBeaconType}
          quantumData={gameState?.resources.quantumData || 0}
          showDebugOverlay={showDebugOverlay}
          onToggleDebugOverlay={() => setShowDebugOverlay(!showDebugOverlay)}
          selectedBeacon={selectedBeacon}
          beaconVersion={beaconVersion}
        />
        
        <BeaconSpecializationModal
          isVisible={showSpecializationModal}
          beaconId={selectedBeaconForUpgrade || ''}
          beaconLevel={selectedBeacon?.level || 1}
          onSelectSpecialization={handleSpecializationSelect}
          onClose={() => {
            setShowSpecializationModal(false);
            setSelectedBeaconForUpgrade(null);
          }}
        />
      </SafeAreaProvider>
    );
  }

  // Show Probe Manager
  if (showProbeManager) {
    return (
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View className="flex-1 bg-background">
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
        <View className="flex-1 bg-background items-center justify-center p-4">
          <Text className="text-text text-2xl font-bold mb-6">Signal Garden</Text>
          
          {gameState && (
            <View className="items-center space-y-4">
              <Text className="text-text/80 text-lg">
                {gameState.player.name}
              </Text>
              <Text className="text-primary text-xl font-semibold">
                Quantum Data: {Math.floor(gameState.resources.quantumData)}
              </Text>
              <Text className="text-text/60 text-sm">
                Save #{gameState.saveCount} • Play time: {Math.floor(gameState.gameTime / 60)}m
              </Text>
              
              <View className="mt-8 space-y-4">
                <TouchableOpacity
                  onPress={handleAddResources}
                  className="bg-primary px-6 py-3 rounded-lg"
                >
                  <Text className="text-white font-semibold text-center">
                    Generate +100 Quantum Data
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={() => setShowGalaxyMap(true)}
                  className="bg-accent px-6 py-3 rounded-lg"
                >
                  <Text className="text-white font-semibold text-center">
                    Open Galaxy Map
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={() => setShowProbeManager(true)}
                  className="bg-primary px-6 py-3 rounded-lg border border-primary/50"
                >
                  <Text className="text-white font-semibold text-center">
                    🚀 Probe Manager
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={handleSaveGame}
                  className="bg-secondary px-6 py-3 rounded-lg"
                >
                  <Text className="text-white font-semibold text-center">
                    Manual Save
                  </Text>
                </TouchableOpacity>
                
                {__DEV__ && (
                  <TouchableOpacity
                    onPress={handleResetGameData}
                    className="bg-red-600 px-6 py-3 rounded-lg border border-red-500"
                  >
                    <Text className="text-white font-semibold text-center">
                      🔄 Reset All Data (Debug)
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              
              <Text className="text-text/40 text-xs mt-6 text-center">
                Save system active • Auto-save every 2 minutes
              </Text>
            </View>
          )}
          
          <StatusBar style="light" />
        </View>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
