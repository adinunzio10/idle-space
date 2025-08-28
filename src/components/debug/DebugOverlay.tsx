/**
 * DEBUG OVERLAY
 * 
 * Visual debugging overlay for development and testing.
 * Provides real-time visualization of gesture states, selected beacon info, and performance metrics.
 * 
 * Features:
 * - Real-time gesture state visualization
 * - Selected beacon information display
 * - Conflict resolution monitoring
 * - Performance metrics display
 * - Touch point visualization
 * - Gesture velocity tracking
 * - State history timeline
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
  useDerivedValue,
} from 'react-native-reanimated';

import {
  GestureStateMachine,
  GestureStateType,
  DebugOverlayInfo,
  getDebugOverlayInfo,
  StateTransitionResult,
} from '../../utils/gestures/gestureStateMachine';
import { gestureConfig } from '../../constants/gestures';
import { Beacon } from '../../types/beacon';

interface DebugOverlayProps {
  stateMachine: GestureStateMachine;
  selectedBeacon?: Beacon | null;
  enabled?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  compact?: boolean;
}

interface TouchPoint {
  id: number;
  x: number;
  y: number;
  timestamp: number;
  phase: 'began' | 'moved' | 'ended';
}

// Simplified state color mapping for visual feedback
const STATE_COLORS: Record<GestureStateType, string> = {
  [GestureStateType.IDLE]: '#6B7280',
  [GestureStateType.TAPPING]: '#F59E0B',
  [GestureStateType.PANNING]: '#3B82F6',
  [GestureStateType.PINCHING]: '#EC4899',
  [GestureStateType.MOMENTUM]: '#059669',
};

export const DebugOverlay: React.FC<DebugOverlayProps> = ({
  stateMachine,
  selectedBeacon = null,
  enabled = __DEV__,
  position = 'top-left',
  compact = false,
}) => {
  const [debugInfo, setDebugInfo] = useState<DebugOverlayInfo | null>(null);
  
  const [recentTransitions, setRecentTransitions] = useState<StateTransitionResult[]>([]);
  const [touchPoints, setTouchPoints] = useState<TouchPoint[]>([]);
  const [conflicts, setConflicts] = useState<string[]>([]);

  // Animated values for visual feedback
  const stateIndicatorScale = useSharedValue(1);
  const conflictIndicatorOpacity = useSharedValue(0);
  
  // Convert React state to shared value for worklet access
  const currentStateShared = useDerivedValue(() => debugInfo?.currentState ?? GestureStateType.IDLE);

  // Update debug info periodically
  useEffect(() => {
    if (!enabled) return;

    const updateInterval = setInterval(() => {
      const info = getDebugOverlayInfo(stateMachine);
      setDebugInfo(info);
    }, 16); // 60fps updates

    return () => clearInterval(updateInterval);
  }, [stateMachine, enabled]);

  // Set up state machine callbacks
  useEffect(() => {
    if (!enabled) return;

    stateMachine.setDebugCallbacks({
      onStateChange: (transition) => {
        setRecentTransitions(prev => [...prev.slice(-4), transition]);
        
        // Animate state indicator
        stateIndicatorScale.value = withTiming(1.2, { duration: 100 }, () => {
          stateIndicatorScale.value = withTiming(1, { duration: 200 });
        });
      },
      
      onConflictResolution: (context, resolution) => {
        const conflictMsg = `${context.incomingGesture} -> ${resolution}`;
        setConflicts(prev => [...prev.slice(-2), conflictMsg]);
        
        // Show conflict indicator
        conflictIndicatorOpacity.value = withTiming(1, { duration: 100 }, () => {
          conflictIndicatorOpacity.value = withTiming(0, { duration: 1000 });
        });
      },
      
      onPerformanceUpdate: (metrics) => {
        // Performance updates handled in debugInfo
      },
    });
  }, [stateMachine, enabled, stateIndicatorScale, conflictIndicatorOpacity]);

  // Animated styles
  const stateIndicatorStyle = useAnimatedStyle(() => {
    const color = STATE_COLORS[currentStateShared.value];
    
    return {
      transform: [{ scale: stateIndicatorScale.value }],
      backgroundColor: color,
    };
  });

  const conflictIndicatorStyle = useAnimatedStyle(() => {
    return {
      opacity: conflictIndicatorOpacity.value,
    };
  });

  if (!enabled || !debugInfo) {
    return null;
  }

  // Position styles
  const positionStyles = {
    'top-left': { top: 50, left: 10 },
    'top-right': { top: 50, right: 10 },
    'bottom-left': { bottom: 50, left: 10 },
    'bottom-right': { bottom: 50, right: 10 },
  };

  const formatStateHistory = (history: string[]) => {
    return history.join(' → ');
  };

  const formatPerformanceMetrics = (metrics: typeof debugInfo.performanceMetrics) => {
    return {
      transition: `${metrics.stateTransitionTime.toFixed(1)}ms`,
      response: `${metrics.gestureResponseTime.toFixed(1)}ms`,
      conflict: `${metrics.conflictResolutionTime.toFixed(1)}ms`,
      active: metrics.totalActiveGestures.toString(),
    };
  };

  if (compact) {
    return (
      <View style={[styles.compactContainer, positionStyles[position]]}>
        <Animated.View style={[styles.stateIndicator, stateIndicatorStyle]}>
          <Text style={styles.stateText}>
            {debugInfo.currentState.replace('_', '').slice(0, 3)}
          </Text>
        </Animated.View>
        
        <Animated.View style={[styles.conflictIndicator, conflictIndicatorStyle]}>
          <Text style={styles.conflictText}>!</Text>
        </Animated.View>
        
        {selectedBeacon && (
          <View style={styles.beaconCompactInfo}>
            <Text style={styles.stateText}>
              B:{selectedBeacon.position.x.toFixed(0)},{selectedBeacon.position.y.toFixed(0)}
            </Text>
          </View>
        )}
      </View>
    );
  }

  const perfMetrics = formatPerformanceMetrics(debugInfo.performanceMetrics);

  return (
    <View style={[styles.container, positionStyles[position]]}>
      <View style={styles.header}>
        <Text style={styles.title}>Debug Info</Text>
        <Animated.View style={[styles.stateIndicator, stateIndicatorStyle]}>
          <Text style={styles.stateText}>{debugInfo.currentState}</Text>
        </Animated.View>
      </View>

      {/* Selected Beacon Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Selected Beacon</Text>
        {selectedBeacon ? (
          <>
            <Text style={styles.beaconText}>ID: {selectedBeacon.id}</Text>
            <Text style={styles.beaconText}>
              Position: ({selectedBeacon.position.x.toFixed(1)}, {selectedBeacon.position.y.toFixed(1)})
            </Text>
            <Text style={styles.beaconText}>Level: {selectedBeacon.level}</Text>
            <Text style={styles.beaconText}>Type: {selectedBeacon.type}</Text>
            {selectedBeacon.specialization && (
              <Text style={styles.beaconText}>Spec: {selectedBeacon.specialization}</Text>
            )}
          </>
        ) : (
          <Text style={styles.beaconText}>None</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gesture State</Text>
        <Text style={styles.historyText}>
          {formatStateHistory(debugInfo.stateHistory)}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Performance</Text>
        <View style={styles.metricsGrid}>
          <Text style={styles.metricText}>Trans: {perfMetrics.transition}</Text>
          <Text style={styles.metricText}>Resp: {perfMetrics.response}</Text>
          <Text style={styles.metricText}>Conf: {perfMetrics.conflict}</Text>
          <Text style={styles.metricText}>Active: {perfMetrics.active}</Text>
        </View>
      </View>

      {recentTransitions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Transitions</Text>
          {recentTransitions.slice(-2).map((transition, index) => (
            <Text key={index} style={styles.transitionText}>
              {transition.previousState} → {transition.newState}
              {transition.conflictResolution && ` [${transition.conflictResolution}]`}
            </Text>
          ))}
        </View>
      )}

      {conflicts.length > 0 && (
        <Animated.View style={[styles.section, conflictIndicatorStyle]}>
          <Text style={[styles.sectionTitle, { color: '#EF4444' }]}>Conflicts</Text>
          {conflicts.map((conflict, index) => (
            <Text key={index} style={styles.conflictText}>
              {conflict}
            </Text>
          ))}
        </Animated.View>
      )}

      {/* Touch point visualization */}
      {touchPoints.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Touch Points</Text>
          {touchPoints.map((point) => (
            <Text key={point.id} style={styles.touchText}>
              #{point.id}: ({point.x.toFixed(0)}, {point.y.toFixed(0)}) {point.phase}
            </Text>
          ))}
        </View>
      )}

      {/* Configuration info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Config</Text>
        <Text style={styles.configText}>
          Profile: {gestureConfig.getCurrentProfile().name}
        </Text>
        <Text style={styles.configText}>
          Accessibility: {Object.entries(gestureConfig.getAccessibilitySettings())
            .filter(([_, enabled]) => enabled)
            .map(([type]) => type)
            .join(', ') || 'None'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 8,
    padding: 12,
    minWidth: 220,
    maxWidth: 280,
    zIndex: 9999,
  },
  
  compactContainer: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 9999,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  title: {
    color: '#F9FAFB',
    fontSize: 14,
    fontWeight: 'bold',
  },

  stateIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },

  stateText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  conflictIndicator: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  beaconCompactInfo: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },

  section: {
    marginBottom: 8,
  },

  sectionTitle: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },

  beaconText: {
    color: '#A7F3D0',
    fontSize: 10,
    fontFamily: 'monospace',
    marginBottom: 1,
  },

  historyText: {
    color: '#F3F4F6',
    fontSize: 10,
    fontFamily: 'monospace',
  },

  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  metricText: {
    color: '#D1D5DB',
    fontSize: 10,
    fontFamily: 'monospace',
    marginRight: 8,
    marginBottom: 2,
  },

  transitionText: {
    color: '#A7F3D0',
    fontSize: 10,
    fontFamily: 'monospace',
    marginBottom: 1,
  },

  conflictText: {
    color: '#FECACA',
    fontSize: 10,
    fontFamily: 'monospace',
    marginBottom: 1,
  },

  touchText: {
    color: '#BFDBFE',
    fontSize: 10,
    fontFamily: 'monospace',
    marginBottom: 1,
  },

  configText: {
    color: '#E5E7EB',
    fontSize: 10,
    marginBottom: 1,
  },
});

export default DebugOverlay;