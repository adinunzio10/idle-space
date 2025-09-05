import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { galaxyMapConfig } from '../../utils/galaxy/GalaxyMapConfig';
import { poolManager } from '../../utils/performance/ObjectPool';
import { useReactProfilerIntegration } from '../../utils/performance/ReactProfilerIntegration';
import { usePerformanceAnalysis, AdvancedPerformanceMetrics } from '../../utils/performance/PerformanceAnalyzer';
import { performanceMonitor } from '../../utils/performance/monitor';

interface PerformanceDashboardProps {
  visible: boolean;
  onClose: () => void;
  moduleManager?: any; // Module manager instance for additional metrics
  position?: 'overlay' | 'sidebar';
  autoStart?: boolean;
  enableAdvancedAnalysis?: boolean;
}

interface PoolStats {
  poolSize: number;
  maxSize: number;
  totalCreated: number;
  utilizationRate: number;
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = React.memo(({
  visible,
  onClose,
  moduleManager,
  position = 'overlay',
  autoStart = false,
  enableAdvancedAnalysis = true,
}) => {
  // Existing state
  const [performanceStats, setPerformanceStats] = useState<any>(null);
  const [poolStats, setPoolStats] = useState<Record<string, PoolStats>>({});
  const [moduleMetrics, setModuleMetrics] = useState<any>(null);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  
  // New advanced analysis state
  const [activeTab, setActiveTab] = useState<'basic' | 'advanced' | 'components' | 'memory' | 'suggestions'>('basic');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [advancedMetrics, setAdvancedMetrics] = useState<AdvancedPerformanceMetrics | null>(null);
  const [analysisHistory, setAnalysisHistory] = useState<AdvancedPerformanceMetrics[]>([]);
  
  // Advanced analysis hooks
  const {
    isProfilerActive,
    profilerResults,
    startProfiling,
    stopProfiling,
  } = useReactProfilerIntegration();
  
  const { analyzer, startAnalysis, stopAnalysis } = usePerformanceAnalysis();

  // Auto-start analysis if requested
  useEffect(() => {
    if (visible && autoStart && enableAdvancedAnalysis && !isAnalyzing) {
      handleStartAnalysis();
    }
  }, [visible, autoStart, enableAdvancedAnalysis, handleStartAnalysis, isAnalyzing]);

  // Periodic advanced metrics update during analysis
  useEffect(() => {
    if (!isAnalyzing) return;

    const interval = setInterval(async () => {
      const currentMetrics = performanceMonitor.getCurrentMetrics();
      // Update with basic metrics during analysis
      setAdvancedMetrics(prev => prev ? { ...prev, ...currentMetrics } : null);
    }, 1000);

    return () => clearInterval(interval);
  }, [isAnalyzing]);

  /**
   * Start comprehensive performance analysis
   */
  const handleStartAnalysis = useCallback(async () => {
    if (!enableAdvancedAnalysis) return;
    
    try {
      setIsAnalyzing(true);
      console.log('[PerformanceDashboard] Starting comprehensive analysis');
      
      // Start both analyzers
      await Promise.all([
        startAnalysis(),
        startProfiling(),
      ]);
      
      console.log('[PerformanceDashboard] Analysis started successfully');
    } catch (error) {
      console.error('[PerformanceDashboard] Failed to start analysis:', error);
      Alert.alert('Error', 'Failed to start performance analysis');
      setIsAnalyzing(false);
    }
  }, [startAnalysis, startProfiling, enableAdvancedAnalysis]);

  /**
   * Stop analysis and generate final report
   */
  const handleStopAnalysis = useCallback(async () => {
    if (!enableAdvancedAnalysis) return;
    
    try {
      console.log('[PerformanceDashboard] Stopping analysis');
      
      // Stop both analyzers and get results
      const [analysisResults, profilerResults] = await Promise.all([
        stopAnalysis(),
        stopProfiling(),
      ]);
      
      setAdvancedMetrics(analysisResults);
      setAnalysisHistory(prev => [analysisResults, ...prev.slice(0, 9)]); // Keep last 10 analyses
      setIsAnalyzing(false);
      
      console.log('[PerformanceDashboard] Analysis complete:', {
        analysisResults,
        profilerResults,
      });
      
    } catch (error) {
      console.error('[PerformanceDashboard] Failed to stop analysis:', error);
      Alert.alert('Error', 'Failed to complete performance analysis');
      setIsAnalyzing(false);
    }
  }, [stopAnalysis, stopProfiling, enableAdvancedAnalysis]);

  /**
   * Clear analysis history
   */
  const handleClearHistory = useCallback(() => {
    setAnalysisHistory([]);
    setAdvancedMetrics(null);
  }, []);

  // Update stats regularly
  const updateStats = useCallback(() => {
    const stats = galaxyMapConfig.getPerformanceStats();
    setPerformanceStats(stats);
    
    const pools = poolManager.getStats();
    setPoolStats(pools);
    
    if (moduleManager) {
      const modules = moduleManager.getGlobalPerformanceMetrics();
      setModuleMetrics(modules);
    }
  }, [moduleManager]);

  useEffect(() => {
    if (visible) {
      updateStats();
      const interval = setInterval(updateStats, 500); // Update every 500ms
      setRefreshInterval(interval);
      
      return () => {
        if (interval) clearInterval(interval);
      };
    } else {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        setRefreshInterval(null);
      }
    }
  }, [visible, updateStats, refreshInterval]);

  // Quality level controls
  const handleQualityChange = useCallback((level: 'low' | 'medium' | 'high' | 'ultra') => {
    galaxyMapConfig.setQualityLevel(level, 'user manual');
  }, []);

  // Emergency controls
  const handleEmergencyCleanup = useCallback(() => {
    galaxyMapConfig.emergencyPoolCleanup();
  }, []);

  const handleEmergencyReset = useCallback(() => {
    galaxyMapConfig.emergencyReset();
  }, []);

  // Module controls
  const handleToggleModule = useCallback((moduleId: string, enabled: boolean) => {
    galaxyMapConfig.setModuleEnabled(moduleId, enabled);
  }, []);

  const renderPoolStats = useMemo(() => {
    return Object.entries(poolStats).map(([poolName, stats]) => (
      <View key={poolName} className="bg-gray-800 p-3 rounded mb-2">
        <Text className="text-white text-sm font-semibold">{poolName.toUpperCase()}</Text>
        <View className="flex-row justify-between mt-1">
          <Text className="text-gray-300 text-xs">Available: {stats.poolSize}/{stats.maxSize}</Text>
          <Text className={`text-xs ${stats.utilizationRate > 0.8 ? 'text-red-400' : 'text-green-400'}`}>
            Usage: {(stats.utilizationRate * 100).toFixed(1)}%
          </Text>
        </View>
        <Text className="text-gray-400 text-xs">Total Created: {stats.totalCreated}</Text>
      </View>
    ));
  }, [poolStats]);

  const renderModuleControls = useMemo(() => {
    if (!performanceStats) return null;

    const allModules = [...performanceStats.enabledModules, ...performanceStats.disabledModules];
    
    return allModules.map(moduleId => {
      const isEnabled = performanceStats.enabledModules.includes(moduleId);
      return (
        <View key={moduleId} className="flex-row items-center justify-between bg-gray-800 p-2 rounded mb-1">
          <Text className="text-white text-sm">{moduleId}</Text>
          <TouchableOpacity
            onPress={() => handleToggleModule(moduleId, !isEnabled)}
            className={`px-3 py-1 rounded ${isEnabled ? 'bg-green-600' : 'bg-red-600'}`}
          >
            <Text className="text-white text-xs font-semibold">
              {isEnabled ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>
        </View>
      );
    });
  }, [performanceStats, handleToggleModule]);

  if (!visible) return null;

  const containerStyle = position === 'overlay' 
    ? "absolute inset-0 bg-black bg-opacity-90 flex-1 z-50"
    : "flex-1 bg-gray-900";

  return (
    <View className={containerStyle}>
      <View className="flex-1 bg-gray-900 m-4 rounded-lg p-4">
        {/* Header */}
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-white text-xl font-bold">Performance Dashboard</Text>
          <View className="flex-row items-center space-x-2">
            {/* Advanced Analysis Control */}
            {enableAdvancedAnalysis && (
              <TouchableOpacity
                onPress={isAnalyzing ? handleStopAnalysis : handleStartAnalysis}
                className={`px-4 py-2 rounded ${
                  isAnalyzing ? 'bg-red-600' : 'bg-green-600'
                }`}
              >
                <Text className="text-white text-sm font-semibold">
                  {isAnalyzing ? 'Stop Analysis' : 'Start Analysis'}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={onClose}
              className="bg-gray-700 px-4 py-2 rounded"
            >
              <Text className="text-white text-sm">Close</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Status Indicator */}
        {enableAdvancedAnalysis && (
          <View className="px-4 py-2 bg-gray-800 rounded mb-4">
            <View className="flex-row items-center space-x-4">
              <View className={`w-3 h-3 rounded-full ${isAnalyzing ? 'bg-green-500' : 'bg-gray-500'}`} />
              <Text className="text-white text-sm">
                {isAnalyzing ? 'Analysis Running' : 'Analysis Stopped'} • 
                {isProfilerActive ? ' React Profiler Active' : ' React Profiler Inactive'} • 
                Samples: {analysisHistory.length}
              </Text>
            </View>
          </View>
        )}

        {/* Tab Navigation */}
        {enableAdvancedAnalysis && (
          <View className="flex-row border-b border-gray-600 mb-4">
            {(['basic', 'advanced', 'components', 'memory', 'suggestions'] as const).map(tab => (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                className={`flex-1 py-3 px-4 ${
                  activeTab === tab ? 'bg-blue-600' : 'bg-transparent'
                }`}
              >
                <Text className={`text-center text-sm font-semibold ${
                  activeTab === tab ? 'text-white' : 'text-gray-300'
                }`}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <ScrollView className="flex-1">
          {/* Show content based on active tab */}
          {(!enableAdvancedAnalysis || activeTab === 'basic') && performanceStats && (
            <>
              {/* Overall Performance */}
              <View className="bg-gray-800 p-4 rounded mb-4">
                <Text className="text-white text-lg font-semibold mb-2">Overall Performance</Text>
                <View className="grid grid-cols-2 gap-2">
                  <Text className="text-gray-300 text-sm">
                    FPS: <Text className={performanceStats.averageFps > 50 ? "text-green-400" : performanceStats.averageFps > 30 ? "text-yellow-400" : "text-red-400"}>{performanceStats.averageFps}</Text>
                  </Text>
                  <Text className="text-gray-300 text-sm">
                    Quality: <Text className="text-blue-400">{performanceStats.currentQuality.toUpperCase()}</Text>
                  </Text>
                  <Text className="text-gray-300 text-sm">
                    Frame Skip: <Text className="text-yellow-400">{(performanceStats.skipRatio * 100).toFixed(1)}%</Text>
                  </Text>
                  <Text className="text-gray-300 text-sm">
                    Performance Mode: <Text className={performanceStats.performanceMode ? "text-red-400" : "text-green-400"}>{performanceStats.performanceMode ? "ON" : "OFF"}</Text>
                  </Text>
                </View>
              </View>

              {/* Quality Controls */}
              <View className="bg-gray-800 p-4 rounded mb-4">
                <Text className="text-white text-lg font-semibold mb-3">Quality Level</Text>
                <View className="flex-row space-x-2">
                  {(['low', 'medium', 'high', 'ultra'] as const).map(level => (
                    <TouchableOpacity
                      key={level}
                      onPress={() => handleQualityChange(level)}
                      className={`px-4 py-2 rounded ${
                        performanceStats.currentQuality === level ? 'bg-blue-600' : 'bg-gray-700'
                      }`}
                    >
                      <Text className="text-white text-xs font-semibold uppercase">{level}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Object Pool Stats */}
              <View className="bg-gray-800 p-4 rounded mb-4">
                <Text className="text-white text-lg font-semibold mb-3">Object Pool Status</Text>
                {renderPoolStats}
                <View className="flex-row space-x-2 mt-3">
                  <TouchableOpacity
                    onPress={handleEmergencyCleanup}
                    className="bg-yellow-600 px-3 py-2 rounded flex-1"
                  >
                    <Text className="text-white text-xs font-semibold text-center">Clean Pools</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleEmergencyReset}
                    className="bg-red-600 px-3 py-2 rounded flex-1"
                  >
                    <Text className="text-white text-xs font-semibold text-center">Emergency Reset</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Module Controls */}
              <View className="bg-gray-800 p-4 rounded mb-4">
                <Text className="text-white text-lg font-semibold mb-3">Module Controls</Text>
                {renderModuleControls}
              </View>

              {/* Module Performance */}
              {moduleMetrics && (
                <View className="bg-gray-800 p-4 rounded mb-4">
                  <Text className="text-white text-lg font-semibold mb-3">Module Performance</Text>
                  <Text className="text-gray-300 text-sm">
                    Active Modules: <Text className="text-green-400">{moduleMetrics.activeModules?.length || 0}</Text>
                  </Text>
                  <Text className="text-gray-300 text-sm">
                    Disabled Modules: <Text className="text-red-400">{moduleMetrics.disabledModules?.length || 0}</Text>
                  </Text>
                  {moduleMetrics.disabledModules?.length > 0 && (
                    <Text className="text-red-400 text-xs mt-1">
                      Disabled: {moduleMetrics.disabledModules.join(', ')}
                    </Text>
                  )}
                </View>
              )}
            </>
          )}

          {/* Advanced Analysis Tabs */}
          {enableAdvancedAnalysis && activeTab === 'advanced' && (
            <AdvancedOverviewTab metrics={advancedMetrics} isAnalyzing={isAnalyzing} />
          )}

          {enableAdvancedAnalysis && activeTab === 'components' && (
            <ComponentsAnalysisTab 
              metrics={advancedMetrics} 
              profilerResults={profilerResults}
              isAnalyzing={isAnalyzing} 
            />
          )}

          {enableAdvancedAnalysis && activeTab === 'memory' && (
            <MemoryAnalysisTab metrics={advancedMetrics} profilerResults={profilerResults} />
          )}

          {enableAdvancedAnalysis && activeTab === 'suggestions' && (
            <SuggestionsTab 
              metrics={advancedMetrics} 
              profilerResults={profilerResults} 
            />
          )}
        </ScrollView>

        {/* Footer with history controls */}
        {enableAdvancedAnalysis && (
          <View className="p-4 border-t border-gray-600">
            <View className="flex-row items-center justify-between">
              <Text className="text-gray-400 text-xs">
                {analysisHistory.length > 0 ? `Last: ${new Date(analysisHistory[0]?.timestamp || 0).toLocaleTimeString()}` : 'No analysis data'}
              </Text>
              <TouchableOpacity
                onPress={handleClearHistory}
                className="bg-gray-600 px-3 py-1 rounded"
              >
                <Text className="text-white text-xs">Clear History</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
});

/**
 * Advanced Overview Tab - Performance metrics summary
 */
const AdvancedOverviewTab: React.FC<{
  metrics: AdvancedPerformanceMetrics | null;
  isAnalyzing: boolean;
}> = ({ metrics, isAnalyzing }) => {
  if (!metrics && !isAnalyzing) {
    return (
      <View className="items-center justify-center py-8">
        <Text className="text-gray-400 text-center">
          Start analysis to view advanced performance metrics
        </Text>
      </View>
    );
  }

  const currentMetrics = metrics || performanceMonitor.getCurrentMetrics();

  return (
    <View className="space-y-4">
      {/* Key Metrics */}
      <View className="bg-gray-800 rounded-lg p-4">
        <Text className="text-white font-semibold mb-3">Key Metrics</Text>
        <View className="grid grid-cols-2 gap-4">
          <MetricCard
            title="Frame Rate"
            value={`${Math.round(currentMetrics.fps)} FPS`}
            color={currentMetrics.fps >= 55 ? 'green' : currentMetrics.fps >= 30 ? 'yellow' : 'red'}
            subtitle={`${currentMetrics.frameDrops}% drops`}
          />
          <MetricCard
            title="Render Time"
            value={`${currentMetrics.renderTime.toFixed(1)}ms`}
            color={currentMetrics.renderTime <= 16.67 ? 'green' : currentMetrics.renderTime <= 33 ? 'yellow' : 'red'}
            subtitle="Average frame"
          />
        </View>
      </View>

      {/* Component Performance */}
      {metrics && (
        <View className="bg-gray-800 rounded-lg p-4">
          <Text className="text-white font-semibold mb-3">Component Performance</Text>
          <View className="grid grid-cols-2 gap-4">
            <MetricCard
              title="Total Renders"
              value={metrics.componentRenderCount.toString()}
              color="blue"
              subtitle="All components"
            />
            <MetricCard
              title="Slow Components"
              value={metrics.slowComponents.length.toString()}
              color={metrics.slowComponents.length === 0 ? 'green' : metrics.slowComponents.length < 3 ? 'yellow' : 'red'}
              subtitle="Need optimization"
            />
          </View>
        </View>
      )}

      {/* Memory Usage */}
      {metrics && (
        <View className="bg-gray-800 rounded-lg p-4">
          <Text className="text-white font-semibold mb-3">Memory Usage</Text>
          <View className="grid grid-cols-2 gap-4">
            <MetricCard
              title="JS Heap"
              value={`${metrics.jsHeapUsed.toFixed(1)}MB`}
              color={metrics.jsHeapUsed < 50 ? 'green' : metrics.jsHeapUsed < 100 ? 'yellow' : 'red'}
              subtitle={`${metrics.jsHeapSize.toFixed(1)}MB total`}
            />
            <MetricCard
              title="Memory Leaks"
              value={metrics.memoryLeakSuspects.length.toString()}
              color={metrics.memoryLeakSuspects.length === 0 ? 'green' : 'red'}
              subtitle="Suspected"
            />
          </View>
        </View>
      )}
    </View>
  );
};

/**
 * Components Analysis Tab
 */
const ComponentsAnalysisTab: React.FC<{
  metrics: AdvancedPerformanceMetrics | null;
  profilerResults: any;
  isAnalyzing: boolean;
}> = ({ metrics, profilerResults, isAnalyzing }) => {
  if (!metrics && !profilerResults) {
    return (
      <View className="items-center justify-center py-8">
        <Text className="text-gray-400 text-center">
          {isAnalyzing ? 'Collecting component data...' : 'Start analysis to view component performance'}
        </Text>
      </View>
    );
  }

  return (
    <View className="space-y-4">
      {/* Slow Components */}
      {metrics?.slowComponents && metrics.slowComponents.length > 0 && (
        <View className="bg-gray-800 rounded-lg p-4">
          <Text className="text-white font-semibold mb-3">
            Slow Components ({metrics.slowComponents.length})
          </Text>
          {metrics.slowComponents.slice(0, 5).map((component, index) => (
            <View key={index} className="mb-3 p-3 bg-gray-700 rounded">
              <Text className="text-white font-medium">{component.componentName}</Text>
              <Text className="text-gray-300 text-sm">
                Renders: {component.renderCount} • 
                Avg: {component.averageRenderTime.toFixed(2)}ms • 
                Max: {component.maxRenderTime.toFixed(2)}ms
              </Text>
              <Text className="text-gray-400 text-xs mt-1">
                Total time: {component.totalRenderTime.toFixed(2)}ms
              </Text>
              {component.suggestedOptimizations.length > 0 && (
                <View className="mt-2">
                  <Text className="text-yellow-400 text-xs font-medium">Suggestions:</Text>
                  {component.suggestedOptimizations.slice(0, 2).map((suggestion, idx) => (
                    <Text key={idx} className="text-yellow-300 text-xs">• {suggestion}</Text>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Render Loops */}
      {profilerResults?.renderLoops && profilerResults.renderLoops.length > 0 && (
        <View className="bg-red-900 bg-opacity-50 rounded-lg p-4">
          <Text className="text-red-200 font-semibold mb-3">
            Render Loop Detection ({profilerResults.renderLoops.length})
          </Text>
          {profilerResults.renderLoops.map((loop: any, index: number) => (
            <View key={index} className="mb-3 p-3 bg-red-800 bg-opacity-50 rounded">
              <Text className="text-red-200 font-medium">{loop.componentName}</Text>
              <Text className="text-red-300 text-sm">
                Type: {loop.loopType} • 
                Frequency: {loop.frequency} renders/5s • 
                Confidence: {Math.round(loop.confidence * 100)}%
              </Text>
              <Text className="text-red-400 text-xs mt-1">{loop.suggestion}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

/**
 * Memory Analysis Tab
 */
const MemoryAnalysisTab: React.FC<{
  metrics: AdvancedPerformanceMetrics | null;
  profilerResults: any;
}> = ({ metrics, profilerResults }) => {
  if (!metrics) {
    return (
      <View className="items-center justify-center py-8">
        <Text className="text-gray-400 text-center">
          Start analysis to view memory metrics
        </Text>
      </View>
    );
  }

  return (
    <View className="space-y-4">
      {/* Memory Overview */}
      <View className="bg-gray-800 rounded-lg p-4">
        <Text className="text-white font-semibold mb-3">Memory Overview</Text>
        <View className="grid grid-cols-2 gap-4">
          <MetricCard
            title="Heap Used"
            value={`${metrics.jsHeapUsed.toFixed(1)}MB`}
            color={metrics.jsHeapUsed < 50 ? 'green' : metrics.jsHeapUsed < 100 ? 'yellow' : 'red'}
            subtitle={`of ${metrics.jsHeapSize.toFixed(1)}MB`}
          />
          <MetricCard
            title="Memory Warnings"
            value={metrics.totalMemoryWarnings.toString()}
            color={metrics.totalMemoryWarnings === 0 ? 'green' : 'red'}
            subtitle="System alerts"
          />
        </View>
      </View>

      {/* Memory Leak Suspects */}
      {metrics.memoryLeakSuspects.length > 0 && (
        <View className="bg-orange-900 bg-opacity-50 rounded-lg p-4">
          <Text className="text-orange-200 font-semibold mb-3">
            Memory Leak Suspects ({metrics.memoryLeakSuspects.length})
          </Text>
          {metrics.memoryLeakSuspects.map((leak, index) => (
            <View key={index} className="mb-3 p-3 bg-orange-800 bg-opacity-50 rounded">
              <Text className="text-orange-200 font-medium">{leak.type.toUpperCase()}</Text>
              <Text className="text-orange-300 text-sm">{leak.description}</Text>
              <Text className="text-orange-400 text-xs mt-1">
                Impact: ~{leak.memoryImpact}MB • 
                Severity: {leak.severity} • 
                Detected: {new Date(leak.detectedAt).toLocaleTimeString()}
              </Text>
              <View className="mt-2 p-2 bg-orange-700 bg-opacity-50 rounded">
                <Text className="text-orange-200 text-xs font-medium">Fix:</Text>
                <Text className="text-orange-300 text-xs">{leak.suggestedFix}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

/**
 * Suggestions Tab - Optimization recommendations
 */
const SuggestionsTab: React.FC<{
  metrics: AdvancedPerformanceMetrics | null;
  profilerResults: any;
}> = ({ metrics, profilerResults }) => {
  const allSuggestions = [
    ...(metrics?.suggestions || []),
    ...(profilerResults?.optimizationSuggestions || []),
  ];

  if (allSuggestions.length === 0) {
    return (
      <View className="items-center justify-center py-8">
        <Text className="text-gray-400 text-center">
          No optimization suggestions yet
        </Text>
        <Text className="text-gray-500 text-sm text-center mt-2">
          Run analysis to get personalized recommendations
        </Text>
      </View>
    );
  }

  const suggestionsByPriority = {
    critical: allSuggestions.filter(s => s.priority === 'critical'),
    high: allSuggestions.filter(s => s.priority === 'high'),
    medium: allSuggestions.filter(s => s.priority === 'medium'),
    low: allSuggestions.filter(s => s.priority === 'low'),
  };

  return (
    <View className="space-y-4">
      {(['critical', 'high', 'medium', 'low'] as const).map(priority => {
        const suggestions = suggestionsByPriority[priority];
        if (suggestions.length === 0) return null;

        return (
          <View
            key={priority}
            className={`rounded-lg p-4 ${
              priority === 'critical' ? 'bg-red-900 bg-opacity-50' :
              priority === 'high' ? 'bg-orange-900 bg-opacity-50' :
              priority === 'medium' ? 'bg-yellow-900 bg-opacity-50' :
              'bg-blue-900 bg-opacity-50'
            }`}
          >
            <Text className={`font-semibold mb-3 ${
              priority === 'critical' ? 'text-red-200' :
              priority === 'high' ? 'text-orange-200' :
              priority === 'medium' ? 'text-yellow-200' :
              'text-blue-200'
            }`}>
              {priority.charAt(0).toUpperCase() + priority.slice(1)} Priority ({suggestions.length})
            </Text>
            
            {suggestions.map((suggestion, index) => (
              <SuggestionCard key={index} suggestion={suggestion} priority={priority} />
            ))}
          </View>
        );
      })}
    </View>
  );
};

/**
 * Metric Card Component
 */
const MetricCard: React.FC<{
  title: string;
  value: string;
  color: 'green' | 'yellow' | 'red' | 'blue' | 'purple';
  subtitle?: string;
  size?: 'normal' | 'small';
}> = ({ title, value, color, subtitle, size = 'normal' }) => {
  const colorClasses = {
    green: 'text-green-400',
    yellow: 'text-yellow-400',
    red: 'text-red-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
  };

  return (
    <View className={`${size === 'small' ? 'p-2' : 'p-3'} bg-gray-700 rounded`}>
      <Text className={`text-gray-300 ${size === 'small' ? 'text-xs' : 'text-sm'}`}>{title}</Text>
      <Text className={`font-bold ${size === 'small' ? 'text-sm' : 'text-lg'} ${colorClasses[color]}`}>
        {value}
      </Text>
      {subtitle && (
        <Text className={`text-gray-400 ${size === 'small' ? 'text-xs' : 'text-xs'}`}>
          {subtitle}
        </Text>
      )}
    </View>
  );
};

/**
 * Suggestion Card Component
 */
const SuggestionCard: React.FC<{
  suggestion: any;
  priority: string;
}> = ({ suggestion, priority }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <View className="mb-3 p-3 bg-black bg-opacity-30 rounded">
      <TouchableOpacity onPress={() => setExpanded(!expanded)}>
        <View className="flex-row items-center justify-between">
          <Text className="text-white font-medium flex-1">{suggestion.type?.toUpperCase()}: {suggestion.component}</Text>
          <Text className="text-gray-400 text-xs ml-2">{expanded ? '▼' : '▶'}</Text>
        </View>
        <Text className="text-gray-300 text-sm mt-1">{suggestion.description}</Text>
        <Text className="text-gray-400 text-xs mt-1">Impact: {suggestion.estimatedImpact}</Text>
      </TouchableOpacity>

      {expanded && (
        <View className="mt-3 p-2 bg-gray-800 rounded">
          <Text className="text-white text-sm font-medium mb-1">Implementation:</Text>
          <Text className="text-gray-300 text-sm">{suggestion.implementationGuide}</Text>
        </View>
      )}
    </View>
  );
};

export default PerformanceDashboard;