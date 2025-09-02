import {
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  withDelay,
  interpolate,
  Easing,
  SharedValue,
  runOnJS,
} from 'react-native-reanimated';

import { PatternType } from '../../types/galaxy';
import {
  PATTERN_VISUAL_CONFIG,
  PATTERN_COLORS,
} from '../../constants/patterns';

/**
 * Animation presets for different pattern formation scenarios
 */
export const PATTERN_ANIMATION_PRESETS = {
  // Standard formation when pattern is first detected
  formation: {
    duration: PATTERN_VISUAL_CONFIG.ANIMATION.FORMATION_DURATION,
    easing: Easing.bezier(0.4, 0.0, 0.2, 1),
    delay: 0,
  },

  // Quick formation for patterns detected during rapid beacon placement
  quickFormation: {
    duration: PATTERN_VISUAL_CONFIG.ANIMATION.FORMATION_DURATION * 0.6,
    easing: Easing.out(Easing.quad),
    delay: 0,
  },

  // Destruction when pattern is broken
  destruction: {
    duration: PATTERN_VISUAL_CONFIG.ANIMATION.DESTRUCTION_DURATION,
    easing: Easing.bezier(0.6, 0.0, 0.8, 1),
    delay: 0,
  },

  // Bonus activation flash
  bonusActivation: {
    duration: PATTERN_VISUAL_CONFIG.ANIMATION.BONUS_FLASH_DURATION,
    easing: Easing.inOut(Easing.sin),
    delay: 0,
  },
} as const;

/**
 * Pattern formation animation factory
 */
export const createFormationAnimation = (
  progress: SharedValue<number>,
  patternType: PatternType,
  preset: keyof typeof PATTERN_ANIMATION_PRESETS = 'formation',
  onComplete?: () => void
) => {
  const animationConfig = PATTERN_ANIMATION_PRESETS[preset];

  progress.value = 0;
  progress.value = withDelay(
    animationConfig.delay,
    withTiming(
      1,
      {
        duration: animationConfig.duration,
        easing: animationConfig.easing,
      },
      finished => {
        if (finished && onComplete) {
          runOnJS(onComplete)();
        }
      }
    )
  );
};

/**
 * Pattern destruction animation factory
 */
export const createDestructionAnimation = (
  progress: SharedValue<number>,
  scale: SharedValue<number>,
  opacity: SharedValue<number>,
  onComplete?: () => void
) => {
  const config = PATTERN_ANIMATION_PRESETS.destruction;

  progress.value = withTiming(0, {
    duration: config.duration,
    easing: config.easing,
  });

  scale.value = withTiming(0.3, {
    duration: config.duration,
    easing: config.easing,
  });

  opacity.value = withTiming(
    0,
    {
      duration: config.duration * 0.8, // Fade out slightly faster
      easing: config.easing,
    },
    finished => {
      if (finished && onComplete) {
        runOnJS(onComplete)();
      }
    }
  );
};

/**
 * Continuous pulse animation for active patterns
 */
export const createPulseAnimation = (
  pulseProgress: SharedValue<number>,
  patternType: PatternType,
  intensity: number = 1
) => {
  const config = PATTERN_VISUAL_CONFIG.EFFECTS[patternType];
  const adjustedIntensity = config.pulseIntensity * intensity;

  pulseProgress.value = withRepeat(
    withSequence(
      withTiming(1, {
        duration: PATTERN_VISUAL_CONFIG.ANIMATION.PULSE_DURATION / 2,
        easing: Easing.inOut(Easing.sin),
      }),
      withTiming(0, {
        duration: PATTERN_VISUAL_CONFIG.ANIMATION.PULSE_DURATION / 2,
        easing: Easing.inOut(Easing.sin),
      })
    ),
    -1,
    false
  );
};

/**
 * Glow intensity animation for pattern highlighting
 */
export const createGlowAnimation = (
  glowIntensity: SharedValue<number>,
  patternType: PatternType,
  isActive: boolean = true
) => {
  if (!isActive) {
    glowIntensity.value = withTiming(0, {
      duration: 300,
      easing: Easing.out(Easing.quad),
    });
    return;
  }

  const config = PATTERN_VISUAL_CONFIG.EFFECTS[patternType];
  const maxIntensity = config.glowIntensity;
  const minIntensity = maxIntensity * 0.3;

  glowIntensity.value = withRepeat(
    withSequence(
      withTiming(maxIntensity, {
        duration: PATTERN_VISUAL_CONFIG.ANIMATION.GLOW_CYCLE_DURATION / 2,
        easing: Easing.inOut(Easing.quad),
      }),
      withTiming(minIntensity, {
        duration: PATTERN_VISUAL_CONFIG.ANIMATION.GLOW_CYCLE_DURATION / 2,
        easing: Easing.inOut(Easing.quad),
      })
    ),
    -1,
    false
  );
};

/**
 * Shimmer effect for complex patterns (pentagon, hexagon)
 */
export const createShimmerAnimation = (
  shimmerProgress: SharedValue<number>,
  patternType: PatternType,
  enabled: boolean = true
) => {
  const config = PATTERN_VISUAL_CONFIG.EFFECTS[patternType];

  if (!enabled || !config.hasShimmer) {
    shimmerProgress.value = 0;
    return;
  }

  shimmerProgress.value = withRepeat(
    withTiming(1, {
      duration: PATTERN_VISUAL_CONFIG.ANIMATION.SHIMMER_DURATION,
      easing: Easing.linear,
    }),
    -1,
    false
  );
};

/**
 * Bonus flash animation when pattern contributes to resource generation
 */
export const createBonusFlashAnimation = (
  flashIntensity: SharedValue<number>,
  onComplete?: () => void
) => {
  flashIntensity.value = 0;
  flashIntensity.value = withSequence(
    withTiming(1, {
      duration: PATTERN_VISUAL_CONFIG.ANIMATION.BONUS_FLASH_DURATION * 0.3,
      easing: Easing.out(Easing.quad),
    }),
    withTiming(0.7, {
      duration: PATTERN_VISUAL_CONFIG.ANIMATION.BONUS_FLASH_DURATION * 0.2,
      easing: Easing.inOut(Easing.quad),
    }),
    withTiming(
      0,
      {
        duration: PATTERN_VISUAL_CONFIG.ANIMATION.BONUS_FLASH_DURATION * 0.5,
        easing: Easing.out(Easing.exp),
      },
      finished => {
        if (finished && onComplete) {
          runOnJS(onComplete)();
        }
      }
    )
  );
};

/**
 * Particle animation for high-value patterns
 */
export const createParticleAnimation = (
  particleProgress: SharedValue<number>,
  patternType: PatternType,
  enabled: boolean = true
) => {
  const config = PATTERN_VISUAL_CONFIG.EFFECTS[patternType];

  if (!enabled || !config.hasParticles) {
    particleProgress.value = 0;
    return;
  }

  particleProgress.value = withRepeat(
    withSequence(
      withDelay(
        Math.random() * 1000, // Random initial delay for variety
        withTiming(1, {
          duration: PATTERN_VISUAL_CONFIG.ANIMATION.PARTICLE_DURATION * 0.8,
          easing: Easing.out(Easing.quad),
        })
      ),
      withTiming(0, {
        duration: PATTERN_VISUAL_CONFIG.ANIMATION.PARTICLE_DURATION * 0.2,
        easing: Easing.out(Easing.exp),
      }),
      withDelay(500, withTiming(0)) // Pause between cycles
    ),
    -1,
    false
  );
};

/**
 * Complex multi-pattern formation sequence
 */
export const createSequentialFormationAnimation = (
  patterns: {
    progress: SharedValue<number>;
    type: PatternType;
    delay: number;
  }[],
  onComplete?: () => void
) => {
  let completedCount = 0;
  const totalPatterns = patterns.length;

  patterns.forEach(({ progress, type, delay }, index) => {
    createFormationAnimation(progress, type, 'formation', () => {
      completedCount++;
      if (completedCount === totalPatterns && onComplete) {
        onComplete();
      }
    });
  });
};

/**
 * Pattern interaction feedback animations
 */
export const createInteractionFeedback = {
  // Touch down feedback
  touchDown: (scale: SharedValue<number>, opacity: SharedValue<number>) => {
    scale.value = withSpring(1.05, {
      damping: 20,
      stiffness: 400,
    });

    opacity.value = withTiming(0.8, {
      duration: 150,
      easing: Easing.out(Easing.quad),
    });
  },

  // Touch up feedback
  touchUp: (scale: SharedValue<number>, opacity: SharedValue<number>) => {
    scale.value = withSpring(1, {
      damping: 20,
      stiffness: 400,
    });

    opacity.value = withTiming(1, {
      duration: 200,
      easing: Easing.out(Easing.quad),
    });
  },

  // Hover effect (for future web support)
  hover: (scale: SharedValue<number>, glowIntensity: SharedValue<number>) => {
    scale.value = withSpring(1.03, {
      damping: 25,
      stiffness: 300,
    });

    glowIntensity.value = withTiming(1.3, {
      duration: 200,
      easing: Easing.out(Easing.quad),
    });
  },

  // Hover out
  hoverOut: (
    scale: SharedValue<number>,
    glowIntensity: SharedValue<number>
  ) => {
    scale.value = withSpring(1, {
      damping: 25,
      stiffness: 300,
    });

    glowIntensity.value = withTiming(1, {
      duration: 200,
      easing: Easing.out(Easing.quad),
    });
  },
};

/**
 * Animation interpolation helpers
 */
export const interpolatePatternScale = (
  progress: number,
  pulseProgress: number,
  patternType: PatternType,
  baseScale: number = 1
): number => {
  const formationScale = interpolate(progress, [0, 0.3, 1], [0.1, 0.8, 1]);

  const config = PATTERN_VISUAL_CONFIG.EFFECTS[patternType];
  const pulseScale = interpolate(
    pulseProgress,
    [0, 1],
    [1, 1 + config.pulseIntensity]
  );

  return baseScale * formationScale * pulseScale;
};

export const interpolatePatternOpacity = (
  progress: number,
  glowIntensity: number,
  isActive: boolean = true
): number => {
  const baseOpacity = interpolate(progress, [0, 0.3, 1], [0, 0.5, 1]);

  const targetOpacity = isActive
    ? PATTERN_VISUAL_CONFIG.RENDERING.FILL_OPACITY_ACTIVE
    : PATTERN_VISUAL_CONFIG.RENDERING.FILL_OPACITY;

  const glowBoost = interpolate(glowIntensity, [0, 1], [1, 1.2]);

  return Math.min(1, baseOpacity * targetOpacity * glowBoost);
};

/**
 * Performance-aware animation controller
 */
export class PatternAnimationController {
  private activeAnimations = new Set<string>();
  private maxConcurrentAnimations: number;

  constructor(maxConcurrent: number = 10) {
    this.maxConcurrentAnimations = maxConcurrent;
  }

  canStartAnimation(patternId: string): boolean {
    return this.activeAnimations.size < this.maxConcurrentAnimations;
  }

  startAnimation(patternId: string): void {
    this.activeAnimations.add(patternId);
  }

  endAnimation(patternId: string): void {
    this.activeAnimations.delete(patternId);
  }

  getActiveAnimationCount(): number {
    return this.activeAnimations.size;
  }

  clearAllAnimations(): void {
    this.activeAnimations.clear();
  }
}
