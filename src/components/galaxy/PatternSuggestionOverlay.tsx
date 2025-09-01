import React, { memo, useMemo, useCallback, useEffect } from 'react';
import {
  Circle,
  Path,
  Polygon,
  Text as SvgText,
  Rect,
  Defs,
  LinearGradient,
  Stop,
  G,
  Line,
} from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  interpolate,
  Easing,
} from 'react-native-reanimated';

import { Beacon, ViewportState, PatternType } from '../../types/galaxy';
import {
  PatternSuggestion,
  PatternSuggestionState,
  SuggestionInteractionEvent,
} from '../../types/spatialHashing';
import {
  DEFAULT_PLACEMENT_HINT_CONFIG,
  SPATIAL_ANIMATION_CONFIG,
} from '../../constants/spatialHashing';
import { PATTERN_COLORS } from '../../constants/patterns';
import { galaxyToScreen } from '../../utils/spatial/viewport';

// Animated SVG components
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);
const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

interface PatternSuggestionOverlayProps {
  suggestions: PatternSuggestion[];
  beacons: Beacon[];
  viewportState: ViewportState;
  suggestionState: PatternSuggestionState;
  onSuggestionInteraction?: (event: SuggestionInteractionEvent) => void;
  showGhostBeacons?: boolean;
  showPatternPreviews?: boolean;
  enableAnimations?: boolean;
}

// Custom comparison function to optimize re-renders
const PatternSuggestionOverlayPropsAreEqual = (
  prevProps: PatternSuggestionOverlayProps,
  nextProps: PatternSuggestionOverlayProps
): boolean => {
  // Quick reference equality checks first
  if (
    prevProps.showGhostBeacons !== nextProps.showGhostBeacons ||
    prevProps.showPatternPreviews !== nextProps.showPatternPreviews ||
    prevProps.enableAnimations !== nextProps.enableAnimations ||
    prevProps.onSuggestionInteraction !== nextProps.onSuggestionInteraction
  ) {
    return false;
  }

  // Compare viewport state (only essential properties)
  const prevViewport = prevProps.viewportState;
  const nextViewport = nextProps.viewportState;
  if (
    Math.abs(prevViewport.scale - nextViewport.scale) > 0.01 ||
    Math.abs(prevViewport.translateX - nextViewport.translateX) > 5 ||
    Math.abs(prevViewport.translateY - nextViewport.translateY) > 5
  ) {
    return false;
  }

  // Compare suggestion state
  const prevSuggestionState = prevProps.suggestionState;
  const nextSuggestionState = nextProps.suggestionState;
  if (
    prevSuggestionState.popupVisible !== nextSuggestionState.popupVisible ||
    prevSuggestionState.mapVisualizationsVisible !== nextSuggestionState.mapVisualizationsVisible ||
    prevSuggestionState.displayMode !== nextSuggestionState.displayMode ||
    prevSuggestionState.selectedSuggestion?.id !== nextSuggestionState.selectedSuggestion?.id ||
    prevSuggestionState.hoveredSuggestion?.id !== nextSuggestionState.hoveredSuggestion?.id
  ) {
    return false;
  }

  // Compare suggestions array (by IDs and essential properties)
  if (prevProps.suggestions.length !== nextProps.suggestions.length) {
    return false;
  }
  
  for (let i = 0; i < prevProps.suggestions.length; i++) {
    const prev = prevProps.suggestions[i];
    const next = nextProps.suggestions[i];
    if (
      prev.id !== next.id ||
      prev.priority !== next.priority ||
      prev.potentialBonus !== next.potentialBonus ||
      prev.suggestedPosition.x !== next.suggestedPosition.x ||
      prev.suggestedPosition.y !== next.suggestedPosition.y
    ) {
      return false;
    }
  }

  // Skip deep comparison of beacons array - suggestions comparison is more relevant
  // Only check if the number of beacons changed significantly
  if (Math.abs(prevProps.beacons.length - nextProps.beacons.length) > 0) {
    return false;
  }

  return true;
};

export const PatternSuggestionOverlay: React.FC<PatternSuggestionOverlayProps> = memo(({
  suggestions,
  beacons,
  viewportState,
  suggestionState,
  onSuggestionInteraction,
  showGhostBeacons = true,
  showPatternPreviews = true,
  enableAnimations = true,
}) => {
  // Filter suggestions based on display mode and visibility
  const visibleSuggestions = useMemo(() => {
    if (!suggestionState.mapVisualizationsVisible) return [];
    
    let filtered = suggestions.filter(s => 
      !suggestionState.dismissedSuggestions.has(s.id)
    );
    
    switch (suggestionState.displayMode) {
      case 'best':
        filtered = filtered.slice(0, 3);
        break;
      case 'high-value':
        filtered = filtered.filter(s => s.potentialBonus >= 2);
        break;
      case 'near-cursor':
        // Would filter by cursor position in real implementation
        break;
      case 'all':
      default:
        filtered = filtered.slice(0, DEFAULT_PLACEMENT_HINT_CONFIG.maxHints);
        break;
    }
    
    return filtered;
  }, [suggestions, suggestionState.mapVisualizationsVisible, suggestionState.dismissedSuggestions, suggestionState.displayMode]);

  // Handle suggestion interaction
  const handleSuggestionPress = useCallback((suggestion: PatternSuggestion) => {
    if (onSuggestionInteraction) {
      onSuggestionInteraction({
        type: 'select',
        suggestion,
        position: suggestion.suggestedPosition,
        timestamp: Date.now(),
      });
    }
  }, [onSuggestionInteraction]);

  const handleSuggestionHover = useCallback((suggestion: PatternSuggestion) => {
    if (onSuggestionInteraction) {
      onSuggestionInteraction({
        type: 'hover',
        suggestion,
        position: suggestion.suggestedPosition,
        timestamp: Date.now(),
      });
    }
  }, [onSuggestionInteraction]);

  if (!suggestionState.mapVisualizationsVisible || visibleSuggestions.length === 0) {
    return null;
  }

  return (
    <G>
      <Defs>
        {/* Ghost beacon gradients */}
        <LinearGradient id="ghost-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#6B7280" stopOpacity="0.6" />
          <Stop offset="100%" stopColor="#9CA3AF" stopOpacity="0.2" />
        </LinearGradient>
        
        {/* Pattern preview gradients */}
        {Object.entries(PATTERN_COLORS).map(([patternType, colors]) => (
          <LinearGradient
            key={`pattern-preview-${patternType}`}
            id={`pattern-preview-${patternType}`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <Stop offset="0%" stopColor={colors.fill} stopOpacity="0.3" />
            <Stop offset="100%" stopColor={colors.stroke} stopOpacity="0.1" />
          </LinearGradient>
        ))}
        
        {/* Highlight gradient */}
        <LinearGradient id="highlight-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#FDE047" stopOpacity="0.8" />
          <Stop offset="100%" stopColor="#FACC15" stopOpacity="0.4" />
        </LinearGradient>
      </Defs>

      {visibleSuggestions.map((suggestion) => (
        <SuggestionVisualization
          key={suggestion.id}
          suggestion={suggestion}
          beacons={beacons}
          viewportState={viewportState}
          isSelected={suggestionState.selectedSuggestion?.id === suggestion.id}
          isHovered={suggestionState.hoveredSuggestion?.id === suggestion.id}
          showGhostBeacon={showGhostBeacons}
          showPatternPreview={showPatternPreviews}
          enableAnimations={enableAnimations}
          onPress={() => handleSuggestionPress(suggestion)}
          onHover={() => handleSuggestionHover(suggestion)}
        />
      ))}
    </G>
  );
}, PatternSuggestionOverlayPropsAreEqual);

PatternSuggestionOverlay.displayName = 'PatternSuggestionOverlay';

/**
 * Individual suggestion visualization component
 */
interface SuggestionVisualizationProps {
  suggestion: PatternSuggestion;
  beacons: Beacon[];
  viewportState: ViewportState;
  isSelected: boolean;
  isHovered: boolean;
  showGhostBeacon: boolean;
  showPatternPreview: boolean;
  enableAnimations: boolean;
  onPress: () => void;
  onHover: () => void;
}

const SuggestionVisualization: React.FC<SuggestionVisualizationProps> = memo(({
  suggestion,
  beacons,
  viewportState,
  isSelected,
  isHovered,
  showGhostBeacon,
  showPatternPreview,
  enableAnimations,
  onPress,
  onHover,
}) => {
  // Animation values
  const appearProgress = useSharedValue(0);
  const pulseProgress = useSharedValue(0);
  const highlightProgress = useSharedValue(0);

  // Initialize animations
  useEffect(() => {
    if (enableAnimations) {
      // Appear animation
      appearProgress.value = withTiming(1, {
        duration: SPATIAL_ANIMATION_CONFIG.SUGGESTION_APPEAR_DURATION,
        easing: Easing.out(Easing.quad),
      });

      // Pulse animation
      pulseProgress.value = withRepeat(
        withSequence(
          withTiming(1, {
            duration: SPATIAL_ANIMATION_CONFIG.GHOST_PULSE_DURATION / 2,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(0, {
            duration: SPATIAL_ANIMATION_CONFIG.GHOST_PULSE_DURATION / 2,
            easing: Easing.inOut(Easing.sin),
          })
        ),
        -1,
        false
      );
    } else {
      appearProgress.value = 1;
    }
  }, [enableAnimations, appearProgress, pulseProgress]);

  // Highlight animation for hover/selection
  useEffect(() => {
    if (enableAnimations) {
      if (isSelected || isHovered) {
        highlightProgress.value = withRepeat(
          withSequence(
            withTiming(1, {
              duration: SPATIAL_ANIMATION_CONFIG.HIGHLIGHT_PULSE_DURATION / 2,
              easing: Easing.inOut(Easing.sin),
            }),
            withTiming(0.3, {
              duration: SPATIAL_ANIMATION_CONFIG.HIGHLIGHT_PULSE_DURATION / 2,
              easing: Easing.inOut(Easing.sin),
            })
          ),
          -1,
          false
        );
      } else {
        highlightProgress.value = withTiming(0, {
          duration: 300,
          easing: Easing.out(Easing.quad),
        });
      }
    }
  }, [isSelected, isHovered, enableAnimations, highlightProgress]);

  // Convert positions to screen coordinates
  const screenPosition = useMemo(() => 
    galaxyToScreen(suggestion.suggestedPosition, viewportState),
    [suggestion.suggestedPosition, viewportState]
  );

  const requiredBeaconScreenPositions = useMemo(() => {
    return suggestion.requiredBeacons.map(beaconId => {
      const beacon = beacons.find(b => b.id === beaconId);
      return beacon ? galaxyToScreen(beacon.position, viewportState) : null;
    }).filter(Boolean);
  }, [suggestion.requiredBeacons, beacons, viewportState]);

  // Pattern-specific colors
  const colors = PATTERN_COLORS[suggestion.type];

  // Ghost beacon animation properties
  const animatedGhostProps = useAnimatedProps(() => {
    const scale = interpolate(
      appearProgress.value,
      [0, 1],
      [0.5, 1]
    );

    const pulseScale = interpolate(
      pulseProgress.value,
      [0, 1],
      [1, SPATIAL_ANIMATION_CONFIG.GHOST_PULSE_SCALE]
    );

    const opacity = interpolate(
      appearProgress.value,
      [0, 0.3, 1],
      [0, 0.5, DEFAULT_PLACEMENT_HINT_CONFIG.opacity.ghost]
    );

    return {
      opacity,
      transform: [{ scale: scale * pulseScale }],
    };
  });

  // Highlight animation properties
  const animatedHighlightProps = useAnimatedProps(() => {
    const intensity = interpolate(
      highlightProgress.value,
      [0, 1],
      [0, SPATIAL_ANIMATION_CONFIG.HIGHLIGHT_PULSE_INTENSITY]
    );

    return {
      opacity: intensity,
      transform: [{ scale: 1 + intensity * 0.2 }],
    };
  });

  // Generate pattern preview polygon points
  const patternPreviewPoints = useMemo(() => {
    if (!showPatternPreview) return '';

    const allPositions = [
      screenPosition,
      ...requiredBeaconScreenPositions as { x: number; y: number }[]
    ];

    if (allPositions.length < 3) return '';

    return allPositions.map(pos => `${pos.x},${pos.y}`).join(' ');
  }, [showPatternPreview, screenPosition, requiredBeaconScreenPositions]);

  return (
    <G onPress={onPress}>
      {/* Pattern preview shape */}
      {showPatternPreview && patternPreviewPoints && (
        <AnimatedPolygon
          points={patternPreviewPoints}
          fill={`url(#pattern-preview-${suggestion.type})`}
          stroke={colors.stroke}
          strokeWidth="1"
          strokeOpacity="0.5"
          strokeDasharray="3,3"
        />
      )}

      {/* Connection lines to required beacons */}
      {requiredBeaconScreenPositions.map((beaconPos, index) => (
        <Line
          key={index}
          x1={screenPosition.x}
          y1={screenPosition.y}
          x2={beaconPos!.x}
          y2={beaconPos!.y}
          stroke={colors.stroke}
          strokeWidth="1"
          strokeOpacity="0.4"
          strokeDasharray="2,4"
        />
      ))}

      {/* Highlight ring for selected/hovered suggestions */}
      {(isSelected || isHovered) && (
        <AnimatedCircle
          animatedProps={animatedHighlightProps}
          cx={screenPosition.x}
          cy={screenPosition.y}
          r="25"
          fill="url(#highlight-gradient)"
        />
      )}

      {/* Ghost beacon */}
      {showGhostBeacon && (
        <AnimatedCircle
          animatedProps={animatedGhostProps}
          cx={screenPosition.x}
          cy={screenPosition.y}
          r="15"
          fill="url(#ghost-gradient)"
          stroke={colors.stroke}
          strokeWidth="2"
          strokeOpacity="0.6"
          strokeDasharray="4,4"
        />
      )}

      {/* Bonus indicator */}
      <BonusIndicator
        position={screenPosition}
        suggestion={suggestion}
        isVisible={isSelected || isHovered}
        enableAnimations={enableAnimations}
      />

      {/* Priority indicator (small dot) */}
      <Circle
        cx={screenPosition.x + 12}
        cy={screenPosition.y - 12}
        r={Math.max(2, suggestion.priority * 3)}
        fill={colors.fillActive}
        opacity="0.8"
      />
    </G>
  );
});

SuggestionVisualization.displayName = 'SuggestionVisualization';

/**
 * Bonus indicator component showing potential bonus value
 */
interface BonusIndicatorProps {
  position: { x: number; y: number };
  suggestion: PatternSuggestion;
  isVisible: boolean;
  enableAnimations: boolean;
}

const BonusIndicator: React.FC<BonusIndicatorProps> = memo(({
  position,
  suggestion,
  isVisible,
  enableAnimations,
}) => {
  const fadeProgress = useSharedValue(0);

  useEffect(() => {
    if (enableAnimations) {
      fadeProgress.value = withTiming(isVisible ? 1 : 0, {
        duration: SPATIAL_ANIMATION_CONFIG.PREVIEW_FADE_DURATION,
        easing: Easing.inOut(Easing.quad),
      });
    } else {
      fadeProgress.value = isVisible ? 1 : 0;
    }
  }, [isVisible, enableAnimations, fadeProgress]);

  const animatedProps = useAnimatedProps(() => ({
    opacity: fadeProgress.value,
    transform: [{ 
      translateY: interpolate(fadeProgress.value, [0, 1], [10, 0]) 
    }],
  }));

  if (!isVisible) return null;

  const bonusText = `+${suggestion.potentialBonus.toFixed(1)}×`;
  const completionText = `${Math.round(suggestion.completionPercentage * 100)}%`;

  return (
    <AnimatedG
      animatedProps={animatedProps}
      transform={`translate(${position.x + 20}, ${position.y - 25})`}
    >
      {/* Background */}
      <AnimatedRect
        x="-15"
        y="-12"
        width="30"
        height="24"
        rx="4"
        ry="4"
        fill="#1F2937"
        opacity="0.9"
        stroke="#374151"
        strokeWidth="1"
      />
      
      {/* Bonus text */}
      <SvgText
        x="0"
        y="-2"
        fontSize="10"
        fontWeight="600"
        textAnchor="middle"
        fill="#FDE047"
      >
        {bonusText}
      </SvgText>
      
      {/* Completion percentage */}
      <SvgText
        x="0"
        y="8"
        fontSize="8"
        textAnchor="middle"
        fill="#9CA3AF"
      >
        {completionText}
      </SvgText>
    </AnimatedG>
  );
});

BonusIndicator.displayName = 'BonusIndicator';

/**
 * Hook for managing pattern suggestion state
 */
export const usePatternSuggestionState = (
  initialState: Partial<PatternSuggestionState> = {}
): [PatternSuggestionState, {
  showPopup: () => void;
  hidePopup: () => void;
  showMapVisualizations: () => void;
  hideMapVisualizations: () => void;
  toggleMapVisualizations: () => void;
  selectSuggestion: (suggestion: PatternSuggestion | null) => void;
  hoverSuggestion: (suggestion: PatternSuggestion | null) => void;
  dismissSuggestion: (suggestionId: string) => void;
  setDisplayMode: (mode: PatternSuggestionState['displayMode']) => void;
}] => {
  const [state, setState] = React.useState<PatternSuggestionState>({
    popupVisible: true,
    mapVisualizationsVisible: true,
    selectedSuggestion: null,
    hoveredSuggestion: null,
    dismissedSuggestions: new Set(),
    autoHideTimer: null,
    displayMode: 'all',
    ...initialState,
  });

  const actions = useMemo(() => ({
    showPopup: () => setState(s => ({ ...s, popupVisible: true })),
    hidePopup: () => setState(s => ({ ...s, popupVisible: false })),
    showMapVisualizations: () => setState(s => ({ ...s, mapVisualizationsVisible: true })),
    hideMapVisualizations: () => setState(s => ({ ...s, mapVisualizationsVisible: false })),
    toggleMapVisualizations: () => setState(s => ({ ...s, mapVisualizationsVisible: !s.mapVisualizationsVisible })),
    selectSuggestion: (suggestion: PatternSuggestion | null) => 
      setState(s => ({ ...s, selectedSuggestion: suggestion })),
    hoverSuggestion: (suggestion: PatternSuggestion | null) => 
      setState(s => ({ ...s, hoveredSuggestion: suggestion })),
    dismissSuggestion: (suggestionId: string) => 
      setState(s => ({ 
        ...s, 
        dismissedSuggestions: new Set([...s.dismissedSuggestions, suggestionId]) 
      })),
    setDisplayMode: (mode: PatternSuggestionState['displayMode']) => 
      setState(s => ({ ...s, displayMode: mode })),
  }), []);

  return [state, actions];
};

export default PatternSuggestionOverlay;