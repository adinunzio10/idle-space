import React from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { GameHUD } from '../components/ui/GameHUD';
import { GameState } from '../storage/schemas/GameState';
import { ProbeInstance } from '../types/probe';
import { RootStackParamList } from '../navigation/AppNavigator';

type MainScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Main'>;

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

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View className="flex-1 bg-background">
          {gameState && <GameHUD resourceManager={gameController.getResourceManager()} showDetailed={false} />}
          
          <View className="flex-1 items-center justify-center p-4">
            <Text className="text-text text-2xl font-bold mb-6">Signal Garden</Text>
            
            {gameState && (
              <View className="items-center space-y-4">
                <Text className="text-text/80 text-lg">
                  {gameState.player.name}
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
                    onPress={() => navigation.navigate('GalaxyMap')}
                    className="bg-accent px-6 py-3 rounded-lg"
                  >
                    <Text className="text-white font-semibold text-center">
                      Open Galaxy Map
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    onPress={() => navigation.navigate('Settings')}
                    className="bg-secondary px-6 py-3 rounded-lg"
                  >
                    <Text className="text-white font-semibold text-center">
                      ⚙️ Settings
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    onPress={() => navigation.navigate('Statistics')}
                    className="bg-primary px-6 py-3 rounded-lg border border-primary/50"
                  >
                    <Text className="text-white font-semibold text-center">
                      📊 Statistics
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => navigation.navigate('PatternGallery')}
                    className="bg-secondary px-6 py-3 rounded-lg border border-secondary/50"
                  >
                    <Text className="text-white font-semibold text-center">
                      🔷 Pattern Gallery
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => navigation.navigate('ProbeManager')}
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
        </View>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
};