import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { ResourceManager, ResourceState, ResourceType, ResourceModifier } from './ResourceManager';
import BigNumber from 'bignumber.js';

interface ResourceContextValue {
  resources: ResourceState;
  addResource: (type: ResourceType, amount: BigNumber | number) => void;
  subtractResource: (type: ResourceType, amount: BigNumber | number) => boolean;
  canAfford: (costs: Partial<Record<ResourceType, BigNumber | number>>) => boolean;
  spendResources: (costs: Partial<Record<ResourceType, BigNumber | number>>) => boolean;
  formatResourceValue: (value: BigNumber, precision?: number) => string;
  addModifier: (modifier: ResourceModifier) => void;
  removeModifier: (modifierId: string) => void;
  getActiveModifiers: (resourceType?: ResourceType) => ResourceModifier[];
}

const ResourceContext = createContext<ResourceContextValue | null>(null);

interface ResourceProviderProps {
  children: ReactNode;
}

export const ResourceProvider: React.FC<ResourceProviderProps> = ({ children }) => {
  const [resourceManager] = useState(() => ResourceManager.getInstance());
  const [resources, setResources] = useState<ResourceState>(() => resourceManager.getResources());

  useEffect(() => {
    const handleResourceChange = (newResources: ResourceState) => {
      setResources(newResources);
    };

    resourceManager.setOnResourceChange(handleResourceChange);

    // Cleanup function
    return () => {
      resourceManager.setOnResourceChange(() => {});
    };
  }, [resourceManager]);

  const addResource = useCallback((type: ResourceType, amount: BigNumber | number) => {
    resourceManager.addResource(type, amount);
  }, [resourceManager]);

  const subtractResource = useCallback((type: ResourceType, amount: BigNumber | number): boolean => {
    return resourceManager.subtractResource(type, amount);
  }, [resourceManager]);

  const canAfford = useCallback((costs: Partial<Record<ResourceType, BigNumber | number>>): boolean => {
    return resourceManager.canAfford(costs);
  }, [resourceManager]);

  const spendResources = useCallback((costs: Partial<Record<ResourceType, BigNumber | number>>): boolean => {
    return resourceManager.spendResources(costs);
  }, [resourceManager]);

  const formatResourceValue = useCallback((value: BigNumber, precision?: number): string => {
    return resourceManager.formatResourceValue(value, precision);
  }, [resourceManager]);

  const addModifier = useCallback((modifier: ResourceModifier) => {
    resourceManager.addModifier(modifier);
  }, [resourceManager]);

  const removeModifier = useCallback((modifierId: string) => {
    resourceManager.removeModifier(modifierId);
  }, [resourceManager]);

  const getActiveModifiers = useCallback((resourceType?: ResourceType): ResourceModifier[] => {
    return resourceManager.getActiveModifiers(resourceType);
  }, [resourceManager]);

  const contextValue: ResourceContextValue = {
    resources,
    addResource,
    subtractResource,
    canAfford,
    spendResources,
    formatResourceValue,
    addModifier,
    removeModifier,
    getActiveModifiers,
  };

  return (
    <ResourceContext.Provider value={contextValue}>
      {children}
    </ResourceContext.Provider>
  );
};

export const useResources = (): ResourceContextValue => {
  const context = useContext(ResourceContext);
  if (!context) {
    throw new Error('useResources must be used within a ResourceProvider');
  }
  return context;
};

// Convenience hook for specific resource types
export const useResource = (type: ResourceType) => {
  const { resources, addResource, subtractResource } = useResources();
  
  return {
    value: resources[type],
    add: (amount: BigNumber | number) => addResource(type, amount),
    subtract: (amount: BigNumber | number) => subtractResource(type, amount),
  };
};

// Hook for resource formatting
export const useResourceFormatter = () => {
  const { formatResourceValue } = useResources();
  return formatResourceValue;
};

// Hook for resource spending
export const useResourceSpending = () => {
  const { canAfford, spendResources } = useResources();
  return { canAfford, spend: spendResources };
};