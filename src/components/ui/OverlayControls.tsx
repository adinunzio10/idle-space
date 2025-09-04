/**
 * OverlayControls Component - Visual Galaxy Sector Overlay Control Panel
 * 
 * Interactive UI component providing toggle controls for sector overlay visualization.
 * Features smooth transitions, performance settings, and integration with SectorOverlayManager.
 * Includes controls for boundaries, sector states, entropy effects, and harvestable resources.
 */

import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { 
  OverlayConfiguration, 
  OverlayControls as OverlayControlsType,
} from '../../utils/galaxy/SectorOverlayManager';

interface OverlayControlsProps {
  /** Current overlay configuration */
  configuration: OverlayConfiguration;
  /** Overlay control functions */
  controls: OverlayControlsType;
  /** Position on screen */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /** Whether the control panel is expanded */
  isExpanded?: boolean;
  /** Callback when expand state changes */
  onExpandChange?: (expanded: boolean) => void;
  /** Compact mode for smaller screens */
  compactMode?: boolean;
  /** Show performance indicators */
  showPerformanceInfo?: boolean;
  /** Performance statistics for display */
  performanceStats?: {
    averageFrameTime: number;
    frameRate: number;
    droppedFrames: number;
    cacheHitRate: number;
  };
  /** Custom styling */
  style?: any;
}

interface ToggleButtonProps {
  label: string;
  description: string;
  isActive: boolean;
  onToggle: () => void;
  icon?: string;
  disabled?: boolean;
  compact?: boolean;
}

interface QualitySliderProps {
  value: 'low' | 'medium' | 'high';
  onValueChange: (value: 'low' | 'medium' | 'high') => void;
  disabled?: boolean;
}

interface PerformanceIndicatorProps {
  label: string;
  value: number | string;
  unit?: string;
  status?: 'good' | 'warning' | 'critical';
  compact?: boolean;
}

// Visual configuration for overlay controls
const CONTROLS_CONFIG = {
  colors: {
    background: 'rgba(17, 24, 39, 0.95)', // Dark background with transparency
    surface: 'rgba(31, 41, 55, 0.9)',
    border: 'rgba(75, 85, 99, 0.5)',
    text: '#F9FAFB',
    textSecondary: '#D1D5DB',
    active: '#10B981', // Green for active state
    inactive: '#6B7280', // Gray for inactive
    warning: '#F59E0B', // Orange for warnings
    critical: '#EF4444', // Red for critical
    // Quality indicators
    qualityLow: '#DC2626',
    qualityMedium: '#F59E0B',
    qualityHigh: '#10B981',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
  },
  borderRadius: 8,
  iconSize: 16,
  // Animation settings
  animations: {
    spring: { damping: 20, stiffness: 300 },
    timing: { duration: 200 },
  },
} as const;

/**
 * Performance Indicator Component
 */
const PerformanceIndicator: React.FC<PerformanceIndicatorProps> = ({
  label,
  value,
  unit = '',
  status = 'good',
  compact = false,
}) => {
  const statusColor = {
    good: CONTROLS_CONFIG.colors.active,
    warning: CONTROLS_CONFIG.colors.warning,
    critical: CONTROLS_CONFIG.colors.critical,
  }[status];

  return (
    <View style={[styles.performanceIndicator, compact && styles.performanceIndicatorCompact]}>
      <Text style={[styles.performanceLabel, { color: CONTROLS_CONFIG.colors.textSecondary }]}>
        {label}
      </Text>
      <Text style={[styles.performanceValue, { color: statusColor }]}>
        {value}{unit}
      </Text>
    </View>
  );
};

/**
 * Quality Setting Slider Component
 */
const QualitySlider: React.FC<QualitySliderProps> = ({
  value,
  onValueChange,
  disabled = false,
}) => {
  const qualities = ['low', 'medium', 'high'] as const;
  const currentIndex = qualities.indexOf(value);
  
  const sliderPosition = useSharedValue(currentIndex);
  
  React.useEffect(() => {
    sliderPosition.value = withSpring(currentIndex, CONTROLS_CONFIG.animations.spring);
  }, [currentIndex, sliderPosition]);

  const animatedSliderStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sliderPosition.value * 60 }],
  }));

  return (
    <View style={[styles.qualitySlider, disabled && styles.disabled]}>
      <View style={styles.qualityTrack}>
        <Animated.View style={[styles.qualityThumb, animatedSliderStyle]} />
      </View>
      <View style={styles.qualityLabels}>
        {qualities.map((quality, index) => (
          <Pressable
            key={quality}
            style={styles.qualityLabel}
            onPress={() => !disabled && onValueChange(quality)}
            disabled={disabled}
          >
            <Text 
              style={[
                styles.qualityLabelText,
                { color: value === quality 
                  ? CONTROLS_CONFIG.colors.text 
                  : CONTROLS_CONFIG.colors.textSecondary 
                }
              ]}
            >
              {quality.charAt(0).toUpperCase() + quality.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
};

/**
 * Toggle Button Component
 */
const ToggleButton: React.FC<ToggleButtonProps> = ({
  label,
  description,
  isActive,
  onToggle,
  icon,
  disabled = false,
  compact = false,
}) => {
  const toggleScale = useSharedValue(1);
  const toggleOpacity = useSharedValue(isActive ? 1 : 0.6);
  
  React.useEffect(() => {
    toggleOpacity.value = withTiming(
      isActive ? 1 : 0.6,
      CONTROLS_CONFIG.animations.timing
    );
  }, [isActive, toggleOpacity]);

  const handlePress = () => {
    if (disabled) return;
    
    toggleScale.value = withSpring(0.95, CONTROLS_CONFIG.animations.spring, () => {
      toggleScale.value = withSpring(1, CONTROLS_CONFIG.animations.spring);
    });
    
    onToggle();
  };

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: toggleScale.value }],
    opacity: toggleOpacity.value,
  }));

  const buttonColor = isActive 
    ? CONTROLS_CONFIG.colors.active 
    : CONTROLS_CONFIG.colors.inactive;

  return (
    <Animated.View style={animatedButtonStyle}>
      <Pressable
        style={[
          styles.toggleButton,
          compact && styles.toggleButtonCompact,
          disabled && styles.disabled,
          { borderColor: buttonColor }
        ]}
        onPress={handlePress}
        disabled={disabled}
      >
        <View style={styles.toggleContent}>
          {icon && (
            <Text style={[styles.toggleIcon, { color: buttonColor }]}>
              {icon}
            </Text>
          )}
          <View style={styles.toggleText}>
            <Text style={[styles.toggleLabel, { color: CONTROLS_CONFIG.colors.text }]}>
              {label}
            </Text>
            {!compact && (
              <Text style={[styles.toggleDescription, { color: CONTROLS_CONFIG.colors.textSecondary }]}>
                {description}
              </Text>
            )}
          </View>
        </View>
        <View style={[styles.toggleIndicator, { backgroundColor: buttonColor }]} />
      </Pressable>
    </Animated.View>
  );
};

/**
 * Main Overlay Controls Component
 */
export const OverlayControls: React.FC<OverlayControlsProps> = ({
  configuration,
  controls,
  position = 'top-right',
  isExpanded: controlledExpanded,
  onExpandChange,
  compactMode = false,
  showPerformanceInfo = false,
  performanceStats,
  style,
}) => {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  
  const expansionProgress = useSharedValue(isExpanded ? 1 : 0);
  
  React.useEffect(() => {
    expansionProgress.value = withSpring(
      isExpanded ? 1 : 0,
      CONTROLS_CONFIG.animations.spring
    );
  }, [isExpanded, expansionProgress]);

  const handleExpandToggle = () => {
    const newExpanded = !isExpanded;
    if (onExpandChange) {
      onExpandChange(newExpanded);
    } else {
      setInternalExpanded(newExpanded);
    }
  };

  // Performance status calculation
  const performanceStatus = useMemo(() => {
    if (!performanceStats) return 'good';
    
    if (performanceStats.frameRate < 30 || performanceStats.droppedFrames > 10) {
      return 'critical';
    } else if (performanceStats.frameRate < 45 || performanceStats.droppedFrames > 5) {
      return 'warning';
    }
    return 'good';
  }, [performanceStats]);

  // Animated styles
  const animatedContainerStyle = useAnimatedStyle(() => ({
    transform: [
      { 
        scale: interpolate(
          expansionProgress.value,
          [0, 1],
          [0.8, 1],
          Extrapolate.CLAMP
        )
      }
    ],
    opacity: expansionProgress.value,
  }));

  const animatedContentStyle = useAnimatedStyle(() => ({
    height: interpolate(
      expansionProgress.value,
      [0, 1],
      [0, compactMode ? 280 : 400],
      Extrapolate.CLAMP
    ),
  }));

  // Position-based styling
  const positionStyles = {
    'top-left': { top: 20, left: 20 },
    'top-right': { top: 20, right: 20 },
    'bottom-left': { bottom: 20, left: 20 },
    'bottom-right': { bottom: 20, right: 20 },
  };

  return (
    <View style={[styles.container, positionStyles[position], style]}>
      {/* Expand/Collapse Button */}
      <Pressable
        style={[
          styles.expandButton,
          { backgroundColor: CONTROLS_CONFIG.colors.surface }
        ]}
        onPress={handleExpandToggle}
      >
        <Text style={[styles.expandButtonText, { color: CONTROLS_CONFIG.colors.text }]}>
          {isExpanded ? '×' : '⚙'}
        </Text>
      </Pressable>

      {/* Main Controls Panel */}
      <Animated.View 
        style={[
          styles.controlsPanel,
          { backgroundColor: CONTROLS_CONFIG.colors.background },
          animatedContainerStyle
        ]}
      >
        <Animated.View style={[styles.controlsContent, animatedContentStyle]}>
          <Text style={[styles.panelTitle, { color: CONTROLS_CONFIG.colors.text }]}>
            Galaxy Overlay Controls
          </Text>

          {/* Toggle Controls */}
          <View style={styles.toggleSection}>
            <ToggleButton
              label="Sector Boundaries"
              description="Show hexagonal sector grid lines"
              isActive={configuration.showBoundaries}
              onToggle={controls.toggleBoundaries}
              icon="⬢"
              compact={compactMode}
            />
            
            <ToggleButton
              label="Sector States"
              description="Highlight healthy/dying/dead regions"
              isActive={configuration.showSectorStates}
              onToggle={controls.toggleSectorStates}
              icon="🌌"
              compact={compactMode}
            />
            
            <ToggleButton
              label="Entropy Effects"
              description="Show entropy spreading particles"
              isActive={configuration.showEntropyEffects}
              onToggle={controls.toggleEntropyEffects}
              icon="⚡"
              compact={compactMode}
            />
            
            <ToggleButton
              label="Harvestable Resources"
              description="Highlight dying stars and void fragments"
              isActive={configuration.showHarvestableResources}
              onToggle={controls.toggleHarvestableResources}
              icon="💎"
              compact={compactMode}
            />
          </View>

          {/* Quality Settings */}
          <View style={styles.qualitySection}>
            <Text style={[styles.sectionTitle, { color: CONTROLS_CONFIG.colors.text }]}>
              Visual Quality
            </Text>
            <QualitySlider
              value={configuration.quality.maxSectors > 45 ? 'high' 
                   : configuration.quality.maxSectors > 30 ? 'medium' 
                   : 'low'}
              onValueChange={controls.setQualityLevel}
            />
          </View>

          {/* Performance Information */}
          {showPerformanceInfo && performanceStats && (
            <View style={styles.performanceSection}>
              <Text style={[styles.sectionTitle, { color: CONTROLS_CONFIG.colors.text }]}>
                Performance
              </Text>
              <View style={styles.performanceGrid}>
                <PerformanceIndicator
                  label="FPS"
                  value={performanceStats.frameRate.toFixed(0)}
                  status={performanceStatus}
                  compact={compactMode}
                />
                <PerformanceIndicator
                  label="Frame Time"
                  value={performanceStats.averageFrameTime.toFixed(1)}
                  unit="ms"
                  status={performanceStats.averageFrameTime > 20 ? 'warning' : 'good'}
                  compact={compactMode}
                />
                <PerformanceIndicator
                  label="Cache Hit"
                  value={Math.round(performanceStats.cacheHitRate * 100)}
                  unit="%"
                  status={performanceStats.cacheHitRate > 0.7 ? 'good' : 'warning'}
                  compact={compactMode}
                />
              </View>
            </View>
          )}

          {/* Reset Button */}
          <Pressable
            style={[
              styles.resetButton,
              { 
                backgroundColor: CONTROLS_CONFIG.colors.surface,
                borderColor: CONTROLS_CONFIG.colors.border,
              }
            ]}
            onPress={controls.resetToDefaults}
          >
            <Text style={[styles.resetButtonText, { color: CONTROLS_CONFIG.colors.textSecondary }]}>
              Reset to Defaults
            </Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 1000,
    minWidth: 280,
    maxWidth: 320,
  },
  expandButton: {
    width: 44,
    height: 44,
    borderRadius: CONTROLS_CONFIG.borderRadius,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    marginBottom: CONTROLS_CONFIG.spacing.sm,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  expandButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  controlsPanel: {
    borderRadius: CONTROLS_CONFIG.borderRadius,
    padding: CONTROLS_CONFIG.spacing.md,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  controlsContent: {
    overflow: 'hidden',
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: CONTROLS_CONFIG.spacing.md,
    textAlign: 'center',
  },
  toggleSection: {
    marginBottom: CONTROLS_CONFIG.spacing.lg,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: CONTROLS_CONFIG.spacing.sm,
    borderRadius: CONTROLS_CONFIG.borderRadius / 2,
    borderWidth: 1,
    marginBottom: CONTROLS_CONFIG.spacing.sm,
  },
  toggleButtonCompact: {
    padding: CONTROLS_CONFIG.spacing.xs,
  },
  toggleContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleIcon: {
    fontSize: CONTROLS_CONFIG.iconSize,
    marginRight: CONTROLS_CONFIG.spacing.sm,
    width: 20,
    textAlign: 'center',
  },
  toggleText: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  toggleDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  toggleIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  qualitySection: {
    marginBottom: CONTROLS_CONFIG.spacing.lg,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: CONTROLS_CONFIG.spacing.sm,
  },
  qualitySlider: {
    alignItems: 'center',
  },
  qualityTrack: {
    width: 180,
    height: 4,
    backgroundColor: CONTROLS_CONFIG.colors.border,
    borderRadius: 2,
    position: 'relative',
    marginBottom: CONTROLS_CONFIG.spacing.sm,
  },
  qualityThumb: {
    position: 'absolute',
    width: 60,
    height: 4,
    backgroundColor: CONTROLS_CONFIG.colors.active,
    borderRadius: 2,
  },
  qualityLabels: {
    flexDirection: 'row',
    width: 180,
  },
  qualityLabel: {
    flex: 1,
    alignItems: 'center',
    padding: CONTROLS_CONFIG.spacing.xs,
  },
  qualityLabelText: {
    fontSize: 12,
    fontWeight: '500',
  },
  performanceSection: {
    marginBottom: CONTROLS_CONFIG.spacing.lg,
  },
  performanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  performanceIndicator: {
    width: '30%',
    alignItems: 'center',
    marginBottom: CONTROLS_CONFIG.spacing.sm,
  },
  performanceIndicatorCompact: {
    width: '48%',
  },
  performanceLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  performanceValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  resetButton: {
    padding: CONTROLS_CONFIG.spacing.sm,
    borderRadius: CONTROLS_CONFIG.borderRadius / 2,
    borderWidth: 1,
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  disabled: {
    opacity: 0.5,
  },
});

export default OverlayControls;