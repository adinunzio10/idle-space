import { useCallback, useRef, useState } from 'react';
import { InteractionManager } from 'react-native';
import type { Beacon, Connection, GeometricPattern } from '../types/galaxy';
import { PatternDetector } from '../utils/patterns/detection';

export function useBackgroundPatternDetection() {
  const [patterns, setPatterns] = useState<GeometricPattern[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const patternDetectorRef = useRef<PatternDetector | null>(null);
  const pendingRequestRef = useRef<string | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize pattern detector lazily
  const getPatternDetector = useCallback(() => {
    if (!patternDetectorRef.current) {
      patternDetectorRef.current = new PatternDetector();
    }
    return patternDetectorRef.current;
  }, []);

  const detectPatternsAsync = useCallback(
    (beacons: Beacon[], connections: Connection[]) => {
      // Clear any pending debounce
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      // Debounce pattern detection to avoid excessive calculations
      debounceTimeoutRef.current = setTimeout(() => {
        // Cancel any pending request
        if (pendingRequestRef.current) {
          return; // Skip if already processing
        }

        const requestId = `pattern-${Date.now()}-${Math.random()}`;
        pendingRequestRef.current = requestId;
        setIsProcessing(true);

        // Use InteractionManager to defer heavy computation until after interactions
        InteractionManager.runAfterInteractions(() => {
          // Further defer to next frame to avoid blocking
          requestAnimationFrame(() => {
            try {
              const detector = getPatternDetector();
              const detectedPatterns = detector.detectPatternsOptimized(
                beacons,
                connections
              );

              // Only update if this request is still current
              if (pendingRequestRef.current === requestId) {
                setPatterns(detectedPatterns);
                setIsProcessing(false);
                pendingRequestRef.current = null;
              }
            } catch (error) {
              console.warn('Pattern detection error:', error);
              setIsProcessing(false);
              pendingRequestRef.current = null;
            }
          });
        });
      }, 100); // 100ms debounce
    },
    [getPatternDetector]
  );

  return {
    patterns,
    isProcessing,
    detectPatternsAsync,
    isWorkerAvailable: true, // Always available with this approach
  };
}
