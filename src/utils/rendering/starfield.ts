import { Point2D, ViewportBounds } from '../../types/galaxy';

export interface Star {
  id: string;
  position: Point2D;
  layer: number; // 0 = far, 1 = mid, 2 = near
  size: number;
  brightness: number;
  color: string;
}

export interface StarLayer {
  id: number;
  parallaxFactor: number;
  starCount: number;
  minSize: number;
  maxSize: number;
  color: string;
  opacity: number;
}

export interface StarFieldConfig {
  layers: StarLayer[];
  galaxyWidth: number;
  galaxyHeight: number;
  seed: number;
  densityFactor: number;
}

export const DEFAULT_STAR_LAYERS: StarLayer[] = [
  {
    id: 0,
    parallaxFactor: 0.1, // Furthest background - moves slowly
    starCount: 200,
    minSize: 1,
    maxSize: 2,
    color: '#6B7280',
    opacity: 0.3,
  },
  {
    id: 1,
    parallaxFactor: 0.3, // Mid layer
    starCount: 150,
    minSize: 1.5,
    maxSize: 3,
    color: '#9CA3AF',
    opacity: 0.5,
  },
  {
    id: 2,
    parallaxFactor: 0.6, // Nearest background - moves faster
    starCount: 100,
    minSize: 2,
    maxSize: 4,
    color: '#F3F4F6',
    opacity: 0.7,
  },
];

export const DEFAULT_STARFIELD_CONFIG: StarFieldConfig = {
  layers: DEFAULT_STAR_LAYERS,
  galaxyWidth: 4000, // Extend beyond main galaxy bounds
  galaxyHeight: 4000,
  seed: 12345,
  densityFactor: 1.0,
};

/**
 * Simple seeded pseudo-random number generator
 * Based on Linear Congruential Generator (LCG)
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }

  next(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  choice<T>(array: T[]): T {
    return array[Math.floor(this.next() * array.length)];
  }
}

/**
 * Generate stars for a specific layer
 */
export function generateStarsForLayer(
  layer: StarLayer,
  config: StarFieldConfig
): Star[] {
  const rng = new SeededRandom(config.seed + layer.id * 1000);
  const stars: Star[] = [];
  
  const adjustedStarCount = Math.floor(layer.starCount * config.densityFactor);
  
  for (let i = 0; i < adjustedStarCount; i++) {
    const star: Star = {
      id: `star-${layer.id}-${i}`,
      position: {
        x: rng.range(0, config.galaxyWidth),
        y: rng.range(0, config.galaxyHeight),
      },
      layer: layer.id,
      size: rng.range(layer.minSize, layer.maxSize),
      brightness: rng.range(0.3, 1.0),
      color: layer.color,
    };
    
    stars.push(star);
  }
  
  return stars;
}

/**
 * Generate all stars for the starfield
 */
export function generateStarField(config: StarFieldConfig = DEFAULT_STARFIELD_CONFIG): Star[] {
  const allStars: Star[] = [];
  
  for (const layer of config.layers) {
    const layerStars = generateStarsForLayer(layer, config);
    allStars.push(...layerStars);
  }
  
  return allStars;
}

/**
 * Get stars visible within the viewport bounds for a specific layer
 * Takes parallax offset into account
 */
export function getVisibleStars(
  stars: Star[],
  viewportBounds: ViewportBounds,
  layerId: number,
  parallaxOffset: Point2D
): Star[] {
  return stars.filter(star => {
    if (star.layer !== layerId) return false;
    
    // Adjust star position based on parallax
    const adjustedX = star.position.x + parallaxOffset.x;
    const adjustedY = star.position.y + parallaxOffset.y;
    
    // Add padding to account for star size
    const padding = star.size * 2;
    
    return (
      adjustedX >= viewportBounds.minX - padding &&
      adjustedX <= viewportBounds.maxX + padding &&
      adjustedY >= viewportBounds.minY - padding &&
      adjustedY <= viewportBounds.maxY + padding
    );
  });
}

/**
 * Calculate parallax offset for a layer based on viewport translation
 */
export function calculateParallaxOffset(
  viewportTranslation: Point2D,
  parallaxFactor: number
): Point2D {
  return {
    x: viewportTranslation.x * parallaxFactor,
    y: viewportTranslation.y * parallaxFactor,
  };
}

/**
 * Get optimal star density based on device performance
 * This can be extended with actual performance metrics
 */
export function getOptimalDensityFactor(): number {
  // For now, return a conservative value
  // Could be enhanced with actual device performance detection
  return 0.8;
}

/**
 * Create star color variations based on stellar types
 */
export const STAR_COLORS = {
  white: '#F8FAFC',
  blue: '#DBEAFE', 
  yellow: '#FEF3C7',
  orange: '#FED7AA',
  red: '#FECACA',
} as const;

/**
 * Get a random star color
 */
export function getRandomStarColor(rng: SeededRandom): string {
  const colors = Object.values(STAR_COLORS);
  return rng.choice(colors);
}

/**
 * Create enhanced star layers with color variation
 */
export function createEnhancedStarLayers(): StarLayer[] {
  return [
    {
      id: 0,
      parallaxFactor: 0.1,
      starCount: 200,
      minSize: 0.8,
      maxSize: 1.5,
      color: STAR_COLORS.white,
      opacity: 0.2,
    },
    {
      id: 1,
      parallaxFactor: 0.3,
      starCount: 150,
      minSize: 1.2,
      maxSize: 2.5,
      color: STAR_COLORS.blue,
      opacity: 0.4,
    },
    {
      id: 2,
      parallaxFactor: 0.6,
      starCount: 100,
      minSize: 1.8,
      maxSize: 3.5,
      color: STAR_COLORS.yellow,
      opacity: 0.6,
    },
  ];
}