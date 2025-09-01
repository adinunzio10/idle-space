import React from 'react';
import { NavigationContainer, DefaultTheme, Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MainScreen } from '../screens/MainScreen';
import { GalaxyMapScreen } from '../screens/GalaxyMapScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { StatisticsScreen } from '../screens/StatisticsScreen';
import { PatternGalleryScreen } from '../screens/PatternGalleryScreen';
import { ProbeManagerScreen } from '../screens/ProbeManagerScreen';
import { GameState } from '../storage/schemas/GameState';
import { ProbeInstance } from '../types/probe';

export type RootStackParamList = {
  Main: undefined;
  GalaxyMap: undefined;
  Settings: undefined;
  Statistics: undefined;
  PatternGallery: undefined;
  ProbeManager: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Custom dark theme matching app colors
const DarkTheme: Theme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: '#4F46E5', // text-primary
    background: '#111827', // bg-background
    card: '#1F2937', // bg-surface
    text: '#F9FAFB', // text-text
    border: '#374151', // text/20 border
    notification: '#F59E0B', // text-accent
  },
};

interface AppNavigatorProps {
  gameState: GameState | null;
  gameController: any;
  probes: ProbeInstance[];
  isInitialized: boolean;
  error: string | null;
}

export const AppNavigator: React.FC<AppNavigatorProps> = ({
  gameState,
  gameController,
  probes,
  isInitialized,
  error,
}) => {
  if (error || !isInitialized) {
    return (
      <NavigationContainer theme={DarkTheme}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen name="Main">
            {() => (
              <MainScreen
                gameState={gameState}
                gameController={gameController}
                probes={probes}
                isInitialized={isInitialized}
                error={error}
              />
            )}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer theme={DarkTheme}>
      <Stack.Navigator
        initialRouteName="Main"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#111827' },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Main">
          {() => (
            <MainScreen
              gameState={gameState}
              gameController={gameController}
              probes={probes}
              isInitialized={isInitialized}
              error={error}
            />
          )}
        </Stack.Screen>
        
        <Stack.Screen name="GalaxyMap">
          {() => 
            gameState ? (
              <GalaxyMapScreen
                gameState={gameState}
                gameController={gameController}
                probes={probes}
              />
            ) : null
          }
        </Stack.Screen>
        
        <Stack.Screen name="Settings">
          {() => 
            gameState ? (
              <SettingsScreen
                gameState={gameState}
                gameController={gameController}
              />
            ) : null
          }
        </Stack.Screen>
        
        <Stack.Screen name="Statistics">
          {() => 
            gameState ? (
              <StatisticsScreen
                gameState={gameState}
                gameController={gameController}
              />
            ) : null
          }
        </Stack.Screen>
        
        <Stack.Screen name="PatternGallery">
          {() => 
            gameState ? (
              <PatternGalleryScreen
                gameState={gameState}
                gameController={gameController}
              />
            ) : null
          }
        </Stack.Screen>
        
        <Stack.Screen name="ProbeManager">
          {() => 
            gameState ? (
              <ProbeManagerScreen
                gameState={gameState}
                gameController={gameController}
              />
            ) : null
          }
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
};