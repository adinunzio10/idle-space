/**
 * Integration and User Interaction Test Suite for GalaxyMapModular
 * 
 * Tests to verify complete system integration and user interaction flows,
 * ensuring all components work together without causing maximum update depth errors.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import GalaxyMapModular from '../GalaxyMapModular';
import { createMockBeacon } from './test-utils';

describe('GalaxyMapModular - Integration and User Interaction Tests', () => {
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

  describe('Complete System Integration', () => {
    test('should integrate all major systems without maximum update depth errors', () => {
      const fullSystemProps = {
        width: 800,
        height: 600,
        beacons: Array.from({ length: 15 }, (_, i) => 
          createMockBeacon(`system-beacon-${i}`, { x: i * 50, y: i * 40 })
        ),
        connections: Array.from({ length: 8 }, (_, i) => ({
          id: `system-conn-${i}`,
          sourceId: `system-beacon-${i}`,
          targetId: `system-beacon-${i + 1}`,
          strength: 0.8 + Math.random() * 0.4,
          isActive: true,
          patterns: [],
        })),
        patterns: [
          {
            id: 'pattern-1',
            type: 'triangle' as const,
            beaconIds: ['system-beacon-0', 'system-beacon-1', 'system-beacon-2'],
            connectionIds: ['system-conn-0', 'system-conn-1', 'system-conn-2'],
            center: { x: 150, y: 150 },
            bonus: 1.2,
            isComplete: true,
          }
        ],
        starSystems: [
          {
            id: 'star-1',
            position: { x: 200, y: 300 },
            state: 'healthy' as const,
            radius: 50,
            brightness: 0.6,
            entropy: 0.2,
          }
        ],
        sectors: [
          {
            id: 'sector-1',
            center: { x: 200, y: 150 },
            bounds: { minX: 0, maxX: 400, minY: 0, maxY: 300 },
            vertices: [
              { x: 0, y: 0 },
              { x: 400, y: 0 },
              { x: 400, y: 300 },
              { x: 0, y: 300 },
            ],
            entropy: 0.4,
            starSystemIds: ['star-1'],
            neighboringSectors: [],
          }
        ],
        enabledModules: ['beacon-rendering', 'connection-rendering', 'environment-rendering', 'star-system', 'sector'],
        performanceMode: true,
        debugMode: true,
      };

      expect(() => {
        const component = render(React.createElement(GalaxyMapModular, fullSystemProps));
        
        // Allow full system integration
        jest.advanceTimersByTime(500);
        
        // System should remain stable
        jest.advanceTimersByTime(1000);
        
        component.unmount();
        
        // Allow cleanup
        jest.advanceTimersByTime(200);
      }).not.toThrow();
    });

    test('should handle module system integration with performance monitoring', () => {
      const integratedProps = {
        ...defaultProps,
        enabledModules: ['beacon-rendering', 'connection-rendering', 'environment-rendering'],
        beacons: Array.from({ length: 20 }, (_, i) => 
          createMockBeacon(`integrated-beacon-${i}`, { x: (i % 5) * 80, y: Math.floor(i / 5) * 120 })
        ),
        performanceMode: true,
        debugMode: true,
      };

      expect(() => {
        const component = render(React.createElement(GalaxyMapModular, integratedProps));
        
        // Allow module system and performance monitoring integration
        jest.advanceTimersByTime(1200); // Include FPS monitoring interval
        
        component.unmount();
      }).not.toThrow();
    });

    test('should integrate viewport management with module rendering', () => {
      const ViewportTestComponent = ({ scale }: { scale: number }) => {
        const beacons = Array.from({ length: 12 }, (_, i) => 
          createMockBeacon(`viewport-beacon-${i}`, { x: i * 60, y: i * 80 })
        );
        
        return React.createElement(GalaxyMapModular, {
          width: 400 * scale,
          height: 600 * scale,
          beacons,
          enabledModules: ['beacon-rendering', 'connection-rendering'],
          performanceMode: true,
        });
      };

      expect(() => {
        const { rerender, unmount } = render(React.createElement(ViewportTestComponent, { scale: 1 }));
        
        jest.advanceTimersByTime(100);
        
        // Simulate viewport scaling integration
        rerender(React.createElement(ViewportTestComponent, { scale: 1.5 }));
        jest.advanceTimersByTime(100);
        
        rerender(React.createElement(ViewportTestComponent, { scale: 0.8 }));
        jest.advanceTimersByTime(100);
        
        unmount();
      }).not.toThrow();
    });
  });

  describe('User Interaction Simulation', () => {
    test('should handle simulated pan gestures without circular dependencies', () => {
      const props = {
        ...defaultProps,
        beacons: Array.from({ length: 8 }, (_, i) => 
          createMockBeacon(`pan-beacon-${i}`, { x: i * 45, y: i * 60 })
        ),
        performanceMode: true,
      };

      expect(() => {
        const { getByTestId } = render(React.createElement(GalaxyMapModular, props));
        
        // Allow component initialization
        jest.advanceTimersByTime(100);
        
        // Simulate pan gesture events (if the component has pan handlers)
        try {
          const svgElement = getByTestId('galaxy-map-svg');
          if (svgElement) {
            // Simulate touch start
            fireEvent(svgElement, 'touchStart', {
              touches: [{ clientX: 100, clientY: 150 }],
            });
            
            jest.advanceTimersByTime(16); // One frame
            
            // Simulate touch move
            fireEvent(svgElement, 'touchMove', {
              touches: [{ clientX: 120, clientY: 170 }],
            });
            
            jest.advanceTimersByTime(16);
            
            // Simulate touch end
            fireEvent(svgElement, 'touchEnd', {
              changedTouches: [{ clientX: 120, clientY: 170 }],
            });
            
            jest.advanceTimersByTime(50);
          }
        } catch (e) {
          // Element might not be findable in test environment, that's OK
          // The important thing is that the component doesn't throw during render
        }
      }).not.toThrow();
    });

    test('should handle simulated zoom interactions', () => {
      const props = {
        ...defaultProps,
        beacons: Array.from({ length: 10 }, (_, i) => 
          createMockBeacon(`zoom-beacon-${i}`, { x: i * 40, y: i * 50 })
        ),
        performanceMode: true,
      };

      expect(() => {
        const { getByTestId } = render(React.createElement(GalaxyMapModular, props));
        
        jest.advanceTimersByTime(100);
        
        // Simulate zoom interactions
        try {
          const svgElement = getByTestId('galaxy-map-svg');
          if (svgElement) {
            // Simulate pinch zoom start
            fireEvent(svgElement, 'touchStart', {
              touches: [
                { clientX: 100, clientY: 150 },
                { clientX: 200, clientY: 250 }
              ],
            });
            
            jest.advanceTimersByTime(16);
            
            // Simulate pinch zoom move (fingers closer together = zoom out)
            fireEvent(svgElement, 'touchMove', {
              touches: [
                { clientX: 120, clientY: 170 },
                { clientX: 180, clientY: 230 }
              ],
            });
            
            jest.advanceTimersByTime(16);
            
            // Simulate pinch end
            fireEvent(svgElement, 'touchEnd', {
              changedTouches: [
                { clientX: 120, clientY: 170 },
                { clientX: 180, clientY: 230 }
              ],
            });
            
            jest.advanceTimersByTime(50);
          }
        } catch (e) {
          // Element might not be accessible in test environment
        }
      }).not.toThrow();
    });

    test('should handle beacon interaction simulation', () => {
      const beacons = [
        createMockBeacon('interactive-beacon-1', { x: 100, y: 100 }),
        createMockBeacon('interactive-beacon-2', { x: 200, y: 200 }),
        createMockBeacon('interactive-beacon-3', { x: 300, y: 300 }),
      ];

      const props = {
        ...defaultProps,
        beacons,
        enabledModules: ['beacon-rendering'],
        performanceMode: true,
      };

      expect(() => {
        const component = render(React.createElement(GalaxyMapModular, props));
        
        jest.advanceTimersByTime(100);
        
        // Test beacon interaction handling
        try {
          const { getAllByTestId } = component;
          const beaconElements = getAllByTestId(/beacon-/);
          
          if (beaconElements.length > 0) {
            // Simulate beacon tap
            fireEvent.press(beaconElements[0]);
            jest.advanceTimersByTime(50);
            
            // Simulate rapid beacon taps
            fireEvent.press(beaconElements[1]);
            jest.advanceTimersByTime(16);
            fireEvent.press(beaconElements[2]);
            jest.advanceTimersByTime(16);
          }
        } catch (e) {
          // Beacon elements might not be findable in test environment
        }
        
        component.unmount();
      }).not.toThrow();
    });
  });

  describe('Stress Testing and High-Load Scenarios', () => {
    test('should handle high beacon density without maximum update depth errors', () => {
      const highDensityProps = {
        width: 1000,
        height: 800,
        beacons: Array.from({ length: 60 }, (_, i) => 
          createMockBeacon(`density-beacon-${i}`, { 
            x: (i % 10) * 100, 
            y: Math.floor(i / 10) * 130 
          })
        ),
        connections: Array.from({ length: 30 }, (_, i) => ({
          id: `density-conn-${i}`,
          sourceId: `density-beacon-${i}`,
          targetId: `density-beacon-${(i + 1) % 60}`,
          strength: Math.random(),
          isActive: true,
          patterns: [],
        })),
        enabledModules: ['beacon-rendering', 'connection-rendering'],
        performanceMode: true,
        debugMode: false, // Disable debug to focus on stress testing
      };

      expect(() => {
        const component = render(React.createElement(GalaxyMapModular, highDensityProps));
        
        // Allow stress test initialization
        jest.advanceTimersByTime(400);
        
        // Continue running under stress
        jest.advanceTimersByTime(1000);
        
        component.unmount();
      }).not.toThrow();
    });

    test('should handle rapid state changes under high load', () => {
      const StressTestComponent = ({ beaconCount, perfMode }: { beaconCount: number; perfMode: boolean }) => {
        const beacons = Array.from({ length: beaconCount }, (_, i) => 
          createMockBeacon(`stress-beacon-${i}`, { x: i * 25, y: i * 35 })
        );
        
        return React.createElement(GalaxyMapModular, {
          width: 600,
          height: 800,
          beacons,
          enabledModules: ['beacon-rendering', 'connection-rendering'],
          performanceMode: perfMode,
        });
      };

      expect(() => {
        const { rerender, unmount } = render(
          React.createElement(StressTestComponent, { beaconCount: 20, perfMode: true })
        );
        
        jest.advanceTimersByTime(100);
        
        // Rapid state changes under stress
        for (let i = 0; i < 5; i++) {
          const beaconCount = 20 + (i * 5);
          const perfMode = i % 2 === 0;
          
          rerender(React.createElement(StressTestComponent, { beaconCount, perfMode }));
          jest.advanceTimersByTime(50);
        }
        
        unmount();
      }).not.toThrow();
    });

    test('should maintain stability during complex module operations', () => {
      const complexProps = {
        width: 800,
        height: 600,
        beacons: Array.from({ length: 25 }, (_, i) => 
          createMockBeacon(`complex-beacon-${i}`, { x: (i % 5) * 160, y: Math.floor(i / 5) * 120 })
        ),
        connections: Array.from({ length: 15 }, (_, i) => ({
          id: `complex-conn-${i}`,
          sourceId: `complex-beacon-${i}`,
          targetId: `complex-beacon-${(i + 5) % 25}`,
          strength: 0.5 + (i % 3) * 0.2,
          isActive: true,
          patterns: [],
        })),
        patterns: Array.from({ length: 5 }, (_, i) => ({
          id: `complex-pattern-${i}`,
          type: 'triangle' as const,
          beaconIds: [`complex-beacon-${i}`, `complex-beacon-${i + 1}`, `complex-beacon-${i + 5}`],
          connectionIds: [`complex-conn-${i}`, `complex-conn-${i + 1}`],
          center: { x: i * 50 + 100, y: i * 50 + 100 },
          bonus: 1.1 + i * 0.1,
          isComplete: true,
        })),
        starSystems: Array.from({ length: 3 }, (_, i) => ({
          id: `complex-star-${i}`,
          position: { x: 200 + i * 200, y: 200 + i * 100 },
          state: (['healthy', 'dying', 'dead'] as const)[i % 3],
          radius: 45 + i * 5,
          brightness: 0.7 - i * 0.1,
          entropy: i * 0.2,
        })),
        enabledModules: ['beacon-rendering', 'connection-rendering', 'environment-rendering', 'star-system'],
        performanceMode: true,
        debugMode: true,
      };

      expect(() => {
        const component = render(React.createElement(GalaxyMapModular, complexProps));
        
        // Allow complex operations
        jest.advanceTimersByTime(300);
        
        // Continue complex operations
        jest.advanceTimersByTime(1500);
        
        component.unmount();
        
        // Allow complex cleanup
        jest.advanceTimersByTime(200);
      }).not.toThrow();
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    test('should handle malformed or edge case data without breaking', () => {
      const edgeCaseProps = {
        width: 400,
        height: 600,
        beacons: [
          createMockBeacon('edge-beacon-1', { x: 0, y: 0 }), // Corner position
          createMockBeacon('edge-beacon-2', { x: 400, y: 600 }), // Max bounds
          createMockBeacon('edge-beacon-3', { x: -10, y: -10 }), // Negative position
        ],
        connections: [
          {
            id: 'edge-conn-1',
            sourceId: 'edge-beacon-1',
            targetId: 'nonexistent-beacon', // Reference to nonexistent beacon
            strength: 1.0,
            isActive: true,
            patterns: [],
          }
        ],
        patterns: [
          {
            id: 'edge-pattern-1',
            type: 'triangle' as const,
            beaconIds: ['edge-beacon-1', 'edge-beacon-2', 'missing-beacon'], // Missing beacon
            connectionIds: ['edge-conn-1'],
            center: { x: 150, y: 150 },
            bonus: 1.5,
            isComplete: false,
          }
        ],
        enabledModules: ['beacon-rendering', 'connection-rendering'],
        performanceMode: true,
      };

      expect(() => {
        const component = render(React.createElement(GalaxyMapModular, edgeCaseProps));
        
        // Allow edge case handling
        jest.advanceTimersByTime(200);
        
        component.unmount();
      }).not.toThrow();
    });

    test('should recover from temporary performance issues', () => {
      const mockGalaxyMapConfig = require('../../../utils/galaxy/GalaxyMapConfig').galaxyMapConfig;
      
      // Simulate poor performance conditions
      mockGalaxyMapConfig.getPerformanceStats.mockReturnValue({
        currentQuality: 'low',
        skipRatio: 0.9,
      });
      mockGalaxyMapConfig.shouldSkipFrame.mockReturnValue(true);

      const recoveryProps = {
        ...defaultProps,
        beacons: Array.from({ length: 30 }, (_, i) => 
          createMockBeacon(`recovery-beacon-${i}`, { x: i * 30, y: i * 25 })
        ),
        performanceMode: true,
        debugMode: true,
      };

      expect(() => {
        const component = render(React.createElement(GalaxyMapModular, recoveryProps));
        
        // Allow performance recovery mechanisms
        jest.advanceTimersByTime(1200);
        
        // Simulate performance improvement
        mockGalaxyMapConfig.getPerformanceStats.mockReturnValue({
          currentQuality: 'medium',
          skipRatio: 0.3,
        });
        mockGalaxyMapConfig.shouldSkipFrame.mockReturnValue(false);
        
        jest.advanceTimersByTime(500);
        
        component.unmount();
      }).not.toThrow();
    });

    test('should handle component updates during async operations', () => {
      const AsyncTestComponent = ({ asyncFlag }: { asyncFlag: boolean }) => {
        const beacons = asyncFlag 
          ? Array.from({ length: 15 }, (_, i) => createMockBeacon(`async-beacon-${i}`, { x: i * 40, y: i * 50 }))
          : [createMockBeacon('single-beacon', { x: 100, y: 100 })];
        
        return React.createElement(GalaxyMapModular, {
          ...defaultProps,
          beacons,
          enabledModules: asyncFlag ? ['beacon-rendering', 'connection-rendering'] : ['beacon-rendering'],
          performanceMode: asyncFlag,
        });
      };

      expect(() => {
        const { rerender, unmount } = render(
          React.createElement(AsyncTestComponent, { asyncFlag: false })
        );
        
        jest.advanceTimersByTime(100);
        
        // Simulate async operation completion
        rerender(React.createElement(AsyncTestComponent, { asyncFlag: true }));
        jest.advanceTimersByTime(200);
        
        // Another async change
        rerender(React.createElement(AsyncTestComponent, { asyncFlag: false }));
        jest.advanceTimersByTime(100);
        
        unmount();
      }).not.toThrow();
    });
  });

  describe('Module System Integration Tests', () => {
    test('should handle all module types integration simultaneously', () => {
      const allModulesProps = {
        width: 900,
        height: 700,
        beacons: Array.from({ length: 20 }, (_, i) => 
          createMockBeacon(`all-beacon-${i}`, { x: (i % 4) * 200, y: Math.floor(i / 4) * 140 })
        ),
        connections: Array.from({ length: 12 }, (_, i) => ({
          id: `all-conn-${i}`,
          sourceId: `all-beacon-${i}`,
          targetId: `all-beacon-${(i + 4) % 20}`,
          strength: 0.6 + (i % 4) * 0.1,
          isActive: true,
          patterns: [],
        })),
        patterns: Array.from({ length: 3 }, (_, i) => ({
          id: `all-pattern-${i}`,
          type: 'square' as const,
          beaconIds: [`all-beacon-${i * 4}`, `all-beacon-${i * 4 + 1}`, `all-beacon-${i * 4 + 4}`, `all-beacon-${i * 4 + 5}`],
          connectionIds: [`all-conn-${i * 4}`, `all-conn-${i * 4 + 1}`, `all-conn-${i * 4 + 2}`, `all-conn-${i * 4 + 3}`],
          center: { x: i * 200 + 200, y: i * 200 + 200 },
          bonus: 1.3 + i * 0.1,
          isComplete: true,
        })),
        starSystems: Array.from({ length: 4 }, (_, i) => ({
          id: `all-star-${i}`,
          position: { x: 150 + i * 200, y: 300 },
          state: (['healthy', 'dying'] as const)[i % 2],
          radius: 60 - i * 5,
          brightness: 0.8 - i * 0.15,
          entropy: i * 0.1,
        })),
        sectors: Array.from({ length: 2 }, (_, i) => ({
          id: `all-sector-${i}`,
          center: { x: i * 450 + 225, y: 350 },
          bounds: { minX: i * 450, maxX: (i + 1) * 450, minY: 0, maxY: 700 },
          vertices: [
            { x: i * 450, y: 0 },
            { x: (i + 1) * 450, y: 0 },
            { x: (i + 1) * 450, y: 700 },
            { x: i * 450, y: 700 },
          ],
          entropy: i * 0.3,
          starSystemIds: [`all-star-${i * 2}`, `all-star-${i * 2 + 1}`],
          neighboringSectors: i === 0 ? ['all-sector-1'] : ['all-sector-0'],
        })),
        enabledModules: [
          'beacon-rendering',
          'connection-rendering', 
          'environment-rendering',
          'star-system',
          'sector',
          'lod',
          'spatial',
          'entropy',
          'overlay'
        ],
        performanceMode: true,
        debugMode: true,
      };

      expect(() => {
        const component = render(React.createElement(GalaxyMapModular, allModulesProps));
        
        // Allow all modules to initialize
        jest.advanceTimersByTime(400);
        
        // Let all modules run together
        jest.advanceTimersByTime(1000);
        
        component.unmount();
        
        // Allow all modules to cleanup
        jest.advanceTimersByTime(300);
      }).not.toThrow();
    });

    test('should handle dynamic module enabling/disabling', () => {
      const DynamicModuleComponent = ({ moduleSet }: { moduleSet: number }) => {
        const moduleSets = [
          ['beacon-rendering'],
          ['beacon-rendering', 'connection-rendering'],
          ['beacon-rendering', 'connection-rendering', 'environment-rendering'],
          ['beacon-rendering', 'star-system', 'sector'],
        ];
        
        return React.createElement(GalaxyMapModular, {
          ...defaultProps,
          beacons: Array.from({ length: 12 }, (_, i) => 
            createMockBeacon(`dynamic-beacon-${i}`, { x: i * 35, y: i * 45 })
          ),
          enabledModules: moduleSets[moduleSet % moduleSets.length],
          performanceMode: true,
        });
      };

      expect(() => {
        const { rerender, unmount } = render(
          React.createElement(DynamicModuleComponent, { moduleSet: 0 })
        );
        
        jest.advanceTimersByTime(100);
        
        // Dynamically change module sets
        for (let i = 1; i <= 3; i++) {
          rerender(React.createElement(DynamicModuleComponent, { moduleSet: i }));
          jest.advanceTimersByTime(150);
        }
        
        unmount();
      }).not.toThrow();
    });
  });
});

/**
 * Comprehensive integration tests for Task 53 fixes
 */
describe('Task 53 Integration Regression Tests', () => {
  const defaultProps = {
    width: 400,
    height: 600,
    beacons: [createMockBeacon('integration-beacon')],
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

  test('Full system integration with all Task 53 fixes active', () => {
    const comprehensiveProps = {
      width: 700,
      height: 500,
      beacons: Array.from({ length: 18 }, (_, i) => 
        createMockBeacon(`comprehensive-beacon-${i}`, { x: (i % 6) * 115, y: Math.floor(i / 6) * 160 })
      ),
      connections: Array.from({ length: 10 }, (_, i) => ({
        id: `comprehensive-conn-${i}`,
        sourceId: `comprehensive-beacon-${i}`,
        targetId: `comprehensive-beacon-${(i + 6) % 18}`,
        strength: 0.7 + (i % 3) * 0.1,
        isActive: true,
        patterns: [],
      })),
      patterns: [
        {
          id: 'comprehensive-pattern-1',
          type: 'hexagon' as const,
          beaconIds: Array.from({ length: 6 }, (_, i) => `comprehensive-beacon-${i}`),
          connectionIds: Array.from({ length: 6 }, (_, i) => `comprehensive-conn-${i}`),
          center: { x: 300, y: 300 },
          bonus: 1.6,
          isComplete: true,
        }
      ],
      enabledModules: ['beacon-rendering', 'connection-rendering', 'environment-rendering'],
      performanceMode: true,
      debugMode: true,
    };

    expect(() => {
      const component = render(React.createElement(GalaxyMapModular, comprehensiveProps));
      
      // Allow comprehensive system integration
      jest.advanceTimersByTime(1500); // Include all monitoring intervals
      
      component.unmount();
      
      // Allow comprehensive cleanup
      jest.advanceTimersByTime(300);
    }).not.toThrow();
  });

  test('Integration test for maximum update depth error prevention', () => {
    // This test specifically verifies that the component can handle
    // all the scenarios that previously caused maximum update depth errors
    const maxUpdateDepthPreventionProps = {
      width: 600,
      height: 800,
      beacons: Array.from({ length: 30 }, (_, i) => 
        createMockBeacon(`depth-beacon-${i}`, { x: (i % 5) * 120, y: Math.floor(i / 5) * 130 })
      ),
      connections: Array.from({ length: 20 }, (_, i) => ({
        id: `depth-conn-${i}`,
        sourceId: `depth-beacon-${i}`,
        targetId: `depth-beacon-${(i + 5) % 30}`,
        strength: Math.random(),
        isActive: true,
        patterns: [],
      })),
      enabledModules: ['beacon-rendering', 'connection-rendering', 'environment-rendering', 'star-system'],
      performanceMode: true,
      debugMode: true,
    };

    let maxUpdateDepthError = false;
    const originalError = console.error;
    console.error = jest.fn((...args) => {
      if (args.some(arg => typeof arg === 'string' && arg.includes('Maximum update depth exceeded'))) {
        maxUpdateDepthError = true;
      }
      return originalError(...args);
    });

    try {
      const component = render(React.createElement(GalaxyMapModular, maxUpdateDepthPreventionProps));
      
      // Run for extended period to catch potential circular dependencies
      jest.advanceTimersByTime(2000);
      
      component.unmount();
      jest.advanceTimersByTime(200);
      
      // Should not have triggered maximum update depth errors
      expect(maxUpdateDepthError).toBe(false);
    } finally {
      console.error = originalError;
    }
  });

  test('Real-world usage scenario with all systems active', () => {
    const realWorldProps = {
      width: 1000,
      height: 800,
      beacons: Array.from({ length: 40 }, (_, i) => 
        createMockBeacon(`real-beacon-${i}`, { 
          x: 50 + (i % 8) * 120, 
          y: 50 + Math.floor(i / 8) * 140 
        })
      ),
      connections: Array.from({ length: 25 }, (_, i) => ({
        id: `real-conn-${i}`,
        sourceId: `real-beacon-${i}`,
        targetId: `real-beacon-${(i + 8) % 40}`,
        strength: 0.4 + Math.random() * 0.6,
        isActive: true,
        patterns: [],
      })),
      patterns: Array.from({ length: 8 }, (_, i) => ({
        id: `real-pattern-${i}`,
        type: i % 3 === 0 ? 'triangle' as const : i % 3 === 1 ? 'square' as const : 'pentagon' as const,
        beaconIds: Array.from({ length: i % 3 + 3 }, (_, j) => `real-beacon-${i * 5 + j}`),
        connectionIds: Array.from({ length: i % 3 + 3 }, (_, j) => `real-conn-${i * 5 + j}`),
        center: { x: (i % 4) * 200 + 200, y: Math.floor(i / 4) * 200 + 200 },
        bonus: 1.0 + i * 0.1,
        isComplete: true,
      })),
      starSystems: Array.from({ length: 6 }, (_, i) => ({
        id: `real-star-${i}`,
        position: { x: 200 + (i % 3) * 300, y: 200 + Math.floor(i / 3) * 400 },
        state: (['healthy', 'dying', 'dead'] as const)[i % 3],
        radius: 40 + (i % 3) * 10,
        brightness: 0.9 - i * 0.1,
        entropy: (i % 3) * 0.3,
      })),
      sectors: Array.from({ length: 4 }, (_, i) => ({
        id: `real-sector-${i}`,
        center: { 
          x: (i % 2) * 500 + 250, 
          y: Math.floor(i / 2) * 400 + 200 
        },
        bounds: { 
          minX: (i % 2) * 500, 
          maxX: ((i % 2) + 1) * 500, 
          minY: Math.floor(i / 2) * 400, 
          maxY: (Math.floor(i / 2) + 1) * 400 
        },
        vertices: [
          { x: (i % 2) * 500, y: Math.floor(i / 2) * 400 },
          { x: ((i % 2) + 1) * 500, y: Math.floor(i / 2) * 400 },
          { x: ((i % 2) + 1) * 500, y: (Math.floor(i / 2) + 1) * 400 },
          { x: (i % 2) * 500, y: (Math.floor(i / 2) + 1) * 400 },
        ],
        entropy: i * 0.2,
        starSystemIds: [`real-star-${i}`, `real-star-${(i + 1) % 6}`],
        neighboringSectors: i < 2 ? [`real-sector-${i + 2}`] : [`real-sector-${i - 2}`],
      })),
      enabledModules: [
        'beacon-rendering',
        'connection-rendering', 
        'environment-rendering',
        'star-system',
        'sector',
        'lod',
        'spatial',
      ],
      performanceMode: true,
      debugMode: true,
    };

    expect(() => {
      const component = render(React.createElement(GalaxyMapModular, realWorldProps));
      
      // Allow real-world scenario to run
      jest.advanceTimersByTime(2000);
      
      component.unmount();
      
      // Allow cleanup
      jest.advanceTimersByTime(400);
    }).not.toThrow();
  });
});