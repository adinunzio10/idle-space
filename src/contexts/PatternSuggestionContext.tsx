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
  
  // Calculate real pattern count using PatternDetector
  const calculatePatternCount = useCallback((currentBeacons: Beacon[]): number => {
    console.log(`[PatternSuggestionContext] calculatePatternCount called with ${currentBeacons.length} beacons`);
    
    if (currentBeacons.length < 3) {
      console.log(`[PatternSuggestionContext] Not enough beacons for patterns (${currentBeacons.length} < 3)`);
      return 0;
    }
    
    try {
      // Build connections from beacon network
      const connections = buildConnectionsFromBeacons(currentBeacons);
      console.log(`[PatternSuggestionContext] Built ${connections.length} connections from ${currentBeacons.length} beacons`);
      
      const patterns = patternDetector.detectPatternsOptimized(currentBeacons, connections);
      console.log(`[PatternSuggestionContext] Detected ${patterns.length} patterns:`, patterns.map(p => ({ id: p.id, type: p.type, beacons: p.beaconIds })));
      
      // Special check for when we're reporting patterns but shouldn't
      if (patterns.length > 0 && currentBeacons.length < 3) {
        console.error(`[PatternSuggestionContext] ERROR: Detected ${patterns.length} patterns with only ${currentBeacons.length} beacons!`);
      }
      
      return patterns.length;
    } catch (error) {
      console.warn('Failed to detect patterns:', error);
      return 0;
    }
  }, [patternDetector]);
  
  // Update beacons and recalculate patterns
  const updateBeacons = useCallback((newBeacons: Beacon[]) => {
    console.log(`[PatternSuggestionContext] updateBeacons called with ${newBeacons.length} beacons`);
    setBeacons(newBeacons);
    const newPatternCount = calculatePatternCount(newBeacons);
    console.log(`[PatternSuggestionContext] Setting pattern count to ${newPatternCount}`);
    setPatternCount(newPatternCount);
  }, [calculatePatternCount]);
  
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
  
  // Initialize pattern count on mount and when beacons change
  useEffect(() => {
    console.log(`[PatternSuggestionContext] useEffect triggered with ${beacons.length} beacons`);
    if (beacons.length > 0) {
      console.log(`[PatternSuggestionContext] First beacon connections:`, beacons[0]?.connections);
    }
    const newPatternCount = calculatePatternCount(beacons);
    setPatternCount(newPatternCount);
  }, [beacons, calculatePatternCount]);
  
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

// Convenience hook for pattern count only
export const usePatternCount = () => {
  const { patternCount } = usePatternSuggestions();
  return patternCount;
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