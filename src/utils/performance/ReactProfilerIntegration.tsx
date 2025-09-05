/**
 * React DevTools Profiler Integration
 * 
 * This component provides deep integration with React DevTools Profiler
 * to automatically detect infinite render loops, analyze component performance,
 * and provide optimization suggestions.
 */

import React, { Profiler, ProfilerOnRenderCallback, useEffect, useRef, useState } from 'react';
import { performanceAnalyzer } from './PerformanceAnalyzer';

/**
 * Profiler interaction data
 */
export interface ProfilerInteraction {
  id: number;
  name: string;
  timestamp: number;
}

/**
 * Component render phase data
 */
export interface RenderPhaseData {
  id: string;
  phase: 'mount' | 'update' | 'nested-update';
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
}

/**
 * Performance profiler results
 */
export interface ProfilerResults {
  slowComponents: ComponentProfileData[];
  renderLoops: RenderLoopDetection[];
  memoryLeaks: MemoryLeakAlert[];
  optimizationSuggestions: OptimizationSuggestion[];
}

/**
 * Component profile data
 */
export interface ComponentProfileData {
  componentName: string;
  mountTime: number;
  updateTime: number;
  renderCount: number;
  averageRenderTime: number;
  isProblematic: boolean;
  suggestions: string[];
}

/**
 * Render loop detection result
 */
export interface RenderLoopDetection {
  componentName: string;
  loopType: 'infinite' | 'excessive' | 'cascade';
  frequency: number;
  confidence: number;
  trigger: string;
  suggestion: string;
}

/**
 * Memory leak alert
 */
export interface MemoryLeakAlert {
  type: 'listener' | 'timer' | 'closure' | 'dom';
  component: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  detectedAt: number;
}

/**
 * Optimization suggestion
 */
export interface OptimizationSuggestion {
  type: 'memo' | 'callback' | 'useMemo' | 'lazy' | 'virtualization';
  component: string;
  issue: string;
  solution: string;
  impact: 'low' | 'medium' | 'high';
  codeExample?: string;
}

/**
 * Render tracking data for a single component
 */
interface ComponentRenderData {
  name: string;
  renders: RenderPhaseData[];
  lastRenderTime: number;
  renderFrequency: number[];
  problematicPatterns: string[];
}

/**
 * React Profiler Integration Hook
 */
export function useReactProfilerIntegration() {
  const [isProfilerActive, setIsProfilerActive] = useState(false);
  const [profilerResults, setProfilerResults] = useState<ProfilerResults | null>(null);
  const renderDataRef = useRef(new Map<string, ComponentRenderData>());
  const analysisIntervalRef = useRef<any>(null);
  
  // Track renders across all profiled components
  const onRenderCallback: ProfilerOnRenderCallback = React.useCallback((
    id: string,
    phase: "mount" | "update" | "nested-update",
    actualDuration: number,
    baseDuration: number,
    startTime: number,
    commitTime: number
  ) => {
    if (!isProfilerActive) return;

    const renderData: RenderPhaseData = {
      id,
      phase,
      actualDuration,
      baseDuration,
      startTime,
      commitTime,
    };

    // Track component render data
    const componentData = renderDataRef.current.get(id) || {
      name: id,
      renders: [],
      lastRenderTime: 0,
      renderFrequency: [],
      problematicPatterns: [],
    };

    componentData.renders.push(renderData);
    componentData.lastRenderTime = commitTime;
    componentData.renderFrequency.push(Date.now());

    // Keep only recent render frequency data (last 5 seconds)
    const fiveSecondsAgo = Date.now() - 5000;
    componentData.renderFrequency = componentData.renderFrequency.filter(
      time => time > fiveSecondsAgo
    );

    // Limit render history to prevent memory bloat
    if (componentData.renders.length > 100) {
      componentData.renders = componentData.renders.slice(-50);
    }

    renderDataRef.current.set(id, componentData);

    // Track with performance analyzer
    performanceAnalyzer.trackComponentRender(
      id,
      actualDuration,
      phase === 'update'
    );

    // Detect immediate issues
    detectImmediateIssues(componentData);
  }, [isProfilerActive]);

  /**
   * Start profiler analysis
   */
  const startProfiling = React.useCallback(() => {
    console.log('[ReactProfilerIntegration] Starting React profiler analysis');
    setIsProfilerActive(true);
    
    // Clear previous data
    renderDataRef.current.clear();
    setProfilerResults(null);
    
    // Start performance analyzer
    performanceAnalyzer.startAnalysis();
    
    // Set up periodic analysis
    analysisIntervalRef.current = setInterval(() => {
      analyzeRenderData();
    }, 2000); // Analyze every 2 seconds
    
    // Set up React DevTools integration if available
    setupReactDevToolsIntegration();
  }, []);

  /**
   * Stop profiler analysis and generate report
   */
  const stopProfiling = React.useCallback(async () => {
    console.log('[ReactProfilerIntegration] Stopping React profiler analysis');
    setIsProfilerActive(false);
    
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
    }
    
    // Generate final analysis
    const results = await generateProfilerResults();
    setProfilerResults(results);
    
    // Stop performance analyzer
    await performanceAnalyzer.stopAnalysis();
    
    console.log('[ReactProfilerIntegration] Profiler analysis complete', results);
    return results;
  }, []);

  /**
   * Analyze render data for patterns and issues
   */
  const analyzeRenderData = React.useCallback(() => {
    const components = Array.from(renderDataRef.current.values());
    
    for (const component of components) {
      // Check for excessive renders
      if (component.renderFrequency.length > 20) { // More than 20 renders in 5 seconds
        if (!component.problematicPatterns.includes('excessive-renders')) {
          component.problematicPatterns.push('excessive-renders');
          console.warn(`[ReactProfiler] Excessive renders detected in ${component.name}: ${component.renderFrequency.length} renders in 5s`);
        }
      }
      
      // Check for slow renders
      const recentRenders = component.renders.slice(-5);
      const averageRenderTime = recentRenders.reduce((sum, render) => sum + render.actualDuration, 0) / recentRenders.length;
      
      if (averageRenderTime > 16) { // Slower than 60fps budget
        if (!component.problematicPatterns.includes('slow-renders')) {
          component.problematicPatterns.push('slow-renders');
          console.warn(`[ReactProfiler] Slow renders detected in ${component.name}: average ${averageRenderTime.toFixed(2)}ms`);
        }
      }
      
      // Check for render cascades
      const cascadeRenders = recentRenders.filter(render => 
        render.phase === 'update' && render.actualDuration > 5
      );
      
      if (cascadeRenders.length > 3) {
        if (!component.problematicPatterns.includes('render-cascade')) {
          component.problematicPatterns.push('render-cascade');
          console.warn(`[ReactProfiler] Render cascade detected in ${component.name}`);
        }
      }
    }
  }, []);

  /**
   * Generate comprehensive profiler results
   */
  const generateProfilerResults = React.useCallback(async (): Promise<ProfilerResults> => {
    const components = Array.from(renderDataRef.current.values());
    
    // Analyze slow components
    const slowComponents: ComponentProfileData[] = components
      .filter(component => component.renders.length > 0)
      .map(component => {
        const totalRenderTime = component.renders.reduce((sum, render) => sum + render.actualDuration, 0);
        const averageRenderTime = totalRenderTime / component.renders.length;
        const mountRenders = component.renders.filter(render => render.phase === 'mount');
        const updateRenders = component.renders.filter(render => render.phase === 'update');
        
        return {
          componentName: component.name,
          mountTime: mountRenders.reduce((sum, render) => sum + render.actualDuration, 0),
          updateTime: updateRenders.reduce((sum, render) => sum + render.actualDuration, 0),
          renderCount: component.renders.length,
          averageRenderTime,
          isProblematic: component.problematicPatterns.length > 0,
          suggestions: generateComponentSuggestions(component),
        };
      })
      .filter(component => component.isProblematic || component.averageRenderTime > 10)
      .sort((a, b) => b.averageRenderTime - a.averageRenderTime);

    // Detect render loops
    const renderLoops: RenderLoopDetection[] = [];
    for (const component of components) {
      const loopDetection = detectRenderLoop(component);
      if (loopDetection) {
        renderLoops.push(loopDetection);
      }
    }

    // Generate memory leak alerts (basic heuristics)
    const memoryLeaks: MemoryLeakAlert[] = generateMemoryLeakAlerts(components);

    // Generate optimization suggestions
    const optimizationSuggestions: OptimizationSuggestion[] = generateOptimizationSuggestions(slowComponents);

    return {
      slowComponents,
      renderLoops,
      memoryLeaks,
      optimizationSuggestions,
    };
  }, []);

  return {
    isProfilerActive,
    profilerResults,
    startProfiling,
    stopProfiling,
    onRenderCallback,
    analyzeRenderData,
  };
}

/**
 * React Profiler Wrapper Component
 */
interface ReactProfilerWrapperProps {
  children: React.ReactNode;
  id: string;
  enabled?: boolean;
}

export const ReactProfilerWrapper: React.FC<ReactProfilerWrapperProps> = ({
  children,
  id,
  enabled = __DEV__,
}) => {
  const { onRenderCallback, isProfilerActive } = useReactProfilerIntegration();

  if (!enabled || !isProfilerActive) {
    return <>{children}</>;
  }

  return (
    <Profiler id={id} onRender={onRenderCallback}>
      {children}
    </Profiler>
  );
};

/**
 * Galaxy Map Profiler - Specialized profiler for the galaxy map system
 */
export const GalaxyMapProfiler: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { onRenderCallback, isProfilerActive } = useReactProfilerIntegration();

  return (
    <Profiler id="GalaxyMapRoot" onRender={onRenderCallback}>
      <Profiler id="GalaxyMapView" onRender={onRenderCallback}>
        <Profiler id="BeaconRenderer" onRender={onRenderCallback}>
          <Profiler id="ConnectionRenderer" onRender={onRenderCallback}>
            <Profiler id="PatternRenderer" onRender={onRenderCallback}>
              <Profiler id="StarField" onRender={onRenderCallback}>
                <Profiler id="PerformanceOverlay" onRender={onRenderCallback}>
                  {children}
                </Profiler>
              </Profiler>
            </Profiler>
          </Profiler>
        </Profiler>
      </Profiler>
    </Profiler>
  );
};

// Helper functions

/**
 * Detect immediate rendering issues
 */
function detectImmediateIssues(componentData: ComponentRenderData): void {
  const recentRenders = componentData.renderFrequency.slice(-10);
  
  // Check for rapid successive renders (potential infinite loop)
  if (recentRenders.length >= 10) {
    const timeSpan = recentRenders[recentRenders.length - 1] - recentRenders[0];
    if (timeSpan < 100) { // 10 renders in less than 100ms
      console.error(`[ReactProfiler] Potential infinite render loop detected in ${componentData.name}`);
    }
  }
}

/**
 * Generate suggestions for a component
 */
function generateComponentSuggestions(component: ComponentRenderData): string[] {
  const suggestions: string[] = [];
  
  if (component.problematicPatterns.includes('excessive-renders')) {
    suggestions.push('Consider using React.memo() to prevent unnecessary re-renders');
    suggestions.push('Check if props are being recreated on every render');
  }
  
  if (component.problematicPatterns.includes('slow-renders')) {
    suggestions.push('Use useMemo() for expensive calculations');
    suggestions.push('Consider splitting component into smaller parts');
    suggestions.push('Profile component logic to identify bottlenecks');
  }
  
  if (component.problematicPatterns.includes('render-cascade')) {
    suggestions.push('Review useEffect dependencies to prevent cascade renders');
    suggestions.push('Consider batching state updates');
  }
  
  return suggestions;
}

/**
 * Detect render loops in component data
 */
function detectRenderLoop(component: ComponentRenderData): RenderLoopDetection | null {
  // Simple heuristic: more than 50 renders in 5 seconds
  if (component.renderFrequency.length > 50) {
    return {
      componentName: component.name,
      loopType: 'infinite',
      frequency: component.renderFrequency.length,
      confidence: Math.min(component.renderFrequency.length / 50, 1),
      trigger: 'State update cycle or dependency issue',
      suggestion: 'Check useEffect dependencies and state update patterns',
    };
  }
  
  // Check for excessive updates
  if (component.renderFrequency.length > 20) {
    return {
      componentName: component.name,
      loopType: 'excessive',
      frequency: component.renderFrequency.length,
      confidence: Math.min(component.renderFrequency.length / 20, 1),
      trigger: 'Frequent prop changes or parent re-renders',
      suggestion: 'Consider memoization or component optimization',
    };
  }
  
  return null;
}

/**
 * Generate memory leak alerts based on component behavior
 */
function generateMemoryLeakAlerts(components: ComponentRenderData[]): MemoryLeakAlert[] {
  const alerts: MemoryLeakAlert[] = [];
  
  // Components with very high render counts might indicate memory leaks
  for (const component of components) {
    if (component.renders.length > 1000) {
      alerts.push({
        type: 'closure',
        component: component.name,
        description: `Component has rendered ${component.renders.length} times, potentially indicating a memory leak`,
        severity: 'medium',
        detectedAt: Date.now(),
      });
    }
  }
  
  return alerts;
}

/**
 * Generate optimization suggestions based on slow components
 */
function generateOptimizationSuggestions(slowComponents: ComponentProfileData[]): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = [];
  
  for (const component of slowComponents.slice(0, 5)) { // Top 5 slow components
    if (component.averageRenderTime > 20) {
      suggestions.push({
        type: 'useMemo',
        component: component.componentName,
        issue: `Slow render time: ${component.averageRenderTime.toFixed(2)}ms average`,
        solution: 'Memoize expensive calculations and object creations',
        impact: 'high',
        codeExample: `
const memoizedValue = useMemo(() => {
  return expensiveCalculation(props.data);
}, [props.data]);`,
      });
    }
    
    if (component.renderCount > 100) {
      suggestions.push({
        type: 'memo',
        component: component.componentName,
        issue: `High render count: ${component.renderCount} renders`,
        solution: 'Wrap component with React.memo to prevent unnecessary re-renders',
        impact: 'medium',
        codeExample: `
export default React.memo(${component.componentName}, (prevProps, nextProps) => {
  // Custom comparison logic if needed
  return shallowEqual(prevProps, nextProps);
});`,
      });
    }
  }
  
  return suggestions;
}

/**
 * Setup React DevTools integration
 */
function setupReactDevToolsIntegration(): void {
  if (__DEV__ && typeof window !== 'undefined') {
    const hook = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (hook) {
      console.log('[ReactProfiler] React DevTools integration enabled');
      // Additional DevTools integration logic can be added here
    }
  }
}