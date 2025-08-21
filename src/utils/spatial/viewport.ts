import { Point2D, ViewportBounds, ViewportState, GestureVelocity } from '../../types/galaxy';

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
  if (scaledContentWidth <= screenWidth && scaledContentHeight <= screenHeight) {
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
  if (scaledContentWidth <= screenWidth && scaledContentHeight <= screenHeight) {
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
export function calculateMomentumDecay(velocity: number, decayRate: number = 0.95): number {
  return velocity * decayRate;
}

/**
 * Apply momentum to translation with boundary constraints
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
    
    if ((constrainedTranslation.x <= minX && velocity.x < 0) || 
        (constrainedTranslation.x >= maxX && velocity.x > 0)) {
      newVelocity.x *= 0.1; // Dampen velocity when hitting bounds
    }
  }

  if (scaledContentHeight > screenHeight) {
    const minY = screenHeight - scaledContentHeight;
    const maxY = 0;
    
    if ((constrainedTranslation.y <= minY && velocity.y < 0) || 
        (constrainedTranslation.y >= maxY && velocity.y > 0)) {
      newVelocity.y *= 0.1; // Dampen velocity when hitting bounds
    }
  }

  // Apply decay
  newVelocity.x = calculateMomentumDecay(newVelocity.x);
  newVelocity.y = calculateMomentumDecay(newVelocity.y);

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
    x: currentTranslation.x - (focalPoint.x - currentTranslation.x) * (scaleDiff / currentScale),
    y: currentTranslation.y - (focalPoint.y - currentTranslation.y) * (scaleDiff / currentScale),
  };
}

/**
 * Check if velocity is below threshold (momentum stopped)
 */
export function isVelocityInsignificant(velocity: GestureVelocity, threshold: number = 0.1): boolean {
  'worklet';
  return Math.abs(velocity.x) < threshold && Math.abs(velocity.y) < threshold;
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