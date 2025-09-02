import { Point2D } from '../types/galaxy';
import { ResourceManager } from './ResourceManager';
import { 
  ProbeType, 
  ProbeConfig, 
  ProbeInstance, 
  ProbeQueueItem,
  ProbeDeploymentResult,
  PROBE_TYPE_CONFIG 
} from '../types/probe';
import { ProbeBackgroundService } from './ProbeBackgroundService';

export class ProbeManager {
  private static instance: ProbeManager | null = null;
  private resourceManager: ResourceManager;
  private probeQueue: ProbeQueueItem[] = [];
  private activeProbes: Map<string, ProbeInstance> = new Map();
  private onProbeUpdateCallbacks: ((probes: ProbeInstance[]) => void)[] = [];
  private onProbeDeployedCallbacks: ((probe: ProbeInstance) => void)[] = [];
  private deploymentTimer: NodeJS.Timeout | null = null;
  private backgroundService: ProbeBackgroundService;
  private maxSimultaneousLaunches: number = 3; // Allow multiple simultaneous probe launches
  private deployedProbeIds: Set<string> = new Set(); // Track probes that have already fired deployment callbacks

  // Use shared probe configuration from types

  private constructor() {
    this.resourceManager = ResourceManager.getInstance();
    this.backgroundService = ProbeBackgroundService.getInstance();
  }

  static getInstance(): ProbeManager {
    if (!ProbeManager.instance) {
      ProbeManager.instance = new ProbeManager();
    }
    return ProbeManager.instance;
  }

  /**
   * Get probe configuration for a specific type
   */
  getProbeConfig(type: ProbeType): ProbeConfig {
    return PROBE_TYPE_CONFIG[type];
  }

  /**
   * Get all available probe types with their configs
   */
  getAvailableProbeTypes(): Record<ProbeType, ProbeConfig> {
    return { ...PROBE_TYPE_CONFIG };
  }

  /**
   * Check if player can afford to launch a probe of the given type
   * NOTE: Probes are now free (time-gated only), so always return true
   */
  canAffordProbe(type: ProbeType): boolean {
    // Probes no longer have resource costs - only time constraints
    return true;
  }

  /**
   * Queue a probe for launch
   */
  queueProbe(type: ProbeType, targetPosition: Point2D, priority: number = 1, startPosition: Point2D = { x: 0, y: 0 }, isManual: boolean = false): ProbeDeploymentResult {
    const config = this.getProbeConfig(type);

    // No resource validation needed - probes are now free (time-gated only)
    
    // Create probe instance
    const probe: ProbeInstance = {
      id: `probe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      status: 'queued',
      startPosition,
      targetPosition,
      createdAt: Date.now(),
      travelProgress: 0,
      accelerationBonus: isManual ? 2.0 : 1,
    };

    // Add to queue
    const queueItem: ProbeQueueItem = { probe, priority };
    this.probeQueue.push(queueItem);
    
    // Sort queue by priority (higher priority first)
    this.probeQueue.sort((a, b) => b.priority - a.priority);

    // Start processing queue if not already running
    this.startQueueProcessing();

    this.notifyProbeUpdate();

    console.log(`[ProbeManager] Queued ${type} probe to (${targetPosition.x}, ${targetPosition.y})`);
    return { success: true, probe };
  }


  /**
   * Get current queue status
   */
  getQueueStatus(): {
    queuedProbes: ProbeInstance[];
    activeProbes: ProbeInstance[];
    totalProbes: number;
  } {
    const queuedProbes = this.probeQueue.map(item => item.probe);
    const activeProbes = Array.from(this.activeProbes.values());

    return {
      queuedProbes,
      activeProbes,
      totalProbes: queuedProbes.length + activeProbes.length,
    };
  }

  /**
   * Get probe by ID
   */
  getProbe(probeId: string): ProbeInstance | null {
    // Check active probes first
    const activeProbe = this.activeProbes.get(probeId);
    if (activeProbe) return activeProbe;

    // Check queue
    const queuedProbe = this.probeQueue.find(item => item.probe.id === probeId);
    return queuedProbe?.probe || null;
  }

  /**
   * Register callback for probe updates
   */
  addProbeUpdateCallback(callback: (probes: ProbeInstance[]) => void): () => void {
    console.log('[ProbeManager] addProbeUpdateCallback registered');
    this.onProbeUpdateCallbacks.push(callback);
    
    // Return cleanup function
    return () => {
      const index = this.onProbeUpdateCallbacks.indexOf(callback);
      if (index > -1) {
        this.onProbeUpdateCallbacks.splice(index, 1);
        console.log('[ProbeManager] Probe update callback removed');
      }
    };
  }

  /**
   * Register callback for probe deployment completion
   */
  addProbeDeployedCallback(callback: (probe: ProbeInstance) => void): () => void {
    console.log('[ProbeManager] addProbeDeployedCallback registered');
    this.onProbeDeployedCallbacks.push(callback);
    
    // Return cleanup function
    return () => {
      const index = this.onProbeDeployedCallbacks.indexOf(callback);
      if (index > -1) {
        this.onProbeDeployedCallbacks.splice(index, 1);
        console.log('[ProbeManager] Probe deployed callback removed');
      }
    };
  }

  /**
   * @deprecated Use addProbeUpdateCallback instead
   * Legacy method for backward compatibility
   */
  setOnProbeUpdate(callback: (probes: ProbeInstance[]) => void): void {
    console.warn('[ProbeManager] setOnProbeUpdate is deprecated, use addProbeUpdateCallback instead');
    this.addProbeUpdateCallback(callback);
  }

  /**
   * @deprecated Use addProbeDeployedCallback instead
   * Legacy method for backward compatibility
   */
  setOnProbeDeployed(callback: (probe: ProbeInstance) => void): void {
    console.warn('[ProbeManager] setOnProbeDeployed is deprecated, use addProbeDeployedCallback instead');
    this.addProbeDeployedCallback(callback);
  }

  /**
   * Initialize the probe manager with background processing
   */
  async initialize(): Promise<void> {
    try {
      // Register background task for probe processing
      await this.backgroundService.registerBackgroundTask();
      
      // Process any probes that completed while app was closed
      const completedProbeIds = await this.backgroundService.processBackgroundCompletions();
      
      // Mark completed probes in our active probes
      for (const probeId of completedProbeIds) {
        const probe = this.activeProbes.get(probeId);
        if (probe) {
          const deployedProbe = {
            ...probe,
            status: 'deployed' as const,
            deploymentCompletedAt: Date.now(),
            travelProgress: 1
          };
          this.activeProbes.set(probeId, deployedProbe);
          this.deployedProbeIds.add(probeId); // Mark as deployed to prevent duplicate callbacks
        }
      }
      
      // Start foreground processing
      this.backgroundService.startForegroundProcessing();
      
      // Start the probe queue processing
      this.startQueueProcessing();
      
      console.log('[ProbeManager] Initialized with background processing');
    } catch (error) {
      console.error('[ProbeManager] Failed to initialize:', error);
    }
  }

  /**
   * Start the automated queue processing system
   */
  private startQueueProcessing(): void {
    if (this.deploymentTimer) return; // Already running

    this.deploymentTimer = setInterval(() => {
      this.processQueue();
      this.updateActiveProbes();
    }, 100); // Process every 100ms for smoother animation

    console.log('[ProbeManager] Queue processing started');
  }

  /**
   * Process the probe queue - enhanced to support multiple simultaneous launches
   */
  private processQueue(): void {
    // Early exit if nothing to process
    if (this.probeQueue.length === 0 && this.activeProbes.size === 0) {
      return;
    }

    // Count currently launching probes
    const launchingProbes = Array.from(this.activeProbes.values()).filter(p => p.status === 'launching');
    const availableLaunchSlots = this.maxSimultaneousLaunches - launchingProbes.length;
    
    let needsSync = false;
    
    // Start as many probes as we have available slots
    for (let i = 0; i < availableLaunchSlots && this.probeQueue.length > 0; i++) {
      const nextItem = this.probeQueue.shift()!;
      const probe = nextItem.probe;

      // Start deployment - create new object to avoid mutation
      const launchingProbe = {
        ...probe,
        status: 'launching' as const,
        deploymentStartedAt: Date.now()
      };
      
      this.activeProbes.set(probe.id, launchingProbe);
      needsSync = true;
      
    }
    
    // Only sync and notify if there were actual changes
    if (needsSync) {
      this.backgroundService.syncProbeQueue(Array.from(this.activeProbes.values()));
      this.notifyProbeUpdate();
    }
  }

  /**
   * Update progress of active probes
   */
  private updateActiveProbes(): void {
    // Early exit if no active probes
    if (this.activeProbes.size === 0) {
      return;
    }

    const now = Date.now();
    let hasUpdates = false;
    const probesToRemove: string[] = [];

    for (const [probeId, probe] of this.activeProbes.entries()) {
      if (probe.status === 'launching' && probe.deploymentStartedAt) {
        const config = this.getProbeConfig(probe.type);
        const adjustedDeploymentTime = config.deploymentTime / probe.accelerationBonus;
        const elapsed = (now - probe.deploymentStartedAt) / 1000;
        const progress = Math.min(elapsed / adjustedDeploymentTime, 1);

        // Only update if progress actually changed
        if (Math.abs(progress - (probe.travelProgress || 0)) > 0.001) { // Use small threshold to avoid floating point issues
          // Create new probe object with updated progress (avoid worklet warnings)
          const updatedProbe = { ...probe, travelProgress: progress };
          this.activeProbes.set(probeId, updatedProbe);
          hasUpdates = true;

          // Debug logging for probe progress (temporary)
          if (progress > 0.9) { // Only log when close to completion
          }

          if (progress >= 1) {
            // Probe deployment completed - create new object with final status
            const deployedProbe = {
              ...updatedProbe,
              status: 'deployed' as const,
              deploymentCompletedAt: now,
              travelProgress: 1
            };
            this.activeProbes.set(probeId, deployedProbe);

            
            // Notify deployment completion (only once per probe)
            if (!this.deployedProbeIds.has(probeId)) {
              this.deployedProbeIds.add(probeId);
              
              this.onProbeDeployedCallbacks.forEach(callback => {
                try {
                  callback(deployedProbe);
                } catch (error) {
                  console.error('[ProbeManager] Error in probe deployed callback:', error);
                }
              });
            }
          }
        }
      } else if (probe.status === 'deployed' && probe.deploymentCompletedAt) {
        // Remove probes that have been deployed for more than 5 seconds (longer than animation)
        const timeSinceDeployment = now - probe.deploymentCompletedAt;
        if (timeSinceDeployment > 5000) { // 5 seconds
          probesToRemove.push(probeId);
          hasUpdates = true;
        }
      }
    }

    // Remove probes that have completed their lifecycle
    for (const probeId of probesToRemove) {
      this.activeProbes.delete(probeId);
      this.deployedProbeIds.delete(probeId); // Clean up tracking
    }

    if (hasUpdates) {
      this.notifyProbeUpdate();
    }
  }

  /**
   * Notify listeners of probe updates
   */
  private notifyProbeUpdate(): void {
    const allProbes = [
      ...this.probeQueue.map(item => item.probe),
      ...Array.from(this.activeProbes.values()),
    ];
    
    this.onProbeUpdateCallbacks.forEach((callback, index) => {
      try {
        callback(allProbes);
      } catch (error) {
        console.error(`[ProbeManager] Error in probe update callback ${index}:`, error);
      }
    });
    
    if (this.onProbeUpdateCallbacks.length === 0) {
    }
  }

  /**
   * Stop probe processing (cleanup)
   */
  async stop(): Promise<void> {
    try {
      // Stop foreground processing
      if (this.deploymentTimer) {
        clearInterval(this.deploymentTimer);
        this.deploymentTimer = null;
        console.log('[ProbeManager] Queue processing stopped');
      }

      // Stop background processing
      this.backgroundService.stopForegroundProcessing();
      
      // Sync final state before shutdown
      await this.backgroundService.syncProbeQueue(Array.from(this.activeProbes.values()));
      
      console.log('[ProbeManager] Stopped with background sync');
    } catch (error) {
      console.error('[ProbeManager] Error during stop:', error);
    }
  }

  /**
   * Get the maximum number of simultaneous launches
   */
  getMaxSimultaneousLaunches(): number {
    return this.maxSimultaneousLaunches;
  }

  /**
   * Set the maximum number of simultaneous launches
   */
  setMaxSimultaneousLaunches(max: number): void {
    this.maxSimultaneousLaunches = Math.max(1, Math.min(max, 10)); // Clamp between 1-10
    console.log(`[ProbeManager] Max simultaneous launches set to ${this.maxSimultaneousLaunches}`);
  }

  /**
   * Clear all probes (for debugging/testing)
   */
  clear(): void {
    this.probeQueue = [];
    this.activeProbes.clear();
    this.deployedProbeIds.clear();
    this.notifyProbeUpdate();
    console.log('[ProbeManager] All probes cleared');
  }
}