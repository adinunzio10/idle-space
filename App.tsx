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
import { JSICrashTester } from './src/debug/JSICrashTester';
import { SharedValueCrashTester } from './src/debug/SharedValueCrashTester';
import { GalaxyMapCrashAnalyzer } from './src/debug/GalaxyMapCrashAnalyzer';

interface GalaxyMapScreenProps {
  onBack: () => void;
  beacons: Beacon[];
  onBeaconSelect: (beacon: Beacon) => void;
  onMapPress: (position: { x: number; y: number }) => void;
}

const GalaxyMapScreen: React.FC<GalaxyMapScreenProps> = ({
  onBack,
  beacons,
  onBeaconSelect,
  onMapPress,
}) => {
  const insets = useSafeAreaInsets();
  const screenData = Dimensions.get('window');
  const headerHeight = 60 + insets.top;
  
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View className="flex-1 bg-background">
        <View 
          className="flex-row justify-between items-center px-4 py-4 bg-surface"
          style={{ paddingTop: insets.top + 16 }}
        >
          <TouchableOpacity
            onPress={onBack}
            className="bg-primary px-4 py-2 rounded-lg"
          >
            <Text className="text-white font-semibold">← Back</Text>
          </TouchableOpacity>
          <Text className="text-text text-lg font-semibold">Galaxy Map</Text>
          <View style={{ width: 70 }} />
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
  const [showDebugTester, setShowDebugTester] = useState(false);
  const [showSharedValueTester, setShowSharedValueTester] = useState(false);
  const [showGalaxyMapAnalyzer, setShowGalaxyMapAnalyzer] = useState(false);

  // Sample beacons for testing
  const sampleBeacons: Beacon[] = [
    {
      id: 'beacon-1',
      position: { x: 100, y: 100 },
      level: 1,
      type: 'pioneer',
      connections: ['beacon-2']
    },
    {
      id: 'beacon-2', 
      position: { x: 200, y: 150 },
      level: 1,
      type: 'harvester',
      connections: ['beacon-1', 'beacon-3']
    },
    {
      id: 'beacon-3',
      position: { x: 150, y: 250 },
      level: 2,
      type: 'architect',
      connections: ['beacon-2']
    }
  ];

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
    gameController.addResources({ quantumData: 100 });
    const updatedState = gameController.getGameState();
    setGameState(updatedState);
  };

  const handleBeaconSelect = (beacon: Beacon) => {
    console.log('Selected beacon:', beacon);
  };

  const handleMapPress = (position: { x: number; y: number }) => {
    console.log('Map pressed at:', position);
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

  if (showDebugTester) {
    return (
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View className="flex-1">
            <View className="flex-row justify-between items-center px-4 py-4 bg-surface">
              <TouchableOpacity
                onPress={() => setShowDebugTester(false)}
                className="bg-primary px-4 py-2 rounded-lg"
              >
                <Text className="text-white font-semibold">← Back</Text>
              </TouchableOpacity>
              <Text className="text-text text-lg font-semibold">Debug JSI Crashes</Text>
              <View style={{ width: 70 }} />
            </View>
            <JSICrashTester />
          </View>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    );
  }

  if (showSharedValueTester) {
    return (
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View className="flex-1">
            <View className="flex-row justify-between items-center px-4 py-4 bg-surface">
              <TouchableOpacity
                onPress={() => setShowSharedValueTester(false)}
                className="bg-primary px-4 py-2 rounded-lg"
              >
                <Text className="text-white font-semibold">← Back</Text>
              </TouchableOpacity>
              <Text className="text-text text-lg font-semibold">SharedValue Analyzer</Text>
              <View style={{ width: 70 }} />
            </View>
            <SharedValueCrashTester />
          </View>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    );
  }

  if (showGalaxyMapAnalyzer) {
    return (
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View className="flex-1">
            <View className="flex-row justify-between items-center px-4 py-4 bg-surface">
              <TouchableOpacity
                onPress={() => setShowGalaxyMapAnalyzer(false)}
                className="bg-primary px-4 py-2 rounded-lg"
              >
                <Text className="text-white font-semibold">← Back</Text>
              </TouchableOpacity>
              <Text className="text-text text-lg font-semibold">Galaxy Map Analyzer</Text>
              <View style={{ width: 70 }} />
            </View>
            <GalaxyMapCrashAnalyzer />
          </View>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    );
  }

  if (showGalaxyMap) {
    return (
      <SafeAreaProvider>
        <GalaxyMapScreen 
          onBack={() => setShowGalaxyMap(false)}
          beacons={sampleBeacons}
          onBeaconSelect={handleBeaconSelect}
          onMapPress={handleMapPress}
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
                  onPress={() => setShowDebugTester(true)}
                  className="bg-red-500 px-6 py-3 rounded-lg"
                >
                  <Text className="text-white font-semibold text-center">
                    🐛 Debug JSI Crashes
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={() => setShowSharedValueTester(true)}
                  className="bg-purple-500 px-6 py-3 rounded-lg"
                >
                  <Text className="text-white font-semibold text-center">
                    🔍 SharedValue Analyzer
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={() => setShowGalaxyMapAnalyzer(true)}
                  className="bg-orange-500 px-6 py-3 rounded-lg"
                >
                  <Text className="text-white font-semibold text-center">
                    🗺️ Galaxy Map Analyzer
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
