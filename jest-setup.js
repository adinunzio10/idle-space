import 'react-native-gesture-handler/jestSetup';

// Enhanced React Native Gesture Handler Mocks
jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');

  // Gesture States
  const State = {
    UNDETERMINED: 0,
    FAILED: 1,
    BEGAN: 2,
    CANCELLED: 3,
    ACTIVE: 4,
    END: 5,
  };

  const Directions = {
    RIGHT: 1,
    LEFT: 2,
    UP: 4,
    DOWN: 8,
  };

  // Mock gesture event structure
  const createMockGestureEvent = (nativeEvent = {}) => ({
    nativeEvent: {
      handlerTag: 1,
      state: State.ACTIVE,
      x: 0,
      y: 0,
      absoluteX: 0,
      absoluteY: 0,
      translationX: 0,
      translationY: 0,
      velocityX: 0,
      velocityY: 0,
      scale: 1,
      focalX: 0,
      focalY: 0,
      numberOfPointers: 1,
      ...nativeEvent,
    },
  });

  // Base gesture handler mock
  const createGestureHandler = (name) => 
    React.forwardRef((props, ref) => {
      React.useImperativeHandle(ref, () => ({
        setNativeProps: jest.fn(),
      }));

      return React.createElement(View, {
        ...props,
        testID: `mock-${name.toLowerCase()}`,
        onLayout: props.onLayout,
        // Simulate gesture callbacks for testing
        onTouchStart: (e) => {
          if (props.onGestureEvent) {
            props.onGestureEvent(createMockGestureEvent({ 
              state: State.BEGAN,
              x: e.nativeEvent.locationX || 0,
              y: e.nativeEvent.locationY || 0,
            }));
          }
        },
        onTouchMove: (e) => {
          if (props.onGestureEvent) {
            props.onGestureEvent(createMockGestureEvent({
              state: State.ACTIVE,
              x: e.nativeEvent.locationX || 0,
              y: e.nativeEvent.locationY || 0,
              translationX: (e.nativeEvent.locationX || 0) - 100,
              translationY: (e.nativeEvent.locationY || 0) - 100,
              velocityX: 10,
              velocityY: 10,
            }));
          }
        },
        onTouchEnd: (e) => {
          if (props.onGestureEvent) {
            props.onGestureEvent(createMockGestureEvent({ state: State.END }));
          }
          if (props.onHandlerStateChange) {
            props.onHandlerStateChange(createMockGestureEvent({ state: State.END }));
          }
        },
      });
    });

  const PanGestureHandler = createGestureHandler('PanGestureHandler');
  const PinchGestureHandler = createGestureHandler('PinchGestureHandler');
  const TapGestureHandler = createGestureHandler('TapGestureHandler');
  const RotationGestureHandler = createGestureHandler('RotationGestureHandler');
  const ForceTouchGestureHandler = createGestureHandler('ForceTouchGestureHandler');
  const LongPressGestureHandler = createGestureHandler('LongPressGestureHandler');

  const GestureHandlerRootView = React.forwardRef((props, ref) =>
    React.createElement(View, { ...props, ref, testID: 'gesture-handler-root-view' })
  );

  const gestureHandlerGlobal = {
    State,
    Directions,
    createMockGestureEvent,
    // Utility functions for testing
    simulatePanGesture: (handler, sequence) => {
      sequence.forEach((step, index) => {
        const event = createMockGestureEvent({
          state: index === 0 ? State.BEGAN : index === sequence.length - 1 ? State.END : State.ACTIVE,
          ...step,
        });
        if (handler.onGestureEvent) handler.onGestureEvent(event);
        if (index === sequence.length - 1 && handler.onHandlerStateChange) {
          handler.onHandlerStateChange(event);
        }
      });
    },
    simulatePinchGesture: (handler, scale, focalPoint = { x: 0, y: 0 }) => {
      const events = [
        { state: State.BEGAN, scale: 1, ...focalPoint },
        { state: State.ACTIVE, scale, ...focalPoint },
        { state: State.END, scale, ...focalPoint },
      ];
      events.forEach(event => {
        const gestureEvent = createMockGestureEvent(event);
        if (handler.onGestureEvent) handler.onGestureEvent(gestureEvent);
        if (event.state === State.END && handler.onHandlerStateChange) {
          handler.onHandlerStateChange(gestureEvent);
        }
      });
    },
    simulateTapGesture: (handler, position = { x: 0, y: 0 }) => {
      const event = createMockGestureEvent({
        state: State.END,
        x: position.x,
        y: position.y,
        absoluteX: position.x,
        absoluteY: position.y,
      });
      if (handler.onGestureEvent) handler.onGestureEvent(event);
      if (handler.onHandlerStateChange) handler.onHandlerStateChange(event);
    },
  };

  // Add to global for test utilities
  if (typeof global !== 'undefined') {
    global.GestureTestUtils = gestureHandlerGlobal;
  }

  // Modern Gesture API mock with proper method chaining
  const createGestureBuilder = (gestureType) => {
    return jest.fn().mockImplementation(() => {
      const gestureConfig = {
        gestureType,
        enabled: true,
        shouldCancelWhenOutside: true,
        simultaneousHandlers: [],
        blockedHandlers: [],
        onStart: null,
        onUpdate: null,
        onEnd: null,
        onChange: null,
        onFinalize: null,
        onBegin: null,
        onTouchesCancelled: null,
      };

      // Create gesture object with proper method chaining
      const gestureObject = {
        // Internal properties for testing
        _config: gestureConfig,
        _gestureType: gestureType,
      };
      
      // Configuration methods that return gestureObject for chaining
      gestureObject.enabled = jest.fn().mockReturnValue(gestureObject);
      gestureObject.disabled = jest.fn().mockReturnValue(gestureObject);
      gestureObject.shouldCancelWhenOutside = jest.fn().mockReturnValue(gestureObject);
      gestureObject.simultaneousWithExternalGesture = jest.fn().mockReturnValue(gestureObject);
      gestureObject.requireExternalGestureToFail = jest.fn().mockReturnValue(gestureObject);
      gestureObject.blockedByExternalGesture = jest.fn().mockReturnValue(gestureObject);
      gestureObject.withRef = jest.fn().mockReturnValue(gestureObject);
      
      // Pan-specific configuration methods
      gestureObject.minDistance = jest.fn().mockReturnValue(gestureObject);
      gestureObject.minPointers = jest.fn().mockReturnValue(gestureObject);
      gestureObject.maxPointers = jest.fn().mockReturnValue(gestureObject);
      gestureObject.minVelocity = jest.fn().mockReturnValue(gestureObject);
      gestureObject.minVelocityX = jest.fn().mockReturnValue(gestureObject);
      gestureObject.minVelocityY = jest.fn().mockReturnValue(gestureObject);
      gestureObject.failOffsetXStart = jest.fn().mockReturnValue(gestureObject);
      gestureObject.failOffsetXEnd = jest.fn().mockReturnValue(gestureObject);
      gestureObject.failOffsetYStart = jest.fn().mockReturnValue(gestureObject);
      gestureObject.failOffsetYEnd = jest.fn().mockReturnValue(gestureObject);
      gestureObject.activeOffsetXStart = jest.fn().mockReturnValue(gestureObject);
      gestureObject.activeOffsetXEnd = jest.fn().mockReturnValue(gestureObject);
      gestureObject.activeOffsetYStart = jest.fn().mockReturnValue(gestureObject);
      gestureObject.activeOffsetYEnd = jest.fn().mockReturnValue(gestureObject);
      
      // Pinch-specific methods
      gestureObject.scale = jest.fn().mockReturnValue(gestureObject);
      
      // Tap-specific methods
      gestureObject.numberOfTaps = jest.fn().mockReturnValue(gestureObject);
      gestureObject.maxDistance = jest.fn().mockReturnValue(gestureObject);
      gestureObject.maxDuration = jest.fn().mockReturnValue(gestureObject);
      gestureObject.maxDelay = jest.fn().mockReturnValue(gestureObject);
      gestureObject.maxDeltaX = jest.fn().mockReturnValue(gestureObject);
      gestureObject.maxDeltaY = jest.fn().mockReturnValue(gestureObject);
      
      // LongPress-specific methods
      gestureObject.minDuration = jest.fn().mockReturnValue(gestureObject);
      
      // Event handlers that store callbacks and return gestureObject for chaining
      // These are the critical methods that must properly chain
      gestureObject.onStart = jest.fn().mockImplementation((callback) => {
        gestureConfig.onStart = callback;
        return gestureObject; // Return the same object for chaining
      });
      
      gestureObject.onUpdate = jest.fn().mockImplementation((callback) => {
        gestureConfig.onUpdate = callback;
        return gestureObject; // Return the same object for chaining
      });
      
      gestureObject.onEnd = jest.fn().mockImplementation((callback) => {
        gestureConfig.onEnd = callback;
        return gestureObject; // Return the same object for chaining
      });
      
      gestureObject.onChange = jest.fn().mockImplementation((callback) => {
        gestureConfig.onChange = callback;
        return gestureObject; // Return the same object for chaining
      });
      
      gestureObject.onFinalize = jest.fn().mockImplementation((callback) => {
        gestureConfig.onFinalize = callback;
        return gestureObject; // Return the same object for chaining
      });
      
      gestureObject.onBegin = jest.fn().mockImplementation((callback) => {
        gestureConfig.onBegin = callback;
        return gestureObject; // Return the same object for chaining
      });
      
      gestureObject.onTouchesCancelled = jest.fn().mockImplementation((callback) => {
        gestureConfig.onTouchesCancelled = callback;
        return gestureObject; // Return the same object for chaining
      });

      return gestureObject;
    });
  };

  const Gesture = {
    Pan: createGestureBuilder('pan'),
    Pinch: createGestureBuilder('pinch'),
    Tap: createGestureBuilder('tap'),
    LongPress: createGestureBuilder('longPress'),
    Rotation: createGestureBuilder('rotation'),
    Fling: createGestureBuilder('fling'),
    ForceTouch: createGestureBuilder('forceTouch'),
    Manual: createGestureBuilder('manual'),
    Native: createGestureBuilder('native'),
    Race: jest.fn((...gestures) => ({ type: 'race', gestures })),
    Simultaneous: jest.fn((...gestures) => ({ type: 'simultaneous', gestures })),
    Exclusive: jest.fn((...gestures) => ({ type: 'exclusive', gestures })),
  };
  

  const GestureDetector = React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({}));
    
    return React.createElement(View, {
      ...props,
      testID: 'gesture-detector',
      // Simulate gesture events for testing
      onTouchStart: props.onTouchStart,
      onTouchMove: props.onTouchMove,
      onTouchEnd: props.onTouchEnd,
    });
  });

  return {
    State,
    Directions,
    PanGestureHandler,
    PinchGestureHandler,
    TapGestureHandler,
    RotationGestureHandler,
    ForceTouchGestureHandler,
    LongPressGestureHandler,
    GestureHandlerRootView,
    Gesture,
    GestureDetector,
    // Export for testing utilities
    ...gestureHandlerGlobal,
  };
});

// Mock @react-native-async-storage/async-storage
jest.mock('@react-native-async-storage/async-storage', () => {
  let store = {};
  return {
    getItem: jest.fn(key => Promise.resolve(store[key] || null)),
    setItem: jest.fn((key, value) => {
      store[key] = value;
      return Promise.resolve();
    }),
    removeItem: jest.fn(key => {
      delete store[key];
      return Promise.resolve();
    }),
    clear: jest.fn(() => {
      store = {};
      return Promise.resolve();
    }),
    getAllKeys: jest.fn(() => Promise.resolve(Object.keys(store))),
    multiGet: jest.fn(keys => Promise.resolve(keys.map(key => [key, store[key] || null]))),
    multiSet: jest.fn(entries => {
      entries.forEach(([key, value]) => store[key] = value);
      return Promise.resolve();
    }),
    multiRemove: jest.fn(keys => {
      keys.forEach(key => delete store[key]);
      return Promise.resolve();
    }),
  };
});

// Mock expo-battery
jest.mock('expo-battery', () => ({
  getBatteryLevelAsync: jest.fn(() => Promise.resolve(0.75)),
  getBatteryStateAsync: jest.fn(() => Promise.resolve(2)), // CHARGING
  getPowerModeAsync: jest.fn(() => Promise.resolve(0)), // NORMAL
  isLowPowerModeEnabledAsync: jest.fn(() => Promise.resolve(false)),
  addBatteryLevelListener: jest.fn(() => ({ remove: jest.fn() })),
  addBatteryStateListener: jest.fn(() => ({ remove: jest.fn() })),
  addLowPowerModeListener: jest.fn(() => ({ remove: jest.fn() })),
  BatteryState: {
    UNKNOWN: 0,
    UNPLUGGED: 1,
    CHARGING: 2,
    FULL: 3,
  },
  PowerMode: {
    NORMAL: 0,
    LOW_POWER: 1,
  },
}));

// Mock rbush spatial indexing
jest.mock('rbush', () => {
  return jest.fn().mockImplementation(() => ({
    insert: jest.fn(function(item) {
      this._items = this._items || [];
      this._items.push(item);
      return this;
    }),
    remove: jest.fn(function(item) {
      this._items = this._items || [];
      const index = this._items.findIndex(i => 
        i.minX === item.minX && i.minY === item.minY && 
        i.maxX === item.maxX && i.maxY === item.maxY
      );
      if (index >= 0) this._items.splice(index, 1);
      return this;
    }),
    search: jest.fn(function(bbox) {
      this._items = this._items || [];
      return this._items.filter(item =>
        item.minX <= bbox.maxX && item.maxX >= bbox.minX &&
        item.minY <= bbox.maxY && item.maxY >= bbox.minY
      );
    }),
    collides: jest.fn(function(bbox) {
      return this.search(bbox).length > 0;
    }),
    clear: jest.fn(function() {
      this._items = [];
      return this;
    }),
    all: jest.fn(function() {
      return this._items || [];
    }),
    load: jest.fn(function(items) {
      this._items = [...items];
      return this;
    }),
    toJSON: jest.fn(function() {
      return { items: this._items || [] };
    }),
    fromJSON: jest.fn(function(data) {
      this._items = [...(data.items || [])];
      return this;
    }),
  }));
});

// Mock react-native-svg components
jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  
  // Simple functional component mocks
  const MockSvg = (props) => React.createElement(View, { ...props, testID: 'mock-svg' });
  const MockG = (props) => React.createElement(View, { ...props, testID: 'mock-g' });
  const MockCircle = (props) => React.createElement(View, { ...props, testID: 'mock-circle' });
  const MockRect = (props) => React.createElement(View, { ...props, testID: 'mock-rect' });
  const MockLine = (props) => React.createElement(View, { ...props, testID: 'mock-line' });
  const MockPath = (props) => React.createElement(View, { ...props, testID: 'mock-path' });
  const MockSvgText = (props) => React.createElement(Text, { ...props, testID: 'mock-svg-text' });
  const MockDefs = (props) => React.createElement(View, { ...props, testID: 'mock-defs' });
  const MockLinearGradient = (props) => React.createElement(View, { ...props, testID: 'mock-linear-gradient' });
  const MockRadialGradient = (props) => React.createElement(View, { ...props, testID: 'mock-radial-gradient' });
  const MockStop = (props) => React.createElement(View, { ...props, testID: 'mock-stop' });
  
  return {
    Svg: MockSvg,
    G: MockG,
    Circle: MockCircle,
    Rect: MockRect,
    Line: MockLine,
    Path: MockPath,
    Text: MockSvgText,
    Defs: MockDefs,
    LinearGradient: MockLinearGradient,
    RadialGradient: MockRadialGradient,
    Stop: MockStop,
  };
});

// Enhanced React Native Reanimated Mock with Worklet Context Simulator
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const Reanimated = require('react-native-reanimated/mock');

  // Worklet execution context simulator
  class WorkletContextSimulator {
    constructor() {
      this.jsThreadCallbacks = [];
      this.sharedValuesStore = new Map();
      this.workletScope = new Map();
    }

    // Simulate separate JS context execution
    executeInWorkletContext(workletFn, args = []) {
      try {
        // Create isolated scope for worklet execution
        const workletThis = { ...this.workletScope };
        const result = workletFn.apply(workletThis, args);
        
        // Process any queued JS thread callbacks
        this.processJSThreadCallbacks();
        
        return result;
      } catch (error) {
        console.warn('Worklet execution error:', error);
        return undefined;
      }
    }

    // Simulate runOnJS callback queueing
    runOnJS(callback) {
      return (...args) => {
        this.jsThreadCallbacks.push(() => callback(...args));
        // Simulate async execution
        setTimeout(() => this.processJSThreadCallbacks(), 0);
      };
    }

    processJSThreadCallbacks() {
      while (this.jsThreadCallbacks.length > 0) {
        const callback = this.jsThreadCallbacks.shift();
        try {
          callback();
        } catch (error) {
          console.warn('JS thread callback error:', error);
        }
      }
    }

    // Enhanced SharedValue implementation
    createSharedValue(initialValue) {
      const sharedValueId = `sv_${Date.now()}_${Math.random()}`;
      
      const sharedValue = {
        value: initialValue,
        _id: sharedValueId,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        modify: jest.fn((modifier) => {
          if (typeof modifier === 'function') {
            sharedValue.value = modifier(sharedValue.value);
          }
          return sharedValue.value;
        }),
      };

      // Store in simulator for cross-context access
      this.sharedValuesStore.set(sharedValueId, sharedValue);
      
      return sharedValue;
    }

    // Simulate worklet scope variables
    setWorkletScope(key, value) {
      this.workletScope.set(key, value);
    }

    getWorkletScope(key) {
      return this.workletScope.get(key);
    }

    // Reset simulator state
    reset() {
      this.jsThreadCallbacks = [];
      this.sharedValuesStore.clear();
      this.workletScope.clear();
    }
  }

  // Create global worklet context simulator
  const workletContext = new WorkletContextSimulator();

  // Enhanced mock implementation
  const enhancedReanimated = {
    ...Reanimated,
    
    // Fix the problematic call method
    call: () => {},

    // Mock createAnimatedComponent
    createAnimatedComponent: (Component) => {
      // Return a React component that behaves like the original but with Animated props support
      return React.forwardRef((props, ref) => {
        // Filter out animated style props and treat them as regular props
        const cleanProps = { ...props };
        if (cleanProps.style && typeof cleanProps.style === 'object') {
          // Convert animated values to regular values for testing
          const flattenedStyle = Array.isArray(cleanProps.style) 
            ? Object.assign({}, ...cleanProps.style)
            : cleanProps.style;
          cleanProps.style = flattenedStyle;
        }
        
        return React.createElement(Component, { 
          ...cleanProps, 
          ref,
          testID: `animated-${cleanProps.testID || 'component'}`
        });
      });
    },

    // Enhanced useSharedValue
    useSharedValue: (initialValue) => {
      const [sharedValue] = React.useState(() => 
        workletContext.createSharedValue(initialValue)
      );
      return sharedValue;
    },

    // Enhanced runOnJS implementation
    runOnJS: (callback) => workletContext.runOnJS(callback),

    // Enhanced worklet creation
    worklet: (fn) => {
      // Mark function as worklet and enhance it
      const workletFn = (...args) => {
        try {
          return workletContext.executeInWorkletContext(fn, args);
        } catch (error) {
          // In test environment, don't throw errors from worklets
          console.warn('Worklet execution error in test:', error.message);
          return undefined;
        }
      };
      workletFn._isWorklet = true;
      workletFn._originalFn = fn;
      return workletFn;
    },

    // Mock useAnimatedGestureHandler with proper worklet simulation
    useAnimatedGestureHandler: (handlers) => {
      return React.useMemo(() => {
        // Return a function that can handle gesture events
        const gestureHandler = (event) => {
          const eventType = event.nativeEvent?.state === 2 ? 'onStart' :
                           event.nativeEvent?.state === 4 ? 'onActive' :
                           event.nativeEvent?.state === 5 ? 'onEnd' : 'onActive';
          
          if (handlers[eventType] && typeof handlers[eventType] === 'function') {
            return workletContext.executeInWorkletContext(handlers[eventType], [event]);
          }
          
          // Fallback to onActive if available
          if (handlers.onActive && typeof handlers.onActive === 'function') {
            return workletContext.executeInWorkletContext(handlers.onActive, [event]);
          }
        };
        
        // Add handler methods as properties for testing
        Object.keys(handlers).forEach(key => {
          if (typeof handlers[key] === 'function') {
            gestureHandler[key] = (event) => {
              return workletContext.executeInWorkletContext(handlers[key], [event]);
            };
          }
        });
        
        return gestureHandler;
      }, [handlers]);
    },

    // Mock useAnimatedStyle with worklet context
    useAnimatedStyle: (styleWorklet, deps) => {
      return React.useMemo(() => {
        try {
          if (typeof styleWorklet === 'function') {
            return workletContext.executeInWorkletContext(styleWorklet) || {};
          }
          return {};
        } catch (error) {
          console.warn('Animated style error:', error);
          return {};
        }
      }, deps);
    },

    // Mock useAnimatedReaction
    useAnimatedReaction: (prepare, react, deps) => {
      React.useEffect(() => {
        if (typeof prepare === 'function' && typeof react === 'function') {
          const prepared = workletContext.executeInWorkletContext(prepare);
          workletContext.executeInWorkletContext(react, [prepared]);
        }
      }, deps);
    },

    // Mock interpolate function
    interpolate: (value, inputRange, outputRange, extrapolate) => {
      // Handle invalid inputs
      if (isNaN(value) || typeof value !== 'number') {
        return NaN;
      }
      if (!Array.isArray(inputRange) || !Array.isArray(outputRange)) {
        return value;
      }
      if (inputRange.length !== outputRange.length) {
        return value;
      }
      
      // Simple linear interpolation for testing
      const input = Math.max(inputRange[0], Math.min(inputRange[inputRange.length - 1], value));
      
      for (let i = 0; i < inputRange.length - 1; i++) {
        if (input >= inputRange[i] && input <= inputRange[i + 1]) {
          const progress = (input - inputRange[i]) / (inputRange[i + 1] - inputRange[i]);
          return outputRange[i] + progress * (outputRange[i + 1] - outputRange[i]);
        }
      }
      
      return outputRange[outputRange.length - 1];
    },

    // Animation timing functions
    withTiming: (toValue, config, callback) => {
      // Simulate immediate completion for tests
      if (callback && typeof callback === 'function') {
        setTimeout(() => workletContext.runOnJS(callback)(true), 0);
      }
      return toValue;
    },

    withSpring: (toValue, config, callback) => {
      if (callback && typeof callback === 'function') {
        setTimeout(() => workletContext.runOnJS(callback)(true), 0);
      }
      return toValue;
    },

    withDecay: (config, callback) => {
      const toValue = (config && config.velocity) ? config.velocity * 0.1 : 0;
      if (callback && typeof callback === 'function') {
        setTimeout(() => workletContext.runOnJS(callback)(true), 0);
      }
      return toValue;
    },

    // Easing functions
    Easing: {
      linear: (t) => t,
      ease: (t) => t,
      quad: (t) => t * t,
      cubic: (t) => t * t * t,
      bezier: () => (t) => t,
      in: (fn) => fn,
      out: (fn) => fn,
      inOut: (fn) => fn,
    },
  };

  // Add worklet context to global for testing utilities
  if (typeof global !== 'undefined') {
    global.WorkletTestUtils = {
      context: workletContext,
      createSharedValue: (value) => workletContext.createSharedValue(value),
      runOnJS: (callback) => workletContext.runOnJS(callback),
      executeWorklet: (fn, args) => workletContext.executeInWorkletContext(fn, args),
      resetContext: () => workletContext.reset(),
      worklet: enhancedReanimated.worklet,
    };
  }

  return enhancedReanimated;
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
      this.renderModules = jest.fn((context) => {
        // Return mock React elements for testing
        return this.modules.map((module, index) => 
          React.createElement('g', { key: `mock-module-${module.id || index}`, 'data-testid': `module-${module.id || index}` })
        );
      });
    }
    
    async registerModule(module) {
      this.modules.push(module);
      return Promise.resolve();
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
    ModuleManager: jest.fn().mockImplementation((options = {}) => new MockModuleManager(options)),
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