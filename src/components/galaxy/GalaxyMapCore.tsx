import React, { useState, useCallback, useMemo, useRef } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { G, Rect } from 'react-native-svg';

import {
  Point2D,
  ViewportState,
  Beacon,
} from '../../types/galaxy';
import {
  screenToGalaxy,
  calculateVisibleBounds,
  clampScale,
  constrainTranslationElastic,
  calculateZoomFocalPoint,
  isPointInHitArea,
} from '../../utils/spatial/viewport';
import BeaconRenderer from './BeaconRenderer';

const AnimatedSvg = Animated.createAnimatedComponent(Svg);
const AnimatedG = Animated.createAnimatedComponent(G);

interface GalaxyMapCoreProps {
  width: number;
  height: number;
  beacons: Beacon[];
  onBeaconSelect?: (beacon: Beacon) => void;
  onMapPress?: (point: Point2D) => void;
  selectedBeacon?: Beacon | null;
  style?: any;
}

export const GalaxyMapCore: React.FC<GalaxyMapCoreProps> = ({
  width,
  height,
  beacons,
  onBeaconSelect,
  onMapPress,
  selectedBeacon = null,
  style,
}) => {
  // Performance tracking
  const [frameCount, setFrameCount] = useState(0);
  const [fps, setFps] = useState(60);
  const lastFrameTime = useRef(Date.now());

  // Constants for galaxy content
  const GALAXY_WIDTH = 2000;
  const GALAXY_HEIGHT = 2000;

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

  // Performance monitoring
  const updatePerformanceMetrics = useCallback(() => {
    const now = Date.now();
    const deltaTime = now - lastFrameTime.current;
    const newFps = 1000 / deltaTime;
    
    setFrameCount(prev => prev + 1);
    setFps(Math.round(newFps));
    lastFrameTime.current = now;

    // Log performance every 60 frames
    if (frameCount % 60 === 0) {
      console.log(`[GalaxyMapCore] FPS: ${Math.round(newFps)}, Frame: ${frameCount}`);
    }
  }, [frameCount]);

  // Simple viewport state update
  const updateViewportState = useCallback(
    (newTranslateX: number, newTranslateY: number, newScale: number) => {
      updatePerformanceMetrics();

      const newViewport: ViewportState = {
        translateX: newTranslateX,
        translateY: newTranslateY,
        scale: newScale,
        bounds: calculateVisibleBounds(width, height, {
          translateX: newTranslateX,
          translateY: newTranslateY,
          scale: newScale,
          bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
        }),
      };
      setViewportState(newViewport);
    },
    [width, height, updatePerformanceMetrics]
  );

  // Filter visible beacons (simple approach without spatial indexing)
  const visibleBeacons = useMemo(() => {
    return beacons.filter(beacon => {
      const bounds = viewportState.bounds;
      return (
        beacon.position.x >= bounds.minX &&
        beacon.position.x <= bounds.maxX &&
        beacon.position.y >= bounds.minY &&
        beacon.position.y <= bounds.maxY
      );
    });
  }, [beacons, viewportState.bounds]);

  // Simple pan gesture
  const panGesture = Gesture.Pan()
    .onStart(() => {
      lastTranslateX.value = translateX.value;
      lastTranslateY.value = translateY.value;
    })
    .onUpdate(event => {
      translateX.value = lastTranslateX.value + event.translationX;
      translateY.value = lastTranslateY.value + event.translationY;
      
      // Update viewport every 10 pixels of movement for performance
      if (Math.abs(event.translationX) % 10 < 2 || Math.abs(event.translationY) % 10 < 2) {
        runOnJS(updateViewportState)(
          translateX.value,
          translateY.value,
          scale.value
        );
      }
    })
    .onEnd(() => {
      runOnJS(updateViewportState)(
        translateX.value,
        translateY.value,
        scale.value
      );
    });

  // Simple pinch gesture
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      lastScale.value = scale.value;
      lastTranslateX.value = translateX.value;
      lastTranslateY.value = translateY.value;
    })
    .onUpdate(event => {
      const newScale = clampScale(lastScale.value * event.scale);
      
      const focalPoint = {
        x: event.focalX || width / 2,
        y: event.focalY || height / 2,
      };
      
      const newTranslation = calculateZoomFocalPoint(
        focalPoint,
        { x: lastTranslateX.value, y: lastTranslateY.value },
        lastScale.value,
        newScale
      );

      const constrainedTranslation = constrainTranslationElastic(
        newTranslation,
        width,
        height,
        GALAXY_WIDTH,
        GALAXY_HEIGHT,
        newScale
      );

      scale.value = newScale;
      translateX.value = constrainedTranslation.x;
      translateY.value = constrainedTranslation.y;

      // Update viewport every 10% scale change for performance
      if (Math.abs(event.scale - 1) > 0.1) {
        runOnJS(updateViewportState)(
          constrainedTranslation.x,
          constrainedTranslation.y,
          newScale
        );
      }
    })
    .onEnd(() => {
      runOnJS(updateViewportState)(
        translateX.value,
        translateY.value,
        scale.value
      );
    });

  // Handle tap interaction - moved to JavaScript thread
  const handleTapInteraction = useCallback(
    (screenX: number, screenY: number, translateX: number, translateY: number, scale: number) => {
      const currentViewport: ViewportState = {
        translateX,
        translateY,
        scale,
        bounds: calculateVisibleBounds(width, height, {
          translateX,
          translateY,
          scale,
          bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
        }),
      };
      
      const screenPoint: Point2D = { x: screenX, y: screenY };
      const galaxyPoint = screenToGalaxy(screenPoint, currentViewport);
      
      // Simple hit testing with fixed radius
      const hitRadius = 20;
      let selectedBeaconFound = null;
      
      for (const beacon of visibleBeacons) {
        if (isPointInHitArea(galaxyPoint, beacon.position, hitRadius)) {
          selectedBeaconFound = beacon;
          break;
        }
      }

      if (selectedBeaconFound && onBeaconSelect) {
        onBeaconSelect(selectedBeaconFound);
      } else if (onMapPress) {
        onMapPress(galaxyPoint);
      }
    },
    [width, height, visibleBeacons, onBeaconSelect, onMapPress]
  );

  // Simple tap gesture for beacon selection and map interaction
  const tapGesture = Gesture.Tap()
    .onEnd(event => {
      runOnJS(handleTapInteraction)(
        event.x,
        event.y,
        translateX.value,
        translateY.value,
        scale.value
      );
    });

  // Combine gestures
  const composedGesture = Gesture.Simultaneous(
    panGesture.simultaneousWithExternalGesture(pinchGesture),
    pinchGesture.simultaneousWithExternalGesture(panGesture),
    tapGesture
      .requireExternalGestureToFail(panGesture)
      .requireExternalGestureToFail(pinchGesture)
  );

  // Create animated props for SVG group transform
  const animatedProps = useAnimatedProps(() => {
    return {
      transform: `translate(${translateX.value}, ${translateY.value}) scale(${scale.value})`,
    };
  });

  return (
    <View style={[{ width, height }, style]} className="galaxy-map-core">
      {/* Simple FPS display for performance monitoring */}
      {__DEV__ && (
        <View className="absolute top-4 left-4 bg-black bg-opacity-50 p-2 rounded">
          <Animated.Text className="text-white text-xs">
            FPS: {fps} | Beacons: {visibleBeacons.length}
          </Animated.Text>
        </View>
      )}

      <GestureDetector gesture={composedGesture}>
        <Animated.View style={{ flex: 1 }}>
          <AnimatedSvg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
          >
            {/* Simple dark background */}
            <Rect x="0" y="0" width={width} height={height} fill="#0F172A" />

            {/* Transformable galaxy content */}
            <AnimatedG animatedProps={animatedProps}>
              {/* Galaxy bounds visualization */}
              <Rect
                x={0}
                y={0}
                width={GALAXY_WIDTH}
                height={GALAXY_HEIGHT}
                fill="none"
                stroke="#4F46E5"
                strokeWidth="2"
                strokeOpacity="0.2"
              />

              {/* Simple beacon rendering - minimal LOD */}
              {visibleBeacons.map(beacon => (
                <BeaconRenderer
                  key={beacon.id}
                  beacon={beacon}
                  lodInfo={{ 
                    level: 1, 
                    renderMode: 'standard' as const,
                    size: 12,
                    showAnimations: false,
                    showEffects: false
                  }}
                  viewportState={viewportState}
                />
              ))}
            </AnimatedG>
          </AnimatedSvg>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

export default GalaxyMapCore;