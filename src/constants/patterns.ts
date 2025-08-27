import { PatternType } from '../types/galaxy';

/**
 * Visual configuration for pattern highlighting and animations
 */
export const PATTERN_VISUAL_CONFIG = {
  // Base rendering settings
  RENDERING: {
    STROKE_WIDTH: 2,
    STROKE_WIDTH_ACTIVE: 3,
    FILL_OPACITY: 0.15,
    FILL_OPACITY_ACTIVE: 0.25,
    STROKE_OPACITY: 0.8,
    STROKE_OPACITY_ACTIVE: 1.0,
    BONUS_TEXT_SIZE: 12,
    BONUS_TEXT_SIZE_LARGE: 16,
  },

  // Level of detail settings
  LOD_SETTINGS: {
    FULL_DETAIL: {
      minZoom: 2.0,
      showFill: true,
      showBonusText: true,
      enableAnimations: true,
      showParticles: true,
    },
    STANDARD: {
      minZoom: 0.8,
      showFill: true,
      showBonusText: false,
      enableAnimations: true,
      showParticles: false,
    },
    SIMPLIFIED: {
      minZoom: 0.3,
      showFill: false,
      showBonusText: false,
      enableAnimations: false,
      showParticles: false,
    },
    HIDDEN: {
      minZoom: 0,
      showFill: false,
      showBonusText: false,
      enableAnimations: false,
      showParticles: false,
    },
  },

  // Animation timing
  ANIMATION: {
    FORMATION_DURATION: 800,
    FORMATION_DELAY: 100, // Stagger multiple patterns
    DESTRUCTION_DURATION: 600,
    PULSE_DURATION: 2000,
    PULSE_DELAY: 500,
    GLOW_CYCLE_DURATION: 3000,
    BONUS_FLASH_DURATION: 1500,
    SHIMMER_DURATION: 4000,
    PARTICLE_DURATION: 2500,
  },

  // Animation effects per pattern type
  EFFECTS: {
    triangle: {
      hasParticles: false,
      hasShimmer: false,
      pulseIntensity: 0.05, // Scale variation: 1.0 to 1.05
      glowIntensity: 0.3,
    },
    square: {
      hasParticles: false,
      hasShimmer: false,
      pulseIntensity: 0.08,
      glowIntensity: 0.4,
    },
    pentagon: {
      hasParticles: true,
      hasShimmer: true,
      pulseIntensity: 0.12,
      glowIntensity: 0.6,
    },
    hexagon: {
      hasParticles: true,
      hasShimmer: true,
      pulseIntensity: 0.15,
      glowIntensity: 0.8,
    },
  } as Record<PatternType, {
    hasParticles: boolean;
    hasShimmer: boolean;
    pulseIntensity: number;
    glowIntensity: number;
  }>,
} as const;

/**
 * Pattern-specific colors extending connection colors for overlays
 */
export const PATTERN_COLORS = {
  triangle: {
    fill: '#10B981',
    fillActive: '#059669',
    stroke: '#34D399',
    strokeActive: '#10B981',
    glow: '#6EE7B7',
    glowActive: '#34D399',
    bonus: '#065F46',
    shadow: '#064E3B',
  },
  square: {
    fill: '#3B82F6',
    fillActive: '#2563EB',
    stroke: '#60A5FA',
    strokeActive: '#3B82F6',
    glow: '#93C5FD',
    glowActive: '#60A5FA',
    bonus: '#1E3A8A',
    shadow: '#1E40AF',
  },
  pentagon: {
    fill: '#8B5CF6',
    fillActive: '#7C3AED',
    stroke: '#A78BFA',
    strokeActive: '#8B5CF6',
    glow: '#C4B5FD',
    glowActive: '#A78BFA',
    bonus: '#581C87',
    shadow: '#5B21B6',
  },
  hexagon: {
    fill: '#F59E0B',
    fillActive: '#D97706',
    stroke: '#FBBF24',
    strokeActive: '#F59E0B',
    glow: '#FCD34D',
    glowActive: '#FBBF24',
    bonus: '#92400E',
    shadow: '#B45309',
  },
} as Record<PatternType, {
  fill: string;
  fillActive: string;
  stroke: string;
  strokeActive: string;
  glow: string;
  glowActive: string;
  bonus: string;
  shadow: string;
}>;

/**
 * Bonus multiplier display configuration
 */
export const BONUS_DISPLAY = {
  MULTIPLIERS: {
    triangle: '1.5×',
    square: '2.0×',
    pentagon: '3.0×',
    hexagon: '5.0×',
  } as Record<PatternType, string>,

  // Position offset from pattern center
  TEXT_OFFSET: {
    x: 0,
    y: -8,
  },

  // Text styling
  TEXT_STYLE: {
    fontSize: 12,
    fontWeight: '600',
    textAnchor: 'middle',
    alignmentBaseline: 'central',
  },

  // Background pill styling
  BACKGROUND: {
    paddingX: 6,
    paddingY: 2,
    cornerRadius: 8,
    opacity: 0.9,
  },
} as const;

/**
 * Pattern rendering layers (z-index equivalent)
 */
export const PATTERN_LAYERS = {
  SHADOW: 0,
  FILL: 1,
  GLOW: 2,
  STROKE: 3,
  PARTICLES: 4,
  BONUS_TEXT: 5,
} as const;

/**
 * Performance thresholds for pattern rendering
 */
export const PATTERN_PERFORMANCE = {
  // Maximum patterns to animate simultaneously
  MAX_ANIMATED_PATTERNS: 20,
  
  // Maximum patterns to show particles for
  MAX_PARTICLE_PATTERNS: 5,
  
  // Culling margin around viewport
  CULLING_MARGIN: 100,
  
  // Minimum pattern size to render (screen pixels)
  MIN_RENDER_SIZE: 20,
  
  // Pattern complexity for LOD decisions
  COMPLEXITY: {
    triangle: 1,
    square: 1,
    pentagon: 2,
    hexagon: 3,
  } as Record<PatternType, number>,
} as const;

/**
 * Pattern interaction settings
 */
export const PATTERN_INTERACTION = {
  // Touch target expansion around pattern
  TOUCH_MARGIN: 20,
  
  // Minimum touch duration for pattern details
  MIN_PRESS_DURATION: 200,
  
  // Visual feedback on touch
  TOUCH_FEEDBACK: {
    scaleIncrease: 0.05,
    opacityIncrease: 0.2,
    duration: 150,
  },
  
  // Hover effect settings (for future web support)
  HOVER: {
    scaleIncrease: 0.03,
    glowIncrease: 0.3,
    duration: 200,
  },
} as const;

/**
 * Pattern overlap visual handling
 */
export const PATTERN_OVERLAP = {
  // Opacity reduction for overlapping patterns
  OVERLAP_OPACITY_REDUCTION: 0.3,
  
  // Z-index priority by pattern type (higher = on top)
  Z_INDEX_PRIORITY: {
    triangle: 1,
    square: 2,
    pentagon: 3,
    hexagon: 4,
  } as Record<PatternType, number>,
  
  // Blend modes for overlapping patterns
  BLEND_MODES: {
    normal: 'normal',
    multiply: 'multiply',
    overlay: 'overlay',
    softLight: 'soft-light',
  },
} as const;