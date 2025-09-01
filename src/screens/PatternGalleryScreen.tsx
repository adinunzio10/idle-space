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

type PatternGalleryScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'PatternGallery'>;

interface PatternGalleryScreenProps {
  gameState: GameState;
  gameController: any;
}

export const PatternGalleryScreen: React.FC<PatternGalleryScreenProps> = ({
  gameState,
  gameController,
}) => {
  const navigation = useNavigation<PatternGalleryScreenNavigationProp>();
  const insets = useSafeAreaInsets();

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
              <Text className="text-text text-lg font-semibold">Pattern Gallery</Text>
              <View style={{ width: 60 }} />
            </View>
          </View>
          
          <View className="flex-1 p-4">
            <Text className="text-text text-xl font-semibold mb-6">🔷 Pattern Gallery</Text>
            
            <View className="space-y-4">
              <View className="bg-surface px-4 py-4 rounded-lg">
                <Text className="text-text/80 text-sm font-semibold mb-2">Discovered Patterns</Text>
                <Text className="text-text/60 text-sm">
                  Geometric patterns you've created will be displayed here, along with their bonuses and effects.
                </Text>
              </View>
              
              <View className="bg-surface px-4 py-4 rounded-lg">
                <Text className="text-text/80 text-sm font-semibold mb-2">Pattern Types</Text>
                <View className="mt-2 space-y-2">
                  <Text className="text-text/60 text-xs">🔺 Triangle - +10% resource generation</Text>
                  <Text className="text-text/60 text-xs">🔷 Square - +15% resource generation</Text>
                  <Text className="text-text/60 text-xs">⬟ Pentagon - +20% resource generation</Text>
                  <Text className="text-text/60 text-xs">⬡ Hexagon - +25% resource generation</Text>
                </View>
              </View>
              
              <View className="bg-surface px-4 py-4 rounded-lg">
                <Text className="text-text/80 text-sm font-semibold mb-2">Coming Soon</Text>
                <Text className="text-text/60 text-sm">
                  Pattern detection, visual gallery, and bonus tracking system will be implemented here.
                </Text>
              </View>
            </View>
          </View>
          
          <StatusBar style="light" />
        </View>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
};