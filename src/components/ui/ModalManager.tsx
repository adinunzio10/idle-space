import React, { useState, createContext, useContext, ReactNode } from 'react';
import { BaseModal } from './BaseModal';
import { BeaconDetailsModal } from './BeaconDetailsModal';
import { ProbeDetailsModal } from './ProbeDetailsModal';
import { QuickInfoModal } from './QuickInfoModal';
import { Beacon } from '../../types/galaxy';
import { ProbeInstance } from '../../types/probe';

// Modal types and data interfaces
export type ModalType = 
  | 'beacon-details'
  | 'probe-details'
  | 'quick-info'
  | 'pattern-suggestion'
  | 'resource-tip';

export interface ModalData {
  beacon?: Beacon;
  probe?: ProbeInstance;
  message?: string;
  title?: string;
  position?: { x: number; y: number };
}

export interface ModalState {
  type: ModalType | null;
  data: ModalData | null;
  isVisible: boolean;
}

// Context for modal management
interface ModalContextType {
  modalState: ModalState;
  showModal: (type: ModalType, data?: ModalData) => void;
  hideModal: () => void;
  updateModalData: (data: Partial<ModalData>) => void;
}

const ModalContext = createContext<ModalContextType | null>(null);

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};

// Modal Provider component
interface ModalProviderProps {
  children: ReactNode;
  gameController?: any; // Pass game controller for modal operations
}

export const ModalProvider: React.FC<ModalProviderProps> = ({ 
  children, 
  gameController 
}) => {
  const [modalState, setModalState] = useState<ModalState>({
    type: null,
    data: null,
    isVisible: false
  });

  const showModal = (type: ModalType, data: ModalData = {}) => {
    setModalState({
      type,
      data,
      isVisible: true
    });
  };

  const hideModal = () => {
    setModalState(prev => ({
      ...prev,
      isVisible: false
    }));
    
    // Clear modal data after animation completes
    setTimeout(() => {
      setModalState({
        type: null,
        data: null,
        isVisible: false
      });
    }, 300);
  };

  const updateModalData = (newData: Partial<ModalData>) => {
    setModalState(prev => ({
      ...prev,
      data: prev.data ? { ...prev.data, ...newData } : newData
    }));
  };

  const renderModal = () => {
    if (!modalState.type || !modalState.isVisible) {
      return null;
    }

    switch (modalState.type) {
      case 'beacon-details':
        return (
          <BeaconDetailsModal
            isVisible={modalState.isVisible}
            beacon={modalState.data?.beacon}
            onClose={hideModal}
            gameController={gameController}
          />
        );

      case 'probe-details':
        return (
          <ProbeDetailsModal
            isVisible={modalState.isVisible}
            probe={modalState.data?.probe}
            onClose={hideModal}
            gameController={gameController}
          />
        );

      case 'quick-info':
        return (
          <QuickInfoModal
            isVisible={modalState.isVisible}
            title={modalState.data?.title || 'Information'}
            message={modalState.data?.message || ''}
            onClose={hideModal}
          />
        );

      default:
        return null;
    }
  };

  return (
    <ModalContext.Provider
      value={{
        modalState,
        showModal,
        hideModal,
        updateModalData
      }}
    >
      {children}
      {renderModal()}
    </ModalContext.Provider>
  );
};

// Strategic Modal Manager Hook - for convenient access to specific modal types
export const useStrategicModals = () => {
  const { showModal, hideModal } = useModal();

  return {
    // Beacon-related modals
    showBeaconDetails: (beacon: Beacon) => {
      showModal('beacon-details', { beacon });
    },

    // Probe-related modals  
    showProbeDetails: (probe: ProbeInstance) => {
      showModal('probe-details', { probe });
    },

    // Info and help modals
    showQuickInfo: (title: string, message: string) => {
      showModal('quick-info', { title, message });
    },

    showPatternSuggestion: (message: string, position?: { x: number; y: number }) => {
      showModal('pattern-suggestion', { 
        title: 'Pattern Suggestion', 
        message, 
        position 
      });
    },

    showResourceTip: (message: string) => {
      showModal('resource-tip', { 
        title: 'Resource Tip', 
        message 
      });
    },

    // Generic close
    hideModal
  };
};