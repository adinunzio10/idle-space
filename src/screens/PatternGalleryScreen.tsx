import React, { useState, useMemo, useEffect } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  FlatList,
  Alert,
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
import { GeometricPattern, PatternType } from '../types/galaxy';
import { PATTERN_COLORS, BONUS_DISPLAY } from '../constants/patterns';
import { formatNumber } from '../utils/numberFormatting';
import * as Haptics from 'expo-haptics';
import Svg, { Polygon, Circle, Text as SvgText } from 'react-native-svg';

type PatternGalleryScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'PatternGallery'
>;

interface PatternGalleryScreenProps {
  gameState: GameState;
  gameController: any;
}

// Helper interfaces
interface PatternDiscovery {
  type: PatternType;
  discoveredAt: number;
  count: number;
  bestBonus: number;
  averageBonus: number;
  isActive: boolean;
}

interface PatternStats {
  totalDiscovered: number;
  totalActive: number;
  bestMultiplier: number;
  patternsByType: Record<PatternType, PatternDiscovery>;
}

// Helper components
const PatternIcon: React.FC<{
  type: PatternType;
  size?: number;
  isActive?: boolean;
}> = ({ type, size = 40, isActive = false }) => {
  const color = PATTERN_COLORS[type];
  const fillColor = isActive ? color.fillActive : color.fill;
  const strokeColor = isActive ? color.strokeActive : color.stroke;

  const getPatternPoints = () => {
    const radius = size / 3;
    const centerX = size / 2;
    const centerY = size / 2;

    switch (type) {
      case 'triangle': {
        const height = (radius * Math.sqrt(3)) / 2;
        return `${centerX},${centerY - radius} ${centerX - height},${centerY + radius / 2} ${centerX + height},${centerY + radius / 2}`;
      }
      case 'square': {
        const half = radius;
        return `${centerX - half},${centerY - half} ${centerX + half},${centerY - half} ${centerX + half},${centerY + half} ${centerX - half},${centerY + half}`;
      }
      case 'pentagon': {
        const points = [];
        for (let i = 0; i < 5; i++) {
          const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
          const x = centerX + radius * Math.cos(angle);
          const y = centerY + radius * Math.sin(angle);
          points.push(`${x},${y}`);
        }
        return points.join(' ');
      }
      case 'hexagon': {
        const points = [];
        for (let i = 0; i < 6; i++) {
          const angle = (i * 2 * Math.PI) / 6 - Math.PI / 2;
          const x = centerX + radius * Math.cos(angle);
          const y = centerY + radius * Math.sin(angle);
          points.push(`${x},${y}`);
        }
        return points.join(' ');
      }
      default:
        return '';
    }
  };

  return (
    <Svg width={size} height={size}>
      <Polygon
        points={getPatternPoints()}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={2}
        fillOpacity={0.8}
      />
    </Svg>
  );
};

const PatternCard: React.FC<{
  discovery: PatternDiscovery;
  onPress: () => void;
}> = ({ discovery, onPress }) => {
  const color = PATTERN_COLORS[discovery.type];
  const multiplier = BONUS_DISPLAY.MULTIPLIERS[discovery.type];

  return (
    <TouchableOpacity
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      className="bg-surface border border-text/10 rounded-lg p-4 mb-3 active:bg-surface/80"
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          <PatternIcon
            type={discovery.type}
            size={50}
            isActive={discovery.isActive}
          />
          <View className="ml-4 flex-1">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-text font-semibold text-lg capitalize">
                {discovery.type}
              </Text>
              <View
                className={`px-2 py-1 rounded-full`}
                style={{ backgroundColor: color.fill + '30' }}
              >
                <Text
                  className="text-text text-xs font-bold"
                  style={{ color: color.stroke }}
                >
                  {multiplier}
                </Text>
              </View>
            </View>
            <Text className="text-text/60 text-sm mb-1">
              Discovered: {discovery.count} patterns
            </Text>
            <Text className="text-text/60 text-xs">
              {discovery.isActive
                ? `${discovery.count} active`
                : 'No active patterns'}
            </Text>
          </View>
        </View>
        <Text className="text-text/40 text-xs">{'>'}</Text>
      </View>
    </TouchableOpacity>
  );
};

const StatCard: React.FC<{
  title: string;
  value: string | number;
  description: string;
  color: string;
  icon: string;
}> = ({ title, value, description, color, icon }) => (
  <View className="bg-surface border border-text/10 rounded-lg p-4 flex-1">
    <View className="flex-row items-center justify-between mb-2">
      <Text className="text-text/80 font-semibold text-sm">{title}</Text>
      <Text className="text-lg">{icon}</Text>
    </View>
    <Text className={`${color} font-bold text-xl mb-1`}>
      {typeof value === 'number' ? formatNumber(value) : value}
    </Text>
    <Text className="text-text/60 text-xs">{description}</Text>
  </View>
);

export const PatternGalleryScreen: React.FC<PatternGalleryScreenProps> = ({
  gameState,
  gameController,
}) => {
  const navigation = useNavigation<PatternGalleryScreenNavigationProp>();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<
    'all' | 'active' | 'discovered'
  >('all');

  // Mock pattern data - in a real implementation, this would come from pattern detection system
  const patternStats = useMemo((): PatternStats => {
    // This would normally analyze the beacon network to find patterns
    // For now, we'll create mock data based on beacon count
    const beaconCount = Object.keys(gameState.beacons).length;

    const mockPatterns: Record<PatternType, PatternDiscovery> = {
      triangle: {
        type: 'triangle',
        discoveredAt: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
        count: Math.max(0, Math.floor(beaconCount / 3) - 1),
        bestBonus: 1.5,
        averageBonus: 1.4,
        isActive: beaconCount >= 3,
      },
      square: {
        type: 'square',
        discoveredAt: Date.now() - 5 * 24 * 60 * 60 * 1000, // 5 days ago
        count: Math.max(0, Math.floor(beaconCount / 4) - 1),
        bestBonus: 2.0,
        averageBonus: 1.8,
        isActive: beaconCount >= 4,
      },
      pentagon: {
        type: 'pentagon',
        discoveredAt: Date.now() - 3 * 24 * 60 * 60 * 1000, // 3 days ago
        count: Math.max(0, Math.floor(beaconCount / 6)),
        bestBonus: 3.0,
        averageBonus: 2.7,
        isActive: beaconCount >= 5,
      },
      hexagon: {
        type: 'hexagon',
        discoveredAt: Date.now() - 1 * 24 * 60 * 60 * 1000, // 1 day ago
        count: Math.max(0, Math.floor(beaconCount / 8)),
        bestBonus: 5.0,
        averageBonus: 4.2,
        isActive: beaconCount >= 6,
      },
    };

    const totalDiscovered = Object.values(mockPatterns).reduce(
      (sum, p) => sum + p.count,
      0
    );
    const totalActive = Object.values(mockPatterns).filter(
      p => p.isActive
    ).length;
    const bestMultiplier = Math.max(
      ...Object.values(mockPatterns).map(p => p.bestBonus)
    );

    return {
      totalDiscovered,
      totalActive,
      bestMultiplier,
      patternsByType: mockPatterns,
    };
  }, [gameState.beacons]);

  const filteredPatterns = useMemo(() => {
    const patterns = Object.values(patternStats.patternsByType);

    let filtered = patterns;

    if (selectedFilter === 'active') {
      filtered = patterns.filter(p => p.isActive);
    } else if (selectedFilter === 'discovered') {
      filtered = patterns.filter(p => p.count > 0);
    }

    if (searchQuery) {
      filtered = filtered.filter(p =>
        p.type.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered.sort((a, b) => b.bestBonus - a.bestBonus);
  }, [patternStats.patternsByType, selectedFilter, searchQuery]);

  const handlePatternPress = (pattern: PatternDiscovery) => {
    const details =
      `Pattern Type: ${pattern.type.charAt(0).toUpperCase() + pattern.type.slice(1)}\n` +
      `Discovered: ${pattern.count} patterns\n` +
      `Best Bonus: ${pattern.bestBonus}x multiplier\n` +
      `Average Bonus: ${pattern.averageBonus}x multiplier\n` +
      `Status: ${pattern.isActive ? 'Active' : 'Inactive'}\n\n` +
      `This pattern provides a ${BONUS_DISPLAY.MULTIPLIERS[pattern.type]} resource generation bonus when formed by connected beacons.`;

    Alert.alert(
      `${pattern.type.charAt(0).toUpperCase() + pattern.type.slice(1)} Pattern`,
      details,
      [{ text: 'OK', style: 'default' }]
    );
  };

  const handleExportPatterns = () => {
    // TODO: Implement pattern export functionality
    Alert.alert(
      'Export Patterns',
      'Pattern export functionality will be implemented in a future update.'
    );
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
                Pattern Gallery
              </Text>
              <View style={{ width: 60 }} />
            </View>
          </View>

          <ScrollView className="flex-1 p-4">
            {/* Header with export button */}
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-text text-xl font-semibold">
                🔷 Pattern Gallery
              </Text>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  handleExportPatterns();
                }}
                className="bg-primary/10 border border-primary/30 px-3 py-2 rounded-lg"
              >
                <Text className="text-primary text-sm font-semibold">
                  Export
                </Text>
              </TouchableOpacity>
            </View>

            {/* Statistics Overview */}
            <View className="mb-6">
              <Text className="text-text text-lg font-semibold mb-4">
                📊 Pattern Statistics
              </Text>
              <View className="flex-row space-x-3 mb-4">
                <StatCard
                  title="Discovered"
                  value={patternStats.totalDiscovered}
                  description="Total patterns found"
                  color="text-primary"
                  icon="🔍"
                />
                <StatCard
                  title="Active Types"
                  value={patternStats.totalActive}
                  description="Currently providing bonuses"
                  color="text-green-400"
                  icon="⚡"
                />
              </View>
              <StatCard
                title="Best Multiplier"
                value={`${patternStats.bestMultiplier}×`}
                description="Highest pattern bonus achieved"
                color="text-accent"
                icon="🏆"
              />
            </View>

            {/* Search and Filter */}
            <View className="mb-6">
              <Text className="text-text text-lg font-semibold mb-4">
                🔍 Browse Patterns
              </Text>

              <View className="bg-surface border border-text/10 rounded-lg px-3 py-2 mb-4">
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search patterns..."
                  placeholderTextColor="#9CA3AF"
                  className="text-text text-sm"
                  style={{ fontSize: 14 }}
                />
              </View>

              <View className="flex-row space-x-2 mb-4">
                {(['all', 'active', 'discovered'] as const).map(filter => (
                  <TouchableOpacity
                    key={filter}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedFilter(filter);
                    }}
                    className={`px-4 py-2 rounded-lg border ${
                      selectedFilter === filter
                        ? 'bg-primary border-primary'
                        : 'bg-surface border-text/20'
                    }`}
                  >
                    <Text
                      className={`text-sm font-semibold ${
                        selectedFilter === filter ? 'text-white' : 'text-text'
                      }`}
                    >
                      {filter.charAt(0).toUpperCase() + filter.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Pattern List */}
            <View className="mb-6">
              <Text className="text-text text-lg font-semibold mb-4">
                📐 Pattern Library
              </Text>
              {filteredPatterns.length > 0 ? (
                filteredPatterns.map(pattern => (
                  <PatternCard
                    key={pattern.type}
                    discovery={pattern}
                    onPress={() => handlePatternPress(pattern)}
                  />
                ))
              ) : (
                <View className="bg-surface border border-text/10 rounded-lg p-6 items-center">
                  <Text className="text-text/60 text-center text-lg mb-2">
                    🔍
                  </Text>
                  <Text className="text-text/80 font-semibold text-center mb-2">
                    {searchQuery
                      ? 'No matching patterns'
                      : 'No patterns discovered'}
                  </Text>
                  <Text className="text-text/60 text-sm text-center">
                    {searchQuery
                      ? 'Try adjusting your search terms or filters.'
                      : 'Build beacon networks to discover geometric patterns and unlock bonuses!'}
                  </Text>
                </View>
              )}
            </View>

            {/* Pattern Guide */}
            <View className="mb-8">
              <Text className="text-text text-lg font-semibold mb-4">
                📚 Pattern Guide
              </Text>

              <View className="bg-surface border border-text/10 rounded-lg p-4">
                <Text className="text-text/80 font-semibold mb-3">
                  How Patterns Work
                </Text>
                <Text className="text-text/60 text-sm mb-3">
                  Connect beacons in geometric shapes to form patterns that
                  provide resource generation bonuses:
                </Text>

                <View className="space-y-2 mb-4">
                  <View className="flex-row items-center">
                    <PatternIcon type="triangle" size={24} />
                    <Text className="text-text/70 text-sm ml-3">
                      <Text className="font-semibold">Triangle:</Text> 3
                      connected beacons - {BONUS_DISPLAY.MULTIPLIERS.triangle}{' '}
                      bonus
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <PatternIcon type="square" size={24} />
                    <Text className="text-text/70 text-sm ml-3">
                      <Text className="font-semibold">Square:</Text> 4 connected
                      beacons - {BONUS_DISPLAY.MULTIPLIERS.square} bonus
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <PatternIcon type="pentagon" size={24} />
                    <Text className="text-text/70 text-sm ml-3">
                      <Text className="font-semibold">Pentagon:</Text> 5
                      connected beacons - {BONUS_DISPLAY.MULTIPLIERS.pentagon}{' '}
                      bonus
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <PatternIcon type="hexagon" size={24} />
                    <Text className="text-text/70 text-sm ml-3">
                      <Text className="font-semibold">Hexagon:</Text> 6
                      connected beacons - {BONUS_DISPLAY.MULTIPLIERS.hexagon}{' '}
                      bonus
                    </Text>
                  </View>
                </View>

                <Text className="text-text/60 text-xs">
                  💡 Tip: Patterns can overlap and stack for even greater
                  bonuses!
                </Text>
              </View>
            </View>
          </ScrollView>

          <StatusBar style="light" />
        </View>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
};
