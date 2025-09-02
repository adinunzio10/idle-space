import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { fpsMonitor, useFPSMonitor } from '../../utils/performance/FPSMonitor';
import { performanceMonitor } from '../../utils/performance/monitor';
import { poolManager } from '../../utils/performance/ObjectPool';
import { useBatteryOptimizationWithSettings } from '../../hooks/useBatteryOptimization';

interface PerformanceOverlayProps {
  visible: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  compact?: boolean;
  onToggle?: () => void;
}

export const PerformanceOverlay: React.FC<PerformanceOverlayProps> = ({
  visible,
  position = 'top-right',
  compact = false,
  onToggle,
}) => {
  const fpsMetrics = useFPSMonitor();
  const { state: batteryState, metrics: batteryMetrics } = useBatteryOptimizationWithSettings();
  const [expanded, setExpanded] = useState(false);
  const [poolStats, setPoolStats] = useState<any>({});
  const [performanceHistory, setPerformanceHistory] = useState<any[]>([]);

  useEffect(() => {
    if (!visible) return;

    const interval = setInterval(() => {
      // Update pool statistics
      setPoolStats(poolManager.getStats());
      
      // Update performance history
      const currentMetrics = performanceMonitor.getCurrentMetrics();
      setPerformanceHistory(prev => {
        const newHistory = [...prev, currentMetrics].slice(-60); // Keep last 60 seconds
        return newHistory;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [visible]);

  if (!visible) return null;

  const positionStyles = {
    'top-left': { top: 50, left: 10 },
    'top-right': { top: 50, right: 10 },
    'bottom-left': { bottom: 50, left: 10 },
    'bottom-right': { bottom: 50, right: 10 },
  };

  const getColorForFPS = (fps: number): string => {
    if (fps >= 55) return '#10B981'; // Green
    if (fps >= 45) return '#F59E0B'; // Yellow
    if (fps >= 30) return '#EF4444'; // Red
    return '#DC2626'; // Dark red
  };

  const getColorForFrameTime = (frameTime: number): string => {
    if (frameTime <= 16.67) return '#10B981'; // Green (60fps)
    if (frameTime <= 22.22) return '#F59E0B'; // Yellow (45fps)
    if (frameTime <= 33.33) return '#EF4444'; // Red (30fps)
    return '#DC2626'; // Dark red
  };

  return (
    <View
      style={[
        {
          position: 'absolute',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          borderRadius: 8,
          padding: compact ? 8 : 12,
          minWidth: compact ? 80 : 200,
          zIndex: 1000,
        },
        positionStyles[position],
      ]}
    >
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        className="mb-1"
      >
        <Text className="text-white font-bold text-sm">
          Performance {expanded ? '▼' : '▶'}
        </Text>
      </TouchableOpacity>

      {/* Compact view */}
      {compact || !expanded ? (
        <View>
          <Text
            className="text-sm font-mono"
            style={{ color: getColorForFPS(fpsMetrics.fps) }}
          >
            {Math.round(fpsMetrics.fps)} FPS
          </Text>
          {!compact && (
            <Text
              className="text-xs font-mono"
              style={{ color: getColorForFrameTime(fpsMetrics.avgFrameTime) }}
            >
              {fpsMetrics.avgFrameTime.toFixed(1)}ms
            </Text>
          )}
        </View>
      ) : (
        /* Expanded view */
        <View className="space-y-2">
          {/* FPS Section */}
          <View>
            <Text className="text-white text-xs font-semibold mb-1">Frame Rate</Text>
            <Text
              className="text-sm font-mono"
              style={{ color: getColorForFPS(fpsMetrics.fps) }}
            >
              {Math.round(fpsMetrics.fps)} FPS ({fpsMetrics.quality})
            </Text>
            <Text
              className="text-xs font-mono text-gray-300"
              style={{ color: getColorForFrameTime(fpsMetrics.avgFrameTime) }}
            >
              Avg: {fpsMetrics.avgFrameTime.toFixed(1)}ms
            </Text>
            <Text className="text-xs font-mono text-gray-400">
              Drops: {fpsMetrics.frameDrops} ({Math.round((fpsMetrics.frameDrops / Math.max(fpsMetrics.totalFrames, 1)) * 100)}%)
            </Text>
          </View>

          {/* Performance Quality */}
          <View>
            <Text className="text-white text-xs font-semibold mb-1">Quality</Text>
            <Text 
              className="text-xs font-mono"
              style={{ 
                color: performanceMonitor.getCurrentQuality() === 'high' ? '#10B981' : 
                      performanceMonitor.getCurrentQuality() === 'medium' ? '#F59E0B' : '#EF4444'
              }}
            >
              {performanceMonitor.getCurrentQuality().toUpperCase()}
            </Text>
          </View>

          {/* JS Thread */}
          <View>
            <Text className="text-white text-xs font-semibold mb-1">JS Thread</Text>
            <Text
              className="text-xs font-mono"
              style={{ color: fpsMetrics.jsThreadBlocked ? '#EF4444' : '#10B981' }}
            >
              {fpsMetrics.jsThreadBlocked ? 'BLOCKED' : 'RESPONSIVE'}
            </Text>
            <Text className="text-xs font-mono text-gray-400">
              Delay: {fpsMetrics.avgInteractionDelay.toFixed(1)}ms
            </Text>
          </View>

          {/* Memory */}
          <View>
            <Text className="text-white text-xs font-semibold mb-1">Memory</Text>
            <Text
              className="text-xs font-mono"
              style={{ color: fpsMetrics.memoryWarning ? '#EF4444' : '#10B981' }}
            >
              {fpsMetrics.memoryWarning ? 'PRESSURE' : 'NORMAL'}
            </Text>
          </View>

          {/* Battery Optimization */}
          <View>
            <Text className="text-white text-xs font-semibold mb-1">Battery</Text>
            <Text className="text-xs font-mono text-gray-300">
              Level: {Math.round(batteryMetrics.batteryLevel * 100)}%
            </Text>
            <Text
              className="text-xs font-mono"
              style={{ 
                color: batteryState.currentOptimizationLevel === 'high' ? '#EF4444' : 
                      batteryState.currentOptimizationLevel === 'medium' ? '#F59E0B' : 
                      batteryState.currentOptimizationLevel === 'low' ? '#3B82F6' : '#10B981'
              }}
            >
              Opt: {batteryState.currentOptimizationLevel.toUpperCase()}
            </Text>
            <Text className="text-xs font-mono text-gray-400">
              Target FPS: {batteryState.targetFrameRate}
            </Text>
            <Text className="text-xs font-mono text-gray-400">
              Effects: {batteryState.visualEffectsEnabled ? 'ON' : 'OFF'}
            </Text>
          </View>

          {/* Object Pools */}
          <View>
            <Text className="text-white text-xs font-semibold mb-1">Object Pools</Text>
            {Object.entries(poolStats).map(([poolName, stats]: [string, any]) => (
              <Text key={poolName} className="text-xs font-mono text-gray-300">
                {poolName}: {stats.poolSize}/{stats.maxSize}
                {stats.utilizationRate && (
                  <Text className="text-gray-400">
                    {' '}({Math.round(stats.utilizationRate * 100)}%)
                  </Text>
                )}
              </Text>
            ))}
          </View>

          {/* Runtime */}
          <View>
            <Text className="text-white text-xs font-semibold mb-1">Runtime</Text>
            <Text className="text-xs font-mono text-gray-300">
              {Math.round(fpsMetrics.uptime / 1000)}s
            </Text>
            <Text className="text-xs font-mono text-gray-400">
              {fpsMetrics.totalFrames} frames
            </Text>
          </View>

          {/* Controls */}
          <View className="pt-2 border-t border-gray-600">
            <TouchableOpacity
              onPress={onToggle}
              className="bg-gray-700 px-3 py-1 rounded"
            >
              <Text className="text-white text-xs font-semibold text-center">
                Toggle
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

/**
 * Hook to manage performance overlay visibility
 */
export function usePerformanceOverlay() {
  const [visible, setVisible] = useState(__DEV__); // Only visible in development by default
  const [position, setPosition] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>('top-right');
  const [compact, setCompact] = useState(false);

  const toggle = () => setVisible(!visible);
  const show = () => setVisible(true);
  const hide = () => setVisible(false);

  return {
    visible,
    position,
    compact,
    toggle,
    show,
    hide,
    setPosition,
    setCompact,
  };
}