import { PatternType } from '../types/galaxy';

export const CONNECTION_CONFIG = {
  // Visual settings for connections
  VISUAL: {
    MIN_WIDTH: 1,
    MAX_WIDTH: 5,
    BASE_OPACITY: 0.7,
    ACTIVE_OPACITY: 1.0,
    PATTERN_OPACITY: 0.9 as const,
    GLOW_RADIUS: 3,
  },

  // Performance thresholds
  PERFORMANCE: {
    MAX_CONNECTIONS_PER_FRAME: 200,
    CULLING_MARGIN: 50, // Extra margin for culling calculations
    MIN_CONNECTION_LENGTH: 10, // Don't render very short connections at low LOD
    MAX_RENDER_DISTANCE: 2000, // Max distance to render connections
  },

  // LOD-based rendering settings
  LOD_SETTINGS: {
    FULL_DETAIL: {
      minZoom: 2.0,
      showFlow: true,
      showGlow: true,
      showPatterns: true,
      animationSpeed: 1.0,
    },
    STANDARD: {
      minZoom: 0.5,
      showFlow: false,
      showGlow: true,
      showPatterns: true,
      animationSpeed: 0.5,
    },
    SIMPLIFIED: {
      minZoom: 0.1,
      showFlow: false,
      showGlow: false,
      showPatterns: false,
      animationSpeed: 0,
    },
    HIDDEN: {
      minZoom: 0,
      showFlow: false,
      showGlow: false,
      showPatterns: false,
      animationSpeed: 0,
    },
  },

  // Connection strength visualization
  STRENGTH_MAPPING: {
    1: { width: 1, glow: 0 },
    2: { width: 1.5, glow: 1 },
    3: { width: 2, glow: 1 },
    4: { width: 3, glow: 2 },
    5: { width: 4, glow: 3 },
  },

  // Animation settings
  ANIMATION: {
    FLOW_SPEED: 2000, // ms for particle to travel connection length
    PULSE_DURATION: 1500,
    FLASH_DURATION: 500,
    PATTERN_COMPLETION_FLASH: 1000,
    GLOW_FADE_DURATION: 300,
  },
} as const;

// Colors for different connection types and patterns
export const CONNECTION_COLORS = {
  // Default connection colors
  DEFAULT: {
    start: '#4F46E5',
    end: '#E0E7FF',
    flow: '#6366F1',
    glow: '#818CF8',
  },

  // Strong connection colors
  STRONG: {
    start: '#3730A3',
    end: '#C7D2FE',
    flow: '#4F46E5',
    glow: '#6366F1',
  },

  // Pattern-specific colors
  PATTERNS: {
    triangle: {
      start: '#10B981',
      end: '#D1FAE5',
      flow: '#34D399',
      glow: '#6EE7B7',
    },
    square: {
      start: '#3B82F6',
      end: '#DBEAFE',
      flow: '#60A5FA',
      glow: '#93C5FD',
    },
    pentagon: {
      start: '#8B5CF6',
      end: '#EDE9FE',
      flow: '#A78BFA',
      glow: '#C4B5FD',
    },
    hexagon: {
      start: '#F59E0B',
      end: '#FEF3C7',
      flow: '#FBBF24',
      glow: '#FCD34D',
    },
  } as Record<
    PatternType,
    { start: string; end: string; flow: string; glow: string }
  >,

  // Special states
  INACTIVE: {
    start: '#6B7280',
    end: '#F3F4F6',
    flow: '#9CA3AF',
    glow: '#D1D5DB',
  },
} as const;

// Pattern bonus multipliers
export const PATTERN_BONUSES = {
  triangle: 1.5,
  square: 2.0,
  pentagon: 3.0,
  hexagon: 5.0,
} as const;

// Connection curve calculation constants
export const CURVE_CONFIG = {
  // Bezier curve control point offset (as percentage of distance)
  CONTROL_POINT_OFFSET: 0.3,

  // Maximum curve deviation for aesthetic appeal
  MAX_CURVE_DEVIATION: 50,

  // Minimum curve for very short connections
  MIN_CURVE_OFFSET: 10,

  // Curve direction variation (adds visual interest)
  CURVE_VARIATION: 0.1,
} as const;
