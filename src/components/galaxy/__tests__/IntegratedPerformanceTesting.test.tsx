/**
 * Integration Tests for Enhanced Performance Testing Infrastructure
 * 
 * Tests the integration of Performance API mocks with existing WorkletTestUtils and GestureTestUtils
 */

import React from 'react';

describe('Integrated Performance Testing Infrastructure', () => {
  describe('WorkletTestUtils Integration', () => {
    beforeEach(() => {
      global.WorkletTestUtils.resetContext();
    });

    it('should provide enhanced worklet performance measurement', () => {
      const testWorklet = global.WorkletTestUtils.worklet((value: number) => value * 2);
      const result = global.WorkletTestUtils.measureWorkletExecution(testWorklet, [50]);
      
      expect(result.result).toBe(100);
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(typeof result.isWorklet).toBe('boolean');
    });

    it('should detect worklet memory leaks', () => {
      const leakAnalysis = global.WorkletTestUtils.detectWorkletMemoryLeaks();
      
      expect(leakAnalysis).toBeDefined();
      expect(typeof leakAnalysis.heapGrowth).toBe('number');
      expect(typeof leakAnalysis.potentialLeak).toBe('boolean');
      expect(Array.isArray(leakAnalysis.recommendations)).toBe(true);
    });

    it('should create worklet performance baseline', () => {
      const baseline = global.WorkletTestUtils.createWorkletPerformanceBaseline(10);
      
      expect(baseline).toBeDefined();
      expect(typeof baseline.averageDuration).toBe('number');
      expect(typeof baseline.successRate).toBe('number');
      expect(baseline.totalOperations).toBe(10);
      expect(baseline.baselineCreatedAt).toBeDefined();
    });
  });

  describe('GestureTestUtils Integration', () => {
    let mockHandler: any;

    beforeEach(() => {
      mockHandler = {
        onGestureEvent: jest.fn(),
        onHandlerStateChange: jest.fn(),
      };
    });

    it('should measure gesture performance', () => {
      const result = global.GestureTestUtils.measureGesturePerformance(
        global.GestureTestUtils.simulatePanGesture,
        mockHandler,
        [
          { x: 0, y: 0, translationX: 0, translationY: 0 },
          { x: 100, y: 100, translationX: 100, translationY: 100 },
        ]
      );

      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(mockHandler.onGestureEvent).toHaveBeenCalled();
    });

    it('should simulate complex pan gesture with momentum', () => {
      const result = global.GestureTestUtils.simulateComplexGestureSequence(
        mockHandler,
        'pan-with-momentum',
        {
          start: { x: 0, y: 0 },
          end: { x: 200, y: 200 },
          steps: 5,
          momentum: true,
        }
      );

      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.eventsDispatched).toBeGreaterThan(0);
      expect(result.averageEventTime).toBeGreaterThanOrEqual(0);
      expect(mockHandler.onGestureEvent).toHaveBeenCalledTimes(result.eventsDispatched);
    });

    it('should simulate elastic pinch gesture', () => {
      const result = global.GestureTestUtils.simulateComplexGestureSequence(
        mockHandler,
        'elastic-pinch',
        {
          initialScale: 1,
          finalScale: 2,
          elasticity: 0.1,
          steps: 10,
          focalPoint: { x: 150, y: 200 },
        }
      );

      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.eventsDispatched).toBeGreaterThan(0);
      expect(result.averageEventTime).toBeGreaterThanOrEqual(0);
      
      // Verify the scale progression in gesture events
      const gestureEvents = mockHandler.onGestureEvent.mock.calls.map(call => call[0].nativeEvent);
      expect(gestureEvents.length).toBe(result.eventsDispatched);
      
      // First event should have scale close to initial
      expect(gestureEvents[0].scale).toBeCloseTo(1, 0.5);
      
      // Last event should have scale close to final
      const lastEvent = gestureEvents[gestureEvents.length - 1];
      expect(lastEvent.scale).toBeCloseTo(2, 0.5);
    });

    it('should create gesture performance baseline', () => {
      const baseline = global.GestureTestUtils.createGesturePerformanceBaseline(5);
      
      expect(baseline).toBeDefined();
      expect(typeof baseline.averageGestureDuration).toBe('number');
      expect(typeof baseline.averageEventTime).toBe('number');
      expect(baseline.totalOperations).toBe(5);
      expect(baseline.baselineCreatedAt).toBeDefined();
    });
  });

  describe('Spatial Performance Integration', () => {
    it('should integrate with coordinate transformation measurement', () => {
      // Test real coordinate transformation function
      const screenToGalaxy = (screenPoint: { x: number; y: number }, viewport: any) => ({
        x: screenPoint.x / viewport.scale - viewport.translateX,
        y: screenPoint.y / viewport.scale - viewport.translateY,
      });

      const result = global.SpatialPerformanceTestUtils.measureCoordinateTransform(
        screenToGalaxy,
        { x: 100, y: 200 },
        { scale: 2, translateX: 50, translateY: 75 }
      );

      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.result).toEqual({ x: 0, y: 25 }); // (100/2 - 50, 200/2 - 75)
    });

    it('should integrate with viewport calculation measurement', () => {
      const calculateVisibleBounds = (width: number, height: number, viewport: any) => ({
        minX: -viewport.translateX / viewport.scale,
        maxX: (-viewport.translateX + width) / viewport.scale,
        minY: -viewport.translateY / viewport.scale,
        maxY: (-viewport.translateY + height) / viewport.scale,
      });

      const result = global.SpatialPerformanceTestUtils.measureViewportCalculation(
        calculateVisibleBounds,
        400,
        600,
        { scale: 1, translateX: 100, translateY: 150 }
      );

      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.result).toEqual({
        minX: -100,
        maxX: 300,
        minY: -150,
        maxY: 450,
      });
    });
  });

  describe('Memory Usage Integration', () => {
    beforeEach(() => {
      global.MemoryTestUtils.resetMemoryTracking();
    });

    it('should track memory usage across different testing components', () => {
      // Capture initial state
      const initialSnapshot = global.MemoryTestUtils.captureMemorySnapshot('initial');
      
      // Perform some operations that might affect memory
      global.WorkletTestUtils.createWorkletPerformanceBaseline(5);
      global.GestureTestUtils.createGesturePerformanceBaseline(3);
      global.SpatialPerformanceTestUtils.createPerformanceBaseline({
        coordinateTransforms: 5,
        viewportCalculations: 3,
        gestureUpdates: 8,
      });
      
      // Capture after operations
      const afterSnapshot = global.MemoryTestUtils.captureMemorySnapshot('after-operations');
      
      // Analyze memory usage
      const analysis = global.MemoryTestUtils.detectMemoryLeaks(initialSnapshot, afterSnapshot);
      
      expect(analysis.heapGrowth).toBeDefined();
      expect(analysis.potentialLeak).toBeDefined();
      expect(Array.isArray(analysis.recommendations)).toBe(true);
      expect(analysis.timeDifference).toBeGreaterThanOrEqual(0); // Allow 0 in fast test environment
    });
  });

  describe('Performance Assertion Matchers Integration', () => {
    it('should work with performance ranges for all test utilities', () => {
      // Test worklet performance within acceptable range
      const workletResult = global.WorkletTestUtils.measureWorkletExecution(
        global.WorkletTestUtils.worklet(() => 42)
      );
      expect(workletResult.duration).toBeWithinPerformanceRange(0, 100);

      // Test gesture performance within acceptable range  
      const gestureResult = global.GestureTestUtils.measureGesturePerformance(
        global.GestureTestUtils.simulateTapGesture,
        { onGestureEvent: jest.fn() },
        { x: 100, y: 100 }
      );
      expect(gestureResult.duration).toBeWithinPerformanceRange(0, 100);

      // Test spatial performance within acceptable range
      const spatialResult = global.SpatialPerformanceTestUtils.measureCoordinateTransform(
        (coords: any) => coords,
        { x: 1, y: 1 },
        { scale: 1 }
      );
      expect(spatialResult.duration).toBeWithinPerformanceRange(0, 50);
    });

    it('should validate coordinate precision from spatial calculations', () => {
      const transformResult = global.SpatialPerformanceTestUtils.measureCoordinateTransform(
        (coords: { x: number; y: number }, viewport: any) => ({
          x: coords.x * viewport.scale + viewport.translateX,
          y: coords.y * viewport.scale + viewport.translateY,
        }),
        { x: 100, y: 200 },
        { scale: 1.5, translateX: 10, translateY: 20 }
      );

      expect(transformResult.result).toBeCloseToCoordinate(
        { x: 160, y: 320 }, // 100 * 1.5 + 10, 200 * 1.5 + 20
        0.01
      );
    });

    it('should validate viewport states in spatial calculations', () => {
      const viewport = {
        translateX: 100,
        translateY: 200,
        scale: 1.5,
        bounds: { minX: 0, maxX: 400, minY: 0, maxY: 600 },
      };

      expect(viewport).toBeValidViewportState();

      // Test invalid viewport
      const invalidViewport = { ...viewport, scale: -1 };
      expect(() => expect(invalidViewport).toBeValidViewportState()).toThrow();
    });
  });

  describe('Complete Integration Test', () => {
    it('should run a complete spatial interface performance test', async () => {
      // Reset all test utilities
      global.MemoryTestUtils.resetMemoryTracking();
      global.WorkletTestUtils.resetContext();
      
      // Capture initial memory state
      const initialMemory = global.MemoryTestUtils.captureMemorySnapshot('initial');
      
      // Create performance baselines for all systems
      const workletBaseline = global.WorkletTestUtils.createWorkletPerformanceBaseline(3);
      const gestureBaseline = global.GestureTestUtils.createGesturePerformanceBaseline(3);
      const spatialBaseline = global.SpatialPerformanceTestUtils.createPerformanceBaseline({
        coordinateTransforms: 3,
        viewportCalculations: 2,
        gestureUpdates: 5,
      });
      
      // Test complex interaction scenario
      const mockHandler = {
        onGestureEvent: jest.fn(),
        onHandlerStateChange: jest.fn(),
      };
      
      const complexGestureResult = global.GestureTestUtils.simulateComplexGestureSequence(
        mockHandler,
        'pan-with-momentum',
        {
          start: { x: 50, y: 50 },
          end: { x: 250, y: 300 },
          steps: 8,
          momentum: true,
        }
      );
      
      // Capture final memory state
      const finalMemory = global.MemoryTestUtils.captureMemorySnapshot('final');
      const memoryAnalysis = global.MemoryTestUtils.detectMemoryLeaks(initialMemory, finalMemory);
      
      // Assert all performance metrics are reasonable
      expect(workletBaseline.averageDuration).toBeWithinPerformanceRange(0, 50);
      expect(gestureBaseline.averageGestureDuration).toBeWithinPerformanceRange(0, 100);
      expect(spatialBaseline.coordinateTransformAverage).toBeWithinPerformanceRange(0, 20);
      expect(spatialBaseline.viewportCalculationAverage).toBeWithinPerformanceRange(0, 20);
      expect(spatialBaseline.gestureUpdateAverage).toBeWithinPerformanceRange(0, 10);
      
      // Assert complex gesture performed correctly
      expect(complexGestureResult.duration).toBeWithinPerformanceRange(0, 150);
      expect(complexGestureResult.eventsDispatched).toBe(9); // 8 steps + 1
      expect(complexGestureResult.averageEventTime).toBeWithinPerformanceRange(0, 50);
      
      // Assert memory usage is reasonable
      expect(memoryAnalysis.heapGrowth).toBeLessThan(10000000); // Less than 10MB growth
      
      // Log performance summary for debugging
      const performanceSummary = {
        worklet: workletBaseline,
        gesture: gestureBaseline,
        spatial: spatialBaseline,
        complexGesture: complexGestureResult,
        memory: memoryAnalysis,
      };
      
      // In a real test, you might want to log this or store it
      expect(performanceSummary).toBeDefined();
    });
  });
});