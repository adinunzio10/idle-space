/**
 * GalacticEnvironmentRenderer - Integrated Living Galactic Environment
 * 
 * Integrates all galactic environment systems into a single renderer that can be
 * easily added to GalaxyMapView. Combines star systems, sector boundaries, entropy
 * visualization, decay effects, and harvest overlays into a cohesive experience.
 */

import React, { useMemo, useState, useEffect } from 'react';
import { G } from 'react-native-svg';
import { StarSystem, GalacticSector, ViewportState, StarSystemState } from '../../types/galaxy';
import { SectorManager, createDefaultSectorManager } from '../../utils/spatial/SectorManager';
import { EntropySpreadManager, createDefaultEntropySpreadManager } from '../../utils/entropy/EntropySpreadManager';
import { TouchInteractionManager } from '../../utils/interactions/TouchInteractionManager';

// Import our implemented components
import { StarSystemComponent } from './StarSystem';
import { MultipleSectorBoundary } from './SectorBoundary';
import { MultiSectorEntropyVisualization } from './EntropyVisualization';
import { MultipleSectorDecayEffects } from './VisualDecayEffects';
import { MultipleHarvestOverlay } from './HarvestOverlay';

/**
 * Generate star systems distributed across galactic sectors
 */
function generateStarSystems(sectors: GalacticSector[], count: number = 75): StarSystem[] {
  const starSystems: StarSystem[] = [];
  
  // Distribute star systems across sectors
  for (let i = 0; i < count; i++) {
    const sector = sectors[Math.floor(Math.random() * sectors.length)];
    
    // Generate position within sector bounds
    const padding = 20; // Keep away from sector edges
    const x = sector.bounds.minX + padding + Math.random() * (sector.bounds.maxX - sector.bounds.minX - 2 * padding);
    const y = sector.bounds.minY + padding + Math.random() * (sector.bounds.maxY - sector.bounds.minY - 2 * padding);
    
    // Determine star state based on sector entropy
    let state: StarSystemState;
    let brightness: number;
    let resources: { stellarEssence?: number; voidFragments?: number } = {};
    
    if (sector.entropy < 0.3) {
      state = 'healthy';
      brightness = 0.8 + Math.random() * 0.2;
    } else if (sector.entropy < 0.7) {
      state = 'dying';
      brightness = 0.4 + Math.random() * 0.4;
      resources.stellarEssence = Math.floor(Math.random() * 10) + 5;
    } else {
      state = 'dead';
      brightness = 0.1 + Math.random() * 0.2;
      resources.voidFragments = Math.floor(Math.random() * 8) + 3;
    }
    
    starSystems.push({
      id: `star_${i}`,
      position: { x, y },
      state,
      radius: 8 + Math.random() * 12, // 8-20 radius
      brightness,
      resources,
      lastStateChange: Date.now() - Math.random() * 86400000, // Random within last 24h
      entropy: sector.entropy + (Math.random() - 0.5) * 0.2, // Slight variation from sector
    });
  }
  
  return starSystems;
}

export interface GalacticEnvironmentConfig {
  /** Enable star system rendering */
  enableStarSystems: boolean;
  /** Enable sector boundary rendering */
  enableSectorBoundaries: boolean;
  /** Enable entropy visualization */
  enableEntropyVisualization: boolean;
  /** Enable decay effects */
  enableDecayEffects: boolean;
  /** Enable harvest overlay */
  enableHarvestOverlay: boolean;
  /** Enable entropy spreading simulation */
  enableEntropySpread: boolean;
  /** Performance limits */
  performance: {
    maxStarSystems: number;
    maxSectors: number;
    maxDecayEffects: number;
    maxHarvestOverlays: number;
  };
}

export interface GalacticEnvironmentProps {
  /** Viewport state for rendering */
  viewportState: ViewportState;
  /** Configuration options */
  config?: Partial<GalacticEnvironmentConfig>;
  /** Star systems data (if external) */
  externalStarSystems?: StarSystem[];
  /** Sectors data (if external) */
  externalSectors?: GalacticSector[];
  /** Resource harvest callback */
  onResourceHarvest?: (starSystem: StarSystem, resourceType: 'stellarEssence' | 'voidFragments', amount: number) => void;
  /** Environment state change callback */
  onEnvironmentChange?: (stats: any) => void;
  /** Touch interaction callbacks */
  onTouchStart?: (x: number, y: number) => void;
  onTouchMove?: (x: number, y: number, deltaX: number, deltaY: number) => void;
  onTouchEnd?: () => void;
}

const DEFAULT_CONFIG: GalacticEnvironmentConfig = {
  enableStarSystems: true,
  enableSectorBoundaries: true,
  enableEntropyVisualization: true,
  enableDecayEffects: true,
  enableHarvestOverlay: true,
  enableEntropySpread: true,
  performance: {
    maxStarSystems: 200,
    maxSectors: 50,
    maxDecayEffects: 15,
    maxHarvestOverlays: 20,
  },
};

/**
 * Main galactic environment renderer
 */
export const GalacticEnvironmentRenderer: React.FC<GalacticEnvironmentProps> = ({
  viewportState,
  config: userConfig,
  externalStarSystems,
  externalSectors,
  onResourceHarvest,
  onEnvironmentChange,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}) => {
  const config = useMemo(() => ({ ...DEFAULT_CONFIG, ...userConfig }), [userConfig]);
  
  // Core managers
  const [sectorManager, setSectorManager] = useState<SectorManager | null>(null);
  const [entropySpreadManager, setEntropySpreadManager] = useState<EntropySpreadManager | null>(null);
  const [touchInteractionManager, setTouchInteractionManager] = useState<TouchInteractionManager | null>(null);
  
  // Environment state
  const [starSystems, setStarSystems] = useState<StarSystem[]>([]);
  const [sectors, setSectors] = useState<GalacticSector[]>([]);
  const [isOverlayActive, setIsOverlayActive] = useState(false);

  // Initialize managers and generate initial data
  useEffect(() => {
    // Initialize or use external sectors
    let initialSectors: GalacticSector[];
    let sectorMgr: SectorManager;

    if (externalSectors && externalSectors.length > 0) {
      initialSectors = externalSectors;
      // Create sector manager with existing sectors (would need constructor overload)
      sectorMgr = createDefaultSectorManager();
    } else {
      // Generate new sectors
      sectorMgr = createDefaultSectorManager();
      initialSectors = sectorMgr.getAllSectors();
    }

    setSectorManager(sectorMgr);
    setSectors(initialSectors);

    // Initialize entropy spread manager
    if (config.enableEntropySpread) {
      const entropyMgr = createDefaultEntropySpreadManager(initialSectors);
      entropyMgr.start();
      setEntropySpreadManager(entropyMgr);
    }

    // Generate or use external star systems
    let initialStarSystems: StarSystem[];
    if (externalStarSystems && externalStarSystems.length > 0) {
      initialStarSystems = externalStarSystems;
    } else {
      // Generate star systems using our sectors
      initialStarSystems = generateStarSystems(initialSectors, 75);
    }

    setStarSystems(initialStarSystems);

    // Initialize touch interaction manager
    const touchMgr = new TouchInteractionManager(initialStarSystems);
    
    // Set up harvest callback
    touchMgr.setHarvestCallback((result) => {
      if (result.success && result.newStarSystemState && onResourceHarvest) {
        onResourceHarvest(result.newStarSystemState, result.resourceType, result.amount);
        
        // Update local star systems
        setStarSystems(prev => 
          prev.map(s => s.id === result.starSystemId ? result.newStarSystemState! : s)
        );
      }
    });

    setTouchInteractionManager(touchMgr);

    // Cleanup on unmount
    return () => {
      if (entropySpreadManager) {
        entropySpreadManager.stop();
        entropySpreadManager.dispose();
      }
      if (touchMgr) {
        touchMgr.dispose();
      }
    };
  }, [externalStarSystems, externalSectors, config.enableEntropySpread, onResourceHarvest]);

  // Update entropy simulation and get updated sectors
  useEffect(() => {
    if (entropySpreadManager && config.enableEntropySpread) {
      const interval = setInterval(() => {
        const updatedSectors = entropySpreadManager.getUpdatedSectors();
        setSectors(updatedSectors);
        
        // Emit environment change stats
        if (onEnvironmentChange) {
          const stats = entropySpreadManager.getStatistics();
          onEnvironmentChange(stats);
        }
      }, 2000); // Update every 2 seconds

      return () => clearInterval(interval);
    }
  }, [entropySpreadManager, config.enableEntropySpread, onEnvironmentChange]);

  // Handle touch interactions
  useEffect(() => {
    if (touchInteractionManager) {
      // Set overlay active based on zoom level
      const newOverlayActive = viewportState.scale > 0.5;
      setIsOverlayActive(newOverlayActive);
    }
  }, [touchInteractionManager, viewportState.scale]);

  // Generate sector render info
  const sectorRenderInfo = useMemo(() => {
    if (!sectorManager) return new Map();
    
    return sectorManager.generateSectorRenderInfo(
      sectors,
      viewportState.scale,
      viewportState.bounds
    );
  }, [sectorManager, sectors, viewportState]);

  // Filter visible star systems for performance
  const visibleStarSystems = useMemo(() => {
    const viewportBounds = {
      minX: -viewportState.translateX / viewportState.scale,
      maxX: (-viewportState.translateX + 800) / viewportState.scale,
      minY: -viewportState.translateY / viewportState.scale,
      maxY: (-viewportState.translateY + 600) / viewportState.scale,
    };

    return starSystems
      .filter(star => {
        return star.position.x >= viewportBounds.minX - 100 &&
               star.position.x <= viewportBounds.maxX + 100 &&
               star.position.y >= viewportBounds.minY - 100 &&
               star.position.y <= viewportBounds.maxY + 100;
      })
      .slice(0, config.performance.maxStarSystems);
  }, [starSystems, viewportState, config.performance.maxStarSystems]);

  // Filter visible sectors for performance  
  const visibleSectors = useMemo(() => {
    const viewportBounds = {
      minX: -viewportState.translateX / viewportState.scale,
      maxX: (-viewportState.translateX + 800) / viewportState.scale,
      minY: -viewportState.translateY / viewportState.scale,
      maxY: (-viewportState.translateY + 600) / viewportState.scale,
    };

    return sectors
      .filter(sector => {
        return sector.bounds.minX < viewportBounds.maxX &&
               sector.bounds.maxX > viewportBounds.minX &&
               sector.bounds.minY < viewportBounds.maxY &&
               sector.bounds.maxY > viewportBounds.minY;
      })
      .slice(0, config.performance.maxSectors);
  }, [sectors, viewportState, config.performance.maxSectors]);

  // Create sector lookup map for decay effects
  const sectorMap = useMemo(() => {
    return new Map(sectors.map(s => [s.id, s]));
  }, [sectors]);

  // Touch event handlers
  const handleTouchStart = (x: number, y: number) => {
    if (touchInteractionManager && config.enableHarvestOverlay) {
      touchInteractionManager.handleTouchStart(x, y, viewportState);
    }
    if (onTouchStart) {
      onTouchStart(x, y);
    }
  };

  const handleTouchMove = (x: number, y: number, deltaX: number, deltaY: number) => {
    if (touchInteractionManager && config.enableHarvestOverlay) {
      touchInteractionManager.handleTouchMove(x, y, deltaX, deltaY);
    }
    if (onTouchMove) {
      onTouchMove(x, y, deltaX, deltaY);
    }
  };

  const handleTouchEnd = () => {
    if (touchInteractionManager && config.enableHarvestOverlay) {
      touchInteractionManager.handleTouchEnd();
    }
    if (onTouchEnd) {
      onTouchEnd();
    }
  };

  return (
    <G>
      {/* Entropy Visualization Layer (Background) */}
      {config.enableEntropyVisualization && (
        <MultiSectorEntropyVisualization
          sectors={visibleSectors}
          viewportState={viewportState}
          maxRenderCount={config.performance.maxSectors}
        />
      )}

      {/* Sector Boundaries Layer */}
      {config.enableSectorBoundaries && (
        <MultipleSectorBoundary
          sectors={visibleSectors}
          renderInfoMap={sectorRenderInfo}
          viewportState={viewportState}
          maxRenderedSectors={config.performance.maxSectors}
        />
      )}

      {/* Star Systems Layer */}
      {config.enableStarSystems && visibleStarSystems.map(starSystem => (
        <StarSystemComponent
          key={starSystem.id}
          starSystem={starSystem}
          renderInfo={{
            shouldRender: true,
            screenSize: starSystem.radius * viewportState.scale,
            lodLevel: viewportState.scale > 0.8 ? 2 : viewportState.scale > 0.3 ? 1 : 0,
            showAnimation: viewportState.scale > 0.3,
            showResources: viewportState.scale > 0.5,
            opacity: 1,
          }}
          viewportState={viewportState}
          onPress={config.enableHarvestOverlay ? (star) => {
            if (touchInteractionManager) {
              const screenX = star.position.x * viewportState.scale + viewportState.translateX;
              const screenY = star.position.y * viewportState.scale + viewportState.translateY;
              touchInteractionManager.handleTouchStart(screenX, screenY, viewportState);
              setTimeout(() => touchInteractionManager.handleTouchEnd(), 100);
            }
          } : undefined}
        />
      ))}

      {/* Decay Effects Layer */}
      {config.enableDecayEffects && (
        <MultipleSectorDecayEffects
          sectors={visibleSectors.filter(s => s.entropy > 0.6)}
          sectorMap={sectorMap}
          viewportState={viewportState}
          maxEffectSectors={config.performance.maxDecayEffects}
        />
      )}

      {/* Harvest Overlay Layer (Top) */}
      {config.enableHarvestOverlay && isOverlayActive && (
        <MultipleHarvestOverlay
          starSystems={visibleStarSystems}
          viewportState={viewportState}
          isOverlayActive={isOverlayActive}
          maxOverlays={config.performance.maxHarvestOverlays}
          onHarvest={(starSystem, resourceType) => {
            if (onResourceHarvest) {
              const harvestAmount = resourceType === 'stellarEssence' ? 5 : 3;
              onResourceHarvest(starSystem, resourceType, harvestAmount);
            }
          }}
        />
      )}
    </G>
  );
};

/**
 * Hook for managing galactic environment state externally
 */
export function useGalacticEnvironment(
  config?: Partial<GalacticEnvironmentConfig>
) {
  const [environmentStats, setEnvironmentStats] = useState<any>(null);
  const [harvestLog, setHarvestLog] = useState<Array<{
    starSystemId: string;
    resourceType: string;
    amount: number;
    timestamp: number;
  }>>([]);

  const handleEnvironmentChange = (stats: any) => {
    setEnvironmentStats(stats);
  };

  const handleResourceHarvest = (
    starSystem: StarSystem, 
    resourceType: 'stellarEssence' | 'voidFragments', 
    amount: number
  ) => {
    setHarvestLog(prev => [
      ...prev.slice(-19), // Keep last 20 entries
      {
        starSystemId: starSystem.id,
        resourceType,
        amount,
        timestamp: Date.now(),
      }
    ]);
  };

  return {
    environmentStats,
    harvestLog,
    handleEnvironmentChange,
    handleResourceHarvest,
  };
}

export default GalacticEnvironmentRenderer;