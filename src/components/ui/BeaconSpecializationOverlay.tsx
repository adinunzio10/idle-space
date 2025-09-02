import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { BaseOverlay } from './BaseOverlay';
import {
  BeaconUpgradeOption,
  BeaconSpecialization,
  SPECIALIZATION_OPTIONS,
} from '../../types/beacon';

interface BeaconSpecializationOverlayProps {
  isVisible: boolean;
  beaconId: string;
  beaconLevel: number;
  onSelectSpecialization: (
    beaconId: string,
    specialization: BeaconSpecialization
  ) => void;
  onClose: () => void;
}

export const BeaconSpecializationOverlay: React.FC<
  BeaconSpecializationOverlayProps
> = ({ isVisible, beaconId, beaconLevel, onSelectSpecialization, onClose }) => {
  const handleSelectSpecialization = (specialization: BeaconSpecialization) => {
    onSelectSpecialization(beaconId, specialization);
    onClose();
  };

  return (
    <BaseOverlay
      isVisible={isVisible}
      onClose={onClose}
      title="Beacon Specialization"
      maxHeight={600}
    >
      {/* Header Info */}
      <View className="items-center mb-6">
        <Text className="text-text/70 text-center">
          Level {beaconLevel} - Choose your beacon's specialization path
        </Text>
      </View>

      {/* Specialization Options */}
      <View className="space-y-4 mb-6">
        {SPECIALIZATION_OPTIONS.map(option => (
          <SpecializationOption
            key={option.type}
            option={option}
            onSelect={() => handleSelectSpecialization(option.type)}
          />
        ))}
      </View>

      {/* Close Button */}
      <TouchableOpacity
        className="bg-surface border border-text/20 rounded-lg py-3"
        onPress={onClose}
      >
        <Text className="text-text text-center font-semibold">
          Decide Later
        </Text>
      </TouchableOpacity>
    </BaseOverlay>
  );
};

interface SpecializationOptionProps {
  option: BeaconUpgradeOption;
  onSelect: () => void;
}

const SpecializationOption: React.FC<SpecializationOptionProps> = ({
  option,
  onSelect,
}) => {
  const getSpecializationColor = (type: BeaconSpecialization) => {
    switch (type) {
      case 'efficiency':
        return 'bg-amber-500';
      case 'range':
        return 'bg-blue-500';
      case 'stability':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getSpecializationBorderColor = (type: BeaconSpecialization) => {
    switch (type) {
      case 'efficiency':
        return 'border-amber-400';
      case 'range':
        return 'border-blue-400';
      case 'stability':
        return 'border-purple-400';
      default:
        return 'border-gray-400';
    }
  };

  return (
    <TouchableOpacity
      className={`border-2 rounded-xl p-4 ${getSpecializationBorderColor(option.type)}`}
      onPress={onSelect}
      activeOpacity={0.8}
    >
      <View className="flex-row items-start space-x-4">
        {/* Icon */}
        <View
          className={`w-12 h-12 rounded-xl ${getSpecializationColor(option.type)} items-center justify-center`}
        >
          <Text className="text-white text-2xl">{option.icon}</Text>
        </View>

        {/* Content */}
        <View className="flex-1">
          <Text className="text-text text-lg font-bold mb-1">
            {option.name}
          </Text>
          <Text className="text-text/70 text-sm mb-2">
            {option.description}
          </Text>

          {/* Bonus Details */}
          <View className="flex-row flex-wrap gap-2">
            {option.bonus.efficiency > 1 && (
              <View className="bg-amber-500/20 rounded-md px-2 py-1">
                <Text className="text-amber-400 text-xs font-medium">
                  +{Math.round((option.bonus.efficiency - 1) * 100)}% Generation
                </Text>
              </View>
            )}
            {option.bonus.range > 1 && (
              <View className="bg-blue-500/20 rounded-md px-2 py-1">
                <Text className="text-blue-400 text-xs font-medium">
                  +{Math.round((option.bonus.range - 1) * 100)}% Range
                </Text>
              </View>
            )}
            {option.bonus.stability > 1 && (
              <View className="bg-purple-500/20 rounded-md px-2 py-1">
                <Text className="text-purple-400 text-xs font-medium">
                  +{Math.round((option.bonus.stability - 1) * 100)}% Pattern
                  Bonus
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default BeaconSpecializationOverlay;
