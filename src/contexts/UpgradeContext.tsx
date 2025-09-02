import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { UpgradeManager } from '../core/UpgradeManager';
import { GameController } from '../core/GameController';

interface UpgradeContextType {
  upgradeManager: UpgradeManager | null;
  milestoneProgress: {
    currentBeacons: number;
    nextMilestone: any | null;
    progress: number; // 0-1
  };
  availableMilestone: any | null;

  // Actions
  purchaseUpgrade: (category: string) => Promise<boolean>;
  makeMilestoneChoice: (milestone: any, choice: string) => Promise<boolean>;
  getUpgradePreview: (category: string) => any | null;
  dismissMilestone: () => void;

  // State
  loading: boolean;
  error: string | null;
}

const UpgradeContext = createContext<UpgradeContextType | null>(null);

interface UpgradeProviderProps {
  children: ReactNode;
  gameController: GameController;
}

export const UpgradeProvider: React.FC<UpgradeProviderProps> = ({
  children,
  gameController,
}) => {
  const [upgradeManager, setUpgradeManager] = useState<UpgradeManager | null>(
    null
  );
  const [milestoneProgress, setMilestoneProgress] = useState({
    currentBeacons: 0,
    nextMilestone: null,
    progress: 0,
  });
  const [availableMilestone, setAvailableMilestone] = useState<any | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const manager = gameController.getUpgradeManager();
      setUpgradeManager(manager);
      setLoading(false);
    } catch (err) {
      console.error('[UpgradeContext] Failed to get UpgradeManager:', err);
      setError('Failed to initialize upgrade system');
      setLoading(false);
    }
  }, [gameController]);

  useEffect(() => {
    if (!upgradeManager || !gameController) return;

    const updateMilestoneProgress = () => {
      try {
        // For now, just set default values
        // This would need to be implemented based on actual beacon count
        setMilestoneProgress({
          currentBeacons: 0,
          nextMilestone: null,
          progress: 0,
        });

        setAvailableMilestone(null);
      } catch (err) {
        console.error(
          '[UpgradeContext] Error updating milestone progress:',
          err
        );
      }
    };

    // Update immediately and then every 5 seconds
    updateMilestoneProgress();
    const interval = setInterval(updateMilestoneProgress, 5000);

    return () => clearInterval(interval);
  }, [upgradeManager, gameController]);

  const purchaseUpgrade = async (category: string): Promise<boolean> => {
    if (!upgradeManager) return false;

    try {
      const resourceManager = gameController.getResourceManager();
      // This would need to match the actual UpgradeManager API
      // For now, return false as placeholder
      console.log(
        `[UpgradeContext] Purchase upgrade ${category} - not implemented`
      );
      return false;
    } catch (err) {
      console.error(
        `[UpgradeContext] Error purchasing ${category} upgrade:`,
        err
      );
      setError(`Failed to purchase ${category} upgrade`);
      return false;
    }
  };

  const makeMilestoneChoice = async (
    milestone: any,
    choice: string
  ): Promise<boolean> => {
    if (!upgradeManager) return false;

    try {
      console.log(`[UpgradeContext] Make milestone choice - not implemented`);
      return false;
    } catch (err) {
      console.error(`[UpgradeContext] Error completing milestone:`, err);
      setError('Failed to complete milestone');
      return false;
    }
  };

  const getUpgradePreview = (category: string): any | null => {
    if (!upgradeManager) return null;

    try {
      // Return a mock preview for now
      return {
        currentLevel: 0,
        cost: 100,
        currentValue: 1.0,
        newValue: 1.25,
        efficiencyScore: 0.8,
        recommendation: 'recommended' as const,
        paybackTime: 60,
      };
    } catch (err) {
      console.error(
        `[UpgradeContext] Error getting preview for ${category}:`,
        err
      );
      return null;
    }
  };

  const dismissMilestone = () => {
    setAvailableMilestone(null);
  };

  const contextValue: UpgradeContextType = {
    upgradeManager,
    milestoneProgress,
    availableMilestone,
    purchaseUpgrade,
    makeMilestoneChoice,
    getUpgradePreview,
    dismissMilestone,
    loading,
    error,
  };

  return (
    <UpgradeContext.Provider value={contextValue}>
      {children}
    </UpgradeContext.Provider>
  );
};

export const useUpgrades = (): UpgradeContextType => {
  const context = useContext(UpgradeContext);
  if (!context) {
    throw new Error('useUpgrades must be used within an UpgradeProvider');
  }
  return context;
};
