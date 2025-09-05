/**
 * VisualDecayEffects Component - Entropy Decay Visual Effects
 * 
 * Creates visual decay effects using particle systems or animated gradients showing
 * entropy creeping between sector boundaries. Provides atmospheric visual feedback
 * for the entropy spreading system.
 */

import React, { useMemo, useEffect } from 'react';
import { Circle, Path, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, { 
  useSharedValue, 
  useAnimatedProps, 
  withRepeat, 
  withTiming, 
  withSequence,
  interpolate,
  Easing
} from 'react-native-reanimated';
import { GalacticSector, ViewportState, Point2D } from '../../types/galaxy';
import { 
  createWorkletSafeClone, 
  freezeForWorklet 
} from '../../utils/performance/WorkletDataIsolation';
import { galaxyToScreen } from '../../utils/spatial/viewport';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

interface VisualDecayEffectsProps {
  sector: GalacticSector;
  viewportState: ViewportState;
  isVisible: boolean;
  neighboringSectors: GalacticSector[];
  effectIntensity?: number; // 0-1, based on entropy level
}

interface DecayParticle {
  id: string;
  position: Point2D;
  velocity: Point2D;
  life: number; // 0-1, 1 = just born, 0 = about to die
  size: number;
  opacity: number;
  color: string;
}

// Configuration for decay effects
const DECAY_EFFECTS_CONFIG = {
  particles: {
    count: 10, // Base particle count per high-entropy sector
    maxCount: 50, // Maximum particles to prevent performance issues
    lifetime: 3000, // Particle lifetime in milliseconds
    speed: { min: 10, max: 30 }, // Particle speed range
    size: { min: 1, max: 4 }, // Particle size range
    opacity: { min: 0.3, max: 0.8 },
  },
  waves: {
    enabled: true,
    speed: 2000, // Wave animation duration
    amplitude: 15, // Wave movement distance
    frequency: 0.8, // Wave frequency
  },
  creep: {
    enabled: true,
    speed: 4000, // Creep animation duration
    intensity: 0.7, // Creep visual intensity
  },
  colors: {
    lowEntropy: '#3B82F6',    // Blue particles for low entropy
    mediumEntropy: '#8B5CF6', // Purple particles for medium entropy
    highEntropy: '#EF4444',   // Red particles for high entropy
    critical: '#DC2626',      // Dark red for critical entropy
  },
  thresholds: {
    particleEffect: 0.6,   // Entropy level to start particle effects
    waveEffect: 0.7,       // Entropy level to start wave effects
    creepEffect: 0.8,      // Entropy level to start creep effects
  }
} as const;

/**
 * Get decay effect color based on entropy level
 */
function getDecayColor(entropy: number): string {
  if (entropy <= 0.3) return DECAY_EFFECTS_CONFIG.colors.lowEntropy;
  if (entropy <= 0.6) return DECAY_EFFECTS_CONFIG.colors.mediumEntropy;
  if (entropy <= 0.9) return DECAY_EFFECTS_CONFIG.colors.highEntropy;
  return DECAY_EFFECTS_CONFIG.colors.critical;
}

/**
 * Generate decay particles for a sector
 */
function generateDecayParticles(
  sector: GalacticSector, 
  count: number, 
  viewportState: ViewportState
): DecayParticle[] {
  const particles: DecayParticle[] = [];
  const color = getDecayColor(sector.entropy);
  
  // Safety check: Ensure sector has valid vertices
  if (!sector.vertices || sector.vertices.length === 0) {
    console.warn(`Sector ${sector.id} has no vertices, skipping decay particles`);
    return particles;
  }
  
  // Generate particles around sector boundaries
  for (let i = 0; i < count; i++) {
    // Pick random vertex or center point
    const sourcePoint = Math.random() < 0.7 && sector.vertices.length > 0
      ? sector.vertices[Math.floor(Math.random() * sector.vertices.length)]
      : sector.center;
    
    // Random offset from source point in world coordinates
    const offsetX = (Math.random() - 0.5) * 100;
    const offsetY = (Math.random() - 0.5) * 100;
    
    // Create world position then convert to screen coordinates using consistent method
    const worldPosition = { x: sourcePoint.x + offsetX, y: sourcePoint.y + offsetY };
    const screenPosition = galaxyToScreen(worldPosition, viewportState);
    
    particles.push({
      id: `particle_${sector.id}_${i}`,
      position: screenPosition,
      velocity: {
        x: (Math.random() - 0.5) * DECAY_EFFECTS_CONFIG.particles.speed.max,
        y: (Math.random() - 0.5) * DECAY_EFFECTS_CONFIG.particles.speed.max
      },
      life: 1,
      size: Math.random() * (DECAY_EFFECTS_CONFIG.particles.size.max - DECAY_EFFECTS_CONFIG.particles.size.min) + DECAY_EFFECTS_CONFIG.particles.size.min,
      opacity: Math.random() * (DECAY_EFFECTS_CONFIG.particles.opacity.max - DECAY_EFFECTS_CONFIG.particles.opacity.min) + DECAY_EFFECTS_CONFIG.particles.opacity.min,
      color
    });
  }
  
  return particles;
}

/**
 * Single particle component
 */
const DecayParticleComponent: React.FC<{ particle: DecayParticle; entropy: number }> = ({ particle, entropy }) => {
  // Create worklet-safe particle data to prevent mutation warnings
  const workletSafeParticle = useMemo(() => 
    freezeForWorklet(createWorkletSafeClone(particle))
  , [particle]);

  const animatedOpacity = useSharedValue(workletSafeParticle.opacity);
  const animatedSize = useSharedValue(workletSafeParticle.size);
  const animatedX = useSharedValue(workletSafeParticle.position.x);
  const animatedY = useSharedValue(workletSafeParticle.position.y);

  useEffect(() => {
    // Particle lifecycle animation
    const lifetime = DECAY_EFFECTS_CONFIG.particles.lifetime;
    
    // Fade out animation
    animatedOpacity.value = withTiming(0, { duration: lifetime, easing: Easing.out(Easing.quad) });
    
    // Size animation (grow then shrink)
    animatedSize.value = withSequence(
      withTiming(workletSafeParticle.size * 1.5, { duration: lifetime * 0.3 }),
      withTiming(workletSafeParticle.size * 0.5, { duration: lifetime * 0.7 })
    );
    
    // Movement animation
    animatedX.value = withTiming(
      workletSafeParticle.position.x + workletSafeParticle.velocity.x, 
      { duration: lifetime, easing: Easing.out(Easing.linear) }
    );
    animatedY.value = withTiming(
      workletSafeParticle.position.y + workletSafeParticle.velocity.y, 
      { duration: lifetime, easing: Easing.out(Easing.linear) }
    );
  }, [workletSafeParticle, animatedOpacity, animatedSize, animatedX, animatedY]);

  const animatedProps = useAnimatedProps(() => ({
    cx: animatedX.value,
    cy: animatedY.value,
    r: animatedSize.value,
    opacity: animatedOpacity.value,
  }));

  return (
    <AnimatedCircle
      fill={workletSafeParticle.color}
      animatedProps={animatedProps}
    />
  );
};

/**
 * Wave effect component for entropy spreading visualization
 */
const EntropyWaveEffect: React.FC<{
  fromSector: GalacticSector;
  toSector: GalacticSector;
  viewportState: ViewportState;
  intensity: number;
}> = ({ fromSector, toSector, viewportState, intensity }) => {
  // Create worklet-safe sector data to prevent mutation warnings
  const workletSafeFromSector = useMemo(() => 
    freezeForWorklet(createWorkletSafeClone(fromSector))
  , [fromSector]);
  
  const workletSafeToSector = useMemo(() => 
    freezeForWorklet(createWorkletSafeClone(toSector))
  , [toSector]);

  const waveProgress = useSharedValue(0);
  const waveOpacity = useSharedValue(0.6);

  useEffect(() => {
    // Wave animation
    waveProgress.value = withRepeat(
      withTiming(1, { duration: DECAY_EFFECTS_CONFIG.waves.speed, easing: Easing.inOut(Easing.sin) }),
      -1,
      false
    );
    
    waveOpacity.value = withRepeat(
      withTiming(0.2, { duration: DECAY_EFFECTS_CONFIG.waves.speed }),
      -1,
      true
    );
  }, [waveProgress, waveOpacity]);

  // Calculate wave path between sectors using worklet-safe data and consistent coordinate transformation
  const wavePath = useMemo(() => {
    const startScreen = galaxyToScreen(workletSafeFromSector.center, viewportState);
    const endScreen = galaxyToScreen(workletSafeToSector.center, viewportState);
    
    // Create curved path with wave effect
    const midX = (startScreen.x + endScreen.x) / 2;
    const midY = (startScreen.y + endScreen.y) / 2;
    const amplitude = DECAY_EFFECTS_CONFIG.waves.amplitude * intensity;
    
    // Perpendicular offset for wave curve
    const dx = endScreen.x - startScreen.x;
    const dy = endScreen.y - startScreen.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const offsetX = (-dy / length) * amplitude;
    const offsetY = (dx / length) * amplitude;
    
    return `M ${startScreen.x} ${startScreen.y} Q ${midX + offsetX} ${midY + offsetY} ${endScreen.x} ${endScreen.y}`;
  }, [workletSafeFromSector, workletSafeToSector, viewportState, intensity]);

  const animatedWaveProps = useAnimatedProps(() => ({
    opacity: waveOpacity.value,
    strokeDashoffset: -waveProgress.value * 50, // Animate dash pattern
  }));

  const waveColor = getDecayColor(workletSafeFromSector.entropy);

  return (
    <AnimatedPath
      d={wavePath}
      fill="none"
      stroke={waveColor}
      strokeWidth={2 * intensity}
      strokeDasharray="10,5"
      animatedProps={animatedWaveProps}
    />
  );
};

/**
 * Main decay effects component
 */
export const VisualDecayEffectsComponent: React.FC<VisualDecayEffectsProps> = ({
  sector,
  viewportState,
  isVisible,
  neighboringSectors,
  effectIntensity = 1,
}) => {
  const entropy = sector.entropy;
  
  // ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURNS
  
  // Generate particles based on entropy level - MUST be before early return
  const particles = useMemo(() => {
    const baseCount = DECAY_EFFECTS_CONFIG.particles.count;
    const entropyMultiplier = Math.min(2, entropy * 2); // Higher entropy = more particles
    const particleCount = Math.min(
      DECAY_EFFECTS_CONFIG.particles.maxCount,
      Math.floor(baseCount * entropyMultiplier * effectIntensity)
    );
    
    return generateDecayParticles(sector, particleCount, viewportState);
  }, [sector, viewportState, entropy, effectIntensity]);

  // Find high-entropy neighbors for wave effects - MUST be before early return
  const highEntropyNeighbors = useMemo(() => {
    return neighboringSectors.filter(neighbor => 
      neighbor.entropy > entropy + 0.2 // Significant entropy difference
    );
  }, [neighboringSectors, entropy]);

  // Creep effect opacity based on entropy - MUST be before early return
  const creepOpacity = useMemo(() => {
    if (entropy < DECAY_EFFECTS_CONFIG.thresholds.creepEffect) return 0;
    return Math.min(0.4, (entropy - DECAY_EFFECTS_CONFIG.thresholds.creepEffect) * 2 * effectIntensity);
  }, [entropy, effectIntensity]);

  // Generate gradient for creep effect - MUST be before early return
  const creepGradientId = useMemo(() => 
    `creep_gradient_${sector.id}_${viewportState.scale.toFixed(2)}_${viewportState.translateX.toFixed(0)}_${viewportState.translateY.toFixed(0)}`
  , [sector.id, viewportState.scale, viewportState.translateX, viewportState.translateY]);
  const creepColor = getDecayColor(entropy);
  
  // Safety checks before rendering - AFTER all hooks
  if (!isVisible || 
      entropy < DECAY_EFFECTS_CONFIG.thresholds.particleEffect ||
      !sector.vertices || 
      sector.vertices.length === 0) {
    return null;
  }

  return (
    <G>
      {/* Gradient definitions for creep effect */}
      {creepOpacity > 0 && (
        <Defs>
          <LinearGradient
            id={creepGradientId}
            x1={sector.vertices[0] ? galaxyToScreen(sector.vertices[0], viewportState).x : 0}
            y1={sector.vertices[0] ? galaxyToScreen(sector.vertices[0], viewportState).y : 0}
            x2={sector.vertices[sector.vertices.length - 1] ? galaxyToScreen(sector.vertices[sector.vertices.length - 1], viewportState).x : 0}
            y2={sector.vertices[sector.vertices.length - 1] ? galaxyToScreen(sector.vertices[sector.vertices.length - 1], viewportState).y : 0}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0%" stopColor={creepColor} stopOpacity={creepOpacity} />
            <Stop offset="50%" stopColor={creepColor} stopOpacity={creepOpacity * 0.5} />
            <Stop offset="100%" stopColor={creepColor} stopOpacity={0} />
          </LinearGradient>
        </Defs>
      )}

      {/* Particle effects */}
      {particles.map(particle => (
        <DecayParticleComponent
          key={particle.id}
          particle={particle}
          entropy={entropy}
        />
      ))}

      {/* Wave effects to high-entropy neighbors */}
      {entropy >= DECAY_EFFECTS_CONFIG.thresholds.waveEffect &&
        highEntropyNeighbors.map(neighbor => (
          <EntropyWaveEffect
            key={`wave_${sector.id}_${neighbor.id}`}
            fromSector={sector}
            toSector={neighbor}
            viewportState={viewportState}
            intensity={effectIntensity}
          />
        ))
      }

      {/* Creep overlay effect */}
      {creepOpacity > 0 && sector.vertices && sector.vertices.length >= 3 && (
        <AnimatedPath
          d={`M ${sector.vertices.map(v => {
            const screenPos = galaxyToScreen(v, viewportState);
            return `${screenPos.x} ${screenPos.y}`;
          }).join(' L ')} Z`}
          fill={`url(#${creepGradientId})`}
          opacity={creepOpacity}
        />
      )}
    </G>
  );
};

/**
 * Multiple sector decay effects with performance optimization
 */
interface MultipleSectorDecayEffectsProps {
  sectors: GalacticSector[];
  sectorMap: Map<string, GalacticSector>;
  viewportState: ViewportState;
  maxEffectSectors?: number;
}

export const MultipleSectorDecayEffects: React.FC<MultipleSectorDecayEffectsProps> = ({
  sectors,
  sectorMap,
  viewportState,
  maxEffectSectors = 15, // Performance limit
}) => {
  // Filter and prioritize sectors for decay effects
  const effectSectors = useMemo(() => {
    const viewportBounds = {
      minX: -viewportState.translateX / viewportState.scale,
      maxX: (-viewportState.translateX + 800) / viewportState.scale,
      minY: -viewportState.translateY / viewportState.scale,
      maxY: (-viewportState.translateY + 600) / viewportState.scale,
    };

    return sectors
      .filter(sector => {
        // Must have sufficient entropy for effects
        if (sector.entropy < DECAY_EFFECTS_CONFIG.thresholds.particleEffect) return false;
        
        // Must be at least partially in viewport
        return sector.bounds.minX < viewportBounds.maxX &&
               sector.bounds.maxX > viewportBounds.minX &&
               sector.bounds.minY < viewportBounds.maxY &&
               sector.bounds.maxY > viewportBounds.minY;
      })
      .sort((a, b) => b.entropy - a.entropy) // Sort by entropy (higher = more priority)
      .slice(0, maxEffectSectors);
  }, [sectors, viewportState, maxEffectSectors]);

  return (
    <G>
      {effectSectors.map(sector => {
        // Get neighboring sectors
        const neighbors = sector.neighboringSectors
          .map(id => sectorMap.get(id))
          .filter(neighbor => neighbor !== undefined) as GalacticSector[];

        return (
          <VisualDecayEffectsComponent
            key={sector.id}
            sector={sector}
            viewportState={viewportState}
            isVisible={true}
            neighboringSectors={neighbors}
            effectIntensity={Math.min(1, sector.entropy * 1.2)}
          />
        );
      })}
    </G>
  );
};

/**
 * Utility function to calculate decay effect performance impact
 */
export function calculateDecayEffectLoad(
  sectors: GalacticSector[],
  viewportState: ViewportState
): {
  activeParticleCount: number;
  activeWaveCount: number;
  activeCreepCount: number;
  totalEffectLoad: number; // 0-1 scale
} {
  let activeParticleCount = 0;
  let activeWaveCount = 0;
  let activeCreepCount = 0;

  sectors.forEach(sector => {
    if (sector.entropy >= DECAY_EFFECTS_CONFIG.thresholds.particleEffect) {
      const particleCount = Math.min(
        DECAY_EFFECTS_CONFIG.particles.maxCount,
        DECAY_EFFECTS_CONFIG.particles.count * sector.entropy * 2
      );
      activeParticleCount += particleCount;
    }
    
    if (sector.entropy >= DECAY_EFFECTS_CONFIG.thresholds.waveEffect) {
      activeWaveCount += sector.neighboringSectors.length;
    }
    
    if (sector.entropy >= DECAY_EFFECTS_CONFIG.thresholds.creepEffect) {
      activeCreepCount += 1;
    }
  });

  // Calculate total effect load (higher = more performance impact)
  const particleLoad = Math.min(1, activeParticleCount / 100);
  const waveLoad = Math.min(1, activeWaveCount / 20);
  const creepLoad = Math.min(1, activeCreepCount / 15);
  
  const totalEffectLoad = (particleLoad + waveLoad + creepLoad) / 3;

  return {
    activeParticleCount,
    activeWaveCount,
    activeCreepCount,
    totalEffectLoad,
  };
}

export default VisualDecayEffectsComponent;