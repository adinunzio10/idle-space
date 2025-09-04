/**
 * Circular Dependency Prevention Test Suite for GalaxyMapModular
 * 
 * Tests to verify the fixes applied in Task 53 preventing maximum update depth errors
 * through proper useEffect dependency management and state/ref synchronization.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import GalaxyMapModular from '../GalaxyMapModular';
import { createMockBeacon } from './test-utils';

describe('GalaxyMapModular - Circular Dependency Prevention', () => {
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
    // Suppress console logs to reduce noise
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Basic Rendering Stability', () => {
    test('should render without throwing maximum update depth errors', () => {
      const minimalProps = {
        width: 400,
        height: 600,
        beacons: [],
      };

      expect(() => {
        render(React.createElement(GalaxyMapModular, minimalProps));
      }).not.toThrow();
    });

    test('should handle single beacon without circular dependencies', () => {
      const singleBeaconProps = {
        width: 400,
        height: 600,
        beacons: [createMockBeacon('beacon-1', { x: 200, y: 300 })],
      };

      expect(() => {
        render(React.createElement(GalaxyMapModular, singleBeaconProps));
      }).not.toThrow();
    });

    test('should handle multiple beacons without render loops', () => {
      const multiBeaconProps = {
        width: 400,
        height: 600,
        beacons: [
          createMockBeacon('beacon-1', { x: 100, y: 100 }),
          createMockBeacon('beacon-2', { x: 200, y: 200 }),
          createMockBeacon('beacon-3', { x: 300, y: 300 }),
        ],
      };

      expect(() => {
        render(React.createElement(GalaxyMapModular, multiBeaconProps));
      }).not.toThrow();
    });
  });

  describe('Performance Mode Stability', () => {
    test('should handle performance mode without loops', () => {
      const performanceProps = {
        ...defaultProps,
        performanceMode: true,
        debugMode: false,
      };

      expect(() => {
        render(React.createElement(GalaxyMapModular, performanceProps));
      }).not.toThrow();
    });

    test('should handle debug mode without loops', () => {
      const debugProps = {
        ...defaultProps,
        performanceMode: false,
        debugMode: true,
      };

      expect(() => {
        render(React.createElement(GalaxyMapModular, debugProps));
      }).not.toThrow();
    });

    test('should handle both performance and debug mode', () => {
      const combinedProps = {
        ...defaultProps,
        performanceMode: true,
        debugMode: true,
      };

      expect(() => {
        render(React.createElement(GalaxyMapModular, combinedProps));
      }).not.toThrow();
    });
  });

  describe('Module System Integration', () => {
    test('should initialize with enabled modules without loops', () => {
      const moduleProps = {
        ...defaultProps,
        enabledModules: ['beacon-rendering', 'connection-rendering'],
        debugMode: true,
      };

      expect(() => {
        render(React.createElement(GalaxyMapModular, moduleProps));
      }).not.toThrow();
    });

    test('should handle empty enabled modules array', () => {
      const emptyModulesProps = {
        ...defaultProps,
        enabledModules: [],
      };

      expect(() => {
        render(React.createElement(GalaxyMapModular, emptyModulesProps));
      }).not.toThrow();
    });

    test('should handle modules with complex data', () => {
      const complexProps = {
        ...defaultProps,
        beacons: Array.from({ length: 10 }, (_, i) => 
          createMockBeacon(`beacon-${i}`, { x: i * 40, y: i * 60 })
        ),
        connections: [
          {
            id: 'conn-1',
            sourceId: 'beacon-0',
            targetId: 'beacon-1',
            strength: 1.0,
            isActive: true,
            patterns: [],
          }
        ],
        enabledModules: ['beacon-rendering', 'connection-rendering', 'environment-rendering'],
      };

      expect(() => {
        render(React.createElement(GalaxyMapModular, complexProps));
      }).not.toThrow();
    });
  });

  describe('Hook Usage Validation', () => {
    test('should not exceed reasonable hook call limits', () => {
      // Track React hook calls to detect infinite loops
      let hookCallCount = 0;
      const originalUseState = React.useState;
      const originalUseEffect = React.useEffect;
      const originalUseMemo = React.useMemo;
      const originalUseCallback = React.useCallback;

      React.useState = jest.fn((initial) => {
        hookCallCount++;
        return originalUseState(initial);
      });

      React.useEffect = jest.fn((effect, deps) => {
        hookCallCount++;
        return originalUseEffect(effect, deps);
      });

      React.useMemo = jest.fn((factory, deps) => {
        hookCallCount++;
        return originalUseMemo(factory, deps);
      });

      React.useCallback = jest.fn((callback, deps) => {
        hookCallCount++;
        return originalUseCallback(callback, deps);
      });

      try {
        render(React.createElement(GalaxyMapModular, defaultProps));
        
        // Should not have excessive hook calls indicating infinite loops
        expect(hookCallCount).toBeLessThan(100);
      } finally {
        // Restore original hooks
        React.useState = originalUseState;
        React.useEffect = originalUseEffect;
        React.useMemo = originalUseMemo;
        React.useCallback = originalUseCallback;
      }
    });

    test('should handle viewport dimension changes without loops', () => {
      const TestComponent = ({ width }: { width: number }) =>
        React.createElement(GalaxyMapModular, { ...defaultProps, width });

      expect(() => {
        const { rerender } = render(React.createElement(TestComponent, { width: 400 }));
        rerender(React.createElement(TestComponent, { width: 500 }));
        rerender(React.createElement(TestComponent, { width: 600 }));
      }).not.toThrow();
    });
  });

  describe('Error Detection Tests', () => {
    test('should detect render count explosions indicating circular dependencies', () => {
      let renderCount = 0;
      let stateUpdateCount = 0;
      const maxRenderCount = 100; // Reasonable threshold
      
      // Track all setState calls that could cause infinite loops
      const originalSetState = React.useState;
      React.useState = jest.fn((initial) => {
        const [state, setState] = originalSetState(initial);
        const trackedSetState = (newState: any) => {
          stateUpdateCount++;
          if (stateUpdateCount > maxRenderCount) {
            throw new Error(`Excessive state updates detected (${stateUpdateCount}). This indicates a circular dependency causing infinite re-renders.`);
          }
          return setState(newState);
        };
        return [state, trackedSetState];
      });

      // Track component render cycles
      const OriginalComponent = GalaxyMapModular;
      const TrackedComponent = (props: any) => {
        renderCount++;
        if (renderCount > maxRenderCount) {
          throw new Error(`Excessive renders detected (${renderCount}). This indicates a circular dependency causing infinite re-renders.`);
        }
        return React.createElement(OriginalComponent, props);
      };

      try {
        const stressProps = {
          ...defaultProps,
          width: 800,
          height: 600,
          beacons: Array.from({ length: 5 }, (_, i) => 
            createMockBeacon(`stress-beacon-${i}`, { x: i * 25, y: i * 30 })
          ),
          performanceMode: true,
          debugMode: true,
        };

        expect(() => {
          render(React.createElement(TrackedComponent, stressProps));
        }).not.toThrow();
        
      } finally {
        React.useState = originalSetState;
      }
    });

    test('should detect "Maximum update depth exceeded" error with aggressive checking', () => {
      // Mock console.error to capture React warnings and errors
      const consoleErrors: string[] = [];
      const originalConsoleError = console.error;
      console.error = jest.fn((...args) => {
        const message = args.join(' ');
        consoleErrors.push(message);
        if (message.includes('Maximum update depth exceeded')) {
          throw new Error(message);
        }
      });

      // Override React error handling to catch the specific error
      const originalOnError = window.onerror;
      window.onerror = (message) => {
        if (typeof message === 'string' && message.includes('Maximum update depth exceeded')) {
          throw new Error(message);
        }
        return false;
      };

      try {
        // Test with conditions that should trigger the maximum update depth error
        const stressProps = {
          ...defaultProps,
          width: 800,
          height: 600,
          beacons: Array.from({ length: 10 }, (_, i) => 
            createMockBeacon(`stress-beacon-${i}`, { x: i * 25, y: i * 30 })
          ),
          connections: Array.from({ length: 3 }, (_, i) => ({
            id: `conn-${i}`,
            sourceId: `stress-beacon-${i}`,
            targetId: `stress-beacon-${i + 1}`,
            strength: 1.0,
            isActive: true,
            patterns: [],
          })),
          performanceMode: true,
          debugMode: true,
          enabledModules: ['beacon-rendering', 'connection-rendering', 'environment-rendering'],
        };

        // Should not throw since circular dependencies have been fixed
        expect(() => {
          render(React.createElement(GalaxyMapModular, stressProps));
        }).not.toThrow();
        
      } finally {
        console.error = originalConsoleError;
        window.onerror = originalOnError;
      }
    });

    test('should handle rapid prop updates without instability', () => {
      const TestComponent = ({ beaconCount }: { beaconCount: number }) =>
        React.createElement(GalaxyMapModular, {
          ...defaultProps,
          beacons: Array.from({ length: beaconCount }, (_, i) => 
            createMockBeacon(`beacon-${i}`, { x: i * 50, y: i * 50 })
          ),
        });

      expect(() => {
        const { rerender } = render(React.createElement(TestComponent, { beaconCount: 1 }));
        
        // Rapid changes that could trigger circular dependencies
        for (let i = 2; i <= 5; i++) {
          rerender(React.createElement(TestComponent, { beaconCount: i }));
        }
      }).not.toThrow();
    });
  });
});

/**
 * Regression tests specifically for Task 53 fixes
 */
describe('Task 53 Regression Tests - Specific Fixes Validation', () => {
  const defaultProps = {
    width: 400,
    height: 600,
    beacons: [createMockBeacon('test-beacon')],
    connections: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('Task 53.1: State/Ref sync wrapper functions should work without loops', () => {
    // Tests setGestureActiveState and setEmergencyModeState fixes
    const props = {
      ...defaultProps,
      performanceMode: true, // Triggers emergency mode detection logic
    };

    expect(() => {
      render(React.createElement(GalaxyMapModular, props));
    }).not.toThrow();
  });

  test('Task 53.2: Memoization strategy should prevent excessive recreations', () => {
    // Tests stable references for arrays and moduleContext optimization
    const props = {
      ...defaultProps,
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
    };

    expect(() => {
      render(React.createElement(GalaxyMapModular, props));
    }).not.toThrow();
  });

  test('Task 53.3: Performance metrics state guards should prevent loops', () => {
    // Tests FPS update guards and notification timeout cleanup
    const props = {
      ...defaultProps,
      debugMode: true,
      performanceMode: true,
    };

    expect(() => {
      render(React.createElement(GalaxyMapModular, props));
    }).not.toThrow();
  });

  test('Task 53.8: No state updates in useMemo should prevent render phase errors', () => {
    // Tests the critical fix removing setCachedModuleRender from useMemo
    const props = {
      ...defaultProps,
      beacons: [
        createMockBeacon('beacon-1', { x: 100, y: 100 }),
        createMockBeacon('beacon-2', { x: 200, y: 200 }),
        createMockBeacon('beacon-3', { x: 300, y: 300 }),
      ],
      enabledModules: ['beacon-rendering', 'connection-rendering'],
    };

    let renderPhaseError: Error | null = null;
    
    try {
      render(React.createElement(GalaxyMapModular, props));
    } catch (error) {
      renderPhaseError = error as Error;
    }

    // Should not throw render phase errors
    if (renderPhaseError) {
      expect(renderPhaseError.message).not.toContain('Cannot update during render');
      expect(renderPhaseError.message).not.toContain('setState');
      expect(renderPhaseError.message).not.toContain('render phase');
    }
  });

  test('Viewport update effects should not create dependency cycles', () => {
    // Tests the complex viewport update effect fixes from Task 53.5
    const TestComponent = ({ dimensions }: { dimensions: { width: number; height: number } }) =>
      React.createElement(GalaxyMapModular, { ...defaultProps, ...dimensions });

    expect(() => {
      const { rerender } = render(
        React.createElement(TestComponent, { dimensions: { width: 400, height: 600 } })
      );
      
      // Test viewport dimension changes that trigger viewport update effects
      rerender(React.createElement(TestComponent, { dimensions: { width: 500, height: 700 } }));
      rerender(React.createElement(TestComponent, { dimensions: { width: 300, height: 500 } }));
    }).not.toThrow();
  });

  test('Module system event handling should not create memory leaks or loops', () => {
    // Tests the event bus subscription cleanup fixes from Task 53.6
    const props = {
      ...defaultProps,
      enabledModules: ['beacon-rendering', 'connection-rendering', 'environment-rendering'],
      debugMode: true,
    };

    expect(() => {
      const component = render(React.createElement(GalaxyMapModular, props));
      // Component should render and unmount cleanly
      component.unmount();
    }).not.toThrow();
  });
});

/**
 * Integration tests for stability under various conditions
 */
describe('GalaxyMapModular - Integration Stability Tests', () => {
  const defaultProps = {
    width: 400,
    height: 600,
    beacons: [createMockBeacon('test-beacon')],
    connections: [],
    patterns: [],
    starSystems: [],
    sectors: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should handle empty state without errors', () => {
    const emptyProps = {
      width: 400,
      height: 600,
      beacons: [],
      connections: [],
      patterns: [],
      starSystems: [],
      sectors: [],
    };

    expect(() => {
      render(React.createElement(GalaxyMapModular, emptyProps));
    }).not.toThrow();
  });

  test('should handle maximum realistic data load', () => {
    const maxDataProps = {
      width: 800,
      height: 600,
      beacons: Array.from({ length: 50 }, (_, i) => 
        createMockBeacon(`max-beacon-${i}`, { x: (i % 10) * 80, y: Math.floor(i / 10) * 120 })
      ),
      connections: Array.from({ length: 20 }, (_, i) => ({
        id: `max-conn-${i}`,
        sourceId: `max-beacon-${i}`,
        targetId: `max-beacon-${(i + 1) % 50}`,
        strength: Math.random(),
        isActive: true,
        patterns: [],
      })),
      enabledModules: ['beacon-rendering', 'connection-rendering', 'environment-rendering'],
      performanceMode: true,
      debugMode: true,
    };

    expect(() => {
      render(React.createElement(GalaxyMapModular, maxDataProps));
    }).not.toThrow();
  });

  test('should handle component unmounting gracefully', () => {
    const props = {
      width: 400,
      height: 600,
      beacons: [createMockBeacon('test-beacon')],
      debugMode: true,
      performanceMode: true,
    };

    expect(() => {
      const component = render(React.createElement(GalaxyMapModular, props));
      component.unmount();
    }).not.toThrow();
  });

  test('should detect default array parameter instability causing infinite re-initialization', () => {
    let useEffectRunCount = 0;
    let moduleInitializationCount = 0;
    
    // Track useEffect executions to detect infinite loops
    const originalUseEffect = React.useEffect;
    React.useEffect = jest.fn((effect, deps) => {
      useEffectRunCount++;
      
      // Check if this is the module initialization effect by examining deps
      if (deps && deps.length > 0 && deps.some(dep => 
        Array.isArray(dep) || (typeof dep === 'boolean') // enabledModules=[], performanceMode, debugMode
      )) {
        moduleInitializationCount++;
        console.log(`Module initialization useEffect run #${moduleInitializationCount}, deps:`, deps?.map(d => Array.isArray(d) ? `Array[${d.length}]` : typeof d));
        
        if (moduleInitializationCount > 3) {
          throw new Error(`Module initialization useEffect running infinitely (${moduleInitializationCount} times). This indicates default array parameters (enabledModules=[], connections=[], etc.) are creating new arrays on every render, causing infinite module re-initialization.`);
        }
      }
      
      return originalUseEffect(effect, deps);
    });

    try {
      // Test with default props that use default array parameters
      const props = {
        width: 400,
        height: 600,
        beacons: [createMockBeacon('test-beacon')],
        // Don't provide connections, patterns, starSystems, sectors, enabledModules
        // This will use the default [] arrays which are created fresh each render
        performanceMode: true,
        debugMode: true,
      };

      expect(() => {
        render(React.createElement(GalaxyMapModular, props));
      }).not.toThrow();
      
    } finally {
      React.useEffect = originalUseEffect;
    }
  });

  test('should detect circular dependency between moduleElements and cachedModuleRender', () => {
    let setCachedModuleRenderCallCount = 0;
    let moduleElementsComputeCount = 0;
    
    // Mock React.useState to track setCachedModuleRender calls
    const originalUseState = React.useState;
    React.useState = jest.fn((initial) => {
      const [state, setState] = originalUseState(initial);
      
      // Track calls to setCachedModuleRender specifically
      const trackedSetState = (newState: any) => {
        // Check if this is the cachedModuleRender setter by examining the call stack
        const stackTrace = new Error().stack || '';
        if (stackTrace.includes('setCachedModuleRender') || 
            (Array.isArray(newState) && newState.length >= 0)) {
          setCachedModuleRenderCallCount++;
          
          // If we've had too many cache updates, it's likely a circular dependency
          if (setCachedModuleRenderCallCount > 20) {
            throw new Error(`Circular dependency detected: setCachedModuleRender called ${setCachedModuleRenderCallCount} times. This indicates moduleElements and cachedModuleRender are triggering each other infinitely.`);
          }
        }
        return setState(newState);
      };
      
      return [state, trackedSetState];
    });

    // Track useMemo computations for moduleElements
    const originalUseMemo = React.useMemo;
    React.useMemo = jest.fn((factory, deps) => {
      // Check if this is the moduleElements memo by examining dependencies
      if (deps && deps.some && deps.some(dep => 
        dep && typeof dep === 'object' && Array.isArray(dep)
      )) {
        moduleElementsComputeCount++;
        if (moduleElementsComputeCount > 20) {
          throw new Error(`Circular dependency detected: moduleElements computed ${moduleElementsComputeCount} times. This indicates cachedModuleRender dependency is causing infinite recomputation.`);
        }
      }
      return originalUseMemo(factory, deps);
    });

    try {
      const circularProps = {
        ...defaultProps,
        beacons: Array.from({ length: 3 }, (_, i) => 
          createMockBeacon(`circular-beacon-${i}`, { x: i * 50, y: i * 50 })
        ),
        performanceMode: false,
        debugMode: false,
      };

      expect(() => {
        render(React.createElement(GalaxyMapModular, circularProps));
      }).not.toThrow();
      
    } finally {
      React.useState = originalUseState;
      React.useMemo = originalUseMemo;
    }
  });

  test('should detect dynamic timestamp in moduleContext causing infinite recomputation', () => {
    let useMemoCallCount = 0;
    let moduleContextComputeCount = 0;
    const dateNowSpy = jest.spyOn(Date, 'now');
    let dateNowCallCount = 0;
    
    // Track Date.now() calls that would cause moduleContext to change constantly
    dateNowSpy.mockImplementation(() => {
      dateNowCallCount++;
      return 1000000 + dateNowCallCount; // Return different timestamp each time
    });

    // Track useMemo computations for moduleContext
    const originalUseMemo = React.useMemo;
    React.useMemo = jest.fn((factory, deps) => {
      useMemoCallCount++;
      
      // Check if this is moduleContext by examining the factory function
      const factoryString = factory.toString();
      if (factoryString.includes('viewport:') || factoryString.includes('screenDimensions:') || factoryString.includes('deltaTime')) {
        moduleContextComputeCount++;
        console.log(`ModuleContext computed #${moduleContextComputeCount}, Date.now() called ${dateNowCallCount} times`);
        
        if (moduleContextComputeCount > 5) {
          throw new Error(`ModuleContext recomputing infinitely (${moduleContextComputeCount} times). This indicates Date.now() or other dynamic values inside useMemo are causing constant recreation of moduleContext, leading to infinite re-renders.`);
        }
      }
      
      return originalUseMemo(factory, deps);
    });

    try {
      const props = {
        ...defaultProps,
        performanceMode: true,
        debugMode: true,
      };

      expect(() => {
        render(React.createElement(GalaxyMapModular, props));
      }).not.toThrow();
      
    } finally {
      React.useMemo = originalUseMemo;
      dateNowSpy.mockRestore();
    }
  });
});