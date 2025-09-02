import {
  Point2D,
  ViewportBounds,
  ViewportState,
  GestureVelocity,
} from '../../types/galaxy';

/**
 * Convert screen coordinates to galaxy coordinates
 */
export function screenToGalaxy(
  screenPoint: Point2D,
  viewport: ViewportState
): Point2D {
  return {
    x: (screenPoint.x - viewport.translateX) / viewport.scale,
    y: (screenPoint.y - viewport.translateY) / viewport.scale,
  };
}

/**
 * Convert galaxy coordinates to screen coordinates
 */
export function galaxyToScreen(
  galaxyPoint: Point2D,
  viewport: ViewportState
): Point2D {
  return {
    x: galaxyPoint.x * viewport.scale + viewport.translateX,
    y: galaxyPoint.y * viewport.scale + viewport.translateY,
  };
}

/**
 * Calculate visible bounds in galaxy coordinates
 */
export function calculateVisibleBounds(
  screenWidth: number,
  screenHeight: number,
  viewport: ViewportState
): ViewportBounds {
  const topLeft = screenToGalaxy({ x: 0, y: 0 }, viewport);
  const bottomRight = screenToGalaxy(
    { x: screenWidth, y: screenHeight },
    viewport
  );

  return {
    minX: topLeft.x,
    maxX: bottomRight.x,
    minY: topLeft.y,
    maxY: bottomRight.y,
  };
}

/**
 * Check if a point is visible within the viewport bounds
 */
export function isPointVisible(
  point: Point2D,
  bounds: ViewportBounds,
  margin: number = 0
): boolean {
  return (
    point.x >= bounds.minX - margin &&
    point.x <= bounds.maxX + margin &&
    point.y >= bounds.minY - margin &&
    point.y <= bounds.maxY + margin
  );
}

/**
 * Clamp scale value within reasonable bounds
 */
export function clampScale(scale: number): number {
  'worklet';
  const MIN_SCALE = 0.1;
  const MAX_SCALE = 10.0;
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
}

/**
 * Calculate optimal translation to keep content centered
 */
export function calculateCenteredTranslation(
  screenWidth: number,
  screenHeight: number,
  contentWidth: number,
  contentHeight: number,
  scale: number
): Point2D {
  const scaledContentWidth = contentWidth * scale;
  const scaledContentHeight = contentHeight * scale;

  return {
    x: (screenWidth - scaledContentWidth) / 2,
    y: (screenHeight - scaledContentHeight) / 2,
  };
}

/**
 * Apply bounds constraints to translation values
 */
export function constrainTranslation(
  translation: Point2D,
  screenWidth: number,
  screenHeight: number,
  contentWidth: number,
  contentHeight: number,
  scale: number
): Point2D {
  const scaledContentWidth = contentWidth * scale;
  const scaledContentHeight = contentHeight * scale;

  // Don't constrain if content is smaller than screen
  if (
    scaledContentWidth <= screenWidth &&
    scaledContentHeight <= screenHeight
  ) {
    return translation;
  }

  const minX = screenWidth - scaledContentWidth;
  const maxX = 0;
  const minY = screenHeight - scaledContentHeight;
  const maxY = 0;

  return {
    x: Math.max(minX, Math.min(maxX, translation.x)),
    y: Math.max(minY, Math.min(maxY, translation.y)),
  };
}

/**
 * Apply elastic bounds constraints with rubber band effect
 */
export function constrainTranslationElastic(
  translation: Point2D,
  screenWidth: number,
  screenHeight: number,
  contentWidth: number,
  contentHeight: number,
  scale: number,
  elasticity: number = 0.3
): Point2D {
  'worklet';
  const scaledContentWidth = contentWidth * scale;
  const scaledContentHeight = contentHeight * scale;

  // Don't constrain if content is smaller than screen
  if (
    scaledContentWidth <= screenWidth &&
    scaledContentHeight <= screenHeight
  ) {
    return translation;
  }

  const minX = screenWidth - scaledContentWidth;
  const maxX = 0;
  const minY = screenHeight - scaledContentHeight;
  const maxY = 0;

  let x = translation.x;
  let y = translation.y;

  // Apply elastic resistance when exceeding bounds
  if (x > maxX) {
    const overflow = x - maxX;
    x = maxX + overflow * elasticity;
  } else if (x < minX) {
    const overflow = minX - x;
    x = minX - overflow * elasticity;
  }

  if (y > maxY) {
    const overflow = y - maxY;
    y = maxY + overflow * elasticity;
  } else if (y < minY) {
    const overflow = minY - y;
    y = minY - overflow * elasticity;
  }

  return { x, y };
}

/**
 * Calculate momentum decay factor
 */
export function calculateMomentumDecay(
  velocity: number,
  decayRate: number = 0.95
): number {
  'worklet';
  return velocity * decayRate;
}

/**
 * Apply momentum to translation with boundary constraints using configurable physics
 */
export function applyMomentum(
  currentTranslation: Point2D,
  velocity: GestureVelocity,
  screenWidth: number,
  screenHeight: number,
  contentWidth: number,
  contentHeight: number,
  scale: number,
  deltaTime: number
): { translation: Point2D; newVelocity: GestureVelocity } {
  'worklet';

  // Get momentum configuration (note: gestureConfig access in worklet context)
  // For worklet safety, we'll use hardcoded optimized values based on research
  const decayRate = 0.95; // Research-based deceleration factor
  const boundaryDamping = 0.1; // Velocity reduction at boundaries

  // Apply velocity to translation
  const newTranslation = {
    x: currentTranslation.x + velocity.x * deltaTime,
    y: currentTranslation.y + velocity.y * deltaTime,
  };

  // Apply elastic constraints
  const constrainedTranslation = constrainTranslationElastic(
    newTranslation,
    screenWidth,
    screenHeight,
    contentWidth,
    contentHeight,
    scale
  );

  // Reduce velocity if hitting boundaries
  let newVelocity = { ...velocity };
  const scaledContentWidth = contentWidth * scale;
  const scaledContentHeight = contentHeight * scale;

  if (scaledContentWidth > screenWidth) {
    const minX = screenWidth - scaledContentWidth;
    const maxX = 0;

    if (
      (constrainedTranslation.x <= minX && velocity.x < 0) ||
      (constrainedTranslation.x >= maxX && velocity.x > 0)
    ) {
      newVelocity.x *= boundaryDamping; // Use configurable boundary damping
    }
  }

  if (scaledContentHeight > screenHeight) {
    const minY = screenHeight - scaledContentHeight;
    const maxY = 0;

    if (
      (constrainedTranslation.y <= minY && velocity.y < 0) ||
      (constrainedTranslation.y >= maxY && velocity.y > 0)
    ) {
      newVelocity.y *= boundaryDamping; // Use configurable boundary damping
    }
  }

  // Apply configurable decay rate
  newVelocity.x = newVelocity.x * decayRate;
  newVelocity.y = newVelocity.y * decayRate;

  return {
    translation: constrainedTranslation,
    newVelocity,
  };
}

/**
 * Calculate focal point for zoom gestures
 */
export function calculateZoomFocalPoint(
  focalPoint: Point2D,
  currentTranslation: Point2D,
  currentScale: number,
  newScale: number
): Point2D {
  'worklet';
  const scaleDiff = newScale - currentScale;

  return {
    x:
      currentTranslation.x -
      (focalPoint.x - currentTranslation.x) * (scaleDiff / currentScale),
    y:
      currentTranslation.y -
      (focalPoint.y - currentTranslation.y) * (scaleDiff / currentScale),
  };
}

/**
 * Check if velocity is below threshold (momentum stopped) using configurable thresholds
 */
export function isVelocityInsignificant(
  velocity: GestureVelocity,
  threshold: number = 0.1
): boolean {
  'worklet';
  // Use research-based minimum velocity threshold if no threshold provided
  const actualThreshold = threshold || 0.1;
  return (
    Math.abs(velocity.x) < actualThreshold &&
    Math.abs(velocity.y) < actualThreshold
  );
}

/**
 * Calculate distance between two points
 */
export function distanceBetweenPoints(p1: Point2D, p2: Point2D): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Check if a point is within a circular hit area
 */
export function isPointInHitArea(
  point: Point2D,
  target: Point2D,
  radius: number
): boolean {
  return distanceBetweenPoints(point, target) <= radius;
}

/**
 * Get dynamic hit radius based on zoom level using gesture configuration
 */
export function getConfiguredHitRadius(
  baseRadius: number,
  scale: number
): number {
  // This function should ideally access gestureConfig, but for worklet safety
  // we'll use the hardcoded research-based values
  const minRadius = 15;
  const maxRadius = 50;
  const scaleFactor = 0.8;

  const scaleAdjustedRadius = Math.max(
    minRadius,
    Math.min(maxRadius, baseRadius / (scale * scaleFactor))
  );

  return scaleAdjustedRadius;
}

/**
 * Apply velocity smoothing using exponential moving average (worklet-safe)
 */
export function smoothVelocityWorklet(
  currentVelocity: GestureVelocity,
  previousVelocity: GestureVelocity
): GestureVelocity {
  'worklet';

  // Research-based EMA configuration (hardcoded for worklet safety)
  const alpha = 0.2;
  const spikeThreshold = 100;

  // Detect velocity spikes (finger lift artifacts)
  const deltaX = Math.abs(currentVelocity.x - previousVelocity.x);
  const deltaY = Math.abs(currentVelocity.y - previousVelocity.y);

  if (deltaX > spikeThreshold || deltaY > spikeThreshold) {
    // Use previous velocity if current seems like finger-lift artifact
    return previousVelocity;
  }

  // Apply exponential moving average
  return {
    x: alpha * currentVelocity.x + (1 - alpha) * previousVelocity.x,
    y: alpha * currentVelocity.y + (1 - alpha) * previousVelocity.y,
  };
}

/**
 * Check if velocity is significant for momentum (worklet-safe)
 */
export function isVelocitySignificantForMomentum(
  velocity: GestureVelocity
): boolean {
  'worklet';

  // Research-based velocity threshold (150px/s)
  const threshold = 150;
  const magnitude = Math.sqrt(
    velocity.x * velocity.x + velocity.y * velocity.y
  );
  return magnitude > threshold;
}
