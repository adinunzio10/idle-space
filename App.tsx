import { StatusBar } from 'expo-status-bar';
import { Text, View, TouchableOpacity } from 'react-native';
import { useEffect, useState } from 'react';
import './global.css';
import { GameController } from './src/core/GameController';
import { GameState } from './src/storage/schemas/GameState';

export default function App() {
  const [gameController] = useState(() => GameController.getInstance());
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  if (error) {
    return (
      <View className="flex-1 bg-background items-center justify-center p-4">
        <Text className="text-red-500 text-xl font-semibold mb-4">Error</Text>
        <Text className="text-text/80 text-base text-center">{error}</Text>
        <StatusBar style="light" />
      </View>
    );
  }

  if (!isInitialized) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Text className="text-text text-xl font-semibold">Signal Garden</Text>
        <Text className="text-text/80 text-base mt-2">
          Initializing save system...
        </Text>
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background items-center justify-center p-4">
      <Text className="text-text text-2xl font-bold mb-6">Signal Garden</Text>
      
      {gameState && (
        <View className="items-center space-y-4">
          <Text className="text-text/80 text-lg">
            Commander: {gameState.player.name}
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
              onPress={handleSaveGame}
              className="bg-secondary px-6 py-3 rounded-lg"
            >
              <Text className="text-white font-semibold text-center">
                Manual Save
              </Text>
            </TouchableOpacity>
          </View>
          
          <Text className="text-text/40 text-xs mt-6 text-center">
            Save system active • Auto-save every 30s
          </Text>
        </View>
      )}
      
      <StatusBar style="light" />
    </View>
  );
}
