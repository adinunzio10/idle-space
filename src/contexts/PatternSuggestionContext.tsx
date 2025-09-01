import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from 'react';
import { Beacon } from '../types/galaxy';
import { 
  PatternSuggestion, 
  PatternSuggestionState, 
  SuggestionInteractionEvent,
  PatternCompletionAnalysis 
} from '../types/spatialHashing';
import { PatternDetector, buildConnectionsFromBeacons } from '../utils/patterns/detection';

interface PatternSuggestionContextValue {
  // State
  patternCount: number;
  mapVisualizationsVisible: boolean;
  popupVisible: boolean;
  selectedSuggestion: PatternSuggestion | null;
  hoveredSuggestion: PatternSuggestion | null;
  dismissedSuggestions: Set<string>;
  displayMode: PatternSuggestionState['displayMode'];
  suggestions: PatternSuggestion[];
  
  // Actions
  showPopup: () => void;
  hidePopup: () => void;
  showMapVisualizations: () => void;
  hideMapVisualizations: () => void;
  toggleMapVisualizations: () => void;
  selectSuggestion: (suggestion: PatternSuggestion | null) => void;
  hoverSuggestion: (suggestion: PatternSuggestion | null) => void;
  dismissSuggestion: (suggestionId: string) => void;
  setDisplayMode: (mode: PatternSuggestionState['displayMode']) => void;
  
  // Internal methods for updating beacons and calculating patterns
  updateBeacons: (beacons: Beacon[]) => void;
  onSuggestionInteraction: (event: SuggestionInteractionEvent) => void;
}

const PatternSuggestionContext = createContext<PatternSuggestionContextValue | null>(null);

interface PatternSuggestionProviderProps {
  children: ReactNode;
  initialBeacons?: Beacon[];
}

export const PatternSuggestionProvider: React.FC<PatternSuggestionProviderProps> = ({ 
  children, 
  initialBeacons = [] 
}) => {
  // Core suggestion state
  const [suggestionState, setSuggestionState] = useState<PatternSuggestionState>({
    popupVisible: false,
    mapVisualizationsVisible: true,
    selectedSuggestion: null,
    hoveredSuggestion: null,
    dismissedSuggestions: new Set(),
    autoHideTimer: null,
    displayMode: 'best',
  });
  
  // Beacon tracking for pattern calculation
  const [beacons, setBeacons] = useState<Beacon[]>(initialBeacons);
  const [patternCount, setPatternCount] = useState<number>(0);
  const [suggestions, setSuggestions] = useState<PatternSuggestion[]>([]);
  
  // Pattern detector instance - memoized to prevent recreation
  const patternDetector = useMemo(() => new PatternDetector(), []);
  
  // Calculate pattern suggestion count using PatternDetector's suggestion engine
  const calculatePatternCount = useCallback((currentBeacons: Beacon[]): number => {
    // Need at least 2 beacons to have suggestions for completing patterns
    if (currentBeacons.length < 2) {
      return 0;
    }
    
    try {
      // Get pattern suggestions instead of completed patterns
      const suggestions = patternDetector.getPatternSuggestions(currentBeacons);
      
      return suggestions.length;
    } catch (error) {
      console.warn('Failed to get pattern suggestions:', error);
      return 0;
    }
  }, [patternDetector]);
  
  // Update beacons and recalculate pattern suggestions
  const updateBeacons = useCallback((newBeacons: Beacon[]) => {
    setBeacons(newBeacons);
    
    // Calculate pattern suggestions
    const newPatternCount = calculatePatternCount(newBeacons);
    setPatternCount(newPatternCount);
    
    // Also update the suggestions array for the UI
    try {
      const newSuggestions = patternDetector.getPatternSuggestions(newBeacons);
      setSuggestions(newSuggestions);
    } catch (error) {
      console.warn('Failed to update suggestions array:', error);
      setSuggestions([]);
    }
  }, [calculatePatternCount, patternDetector]);
  
  // Pattern suggestion actions
  const actions = useMemo(() => ({
    showPopup: () => setSuggestionState(s => ({ ...s, popupVisible: true })),
    hidePopup: () => setSuggestionState(s => ({ ...s, popupVisible: false })),
    showMapVisualizations: () => setSuggestionState(s => ({ ...s, mapVisualizationsVisible: true })),
    hideMapVisualizations: () => setSuggestionState(s => ({ ...s, mapVisualizationsVisible: false })),
    toggleMapVisualizations: () => setSuggestionState(s => ({ ...s, mapVisualizationsVisible: !s.mapVisualizationsVisible })),
    selectSuggestion: (suggestion: PatternSuggestion | null) => 
      setSuggestionState(s => ({ ...s, selectedSuggestion: suggestion })),
    hoverSuggestion: (suggestion: PatternSuggestion | null) => 
      setSuggestionState(s => ({ ...s, hoveredSuggestion: suggestion })),
    dismissSuggestion: (suggestionId: string) => 
      setSuggestionState(s => ({ 
        ...s, 
        dismissedSuggestions: new Set([...s.dismissedSuggestions, suggestionId]) 
      })),
    setDisplayMode: (mode: PatternSuggestionState['displayMode']) => 
      setSuggestionState(s => ({ ...s, displayMode: mode })),
  }), []);
  
  // Handle suggestion interactions
  const onSuggestionInteraction = useCallback((event: SuggestionInteractionEvent) => {
    switch (event.type) {
      case 'select':
        actions.selectSuggestion(event.suggestion);
        break;
      case 'dismiss':
        actions.dismissSuggestion(event.suggestion.id);
        break;
      case 'hover':
        actions.hoverSuggestion(event.suggestion);
        break;
    }
  }, [actions]);
  
  // Initialize pattern suggestion count on mount and when beacons change
  useEffect(() => {
    const newPatternCount = calculatePatternCount(beacons);
    setPatternCount(newPatternCount);
    
    // Also update suggestions array
    try {
      const newSuggestions = patternDetector.getPatternSuggestions(beacons);
      setSuggestions(newSuggestions);
    } catch (error) {
      console.warn('Failed to initialize suggestions array:', error);
      setSuggestions([]);
    }
  }, [beacons, calculatePatternCount, patternDetector]);
  
  const contextValue: PatternSuggestionContextValue = {
    // State
    patternCount,
    mapVisualizationsVisible: suggestionState.mapVisualizationsVisible,
    popupVisible: suggestionState.popupVisible,
    selectedSuggestion: suggestionState.selectedSuggestion,
    hoveredSuggestion: suggestionState.hoveredSuggestion,
    dismissedSuggestions: suggestionState.dismissedSuggestions,
    displayMode: suggestionState.displayMode,
    suggestions,
    
    // Actions
    ...actions,
    
    // Internal methods
    updateBeacons,
    onSuggestionInteraction,
  };

  return (
    <PatternSuggestionContext.Provider value={contextValue}>
      {children}
    </PatternSuggestionContext.Provider>
  );
};

export const usePatternSuggestions = (): PatternSuggestionContextValue => {
  const context = useContext(PatternSuggestionContext);
  if (!context) {
    throw new Error('usePatternSuggestions must be used within a PatternSuggestionProvider');
  }
  return context;
};

// Convenience hook for pattern suggestion count only
export const usePatternCount = () => {
  const { patternCount } = usePatternSuggestions();
  return patternCount; // This is actually the count of pattern suggestions, not completed patterns
};

// Convenience hook for pattern visibility controls
export const usePatternVisibility = () => {
  const { 
    mapVisualizationsVisible, 
    popupVisible,
    showMapVisualizations, 
    hideMapVisualizations, 
    toggleMapVisualizations,
    showPopup,
    hidePopup
  } = usePatternSuggestions();
  
  return {
    mapVisualizationsVisible,
    popupVisible,
    showMapVisualizations,
    hideMapVisualizations,
    toggleMapVisualizations,
    showPopup,
    hidePopup,
  };
};

// Hook for suggestion interactions
export const usePatternSuggestionActions = () => {
  const {
    selectSuggestion,
    hoverSuggestion,
    dismissSuggestion,
    setDisplayMode,
    onSuggestionInteraction,
  } = usePatternSuggestions();
  
  return {
    selectSuggestion,
    hoverSuggestion,
    dismissSuggestion,
    setDisplayMode,
    onSuggestionInteraction,
  };
};