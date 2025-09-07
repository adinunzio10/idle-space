/**
 * TypeScript declarations for specialized spatial Jest matchers
 * 
 * Provides type safety and IntelliSense support for custom Jest matchers
 * used in galaxy map spatial interface testing.
 */

declare namespace jest {
  interface Matchers<R> {
    // === EXISTING MATCHERS ===
    toBeWithinPerformanceRange(min: number, max: number): R;
    toBeCloseToCoordinate(expected: { x: number; y: number }, precision?: number): R;
    toBeValidViewportState(): R;

    // === SPECIALIZED SPATIAL MATCHERS ===

    /**
     * Validates coordinate precision with floating-point accuracy
     * Handles extreme zoom levels and precision requirements
     */
    toBeWithinCoordinatePrecision(
      expected: { x: number; y: number },
      precision?: number
    ): R;

    /**
     * Validates 2D transformation matrix properties
     * Checks invertibility, finite values, and safe scale limits
     */
    toBeValidTransformationMatrix(): R;

    /**
     * Validates viewport bounds against constraints
     * Checks scale limits, translation bounds, and consistency
     */
    toHaveValidViewportBounds(constraints?: {
      maxScale?: number;
      minScale?: number;
      maxTranslation?: { x: number; y: number };
    }): R;

    /**
     * Validates viewport calculation accuracy with tolerance
     * Compares calculated vs expected viewport bounds and dimensions
     */
    toBeWithinViewportCalculationTolerance(
      expected: {
        visibleBounds?: { minX: number; maxX: number; minY: number; maxY: number };
        scaledDimensions?: { width: number; height: number };
      },
      tolerance?: number
    ): R;

    /**
     * Validates gesture physics accuracy
     * Checks momentum decay, friction, and elastic behavior
     */
    toHaveAccurateGesturePhysics(): R;

    /**
     * Validates gesture timing meets performance requirements
     * Checks frame rate, jitter, and dropped frame percentage
     */
    toMeetGestureTimingRequirements(requirements: {
      minFrameRate?: number;
      maxFrameJitter?: number;
      maxDroppedFramePercentage?: number;
    }): R;

    /**
     * Validates scale limit enforcement
     * Checks clamping behavior and precision
     */
    toRespectScaleLimits(): R;

    /**
     * Validates coordinate system consistency
     * Checks screen-to-world coordinate transformations
     */
    toHaveConsistentCoordinateSystem(): R;

    /**
     * Validates spatial operation performance bounds
     * Checks execution time, memory usage, and FPS impact
     */
    toCompleteWithinSpatialPerformanceBounds(requirements: {
      maxExecutionTime?: number;
      maxMemoryUsage?: number;
      targetFPS?: number;
    }): R;
  }
}

// Export interface for use in test files
export interface SpatialMatcherConstraints {
  viewport?: {
    maxScale?: number;
    minScale?: number;
    maxTranslation?: { x: number; y: number };
  };
  timing?: {
    minFrameRate?: number;
    maxFrameJitter?: number;
    maxDroppedFramePercentage?: number;
  };
  performance?: {
    maxExecutionTime?: number;
    maxMemoryUsage?: number;
    targetFPS?: number;
  };
}

export interface CoordinateSystemData {
  screenCoordinates: { x: number; y: number };
  worldCoordinates: { x: number; y: number };
  viewport: {
    translateX: number;
    translateY: number;
    scale: number;
    bounds: { minX: number; maxX: number; minY: number; maxY: number };
  };
}

export interface GesturePhysicsData {
  phases?: Array<{
    phase: 'active' | 'momentum';
    velocity: { x: number; y: number };
  }>;
  friction?: number;
  overscrollPhase?: {
    maxOverscroll?: { x: number; y: number };
    elasticity?: number;
    settleDuration?: number;
  };
}

export interface ScaleConstraintData {
  currentScale: number;
  targetScale: number;
  limits: { min: number; max: number };
  enforcedScale: number;
  precision?: number;
}

export interface TransformationMatrix2D {
  a: number; // X scale
  b: number; // X skew
  c: number; // Y skew  
  d: number; // Y scale
  tx: number; // X translation
  ty: number; // Y translation
}

export interface ViewportCalculationResult {
  visibleBounds?: { minX: number; maxX: number; minY: number; maxY: number };
  scaledDimensions?: { width: number; height: number };
}

export interface GestureTimingData {
  expectedFrameRate?: number;
  actualFrameRate: number;
  frameJitter: number;
  droppedFrames: number;
  totalFrames: number;
}