import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import GalaxyMapErrorBoundary from './GalaxyMapErrorBoundary';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  runOnJS,
  withDecay,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

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

// Conditional SVG imports to handle Jest testing issues
let Svg: any, G: any, Rect: any;

if (process.env.NODE_ENV === 'test') {
  // Use simple View components for testing
  Svg = View;
  G = View;
  Rect = View;
} else {
  // Use actual SVG components in production
  const SvgModule = require('react-native-svg');
  Svg = SvgModule.Svg || SvgModule.default;
  G = SvgModule.G;
  Rect = SvgModule.Rect;
}

const AnimatedSvg = Animated.createAnimatedComponent(Svg);
const AnimatedG = Animated.createAnimatedComponent(G);

// Stable default arrays to prevent infinite re-renders from default parameters
const EMPTY_CONNECTIONS: Connection[] = [];
const EMPTY_PATTERNS: GeometricPattern[] = [];
const EMPTY_STAR_SYSTEMS: StarSystem[] = [];
const EMPTY_SECTORS: GalacticSector[] = [];
const EMPTY_MODULES: string[] = [];

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
  gestureConfig?: {
    panActivationDistance?: number; // Minimum distance to activate pan gesture
    panSensitivity?: number; // Touch sensitivity multiplier
    enableMomentum?: boolean; // Enable momentum/decay after pan ends
  };
}

export const GalaxyMapModular: React.FC<GalaxyMapModularProps> = ({
  width,
  height,
  beacons,
  connections = EMPTY_CONNECTIONS,
  patterns = EMPTY_PATTERNS,
  starSystems = EMPTY_STAR_SYSTEMS,
  sectors = EMPTY_SECTORS,
  onBeaconSelect,
  onMapPress,
  selectedBeacon = null,
  style,
  enabledModules = EMPTY_MODULES,
  performanceMode = false,
  debugMode = false,
  gestureConfig = {
    panActivationDistance: 8, // Default 8px minimum distance
    panSensitivity: 1.0, // Default sensitivity
    enableMomentum: false, // Momentum disabled by default for compatibility
  },
}) => {
  // Props validation and sanitization
  const sanitizedWidth = useMemo(() => {
    if (typeof width !== 'number' || isNaN(width) || !isFinite(width) || width <= 0) {
      return 400; // Default fallback width
    }
    return Math.max(1, Math.min(width, 10000)); // Clamp between 1 and 10000
  }, [width]);

  const sanitizedHeight = useMemo(() => {
    if (typeof height !== 'number' || isNaN(height) || !isFinite(height) || height <= 0) {
      return 600; // Default fallback height
    }
    return Math.max(1, Math.min(height, 10000)); // Clamp between 1 and 10000
  }, [height]);

  const sanitizedBeacons = useMemo(() => {
    if (!Array.isArray(beacons)) {
      return []; // Return empty array if beacons is not an array
    }
    
    // Filter and sanitize beacon data
    return beacons.filter((beacon): beacon is Beacon => {
      if (!beacon || typeof beacon !== 'object') return false;
      if (!beacon.id || typeof beacon.id !== 'string') return false;
      if (!beacon.position || typeof beacon.position !== 'object') return false;
      if (typeof beacon.position.x !== 'number' || isNaN(beacon.position.x) || !isFinite(beacon.position.x)) return false;
      if (typeof beacon.position.y !== 'number' || isNaN(beacon.position.y) || !isFinite(beacon.position.y)) return false;
      return true;
    });
  }, [beacons]);

  const sanitizedConnections = useMemo(() => {
    if (!Array.isArray(connections)) {
      return EMPTY_CONNECTIONS; // Return empty array if connections is not an array
    }
    
    // Filter and sanitize connection data
    return connections.filter((connection): connection is Connection => {
      if (!connection || typeof connection !== 'object') return false;
      if (!connection.id || typeof connection.id !== 'string') return false;
      if (!connection.sourceId || typeof connection.sourceId !== 'string') return false;
      if (!connection.targetId || typeof connection.targetId !== 'string') return false;
      if (typeof connection.strength !== 'number' || isNaN(connection.strength) || !isFinite(connection.strength)) return false;
      if (typeof connection.isActive !== 'boolean') return false;
      return true;
    });
  }, [connections]);

  const sanitizedPatterns = useMemo(() => {
    return Array.isArray(patterns) ? patterns : EMPTY_PATTERNS;
  }, [patterns]);

  const sanitizedStarSystems = useMemo(() => {
    return Array.isArray(starSystems) ? starSystems : EMPTY_STAR_SYSTEMS;
  }, [starSystems]);

  const sanitizedSectors = useMemo(() => {
    return Array.isArray(sectors) ? sectors : EMPTY_SECTORS;
  }, [sectors]);

  const sanitizedEnabledModules = useMemo(() => {
    if (!Array.isArray(enabledModules)) {
      return EMPTY_MODULES;
    }
    // Filter out invalid module names
    return enabledModules.filter(module => 
      typeof module === 'string' && module.length > 0
    );
  }, [enabledModules]);

  const sanitizedGestureConfig = useMemo(() => {
    const config = gestureConfig || {};
    return {
      panActivationDistance: typeof config.panActivationDistance === 'number' && 
                           isFinite(config.panActivationDistance) && 
                           config.panActivationDistance > 0 
                           ? config.panActivationDistance : 8,
      panSensitivity: typeof config.panSensitivity === 'number' && 
                     isFinite(config.panSensitivity) && 
                     config.panSensitivity > 0 
                     ? config.panSensitivity : 1.0,
      enableMomentum: typeof config.enableMomentum === 'boolean' ? config.enableMomentum : false,
    };
  }, [gestureConfig]);
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
  
  // Gesture performance optimization (simplified to use only ref)
  const isGestureActiveRef = useRef(false);
  const lastViewportUpdate = useRef(Date.now());
  
  // Simplified gesture state management
  const setGestureActiveState = useCallback((active: boolean) => {
    isGestureActiveRef.current = active;
  }, []);
  const pendingViewportUpdate = useRef<{
    translateX: number;
    translateY: number;
    scale: number;
  } | null>(null);
  
  // Module render caching (simplified)
  const cachedModuleRenderRef = useRef<React.ReactNode[]>([]);
  const lastCacheTime = useRef(0);

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
  const [viewportState, setViewportState] = useState<ViewportState>(() => ({
    translateX: 0,
    translateY: 0,
    scale: 1,
    bounds: {
      minX: 0,
      maxX: sanitizedWidth,
      minY: 0,
      maxY: sanitizedHeight,
    },
  }));

  // Update viewport state when dimensions change
  useEffect(() => {
    // Use functional update to avoid dependency on current viewportState
    setViewportState(prevState => {
      const newViewport = {
        ...prevState,
        bounds: {
          minX: 0,
          maxX: sanitizedWidth,
          minY: 0,
          maxY: sanitizedHeight,
        },
      };

      // Emit viewport changed event to modules when dimensions change
      // Only emit if modules are initialized and not during initial mount
      if (moduleManager.current && modulesInitialized && !isGestureActiveRef.current) {
        // Use a timeout to ensure the event is emitted after the state update
        setTimeout(() => {
          if (moduleManager.current) {
            moduleManager.current.getEventBus().emit('viewport:changed', {
              moduleId: 'core',
              timestamp: Date.now(),
              data: newViewport,
            });
          }
        }, 0);
      }

      return newViewport;
    });
  }, [sanitizedWidth, sanitizedHeight, modulesInitialized]);

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

  // Stabilize enabledModules array to prevent unnecessary re-initialization
  const stableEnabledModules = useMemo(() => sanitizedEnabledModules, [sanitizedEnabledModules.length, ...sanitizedEnabledModules]);

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
        if (stableEnabledModules.length > 0) {
          const allModules = manager.getAllModules();
          for (const module of allModules) {
            if (!stableEnabledModules.includes(module.id)) {
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const timeouts = notificationTimeouts.current;
      timeouts.forEach(timeoutId => clearTimeout(timeoutId));
      timeouts.clear();
    };
  }, [performanceMode, debugMode, stableEnabledModules, addNotification]);

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
    if (galaxyMapConfig?.reportPerformance) {
      galaxyMapConfig.reportPerformance(newFps, deltaTime);
    }
    
    // Check if we should skip frames (every 100ms)
    if (now - lastSkipCheck.current > 100) {
      shouldSkipFrame.current = galaxyMapConfig?.shouldSkipFrame?.() || false;
      lastSkipCheck.current = now;
    }
    
    lastFrameTime.current = now;

    // Get global performance metrics from module manager
    if (moduleManager.current) {
      const globalMetrics = moduleManager.current.getGlobalPerformanceMetrics();
      
      // Log performance every 60 frames
      if (frameCount.current % 60 === 0) {
        const configStats = galaxyMapConfig?.getPerformanceStats?.() || { currentQuality: 'unknown', skipRatio: 0 };
        console.log(`[GalaxyMapModular] FPS: ${Math.round(newFps)}, Global FPS: ${Math.round(globalMetrics.averageFps)}, Quality: ${configStats.currentQuality}, Skip Ratio: ${(configStats.skipRatio * 100).toFixed(1)}%, Disabled Modules: ${globalMetrics.disabledModules.length}, Frame: ${frameCount.current}`);
      }

      // Emergency mode detection - if FPS drops below 10 consistently (and not in initial frames)
      if ((newFps < 10 || globalMetrics.averageFps < 10) && !emergencyModeRef.current && frameCount.current > 60) {
        console.warn('[GalaxyMapModular] Emergency mode triggered due to low FPS');
        setEmergencyModeState(true);
        if (galaxyMapConfig?.emergencyReset) {
          galaxyMapConfig.emergencyReset();
        }
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
      if (!immediate && isGestureActiveRef.current && now - lastViewportUpdate.current < 33) {
        return; // Skip update, will be processed later (30fps during gestures)
      }
      
      lastViewportUpdate.current = now;
      // Don't update performance metrics here to avoid render loops

      const newViewport: ViewportState = {
        translateX: newTranslateX,
        translateY: newTranslateY,
        scale: newScale,
        bounds: calculateVisibleBounds(sanitizedWidth, sanitizedHeight, {
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
    [sanitizedWidth, sanitizedHeight] // Dependencies for calculateVisibleBounds
  );
  
  // Process pending viewport updates immediately after gesture ends (no InteractionManager delay)
  useEffect(() => {
    const checkPendingUpdate = () => {
      if (!isGestureActiveRef.current && pendingViewportUpdate.current) {
        const pending = pendingViewportUpdate.current;
        
        // Process immediately after gesture ends
        const now = Date.now();
        lastViewportUpdate.current = now;
        
        const newViewport: ViewportState = {
          translateX: pending.translateX,
          translateY: pending.translateY,
          scale: pending.scale,
          bounds: calculateVisibleBounds(sanitizedWidth, sanitizedHeight, {
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
      }
    };
    
    // Check for pending updates periodically
    const interval = setInterval(checkPendingUpdate, 16); // Check at 60fps
    return () => clearInterval(interval);
  }, [sanitizedWidth, sanitizedHeight]); // Only width/height dependency needed

  // Memoize screen dimensions to prevent unnecessary context recreation
  const screenDimensions = useMemo(() => ({ width: sanitizedWidth, height: sanitizedHeight }), [sanitizedWidth, sanitizedHeight]);
  
  // Memoize stable references for arrays to prevent unnecessary updates
  const stableBeacons = useMemo(() => sanitizedBeacons, [sanitizedBeacons]);
  const stableConnections = useMemo(() => sanitizedConnections, [sanitizedConnections]);
  const stablePatterns = useMemo(() => sanitizedPatterns, [sanitizedPatterns]);
  const stableStarSystems = useMemo(() => sanitizedStarSystems, [sanitizedStarSystems]);
  const stableSectors = useMemo(() => sanitizedSectors, [sanitizedSectors]);
  
  // Throttled viewport for module context to reduce re-renders
  const throttledViewportRef = useRef(viewportState);
  const lastContextUpdate = useRef(0);
  
  // Update throttled viewport only when significant changes occur
  const throttledViewport = useMemo(() => {
    const now = Date.now();
    const timeSinceUpdate = now - lastContextUpdate.current;
    
    // Always update immediately during initial render
    if (lastContextUpdate.current === 0) {
      lastContextUpdate.current = now;
      throttledViewportRef.current = viewportState;
      return viewportState;
    }
    
    // During gestures, throttle more aggressively (every 100ms)
    const throttleInterval = isGestureActiveRef.current ? 100 : 50;
    
    if (timeSinceUpdate >= throttleInterval) {
      // Check if viewport has changed significantly
      const prev = throttledViewportRef.current;
      const scaleChanged = Math.abs(viewportState.scale - prev.scale) > 0.01;
      const translateChanged = 
        Math.abs(viewportState.translateX - prev.translateX) > 10 ||
        Math.abs(viewportState.translateY - prev.translateY) > 10;
      
      if (scaleChanged || translateChanged) {
        lastContextUpdate.current = now;
        throttledViewportRef.current = viewportState;
        return viewportState;
      }
    }
    
    // Return previous viewport if not enough change
    return throttledViewportRef.current;
  }, [viewportState]);
  
  // Create module context with throttled viewport updates to prevent excessive re-renders
  const moduleContext = useMemo((): ModuleContext => {
    const now = Date.now();
    const deltaTime = lastFrameTime.current > 0 ? now - lastFrameTime.current : 16.67;
    
    // Use throttled viewport instead of current one
    const cloneViewport = {
      translateX: throttledViewport.translateX,
      translateY: throttledViewport.translateY,
      scale: throttledViewport.scale,
      bounds: {
        minX: throttledViewport.bounds.minX,
        maxX: throttledViewport.bounds.maxX,
        minY: throttledViewport.bounds.minY,
        maxY: throttledViewport.bounds.maxY,
      },
    };

    const cloneScreenDimensions = {
      width: screenDimensions.width,
      height: screenDimensions.height,
    };
    
    return {
      viewport: cloneViewport,
      screenDimensions: cloneScreenDimensions,
      beacons: stableBeacons.map(beacon => ({ ...beacon, position: { ...beacon.position } })),
      connections: stableConnections.map(connection => ({ 
        ...connection
      })),
      patterns: stablePatterns.map(pattern => ({ ...pattern })),
      starSystems: stableStarSystems.map(system => ({ 
        ...system, 
        position: { ...system.position } 
      })),
      sectors: stableSectors.map(sector => ({ 
        ...sector, 
        center: { ...sector.center },
        bounds: { ...sector.bounds }
      })),
      deltaTime,
      frameCount: frameCount.current,
    };
  }, [throttledViewport, screenDimensions, stableBeacons, stableConnections, stablePatterns, stableStarSystems, stableSectors]);


  // Render modules with simplified caching for emergency performance only
  const moduleElements = useMemo(() => {
    if (!moduleManager.current || !modulesInitialized) {
      return [];
    }

    // Only use cache in emergency situations (severe performance degradation)
    const now = Date.now();
    if (shouldSkipFrame.current && cachedModuleRenderRef.current.length > 0) {
      // Update cache timestamp to indicate it's being used
      lastCacheTime.current = now;
      return cachedModuleRenderRef.current;
    }
    
    // Normal rendering path - no gesture-based caching
    try {
      const rendered = moduleManager.current.renderModules(moduleContext);
      
      // Update cache for emergency use (every 100ms maximum)
      if (rendered.length > 0 && now - lastCacheTime.current > 100) {
        cachedModuleRenderRef.current = rendered;
        lastCacheTime.current = now;
      }
      
      return rendered;
    } catch (error) {
      console.error('[GalaxyMapModular] Error rendering modules:', error);
      // Fallback to cache only in error cases
      return cachedModuleRenderRef.current.length > 0 ? cachedModuleRenderRef.current : [];
    }
  }, [modulesInitialized, moduleContext]);


  // Handle tap interaction
  const handleTapInteraction = useCallback(
    (screenX: number, screenY: number, translateX: number, translateY: number, scale: number) => {
      const currentViewport: ViewportState = {
        translateX,
        translateY,
        scale,
        bounds: calculateVisibleBounds(sanitizedWidth, sanitizedHeight, {
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
      
      for (const beacon of sanitizedBeacons) {
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
    [sanitizedWidth, sanitizedHeight, sanitizedBeacons, onBeaconSelect, onMapPress]
  );

  // Optimized pan gesture with improved throttling and configurable activation
  const lastPanUpdate = useRef(0);
  const gestureStartPosition = useRef({ x: 0, y: 0 });
  const isPanActive = useRef(false);
  
  // Extract gesture configuration with defaults
  const panActivationDistance = sanitizedGestureConfig.panActivationDistance;
  const panSensitivity = sanitizedGestureConfig.panSensitivity;
  const enableMomentum = sanitizedGestureConfig.enableMomentum;
  
  const panGesture = Gesture.Pan()
    .onStart((event) => {
      lastTranslateX.value = translateX.value;
      lastTranslateY.value = translateY.value;
      // Use event position if available, fallback to center of screen for testing
      gestureStartPosition.current = { 
        x: event?.x ?? sanitizedWidth / 2, 
        y: event?.y ?? sanitizedHeight / 2 
      };
      isPanActive.current = false; // Will be activated once threshold is met
      runOnJS(setGestureActiveState)(true);
      lastPanUpdate.current = 0; // Reset throttling
    })
    .onUpdate(event => {
      // Check if pan should be activated based on activation distance
      if (!isPanActive.current) {
        // Use current position if available, otherwise use translation distance
        const currentX = event.x ?? (gestureStartPosition.current.x + event.translationX);
        const currentY = event.y ?? (gestureStartPosition.current.y + event.translationY);
        
        const deltaX = currentX - gestureStartPosition.current.x;
        const deltaY = currentY - gestureStartPosition.current.y;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if (distance >= panActivationDistance) {
          isPanActive.current = true;
        } else {
          return; // Don't process pan updates until activation threshold is met
        }
      }
      
      // Apply sensitivity multiplier to translation
      const sensitiveTranslationX = event.translationX * panSensitivity;
      const sensitiveTranslationY = event.translationY * panSensitivity;
      
      translateX.value = lastTranslateX.value + sensitiveTranslationX;
      translateY.value = lastTranslateY.value + sensitiveTranslationY;
      
      // Time-based throttling for smoother panning (16ms = ~60fps)
      const now = Date.now();
      if (now - lastPanUpdate.current >= 16) {
        runOnJS(updateViewportState)(
          translateX.value,
          translateY.value,
          scale.value
        );
        lastPanUpdate.current = now;
      }
    })
    .onEnd((event) => {
      // Apply momentum if enabled and pan was active
      const hasVelocity = (event?.velocityX ?? 0) !== 0 || (event?.velocityY ?? 0) !== 0;
      if (enableMomentum && isPanActive.current && hasVelocity) {
        // Apply velocity-based momentum using withDecay
        translateX.value = withDecay({
          velocity: (event?.velocityX ?? 0) * panSensitivity * 0.5, // Reduce velocity for smoother decay
          clamp: [
            -(GALAXY_WIDTH * scale.value - sanitizedWidth),
            0
          ],
        });
        
        translateY.value = withDecay({
          velocity: (event?.velocityY ?? 0) * panSensitivity * 0.5,
          clamp: [
            -(GALAXY_HEIGHT * scale.value - sanitizedHeight),
            0
          ],
        });
        
        // Update viewport state after momentum animation completes
        setTimeout(() => {
          runOnJS(updateViewportState)(
            translateX.value,
            translateY.value,
            scale.value,
            true // immediate update
          );
        }, 500); // Allow time for decay animation
      } else {
        // Final update when gesture ends without momentum
        runOnJS(updateViewportState)(
          translateX.value,
          translateY.value,
          scale.value,
          true // immediate update
        );
      }
      
      isPanActive.current = false;
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
        x: event.focalX || sanitizedWidth / 2,
        y: event.focalY || sanitizedHeight / 2,
      };
      
      const newTranslation = calculateZoomFocalPoint(
        focalPoint,
        { x: lastTranslateX.value, y: lastTranslateY.value },
        lastScale.value,
        newScale
      );

      const constrainedTranslation = constrainTranslationElastic(
        newTranslation,
        sanitizedWidth,
        sanitizedHeight,
        GALAXY_WIDTH,
        GALAXY_HEIGHT,
        newScale
      );

      scale.value = newScale;
      translateX.value = constrainedTranslation.x;
      translateY.value = constrainedTranslation.y;

      // Throttle pinch updates based on scale change (more responsive than time-based)
      if (Math.abs(event.scale - 1) > 0.05) { // More sensitive than before (0.1 -> 0.05)
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

  const composedGesture = process.env.NODE_ENV === 'test' ? 
    // Simplified gesture for testing
    Gesture.Simultaneous(panGesture, pinchGesture, tapGesture) :
    // Full gesture configuration for production
    Gesture.Simultaneous(
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

  // Error reporting callback for analytics
  const handleErrorReport = useCallback((errorReport: any) => {
    console.error('[GalaxyMapModular] Error reported:', errorReport);
    
    // Add error notification
    addNotification(
      'error',
      `Component error: ${errorReport.error.message}`,
      errorReport.moduleId
    );
  }, [addNotification]);

  return (
    <GalaxyMapErrorBoundary 
      onErrorReport={handleErrorReport}
      showReporting={debugMode}
      testID="galaxy-map-error-boundary"
    >
      <View style={[{ width: sanitizedWidth, height: sanitizedHeight }, style]} className="galaxy-map-modular" testID="galaxy-map">
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
                  Beacons: {sanitizedBeacons.length} | Quality: {configStats.currentQuality}
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
                if (galaxyMapConfig?.setQualityLevel) {
                  galaxyMapConfig.setQualityLevel('high', 'user recovery');
                }
                setEmergencyModeState(false);
              }}
              className="bg-green-600 px-3 py-2 rounded"
            >
              <Text className="text-white text-xs font-semibold text-center">Try High Quality</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (galaxyMapConfig?.setModuleEnabled) {
                  galaxyMapConfig.setModuleEnabled('beacon-rendering', true);
                  galaxyMapConfig.setModuleEnabled('connection-rendering', true);
                }
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
            width={sanitizedWidth}
            height={sanitizedHeight}
            viewBox={`0 0 ${sanitizedWidth} ${sanitizedHeight}`}
          >
            <Rect x={0} y={0} width={sanitizedWidth} height={sanitizedHeight} fill="#0F172A" />

            <AnimatedG {...(process.env.NODE_ENV !== 'test' ? { animatedProps } : {})}>
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

        {/* Performance controls are now integrated into the FPS overlay in MainScreen */}
      </View>
    </GalaxyMapErrorBoundary>
  );
};

export default GalaxyMapModular;