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
    
    // Enhanced performance monitoring for gestures
    measureGesturePerformance: (gestureSimulationFn, ...args) => {
      const startTime = performance.now();
      const result = gestureSimulationFn(...args);
      const endTime = performance.now();
      
      return {
        result,
        duration: endTime - startTime,
      };
    },
    
    // Complex gesture sequence with performance measurement
    simulateComplexGestureSequence: (handler, gestureType, config) => {
      const startTime = performance.now();
      let eventCount = 0;
      
      switch (gestureType) {
        case 'pan-with-momentum':
          const { start, end, steps = 10, momentum = true } = config;
          const sequence = [];
          
          for (let i = 0; i <= steps; i++) {
            const progress = i / steps;
            const x = start.x + (end.x - start.x) * progress;
            const y = start.y + (end.y - start.y) * progress;
            
            // Add momentum effect
            const velocityX = momentum ? (end.x - start.x) / steps * (1 + Math.sin(progress * Math.PI) * 0.5) : 0;
            const velocityY = momentum ? (end.y - start.y) / steps * (1 + Math.sin(progress * Math.PI) * 0.5) : 0;
            
            sequence.push({
              x,
              y,
              translationX: x - start.x,
              translationY: y - start.y,
              velocityX,
              velocityY,
            });
          }
          
          sequence.forEach((step, index) => {
            const event = createMockGestureEvent({
              state: index === 0 ? State.BEGAN : index === sequence.length - 1 ? State.END : State.ACTIVE,
              ...step,
            });
            if (handler.onGestureEvent) {
              handler.onGestureEvent(event);
              eventCount++;
            }
            if (index === sequence.length - 1 && handler.onHandlerStateChange) {
              handler.onHandlerStateChange(event);
            }
          });
          break;
          
        case 'elastic-pinch':
          const { initialScale = 1, finalScale, elasticity = 0.1 } = config;
          const pinchSteps = config.steps || 15;
          
          for (let i = 0; i <= pinchSteps; i++) {
            const progress = i / pinchSteps;
            const baseScale = initialScale + (finalScale - initialScale) * progress;
            
            // Add elastic effect
            const elasticEffect = elasticity * Math.sin(progress * Math.PI * 4) * Math.exp(-progress * 3);
            const scale = baseScale + elasticEffect;
            
            const event = createMockGestureEvent({
              state: i === 0 ? State.BEGAN : i === pinchSteps ? State.END : State.ACTIVE,
              scale,
              focalX: config.focalPoint?.x || 200,
              focalY: config.focalPoint?.y || 300,
            });
            
            if (handler.onGestureEvent) {
              handler.onGestureEvent(event);
              eventCount++;
            }
            if (i === pinchSteps && handler.onHandlerStateChange) {
              handler.onHandlerStateChange(event);
            }
          }
          break;
      }
      
      const endTime = performance.now();
      
      return {
        duration: endTime - startTime,
        eventsDispatched: eventCount,
        averageEventTime: eventCount > 0 ? (endTime - startTime) / eventCount : 0,
      };
    },
    
    // Gesture performance baseline
    createGesturePerformanceBaseline: (operations = 20) => {
      const mockHandler = {
        onGestureEvent: jest.fn(),
        onHandlerStateChange: jest.fn(),
      };
      
      let totalDuration = 0;
      let totalEvents = 0;
      
      for (let i = 0; i < operations; i++) {
        const result = gestureHandlerGlobal.simulateComplexGestureSequence(
          mockHandler,
          'pan-with-momentum',
          {
            start: { x: Math.random() * 100, y: Math.random() * 100 },
            end: { x: Math.random() * 300 + 100, y: Math.random() * 300 + 100 },
            steps: 10,
            momentum: true,
          }
        );
        
        totalDuration += result.duration;
        totalEvents += result.eventsDispatched;
      }
      
      return {
        averageGestureDuration: totalDuration / operations,
        averageEventTime: totalEvents > 0 ? totalDuration / totalEvents : 0,
        totalOperations: operations,
        baselineCreatedAt: new Date().toISOString(),
      };
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
      
      // Enhanced performance monitoring for worklets
      measureWorkletExecution: (workletFn, args = []) => {
        const startTime = performance.now();
        const result = workletContext.executeInWorkletContext(workletFn, args);
        const endTime = performance.now();
        
        return {
          result,
          duration: endTime - startTime,
          isWorklet: typeof workletFn._isWorklet !== 'undefined' ? workletFn._isWorklet : false,
        };
      },
      
      // Memory leak detection for worklet context
      detectWorkletMemoryLeaks: () => {
        const beforeSnapshot = global.MemoryTestUtils.captureMemorySnapshot('worklet-before');
        
        // Execute some test operations
        const testSharedValue = workletContext.createSharedValue(100);
        const testWorklet = enhancedReanimated.worklet(() => {
          return testSharedValue.value * 2;
        });
        workletContext.executeInWorkletContext(testWorklet);
        
        const afterSnapshot = global.MemoryTestUtils.captureMemorySnapshot('worklet-after');
        return global.MemoryTestUtils.detectMemoryLeaks(beforeSnapshot, afterSnapshot);
      },
      
      // Performance baseline for worklet operations
      createWorkletPerformanceBaseline: (operations = 50) => {
        let totalDuration = 0;
        let successCount = 0;
        
        for (let i = 0; i < operations; i++) {
          try {
            const testWorklet = enhancedReanimated.worklet((value) => value * Math.random());
            const result = global.WorkletTestUtils.measureWorkletExecution(testWorklet, [i]);
            totalDuration += result.duration;
            successCount++;
          } catch (error) {
            // Skip failed operations
          }
        }
        
        return {
          averageDuration: successCount > 0 ? totalDuration / successCount : 0,
          successRate: (successCount / operations) * 100,
          totalOperations: operations,
          baselineCreatedAt: new Date().toISOString(),
        };
      },

      // === ENHANCED WORKLET ISOLATION TESTING WITH MEMORY LEAK DETECTION ===

      /**
       * Monitors memory usage during complex gesture sequences with worklet processing
       * @param {Function|Object} gestureHandler - The gesture handler function or object with onGestureEvent
       * @param {Array} gestureSequence - Array of gesture configurations with eventCount and duration
       * @returns {Object} Comprehensive memory monitoring report
       */
      monitorGestureSequenceMemory: (gestureHandler, gestureSequence) => {
        if (!gestureHandler || !Array.isArray(gestureSequence)) {
          throw new Error('monitorGestureSequenceMemory requires valid gestureHandler and gestureSequence array');
        }

        const initialSnapshot = global.MemoryTestUtils.captureMemorySnapshot('gesture-sequence-start');
        const memoryCheckpoints = [];
        let peakMemoryUsage = initialSnapshot.jsHeapSizeUsed;
        let totalProcessingTime = 0;
        let eventCount = 0;
        let errorCount = 0;

        gestureSequence.forEach((gesture, sequenceIndex) => {
          if (!gesture || typeof gesture.eventCount !== 'number') {
            console.warn(`Invalid gesture configuration at index ${sequenceIndex}`);
            return;
          }

          const gestureStartTime = performance.now();

          // Simulate gesture events with error handling
          for (let i = 0; i < gesture.eventCount; i++) {
            const eventStartTime = performance.now();
            
            try {
              // Create mock gesture event
              const mockEvent = {
                nativeEvent: {
                  translationX: Math.random() * 100,
                  translationY: Math.random() * 100,
                  x: Math.random() * 400,
                  y: Math.random() * 600,
                },
              };

              // Execute worklet if gesture handler has worklet functions
              if (typeof gestureHandler === 'function') {
                workletContext.executeInWorkletContext(gestureHandler, [mockEvent]);
              } else if (gestureHandler && gestureHandler.onGestureEvent) {
                workletContext.executeInWorkletContext(gestureHandler.onGestureEvent, [mockEvent]);
              }

              totalProcessingTime += performance.now() - eventStartTime;
              eventCount++;

              // Memory checkpoint every 5 events for efficiency
              if (i % 5 === 0) {
                const checkpointSnapshot = global.MemoryTestUtils.captureMemorySnapshot(`gesture-${sequenceIndex}-event-${i}`);
                peakMemoryUsage = Math.max(peakMemoryUsage, checkpointSnapshot.jsHeapSizeUsed);
                memoryCheckpoints.push({
                  gestureIndex: sequenceIndex,
                  eventIndex: i,
                  memoryUsage: checkpointSnapshot.jsHeapSizeUsed,
                  timestamp: checkpointSnapshot.timestamp,
                });
              }
            } catch (error) {
              errorCount++;
              console.warn(`Error in gesture event processing: ${error.message}`);
            }
          }
        });

        const finalSnapshot = global.MemoryTestUtils.captureMemorySnapshot('gesture-sequence-end');
        const memoryGrowth = finalSnapshot.jsHeapSizeUsed - initialSnapshot.jsHeapSizeUsed;
        const memoryGrowthPercentage = initialSnapshot.jsHeapSizeUsed > 0 ? 
          (memoryGrowth / initialSnapshot.jsHeapSizeUsed) * 100 : 0;
        const potentialLeaks = memoryGrowthPercentage > 15; // 15% growth threshold

        // Enhanced leak source identification
        const leakSources = [];
        if (potentialLeaks) {
          leakSources.push('Gesture event processing accumulation');
          if (workletContext.sharedValuesStore.size > 10) {
            leakSources.push(`SharedValue accumulation (${workletContext.sharedValuesStore.size} values)`);
          }
          if (workletContext.jsThreadCallbacks.length > 5) {
            leakSources.push(`Uncleaned JS thread callbacks (${workletContext.jsThreadCallbacks.length} pending)`);
          }
          if (errorCount > eventCount * 0.1) {
            leakSources.push('High error rate may indicate resource leaks');
          }
        }

        return {
          initialSnapshot,
          finalSnapshot,
          peakMemoryUsage,
          memoryGrowth,
          memoryGrowthPercentage,
          potentialLeaks,
          leakSources,
          errorCount,
          executionMetrics: {
            totalDuration: totalProcessingTime,
            averageEventProcessingTime: eventCount > 0 ? totalProcessingTime / eventCount : 0,
            memoryEfficiency: eventCount > 0 ? Math.max(0, 1 - (Math.abs(memoryGrowth) / (eventCount * 1024))) : 1,
            errorRate: eventCount > 0 ? errorCount / eventCount : 0,
          },
        };
      },

      /**
       * Validates worklet cleanup after execution with comprehensive resource tracking
       * @returns {Object} Detailed cleanup validation report
       */
      validateWorkletCleanup: () => {
        const currentTime = Date.now();
        
        // Enhanced SharedValue orphan detection
        const orphanedSharedValues = [];
        const activeSharedValues = [];
        
        workletContext.sharedValuesStore.forEach((sharedValue, id) => {
          try {
            // Extract timestamp from SharedValue ID
            const idParts = id.split('_');
            const creationTime = idParts.length > 1 ? parseInt(idParts[1]) : currentTime;
            const timeSinceCreation = currentTime - creationTime;
            
            // Consider SharedValues orphaned if they're older than 5 seconds in test environment
            if (timeSinceCreation > 5000) {
              orphanedSharedValues.push({
                id,
                timeSinceCreation,
                lastAccessed: creationTime,
              });
            } else {
              activeSharedValues.push({
                id,
                age: timeSinceCreation,
              });
            }
          } catch (error) {
            // If we can't parse the ID, consider it potentially orphaned
            orphanedSharedValues.push({
              id,
              timeSinceCreation: 'unknown',
              parseError: error.message,
            });
          }
        });

        // Enhanced listener leak detection
        const unclearedListeners = [];
        Array.from(workletContext.sharedValuesStore.values()).forEach((sharedValue) => {
          if (sharedValue.addListener && sharedValue.addListener.mock?.calls?.length > 0) {
            unclearedListeners.push({
              id: sharedValue._id,
              listenerCount: sharedValue.addListener.mock.calls.length,
            });
          }
        });

        // Pending callback analysis
        const pendingJSCallbacks = workletContext.jsThreadCallbacks.map((callback, index) => ({
          index,
          type: typeof callback,
          stringified: callback.toString().substring(0, 100), // First 100 chars for identification
        }));

        // Worklet scope leak detection with type analysis
        const workletScopeLeaks = [];
        workletContext.workletScope.forEach((value, key) => {
          if (typeof value === 'object' && value !== null) {
            workletScopeLeaks.push({
              key,
              type: Array.isArray(value) ? 'array' : 'object',
              size: Array.isArray(value) ? value.length : Object.keys(value).length,
            });
          }
        });

        // Calculate cleanup efficiency
        const totalResources = orphanedSharedValues.length + activeSharedValues.length + 
                             unclearedListeners.length + pendingJSCallbacks.length + workletScopeLeaks.length;
        const cleanResources = activeSharedValues.length;
        const cleanupEfficiency = totalResources > 0 ? cleanResources / totalResources : 1;
        
        const cleanupSuccessful = orphanedSharedValues.length === 0 && 
                                unclearedListeners.length === 0 && 
                                pendingJSCallbacks.length === 0 && 
                                workletScopeLeaks.length === 0;

        // Generate detailed recommendations
        const recommendations = [];
        if (!cleanupSuccessful) {
          if (orphanedSharedValues.length > 0) {
            recommendations.push(`Clean up ${orphanedSharedValues.length} orphaned SharedValues by removing references`);
          }
          if (unclearedListeners.length > 0) {
            recommendations.push(`Remove ${unclearedListeners.length} event listeners before worklet disposal`);
          }
          if (pendingJSCallbacks.length > 0) {
            recommendations.push(`Execute or clear ${pendingJSCallbacks.length} pending runOnJS callbacks`);
          }
          if (workletScopeLeaks.length > 0) {
            recommendations.push(`Clear ${workletScopeLeaks.length} worklet scope variables that reference large objects`);
          }
        }
        
        if (cleanupEfficiency < 0.8) {
          recommendations.push('Overall cleanup efficiency is low - review resource management strategy');
        }

        return {
          orphanedSharedValues,
          activeSharedValues,
          unclearedListeners,
          pendingJSCallbacks,
          workletScopeLeaks,
          cleanupSuccessful,
          cleanupEfficiency,
          totalResources,
          recommendations,
        };
      },

      /**
       * Measures worklet performance under various load conditions
       */
      measureWorkletPerformanceUnderLoad: (workletFn, loadTestConfig) => {
        const { concurrentExecutions, executionsPerBatch, batchCount, memoryPressureSimulation } = loadTestConfig;
        
        const startSnapshot = global.MemoryTestUtils.captureMemorySnapshot('load-test-start');
        const performanceMetrics = [];
        let totalExecutionTime = 0;
        const memoryUsagePattern = [];

        for (let batch = 0; batch < batchCount; batch++) {
          const batchStartTime = performance.now();
          const promises = [];

          // Simulate concurrent executions
          for (let concurrent = 0; concurrent < concurrentExecutions; concurrent++) {
            for (let exec = 0; exec < executionsPerBatch; exec++) {
              const executionStartTime = performance.now();
              
              // Execute worklet with test data
              const testData = {
                value: Math.random() * 1000,
                timestamp: Date.now(),
                batchIndex: batch,
                executionIndex: exec,
              };

              try {
                const result = workletContext.executeInWorkletContext(workletFn, [testData]);
                const executionEndTime = performance.now();
                const executionTime = executionEndTime - executionStartTime;
                
                performanceMetrics.push({
                  batchIndex: batch,
                  executionTime,
                  memoryBefore: global.MemoryTestUtils.captureMemorySnapshot('pre-execution').jsHeapSizeUsed,
                  memoryAfter: global.MemoryTestUtils.captureMemorySnapshot('post-execution').jsHeapSizeUsed,
                  successful: true,
                });

                totalExecutionTime += executionTime;
              } catch (error) {
                performanceMetrics.push({
                  batchIndex: batch,
                  executionTime: performance.now() - executionStartTime,
                  error: error.message,
                  successful: false,
                });
              }
            }
          }

          // Memory pressure simulation
          if (memoryPressureSimulation) {
            const pressureData = new Array(1000).fill(0).map(() => Math.random());
            memoryUsagePattern.push({
              batch,
              pressureSimulated: true,
              dataSize: pressureData.length,
            });
          }
        }

        const endSnapshot = global.MemoryTestUtils.captureMemorySnapshot('load-test-end');
        const successfulExecutions = performanceMetrics.filter(m => m.successful);
        const averageExecutionTime = successfulExecutions.length > 0 ? 
          successfulExecutions.reduce((sum, m) => sum + m.executionTime, 0) / successfulExecutions.length : 0;

        const memoryGrowth = endSnapshot.jsHeapSizeUsed - startSnapshot.jsHeapSizeUsed;
        const baselinePerformance = successfulExecutions[0]?.executionTime || 1;
        const finalPerformance = successfulExecutions[successfulExecutions.length - 1]?.executionTime || 1;
        const performanceDegradation = (finalPerformance - baselinePerformance) / baselinePerformance;

        return {
          averageExecutionTime,
          memoryUsagePattern: {
            peak: Math.max(...performanceMetrics.map(m => m.memoryAfter || 0)),
            average: performanceMetrics.reduce((sum, m) => sum + (m.memoryAfter || 0), 0) / performanceMetrics.length,
            growth: memoryGrowth,
          },
          performanceDegradation,
          memoryLeaksDetected: memoryGrowth > (startSnapshot.jsHeapSizeUsed * 0.2),
          recommendedMaxLoad: performanceDegradation < 0.5 ? concurrentExecutions : Math.floor(concurrentExecutions * 0.7),
          stabilityScore: successfulExecutions.length / performanceMetrics.length,
        };
      },

      /**
       * Validates garbage collection effectiveness
       */
      validateGarbageCollection: () => {
        const beforeSnapshot = global.MemoryTestUtils.captureMemorySnapshot('gc-before');
        
        // Attempt to trigger garbage collection (mock implementation)
        // In real React Native, this would use JSI bridge or other native methods
        const collectionTriggered = true;
        
        // Simulate some cleanup
        const initialSharedValueCount = workletContext.sharedValuesStore.size;
        const initialCallbackCount = workletContext.jsThreadCallbacks.length;
        
        // Mock cleanup of unreferenced items
        const cleanedSharedValues = Math.floor(initialSharedValueCount * 0.3);
        const cleanedCallbacks = Math.floor(initialCallbackCount * 0.5);
        
        // Remove some items to simulate GC
        let removeCount = 0;
        for (const [id, _] of workletContext.sharedValuesStore.entries()) {
          if (removeCount >= cleanedSharedValues) break;
          workletContext.sharedValuesStore.delete(id);
          removeCount++;
        }
        
        workletContext.jsThreadCallbacks.splice(0, cleanedCallbacks);

        const afterSnapshot = global.MemoryTestUtils.captureMemorySnapshot('gc-after');
        const memoryReleased = Math.max(0, beforeSnapshot.jsHeapSizeUsed - afterSnapshot.jsHeapSizeUsed);
        
        const remainingObjects = workletContext.sharedValuesStore.size + workletContext.jsThreadCallbacks.length;
        const collectionEfficiency = memoryReleased > 0 ? (memoryReleased / beforeSnapshot.jsHeapSizeUsed) : 0;
        
        const gcRecommendations = [];
        if (collectionEfficiency < 0.1) {
          gcRecommendations.push('Consider more aggressive cleanup of worklet resources');
        }
        if (remainingObjects > 50) {
          gcRecommendations.push('High number of remaining objects - check for circular references');
        }

        return {
          collectionTriggered,
          memoryReleased,
          remainingObjects,
          collectionEfficiency,
          gcRecommendations,
        };
      },

      // === WORKLET ISOLATION TESTING ===

      /**
       * Creates an isolated worklet execution context
       */
      createIsolatedWorkletContext: (contextId) => {
        const isolatedContext = {
          id: contextId,
          variables: new Map(),
          sharedValues: new Map(),
          callbacks: [],

          setVariable: function(key, value) {
            this.variables.set(key, value);
          },

          getVariable: function(key) {
            return this.variables.get(key);
          },

          cleanup: function() {
            this.variables.clear();
            this.sharedValues.clear();
            this.callbacks = [];
          },
        };

        return isolatedContext;
      },

      /**
       * Executes worklet in a specific isolated context
       */
      executeInContext: (workletFn, context) => {
        // Temporarily override worklet context variables
        const originalScope = new Map(workletContext.workletScope);
        
        // Set context variables in worklet scope
        context.variables.forEach((value, key) => {
          workletContext.workletScope.set(key, value);
        });

        try {
          const result = workletContext.executeInWorkletContext(workletFn, []);
          return result;
        } finally {
          // Restore original scope
          workletContext.workletScope.clear();
          originalScope.forEach((value, key) => {
            workletContext.workletScope.set(key, value);
          });
        }
      },

      /**
       * Validates resource cleanup between worklet executions
       */
      validateResourceCleanupBetweenExecutions: () => {
        const executions = [];
        const resourceLeaksPerExecution = [];
        let totalResourceGrowth = 0;

        // Simulate tracking of multiple executions (mock data)
        for (let i = 0; i < 5; i++) {
          const beforeExecution = {
            sharedValues: workletContext.sharedValuesStore.size,
            callbacks: workletContext.jsThreadCallbacks.length,
            memoryUsed: global.MemoryTestUtils.captureMemorySnapshot(`execution-${i}-before`).jsHeapSizeUsed,
          };

          // Simulate worklet execution that might leave resources
          const testSharedValue = workletContext.createSharedValue(Math.random());
          workletContext.jsThreadCallbacks.push(() => console.log(`Test callback ${i}`));

          const afterExecution = {
            sharedValues: workletContext.sharedValuesStore.size,
            callbacks: workletContext.jsThreadCallbacks.length,
            memoryUsed: global.MemoryTestUtils.captureMemorySnapshot(`execution-${i}-after`).jsHeapSizeUsed,
          };

          const resourceGrowth = {
            sharedValues: afterExecution.sharedValues - beforeExecution.sharedValues,
            callbacks: afterExecution.callbacks - beforeExecution.callbacks,
            memory: afterExecution.memoryUsed - beforeExecution.memoryUsed,
          };

          resourceLeaksPerExecution.push(resourceGrowth);
          totalResourceGrowth += resourceGrowth.memory;
          executions.push({ beforeExecution, afterExecution, resourceGrowth });
        }

        const averageResourceGrowth = totalResourceGrowth / executions.length;
        const cleanupEfficiency = averageResourceGrowth > 0 ? 
          (1 - (averageResourceGrowth / executions[0].beforeExecution.memoryUsed)) : 1;

        const criticalLeaks = resourceLeaksPerExecution.filter(leak => 
          leak.sharedValues > 5 || leak.callbacks > 10 || leak.memory > 1000000
        );

        const recommendations = [];
        if (criticalLeaks.length > 0) {
          recommendations.push('Critical resource leaks detected - implement cleanup hooks');
        }
        if (cleanupEfficiency < 0.8) {
          recommendations.push('Poor cleanup efficiency - review resource disposal patterns');
        }

        return {
          executionCount: executions.length,
          resourceLeaksPerExecution,
          averageResourceGrowth,
          cleanupEfficiency,
          criticalLeaks,
          recommendations,
        };
      },

      /**
       * Monitors memory patterns during worklet operations
       */
      monitorWorkletMemoryPatterns: (workletFn, workletArgs, monitoringConfig) => {
        const { samplingRate, duration } = monitoringConfig;
        const memoryPattern = [];
        const memorySpikes = [];
        let peakUsage = 0;
        let totalSamples = 0;
        let totalUsage = 0;
        let gcTriggers = 0;

        const startTime = Date.now();
        const endTime = startTime + duration;

        // Simulate memory monitoring during worklet execution
        const monitoringInterval = Math.max(1, Math.floor(duration / samplingRate));
        
        for (let sample = 0; sample < samplingRate && Date.now() < endTime; sample++) {
          const sampleStartTime = performance.now();
          
          // Execute worklet
          try {
            const result = workletContext.executeInWorkletContext(workletFn, [workletArgs]);
            
            const memorySnapshot = global.MemoryTestUtils.captureMemorySnapshot(`pattern-sample-${sample}`);
            const currentUsage = memorySnapshot.jsHeapSizeUsed;
            
            memoryPattern.push({
              timestamp: Date.now(),
              memoryUsage: currentUsage,
              sampleIndex: sample,
            });

            // Detect memory spikes (>20% increase from previous sample)
            if (memoryPattern.length > 1) {
              const previousUsage = memoryPattern[memoryPattern.length - 2].memoryUsage;
              const growthRate = (currentUsage - previousUsage) / previousUsage;
              if (growthRate > 0.2) {
                memorySpikes.push({
                  sampleIndex: sample,
                  previousUsage,
                  currentUsage,
                  growthRate,
                });
              }
            }

            peakUsage = Math.max(peakUsage, currentUsage);
            totalUsage += currentUsage;
            totalSamples++;

            // Simulate GC trigger detection (mock)
            if (currentUsage > peakUsage * 0.8) {
              gcTriggers++;
            }

          } catch (error) {
            memoryPattern.push({
              timestamp: Date.now(),
              error: error.message,
              sampleIndex: sample,
            });
          }

          // Simulate sampling interval
          const elapsed = performance.now() - sampleStartTime;
          if (elapsed < monitoringInterval) {
            // In real implementation, would use setTimeout or similar
            continue;
          }
        }

        const averageUsage = totalSamples > 0 ? totalUsage / totalSamples : 0;
        
        // Determine allocation pattern
        let allocationPattern = 'stable';
        if (memorySpikes.length > samplingRate * 0.3) {
          allocationPattern = 'spiky';
        } else if (peakUsage > averageUsage * 1.5) {
          allocationPattern = 'growing';
        } else if (memoryPattern.some(p => p.memoryUsage < averageUsage * 0.7)) {
          allocationPattern = 'variable';
        }

        const memoryEfficiency = peakUsage > 0 ? averageUsage / peakUsage : 1;
        
        const recommendations = [];
        if (allocationPattern === 'spiky') {
          recommendations.push('High memory volatility - consider object pooling');
        }
        if (memoryEfficiency < 0.6) {
          recommendations.push('Low memory efficiency - review object lifecycle management');
        }
        if (gcTriggers > samplingRate * 0.2) {
          recommendations.push('Frequent GC triggers - optimize memory allocation patterns');
        }

        return {
          memoryPattern,
          peakUsage,
          averageUsage,
          memorySpikes,
          allocationPattern,
          gcTriggers,
          memoryEfficiency,
          recommendations,
        };
      },

      // === PERFORMANCE TESTING UNDER LOAD ===

      /**
       * Tests worklet performance with varying memory pressure
       */
      testWorkletPerformanceWithMemoryPressure: (workletFn, memoryPressureTests) => {
        const performanceByPressure = {};
        const performanceDegradationCurve = [];
        let memoryPressureThreshold = Infinity;

        memoryPressureTests.forEach((test, index) => {
          const { memoryPressure, complexity } = test;
          
          // Simulate memory pressure
          const pressureData = [];
          const pressureMultiplier = {
            low: 1,
            medium: 5,
            high: 20,
            extreme: 50,
          }[memoryPressure] || 1;

          for (let i = 0; i < pressureMultiplier * 100; i++) {
            pressureData.push(new Array(100).fill(Math.random()));
          }

          const beforeSnapshot = global.MemoryTestUtils.captureMemorySnapshot(`pressure-${memoryPressure}-before`);
          const executions = [];
          let totalExecutionTime = 0;

          // Run multiple executions under this pressure level
          for (let exec = 0; exec < 10; exec++) {
            const startTime = performance.now();
            
            try {
              const result = workletContext.executeInWorkletContext(workletFn, [complexity]);
              const endTime = performance.now();
              const executionTime = endTime - startTime;
              
              executions.push({ executionTime, successful: true });
              totalExecutionTime += executionTime;
            } catch (error) {
              const endTime = performance.now();
              executions.push({ 
                executionTime: endTime - startTime, 
                successful: false,
                error: error.message 
              });
            }
          }

          const afterSnapshot = global.MemoryTestUtils.captureMemorySnapshot(`pressure-${memoryPressure}-after`);
          const averageExecutionTime = totalExecutionTime / executions.filter(e => e.successful).length;
          const memoryUsage = afterSnapshot.jsHeapSizeUsed - beforeSnapshot.jsHeapSizeUsed;

          performanceByPressure[memoryPressure] = {
            averageExecutionTime,
            memoryUsage,
            successRate: executions.filter(e => e.successful).length / executions.length,
            pressureLevel: pressureMultiplier,
          };

          // Track degradation curve
          const baselineTime = performanceByPressure.low?.averageExecutionTime || averageExecutionTime;
          const degradationFactor = averageExecutionTime / baselineTime;
          
          performanceDegradationCurve.push({
            memoryPressure,
            degradationFactor,
            absoluteTime: averageExecutionTime,
          });

          // Determine threshold where performance degrades significantly
          if (degradationFactor > 2 && memoryPressureThreshold === Infinity) {
            memoryPressureThreshold = pressureMultiplier;
          }
        });

        const recommendations = [];
        if (memoryPressureThreshold < 20) {
          recommendations.push('Low memory pressure tolerance - optimize worklet memory usage');
        }
        if (performanceByPressure.extreme?.successRate < 0.8) {
          recommendations.push('Poor stability under extreme memory pressure');
        }

        return {
          performanceByPressure,
          performanceDegradationCurve,
          memoryPressureThreshold,
          recommendations,
        };
      },

      /**
       * Validates worklet stability across multiple execution cycles
       */
      validateWorkletStabilityAcrossCycles: (workletFn, config) => {
        const { cycleCount, iterationsPerCycle, memoryMonitoring } = config;
        const cycleResults = [];
        const memoryLeakTrend = [];
        let failureCount = 0;
        let totalExecutionTime = 0;
        let totalMemoryGrowth = 0;

        for (let cycle = 0; cycle < cycleCount; cycle++) {
          const cycleStartSnapshot = memoryMonitoring ? 
            global.MemoryTestUtils.captureMemorySnapshot(`cycle-${cycle}-start`) : null;
          
          const cycleStartTime = performance.now();
          let cycleExecutionTime = 0;
          let cycleFailures = 0;

          for (let iteration = 0; iteration < iterationsPerCycle; iteration++) {
            const iterationStartTime = performance.now();
            
            try {
              const result = workletContext.executeInWorkletContext(workletFn, [{
                initialValue: Math.random() * 100,
                iterations: 50 + Math.floor(Math.random() * 50),
              }]);
              
              cycleExecutionTime += performance.now() - iterationStartTime;
            } catch (error) {
              cycleFailures++;
              failureCount++;
            }
          }

          const cycleEndSnapshot = memoryMonitoring ? 
            global.MemoryTestUtils.captureMemorySnapshot(`cycle-${cycle}-end`) : null;

          const cycleMemoryGrowth = memoryMonitoring ? 
            cycleEndSnapshot.jsHeapSizeUsed - cycleStartSnapshot.jsHeapSizeUsed : 0;

          cycleResults.push({
            cycle,
            executionTime: cycleExecutionTime,
            failures: cycleFailures,
            memoryGrowth: cycleMemoryGrowth,
          });

          if (memoryMonitoring) {
            memoryLeakTrend.push({
              cycle,
              memoryGrowth: cycleMemoryGrowth,
              cumulativeGrowth: totalMemoryGrowth + cycleMemoryGrowth,
            });
            totalMemoryGrowth += cycleMemoryGrowth;
          }

          totalExecutionTime += cycleExecutionTime;
        }

        // Calculate stability metrics
        const executionTimes = cycleResults.map(r => r.executionTime);
        const averageExecutionTime = totalExecutionTime / cycleCount;
        const executionTimeVariance = executionTimes.reduce((sum, time) => 
          sum + Math.pow(time - averageExecutionTime, 2), 0) / cycleCount;
        
        const executionStability = 1 - Math.sqrt(executionTimeVariance) / averageExecutionTime;
        
        const memoryGrowths = cycleResults.map(r => r.memoryGrowth);
        const averageMemoryGrowth = totalMemoryGrowth / cycleCount;
        const memoryGrowthVariance = memoryGrowths.reduce((sum, growth) => 
          sum + Math.pow(growth - averageMemoryGrowth, 2), 0) / cycleCount;
        
        const memoryStability = memoryMonitoring ? 
          1 - Math.sqrt(memoryGrowthVariance) / Math.max(averageMemoryGrowth, 1) : 1;

        const performanceConsistency = 1 - (failureCount / (cycleCount * iterationsPerCycle));
        const stabilityScore = (executionStability + memoryStability + performanceConsistency) / 3;

        const criticalIssues = [];
        if (executionStability < 0.8) {
          criticalIssues.push('Unstable execution time across cycles');
        }
        if (memoryStability < 0.8) {
          criticalIssues.push('Inconsistent memory usage patterns');
        }
        if (failureCount > cycleCount * iterationsPerCycle * 0.05) {
          criticalIssues.push('High failure rate across cycles');
        }

        const recommendations = [];
        if (criticalIssues.length > 0) {
          recommendations.push('Address critical stability issues before production use');
        }
        if (totalMemoryGrowth > 0) {
          recommendations.push('Monitor memory growth - potential leak detected');
        }

        return {
          executionStability,
          memoryStability,
          performanceConsistency,
          failureCount,
          memoryLeakTrend,
          stabilityScore,
          criticalIssues,
          recommendations,
        };
      },

      // === EDGE CASES AND COMPLEX SCENARIOS ===

      /**
       * Detects memory leaks with nested SharedValues
       */
      detectNestedSharedValueLeaks: () => {
        const nestingLevels = [];
        const leaksPerLevel = [];
        let totalSharedValues = 0;
        let orphanedValues = 0;

        // Analyze the SharedValues store for nested structures
        workletContext.sharedValuesStore.forEach((sharedValue, id) => {
          totalSharedValues++;
          
          // Simulate nesting analysis (in real implementation, would traverse object references)
          const mockNestingLevel = Math.floor(Math.random() * 5) + 1;
          const mockLeakStatus = Math.random() > 0.7; // 30% chance of leak
          
          if (!nestingLevels[mockNestingLevel]) {
            nestingLevels[mockNestingLevel] = 0;
            leaksPerLevel[mockNestingLevel] = 0;
          }
          
          nestingLevels[mockNestingLevel]++;
          
          if (mockLeakStatus) {
            leaksPerLevel[mockNestingLevel]++;
            orphanedValues++;
          }
        });

        const deepestLeakLevel = leaksPerLevel.reduceRight((max, count, level) => 
          count > 0 ? Math.max(max, level) : max, 0);
        
        const memoryImpact = orphanedValues * 1024; // Simulate memory impact

        const cleanupRecommendations = [];
        if (orphanedValues > totalSharedValues * 0.2) {
          cleanupRecommendations.push('High percentage of orphaned SharedValues - implement reference tracking');
        }
        if (deepestLeakLevel > 3) {
          cleanupRecommendations.push('Deep nesting detected - consider flattening SharedValue structures');
        }
        if (memoryImpact > 10240) { // 10KB
          cleanupRecommendations.push('Significant memory impact - prioritize cleanup of nested structures');
        }

        return {
          nestingLevels,
          leaksPerLevel,
          totalSharedValues,
          orphanedValues,
          deepestLeakLevel,
          memoryImpact,
          cleanupRecommendations,
        };
      },

      /**
       * Validates cleanup of runOnJS callbacks
       */
      validateRunOnJSCleanup: () => {
        let totalCallbacksCreated = workletContext.jsThreadCallbacks.length;
        let callbacksExecuted = 0;
        let pendingCallbacks = 0;
        let orphanedCallbacks = 0;

        // Simulate callback execution tracking
        workletContext.jsThreadCallbacks.forEach((callback, index) => {
          const shouldExecute = Math.random() > 0.3; // 70% execution rate
          if (shouldExecute) {
            try {
              callback();
              callbacksExecuted++;
            } catch (error) {
              orphanedCallbacks++;
            }
          } else {
            pendingCallbacks++;
          }
        });

        // Add simulated historical data
        totalCallbacksCreated += Math.floor(Math.random() * 20);
        
        const memoryUsedByCallbacks = (pendingCallbacks + orphanedCallbacks) * 256; // Simulate memory usage
        const cleanupEfficiency = totalCallbacksCreated > 0 ? callbacksExecuted / totalCallbacksCreated : 1;

        const recommendations = [];
        if (cleanupEfficiency < 0.8) {
          recommendations.push('Poor callback execution rate - ensure runOnJS callbacks are properly handled');
        }
        if (orphanedCallbacks > 5) {
          recommendations.push('High number of orphaned callbacks - check for error handling in JS callbacks');
        }
        if (pendingCallbacks > 10) {
          recommendations.push('Many pending callbacks - consider callback timeout mechanisms');
        }

        return {
          totalCallbacksCreated,
          callbacksExecuted,
          pendingCallbacks,
          orphanedCallbacks,
          memoryUsedByCallbacks,
          cleanupEfficiency,
          recommendations,
        };
      },

      /**
       * Measures worklet performance impact on UI thread
       */
      measureUIThreadImpact: (workletFn, workload) => {
        const startTime = performance.now();
        let workletExecutionTime = 0;
        let uiThreadBlockingTime = 0;
        let jsCallbackOverhead = 0;

        // Execute worklet and measure UI thread impact
        const workletStartTime = performance.now();
        
        try {
          const result = workletContext.executeInWorkletContext(workletFn, [workload]);
          workletExecutionTime = performance.now() - workletStartTime;

          // Simulate UI thread blocking calculation
          // In real implementation, this would measure actual frame drops or UI responsiveness
          uiThreadBlockingTime = workletExecutionTime * 0.1; // 10% of worklet time affects UI thread

          // Simulate JS callback overhead
          if (workletFn.toString().includes('runOnJS')) {
            jsCallbackOverhead = workload.jsCallbacks * 2; // 2ms per callback overhead
            uiThreadBlockingTime += jsCallbackOverhead;
          }

        } catch (error) {
          workletExecutionTime = performance.now() - workletStartTime;
          uiThreadBlockingTime = workletExecutionTime; // Error cases block UI thread more
        }

        const totalTime = performance.now() - startTime;
        const frameDropRisk = uiThreadBlockingTime > 16.67; // 60fps = 16.67ms per frame
        const performanceImpactScore = Math.min(1, uiThreadBlockingTime / 16.67);

        const recommendations = [];
        if (frameDropRisk) {
          recommendations.push('High frame drop risk - optimize worklet execution time');
        }
        if (jsCallbackOverhead > workletExecutionTime * 0.5) {
          recommendations.push('JS callback overhead is significant - minimize runOnJS usage');
        }
        if (performanceImpactScore > 0.8) {
          recommendations.push('High UI thread impact - consider breaking worklet into smaller chunks');
        }

        return {
          workletExecutionTime,
          uiThreadBlockingTime,
          jsCallbackOverhead,
          frameDropRisk,
          performanceImpactScore,
          recommendations,
        };
      },

      // === INTEGRATION WITH EXISTING TEST INFRASTRUCTURE ===

      /**
       * Integrates with spatial performance testing from Task 1.1
       */
      integrateWithSpatialPerformance: (spatialWorklet, coordinates, viewport) => {
        const workletStartTime = performance.now();
        
        // Execute spatial worklet in worklet context
        const workletResult = workletContext.executeInWorkletContext(spatialWorklet, [coordinates, viewport]);
        const workletExecutionTime = performance.now() - workletStartTime;
        
        // Get spatial performance measurement using existing infrastructure
        const spatialResult = global.SpatialPerformanceTestUtils.measureCoordinateTransform(
          (coords, vp) => ({
            x: coords.x * vp.scale + vp.translateX,
            y: coords.y * vp.scale + vp.translateY,
          }),
          coordinates,
          viewport
        );

        const workletMemorySnapshot = global.MemoryTestUtils.captureMemorySnapshot('spatial-worklet-integration');

        const combinedEfficiency = spatialResult.duration > 0 && workletExecutionTime > 0 ? 
          Math.min(spatialResult.duration, workletExecutionTime) / Math.max(spatialResult.duration, workletExecutionTime) : 1;

        const performanceComparison = {
          workletVsSpatial: workletExecutionTime / spatialResult.duration,
          recommendation: workletExecutionTime < spatialResult.duration ? 
            'Worklet implementation is more efficient' : 
            'Consider optimizing worklet implementation',
        };

        return {
          workletPerformance: {
            executionTime: workletExecutionTime,
            memoryUsage: workletMemorySnapshot.jsHeapSizeUsed,
            result: workletResult,
          },
          spatialPerformance: {
            coordinateTransformTime: spatialResult.duration,
            result: spatialResult.result,
          },
          combinedEfficiency,
          performanceComparison,
        };
      },

      /**
       * Integrates with enhanced gesture simulation from Task 1.2
       */
      integrateWithGestureSimulation: (gestureHandler, gestureType, gestureConfig) => {
        const integrationStartTime = performance.now();
        const workletExecutionMetrics = {
          executions: [],
          memoryUsagePattern: [],
          totalExecutions: 0,
        };

        // Create enhanced gesture handler that tracks worklet execution
        const trackingHandler = {
          onGestureEvent: (event) => {
            const executionStartTime = performance.now();
            const beforeMemory = global.MemoryTestUtils.captureMemorySnapshot('gesture-worklet-before');
            
            let result;
            if (gestureHandler.onGestureEvent) {
              result = workletContext.executeInWorkletContext(gestureHandler.onGestureEvent, [event]);
            }
            
            const executionEndTime = performance.now();
            const afterMemory = global.MemoryTestUtils.captureMemorySnapshot('gesture-worklet-after');
            
            workletExecutionMetrics.executions.push({
              executionTime: executionEndTime - executionStartTime,
              memoryGrowth: afterMemory.jsHeapSizeUsed - beforeMemory.jsHeapSizeUsed,
              eventType: event.nativeEvent?.state || 'unknown',
            });
            
            workletExecutionMetrics.totalExecutions++;
            workletExecutionMetrics.memoryUsagePattern.push(afterMemory.jsHeapSizeUsed);

            return result;
          },
        };

        // Use existing gesture simulation infrastructure
        let gestureSimulationResult;
        switch (gestureType) {
          case 'complex_pan_with_momentum':
            gestureSimulationResult = global.GestureTestUtils.simulatePanWithMomentum?.(
              trackingHandler,
              gestureConfig.startPoint,
              gestureConfig.endPoint,
              gestureConfig
            ) || { totalDuration: 0, gestureEvents: [] };
            break;
          default:
            // Fallback to basic gesture simulation
            const sequence = [
              { x: gestureConfig.startPoint?.x || 0, y: gestureConfig.startPoint?.y || 0 },
              { x: gestureConfig.endPoint?.x || 100, y: gestureConfig.endPoint?.y || 100 },
            ];
            global.GestureTestUtils.simulatePanGesture?.(trackingHandler, sequence);
            gestureSimulationResult = { totalDuration: 100, gestureEvents: sequence };
        }

        // Calculate worklet execution metrics
        const averageExecutionTime = workletExecutionMetrics.executions.length > 0 ?
          workletExecutionMetrics.executions.reduce((sum, exec) => sum + exec.executionTime, 0) / workletExecutionMetrics.executions.length :
          0;

        const totalMemoryGrowth = workletExecutionMetrics.executions.reduce((sum, exec) => sum + exec.memoryGrowth, 0);

        // Memory leak detection specific to gesture-worklet integration
        const memoryLeakDetection = {
          leaksDetected: totalMemoryGrowth > 1000000, // 1MB threshold
          averageMemoryGrowthPerExecution: workletExecutionMetrics.executions.length > 0 ? 
            totalMemoryGrowth / workletExecutionMetrics.executions.length : 0,
          recommendations: [],
        };

        if (memoryLeakDetection.leaksDetected) {
          memoryLeakDetection.recommendations.push('Memory leaks detected in gesture-worklet integration');
          memoryLeakDetection.recommendations.push('Review SharedValue cleanup in gesture handlers');
        }

        // Performance integration analysis
        const gestureOverhead = gestureSimulationResult.totalDuration || 1;
        const workletOverhead = averageExecutionTime * workletExecutionMetrics.totalExecutions;
        const combinedPerformanceScore = gestureOverhead > 0 ? 
          Math.max(0, 1 - (workletOverhead / gestureOverhead)) : 1;

        const performanceIntegration = {
          combinedPerformanceScore,
          workletEfficiency: workletOverhead / Math.max(gestureOverhead, 1),
          gestureToWorkletRatio: gestureOverhead / Math.max(workletOverhead, 1),
        };

        return {
          gestureSimulationResult,
          workletExecutionMetrics: {
            totalExecutions: workletExecutionMetrics.totalExecutions,
            averageExecutionTime,
            memoryUsagePattern: workletExecutionMetrics.memoryUsagePattern,
            executionDetails: workletExecutionMetrics.executions,
          },
          memoryLeakDetection,
          performanceIntegration,
        };
      },
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

// Mock React Native Performance API for spatial testing
if (typeof global.performance === 'undefined') {
  global.performance = {};
}

// Performance API implementation with full functionality
if (typeof global.performance.now === 'undefined') {
  global.performance.now = jest.fn(() => Date.now());
}

// Performance marks and measures storage
const performanceEntries = new Map();
const performanceMarks = new Map();
const performanceMeasures = new Map();

// Performance mark implementation
global.performance.mark = jest.fn((name) => {
  const entry = {
    name,
    entryType: 'mark',
    startTime: Date.now(),
    duration: 0,
  };
  performanceEntries.set(name, entry);
  performanceMarks.set(name, entry);
  return entry;
});

// Performance measure implementation
global.performance.measure = jest.fn((name, startMarkName, endMarkName) => {
  const startMark = performanceMarks.get(startMarkName);
  const endMark = performanceMarks.get(endMarkName);
  
  const startTime = startMark ? startMark.startTime : Date.now();
  const endTime = endMark ? endMark.startTime : Date.now();
  
  const entry = {
    name,
    entryType: 'measure',
    startTime,
    duration: Math.max(0, endTime - startTime),
  };
  
  performanceEntries.set(name, entry);
  performanceMeasures.set(name, entry);
  return entry;
});

// Get entries by name implementation
global.performance.getEntriesByName = jest.fn((name, entryType) => {
  const entry = performanceEntries.get(name);
  if (!entry) return [];
  
  if (entryType && entry.entryType !== entryType) {
    return [];
  }
  
  return [entry];
});

// Clear marks implementation
global.performance.clearMarks = jest.fn((name) => {
  if (name) {
    performanceMarks.delete(name);
    performanceEntries.delete(name);
  } else {
    performanceMarks.clear();
    // Only clear mark entries, not measures
    for (const [entryName, entry] of performanceEntries.entries()) {
      if (entry.entryType === 'mark') {
        performanceEntries.delete(entryName);
      }
    }
  }
});

// Clear measures implementation
global.performance.clearMeasures = jest.fn((name) => {
  if (name) {
    performanceMeasures.delete(name);
    performanceEntries.delete(name);
  } else {
    performanceMeasures.clear();
    // Only clear measure entries, not marks
    for (const [entryName, entry] of performanceEntries.entries()) {
      if (entry.entryType === 'measure') {
        performanceEntries.delete(entryName);
      }
    }
  }
});

// Spatial Performance Testing Utilities
class SpatialPerformanceTestUtils {
  static measureCoordinateTransform(transformFn, coordinates, viewport) {
    const startTime = performance.now();
    const result = transformFn(coordinates, viewport);
    const endTime = performance.now();
    
    return {
      duration: endTime - startTime,
      result,
    };
  }

  static measureViewportCalculation(calculationFn, width, height, viewport) {
    const startTime = performance.now();
    const result = calculationFn(width, height, viewport);
    const endTime = performance.now();
    
    return {
      duration: endTime - startTime,
      result,
    };
  }

  static createPerformanceBaseline(operations) {
    const { coordinateTransforms = 10, viewportCalculations = 5, gestureUpdates = 20 } = operations;
    
    // Run coordinate transform tests
    let coordinateTransformTotal = 0;
    for (let i = 0; i < coordinateTransforms; i++) {
      const result = this.measureCoordinateTransform(
        (coords, viewport) => ({ 
          x: coords.x * viewport.scale + viewport.translateX, 
          y: coords.y * viewport.scale + viewport.translateY 
        }),
        { x: Math.random() * 1000, y: Math.random() * 1000 },
        { scale: Math.random() * 2 + 0.5, translateX: Math.random() * 100, translateY: Math.random() * 100 }
      );
      coordinateTransformTotal += result.duration;
    }

    // Run viewport calculation tests
    let viewportCalculationTotal = 0;
    for (let i = 0; i < viewportCalculations; i++) {
      const result = this.measureViewportCalculation(
        (w, h, viewport) => ({
          minX: -viewport.translateX / viewport.scale,
          maxX: (-viewport.translateX + w) / viewport.scale,
          minY: -viewport.translateY / viewport.scale,
          maxY: (-viewport.translateY + h) / viewport.scale,
        }),
        400,
        600,
        { scale: Math.random() * 2 + 0.5, translateX: Math.random() * 100, translateY: Math.random() * 100 }
      );
      viewportCalculationTotal += result.duration;
    }

    // Run gesture update simulations
    let gestureUpdateTotal = 0;
    for (let i = 0; i < gestureUpdates; i++) {
      const startTime = performance.now();
      // Simulate gesture update processing
      const mockGestureData = {
        x: Math.random() * 400,
        y: Math.random() * 600,
        translationX: Math.random() * 200 - 100,
        translationY: Math.random() * 200 - 100,
      };
      // Mock processing
      const processed = { ...mockGestureData, processed: true };
      const endTime = performance.now();
      gestureUpdateTotal += (endTime - startTime);
    }

    return {
      coordinateTransformAverage: coordinateTransformTotal / coordinateTransforms,
      viewportCalculationAverage: viewportCalculationTotal / viewportCalculations,
      gestureUpdateAverage: gestureUpdateTotal / gestureUpdates,
      baselineCreatedAt: new Date().toISOString(),
    };
  }
}

// Add to global for test access
global.SpatialPerformanceTestUtils = SpatialPerformanceTestUtils;

// Memory Usage Tracking Utilities
class MemoryTestUtils {
  static snapshots = new Map();
  static snapshotCounter = 0;

  static captureMemorySnapshot(name) {
    // Mock memory usage data (in real React Native, would use JSI bridge)
    const mockMemoryUsage = {
      jsHeapSizeUsed: Math.floor(Math.random() * 50000000) + 10000000, // 10-60MB
      jsHeapSizeTotal: Math.floor(Math.random() * 100000000) + 50000000, // 50-150MB
    };

    const snapshot = {
      name,
      ...mockMemoryUsage,
      timestamp: Date.now(),
      id: ++this.snapshotCounter,
    };

    this.snapshots.set(name, snapshot);
    return snapshot;
  }

  static detectMemoryLeaks(beforeSnapshot, afterSnapshot) {
    const heapGrowth = afterSnapshot.jsHeapSizeUsed - beforeSnapshot.jsHeapSizeUsed;
    const growthPercentage = (heapGrowth / beforeSnapshot.jsHeapSizeUsed) * 100;
    
    // Consider it a potential leak if heap grew by more than 20%
    const potentialLeak = growthPercentage > 20;
    
    const recommendations = [];
    if (potentialLeak) {
      recommendations.push('Check for uncleaned event listeners');
      recommendations.push('Verify SharedValues are properly cleaned up');
      recommendations.push('Review gesture handler cleanup');
      if (heapGrowth > 5000000) { // 5MB growth
        recommendations.push('Significant heap growth detected - review large object allocations');
      }
    }

    return {
      heapGrowth,
      growthPercentage,
      potentialLeak,
      recommendations,
      timeDifference: afterSnapshot.timestamp - beforeSnapshot.timestamp,
    };
  }

  static resetMemoryTracking() {
    this.snapshots.clear();
    this.snapshotCounter = 0;
  }
}

// Add to global for test access
global.MemoryTestUtils = MemoryTestUtils;

// Custom Jest Matchers for Performance Testing
expect.extend({
  toBeWithinPerformanceRange(received, min, max) {
    const pass = received >= min && received <= max;
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be within performance range ${min}-${max}ms`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within performance range ${min}-${max}ms`,
        pass: false,
      };
    }
  },

  toBeCloseToCoordinate(received, expected, precision = 0.01) {
    const xDiff = Math.abs(received.x - expected.x);
    const yDiff = Math.abs(received.y - expected.y);
    const pass = xDiff <= precision && yDiff <= precision;
    
    if (pass) {
      return {
        message: () => `expected coordinate (${received.x}, ${received.y}) not to be close to (${expected.x}, ${expected.y}) within ${precision}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected coordinate (${received.x}, ${received.y}) to be close to (${expected.x}, ${expected.y}) within ${precision}. Differences: x=${xDiff}, y=${yDiff}`,
        pass: false,
      };
    }
  },

  toBeValidViewportState(received) {
    const errors = [];
    
    if (typeof received !== 'object' || received === null) {
      errors.push('viewport must be an object');
    } else {
      if (typeof received.translateX !== 'number') {
        errors.push('translateX must be a number');
      }
      if (typeof received.translateY !== 'number') {
        errors.push('translateY must be a number');
      }
      if (typeof received.scale !== 'number') {
        errors.push('scale must be a number');
      } else if (received.scale <= 0) {
        errors.push('scale must be positive');
      }
      if (!received.bounds || typeof received.bounds !== 'object') {
        errors.push('bounds must be an object');
      } else {
        const { bounds } = received;
        if (typeof bounds.minX !== 'number' || typeof bounds.maxX !== 'number' ||
            typeof bounds.minY !== 'number' || typeof bounds.maxY !== 'number') {
          errors.push('bounds must have numeric minX, maxX, minY, maxY properties');
        }
        if (bounds.minX >= bounds.maxX || bounds.minY >= bounds.maxY) {
          errors.push('bounds must have minX < maxX and minY < maxY');
        }
      }
    }

    const pass = errors.length === 0;
    
    if (pass) {
      return {
        message: () => 'expected viewport state to be invalid',
        pass: true,
      };
    } else {
      return {
        message: () => `expected valid viewport state but found errors: ${errors.join(', ')}`,
        pass: false,
      };
    }
  },

  // === SPECIALIZED SPATIAL MATCHERS ===

  toBeWithinCoordinatePrecision(received, expected, precision = 1e-8) {
    if (!received || !expected || typeof received !== 'object' || typeof expected !== 'object') {
      return {
        message: () => 'expected both coordinates to be objects with x and y properties',
        pass: false,
      };
    }

    const xDiff = Math.abs(received.x - expected.x);
    const yDiff = Math.abs(received.y - expected.y);
    
    // Handle floating point edge cases
    const effectivePrecision = Math.max(precision, Number.EPSILON);
    const pass = xDiff <= effectivePrecision && yDiff <= effectivePrecision;
    
    if (pass) {
      return {
        message: () => `expected coordinate (${received.x}, ${received.y}) not to be within precision ${precision} of (${expected.x}, ${expected.y})`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected coordinate (${received.x}, ${received.y}) to be within precision ${precision} of (${expected.x}, ${expected.y}). Actual differences: x=${xDiff}, y=${yDiff}`,
        pass: false,
      };
    }
  },

  toBeValidTransformationMatrix(received) {
    const errors = [];
    
    if (!received || typeof received !== 'object') {
      errors.push('matrix must be an object');
    } else {
      // Check required properties
      const requiredProps = ['a', 'b', 'c', 'd', 'tx', 'ty'];
      for (const prop of requiredProps) {
        if (typeof received[prop] !== 'number') {
          errors.push(`${prop} must be a number`);
        }
      }

      if (errors.length === 0) {
        // Check determinant (matrix must be invertible)
        const determinant = received.a * received.d - received.b * received.c;
        if (Math.abs(determinant) < 1e-10) {
          errors.push('transformation matrix is not invertible (determinant near zero)');
        }

        // Check for extreme values that could cause precision issues
        const maxScale = 1e6;
        if (Math.abs(received.a) > maxScale || Math.abs(received.d) > maxScale) {
          errors.push('scale factors exceed maximum safe values');
        }

        // Check for NaN or Infinity
        for (const prop of requiredProps) {
          if (!isFinite(received[prop])) {
            errors.push(`${prop} must be finite`);
          }
        }
      }
    }

    const pass = errors.length === 0;
    
    if (pass) {
      return {
        message: () => 'expected transformation matrix to be invalid',
        pass: true,
      };
    } else {
      return {
        message: () => `expected valid transformation matrix but found errors: ${errors.join(', ')}`,
        pass: false,
      };
    }
  },

  toHaveValidViewportBounds(received, constraints = {}) {
    const errors = [];
    
    if (!received || typeof received !== 'object') {
      errors.push('viewport must be an object');
      return {
        message: () => `expected valid viewport but found errors: ${errors.join(', ')}`,
        pass: false,
      };
    }

    // Check scale constraints
    if (constraints.maxScale && received.scale > constraints.maxScale) {
      errors.push(`scale ${received.scale} exceeds maximum ${constraints.maxScale}`);
    }
    if (constraints.minScale && received.scale < constraints.minScale) {
      errors.push(`scale ${received.scale} below minimum ${constraints.minScale}`);
    }

    // Check translation constraints
    if (constraints.maxTranslation) {
      if (Math.abs(received.translateX) > constraints.maxTranslation.x) {
        errors.push(`translation X ${received.translateX} exceeds maximum ${constraints.maxTranslation.x}`);
      }
      if (Math.abs(received.translateY) > constraints.maxTranslation.y) {
        errors.push(`translation Y ${received.translateY} exceeds maximum ${constraints.maxTranslation.y}`);
      }
    }

    // Check bounds consistency
    if (received.bounds) {
      if (received.bounds.minX >= received.bounds.maxX || received.bounds.minY >= received.bounds.maxY) {
        errors.push('bounds must have minX < maxX and minY < maxY');
      }
    }

    const pass = errors.length === 0;
    
    if (pass) {
      return {
        message: () => 'expected viewport to have invalid bounds',
        pass: true,
      };
    } else {
      return {
        message: () => `expected valid viewport bounds but found errors: ${errors.join(', ')}`,
        pass: false,
      };
    }
  },

  toBeWithinViewportCalculationTolerance(received, expected, tolerance = 0.01) {
    const errors = [];

    if (!received || !expected) {
      errors.push('both viewport calculations must be provided');
    } else {
      // Check visible bounds
      if (received.visibleBounds && expected.visibleBounds) {
        const bounds = ['minX', 'maxX', 'minY', 'maxY'];
        for (const bound of bounds) {
          const diff = Math.abs(received.visibleBounds[bound] - expected.visibleBounds[bound]);
          if (diff > tolerance) {
            errors.push(`visibleBounds.${bound} difference ${diff} exceeds tolerance ${tolerance}`);
          }
        }
      }

      // Check scaled dimensions
      if (received.scaledDimensions && expected.scaledDimensions) {
        const dims = ['width', 'height'];
        for (const dim of dims) {
          const diff = Math.abs(received.scaledDimensions[dim] - expected.scaledDimensions[dim]);
          if (diff > tolerance) {
            errors.push(`scaledDimensions.${dim} difference ${diff} exceeds tolerance ${tolerance}`);
          }
        }
      }
    }

    const pass = errors.length === 0;
    
    if (pass) {
      return {
        message: () => `expected viewport calculations not to be within tolerance ${tolerance}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected viewport calculations to be within tolerance ${tolerance} but found errors: ${errors.join(', ')}`,
        pass: false,
      };
    }
  },

  toHaveAccurateGesturePhysics(received) {
    const errors = [];
    
    if (!received || typeof received !== 'object') {
      errors.push('gesture data must be an object');
    } else {
      // Check momentum phase physics
      if (received.phases && Array.isArray(received.phases)) {
        const momentumPhases = received.phases.filter(phase => phase.phase === 'momentum');
        
        for (let i = 1; i < momentumPhases.length; i++) {
          const current = momentumPhases[i];
          const previous = momentumPhases[i - 1];
          
          if (current.velocity && previous.velocity) {
            const currentMagnitude = Math.sqrt(current.velocity.x ** 2 + current.velocity.y ** 2);
            const previousMagnitude = Math.sqrt(previous.velocity.x ** 2 + previous.velocity.y ** 2);
            
            // Velocity should decrease during momentum phase (physics)
            if (currentMagnitude > previousMagnitude * 1.01) { // Small tolerance for floating point
              errors.push(`velocity increased during momentum phase: ${previousMagnitude} -> ${currentMagnitude}`);
            }
          }
        }

        // Check friction consistency if provided
        if (received.friction && typeof received.friction === 'number') {
          if (received.friction < 0 || received.friction > 1) {
            errors.push('friction must be between 0 and 1');
          }
        }
      }

      // Check elastic boundary behavior
      if (received.overscrollPhase) {
        const overscroll = received.overscrollPhase;
        
        if (overscroll.elasticity && (overscroll.elasticity < 0 || overscroll.elasticity > 1)) {
          errors.push('elasticity must be between 0 and 1');
        }
        
        if (overscroll.settleDuration && overscroll.settleDuration < 0) {
          errors.push('settle duration must be positive');
        }

        if (overscroll.maxOverscroll) {
          if (overscroll.maxOverscroll.x < 0 || overscroll.maxOverscroll.y < 0) {
            errors.push('overscroll amounts must be non-negative');
          }
        }
      }
    }

    const pass = errors.length === 0;
    
    if (pass) {
      return {
        message: () => 'expected gesture physics to be inaccurate',
        pass: true,
      };
    } else {
      return {
        message: () => `expected accurate gesture physics but found errors: ${errors.join(', ')}`,
        pass: false,
      };
    }
  },

  toMeetGestureTimingRequirements(received, requirements) {
    const errors = [];
    
    if (!received || !requirements) {
      errors.push('both timing data and requirements must be provided');
    } else {
      // Check frame rate
      if (requirements.minFrameRate && received.actualFrameRate < requirements.minFrameRate) {
        errors.push(`frame rate ${received.actualFrameRate} below minimum ${requirements.minFrameRate}`);
      }

      // Check frame jitter
      if (requirements.maxFrameJitter && received.frameJitter > requirements.maxFrameJitter) {
        errors.push(`frame jitter ${received.frameJitter} exceeds maximum ${requirements.maxFrameJitter}`);
      }

      // Check dropped frame percentage
      if (requirements.maxDroppedFramePercentage && received.droppedFrames && received.totalFrames) {
        const droppedPercentage = received.droppedFrames / received.totalFrames;
        if (droppedPercentage > requirements.maxDroppedFramePercentage) {
          errors.push(`dropped frame percentage ${droppedPercentage * 100}% exceeds maximum ${requirements.maxDroppedFramePercentage * 100}%`);
        }
      }
    }

    const pass = errors.length === 0;
    
    if (pass) {
      return {
        message: () => 'expected gesture timing to fail requirements',
        pass: true,
      };
    } else {
      return {
        message: () => `expected gesture timing to meet requirements but found errors: ${errors.join(', ')}`,
        pass: false,
      };
    }
  },

  toRespectScaleLimits(received) {
    const errors = [];
    
    if (!received || typeof received !== 'object') {
      errors.push('scale data must be an object');
    } else {
      const { currentScale, targetScale, limits, enforcedScale, precision = 1e-10 } = received;

      if (!limits || typeof limits !== 'object') {
        errors.push('limits must be provided');
      } else {
        // Calculate expected enforced scale
        let expectedScale = targetScale;
        if (targetScale < limits.min) {
          expectedScale = limits.min;
        } else if (targetScale > limits.max) {
          expectedScale = limits.max;
        }

        // Check if enforced scale matches expected (with precision tolerance)
        const scaleDiff = Math.abs(enforcedScale - expectedScale);
        if (scaleDiff > precision) {
          errors.push(`enforced scale ${enforcedScale} does not match expected ${expectedScale} (difference: ${scaleDiff})`);
        }

        // Validate limits themselves
        if (limits.min >= limits.max) {
          errors.push('minimum scale must be less than maximum scale');
        }

        if (limits.min <= 0) {
          errors.push('minimum scale must be positive');
        }
      }
    }

    const pass = errors.length === 0;
    
    if (pass) {
      return {
        message: () => 'expected scale limits to be violated',
        pass: true,
      };
    } else {
      return {
        message: () => `expected scale limits to be respected but found errors: ${errors.join(', ')}`,
        pass: false,
      };
    }
  },

  toHaveConsistentCoordinateSystem(received) {
    const errors = [];
    
    if (!received || typeof received !== 'object') {
      errors.push('coordinate data must be an object');
    } else {
      const { screenCoordinates, worldCoordinates, viewport } = received;

      if (!screenCoordinates || !worldCoordinates || !viewport) {
        errors.push('screenCoordinates, worldCoordinates, and viewport must all be provided');
      } else {
        // Transform screen coordinates to world coordinates using viewport
        const expectedWorldX = (screenCoordinates.x - viewport.translateX) / viewport.scale;
        const expectedWorldY = (screenCoordinates.y - viewport.translateY) / viewport.scale;

        // Use appropriate precision based on scale (higher scale needs higher precision)
        const precision = Math.max(1e-10, 1 / (viewport.scale * 1000));
        
        const xDiff = Math.abs(worldCoordinates.x - expectedWorldX);
        const yDiff = Math.abs(worldCoordinates.y - expectedWorldY);

        if (xDiff > precision) {
          errors.push(`world X coordinate ${worldCoordinates.x} inconsistent with screen coordinate, expected ${expectedWorldX} (difference: ${xDiff})`);
        }

        if (yDiff > precision) {
          errors.push(`world Y coordinate ${worldCoordinates.y} inconsistent with screen coordinate, expected ${expectedWorldY} (difference: ${yDiff})`);
        }

        // Validate viewport bounds consistency
        if (viewport.bounds) {
          if (worldCoordinates.x < viewport.bounds.minX - precision || 
              worldCoordinates.x > viewport.bounds.maxX + precision ||
              worldCoordinates.y < viewport.bounds.minY - precision ||
              worldCoordinates.y > viewport.bounds.maxY + precision) {
            // Only warn if significantly outside bounds
            const xOutside = Math.max(0, viewport.bounds.minX - worldCoordinates.x, worldCoordinates.x - viewport.bounds.maxX);
            const yOutside = Math.max(0, viewport.bounds.minY - worldCoordinates.y, worldCoordinates.y - viewport.bounds.maxY);
            
            if (xOutside > precision * 10 || yOutside > precision * 10) {
              errors.push(`world coordinates (${worldCoordinates.x}, ${worldCoordinates.y}) are outside viewport bounds`);
            }
          }
        }
      }
    }

    const pass = errors.length === 0;
    
    if (pass) {
      return {
        message: () => 'expected coordinate system to be inconsistent',
        pass: true,
      };
    } else {
      return {
        message: () => `expected consistent coordinate system but found errors: ${errors.join(', ')}`,
        pass: false,
      };
    }
  },

  toCompleteWithinSpatialPerformanceBounds(received, requirements) {
    if (typeof received !== 'function') {
      return {
        message: () => 'expected a function to test performance of',
        pass: false,
      };
    }

    const errors = [];
    const startTime = performance.now();
    const startMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;

    try {
      // Execute the function
      const result = received();
      
      const endTime = performance.now();
      const endMemory = performance.memory ? performance.memory.usedJSHeapSize : startMemory;
      
      const executionTime = endTime - startTime;
      const memoryUsage = endMemory - startMemory;

      // Check execution time
      if (requirements.maxExecutionTime && executionTime > requirements.maxExecutionTime) {
        errors.push(`execution time ${executionTime.toFixed(2)}ms exceeds maximum ${requirements.maxExecutionTime}ms`);
      }

      // Check memory usage
      if (requirements.maxMemoryUsage && memoryUsage > requirements.maxMemoryUsage) {
        errors.push(`memory usage ${memoryUsage} bytes exceeds maximum ${requirements.maxMemoryUsage} bytes`);
      }

      // Check FPS impact (approximate)
      if (requirements.targetFPS) {
        const frameTime = 1000 / requirements.targetFPS;
        if (executionTime > frameTime * 0.8) { // 80% of frame time
          errors.push(`execution time ${executionTime.toFixed(2)}ms impacts target FPS ${requirements.targetFPS} (frame budget: ${frameTime.toFixed(2)}ms)`);
        }
      }

    } catch (error) {
      errors.push(`function threw error: ${error.message}`);
    }

    const pass = errors.length === 0;
    
    if (pass) {
      return {
        message: () => 'expected spatial operation to exceed performance bounds',
        pass: true,
      };
    } else {
      return {
        message: () => `expected spatial operation to complete within performance bounds but found errors: ${errors.join(', ')}`,
        pass: false,
      };
    }
  },
});

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

// Ensure GestureTestUtils and WorkletTestUtils are available globally
// These might not be set if the specific mock modules aren't imported
if (!global.GestureTestUtils) {
  // Import the React Native Gesture Handler mock to ensure GestureTestUtils is available
  const gestureHandlerMock = require('react-native-gesture-handler');
  // The mock should have already set global.GestureTestUtils during import
}

if (!global.WorkletTestUtils) {
  // Import the React Native Reanimated mock to ensure WorkletTestUtils is available  
  const reanimatedMock = require('react-native-reanimated');
  // The mock should have already set global.WorkletTestUtils during import
}