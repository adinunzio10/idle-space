import React, { memo, useMemo } from 'react';
import {
  Circle,
  Polygon,
  G,
  Defs,
  RadialGradient,
  Stop,
} from 'react-native-svg';

import { Beacon, LODRenderInfo, ViewportState } from '../../types/galaxy';
import { RENDERING_CONFIG } from '../../constants/rendering';
import { galaxyToScreen } from '../../utils/spatial/viewport';
import { getBeaconLevelScale, shouldShowLevelIndicators } from '../../utils/rendering/lod';


interface BeaconRendererProps {
  beacon: Beacon;
  lodInfo: LODRenderInfo;
  viewportState: ViewportState;
  onPress?: (beacon: Beacon) => void;
}

export const BeaconRenderer: React.FC<BeaconRendererProps> = memo(({
  beacon,
  lodInfo,
  viewportState,
  onPress,
}) => {
  // Convert galaxy coordinates to screen coordinates
  const screenPosition = galaxyToScreen(beacon.position, viewportState);
  
  // Get color scheme for beacon type
  const colors = RENDERING_CONFIG.BEACON_COLORS[beacon.type];
  
  // Calculate final size with level scaling
  const levelScale = getBeaconLevelScale(beacon.level);
  const finalSize = lodInfo.size * levelScale;
  
  // Simple opacity for glow effect (no complex animations for performance)
  const glowOpacity = lodInfo.showAnimations ? RENDERING_CONFIG.ANIMATIONS.GLOW_OPACITY : 0.3;
  
  // Generate shapes based on beacon type and LOD level
  const beaconShape = useMemo(() => {
    const radius = finalSize / 2;
    const strokeWidth = Math.max(1, radius / 8);
    
    switch (lodInfo.renderMode) {
      case 'full':
      case 'standard':
        return renderDetailedBeacon(beacon.type, radius, colors, strokeWidth, lodInfo.showEffects);
      
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
    <G onPress={onPress ? () => onPress(beacon) : undefined}>
      <Defs>
        {/* Glow gradient */}
        <RadialGradient
          id={`glow-${beacon.id}`}
          cx="50%"
          cy="50%"
          r="50%"
        >
          <Stop offset="0%" stopColor={colors.glow} stopOpacity="0.8" />
          <Stop offset="70%" stopColor={colors.glow} stopOpacity="0.3" />
          <Stop offset="100%" stopColor={colors.glow} stopOpacity="0" />
        </RadialGradient>
        
        {/* Primary gradient */}
        <RadialGradient
          id={`primary-${beacon.id}`}
          cx="30%"
          cy="30%"
          r="70%"
        >
          <Stop offset="0%" stopColor={colors.secondary} stopOpacity="1" />
          <Stop offset="70%" stopColor={colors.primary} stopOpacity="1" />
          <Stop offset="100%" stopColor={colors.primary} stopOpacity="0.8" />
        </RadialGradient>
      </Defs>
      
      {/* Glow effect (only for full/standard LOD) */}
      {lodInfo.showEffects && (
        <G opacity={glowOpacity}>
          <Circle
            cx={screenPosition.x}
            cy={screenPosition.y}
            r={finalSize}
            fill={`url(#glow-${beacon.id})`}
          />
        </G>
      )}
      
      {/* Level indicators */}
      {levelIndicators}
      
      {/* Main beacon shape */}
      <G
        transform={`translate(${screenPosition.x}, ${screenPosition.y})`}
      >
        {beaconShape}
      </G>
    </G>
  );
});

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
      
      return (
        <Polygon
          points={points}
          fill={colors.primary}
        />
      );
    
    case 'harvester':
      // Simple circle
      return (
        <Circle
          cx={0}
          cy={0}
          r={radius}
          fill={colors.primary}
        />
      );
    
    case 'architect':
      // Simple square (easier to render than hexagon at low LOD)
      return (
        <Polygon
          points={`-${radius},-${radius} ${radius},-${radius} ${radius},${radius} -${radius},${radius}`}
          fill={colors.primary}
        />
      );
    
    default:
      return (
        <Circle
          cx={0}
          cy={0}
          r={radius}
          fill={colors.primary}
        />
      );
  }
}

export default BeaconRenderer;