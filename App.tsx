import { StatusBar } from 'expo-status-bar';
import { Text, View, TouchableOpacity, Dimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import './global.css';
import { GameController } from './src/core/GameController';
import { GameState } from './src/storage/schemas/GameState';
import { GalaxyMapView } from './src/components/galaxy/GalaxyMapView';
import { Beacon } from './src/types/galaxy';
import { BeaconType, BeaconSpecialization } from './src/types/beacon';
import { BeaconSpecializationModal } from './src/components/ui/BeaconSpecializationModal';

interface GalaxyMapScreenProps {
  onBack: () => void;
  beacons: Beacon[];
  onBeaconSelect: (beacon: Beacon) => void;
  onMapPress: (position: { x: number; y: number }) => void;
  selectedBeaconType: BeaconType;
  onBeaconTypeSelect: (type: BeaconType) => void;
  quantumData: number;
}

const GalaxyMapScreen: React.FC<GalaxyMapScreenProps> = ({
  onBack,
  beacons,
  onBeaconSelect,
  onMapPress,
  selectedBeaconType,
  onBeaconTypeSelect,
  quantumData,
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
            <Text className="text-text text-lg font-semibold">Galaxy Map</Text>
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
          onBeaconSelect={onBeaconSelect}
          onMapPress={onMapPress}
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

  useEffect(() => {
    let mounted = true;

    const initializeGame = async () => {
      try {
        await gameController.initialize();
        if (mounted) {
          const state = gameController.getGameState();
          setGameState(state);
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
      gameController.shutdown();
    };
  }, [gameController]);

  const handleSaveGame = async () => {
    try {
      await gameController.saveGame();
      const updatedState = gameController.getGameState();
      setGameState(updatedState);
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
    setSelectedBeaconForUpgrade(beacon.id);
    setShowSpecializationModal(true);
  };

  const handleSpecializationSelect = (beaconId: string, specialization: BeaconSpecialization) => {
    console.log(`Specializing beacon ${beaconId} with ${specialization}`);
    // TODO: Implement beacon specialization in GameController
    // For now, just refresh state
    const updatedState = gameController.getGameState();
    setGameState(updatedState);
  };

  const handleMapPress = (position: { x: number; y: number }) => {
    const result = gameController.placeBeacon(position, selectedBeaconType);
    
    if (result.success) {
      // Refresh game state to show the new beacon
      const updatedState = gameController.getGameState();
      setGameState(updatedState);
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
      connections: beacon.connections
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
    const selectedBeacon = selectedBeaconForUpgrade 
      ? gameState?.beacons[selectedBeaconForUpgrade]
      : null;

    return (
      <SafeAreaProvider>
        <GalaxyMapScreen 
          onBack={() => setShowGalaxyMap(false)}
          beacons={getBeaconsForMap()}
          onBeaconSelect={handleBeaconSelect}
          onMapPress={handleMapPress}
          selectedBeaconType={selectedBeaconType}
          onBeaconTypeSelect={setSelectedBeaconType}
          quantumData={gameState?.resources.quantumData || 0}
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
                  onPress={handleSaveGame}
                  className="bg-secondary px-6 py-3 rounded-lg"
                >
                  <Text className="text-white font-semibold text-center">
                    Manual Save
                  </Text>
                </TouchableOpacity>
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
