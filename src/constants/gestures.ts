/**
 * GESTURE CONFIGURATION SYSTEM
 *
 * Research-based gesture thresholds and configuration system for mobile-optimized
 * touch interactions. Based on industry standards and accessibility guidelines.
 *
 * Key Features:
 * - Research-based default thresholds
 * - Device-specific profiles (iOS/Android)
 * - Accessibility compliance (WCAG 2.1)
 * - Palm rejection settings
 * - Performance-tuned momentum physics
 */

import { Platform, Dimensions } from 'react-native';

// Base gesture thresholds (research-optimized)
export const GESTURE_THRESHOLDS = {
  // Pan gesture configuration
  PAN: {
    MIN_DISTANCE: 10, // 10px minimum pan distance (research-based)
    ACTIVATION_DELAY: 0, // No delay for responsive feel
    MAX_POINTERS: 1, // Single finger panning
    MIN_POINTERS: 1,
  },

  // Tap gesture configuration
  TAP: {
    MAX_DURATION: 200, // 200ms maximum tap duration (research-based)
    MAX_DISTANCE: 5, // 5px maximum movement during tap
    MIN_POINTERS: 1,
    MAX_POINTERS: 1,
  },

  // Pinch/zoom gesture configuration
  PINCH: {
    MIN_SCALE: 0.1, // Minimum zoom out
    MAX_SCALE: 10.0, // Maximum zoom in
    ACTIVATION_THRESHOLD: 0.05, // Minimum scale change to activate
  },

  // Double tap configuration
  DOUBLE_TAP: {
    MAX_DELAY: 300, // Maximum time between taps
    MAX_DISTANCE: 30, // Maximum distance between taps
    ZOOM_IN_SCALE: 3.0, // Target scale for zoom in
    ZOOM_OUT_SCALE: 1.0, // Target scale for zoom out
  },

  // Hit area configuration
  HIT_DETECTION: {
    BASE_RADIUS: 20, // Base hit radius in px
    MIN_RADIUS: 15, // Minimum hit radius
    MAX_RADIUS: 50, // Maximum hit radius
    SCALE_FACTOR: 0.8, // How hit radius scales with zoom
  },
} as const;

// Velocity smoothing and momentum physics
export const MOMENTUM_PHYSICS = {
  // Velocity smoothing (Exponential Moving Average)
  SMOOTHING: {
    ALPHA: 0.2, // EMA alpha factor (research-based)
    SPIKE_THRESHOLD: 100, // Velocity jump threshold for finger-lift detection
    MIN_THRESHOLD: 150, // Minimum velocity to start momentum (px/s)
  },

  // Momentum decay
  DECAY: {
    RATE: 0.95, // Deceleration factor (research-based)
    MIN_VELOCITY: 0.1, // Velocity below which momentum stops
    BOUNDARY_DAMPING: 0.1, // Velocity reduction at boundaries
  },

  // Elastic boundaries
  ELASTIC: {
    RESISTANCE: 0.3, // Elastic resistance factor
    SPRING_CONFIG: {
      damping: 20,
      stiffness: 300,
    },
  },
} as const;

// Palm rejection configuration
export const PALM_REJECTION = {
  // Touch area analysis
  TOUCH_AREA: {
    MIN_SIZE: 10, // Minimum valid touch area (px²)
    MAX_SIZE: 2000, // Maximum valid touch area (px²) - beyond this likely palm
    ASPECT_RATIO_MAX: 3.0, // Maximum width/height ratio for valid touches
  },

  // Multi-touch filtering
  MULTI_TOUCH: {
    MAX_SIMULTANEOUS: 2, // Maximum simultaneous touches (pan + pinch)
    MIN_SEPARATION: 50, // Minimum distance between valid touches
    CLUSTER_THRESHOLD: 30, // Distance threshold for palm cluster detection
  },

  // Temporal filtering
  TIMING: {
    RAPID_SUCCESSION_MS: 100, // Time window for rapid touch detection
    MAX_RAPID_TOUCHES: 3, // Maximum touches in rapid succession
  },
} as const;

// Device profile types
export interface DeviceProfile {
  name: string;
  platform: 'ios' | 'android' | 'universal';
  screenDensity: 'low' | 'medium' | 'high' | 'xxhigh';
  adjustments: {
    panSensitivity: number; // Multiplier for pan thresholds
    tapTolerance: number; // Multiplier for tap tolerances
    momentumDecay: number; // Adjustment to momentum decay rate
    palmRejectionStrength: number; // Palm rejection sensitivity
  };
}

// Platform-specific device profiles
export const DEVICE_PROFILES: Record<string, DeviceProfile> = {
  // iOS optimized profile
  ios_default: {
    name: 'iOS Default',
    platform: 'ios',
    screenDensity: 'high',
    adjustments: {
      panSensitivity: 1.0, // iOS has good native gesture handling
      tapTolerance: 1.0,
      momentumDecay: 1.0,
      palmRejectionStrength: 0.8, // iOS handles some palm rejection natively
    },
  },

  // Android optimized profile
  android_default: {
    name: 'Android Default',
    platform: 'android',
    screenDensity: 'high',
    adjustments: {
      panSensitivity: 1.1, // Slightly more sensitive on Android
      tapTolerance: 1.2, // More tolerant tap detection
      momentumDecay: 0.98, // Slightly longer momentum
      palmRejectionStrength: 1.2, // Stronger palm rejection needed
    },
  },

  // Large screen devices (tablets)
  tablet: {
    name: 'Tablet',
    platform: 'universal',
    screenDensity: 'medium',
    adjustments: {
      panSensitivity: 1.3, // Larger movements on big screens
      tapTolerance: 1.5, // More tolerant for larger fingers
      momentumDecay: 0.93, // Longer momentum for larger content
      palmRejectionStrength: 1.5, // Much stronger palm rejection
    },
  },

  // Small screen devices
  compact: {
    name: 'Compact',
    platform: 'universal',
    screenDensity: 'high',
    adjustments: {
      panSensitivity: 0.8, // Less sensitive for precise control
      tapTolerance: 0.8, // More precise tapping
      momentumDecay: 1.05, // Shorter momentum
      palmRejectionStrength: 0.6, // Less aggressive palm rejection
    },
  },
} as const;

// Accessibility configuration
export const ACCESSIBILITY = {
  // Motor impairment accommodations
  MOTOR: {
    INCREASED_HIT_RADIUS: 1.5, // Multiply hit radius by this factor
    LONGER_TAP_DURATION: 400, // Extended tap duration for motor difficulties
    REDUCED_PRECISION: 1.3, // Reduce precision requirements
  },

  // Visual impairment accommodations
  VISUAL: {
    ENHANCED_FEEDBACK: true, // Enable haptic/audio feedback
    HIGH_CONTRAST_MODE: true, // Visual indicators
    GESTURE_HINTS: true, // Show gesture affordances
  },

  // Cognitive accommodations
  COGNITIVE: {
    SIMPLIFIED_GESTURES: true, // Disable complex gesture combinations
    CONFIRMATION_DIALOGS: true, // Confirm destructive actions
    SLOWER_ANIMATIONS: 0.7, // Reduce animation speed
  },
} as const;

// Runtime configuration class
export class GestureConfiguration {
  private currentProfile: DeviceProfile;
  private accessibilitySettings: {
    motorImpairment: boolean;
    visualImpairment: boolean;
    cognitiveImpairment: boolean;
  };

  constructor() {
    // Auto-detect device profile
    this.currentProfile = this.detectDeviceProfile();
    this.accessibilitySettings = {
      motorImpairment: false,
      visualImpairment: false,
      cognitiveImpairment: false,
    };
  }

  private detectDeviceProfile(): DeviceProfile {
    const { width, height } = Dimensions.get('window');
    const screenSize = Math.min(width, height);

    // Determine if tablet based on screen size
    const isTablet = screenSize >= 768;
    const isCompact = screenSize < 400;

    if (isTablet) {
      return DEVICE_PROFILES.tablet;
    } else if (isCompact) {
      return DEVICE_PROFILES.compact;
    } else if (Platform.OS === 'ios') {
      return DEVICE_PROFILES.ios_default;
    } else {
      return DEVICE_PROFILES.android_default;
    }
  }

  // Get adjusted gesture thresholds based on profile and accessibility
  public getPanThresholds() {
    const base = GESTURE_THRESHOLDS.PAN;
    const profile = this.currentProfile.adjustments;

    return {
      minDistance:
        base.MIN_DISTANCE *
        profile.panSensitivity *
        (this.accessibilitySettings.motorImpairment
          ? ACCESSIBILITY.MOTOR.REDUCED_PRECISION
          : 1),
      activationDelay: base.ACTIVATION_DELAY,
      maxPointers: base.MAX_POINTERS,
      minPointers: base.MIN_POINTERS,
    };
  }

  public getTapThresholds() {
    const base = GESTURE_THRESHOLDS.TAP;
    const profile = this.currentProfile.adjustments;

    return {
      maxDuration: this.accessibilitySettings.motorImpairment
        ? ACCESSIBILITY.MOTOR.LONGER_TAP_DURATION
        : base.MAX_DURATION,
      maxDistance: base.MAX_DISTANCE * profile.tapTolerance,
      minPointers: base.MIN_POINTERS,
      maxPointers: base.MAX_POINTERS,
    };
  }

  public getHitRadius(baseRadius: number, scale: number): number {
    const scaleAdjustedRadius = Math.max(
      GESTURE_THRESHOLDS.HIT_DETECTION.MIN_RADIUS,
      Math.min(
        GESTURE_THRESHOLDS.HIT_DETECTION.MAX_RADIUS,
        baseRadius / (scale * GESTURE_THRESHOLDS.HIT_DETECTION.SCALE_FACTOR)
      )
    );

    const profileAdjusted =
      scaleAdjustedRadius * this.currentProfile.adjustments.tapTolerance;

    return (
      profileAdjusted *
      (this.accessibilitySettings.motorImpairment
        ? ACCESSIBILITY.MOTOR.INCREASED_HIT_RADIUS
        : 1)
    );
  }

  public getMomentumConfig() {
    const base = MOMENTUM_PHYSICS;
    const profile = this.currentProfile.adjustments;

    return {
      smoothing: {
        alpha: base.SMOOTHING.ALPHA,
        spikeThreshold: base.SMOOTHING.SPIKE_THRESHOLD,
        minThreshold: base.SMOOTHING.MIN_THRESHOLD,
      },
      decay: {
        rate: base.DECAY.RATE * profile.momentumDecay,
        minVelocity: base.DECAY.MIN_VELOCITY,
        boundaryDamping: base.DECAY.BOUNDARY_DAMPING,
      },
      elastic: base.ELASTIC,
    };
  }

  public getPalmRejectionConfig() {
    const base = PALM_REJECTION;
    const profile = this.currentProfile.adjustments;

    return {
      touchArea: {
        minSize: base.TOUCH_AREA.MIN_SIZE,
        maxSize: base.TOUCH_AREA.MAX_SIZE / profile.palmRejectionStrength,
        aspectRatioMax: base.TOUCH_AREA.ASPECT_RATIO_MAX,
      },
      multiTouch: base.MULTI_TOUCH,
      timing: base.TIMING,
    };
  }

  // Configuration methods
  public setDeviceProfile(profileKey: keyof typeof DEVICE_PROFILES) {
    if (DEVICE_PROFILES[profileKey]) {
      this.currentProfile = DEVICE_PROFILES[profileKey];
    }
  }

  public enableAccessibility(
    type: 'motor' | 'visual' | 'cognitive',
    enabled: boolean
  ) {
    switch (type) {
      case 'motor':
        this.accessibilitySettings.motorImpairment = enabled;
        break;
      case 'visual':
        this.accessibilitySettings.visualImpairment = enabled;
        break;
      case 'cognitive':
        this.accessibilitySettings.cognitiveImpairment = enabled;
        break;
    }
  }

  public getCurrentProfile(): DeviceProfile {
    return this.currentProfile;
  }

  public getAccessibilitySettings() {
    return { ...this.accessibilitySettings };
  }
}

// Global configuration instance
export const gestureConfig = new GestureConfiguration();

// Utility functions for gesture validation and palm rejection
export const GestureUtils = {
  // Check if touch is likely from palm based on area and timing
  isPalmTouch(touchData: {
    area?: number;
    width?: number;
    height?: number;
    timestamp: number;
    identifier: number;
  }): boolean {
    const config = gestureConfig.getPalmRejectionConfig();

    // Check touch area if available
    if (touchData.area && touchData.area > config.touchArea.maxSize) {
      return true;
    }

    // Check aspect ratio if width/height available
    if (touchData.width && touchData.height) {
      const aspectRatio =
        Math.max(touchData.width, touchData.height) /
        Math.min(touchData.width, touchData.height);
      if (aspectRatio > config.touchArea.aspectRatioMax) {
        return true;
      }
    }

    return false;
  },

  // Apply velocity smoothing with exponential moving average
  smoothVelocity(
    currentVelocity: { x: number; y: number },
    previousVelocity: { x: number; y: number }
  ): { x: number; y: number } {
    const config = gestureConfig.getMomentumConfig();
    const alpha = config.smoothing.alpha;

    // Detect velocity spikes (finger lift artifacts)
    const deltaX = Math.abs(currentVelocity.x - previousVelocity.x);
    const deltaY = Math.abs(currentVelocity.y - previousVelocity.y);

    if (
      deltaX > config.smoothing.spikeThreshold ||
      deltaY > config.smoothing.spikeThreshold
    ) {
      // Use previous velocity if current seems like finger-lift artifact
      return previousVelocity;
    }

    // Apply exponential moving average
    return {
      x: alpha * currentVelocity.x + (1 - alpha) * previousVelocity.x,
      y: alpha * currentVelocity.y + (1 - alpha) * previousVelocity.y,
    };
  },

  // Check if velocity is significant enough for momentum
  isVelocitySignificant(velocity: { x: number; y: number }): boolean {
    const config = gestureConfig.getMomentumConfig();
    const magnitude = Math.sqrt(
      velocity.x * velocity.x + velocity.y * velocity.y
    );
    return magnitude > config.smoothing.minThreshold;
  },

  // Apply momentum decay with device-specific adjustments
  applyMomentumDecay(velocity: { x: number; y: number }): {
    x: number;
    y: number;
  } {
    const config = gestureConfig.getMomentumConfig();
    return {
      x: velocity.x * config.decay.rate,
      y: velocity.y * config.decay.rate,
    };
  },
};
