import React, { useEffect, useState } from 'react';
import { View, Text, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ResourceManager, ResourceState } from '../../core/ResourceManager';
import { useSettingsFormatter } from '../../hooks/useSettingsFormatter';
import {
  AccessibilityHelper,
  AccessibilityRoles,
} from '../../utils/accessibility';

interface GameHUDProps {
  resourceManager: ResourceManager;
  showDetailed?: boolean;
}

interface FormattedResource {
  name: string;
  displayName: string;
  value: string;
  color: string;
  shortName: string;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  resourceManager,
  showDetailed = false,
}) => {
  const [resources, setResources] = useState<ResourceState>(
    resourceManager.getResources()
  );
  const formatter = useSettingsFormatter();
  const insets = useSafeAreaInsets();
  const screenData = Dimensions.get('window');
  const isSmallScreen = screenData.width < 375; // iPhone SE and below

  useEffect(() => {
    const handleResourceChange = (newResources: ResourceState) => {
      setResources(newResources);
    };

    resourceManager.setOnResourceChange(handleResourceChange);
    setResources(resourceManager.getResources());

    return () => {
      // Clean up callback - ResourceManager doesn't have removeCallback method yet
      // We'll rely on component unmounting to stop updates
    };
  }, [resourceManager]);

  const formatResource = (value: number): string => {
    return formatter.format(value, { useShortNotation: true, precision: 2 });
  };

  const getFormattedResources = (): FormattedResource[] => {
    return [
      {
        name: 'quantumData',
        displayName: 'Quantum Data',
        value: formatResource(resources.quantumData.toNumber()),
        color: 'text-primary',
        shortName: 'QD',
      },
      {
        name: 'stellarEssence',
        displayName: 'Stellar Essence',
        value: formatResource(resources.stellarEssence.toNumber()),
        color: 'text-secondary',
        shortName: 'SE',
      },
      {
        name: 'voidFragments',
        displayName: 'Void Fragments',
        value: formatResource(resources.voidFragments.toNumber()),
        color: 'text-accent',
        shortName: 'VF',
      },
      {
        name: 'resonanceCrystals',
        displayName: 'Resonance Crystals',
        value: formatResource(resources.resonanceCrystals.toNumber()),
        color: 'text-blue-400',
        shortName: 'RC',
      },
      {
        name: 'chronosParticles',
        displayName: 'Chronos Particles',
        value: formatResource(resources.chronosParticles.toNumber()),
        color: 'text-pink-400',
        shortName: 'CP',
      },
    ];
  };

  const formattedResources = getFormattedResources();
  const visibleResources = formattedResources.filter(resource => {
    const value = resources[resource.name as keyof ResourceState];
    const numericValue = typeof value === 'number' ? value : value.toNumber();
    return resource.name === 'quantumData' || numericValue > 0;
  });

  if (showDetailed) {
    return (
      <View
        className="bg-surface/95 backdrop-blur-sm border-b border-text/10"
        style={{ paddingTop: insets.top + 12, paddingBottom: 12 }}
        {...AccessibilityHelper.getAccessibilityProps({
          role: AccessibilityRoles.HEADER,
          label: 'Resource Dashboard',
          hint: 'Shows current resource amounts',
          liveRegion: 'polite',
        })}
      >
        <View className="px-4">
          <View className="flex-row flex-wrap justify-between">
            {visibleResources.map(resource => {
              const accessibilityLabel =
                AccessibilityHelper.describeGameElement('resource', {
                  name: resource.displayName,
                  amount: resource.value,
                  rate: null,
                });

              return (
                <View
                  key={resource.name}
                  className="mb-2 min-w-[30%]"
                  {...AccessibilityHelper.getAccessibilityProps({
                    role: AccessibilityRoles.TEXT,
                    label: accessibilityLabel,
                  })}
                >
                  <Text className="text-text/60 text-xs font-medium">
                    {resource.displayName}
                  </Text>
                  <Text
                    className={`${resource.color} text-sm font-bold`}
                    {...AccessibilityHelper.getAccessibilityProps({
                      role: AccessibilityRoles.TEXT,
                      label: `${resource.displayName}: ${resource.value}`,
                    })}
                  >
                    {resource.value}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
  }

  // Compact HUD for one-handed use
  const compactResourcesText = visibleResources
    .slice(0, isSmallScreen ? 3 : 5)
    .map(r => `${r.displayName}: ${r.value}`)
    .join(', ');

  return (
    <View
      className="bg-surface/95 backdrop-blur-sm border-b border-text/10"
      style={{ paddingTop: insets.top + 8, paddingBottom: 8 }}
      {...AccessibilityHelper.getAccessibilityProps({
        role: AccessibilityRoles.HEADER,
        label: `Compact Resource HUD: ${compactResourcesText}`,
        hint: 'Shows abbreviated resource amounts',
        liveRegion: 'polite',
      })}
    >
      <View className="px-4">
        <View
          className={`flex-row ${isSmallScreen ? 'justify-between' : 'justify-around'} items-center`}
        >
          {visibleResources.slice(0, isSmallScreen ? 3 : 5).map(resource => (
            <View
              key={resource.name}
              className="flex-row items-center"
              {...AccessibilityHelper.getAccessibilityProps({
                role: AccessibilityRoles.TEXT,
                label: `${resource.displayName}: ${resource.value}`,
              })}
            >
              <View className="items-center">
                <Text
                  className="text-text/60 text-xs font-medium"
                  importantForAccessibility="no"
                >
                  {resource.shortName}
                </Text>
                <Text
                  className={`${resource.color} text-sm font-bold`}
                  importantForAccessibility="no"
                >
                  {resource.value}
                </Text>
              </View>
            </View>
          ))}

          {visibleResources.length > (isSmallScreen ? 3 : 5) && (
            <View
              className="items-center"
              {...AccessibilityHelper.getAccessibilityProps({
                role: AccessibilityRoles.TEXT,
                label: `${visibleResources.length - (isSmallScreen ? 3 : 5)} more resources available in detailed view`,
              })}
            >
              <Text
                className="text-text/60 text-xs font-medium"
                importantForAccessibility="no"
              >
                +{visibleResources.length - (isSmallScreen ? 3 : 5)}
              </Text>
              <Text
                className="text-text/40 text-xs"
                importantForAccessibility="no"
              >
                more
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};
