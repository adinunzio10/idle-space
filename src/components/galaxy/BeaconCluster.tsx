import React, { memo, useMemo } from 'react';
import {
  Circle,
  Text,
  G,
  Defs,
  RadialGradient,
  Stop,
} from 'react-native-svg';

import { BeaconCluster, ViewportState } from '../../types/galaxy';
import { RENDERING_CONFIG } from '../../constants/rendering';
import { galaxyToScreen } from '../../utils/spatial/viewport';

interface BeaconClusterRendererProps {
  cluster: BeaconCluster;
  viewportState: ViewportState;
  onPress?: (cluster: BeaconCluster) => void;
}

export const BeaconClusterRenderer: React.FC<BeaconClusterRendererProps> = memo(({
  cluster,
  viewportState,
  onPress,
}) => {
  // Convert galaxy coordinates to screen coordinates
  const screenPosition = galaxyToScreen(cluster.position, viewportState);
  
  // Calculate cluster visual properties
  const clusterSize = RENDERING_CONFIG.BEACON_SIZES.CLUSTER;
  const beaconCount = cluster.beacons.length;
  
  // Determine dominant beacon type for color scheme
  const typeCount = cluster.beacons.reduce((counts, beacon) => {
    counts[beacon.type] = (counts[beacon.type] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);
  
  const dominantType = Object.entries(typeCount).reduce((a, b) => 
    typeCount[a[0]] > typeCount[b[0]] ? a : b
  )[0] as keyof typeof RENDERING_CONFIG.BEACON_COLORS;
  
  const colors = RENDERING_CONFIG.BEACON_COLORS[dominantType];
  
  // Calculate cluster radius based on beacon count (with some limits)
  const radius = useMemo(() => {
    const baseRadius = clusterSize / 2;
    const scaleFactor = Math.log10(beaconCount + 1) * 0.5; // Logarithmic scaling
    return Math.max(baseRadius, Math.min(baseRadius * 2, baseRadius + scaleFactor * 10));
  }, [beaconCount, clusterSize]);
  
  // Create cluster composition indicators (rings for different beacon types)
  const compositionRings = useMemo(() => {
    const rings: React.ReactElement[] = [];
    const types = Object.keys(typeCount) as (keyof typeof RENDERING_CONFIG.BEACON_COLORS)[];
    
    if (types.length > 1) {
      types.forEach((type, index) => {
        const typeColors = RENDERING_CONFIG.BEACON_COLORS[type];
        const ringRadius = radius + 3 + (index * 2);
        const strokeWidth = Math.max(1, typeCount[type] / beaconCount * 4);
        
        rings.push(
          <Circle
            key={`composition-${type}`}
            cx={screenPosition.x}
            cy={screenPosition.y}
            r={ringRadius}
            fill="none"
            stroke={typeColors.primary}
            strokeWidth={strokeWidth}
            strokeOpacity="0.7"
          />
        );
      });
    }
    
    return rings;
  }, [typeCount, radius, screenPosition, beaconCount]);
  
  // Format beacon count for display
  const displayCount = useMemo(() => {
    if (beaconCount < 10) return beaconCount.toString();
    if (beaconCount < 100) return beaconCount.toString();
    if (beaconCount < 1000) return `${Math.floor(beaconCount / 10)}0+`;
    return `${Math.floor(beaconCount / 100)}00+`;
  }, [beaconCount]);
  
  // Calculate text size based on cluster size
  const textSize = Math.max(8, Math.min(16, radius / 2));
  
  return (
    <G onPress={onPress ? () => onPress(cluster) : undefined}>
      <Defs>
        {/* Cluster gradient */}
        <RadialGradient
          id={`cluster-${cluster.id}`}
          cx="30%"
          cy="30%"
          r="70%"
        >
          <Stop offset="0%" stopColor={colors.secondary} stopOpacity="0.9" />
          <Stop offset="50%" stopColor={colors.primary} stopOpacity="0.8" />
          <Stop offset="100%" stopColor={colors.primary} stopOpacity="0.6" />
        </RadialGradient>
        
        {/* Outer glow */}
        <RadialGradient
          id={`cluster-glow-${cluster.id}`}
          cx="50%"
          cy="50%"
          r="50%"
        >
          <Stop offset="0%" stopColor={colors.glow} stopOpacity="0.3" />
          <Stop offset="70%" stopColor={colors.glow} stopOpacity="0.1" />
          <Stop offset="100%" stopColor={colors.glow} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      
      {/* Outer glow effect */}
      <Circle
        cx={screenPosition.x}
        cy={screenPosition.y}
        r={radius * 1.5}
        fill={`url(#cluster-glow-${cluster.id})`}
      />
      
      {/* Composition rings */}
      {compositionRings}
      
      {/* Main cluster circle */}
      <Circle
        cx={screenPosition.x}
        cy={screenPosition.y}
        r={radius}
        fill={`url(#cluster-${cluster.id})`}
        stroke={colors.primary}
        strokeWidth="2"
        strokeOpacity="0.8"
      />
      
      {/* Beacon count text */}
      <Text
        x={screenPosition.x}
        y={screenPosition.y + textSize / 3} // Offset for better centering
        fontSize={textSize}
        fill="#FFFFFF"
        textAnchor="middle"
        fontWeight="bold"
        fontFamily="monospace"
      >
        {displayCount}
      </Text>
      
      {/* Level indicator (if cluster has high average level) */}
      {cluster.level > 1 && (
        <Circle
          cx={screenPosition.x + radius * 0.7}
          cy={screenPosition.y - radius * 0.7}
          r={Math.max(3, radius / 4)}
          fill={colors.secondary}
          stroke={colors.primary}
          strokeWidth="1"
        />
      )}
      
      {/* Level text */}
      {cluster.level > 1 && (
        <Text
          x={screenPosition.x + radius * 0.7}
          y={screenPosition.y - radius * 0.7 + textSize / 4}
          fontSize={Math.max(6, textSize / 2)}
          fill="#FFFFFF"
          textAnchor="middle"
          fontWeight="bold"
          fontFamily="monospace"
        >
          {cluster.level}
        </Text>
      )}
    </G>
  );
});

BeaconClusterRenderer.displayName = 'BeaconClusterRenderer';

export default BeaconClusterRenderer;