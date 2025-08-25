/**
 * GESTURE WORKLETS
 * 
 * High-performance worklet functions for gesture handling using React Native Reanimated.
 * All functions marked with 'worklet' directive run on UI thread for 60fps performance.
 * 
 * Features:
 * - UI-thread gesture processing
 * - Conflict resolution worklets
 * - Performance monitoring worklets
 * - State machine integration worklets
 * - Palm rejection worklets
 */

import { SharedValue } from 'react-native-reanimated';
import {
  GestureStateMachine,
  GestureStateType,
  GestureEventData,
} from './gestureStateMachine';
import { GestureUtils } from '../../constants/gestures';

// Performance tracking shared values
export interface GesturePerformanceSharedValues {
  lastFrameTime: SharedValue<number>;
  frameCount: SharedValue<number>;
  avgFrameTime: SharedValue<number>;
  droppedFrames: SharedValue<number>;
  gestureResponseTime: SharedValue<number>;
}

// Note: Performance shared values are now created directly in components using useSharedValue()
// This function has been removed to avoid creating fake SharedValues

/**
 * High-performance gesture state validation worklet
 */
export function validateGestureTransitionWorklet(
  currentState: SharedValue<GestureStateType>,
  targetState: GestureStateType,
  eventData: GestureEventData
): boolean {
  'worklet';
  
  const current = currentState.value;
  
  // Simplified fast path for common transitions
  if (current === GestureStateType.IDLE) {
    return true; // IDLE can transition to any state
  }
  
  if (current === GestureStateType.TAPPING) {
    return (
      targetState === GestureStateType.IDLE ||
      targetState === GestureStateType.PANNING
    );
  }
  
  if (current === GestureStateType.PANNING) {
    return (
      targetState === GestureStateType.IDLE ||
      targetState === GestureStateType.MOMENTUM ||
      targetState === GestureStateType.PINCHING
    );
  }
  
  if (current === GestureStateType.PINCHING) {
    return (
      targetState === GestureStateType.IDLE ||
      targetState === GestureStateType.PANNING
    );
  }
  
  if (current === GestureStateType.MOMENTUM) {
    return true; // Momentum can be interrupted by any gesture
  }
  
  // For other states, allow reasonable transitions
  return true; // Simplified for worklet performance
}

/**
 * High-performance conflict resolution worklet
 */
export function resolveGestureConflictWorklet(
  currentState: SharedValue<GestureStateType>,
  incomingGesture: GestureStateType,
  pointerCount: number,
  eventTimestamp: number
): GestureStateType {
  'worklet';
  
  const current = currentState.value;
  
  // Simplified simultaneous gesture handling
  if (pointerCount >= 2) {
    if (
      (current === GestureStateType.PANNING && incomingGesture === GestureStateType.PINCHING) ||
      (current === GestureStateType.PINCHING && incomingGesture === GestureStateType.PANNING)
    ) {
      // Allow both gestures simultaneously - let React Native Gesture Handler manage it
      return incomingGesture;
    }
  }
  
  // Simplified priority-based resolution
  const priorities = {
    [GestureStateType.IDLE]: 0,
    [GestureStateType.TAPPING]: 3,
    [GestureStateType.PANNING]: 2,
    [GestureStateType.PINCHING]: 4,
    [GestureStateType.MOMENTUM]: 1,
  };
  
  const currentPriority = priorities[current] || 0;
  const incomingPriority = priorities[incomingGesture] || 0;
  
  // Higher priority wins
  if (incomingPriority > currentPriority) {
    // Don't update shared state here - let JS state machine handle it
    return incomingGesture;
  }
  
  // Keep current state if it has higher or equal priority
  return current;
}

/**
 * Palm rejection worklet
 */
export function palmRejectionWorklet(
  touchArea: number,
  touchWidth: number,
  touchHeight: number,
  pointerCount: number,
  rapidTouchCount: number
): boolean {
  'worklet';
  
  // Quick palm rejection checks (optimized for UI thread)
  
  // Large touch area likely palm
  if (touchArea > 2000) {
    return true;
  }
  
  // High aspect ratio likely palm
  if (touchWidth > 0 && touchHeight > 0) {
    const aspectRatio = Math.max(touchWidth, touchHeight) / Math.min(touchWidth, touchHeight);
    if (aspectRatio > 3.0) {
      return true;
    }
  }
  
  // Too many rapid touches likely palm
  if (rapidTouchCount > 3) {
    return true;
  }
  
  // Too many simultaneous touches
  if (pointerCount > 3) {
    return true;
  }
  
  return false;
}

/**
 * Velocity smoothing worklet with spike detection
 */
export function smoothVelocityWorklet(
  currentVelocity: { x: number; y: number },
  previousVelocity: { x: number; y: number },
  alpha: number = 0.2,
  spikeThreshold: number = 100
): { x: number; y: number } {
  'worklet';
  
  // Detect velocity spikes (finger lift artifacts)
  const deltaX = Math.abs(currentVelocity.x - previousVelocity.x);
  const deltaY = Math.abs(currentVelocity.y - previousVelocity.y);
  
  if (deltaX > spikeThreshold || deltaY > spikeThreshold) {
    // Use previous velocity if current seems like finger-lift artifact
    return previousVelocity;
  }
  
  // Apply exponential moving average
  return {
    x: alpha * currentVelocity.x + (1 - alpha) * previousVelocity.x,
    y: alpha * currentVelocity.y + (1 - alpha) * previousVelocity.y,
  };
}

/**
 * Performance monitoring worklet
 */
export function updatePerformanceMetricsWorklet(
  performanceSharedValues: GesturePerformanceSharedValues,
  currentTimestamp: number
): void {
  'worklet';
  
  const lastFrame = performanceSharedValues.lastFrameTime.value;
  
  if (lastFrame > 0) {
    const frameTime = currentTimestamp - lastFrame;
    performanceSharedValues.frameCount.value++;
    
    // Update moving average
    const alpha = 0.1;
    performanceSharedValues.avgFrameTime.value = 
      alpha * frameTime + (1 - alpha) * performanceSharedValues.avgFrameTime.value;
    
    // Count dropped frames (>20ms = dropped frame at 60fps)
    if (frameTime > 20) {
      performanceSharedValues.droppedFrames.value++;
    }
  }
  
  performanceSharedValues.lastFrameTime.value = currentTimestamp;
}

/**
 * Gesture response time tracking worklet
 */
export function trackGestureResponseTimeWorklet(
  performanceSharedValues: GesturePerformanceSharedValues,
  gestureStartTime: number,
  currentTime: number
): void {
  'worklet';
  
  const responseTime = currentTime - gestureStartTime;
  
  // Update response time with exponential moving average
  const alpha = 0.3;
  performanceSharedValues.gestureResponseTime.value = 
    alpha * responseTime + (1 - alpha) * performanceSharedValues.gestureResponseTime.value;
}

/**
 * Gesture boundary constraint worklet
 */
export function constrainGestureBoundsWorklet(
  translation: { x: number; y: number },
  scale: number,
  viewportWidth: number,
  viewportHeight: number,
  contentWidth: number,
  contentHeight: number
): { x: number; y: number } {
  'worklet';
  
  const scaledContentWidth = contentWidth * scale;
  const scaledContentHeight = contentHeight * scale;
  
  // Calculate bounds
  const maxTranslateX = scaledContentWidth > viewportWidth 
    ? 0 
    : (viewportWidth - scaledContentWidth) / 2;
  const minTranslateX = scaledContentWidth > viewportWidth 
    ? viewportWidth - scaledContentWidth 
    : (viewportWidth - scaledContentWidth) / 2;
    
  const maxTranslateY = scaledContentHeight > viewportHeight 
    ? 0 
    : (viewportHeight - scaledContentHeight) / 2;
  const minTranslateY = scaledContentHeight > viewportHeight 
    ? viewportHeight - scaledContentHeight 
    : (viewportHeight - scaledContentHeight) / 2;
  
  return {
    x: Math.max(minTranslateX, Math.min(maxTranslateX, translation.x)),
    y: Math.max(minTranslateY, Math.min(maxTranslateY, translation.y)),
  };
}

/**
 * Elastic boundary resistance worklet
 */
export function applyElasticResistanceWorklet(
  translation: { x: number; y: number },
  constrainedTranslation: { x: number; y: number },
  resistance: number = 0.3
): { x: number; y: number } {
  'worklet';
  
  const deltaX = translation.x - constrainedTranslation.x;
  const deltaY = translation.y - constrainedTranslation.y;
  
  // Apply resistance to out-of-bounds movement
  return {
    x: constrainedTranslation.x + deltaX * resistance,
    y: constrainedTranslation.y + deltaY * resistance,
  };
}

/**
 * Momentum physics worklet
 */
export function applyMomentumWorklet(
  velocity: { x: number; y: number },
  decayRate: number = 0.95,
  minVelocity: number = 0.1
): { velocity: { x: number; y: number }; shouldContinue: boolean } {
  'worklet';
  
  const newVelocity = {
    x: velocity.x * decayRate,
    y: velocity.y * decayRate,
  };
  
  const magnitude = Math.sqrt(newVelocity.x * newVelocity.x + newVelocity.y * newVelocity.y);
  const shouldContinue = magnitude > minVelocity;
  
  return {
    velocity: newVelocity,
    shouldContinue,
  };
}

/**
 * Hit testing worklet for gesture targets
 */
export function hitTestWorklet(
  point: { x: number; y: number },
  targetPosition: { x: number; y: number },
  hitRadius: number
): boolean {
  'worklet';
  
  const deltaX = point.x - targetPosition.x;
  const deltaY = point.y - targetPosition.y;
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  
  return distance <= hitRadius;
}

/**
 * Scale clamping worklet
 */
export function clampScaleWorklet(
  scale: number,
  minScale: number = 0.1,
  maxScale: number = 10.0
): number {
  'worklet';
  
  return Math.max(minScale, Math.min(maxScale, scale));
}

/**
 * Focal point zoom calculation worklet
 */
export function calculateFocalPointZoomWorklet(
  focalPoint: { x: number; y: number },
  currentTranslation: { x: number; y: number },
  currentScale: number,
  targetScale: number
): { x: number; y: number } {
  'worklet';
  
  const scaleDelta = targetScale / currentScale;
  
  return {
    x: focalPoint.x - (focalPoint.x - currentTranslation.x) * scaleDelta,
    y: focalPoint.y - (focalPoint.y - currentTranslation.y) * scaleDelta,
  };
}

/**
 * Multi-touch center point calculation worklet
 */
export function calculateCenterPointWorklet(
  touches: Array<{ x: number; y: number }>
): { x: number; y: number } {
  'worklet';
  
  if (touches.length === 0) {
    return { x: 0, y: 0 };
  }
  
  let sumX = 0;
  let sumY = 0;
  
  for (let i = 0; i < touches.length; i++) {
    sumX += touches[i].x;
    sumY += touches[i].y;
  }
  
  return {
    x: sumX / touches.length,
    y: sumY / touches.length,
  };
}

/**
 * Distance between two points worklet
 */
export function calculateDistanceWorklet(
  point1: { x: number; y: number },
  point2: { x: number; y: number }
): number {
  'worklet';
  
  const deltaX = point2.x - point1.x;
  const deltaY = point2.y - point1.y;
  
  return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
}

/**
 * Gesture debugging worklet
 */
export function debugGestureWorklet(
  gestureType: string,
  data: any,
  timestamp: number,
  debugSharedValue: SharedValue<string>
): void {
  'worklet';
  
  // Simple debug logging that can be read from JavaScript thread
  debugSharedValue.value = `${gestureType}@${timestamp % 10000}: ${JSON.stringify(data)}`;
}