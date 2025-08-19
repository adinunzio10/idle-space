import React, { useMemo } from 'react';
import { Circle, G } from 'react-native-svg';
import { Point2D, ViewportState } from '../../types/galaxy';
import {
  Star,
  StarLayer,
  generateStarField,
  getVisibleStars,
  calculateParallaxOffset,
  DEFAULT_STARFIELD_CONFIG,
  createEnhancedStarLayers,
  getOptimalDensityFactor,
} from '../../utils/rendering/starfield';

interface StarFieldProps {
  viewportState: ViewportState;
  width: number;
  height: number;
  enableParallax?: boolean;
  densityFactor?: number;
}

interface StarLayerRendererProps {
  layer: StarLayer;
  stars: Star[];
  viewportState: ViewportState;
  parallaxOffset: Point2D;
  enableParallax: boolean;
}

const StarLayerRenderer: React.FC<StarLayerRendererProps> = ({
  layer,
  stars,
  viewportState,
  parallaxOffset,
  enableParallax,
}) => {
  // Get visible stars for this layer
  const visibleStars = useMemo(() => {
    const effectiveParallaxOffset = enableParallax ? parallaxOffset : { x: 0, y: 0 };
    return getVisibleStars(stars, viewportState.bounds, layer.id, effectiveParallaxOffset);
  }, [stars, viewportState.bounds, layer.id, parallaxOffset, enableParallax]);

  // For SVG, we need to apply transform directly as props
  const transformValues = useMemo(() => {
    if (!enableParallax) {
      return { translateX: 0, translateY: 0 };
    }
    return {
      translateX: parallaxOffset.x,
      translateY: parallaxOffset.y,
    };
  }, [parallaxOffset, enableParallax]);

  if (visibleStars.length === 0) {
    return null;
  }

  return (
    <G
      transform={`translate(${transformValues.translateX}, ${transformValues.translateY})`}
    >
      {visibleStars.map((star) => {
        // Calculate screen position
        const screenPos = {
          x: star.position.x * viewportState.scale + viewportState.translateX,
          y: star.position.y * viewportState.scale + viewportState.translateY,
        };

        // Calculate effective size and opacity based on zoom
        const effectiveSize = Math.max(0.5, star.size * Math.min(1.5, viewportState.scale));
        const effectiveOpacity = Math.min(
          layer.opacity,
          star.brightness * Math.min(1.0, viewportState.scale * 0.8)
        );

        return (
          <Circle
            key={star.id}
            cx={screenPos.x}
            cy={screenPos.y}
            r={effectiveSize}
            fill={star.color}
            opacity={effectiveOpacity}
          />
        );
      })}
    </G>
  );
};

export const StarField: React.FC<StarFieldProps> = ({
  viewportState,
  width,
  height,
  enableParallax = true,
  densityFactor,
}) => {
  // Generate starfield configuration
  const starFieldConfig = useMemo(() => {
    const optimalDensity = densityFactor ?? getOptimalDensityFactor();
    return {
      ...DEFAULT_STARFIELD_CONFIG,
      layers: createEnhancedStarLayers(),
      galaxyWidth: Math.max(4000, width * 2),
      galaxyHeight: Math.max(4000, height * 2),
      densityFactor: optimalDensity,
    };
  }, [width, height, densityFactor]);

  // Generate all stars
  const allStars = useMemo(() => {
    return generateStarField(starFieldConfig);
  }, [starFieldConfig]);

  // Group stars by layer for efficient rendering
  const starsByLayer = useMemo(() => {
    const grouped = new Map<number, Star[]>();
    
    for (const star of allStars) {
      if (!grouped.has(star.layer)) {
        grouped.set(star.layer, []);
      }
      grouped.get(star.layer)!.push(star);
    }
    
    return grouped;
  }, [allStars]);

  // Calculate parallax offsets for each layer
  const parallaxOffsets = useMemo(() => {
    const offsets = new Map<number, Point2D>();
    
    for (const layer of starFieldConfig.layers) {
      const offset = enableParallax
        ? calculateParallaxOffset(
            { x: -viewportState.translateX, y: -viewportState.translateY },
            layer.parallaxFactor
          )
        : { x: 0, y: 0 };
      offsets.set(layer.id, offset);
    }
    
    return offsets;
  }, [viewportState.translateX, viewportState.translateY, starFieldConfig.layers, enableParallax]);

  return (
    <>
      {starFieldConfig.layers
        .sort((a, b) => a.id - b.id) // Render far layers first
        .map((layer) => {
          const layerStars = starsByLayer.get(layer.id) || [];
          const parallaxOffset = parallaxOffsets.get(layer.id) || { x: 0, y: 0 };

          return (
            <StarLayerRenderer
              key={layer.id}
              layer={layer}
              stars={layerStars}
              viewportState={viewportState}
              parallaxOffset={parallaxOffset}
              enableParallax={enableParallax}
            />
          );
        })}
    </>
  );
};

export default StarField;