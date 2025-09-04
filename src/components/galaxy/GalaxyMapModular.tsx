import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, InteractionManager } from 'react-native';
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
  Connection,
  GeometricPattern,
  StarSystem,
  GalacticSector,
} from '../../types/galaxy';
import {
  screenToGalaxy,
  calculateVisibleBounds,
  clampScale,
  constrainTranslationElastic,
  calculateZoomFocalPoint,
  isPointInHitArea,
} from '../../utils/spatial/viewport';
import {
  ModuleManager,
  ModuleContext,
  BeaconRenderingModule,
  ConnectionRenderingModule,
  EnvironmentRenderingModule,
  StarSystemModule,
  SectorModule,
  GestureModule,
  LODModule,
  SpatialModule,
  EntropyModule,
  OverlayModule,
} from '../../utils/galaxy/modules';
import { galaxyMapConfig } from '../../utils/galaxy/GalaxyMapConfig';

const AnimatedSvg = Animated.createAnimatedComponent(Svg);
const AnimatedG = Animated.createAnimatedComponent(G);

interface GalaxyMapModularProps {
  width: number;
  height: number;
  beacons: Beacon[];
  connections?: Connection[];
  patterns?: GeometricPattern[];
  starSystems?: StarSystem[];
  sectors?: GalacticSector[];
  onBeaconSelect?: (beacon: Beacon) => void;
  onMapPress?: (point: Point2D) => void;
  selectedBeacon?: Beacon | null;
  style?: any;
  enabledModules?: string[]; // Allow selective module enabling
  performanceMode?: boolean;
  debugMode?: boolean;
}

export const GalaxyMapModular: React.FC<GalaxyMapModularProps> = ({
  width,
  height,
  beacons,
  connections = [],
  patterns = [],
  starSystems = [],
  sectors = [],
  onBeaconSelect,
  onMapPress,
  selectedBeacon = null,
  style,
  enabledModules = [],
  performanceMode = false,
  debugMode = false,
}) => {
  // Module system
  const moduleManager = useRef<ModuleManager | null>(null);
  const eventBusUnsubscribe = useRef<(() => void) | null>(null);
  const [modulesInitialized, setModulesInitialized] = useState(false);

  // Performance tracking
  const frameCount = useRef(0);
  const [fps, setFps] = useState(60);
  const lastFrameTime = useRef(Date.now());
  const shouldSkipFrame = useRef(false);
  const lastSkipCheck = useRef(Date.now());
  
  // Gesture performance optimization
  const [isGestureActive, setIsGestureActive] = useState(false);
  const isGestureActiveRef = useRef(false);
  const lastViewportUpdate = useRef(Date.now());
  
  // Wrapper function to keep state and ref in sync without useEffect
  const setGestureActiveState = useCallback((active: boolean) => {
    isGestureActiveRef.current = active;
    setIsGestureActive(active);
  }, []);
  const pendingViewportUpdate = useRef<{
    translateX: number;
    translateY: number;
    scale: number;
  } | null>(null);
  
  // Module render caching
  const [cachedModuleRender, setCachedModuleRender] = useState<React.ReactNode[]>([]);

  // Notifications
  const [notifications, setNotifications] = useState<{ 
    type: string; 
    message: string; 
    moduleId?: string; 
    id: number;
  }[]>([]);
  const notificationIdCounter = useRef(0);
  const notificationTimeouts = useRef<Map<number, NodeJS.Timeout>>(new Map());

  // Performance dashboard (removed - handled in parent component)
  // const [showPerformanceDashboard, setShowPerformanceDashboard] = useState(false);

  // Fallback and recovery state
  const emergencyModeRef = useRef(false);
  const [showFallbackControls, setShowFallbackControls] = useState(false);
  
  // Wrapper function to keep emergency mode ref updated and trigger UI state changes
  const setEmergencyModeState = useCallback((emergency: boolean) => {
    emergencyModeRef.current = emergency;
    setShowFallbackControls(emergency);
  }, []);

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

  // Notification management with proper timeout cleanup
  const dismissNotification = useCallback((notificationId: number) => {
    // Clear any pending timeout for this notification
    const timeoutId = notificationTimeouts.current.get(notificationId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      notificationTimeouts.current.delete(notificationId);
    }
    
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  }, []);

  const addNotification = useCallback((type: string, message: string, moduleId?: string) => {
    const notificationId = notificationIdCounter.current++;
    
    setNotifications(prev => [...prev, {
      type,
      message,
      moduleId,
      id: notificationId,
    }]);
    
    // Set up auto-dismiss with proper cleanup tracking
    const timeoutId = setTimeout(() => {
      dismissNotification(notificationId);
    }, 5000);
    
    notificationTimeouts.current.set(notificationId, timeoutId);
  }, [dismissNotification]);

  // Performance monitoring - separate from render cycle
  useEffect(() => {
    const interval = setInterval(() => {
      updatePerformanceMetrics();
    }, 1000); // Update every second to avoid render loops
    
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - function doesn't need to be recreated

  // Initialize module system
  useEffect(() => {
    const initializeModules = async () => {
      // Cleanup previous event subscription if it exists
      if (eventBusUnsubscribe.current) {
        eventBusUnsubscribe.current();
        eventBusUnsubscribe.current = null;
      }
      
      if (moduleManager.current) {
        moduleManager.current = null;
      }

      try {
        const manager = new ModuleManager({
          performanceMode,
          debugMode,
          maxRenderTime: 16.67,
          adaptivePerformance: true,
        });

        // Register core modules
        const beaconModule = new BeaconRenderingModule();
        const connectionModule = new ConnectionRenderingModule();
        const environmentModule = new EnvironmentRenderingModule();
        const starSystemModule = new StarSystemModule();
        const sectorModule = new SectorModule();
        const gestureModule = new GestureModule();
        const lodModule = new LODModule();
        const spatialModule = new SpatialModule();
        
        // Register new integrated modules
        const entropyModule = new EntropyModule();
        const overlayModule = new OverlayModule();

        await manager.registerModule(beaconModule);
        await manager.registerModule(connectionModule);
        await manager.registerModule(environmentModule);
        await manager.registerModule(starSystemModule);
        await manager.registerModule(sectorModule);
        await manager.registerModule(gestureModule);
        await manager.registerModule(lodModule);
        await manager.registerModule(spatialModule);
        await manager.registerModule(entropyModule);
        await manager.registerModule(overlayModule);

        // Disable modules not in enabledModules list (if specified)
        if (enabledModules.length > 0) {
          const allModules = manager.getAllModules();
          for (const module of allModules) {
            if (!enabledModules.includes(module.id)) {
              manager.disableModule(module.id);
            }
          }
        }

        // Set up notification listener with cleanup
        const eventBus = manager.getEventBus();
        const unsubscribe = eventBus.subscribe('module:performance-warning', (payload) => {
          addNotification(
            payload.data.type || 'warning',
            payload.data.message || `Performance warning from ${payload.moduleId}`,
            payload.moduleId
          );
        });
        
        // Store unsubscribe function for cleanup
        eventBusUnsubscribe.current = unsubscribe;

        moduleManager.current = manager;
        setModulesInitialized(true);
        
        console.log('[GalaxyMapModular] Modules initialized successfully');
      } catch (error) {
        console.error('[GalaxyMapModular] Failed to initialize modules:', error);
      }
    };

    initializeModules();
    
    // Cleanup on unmount
    return () => {
      if (eventBusUnsubscribe.current) {
        eventBusUnsubscribe.current();
      }
      
      // Clear all notification timeouts - copy ref to avoid stale closure
      const timeouts = notificationTimeouts.current;
      timeouts.forEach(timeoutId => clearTimeout(timeoutId));
      timeouts.clear();
    };
  }, [performanceMode, debugMode, enabledModules, addNotification]);

  // Performance monitoring with frame skipping
  const updatePerformanceMetrics = useCallback(() => {
    const now = Date.now();
    const deltaTime = now - lastFrameTime.current;
    const newFps = 1000 / deltaTime;
    
    frameCount.current++;
    
    // Only update FPS if it has changed significantly to reduce state updates
    const roundedFps = Math.round(newFps);
    setFps(prev => prev !== roundedFps ? roundedFps : prev);
    
    // Report performance to GalaxyMapConfig for auto-optimization
    galaxyMapConfig.reportPerformance(newFps, deltaTime);
    
    // Check if we should skip frames (every 100ms)
    if (now - lastSkipCheck.current > 100) {
      shouldSkipFrame.current = galaxyMapConfig.shouldSkipFrame();
      lastSkipCheck.current = now;
    }
    
    lastFrameTime.current = now;

    // Get global performance metrics from module manager
    if (moduleManager.current) {
      const globalMetrics = moduleManager.current.getGlobalPerformanceMetrics();
      
      // Log performance every 60 frames
      if (frameCount.current % 60 === 0) {
        const configStats = galaxyMapConfig.getPerformanceStats();
        console.log(`[GalaxyMapModular] FPS: ${Math.round(newFps)}, Global FPS: ${Math.round(globalMetrics.averageFps)}, Quality: ${configStats.currentQuality}, Skip Ratio: ${(configStats.skipRatio * 100).toFixed(1)}%, Disabled Modules: ${globalMetrics.disabledModules.length}, Frame: ${frameCount.current}`);
      }

      // Emergency mode detection - if FPS drops below 15 consistently
      if (newFps < 15 && !emergencyModeRef.current) {
        console.warn('[GalaxyMapModular] Emergency mode triggered due to low FPS');
        setEmergencyModeState(true);
        galaxyMapConfig.emergencyReset();
      }
    }
  }, [setEmergencyModeState]); // Include setEmergencyModeState dependency

  // Throttled viewport state update
  const updateViewportState = useCallback(
    (newTranslateX: number, newTranslateY: number, newScale: number, immediate = false) => {
      const now = Date.now();
      
      // Store pending update
      pendingViewportUpdate.current = {
        translateX: newTranslateX,
        translateY: newTranslateY,
        scale: newScale,
      };
      
      // Throttle updates during gestures (except immediate updates)
      if (!immediate && isGestureActiveRef.current && now - lastViewportUpdate.current < 50) {
        return; // Skip update, will be processed later
      }
      
      lastViewportUpdate.current = now;
      // Don't update performance metrics here to avoid render loops

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

      // Skip module notifications during active gestures for performance
      if (!isGestureActiveRef.current && moduleManager.current) {
        moduleManager.current.getEventBus().emit('viewport:changed', {
          moduleId: 'core',
          timestamp: Date.now(),
          data: newViewport,
        });
      }
      
      // Clear pending update
      pendingViewportUpdate.current = null;
    },
    [width, height] // Removed isGestureActive since we use it inside but don't need to recreate when it changes
  );
  
  // Process any pending viewport updates when gesture ends using InteractionManager
  useEffect(() => {
    if (!isGestureActive && pendingViewportUpdate.current) {
      const pending = pendingViewportUpdate.current;
      
      // Defer expensive operations until after gesture animations complete
      InteractionManager.runAfterInteractions(() => {
        // Direct viewport state update without calling updateViewportState to avoid loops
        const now = Date.now();
        lastViewportUpdate.current = now;
        
        const newViewport: ViewportState = {
          translateX: pending.translateX,
          translateY: pending.translateY,
          scale: pending.scale,
          bounds: calculateVisibleBounds(width, height, {
            translateX: pending.translateX,
            translateY: pending.translateY,
            scale: pending.scale,
            bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
          }),
        };
        setViewportState(newViewport);
        
        // Notify modules if manager is available
        if (moduleManager.current) {
          moduleManager.current.getEventBus().emit('viewport:changed', {
            moduleId: 'core',
            timestamp: now,
            data: newViewport,
          });
        }
        
        // Clear pending update
        pendingViewportUpdate.current = null;
      });
    }
  }, [isGestureActive, width, height]); // Added width and height since they're used in calculations

  // Memoize screen dimensions to prevent unnecessary context recreation
  const screenDimensions = useMemo(() => ({ width, height }), [width, height]);
  
  // Memoize stable references for arrays to prevent unnecessary updates
  const stableBeacons = useMemo(() => beacons, [beacons]);
  const stableConnections = useMemo(() => connections, [connections]);
  const stablePatterns = useMemo(() => patterns, [patterns]);
  const stableStarSystems = useMemo(() => starSystems, [starSystems]);
  const stableSectors = useMemo(() => sectors, [sectors]);
  
  // Create module context with more selective updates
  const moduleContext = useMemo((): ModuleContext => {
    const now = Date.now();
    const deltaTime = lastFrameTime.current > 0 ? now - lastFrameTime.current : 16.67;
    
    return {
      viewport: viewportState,
      screenDimensions,
      beacons: stableBeacons,
      connections: stableConnections,
      patterns: stablePatterns,
      starSystems: stableStarSystems,
      sectors: stableSectors,
      deltaTime,
      frameCount: frameCount.current,
    };
  }, [viewportState, screenDimensions, stableBeacons, stableConnections, stablePatterns, stableStarSystems, stableSectors]);

  // Render modules with caching during gestures
  const moduleElements = useMemo(() => {
    if (!moduleManager.current || !modulesInitialized) {
      return [];
    }

    // Skip rendering if frame skipping is enabled and should skip
    if (shouldSkipFrame.current) {
      return cachedModuleRender.length > 0 ? cachedModuleRender : []; // Use cached render
    }
    
    // Use cached render during active gestures to prevent flickering
    if (isGestureActive) {
      return cachedModuleRender;
    }

    // Full render when not in gesture
    try {
      const renderedElements = moduleManager.current.renderModules(moduleContext);
      
      // Cache this render immediately without triggering additional effects
      updateModuleCache(renderedElements);
      
      return renderedElements;
    } catch (error) {
      console.error('[GalaxyMapModular] Error rendering modules:', error);
      return cachedModuleRender.length > 0 ? cachedModuleRender : [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modulesInitialized, moduleContext, isGestureActive]); // Removed cachedModuleRender to avoid circular dependency

  // Cache module elements using ref to avoid circular dependency
  const moduleElementsRef = useRef<React.ReactNode[]>([]);
  
  // Update cache when not in gesture mode, but avoid triggering re-renders
  const updateModuleCache = useCallback((elements: React.ReactNode[]) => {
    if (!isGestureActiveRef.current && elements.length > 0) {
      moduleElementsRef.current = elements;
      setCachedModuleRender(elements);
    }
  }, []);

  // Handle tap interaction
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
      
      // Check for beacon selection
      const hitRadius = 20;
      let selectedBeaconFound = null;
      
      for (const beacon of beacons) {
        if (isPointInHitArea(galaxyPoint, beacon.position, hitRadius)) {
          selectedBeaconFound = beacon;
          break;
        }
      }

      // Emit interaction events to modules
      if (moduleManager.current) {
        const eventBus = moduleManager.current.getEventBus();
        
        if (selectedBeaconFound) {
          eventBus.emit('beacon:selected', {
            moduleId: 'core',
            timestamp: Date.now(),
            data: selectedBeaconFound,
          });
          onBeaconSelect?.(selectedBeaconFound);
        } else {
          eventBus.emit('map:pressed', {
            moduleId: 'core',
            timestamp: Date.now(),
            data: galaxyPoint,
          });
          onMapPress?.(galaxyPoint);
        }
      } else {
        // Fallback behavior when modules aren't ready
        if (selectedBeaconFound && onBeaconSelect) {
          onBeaconSelect(selectedBeaconFound);
        } else if (onMapPress) {
          onMapPress(galaxyPoint);
        }
      }
    },
    [width, height, beacons, onBeaconSelect, onMapPress]
  );

  // Optimized pan gesture with throttling
  const panGesture = Gesture.Pan()
    .onStart(() => {
      lastTranslateX.value = translateX.value;
      lastTranslateY.value = translateY.value;
      runOnJS(setGestureActiveState)(true);
    })
    .onUpdate(event => {
      translateX.value = lastTranslateX.value + event.translationX;
      translateY.value = lastTranslateY.value + event.translationY;
      
      // Throttle viewport updates during pan - only update every 50ms
      if (Math.abs(event.translationX) % 25 < 2 || Math.abs(event.translationY) % 25 < 2) {
        runOnJS(updateViewportState)(
          translateX.value,
          translateY.value,
          scale.value
        );
      }
    })
    .onEnd(() => {
      // Final update when gesture ends
      runOnJS(updateViewportState)(
        translateX.value,
        translateY.value,
        scale.value,
        true // immediate update
      );
      runOnJS(setGestureActiveState)(false);
    });

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      'worklet';
      lastScale.value = scale.value;
      lastTranslateX.value = translateX.value;
      lastTranslateY.value = translateY.value;
      runOnJS(setGestureActiveState)(true);
    })
    .onUpdate(event => {
      'worklet';
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

      // Throttle JS updates during pinch
      if (Math.abs(event.scale - 1) > 0.1) {
        runOnJS(updateViewportState)(
          constrainedTranslation.x,
          constrainedTranslation.y,
          newScale
        );
      }
    })
    .onEnd(() => {
      'worklet';
      runOnJS(updateViewportState)(
        translateX.value,
        translateY.value,
        scale.value,
        true // immediate update
      );
      runOnJS(setGestureActiveState)(false);
    });

  const tapGesture = Gesture.Tap()
    .onEnd(event => {
      'worklet';
      runOnJS(handleTapInteraction)(
        event.x,
        event.y,
        translateX.value,
        translateY.value,
        scale.value
      );
    });

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
    <View style={[{ width, height }, style]} className="galaxy-map-modular">
      {/* Performance and debug display */}
      {debugMode && moduleManager.current && (
        <View className="absolute top-4 left-4 bg-black bg-opacity-50 p-2 rounded">
          {(() => {
            const globalMetrics = moduleManager.current!.getGlobalPerformanceMetrics();
            const configStats = galaxyMapConfig.getPerformanceStats();
            return (
              <View>
                <Text className="text-white text-xs">
                  FPS: {fps} | Global FPS: {Math.round(globalMetrics.averageFps)}
                </Text>
                <Text className="text-white text-xs">
                  Beacons: {beacons.length} | Quality: {configStats.currentQuality}
                </Text>
                <Text className="text-white text-xs">
                  Modules: {modulesInitialized ? 'Ready' : 'Loading'} | Skip: {(configStats.skipRatio * 100).toFixed(1)}%
                </Text>
                {globalMetrics.disabledModules.length > 0 && (
                  <Text className="text-yellow-400 text-xs">
                    Disabled: {globalMetrics.disabledModules.join(', ')}
                  </Text>
                )}
                {globalMetrics.performanceMode && (
                  <Text className="text-orange-400 text-xs">Performance Mode</Text>
                )}
                <TouchableOpacity
                  onPress={() => console.log('Performance controls available in FPS overlay')}
                  className="bg-blue-600 px-2 py-1 rounded mt-1"
                >
                  <Text className="text-white text-xs">Dashboard</Text>
                </TouchableOpacity>
              </View>
            );
          })()}
        </View>
      )}

      {/* Emergency Fallback Controls */}
      {showFallbackControls && (
        <View className="absolute top-4 right-4 bg-red-900 bg-opacity-90 p-4 rounded-lg max-w-72">
          <Text className="text-red-400 text-sm font-bold mb-2">🚨 EMERGENCY MODE</Text>
          <Text className="text-white text-xs mb-3">
            Performance issues detected. Some modules have been disabled.
          </Text>
          <View className="space-y-2">
            <TouchableOpacity
              onPress={() => {
                galaxyMapConfig.setQualityLevel('high', 'user recovery');
                setEmergencyModeState(false);
              }}
              className="bg-green-600 px-3 py-2 rounded"
            >
              <Text className="text-white text-xs font-semibold text-center">Try High Quality</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                galaxyMapConfig.setModuleEnabled('beacon-rendering', true);
                galaxyMapConfig.setModuleEnabled('connection-rendering', true);
              }}
              className="bg-blue-600 px-3 py-2 rounded"
            >
              <Text className="text-white text-xs font-semibold text-center">Re-enable Core Modules</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => console.log('[GalaxyMapModular] Performance dashboard requested - implement in parent component')}
              className="bg-purple-600 px-3 py-2 rounded"
            >
              <Text className="text-white text-xs font-semibold text-center">Open Dashboard</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowFallbackControls(false)}
              className="bg-gray-600 px-3 py-2 rounded"
            >
              <Text className="text-white text-xs font-semibold text-center">Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Notifications */}
      {notifications.length > 0 && !showFallbackControls && (
        <View className="absolute top-4 right-4 space-y-2">
          {notifications.map((notification) => (
            <View 
              key={notification.id}
              className="bg-black bg-opacity-80 p-3 rounded-lg max-w-80"
            >
              <View className="flex-row justify-between items-start">
                <View className="flex-1">
                  <Text className="text-white text-sm font-medium">
                    {notification.type === 'module-disabled' ? '⚠️' : 
                     notification.type === 'module-enabled' ? '✅' : '📊'} 
                    {notification.type.replace('-', ' ').toUpperCase()}
                  </Text>
                  <Text className="text-gray-300 text-xs mt-1">
                    {notification.message}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => dismissNotification(notification.id)}
                  className="ml-2 p-1"
                >
                  <Text className="text-gray-400 text-xs">✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      <GestureDetector gesture={composedGesture}>
        <Animated.View style={{ flex: 1 }}>
          <AnimatedSvg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
          >
            <Rect x="0" y="0" width={width} height={height} fill="#0F172A" />

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

              {/* Render all module elements */}
              {moduleElements}
            </AnimatedG>
          </AnimatedSvg>
        </Animated.View>
      </GestureDetector>

      {/* Performance controls are now integrated into the FPS overlay in GalaxyMapScreen */}
    </View>
  );
};

export default GalaxyMapModular;