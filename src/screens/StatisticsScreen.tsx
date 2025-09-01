import React from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ResourceHUD } from '../components/ui/ResourceHUD';
import { GameState } from '../storage/schemas/GameState';
import { RootStackParamList } from '../navigation/AppNavigator';

type StatisticsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Statistics'>;

interface StatisticsScreenProps {
  gameState: GameState;
  gameController: any;
}

export const StatisticsScreen: React.FC<StatisticsScreenProps> = ({
  gameState,
  gameController,
}) => {
  const navigation = useNavigation<StatisticsScreenNavigationProp>();
  const insets = useSafeAreaInsets();

  const beaconCount = Object.keys(gameState.beacons).length;
  const totalBeaconLevels = Object.values(gameState.beacons).reduce((sum, beacon) => sum + beacon.level, 0);

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View className="flex-1 bg-background">
          <ResourceHUD resources={gameState.resources} />
          
          <View className="bg-surface px-4 py-3" style={{ paddingTop: insets.top + 12 }}>
            <View className="flex-row justify-between items-center">
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                className="bg-primary px-4 py-2 rounded-lg"
              >
                <Text className="text-white font-semibold">← Back</Text>
              </TouchableOpacity>
              <Text className="text-text text-lg font-semibold">Statistics</Text>
              <View style={{ width: 60 }} />
            </View>
          </View>
          
          <View className="flex-1 p-4">
            <Text className="text-text text-xl font-semibold mb-6">📊 Game Statistics</Text>
            
            <View className="space-y-4">
              <View className="bg-surface px-4 py-4 rounded-lg">
                <Text className="text-text/80 text-sm font-semibold mb-2">Player Progress</Text>
                <Text className="text-text text-base">Player: {gameState.player.name}</Text>
                <Text className="text-text/60 text-sm">Save #{gameState.saveCount}</Text>
                <Text className="text-text/60 text-sm">Play time: {Math.floor(gameState.gameTime / 60)} minutes</Text>
              </View>
              
              <View className="bg-surface px-4 py-4 rounded-lg">
                <Text className="text-text/80 text-sm font-semibold mb-2">Beacon Network</Text>
                <Text className="text-text text-base">Total Beacons: {beaconCount}</Text>
                <Text className="text-text/60 text-sm">Combined Levels: {totalBeaconLevels}</Text>
              </View>
              
              <View className="bg-surface px-4 py-4 rounded-lg">
                <Text className="text-text/80 text-sm font-semibold mb-2">Resources</Text>
                <Text className="text-text text-base">Quantum Data: {gameState.resources.quantumData}</Text>
              </View>
              
              <View className="bg-surface px-4 py-4 rounded-lg">
                <Text className="text-text/80 text-sm font-semibold mb-2">Advanced Statistics</Text>
                <Text className="text-text/60 text-sm">Pattern bonuses, efficiency metrics, and detailed analytics will be implemented here.</Text>
              </View>
            </View>
          </View>
          
          <StatusBar style="light" />
        </View>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
};