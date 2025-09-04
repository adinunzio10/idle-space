import React, { useMemo } from 'react';
import {
  Circle,
  Polygon,
  G,
  Defs,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withRepeat,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';

import { Beacon, LODRenderInfo, ViewportState } from '../../types/galaxy';
import { RENDERING_CONFIG } from '../../constants/rendering';
import { galaxyToScreen } from '../../utils/spatial/viewport';
import {
  getBeaconLevelScale,
  shouldShowLevelIndicators,
} from '../../utils/rendering/lod';
import {
  poolManager,
  PooledBeaconRenderData,
} from '../../utils/performance/ObjectPool';
import {
  withPerformanceMemo,
  useRenderTracker,
} from '../../utils/performance/RenderOptimizations';
import { useBatteryAwareVisualEffects } from '../../hooks/useBatteryOptimization';
import {
  cloneBeaconRenderData,
  BeaconWorkletData,
  freezeForWorklet,
} from '../../utils/performance/WorkletDataIsolation';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface BeaconRendererProps {
  beacon: Beacon;
  lodInfo: LODRenderInfo;
  viewportState: ViewportState;
}

const BeaconRendererComponent: React.FC<BeaconRendererProps> = ({
  beacon,
  lodInfo,
  viewportState,
}) => {
  // Performance tracking for this component
  useRenderTracker('BeaconRenderer', {
    beaconId: beacon.id,
    lodLevel: lodInfo.level,
  });

  // Battery-aware visual effects
  const { enableGlowEffects, enableAnimations, animationScale } =
    useBatteryAwareVisualEffects();

  // Convert galaxy coordinates to screen coordinates
  const screenPosition = galaxyToScreen(beacon.position, viewportState);

  // DEBUG: Track beacon coordinate transformation for comparison with circular effects
  React.useEffect(() => {
    console.log(`[DEBUG:BeaconRenderer] ${beacon.id} - worldPos(${beacon.position.x.toFixed(1)}, ${beacon.position.y.toFixed(1)}) | viewport(scale:${viewportState.scale.toFixed(2)}, translate:${viewportState.translateX.toFixed(1)},${viewportState.translateY.toFixed(1)}) | screenPos(${screenPosition.x.toFixed(1)}, ${screenPosition.y.toFixed(1)}) - ${Date.now()}`);
  }, [beacon.position.x, beacon.position.y, viewportState.scale, viewportState.translateX, viewportState.translateY, screenPosition.x, screenPosition.y, beacon.id]);

  // Get color scheme for beacon type
  const colors = RENDERING_CONFIG.BEACON_COLORS[beacon.type];

  // Calculate final size with level scaling
  const levelScale = getBeaconLevelScale(beacon.level);
  const finalSize = lodInfo.size * levelScale;

  // Enhanced animations for high LOD levels
  const pulseAnimation = useSharedValue(0);
  const glowAnimation = useSharedValue(0);

  React.useEffect(() => {
    const shouldAnimate = lodInfo.showAnimations && enableAnimations;

    if (shouldAnimate) {
      // Pulse animation for the beacon with battery-aware duration
      const adjustedDuration =
        RENDERING_CONFIG.ANIMATIONS.PULSE_DURATION / animationScale;

      pulseAnimation.value = withRepeat(
        withTiming(1, {
          duration: adjustedDuration,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true
      );

      // Glow animation only if glow effects are enabled
      if (enableGlowEffects) {
        glowAnimation.value = withRepeat(
          withTiming(1, {
            duration: adjustedDuration * 1.5,
            easing: Easing.inOut(Easing.ease),
          }),
          -1,
          true
        );
      } else {
        glowAnimation.value = 0;
      }
    } else {
      pulseAnimation.value = 0;
      glowAnimation.value = 0;
    }
  }, [
    lodInfo.showAnimations,
    enableAnimations,
    enableGlowEffects,
    animationScale,
    pulseAnimation,
    glowAnimation,
  ]);

  // Pooled render data for performance
  const renderData = useMemo((): PooledBeaconRenderData => {
    const pool = poolManager.getPool<PooledBeaconRenderData>('beaconRender');
    const data = pool?.acquire() || {
      id: beacon.id,
      x: screenPosition.x,
      y: screenPosition.y,
      size: finalSize,
      color: colors.primary,
      glowSize: finalSize * 1.5,
      glowOpacity:
        lodInfo.showAnimations && enableGlowEffects
          ? RENDERING_CONFIG.ANIMATIONS.GLOW_OPACITY
          : 0.3,
      level: beacon.level,
      type: beacon.type,
      active: true,
    };

    // Update with current values
    data.id = beacon.id;
    data.x = screenPosition.x;
    data.y = screenPosition.y;
    data.size = finalSize;
    data.color = colors.primary;
    data.glowSize = finalSize * 1.5;
    data.glowOpacity =
      lodInfo.showAnimations && enableGlowEffects
        ? RENDERING_CONFIG.ANIMATIONS.GLOW_OPACITY
        : 0.3;
    data.level = beacon.level;
    data.type = beacon.type;
    data.active = true;

    return data;
  }, [
    beacon.id,
    screenPosition.x,
    screenPosition.y,
    finalSize,
    colors.primary,
    beacon.level,
    beacon.type,
    lodInfo.showAnimations,
    enableGlowEffects,
  ]);

  // Create worklet-safe data clone to prevent Reanimated mutation warnings
  const workletSafeData = useMemo((): BeaconWorkletData => {
    return freezeForWorklet(cloneBeaconRenderData({
      id: renderData.id,
      x: renderData.x,
      y: renderData.y,
      size: renderData.size,
      color: renderData.color,
      glowSize: renderData.glowSize,
      glowOpacity: renderData.glowOpacity,
      level: renderData.level,
      type: renderData.type,
      active: renderData.active,
    }));
  }, [renderData]);

  // CRITICAL FIX: Release pooled object on component unmount/cleanup
  React.useEffect(() => {
    return () => {
      const pool = poolManager.getPool<PooledBeaconRenderData>('beaconRender');
      if (pool && renderData) {
        pool.release(renderData);
      }
    };
  }, [renderData]);

  // Animated props for pulse effect (using worklet-safe data to prevent mutation warnings)
  const animatedGlowProps = useAnimatedProps(() => {
    const opacity = interpolate(
      glowAnimation.value,
      [0, 1],
      [workletSafeData.glowOpacity * 0.5, workletSafeData.glowOpacity]
    );
    const scale = interpolate(pulseAnimation.value, [0, 1], [0.8, 1.2]);

    return {
      opacity: lodInfo.showAnimations ? opacity : workletSafeData.glowOpacity,
      r: workletSafeData.glowSize * (lodInfo.showAnimations ? scale : 1),
    };
  });

  // Generate shapes based on beacon type and LOD level
  const beaconShape = useMemo(() => {
    const radius = finalSize / 2;
    const strokeWidth = Math.max(1, radius / 8);

    switch (lodInfo.renderMode) {
      case 'full':
      case 'standard':
        return renderDetailedBeacon(
          beacon.type,
          radius,
          colors,
          strokeWidth,
          lodInfo.showEffects
        );

      case 'simplified':
        return renderSimplifiedBeacon(beacon.type, radius, colors);

      default:
        return renderSimplifiedBeacon(beacon.type, radius, colors);
    }
  }, [beacon.type, finalSize, colors, lodInfo.renderMode, lodInfo.showEffects]);

  // Level indicators (rings around beacon)
  const levelIndicators = useMemo(() => {
    if (!shouldShowLevelIndicators(viewportState.scale, beacon.level)) {
      return null;
    }

    const rings = [];
    const baseRadius = finalSize / 2;

    for (let i = 2; i <= beacon.level; i++) {
      const ringRadius = baseRadius + (i - 1) * 4;
      rings.push(
        <Circle
          key={`level-${i}`}
          cx={screenPosition.x}
          cy={screenPosition.y}
          r={ringRadius}
          fill="none"
          stroke={colors.secondary}
          strokeWidth="1"
          strokeOpacity="0.6"
        />
      );
    }

    return rings;
  }, [beacon.level, finalSize, screenPosition, colors, viewportState.scale]);

  return (
    <G>
      <Defs>
        {/* Glow gradient */}
        <RadialGradient id={`glow-${beacon.id}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={colors.glow} stopOpacity="0.8" />
          <Stop offset="70%" stopColor={colors.glow} stopOpacity="0.3" />
          <Stop offset="100%" stopColor={colors.glow} stopOpacity="0" />
        </RadialGradient>

        {/* Primary gradient */}
        <RadialGradient id={`primary-${beacon.id}`} cx="30%" cy="30%" r="70%">
          <Stop offset="0%" stopColor={colors.secondary} stopOpacity="1" />
          <Stop offset="70%" stopColor={colors.primary} stopOpacity="1" />
          <Stop offset="100%" stopColor={colors.primary} stopOpacity="0.8" />
        </RadialGradient>
      </Defs>

      {/* Enhanced glow effect with animation */}
      {lodInfo.showEffects && (
        <AnimatedCircle
          cx={workletSafeData.x}
          cy={workletSafeData.y}
          fill={`url(#glow-${beacon.id})`}
          animatedProps={animatedGlowProps}
        />
      )}

      {/* Level indicators */}
      {levelIndicators}

      {/* Main beacon shape */}
      <G transform={`translate(${screenPosition.x}, ${screenPosition.y})`}>
        {beaconShape}
      </G>
    </G>
  );
};

// Custom comparison function for beacon rendering props
const compareBeaconProps = (
  prevProps: BeaconRendererProps,
  nextProps: BeaconRendererProps
): boolean => {
  // Compare beacon data
  if (
    prevProps.beacon.id !== nextProps.beacon.id ||
    prevProps.beacon.position.x !== nextProps.beacon.position.x ||
    prevProps.beacon.position.y !== nextProps.beacon.position.y ||
    prevProps.beacon.level !== nextProps.beacon.level ||
    prevProps.beacon.type !== nextProps.beacon.type
  ) {
    return false;
  }

  // Compare LOD info
  if (
    prevProps.lodInfo.level !== nextProps.lodInfo.level ||
    prevProps.lodInfo.renderMode !== nextProps.lodInfo.renderMode ||
    prevProps.lodInfo.showAnimations !== nextProps.lodInfo.showAnimations ||
    prevProps.lodInfo.showEffects !== nextProps.lodInfo.showEffects
  ) {
    return false;
  }

  // Compare viewport state with tolerance for floating point precision
  const threshold = 0.1;
  if (
    Math.abs(
      prevProps.viewportState.translateX - nextProps.viewportState.translateX
    ) > threshold ||
    Math.abs(
      prevProps.viewportState.translateY - nextProps.viewportState.translateY
    ) > threshold ||
    Math.abs(prevProps.viewportState.scale - nextProps.viewportState.scale) >
      0.01
  ) {
    return false;
  }

  return true;
};

// Export optimized component with performance memoization
export const BeaconRenderer = withPerformanceMemo(
  BeaconRendererComponent,
  compareBeaconProps
);
BeaconRenderer.displayName = 'BeaconRenderer';

/**
 * Render detailed beacon shape based on type
 */
function renderDetailedBeacon(
  type: Beacon['type'],
  radius: number,
  colors: any,
  strokeWidth: number,
  showEffects: boolean
): React.ReactElement {
  const fillId = showEffects ? `url(#primary-${type})` : colors.primary;

  switch (type) {
    case 'pioneer':
      // Diamond shape
      const points = [
        `0,-${radius}`,
        `${radius},0`,
        `0,${radius}`,
        `-${radius},0`,
      ].join(' ');

      return (
        <Polygon
          points={points}
          fill={fillId}
          stroke={colors.primary}
          strokeWidth={strokeWidth}
        />
      );

    case 'harvester':
      // Circle shape
      return (
        <Circle
          cx={0}
          cy={0}
          r={radius}
          fill={fillId}
          stroke={colors.primary}
          strokeWidth={strokeWidth}
        />
      );

    case 'architect':
      // Hexagon shape
      const hexPoints = [];
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        const x = radius * Math.cos(angle);
        const y = radius * Math.sin(angle);
        hexPoints.push(`${x},${y}`);
      }

      return (
        <Polygon
          points={hexPoints.join(' ')}
          fill={fillId}
          stroke={colors.primary}
          strokeWidth={strokeWidth}
        />
      );

    default:
      return (
        <Circle
          cx={0}
          cy={0}
          r={radius}
          fill={fillId}
          stroke={colors.primary}
          strokeWidth={strokeWidth}
        />
      );
  }
}

/**
 * Render simplified beacon shape (just basic shapes)
 */
function renderSimplifiedBeacon(
  type: Beacon['type'],
  radius: number,
  colors: any
): React.ReactElement {
  switch (type) {
    case 'pioneer':
      // Simple diamond
      const points = [
        `0,-${radius}`,
        `${radius},0`,
        `0,${radius}`,
        `-${radius},0`,
      ].join(' ');

      return <Polygon points={points} fill={colors.primary} />;

    case 'harvester':
      // Simple circle
      return <Circle cx={0} cy={0} r={radius} fill={colors.primary} />;

    case 'architect':
      // Simple square (easier to render than hexagon at low LOD)
      return (
        <Polygon
          points={`-${radius},-${radius} ${radius},-${radius} ${radius},${radius} -${radius},${radius}`}
          fill={colors.primary}
        />
      );

    default:
      return <Circle cx={0} cy={0} r={radius} fill={colors.primary} />;
  }
}

export default BeaconRenderer;
