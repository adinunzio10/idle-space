import { Point2D, ViewportBounds, ViewportState } from '../../types/galaxy';

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