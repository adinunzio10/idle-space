/**
 * WORKLET PATTERNS DOCUMENTATION
 * 
 * This file demonstrates proper React Native Reanimated v3 worklet usage patterns
 * to avoid synchronous UI thread to JavaScript thread violations.
 * 
 * KEY PRINCIPLES:
 * 1. Functions marked with 'worklet' run on UI thread - can access shared values directly
 * 2. JavaScript functions must be called via runOnJS() from gesture handlers/worklets
 * 3. React state should never be accessed directly inside gesture handlers
 * 4. Pass needed data as parameters to runOnJS callbacks instead of capturing closures
 * 
 * COMMON VIOLATIONS TO AVOID:
 * ❌ Direct React state access in gesture handlers
 * ❌ Calling non-worklet functions inside useAnimatedStyle
 * ❌ Accessing component methods/hooks inside gesture callbacks
 * ❌ Using console.log inside worklets (use runOnJS for logging)
 * 
 * CORRECT PATTERNS USED IN THIS FILE:
 * ✅ runOnJS() wrapping for all JavaScript function calls from gestures
 * ✅ 'worklet' directive on utility functions in viewport.ts
 * ✅ Passing React state as parameters instead of closure capture
 * ✅ Using shared values only within worklet contexts
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useAnimatedProps,
  useSharedValue,
  withSpring,
  runOnJS,
  useFrameCallback,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { G, Rect } from 'react-native-svg';

import {
  Point2D,
  ViewportState,
  GalaxyMapProps,
  GestureVelocity,
  GestureState,
  BeaconCluster,
  RenderingState,
} from '../../types/galaxy';
import {
  screenToGalaxy,
  galaxyToScreen,
  calculateVisibleBounds,
  clampScale,
  constrainTranslationElastic,
  applyMomentum,
  calculateZoomFocalPoint,
  isVelocityInsignificant,
  isPointInHitArea,
} from '../../utils/spatial/viewport';
import { QuadTreeSpatialIndex } from '../../utils/spatial/quadtree';
import { performanceMonitor, usePerformanceMonitor } from '../../utils/performance/monitor';
import { 
  getLODRenderInfo, 
  shouldEnableClustering, 
  calculateHitRadius 
} from '../../utils/rendering/lod';
import { hierarchicalCluster, isPointInCluster } from '../../utils/rendering/clustering';
import { 
  getConnectionRenderInfo, 
  isConnectionVisible,
  isPointNearConnection 
} from '../../utils/rendering/connections';
import { 
  buildConnectionsFromBeacons, 
  PatternDetector, 
  updateConnectionPatterns 
} from '../../utils/patterns/detection';
import { CONNECTION_CONFIG } from '../../constants/connections';
import BeaconRenderer from './BeaconRenderer';
import BeaconClusterRenderer from './BeaconCluster';
import ConnectionRenderer from './ConnectionRenderer';
import StarField from './StarField';

const AnimatedSvg = Animated.createAnimatedComponent(Svg);
const AnimatedG = Animated.createAnimatedComponent(G);

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
  
  // Velocity tracking for momentum
  const velocityX = useSharedValue(0);
  const velocityY = useSharedValue(0);
  const isDecaying = useSharedValue(false);
  
  // Velocity smoothing to prevent finger-lift artifacts
  const prevVelocityX = useSharedValue(0);
  const prevVelocityY = useSharedValue(0);
  
  // Focal point for zoom
  const focalPointX = useSharedValue(width / 2);
  const focalPointY = useSharedValue(height / 2);
  
  // Gesture state tracking
  const gestureState = useSharedValue<GestureState>({
    isActive: false,
    velocity: { x: 0, y: 0 },
    focalPoint: undefined,
  });

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

  // Rendering state management
  const [renderingState, setRenderingState] = useState<RenderingState>({
    zoom: 1,
    visibleBeacons: [],
    clusters: [],
    connections: [],
    patterns: [],
    lodLevel: 1,
    shouldCluster: false,
    performanceMode: false,
  });

  // Performance monitoring hook
  const { startFrame, endFrame, getQualitySettings } = usePerformanceMonitor();

  // Spatial indexing for efficient beacon queries - now using QuadTree
  const spatialIndex = useMemo(() => {
    const bounds = {
      x: 0,
      y: 0,
      width: GALAXY_WIDTH,
      height: GALAXY_HEIGHT,
    };
    const index = new QuadTreeSpatialIndex(bounds, 10, 8);
    index.rebuild(beacons);
    return index;
  }, [beacons]);

  // Pattern detector for geometric patterns
  const patternDetector = useMemo(() => new PatternDetector(), []);

  // Initialize performance monitoring
  React.useEffect(() => {
    performanceMonitor.start();
    return () => {
      performanceMonitor.stop();
    };
  }, []);

  // Debug logging helper - defined early so it's available in worklets
  const logGesture = useCallback((type: string, data: any) => {
    console.log(`[GalaxyMap] ${type}:`, data);
  }, []);

  // Update viewport and rendering state callback
  const updateViewportState = useCallback((newTranslateX: number, newTranslateY: number, newScale: number) => {
    startFrame(); // Start performance monitoring

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

    // Get performance quality settings
    const qualitySettings = getQualitySettings();

    // Calculate rendering state with performance optimizations
    const visibleBeacons = spatialIndex.queryBounds(newViewport.bounds);
    
    // Apply performance-based beacon limit
    const limitedBeacons = visibleBeacons.slice(0, qualitySettings.maxVisibleBeacons);
    
    const lodInfo = getLODRenderInfo(newScale, qualitySettings.lodBias);
    const shouldCluster = shouldEnableClustering(limitedBeacons, newScale, newViewport);
    
    let clusters: BeaconCluster[] = [];
    let remainingBeacons = limitedBeacons;
    
    if (shouldCluster) {
      const clusterResult = hierarchicalCluster(limitedBeacons, newScale);
      clusters = clusterResult.clusters;
      remainingBeacons = clusterResult.remainingBeacons;
    }

    // Build connections from all beacons (not just visible ones for pattern detection)
    const allConnections = buildConnectionsFromBeacons(beacons);
    
    // Detect patterns (skip if performance is poor)
    let patterns = renderingState.patterns; // Reuse previous patterns
    if (qualitySettings.enableAnimations) {
      patterns = patternDetector.detectPatternsOptimized(beacons, allConnections);
    }
    
    // Update connections with pattern information
    const connectionsWithPatterns = updateConnectionPatterns(allConnections, patterns);
    
    // Filter connections to only those that are visible with performance limits
    const beaconMap = new Map(beacons.map(b => [b.id, b]));
    const visibleConnections = connectionsWithPatterns
      .filter(connection => {
        const sourceBeacon = beaconMap.get(connection.sourceId);
        const targetBeacon = beaconMap.get(connection.targetId);
        
        if (!sourceBeacon || !targetBeacon) return false;
        
        return isConnectionVisible(connection, sourceBeacon, targetBeacon, newViewport);
      })
      .slice(0, CONNECTION_CONFIG.PERFORMANCE.MAX_CONNECTIONS_PER_FRAME);
    
    const newRenderingState: RenderingState = {
      zoom: newScale,
      visibleBeacons: remainingBeacons,
      clusters,
      connections: visibleConnections,
      patterns,
      lodLevel: lodInfo.level,
      shouldCluster,
      performanceMode: !qualitySettings.enableAnimations,
    };
    
    setRenderingState(newRenderingState);
    endFrame(); // End performance monitoring
  }, [width, height, spatialIndex, patternDetector, beacons, startFrame, endFrame, getQualitySettings, renderingState.patterns]);

  // Momentum physics frame callback
  // WORKLET PATTERN: useFrameCallback with runOnJS for state updates
  useFrameCallback((frameInfo) => {
    if (isDecaying.value && !gestureState.value.isActive) {
      const deltaTime = frameInfo.timeSincePreviousFrame || 16.67; // Fallback to 60fps
      const normalizedDelta = deltaTime / 16.67; // Normalize to 60fps
      
      const currentVelocity: GestureVelocity = {
        x: velocityX.value,
        y: velocityY.value,
      };
      
      if (isVelocityInsignificant(currentVelocity, 0.1)) {
        isDecaying.value = false;
        velocityX.value = 0;
        velocityY.value = 0;
        runOnJS(logGesture)('Momentum Stopped', {
          finalTranslateX: translateX.value,
          finalTranslateY: translateY.value
        });
        return;
      }
      
      const momentumResult = applyMomentum(
        { x: translateX.value, y: translateY.value },
        currentVelocity,
        width,
        height,
        GALAXY_WIDTH,
        GALAXY_HEIGHT,
        scale.value,
        normalizedDelta
      );
      
      translateX.value = momentumResult.translation.x;
      translateY.value = momentumResult.translation.y;
      velocityX.value = momentumResult.newVelocity.x;
      velocityY.value = momentumResult.newVelocity.y;
      
      // ✅ CORRECT: runOnJS wraps JavaScript function call from worklet context
      runOnJS(updateViewportState)(
        momentumResult.translation.x,
        momentumResult.translation.y,
        scale.value
      );
    }
  }, true);

  // Pan gesture
  // WORKLET PATTERN: Gesture handlers with proper runOnJS usage
  const panGesture = Gesture.Pan()
    .minDistance(1) // Start panning after just 1px movement
    .activateAfterLongPress(0) // No long press delay
    .minPointers(1)
    .maxPointers(1)
    .onStart(() => {
      runOnJS(logGesture)('Pan Start', {
        translateX: translateX.value,
        translateY: translateY.value,
        scale: scale.value
      });
      
      isDecaying.value = false;
      gestureState.value.isActive = true;
      lastTranslateX.value = translateX.value;
      lastTranslateY.value = translateY.value;
      velocityX.value = 0;
      velocityY.value = 0;
    })
    .onUpdate((event) => {
      translateX.value = lastTranslateX.value + event.translationX;
      translateY.value = lastTranslateY.value + event.translationY;
      
      // Track velocity for momentum with smoothing to prevent finger-lift spikes
      prevVelocityX.value = velocityX.value;
      prevVelocityY.value = velocityY.value;
      velocityX.value = event.velocityX;
      velocityY.value = event.velocityY;
      
      // ✅ ADDED: Real-time viewport updates during panning for responsive UI (throttled)
      // Only update every few pixels to avoid excessive calls
      if (Math.abs(event.translationX) % 10 < 2 || Math.abs(event.translationY) % 10 < 2) {
        runOnJS(updateViewportState)(translateX.value, translateY.value, scale.value);
      }
      
      // Log every 10th update to avoid spam
      if (Math.abs(event.translationX) % 20 < 5 || Math.abs(event.translationY) % 20 < 5) {
        runOnJS(logGesture)('Pan Update', {
          translationX: event.translationX,
          translationY: event.translationY,
          newTranslateX: translateX.value,
          newTranslateY: translateY.value,
          velocityX: velocityX.value,
          velocityY: velocityY.value
        });
      }
    })
    .onEnd(() => {
      const finalVelocity = { x: velocityX.value, y: velocityY.value };
      
      // Smart velocity filtering to prevent finger-lift artifacts
      const currentVelocity = { x: velocityX.value, y: velocityY.value };
      const previousVelocity = { x: prevVelocityX.value, y: prevVelocityY.value };
      
      // Check for velocity spikes (finger lift artifacts)
      const velocityJumpX = Math.abs(currentVelocity.x - previousVelocity.x);
      const velocityJumpY = Math.abs(currentVelocity.y - previousVelocity.y);
      const isLikelyFingerLift = velocityJumpX > 100 || velocityJumpY > 100;
      
      // Use previous velocity if current one seems like a finger-lift artifact
      const smoothedVelocity = isLikelyFingerLift ? previousVelocity : currentVelocity;
      
      runOnJS(logGesture)('Pan End', {
        finalTranslateX: translateX.value,
        finalTranslateY: translateY.value,
        rawVelocity: finalVelocity,
        smoothedVelocity: smoothedVelocity,
        isLikelyFingerLift: isLikelyFingerLift,
        willStartMomentum: !isVelocityInsignificant(smoothedVelocity, 150)
      });
      
      gestureState.value.isActive = false;
      
      // Apply elastic constraints
      const constrainedTranslation = constrainTranslationElastic(
        { x: translateX.value, y: translateY.value },
        width,
        height,
        GALAXY_WIDTH,
        GALAXY_HEIGHT,
        scale.value
      );
      
      // Start momentum decay if smoothed velocity is significant
      if (!isVelocityInsignificant(smoothedVelocity, 150)) { // Reduced threshold since we're using smoothed velocity
        isDecaying.value = true;
        velocityX.value = smoothedVelocity.x * 0.05; // Use smoothed velocity
        velocityY.value = smoothedVelocity.y * 0.05;
      } else {
        // Spring back to constrained position
        translateX.value = withSpring(constrainedTranslation.x);
        translateY.value = withSpring(constrainedTranslation.y);
      }
      
      // ✅ CORRECT: All gesture handlers use runOnJS for JavaScript calls
      runOnJS(updateViewportState)(constrainedTranslation.x, constrainedTranslation.y, scale.value);
    });

  // Pinch gesture with focal point zooming
  const pinchGesture = Gesture.Pinch()
    .onStart((event) => {
      runOnJS(logGesture)('Pinch Start', {
        focalX: event.focalX,
        focalY: event.focalY,
        initialScale: scale.value
      });
      
      isDecaying.value = false;
      gestureState.value.isActive = true;
      lastScale.value = scale.value;
      lastTranslateX.value = translateX.value;
      lastTranslateY.value = translateY.value;
      
      // Set focal point for zoom
      focalPointX.value = event.focalX;
      focalPointY.value = event.focalY;
      gestureState.value.focalPoint = { x: event.focalX, y: event.focalY };
    })
    .onUpdate((event) => {
      const newScale = clampScale(lastScale.value * event.scale);
      
      // Calculate focal point adjustment
      const focalPoint = { x: event.focalX, y: event.focalY };
      const newTranslation = calculateZoomFocalPoint(
        focalPoint,
        { x: lastTranslateX.value, y: lastTranslateY.value },
        lastScale.value,
        newScale
      );
      
      scale.value = newScale;
      translateX.value = newTranslation.x;
      translateY.value = newTranslation.y;
      
      // ✅ ADDED: Real-time viewport updates during pinch for responsive UI (throttled)
      // Only update on significant scale changes to avoid excessive calls  
      if (Math.abs(event.scale - lastScale.value) > 0.05) {
        runOnJS(updateViewportState)(newTranslation.x, newTranslation.y, newScale);
      }
      
      // Log occasional updates
      if (Math.abs(event.scale - 1) > 0.1) {
        runOnJS(logGesture)('Pinch Update', {
          scale: event.scale,
          newScale: newScale,
          focalX: event.focalX,
          focalY: event.focalY
        });
      }
    })
    .onEnd(() => {
      runOnJS(logGesture)('Pinch End', {
        finalScale: scale.value,
        finalTranslateX: translateX.value,
        finalTranslateY: translateY.value
      });
      
      gestureState.value.isActive = false;
      gestureState.value.focalPoint = undefined;
      
      const clampedScale = clampScale(scale.value);
      
      // Apply elastic constraints to translation
      const constrainedTranslation = constrainTranslationElastic(
        { x: translateX.value, y: translateY.value },
        width,
        height,
        GALAXY_WIDTH,
        GALAXY_HEIGHT,
        clampedScale
      );
      
      scale.value = withSpring(clampedScale);
      translateX.value = withSpring(constrainedTranslation.x);
      translateY.value = withSpring(constrainedTranslation.y);
      
      runOnJS(updateViewportState)(constrainedTranslation.x, constrainedTranslation.y, clampedScale);
    });

  // Handle single tap - worklet-safe callback that receives necessary data as parameters
  // WORKLET PATTERN: Pass React state as parameters instead of closure capture
  const handleSingleTap = useCallback((tapX: number, tapY: number, currentScale: number, currentTranslateX: number, currentTranslateY: number, viewportBounds: any, clusters: any[], connections: any[], visibleBeacons: any[]) => {
    const screenPoint: Point2D = { x: tapX, y: tapY };
    const currentViewport: ViewportState = {
      translateX: currentTranslateX,
      translateY: currentTranslateY,
      scale: currentScale,
      bounds: viewportBounds,
    };
    const galaxyPoint = screenToGalaxy(screenPoint, currentViewport);
    
    // Calculate dynamic hit radius based on zoom
    const hitRadius = calculateHitRadius(currentScale);
    
    // Check if tap hits any cluster first (they're larger)
    for (const cluster of clusters) {
      if (isPointInCluster(galaxyPoint, cluster)) {
        // Handle cluster tap - could expand cluster or show cluster info
        if (onBeaconSelect && cluster.beacons.length > 0) {
          // For now, select the first beacon in the cluster
          onBeaconSelect(cluster.beacons[0]);
        }
        return; // Early return if cluster was hit
      }
    }
    
    // Check if tap hits any connection first
    const beaconMap = new Map(beacons.map(b => [b.id, b]));
    let selectedConnection = null;
    
    for (const connection of connections) {
      const sourceBeacon = beaconMap.get(connection.sourceId);
      const targetBeacon = beaconMap.get(connection.targetId);
      
      if (sourceBeacon && targetBeacon) {
        if (isPointNearConnection(galaxyPoint, sourceBeacon.position, targetBeacon.position, hitRadius)) {
          selectedConnection = connection;
          break;
        }
      }
    }
    
    // Check if tap hits any visible beacon
    let selectedBeacon = null;
    if (!selectedConnection) {
      for (const beacon of visibleBeacons) {
        if (isPointInHitArea(galaxyPoint, beacon.position, hitRadius)) {
          selectedBeacon = beacon;
          break; // Select first hit beacon
        }
      }
    }
    
    if (selectedConnection) {
      // Handle connection selection - could show connection info
      // For now, select the source beacon
      const sourceBeacon = beaconMap.get(selectedConnection.sourceId);
      if (sourceBeacon && onBeaconSelect) {
        onBeaconSelect(sourceBeacon);
      }
    } else if (selectedBeacon && onBeaconSelect) {
      onBeaconSelect(selectedBeacon);
    } else if (onMapPress) {
      onMapPress(galaxyPoint);
    }
  }, [beacons, onBeaconSelect, onMapPress]);

  // Single tap for beacon/cluster selection or map interaction
  const singleTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .maxDelay(250)
    .onEnd((event) => {
      // ✅ CORRECT: Pass React state as parameters to avoid closure capture violations
      runOnJS(handleSingleTap)(
        event.x, 
        event.y, 
        scale.value, 
        translateX.value, 
        translateY.value,
        viewportState.bounds,
        renderingState.clusters,
        renderingState.connections,
        renderingState.visibleBeacons
      );
    });

  // Double tap to zoom gesture
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((event) => {
      const currentScale = scale.value;
      const targetScale = currentScale < 2 ? 3 : 1; // Zoom in to 3x or out to 1x
      const focalPoint = { x: event.x, y: event.y };
      
      runOnJS(logGesture)('Double Tap', {
        tapX: event.x,
        tapY: event.y,
        currentScale,
        targetScale,
        action: currentScale < 2 ? 'zoom in' : 'zoom out'
      });
      
      isDecaying.value = false;
      
      // Calculate new translation to center on tap point
      const newTranslation = calculateZoomFocalPoint(
        focalPoint,
        { x: translateX.value, y: translateY.value },
        currentScale,
        targetScale
      );
      
      // Apply constraints
      const constrainedTranslation = constrainTranslationElastic(
        newTranslation,
        width,
        height,
        GALAXY_WIDTH,
        GALAXY_HEIGHT,
        targetScale
      );
      
      // Animate to new scale and position
      scale.value = withSpring(targetScale, { damping: 20, stiffness: 300 });
      translateX.value = withSpring(constrainedTranslation.x, { damping: 20, stiffness: 300 });
      translateY.value = withSpring(constrainedTranslation.y, { damping: 20, stiffness: 300 });
      
      runOnJS(updateViewportState)(constrainedTranslation.x, constrainedTranslation.y, targetScale);
    });

  // Compose gestures with proper priority
  const composedGesture = Gesture.Race(
    doubleTapGesture,
    Gesture.Exclusive(
      singleTapGesture,
      Gesture.Simultaneous(panGesture, pinchGesture)
    )
  );

  // Create animated props for SVG group transform
  const animatedProps = useAnimatedProps(() => {
    return {
      transform: `translate(${translateX.value}, ${translateY.value}) scale(${scale.value})`,
    };
  });


  // Get LOD rendering information
  const lodRenderInfo = useMemo(() => {
    return getLODRenderInfo(viewportState.scale);
  }, [viewportState.scale]);

  return (
    <View style={[{ width, height }, style]}>
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={{ flex: 1 }}>
          <AnimatedSvg
            width={width}
            height={height}
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

            {/* Star field background with parallax - stays fixed */}
            <StarField
              viewportState={viewportState}
              width={width}
              height={height}
              enableParallax={performanceMonitor.getQualitySettings().enableParallax}
              densityFactor={performanceMonitor.getQualitySettings().starDensity}
            />
            
            {/* Transformable galaxy content group */}
            <AnimatedG animatedProps={animatedProps}>
              {/* Debug: Show viewport bounds */}
              <Rect
                x={0}
                y={0}
                width={GALAXY_WIDTH}
                height={GALAXY_HEIGHT}
                fill="none"
                stroke="#4F46E5"
                strokeWidth="2"
                strokeOpacity="0.3"
              />

              {/* Render connections (behind beacons and clusters) */}
              {renderingState.connections
                .slice(0, CONNECTION_CONFIG.PERFORMANCE.MAX_CONNECTIONS_PER_FRAME)
                .map((connection) => {
                  const sourceBeacon = beacons.find(b => b.id === connection.sourceId);
                  const targetBeacon = beacons.find(b => b.id === connection.targetId);
                  
                  if (!sourceBeacon || !targetBeacon) return null;
                  
                  const connectionRenderInfo = getConnectionRenderInfo(
                    connection,
                    viewportState.scale,
                    true // Already filtered for visibility
                  );
                  
                  return (
                    <ConnectionRenderer
                      key={connection.id}
                      connection={connection}
                      sourceBeacon={sourceBeacon}
                      targetBeacon={targetBeacon}
                      renderInfo={connectionRenderInfo}
                      viewportState={viewportState}
                    />
                  );
                })}

              {/* Render beacon clusters */}
              {renderingState.clusters.map((cluster) => (
                <BeaconClusterRenderer
                  key={cluster.id}
                  cluster={cluster}
                  viewportState={viewportState}
                  onPress={onBeaconSelect ? (cluster) => {
                    // Handle cluster press - for now select first beacon
                    if (cluster.beacons.length > 0) {
                      onBeaconSelect(cluster.beacons[0]);
                    }
                  } : undefined}
                />
              ))}

              {/* Render individual visible beacons */}
              {renderingState.visibleBeacons.map((beacon) => (
                <BeaconRenderer
                  key={beacon.id}
                  beacon={beacon}
                  lodInfo={lodRenderInfo}
                  viewportState={viewportState}
                  onPress={onBeaconSelect}
                />
              ))}
            </AnimatedG>
          </AnimatedSvg>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

export default GalaxyMapView;