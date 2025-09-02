import React, { useEffect, useState, useMemo } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Share,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { GameHUD } from '../components/ui/GameHUD';
import { GameState } from '../storage/schemas/GameState';
import { RootStackParamList } from '../navigation/AppNavigator';
import { formatNumber } from '../utils/numberFormatting';
import { BeaconType } from '../types/beacon';
import * as Haptics from 'expo-haptics';

type StatisticsScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Statistics'
>;

interface StatisticsScreenProps {
  gameState: GameState;
  gameController: any;
}

// Helper interfaces
interface StatCard {
  title: string;
  value: string | number;
  description?: string;
  color?: string;
  icon?: string;
}

interface BeaconStats {
  total: number;
  byType: Record<BeaconType, number>;
  totalLevels: number;
  averageLevel: number;
  maxLevel: number;
}

interface ResourceStats {
  total: Record<string, number>;
  rates: Record<string, number>;
  allTimeGenerated: Record<string, number>;
}

// Helper components
const StatCard: React.FC<StatCard & { onPress?: () => void }> = ({
  title,
  value,
  description,
  color = 'text-primary',
  icon,
  onPress,
}) => (
  <TouchableOpacity
    onPress={onPress}
    className={`bg-surface border border-text/10 rounded-lg p-4 ${onPress ? 'active:bg-surface/80' : ''}`}
    disabled={!onPress}
  >
    <View className="flex-row items-center justify-between mb-2">
      <Text className="text-text font-semibold text-base">{title}</Text>
      {icon && <Text className="text-xl">{icon}</Text>}
    </View>
    <Text className={`${color} font-bold text-lg mb-1`}>
      {typeof value === 'number'
        ? formatNumber(value, { useShortNotation: true })
        : value}
    </Text>
    {description && <Text className="text-text/60 text-sm">{description}</Text>}
  </TouchableOpacity>
);

const StatSection: React.FC<{
  title: string;
  children: React.ReactNode;
  icon?: string;
}> = ({ title, children, icon }) => (
  <View className="mb-6">
    <View className="flex-row items-center mb-4">
      {icon && <Text className="text-xl mr-2">{icon}</Text>}
      <Text className="text-text text-lg font-semibold">{title}</Text>
    </View>
    <View className="space-y-3">{children}</View>
  </View>
);

export const StatisticsScreen: React.FC<StatisticsScreenProps> = ({
  gameState,
  gameController,
}) => {
  const navigation = useNavigation<StatisticsScreenNavigationProp>();
  const insets = useSafeAreaInsets();
  const [refreshTime, setRefreshTime] = useState(Date.now());

  // Auto-refresh statistics every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshTime(Date.now());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Calculate comprehensive statistics
  const beaconStats = useMemo((): BeaconStats => {
    const beacons = Object.values(gameState.beacons);
    const total = beacons.length;
    const byType: Record<BeaconType, number> = {
      pioneer: 0,
      harvester: 0,
      architect: 0,
    };

    let totalLevels = 0;
    let maxLevel = 0;

    beacons.forEach(beacon => {
      byType[beacon.type]++;
      totalLevels += beacon.level;
      maxLevel = Math.max(maxLevel, beacon.level);
    });

    return {
      total,
      byType,
      totalLevels,
      averageLevel: total > 0 ? totalLevels / total : 0,
      maxLevel,
    };
  }, [gameState.beacons, refreshTime]);

  const resourceStats = useMemo((): ResourceStats => {
    const resourceManager = gameController.getResourceManager();
    const resources = resourceManager.getResources();

    return {
      total: {
        quantumData: resources.quantumData.toNumber(),
        stellarEssence: resources.stellarEssence.toNumber(),
        voidFragments: resources.voidFragments.toNumber(),
        resonanceCrystals: resources.resonanceCrystals.toNumber(),
        chronosParticles: resources.chronosParticles.toNumber(),
      },
      rates: {
        quantumData: 0, // TODO: Calculate from beacon network
        stellarEssence: 0,
        voidFragments: 0,
      },
      allTimeGenerated: {
        quantumData: resources.quantumData.toNumber(), // Simplified - would track separately in real app
        stellarEssence: resources.stellarEssence.toNumber(),
        voidFragments: resources.voidFragments.toNumber(),
      },
    };
  }, [gameState, gameController, refreshTime]);

  const gameStats = useMemo(() => {
    const playTimeHours = gameState.gameTime / 3600;
    const playTimeDays = playTimeHours / 24;

    return {
      playTime: {
        total: gameState.gameTime,
        hours: playTimeHours,
        days: playTimeDays,
        formatted:
          playTimeHours < 1
            ? `${Math.floor(gameState.gameTime / 60)}m`
            : playTimeHours < 24
              ? `${Math.floor(playTimeHours)}h ${Math.floor((playTimeHours % 1) * 60)}m`
              : `${Math.floor(playTimeDays)}d ${Math.floor((playTimeDays % 1) * 24)}h`,
      },
      saves: gameState.saveCount,
      efficiency:
        beaconStats.total > 0
          ? resourceStats.total.quantumData / beaconStats.total
          : 0,
    };
  }, [gameState, beaconStats, resourceStats]);

  const handleExportStats = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const statsData = {
      exportDate: new Date().toISOString(),
      playerName: gameState.player.name,
      playTime: gameStats.playTime,
      saveCount: gameStats.saves,
      beacons: beaconStats,
      resources: resourceStats.total,
      efficiency: gameStats.efficiency,
    };

    const statsText =
      `📊 Signal Garden Statistics\n\n` +
      `👤 Player: ${gameState.player.name}\n` +
      `⏰ Play Time: ${gameStats.playTime.formatted}\n` +
      `💾 Saves: ${gameStats.saves}\n\n` +
      `🌐 Network: ${beaconStats.total} beacons\n` +
      `📊 Avg Level: ${beaconStats.averageLevel.toFixed(1)}\n` +
      `🚀 Pioneer: ${beaconStats.byType.pioneer}\n` +
      `⛏️ Harvester: ${beaconStats.byType.harvester}\n` +
      `🏗️ Architect: ${beaconStats.byType.architect}\n\n` +
      `💎 Quantum Data: ${formatNumber(resourceStats.total.quantumData)}\n` +
      `⭐ Stellar Essence: ${formatNumber(resourceStats.total.stellarEssence)}\n` +
      `🌌 Void Fragments: ${formatNumber(resourceStats.total.voidFragments)}\n\n` +
      `⚡ Efficiency: ${gameStats.efficiency.toFixed(2)} QD/beacon\n\n` +
      `Exported from Signal Garden v1.0.0`;

    try {
      await Share.share({
        message: statsText,
        title: 'Signal Garden Statistics',
      });
    } catch (error) {
      console.error('Failed to share statistics:', error);
    }
  };

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View className="flex-1 bg-background">
          <GameHUD
            resourceManager={gameController.getResourceManager()}
            showDetailed={false}
          />

          <View className="bg-surface px-4 py-3">
            <View className="flex-row justify-between items-center">
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                className="bg-primary px-4 py-2 rounded-lg"
              >
                <Text className="text-white font-semibold">← Back</Text>
              </TouchableOpacity>
              <Text className="text-text text-lg font-semibold">
                Statistics
              </Text>
              <View style={{ width: 60 }} />
            </View>
          </View>

          <ScrollView className="flex-1 p-4">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-text text-xl font-semibold">
                📊 Statistics
              </Text>
              <TouchableOpacity
                onPress={handleExportStats}
                className="bg-primary/10 border border-primary/30 px-3 py-2 rounded-lg"
              >
                <Text className="text-primary text-sm font-semibold">
                  Export
                </Text>
              </TouchableOpacity>
            </View>

            {/* Overview Cards */}
            <StatSection title="Overview" icon="🎯">
              <View className="flex-row space-x-3">
                <View className="flex-1">
                  <StatCard
                    title="Play Time"
                    value={gameStats.playTime.formatted}
                    description={`${gameStats.saves} saves`}
                    color="text-primary"
                    icon="⏰"
                  />
                </View>
                <View className="flex-1">
                  <StatCard
                    title="Network Size"
                    value={beaconStats.total}
                    description={`Avg level ${beaconStats.averageLevel.toFixed(1)}`}
                    color="text-secondary"
                    icon="🌐"
                  />
                </View>
              </View>
            </StatSection>

            {/* Resource Statistics */}
            <StatSection title="Resources" icon="💎">
              <View className="grid grid-cols-2 gap-3">
                <StatCard
                  title="Quantum Data"
                  value={resourceStats.total.quantumData}
                  description="Primary currency"
                  color="text-primary"
                />
                <StatCard
                  title="Stellar Essence"
                  value={resourceStats.total.stellarEssence}
                  description="Advanced material"
                  color="text-secondary"
                />
                <StatCard
                  title="Void Fragments"
                  value={resourceStats.total.voidFragments}
                  description="Rare resource"
                  color="text-accent"
                />
                <StatCard
                  title="Resonance Crystals"
                  value={resourceStats.total.resonanceCrystals}
                  description="Pattern enhancer"
                  color="text-blue-400"
                />
              </View>

              {resourceStats.total.chronosParticles > 0 && (
                <StatCard
                  title="Chronos Particles"
                  value={resourceStats.total.chronosParticles}
                  description="Premium currency"
                  color="text-pink-400"
                  icon="⚡"
                />
              )}
            </StatSection>

            {/* Beacon Network */}
            <StatSection title="Beacon Network" icon="📡">
              <View className="flex-row space-x-3 mb-3">
                <View className="flex-1">
                  <StatCard
                    title="Total Beacons"
                    value={beaconStats.total}
                    description={`${beaconStats.totalLevels} total levels`}
                    color="text-primary"
                  />
                </View>
                <View className="flex-1">
                  <StatCard
                    title="Highest Level"
                    value={beaconStats.maxLevel}
                    description="Maximum beacon level"
                    color="text-accent"
                  />
                </View>
              </View>

              <View className="grid grid-cols-3 gap-2">
                <StatCard
                  title="Pioneer"
                  value={beaconStats.byType.pioneer}
                  description="Exploration beacons"
                  color="text-primary"
                  icon="🔍"
                />
                <StatCard
                  title="Harvester"
                  value={beaconStats.byType.harvester}
                  description="Resource generators"
                  color="text-secondary"
                  icon="⛏️"
                />
                <StatCard
                  title="Architect"
                  value={beaconStats.byType.architect}
                  description="Pattern builders"
                  color="text-accent"
                  icon="🏗️"
                />
              </View>
            </StatSection>

            {/* Performance Metrics */}
            <StatSection title="Performance" icon="📈">
              <StatCard
                title="Network Efficiency"
                value={gameStats.efficiency.toFixed(2)}
                description="QD per beacon ratio"
                color="text-green-400"
                icon="⚡"
              />

              <StatCard
                title="Session Statistics"
                value="Coming Soon"
                description="Detailed session analytics"
                color="text-text/60"
                icon="📊"
              />
            </StatSection>

            {/* Achievements Preview */}
            <StatSection title="Achievements" icon="🏆">
              <StatCard
                title="Progress Tracking"
                value="Coming Soon"
                description="Achievement system in development"
                color="text-text/60"
                icon="🎖️"
              />
            </StatSection>

            {/* Debug Information */}
            {__DEV__ && (
              <StatSection title="Debug Info" icon="🔧">
                <View className="bg-surface border border-text/10 rounded-lg p-4">
                  <Text className="text-text/80 font-semibold mb-2">
                    Development Statistics
                  </Text>
                  <Text className="text-text/60 text-sm mb-1">
                    Last refresh: {new Date(refreshTime).toLocaleTimeString()}
                  </Text>
                  <Text className="text-text/60 text-sm mb-1">
                    Save version: {gameState.saveCount}
                  </Text>
                  <Text className="text-text/60 text-sm">
                    Game time: {gameState.gameTime}s
                  </Text>
                </View>
              </StatSection>
            )}

            <View className="mb-8" />
          </ScrollView>

          <StatusBar style="light" />
        </View>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
};
