import { InteractionManager } from 'react-native';
import type { Beacon, GeometricPattern } from '../types/galaxy';
import type { ViewportState } from '../types/galaxy';
import type { PatternCompletionAnalysis } from '../types/spatialHashing';
import { PatternSuggestionEngine } from '../utils/patterns/PatternSuggestionEngine';

interface AnalysisRequest {
  id: string;
  beacons: Beacon[];
  viewport?: ViewportState;
  timestamp: number;
}

interface AnalysisCallback {
  onComplete: (analysis: PatternCompletionAnalysis) => void;
  onError: (error: Error) => void;
}

export class AsyncPatternAnalyzer {
  private suggestionEngine: PatternSuggestionEngine;
  private isProcessing = false;
  private pendingRequest: AnalysisRequest | null = null;
  private pendingCallback: AnalysisCallback | null = null;
  private placementCooldownTimeout: NodeJS.Timeout | null = null;
  private lastPlacementTime = 0;

  constructor(suggestionEngine: PatternSuggestionEngine) {
    this.suggestionEngine = suggestionEngine;
  }

  /**
   * Queue pattern analysis with proper async execution
   */
  public analyzeAsync(
    beacons: Beacon[],
    viewport?: ViewportState,
    cooldownMs = 500
  ): Promise<PatternCompletionAnalysis> {
    return new Promise((resolve, reject) => {
      // Cancel any existing request
      this.cancelPending();

      // Skip analysis for small networks
      if (beacons.length < 10) {
        resolve({
          suggestedPositions: [],
          incompletePatterns: [],
          optimalNextPlacement: null,
          totalPotentialBonus: 0,
          averageCompletionCost: 0,
        });
        return;
      }

      // Enforce placement cooldown
      const now = Date.now();
      if (now - this.lastPlacementTime < cooldownMs) {
        resolve({
          suggestedPositions: [],
          incompletePatterns: [],
          optimalNextPlacement: null,
          totalPotentialBonus: 0,
          averageCompletionCost: 0,
        });
        return;
      }

      // Create request
      const request: AnalysisRequest = {
        id: `analysis_${now}_${Math.random()}`,
        beacons: [...beacons], // Deep copy to avoid mutation
        viewport,
        timestamp: now,
      };

      this.pendingRequest = request;
      this.pendingCallback = {
        onComplete: resolve,
        onError: reject,
      };

      // Use triple deferral to ensure it runs after all UI updates
      this.clearCooldown();
      this.placementCooldownTimeout = setTimeout(() => {
        InteractionManager.runAfterInteractions(() => {
          // Use multiple RAF calls to ensure we're in a truly idle frame
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              this.executeAnalysis();
            });
          });
        });
      }, cooldownMs);

      this.lastPlacementTime = now;
    });
  }

  /**
   * Execute the analysis in the background
   */
  private executeAnalysis(): void {
    if (!this.pendingRequest || !this.pendingCallback || this.isProcessing) {
      return;
    }

    const request = this.pendingRequest;
    const callback = this.pendingCallback;

    this.isProcessing = true;

    try {
      // Update spatial index first
      this.suggestionEngine.updateSpatialIndex(request.beacons);

      // Perform the actual analysis
      const analysis = this.suggestionEngine.analyzePatternOpportunities(
        request.beacons,
        [],
        request.viewport ? { bounds: request.viewport.bounds } : undefined
      );

      // Complete the request if it's still current
      if (this.pendingRequest?.id === request.id) {
        callback.onComplete(analysis);
        this.clearPending();
      }
    } catch (error) {
      if (this.pendingRequest?.id === request.id) {
        callback.onError(
          error instanceof Error ? error : new Error(String(error))
        );
        this.clearPending();
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Cancel any pending analysis
   */
  public cancelPending(): void {
    this.clearCooldown();
    this.clearPending();
  }

  private clearPending(): void {
    this.pendingRequest = null;
    this.pendingCallback = null;
  }

  private clearCooldown(): void {
    if (this.placementCooldownTimeout) {
      clearTimeout(this.placementCooldownTimeout);
      this.placementCooldownTimeout = null;
    }
  }

  /**
   * Check if analysis is currently running
   */
  public get processing(): boolean {
    return this.isProcessing;
  }

  /**
   * Cleanup when component unmounts
   */
  public cleanup(): void {
    this.cancelPending();
  }
}
