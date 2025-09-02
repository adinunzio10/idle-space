import React, { memo, useEffect, useMemo, useState } from 'react';
import {
  Path,
  Polygon,
  Circle,
  Text as SvgText,
  Rect,
  Defs,
  LinearGradient,
  Stop,
  G,
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
  useAnimatedReaction,
  runOnJS,
} from 'react-native-reanimated';

import { GeometricPattern, Beacon, ViewportState } from '../../types/galaxy';
import {
  PATTERN_COLORS,
  PATTERN_VISUAL_CONFIG,
  BONUS_DISPLAY,
  PATTERN_LAYERS,
  PATTERN_INTERACTION,
} from '../../constants/patterns';
import { galaxyToScreen } from '../../utils/spatial/viewport';

// Animated SVG components
const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

interface PatternOverlayProps {
  pattern: GeometricPattern;
  beacons: Beacon[];
  viewportState: ViewportState;
  isActive: boolean;
  bonusMultiplier?: number;
  onPress?: (pattern: GeometricPattern) => void;
  lodLevel: number;
  enableAnimations: boolean;
}

export const PatternOverlay: React.FC<PatternOverlayProps> = memo(
  ({
    pattern,
    beacons,
    viewportState,
    isActive,
    bonusMultiplier,
    onPress,
    lodLevel,
    enableAnimations,
  }) => {
    // Animation values
    const formationProgress = useSharedValue(0);
    const pulseProgress = useSharedValue(0);
    const glowIntensity = useSharedValue(0);
    const shimmerProgress = useSharedValue(0);

    // React state to track visibility (synced from shared value to avoid render-time .value access)
    const [isVisible, setIsVisible] = useState(false);

    // Get pattern configuration
    const patternConfig = PATTERN_VISUAL_CONFIG.EFFECTS[pattern.type];
    const colors = PATTERN_COLORS[pattern.type];

    // Convert beacon positions to screen coordinates
    const screenPoints = useMemo(() => {
      return pattern.beaconIds.map(beaconId => {
        const beacon = beacons.find(b => b.id === beaconId);
        if (!beacon) return { x: 0, y: 0 };
        return galaxyToScreen(beacon.position, viewportState);
      });
    }, [pattern.beaconIds, beacons, viewportState]);

    // Calculate pattern center for bonus text positioning
    const patternCenter = useMemo(() => {
      if (screenPoints.length === 0) return { x: 0, y: 0 };

      const sum = screenPoints.reduce(
        (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
        { x: 0, y: 0 }
      );

      return {
        x: sum.x / screenPoints.length,
        y: sum.y / screenPoints.length,
      };
    }, [screenPoints]);

    // Generate polygon points string for SVG
    const polygonPoints = useMemo(() => {
      return screenPoints.map(point => `${point.x},${point.y}`).join(' ');
    }, [screenPoints]);

    // Initialize animations on mount
    useEffect(() => {
      if (!enableAnimations) {
        formationProgress.value = 1;
        return;
      }

      // Formation animation
      formationProgress.value = withSpring(1, {
        damping: 20,
        stiffness: 300,
        mass: 1,
      });

      // Continuous pulse animation
      if (isActive) {
        pulseProgress.value = withRepeat(
          withSequence(
            withTiming(1, {
              duration: PATTERN_VISUAL_CONFIG.ANIMATION.PULSE_DURATION / 2,
              easing: Easing.inOut(Easing.sin),
            }),
            withTiming(0, {
              duration: PATTERN_VISUAL_CONFIG.ANIMATION.PULSE_DURATION / 2,
              easing: Easing.inOut(Easing.sin),
            })
          ),
          -1,
          false
        );

        // Glow animation
        glowIntensity.value = withRepeat(
          withSequence(
            withTiming(1, {
              duration: PATTERN_VISUAL_CONFIG.ANIMATION.GLOW_CYCLE_DURATION / 2,
              easing: Easing.inOut(Easing.quad),
            }),
            withTiming(0.3, {
              duration: PATTERN_VISUAL_CONFIG.ANIMATION.GLOW_CYCLE_DURATION / 2,
              easing: Easing.inOut(Easing.quad),
            })
          ),
          -1,
          false
        );

        // Shimmer animation for complex patterns
        if (patternConfig.hasShimmer) {
          shimmerProgress.value = withRepeat(
            withTiming(1, {
              duration: PATTERN_VISUAL_CONFIG.ANIMATION.SHIMMER_DURATION,
              easing: Easing.linear,
            }),
            -1,
            false
          );
        }
      }
    }, [
      isActive,
      enableAnimations,
      patternConfig.hasShimmer,
      formationProgress,
      pulseProgress,
      glowIntensity,
      shimmerProgress,
    ]);

    // Sync shared value to React state to avoid render-time .value access
    useAnimatedReaction(
      () => formationProgress.value > 0,
      current => {
        runOnJS(setIsVisible)(current);
      }
    );

    // Animated properties for the main pattern
    const animatedPolygonProps = useAnimatedProps(() => {
      const scale = interpolate(formationProgress.value, [0, 1], [0.1, 1]);

      const pulseScale = interpolate(
        pulseProgress.value,
        [0, 1],
        [1, 1 + patternConfig.pulseIntensity]
      );

      const finalScale = scale * pulseScale;

      const opacity = interpolate(
        formationProgress.value,
        [0, 0.3, 1],
        [
          0,
          0.5,
          isActive
            ? PATTERN_VISUAL_CONFIG.RENDERING.FILL_OPACITY_ACTIVE
            : PATTERN_VISUAL_CONFIG.RENDERING.FILL_OPACITY,
        ]
      );

      return {
        opacity,
        transform: [{ scale: finalScale }],
      };
    });

    // Animated properties for glow effect
    const animatedGlowProps = useAnimatedProps(() => {
      const glowOpacity =
        interpolate(
          glowIntensity.value,
          [0, 1],
          [0.2, patternConfig.glowIntensity]
        ) * interpolate(formationProgress.value, [0, 1], [0, 1]);

      return {
        opacity: glowOpacity,
      };
    });

    // Gradient IDs for this pattern
    const gradientId = `pattern-gradient-${pattern.id}`;
    const glowGradientId = `pattern-glow-${pattern.id}`;
    const shimmerGradientId = `pattern-shimmer-${pattern.id}`;

    // Don't render if no points or too small
    if (screenPoints.length < 3 || !isVisible) {
      return null;
    }

    // Determine LOD settings
    const showFill = lodLevel >= 2;
    const showBonusText = lodLevel >= 3 && isActive;
    const showGlow = lodLevel >= 2 && isActive;
    const showShimmer = lodLevel >= 3 && patternConfig.hasShimmer && isActive;

    return (
      <AnimatedG onPress={onPress ? () => onPress(pattern) : undefined}>
        <Defs>
          {/* Main fill gradient */}
          <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop
              offset="0%"
              stopColor={isActive ? colors.fillActive : colors.fill}
              stopOpacity={0.6}
            />
            <Stop
              offset="100%"
              stopColor={isActive ? colors.strokeActive : colors.stroke}
              stopOpacity={0.1}
            />
          </LinearGradient>

          {/* Glow gradient */}
          {showGlow && (
            <LinearGradient
              id={glowGradientId}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <Stop
                offset="0%"
                stopColor={colors.glowActive}
                stopOpacity={0.8}
              />
              <Stop offset="50%" stopColor={colors.glow} stopOpacity={0.4} />
              <Stop
                offset="100%"
                stopColor={colors.glowActive}
                stopOpacity={0.8}
              />
            </LinearGradient>
          )}

          {/* Shimmer gradient */}
          {showShimmer && (
            <LinearGradient
              id={shimmerGradientId}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="0%"
            >
              <Stop offset="0%" stopColor={colors.stroke} stopOpacity={0} />
              <Stop
                offset="20%"
                stopColor={colors.glowActive}
                stopOpacity={0.3}
              />
              <Stop
                offset="50%"
                stopColor={colors.glowActive}
                stopOpacity={0.8}
              />
              <Stop
                offset="80%"
                stopColor={colors.glowActive}
                stopOpacity={0.3}
              />
              <Stop offset="100%" stopColor={colors.stroke} stopOpacity={0} />
            </LinearGradient>
          )}
        </Defs>

        {/* Shadow layer */}
        {showFill && (
          <AnimatedPolygon
            points={polygonPoints}
            fill={colors.shadow}
            opacity={0.1}
            transform={`translate(2, 2)`}
          />
        )}

        {/* Glow layer (renders behind main shape) */}
        {showGlow && (
          <AnimatedPolygon
            animatedProps={animatedGlowProps}
            points={polygonPoints}
            fill={`url(#${glowGradientId})`}
            stroke={colors.glowActive}
            strokeWidth={PATTERN_VISUAL_CONFIG.RENDERING.STROKE_WIDTH + 2}
            transform={`translate(${patternCenter.x}, ${patternCenter.y}) scale(1.1) translate(${-patternCenter.x}, ${-patternCenter.y})`}
          />
        )}

        {/* Main pattern shape */}
        <AnimatedPolygon
          animatedProps={animatedPolygonProps}
          points={polygonPoints}
          fill={showFill ? `url(#${gradientId})` : 'transparent'}
          stroke={isActive ? colors.strokeActive : colors.stroke}
          strokeWidth={
            isActive
              ? PATTERN_VISUAL_CONFIG.RENDERING.STROKE_WIDTH_ACTIVE
              : PATTERN_VISUAL_CONFIG.RENDERING.STROKE_WIDTH
          }
          strokeOpacity={
            isActive
              ? PATTERN_VISUAL_CONFIG.RENDERING.STROKE_OPACITY_ACTIVE
              : PATTERN_VISUAL_CONFIG.RENDERING.STROKE_OPACITY
          }
        />

        {/* Shimmer overlay */}
        {showShimmer && (
          <AnimatedPolygon
            points={polygonPoints}
            fill={`url(#${shimmerGradientId})`}
            opacity={0.5}
          />
        )}

        {/* Bonus multiplier text */}
        {showBonusText && bonusMultiplier && (
          <G
            transform={`translate(${patternCenter.x + BONUS_DISPLAY.TEXT_OFFSET.x}, ${patternCenter.y + BONUS_DISPLAY.TEXT_OFFSET.y})`}
          >
            {/* Background pill */}
            <Rect
              x={-BONUS_DISPLAY.BACKGROUND.paddingX - 8}
              y={-BONUS_DISPLAY.BACKGROUND.paddingY - 6}
              width={16 + BONUS_DISPLAY.BACKGROUND.paddingX * 2}
              height={12 + BONUS_DISPLAY.BACKGROUND.paddingY * 2}
              rx={BONUS_DISPLAY.BACKGROUND.cornerRadius}
              ry={BONUS_DISPLAY.BACKGROUND.cornerRadius}
              fill={colors.bonus}
              opacity={BONUS_DISPLAY.BACKGROUND.opacity}
            />

            {/* Multiplier text */}
            <SvgText
              x={0}
              y={0}
              fontSize={BONUS_DISPLAY.TEXT_STYLE.fontSize}
              fontWeight={BONUS_DISPLAY.TEXT_STYLE.fontWeight}
              textAnchor={BONUS_DISPLAY.TEXT_STYLE.textAnchor}
              alignmentBaseline="central"
              fill="white"
            >
              {BONUS_DISPLAY.MULTIPLIERS[pattern.type]}
            </SvgText>
          </G>
        )}

        {/* Particles for complex patterns */}
        {patternConfig.hasParticles && isActive && lodLevel >= 3 && (
          <PatternParticles
            center={patternCenter}
            colors={colors}
            patternType={pattern.type}
            enabled={enableAnimations}
          />
        )}
      </AnimatedG>
    );
  }
);

PatternOverlay.displayName = 'PatternOverlay';

/**
 * Particle effects for high-value patterns
 */
interface PatternParticlesProps {
  center: { x: number; y: number };
  colors: (typeof PATTERN_COLORS)[keyof typeof PATTERN_COLORS];
  patternType: string;
  enabled: boolean;
}

const PatternParticles: React.FC<PatternParticlesProps> = memo(
  ({ center, colors, patternType, enabled }) => {
    const particleAnimation = useSharedValue(0);

    useEffect(() => {
      if (!enabled) return;

      particleAnimation.value = withRepeat(
        withTiming(1, {
          duration: PATTERN_VISUAL_CONFIG.ANIMATION.PARTICLE_DURATION,
          easing: Easing.linear,
        }),
        -1,
        false
      );
    }, [enabled, particleAnimation]);

    const animatedParticleProps = useAnimatedProps(() => {
      const progress = particleAnimation.value;
      const opacity = interpolate(progress, [0, 0.2, 0.8, 1], [0, 0.8, 0.8, 0]);

      const scale = interpolate(progress, [0, 0.3, 1], [0.5, 1.2, 0.8]);

      return {
        opacity,
        transform: [{ scale }],
      };
    });

    if (!enabled) return null;

    // Generate particle positions in a circle around the pattern
    const particles = Array.from(
      { length: patternType === 'hexagon' ? 8 : 6 },
      (_, i) => {
        const angle = (i / (patternType === 'hexagon' ? 8 : 6)) * 2 * Math.PI;
        const radius = 25;
        return {
          x: center.x + Math.cos(angle) * radius,
          y: center.y + Math.sin(angle) * radius,
        };
      }
    );

    return (
      <G>
        {particles.map((particle, index) => (
          <AnimatedCircle
            key={index}
            animatedProps={animatedParticleProps}
            cx={particle.x}
            cy={particle.y}
            r={2}
            fill={colors.glowActive}
          />
        ))}
      </G>
    );
  }
);

PatternParticles.displayName = 'PatternParticles';

export default PatternOverlay;
