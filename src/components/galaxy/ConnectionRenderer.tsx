import React, { memo, useMemo, useEffect } from 'react';
import { Path, Defs, LinearGradient, Stop, G, Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  interpolate,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import {
  Connection,
  Beacon,
  ViewportState,
  ConnectionRenderInfo,
} from '../../types/galaxy';
import { CONNECTION_COLORS } from '../../constants/connections';
import { galaxyToScreen } from '../../utils/spatial/viewport';
import { generateConnectionPath } from '../../utils/rendering/connections';
import {
  createConnectionFlowAnimation,
  createConnectionSparkAnimation,
  globalEffectManager,
} from '../../utils/effects/VisualEffects';
import {
  useBatteryAwareVisualEffects,
  useBatteryAwarePerformance,
} from '../../hooks/useBatteryOptimization';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ConnectionRendererProps {
  connection: Connection;
  sourceBeacon: Beacon;
  targetBeacon: Beacon;
  renderInfo: ConnectionRenderInfo;
  viewportState: ViewportState;
  onPress?: (connection: Connection) => void;
}

export const ConnectionRenderer: React.FC<ConnectionRendererProps> = memo(
  ({
    connection,
    sourceBeacon,
    targetBeacon,
    renderInfo,
    viewportState,
    onPress,
  }) => {
    // Battery-aware visual effects
    const {
      enableVisualEffects,
      enableGlowEffects,
      enableAnimations,
      animationScale,
    } = useBatteryAwareVisualEffects();
    const { shouldThrottleUpdates, updateInterval } =
      useBatteryAwarePerformance();

    // Animation values for visual effects
    const flowProgress = useSharedValue(0);
    const sparkProgress = useSharedValue(0);
    const sparkOpacity = useSharedValue(0);
    const glowIntensity = useSharedValue(0.5);

    // Start animations based on connection state and battery optimization
    useEffect(() => {
      const effectId = `connection-${connection.id}`;

      if (renderInfo.showFlow && connection.isActive && enableAnimations) {
        // Start flow animation for active connections
        globalEffectManager.registerEffect(`${effectId}-flow`, () => {
          createConnectionFlowAnimation(flowProgress);
        });
        globalEffectManager.startEffect(`${effectId}-flow`);

        // Add glow animation for strong connections only if glow effects are enabled
        if (connection.strength >= 3 && enableGlowEffects) {
          const adjustedDuration = 2000 / animationScale;
          glowIntensity.value = withRepeat(
            withTiming(1, {
              duration: adjustedDuration,
              easing: Easing.inOut(Easing.sin),
            }),
            -1,
            true
          );
        }

        // Occasional sparks for very active connections with battery-aware intervals
        if (connection.strength >= 4 && enableVisualEffects) {
          const sparkInterval = setInterval(
            () => {
              if (Math.random() < 0.3) {
                // 30% chance every interval
                createConnectionSparkAnimation(sparkProgress, sparkOpacity);
              }
            },
            shouldThrottleUpdates ? updateInterval * 3 : 3000
          );

          return () => {
            clearInterval(sparkInterval);
            globalEffectManager.stopEffect(`${effectId}-flow`);
          };
        }
      }

      return () => {
        globalEffectManager.stopEffect(`${effectId}-flow`);
      };
    }, [
      connection.id,
      connection.isActive,
      connection.strength,
      renderInfo.showFlow,
      flowProgress,
      sparkProgress,
      sparkOpacity,
      glowIntensity,
      enableAnimations,
      enableGlowEffects,
      enableVisualEffects,
      animationScale,
      shouldThrottleUpdates,
      updateInterval,
    ]);
    // Convert galaxy coordinates to screen coordinates
    const sourceScreen = galaxyToScreen(sourceBeacon.position, viewportState);
    const targetScreen = galaxyToScreen(targetBeacon.position, viewportState);

    // Generate the SVG path for the connection
    const pathData = useMemo(() => {
      return generateConnectionPath(
        sourceScreen,
        targetScreen,
        connection.strength,
        connection.id
      );
    }, [sourceScreen, targetScreen, connection.strength, connection.id]);

    // Determine colors based on connection state and patterns
    const colors = useMemo(() => {
      if (renderInfo.isPatternConnection && renderInfo.patternColor) {
        // Use pattern-specific colors
        const patternType = connection.patterns[0];
        return (
          CONNECTION_COLORS.PATTERNS[patternType] || CONNECTION_COLORS.DEFAULT
        );
      } else if (connection.strength >= 4) {
        return CONNECTION_COLORS.STRONG;
      } else if (!connection.isActive) {
        return CONNECTION_COLORS.INACTIVE;
      } else {
        return CONNECTION_COLORS.DEFAULT;
      }
    }, [
      renderInfo.isPatternConnection,
      renderInfo.patternColor,
      connection.patterns,
      connection.strength,
      connection.isActive,
    ]);

    // Create gradient ID
    const gradientId = `connection-gradient-${connection.id}`;

    // Animated properties for flow effect
    const animatedPathProps = useAnimatedProps(() => {
      const dashOffset = interpolate(
        flowProgress.value,
        [0, 1],
        [0, -50] // Negative to make flow go from source to target
      );

      return {
        strokeDasharray: renderInfo.showFlow ? '10,5' : undefined,
        strokeDashoffset: renderInfo.showFlow ? dashOffset : 0,
      };
    });

    // Animated properties for glow effect
    const animatedGlowProps = useAnimatedProps(() => {
      const opacity = interpolate(glowIntensity.value, [0, 1], [0.3, 0.8]);

      const strokeWidth = interpolate(
        glowIntensity.value,
        [0, 1],
        [renderInfo.lineWidth * 2, renderInfo.lineWidth * 3]
      );

      return {
        opacity,
        strokeWidth,
      };
    });

    // Animated spark properties
    const animatedSparkProps = useAnimatedProps(() => {
      const progress = sparkProgress.value;
      const x = sourceScreen.x + (targetScreen.x - sourceScreen.x) * progress;
      const y = sourceScreen.y + (targetScreen.y - sourceScreen.y) * progress;
      const size = interpolate(progress, [0, 0.5, 1], [2, 6, 2]);

      return {
        cx: x,
        cy: y,
        r: size,
        opacity: sparkOpacity.value,
      };
    });

    // Don't render if not supposed to
    if (!renderInfo.shouldRender) {
      return null;
    }

    return (
      <G onPress={onPress ? () => onPress(connection) : undefined}>
        <Defs>
          {/* Main connection gradient */}
          <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop
              offset="0%"
              stopColor={colors.start}
              stopOpacity={renderInfo.opacity}
            />
            <Stop
              offset="50%"
              stopColor={colors.flow}
              stopOpacity={renderInfo.opacity * 0.9}
            />
            <Stop
              offset="100%"
              stopColor={colors.end}
              stopOpacity={renderInfo.opacity}
            />
          </LinearGradient>

          {/* Glow gradient for strong connections */}
          {renderInfo.showFlow && connection.strength >= 3 && (
            <LinearGradient
              id={`${gradientId}-glow`}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="0%"
            >
              <Stop offset="0%" stopColor={colors.glow} stopOpacity={0.3} />
              <Stop offset="50%" stopColor={colors.glow} stopOpacity={0.6} />
              <Stop offset="100%" stopColor={colors.glow} stopOpacity={0.3} />
            </LinearGradient>
          )}
        </Defs>

        {/* Enhanced glow effect for strong connections */}
        {renderInfo.showFlow && connection.strength >= 3 && (
          <AnimatedPath
            d={pathData}
            stroke={`url(#${gradientId}-glow)`}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            animatedProps={animatedGlowProps}
          />
        )}

        {/* Main connection line with flow animation */}
        <AnimatedPath
          d={pathData}
          stroke={`url(#${gradientId})`}
          strokeWidth={renderInfo.lineWidth}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={renderInfo.opacity}
          animatedProps={animatedPathProps}
        />

        {/* Animated spark effect for high-strength connections */}
        {connection.strength >= 4 && (
          <AnimatedCircle
            fill={colors.flow}
            animatedProps={animatedSparkProps}
          />
        )}

        {/* Flow animation effect (for active connections at high LOD) */}
        {renderInfo.showAnimation && renderInfo.showFlow && (
          <FlowEffect
            pathData={pathData}
            colors={colors}
            lineWidth={renderInfo.lineWidth}
            connectionId={connection.id}
          />
        )}

        {/* Pattern highlight for pattern connections */}
        {renderInfo.isPatternConnection && renderInfo.showFlow && (
          <Path
            d={pathData}
            stroke={colors.glow}
            strokeWidth={Math.max(1, renderInfo.lineWidth - 1)}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.4}
            strokeDasharray={`${renderInfo.lineWidth * 2},${renderInfo.lineWidth}`}
          />
        )}
      </G>
    );
  }
);

ConnectionRenderer.displayName = 'ConnectionRenderer';

/**
 * Flow effect component for animated connections
 */
interface FlowEffectProps {
  pathData: string;
  colors: { flow: string };
  lineWidth: number;
  connectionId: string;
}

const FlowEffect: React.FC<FlowEffectProps> = memo(
  ({ pathData, colors, lineWidth, connectionId }) => {
    const flowGradientId = `flow-${connectionId}`;

    return (
      <>
        <Defs>
          <LinearGradient id={flowGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={colors.flow} stopOpacity={0} />
            <Stop offset="20%" stopColor={colors.flow} stopOpacity={0.3} />
            <Stop offset="40%" stopColor={colors.flow} stopOpacity={0.8} />
            <Stop offset="60%" stopColor={colors.flow} stopOpacity={0.8} />
            <Stop offset="80%" stopColor={colors.flow} stopOpacity={0.3} />
            <Stop offset="100%" stopColor={colors.flow} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        <Path
          d={pathData}
          stroke={`url(#${flowGradientId})`}
          strokeWidth={Math.max(1, lineWidth - 1)}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${lineWidth * 3},${lineWidth * 6}`}
          strokeDashoffset={0}
        >
          {/* Simple flow animation using opacity changes */}
          {/* Note: For a more complex animation, you'd use react-native-reanimated */}
        </Path>
      </>
    );
  }
);

FlowEffect.displayName = 'FlowEffect';

export default ConnectionRenderer;
