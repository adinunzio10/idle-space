/**
 * GalaxyOverlaySystem - Complete Visual Galaxy Sector Overlay Integration
 * 
 * Master integration component that combines all sector overlay systems with smooth
 * transitions, performance optimization, and comprehensive testing capabilities.
 * Provides a single entry point for the complete galaxy overlay visualization system.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { G } from 'react-native-svg';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { 
  GalacticSector, 
  StarSystem, 
  ViewportState, 
  SectorRenderInfo 
} from '../../types/galaxy';
import { 
  SectorOverlayManager,
  OverlayConfiguration,
  SectorStateInfo,
  createSectorOverlayManager,
  DEFAULT_OVERLAY_CONFIG,
} from '../../utils/galaxy/SectorOverlayManager';
import { 
  OptimizationSuite,
  createOptimizationSuite,
  PerformanceMetrics,
} from '../../utils/galaxy/OverlayOptimization';
import { MultipleSectorBoundary } from './SectorBoundary';
import { MultipleSectorStateRenderer } from './SectorStateRenderer';
import { MultiSectorEntropyVisualization } from './EntropyVisualization';
import { MultipleHarvestOverlay } from './HarvestOverlay';
import { OverlayControls } from '../ui/OverlayControls';

export interface GalaxyOverlaySystemProps {
  /** Galactic sectors data */
  sectors: GalacticSector[];
  /** Star systems data */
  starSystems: StarSystem[];
  /** Current viewport state */
  viewportState: ViewportState;
  /** Initial overlay configuration */
  initialConfig?: Partial<OverlayConfiguration>;
  /** Enable performance monitoring and adaptation */
  enablePerformanceAdaptation?: boolean;
  /** Show overlay controls UI */
  showControls?: boolean;
  /** Controls position */
  controlsPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /** Enable smooth transitions between states */
  enableTransitions?: boolean;
  /** Performance testing mode */
  testingMode?: boolean;
  /** Resource harvest callback */
  onResourceHarvest?: (starSystem: StarSystem, resourceType: 'stellarEssence' | 'voidFragments', amount: number) => void;
  /** Performance metrics callback */
  onPerformanceUpdate?: (metrics: PerformanceMetrics) => void;
  /** Configuration change callback */
  onConfigurationChange?: (config: OverlayConfiguration) => void;
}

interface PerformanceTestResult {
  testName: string;
  duration: number;
  frameCount: number;
  averageFrameTime: number;
  minFrameTime: number;
  maxFrameTime: number;
  droppedFrames: number;
  memoryUsage?: number;
  success: boolean;
  details: string;
}

/**
 * Performance Testing Utilities
 */
class PerformanceTestRunner {
  private results: PerformanceTestResult[] = [];
  private currentTest: {
    name: string;
    startTime: number;
    frameCount: number;
    frameTimes: number[];
  } | null = null;

  startTest(testName: string): void {
    this.currentTest = {
      name: testName,
      startTime: performance.now(),
      frameCount: 0,
      frameTimes: [],
    };
  }

  recordFrame(frameTime: number): void {
    if (this.currentTest) {
      this.currentTest.frameCount++;
      this.currentTest.frameTimes.push(frameTime);
    }
  }

  endTest(): PerformanceTestResult | null {
    if (!this.currentTest) return null;

    const endTime = performance.now();
    const duration = endTime - this.currentTest.startTime;
    const frameTimes = this.currentTest.frameTimes;
    const averageFrameTime = frameTimes.reduce((sum, time) => sum + time, 0) / frameTimes.length;
    const minFrameTime = Math.min(...frameTimes);
    const maxFrameTime = Math.max(...frameTimes);
    const droppedFrames = frameTimes.filter(time => time > 33).length; // > 30fps

    const result: PerformanceTestResult = {
      testName: this.currentTest.name,
      duration,
      frameCount: this.currentTest.frameCount,
      averageFrameTime,
      minFrameTime,
      maxFrameTime,
      droppedFrames,
      success: averageFrameTime < 20 && droppedFrames < this.currentTest.frameCount * 0.1, // < 20ms avg, < 10% dropped
      details: `${this.currentTest.frameCount} frames in ${duration.toFixed(1)}ms`,
    };

    this.results.push(result);
    this.currentTest = null;

    return result;
  }

  getResults(): PerformanceTestResult[] {
    return [...this.results];
  }

  clear(): void {
    this.results = [];
    this.currentTest = null;
  }
}

/**
 * Main Galaxy Overlay System Component
 */
export const GalaxyOverlaySystem: React.FC<GalaxyOverlaySystemProps> = ({
  sectors,
  starSystems,
  viewportState,
  initialConfig,
  enablePerformanceAdaptation = true,
  showControls = true,
  controlsPosition = 'top-right',
  enableTransitions = true,
  testingMode = false,
  onResourceHarvest,
  onPerformanceUpdate,
  onConfigurationChange,
}) => {
  // Core systems
  const overlayManager = useRef<SectorOverlayManager>(
    createSectorOverlayManager(initialConfig)
  );
  const optimizationSuite = useRef<OptimizationSuite>(
    createOptimizationSuite()
  );
  const testRunner = useRef<PerformanceTestRunner>(
    new PerformanceTestRunner()
  );

  // State management
  const [isInitialized, setIsInitialized] = useState(false);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [currentConfig, setCurrentConfig] = useState<OverlayConfiguration>(
    () => overlayManager.current.getConfiguration()
  );

  // Animation values for smooth transitions
  const systemOpacity = useSharedValue(0);
  const transitionProgress = useSharedValue(0);

  // Initialize the system
  useEffect(() => {
    // Update overlay manager with new data
    overlayManager.current.updateSectors(sectors);
    overlayManager.current.updateStarSystems(starSystems);

    if (!isInitialized) {
      // Fade in the system
      systemOpacity.value = withSpring(1, { damping: 20, stiffness: 200 });
      setIsInitialized(true);
    }
  }, [sectors, starSystems, isInitialized, systemOpacity]);

  // Performance monitoring
  useEffect(() => {
    if (!enablePerformanceAdaptation) return;

    let animationId: number;
    let lastTime = performance.now();

    const monitorFrame = (currentTime: number) => {
      const frameTime = currentTime - lastTime;
      lastTime = currentTime;

      // Monitor performance
      optimizationSuite.current.performance.monitorPerformance(frameTime);
      
      // Record for testing if active
      if (testingMode) {
        testRunner.current.recordFrame(frameTime);
      }

      // Update metrics periodically
      const metrics = optimizationSuite.current.performance.getMetrics();
      setPerformanceMetrics(metrics);
      
      if (onPerformanceUpdate) {
        onPerformanceUpdate(metrics);
      }

      // Adaptive quality adjustment
      if (metrics.performanceScore < 0.5) {
        const recommendedQuality = optimizationSuite.current.performance.getRecommendedQuality();
        
        // Apply recommended settings
        const newConfig: Partial<OverlayConfiguration> = {
          quality: {
            ...currentConfig.quality,
            maxSectors: recommendedQuality.maxSectors,
            maxEntropyEffects: recommendedQuality.maxParticles,
            maxHarvestIndicators: Math.min(recommendedQuality.maxStarSystems, 50),
            particleQuality: recommendedQuality.particleQuality,
          },
          animations: {
            ...currentConfig.animations,
            enableTransitions: recommendedQuality.enableAnimations,
            enablePulseEffects: recommendedQuality.enableAnimations,
            enableParticleAnimations: recommendedQuality.enableParticles,
          },
        };
        
        overlayManager.current.updateConfiguration(newConfig);
        const updatedConfig = overlayManager.current.getConfiguration();
        setCurrentConfig(updatedConfig);
        
        if (onConfigurationChange) {
          onConfigurationChange(updatedConfig);
        }
      }

      animationId = requestAnimationFrame(monitorFrame);
    };

    animationId = requestAnimationFrame(monitorFrame);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [enablePerformanceAdaptation, testingMode, currentConfig, onPerformanceUpdate, onConfigurationChange]);

  // Generate render data
  const renderData = useMemo(() => {
    if (!isInitialized) return null;
    return overlayManager.current.generateRenderData(viewportState);
  }, [viewportState, isInitialized, currentConfig]);

  // Get overlay controls
  const overlayControls = useMemo(() => {
    return overlayManager.current.getControls();
  }, []);

  // Enhanced controls that include performance testing
  const enhancedControls = useMemo(() => ({
    ...overlayControls,
    startPerformanceTest: (testName: string) => {
      if (testingMode) {
        testRunner.current.startTest(testName);
      }
    },
    endPerformanceTest: () => {
      if (testingMode) {
        return testRunner.current.endTest();
      }
      return null;
    },
    getTestResults: () => testRunner.current.getResults(),
    clearTestResults: () => testRunner.current.clear(),
  }), [overlayControls, testingMode]);

  // Animated container style
  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: systemOpacity.value,
  }));

  // Resource harvest handler
  const handleResourceHarvest = (starSystem: StarSystem, resourceType: 'stellarEssence' | 'voidFragments', amount: number) => {
    if (onResourceHarvest) {
      onResourceHarvest(starSystem, resourceType, amount);
    }
  };

  if (!renderData) {
    return null;
  }

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Animated.View style={[{ flex: 1 }, animatedContainerStyle]}>
        <G>
          {/* Sector Boundaries Layer */}
          {currentConfig.showBoundaries && (
            <MultipleSectorBoundary
              sectors={renderData.visibleSectors}
              renderInfoMap={renderData.sectorRenderInfo}
              viewportState={viewportState}
              enableTransitions={enableTransitions && currentConfig.animations.enableTransitions}
              performanceMode={currentConfig.quality.maxSectors < 30}
              showHexagonalGrid={viewportState.scale > 0.8}
            />
          )}

          {/* Entropy Visualization Layer */}
          {currentConfig.showEntropyEffects && (
            <MultiSectorEntropyVisualization
              sectors={renderData.visibleSectors}
              viewportState={viewportState}
              enableParticleSystem={currentConfig.animations.enableParticleAnimations}
              particleQuality={currentConfig.quality.particleQuality}
              maxRenderCount={currentConfig.quality.maxEntropyEffects}
            />
          )}

          {/* Sector State Layer */}
          {currentConfig.showSectorStates && (
            <MultipleSectorStateRenderer
              sectorStates={renderData.sectorStates}
              viewportState={viewportState}
              enableAnimations={enableTransitions && currentConfig.animations.enablePulseEffects}
              performanceMode={currentConfig.quality.maxSectors < 30}
              maxRenderedStates={currentConfig.quality.maxSectors}
            />
          )}

          {/* Harvestable Resources Layer */}
          {currentConfig.showHarvestableResources && (
            <MultipleHarvestOverlay
              starSystems={renderData.visibleStarSystems}
              viewportState={viewportState}
              isOverlayActive={viewportState.scale > 0.5}
              maxOverlays={currentConfig.quality.maxHarvestIndicators}
              enableGlowEffects={currentConfig.animations.enablePulseEffects}
              enableAnimations={enableTransitions}
              performanceMode={currentConfig.quality.maxSectors < 30}
              onHarvest={(starSystem: StarSystem, resourceType: 'stellarEssence' | 'voidFragments') => {
                // MultipleHarvestOverlay callback has 2 params, but we need 3 for handleResourceHarvest
                const amount = resourceType === 'stellarEssence' 
                  ? starSystem.resources?.stellarEssence || 0
                  : starSystem.resources?.voidFragments || 0;
                handleResourceHarvest(starSystem, resourceType, amount);
              }}
            />
          )}
        </G>
      </Animated.View>

      {/* Overlay Controls */}
      {showControls && (
        <OverlayControls
          configuration={currentConfig}
          controls={enhancedControls}
          position={controlsPosition}
          showPerformanceInfo={enablePerformanceAdaptation}
          performanceStats={performanceMetrics ? {
            averageFrameTime: performanceMetrics.averageFrameTime,
            frameRate: 1000 / performanceMetrics.averageFrameTime,
            droppedFrames: performanceMetrics.droppedFrames,
            cacheHitRate: 0.8, // Placeholder - would come from actual cache metrics
          } : undefined}
        />
      )}
    </View>
  );
};

/**
 * Hook for using the Galaxy Overlay System with external state management
 */
export function useGalaxyOverlaySystem(
  sectors: GalacticSector[],
  starSystems: StarSystem[],
  initialConfig?: Partial<OverlayConfiguration>
) {
  const [configuration, setConfiguration] = useState<OverlayConfiguration>(() => ({
    ...DEFAULT_OVERLAY_CONFIG,
    ...initialConfig,
  }));
  
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [isOptimized, setIsOptimized] = useState(true);

  useEffect(() => {
    if (performanceMetrics) {
      setIsOptimized(performanceMetrics.performanceScore > 0.7);
    }
  }, [performanceMetrics]);

  return {
    configuration,
    setConfiguration,
    performanceMetrics,
    isOptimized,
    onPerformanceUpdate: setPerformanceMetrics,
    onConfigurationChange: setConfiguration,
  };
}

export default GalaxyOverlaySystem;