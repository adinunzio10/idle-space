import React from 'react';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RESOURCE_DEFINITIONS, ResourceType } from '../../types/resources';
import { Resources } from '../../storage/schemas/GameState';
import { NumberFormatter } from '../../utils/NumberFormatter';

interface ResourceHUDProps {
  resources: Resources;
  variant?: 'full' | 'compact';
}

export const ResourceHUD: React.FC<ResourceHUDProps> = ({ 
  resources, 
  variant = 'full' 
}) => {
  const insets = useSafeAreaInsets();

  const formatResourceValue = (value: number) => {
    return NumberFormatter.formatResource(value);
  };

  const primaryResources: Array<keyof Resources> = ['quantumData', 'stellarEssence', 'voidFragments'];
  const displayResources = variant === 'compact' ? ['quantumData'] : primaryResources;

  return (
    <View 
      className="bg-surface/95 border-b border-text/10"
      style={{ paddingTop: insets.top + 8, paddingBottom: 8 }}
    >
      <View className="flex-row justify-center items-center px-4">
        {displayResources.map((resourceType, index) => {
          const definition = RESOURCE_DEFINITIONS[resourceType as ResourceType];
          const value = resources[resourceType as keyof Resources] || 0;
          
          return (
            <View key={resourceType} className="flex-row items-center">
              {index > 0 && <View className="w-px h-4 bg-text/20 mx-3" />}
              <View className="flex-row items-center space-x-1">
                <Text className="text-sm">{definition.icon}</Text>
                <Text 
                  className="text-text font-semibold text-sm"
                  style={{ color: definition.color }}
                >
                  {formatResourceValue(value)}
                </Text>
                <Text className="text-text/60 text-xs">
                  {definition.shortName}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};