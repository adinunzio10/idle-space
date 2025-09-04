/**
 * Worklet Context Simulator Validation Tests
 * 
 * Tests to verify that our worklet execution context simulator properly
 * handles worklet execution, shared values, and runOnJS calls without JSI errors.
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { 
  useSharedValue, 
  useAnimatedStyle, 
  useAnimatedGestureHandler,
  runOnJS,
  worklet,
  interpolate,
  withTiming,
  withSpring,
} from 'react-native-reanimated';

// Access global worklet test utilities
const WorkletTestUtils = global.WorkletTestUtils;

describe('Worklet Context Simulator Validation', () => {
  beforeEach(() => {
    // Reset worklet context before each test
    if (WorkletTestUtils) {
      WorkletTestUtils.resetContext();
    }
  });

  describe('useSharedValue Hook', () => {
    it('should create shared value with initial value', () => {
      const { result } = renderHook(() => useSharedValue(10));
      
      expect(result.current).toBeDefined();
      expect(result.current.value).toBe(10);
    });

    it('should allow shared value mutation', () => {
      const { result } = renderHook(() => useSharedValue(5));
      
      act(() => {
        result.current.value = 15;
      });
      
      expect(result.current.value).toBe(15);
    });

    it('should provide modify method', () => {
      const { result } = renderHook(() => useSharedValue(20));
      
      act(() => {
        result.current.modify((value) => value * 2);
      });
      
      expect(result.current.value).toBe(40);
    });

    it('should have listener methods', () => {
      const { result } = renderHook(() => useSharedValue(0));
      
      expect(typeof result.current.addListener).toBe('function');
      expect(typeof result.current.removeListener).toBe('function');
    });
  });

  describe('runOnJS Function', () => {
    it('should create callable function', () => {
      const jsCallback = jest.fn();
      const runOnJSCallback = runOnJS(jsCallback);
      
      expect(typeof runOnJSCallback).toBe('function');
    });

    it('should queue and execute JS callbacks', (done) => {
      const jsCallback = jest.fn((value) => {
        expect(value).toBe('test-value');
        expect(jsCallback).toHaveBeenCalledWith('test-value');
        done();
      });
      
      const runOnJSCallback = runOnJS(jsCallback);
      runOnJSCallback('test-value');
    });

    it('should handle multiple queued callbacks', (done) => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      const runOnJS1 = runOnJS(callback1);
      const runOnJS2 = runOnJS(callback2);
      
      runOnJS1('value1');
      runOnJS2('value2');
      
      // Check after async execution
      setTimeout(() => {
        expect(callback1).toHaveBeenCalledWith('value1');
        expect(callback2).toHaveBeenCalledWith('value2');
        done();
      }, 10);
    });
  });

  describe('worklet Function', () => {
    it('should create worklet from function', () => {
      const originalFn = (x, y) => x + y;
      const workletFn = worklet(originalFn);
      
      expect(typeof workletFn).toBe('function');
      expect(workletFn._isWorklet).toBe(true);
      expect(workletFn._originalFn).toBe(originalFn);
    });

    it('should execute worklet in simulated context', () => {
      const workletFn = worklet((value) => {
        return value * 2;
      });
      
      const result = workletFn(5);
      expect(result).toBe(10);
    });

    it('should handle worklet execution errors gracefully', () => {
      const workletFn = worklet(() => {
        throw new Error('Test error');
      });
      
      const result = workletFn();
      expect(result).toBeUndefined();
    });
  });

  describe('useAnimatedStyle Hook', () => {
    it('should return empty object for undefined style worklet', () => {
      const { result } = renderHook(() => useAnimatedStyle(null));
      expect(result.current).toEqual({});
    });

    it('should execute style worklet and return result', () => {
      const styleWorklet = () => ({
        transform: [{ translateX: 100 }],
      });
      
      const { result } = renderHook(() => useAnimatedStyle(styleWorklet));
      
      expect(result.current).toEqual({
        transform: [{ translateX: 100 }],
      });
    });

    it('should handle style worklet errors gracefully', () => {
      const styleWorklet = () => {
        throw new Error('Style error');
      };
      
      const { result } = renderHook(() => useAnimatedStyle(styleWorklet));
      expect(result.current).toEqual({});
    });

    it('should respond to dependency changes', () => {
      let multiplier = 1;
      
      const { result, rerender } = renderHook(() => 
        useAnimatedStyle(() => ({
          opacity: multiplier * 0.5,
        }), [multiplier])
      );
      
      expect(result.current.opacity).toBe(0.5);
      
      multiplier = 2;
      rerender();
      
      expect(result.current.opacity).toBe(1);
    });
  });

  describe('useAnimatedGestureHandler Hook', () => {
    it('should wrap gesture handlers with worklet context', () => {
      const onStart = jest.fn();
      const onActive = jest.fn();
      const onEnd = jest.fn();
      
      const handlers = {
        onStart: worklet((event) => {
          onStart(event.translationX);
        }),
        onActive: worklet((event) => {
          onActive(event.translationY);
        }),
        onEnd: worklet((event) => {
          onEnd(event.state);
        }),
      };
      
      const { result } = renderHook(() => useAnimatedGestureHandler(handlers));
      
      expect(result.current).toBeDefined();
      expect(typeof result.current.onStart).toBe('function');
      expect(typeof result.current.onActive).toBe('function');
      expect(typeof result.current.onEnd).toBe('function');
      
      // Test gesture handler execution
      const mockEvent = {
        translationX: 10,
        translationY: 20,
        state: 5, // END state
      };
      
      result.current.onStart(mockEvent);
      result.current.onActive(mockEvent);
      result.current.onEnd(mockEvent);
      
      expect(onStart).toHaveBeenCalledWith(10);
      expect(onActive).toHaveBeenCalledWith(20);
      expect(onEnd).toHaveBeenCalledWith(5);
    });
  });

  describe('Animation Functions', () => {
    describe('interpolate', () => {
      it('should perform linear interpolation', () => {
        const result = interpolate(0.5, [0, 1], [0, 100]);
        expect(result).toBe(50);
      });

      it('should handle multiple input/output ranges', () => {
        const result = interpolate(1.5, [0, 1, 2], [0, 50, 100]);
        expect(result).toBe(75);
      });

      it('should clamp values outside input range', () => {
        const result = interpolate(2, [0, 1], [0, 100]);
        expect(result).toBe(100);
        
        const resultNegative = interpolate(-1, [0, 1], [0, 100]);
        expect(resultNegative).toBe(0);
      });

      it('should handle invalid inputs gracefully', () => {
        const result = interpolate('invalid', [0, 1], [0, 100]);
        expect(result).toBe('invalid');
      });
    });

    describe('withTiming', () => {
      it('should return target value immediately', () => {
        const result = withTiming(100);
        expect(result).toBe(100);
      });

      it('should call callback asynchronously', (done) => {
        const callback = jest.fn((finished) => {
          expect(finished).toBe(true);
          expect(callback).toHaveBeenCalledWith(true);
          done();
        });
        
        withTiming(100, {}, callback);
      });
    });

    describe('withSpring', () => {
      it('should return target value immediately', () => {
        const result = withSpring(200);
        expect(result).toBe(200);
      });

      it('should call callback asynchronously', (done) => {
        const callback = jest.fn((finished) => {
          expect(finished).toBe(true);
          done();
        });
        
        withSpring(200, {}, callback);
      });
    });
  });

  describe('WorkletTestUtils Integration', () => {
    it('should have WorkletTestUtils available globally', () => {
      expect(WorkletTestUtils).toBeDefined();
      expect(WorkletTestUtils.context).toBeDefined();
      expect(typeof WorkletTestUtils.createSharedValue).toBe('function');
      expect(typeof WorkletTestUtils.runOnJS).toBe('function');
      expect(typeof WorkletTestUtils.executeWorklet).toBe('function');
      expect(typeof WorkletTestUtils.resetContext).toBe('function');
    });

    it('should create shared values through test utils', () => {
      const sharedValue = WorkletTestUtils.createSharedValue(42);
      
      expect(sharedValue).toBeDefined();
      expect(sharedValue.value).toBe(42);
      expect(sharedValue._id).toBeDefined();
    });

    it('should execute worklets through test utils', () => {
      const workletFn = (a, b) => a * b;
      const result = WorkletTestUtils.executeWorklet(workletFn, [6, 7]);
      
      expect(result).toBe(42);
    });

    it('should reset context state', () => {
      // Create some state
      const sharedValue = WorkletTestUtils.createSharedValue(10);
      WorkletTestUtils.context.setWorkletScope('test', 'value');
      
      // Reset context
      WorkletTestUtils.resetContext();
      
      // Context should be clean
      expect(WorkletTestUtils.context.jsThreadCallbacks).toEqual([]);
      expect(WorkletTestUtils.context.sharedValuesStore.size).toBe(0);
      expect(WorkletTestUtils.context.workletScope.size).toBe(0);
    });
  });
});