import React from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { GameHUD } from '../components/ui/GameHUD';
import { ProbeManagerUI } from '../components/ui/ProbeManagerUI';
import { GameState } from '../storage/schemas/GameState';
import { RootStackParamList } from '../navigation/AppNavigator';

type ProbeManagerScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ProbeManager'>;

interface ProbeManagerScreenProps {
  gameState: GameState;
  gameController: any;
}

export const ProbeManagerScreen: React.FC<ProbeManagerScreenProps> = ({
  gameState,
  gameController,
}) => {
  const navigation = useNavigation<ProbeManagerScreenNavigationProp>();

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View className="flex-1 bg-background">
          <GameHUD resourceManager={gameController.getResourceManager()} showDetailed={false} />
          <ProbeManagerUI
            probeManager={gameController.getProbeManager()}
            onClose={() => navigation.goBack()}
          />
          <StatusBar style="light" />
        </View>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
};