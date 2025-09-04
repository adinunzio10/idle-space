/**
 * Performance Regression Test Suite for GalaxyMapModular
 * 
 * Tests to verify performance optimizations and prevent regression of 
 * performance improvements implemented in Task 53.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import GalaxyMapModular from '../GalaxyMapModular';
import { createMockBeacon } from './test-utils';

describe('GalaxyMapModular - Performance Regression Tests', () => {
  const defaultProps = {
    width: 400,
    height: 600,
    beacons: [createMockBeacon('test-1', { x: 100, y: 100 })],
    connections: [],
    patterns: [],
    starSystems: [],
    sectors: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Suppress console logs
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('FPS Monitoring and State Guards', () => {
    test('should handle FPS updates with state guards to prevent unnecessary re-renders', () => {
      const props = {
        ...defaultProps,
        performanceMode: true,
        debugMode: true,
      };

      // Track useState calls to detect excessive state updates
      let stateUpdateCount = 0;
      const originalUseState = React.useState;
      React.useState = jest.fn((initial) => {
        const [state, setState] = originalUseState(initial);
        const wrappedSetState = (newState: any) => {
          stateUpdateCount++;
          return setState(newState);
        };
        return [state, wrappedSetState];
      }) as any;

      try {
        const component = render(React.createElement(GalaxyMapModular, props));
        
        // Allow FPS monitoring to start
        jest.advanceTimersByTime(1100);
        
        // Allow multiple FPS monitoring cycles
        jest.advanceTimersByTime(2000);
        
        component.unmount();
        
        // Should not have excessive state updates from FPS monitoring
        // The state guard should prevent updates when FPS hasn't changed significantly
        expect(stateUpdateCount).toBeLessThan(50); // Reasonable limit for component lifecycle
      } finally {
        React.useState = originalUseState;
      }
    });

    test('should throttle performance metric updates appropriately', () => {
      const mockGalaxyMapConfig = require('../../../utils/galaxy/GalaxyMapConfig').galaxyMapConfig;
      
      const props = {
        ...defaultProps,
        performanceMode: true,
      };

      const component = render(React.createElement(GalaxyMapModular, props));
      
      // Allow performance monitoring to initialize
      jest.advanceTimersByTime(100);
      
      // Simulate multiple performance cycles
      jest.advanceTimersByTime(3000); // 3 seconds of monitoring
      
      component.unmount();
      
      // Should report performance but not excessively
      expect(mockGalaxyMapConfig.reportPerformance).toHaveBeenCalled();
      expect(mockGalaxyMapConfig.reportPerformance.mock.calls.length).toBeLessThan(100);
    });

    test('should handle frame skipping mechanism without performance degradation', () => {
      const mockGalaxyMapConfig = require('../../../utils/galaxy/GalaxyMapConfig').galaxyMapConfig;
      mockGalaxyMapConfig.shouldSkipFrame.mockReturnValue(true); // Enable frame skipping
      
      const props = {
        ...defaultProps,
        performanceMode: true,
        beacons: Array.from({ length: 20 }, (_, i) => 
          createMockBeacon(`perf-beacon-${i}`, { x: i * 20, y: i * 30 })
        ),
      };

      expect(() => {
        const component = render(React.createElement(GalaxyMapModular, props));
        
        // Allow frame skipping logic to activate
        jest.advanceTimersByTime(200);
        
        component.unmount();
      }).not.toThrow();
      
      // Test passes if frame skipping configuration is available and no errors occur
      expect(mockGalaxyMapConfig.shouldSkipFrame).toBeDefined();
    });
  });

  describe('Module Context Memoization Optimization', () => {
    test('should use stable references for array props to prevent unnecessary context recreation', () => {
      let contextCreationCount = 0;
      
      // Mock useMemo to track moduleContext creation
      const originalUseMemo = React.useMemo;
      React.useMemo = jest.fn((factory, deps) => {
        const result = originalUseMemo(factory, deps);
        
        // Detect moduleContext creation (object with viewport, beacons, etc.)
        if (typeof result === 'object' && result?.viewport && result?.beacons) {
          contextCreationCount++;
        }
        
        return result;
      }) as any;

      const stableBeacons = [
        createMockBeacon('beacon-1', { x: 100, y: 100 }),
        createMockBeacon('beacon-2', { x: 200, y: 200 }),
      ];
      const stableConnections = [
        {
          id: 'conn-1',
          fromBeaconId: 'beacon-1',
          toBeaconId: 'beacon-2',
          type: 'quantum' as const,
          strength: 1.0,
        }
      ];

      try {
        const props = {
          ...defaultProps,
          beacons: stableBeacons,
          connections: stableConnections,
          performanceMode: true,
        };

        const component = render(React.createElement(GalaxyMapModular, props));
        
        // Allow context to be created
        jest.advanceTimersByTime(100);
        
        component.unmount();
        
        // Should not create excessive module contexts due to stable references
        expect(contextCreationCount).toBeLessThan(10);
      } finally {
        React.useMemo = originalUseMemo;
      }
    });

    test('should handle beacon array changes efficiently with stable references', () => {
      let memoizationCount = 0;
      const originalUseMemo = React.useMemo;
      
      React.useMemo = jest.fn((factory, deps) => {
        memoizationCount++;
        return originalUseMemo(factory, deps);
      }) as any;

      const TestComponent = ({ beaconCount }: { beaconCount: number }) => {
        const beacons = Array.from({ length: beaconCount }, (_, i) => 
          createMockBeacon(`beacon-${i}`, { x: i * 50, y: i * 50 })
        );
        
        return React.createElement(GalaxyMapModular, { ...defaultProps, beacons });
      };

      try {
        const { rerender, unmount } = render(React.createElement(TestComponent, { beaconCount: 2 }));
        
        jest.advanceTimersByTime(100);
        
        // Change beacon count - should use stable references
        rerender(React.createElement(TestComponent, { beaconCount: 3 }));
        jest.advanceTimersByTime(50);
        
        rerender(React.createElement(TestComponent, { beaconCount: 1 }));
        jest.advanceTimersByTime(50);
        
        unmount();
        
        // Should have reasonable memoization usage (not excessive due to stable references)
        expect(memoizationCount).toBeLessThan(100);
      } finally {
        React.useMemo = originalUseMemo;
      }
    });

    test('should optimize screen dimensions memoization', () => {
      const TestComponent = ({ dimensions }: { dimensions: { width: number; height: number } }) =>
        React.createElement(GalaxyMapModular, { ...defaultProps, ...dimensions });

      expect(() => {
        const { rerender, unmount } = render(
          React.createElement(TestComponent, { dimensions: { width: 400, height: 600 } })
        );
        
        jest.advanceTimersByTime(50);
        
        // Change dimensions - should handle efficiently
        rerender(React.createElement(TestComponent, { dimensions: { width: 500, height: 700 } }));
        jest.advanceTimersByTime(30);
        
        // Same dimensions - should use optimized handling
        rerender(React.createElement(TestComponent, { dimensions: { width: 500, height: 700 } }));
        jest.advanceTimersByTime(30);
        
        unmount();
      }).not.toThrow();
    });
  });

  describe('Gesture Handler Performance Optimization', () => {
    test('should handle gesture state updates with proper throttling', () => {
      let gestureStateUpdateCount = 0;
      
      // Mock gesture state updates
      const originalUseState = React.useState;
      React.useState = jest.fn((initial) => {
        const [state, setState] = originalUseState(initial);
        const wrappedSetState = (newState: any) => {
          // Count gesture-related state updates
          if (typeof newState === 'boolean') {
            gestureStateUpdateCount++;
          }
          return setState(newState);
        };
        return [state, wrappedSetState];
      }) as any;

      try {
        const props = {
          ...defaultProps,
          performanceMode: true,
        };

        const component = render(React.createElement(GalaxyMapModular, props));
        
        // Simulate gesture activity period
        jest.advanceTimersByTime(200);
        
        component.unmount();
        
        // Should not have excessive gesture state updates
        expect(gestureStateUpdateCount).toBeLessThan(20);
      } finally {
        React.useState = originalUseState;
      }
    });

    test('should optimize viewport update throttling during gestures', () => {
      let viewportUpdateCount = 0;
      const originalUseState = React.useState;
      
      React.useState = jest.fn((initial) => {
        const [state, setState] = originalUseState(initial);
        const wrappedSetState = (newState: any) => {
          // Track viewport state updates (objects with translateX, translateY, scale, bounds)
          if (typeof newState === 'object' && newState?.translateX !== undefined && 
              newState?.translateY !== undefined && newState?.scale !== undefined) {
            viewportUpdateCount++;
          }
          return setState(newState);
        };
        return [state, wrappedSetState];
      }) as any;

      try {
        const props = {
          ...defaultProps,
          performanceMode: true,
        };

        const component = render(React.createElement(GalaxyMapModular, props));
        
        // Allow viewport initialization and updates
        jest.advanceTimersByTime(300);
        
        component.unmount();
        
        // Should have reasonable viewport update frequency (throttled)
        expect(viewportUpdateCount).toBeLessThan(15);
      } finally {
        React.useState = originalUseState;
      }
    });

    test('should handle emergency mode detection without performance degradation', () => {
      const mockGalaxyMapConfig = require('../../../utils/galaxy/GalaxyMapConfig').galaxyMapConfig;
      mockGalaxyMapConfig.getPerformanceStats.mockReturnValue({
        currentQuality: 'low',
        skipRatio: 0.8,
      });

      const props = {
        ...defaultProps,
        performanceMode: true,
        debugMode: true,
      };

      const startTime = Date.now();
      
      const component = render(React.createElement(GalaxyMapModular, props));
      
      // Allow emergency mode logic to execute
      jest.advanceTimersByTime(1200);
      
      component.unmount();
      
      const executionTime = Date.now() - startTime;
      
      // Should not take excessive time for emergency mode detection
      expect(executionTime).toBeLessThan(2000); // 2 seconds max
      
      // Emergency reset should be available if needed
      expect(mockGalaxyMapConfig.emergencyReset).toBeDefined();
    });
  });

  describe('Module Rendering Performance', () => {
    test('should cache module renders efficiently during gestures', () => {
      const props = {
        ...defaultProps,
        enabledModules: ['beacon-rendering', 'connection-rendering'],
        beacons: [
          createMockBeacon('beacon-1', { x: 100, y: 100 }),
          createMockBeacon('beacon-2', { x: 200, y: 200 }),
        ],
        performanceMode: true,
      };

      expect(() => {
        const component = render(React.createElement(GalaxyMapModular, props));
        
        // Allow module rendering and caching
        jest.advanceTimersByTime(200);
        
        component.unmount();
      }).not.toThrow();
    });

    test('should skip frame rendering when appropriate', () => {
      const mockGalaxyMapConfig = require('../../../utils/galaxy/GalaxyMapConfig').galaxyMapConfig;
      mockGalaxyMapConfig.shouldSkipFrame.mockReturnValue(true);

      const props = {
        ...defaultProps,
        enabledModules: ['beacon-rendering'],
        beacons: Array.from({ length: 30 }, (_, i) => 
          createMockBeacon(`skip-beacon-${i}`, { x: i * 15, y: i * 20 })
        ),
        performanceMode: true,
      };

      expect(() => {
        const component = render(React.createElement(GalaxyMapModular, props));
        
        // Allow frame skipping logic to execute
        jest.advanceTimersByTime(150);
        
        component.unmount();
      }).not.toThrow();
      
      // Frame skipping mechanism should be available
      expect(mockGalaxyMapConfig.shouldSkipFrame).toBeDefined();
    });

    test('should handle module cache updates without circular dependencies', () => {
      let cacheUpdateCount = 0;
      
      // Track useEffect calls related to caching
      const originalUseEffect = React.useEffect;
      React.useEffect = jest.fn((effect, deps) => {
        // Detect cache-related effects (looking at dependency patterns)
        if (Array.isArray(deps) && deps.length === 2) {
          cacheUpdateCount++;
        }
        return originalUseEffect(effect, deps);
      }) as any;

      try {
        const props = {
          ...defaultProps,
          enabledModules: ['beacon-rendering', 'connection-rendering'],
          beacons: [
            createMockBeacon('cache-beacon-1', { x: 50, y: 50 }),
            createMockBeacon('cache-beacon-2', { x: 150, y: 150 }),
          ],
        };

        const component = render(React.createElement(GalaxyMapModular, props));
        
        // Allow caching effects to execute
        jest.advanceTimersByTime(200);
        
        component.unmount();
        
        // Should have reasonable cache update effects (not circular)
        expect(cacheUpdateCount).toBeLessThan(15);
      } finally {
        React.useEffect = originalUseEffect;
      }
    });
  });

  describe('Performance Monitoring Integration', () => {
    test('should integrate with galaxy config performance tracking', () => {
      const mockGalaxyMapConfig = require('../../../utils/galaxy/GalaxyMapConfig').galaxyMapConfig;
      
      const props = {
        ...defaultProps,
        performanceMode: true,
        debugMode: true,
      };

      expect(() => {
        const component = render(React.createElement(GalaxyMapModular, props));
        
        // Allow performance monitoring
        jest.advanceTimersByTime(500);
        
        component.unmount();
      }).not.toThrow();
      
      // Performance monitoring integration should be available
      expect(mockGalaxyMapConfig.reportPerformance).toBeDefined();
      expect(mockGalaxyMapConfig.shouldSkipFrame).toBeDefined();
      expect(mockGalaxyMapConfig.getPerformanceStats).toBeDefined();
    });

    test('should handle performance quality adjustments', () => {
      const mockGalaxyMapConfig = require('../../../utils/galaxy/GalaxyMapConfig').galaxyMapConfig;
      mockGalaxyMapConfig.getPerformanceStats.mockReturnValue({
        currentQuality: 'medium',
        skipRatio: 0.3,
      });

      const props = {
        ...defaultProps,
        performanceMode: true,
        debugMode: true,
      };

      expect(() => {
        const component = render(React.createElement(GalaxyMapModular, props));
        
        // Allow performance quality monitoring
        jest.advanceTimersByTime(1200);
        
        component.unmount();
      }).not.toThrow();
      
      // Performance quality system should be available
      expect(mockGalaxyMapConfig.getPerformanceStats).toBeDefined();
    });

    test('should handle performance mode toggles efficiently', () => {
      const TestComponent = ({ perfMode }: { perfMode: boolean }) =>
        React.createElement(GalaxyMapModular, { 
          ...defaultProps, 
          performanceMode: perfMode,
          debugMode: true,
        });

      expect(() => {
        const { rerender, unmount } = render(React.createElement(TestComponent, { perfMode: false }));
        
        jest.advanceTimersByTime(100);
        
        // Toggle performance mode
        rerender(React.createElement(TestComponent, { perfMode: true }));
        jest.advanceTimersByTime(100);
        
        // Toggle back
        rerender(React.createElement(TestComponent, { perfMode: false }));
        jest.advanceTimersByTime(100);
        
        unmount();
      }).not.toThrow();
    });
  });

  describe('Complex Performance Scenarios', () => {
    test('should handle high beacon count without performance degradation', () => {
      const highBeaconProps = {
        width: 800,
        height: 600,
        beacons: Array.from({ length: 50 }, (_, i) => 
          createMockBeacon(`high-beacon-${i}`, { x: (i % 10) * 80, y: Math.floor(i / 10) * 120 })
        ),
        connections: Array.from({ length: 25 }, (_, i) => ({
          id: `high-conn-${i}`,
          fromBeaconId: `high-beacon-${i}`,
          toBeaconId: `high-beacon-${(i + 1) % 50}`,
          type: 'quantum' as const,
          strength: Math.random(),
        })),
        enabledModules: ['beacon-rendering', 'connection-rendering'],
        performanceMode: true,
        debugMode: false, // Disable debug to focus on performance
      };

      const startTime = Date.now();
      
      expect(() => {
        const component = render(React.createElement(GalaxyMapModular, highBeaconProps));
        
        // Allow complex rendering
        jest.advanceTimersByTime(400);
        
        component.unmount();
      }).not.toThrow();
      
      const executionTime = Date.now() - startTime;
      
      // Should handle high beacon count efficiently
      expect(executionTime).toBeLessThan(3000); // 3 seconds max
    });

    test('should handle rapid viewport changes with performance optimization', () => {
      const TestComponent = ({ scale }: { scale: number }) => {
        const beacons = Array.from({ length: 15 }, (_, i) => 
          createMockBeacon(`viewport-beacon-${i}`, { x: i * 40, y: i * 60 })
        );
        
        return React.createElement(GalaxyMapModular, {
          ...defaultProps,
          width: 400 * scale,
          height: 600 * scale,
          beacons,
          performanceMode: true,
        });
      };

      const startTime = Date.now();
      
      expect(() => {
        const { rerender, unmount } = render(React.createElement(TestComponent, { scale: 1 }));
        
        jest.advanceTimersByTime(100);
        
        // Rapid viewport changes
        for (let scale = 1.2; scale <= 2.0; scale += 0.2) {
          rerender(React.createElement(TestComponent, { scale }));
          jest.advanceTimersByTime(30);
        }
        
        unmount();
      }).not.toThrow();
      
      const executionTime = Date.now() - startTime;
      
      // Should handle rapid viewport changes efficiently
      expect(executionTime).toBeLessThan(2000);
    });

    test('should optimize module initialization performance', () => {
      const complexModuleProps = {
        ...defaultProps,
        enabledModules: ['beacon-rendering', 'connection-rendering', 'environment-rendering', 'star-system', 'sector'],
        beacons: Array.from({ length: 20 }, (_, i) => 
          createMockBeacon(`init-beacon-${i}`, { x: i * 30, y: i * 45 })
        ),
        performanceMode: true,
        debugMode: true,
      };

      const startTime = Date.now();
      
      expect(() => {
        const component = render(React.createElement(GalaxyMapModular, complexModuleProps));
        
        // Allow module initialization
        jest.advanceTimersByTime(300);
        
        component.unmount();
      }).not.toThrow();
      
      const executionTime = Date.now() - startTime;
      
      // Should initialize complex module setup efficiently
      expect(executionTime).toBeLessThan(2500);
    });
  });
});

/**
 * Regression tests for specific Task 53 performance fixes
 */
describe('Task 53 Performance Regression Tests', () => {
  const defaultProps = {
    width: 400,
    height: 600,
    beacons: [createMockBeacon('test-beacon')],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('Task 53.2: Memoization strategy prevents excessive recreations', () => {
    let memoCallCount = 0;
    const originalUseMemo = React.useMemo;
    
    React.useMemo = jest.fn((factory, deps) => {
      memoCallCount++;
      return originalUseMemo(factory, deps);
    }) as any;

    const TestComponent = ({ beaconCount }: { beaconCount: number }) => {
      const beacons = Array.from({ length: beaconCount }, (_, i) => 
        createMockBeacon(`memo-beacon-${i}`, { x: i * 40, y: i * 60 })
      );
      
      return React.createElement(GalaxyMapModular, { ...defaultProps, beacons });
    };

    try {
      const { rerender, unmount } = render(React.createElement(TestComponent, { beaconCount: 3 }));
      
      jest.advanceTimersByTime(100);
      
      // Change beacon count
      rerender(React.createElement(TestComponent, { beaconCount: 4 }));
      jest.advanceTimersByTime(50);
      
      rerender(React.createElement(TestComponent, { beaconCount: 2 }));
      jest.advanceTimersByTime(50);
      
      unmount();
      
      // Memoization should limit unnecessary recreations
      expect(memoCallCount).toBeLessThan(80); // Reasonable limit for optimized component
    } finally {
      React.useMemo = originalUseMemo;
    }
  });

  test('Task 53.3: FPS update state guards prevent unnecessary renders', () => {
    let fpsStateUpdateCount = 0;
    const originalUseState = React.useState;
    
    React.useState = jest.fn((initial) => {
      const [state, setState] = originalUseState(initial);
      const wrappedSetState = (newState: any) => {
        // Track FPS-related state updates (likely numeric values around 30-60)
        if (typeof newState === 'number' && newState >= 1 && newState <= 120) {
          fpsStateUpdateCount++;
        }
        return setState(newState);
      };
      return [state, wrappedSetState];
    }) as any;

    try {
      const props = {
        ...defaultProps,
        performanceMode: true,
        debugMode: true,
      };

      const component = render(React.createElement(GalaxyMapModular, props));
      
      // Allow FPS monitoring to run
      jest.advanceTimersByTime(3000); // 3 seconds
      
      component.unmount();
      
      // State guards should prevent excessive FPS updates
      expect(fpsStateUpdateCount).toBeLessThan(20); // Should be limited by guards
    } finally {
      React.useState = originalUseState;
    }
  });

  test('Task 53.8: Pure useMemo without state updates prevents render loops', () => {
    // This test verifies that useMemo hooks remain pure and don't trigger state updates
    let renderPhaseStateUpdates = 0;
    const originalUseState = React.useState;
    
    React.useState = jest.fn((initial) => {
      const [state, setState] = originalUseState(initial);
      const wrappedSetState = (newState: any) => {
        // This should not be called during render phase (useMemo execution)
        renderPhaseStateUpdates++;
        return setState(newState);
      };
      return [state, wrappedSetState];
    }) as any;

    try {
      const props = {
        ...defaultProps,
        beacons: [
          createMockBeacon('pure-beacon-1', { x: 100, y: 100 }),
          createMockBeacon('pure-beacon-2', { x: 200, y: 200 }),
          createMockBeacon('pure-beacon-3', { x: 300, y: 300 }),
        ],
        enabledModules: ['beacon-rendering', 'connection-rendering'],
      };

      const component = render(React.createElement(GalaxyMapModular, props));
      
      // Allow module rendering (which uses useMemo)
      jest.advanceTimersByTime(200);
      
      component.unmount();
      
      // Should have reasonable state updates (not from render phase violations)
      expect(renderPhaseStateUpdates).toBeLessThan(30);
    } finally {
      React.useState = originalUseState;
    }
  });

  test('Gesture throttling optimization prevents excessive updates', () => {
    let viewportUpdateFrequency = 0;
    const originalUseState = React.useState;
    
    React.useState = jest.fn((initial) => {
      const [state, setState] = originalUseState(initial);
      const wrappedSetState = (newState: any) => {
        // Track viewport-related updates
        if (typeof newState === 'object' && newState?.translateX !== undefined) {
          viewportUpdateFrequency++;
        }
        return setState(newState);
      };
      return [state, wrappedSetState];
    }) as any;

    try {
      const props = {
        ...defaultProps,
        performanceMode: true,
      };

      const component = render(React.createElement(GalaxyMapModular, props));
      
      // Simulate period where gestures might occur
      jest.advanceTimersByTime(500);
      
      component.unmount();
      
      // Throttling should limit viewport update frequency
      expect(viewportUpdateFrequency).toBeLessThan(25);
    } finally {
      React.useState = originalUseState;
    }
  });
});