import React, { useState, createContext, useContext, ReactNode } from 'react';
import { View, Dimensions } from 'react-native';
import { BaseOverlay } from './BaseOverlay';
import { BeaconDetailsOverlay } from './BeaconDetailsOverlay';
import { ProbeDetailsOverlay } from './ProbeDetailsOverlay';
import { QuickInfoOverlay } from './QuickInfoOverlay';
import { Beacon } from '../../types/galaxy';
import { ProbeInstance } from '../../types/probe';

// Overlay types and data interfaces
export type OverlayType =
  | 'beacon-details'
  | 'probe-details'
  | 'quick-info'
  | 'pattern-suggestion'
  | 'resource-tip';

export interface OverlayData {
  beacon?: Beacon;
  probe?: ProbeInstance;
  message?: string;
  title?: string;
  position?: { x: number; y: number };
}

export interface OverlayState {
  type: OverlayType | null;
  data: OverlayData | null;
  isVisible: boolean;
  zIndex: number;
}

// Overlay queue for managing multiple overlays
interface OverlayQueueItem {
  id: string;
  type: OverlayType;
  data: OverlayData;
  zIndex: number;
}

// Context for overlay management
interface OverlayContextType {
  activeOverlays: OverlayQueueItem[];
  showOverlay: (type: OverlayType, data?: OverlayData) => string; // returns overlay ID
  hideOverlay: (id?: string) => void; // if no ID provided, hides top overlay
  hideAllOverlays: () => void;
  updateOverlayData: (id: string, data: Partial<OverlayData>) => void;
}

const OverlayContext = createContext<OverlayContextType | null>(null);

export const useOverlay = () => {
  const context = useContext(OverlayContext);
  if (!context) {
    throw new Error('useOverlay must be used within an OverlayProvider');
  }
  return context;
};

// Overlay Provider component
interface OverlayProviderProps {
  children: ReactNode;
  gameController?: any; // Pass game controller for overlay operations
}

export const OverlayProvider: React.FC<OverlayProviderProps> = ({
  children,
  gameController,
}) => {
  const [activeOverlays, setActiveOverlays] = useState<OverlayQueueItem[]>([]);
  const [nextZIndex, setNextZIndex] = useState(1000);

  const showOverlay = (type: OverlayType, data: OverlayData = {}): string => {
    const overlayId = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newOverlay: OverlayQueueItem = {
      id: overlayId,
      type,
      data,
      zIndex: nextZIndex,
    };

    setActiveOverlays(prev => [...prev, newOverlay]);
    setNextZIndex(prev => prev + 1);

    return overlayId;
  };

  const hideOverlay = (id?: string) => {
    if (!id) {
      // Hide top overlay (last in array)
      setActiveOverlays(prev => prev.slice(0, -1));
    } else {
      // Hide specific overlay
      setActiveOverlays(prev => prev.filter(overlay => overlay.id !== id));
    }
  };

  const hideAllOverlays = () => {
    setActiveOverlays([]);
  };

  const updateOverlayData = (id: string, newData: Partial<OverlayData>) => {
    setActiveOverlays(prev =>
      prev.map(overlay =>
        overlay.id === id
          ? { ...overlay, data: { ...overlay.data, ...newData } }
          : overlay
      )
    );
  };

  const renderOverlay = (overlayItem: OverlayQueueItem) => {
    const { id, type, data, zIndex } = overlayItem;

    const handleClose = () => hideOverlay(id);

    const overlayProps = {
      isVisible: true,
      onClose: handleClose,
      gameController,
      zIndex,
    };

    switch (type) {
      case 'beacon-details':
        return (
          <BeaconDetailsOverlay
            key={id}
            {...overlayProps}
            beacon={data.beacon}
          />
        );

      case 'probe-details':
        return (
          <ProbeDetailsOverlay key={id} {...overlayProps} probe={data.probe} />
        );

      case 'quick-info':
        return (
          <QuickInfoOverlay
            key={id}
            {...overlayProps}
            title={data.title || 'Information'}
            message={data.message || ''}
          />
        );

      default:
        return null;
    }
  };

  return (
    <OverlayContext.Provider
      value={{
        activeOverlays,
        showOverlay,
        hideOverlay,
        hideAllOverlays,
        updateOverlayData,
      }}
    >
      {children}
      {/* Render all active overlays */}
      {activeOverlays.map(renderOverlay)}
    </OverlayContext.Provider>
  );
};

// Strategic Overlay Manager Hook - for convenient access to specific overlay types
export const useStrategicOverlays = () => {
  const { showOverlay, hideOverlay, hideAllOverlays } = useOverlay();

  return {
    // Beacon-related overlays
    showBeaconDetails: (beacon: Beacon) => {
      return showOverlay('beacon-details', { beacon });
    },

    // Probe-related overlays
    showProbeDetails: (probe: ProbeInstance) => {
      return showOverlay('probe-details', { probe });
    },

    // Info and help overlays
    showQuickInfo: (title: string, message: string) => {
      return showOverlay('quick-info', { title, message });
    },

    showPatternSuggestion: (
      message: string,
      position?: { x: number; y: number }
    ) => {
      return showOverlay('pattern-suggestion', {
        title: 'Pattern Suggestion',
        message,
        position,
      });
    },

    showResourceTip: (message: string) => {
      return showOverlay('resource-tip', {
        title: 'Resource Tip',
        message,
      });
    },

    // Generic controls
    hideOverlay,
    hideAllOverlays,
  };
};
