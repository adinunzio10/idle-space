import React, { memo, useEffect, useMemo } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import {
  ParticleEmitterType,
  particleManager,
} from '../../utils/effects/ParticleSystem';
import { ViewportState } from '../../types/galaxy';

interface ParticleEffectsRendererProps {
  viewportState: ViewportState;
  width: number;
  height: number;
  effects: EffectInstance[];
  enableAnimations: boolean;
}

interface EffectInstance {
  id: string;
  type: ParticleEmitterType;
  position: { x: number; y: number };
  isActive: boolean;
  intensity?: number;
  duration?: number;
}

/**
 * Individual particle component for performance
 */
const ParticleComponent = memo<{
  x: number;
  y: number;
  size: number;
  color: string;
  opacity: number;
}>(({ x, y, size, color, opacity }) => {
  const animatedStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: x - size / 2,
    top: y - size / 2,
    width: size,
    height: size,
    backgroundColor: color,
    borderRadius: size / 2,
    opacity,
  }));

  return <Animated.View style={animatedStyle} />;
});

/**
 * Effect burst animation for celebrations
 */
const EffectBurst: React.FC<{
  centerX: number;
  centerY: number;
  color: string;
  onComplete: () => void;
}> = memo(({ centerX, centerY, color, onComplete }) => {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    // Burst animation
    scale.value = withSequence(
      withTiming(0.2, { duration: 100, easing: Easing.out(Easing.exp) }),
      withTiming(2.5, { duration: 400, easing: Easing.out(Easing.back(1.5)) }),
      withTiming(0, { duration: 300, easing: Easing.in(Easing.exp) })
    );

    opacity.value = withSequence(
      withTiming(1, { duration: 100 }),
      withTiming(0.7, { duration: 400 }),
      withTiming(0, { duration: 300 })
    );

    // Complete callback
    setTimeout(() => {
      runOnJS(onComplete)();
    }, 800);
  }, [scale, opacity, onComplete]);

  const animatedStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: centerX - 25,
    top: centerY - 25,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: color,
    borderWidth: 2,
    borderColor: color,
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={animatedStyle} />;
});

/**
 * Floating number effect for score/XP gains
 */
const FloatingNumber: React.FC<{
  value: string;
  startX: number;
  startY: number;
  color: string;
  onComplete: () => void;
}> = memo(({ value, startX, startY, color, onComplete }) => {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(0.8);

  useEffect(() => {
    // Float upward
    translateY.value = withTiming(-80, {
      duration: 2000,
      easing: Easing.out(Easing.quad),
    });

    // Scale up then fade
    scale.value = withSequence(
      withTiming(1.2, { duration: 300, easing: Easing.out(Easing.back(1.2)) }),
      withTiming(1, { duration: 1700, easing: Easing.linear })
    );

    opacity.value = withSequence(
      withTiming(1, { duration: 300 }),
      withTiming(1, { duration: 1000 }),
      withTiming(0, { duration: 700, easing: Easing.in(Easing.exp) })
    );

    setTimeout(() => {
      runOnJS(onComplete)();
    }, 2000);
  }, [translateY, opacity, scale, onComplete]);

  const animatedStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: startX,
    top: startY,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Animated.Text
        style={{
          fontSize: 16,
          fontWeight: 'bold',
          color,
          textAlign: 'center',
        }}
      >
        {value}
      </Animated.Text>
    </Animated.View>
  );
});

/**
 * Main particle effects renderer component
 */
export const ParticleEffectsRenderer: React.FC<ParticleEffectsRendererProps> =
  memo(({ viewportState, width, height, effects, enableAnimations }) => {
    const [activeEffects, setActiveEffects] = React.useState<Map<string, any>>(
      new Map()
    );

    // Create and manage particle systems
    useEffect(() => {
      if (!enableAnimations) return;

      effects.forEach(effect => {
        if (effect.isActive && !activeEffects.has(effect.id)) {
          const system = particleManager.createSystem(effect.id, effect.type, {
            maxParticles: Math.min(50, (effect.intensity || 1) * 20),
            particleLifetime: effect.duration || 2000,
          });

          system.setPosition(effect.position.x, effect.position.y);
          system.start();

          setActiveEffects(prev => new Map(prev).set(effect.id, system));
        } else if (!effect.isActive && activeEffects.has(effect.id)) {
          particleManager.removeSystem(effect.id);
          setActiveEffects(prev => {
            const newMap = new Map(prev);
            newMap.delete(effect.id);
            return newMap;
          });
        }
      });

      // Cleanup removed effects
      activeEffects.forEach((system, id) => {
        if (!effects.find(e => e.id === id)) {
          particleManager.removeSystem(id);
          setActiveEffects(prev => {
            const newMap = new Map(prev);
            newMap.delete(id);
            return newMap;
          });
        }
      });
    }, [effects, activeEffects, enableAnimations]);

    // Convert particle positions to screen coordinates
    const screenParticles = useMemo(() => {
      if (!enableAnimations) return [];

      const particles: any[] = [];
      activeEffects.forEach(system => {
        const systemParticles = system.getParticles();
        systemParticles.forEach(particle => {
          // Convert galaxy coordinates to screen coordinates
          const screenX =
            (particle.x - viewportState.translateX) * viewportState.scale;
          const screenY =
            (particle.y - viewportState.translateY) * viewportState.scale;

          // Only render particles within screen bounds (with margin)
          if (
            screenX >= -50 &&
            screenX <= width + 50 &&
            screenY >= -50 &&
            screenY <= height + 50
          ) {
            particles.push({
              ...particle,
              x: screenX,
              y: screenY,
            });
          }
        });
      });

      return particles;
    }, [activeEffects, viewportState, width, height, enableAnimations]);

    if (!enableAnimations) return null;

    return (
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width,
          height,
          pointerEvents: 'none',
        }}
      >
        {/* Render individual particles */}
        {screenParticles.map((particle, index) => (
          <ParticleComponent
            key={`${particle.id}-${index}`}
            x={particle.x}
            y={particle.y}
            size={particle.size}
            color={particle.color}
            opacity={particle.opacity}
          />
        ))}
      </View>
    );
  });

/**
 * Hook for managing particle effects
 */
export function useParticleEffects() {
  const [effects, setEffects] = React.useState<EffectInstance[]>([]);

  const addEffect = React.useCallback(
    (
      id: string,
      type: ParticleEmitterType,
      position: { x: number; y: number },
      options?: { intensity?: number; duration?: number }
    ) => {
      setEffects(prev => [
        ...prev.filter(e => e.id !== id), // Remove existing effect with same ID
        {
          id,
          type,
          position,
          isActive: true,
          intensity: options?.intensity,
          duration: options?.duration,
        },
      ]);
    },
    []
  );

  const removeEffect = React.useCallback((id: string) => {
    setEffects(prev =>
      prev.map(e => (e.id === id ? { ...e, isActive: false } : e))
    );

    // Remove from list after animation completes
    setTimeout(() => {
      setEffects(prev => prev.filter(e => e.id !== id));
    }, 1000);
  }, []);

  const clearAllEffects = React.useCallback(() => {
    setEffects([]);
  }, []);

  return {
    effects,
    addEffect,
    removeEffect,
    clearAllEffects,
  };
}

ParticleComponent.displayName = 'ParticleComponent';
EffectBurst.displayName = 'EffectBurst';
FloatingNumber.displayName = 'FloatingNumber';
ParticleEffectsRenderer.displayName = 'ParticleEffectsRenderer';
