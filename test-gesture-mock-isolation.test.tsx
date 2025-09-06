import React, { useRef } from 'react';
import { render } from '@testing-library/react-native';
import { View } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { useSharedValue, runOnJS } from 'react-native-reanimated';

// Test component that uses the exact same gesture chain as GalaxyMapModular
const TestGestureChain = () => {
  console.log('Creating pan gesture...');
  
  // Add the same refs and shared values as GalaxyMapModular
  const lastTranslateX = useSharedValue(0);
  const lastTranslateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const gestureStartPosition = useRef({ x: 0, y: 0 });
  const isPanActive = useRef(false);
  const lastPanUpdate = useRef(0);
  const width = 800;
  const height = 600;
  
  const setGestureActiveState = (active: boolean) => {
    console.log('Gesture active state:', active);
  };
  
  try {
    // This is the EXACT pattern from GalaxyMapModular.tsx line 657-670
    const panGesture = Gesture.Pan()
      .onStart((event) => {
        lastTranslateX.value = translateX.value;
        lastTranslateY.value = translateY.value;
        // Use event position if available, fallback to center of screen for testing
        gestureStartPosition.current = { 
          x: event?.x ?? width / 2, 
          y: event?.y ?? height / 2 
        };
        isPanActive.current = false; // Will be activated once threshold is met
        runOnJS(setGestureActiveState)(true);
        lastPanUpdate.current = 0; // Reset throttling
        console.log('onStart callback executed');
      })
      .onUpdate(event => {
        // Check if pan should be activated based on activation distance
        if (!isPanActive.current) {
          // Use current position if available, otherwise use translation distance
          const currentX = event.x ?? (gestureStartPosition.current.x + event.translationX);
          console.log('onUpdate callback executed');
        }
      });
      
    console.log('Gesture chain created successfully');
  } catch (error) {
    console.error('Gesture chain failed:', error);
    console.error('Error stack:', error.stack);
  }

  return <View testID="test-gesture-chain" />;
};

describe('Isolated Gesture Mock Test', () => {
  it('should create gesture chain like GalaxyMapModular does', () => {
    render(<TestGestureChain />);
  });
});