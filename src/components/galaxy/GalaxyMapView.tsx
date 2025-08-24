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
  calculateVisibleBounds,
  clampScale,
  constrainTranslationElastic,
  applyMomentum,
  calculateZoomFocalPoint,
  isVelocityInsignificant,
  isPointInHitArea,
  smoothVelocityWorklet,
  isVelocitySignificantForMomentum,
  getConfiguredHitRadius,
} from '../../utils/spatial/viewport';
import {
  GestureStateMachine,
  GestureStateType,
  createStateChecker,
} from '../../utils/gestures/gestureStateMachine';
import {
  palmRejectionWorklet,
  smoothVelocityWorklet as gestureSmoothenWorklet,
  updatePerformanceMetricsWorklet,
  trackGestureResponseTimeWorklet,
  constrainGestureBoundsWorklet,
  applyElasticResistanceWorklet,
  clampScaleWorklet,
  calculateFocalPointZoomWorklet,
  debugGestureWorklet,
} from '../../utils/gestures/gestureWorklets';
import GestureDebugOverlay from '../debug/GestureDebugOverlay';
import { QuadTreeSpatialIndex } from '../../utils/spatial/quadtree';
import { performanceMonitor, usePerformanceMonitor } from '../../utils/performance/monitor';
import { 
  getLODRenderInfo, 
  shouldEnableClustering
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
import { gestureConfig, GESTURE_THRESHOLDS } from '../../constants/gestures';
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
  
  // Advanced Gesture State Machine - create proper SharedValue for state
  const gestureSharedState = useSharedValue(GestureStateType.IDLE);
  const gestureStateMachine = useMemo(() => new GestureStateMachine(gestureSharedState), [gestureSharedState]);
  const stateChecker = useMemo(() => createStateChecker(gestureSharedState), [gestureSharedState]);
  
  // Performance tracking shared values - create real SharedValues
  const performanceLastFrameTime = useSharedValue(0);
  const performanceFrameCount = useSharedValue(0);
  const performanceAvgFrameTime = useSharedValue(16.67);
  const performanceDroppedFrames = useSharedValue(0);
  const performanceGestureResponseTime = useSharedValue(0);
  
  const performanceSharedValues = useMemo(() => ({
    lastFrameTime: performanceLastFrameTime,
    frameCount: performanceFrameCount,
    avgFrameTime: performanceAvgFrameTime,
    droppedFrames: performanceDroppedFrames,
    gestureResponseTime: performanceGestureResponseTime,
  }), [performanceLastFrameTime, performanceFrameCount, performanceAvgFrameTime, performanceDroppedFrames, performanceGestureResponseTime]);
  
  // Debug shared value for worklet debugging
  const debugSharedValue = useSharedValue('');
  
  // Enhanced gesture state tracking - Use primitive SharedValues to avoid serialization issues
  const gestureStateIsActive = useSharedValue(false);
  const gestureStateVelocityX = useSharedValue(0);
  const gestureStateVelocityY = useSharedValue(0);
  const gestureStateFocalPointX = useSharedValue(0);
  const gestureStateFocalPointY = useSharedValue(0);
  const gestureStateHasFocalPoint = useSharedValue(false);
  
  // Advanced palm rejection tracking - Use simple arrays instead of complex objects
  const activeTouchAreasData = useSharedValue(''); // JSON string for serializable storage
  const rapidTouchCount = useSharedValue(0);
  const lastTouchTime = useSharedValue(0);

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

  // FIX: State transition helper to avoid closure capture in runOnJS
  const requestStateTransition = useCallback((targetState: GestureStateType, eventData: any) => {
    gestureStateMachine.requestTransition(targetState, eventData);
  }, [gestureStateMachine]);

  // Palm rejection tracking - Use serializable string storage to avoid JSI crashes
  const activeTouchesData = useSharedValue(''); // JSON string storage
  const recentTouchesData = useSharedValue(''); // JSON string storage

  // Palm rejection helper (called via runOnJS) - Fixed for JSI serialization
  const handleTouchEvent = useCallback((touchData: {
    identifier: number;
    x: number;
    y: number;
    timestamp: number;
    phase: 'began' | 'moved' | 'ended';
  }) => {
    const now = Date.now();
    
    try {
      // Parse current data from serializable storage
      let activeTouches: Record<number, { x: number; y: number; timestamp: number }> = {};
      let recentTouches: { x: number; y: number; timestamp: number }[] = [];
      
      try {
        if (activeTouchesData.value) {
          activeTouches = JSON.parse(activeTouchesData.value);
        }
        if (recentTouchesData.value) {
          recentTouches = JSON.parse(recentTouchesData.value);
        }
      } catch (parseError) {
        console.warn('Failed to parse touch data, resetting:', parseError);
        activeTouches = {};
        recentTouches = [];
      }
      
      // Clean up old touches (older than 1 second)
      recentTouches = recentTouches.filter(
        touch => now - touch.timestamp < 1000
      );
      
      switch (touchData.phase) {
        case 'began':
          // Check for palm rejection
          const config = gestureConfig.getPalmRejectionConfig();
          
          // Check for rapid succession touches (potential palm)
          const recentCount = recentTouches.filter(
            touch => now - touch.timestamp < config.timing.RAPID_SUCCESSION_MS
          ).length;
          
          if (recentCount >= config.timing.MAX_RAPID_TOUCHES) {
            logGesture('Palm Rejected', { 
              reason: 'rapid succession',
              count: recentCount,
              touchId: touchData.identifier 
            });
            return false; // Reject touch
          }
          
          // Check for clustered touches (potential palm)
          const nearbyTouches = Object.values(activeTouches).filter(
            activeTouch => {
              const distance = Math.sqrt(
                Math.pow(activeTouch.x - touchData.x, 2) + 
                Math.pow(activeTouch.y - touchData.y, 2)
              );
              return distance < config.multiTouch.CLUSTER_THRESHOLD;
            }
          );
          
          if (nearbyTouches.length >= 2) {
            logGesture('Palm Rejected', { 
              reason: 'clustered touches',
              nearbyCount: nearbyTouches.length,
              touchId: touchData.identifier 
            });
            return false; // Reject touch
          }
          
          // Track active touch
          activeTouches[touchData.identifier] = {
            x: touchData.x,
            y: touchData.y,
            timestamp: now,
          };
          
          // Add to recent touches
          recentTouches.push({
            x: touchData.x,
            y: touchData.y,
            timestamp: now,
          });
          
          break;
          
        case 'ended':
          delete activeTouches[touchData.identifier];
          break;
      }
      
      // Save back to serializable storage
      activeTouchesData.value = JSON.stringify(activeTouches);
      recentTouchesData.value = JSON.stringify(recentTouches);
      
      return true; // Allow touch
    } catch (error) {
      console.warn('Touch event processing error:', error);
      return true; // Default to allowing touch on error
    }
  }, [logGesture, activeTouchesData, recentTouchesData]);

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
    if (isDecaying.value && !gestureStateIsActive.value) {
      const deltaTime = frameInfo.timeSincePreviousFrame || 16.67; // Fallback to 60fps
      const normalizedDelta = deltaTime / 16.67; // Normalize to 60fps
      
      const currentVelocity: GestureVelocity = {
        x: velocityX.value,
        y: velocityY.value,
      };
      
      // Use configurable momentum physics - check if velocity is below minimum threshold
      if (!isVelocitySignificantForMomentum(currentVelocity)) {
        isDecaying.value = false;
        velocityX.value = 0;
        velocityY.value = 0;
        
        // Transition back to idle when momentum stops
        runOnJS(requestStateTransition)(GestureStateType.IDLE, {
          type: 'momentum',
          timestamp: Date.now(),
          pointerCount: 0,
        });
        
        runOnJS(logGesture)('Momentum Stopped', {
          finalTranslateX: translateX.value,
          finalTranslateY: translateY.value
        });
        
        runOnJS(logGesture)('State Transition', {
          from: 'MOMENTUM_ACTIVE',
          to: 'IDLE',
          reason: 'momentum_end'
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

  // Advanced Pan gesture with state machine integration
  const panThresholds = gestureConfig.getPanThresholds();
  const panGesture = Gesture.Pan()
    .minDistance(panThresholds.minDistance)
    // FIX: Remove .activateAfterLongPress(0) - it causes JSI crashes when delay is 0
    // .activateAfterLongPress(panThresholds.activationDelay) 
    .minPointers(panThresholds.minPointers)
    .maxPointers(panThresholds.maxPointers)
    .shouldCancelWhenOutside(false) // Allow dragging outside bounds
    .enableTrackpadTwoFingerGesture(true) // Support trackpad gestures
    .onStart((event) => {
      // Advanced gesture state management
      const gestureStartTime = Date.now();
      
      // Palm rejection check
      const isPalm = palmRejectionWorklet(
        event.handlerTag || 0, // Use handlerTag as area approximation
        0, // Width not available in pan gesture
        0, // Height not available in pan gesture
        event.numberOfPointers || 1,
        rapidTouchCount.value
      );
      
      if (isPalm) {
        debugGestureWorklet('Palm Rejected', { reason: 'pan start' }, gestureStartTime, debugSharedValue);
        return; // Exit early if palm detected
      }
      
      // State machine transition (simplified)
      const currentState = gestureSharedState.value;
      
      // Update rapid touch tracking
      if (gestureStartTime - lastTouchTime.value < 100) {
        rapidTouchCount.value++;
      } else {
        rapidTouchCount.value = 1;
      }
      lastTouchTime.value = gestureStartTime;
      
      // Track performance
      updatePerformanceMetricsWorklet(performanceSharedValues, gestureStartTime);
      
      // Legacy gesture handling
      runOnJS(logGesture)('Pan Start', {
        translateX: translateX.value,
        translateY: translateY.value,
        scale: scale.value,
        state: currentState
      });
      
      // FIX: Use separate callback to avoid closure capture
      runOnJS(requestStateTransition)(GestureStateType.PAN_STARTING, {
        type: 'pan',
        timestamp: gestureStartTime,
        pointerCount: event.numberOfPointers || 1,
        position: { x: event.x, y: event.y },
      });
      
      // Debug state transition
      runOnJS(logGesture)('State Transition', {
        from: currentState,
        to: 'PAN_STARTING',
        timestamp: gestureStartTime
      });
      
      isDecaying.value = false;
      gestureStateIsActive.value = true;
      lastTranslateX.value = translateX.value;
      lastTranslateY.value = translateY.value;
      velocityX.value = 0;
      velocityY.value = 0;
    })
    .onUpdate((event) => {
      // Transition to active panning state only if in PAN_STARTING
      const currentTime = Date.now();
      
      // Only transition to PAN_ACTIVE if currently in PAN_STARTING (do this once)
      if (gestureSharedState.value === GestureStateType.PAN_STARTING) {
        runOnJS(requestStateTransition)(GestureStateType.PAN_ACTIVE, {
          type: 'pan',
          timestamp: currentTime,
          pointerCount: event.numberOfPointers || 1,
          position: { x: event.x, y: event.y },
        });
        
        // Debug state transition
        runOnJS(logGesture)('State Transition', {
          from: 'PAN_STARTING',
          to: 'PAN_ACTIVE',
          timestamp: currentTime
        });
      }
      
      // Update translation with elastic resistance at boundaries
      const newTranslation = {
        x: lastTranslateX.value + event.translationX,
        y: lastTranslateY.value + event.translationY,
      };
      
      // Apply boundary constraints with elastic resistance
      const constrainedTranslation = constrainGestureBoundsWorklet(
        newTranslation,
        scale.value,
        width,
        height,
        GALAXY_WIDTH,
        GALAXY_HEIGHT
      );
      
      const elasticTranslation = applyElasticResistanceWorklet(
        newTranslation,
        constrainedTranslation,
        0.3
      );
      
      translateX.value = elasticTranslation.x;
      translateY.value = elasticTranslation.y;
      
      // Enhanced velocity smoothing with worklet
      const currentVel = { x: event.velocityX || 0, y: event.velocityY || 0 };
      const prevVel = { x: velocityX.value, y: velocityY.value };
      
      const smoothedVel = gestureSmoothenWorklet(currentVel, prevVel);
      
      prevVelocityX.value = velocityX.value;
      prevVelocityY.value = velocityY.value;
      velocityX.value = smoothedVel.x;
      velocityY.value = smoothedVel.y;
      
      // Track performance
      updatePerformanceMetricsWorklet(performanceSharedValues, currentTime);
      
      // Debug logging with worklet
      if (Math.abs(event.translationX) % 20 < 5 || Math.abs(event.translationY) % 20 < 5) {
        debugGestureWorklet('Pan Update', {
          translation: { x: event.translationX, y: event.translationY },
          velocity: smoothedVel,
          state: gestureSharedState.value,
        }, currentTime, debugSharedValue);
      }
      
      // Real-time viewport updates (throttled)
      if (Math.abs(event.translationX) % 10 < 2 || Math.abs(event.translationY) % 10 < 2) {
        runOnJS(updateViewportState)(translateX.value, translateY.value, scale.value);
      }
    })
    .onEnd((event) => {
      // Track touch end for palm rejection cleanup
      runOnJS(handleTouchEvent)({
        identifier: 0, // Pan is single touch
        x: event.x,
        y: event.y,
        timestamp: Date.now(),
        phase: 'ended',
      });
      
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
        willStartMomentum: isVelocitySignificantForMomentum(smoothedVelocity)
      });
      
      gestureStateIsActive.value = false;
      const currentState = gestureSharedState.value; // Capture state before transition
      
      // Apply elastic constraints only if needed
      const constrainedTranslation = constrainTranslationElastic(
        { x: translateX.value, y: translateY.value },
        width,
        height,
        GALAXY_WIDTH,
        GALAXY_HEIGHT,
        scale.value,
        0.1 // Reduce elasticity to be less aggressive
      );
      
      // Use research-based velocity threshold for momentum
      if (isVelocitySignificantForMomentum(smoothedVelocity)) {
        // Transition to momentum state
        runOnJS(requestStateTransition)(GestureStateType.MOMENTUM_ACTIVE, {
          type: 'momentum',
          timestamp: Date.now(),
          pointerCount: 0,
        });
        
        isDecaying.value = true;
        velocityX.value = smoothedVelocity.x * 0.05; // Use smoothed velocity
        velocityY.value = smoothedVelocity.y * 0.05;
        
        // Debug state transition to momentum
        runOnJS(logGesture)('State Transition', {
          from: currentState,
          to: 'MOMENTUM_ACTIVE',
          reason: 'momentum_start'
        });
        
        // Log momentum start
        runOnJS(logGesture)('Momentum Start', {
          initialVelocity: smoothedVelocity,
          scaledVelocity: { x: smoothedVelocity.x * 0.05, y: smoothedVelocity.y * 0.05 }
        });
      } else {
        // Transition back to idle immediately
        runOnJS(requestStateTransition)(GestureStateType.IDLE, {
          type: 'momentum', 
          timestamp: Date.now(),
          pointerCount: 0,
        });
        
        // Debug state transition back to idle
        runOnJS(logGesture)('State Transition', {
          from: currentState,
          to: 'IDLE',
          reason: 'pan_end_no_momentum'
        });
        
        // Only spring back if significantly out of bounds
        const distance = Math.sqrt(
          Math.pow(constrainedTranslation.x - translateX.value, 2) + 
          Math.pow(constrainedTranslation.y - translateY.value, 2)
        );
        
        if (distance > 5) { // Only snap back if more than 5px out of bounds
          translateX.value = withSpring(constrainedTranslation.x);
          translateY.value = withSpring(constrainedTranslation.y);
        }
      }
      
      // ✅ CORRECT: All gesture handlers use runOnJS for JavaScript calls
      runOnJS(updateViewportState)(constrainedTranslation.x, constrainedTranslation.y, scale.value);
    });

  // Advanced Pinch gesture with state machine integration
  const pinchGesture = Gesture.Pinch()
    .onTouchesCancelled(() => {
      // Handle cancelled touches for better error recovery
      debugGestureWorklet('Pinch Cancelled', {}, Date.now(), debugSharedValue);
    })
    .onStart((event) => {
      const gestureStartTime = Date.now();
      
      // Advanced palm rejection for multi-touch
      const pointerCount = event.numberOfPointers || 2;
      const isPalm = palmRejectionWorklet(
        0, // Area not available in pinch
        0, // Width not available
        0, // Height not available
        pointerCount,
        rapidTouchCount.value
      );
      
      if (isPalm) {
        debugGestureWorklet('Palm Rejected', { reason: 'pinch start', pointerCount }, gestureStartTime, debugSharedValue);
        return;
      }
      
      // State machine transition (simplified)
      const currentState = gestureSharedState.value;
      
      // Track performance
      trackGestureResponseTimeWorklet(performanceSharedValues, gestureStartTime, gestureStartTime);
      
      runOnJS(logGesture)('Pinch Start', {
        focalX: event.focalX,
        focalY: event.focalY,
        initialScale: scale.value,
        currentState,
        pointerCount
      });
      
      // FIX: Use separate callback to avoid closure capture
      runOnJS(requestStateTransition)(GestureStateType.PINCH_STARTING, {
        type: 'pinch',
        timestamp: gestureStartTime,
        pointerCount,
        focalPoint: { x: event.focalX, y: event.focalY },
        scale: event.scale,
      });
      
      isDecaying.value = false;
      gestureStateIsActive.value = true;
      lastScale.value = scale.value;
      lastTranslateX.value = translateX.value;
      lastTranslateY.value = translateY.value;
      
      // Set focal point for zoom
      focalPointX.value = event.focalX;
      focalPointY.value = event.focalY;
      gestureStateFocalPointX.value = event.focalX;
      gestureStateFocalPointY.value = event.focalY;
      gestureStateHasFocalPoint.value = true;
    })
    .onUpdate((event) => {
      const currentTime = Date.now();
      
      // Only transition to PINCH_ACTIVE if currently in PINCH_STARTING (do this once)
      if (gestureSharedState.value === GestureStateType.PINCH_STARTING) {
        runOnJS(requestStateTransition)(GestureStateType.PINCH_ACTIVE, {
          type: 'pinch',
          timestamp: currentTime,
          pointerCount: event.numberOfPointers || 2,
          focalPoint: { x: event.focalX, y: event.focalY },
          scale: event.scale,
        });
      }
      
      // Enhanced scale clamping with worklet
      const newScale = clampScaleWorklet(lastScale.value * (event.scale || 1), 0.1, 10.0);
      
      // Calculate focal point adjustment with worklet
      const focalPoint = { x: event.focalX || width / 2, y: event.focalY || height / 2 };
      const newTranslation = calculateFocalPointZoomWorklet(
        focalPoint,
        { x: lastTranslateX.value, y: lastTranslateY.value },
        lastScale.value,
        newScale
      );
      
      // Apply boundary constraints
      const constrainedTranslation = constrainGestureBoundsWorklet(
        newTranslation,
        newScale,
        width,
        height,
        GALAXY_WIDTH,
        GALAXY_HEIGHT
      );
      
      scale.value = newScale;
      translateX.value = constrainedTranslation.x;
      translateY.value = constrainedTranslation.y;
      
      // Track performance
      updatePerformanceMetricsWorklet(performanceSharedValues, currentTime);
      
      // Debug logging with worklet
      if (Math.abs((event.scale || 1) - 1) > 0.1) {
        debugGestureWorklet('Pinch Update', {
          scale: event.scale,
          newScale,
          focalPoint,
          state: gestureSharedState.value,
        }, currentTime, debugSharedValue);
      }
      
      // Real-time viewport updates (throttled)
      if (Math.abs((event.scale || 1) - lastScale.value) > 0.05) {
        runOnJS(updateViewportState)(constrainedTranslation.x, constrainedTranslation.y, newScale);
      }
    })
    .onEnd(() => {
      runOnJS(logGesture)('Pinch End', {
        finalScale: scale.value,
        finalTranslateX: translateX.value,
        finalTranslateY: translateY.value
      });
      
      gestureStateIsActive.value = false;
      gestureStateHasFocalPoint.value = false;
      
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
    
    // Calculate dynamic hit radius using gesture configuration
    const hitRadius = getConfiguredHitRadius(20, currentScale); // Use configured hit radius
    
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

  // Single tap for beacon/cluster selection or map interaction with optimized thresholds
  const tapThresholds = gestureConfig.getTapThresholds();
  const singleTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .maxDelay(tapThresholds.maxDuration) // Research-based 200ms (or extended for accessibility)
    .minPointers(tapThresholds.minPointers)
    .onEnd((event: any) => {
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

  // Double tap to zoom gesture with optimized timing
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(GESTURE_THRESHOLDS.DOUBLE_TAP.MAX_DELAY) // 300ms between taps
    .onEnd((event: any) => {
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

  // Advanced gesture composition with hierarchical conflict resolution
  const composedGesture = Gesture.Race(
    // Highest priority: Double tap (must be detected before single tap)
    doubleTapGesture,
    
    // Medium priority: Exclusive gesture group
    Gesture.Exclusive(
      // Single tap has failure requirements - fails if pan or pinch starts
      singleTapGesture
        .requireExternalGestureToFail(panGesture)
        .requireExternalGestureToFail(pinchGesture),
      
      // Simultaneous pan + pinch for advanced navigation
      Gesture.Simultaneous(
        panGesture
          .simultaneousWithExternalGesture(pinchGesture),
        pinchGesture
          .simultaneousWithExternalGesture(panGesture)
      )
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
      {/* Gesture Debug Overlay */}
      {__DEV__ && (
        <GestureDebugOverlay
          stateMachine={gestureStateMachine}
          enabled={true}
          position="top-left"
          compact={false}
        />
      )}
      
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