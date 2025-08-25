import React, { memo, useMemo } from 'react';
import {
  Path,
  Defs,
  LinearGradient,
  Stop,
  G,
} from 'react-native-svg';

import { 
  Connection, 
  Beacon, 
  ViewportState, 
  ConnectionRenderInfo 
} from '../../types/galaxy';
import { CONNECTION_COLORS } from '../../constants/connections';
import { galaxyToScreen } from '../../utils/spatial/viewport';
import { generateConnectionPath } from '../../utils/rendering/connections';

interface ConnectionRendererProps {
  connection: Connection;
  sourceBeacon: Beacon;
  targetBeacon: Beacon;
  renderInfo: ConnectionRenderInfo;
  viewportState: ViewportState;
  onPress?: (connection: Connection) => void;
}

export const ConnectionRenderer: React.FC<ConnectionRendererProps> = memo(({
  connection,
  sourceBeacon,
  targetBeacon,
  renderInfo,
  viewportState,
  onPress,
}) => {
  // Convert galaxy coordinates to screen coordinates
  const sourceScreen = galaxyToScreen(sourceBeacon.position, viewportState);
  const targetScreen = galaxyToScreen(targetBeacon.position, viewportState);

  // Generate the SVG path for the connection
  const pathData = useMemo(() => {
    return generateConnectionPath(sourceScreen, targetScreen, connection.strength, connection.id);
  }, [sourceScreen, targetScreen, connection.strength, connection.id]);

  // Determine colors based on connection state and patterns
  const colors = useMemo(() => {
    if (renderInfo.isPatternConnection && renderInfo.patternColor) {
      // Use pattern-specific colors
      const patternType = connection.patterns[0];
      return CONNECTION_COLORS.PATTERNS[patternType] || CONNECTION_COLORS.DEFAULT;
    } else if (connection.strength >= 4) {
      return CONNECTION_COLORS.STRONG;
    } else if (!connection.isActive) {
      return CONNECTION_COLORS.INACTIVE;
    } else {
      return CONNECTION_COLORS.DEFAULT;
    }
  }, [renderInfo.isPatternConnection, renderInfo.patternColor, connection.patterns, connection.strength, connection.isActive]);

  // Don't render if not supposed to
  if (!renderInfo.shouldRender) {
    return null;
  }

  // Create gradient ID
  const gradientId = `connection-gradient-${connection.id}`;

  return (
    <G onPress={onPress ? () => onPress(connection) : undefined}>
      <Defs>
        {/* Main connection gradient */}
        <LinearGradient
          id={gradientId}
          x1="0%"
          y1="0%"
          x2="100%"
          y2="0%"
        >
          <Stop offset="0%" stopColor={colors.start} stopOpacity={renderInfo.opacity} />
          <Stop offset="50%" stopColor={colors.flow} stopOpacity={renderInfo.opacity * 0.9} />
          <Stop offset="100%" stopColor={colors.end} stopOpacity={renderInfo.opacity} />
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

      {/* Glow effect for strong connections */}
      {renderInfo.showFlow && connection.strength >= 3 && (
        <Path
          d={pathData}
          stroke={`url(#${gradientId}-glow)`}
          strokeWidth={renderInfo.lineWidth + 2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* Main connection line */}
      <Path
        d={pathData}
        stroke={`url(#${gradientId})`}
        strokeWidth={renderInfo.lineWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={renderInfo.opacity}
      />

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
});

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

const FlowEffect: React.FC<FlowEffectProps> = memo(({
  pathData,
  colors,
  lineWidth,
  connectionId,
}) => {
  const flowGradientId = `flow-${connectionId}`;
  
  return (
    <>
      <Defs>
        <LinearGradient
          id={flowGradientId}
          x1="0%"
          y1="0%"
          x2="100%"
          y2="0%"
        >
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
});

FlowEffect.displayName = 'FlowEffect';

export default ConnectionRenderer;