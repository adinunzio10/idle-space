import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { GestureHandlerRootView, PanGestureHandler, PinchGestureHandler, State } from 'react-native-gesture-handler';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  useAnimatedGestureHandler,
  runOnJS,
  interpolate,
  Extrapolate
} from 'react-native-reanimated';

interface GestureEvent {
  nativeEvent: {
    translationX: number;
    translationY: number;
    scale: number;
    state: State;
  };
}

export const JSICrashTester: React.FC = () => {
  const [crashLog, setCrashLog] = useState<string[]>([]);
  const [testRunning, setTestRunning] = useState(false);

  // Shared values that might cause JSI issues
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  
  // Complex shared value that might cause serialization issues
  const complexSharedValue = useSharedValue({
    nested: { data: 'test' },
    array: [1, 2, 3]
  });

  const logCrashEvent = (message: string) => {
    console.log(`[JSI CRASH TEST]: ${message}`);
    setCrashLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const onPanGestureEvent = useAnimatedGestureHandler({
    onStart: () => {
      'worklet';
      // This might cause JSI issues with complex objects
      try {
        console.log('Pan started with complex value:', complexSharedValue.value);
      } catch (e) {
        runOnJS(logCrashEvent)('Pan gesture JSI error: ' + String(e));
      }
    },
    onActive: (event: GestureEvent) => {
      'worklet';
      translateX.value = event.translationX;
      translateY.value = event.translationY;
      
      // Rapid SharedValue mutations that might cause crashes
      rotation.value = interpolate(
        event.translationX,
        [-200, 200],
        [-Math.PI, Math.PI],
        Extrapolate.CLAMP
      );
    },
    onEnd: () => {
      'worklet';
      try {
        // Rapid value resets that might trigger JSI issues
        translateX.value = 0;
        translateY.value = 0;
        rotation.value = 0;
      } catch (e) {
        runOnJS(logCrashEvent)('Pan end JSI error: ' + String(e));
      }
    },
  });

  const onPinchGestureEvent = useAnimatedGestureHandler({
    onActive: (event: { scale: number }) => {
      'worklet';
      try {
        scale.value = event.scale;
        
        // Complex worklet operations that might cause crashes
        const complexCalculation = Math.pow(event.scale, 2) * Math.sin(rotation.value);
        
        // Attempting to access/modify complex shared values in worklet
        if (complexSharedValue.value && typeof complexSharedValue.value === 'object') {
          // This might cause serialization issues
          complexSharedValue.value = {
            ...complexSharedValue.value,
            dynamic: complexCalculation
          };
        }
      } catch (e) {
        runOnJS(logCrashEvent)('Pinch gesture JSI error: ' + String(e));
      }
    },
    onEnd: () => {
      'worklet';
      scale.value = 1;
    },
  });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
        { rotate: `${rotation.value}rad` },
      ],
    };
  });

  const startCrashTest = () => {
    setTestRunning(true);
    setCrashLog([]);
    logCrashEvent('Starting JSI crash reproduction test');
    
    // Simulate rapid gesture events that might cause crashes
    setTimeout(() => {
      logCrashEvent('Test phase 1: Rapid SharedValue mutations');
      
      // Rapid-fire updates to shared values
      for (let i = 0; i < 100; i++) {
        setTimeout(() => {
          translateX.value = Math.random() * 200 - 100;
          translateY.value = Math.random() * 200 - 100;
          scale.value = 0.5 + Math.random();
          rotation.value = Math.random() * Math.PI * 2;
          
          // Attempt to update complex object in SharedValue
          try {
            complexSharedValue.value = {
              nested: { data: `test-${i}` },
              array: [i, i + 1, i + 2],
              timestamp: Date.now()
            };
          } catch (e) {
            logCrashEvent(`Complex value update error at iteration ${i}: ${e}`);
          }
        }, i * 10);
      }
    }, 1000);

    // Stop test after 5 seconds
    setTimeout(() => {
      setTestRunning(false);
      logCrashEvent('JSI crash test completed');
      Alert.alert('Test Complete', 'Check console and logs for any JSI-related crashes');
    }, 5000);
  };

  return (
    <View className="flex-1 bg-background p-4">
      <Text className="text-text text-xl font-bold mb-4">JSI Crash Testing</Text>
      
      <TouchableOpacity
        onPress={startCrashTest}
        disabled={testRunning}
        className={`${testRunning ? 'bg-gray-500' : 'bg-red-500'} px-4 py-3 rounded-lg mb-4`}
      >
        <Text className="text-white font-semibold text-center">
          {testRunning ? 'Running Crash Test...' : 'Start JSI Crash Test'}
        </Text>
      </TouchableOpacity>

      <Text className="text-text text-sm mb-2">
        Instructions: Use gestures on the box below to trigger potential JSI crashes
      </Text>

      <GestureHandlerRootView className="flex-1">
        <PinchGestureHandler onGestureEvent={onPinchGestureEvent}>
          <Animated.View>
            <PanGestureHandler onGestureEvent={onPanGestureEvent}>
              <Animated.View
                style={[animatedStyle]}
                className="w-32 h-32 bg-primary rounded-lg items-center justify-center mx-auto my-8"
              >
                <Text className="text-white font-semibold">Test Box</Text>
                <Text className="text-white text-xs">Pan & Pinch</Text>
              </Animated.View>
            </PanGestureHandler>
          </Animated.View>
        </PinchGestureHandler>
      </GestureHandlerRootView>

      <View className="bg-surface rounded-lg p-3 max-h-32">
        <Text className="text-text font-semibold mb-2">Crash Log:</Text>
        <View className="flex-1">
          {crashLog.map((log, index) => (
            <Text key={index} className="text-text/80 text-xs">
              {log}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
};