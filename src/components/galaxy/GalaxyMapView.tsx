import React, { useState, useCallback, useMemo } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Rect } from 'react-native-svg';

import {
  Point2D,
  ViewportState,
  GalaxyMapProps,
} from '../../types/galaxy';
import {
  screenToGalaxy,
  galaxyToScreen,
  calculateVisibleBounds,
  clampScale,
  constrainTranslation,
} from '../../utils/spatial/viewport';
import { SpatialIndex } from '../../utils/spatial/indexing';

const AnimatedSvg = Animated.createAnimatedComponent(Svg);

interface GalaxyMapViewProps extends GalaxyMapProps {
  style?: any;
}

export const GalaxyMapView: React.FC<GalaxyMapViewProps> = ({
  width,
  height,
  beacons,
  onBeaconSelect,
  onMapPress,
  style,
}) => {
  // Gesture handling shared values
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const lastScale = useSharedValue(1);
  const lastTranslateX = useSharedValue(0);
  const lastTranslateY = useSharedValue(0);

  // Viewport state management
  const [viewportState, setViewportState] = useState<ViewportState>({
    translateX: 0,
    translateY: 0,
    scale: 1,
    bounds: {
      minX: 0,
      maxX: width,
      minY: 0,
      maxY: height,
    },
  });

  // Spatial indexing for efficient beacon queries
  const spatialIndex = useMemo(() => {
    const index = new SpatialIndex(1000);
    index.rebuild(beacons);
    return index;
  }, [beacons]);

  // Update viewport state callback
  const updateViewportState = useCallback((newTranslateX: number, newTranslateY: number, newScale: number) => {
    const newViewport: ViewportState = {
      translateX: newTranslateX,
      translateY: newTranslateY,
      scale: newScale,
      bounds: calculateVisibleBounds(width, height, {
        translateX: newTranslateX,
        translateY: newTranslateY,
        scale: newScale,
        bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 }, // Will be calculated
      }),
    };
    setViewportState(newViewport);
  }, [width, height]);

  // Pan gesture
  const panGesture = Gesture.Pan()
    .onStart(() => {
      lastTranslateX.value = translateX.value;
      lastTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = lastTranslateX.value + event.translationX;
      translateY.value = lastTranslateY.value + event.translationY;
    })
    .onEnd(() => {
      // Apply constraints and spring animation
      const constrainedTranslation = constrainTranslation(
        { x: translateX.value, y: translateY.value },
        width,
        height,
        2000, // Assume galaxy content size
        2000,
        scale.value
      );

      translateX.value = withSpring(constrainedTranslation.x);
      translateY.value = withSpring(constrainedTranslation.y);
      
      runOnJS(updateViewportState)(constrainedTranslation.x, constrainedTranslation.y, scale.value);
    });

  // Pinch gesture
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      lastScale.value = scale.value;
    })
    .onUpdate((event) => {
      const newScale = clampScale(lastScale.value * event.scale);
      scale.value = newScale;
    })
    .onEnd(() => {
      const clampedScale = clampScale(scale.value);
      scale.value = withSpring(clampedScale);
      
      runOnJS(updateViewportState)(translateX.value, translateY.value, clampedScale);
    });

  // Compose gestures
  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  // Animated style for SVG transform
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  // Handle tap events
  const handleMapPress = useCallback((event: { nativeEvent: { locationX: number; locationY: number } }) => {
    if (onMapPress) {
      const screenPoint: Point2D = {
        x: event.nativeEvent.locationX,
        y: event.nativeEvent.locationY,
      };
      const galaxyPoint = screenToGalaxy(screenPoint, viewportState);
      onMapPress(galaxyPoint);
    }
  }, [onMapPress, viewportState]);

  // Get visible beacons for rendering
  const visibleBeacons = useMemo(() => {
    return spatialIndex.queryBounds(viewportState.bounds);
  }, [spatialIndex, viewportState.bounds]);

  return (
    <View style={[{ width, height }, style]} onTouchEnd={handleMapPress}>
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={{ flex: 1 }}>
          <AnimatedSvg
            width={width}
            height={height}
            style={animatedStyle}
            viewBox={`0 0 ${width} ${height}`}
          >
            {/* Background galaxy space */}
            <Rect
              x="0"
              y="0"
              width={width}
              height={height}
              fill="#0F172A"
            />
            
            {/* Debug: Show viewport bounds */}
            <Rect
              x={galaxyToScreen({ x: viewportState.bounds.minX, y: viewportState.bounds.minY }, viewportState).x}
              y={galaxyToScreen({ x: viewportState.bounds.minX, y: viewportState.bounds.minY }, viewportState).y}
              width={(viewportState.bounds.maxX - viewportState.bounds.minX) * viewportState.scale}
              height={(viewportState.bounds.maxY - viewportState.bounds.minY) * viewportState.scale}
              fill="none"
              stroke="#4F46E5"
              strokeWidth="2"
              strokeOpacity="0.3"
            />

            {/* Render visible beacons (placeholder for now) */}
            {visibleBeacons.map((beacon) => {
              const screenPos = galaxyToScreen(beacon.position, viewportState);
              return (
                <Rect
                  key={beacon.id}
                  x={screenPos.x - 5}
                  y={screenPos.y - 5}
                  width="10"
                  height="10"
                  fill="#F59E0B"
                  rx="2"
                />
              );
            })}
          </AnimatedSvg>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

export default GalaxyMapView;