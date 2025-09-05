/**
 * Test Utilities Validation Tests
 * 
 * Tests to verify that our enhanced test utilities library provides
 * comprehensive testing capabilities for galaxy map components.
 */

import {
  createMockBeacon,
  createMockBeaconGrid,
  createMockConnections,
  createMockViewportState,
  createMockModuleContext,
  TestModuleManager,
  performanceTestUtils,
  gestureTestUtils,
  workletTestUtils,
  setupTestEnvironment,
  testAssertions,
  createIntegrationTestSuite,
} from './test-utils';

describe('Test Utilities Library Validation', () => {
  describe('Mock Data Generation', () => {
    describe('createMockBeacon', () => {
      it('should create beacon with default values', () => {
        const beacon = createMockBeacon('test-beacon');
        
        expect(beacon.id).toBe('test-beacon');
        expect(beacon.position).toEqual({ x: 0, y: 0 });
        expect(beacon.level).toBe(1);
        expect(beacon.type).toBe('pioneer');
        expect(beacon.connections).toEqual([]);
      });

      it('should accept custom position and options', () => {
        const beacon = createMockBeacon(
          'custom-beacon',
          { x: 100, y: 200 },
          { level: 3, type: 'harvester' }
        );
        
        expect(beacon.id).toBe('custom-beacon');
        expect(beacon.position).toEqual({ x: 100, y: 200 });
        expect(beacon.level).toBe(3);
        expect(beacon.type).toBe('harvester');
      });
    });

    describe('createMockBeaconGrid', () => {
      it('should create grid of beacons', () => {
        const beacons = createMockBeaconGrid(2, 2, 50);
        
        expect(beacons).toHaveLength(4);
        expect(beacons[0].id).toBe('beacon-0-0');
        expect(beacons[0].position).toEqual({ x: 0, y: 0 });
        expect(beacons[3].id).toBe('beacon-1-1');
        expect(beacons[3].position).toEqual({ x: 50, y: 50 });
      });

      it('should use default spacing', () => {
        const beacons = createMockBeaconGrid(2, 1);
        
        expect(beacons).toHaveLength(2);
        expect(beacons[1].position).toEqual({ x: 100, y: 0 });
      });
    });

    describe('createMockConnections', () => {
      it('should create connections between beacons', () => {
        const beacons = createMockBeaconGrid(3, 1);
        const connections = createMockConnections(beacons);
        
        expect(Array.isArray(connections)).toBe(true);
        connections.forEach(connection => {
          expect(typeof connection.sourceId).toBe('string');
          expect(typeof connection.targetId).toBe('string');
          expect(typeof connection.id).toBe('string');
          expect(typeof connection.strength).toBe('number');
          expect(typeof connection.isActive).toBe('boolean');
          expect(Array.isArray(connection.patterns)).toBe(true);
        });
      });
    });

    describe('createMockViewportState', () => {
      it('should create viewport with defaults', () => {
        const viewport = createMockViewportState();
        
        testAssertions.expectValidViewportState(viewport);
        expect(viewport.translateX).toBe(0);
        expect(viewport.translateY).toBe(0);
        expect(viewport.scale).toBe(1);
      });

      it('should accept overrides', () => {
        const viewport = createMockViewportState({
          translateX: 100,
          scale: 2,
        });
        
        expect(viewport.translateX).toBe(100);
        expect(viewport.scale).toBe(2);
        expect(viewport.translateY).toBe(0); // Default preserved
      });
    });

    describe('createMockModuleContext', () => {
      it('should create valid module context', () => {
        const context = createMockModuleContext();
        
        testAssertions.expectValidModuleContext(context);
      });

      it('should accept custom beacons and connections', () => {
        const beacons = createMockBeaconGrid(2, 2);
        const connections = createMockConnections(beacons);
        
        const context = createMockModuleContext({
          beacons,
          connections,
        });
        
        expect(context.beacons).toHaveLength(4);
        expect(context.connections).toEqual(connections);
      });
    });
  });

  describe('TestModuleManager', () => {
    let moduleManager: TestModuleManager;

    beforeEach(() => {
      moduleManager = new TestModuleManager();
    });

    it('should add and track modules', () => {
      moduleManager
        .addModule('beacon-rendering', true)
        .addModule('connection-rendering', false);
      
      expect(moduleManager.getAllModules()).toHaveLength(2);
      expect(moduleManager.getEnabledModules()).toEqual(['beacon-rendering']);
    });

    it('should enable and disable modules', () => {
      moduleManager.addModule('test-module', false);
      
      expect(moduleManager.getEnabledModules()).not.toContain('test-module');
      
      moduleManager.enableModule('test-module');
      expect(moduleManager.getEnabledModules()).toContain('test-module');
      
      moduleManager.disableModule('test-module');
      expect(moduleManager.getEnabledModules()).not.toContain('test-module');
    });

    it('should provide event bus', () => {
      const eventBus = moduleManager.getEventBus();
      
      expect(eventBus.subscribe).toBeDefined();
      expect(eventBus.emit).toBeDefined();
    });

    it('should render enabled modules', () => {
      moduleManager
        .addModule('module1', true)
        .addModule('module2', false)
        .addModule('module3', true);
      
      const context = createMockModuleContext();
      const rendered = moduleManager.renderModules(context);
      
      expect(rendered).toHaveLength(2); // Only enabled modules
    });

    it('should reset state', () => {
      moduleManager.addModule('test-module');
      expect(moduleManager.getAllModules()).toHaveLength(1);
      
      moduleManager.reset();
      expect(moduleManager.getAllModules()).toHaveLength(0);
    });
  });

  describe('Performance Test Utils', () => {
    describe('measureRenderTime', () => {
      it('should measure execution time', () => {
        const renderTime = performanceTestUtils.measureRenderTime(() => {
          // Simulate some work
          for (let i = 0; i < 1000; i++) {
            Math.random();
          }
        });
        
        expect(typeof renderTime).toBe('number');
        expect(renderTime).toBeGreaterThanOrEqual(0);
      });
    });

    describe('simulateFrameSkip', () => {
      it('should determine frame skip conditions', () => {
        expect(performanceTestUtils.simulateFrameSkip(60)).toBe(false);
        expect(performanceTestUtils.simulateFrameSkip(25)).toBe(true);
        expect(performanceTestUtils.simulateFrameSkip(30, 60)).toBe(false);
        expect(performanceTestUtils.simulateFrameSkip(29, 60)).toBe(true);
      });
    });

    describe('createPerformanceMonitor', () => {
      it('should create performance monitor mock', () => {
        const monitor = performanceTestUtils.createPerformanceMonitor();
        
        expect(monitor.startTiming).toBeDefined();
        expect(monitor.endTiming).toBeDefined();
        expect(monitor.getAverageFps).toBeDefined();
        expect(monitor.shouldSkipFrame).toBeDefined();
        expect(monitor.reportPerformance).toBeDefined();
        expect(monitor.reset).toBeDefined();
        
        expect(monitor.getAverageFps()).toBe(60);
        expect(monitor.shouldSkipFrame()).toBe(false);
      });
    });
  });

  describe('Gesture Test Utils', () => {
    it('should provide gesture simulation methods', () => {
      expect(typeof gestureTestUtils.simulatePanSequence).toBe('function');
      expect(typeof gestureTestUtils.simulatePinchZoom).toBe('function');
      expect(typeof gestureTestUtils.simulateTap).toBe('function');
    });

    it('should simulate pan sequence without errors', () => {
      const mockHandler = {
        onGestureEvent: jest.fn(),
        onHandlerStateChange: jest.fn(),
      };
      
      // Should not throw
      gestureTestUtils.simulatePanSequence(
        mockHandler,
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        3
      );
    });

    it('should simulate pinch zoom without errors', () => {
      const mockHandler = {
        onGestureEvent: jest.fn(),
        onHandlerStateChange: jest.fn(),
      };
      
      // Should not throw
      gestureTestUtils.simulatePinchZoom(mockHandler, 1, 2);
    });

    it('should simulate tap without errors', () => {
      const mockHandler = {
        onGestureEvent: jest.fn(),
        onHandlerStateChange: jest.fn(),
      };
      
      // Should not throw
      gestureTestUtils.simulateTap(mockHandler, { x: 100, y: 200 });
    });
  });

  describe('Worklet Test Utils', () => {
    beforeEach(() => {
      workletTestUtils.resetWorkletContext();
    });

    it('should provide worklet testing methods', () => {
      expect(typeof workletTestUtils.createTestSharedValue).toBe('function');
      expect(typeof workletTestUtils.executeWorklet).toBe('function');
      expect(typeof workletTestUtils.simulateRunOnJS).toBe('function');
      expect(typeof workletTestUtils.resetWorkletContext).toBe('function');
    });

    it('should create test shared values', () => {
      const sharedValue = workletTestUtils.createTestSharedValue(42);
      
      expect(sharedValue).toBeDefined();
      expect(sharedValue.value).toBe(42);
    });

    it('should execute worklets', () => {
      const workletFn = (a: number, b: number) => a + b;
      const result = workletTestUtils.executeWorklet(workletFn, [5, 7]);
      
      expect(result).toBe(12);
    });

    it('should simulate runOnJS calls', (done) => {
      const jsCallback = jest.fn((value) => {
        expect(value).toBe('test');
        done();
      });
      
      workletTestUtils.simulateRunOnJS(jsCallback, ['test']);
    });
  });

  describe('Test Environment Setup', () => {
    it('should setup test environment with defaults', () => {
      const env = setupTestEnvironment();
      
      expect(env).toBeDefined();
    });

    it('should setup with performance monitoring', () => {
      const env = setupTestEnvironment({ setupPerformanceMonitoring: true });
      
      expect(env.performanceMonitor).toBeDefined();
    });

    it('should provide console restoration when not in debug mode', () => {
      const env = setupTestEnvironment({ 
        setupPerformanceMonitoring: true,
        enableDebugMode: false 
      });
      
      expect(env.restoreConsole).toBeDefined();
      expect(typeof env.restoreConsole).toBe('function');
    });
  });

  describe('Test Assertions', () => {
    describe('expectValidViewportState', () => {
      it('should validate valid viewport state', () => {
        const viewport = createMockViewportState();
        
        // Should not throw
        expect(() => {
          testAssertions.expectValidViewportState(viewport);
        }).not.toThrow();
      });

      it('should reject invalid viewport state', () => {
        const invalidViewport = { translateX: 'invalid' } as any;
        
        expect(() => {
          testAssertions.expectValidViewportState(invalidViewport);
        }).toThrow();
      });
    });

    describe('expectValidBeacon', () => {
      it('should validate valid beacon', () => {
        const beacon = createMockBeacon('test');
        
        // Should not throw
        expect(() => {
          testAssertions.expectValidBeacon(beacon);
        }).not.toThrow();
      });

      it('should reject invalid beacon type', () => {
        const invalidBeacon = createMockBeacon('test', { x: 0, y: 0 }, { type: 'invalid' as any });
        
        expect(() => {
          testAssertions.expectValidBeacon(invalidBeacon);
        }).toThrow();
      });
    });

    describe('expectValidModuleContext', () => {
      it('should validate valid module context', () => {
        const context = createMockModuleContext();
        
        // Should not throw
        expect(() => {
          testAssertions.expectValidModuleContext(context);
        }).not.toThrow();
      });
    });
  });

  describe('Integration Test Suite', () => {
    it('should create integration test suite', () => {
      const suite = createIntegrationTestSuite('Test Suite');
      
      expect(suite.setup).toBeDefined();
      expect(suite.createTestScenario).toBeDefined();
      expect(suite.cleanup).toBeDefined();
    });

    it('should create test scenarios', () => {
      const suite = createIntegrationTestSuite('Galaxy Tests');
      const scenario = suite.createTestScenario('Basic Scenario', {
        beaconCount: 4,
        viewportScale: 1.5,
        enabledModules: ['beacon-rendering', 'connection-rendering'],
      });
      
      expect(scenario.name).toBe('Galaxy Tests - Basic Scenario');
      expect(scenario.beacons).toHaveLength(4);
      expect(scenario.viewport.scale).toBe(1.5);
      expect(scenario.moduleManager.getEnabledModules()).toEqual([
        'beacon-rendering',
        'connection-rendering'
      ]);
    });

    it('should provide setup and cleanup', () => {
      const suite = createIntegrationTestSuite('Test Suite');
      
      // Should not throw
      expect(() => {
        const env = suite.setup();
        suite.cleanup();
      }).not.toThrow();
    });
  });
});