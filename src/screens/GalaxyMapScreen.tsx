import React, { useState } from 'react';
import { Text, View, TouchableOpacity, Dimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { GalaxyMapView } from '../components/galaxy/GalaxyMapView';
import { ResourceHUD } from '../components/ui/ResourceHUD';
import { BeaconSpecializationModal } from '../components/ui/BeaconSpecializationModal';
import { ProbeManagerUI } from '../components/ui/ProbeManagerUI';
import { ProbeLaunchFAB } from '../components/ui/ProbeLaunchFAB';
import { PatternToggleButton } from '../components/ui/PatternToggleButton';
import { GameState } from '../storage/schemas/GameState';
import { ProbeInstance } from '../types/probe';
import { Beacon } from '../types/galaxy';
import { BeaconType, BeaconSpecialization } from '../types/beacon';
import { RootStackParamList } from '../navigation/AppNavigator';
import { ProbeType } from '../types/probe';
import { Point2D } from '../types/galaxy';

type GalaxyMapScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'GalaxyMap'>;

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
  const navigation = useNavigation<GalaxyMapScreenNavigationProp>();
  const insets = useSafeAreaInsets();
  const screenData = Dimensions.get('window');
  const headerHeight = 140 + insets.top;

  const [selectedBeaconType, setSelectedBeaconType] = useState<BeaconType>('pioneer');
  const [showSpecializationModal, setShowSpecializationModal] = useState(false);
  const [selectedBeaconForUpgrade, setSelectedBeaconForUpgrade] = useState<string | null>(null);
  const [showDebugOverlay, setShowDebugOverlay] = useState(false);
  const [selectedBeaconId, setSelectedBeaconId] = useState<string | null>(null);
  const [beaconVersion, setBeaconVersion] = useState(0);
  const [showProbeManager, setShowProbeManager] = useState(false);
  const [lastPlacement, setLastPlacement] = useState<{ position: { x: number; y: number } | null; timestamp: number }>({ position: null, timestamp: 0 });

  // Handle probe launch from FAB
  const handleProbeLaunch = (type: ProbeType, launchPosition: Point2D) => {
    console.log('[GalaxyMapScreen] handleProbeLaunch called with:', { type, launchPosition });
    try {
      const probeManager = gameController.getProbeManager();
      
      // Generate random target position within galaxy bounds
      const targetPosition: Point2D = {
        x: Math.random() * 1800 + 100, // 100-1900 to stay within bounds
        y: Math.random() * 1800 + 100,
      };
      
      const result = probeManager.queueProbe(type, targetPosition, 1, launchPosition);
      
      if (result.success) {
        console.log(`[GalaxyMapScreen] Successfully queued ${type} probe`);
      } else {
        console.warn(`[GalaxyMapScreen] Failed to queue ${type} probe:`, result.error);
      }
    } catch (error) {
      console.error(`[GalaxyMapScreen] Error launching ${type} probe:`, error);
    }
  };

  const handleBeaconSelect = (beacon: Beacon) => {
    console.log('Selected beacon:', beacon);
    setSelectedBeaconId(beacon.id);
  };

  const handleSpecializationSelect = (beaconId: string, specialization: BeaconSpecialization) => {
    console.log(`Specializing beacon ${beaconId} with ${specialization}`);
    // TODO: Implement beacon specialization in GameController
    setShowSpecializationModal(false);
    setSelectedBeaconForUpgrade(null);
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
      setBeaconVersion(prev => prev + 1); // Force re-render
    } else {
      console.error('Failed to place beacon:', result.error);
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
      connections: [...beacon.connections]
    }));
  };

  const selectedBeacon = selectedBeaconId && gameState 
    ? getBeaconsForMap().find(b => b.id === selectedBeaconId) || null
    : null;

  if (showProbeManager) {
    return (
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View className="flex-1 bg-background">
            <ResourceHUD resources={gameState.resources} />
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
          <ResourceHUD resources={gameState.resources} />
          
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
                <Text className="text-text text-lg font-semibold">Galaxy Map</Text>
                {__DEV__ && (
                  <TouchableOpacity
                    onPress={() => setShowDebugOverlay(!showDebugOverlay)}
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
            </View>
            
            {/* Beacon Type Selection */}
            <View className="pb-4">
              <Text className="text-text/80 text-sm mb-2 px-4">Select Beacon Type (Cost: 50 QD)</Text>
              <View className="flex-row space-x-2 px-4">
                <TouchableOpacity
                  onPress={() => setSelectedBeaconType('pioneer')}
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
                  onPress={() => setSelectedBeaconType('harvester')}
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
                  onPress={() => setSelectedBeaconType('architect')}
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
            beacons={getBeaconsForMap()}
            probes={probes}
            onBeaconSelect={handleBeaconSelect}
            onMapPress={handleMapPress}
            showDebugOverlay={showDebugOverlay}
            selectedBeacon={selectedBeacon}
            beaconUpdateTrigger={beaconVersion}
          />
          
          <StatusBar style="light" />
          
          {/* FABs positioned inside main view container */}
          {(() => {
            console.warn('🚨 [GalaxyMapScreen] RENDERING PROBELAUNCHFAB!');
            return (
              <ProbeLaunchFAB
                onProbeSelect={handleProbeLaunch}
                position="bottomLeft"
                launchPosition={{ x: 1000, y: 1000 }}
              />
            );
          })()}
          
          <PatternToggleButton
            position="bottom-right"
          />
        </View>
        
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
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
};