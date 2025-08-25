import { 
  Connection, 
  ConnectionRenderInfo, 
  Beacon, 
  ViewportState, 
  Point2D 
} from '../../types/galaxy';
import { CONNECTION_CONFIG, CONNECTION_COLORS, CURVE_CONFIG } from '../../constants/connections';
import { isPointInHitArea } from '../spatial/viewport';

/**
 * Calculate connection render information based on zoom level and connection properties
 */
export function getConnectionRenderInfo(
  connection: Connection,
  zoom: number,
  isVisible: boolean
): ConnectionRenderInfo {
  // Don't render if not visible or connection is very weak at low zoom
  if (!isVisible || (zoom < 0.5 && connection.strength < 2)) {
    return {
      shouldRender: false,
      lineWidth: 0,
      opacity: 0,
      showAnimation: false,
      showFlow: false,
      isPatternConnection: false,
    };
  }
  
  // Determine LOD level based on zoom
  let lodSettings;
  if (zoom >= CONNECTION_CONFIG.LOD_SETTINGS.FULL_DETAIL.minZoom) {
    lodSettings = CONNECTION_CONFIG.LOD_SETTINGS.FULL_DETAIL;
  } else if (zoom >= CONNECTION_CONFIG.LOD_SETTINGS.STANDARD.minZoom) {
    lodSettings = CONNECTION_CONFIG.LOD_SETTINGS.STANDARD;
  } else if (zoom >= CONNECTION_CONFIG.LOD_SETTINGS.SIMPLIFIED.minZoom) {
    lodSettings = CONNECTION_CONFIG.LOD_SETTINGS.SIMPLIFIED;
  } else {
    lodSettings = CONNECTION_CONFIG.LOD_SETTINGS.HIDDEN;
  }
  
  // Calculate line width based on connection strength
  const strengthMapping = CONNECTION_CONFIG.STRENGTH_MAPPING[connection.strength as keyof typeof CONNECTION_CONFIG.STRENGTH_MAPPING] ||
                         CONNECTION_CONFIG.STRENGTH_MAPPING[1];
  const baseWidth = strengthMapping.width;
  const lineWidth = Math.max(CONNECTION_CONFIG.VISUAL.MIN_WIDTH, 
                            Math.min(CONNECTION_CONFIG.VISUAL.MAX_WIDTH, baseWidth));
  
  // Calculate opacity
  let opacity: number = connection.isActive ? CONNECTION_CONFIG.VISUAL.ACTIVE_OPACITY : CONNECTION_CONFIG.VISUAL.BASE_OPACITY;
  if (connection.patterns.length > 0) {
    opacity = CONNECTION_CONFIG.VISUAL.PATTERN_OPACITY;
  }
  
  // Reduce opacity at lower zoom levels
  if (zoom < 1.0) {
    opacity *= zoom;
  }
  
  const isPatternConnection = connection.patterns.length > 0;
  let patternColor: string | undefined;
  
  if (isPatternConnection && lodSettings.showPatterns) {
    // Use the color of the highest-priority pattern
    const primaryPattern = connection.patterns[0]; // Assuming first pattern is primary
    patternColor = CONNECTION_COLORS.PATTERNS[primaryPattern]?.start;
  }
  
  return {
    shouldRender: true,
    lineWidth,
    opacity: Math.max(0.1, opacity),
    showAnimation: lodSettings.showFlow && connection.isActive,
    showFlow: lodSettings.showFlow,
    isPatternConnection,
    patternColor,
  };
}

/**
 * Check if a connection should be rendered based on viewport culling
 */
export function isConnectionVisible(
  connection: Connection,
  sourceBeacon: Beacon,
  targetBeacon: Beacon,
  viewportState: ViewportState
): boolean {
  const margin = CONNECTION_CONFIG.PERFORMANCE.CULLING_MARGIN;
  
  // Expand viewport bounds by margin for culling
  const expandedBounds = {
    minX: viewportState.bounds.minX - margin,
    maxX: viewportState.bounds.maxX + margin,
    minY: viewportState.bounds.minY - margin,
    maxY: viewportState.bounds.maxY + margin,
  };
  
  // Check if either endpoint is within the expanded viewport
  const sourceVisible = (
    sourceBeacon.position.x >= expandedBounds.minX &&
    sourceBeacon.position.x <= expandedBounds.maxX &&
    sourceBeacon.position.y >= expandedBounds.minY &&
    sourceBeacon.position.y <= expandedBounds.maxY
  );
  
  const targetVisible = (
    targetBeacon.position.x >= expandedBounds.minX &&
    targetBeacon.position.x <= expandedBounds.maxX &&
    targetBeacon.position.y >= expandedBounds.minY &&
    targetBeacon.position.y <= expandedBounds.maxY
  );
  
  // Render if either endpoint is visible
  if (sourceVisible || targetVisible) return true;
  
  // Check if the connection line intersects the viewport (for very long connections)
  return lineIntersectsRect(
    sourceBeacon.position,
    targetBeacon.position,
    expandedBounds
  );
}

/**
 * Check if a line segment intersects a rectangle
 */
function lineIntersectsRect(
  start: Point2D,
  end: Point2D,
  rect: { minX: number; maxX: number; minY: number; maxY: number }
): boolean {
  // Simple bounding box check first
  const lineMinX = Math.min(start.x, end.x);
  const lineMaxX = Math.max(start.x, end.x);
  const lineMinY = Math.min(start.y, end.y);
  const lineMaxY = Math.max(start.y, end.y);
  
  if (lineMaxX < rect.minX || lineMinX > rect.maxX ||
      lineMaxY < rect.minY || lineMinY > rect.maxY) {
    return false;
  }
  
  // If line bounding box intersects rect, assume intersection for performance
  return true;
}

/**
 * Calculate bezier curve control points for a connection
 */
export function calculateConnectionCurve(
  source: Point2D,
  target: Point2D,
  strength: number = 1,
  connectionId?: string
): { start: Point2D; control1: Point2D; control2: Point2D; end: Point2D } {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Calculate perpendicular vector for curve offset
  const perpX = -dy / distance;
  const perpY = dx / distance;
  
  // Calculate curve offset based on distance and strength
  let curveOffset = distance * CURVE_CONFIG.CONTROL_POINT_OFFSET;
  curveOffset = Math.min(curveOffset, CURVE_CONFIG.MAX_CURVE_DEVIATION);
  curveOffset = Math.max(curveOffset, CURVE_CONFIG.MIN_CURVE_OFFSET);
  
  // Add variation based on connection strength
  curveOffset *= (1 + strength * CURVE_CONFIG.CURVE_VARIATION);
  
  // Alternate curve direction based on connection properties for visual variety
  // Use connection ID for stable direction if available, otherwise fall back to coordinate-based
  const direction = connectionId 
    ? (connectionId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 2 === 0 ? 1 : -1)
    : (Math.sin(source.x + target.x + source.y + target.y) > 0 ? 1 : -1);
  curveOffset *= direction;
  
  // Calculate control points
  const control1 = {
    x: source.x + dx * 0.25 + perpX * curveOffset * 0.5,
    y: source.y + dy * 0.25 + perpY * curveOffset * 0.5,
  };
  
  const control2 = {
    x: source.x + dx * 0.75 + perpX * curveOffset * 0.5,
    y: source.y + dy * 0.75 + perpY * curveOffset * 0.5,
  };
  
  return {
    start: source,
    control1,
    control2,
    end: target,
  };
}

/**
 * Generate SVG path string for a bezier curve connection
 */
export function generateConnectionPath(
  source: Point2D,
  target: Point2D,
  strength: number = 1,
  connectionId?: string
): string {
  const curve = calculateConnectionCurve(source, target, strength, connectionId);
  
  return `M ${curve.start.x} ${curve.start.y} ` +
         `C ${curve.control1.x} ${curve.control1.y}, ` +
         `${curve.control2.x} ${curve.control2.y}, ` +
         `${curve.end.x} ${curve.end.y}`;
}

/**
 * Calculate connection distance for performance sorting
 */
export function calculateConnectionDistance(
  connection: Connection,
  sourceBeacon: Beacon,
  targetBeacon: Beacon
): number {
  const dx = targetBeacon.position.x - sourceBeacon.position.x;
  const dy = targetBeacon.position.y - sourceBeacon.position.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Sort connections by priority for performance-limited rendering
 */
export function prioritizeConnections(
  connections: { connection: Connection; source: Beacon; target: Beacon }[]
): { connection: Connection; source: Beacon; target: Beacon }[] {
  return connections.sort((a, b) => {
    // Prioritize pattern connections
    if (a.connection.patterns.length > 0 && b.connection.patterns.length === 0) return -1;
    if (a.connection.patterns.length === 0 && b.connection.patterns.length > 0) return 1;
    
    // Then prioritize by strength
    if (a.connection.strength !== b.connection.strength) {
      return b.connection.strength - a.connection.strength;
    }
    
    // Then prioritize active connections
    if (a.connection.isActive !== b.connection.isActive) {
      return a.connection.isActive ? -1 : 1;
    }
    
    // Finally, prioritize shorter connections (closer objects)
    const distanceA = calculateConnectionDistance(a.connection, a.source, a.target);
    const distanceB = calculateConnectionDistance(b.connection, b.source, b.target);
    return distanceA - distanceB;
  });
}

/**
 * Check if a point is near a connection line for interaction
 */
export function isPointNearConnection(
  point: Point2D,
  source: Point2D,
  target: Point2D,
  hitRadius: number = 10
): boolean {
  // Use point-to-line distance calculation
  const A = point.x - source.x;
  const B = point.y - source.y;
  const C = target.x - source.x;
  const D = target.y - source.y;
  
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  
  if (lenSq === 0) {
    // Source and target are the same point
    return isPointInHitArea(point, source, hitRadius);
  }
  
  const param = dot / lenSq;
  
  let closestPoint: Point2D;
  if (param < 0) {
    closestPoint = source;
  } else if (param > 1) {
    closestPoint = target;
  } else {
    closestPoint = {
      x: source.x + param * C,
      y: source.y + param * D,
    };
  }
  
  return isPointInHitArea(point, closestPoint, hitRadius);
}