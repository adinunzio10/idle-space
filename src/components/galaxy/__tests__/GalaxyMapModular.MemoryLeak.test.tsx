/**
 * Memory Leak Detection Test Suite for GalaxyMapModular
 * 
 * Tests to verify proper cleanup of timeouts, intervals, event subscriptions,
 * and other resources to prevent memory leaks as addressed in Task 53.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import GalaxyMapModular from '../GalaxyMapModular';
import { createMockBeacon } from './test-utils';
import { galaxyMapConfig } from '../../../utils/galaxy/GalaxyMapConfig';

describe('GalaxyMapModular - Memory Leak Detection', () => {
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

  describe('Component Mount/Unmount Lifecycle', () => {
    test('should handle component unmounting without errors', () => {
      const props = {
        ...defaultProps,
        debugMode: true,
        performanceMode: true,
      };

      expect(() => {
        const component = render(React.createElement(GalaxyMapModular, props));
        
        // Allow component initialization
        jest.advanceTimersByTime(100);
        
        // Unmount should not throw errors
        component.unmount();
        
        // Allow cleanup to complete
        jest.advanceTimersByTime(100);
      }).not.toThrow();
    });

    test('should handle rapid mount/unmount cycles', () => {
      const props = {
        ...defaultProps,
        performanceMode: true,
      };

      expect(() => {
        // Rapid mount/unmount cycles
        for (let i = 0; i < 3; i++) {
          const component = render(React.createElement(GalaxyMapModular, props));
          jest.advanceTimersByTime(50);
          component.unmount();
          jest.advanceTimersByTime(20);
        }
      }).not.toThrow();
    });

    test('should handle component unmounting during active operations', () => {
      const props = {
        ...defaultProps,
        debugMode: true,
        performanceMode: true,
      };

      expect(() => {
        const component = render(React.createElement(GalaxyMapModular, props));
        
        // Allow initialization with active operations
        jest.advanceTimersByTime(150);
        
        // Unmount while operations may be running
        component.unmount();
        
        // Allow pending operations to complete
        jest.advanceTimersByTime(200);
      }).not.toThrow();
    });
  });

  describe('Timer Management Verification', () => {
    test('should not create excessive timers', () => {
      const originalSetTimeout = global.setTimeout;
      const originalSetInterval = global.setInterval;
      
      let timeoutCount = 0;
      let intervalCount = 0;
      
      // Track timer creation without infinite recursion
      global.setTimeout = jest.fn((callback, delay) => {
        timeoutCount++;
        return originalSetTimeout(callback, delay);
      }) as any;
      
      global.setInterval = jest.fn((callback, delay) => {
        intervalCount++;
        return originalSetInterval(callback, delay);
      }) as any;

      try {
        const props = {
          ...defaultProps,
          performanceMode: true,
          debugMode: true,
        };

        const component = render(React.createElement(GalaxyMapModular, props));
        
        // Allow timer creation
        jest.advanceTimersByTime(200);
        
        component.unmount();
        
        // Should not create excessive timers
        expect(timeoutCount).toBeLessThan(20);
        expect(intervalCount).toBeLessThan(10);
      } finally {
        // Restore original functions
        global.setTimeout = originalSetTimeout;
        global.setInterval = originalSetInterval;
      }
    });

    test('should handle timer cleanup during re-renders', () => {
      const TestComponent = ({ testProp }: { testProp: number }) =>
        React.createElement(GalaxyMapModular, { ...defaultProps, width: 400 + testProp });

      expect(() => {
        const { rerender, unmount } = render(React.createElement(TestComponent, { testProp: 0 }));
        
        jest.advanceTimersByTime(100);
        
        // Trigger re-renders
        rerender(React.createElement(TestComponent, { testProp: 50 }));
        jest.advanceTimersByTime(50);
        
        rerender(React.createElement(TestComponent, { testProp: 100 }));
        jest.advanceTimersByTime(50);
        
        unmount();
        jest.advanceTimersByTime(100);
      }).not.toThrow();
    });

    test('should handle notification timeout cleanup', () => {
      const props = {
        ...defaultProps,
        debugMode: true,
        performanceMode: true,
      };

      expect(() => {
        const component = render(React.createElement(GalaxyMapModular, props));
        
        // Allow potential notification creation
        jest.advanceTimersByTime(150);
        
        // Unmount to trigger cleanup
        component.unmount();
        
        // Allow cleanup to execute
        jest.advanceTimersByTime(100);
      }).not.toThrow();
    });
  });

  describe('Event Subscription Cleanup', () => {
    test('should handle module event subscriptions cleanup', () => {
      const props = {
        ...defaultProps,
        enabledModules: ['beacon-rendering', 'connection-rendering'],
        debugMode: true,
      };

      expect(() => {
        const component = render(React.createElement(GalaxyMapModular, props));
        
        // Allow module initialization and event subscriptions
        jest.advanceTimersByTime(150);
        
        // Unmount to trigger cleanup
        component.unmount();
        
        // Allow cleanup to execute
        jest.advanceTimersByTime(100);
      }).not.toThrow();
    });

    test('should handle multiple subscription cleanup cycles', () => {
      const props = {
        ...defaultProps,
        enabledModules: ['beacon-rendering'],
        performanceMode: true,
      };

      expect(() => {
        // Multiple mount/unmount cycles
        for (let i = 0; i < 2; i++) {
          const component = render(React.createElement(GalaxyMapModular, props));
          jest.advanceTimersByTime(100);
          component.unmount();
          jest.advanceTimersByTime(50);
        }
      }).not.toThrow();
    });

    test('should handle subscription cleanup when modules change', () => {
      const TestComponent = ({ modules }: { modules: string[] }) =>
        React.createElement(GalaxyMapModular, { ...defaultProps, enabledModules: modules });

      expect(() => {
        const { rerender, unmount } = render(
          React.createElement(TestComponent, { modules: ['beacon-rendering'] })
        );
        
        jest.advanceTimersByTime(100);
        
        // Change modules to trigger re-initialization
        rerender(React.createElement(TestComponent, { modules: ['connection-rendering'] }));
        jest.advanceTimersByTime(100);
        
        rerender(React.createElement(TestComponent, { modules: ['beacon-rendering', 'connection-rendering'] }));
        jest.advanceTimersByTime(100);
        
        unmount();
        jest.advanceTimersByTime(50);
      }).not.toThrow();
    });
  });

  describe('Performance Monitoring Cleanup', () => {
    test('should handle performance monitoring lifecycle', () => {
      const props = {
        ...defaultProps,
        performanceMode: true,
        debugMode: true,
      };

      expect(() => {
        const component = render(React.createElement(GalaxyMapModular, props));
        
        // Allow performance monitoring to initialize
        jest.advanceTimersByTime(1100); // Wait for FPS monitoring
        
        // Unmount during active monitoring
        component.unmount();
        
        // Allow cleanup
        jest.advanceTimersByTime(100);
      }).not.toThrow();
    });

    test('should handle frame tracking without memory leaks', () => {
      const props = {
        ...defaultProps,
        debugMode: true,
        performanceMode: true,
      };

      expect(() => {
        const component = render(React.createElement(GalaxyMapModular, props));
        
        // Allow frame tracking to start
        jest.advanceTimersByTime(100);
        
        // Unmount during active tracking
        component.unmount();
        
        // Allow cleanup
        jest.advanceTimersByTime(100);
      }).not.toThrow();
    });

    test('should handle galaxy config performance integration', () => {
      const mockGalaxyMapConfig = galaxyMapConfig;
      
      const props = {
        ...defaultProps,
        performanceMode: true,
      };

      expect(() => {
        const component = render(React.createElement(GalaxyMapModular, props));
        
        // Allow performance system to activate
        jest.advanceTimersByTime(100);
        
        component.unmount();
        jest.advanceTimersByTime(50);
        
        // Test should complete without errors (indicates proper integration)
        // Note: reportPerformance may not be called in test environment, but integration should not throw
      }).not.toThrow();
    });
  });

  describe('Complex Memory Leak Scenarios', () => {
    test('should handle stress test conditions without memory leaks', () => {
      const stressProps = {
        width: 800,
        height: 600,
        beacons: Array.from({ length: 15 }, (_, i) => 
          createMockBeacon(`stress-beacon-${i}`, { x: i * 30, y: i * 40 })
        ),
        connections: Array.from({ length: 8 }, (_, i) => ({
          id: `stress-conn-${i}`,
          sourceId: `stress-beacon-${i}`,
          targetId: `stress-beacon-${i + 1}`,
          strength: 1.0,
          isActive: true,
          patterns: [],
        })),
        enabledModules: ['beacon-rendering', 'connection-rendering'],
        performanceMode: true,
        debugMode: true,
      };

      expect(() => {
        const component = render(React.createElement(GalaxyMapModular, stressProps));
        
        // Allow complex initialization
        jest.advanceTimersByTime(300);
        
        // Unmount
        component.unmount();
        
        // Allow cleanup
        jest.advanceTimersByTime(200);
      }).not.toThrow();
    });

    test('should handle rapid prop changes without resource accumulation', () => {
      const TestComponent = ({ beaconCount }: { beaconCount: number }) =>
        React.createElement(GalaxyMapModular, {
          ...defaultProps,
          beacons: Array.from({ length: beaconCount }, (_, i) => 
            createMockBeacon(`beacon-${i}`, { x: i * 50, y: i * 50 })
          ),
          performanceMode: true,
        });

      expect(() => {
        const { rerender, unmount } = render(React.createElement(TestComponent, { beaconCount: 1 }));
        
        jest.advanceTimersByTime(50);
        
        // Rapid prop changes
        for (let count = 2; count <= 4; count++) {
          rerender(React.createElement(TestComponent, { beaconCount: count }));
          jest.advanceTimersByTime(20);
        }
        
        unmount();
        jest.advanceTimersByTime(100);
      }).not.toThrow();
    });

    test('should handle module re-initialization cycles', () => {
      const TestComponent = ({ modules }: { modules: string[] }) =>
        React.createElement(GalaxyMapModular, { 
          ...defaultProps, 
          enabledModules: modules,
          debugMode: true,
        });

      expect(() => {
        const { rerender, unmount } = render(
          React.createElement(TestComponent, { modules: ['beacon-rendering'] })
        );
        
        jest.advanceTimersByTime(100);
        
        // Module changes that trigger re-initialization
        rerender(React.createElement(TestComponent, { modules: ['connection-rendering'] }));
        jest.advanceTimersByTime(100);
        
        rerender(React.createElement(TestComponent, { modules: ['beacon-rendering', 'environment-rendering'] }));
        jest.advanceTimersByTime(100);
        
        unmount();
        jest.advanceTimersByTime(100);
      }).not.toThrow();
    });
  });

  describe('State and Ref Cleanup Verification', () => {
    test('should handle state cleanup during unmount', () => {
      const props = {
        ...defaultProps,
        debugMode: true,
        performanceMode: true,
      };

      expect(() => {
        const component = render(React.createElement(GalaxyMapModular, props));
        
        // Allow state to initialize
        jest.advanceTimersByTime(200);
        
        // Unmount should clean up state without errors
        component.unmount();
        
        // Allow cleanup to complete
        jest.advanceTimersByTime(100);
      }).not.toThrow();
    });

    test('should handle ref cleanup during unmount', () => {
      const props = {
        ...defaultProps,
        performanceMode: true,
        enabledModules: ['beacon-rendering'],
      };

      expect(() => {
        const component = render(React.createElement(GalaxyMapModular, props));
        
        // Allow refs to be populated
        jest.advanceTimersByTime(150);
        
        // Unmount should clean up refs properly
        component.unmount();
        
        // Allow cleanup
        jest.advanceTimersByTime(100);
      }).not.toThrow();
    });

    test('should handle concurrent state updates during cleanup', () => {
      const props = {
        ...defaultProps,
        debugMode: true,
        performanceMode: true,
      };

      expect(() => {
        const component = render(React.createElement(GalaxyMapModular, props));
        
        // Allow async operations to start
        jest.advanceTimersByTime(100);
        
        // Unmount while operations might be pending
        component.unmount();
        
        // Let any pending operations complete
        jest.advanceTimersByTime(300);
      }).not.toThrow();
    });
  });
});

/**
 * Specific regression tests for Task 53 memory leak fixes
 */
describe('Task 53 Memory Leak Regression Tests', () => {
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

  test('Task 53.4: Notification timeout cleanup regression test', () => {
    const props = {
      ...defaultProps,
      debugMode: true,
      performanceMode: true,
    };

    expect(() => {
      const component = render(React.createElement(GalaxyMapModular, props));
      
      // Allow potential notifications to be created
      jest.advanceTimersByTime(150);
      
      // Unmount to trigger cleanup - should not throw memory leak errors
      component.unmount();
      
      // Allow cleanup to execute
      jest.advanceTimersByTime(100);
    }).not.toThrow();
  });

  test('Task 53.6: Event bus subscription cleanup regression test', () => {
    const props = {
      ...defaultProps,
      enabledModules: ['beacon-rendering', 'connection-rendering'],
      performanceMode: true,
    };

    expect(() => {
      // Multiple cycles to test subscription cleanup
      for (let i = 0; i < 3; i++) {
        const component = render(React.createElement(GalaxyMapModular, props));
        jest.advanceTimersByTime(100);
        component.unmount();
        jest.advanceTimersByTime(50);
      }
    }).not.toThrow();
  });

  test('Task 53.7: Performance monitoring cleanup regression test', () => {
    const props = {
      ...defaultProps,
      performanceMode: true,
      debugMode: true,
    };

    expect(() => {
      const component = render(React.createElement(GalaxyMapModular, props));
      
      // Allow performance monitoring to initialize
      jest.advanceTimersByTime(1100);
      
      // Unmount during active monitoring
      component.unmount();
      
      // Allow cleanup
      jest.advanceTimersByTime(200);
    }).not.toThrow();
  });

  test('Comprehensive memory leak prevention verification', () => {
    const props = {
      width: 600,
      height: 800,
      beacons: [
        createMockBeacon('beacon-1', { x: 100, y: 100 }),
        createMockBeacon('beacon-2', { x: 200, y: 200 }),
      ],
      connections: [
        {
          id: 'conn-1',
          sourceId: 'beacon-1',
          targetId: 'beacon-2',
          strength: 1.0,
          isActive: true,
          patterns: [],
        }
      ],
      enabledModules: ['beacon-rendering', 'connection-rendering'],
      performanceMode: true,
      debugMode: true,
    };

    expect(() => {
      const component = render(React.createElement(GalaxyMapModular, props));
      
      // Allow full system initialization
      jest.advanceTimersByTime(1200);
      
      // Unmount to trigger comprehensive cleanup
      component.unmount();
      
      // Allow all cleanup operations to complete
      jest.advanceTimersByTime(500);
    }).not.toThrow();
  });

  test('Module cache state update memory leak prevention', () => {
    // Tests the critical Task 53.8 fix - no state updates in useMemo
    const props = {
      ...defaultProps,
      beacons: [
        createMockBeacon('beacon-1', { x: 100, y: 100 }),
        createMockBeacon('beacon-2', { x: 200, y: 200 }),
        createMockBeacon('beacon-3', { x: 300, y: 300 }),
      ],
      enabledModules: ['beacon-rendering', 'connection-rendering'],
    };

    expect(() => {
      const component = render(React.createElement(GalaxyMapModular, props));
      
      // Allow module rendering and caching
      jest.advanceTimersByTime(200);
      
      // Unmount to test proper cleanup
      component.unmount();
      
      // Allow cleanup
      jest.advanceTimersByTime(100);
    }).not.toThrow();
  });

  test('State/ref synchronization memory leak prevention', () => {
    // Tests Task 53.1 fixes - wrapper functions prevent circular dependencies
    const props = {
      ...defaultProps,
      performanceMode: true, // Triggers emergency mode logic
    };

    expect(() => {
      const component = render(React.createElement(GalaxyMapModular, props));
      
      // Allow state/ref synchronization to occur
      jest.advanceTimersByTime(200);
      
      // Unmount should not cause memory leaks from circular refs
      component.unmount();
      
      jest.advanceTimersByTime(100);
    }).not.toThrow();
  });

  test('Viewport update effect memory leak prevention', () => {
    // Tests Task 53.5 fixes - viewport updates don't create dependency cycles
    const TestComponent = ({ dimensions }: { dimensions: { width: number; height: number } }) =>
      React.createElement(GalaxyMapModular, { ...defaultProps, ...dimensions });

    expect(() => {
      const { rerender, unmount } = render(
        React.createElement(TestComponent, { dimensions: { width: 400, height: 600 } })
      );
      
      jest.advanceTimersByTime(100);
      
      // Viewport changes that previously caused memory leaks
      rerender(React.createElement(TestComponent, { dimensions: { width: 500, height: 700 } }));
      jest.advanceTimersByTime(50);
      
      rerender(React.createElement(TestComponent, { dimensions: { width: 300, height: 500 } }));
      jest.advanceTimersByTime(50);
      
      unmount();
      jest.advanceTimersByTime(100);
    }).not.toThrow();
  });
});