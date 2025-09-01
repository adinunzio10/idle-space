import { useEffect, useState, useCallback } from 'react';
import { View, Text, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-screens';
import './global.css';
import { GameController } from './src/core/GameController';
import { GameState } from './src/storage/schemas/GameState';
import { ProbeInstance } from './src/types/probe';
import { AppNavigator } from './src/navigation/AppNavigator';
import { PatternSuggestionProvider } from './src/contexts/PatternSuggestionContext';
import { ResourceProvider } from './src/core/ResourceContext';
import { SettingsProvider } from './src/contexts/SettingsContext';
import { useGameSettings } from './src/hooks/useGameSettings';

// Inner component that can use settings hooks
function GameApp() {
  const [gameController] = useState(() => GameController.getInstance());
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [probes, setProbes] = useState<ProbeInstance[]>([]);
  const [processedProbeIds] = useState(() => new Set<string>()); // Track probes that have already created beacons
  
  // Synchronize settings with game controller and other systems
  useGameSettings(gameController);

  // Initialize additional managers
  useEffect(() => {
    const initializeManagers = async () => {
      const { AudioManager } = await import('./src/core/AudioManager');
      const { AccessibilityManager } = await import('./src/utils/AccessibilityManager');
      
      try {
        await AudioManager.getInstance().initialize();
        await AccessibilityManager.getInstance().initialize();
      } catch (error) {
        console.error('Failed to initialize additional managers:', error);
      }
    };

    initializeManagers();
  }, []);
  
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
      
      const finalPos = result.finalPosition || result.beacon.position;
      const wasRelocated = finalPos.x !== probe.targetPosition.x || finalPos.y !== probe.targetPosition.y;
      
      if (wasRelocated) {
        // TODO: Add visual notification for user about beacon relocation
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


  return (
    <ResourceProvider>
      <PatternSuggestionProvider initialBeacons={[]}>
        <AppNavigator
          gameState={gameState}
          gameController={gameController}
          probes={probes}
          isInitialized={isInitialized}
          error={error}
        />
      </PatternSuggestionProvider>
    </ResourceProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SettingsProvider>
          <GameApp />
        </SettingsProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
