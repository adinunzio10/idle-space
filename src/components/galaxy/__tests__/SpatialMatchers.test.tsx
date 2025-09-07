/**
 * Test Suite for Specialized Spatial Jest Matchers
 * 
 * Tests for custom Jest matchers that handle spatial calculations,
 * coordinate transformations, and viewport validation for galaxy map interface.
 * 
 * Following TDD: RED-GREEN-REFACTOR
 * RED Phase: Write failing tests for new matchers that don't exist yet
 */

import { performance } from 'perf_hooks';
import type { ViewportState } from '../../../types/galaxy';

describe('Specialized Spatial Jest Matchers', () => {
  describe('Coordinate Precision Matchers', () => {
    describe('toBeWithinCoordinatePrecision', () => {
      it('should validate coordinate precision at normal zoom levels', () => {
        const coordinate = { x: 100.123456789, y: 200.987654321 };
        const target = { x: 100.123456788, y: 200.987654320 };
        
        // This should pass with precision 1e-8
        expect(coordinate).toBeWithinCoordinatePrecision(target, 1e-8);
        
        // This should fail with higher precision requirement
        expect(() => {
          expect(coordinate).toBeWithinCoordinatePrecision(target, 1e-10);
        }).toThrow();
      });

      it('should handle extreme zoom level precision requirements', () => {
        const extremeZoomCoordinate = { x: 0.000000001, y: 0.000000002 };
        const target = { x: 0.000000001000001, y: 0.000000002000001 };
        
        // Should handle floating point precision at extreme zoom
        expect(extremeZoomCoordinate).toBeWithinCoordinatePrecision(target, 1e-12);
        
        // Should fail at even higher precision - use much larger difference
        const farTarget = { x: 0.000001, y: 0.000002 };
        expect(() => {
          expect(extremeZoomCoordinate).toBeWithinCoordinatePrecision(farTarget, 1e-15);
        }).toThrow();
      });

      it('should handle coordinates near floating point limits', () => {
        const coordinate = { x: Number.MAX_SAFE_INTEGER - 1, y: Number.MIN_SAFE_INTEGER + 1 };
        const target = { x: Number.MAX_SAFE_INTEGER, y: Number.MIN_SAFE_INTEGER };
        
        expect(coordinate).toBeWithinCoordinatePrecision(target, 2);
      });
    });

    describe('toBeValidTransformationMatrix', () => {
      it('should validate 2D transformation matrices', () => {
        const validMatrix = {
          a: 1.5, b: 0, c: 0, d: 1.5, // scale components
          tx: 100, ty: 150 // translation components
        };
        
        expect(validMatrix).toBeValidTransformationMatrix();
        
        // Invalid matrix with determinant near zero
        const invalidMatrix = { a: 0, b: 0, c: 0, d: 0, tx: 0, ty: 0 };
        expect(() => {
          expect(invalidMatrix).toBeValidTransformationMatrix();
        }).toThrow();
      });

      it('should detect non-invertible matrices', () => {
        const nonInvertibleMatrix = {
          a: 1, b: 2, c: 2, d: 4, // determinant = 1*4 - 2*2 = 0
          tx: 0, ty: 0
        };
        
        expect(() => {
          expect(nonInvertibleMatrix).toBeValidTransformationMatrix();
        }).toThrow('not invertible');
      });

      it('should validate transformation bounds', () => {
        const extremeScaleMatrix = {
          a: 1e10, b: 0, c: 0, d: 1e10,
          tx: 0, ty: 0
        };
        
        expect(() => {
          expect(extremeScaleMatrix).toBeValidTransformationMatrix();
        }).toThrow('scale factors exceed');
      });
    });
  });

  describe('Viewport Validation Matchers', () => {
    describe('toHaveValidViewportBounds', () => {
      it('should validate viewport bounds constraints', () => {
        const validViewport: ViewportState = {
          translateX: 100,
          translateY: 150,
          scale: 1.5,
          bounds: { minX: 0, maxX: 1000, minY: 0, maxY: 800 }
        };
        
        const constraints = {
          maxScale: 10,
          minScale: 0.1,
          maxTranslation: { x: 2000, y: 1500 }
        };
        
        expect(validViewport).toHaveValidViewportBounds(constraints);
        
        // Invalid viewport exceeding scale limits
        const invalidViewport = { ...validViewport, scale: 15 };
        expect(() => {
          expect(invalidViewport).toHaveValidViewportBounds(constraints);
        }).toThrow();
      });

      it('should validate translation bounds', () => {
        const viewport: ViewportState = {
          translateX: 3000,
          translateY: 2000,
          scale: 1,
          bounds: { minX: 0, maxX: 1000, minY: 0, maxY: 800 }
        };
        
        const constraints = {
          maxTranslation: { x: 2000, y: 1500 }
        };
        
        expect(() => {
          expect(viewport).toHaveValidViewportBounds(constraints);
        }).toThrow('translation');
      });
    });

    describe('toBeWithinViewportCalculationTolerance', () => {
      it('should validate viewport calculations with tolerance', () => {
        const calculatedViewport = {
          visibleBounds: { minX: 10.01, maxX: 509.99, minY: 15.02, maxY: 384.98 },
          scaledDimensions: { width: 499.98, height: 369.96 }
        };
        
        const expectedViewport = {
          visibleBounds: { minX: 10, maxX: 510, minY: 15, maxY: 385 },
          scaledDimensions: { width: 500, height: 370 }
        };
        
        expect(calculatedViewport).toBeWithinViewportCalculationTolerance(expectedViewport, 0.05);
        
        // Should fail with stricter tolerance
        expect(() => {
          expect(calculatedViewport).toBeWithinViewportCalculationTolerance(expectedViewport, 0.001);
        }).toThrow();
      });
    });
  });

  describe('Gesture Accuracy Matchers', () => {
    describe('toHaveAccurateGesturePhysics', () => {
      it('should validate gesture momentum physics', () => {
        const gestureData = {
          phases: [
            { phase: 'active', velocity: { x: 500, y: 300 } },
            { phase: 'momentum', velocity: { x: 475, y: 285 } },
            { phase: 'momentum', velocity: { x: 451, y: 270 } },
            { phase: 'momentum', velocity: { x: 428, y: 257 } }
          ],
          friction: 0.95
        };
        
        expect(gestureData).toHaveAccurateGesturePhysics();
        
        // Invalid physics - velocity increases during momentum
        const invalidGesture = {
          phases: [
            { phase: 'momentum', velocity: { x: 300, y: 200 } },
            { phase: 'momentum', velocity: { x: 350, y: 250 } } // Invalid increase
          ]
        };
        
        expect(() => {
          expect(invalidGesture).toHaveAccurateGesturePhysics();
        }).toThrow();
      });

      it('should validate elastic boundary behavior', () => {
        const elasticGestureData = {
          overscrollPhase: {
            maxOverscroll: { x: 50, y: 30 },
            elasticity: 0.3,
            settleDuration: 450
          },
          boundaries: { minX: 0, maxX: 1000, minY: 0, maxY: 800 }
        };
        
        expect(elasticGestureData).toHaveAccurateGesturePhysics();
      });
    });

    describe('toMeetGestureTimingRequirements', () => {
      it('should validate gesture timing accuracy', () => {
        const gestureTimingData = {
          expectedFrameRate: 60,
          actualFrameRate: 58.5,
          frameJitter: 0.8,
          droppedFrames: 2,
          totalFrames: 180
        };
        
        const requirements = {
          minFrameRate: 55,
          maxFrameJitter: 1.0,
          maxDroppedFramePercentage: 0.05 // 5%
        };
        
        expect(gestureTimingData).toMeetGestureTimingRequirements(requirements);
        
        // Failing case - too many dropped frames
        const failingTiming = {
          ...gestureTimingData,
          droppedFrames: 20 // 11% dropped frames
        };
        
        expect(() => {
          expect(failingTiming).toMeetGestureTimingRequirements(requirements);
        }).toThrow();
      });
    });
  });

  describe('Scale and Boundary Constraint Matchers', () => {
    describe('toRespectScaleLimits', () => {
      it('should validate scale enforcement at boundaries', () => {
        const scaleData = {
          currentScale: 0.5,
          targetScale: 0.1,
          limits: { min: 0.1, max: 10 },
          enforcedScale: 0.1 // Clamped to minimum
        };
        
        expect(scaleData).toRespectScaleLimits();
        
        // Invalid - target scale is clamped but result doesn't match
        const invalidScale = {
          ...scaleData,
          enforcedScale: 0.05 // Should be 0.1
        };
        
        expect(() => {
          expect(invalidScale).toRespectScaleLimits();
        }).toThrow();
      });

      it('should handle floating point precision in scale calculations', () => {
        const preciseScaleData = {
          currentScale: 1.0000000000001,
          targetScale: 1.0,
          limits: { min: 0.1, max: 10 },
          enforcedScale: 1.0,
          precision: 1e-12
        };
        
        expect(preciseScaleData).toRespectScaleLimits();
      });
    });

    describe('toHaveConsistentCoordinateSystem', () => {
      it('should validate coordinate system consistency across transformations', () => {
        // Correct calculation: world = (screen - translate) / scale
        // screen = world * scale + translate
        // So for world(200, 300), scale 0.5, translate (100, 150):
        // screen should be: 200 * 0.5 + 100 = 200, 300 * 0.5 + 150 = 300
        const coordinateData = {
          screenCoordinates: { x: 200, y: 300 },
          worldCoordinates: { x: 200, y: 300 }, // Correct world coordinates
          viewport: {
            translateX: 100,
            translateY: 150,
            scale: 0.5,
            bounds: { minX: 0, maxX: 1000, minY: 0, maxY: 1000 }
          }
        };
        
        expect(coordinateData).toHaveConsistentCoordinateSystem();
        
        // Invalid - coordinates don't match transformation
        const invalidCoordinates = {
          ...coordinateData,
          worldCoordinates: { x: 5000, y: 6000 } // Way off
        };
        
        expect(() => {
          expect(invalidCoordinates).toHaveConsistentCoordinateSystem();
        }).toThrow();
      });

      it('should handle coordinate system consistency at extreme zoom', () => {
        const extremeZoomData = {
          screenCoordinates: { x: 1, y: 1 },
          worldCoordinates: { x: 0.000001, y: 0.000001 },
          viewport: {
            translateX: 0,
            translateY: 0,
            scale: 1000000,
            bounds: { minX: -0.001, maxX: 0.001, minY: -0.001, maxY: 0.001 }
          }
        };
        
        expect(extremeZoomData).toHaveConsistentCoordinateSystem();
      });
    });
  });

  describe('Performance Integration with Spatial Matchers', () => {
    describe('toCompleteWithinSpatialPerformanceBounds', () => {
      it('should validate spatial operations meet performance requirements', () => {
        const spatialOperation = () => {
          // Simulate coordinate transformation
          const coords = [];
          for (let i = 0; i < 1000; i++) {
            coords.push({
              x: Math.cos(i) * 100 + 500,
              y: Math.sin(i) * 100 + 400
            });
          }
          return coords;
        };
        
        const performanceRequirements = {
          maxExecutionTime: 50, // 50ms
          maxMemoryUsage: 1024 * 1024, // 1MB
          targetFPS: 60
        };
        
        expect(spatialOperation).toCompleteWithinSpatialPerformanceBounds(performanceRequirements);
      });

      it('should detect performance regression in coordinate calculations', () => {
        const slowOperation = () => {
          // Intentionally slow operation
          const coords = [];
          for (let i = 0; i < 100000; i++) {
            coords.push({
              x: Math.cos(i) * Math.sqrt(i) + Math.random() * 1000,
              y: Math.sin(i) * Math.sqrt(i) + Math.random() * 1000
            });
          }
          return coords;
        };
        
        const strictRequirements = {
          maxExecutionTime: 10, // Very strict
          maxMemoryUsage: 1024 * 100, // 100KB
          targetFPS: 60
        };
        
        expect(() => {
          expect(slowOperation).toCompleteWithinSpatialPerformanceBounds(strictRequirements);
        }).toThrow();
      });
    });
  });
});