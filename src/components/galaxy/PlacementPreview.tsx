import React, { useMemo } from 'react';
import { G, Circle, Path, Line } from 'react-native-svg';
import { Point2D, ViewportState } from '../../types/galaxy';
import { BeaconType, BeaconPlacementInfo } from '../../types/beacon';
import { Beacon } from '../../entities/Beacon';
import { galaxyToScreen } from '../../utils/spatial/viewport';
import { VoronoiVisualizer } from '../../utils/rendering/voronoi';

interface PlacementPreviewProps {
  placementInfo: BeaconPlacementInfo;
  viewportState: ViewportState;
  nearbyBeacons: Beacon[];
  showConnectionPreview: boolean;
  showTerritoryPreview: boolean;
  opacity?: number;
}

export const PlacementPreview: React.FC<PlacementPreviewProps> = ({
  placementInfo,
  viewportState,
  nearbyBeacons,
  showConnectionPreview = true,
  showTerritoryPreview = true,
  opacity = 0.7,
}) => {
  const screenPosition = useMemo(
    () => galaxyToScreen(placementInfo.position, viewportState),
    [placementInfo.position, viewportState]
  );

  const validationColor = placementInfo.isValid ? '#10B981' : '#EF4444'; // Green or red
  const territoryColor = placementInfo.isValid ? '#10B981' : '#F59E0B'; // Green or orange

  // Generate connection preview lines
  const connectionPreviews = useMemo(() => {
    if (!showConnectionPreview) return null;

    return placementInfo.estimatedConnections
      .map(beaconId => {
        const beacon = nearbyBeacons.find(b => b.id === beaconId);
        if (!beacon) return null;

        const targetScreen = galaxyToScreen(beacon.position, viewportState);
        const distance = Math.sqrt(
          Math.pow(placementInfo.position.x - beacon.position.x, 2) +
            Math.pow(placementInfo.position.y - beacon.position.y, 2)
        );

        // Connection strength affects line style
        const alpha = Math.max(0.3, 1.0 - distance / 300);

        return (
          <Line
            key={`preview-connection-${beaconId}`}
            x1={screenPosition.x}
            y1={screenPosition.y}
            x2={targetScreen.x}
            y2={targetScreen.y}
            stroke={validationColor}
            strokeWidth="2"
            strokeOpacity={alpha * opacity}
            strokeDasharray="5,5"
          />
        );
      })
      .filter(Boolean);
  }, [
    showConnectionPreview,
    placementInfo.estimatedConnections,
    placementInfo.position,
    nearbyBeacons,
    screenPosition,
    viewportState,
    validationColor,
    opacity,
  ]);

  // Generate territory preview (simplified circle)
  const territoryPreview = useMemo(() => {
    if (!showTerritoryPreview) return null;

    const territoryRadius = placementInfo.territoryRadius * viewportState.scale;

    return (
      <Circle
        cx={screenPosition.x}
        cy={screenPosition.y}
        r={territoryRadius}
        fill={territoryColor}
        fillOpacity={0.1 * opacity}
        stroke={territoryColor}
        strokeWidth="1"
        strokeOpacity={0.3 * opacity}
        strokeDasharray="3,3"
      />
    );
  }, [
    showTerritoryPreview,
    placementInfo.territoryRadius,
    screenPosition,
    viewportState.scale,
    territoryColor,
    opacity,
  ]);

  // Ghost beacon preview
  const beaconPreview = useMemo(() => {
    const size = 24 * viewportState.scale; // Base beacon size
    const halfSize = size / 2;

    return (
      <G>
        {/* Outer glow */}
        <Circle
          cx={screenPosition.x}
          cy={screenPosition.y}
          r={size}
          fill={validationColor}
          fillOpacity={0.2 * opacity}
        />

        {/* Main beacon shape based on type */}
        {placementInfo.type === 'pioneer' && (
          <Path
            d={`M ${screenPosition.x} ${screenPosition.y - halfSize} 
                L ${screenPosition.x + halfSize} ${screenPosition.y} 
                L ${screenPosition.x} ${screenPosition.y + halfSize} 
                L ${screenPosition.x - halfSize} ${screenPosition.y} 
                Z`}
            fill={validationColor}
            fillOpacity={opacity}
            stroke={validationColor}
            strokeWidth="2"
          />
        )}

        {placementInfo.type === 'harvester' && (
          <Circle
            cx={screenPosition.x}
            cy={screenPosition.y}
            r={halfSize}
            fill={validationColor}
            fillOpacity={opacity}
            stroke={validationColor}
            strokeWidth="2"
          />
        )}

        {placementInfo.type === 'architect' && (
          <Path
            d={generateHexagonPath(screenPosition, halfSize)}
            fill={validationColor}
            fillOpacity={opacity}
            stroke={validationColor}
            strokeWidth="2"
          />
        )}
      </G>
    );
  }, [
    placementInfo.type,
    screenPosition,
    viewportState.scale,
    validationColor,
    opacity,
  ]);

  // Validation feedback text
  const validationFeedback = useMemo(() => {
    if (placementInfo.isValid) return null;

    const textY = screenPosition.y + 40;
    const maxReasons = 2; // Show max 2 reasons to avoid cluttering

    return placementInfo.validationReasons
      .slice(0, maxReasons)
      .map((reason, index) => (
        <text
          key={`validation-${index}`}
          x={screenPosition.x}
          y={textY + index * 16}
          textAnchor="middle"
          fontSize="12"
          fill="#EF4444"
          fillOpacity={opacity}
        >
          {reason}
        </text>
      ));
  }, [
    placementInfo.isValid,
    placementInfo.validationReasons,
    screenPosition,
    opacity,
  ]);

  return (
    <G opacity={opacity}>
      {/* Territory preview */}
      {territoryPreview}

      {/* Connection previews */}
      {connectionPreviews}

      {/* Ghost beacon */}
      {beaconPreview}

      {/* Validation feedback */}
      {validationFeedback}
    </G>
  );
};

/**
 * Generate hexagon path for architect beacon preview
 */
function generateHexagonPath(center: Point2D, radius: number): string {
  const points: Point2D[] = [];

  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    const x = center.x + radius * Math.cos(angle);
    const y = center.y + radius * Math.sin(angle);
    points.push({ x, y });
  }

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i].x} ${points[i].y}`;
  }
  path += ' Z';

  return path;
}

export default PlacementPreview;
