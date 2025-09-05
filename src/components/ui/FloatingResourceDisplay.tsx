import React from 'react';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

interface Resource {
  name: string;
  value: number;
  icon: string;
  color: string;
  maxDisplayValue?: number;
}

interface FloatingResourceDisplayProps {
  resources: Resource[];
  position?: 'top' | 'bottom';
  compact?: boolean;
  visible?: boolean;
  onPress?: () => void;
}

export const FloatingResourceDisplay: React.FC<FloatingResourceDisplayProps> = ({
  resources,
  position = 'top',
  compact = false,
  visible = true,
  onPress,
}) => {
  const insets = useSafeAreaInsets();
  const opacity = useSharedValue(visible ? 1 : 0);
  const translateY = useSharedValue(0);

  // Update visibility animation
  React.useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, { duration: 300 });
    translateY.value = withSpring(visible ? 0 : (position === 'top' ? -50 : 50), {
      damping: 15,
      stiffness: 300,
    });
  }, [visible, position, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ translateY: translateY.value }],
    };
  });

  const formatValue = (value: number, maxDisplay?: number): string => {
    if (maxDisplay && value > maxDisplay) {
      if (value >= 1000000) {
        return `${(value / 1000000).toFixed(1)}M`;
      } else if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}K`;
      }
    }
    
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    } else {
      return Math.floor(value).toString();
    }
  };

  const positionStyle = {
    position: 'absolute' as const,
    left: 16,
    right: 16,
    zIndex: 100,
    ...(position === 'top' 
      ? { top: insets.top + 16 }
      : { bottom: insets.bottom + 8 }
    ),
  };

  if (compact) {
    return (
      <Animated.View style={[positionStyle, animatedStyle]}>
        <View className="bg-background/90 backdrop-blur-sm border border-white/10 rounded-xl px-3 py-2">
          <View className="flex-row justify-between items-center space-x-4">
            {resources.slice(0, 3).map((resource, index) => (
              <View key={resource.name} className="flex-row items-center space-x-1">
                <Text className="text-sm">{resource.icon}</Text>
                <Text className={`text-sm font-semibold ${resource.color}`}>
                  {formatValue(resource.value, resource.maxDisplayValue)}
                </Text>
              </View>
            ))}
            {resources.length > 3 && (
              <Text className="text-text/60 text-sm">+{resources.length - 3}</Text>
            )}
          </View>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[positionStyle, animatedStyle]}>
      <View className="bg-background/90 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3">
        <View className="flex-row justify-between items-center space-x-6">
          {resources.map((resource, index) => (
            <View key={resource.name} className="flex-1 items-center">
              <View className="flex-row items-center space-x-2 mb-1">
                <Text className="text-base">{resource.icon}</Text>
                <Text className="text-text/80 text-sm font-medium">
                  {resource.name}
                </Text>
              </View>
              <Text className={`text-lg font-bold ${resource.color}`}>
                {formatValue(resource.value, resource.maxDisplayValue)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Animated.View>
  );
};

// Enhanced GameHUD component that uses floating display
interface EnhancedGameHUDProps {
  resourceManager: any;
  position?: 'top' | 'bottom';
  compact?: boolean;
  showDetailed?: boolean;
}

export const EnhancedGameHUD: React.FC<EnhancedGameHUDProps> = ({
  resourceManager,
  position = 'top',
  compact = false,
  showDetailed = true,
}) => {
  const [resources, setResources] = React.useState<Resource[]>([]);

  React.useEffect(() => {
    const updateResources = () => {
      const quantumData = resourceManager.getResource('quantumData').toNumber();
      const stellarEssence = resourceManager.getResource('stellarEssence')?.toNumber() || 0;
      const voidFragments = resourceManager.getResource('voidFragments')?.toNumber() || 0;

      const resourceList: Resource[] = [
        {
          name: 'Quantum Data',
          value: quantumData,
          icon: '⚛️',
          color: 'text-primary',
          maxDisplayValue: 999999,
        },
      ];

      // Add other resources if they exist
      if (stellarEssence > 0) {
        resourceList.push({
          name: 'Stellar Essence',
          value: stellarEssence,
          icon: '✨',
          color: 'text-accent',
          maxDisplayValue: 999999,
        });
      }

      if (voidFragments > 0) {
        resourceList.push({
          name: 'Void Fragments',
          value: voidFragments,
          icon: '🔮',
          color: 'text-secondary',
          maxDisplayValue: 999999,
        });
      }

      setResources(resourceList);
    };

    // Initial update
    updateResources();

    // Set up regular updates
    const interval = setInterval(updateResources, 1000);

    return () => clearInterval(interval);
  }, [resourceManager]);

  return (
    <FloatingResourceDisplay
      resources={resources}
      position={position}
      compact={compact}
      visible={true}
    />
  );
};