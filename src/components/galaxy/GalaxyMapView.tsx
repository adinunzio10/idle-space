import React, { useState, useCallback, useMemo } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
  runOnUI,
  useFrameCallback,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Rect } from 'react-native-svg';

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
      
      runOnJS(updateViewportState)(
        momentumResult.translation.x,
        momentumResult.translation.y,
        scale.value
      );
    }
  }, true);

  // Pan gesture
  const panGesture = Gesture.Pan()
    .onStart(() => {
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
      
      // Track velocity for momentum
      velocityX.value = event.velocityX;
      velocityY.value = event.velocityY;
    })
    .onEnd(() => {
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

      // Start momentum decay if velocity is significant
      const currentVelocity = { x: velocityX.value, y: velocityY.value };
      if (!isVelocityInsignificant(currentVelocity, 50)) {
        isDecaying.value = true;
        velocityX.value = velocityX.value * 0.1; // Scale down initial velocity
        velocityY.value = velocityY.value * 0.1;
      } else {
        // Spring back to constrained position
        translateX.value = withSpring(constrainedTranslation.x);
        translateY.value = withSpring(constrainedTranslation.y);
      }
      
      runOnJS(updateViewportState)(constrainedTranslation.x, constrainedTranslation.y, scale.value);
    });

  // Pinch gesture with focal point zooming
  const pinchGesture = Gesture.Pinch()
    .onStart((event) => {
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
    })
    .onEnd(() => {
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

  // Handle single tap - needs to be a worklet-safe callback
  const handleSingleTap = useCallback((tapX: number, tapY: number, currentScale: number, currentTranslateX: number, currentTranslateY: number) => {
    const screenPoint: Point2D = { x: tapX, y: tapY };
    const currentViewport: ViewportState = {
      translateX: currentTranslateX,
      translateY: currentTranslateY,
      scale: currentScale,
      bounds: viewportState.bounds, // This should be safe to access
    };
    const galaxyPoint = screenToGalaxy(screenPoint, currentViewport);
    
    // Calculate dynamic hit radius based on zoom
    const hitRadius = calculateHitRadius(currentScale);
    
    // Check if tap hits any cluster first (they're larger)
    for (const cluster of renderingState.clusters) {
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
    
    for (const connection of renderingState.connections) {
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
      for (const beacon of renderingState.visibleBeacons) {
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
  }, [viewportState.bounds, renderingState.clusters, renderingState.connections, renderingState.visibleBeacons, beacons, onBeaconSelect, onMapPress]);

  // Single tap for beacon/cluster selection or map interaction
  const singleTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .maxDelay(250)
    .onEnd((event) => {
      runOnJS(handleSingleTap)(event.x, event.y, scale.value, translateX.value, translateY.value);
    });

  // Double tap to zoom gesture
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((event) => {
      isDecaying.value = false;
      
      const currentScale = scale.value;
      const targetScale = currentScale < 2 ? 3 : 1; // Zoom in to 3x or out to 1x
      const focalPoint = { x: event.x, y: event.y };
      
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

            {/* Star field background with parallax */}
            <StarField
              viewportState={viewportState}
              width={width}
              height={height}
              enableParallax={getQualitySettings().enableParallax}
              densityFactor={getQualitySettings().starDensity}
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
          </AnimatedSvg>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

export default GalaxyMapView;