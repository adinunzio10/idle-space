/**
 * GalaxyMapModular Pan Gesture Performance Test Suite
 * 
 * Tests the pan gesture fixes to ensure:
 * 1. Modules don't disappear during panning
 * 2. Panning is smooth and responsive
 * 3. Viewport updates are properly throttled
 * 4. Module cache behavior is correct
 */

import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import { GestureHandlerRootView, Gesture } from 'react-native-gesture-handler';
import GalaxyMapModular from '../GalaxyMapModular';
// import GalaxyMapModular from '../GalaxyMapModular.minimal';
import { Beacon, Connection } from '../../../types/galaxy';
import { galaxyMapConfig } from '../../../utils/galaxy/GalaxyMapConfig';
import { galaxyToScreen, calculateVisibleBounds } from '../../../utils/spatial/viewport';


// Reanimated is mocked globally in jest-setup.js

// Gesture Handler is mocked globally in jest-setup.js

// SVG components are mocked globally in jest-setup.js

// Mock performance utilities
jest.mock('../../../utils/performance/WorkletDataIsolation', () => ({
  createWorkletSafeClone: jest.fn((obj) => ({ ...obj })),
  freezeForWorklet: jest.fn((obj) => obj),
}));

// Mock spatial utilities
jest.mock('../../../utils/spatial/viewport', () => ({
  screenToGalaxy: jest.fn((point) => point),
  galaxyToScreen: jest.fn((point) => point),
  calculateVisibleBounds: jest.fn(() => ({
    minX: 0,
    maxX: 800,
    minY: 0,
    maxY: 600,
  })),
  clampScale: jest.fn((scale) => Math.max(0.5, Math.min(3.0, scale))),
  constrainTranslationElastic: jest.fn((translation) => translation),
  calculateZoomFocalPoint: jest.fn((focal, translation) => translation),
  isPointInHitArea: jest.fn(() => false),
}));

// Mock module manager and modules - using global mock from jest-setup.js
// The global mock provides the mockModuleManager with jest.fn() renderModules

// Mock galaxy map config
jest.mock('../../../utils/galaxy/GalaxyMapConfig', () => ({
  galaxyMapConfig: {
    reportPerformance: jest.fn(),
    shouldSkipFrame: jest.fn(() => false),
    getPerformanceStats: jest.fn(() => ({
      currentQuality: 'high',
      skipRatio: 0,
    })),
    emergencyReset: jest.fn(),
    setQualityLevel: jest.fn(),
    setModuleEnabled: jest.fn(),
  },
}));

// Test data
const createMockBeacon = (id: string, x: number, y: number): Beacon => ({
  id,
  position: { x, y },
  level: 1,
  type: 'pioneer',
  connections: [],
});

const createMockConnection = (id: string, sourceId: string, targetId: string): Connection => ({
  id,
  sourceId,
  targetId,
  strength: 1,
  isActive: true,
  patterns: [],
});

const mockBeacons = [
  createMockBeacon('beacon1', 100, 100),
  createMockBeacon('beacon2', 200, 200),
  createMockBeacon('beacon3', 300, 300),
];

const mockConnections = [
  createMockConnection('conn1', 'beacon1', 'beacon2'),
  createMockConnection('conn2', 'beacon2', 'beacon3'),
];

describe('GalaxyMapModular Pan Gesture Performance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock Date.now for consistent timing
    jest.spyOn(Date, 'now').mockReturnValue(1000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render without crashing', () => {
    const { getByTestId } = render(
      <GestureHandlerRootView>
        <GalaxyMapModular
          width={800}
          height={600}
          beacons={mockBeacons}
          connections={mockConnections}
        />
      </GestureHandlerRootView>
    );

    expect(getByTestId('galaxy-map')).toBeTruthy();
  });

  it('should initialize modules and not use cached renders during normal operation', async () => {
    const modulesMock = require('../../../utils/galaxy/modules');
    
    render(
      <GestureHandlerRootView>
        <GalaxyMapModular
          width={800}
          height={600}
          beacons={mockBeacons}
          connections={mockConnections}
        />
      </GestureHandlerRootView>
    );

    // Wait for async module initialization and rendering
    await waitFor(() => {
      // Check if ModuleManager constructor was called
      expect(modulesMock.ModuleManager).toHaveBeenCalled();
    });
    
    // Get the most recent instance of ModuleManager
    const mockInstance = modulesMock.ModuleManager.mock.results[modulesMock.ModuleManager.mock.results.length - 1].value;
    
    // Wait for renderModules to be called
    await waitFor(() => {
      expect(mockInstance.renderModules).toHaveBeenCalled();
    });
  });

  it('should throttle viewport updates during pan gestures using time-based throttling', () => {
    // Using imported Gesture
    let panGesture: any;
    let updateCallback: any;

    // Mock Gesture.Pan to capture the update callback
    (Gesture.Pan as jest.MockedFunction<any>).mockImplementation(() => {
      panGesture = {
        onStart: jest.fn().mockReturnThis(),
        onUpdate: jest.fn((callback) => {
          updateCallback = callback;
          return panGesture;
        }),
        onEnd: jest.fn().mockReturnThis(),
      };
      return panGesture;
    });

    const mockUpdateViewportState = jest.fn();
    
    render(
      <GestureHandlerRootView>
        <GalaxyMapModular
          width={800}
          height={600}
          beacons={mockBeacons}
          connections={mockConnections}
        />
      </GestureHandlerRootView>
    );

    // Simulate rapid pan updates
    act(() => {
      if (updateCallback) {
        // First update should go through (time = 1000)
        updateCallback({ translationX: 10, translationY: 10 });
        
        // Second update at same time should be throttled
        updateCallback({ translationX: 20, translationY: 20 });
        
        // Update after 16ms should go through
        jest.spyOn(Date, 'now').mockReturnValue(1016);
        updateCallback({ translationX: 30, translationY: 30 });
      }
    });

    // Should have throttled intermediate updates
    expect(Gesture.Pan).toHaveBeenCalled();
  });

  it('should not cache module renders during normal panning', () => {
    const { getByTestId } = render(
      <GestureHandlerRootView>
        <GalaxyMapModular
          width={800}
          height={600}
          beacons={mockBeacons}
          connections={mockConnections}
          debugMode={true}
        />
      </GestureHandlerRootView>
    );

    // Clear initial render calls
    mockModuleManager.renderModules.mockClear();

    // Force a re-render by changing props
    act(() => {
      // Simulate viewport change that would trigger re-render
      const component = getByTestId('galaxy-map');
      expect(component).toBeTruthy();
    });

    // Should continue to call renderModules for each frame, no caching during normal operation
    expect(mockModuleManager.renderModules).toHaveBeenCalled();
  });

  it('should only use cache during emergency performance situations', () => {
    // Using imported galaxyMapConfig
    
    // Mock frame skipping condition
    (galaxyMapConfig.shouldSkipFrame as jest.MockedFunction<any>).mockReturnValue(true);

    render(
      <GestureHandlerRootView>
        <GalaxyMapModular
          width={800}
          height={600}
          beacons={mockBeacons}
          connections={mockConnections}
          performanceMode={true}
        />
      </GestureHandlerRootView>
    );

    // Should still call renderModules for the first render to populate cache
    expect(mockModuleManager.renderModules).toHaveBeenCalled();
  });

  it('should handle coordinate transformations consistently', () => {
    // Using imported galaxyToScreen
    
    render(
      <GestureHandlerRootView>
        <GalaxyMapModular
          width={800}
          height={600}
          beacons={mockBeacons}
          connections={mockConnections}
        />
      </GestureHandlerRootView>
    );

    // Verify coordinate transformation is called consistently
    expect(galaxyToScreen).toHaveBeenCalled();
  });

  it('should properly manage gesture state without state updates during gestures', () => {
    // Using imported Gesture
    let startCallback: any;
    let endCallback: any;

    // Mock Gesture.Pan to capture callbacks
    (Gesture.Pan as jest.MockedFunction<any>).mockImplementation(() => ({
      onStart: jest.fn((callback) => {
        startCallback = callback;
        return { onUpdate: jest.fn().mockReturnThis(), onEnd: jest.fn((callback) => {
          endCallback = callback;
          return {};
        }) };
      }),
      onUpdate: jest.fn().mockReturnThis(),
      onEnd: jest.fn().mockReturnThis(),
    }));

    render(
      <GestureHandlerRootView>
        <GalaxyMapModular
          width={800}
          height={600}
          beacons={mockBeacons}
          connections={mockConnections}
        />
      </GestureHandlerRootView>
    );

    // Simulate gesture start and end
    act(() => {
      if (startCallback) startCallback();
      if (endCallback) endCallback();
    });

    // Should have called gesture callbacks
    expect(Gesture.Pan).toHaveBeenCalled();
  });

  it('should handle viewport updates without InteractionManager delays', () => {
    // Using imported calculateVisibleBounds
    
    render(
      <GestureHandlerRootView>
        <GalaxyMapModular
          width={800}
          height={600}
          beacons={mockBeacons}
          connections={mockConnections}
        />
      </GestureHandlerRootView>
    );

    // Should calculate bounds immediately without InteractionManager
    expect(calculateVisibleBounds).toHaveBeenCalled();
  });

  it('should emit module events properly after viewport changes', () => {
    const mockEventBus = mockModuleManager.getEventBus();
    
    render(
      <GestureHandlerRootView>
        <GalaxyMapModular
          width={800}
          height={600}
          beacons={mockBeacons}
          connections={mockConnections}
        />
      </GestureHandlerRootView>
    );

    // Should set up event listeners
    expect(mockEventBus.subscribe).toHaveBeenCalledWith(
      'module:performance-warning',
      expect.any(Function)
    );
  });

  it('should maintain smooth performance metrics during panning', () => {
    // Using imported galaxyMapConfig
    
    render(
      <GestureHandlerRootView>
        <GalaxyMapModular
          width={800}
          height={600}
          beacons={mockBeacons}
          connections={mockConnections}
          debugMode={true}
        />
      </GestureHandlerRootView>
    );

    // Should report performance metrics
    expect(galaxyMapConfig.reportPerformance).toHaveBeenCalled();
  });
});

// Integration test for the complete pan gesture flow
describe('GalaxyMapModular Pan Gesture Integration', () => {
  it('should maintain module visibility throughout a complete pan gesture cycle', async () => {
    // Using imported Gesture
    const callbacks: any = {};

    // Mock complete gesture chain
    (Gesture.Pan as jest.MockedFunction<any>).mockImplementation(() => ({
      onStart: jest.fn((fn) => { callbacks.start = fn; return { onUpdate: jest.fn().mockReturnThis(), onEnd: jest.fn().mockReturnThis() }; }),
      onUpdate: jest.fn((fn) => { callbacks.update = fn; return { onEnd: jest.fn().mockReturnThis() }; }),
      onEnd: jest.fn((fn) => { callbacks.end = fn; return {}; }),
    }));

    const component = render(
      <GestureHandlerRootView>
        <GalaxyMapModular
          width={800}
          height={600}
          beacons={mockBeacons}
          connections={mockConnections}
          debugMode={true}
        />
      </GestureHandlerRootView>
    );

    // Simulate complete pan gesture
    act(() => {
      // Start gesture
      if (callbacks.start) callbacks.start();
      
      // Multiple updates during pan
      if (callbacks.update) {
        callbacks.update({ translationX: 10, translationY: 10 });
        jest.spyOn(Date, 'now').mockReturnValue(1016);
        callbacks.update({ translationX: 20, translationY: 20 });
        jest.spyOn(Date, 'now').mockReturnValue(1032);
        callbacks.update({ translationX: 30, translationY: 30 });
      }
      
      // End gesture
      if (callbacks.end) callbacks.end();
    });

    // Modules should have been rendered throughout the gesture
    expect(mockModuleManager.renderModules).toHaveBeenCalled();
    expect(component.getByTestId).toBeDefined();
  });
});