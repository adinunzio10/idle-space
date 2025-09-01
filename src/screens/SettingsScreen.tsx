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

type SettingsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Settings'>;

interface SettingsScreenProps {
  gameState: GameState;
  gameController: any;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  gameState,
  gameController,
}) => {
  const navigation = useNavigation<SettingsScreenNavigationProp>();
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
              <Text className="text-text text-lg font-semibold">Settings</Text>
              <View style={{ width: 60 }} />
            </View>
          </View>
          
          <View className="flex-1 items-center justify-center p-4">
            <Text className="text-text text-xl font-semibold mb-4">⚙️ Settings</Text>
            <Text className="text-text/60 text-base text-center">
              Game settings and preferences will be implemented here.
            </Text>
            
            <View className="mt-8 space-y-4">
              <View className="bg-surface px-4 py-3 rounded-lg">
                <Text className="text-text/80 text-sm">Audio Settings</Text>
                <Text className="text-text/60 text-xs mt-1">Coming soon</Text>
              </View>
              
              <View className="bg-surface px-4 py-3 rounded-lg">
                <Text className="text-text/80 text-sm">Display Settings</Text>
                <Text className="text-text/60 text-xs mt-1">Coming soon</Text>
              </View>
              
              <View className="bg-surface px-4 py-3 rounded-lg">
                <Text className="text-text/80 text-sm">Save Management</Text>
                <Text className="text-text/60 text-xs mt-1">Coming soon</Text>
              </View>
            </View>
          </View>
          
          <StatusBar style="light" />
        </View>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
};