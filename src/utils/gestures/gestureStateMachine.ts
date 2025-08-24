/**
 * GESTURE STATE MACHINE
 * 
 * Advanced gesture state management system for handling complex gesture interactions
 * with proper conflict resolution, priority handling, and debugging tools.
 * 
 * Features:
 * - Hierarchical gesture state management
 * - Conflict resolution with priority-based arbitration
 * - State transition validation and logging
 * - Visual debugging overlays
 * - Performance monitoring for gesture response times
 */

import { SharedValue } from 'react-native-reanimated';

// Gesture state enumeration
export enum GestureStateType {
  IDLE = 'IDLE',
  TAP_PENDING = 'TAP_PENDING',
  TAP_CONFIRMED = 'TAP_CONFIRMED',
  DOUBLE_TAP_PENDING = 'DOUBLE_TAP_PENDING',
  PAN_STARTING = 'PAN_STARTING',
  PAN_ACTIVE = 'PAN_ACTIVE',
  PINCH_STARTING = 'PINCH_STARTING',
  PINCH_ACTIVE = 'PINCH_ACTIVE',
  SIMULTANEOUS_PAN_PINCH = 'SIMULTANEOUS_PAN_PINCH',
  MOMENTUM_ACTIVE = 'MOMENTUM_ACTIVE',
  ELASTIC_BOUNCE = 'ELASTIC_BOUNCE',
  CANCELLED = 'CANCELLED',
}

// Gesture priorities for conflict resolution
export const GESTURE_PRIORITIES = {
  [GestureStateType.IDLE]: 0,
  [GestureStateType.TAP_PENDING]: 1,
  [GestureStateType.TAP_CONFIRMED]: 2,
  [GestureStateType.DOUBLE_TAP_PENDING]: 3,
  [GestureStateType.PAN_STARTING]: 4,
  [GestureStateType.PAN_ACTIVE]: 5,
  [GestureStateType.PINCH_STARTING]: 6,
  [GestureStateType.PINCH_ACTIVE]: 7,
  [GestureStateType.SIMULTANEOUS_PAN_PINCH]: 8, // Highest priority
  [GestureStateType.MOMENTUM_ACTIVE]: 2,
  [GestureStateType.ELASTIC_BOUNCE]: 3,
  [GestureStateType.CANCELLED]: 0,
} as const;

// Valid state transitions
const VALID_TRANSITIONS: Record<GestureStateType, GestureStateType[]> = {
  [GestureStateType.IDLE]: [
    GestureStateType.TAP_PENDING,
    GestureStateType.PAN_STARTING,
    GestureStateType.PINCH_STARTING,
  ],
  [GestureStateType.TAP_PENDING]: [
    GestureStateType.TAP_CONFIRMED,
    GestureStateType.DOUBLE_TAP_PENDING,
    GestureStateType.PAN_STARTING,
    GestureStateType.CANCELLED,
    GestureStateType.IDLE,
  ],
  [GestureStateType.TAP_CONFIRMED]: [
    GestureStateType.IDLE,
    GestureStateType.DOUBLE_TAP_PENDING,
  ],
  [GestureStateType.DOUBLE_TAP_PENDING]: [
    GestureStateType.IDLE,
    GestureStateType.CANCELLED,
  ],
  [GestureStateType.PAN_STARTING]: [
    GestureStateType.PAN_ACTIVE,
    GestureStateType.SIMULTANEOUS_PAN_PINCH,
    GestureStateType.CANCELLED,
    GestureStateType.IDLE,
  ],
  [GestureStateType.PAN_ACTIVE]: [
    GestureStateType.MOMENTUM_ACTIVE,
    GestureStateType.SIMULTANEOUS_PAN_PINCH,
    GestureStateType.ELASTIC_BOUNCE,
    GestureStateType.IDLE,
  ],
  [GestureStateType.PINCH_STARTING]: [
    GestureStateType.PINCH_ACTIVE,
    GestureStateType.SIMULTANEOUS_PAN_PINCH,
    GestureStateType.CANCELLED,
    GestureStateType.IDLE,
  ],
  [GestureStateType.PINCH_ACTIVE]: [
    GestureStateType.SIMULTANEOUS_PAN_PINCH,
    GestureStateType.ELASTIC_BOUNCE,
    GestureStateType.IDLE,
  ],
  [GestureStateType.SIMULTANEOUS_PAN_PINCH]: [
    GestureStateType.PAN_ACTIVE,
    GestureStateType.PINCH_ACTIVE,
    GestureStateType.MOMENTUM_ACTIVE,
    GestureStateType.ELASTIC_BOUNCE,
    GestureStateType.IDLE,
  ],
  [GestureStateType.MOMENTUM_ACTIVE]: [
    GestureStateType.PAN_STARTING,
    GestureStateType.PINCH_STARTING,
    GestureStateType.TAP_PENDING,
    GestureStateType.IDLE,
  ],
  [GestureStateType.ELASTIC_BOUNCE]: [
    GestureStateType.IDLE,
  ],
  [GestureStateType.CANCELLED]: [
    GestureStateType.IDLE,
  ],
};

// Gesture event data interfaces
export interface GestureEventData {
  type: 'tap' | 'pan' | 'pinch' | 'momentum' | 'elastic';
  timestamp: number;
  pointerCount: number;
  position?: { x: number; y: number };
  translation?: { x: number; y: number };
  velocity?: { x: number; y: number };
  scale?: number;
  focalPoint?: { x: number; y: number };
}

// State transition result
export interface StateTransitionResult {
  success: boolean;
  previousState: GestureStateType;
  newState: GestureStateType;
  conflictResolution?: string;
  debugInfo?: any;
}

// Performance metrics tracking
interface PerformanceMetrics {
  stateTransitionTime: number;
  gestureResponseTime: number;
  conflictResolutionTime: number;
  totalActiveGestures: number;
}

// Gesture conflict resolution context
interface ConflictContext {
  activeGestures: GestureStateType[];
  incomingGesture: GestureStateType;
  eventData: GestureEventData;
  timestamp: number;
}

/**
 * Advanced Gesture State Machine
 * 
 * Manages complex gesture state transitions with conflict resolution,
 * priority handling, and debugging capabilities.
 */
export class GestureStateMachine {
  private currentState: SharedValue<GestureStateType>;
  private stateHistory: { state: GestureStateType; timestamp: number; event?: GestureEventData }[] = [];
  private activeGestures: Set<GestureStateType> = new Set();
  private debugMode: boolean = __DEV__;
  private performanceMetrics: PerformanceMetrics = {
    stateTransitionTime: 0,
    gestureResponseTime: 0,
    conflictResolutionTime: 0,
    totalActiveGestures: 0,
  };

  // Debugging and monitoring callbacks
  private onStateChange?: (transition: StateTransitionResult) => void;
  private onConflictResolution?: (context: ConflictContext, resolution: string) => void;
  private onPerformanceUpdate?: (metrics: PerformanceMetrics) => void;

  constructor(sharedState: SharedValue<GestureStateType>) {
    this.currentState = sharedState;
    this.recordState(sharedState.value, Date.now());
  }

  /**
   * Request a state transition with conflict resolution
   */
  requestTransition(
    targetState: GestureStateType,
    eventData: GestureEventData,
    force: boolean = false
  ): StateTransitionResult {
    const startTime = Date.now();
    const previousState = this.currentState.value;

    // Validate transition
    if (!force && !this.isValidTransition(previousState, targetState)) {
      const result: StateTransitionResult = {
        success: false,
        previousState,
        newState: previousState,
        debugInfo: {
          reason: 'Invalid transition',
          validTransitions: VALID_TRANSITIONS[previousState],
        },
      };
      
      if (this.debugMode) {
        console.warn('[GestureStateMachine] Invalid transition:', result);
      }
      
      return result;
    }

    // Handle conflicts with active gestures
    const conflictResolution = this.resolveConflicts({
      activeGestures: Array.from(this.activeGestures),
      incomingGesture: targetState,
      eventData,
      timestamp: startTime,
    });

    // Apply conflict resolution
    let finalState = targetState;
    if (conflictResolution !== 'allow') {
      if (conflictResolution === 'block') {
        const result: StateTransitionResult = {
          success: false,
          previousState,
          newState: previousState,
          conflictResolution,
        };
        
        return result;
      } else if (conflictResolution.startsWith('override:')) {
        finalState = conflictResolution.split(':')[1] as GestureStateType;
      }
    }

    // Execute transition
    this.performTransition(previousState, finalState, eventData, startTime);

    const result: StateTransitionResult = {
      success: true,
      previousState,
      newState: finalState,
      conflictResolution: conflictResolution !== 'allow' ? conflictResolution : undefined,
      debugInfo: {
        transitionTime: Date.now() - startTime,
        eventData,
      },
    };

    // Update performance metrics
    this.performanceMetrics.stateTransitionTime = Date.now() - startTime;
    this.performanceMetrics.totalActiveGestures = this.activeGestures.size;

    // Notify callbacks
    this.onStateChange?.(result);
    this.onPerformanceUpdate?.(this.performanceMetrics);

    return result;
  }

  /**
   * Get current state
   */
  getCurrentState(): GestureStateType {
    return this.currentState.value;
  }

  /**
   * Get shared value for use in worklets
   */
  getSharedState(): SharedValue<GestureStateType> {
    return this.currentState;
  }

  /**
   * Check if state can interrupt current gesture
   */
  canInterrupt(incomingState: GestureStateType): boolean {
    const currentState = this.currentState.value;
    const currentPriority = GESTURE_PRIORITIES[currentState];
    const incomingPriority = GESTURE_PRIORITIES[incomingState];

    // Higher priority can interrupt lower priority
    return incomingPriority > currentPriority;
  }

  /**
   * Reset to idle state (for emergency reset)
   */
  reset(): void {
    this.performTransition(
      this.currentState.value,
      GestureStateType.IDLE,
      { type: 'momentum', timestamp: Date.now(), pointerCount: 0 },
      Date.now()
    );
    this.activeGestures.clear();
  }

  /**
   * Get state history for debugging
   */
  getStateHistory(): typeof this.stateHistory {
    return [...this.stateHistory];
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Set up debugging callbacks
   */
  setDebugCallbacks(callbacks: {
    onStateChange?: (transition: StateTransitionResult) => void;
    onConflictResolution?: (context: ConflictContext, resolution: string) => void;
    onPerformanceUpdate?: (metrics: PerformanceMetrics) => void;
  }): void {
    this.onStateChange = callbacks.onStateChange;
    this.onConflictResolution = callbacks.onConflictResolution;
    this.onPerformanceUpdate = callbacks.onPerformanceUpdate;
  }

  // Private methods

  private isValidTransition(from: GestureStateType, to: GestureStateType): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
  }

  private resolveConflicts(context: ConflictContext): string {
    const startTime = Date.now();
    const { activeGestures, incomingGesture, eventData } = context;

    // No conflicts if no active gestures
    if (activeGestures.length === 0) {
      return 'allow';
    }

    // Special cases for simultaneous gestures
    if (this.shouldAllowSimultaneous(activeGestures, incomingGesture, eventData)) {
      // Transition to simultaneous state if appropriate
      if (
        (activeGestures.includes(GestureStateType.PAN_ACTIVE) && incomingGesture === GestureStateType.PINCH_STARTING) ||
        (activeGestures.includes(GestureStateType.PINCH_ACTIVE) && incomingGesture === GestureStateType.PAN_STARTING)
      ) {
        const resolution = 'override:' + GestureStateType.SIMULTANEOUS_PAN_PINCH;
        
        this.onConflictResolution?.(context, resolution);
        this.performanceMetrics.conflictResolutionTime = Date.now() - startTime;
        
        return resolution;
      }
    }

    // Priority-based resolution
    const currentPriority = Math.max(...activeGestures.map(g => GESTURE_PRIORITIES[g]));
    const incomingPriority = GESTURE_PRIORITIES[incomingGesture];

    if (incomingPriority > currentPriority) {
      const resolution = 'allow';
      this.onConflictResolution?.(context, resolution);
      return resolution;
    } else if (incomingPriority < currentPriority) {
      const resolution = 'block';
      this.onConflictResolution?.(context, resolution);
      return resolution;
    }

    // Equal priority - use timing and context
    const resolution = this.resolveEqualPriorityConflict(context);
    this.onConflictResolution?.(context, resolution);
    this.performanceMetrics.conflictResolutionTime = Date.now() - startTime;
    
    return resolution;
  }

  private shouldAllowSimultaneous(
    activeGestures: GestureStateType[],
    incomingGesture: GestureStateType,
    eventData: GestureEventData
  ): boolean {
    // Allow pan + pinch combinations
    const hasPan = activeGestures.some(g => g === GestureStateType.PAN_ACTIVE || g === GestureStateType.PAN_STARTING);
    const hasPinch = activeGestures.some(g => g === GestureStateType.PINCH_ACTIVE || g === GestureStateType.PINCH_STARTING);
    
    const incomingIsPan = incomingGesture === GestureStateType.PAN_STARTING || incomingGesture === GestureStateType.PAN_ACTIVE;
    const incomingIsPinch = incomingGesture === GestureStateType.PINCH_STARTING || incomingGesture === GestureStateType.PINCH_ACTIVE;

    // Allow pan+pinch if we have appropriate pointer count
    if ((hasPan && incomingIsPinch) || (hasPinch && incomingIsPan)) {
      return eventData.pointerCount >= 2;
    }

    return false;
  }

  private resolveEqualPriorityConflict(context: ConflictContext): string {
    const { activeGestures, incomingGesture, eventData } = context;

    // For equal priority, prefer the gesture that was started more recently
    // This helps with rapid gesture changes
    const recentStates = this.stateHistory.slice(-3);
    const recentGesture = recentStates[recentStates.length - 1]?.state;

    // If the incoming gesture is similar to recent gesture, allow it
    if (this.areGesturesSimilar(recentGesture, incomingGesture)) {
      return 'allow';
    }

    // For tap conflicts, use timing
    if (incomingGesture === GestureStateType.TAP_PENDING) {
      const lastTap = this.stateHistory
        .slice()
        .reverse()
        .find(h => h.state === GestureStateType.TAP_CONFIRMED);
      
      if (lastTap && (eventData.timestamp - lastTap.timestamp) < 300) {
        return 'override:' + GestureStateType.DOUBLE_TAP_PENDING;
      }
    }

    // Default to blocking equal priority conflicts
    return 'block';
  }

  private areGesturesSimilar(gesture1: GestureStateType | undefined, gesture2: GestureStateType): boolean {
    if (!gesture1) return false;

    // Group similar gestures
    const panGestures = [GestureStateType.PAN_STARTING, GestureStateType.PAN_ACTIVE];
    const pinchGestures = [GestureStateType.PINCH_STARTING, GestureStateType.PINCH_ACTIVE];
    const tapGestures = [GestureStateType.TAP_PENDING, GestureStateType.TAP_CONFIRMED];

    return (
      (panGestures.includes(gesture1) && panGestures.includes(gesture2)) ||
      (pinchGestures.includes(gesture1) && pinchGestures.includes(gesture2)) ||
      (tapGestures.includes(gesture1) && tapGestures.includes(gesture2))
    );
  }

  private performTransition(
    from: GestureStateType,
    to: GestureStateType,
    eventData: GestureEventData,
    timestamp: number
  ): void {
    // Update active gestures tracking
    this.updateActiveGestures(from, to);

    // Update current state
    this.currentState.value = to;

    // Record in history
    this.recordState(to, timestamp, eventData);

    if (this.debugMode) {
      console.log(`[GestureStateMachine] Transition: ${from} -> ${to}`, {
        eventData,
        activeGestures: Array.from(this.activeGestures),
      });
    }
  }

  private updateActiveGestures(from: GestureStateType, to: GestureStateType): void {
    // Remove completed or cancelled gestures
    if (to === GestureStateType.IDLE || to === GestureStateType.CANCELLED) {
      this.activeGestures.clear();
    } else {
      // Add new active gesture
      if (this.isActiveGesture(to)) {
        this.activeGestures.add(to);
      }
      
      // Remove previous gesture if it's not active anymore
      if (!this.isActiveGesture(from)) {
        this.activeGestures.delete(from);
      }
    }
  }

  private isActiveGesture(state: GestureStateType): boolean {
    return ![
      GestureStateType.IDLE,
      GestureStateType.TAP_CONFIRMED,
      GestureStateType.CANCELLED,
    ].includes(state);
  }

  private recordState(state: GestureStateType, timestamp: number, eventData?: GestureEventData): void {
    this.stateHistory.push({ state, timestamp, event: eventData });
    
    // Keep only recent history (last 50 states)
    if (this.stateHistory.length > 50) {
      this.stateHistory = this.stateHistory.slice(-50);
    }
  }
}

// Worklet-safe utility functions for use in gesture handlers
/**
 * Create a worklet-safe state checker
 */
export function createStateChecker(stateMachine: GestureStateMachine) {
  'worklet';
  
  return {
    isState: (state: GestureStateType) => {
      'worklet';
      return stateMachine.getSharedState().value === state;
    },
    
    isAnyState: (states: GestureStateType[]) => {
      'worklet';
      return states.includes(stateMachine.getSharedState().value);
    },
    
    canTransition: (toState: GestureStateType) => {
      'worklet';
      const currentState = stateMachine.getSharedState().value;
      return VALID_TRANSITIONS[currentState]?.includes(toState) ?? false;
    },
  };
}

/**
 * Debug utility for visualizing gesture state
 */
export interface DebugOverlayInfo {
  currentState: GestureStateType;
  activeGestures: GestureStateType[];
  stateHistory: string[];
  performanceMetrics: PerformanceMetrics;
  conflicts?: string;
}

/**
 * Get debug information for overlay rendering
 */
export function getDebugOverlayInfo(stateMachine: GestureStateMachine): DebugOverlayInfo {
  const history = stateMachine.getStateHistory();
  
  return {
    currentState: stateMachine.getCurrentState(),
    activeGestures: [], // Would need to expose this from state machine
    stateHistory: history.slice(-5).map(h => `${h.state}@${h.timestamp % 10000}`),
    performanceMetrics: stateMachine.getPerformanceMetrics(),
  };
}