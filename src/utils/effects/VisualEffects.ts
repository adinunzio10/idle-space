import {
  interpolate,
  Easing,
  withTiming,
  withRepeat,
  withSequence,
  WithTimingConfig,
  SharedValue,
} from 'react-native-reanimated';

/**
 * Visual effect configurations
 */
export interface EffectConfig {
  duration: number;
  easing: any;
  repeat?: boolean;
  delay?: number;
}

/**
 * Predefined easing functions for various effects
 */
export const VISUAL_EASINGS = {
  // Smooth, natural motion
  ease: Easing.out(Easing.exp),

  // Bouncy, playful effects
  bounce: Easing.bounce,

  // Sharp, technical feel
  linear: Easing.linear,

  // Organic, breathing effect
  sine: Easing.sin,

  // Quick attention grab
  elastic: Easing.elastic(2),

  // Smooth acceleration
  cubic: Easing.bezier(0.4, 0, 0.2, 1),

  // Material design standard
  standard: Easing.bezier(0.4, 0, 0.2, 1),

  // Emphasized motion
  emphasized: Easing.bezier(0.2, 0, 0, 1),
};

/**
 * Visual effect presets
 */
export const EFFECT_PRESETS: Record<string, EffectConfig> = {
  // Beacon effects
  beaconPulse: {
    duration: 2000,
    easing: VISUAL_EASINGS.sine,
    repeat: true,
  },

  beaconGlow: {
    duration: 3000,
    easing: VISUAL_EASINGS.ease,
    repeat: true,
  },

  beaconLevelUp: {
    duration: 1000,
    easing: VISUAL_EASINGS.bounce,
    repeat: false,
  },

  // Connection effects
  connectionSpark: {
    duration: 800,
    easing: VISUAL_EASINGS.cubic,
    repeat: false,
  },

  connectionFlow: {
    duration: 4000,
    easing: VISUAL_EASINGS.linear,
    repeat: true,
  },

  connectionEstablished: {
    duration: 1500,
    easing: VISUAL_EASINGS.emphasized,
    repeat: false,
  },

  // Probe effects
  probeTrail: {
    duration: 500,
    easing: VISUAL_EASINGS.ease,
    repeat: false,
  },

  probeLaunch: {
    duration: 300,
    easing: VISUAL_EASINGS.elastic,
    repeat: false,
  },

  probeArrival: {
    duration: 800,
    easing: VISUAL_EASINGS.bounce,
    repeat: false,
  },

  // UI effects
  fadeIn: {
    duration: 500,
    easing: VISUAL_EASINGS.standard,
    repeat: false,
  },

  slideIn: {
    duration: 300,
    easing: VISUAL_EASINGS.emphasized,
    repeat: false,
  },

  scaleUp: {
    duration: 200,
    easing: VISUAL_EASINGS.cubic,
    repeat: false,
  },
};

/**
 * Create a pulsing animation for beacons
 */
export function createPulseAnimation(
  animatedValue: SharedValue<number>,
  config: EffectConfig = EFFECT_PRESETS.beaconPulse
): void {
  const timingConfig: WithTimingConfig = {
    duration: config.duration,
    easing: config.easing,
  };

  if (config.repeat) {
    animatedValue.value = withRepeat(
      withSequence(withTiming(1, timingConfig), withTiming(0, timingConfig)),
      -1,
      true
    );
  } else {
    animatedValue.value = withTiming(1, timingConfig);
  }
}

/**
 * Create a glow effect animation
 */
export function createGlowAnimation(
  animatedValue: SharedValue<number>,
  intensity: number = 1,
  config: EffectConfig = EFFECT_PRESETS.beaconGlow
): void {
  const timingConfig: WithTimingConfig = {
    duration: config.duration,
    easing: config.easing,
  };

  if (config.repeat) {
    animatedValue.value = withRepeat(
      withSequence(
        withTiming(intensity * 0.3, timingConfig),
        withTiming(intensity, timingConfig),
        withTiming(intensity * 0.6, timingConfig)
      ),
      -1,
      true
    );
  } else {
    animatedValue.value = withTiming(intensity, timingConfig);
  }
}

/**
 * Create a level-up celebration effect
 */
export function createLevelUpAnimation(
  scaleValue: SharedValue<number>,
  glowValue: SharedValue<number>,
  config: EffectConfig = EFFECT_PRESETS.beaconLevelUp
): void {
  const timingConfig: WithTimingConfig = {
    duration: config.duration,
    easing: config.easing,
  };

  // Scale animation
  scaleValue.value = withSequence(
    withTiming(1.5, timingConfig),
    withTiming(1.0, timingConfig)
  );

  // Glow burst animation
  glowValue.value = withSequence(
    withTiming(2.0, { duration: config.duration * 0.3, easing: config.easing }),
    withTiming(1.0, { duration: config.duration * 0.7, easing: config.easing })
  );
}

/**
 * Create a connection spark effect
 */
export function createConnectionSparkAnimation(
  progressValue: SharedValue<number>,
  opacityValue: SharedValue<number>,
  config: EffectConfig = EFFECT_PRESETS.connectionSpark
): void {
  const timingConfig: WithTimingConfig = {
    duration: config.duration,
    easing: config.easing,
  };

  // Progress along the connection line
  progressValue.value = withTiming(1, timingConfig);

  // Opacity fade out
  opacityValue.value = withSequence(
    withTiming(1, { duration: config.duration * 0.2, easing: config.easing }),
    withTiming(0, { duration: config.duration * 0.8, easing: config.easing })
  );
}

/**
 * Create flowing data effect along connections
 */
export function createConnectionFlowAnimation(
  flowValue: SharedValue<number>,
  config: EffectConfig = EFFECT_PRESETS.connectionFlow
): void {
  const timingConfig: WithTimingConfig = {
    duration: config.duration,
    easing: config.easing,
  };

  if (config.repeat) {
    flowValue.value = withRepeat(withTiming(1, timingConfig), -1, false);
  } else {
    flowValue.value = withTiming(1, timingConfig);
  }
}

/**
 * Create probe launch effect
 */
export function createProbeLaunchAnimation(
  scaleValue: SharedValue<number>,
  glowValue: SharedValue<number>,
  config: EffectConfig = EFFECT_PRESETS.probeLaunch
): void {
  const timingConfig: WithTimingConfig = {
    duration: config.duration,
    easing: config.easing,
  };

  // Scale punch effect
  scaleValue.value = withSequence(
    withTiming(0.8, {
      duration: config.duration * 0.3,
      easing: VISUAL_EASINGS.cubic,
    }),
    withTiming(1.2, { duration: config.duration * 0.7, easing: config.easing }),
    withTiming(1.0, {
      duration: config.duration * 0.3,
      easing: VISUAL_EASINGS.ease,
    })
  );

  // Glow burst
  glowValue.value = withSequence(
    withTiming(2.0, { duration: config.duration * 0.5, easing: config.easing }),
    withTiming(0, {
      duration: config.duration * 0.5,
      easing: VISUAL_EASINGS.ease,
    })
  );
}

/**
 * Create probe trail effect
 */
export function createProbeTrailAnimation(
  opacityValue: SharedValue<number>,
  scaleValue: SharedValue<number>,
  config: EffectConfig = EFFECT_PRESETS.probeTrail
): void {
  const timingConfig: WithTimingConfig = {
    duration: config.duration,
    easing: config.easing,
  };

  // Fade out trail
  opacityValue.value = withTiming(0, timingConfig);

  // Scale down trail
  scaleValue.value = withTiming(0.5, timingConfig);
}

/**
 * Create fade-in effect for UI elements
 */
export function createFadeInAnimation(
  opacityValue: SharedValue<number>,
  config: EffectConfig = EFFECT_PRESETS.fadeIn
): void {
  opacityValue.value = withTiming(1, {
    duration: config.duration,
    easing: config.easing,
  });
}

/**
 * Create slide-in effect for UI elements
 */
export function createSlideInAnimation(
  translateValue: SharedValue<number>,
  fromOffset: number,
  config: EffectConfig = EFFECT_PRESETS.slideIn
): void {
  translateValue.value = fromOffset;
  translateValue.value = withTiming(0, {
    duration: config.duration,
    easing: config.easing,
  });
}

/**
 * Color interpolation utilities for effects
 */
export const COLOR_EFFECTS = {
  // Interpolate between two hex colors
  interpolateColor: (
    progress: number,
    startColor: string,
    endColor: string
  ): string => {
    // Convert hex to RGB
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result
        ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
          }
        : { r: 0, g: 0, b: 0 };
    };

    const start = hexToRgb(startColor);
    const end = hexToRgb(endColor);

    const r = Math.round(start.r + (end.r - start.r) * progress);
    const g = Math.round(start.g + (end.g - start.g) * progress);
    const b = Math.round(start.b + (end.b - start.b) * progress);

    return `rgb(${r}, ${g}, ${b})`;
  },

  // Create pulsing color effect
  createPulsingColor: (
    baseColor: string,
    accentColor: string,
    progress: number
  ): string => {
    const pulseIntensity = Math.abs(Math.sin(progress * Math.PI));
    return COLOR_EFFECTS.interpolateColor(
      pulseIntensity,
      baseColor,
      accentColor
    );
  },

  // Create energy flow color
  createEnergyColor: (progress: number): string => {
    const colors = ['#4F46E5', '#7C3AED', '#EC4899', '#EF4444', '#F59E0B'];
    const segment = progress * (colors.length - 1);
    const startIndex = Math.floor(segment);
    const endIndex = Math.min(startIndex + 1, colors.length - 1);
    const t = segment - startIndex;

    return COLOR_EFFECTS.interpolateColor(
      t,
      colors[startIndex],
      colors[endIndex]
    );
  },
};

/**
 * Physics-based animation helpers
 */
export const PHYSICS_EFFECTS = {
  // Create spring animation with custom physics
  createSpringAnimation: (
    animatedValue: SharedValue<number>,
    toValue: number,
    damping: number = 15,
    stiffness: number = 150,
    mass: number = 1
  ) => {
    animatedValue.value = withTiming(toValue, {
      duration: Math.sqrt(mass / stiffness) * 2000, // Approximate spring duration
      easing: Easing.out(Easing.exp),
    });
  },

  // Create gravity effect
  createGravityEffect: (
    yValue: SharedValue<number>,
    initialVelocity: number = 0,
    gravity: number = 9.8,
    duration: number = 1000
  ) => {
    const distance =
      initialVelocity * (duration / 1000) +
      0.5 * gravity * Math.pow(duration / 1000, 2);
    yValue.value = withTiming(distance, {
      duration,
      easing: Easing.in(Easing.quad),
    });
  },
};

/**
 * Performance-optimized effect manager
 */
export class EffectManager {
  private activeEffects: Set<string> = new Set();
  private effectCallbacks: Map<string, () => void> = new Map();

  /**
   * Register an effect
   */
  registerEffect(id: string, callback: () => void): void {
    this.effectCallbacks.set(id, callback);
  }

  /**
   * Start an effect if not already running
   */
  startEffect(id: string): boolean {
    if (this.activeEffects.has(id)) {
      return false; // Effect already running
    }

    const callback = this.effectCallbacks.get(id);
    if (callback) {
      this.activeEffects.add(id);
      callback();
      return true;
    }

    return false;
  }

  /**
   * Stop an effect
   */
  stopEffect(id: string): void {
    this.activeEffects.delete(id);
  }

  /**
   * Check if effect is running
   */
  isEffectRunning(id: string): boolean {
    return this.activeEffects.has(id);
  }

  /**
   * Get active effect count for performance monitoring
   */
  getActiveEffectCount(): number {
    return this.activeEffects.size;
  }

  /**
   * Clear all effects
   */
  clearAllEffects(): void {
    this.activeEffects.clear();
  }
}

// Global effect manager instance
export const globalEffectManager = new EffectManager();
