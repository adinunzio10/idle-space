import React, { memo, useMemo, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, Dimensions, ScrollView } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  interpolate,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

import {
  PatternSuggestion,
  PatternCompletionAnalysis,
  SuggestionInteractionEvent,
} from '../../types/spatialHashing';
import { PatternType } from '../../types/galaxy';
import {
  DEFAULT_PLACEMENT_HINT_CONFIG,
  SPATIAL_ANIMATION_CONFIG,
} from '../../constants/spatialHashing';
import { PATTERN_COLORS } from '../../constants/patterns';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface PlacementHintSystemProps {
  analysis: PatternCompletionAnalysis | null;
  isVisible: boolean;
  maxHints?: number;
  onHintPress?: (suggestion: PatternSuggestion) => void;
  onSuggestionInteraction?: (event: SuggestionInteractionEvent) => void;
  onClose?: () => void;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'floating';
  enableAnimations?: boolean;
}

export const PlacementHintSystem: React.FC<PlacementHintSystemProps> = memo(({
  analysis,
  isVisible,
  maxHints = DEFAULT_PLACEMENT_HINT_CONFIG.maxHints,
  onHintPress,
  onSuggestionInteraction,
  onClose,
  position = 'top',
  enableAnimations = true,
}) => {
  // Filter and prioritize suggestions (show all, no limit)
  const displayedHints = useMemo(() => {
    if (!analysis || !analysis.suggestedPositions) return [];
    
    return analysis.suggestedPositions
      .filter(s => s.potentialBonus >= DEFAULT_PLACEMENT_HINT_CONFIG.minBonusThreshold)
      .sort((a, b) => b.priority - a.priority);
  }, [analysis]);

  // Animation value for container visibility
  const containerAnimation = useSharedValue(0);

  useEffect(() => {
    if (enableAnimations) {
      containerAnimation.value = withTiming(isVisible ? 1 : 0, {
        duration: SPATIAL_ANIMATION_CONFIG.HINT_CARD_SLIDE_DURATION,
        easing: Easing.out(Easing.quad),
      });
    } else {
      containerAnimation.value = isVisible ? 1 : 0;
    }
  }, [isVisible, enableAnimations, containerAnimation]);

  // Container animation style
  const containerAnimatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      containerAnimation.value,
      [0, 1],
      [position === 'top' ? -100 : position === 'bottom' ? 100 : 0, 0]
    );

    return {
      opacity: containerAnimation.value,
      transform: [{ translateY }],
    };
  });

  if (!isVisible || displayedHints.length === 0) {
    return null;
  }

  return (
    <Animated.View style={[
      styles.container,
      styles[`container_${position}`],
      containerAnimatedStyle,
    ]}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Pattern Opportunities</Text>
            <Text style={styles.headerSubtitle}>
              {analysis?.totalPotentialBonus ? 
                `+${analysis.totalPotentialBonus.toFixed(1)}× total bonus potential` : 
                'Complete patterns for bonus multipliers'
              }
            </Text>
          </View>
          {onClose && (
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      <ScrollView 
        style={styles.hintsContainer}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
      >
        {displayedHints.map((hint, index) => (
          <HintCard
            key={hint.id}
            suggestion={hint}
            index={index}
            enableAnimations={enableAnimations}
            onPress={() => {
              onHintPress?.(hint);
              onSuggestionInteraction?.({
                type: 'select',
                suggestion: hint,
                position: hint.suggestedPosition,
                timestamp: Date.now(),
              });
            }}
          />
        ))}
      </ScrollView>
    </Animated.View>
  );
});

PlacementHintSystem.displayName = 'PlacementHintSystem';

/**
 * Individual hint card component
 */
interface HintCardProps {
  suggestion: PatternSuggestion;
  index: number;
  enableAnimations: boolean;
  onPress: () => void;
}

const HintCard: React.FC<HintCardProps> = memo(({
  suggestion,
  index,
  enableAnimations,
  onPress,
}) => {
  const cardAnimation = useSharedValue(0);
  const pressAnimation = useSharedValue(0);

  // Staggered entrance animation
  useEffect(() => {
    if (enableAnimations) {
      const delay = index * 100; // Stagger by 100ms
      cardAnimation.value = withDelay(delay, withSpring(1, {
        damping: SPATIAL_ANIMATION_CONFIG.HINT_CARD_SPRING_CONFIG.damping,
        stiffness: SPATIAL_ANIMATION_CONFIG.HINT_CARD_SPRING_CONFIG.stiffness,
      }));
    } else {
      cardAnimation.value = 1;
    }
  }, [index, enableAnimations, cardAnimation]);

  const cardAnimatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(cardAnimation.value, [0, 1], [0.8, 1]);
    const pressScale = interpolate(pressAnimation.value, [0, 1], [1, 0.95]);
    
    return {
      opacity: cardAnimation.value,
      transform: [{ scale: scale * pressScale }],
    };
  });

  const handlePressIn = useCallback(() => {
    if (enableAnimations) {
      pressAnimation.value = withTiming(1, { duration: 100 });
    }
  }, [enableAnimations, pressAnimation]);

  const handlePressOut = useCallback(() => {
    if (enableAnimations) {
      pressAnimation.value = withTiming(0, { duration: 100 });
    }
  }, [enableAnimations, pressAnimation]);

  const patternColor = PATTERN_COLORS[suggestion.type];
  const patternName = getPatternDisplayName(suggestion.type);

  return (
    <Animated.View style={[styles.hintCard, cardAnimatedStyle]}>
      <TouchableOpacity
        style={[styles.hintCardTouchable, { borderLeftColor: patternColor.stroke }]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.8}
      >
        <View style={styles.hintCardHeader}>
          <View style={[styles.patternIcon, { backgroundColor: patternColor.fill }]}>
            <Text style={styles.patternIconText}>{getPatternIcon(suggestion.type)}</Text>
          </View>
          
          <View style={styles.hintCardInfo}>
            <Text style={styles.hintCardTitle}>Complete {patternName}</Text>
            <Text style={styles.hintCardSubtitle}>
              {suggestion.requiredBeacons.length} beacon{suggestion.requiredBeacons.length !== 1 ? 's' : ''} needed
            </Text>
          </View>
          
          <View style={styles.bonusDisplay}>
            <Text style={styles.bonusValue}>+{suggestion.potentialBonus.toFixed(1)}×</Text>
            <Text style={styles.bonusLabel}>bonus</Text>
          </View>
        </View>
        
        <View style={styles.hintCardMetrics}>
          <MetricBadge
            label="Priority"
            value={Math.round(suggestion.priority * 100)}
            suffix="%"
            color="#10B981"
          />
          <MetricBadge
            label="Progress"
            value={Math.round(suggestion.completionPercentage * 100)}
            suffix="%"
            color="#3B82F6"
          />
          <MetricBadge
            label="Value"
            value={suggestion.estimatedValue.toFixed(1)}
            suffix="×"
            color="#F59E0B"
          />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

HintCard.displayName = 'HintCard';

/**
 * Metric badge component
 */
interface MetricBadgeProps {
  label: string;
  value: number | string;
  suffix?: string;
  color: string;
}

const MetricBadge: React.FC<MetricBadgeProps> = memo(({
  label,
  value,
  suffix = '',
  color,
}) => (
  <View style={[styles.metricBadge, { borderColor: color }]}>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={[styles.metricValue, { color }]}>
      {value}{suffix}
    </Text>
  </View>
));

MetricBadge.displayName = 'MetricBadge';

/**
 * Helper functions
 */
function getPatternDisplayName(type: PatternType): string {
  switch (type) {
    case 'triangle': return 'Triangle';
    case 'square': return 'Square';
    case 'pentagon': return 'Pentagon';
    case 'hexagon': return 'Hexagon';
    default: return 'Pattern';
  }
}

function getPatternIcon(type: PatternType): string {
  switch (type) {
    case 'triangle': return '△';
    case 'square': return '□';
    case 'pentagon': return '⬟';
    case 'hexagon': return '⬡';
    default: return '●';
  }
}

/**
 * Styles
 */
const styles = {
  container: {
    position: 'absolute' as const,
    backgroundColor: 'rgba(17, 24, 39, 0.95)',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    maxWidth: Math.min(screenWidth - 32, 400),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },

  container_top: {
    top: 60,
    left: 0,
    right: 0,
    marginHorizontal: 16,
  },

  container_bottom: {
    bottom: 80,
    left: 0,
    right: 0,
    marginHorizontal: 16,
  },

  container_left: {
    left: 16,
    top: '50%' as any,
    transform: [{ translateY: -150 }] as any,
  },

  container_right: {
    right: 16,
    top: '50%' as any,
    transform: [{ translateY: -150 }] as any,
  },

  container_floating: {
    top: 100,
    right: 16,
  },

  header: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
    paddingBottom: 12,
  },

  headerContent: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
  },

  headerText: {
    flex: 1,
    marginRight: 12,
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as any,
    color: '#F9FAFB',
    marginBottom: 4,
  },

  headerSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
  },

  closeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(107, 114, 128, 0.3)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },

  closeButtonText: {
    fontSize: 16,
    color: '#9CA3AF',
    fontWeight: 'bold' as any,
  },

  hintsContainer: {
    maxHeight: 300,
  },

  hintCard: {
    position: 'relative' as const,
    marginBottom: 12,
  },

  hintCardTouchable: {
    backgroundColor: '#1F2937',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
    borderLeftWidth: 4,
    padding: 12,
  },

  hintCardHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
  },

  patternIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginRight: 12,
  },

  patternIconText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold' as any,
  },

  hintCardInfo: {
    flex: 1,
  },

  hintCardTitle: {
    fontSize: 16,
    fontWeight: '600' as any,
    color: '#F9FAFB',
    marginBottom: 2,
  },

  hintCardSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
  },

  bonusDisplay: {
    alignItems: 'center' as const,
  },

  bonusValue: {
    fontSize: 20,
    fontWeight: 'bold' as any,
    color: '#FDE047',
    marginBottom: 2,
  },

  bonusLabel: {
    fontSize: 12,
    color: '#9CA3AF',
  },

  hintCardMetrics: {
    flexDirection: 'row' as const,
    justifyContent: 'space-around' as const,
    gap: 8,
  },

  metricBadge: {
    flex: 1,
    alignItems: 'center' as const,
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: 'rgba(55, 65, 81, 0.5)',
  },

  metricLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    marginBottom: 2,
    textTransform: 'uppercase' as const,
  },

  metricValue: {
    fontSize: 14,
    fontWeight: '600' as any,
  },
};

export default PlacementHintSystem;