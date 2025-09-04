import 'react-native-gesture-handler/jestSetup';

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');

  // The mock for `call` immediately calls the callback which is incorrect
  // So we override it with a no-op
  Reanimated.default.call = () => {};

  return Reanimated;
});

// Mock Animated API - skipped as it may not exist in all RN versions

// Mock React Navigation if needed
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
  useRoute: () => ({
    params: {},
  }),
}));

// Mock ModuleManager and related galaxy modules
jest.mock('./src/utils/galaxy/modules', () => {
  const React = require('react');
  
  // Mock EventBus
  class MockEventBus {
    constructor() {
      this.listeners = {};
    }
    
    subscribe(event, callback) {
      if (!this.listeners[event]) {
        this.listeners[event] = [];
      }
      this.listeners[event].push(callback);
      
      // Return unsubscribe function
      return () => {
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
      };
    }
    
    emit(event, payload) {
      if (this.listeners[event]) {
        this.listeners[event].forEach(callback => callback(payload));
      }
    }
  }
  
  // Mock ModuleManager
  class MockModuleManager {
    constructor(options = {}) {
      this.options = options;
      this.modules = [];
      this.eventBus = new MockEventBus();
      this.performanceMode = false;
      this.debugMode = false;
    }
    
    async registerModule(module) {
      this.modules.push(module);
      return Promise.resolve();
    }
    
    renderModules(context) {
      // Return mock React elements for testing
      return this.modules.map((module, index) => 
        React.createElement('g', { key: `mock-module-${module.id || index}`, 'data-testid': `module-${module.id || index}` })
      );
    }
    
    getEventBus() {
      return this.eventBus;
    }
    
    getAllModules() {
      return this.modules;
    }
    
    disableModule(id) {
      const module = this.modules.find(m => m.id === id);
      if (module) {
        module.enabled = false;
      }
    }
    
    enableModule(id) {
      const module = this.modules.find(m => m.id === id);
      if (module) {
        module.enabled = true;
      }
    }
    
    setGlobalPerformanceMode(enabled) {
      this.performanceMode = enabled;
    }
    
    setDebugMode(enabled) {
      this.debugMode = enabled;
    }
    
    getGlobalPerformanceMetrics() {
      return {
        averageFps: 60,
        disabledModules: [],
        performanceMode: this.performanceMode,
      };
    }
  }
  
  // Mock Module classes
  class MockModule {
    constructor(id) {
      this.id = id;
      this.enabled = true;
    }
    
    render(context) {
      return React.createElement('g', { 'data-testid': `module-${this.id}` });
    }
  }
  
  return {
    ModuleManager: MockModuleManager,
    BeaconRenderingModule: class extends MockModule { constructor() { super('beacon-rendering'); } },
    ConnectionRenderingModule: class extends MockModule { constructor() { super('connection-rendering'); } },
    EnvironmentRenderingModule: class extends MockModule { constructor() { super('environment-rendering'); } },
    StarSystemModule: class extends MockModule { constructor() { super('star-system'); } },
    SectorModule: class extends MockModule { constructor() { super('sector'); } },
    GestureModule: class extends MockModule { constructor() { super('gesture'); } },
    LODModule: class extends MockModule { constructor() { super('lod'); } },
    SpatialModule: class extends MockModule { constructor() { super('spatial'); } },
    EntropyModule: class extends MockModule { constructor() { super('entropy'); } },
    OverlayModule: class extends MockModule { constructor() { super('overlay'); } },
  };
});

// Mock galaxy map config
jest.mock('./src/utils/galaxy/GalaxyMapConfig', () => ({
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

// Mock spatial utility functions
jest.mock('./src/utils/spatial/viewport', () => ({
  screenToGalaxy: jest.fn((screenPoint, viewport) => ({
    x: screenPoint.x / viewport.scale - viewport.translateX,
    y: screenPoint.y / viewport.scale - viewport.translateY,
  })),
  calculateVisibleBounds: jest.fn((width, height, viewport) => ({
    minX: -viewport.translateX / viewport.scale,
    maxX: (-viewport.translateX + width) / viewport.scale,
    minY: -viewport.translateY / viewport.scale,
    maxY: (-viewport.translateY + height) / viewport.scale,
  })),
  clampScale: jest.fn((scale) => Math.max(0.1, Math.min(10, scale))),
  constrainTranslationElastic: jest.fn((translation) => translation),
  calculateZoomFocalPoint: jest.fn((focalPoint, currentTranslation, currentScale, newScale) => currentTranslation),
  isPointInHitArea: jest.fn((point, targetPoint, radius) => {
    const dx = point.x - targetPoint.x;
    const dy = point.y - targetPoint.y;
    return Math.sqrt(dx * dx + dy * dy) <= radius;
  }),
}));

// Silence console warnings in tests
const originalWarn = console.warn;
const originalError = console.error;

beforeEach(() => {
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterEach(() => {
  console.warn = originalWarn;
  console.error = originalError;
});

// Global test utilities
global.createMockBeacon = (id = 'test-beacon', position = { x: 100, y: 100 }) => ({
  id,
  position,
  level: 1,
  type: 'pioneer',
  connections: [],
});

global.createMockViewportState = (overrides = {}) => ({
  translateX: 0,
  translateY: 0,
  scale: 1,
  bounds: { minX: 0, maxX: 400, minY: 0, maxY: 600 },
  ...overrides,
});

global.createMockModuleContext = (overrides = {}) => ({
  viewport: createMockViewportState(),
  screenDimensions: { width: 400, height: 600 },
  beacons: [createMockBeacon()],
  connections: [],
  patterns: [],
  starSystems: [],
  sectors: [],
  deltaTime: 16.67,
  frameCount: 1,
  ...overrides,
});