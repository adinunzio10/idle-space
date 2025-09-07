/**
 * Integration Test Suite for Specialized Spatial Jest Matchers
 * 
 * Demonstrates how the specialized matchers work together in realistic
 * spatial interface scenarios for galaxy map testing.
 * 
 * Tests real-world use cases combining coordinate transformations,
 * viewport calculations, gesture physics, and performance validation.
 */

import { performance } from 'perf_hooks';
import type { ViewportState } from '../../../types/galaxy';
import { 
  createMockViewportState, 
  createMockBeaconGrid,
  gestureTestUtils,
  performanceTestUtils
} from './test-utils';

describe('Specialized Spatial Matchers - Integration Tests', () => {
  describe('Galaxy Map Viewport Management', () => {
    it('should validate complete viewport transformation chain', () => {
      // Simulate realistic galaxy map viewport scenario
      const screenDimensions = { width: 400, height: 600 };
      const viewport: ViewportState = {
        translateX: -200,
        translateY: -150,
        scale: 2.5,
        bounds: { minX: -1000, maxX: 1000, minY: -800, maxY: 800 }
      };

      // Validate viewport state
      expect(viewport).toBeValidViewportState();

      // Test viewport constraints
      const constraints = {
        maxScale: 10,
        minScale: 0.1,
        maxTranslation: { x: 2000, y: 1500 }
      };
      expect(viewport).toHaveValidViewportBounds(constraints);

      // Test coordinate transformation consistency
      const beaconScreenPos = { x: 300, y: 400 };
      const expectedWorldPos = {
        x: (beaconScreenPos.x - viewport.translateX) / viewport.scale,
        y: (beaconScreenPos.y - viewport.translateY) / viewport.scale
      };

      const coordinateData = {
        screenCoordinates: beaconScreenPos,
        worldCoordinates: expectedWorldPos,
        viewport
      };
      expect(coordinateData).toHaveConsistentCoordinateSystem();

      // Test transformation matrix for the same viewport
      const transformMatrix = {
        a: viewport.scale, b: 0, c: 0, d: viewport.scale,
        tx: viewport.translateX, ty: viewport.translateY
      };
      expect(transformMatrix).toBeValidTransformationMatrix();
    });

    it('should handle extreme zoom scenarios with precision', () => {
      const extremeViewport: ViewportState = {
        translateX: 0.0000001,
        translateY: 0.0000002,
        scale: 1000000, // 1M zoom
        bounds: { minX: -0.001, maxX: 0.001, minY: -0.001, maxY: 0.001 }
      };

      expect(extremeViewport).toBeValidViewportState();

      // Test high-precision coordinate calculations
      const nanoCoordinate = { x: 0.0000005, y: 0.0000007 };
      const nearbyCoordinate = { x: 0.0000005000001, y: 0.0000007000001 };
      
      expect(nanoCoordinate).toBeWithinCoordinatePrecision(nearbyCoordinate, 1e-12);

      // Test coordinate system consistency at extreme zoom
      const extremeCoordData = {
        screenCoordinates: { x: 500, y: 700 },
        worldCoordinates: { 
          x: (500 - extremeViewport.translateX) / extremeViewport.scale,
          y: (700 - extremeViewport.translateY) / extremeViewport.scale
        },
        viewport: extremeViewport
      };
      expect(extremeCoordData).toHaveConsistentCoordinateSystem();
    });
  });

  describe('Pan Gesture Physics Validation', () => {
    it('should validate realistic pan gesture with momentum and boundaries', async () => {
      const viewport: ViewportState = {
        translateX: 0,
        translateY: 0,
        scale: 1,
        bounds: { minX: -500, maxX: 500, minY: -400, maxY: 400 }
      };

      // Simulate pan gesture with momentum
      const panStart = { x: 100, y: 150 };
      const panEnd = { x: 350, y: 400 };
      const initialVelocity = { x: 400, y: 300 };

      const mockHandler = {
        onGestureEvent: jest.fn(),
        onHandlerStateChange: jest.fn()
      };

      // Use advanced gesture simulation from test-utils
      const gestureResult = gestureTestUtils.simulatePanWithMomentum(
        mockHandler,
        panStart,
        panEnd,
        { velocity: initialVelocity, friction: 0.95 }
      );

      // Validate gesture physics
      const gesturePhysicsData = {
        phases: gestureResult.gestureEvents
          .filter(event => event.phase)
          .map(event => ({
            phase: event.phase as 'active' | 'momentum',
            velocity: { x: event.velocityX || 0, y: event.velocityY || 0 }
          })),
        friction: 0.95
      };

      expect(gesturePhysicsData).toHaveAccurateGesturePhysics();

      // Test momentum duration calculation
      const momentumDuration = gestureTestUtils.calculateMomentumDuration(
        initialVelocity, 0.95
      );
      expect(momentumDuration.duration).toBeGreaterThan(0);
      expect(momentumDuration.frames).toBeGreaterThan(0);

      // Validate timing requirements
      const timingData = {
        actualFrameRate: 58.5,
        frameJitter: 0.8,
        droppedFrames: 1,
        totalFrames: 60
      };
      const timingRequirements = {
        minFrameRate: 55,
        maxFrameJitter: 1.0,
        maxDroppedFramePercentage: 0.05
      };
      expect(timingData).toMeetGestureTimingRequirements(timingRequirements);
    });

    it('should validate elastic boundary behavior', () => {
      const boundaries = { minX: 0, maxX: 1000, minY: 0, maxY: 800 };
      const overscrollTarget = { x: 1200, y: 900 }; // Outside bounds

      const elasticGestureData = gestureTestUtils.simulateElasticOverscroll(
        { onGestureEvent: jest.fn() },
        overscrollTarget,
        boundaries,
        { stiffness: 0.8, damping: 0.6 }
      );

      // Validate elastic behavior
      const elasticPhysics = {
        overscrollPhase: {
          maxOverscroll: elasticGestureData.maxOverscroll,
          elasticity: 0.3, // Typical elasticity value
          settleDuration: elasticGestureData.settlingTime
        }
      };
      expect(elasticPhysics).toHaveAccurateGesturePhysics();

      // Validate that final position respects boundaries
      expect(elasticGestureData.finalPosition.x).toBeLessThanOrEqual(boundaries.maxX);
      expect(elasticGestureData.finalPosition.y).toBeLessThanOrEqual(boundaries.maxY);
    });
  });

  describe('Scale Constraint Validation', () => {
    it('should validate pinch-to-zoom scale enforcement', () => {
      const scaleConstraints = { min: 0.1, max: 10 };
      
      // Test various scale scenarios
      const scaleScenarios = [
        { current: 1.0, target: 0.05, expected: 0.1 }, // Below minimum
        { current: 5.0, target: 15, expected: 10 },    // Above maximum
        { current: 2.0, target: 3.5, expected: 3.5 },  // Within bounds
      ];

      scaleScenarios.forEach(scenario => {
        const scaleData = {
          currentScale: scenario.current,
          targetScale: scenario.target,
          limits: scaleConstraints,
          enforcedScale: scenario.expected,
          precision: 1e-10
        };
        
        expect(scaleData).toRespectScaleLimits();
      });

      // Test floating-point precision edge case
      const preciseScaleData = {
        currentScale: 1.0000000000001,
        targetScale: 1.0,
        limits: scaleConstraints,
        enforcedScale: 1.0,
        precision: 1e-12
      };
      expect(preciseScaleData).toRespectScaleLimits();
    });
  });

  describe('Performance Integration', () => {
    it('should validate spatial operations meet performance requirements', () => {
      // Simulate coordinate transformation workload
      const spatialWorkload = () => {
        const beacons = createMockBeaconGrid(10, 10, 100); // 100 beacons
        const viewport = createMockViewportState({ scale: 1.5, translateX: 200, translateY: 150 });
        
        // Transform all beacon coordinates
        return beacons.map(beacon => ({
          screenX: beacon.position.x * viewport.scale + viewport.translateX,
          screenY: beacon.position.y * viewport.scale + viewport.translateY
        }));
      };

      const performanceRequirements = {
        maxExecutionTime: 10, // 10ms for 100 beacons
        maxMemoryUsage: 1024 * 50, // 50KB
        targetFPS: 60
      };

      expect(spatialWorkload).toCompleteWithinSpatialPerformanceBounds(performanceRequirements);
    });

    it('should detect performance regression in viewport calculations', () => {
      const heavyViewportCalculation = () => {
        const results = [];
        
        // Much more intensive calculation to ensure it exceeds 1ms
        for (let scale = 0.1; scale <= 20; scale += 0.05) { // More iterations
          for (let tx = -2000; tx <= 2000; tx += 50) {    // More iterations
            for (let ty = -1500; ty <= 1500; ty += 50) {   // More iterations
              // Add expensive mathematical operations
              const visibleBounds = {
                minX: -tx / scale,
                maxX: (400 - tx) / scale,
                minY: -ty / scale,
                maxY: (600 - ty) / scale
              };
              
              // Add CPU-intensive operations to force slowdown
              for (let i = 0; i < 100; i++) {
                Math.sin(tx * ty * scale + i) * Math.cos(tx + ty + scale + i);
              }
              
              results.push({
                scale,
                translate: { x: tx, y: ty },
                bounds: visibleBounds
              });
            }
          }
        }
        
        return results;
      };

      // This should fail due to heavy computation
      const strictRequirements = {
        maxExecutionTime: 1, // Very strict 1ms limit
        targetFPS: 60
      };

      expect(() => {
        expect(heavyViewportCalculation).toCompleteWithinSpatialPerformanceBounds(strictRequirements);
      }).toThrow('execution time');
    });
  });

  describe('Viewport Calculation Accuracy', () => {
    it('should validate viewport calculations with floating-point tolerance', () => {
      const viewport = createMockViewportState({
        translateX: 123.456789,
        translateY: 234.567890,
        scale: 1.234567
      });
      
      // Calculate expected visible bounds
      const screenWidth = 400;
      const screenHeight = 600;
      
      const calculatedViewport = {
        visibleBounds: {
          minX: -viewport.translateX / viewport.scale,
          maxX: (screenWidth - viewport.translateX) / viewport.scale,
          minY: -viewport.translateY / viewport.scale,
          maxY: (screenHeight - viewport.translateY) / viewport.scale
        },
        scaledDimensions: {
          width: screenWidth / viewport.scale,
          height: screenHeight / viewport.scale
        }
      };

      // Expected values with slight floating-point differences
      const expectedViewport = {
        visibleBounds: {
          minX: -100.040064,  // Slight difference
          maxX: 224.000001,   // Slight difference  
          minY: -190.000002,  // Slight difference
          maxY: 296.087896    // Slight difference
        },
        scaledDimensions: {
          width: 324.000001,  // Slight difference
          height: 486.087895  // Slight difference
        }
      };

      // This should pass with reasonable tolerance
      expect(calculatedViewport).toBeWithinViewportCalculationTolerance(expectedViewport, 0.1);

      // This should fail with strict tolerance
      expect(() => {
        expect(calculatedViewport).toBeWithinViewportCalculationTolerance(expectedViewport, 0.0001);
      }).toThrow('tolerance');
    });
  });

  describe('Multi-Touch Gesture Complex Scenarios', () => {
    it('should validate combined pan and pinch gestures', async () => {
      const initialViewport = createMockViewportState({ scale: 1, translateX: 0, translateY: 0 });
      
      // Simulate simultaneous pan and pinch
      const combinedGestureData = gestureTestUtils.simulateMultiTouchGesture(
        { onGestureEvent: jest.fn() },
        [
          {
            type: 'pan',
            startPoint: { x: 100, y: 150 },
            endPoint: { x: 200, y: 250 }
          },
          {
            type: 'pinch',
            initialScale: 1.0,
            finalScale: 2.5,
            focalPoint: { x: 200, y: 300 }
          }
        ],
        {
          synchronization: 'simultaneous',
          interactionMode: 'combined'
        }
      );

      // Validate that combined gesture has proper structure
      expect(combinedGestureData.combinedEvents.length).toBeGreaterThan(0);
      expect(combinedGestureData.totalEvents).toBe(combinedGestureData.combinedEvents.length);

      // Each event should have both translation and scale information
      const finalEvent = combinedGestureData.combinedEvents[combinedGestureData.combinedEvents.length - 1];
      expect(finalEvent.translationX).toBeDefined();
      expect(finalEvent.translationY).toBeDefined();
      expect(finalEvent.scale).toBeDefined();
      expect(finalEvent.numberOfPointers).toBeGreaterThan(1);
    });

    it('should handle conflicting gestures with priority resolution', () => {
      const conflictingGestures = [
        { type: 'pan', priority: 1 },
        { type: 'pinch', priority: 3 },
        { type: 'rotation', priority: 2 }
      ];

      const resolutionResult = gestureTestUtils.simulateConflictingGestures(
        { onGestureEvent: jest.fn() },
        conflictingGestures,
        {
          conflictResolution: 'priority',
          allowSimultaneous: false
        }
      );

      // Highest priority gesture should dominate
      expect(resolutionResult.dominantGesture).toBe('pinch');
      expect(resolutionResult.suppressedGestures).toContain('pan');
      expect(resolutionResult.suppressedGestures).toContain('rotation');
      expect(resolutionResult.resolved).toBe(true);
    });
  });

  describe('Real-World Galaxy Map Scenario', () => {
    it('should validate complete galaxy map interaction sequence', async () => {
      // Setup realistic galaxy map scenario
      const beacons = createMockBeaconGrid(5, 4, 120); // 20 beacons, 120px spacing
      let currentViewport = createMockViewportState({
        scale: 1,
        translateX: 0,
        translateY: 0,
        bounds: { minX: -1000, maxX: 1000, minY: -800, maxY: 800 }
      });

      // 1. Initial state validation
      expect(currentViewport).toBeValidViewportState();

      // 2. User pans to explore galaxy
      const panGestureResult = gestureTestUtils.simulatePanWithMomentum(
        { onGestureEvent: jest.fn() },
        { x: 200, y: 300 },
        { x: 100, y: 180 },
        { velocity: { x: -150, y: -200 }, friction: 0.92 }
      );

      expect({
        phases: panGestureResult.gestureEvents
          .filter(e => e.phase)
          .map(e => ({ phase: e.phase as 'active' | 'momentum', velocity: { x: e.velocityX || 0, y: e.velocityY || 0 } })),
        friction: 0.92
      }).toHaveAccurateGesturePhysics();

      // 3. User pinches to zoom in on specific region
      currentViewport = {
        ...currentViewport,
        scale: 3.2,
        translateX: -320,
        translateY: -240
      };

      const scaleConstraintData = {
        currentScale: 1.0,
        targetScale: 3.2,
        limits: { min: 0.1, max: 10 },
        enforcedScale: 3.2
      };
      expect(scaleConstraintData).toRespectScaleLimits();

      // 4. Validate coordinate transformation accuracy for beacon positions
      beacons.forEach(beacon => {
        const screenPosition = {
          x: beacon.position.x * currentViewport.scale + currentViewport.translateX,
          y: beacon.position.y * currentViewport.scale + currentViewport.translateY
        };

        const coordinateConsistency = {
          screenCoordinates: screenPosition,
          worldCoordinates: beacon.position,
          viewport: currentViewport
        };
        expect(coordinateConsistency).toHaveConsistentCoordinateSystem();
      });

      // 5. Validate performance under load
      const complexRenderOperation = () => {
        return beacons.map(beacon => {
          // Simulate complex beacon rendering calculations
          const screenX = beacon.position.x * currentViewport.scale + currentViewport.translateX;
          const screenY = beacon.position.y * currentViewport.scale + currentViewport.translateY;
          
          // Simulate connection line calculations
          const connections = beacon.connections.map(connId => ({
            id: connId,
            distance: Math.sqrt((screenX - 200) ** 2 + (screenY - 300) ** 2),
            angle: Math.atan2(screenY - 300, screenX - 200)
          }));

          return { beacon, screenX, screenY, connections };
        });
      };

      expect(complexRenderOperation).toCompleteWithinSpatialPerformanceBounds({
        maxExecutionTime: 16, // One frame at 60fps
        targetFPS: 60
      });

      // 6. Validate viewport bounds are respected after all interactions
      expect(currentViewport).toHaveValidViewportBounds({
        maxScale: 10,
        minScale: 0.1,
        maxTranslation: { x: 2000, y: 1500 }
      });
    });
  });
});