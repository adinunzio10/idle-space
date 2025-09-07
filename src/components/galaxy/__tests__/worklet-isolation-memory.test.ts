/**
 * Worklet Isolation Testing with Memory Leak Detection
 * 
 * Tests for enhanced WorkletTestUtils that provide:
 * - Memory leak detection for worklet execution cycles
 * - Worklet isolation testing with proper cleanup validation
 * - Memory monitoring helpers for complex gesture sequences
 * - Performance testing under various load conditions
 * - Garbage collection validation utilities
 * 
 * This test suite follows TDD methodology - tests written first to define desired behavior,
 * then implementation built to make tests pass.
 */

import { setupTestEnvironment } from './test-utils';

describe('Worklet Isolation Testing with Memory Leak Detection', () => {
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    const setup = setupTestEnvironment({
      setupPerformanceMonitoring: true,
      enableDebugMode: false,
    });
    cleanup = setup.restoreConsole;

    // Reset worklet context for isolated testing
    if (global.WorkletTestUtils) {
      global.WorkletTestUtils.resetContext();
    }
  });

  afterEach(() => {
    cleanup?.();
  });

  describe('Enhanced Memory Leak Detection', () => {
    it('should detect memory leaks during worklet execution cycles', () => {
      expect(global.WorkletTestUtils).toBeDefined();
      expect(global.WorkletTestUtils.detectWorkletMemoryLeaks).toBeInstanceOf(Function);

      const leakDetectionResult = global.WorkletTestUtils.detectWorkletMemoryLeaks();

      expect(leakDetectionResult).toMatchObject({
        heapGrowth: expect.any(Number),
        growthPercentage: expect.any(Number),
        potentialLeak: expect.any(Boolean),
        recommendations: expect.any(Array), // Changed to just expect an array (may be empty)
        timeDifference: expect.any(Number),
      });

      // If there's a potential leak, there should be recommendations
      if (leakDetectionResult.potentialLeak) {
        expect(leakDetectionResult.recommendations.length).toBeGreaterThan(0);
        expect(leakDetectionResult.recommendations[0]).toEqual(expect.any(String));
      }
    });

    it('should provide memory monitoring for complex gesture sequences', () => {
      expect(global.WorkletTestUtils.monitorGestureSequenceMemory).toBeInstanceOf(Function);

      const mockGestureHandler = jest.fn();
      const gestureSequence = [
        { type: 'pan', duration: 100, eventCount: 10 },
        { type: 'pinch', duration: 150, eventCount: 15 },
        { type: 'rotation', duration: 200, eventCount: 20 },
      ];

      const memoryReport = global.WorkletTestUtils.monitorGestureSequenceMemory(
        mockGestureHandler,
        gestureSequence
      );

      expect(memoryReport).toMatchObject({
        initialSnapshot: expect.objectContaining({
          jsHeapSizeUsed: expect.any(Number),
          timestamp: expect.any(Number),
        }),
        finalSnapshot: expect.objectContaining({
          jsHeapSizeUsed: expect.any(Number),
          timestamp: expect.any(Number),
        }),
        peakMemoryUsage: expect.any(Number),
        memoryGrowth: expect.any(Number),
        potentialLeaks: expect.any(Boolean),
        leakSources: expect.any(Array),
        executionMetrics: expect.objectContaining({
          totalDuration: expect.any(Number),
          averageEventProcessingTime: expect.any(Number),
          memoryEfficiency: expect.any(Number),
        }),
      });
    });

    it('should validate worklet cleanup after execution', () => {
      expect(global.WorkletTestUtils.validateWorkletCleanup).toBeInstanceOf(Function);

      const mockWorklet = global.WorkletTestUtils.worklet((value: number) => value * 2);
      const testSharedValue = global.WorkletTestUtils.createSharedValue(100);

      // Execute worklet
      global.WorkletTestUtils.executeWorklet(mockWorklet, [testSharedValue.value]);

      const cleanupValidation = global.WorkletTestUtils.validateWorkletCleanup();

      expect(cleanupValidation).toMatchObject({
        orphanedSharedValues: expect.any(Array),
        unclearedListeners: expect.any(Array),
        pendingJSCallbacks: expect.any(Array),
        workletScopeLeaks: expect.any(Array),
        cleanupSuccessful: expect.any(Boolean),
        recommendations: expect.any(Array),
      });
    });

    it('should measure worklet performance under load conditions', () => {
      expect(global.WorkletTestUtils.measureWorkletPerformanceUnderLoad).toBeInstanceOf(Function);

      const mockWorklet = global.WorkletTestUtils.worklet((data: any) => {
        return data.value * Math.random() + data.timestamp;
      });

      const loadTestConfig = {
        concurrentExecutions: 50,
        executionsPerBatch: 10,
        batchCount: 5,
        memoryPressureSimulation: true,
      };

      const performanceReport = global.WorkletTestUtils.measureWorkletPerformanceUnderLoad(
        mockWorklet,
        loadTestConfig
      );

      expect(performanceReport).toMatchObject({
        averageExecutionTime: expect.any(Number),
        memoryUsagePattern: expect.objectContaining({
          peak: expect.any(Number),
          average: expect.any(Number),
          growth: expect.any(Number),
        }),
        performanceDegradation: expect.any(Number),
        memoryLeaksDetected: expect.any(Boolean),
        recommendedMaxLoad: expect.any(Number),
        stabilityScore: expect.any(Number),
      });
    });

    it('should ensure garbage collection validation', () => {
      expect(global.WorkletTestUtils.validateGarbageCollection).toBeInstanceOf(Function);

      // Create resources that should be garbage collected
      const resources = [];
      for (let i = 0; i < 10; i++) {
        resources.push({
          sharedValue: global.WorkletTestUtils.createSharedValue(i),
          worklet: global.WorkletTestUtils.worklet(() => Math.random()),
        });
      }

      // Clear references
      resources.length = 0;

      const gcValidation = global.WorkletTestUtils.validateGarbageCollection();

      expect(gcValidation).toMatchObject({
        collectionTriggered: expect.any(Boolean),
        memoryReleased: expect.any(Number),
        remainingObjects: expect.any(Number),
        collectionEfficiency: expect.any(Number),
        gcRecommendations: expect.any(Array),
      });
    });
  });

  describe('Worklet Isolation Testing', () => {
    it('should isolate worklet execution contexts', () => {
      expect(global.WorkletTestUtils.createIsolatedWorkletContext).toBeInstanceOf(Function);

      const context1 = global.WorkletTestUtils.createIsolatedWorkletContext('context1');
      const context2 = global.WorkletTestUtils.createIsolatedWorkletContext('context2');

      // Set different values in each context
      context1.setVariable('testValue', 100);
      context2.setVariable('testValue', 200);

      const worklet1 = global.WorkletTestUtils.worklet(() => context1.getVariable('testValue'));
      const worklet2 = global.WorkletTestUtils.worklet(() => context2.getVariable('testValue'));

      const result1 = global.WorkletTestUtils.executeInContext(worklet1, context1);
      const result2 = global.WorkletTestUtils.executeInContext(worklet2, context2);

      expect(result1).toBe(100);
      expect(result2).toBe(200);
      
      // Contexts should be isolated
      expect(context1.getVariable('testValue')).not.toBe(context2.getVariable('testValue'));
    });

    it('should validate proper resource cleanup between executions', () => {
      expect(global.WorkletTestUtils.validateResourceCleanupBetweenExecutions).toBeInstanceOf(Function);

      const workletWithResources = global.WorkletTestUtils.worklet((input: any) => {
        // Simulate resource-heavy operations
        const sharedValue = global.WorkletTestUtils.createSharedValue(input);
        const callback = global.WorkletTestUtils.runOnJS(() => console.log('callback'));
        
        return {
          value: sharedValue.value,
          hasCallback: typeof callback === 'function',
        };
      });

      // Execute worklet multiple times
      const executions = 5;
      const results = [];
      
      for (let i = 0; i < executions; i++) {
        results.push(global.WorkletTestUtils.executeWorklet(workletWithResources, [i * 10]));
      }

      const cleanupValidation = global.WorkletTestUtils.validateResourceCleanupBetweenExecutions();

      expect(cleanupValidation).toMatchObject({
        executionCount: executions,
        resourceLeaksPerExecution: expect.any(Array),
        averageResourceGrowth: expect.any(Number),
        cleanupEfficiency: expect.any(Number),
        criticalLeaks: expect.any(Array),
        recommendations: expect.any(Array),
      });
    });

    it('should monitor worklet memory patterns during complex operations', () => {
      expect(global.WorkletTestUtils.monitorWorkletMemoryPatterns).toBeInstanceOf(Function);

      const complexWorklet = global.WorkletTestUtils.worklet((data: any) => {
        // Simulate complex operations that might cause memory patterns
        const arrays = [];
        for (let i = 0; i < 100; i++) {
          arrays.push(new Array(data.size || 10).fill(Math.random()));
        }
        
        // Process arrays
        const results = arrays.map(arr => arr.reduce((sum, val) => sum + val, 0));
        
        return results.slice(0, 10); // Return only subset
      });

      const memoryPatternReport = global.WorkletTestUtils.monitorWorkletMemoryPatterns(
        complexWorklet,
        { size: 50 },
        { samplingRate: 10, duration: 1000 }
      );

      expect(memoryPatternReport).toMatchObject({
        memoryPattern: expect.any(Array),
        peakUsage: expect.any(Number),
        averageUsage: expect.any(Number),
        memorySpikes: expect.any(Array),
        allocationPattern: expect.any(String),
        gcTriggers: expect.any(Number),
        memoryEfficiency: expect.any(Number),
        recommendations: expect.any(Array),
      });
    });
  });

  describe('Performance Testing Under Load', () => {
    it('should test worklet performance with varying memory pressure', () => {
      expect(global.WorkletTestUtils.testWorkletPerformanceWithMemoryPressure).toBeInstanceOf(Function);

      const testWorklet = global.WorkletTestUtils.worklet((complexity: number) => {
        // Simulate work proportional to complexity
        let result = 0;
        for (let i = 0; i < complexity; i++) {
          result += Math.sqrt(i) * Math.sin(i / 100);
        }
        return result;
      });

      const memoryPressureTests = [
        { memoryPressure: 'low', complexity: 100 },
        { memoryPressure: 'medium', complexity: 1000 },
        { memoryPressure: 'high', complexity: 5000 },
        { memoryPressure: 'extreme', complexity: 10000 },
      ];

      const performanceReport = global.WorkletTestUtils.testWorkletPerformanceWithMemoryPressure(
        testWorklet,
        memoryPressureTests
      );

      expect(performanceReport).toMatchObject({
        performanceByPressure: expect.objectContaining({
          low: expect.objectContaining({
            averageExecutionTime: expect.any(Number),
            memoryUsage: expect.any(Number),
          }),
          medium: expect.objectContaining({
            averageExecutionTime: expect.any(Number),
            memoryUsage: expect.any(Number),
          }),
          high: expect.objectContaining({
            averageExecutionTime: expect.any(Number),
            memoryUsage: expect.any(Number),
          }),
          extreme: expect.objectContaining({
            averageExecutionTime: expect.any(Number),
            memoryUsage: expect.any(Number),
          }),
        }),
        performanceDegradationCurve: expect.any(Array),
        memoryPressureThreshold: expect.any(Number),
        recommendations: expect.any(Array),
      });
    });

    it('should validate worklet stability across multiple execution cycles', () => {
      expect(global.WorkletTestUtils.validateWorkletStabilityAcrossCycles).toBeInstanceOf(Function);

      const stressTestWorklet = global.WorkletTestUtils.worklet((cycleData: any) => {
        // Simulate operations that might accumulate memory or state issues
        const sharedValue = global.WorkletTestUtils.createSharedValue(cycleData.initialValue);
        
        for (let i = 0; i < cycleData.iterations; i++) {
          sharedValue.value = sharedValue.value * 1.1 + Math.random();
        }
        
        return sharedValue.value;
      });

      const stabilityReport = global.WorkletTestUtils.validateWorkletStabilityAcrossCycles(
        stressTestWorklet,
        {
          cycleCount: 20,
          iterationsPerCycle: 100,
          memoryMonitoring: true,
        }
      );

      expect(stabilityReport).toMatchObject({
        executionStability: expect.any(Number),
        memoryStability: expect.any(Number),
        performanceConsistency: expect.any(Number),
        failureCount: expect.any(Number),
        memoryLeakTrend: expect.any(Array),
        stabilityScore: expect.any(Number),
        criticalIssues: expect.any(Array),
        recommendations: expect.any(Array),
      });
    });
  });

  describe('Edge Cases and Complex Scenarios', () => {
    it('should handle worklet memory leaks with nested SharedValues', () => {
      expect(global.WorkletTestUtils.detectNestedSharedValueLeaks).toBeInstanceOf(Function);

      const nestedWorklet = global.WorkletTestUtils.worklet((depth: number) => {
        const createNested = (level: number): any => {
          if (level <= 0) return global.WorkletTestUtils.createSharedValue(Math.random());
          
          return {
            current: global.WorkletTestUtils.createSharedValue(level),
            nested: createNested(level - 1),
          };
        };
        
        return createNested(depth);
      });

      // Execute with different nesting depths
      const results = [2, 4, 6, 8].map(depth => 
        global.WorkletTestUtils.executeWorklet(nestedWorklet, [depth])
      );

      const nestedLeakReport = global.WorkletTestUtils.detectNestedSharedValueLeaks();

      expect(nestedLeakReport).toMatchObject({
        nestingLevels: expect.any(Array),
        leaksPerLevel: expect.any(Array),
        totalSharedValues: expect.any(Number),
        orphanedValues: expect.any(Number),
        deepestLeakLevel: expect.any(Number),
        memoryImpact: expect.any(Number),
        cleanupRecommendations: expect.any(Array),
      });
    });

    it('should validate worklet cleanup with runOnJS callbacks', () => {
      expect(global.WorkletTestUtils.validateRunOnJSCleanup).toBeInstanceOf(Function);

      const callbackWorklet = global.WorkletTestUtils.worklet((callbackCount: number) => {
        const callbacks = [];
        
        for (let i = 0; i < callbackCount; i++) {
          callbacks.push(
            global.WorkletTestUtils.runOnJS(() => {
              console.log(`Callback ${i} executed`);
              return i;
            })
          );
        }
        
        // Execute some callbacks
        callbacks.slice(0, Math.floor(callbackCount / 2)).forEach(cb => cb());
        
        return callbacks.length;
      });

      // Execute worklet with different callback counts
      [5, 10, 20].forEach(count => {
        global.WorkletTestUtils.executeWorklet(callbackWorklet, [count]);
      });

      const callbackCleanupReport = global.WorkletTestUtils.validateRunOnJSCleanup();

      expect(callbackCleanupReport).toMatchObject({
        totalCallbacksCreated: expect.any(Number),
        callbacksExecuted: expect.any(Number),
        pendingCallbacks: expect.any(Number),
        orphanedCallbacks: expect.any(Number),
        memoryUsedByCallbacks: expect.any(Number),
        cleanupEfficiency: expect.any(Number),
        recommendations: expect.any(Array),
      });
    });

    it('should measure worklet performance impact on UI thread', () => {
      expect(global.WorkletTestUtils.measureUIThreadImpact).toBeInstanceOf(Function);

      const heavyWorklet = global.WorkletTestUtils.worklet((workload: any) => {
        // Simulate heavy computation
        let result = 0;
        for (let i = 0; i < workload.iterations; i++) {
          result += Math.pow(Math.sin(i), 2) + Math.cos(i * 0.1);
          
          // Simulate SharedValue updates
          if (i % 100 === 0) {
            const sharedValue = global.WorkletTestUtils.createSharedValue(result);
            result = sharedValue.value;
          }
        }
        
        // Trigger runOnJS callbacks
        for (let i = 0; i < workload.jsCallbacks; i++) {
          global.WorkletTestUtils.runOnJS(() => {
            return `Callback ${i}`;
          })();
        }
        
        return result;
      });

      const uiThreadImpactReport = global.WorkletTestUtils.measureUIThreadImpact(
        heavyWorklet,
        { iterations: 10000, jsCallbacks: 5 }
      );

      expect(uiThreadImpactReport).toMatchObject({
        workletExecutionTime: expect.any(Number),
        uiThreadBlockingTime: expect.any(Number),
        jsCallbackOverhead: expect.any(Number),
        frameDropRisk: expect.any(Boolean),
        performanceImpactScore: expect.any(Number),
        recommendations: expect.any(Array),
      });
    });
  });

  describe('Integration with Existing Test Infrastructure', () => {
    it('should integrate with performance monitoring from Task 1.1', () => {
      expect(global.SpatialPerformanceTestUtils).toBeDefined();
      expect(global.WorkletTestUtils.integrateWithSpatialPerformance).toBeInstanceOf(Function);

      const spatialWorklet = global.WorkletTestUtils.worklet((coordinates: any, viewport: any) => {
        // Simulate coordinate transformation in worklet
        return {
          x: coordinates.x * viewport.scale + viewport.translateX,
          y: coordinates.y * viewport.scale + viewport.translateY,
        };
      });

      const integration = global.WorkletTestUtils.integrateWithSpatialPerformance(
        spatialWorklet,
        { x: 100, y: 200 },
        { scale: 1.5, translateX: 50, translateY: 75 }
      );

      expect(integration).toMatchObject({
        workletPerformance: expect.objectContaining({
          executionTime: expect.any(Number),
          memoryUsage: expect.any(Number),
        }),
        spatialPerformance: expect.objectContaining({
          coordinateTransformTime: expect.any(Number),
        }),
        combinedEfficiency: expect.any(Number),
        performanceComparison: expect.any(Object),
      });
    });

    it('should work with enhanced gesture simulation from Task 1.2', () => {
      expect(global.GestureTestUtils).toBeDefined();
      expect(global.WorkletTestUtils.integrateWithGestureSimulation).toBeInstanceOf(Function);

      const gestureWorklet = global.WorkletTestUtils.worklet((gestureEvent: any) => {
        const sharedValue = global.WorkletTestUtils.createSharedValue(0);
        sharedValue.value = gestureEvent.translationX + gestureEvent.translationY;
        return sharedValue.value;
      });

      const mockHandler = { onGestureEvent: gestureWorklet };

      const gestureIntegration = global.WorkletTestUtils.integrateWithGestureSimulation(
        mockHandler,
        'complex_pan_with_momentum',
        {
          startPoint: { x: 0, y: 0 },
          endPoint: { x: 200, y: 100 },
          velocity: { x: 300, y: 150 },
        }
      );

      expect(gestureIntegration).toMatchObject({
        gestureSimulationResult: expect.any(Object),
        workletExecutionMetrics: expect.objectContaining({
          totalExecutions: expect.any(Number),
          averageExecutionTime: expect.any(Number),
          memoryUsagePattern: expect.any(Array),
        }),
        memoryLeakDetection: expect.objectContaining({
          leaksDetected: expect.any(Boolean),
          recommendations: expect.any(Array),
        }),
        performanceIntegration: expect.objectContaining({
          combinedPerformanceScore: expect.any(Number),
        }),
      });
    });
  });
});