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

import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from 'react';
import debounce from 'lodash.debounce';
import { View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withSpring,
  runOnJS,
  useFrameCallback,
  runOnUI,
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
  Beacon,
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
import DebugOverlay from '../debug/DebugOverlay';
import { SpatialIndex } from '../../utils/spatial/indexing';
import {
  performanceMonitor,
  usePerformanceMonitor,
} from '../../utils/performance/monitor';
import {
  getLODRenderInfo,
  shouldEnableClustering,
} from '../../utils/rendering/lod';
import {
  hierarchicalCluster,
  isPointInCluster,
} from '../../utils/rendering/clustering';
import {
  getConnectionRenderInfo,
  isConnectionVisible,
  isPointNearConnection,
} from '../../utils/rendering/connections';
import {
  buildConnectionsFromBeacons,
  PatternDetector,
  updateConnectionPatterns,
} from '../../utils/patterns/detection';
import { useBackgroundPatternDetection } from '../../hooks/useBackgroundPatternDetection';
import { AsyncPatternAnalyzer } from '../../services/AsyncPatternAnalyzer';
import { CONNECTION_CONFIG } from '../../constants/connections';
import { useBatteryAwarePerformance } from '../../hooks/useBatteryOptimization';
import { gestureConfig, GESTURE_THRESHOLDS } from '../../constants/gestures';
import BeaconRenderer from './BeaconRenderer';
import {
  useStableCallback,
  useSmartMemo,
  useBatchedState,
  useFrameLimitedState,
  useRenderTracker,
} from '../../utils/performance/RenderOptimizations';
import BeaconClusterRenderer from './BeaconCluster';
import ConnectionRenderer from './ConnectionRenderer';
import PatternRenderer, { usePatternRenderingQuality } from './PatternRenderer';
import { PatternSuggestionOverlay } from './PatternSuggestionOverlay';
import {
  usePatternSuggestions,
  usePatternSuggestionActions,
} from '../../contexts/PatternSuggestionContext';
import { PlacementHintSystem } from '../ui/PlacementHintSystem';
import { useSettings } from '../../contexts/SettingsContext';
import {
  preventDefaultEvents,
  applyTouchActionCSS,
  createWebOptimizedPanGesture,
  createWebOptimizedPinchGesture,
  createWebOptimizedTapGesture,
  createWebSimultaneousGestures,
  webGesturePerformanceMonitor,
  cleanupWebGestureResources,
  webTouchEventManager,
  handleWheelEvent,
  IS_WEB,
} from '../../utils/gestures/webGestureHandler';
import { webGestureDebugger } from '../../utils/debugging/WebGestureDebugger';
import StarField from './StarField';
import { ProbeAnimationRenderer } from './ProbeAnimationRenderer';
import { GalacticEnvironmentRenderer } from './GalacticEnvironmentRenderer';
import { PatternSuggestionEngine } from '../../utils/patterns/PatternSuggestionEngine';
import { SpatialPatternCache } from '../../utils/patterns/SpatialPatternCache';
import { SpatialHashMap } from '../../utils/spatial/SpatialHashMap';
import {
  PlacementValidator,
  PlacementConfig,
} from '../../utils/spatial/PlacementValidator';
import { BEACON_PLACEMENT_CONFIG } from '../../types/beacon';
import { Beacon as BeaconEntity } from '../../entities/Beacon';
import { ProbeType } from '../../types/probe';

const AnimatedSvg = Animated.createAnimatedComponent(Svg);
const AnimatedG = Animated.createAnimatedComponent(G);

interface GalaxyMapViewProps extends GalaxyMapProps {
  style?: any;
  gameController?: any; // GameController instance for probe launching
}

export const GalaxyMapView: React.FC<GalaxyMapViewProps> = ({
  width,
  height,
  beacons,
  probes = [],
  onBeaconSelect,
  onMapPress,
  showDebugOverlay = false,
  selectedBeacon = null,
  beaconUpdateTrigger,
  style,
  gameController,
}) => {
  // Performance tracking for this complex component
  useRenderTracker('GalaxyMapView', {
    beaconCount: beacons.length,
    probeCount: probes.length,
    debugOverlay: showDebugOverlay,
  });

  // Battery-aware performance settings
  const {
    targetFrameRate,
    shouldThrottleUpdates,
    updateInterval,
    enableLOD,
    lodDistance,
  } = useBatteryAwarePerformance();
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
  const gestureStateMachine = useMemo(
    () => new GestureStateMachine(gestureSharedState),
    [gestureSharedState]
  );
  const stateChecker = useMemo(
    () => createStateChecker(gestureSharedState),
    [gestureSharedState]
  );

  // Performance tracking shared values - create real SharedValues
  const performanceLastFrameTime = useSharedValue(0);
  const performanceFrameCount = useSharedValue(0);
  const performanceAvgFrameTime = useSharedValue(16.67);
  const performanceDroppedFrames = useSharedValue(0);
  const performanceGestureResponseTime = useSharedValue(0);

  const performanceSharedValues = useMemo(
    () => ({
      lastFrameTime: performanceLastFrameTime,
      frameCount: performanceFrameCount,
      avgFrameTime: performanceAvgFrameTime,
      droppedFrames: performanceDroppedFrames,
      gestureResponseTime: performanceGestureResponseTime,
    }),
    [
      performanceLastFrameTime,
      performanceFrameCount,
      performanceAvgFrameTime,
      performanceDroppedFrames,
      performanceGestureResponseTime,
    ]
  );

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

  // Pattern completion analysis state
  const [patternAnalysis, setPatternAnalysis] = useState<any>(null);

  // Performance monitoring hook
  const { startFrame, endFrame, getQualitySettings } = usePerformanceMonitor();

  // Create a stable ref for updateViewportState to avoid circular dependencies
  const updateViewportStateRef = useRef<
    ((x: number, y: number, s: number) => void) | null
  >(null);

  // Web gesture container ref for event prevention
  const containerRef = useRef<any>(null);

  // Optimized spatial indexing for efficient beacon queries - now using R-tree with smart memoization
  const spatialIndex = useSmartMemo(
    () => {
      const index = new SpatialIndex();
      index.rebuild(beacons);
      return index;
    },
    [beacons.length, beacons.map(b => b.id).join(','), beaconUpdateTrigger],
    (prev, next) => {
      // Custom comparison to avoid rebuilding if beacons haven't actually changed
      return prev && next && prev.getStats().totalBeacons === next.getStats().totalBeacons;
    }
  );

  // Spatial hashing components for pattern suggestions
  const spatialHashMap = useMemo(() => new SpatialHashMap(), []);
  const spatialCache = useMemo(() => new SpatialPatternCache(), []);

  // Optimized placement validator for pattern suggestions with smart memoization
  const placementValidator = useSmartMemo(() => {
    const placementConfig: PlacementConfig = {
      bounds: {
        minX: -10000,
        maxX: 10000,
        minY: -10000,
        maxY: 10000,
      },
      minimumDistances: BEACON_PLACEMENT_CONFIG.MINIMUM_DISTANCE,
      allowOverlap: false,
    };
    const validator = new PlacementValidator(placementConfig);

    // Convert galaxy beacons to the format expected by PlacementValidator
    const entityBeacons = beacons.map(
      beacon =>
        new BeaconEntity({
          id: beacon.id,
          position: beacon.position,
          level: beacon.level || 1,
          type: beacon.type,
          specialization: 'none',
          status: 'active',
          connections: beacon.connections || [],
          createdAt: Date.now(),
          lastUpgraded: Date.now(),
          generationRate: 1.0,
          totalResourcesGenerated: 0,
        })
    );

    validator.updateBeacons(entityBeacons);
    return validator;
  }, [
    beacons.length,
    beacons.map(b => `${b.id}-${b.position.x}-${b.position.y}`).join(','),
    beaconUpdateTrigger,
  ]);

  // Pattern detector with optimized memoization
  const patternDetector = useSmartMemo(
    () =>
      new PatternDetector(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        placementValidator,
        spatialIndex
      ),
    [placementValidator, spatialIndex]
  );

  // Background pattern detection to prevent main thread blocking
  const {
    patterns: backgroundPatterns,
    detectPatternsAsync,
    isWorkerAvailable,
  } = useBackgroundPatternDetection();

  const suggestionEngine = useMemo(
    () =>
      new PatternSuggestionEngine(
        spatialHashMap,
        undefined,
        placementValidator,
        spatialIndex
      ),
    [spatialHashMap, placementValidator, spatialIndex]
  );

  // Pattern suggestion state from context
  const {
    popupVisible,
    mapVisualizationsVisible,
    selectedSuggestion,
    hoveredSuggestion,
    dismissedSuggestions,
    displayMode,
    suggestions,
    updateBeacons,
    hidePopup,
  } = usePatternSuggestions();

  const suggestionActions = usePatternSuggestionActions();

  // Settings context for pattern suggestions
  const { settings } = useSettings();

  // Create suggestionState object for backward compatibility
  const suggestionState = useMemo(() => ({
    popupVisible,
    mapVisualizationsVisible,
    selectedSuggestion,
    hoveredSuggestion,
    dismissedSuggestions,
    displayMode,
    autoHideTimer: null, // Not used in context, but needed for interface compatibility
  }), [popupVisible, mapVisualizationsVisible, selectedSuggestion, hoveredSuggestion, dismissedSuggestions, displayMode]);

  // Debounced pattern analysis to prevent excessive calculations during pan/zoom
  const analyzePatternOpportunitiesDebounced = useMemo(
    () =>
      debounce(
        (
          beacons: any[],
          viewport: ViewportState,
          currentSuggestionState: any
        ) => {
          try {
            // Pass viewport bounds for culling optimization
            const analysis = suggestionEngine.analyzePatternOpportunities(
              beacons,
              [],
              { bounds: viewport.bounds }
            );
            setPatternAnalysis(analysis);
          } catch (error) {
            console.warn('Failed to analyze pattern opportunities:', error);
          }
        },
        300
      ),
    [suggestionEngine]
  );

  // Async pattern analyzer for background processing
  const asyncPatternAnalyzer = useMemo(
    () => new AsyncPatternAnalyzer(suggestionEngine),
    [suggestionEngine]
  );

  // Async pattern analysis to prevent frame drops
  const analyzePatternAsync = useCallback(
    async (beacons: Beacon[], viewport: ViewportState) => {
      if (
        suggestionState.popupVisible ||
        suggestionState.mapVisualizationsVisible
      ) {
        try {
          const analysis = await asyncPatternAnalyzer.analyzeAsync(
            beacons,
            viewport
          );
          setPatternAnalysis(analysis);
        } catch (error) {
          console.warn('Failed to analyze pattern opportunities:', error);
        }
      }
    },
    [
      asyncPatternAnalyzer,
      suggestionState.popupVisible,
      suggestionState.mapVisualizationsVisible,
    ]
  );

  // Track significant viewport changes to avoid unnecessary pattern analysis
  const lastSignificantViewport = useRef<ViewportState>({
    translateX: 0,
    translateY: 0,
    scale: 1,
    bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
  });

  const isSignificantViewportChange = useCallback(
    (newViewport: ViewportState): boolean => {
      const last = lastSignificantViewport.current;

      // Check zoom change (>10% threshold)
      const scaleChange = Math.abs(newViewport.scale - last.scale) / last.scale;
      if (scaleChange > 0.1) {
        return true;
      }

      // Check pan distance (>25% of screen width/height threshold)
      const panDistanceX = Math.abs(newViewport.translateX - last.translateX);
      const panDistanceY = Math.abs(newViewport.translateY - last.translateY);
      const screenThresholdX = width * 0.25;
      const screenThresholdY = height * 0.25;

      if (panDistanceX > screenThresholdX || panDistanceY > screenThresholdY) {
        return true;
      }

      return false;
    },
    [width, height]
  );

  // Check if Pattern Opportunities popup is currently visible (not map visualizations)
  const isPatternHintPopupVisible = useMemo(() => {
    return (
      suggestionState.popupVisible &&
      (patternAnalysis?.suggestedPositions?.length || 0) > 0
    );
  }, [
    suggestionState.popupVisible,
    patternAnalysis?.suggestedPositions?.length,
  ]);

  // Pattern rendering quality settings based on performance
  const patternRenderingQuality = usePatternRenderingQuality(
    renderingState.patterns.length,
    viewportState.scale
  );

  // Initialize performance monitoring and cleanup
  React.useEffect(() => {
    performanceMonitor.start();
    return () => {
      performanceMonitor.stop();
      asyncPatternAnalyzer.cleanup();
    };
  }, [asyncPatternAnalyzer]);

  // Update context with beacon changes and trigger pattern analysis
  useEffect(() => {
    // Update context with current beacons for pattern count calculation
    updateBeacons(beacons);

    if (
      beacons.length > 0 &&
      (suggestionState.popupVisible || suggestionState.mapVisualizationsVisible)
    ) {
      // Update the suggestion engine's spatial index with current beacons
      suggestionEngine.updateSpatialIndex(beacons);

      // Cancel any pending debounced call and analyze immediately
      analyzePatternOpportunitiesDebounced.cancel();
      analyzePatternOpportunitiesDebounced(
        beacons,
        viewportState,
        suggestionState
      );
    }
  }, [
    beacons,
    beacons.length,
    updateBeacons,
    analyzePatternOpportunitiesDebounced,
    viewportState,
    suggestionState,
    suggestionEngine,
  ]);
  // Pattern analysis trigger when beacons change (completely async now)
  useEffect(() => {
    if (beacons.length > 0) {
      // Use async analyzer with placement cooldown
      analyzePatternAsync(beacons, viewportState);
    }
  }, [beacons.length, beacons, analyzePatternAsync, viewportState]);

  // Debug logging helper - defined early so it's available in worklets
  const logGesture = useCallback((type: string, data: any) => {
    console.log(`[GalaxyMap] ${type}:`, data);
  }, []);

  // FIX: State transition helper to avoid closure capture in runOnJS
  const requestStateTransition = useCallback(
    (targetState: GestureStateType, eventData: any) => {
      gestureStateMachine.requestTransition(targetState, eventData);
    },
    [gestureStateMachine]
  );

  // Palm rejection tracking - Use serializable string storage to avoid JSI crashes
  const activeTouchesData = useSharedValue(''); // JSON string storage
  const recentTouchesData = useSharedValue(''); // JSON string storage

  // Palm rejection helper (called via runOnJS) - Fixed for JSI serialization
  const handleTouchEvent = useCallback(
    (touchData: {
      identifier: number;
      x: number;
      y: number;
      timestamp: number;
      phase: 'began' | 'moved' | 'ended';
      activeTouchesDataValue: string | null;
      recentTouchesDataValue: string | null;
    }) => {
      const now = Date.now();

      try {
        // Parse current data from serializable storage
        let activeTouches: Record<
          number,
          { x: number; y: number; timestamp: number }
        > = {};
        let recentTouches: { x: number; y: number; timestamp: number }[] = [];

        try {
          if (touchData.activeTouchesDataValue) {
            activeTouches = JSON.parse(touchData.activeTouchesDataValue);
          }
          if (touchData.recentTouchesDataValue) {
            recentTouches = JSON.parse(touchData.recentTouchesDataValue);
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
                touchId: touchData.identifier,
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
                touchId: touchData.identifier,
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
    },
    [logGesture, activeTouchesData, recentTouchesData]
  );

  // Update viewport and rendering state callback
  const updateViewportState = useCallback(
    (newTranslateX: number, newTranslateY: number, newScale: number) => {
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
      const limitedBeacons = visibleBeacons.slice(
        0,
        qualitySettings.maxVisibleBeacons
      );

      // Use battery-aware LOD settings
      const adjustedLodBias = qualitySettings.lodBias * lodDistance;
      const lodInfo = getLODRenderInfo(newScale, adjustedLodBias);
      const shouldCluster = enableLOD
        ? shouldEnableClustering(limitedBeacons, newScale, newViewport)
        : false;

      let clusters: BeaconCluster[] = [];
      let remainingBeacons = limitedBeacons;

      if (shouldCluster) {
        const clusterResult = hierarchicalCluster(limitedBeacons, newScale);
        clusters = clusterResult.clusters;
        remainingBeacons = clusterResult.remainingBeacons;
      }

      // Build connections from all beacons (not just visible ones for pattern detection)
      const allConnections = buildConnectionsFromBeacons(beacons);

      // Use background patterns to avoid main thread blocking
      // Trigger async pattern detection for next frame
      if (qualitySettings.enableAnimations && isWorkerAvailable) {
        detectPatternsAsync(beacons, allConnections);
      }

      // Use cached background patterns or fallback to empty
      const patterns = backgroundPatterns;

      // Update connections with pattern information
      const connectionsWithPatterns = updateConnectionPatterns(
        allConnections,
        patterns
      );

      // Filter connections to only those that are visible with performance limits
      const beaconMap = new Map(beacons.map(b => [b.id, b]));
      const visibleConnections = connectionsWithPatterns
        .filter(connection => {
          const sourceBeacon = beaconMap.get(connection.sourceId);
          const targetBeacon = beaconMap.get(connection.targetId);

          if (!sourceBeacon || !targetBeacon) return false;

          return isConnectionVisible(
            connection,
            sourceBeacon,
            targetBeacon,
            newViewport
          );
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

      // Update pattern suggestions only on significant viewport changes (async for performance)
      if (patterns.length > 0 && isSignificantViewportChange(newViewport)) {
        lastSignificantViewport.current = newViewport;
        analyzePatternAsync(beacons, newViewport);
      }

      endFrame(); // End performance monitoring
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      width,
      height,
      spatialIndex,
      patternDetector,
      beacons,
      startFrame,
      endFrame,
      getQualitySettings,
      isSignificantViewportChange,
      analyzePatternAsync,
      suggestionState,
      backgroundPatterns,
      detectPatternsAsync,
      isWorkerAvailable,
      enableLOD,
      lodDistance,
    ]
  );

  // Store the function in ref to prevent circular dependencies
  updateViewportStateRef.current = updateViewportState;

  // Web-specific gesture setup and event prevention
  React.useEffect(() => {
    if (!IS_WEB || !containerRef.current) return;

    const containerElement = containerRef.current;

    // Apply touch-action CSS and web-specific styles
    applyTouchActionCSS(containerElement, 'none');

    // Prevent default browser behaviors
    const cleanupEventPrevention = preventDefaultEvents(containerElement);

    // Attach advanced touch event manager
    const cleanupTouchManager =
      webTouchEventManager.attachToElement(containerElement);

    // Handle wheel events for desktop zoom/pan
    const cleanupWheelHandler = handleWheelEvent(
      containerElement,
      ({ x, y, scale: wheelScale }) => {
        if (wheelScale !== 1) {
          // Wheel zoom
          const newScale = clampScale(scale.value * wheelScale);
          const centerPoint = { x: width / 2, y: height / 2 };

          const newTranslation = calculateZoomFocalPoint(
            centerPoint,
            { x: translateX.value, y: translateY.value },
            scale.value,
            newScale
          );

          // Apply constraints
          const constrainedTranslation = constrainTranslationElastic(
            newTranslation,
            width,
            height,
            GALAXY_WIDTH,
            GALAXY_HEIGHT,
            newScale
          );

          scale.value = withSpring(newScale);
          translateX.value = withSpring(constrainedTranslation.x);
          translateY.value = withSpring(constrainedTranslation.y);

          updateViewportState(
            constrainedTranslation.x,
            constrainedTranslation.y,
            newScale
          );
        } else if (x !== 0 || y !== 0) {
          // Wheel pan
          const newTranslateX = translateX.value - x * 0.5;
          const newTranslateY = translateY.value - y * 0.5;

          translateX.value = newTranslateX;
          translateY.value = newTranslateY;

          updateViewportState(newTranslateX, newTranslateY, scale.value);
        }
      }
    );

    return () => {
      cleanupWebGestureResources();
      if (cleanupEventPrevention) {
        cleanupEventPrevention();
      }
      if (cleanupTouchManager) {
        cleanupTouchManager();
      }
      if (cleanupWheelHandler) {
        cleanupWheelHandler();
      }
    };
  }, [width, height, updateViewportState, scale, translateX, translateY]);

  // Advanced Pan gesture with state machine integration and web optimizations

  // Frame skip counter for performance optimization
  const frameSkipCounter = useSharedValue(0);

  // Momentum physics frame callback
  // WORKLET PATTERN: useFrameCallback with runOnJS for state updates
  useFrameCallback(frameInfo => {
    // Skip frames if previous frame took too long (> 20ms = 50fps)
    const deltaTime = frameInfo.timeSincePreviousFrame || 16.67;
    if (deltaTime > 20) {
      frameSkipCounter.value++;
      if (frameSkipCounter.value % 2 !== 0) {
        return; // Skip this frame to recover performance
      }
    } else {
      frameSkipCounter.value = 0; // Reset counter on good performance
    }

    if (isDecaying.value && !gestureStateIsActive.value) {
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

        // Update shared state immediately in worklet for thread synchronization
        gestureSharedState.value = GestureStateType.IDLE;

        // Momentum stopped - no more JS thread state transitions needed

        runOnJS(logGesture)('Momentum Stopped', {
          finalTranslateX: translateX.value,
          finalTranslateY: translateY.value,
        });

        runOnJS(logGesture)('State Transition', {
          from: 'MOMENTUM',
          to: 'IDLE',
          reason: 'momentum_end',
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

  // Web-specific gesture setup and event prevention
  React.useEffect(() => {
    if (!IS_WEB || !containerRef.current) return;

    const containerElement = containerRef.current;

    // Apply touch-action CSS and web-specific styles
    applyTouchActionCSS(containerElement, 'none');

    // Prevent default browser behaviors
    const cleanupEventPrevention = preventDefaultEvents(containerElement);

    // Attach advanced touch event manager
    const cleanupTouchManager =
      webTouchEventManager.attachToElement(containerElement);

    // Handle wheel events for desktop zoom/pan
    const cleanupWheelHandler = handleWheelEvent(
      containerElement,
      ({ x, y, scale: wheelScale }) => {
        if (wheelScale !== 1) {
          // Wheel zoom
          const newScale = clampScale(scale.value * wheelScale);
          const centerPoint = { x: width / 2, y: height / 2 };

          const newTranslation = calculateZoomFocalPoint(
            centerPoint,
            { x: translateX.value, y: translateY.value },
            scale.value,
            newScale
          );

          // Apply constraints
          const constrainedTranslation = constrainTranslationElastic(
            newTranslation,
            width,
            height,
            GALAXY_WIDTH,
            GALAXY_HEIGHT,
            newScale
          );

          scale.value = withSpring(newScale);
          translateX.value = withSpring(constrainedTranslation.x);
          translateY.value = withSpring(constrainedTranslation.y);

          updateViewportState(
            constrainedTranslation.x,
            constrainedTranslation.y,
            newScale
          );
        } else if (x !== 0 || y !== 0) {
          // Wheel pan
          const newTranslateX = translateX.value - x * 0.5;
          const newTranslateY = translateY.value - y * 0.5;

          translateX.value = newTranslateX;
          translateY.value = newTranslateY;

          updateViewportState(newTranslateX, newTranslateY, scale.value);
        }
      }
    );

    return () => {
      cleanupWebGestureResources();
      if (cleanupEventPrevention) {
        cleanupEventPrevention();
      }
      if (cleanupTouchManager) {
        cleanupTouchManager();
      }
      if (cleanupWheelHandler) {
        cleanupWheelHandler();
      }
    };
  }, [width, height, updateViewportState, scale, translateX, translateY]);

  // Advanced Pan gesture with state machine integration and web optimizations
  const panThresholds = gestureConfig.getPanThresholds();
  const basePanGesture = IS_WEB
    ? createWebOptimizedPanGesture()
    : Gesture.Pan();
  const panGesture = basePanGesture
    .minDistance(panThresholds.minDistance)
    // FIX: Remove .activateAfterLongPress(0) - it causes JSI crashes when delay is 0
    // .activateAfterLongPress(panThresholds.activationDelay)
    .minPointers(panThresholds.minPointers)
    .maxPointers(panThresholds.maxPointers)
    .shouldCancelWhenOutside(false) // Allow dragging outside bounds
    .runOnJS(true)
    .onStart(event => {
      // Advanced gesture state management
      const gestureStartTime = Date.now();

      // Web performance tracking
      if (IS_WEB) {
        webGesturePerformanceMonitor.startGesture();

        // Debug event recording
        webGestureDebugger.recordEvent({
          id: `pan-${gestureStartTime}`,
          type: 'gesture',
          action: 'start',
          timestamp: gestureStartTime,
          coordinates: { x: event.x || 0, y: event.y || 0 },
          target: 'galaxy-map',
          data: {
            gestureType: 'pan',
            pointerCount: event.numberOfPointers || 1,
            translationX: event.translationX || 0,
            translationY: event.translationY || 0,
          },
        });
      }

      // Palm rejection check
      const isPalm = palmRejectionWorklet(
        event.handlerTag || 0, // Use handlerTag as area approximation
        0, // Width not available in pan gesture
        0, // Height not available in pan gesture
        event.numberOfPointers || 1,
        rapidTouchCount.value
      );

      if (isPalm) {
        debugGestureWorklet(
          'Palm Rejected',
          { reason: 'pan start' },
          gestureStartTime,
          debugSharedValue
        );
        return; // Exit early if palm detected
      }

      // Simplified state check - much more permissive
      const currentState = gestureSharedState.value;

      // Only block if we're already panning (avoid double pan start)
      if (currentState === GestureStateType.PANNING) {
        debugGestureWorklet(
          'Pan Start Blocked',
          {
            currentState,
            reason: 'already_panning',
          },
          gestureStartTime,
          debugSharedValue
        );
        return;
      }

      // Update rapid touch tracking
      if (gestureStartTime - lastTouchTime.value < 100) {
        rapidTouchCount.value++;
      } else {
        rapidTouchCount.value = 1;
      }
      lastTouchTime.value = gestureStartTime;

      // Track performance
      updatePerformanceMetricsWorklet(
        performanceSharedValues,
        gestureStartTime
      );

      // Legacy gesture handling
      runOnJS(logGesture)('Pan Start', {
        translateX: translateX.value,
        translateY: translateY.value,
        scale: scale.value,
        state: currentState,
      });

      // FIX: Directly update shared state only (no redundant JS thread call)
      gestureSharedState.value = GestureStateType.PANNING;

      // Debug state transition
      runOnJS(logGesture)('State Transition', {
        from: currentState,
        to: 'PANNING',
        timestamp: gestureStartTime,
      });

      isDecaying.value = false;
      gestureStateIsActive.value = true;
      lastTranslateX.value = translateX.value;
      lastTranslateY.value = translateY.value;
      velocityX.value = 0;
      velocityY.value = 0;
    })
    .onUpdate(event => {
      // Simplified - we're already in PANNING state, no need to transition
      const currentTime = Date.now();

      // Web performance tracking
      if (IS_WEB) {
        webGesturePerformanceMonitor.trackEvent();

        // Debug event recording for significant moves
        if (
          Math.abs(event.translationX) % 20 < 5 ||
          Math.abs(event.translationY) % 20 < 5
        ) {
          webGestureDebugger.recordEvent({
            id: `pan-${Date.now()}`,
            type: 'gesture',
            action: 'move',
            timestamp: currentTime,
            coordinates: { x: event.x || 0, y: event.y || 0 },
            target: 'galaxy-map',
            data: {
              gestureType: 'pan',
              translationX: event.translationX || 0,
              translationY: event.translationY || 0,
              velocityX: event.velocityX || 0,
              velocityY: event.velocityY || 0,
            },
          });
        }
      }

      // Ensure we're still in panning state (might be interrupted)
      if (gestureSharedState.value !== GestureStateType.PANNING) {
        return; // Exit if state changed (e.g., pinch started)
      }

      // Update translation directly without constraint interference
      // Let user pan freely - they can see what they're doing
      translateX.value = lastTranslateX.value + event.translationX;
      translateY.value = lastTranslateY.value + event.translationY;

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
      if (
        Math.abs(event.translationX) % 20 < 5 ||
        Math.abs(event.translationY) % 20 < 5
      ) {
        debugGestureWorklet(
          'Pan Update',
          {
            translation: { x: event.translationX, y: event.translationY },
            velocity: smoothedVel,
            state: gestureSharedState.value,
          },
          currentTime,
          debugSharedValue
        );
      }

      // Real-time viewport updates (heavily throttled for performance)
      if (
        Math.abs(event.translationX) % 25 < 3 ||
        Math.abs(event.translationY) % 25 < 3
      ) {
        runOnJS(updateViewportState)(
          translateX.value,
          translateY.value,
          scale.value
        );
      }
    })
    .onEnd(event => {
      // Track touch end for palm rejection cleanup
      runOnJS(handleTouchEvent)({
        identifier: 0, // Pan is single touch
        x: event.x,
        y: event.y,
        timestamp: Date.now(),
        phase: 'ended',
        activeTouchesDataValue: activeTouchesData.value,
        recentTouchesDataValue: recentTouchesData.value,
      });

      const finalVelocity = { x: velocityX.value, y: velocityY.value };

      // Web performance tracking
      // Smart velocity filtering to prevent finger-lift artifacts
      const currentVelocity = { x: velocityX.value, y: velocityY.value };
      const previousVelocity = {
        x: prevVelocityX.value,
        y: prevVelocityY.value,
      };

      // Check for velocity spikes (finger lift artifacts)
      const velocityJumpX = Math.abs(currentVelocity.x - previousVelocity.x);
      const velocityJumpY = Math.abs(currentVelocity.y - previousVelocity.y);
      const isLikelyFingerLift = velocityJumpX > 100 || velocityJumpY > 100;

      // Use previous velocity if current one seems like a finger-lift artifact
      const smoothedVelocity = isLikelyFingerLift
        ? previousVelocity
        : currentVelocity;

      if (IS_WEB) {
        webGesturePerformanceMonitor.endGesture();

        // Debug event recording
        webGestureDebugger.recordEvent({
          id: `pan-end-${Date.now()}`,
          type: 'gesture',
          action: 'end',
          timestamp: Date.now(),
          coordinates: { x: event.x || 0, y: event.y || 0 },
          target: 'galaxy-map',
          data: {
            gestureType: 'pan',
            finalTranslateX: translateX.value,
            finalTranslateY: translateY.value,
            finalVelocity: finalVelocity,
            willStartMomentum:
              isVelocitySignificantForMomentum(smoothedVelocity),
          },
        });
      }

      runOnJS(logGesture)('Pan End', {
        finalTranslateX: translateX.value,
        finalTranslateY: translateY.value,
        rawVelocity: finalVelocity,
        smoothedVelocity: smoothedVelocity,
        isLikelyFingerLift: isLikelyFingerLift,
        willStartMomentum: isVelocitySignificantForMomentum(smoothedVelocity),
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
        // Update shared state immediately in worklet for thread synchronization
        gestureSharedState.value = GestureStateType.MOMENTUM;

        isDecaying.value = true;
        velocityX.value = smoothedVelocity.x * 0.05; // Use smoothed velocity
        velocityY.value = smoothedVelocity.y * 0.05;

        // Debug state transition to momentum
        runOnJS(logGesture)('State Transition', {
          from: currentState,
          to: 'MOMENTUM',
          reason: 'momentum_start',
        });

        // Log momentum start
        runOnJS(logGesture)('Momentum Start', {
          initialVelocity: smoothedVelocity,
          scaledVelocity: {
            x: smoothedVelocity.x * 0.05,
            y: smoothedVelocity.y * 0.05,
          },
        });
      } else {
        // Update shared state immediately in worklet for thread synchronization
        gestureSharedState.value = GestureStateType.IDLE;

        // Debug state transition back to idle
        runOnJS(logGesture)('State Transition', {
          from: currentState,
          to: 'IDLE',
          reason: 'pan_end_no_momentum',
        });

        // Don't snap position - let user see where they dragged
        // Only apply constraints if user actually dragged outside bounds during gesture
      }

      // ✅ CORRECT: Use actual position, not constrained - let user see where they dragged
      runOnJS(updateViewportState)(
        translateX.value,
        translateY.value,
        scale.value
      );
    });

  // Advanced Pinch gesture with state machine integration and web optimizations
  const basePinchGesture = IS_WEB
    ? createWebOptimizedPinchGesture()
    : Gesture.Pinch();
  const pinchGesture = basePinchGesture
    .runOnJS(true)
    .onTouchesCancelled(() => {
      // Handle cancelled touches for better error recovery
      debugGestureWorklet('Pinch Cancelled', {}, Date.now(), debugSharedValue);
    })
    .onStart(event => {
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
        debugGestureWorklet(
          'Palm Rejected',
          { reason: 'pinch start', pointerCount },
          gestureStartTime,
          debugSharedValue
        );
        return;
      }

      // Simplified state check - allow pinch if not already pinching
      const currentState = gestureSharedState.value;

      if (currentState === GestureStateType.PINCHING) {
        debugGestureWorklet(
          'Pinch Start Blocked',
          {
            currentState,
            reason: 'already_pinching',
          },
          gestureStartTime,
          debugSharedValue
        );
        return; // Don't start pinch if already pinching
      }

      // Track performance
      trackGestureResponseTimeWorklet(
        performanceSharedValues,
        gestureStartTime,
        gestureStartTime
      );

      runOnJS(logGesture)('Pinch Start', {
        focalX: event.focalX,
        focalY: event.focalY,
        initialScale: scale.value,
        currentState,
        pointerCount,
      });

      // FIX: Directly update shared state only (no redundant JS thread call)
      gestureSharedState.value = GestureStateType.PINCHING;

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
    .onUpdate(event => {
      const currentTime = Date.now();

      // Simplified - we're already in PINCHING state, no need to transition
      // Ensure we're still in pinching state (might be interrupted)
      if (gestureSharedState.value !== GestureStateType.PINCHING) {
        return; // Exit if state changed (e.g., pan started)
      }

      // Enhanced scale clamping with worklet
      const newScale = clampScaleWorklet(
        lastScale.value * (event.scale || 1),
        0.1,
        10.0
      );

      // Calculate focal point adjustment with worklet
      const focalPoint = {
        x: event.focalX || width / 2,
        y: event.focalY || height / 2,
      };
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
        debugGestureWorklet(
          'Pinch Update',
          {
            scale: event.scale,
            newScale,
            focalPoint,
            state: gestureSharedState.value,
          },
          currentTime,
          debugSharedValue
        );
      }

      // Real-time viewport updates (heavily throttled for performance)
      if (Math.abs((event.scale || 1) - lastScale.value) > 0.1) {
        runOnJS(updateViewportState)(
          constrainedTranslation.x,
          constrainedTranslation.y,
          newScale
        );
      }
    })
    .onEnd(() => {
      const currentState = gestureSharedState.value; // Capture state before transition

      runOnJS(logGesture)('Pinch End', {
        finalScale: scale.value,
        finalTranslateX: translateX.value,
        finalTranslateY: translateY.value,
      });

      gestureStateIsActive.value = false;
      gestureStateHasFocalPoint.value = false;

      // Update shared state immediately in worklet for thread synchronization
      gestureSharedState.value = GestureStateType.IDLE;

      // Debug state transition back to idle
      runOnJS(logGesture)('State Transition', {
        from: currentState,
        to: 'IDLE',
        reason: 'pinch_end',
      });

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
      // Don't spring translation back - keep where user pinched

      runOnJS(updateViewportState)(
        translateX.value,
        translateY.value,
        clampedScale
      );
    });

  // Handle pattern suggestion interactions with stable callback
  const handleSuggestionInteraction = useStableCallback(
    (event: any) => {
      suggestionActions.onSuggestionInteraction(event);
    },
    [suggestionActions]
  );

  // Handle placement hint interactions with stable callback
  const handleHintPress = useStableCallback(
    (suggestion: any) => {
      if (
        onMapPress &&
        suggestion.allMissingPositions &&
        suggestion.allMissingPositions.length > 1
      ) {
        // Place multiple beacons with small delays to avoid race conditions
        suggestion.allMissingPositions.forEach(
          (position: any, index: number) => {
            setTimeout(() => {
              onMapPress(position);
            }, index * 50); // 50ms delay between placements
          }
        );
      } else if (onMapPress) {
        // Single position placement (either only one missing or fallback)
        const position =
          suggestion.allMissingPositions?.[0] || suggestion.suggestedPosition;
        onMapPress(position);
      }
      suggestionActions.selectSuggestion(suggestion);
    },
    [onMapPress, suggestionActions]
  );

  // Handle single tap - worklet-safe callback that receives necessary data as parameters
  // WORKLET PATTERN: Pass React state as parameters instead of closure capture
  const handleSingleTap = useStableCallback(
    (
      tapX: number,
      tapY: number,
      currentScale: number,
      currentTranslateX: number,
      currentTranslateY: number,
      viewportBounds: any,
      clusters: any[],
      connections: any[],
      visibleBeacons: any[],
      beaconsArray: any[],
      isPopupVisible: boolean
    ) => {
      // Don't process taps if the Pattern Opportunities popup is visible
      if (isPopupVisible) {
        return;
      }

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

      // Create beacon map for fresh data lookup using passed beaconsArray
      const beaconMap = new Map(beaconsArray.map(b => [b.id, b]));

      // Check if tap hits any cluster first (they're larger)
      for (const cluster of clusters) {
        if (isPointInCluster(galaxyPoint, cluster)) {
          // Handle cluster tap - could expand cluster or show cluster info
          if (onBeaconSelect && cluster.beacons.length > 0) {
            // Get fresh beacon data from the beacons array instead of using stale reference
            const freshBeacon =
              beaconMap.get(cluster.beacons[0].id) || cluster.beacons[0];
            onBeaconSelect(freshBeacon);
          }
          return; // Early return if cluster was hit
        }
      }

      // Check if tap hits any visible beacon first (higher priority)
      let selectedBeacon = null;
      for (const beacon of visibleBeacons) {
        if (isPointInHitArea(galaxyPoint, beacon.position, hitRadius)) {
          // Get fresh beacon data from the beacons array instead of using stale reference
          selectedBeacon = beaconMap.get(beacon.id) || beacon;
          break; // Select first hit beacon
        }
      }

      // Only check connections if no beacon was directly hit
      let selectedConnection = null;
      if (!selectedBeacon) {
        for (const connection of connections) {
          const sourceBeacon = beaconMap.get(connection.sourceId);
          const targetBeacon = beaconMap.get(connection.targetId);

          if (sourceBeacon && targetBeacon) {
            if (
              isPointNearConnection(
                galaxyPoint,
                sourceBeacon.position,
                targetBeacon.position,
                hitRadius
              )
            ) {
              selectedConnection = connection;
              break;
            }
          }
        }
      }

      if (selectedBeacon && onBeaconSelect) {
        onBeaconSelect(selectedBeacon);
      } else if (selectedConnection) {
        // Handle connection selection - could show connection info
        // For now, select the source beacon
        const sourceBeacon = beaconMap.get(selectedConnection.sourceId);
        if (sourceBeacon && onBeaconSelect) {
          onBeaconSelect(sourceBeacon);
        }
      } else if (onMapPress) {
        onMapPress(galaxyPoint);
      }
    },
    [beacons, onBeaconSelect, onMapPress, isPatternHintPopupVisible]
  );

  // Single tap for beacon/cluster selection or map interaction with optimized thresholds
  const tapThresholds = gestureConfig.getTapThresholds();
  const baseSingleTapGesture = IS_WEB
    ? createWebOptimizedTapGesture()
    : Gesture.Tap();
  const singleTapGesture = baseSingleTapGesture
    .numberOfTaps(1)
    .maxDelay(tapThresholds.maxDuration) // Research-based 200ms (or extended for accessibility)
    .minPointers(tapThresholds.minPointers)
    .runOnJS(true)
    .onStart(() => {
      // Set tapping state
      gestureSharedState.value = GestureStateType.TAPPING;
    })
    .onEnd((event: any) => {
      // Reset to idle
      gestureSharedState.value = GestureStateType.IDLE;

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
        renderingState.visibleBeacons,
        beacons,
        isPatternHintPopupVisible
      );
    });

  // Double tap to zoom gesture with optimized timing
  const baseDoubleTapGesture = IS_WEB
    ? createWebOptimizedTapGesture()
    : Gesture.Tap();
  const doubleTapGesture = baseDoubleTapGesture
    .numberOfTaps(2)
    .maxDelay(GESTURE_THRESHOLDS.DOUBLE_TAP.MAX_DELAY) // 300ms between taps
    .runOnJS(true)
    .onEnd((event: any) => {
      const currentScale = scale.value;
      const targetScale = currentScale < 2 ? 3 : 1; // Zoom in to 3x or out to 1x
      const focalPoint = { x: event.x, y: event.y };

      runOnJS(logGesture)('Double Tap', {
        tapX: event.x,
        tapY: event.y,
        currentScale,
        targetScale,
        action: currentScale < 2 ? 'zoom in' : 'zoom out',
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
      translateX.value = withSpring(constrainedTranslation.x, {
        damping: 20,
        stiffness: 300,
      });
      translateY.value = withSpring(constrainedTranslation.y, {
        damping: 20,
        stiffness: 300,
      });

      runOnJS(updateViewportState)(
        constrainedTranslation.x,
        constrainedTranslation.y,
        targetScale
      );
    });

  // Web-optimized gesture composition
  const gestureArray = [
    // Double tap must be detected first to prevent single tap
    doubleTapGesture,

    // Single tap should fail if pan/pinch activates
    singleTapGesture
      .requireExternalGestureToFail(panGesture)
      .requireExternalGestureToFail(pinchGesture),

    // Pan and pinch can work simultaneously
    panGesture.simultaneousWithExternalGesture(pinchGesture),
    pinchGesture.simultaneousWithExternalGesture(panGesture),
  ];

  const composedGesture = IS_WEB
    ? createWebSimultaneousGestures(gestureArray)
    : Gesture.Race(
        doubleTapGesture,
        Gesture.Simultaneous(
          singleTapGesture
            .requireExternalGestureToFail(panGesture)
            .requireExternalGestureToFail(pinchGesture),
          panGesture.simultaneousWithExternalGesture(pinchGesture),
          pinchGesture.simultaneousWithExternalGesture(panGesture)
        )
      );

  // Create animated props for SVG group transform
  const animatedProps = useAnimatedProps(() => {
    return {
      transform: `translate(${translateX.value}, ${translateY.value}) scale(${scale.value})`,
    };
  });

  // Get LOD rendering information with battery-aware settings
  const lodRenderInfo = useMemo(() => {
    return getLODRenderInfo(viewportState.scale, 1.0 * lodDistance);
  }, [viewportState.scale, lodDistance]);

  // Force update rendering state when beacons change
  React.useEffect(() => {
    if (beaconUpdateTrigger !== undefined && updateViewportStateRef.current) {
      // Copy the function reference to avoid worklet capturing the ref object
      const updateFn = updateViewportStateRef.current;

      // Force a viewport update to refresh spatial index and visible beacons
      // Use runOnUI to properly access shared values from JS thread
      runOnUI(() => {
        'worklet';
        const x = translateX.value;
        const y = translateY.value;
        const s = scale.value;
        runOnJS(updateFn)(x, y, s);
      })();
    }
  }, [beaconUpdateTrigger, scale, translateX, translateY]);

  // Immediately clear rendering state when beacons are cleared
  React.useEffect(() => {
    if (beacons.length === 0) {
      console.log('[GalaxyMapView] Beacons cleared - immediately updating rendering state');
      setRenderingState(prev => ({
        ...prev,
        visibleBeacons: [],
        clusters: [],
        connections: [],
        patterns: [],
      }));
    }
  }, [beacons.length]);

  return (
    <View
      ref={containerRef}
      style={[{ width, height }, style]}
      className="galaxy-map-container"
    >
      {/* Debug Overlay */}
      {__DEV__ && showDebugOverlay && (
        <DebugOverlay
          stateMachine={gestureStateMachine}
          selectedBeacon={selectedBeacon}
          enabled={true}
          position="top-left"
          compact={false}
        />
      )}

      <GestureDetector gesture={composedGesture}>
        <Animated.View style={{ flex: 1 }} className="galaxy-map-container">
          <AnimatedSvg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="galaxy-map-container"
          >
            {/* Background galaxy space */}
            <Rect x="0" y="0" width={width} height={height} fill="#0F172A" />

            {/* Star field background with parallax - stays fixed */}
            <StarField
              viewportState={viewportState}
              width={width}
              height={height}
              enableParallax={
                performanceMonitor.getQualitySettings().enableParallax
              }
              densityFactor={
                performanceMonitor.getQualitySettings().starDensity
              }
            />

            {/* Transformable galaxy content group */}
            <AnimatedG animatedProps={animatedProps}>
              {/* Living Galactic Environment Layer */}
              <GalacticEnvironmentRenderer
                viewportState={viewportState}
                config={{
                  enableStarSystems: true,
                  enableSectorBoundaries: viewportState.scale < 2, // Only show at low zoom
                  enableEntropyVisualization: true,
                  enableDecayEffects: viewportState.scale > 0.5,
                  enableHarvestOverlay: viewportState.scale > 1,
                  enableEntropySpread: true,
                }}
                onResourceHarvest={(starSystem, resourceType, amount) => {
                  console.log(`Harvested ${amount} ${resourceType} from star ${starSystem.id}`);
                  // TODO: Connect to game resource system
                }}
                onEnvironmentChange={(stats) => {
                  console.log('Environment stats:', stats);
                  // TODO: Update game statistics
                }}
              />

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
                .slice(
                  0,
                  CONNECTION_CONFIG.PERFORMANCE.MAX_CONNECTIONS_PER_FRAME
                )
                .map(connection => {
                  const sourceBeacon = beacons.find(
                    b => b.id === connection.sourceId
                  );
                  const targetBeacon = beacons.find(
                    b => b.id === connection.targetId
                  );

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

              {/* Render geometric patterns (after connections, before beacons) */}
              <PatternRenderer
                patterns={renderingState.patterns}
                beacons={beacons}
                viewportState={viewportState}
                screenWidth={width}
                screenHeight={height}
                qualitySettings={patternRenderingQuality}
                onPatternPress={pattern => {
                  // TODO: Add pattern info overlay or tooltip
                }}
              />

              {/* Render beacon clusters */}
              {renderingState.clusters.map(cluster => (
                <BeaconClusterRenderer
                  key={cluster.id}
                  cluster={cluster}
                  viewportState={viewportState}
                  onPress={
                    onBeaconSelect
                      ? cluster => {
                          // Handle cluster press - for now select first beacon
                          if (cluster.beacons.length > 0) {
                            onBeaconSelect(cluster.beacons[0]);
                          }
                        }
                      : undefined
                  }
                />
              ))}

              {/* Render individual visible beacons */}
              {renderingState.visibleBeacons.map(beacon => (
                <BeaconRenderer
                  key={beacon.id}
                  beacon={beacon}
                  lodInfo={lodRenderInfo}
                  viewportState={viewportState}
                />
              ))}

              {/* Pattern suggestion overlay - only render when enabled in settings */}
              {settings.patternSuggestionsEnabled && (
                <PatternSuggestionOverlay
                  suggestions={suggestions}
                  beacons={beacons}
                  viewportState={viewportState}
                  suggestionState={suggestionState}
                  onSuggestionInteraction={handleSuggestionInteraction}
                  showGhostBeacons={true}
                  showPatternPreviews={true}
                  enableAnimations={!renderingState.performanceMode}
                />
              )}
            </AnimatedG>
          </AnimatedSvg>

          {/* Probe Travel Animations - Render above SVG content */}
          <ProbeAnimationRenderer
            probes={probes}
            scale={scale}
            translateX={translateX}
            translateY={translateY}
            width={width}
            height={height}
          />

          {/* Pattern placement hint system - Floating UI overlay */}
          <PlacementHintSystem
            analysis={patternAnalysis}
            isVisible={
              suggestionState.popupVisible &&
              (patternAnalysis?.suggestedPositions?.length || 0) > 0
            }
            onHintPress={handleHintPress}
            onSuggestionInteraction={handleSuggestionInteraction}
            onClose={() => {
              hidePopup();
            }}
            position="top"
            enableAnimations={!renderingState.performanceMode}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

export default GalaxyMapView;
