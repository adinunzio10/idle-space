# Specialized Spatial Jest Matchers

This document provides comprehensive documentation for the specialized spatial Jest matchers implemented for galaxy map testing.

## Overview

Task 1.4 has successfully implemented a comprehensive suite of specialized Jest matchers for spatial calculations, coordinate transformations, and viewport validation specifically designed for the galaxy map interface. These matchers extend Jest's `expect()` functionality with domain-specific assertions.

## Implementation Approach

The implementation follows strict **Test-Driven Development (TDD)** methodology:

1. **RED Phase**: Created failing tests in `SpatialMatchers.test.tsx` (18 unit tests)
2. **GREEN Phase**: Implemented all 9 specialized matchers in `jest-setup.js`
3. **REFACTOR Phase**: Added integration tests and TypeScript declarations

## Available Matchers

### 1. `toBeWithinCoordinatePrecision(expected, precision)`

**Purpose**: Validates coordinate precision with floating-point accuracy, handling extreme zoom levels.

```typescript
expect({ x: 100.123456789, y: 200.987654321 })
  .toBeWithinCoordinatePrecision({ x: 100.123456788, y: 200.987654320 }, 1e-8);
```

**Features**:
- Handles floating-point edge cases with `Number.EPSILON`
- Supports extreme zoom level precision requirements
- Validates coordinates near floating-point limits

### 2. `toBeValidTransformationMatrix()`

**Purpose**: Validates 2D transformation matrix properties including invertibility and safe scale limits.

```typescript
expect({
  a: 1.5, b: 0, c: 0, d: 1.5,
  tx: 100, ty: 150
}).toBeValidTransformationMatrix();
```

**Features**:
- Checks matrix invertibility (determinant ≠ 0)
- Validates finite values (no NaN or Infinity)
- Enforces safe scale limits (< 1e6) to prevent precision issues

### 3. `toHaveValidViewportBounds(constraints)`

**Purpose**: Validates viewport bounds against scale and translation constraints.

```typescript
expect(viewport).toHaveValidViewportBounds({
  maxScale: 10,
  minScale: 0.1,
  maxTranslation: { x: 2000, y: 1500 }
});
```

**Features**:
- Scale constraint validation
- Translation boundary enforcement
- Bounds consistency checking

### 4. `toBeWithinViewportCalculationTolerance(expected, tolerance)`

**Purpose**: Validates viewport calculation accuracy with configurable tolerance.

```typescript
expect(calculatedViewport).toBeWithinViewportCalculationTolerance(expectedViewport, 0.05);
```

**Features**:
- Visible bounds comparison
- Scaled dimensions validation
- Configurable floating-point tolerance

### 5. `toHaveAccurateGesturePhysics()`

**Purpose**: Validates gesture momentum physics with friction and elastic behavior.

```typescript
expect({
  phases: [
    { phase: 'momentum', velocity: { x: 475, y: 285 } },
    { phase: 'momentum', velocity: { x: 451, y: 270 } }
  ],
  friction: 0.95
}).toHaveAccurateGesturePhysics();
```

**Features**:
- Momentum phase velocity decay validation
- Friction consistency checking
- Elastic boundary behavior validation

### 6. `toMeetGestureTimingRequirements(requirements)`

**Purpose**: Validates gesture timing meets performance requirements.

```typescript
expect(timingData).toMeetGestureTimingRequirements({
  minFrameRate: 55,
  maxFrameJitter: 1.0,
  maxDroppedFramePercentage: 0.05
});
```

**Features**:
- Frame rate validation
- Frame jitter checking
- Dropped frame percentage calculation

### 7. `toRespectScaleLimits()`

**Purpose**: Validates scale constraint enforcement with floating-point precision.

```typescript
expect({
  currentScale: 0.5,
  targetScale: 0.1,
  limits: { min: 0.1, max: 10 },
  enforcedScale: 0.1
}).toRespectScaleLimits();
```

**Features**:
- Scale clamping validation
- Floating-point precision handling
- Limit validation

### 8. `toHaveConsistentCoordinateSystem()`

**Purpose**: Validates coordinate system transformation consistency.

```typescript
expect({
  screenCoordinates: { x: 200, y: 300 },
  worldCoordinates: { x: 200, y: 300 },
  viewport: { translateX: 100, translateY: 150, scale: 0.5, bounds: {...} }
}).toHaveConsistentCoordinateSystem();
```

**Features**:
- Screen-to-world coordinate transformation validation
- Scale-based precision adjustment
- Viewport bounds consistency checking

### 9. `toCompleteWithinSpatialPerformanceBounds(requirements)`

**Purpose**: Validates spatial operation performance bounds for regression detection.

```typescript
expect(spatialOperation).toCompleteWithinSpatialPerformanceBounds({
  maxExecutionTime: 16, // One frame at 60fps
  maxMemoryUsage: 1024 * 50, // 50KB
  targetFPS: 60
});
```

**Features**:
- Execution time measurement
- Memory usage tracking
- FPS impact calculation
- Performance regression detection

## Test Files

### Unit Tests: `SpatialMatchers.test.tsx`
- 18 comprehensive unit tests
- Covers all matcher functionality
- Edge case validation
- Error condition testing

### Integration Tests: `SpatialMatchers.Integration.test.tsx`
- 11 real-world scenario tests
- Complex gesture sequences
- Multi-touch interactions
- Complete galaxy map workflows

## TypeScript Support

TypeScript declarations are provided in `/src/types/spatial-matchers.d.ts`:

```typescript
declare namespace jest {
  interface Matchers<R> {
    toBeWithinCoordinatePrecision(expected: { x: number; y: number }, precision?: number): R;
    toBeValidTransformationMatrix(): R;
    // ... all other matchers
  }
}
```

## Usage Examples

### Basic Coordinate Validation
```typescript
const coordinate = { x: 123.456789, y: 234.567890 };
const target = { x: 123.456788, y: 234.567889 };
expect(coordinate).toBeWithinCoordinatePrecision(target, 1e-5);
```

### Viewport State Validation
```typescript
const viewport: ViewportState = {
  translateX: 100, translateY: 150, scale: 2.5,
  bounds: { minX: -500, maxX: 500, minY: -400, maxY: 400 }
};
expect(viewport).toBeValidViewportState();
expect(viewport).toHaveValidViewportBounds({
  maxScale: 10, minScale: 0.1
});
```

### Gesture Physics Validation
```typescript
const gestureData = {
  phases: [
    { phase: 'active', velocity: { x: 500, y: 300 } },
    { phase: 'momentum', velocity: { x: 475, y: 285 } },
    { phase: 'momentum', velocity: { x: 451, y: 270 } }
  ],
  friction: 0.95
};
expect(gestureData).toHaveAccurateGesturePhysics();
```

### Performance Validation
```typescript
const spatialCalculation = () => {
  // Complex coordinate transformations
  return beacons.map(beacon => transformToScreen(beacon.position, viewport));
};

expect(spatialCalculation).toCompleteWithinSpatialPerformanceBounds({
  maxExecutionTime: 16, // 60fps frame budget
  targetFPS: 60
});
```

## Integration with Existing Infrastructure

These specialized matchers integrate seamlessly with existing testing infrastructure:

- **Performance API Mocks**: Works with React Native performance mocking
- **Gesture Test Utils**: Integrates with gesture simulation utilities
- **Worklet Test Utils**: Compatible with worklet isolation testing
- **Memory Test Utils**: Includes memory usage validation

## Key Features

1. **Extreme Zoom Support**: Handles floating-point precision at 1M+ zoom levels
2. **Physics Validation**: Validates realistic momentum, friction, and elastic behavior
3. **Performance Monitoring**: Detects performance regressions in spatial calculations
4. **Comprehensive Error Messages**: Provides detailed debugging information
5. **Type Safety**: Full TypeScript support with IntelliSense
6. **Real-World Testing**: Integration tests cover complete galaxy map workflows

## Test Results

- **29 Total Tests**: 18 unit + 11 integration tests
- **100% Pass Rate**: All tests passing
- **Comprehensive Coverage**: All matcher functionality tested
- **Performance Validation**: Includes regression detection tests

## Future Enhancements

The matcher suite provides a solid foundation for spatial interface testing and can be extended with:

- Additional transformation matrix validations (3D transforms)
- More complex gesture physics (rotation, multi-finger)
- WebGL/GPU performance validation
- Advanced spatial indexing validation

## References

- **Task 1.1**: Performance testing infrastructure with React Native Performance API mocks
- **Task 1.2**: Advanced gesture simulation with momentum and elastic behavior  
- **Task 1.3**: Enhanced worklet isolation testing with memory leak detection
- **TDD Methodology**: Red-Green-Refactor cycle followed throughout implementation