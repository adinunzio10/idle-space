import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ProbeInstance } from '../types/probe';

interface ProbeBackgroundData {
  probeQueue: {
    id: string;
    type: 'pioneer' | 'harvester' | 'architect';
    targetPosition: { x: number; y: number };
    deploymentStartedAt: number;
    deploymentTime: number;
    accelerationBonus: number;
  }[];
  lastProcessedAt: number;
}

/**
 * Service class for managing probe background processing and automated launch timer system
 */
export class ProbeBackgroundService {
  private static instance: ProbeBackgroundService | null = null;
  private isRegistered = false;
  private backgroundInterval: NodeJS.Timeout | null = null;

  static getInstance(): ProbeBackgroundService {
    if (!ProbeBackgroundService.instance) {
      ProbeBackgroundService.instance = new ProbeBackgroundService();
    }
    return ProbeBackgroundService.instance;
  }

  /**
   * Initialize background processing capabilities
   */
  async registerBackgroundTask(): Promise<void> {
    if (this.isRegistered) return;

    try {
      // For now, we'll focus on persistent storage and foreground processing
      // Background task execution can be added later if needed
      this.isRegistered = true;
      console.log('[ProbeBackgroundService] Background processing capabilities initialized');
    } catch (error) {
      console.error('[ProbeBackgroundService] Failed to initialize background processing:', error);
    }
  }

  /**
   * Cleanup background processing
   */
  async unregisterBackgroundTask(): Promise<void> {
    if (!this.isRegistered) return;

    try {
      this.isRegistered = false;
      console.log('[ProbeBackgroundService] Background processing cleaned up');
    } catch (error) {
      console.error('[ProbeBackgroundService] Failed to cleanup background processing:', error);
    }
  }

  /**
   * Start foreground processing interval
   */
  startForegroundProcessing(): void {
    if (this.backgroundInterval) return;

    // Process probes every second when app is in foreground
    this.backgroundInterval = setInterval(async () => {
      await this.processPendingProbes();
    }, 1000);

    console.log('[ProbeBackgroundService] Foreground processing started');
  }

  /**
   * Stop foreground processing interval
   */
  stopForegroundProcessing(): void {
    if (this.backgroundInterval) {
      clearInterval(this.backgroundInterval);
      this.backgroundInterval = null;
      console.log('[ProbeBackgroundService] Foreground processing stopped');
    }
  }

  /**
   * Sync current probe queue to persistent storage for background processing
   */
  async syncProbeQueue(activeProbes?: ProbeInstance[]): Promise<void> {
    try {
      if (!activeProbes) {
        // If no probes provided, we'll sync empty data
        const probeData: ProbeBackgroundData = {
          probeQueue: [],
          lastProcessedAt: Date.now(),
        };
        await persistProbeData(probeData);
        return;
      }

      // Convert active probes to background-processable format
      const backgroundProbes = activeProbes
        .filter((probe: ProbeInstance) => probe.status === 'launching' && probe.deploymentStartedAt)
        .map((probe: ProbeInstance) => ({
          id: probe.id,
          type: probe.type,
          targetPosition: probe.targetPosition,
          deploymentStartedAt: probe.deploymentStartedAt!,
          deploymentTime: 30, // Default deployment time, will be overridden by actual config
          accelerationBonus: probe.accelerationBonus,
        }));

      const probeData: ProbeBackgroundData = {
        probeQueue: backgroundProbes,
        lastProcessedAt: Date.now(),
      };

      await persistProbeData(probeData);
      console.log(`[ProbeBackgroundService] Synced ${backgroundProbes.length} probes to background storage`);
    } catch (error) {
      console.error('[ProbeBackgroundService] Failed to sync probe queue:', error);
    }
  }

  /**
   * Process any probes that completed while app was backgrounded
   */
  async processBackgroundCompletions(): Promise<string[]> {
    try {
      const probeData = await getPersistedProbeData();
      if (!probeData) return [];

      const now = Date.now();
      const completedProbeIds: string[] = [];

      // Check which background probes should have completed
      for (const bgProbe of probeData.probeQueue) {
        const adjustedDeploymentTime = (bgProbe.deploymentTime * 1000) / bgProbe.accelerationBonus;
        const elapsedSinceStart = now - bgProbe.deploymentStartedAt;

        if (elapsedSinceStart >= adjustedDeploymentTime) {
          completedProbeIds.push(bgProbe.id);
        }
      }

      if (completedProbeIds.length > 0) {
        // Remove completed probes from background storage
        probeData.probeQueue = probeData.probeQueue.filter(
          (probe) => !completedProbeIds.includes(probe.id)
        );
        await persistProbeData(probeData);

        console.log(`[ProbeBackgroundService] Processed ${completedProbeIds.length} background completions`);
      }

      return completedProbeIds;
    } catch (error) {
      console.error('[ProbeBackgroundService] Error processing background completions:', error);
      return [];
    }
  }

  /**
   * Process pending probes (foreground processing)
   */
  private async processPendingProbes(): Promise<void> {
    // This method is called by the foreground interval
    // The actual probe processing logic remains in ProbeManager
    // This just ensures sync with background storage
    await this.syncProbeQueue();
  }
}

/**
 * Persist probe data to AsyncStorage for background processing
 */
async function persistProbeData(data: ProbeBackgroundData): Promise<void> {
  try {
    await AsyncStorage.setItem('@probe_background_data', JSON.stringify(data));
  } catch (error) {
    console.error('[ProbeBackgroundService] Failed to persist probe data:', error);
  }
}

/**
 * Retrieve persisted probe data from AsyncStorage
 */
async function getPersistedProbeData(): Promise<ProbeBackgroundData | null> {
  try {
    const data = await AsyncStorage.getItem('@probe_background_data');
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('[ProbeBackgroundService] Failed to retrieve probe data:', error);
    return null;
  }
}