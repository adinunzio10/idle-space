import React, { ReactNode, useState, useCallback } from 'react';
import { View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface FloatingPanel {
  id: string;
  content: ReactNode;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  size: 'small' | 'medium' | 'large' | 'full';
  transparent?: boolean;
  dismissible?: boolean;
  priority?: number; // Higher numbers appear above lower numbers
}

interface FloatingUIManagerProps {
  children?: ReactNode;
  onPanelChange?: (panels: FloatingPanel[]) => void;
}

export const FloatingUIManager: React.FC<FloatingUIManagerProps> = ({
  children,
  onPanelChange,
}) => {
  const insets = useSafeAreaInsets();
  const [panels, setPanels] = useState<FloatingPanel[]>([]);

  // Add panel
  const showPanel = useCallback((panel: FloatingPanel) => {
    setPanels(prev => {
      const existing = prev.find(p => p.id === panel.id);
      if (existing) {
        // Update existing panel
        const newPanels = prev.map(p => p.id === panel.id ? panel : p);
        onPanelChange?.(newPanels);
        return newPanels;
      } else {
        // Add new panel
        const newPanels = [...prev, panel].sort((a, b) => (b.priority || 0) - (a.priority || 0));
        onPanelChange?.(newPanels);
        return newPanels;
      }
    });
  }, [onPanelChange]);

  // Remove panel
  const hidePanel = useCallback((panelId: string) => {
    setPanels(prev => {
      const newPanels = prev.filter(p => p.id !== panelId);
      onPanelChange?.(newPanels);
      return newPanels;
    });
  }, [onPanelChange]);

  // Get positioning styles for a panel
  const getPanelPositionStyle = (panel: FloatingPanel): ViewStyle => {
    const baseStyle: ViewStyle = {
      position: 'absolute',
      zIndex: 1000 + (panel.priority || 0),
    };

    // Size configurations
    const getSizeStyle = (): ViewStyle => {
      switch (panel.size) {
        case 'small':
          return { width: '30%', maxHeight: '25%' };
        case 'medium':
          return { width: '60%', maxHeight: '40%' };
        case 'large':
          return { width: '80%', maxHeight: '60%' };
        case 'full':
          return { width: '100%', height: '100%' };
        default:
          return { width: '60%', maxHeight: '40%' };
      }
    };

    // Position configurations
    const getPositionStyle = (): ViewStyle => {
      switch (panel.position) {
        case 'top':
          return {
            top: insets.top + 20,
            left: '50%',
            marginLeft: '-30%', // Half of width for centering
          };
        case 'bottom':
          return {
            bottom: insets.bottom + 20,
            left: '50%',
            marginLeft: '-30%', // Half of width for centering
          };
        case 'left':
          return {
            left: 20,
            top: '50%',
            marginTop: '-20%', // Half of height for centering
          };
        case 'right':
          return {
            right: 20,
            top: '50%',
            marginTop: '-20%', // Half of height for centering
          };
        case 'center':
        default:
          return {
            left: '50%',
            top: '50%',
            marginLeft: '-30%', // Half of width for centering
            marginTop: '-20%', // Half of height for centering
          };
      }
    };

    return {
      ...baseStyle,
      ...getSizeStyle(),
      ...getPositionStyle(),
    };
  };

  // Get background style for a panel
  const getPanelBackgroundStyle = (panel: FloatingPanel): ViewStyle => {
    if (panel.transparent) {
      return {
        backgroundColor: 'transparent',
      };
    }

    return {
      backgroundColor: 'rgba(31, 41, 55, 0.95)', // bg-surface with transparency
      borderRadius: 16,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 8,
      },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 16,
    };
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Main content */}
      {children}
      
      {/* Floating panels */}
      {panels.map(panel => (
        <View
          key={panel.id}
          style={[
            getPanelPositionStyle(panel),
            getPanelBackgroundStyle(panel),
          ]}
        >
          <View style={{ flex: 1, padding: panel.transparent ? 0 : 16 }}>
            {panel.content}
          </View>
        </View>
      ))}
    </View>
  );
};

// Hook for using the FloatingUIManager
export const useFloatingUI = () => {
  const [managerRef, setManagerRef] = useState<{
    showPanel: (panel: FloatingPanel) => void;
    hidePanel: (panelId: string) => void;
  } | null>(null);

  const setManager = useCallback((showPanel: (panel: FloatingPanel) => void, hidePanel: (panelId: string) => void) => {
    setManagerRef({ showPanel, hidePanel });
  }, []);

  const showPanel = useCallback((panel: FloatingPanel) => {
    managerRef?.showPanel(panel);
  }, [managerRef]);

  const hidePanel = useCallback((panelId: string) => {
    managerRef?.hidePanel(panelId);
  }, [managerRef]);

  return {
    showPanel,
    hidePanel,
    setManager,
  };
};