import {
  GalaxyMapModule,
  ModuleRegistryEntry,
  ModuleDependencyInfo,
  ModuleEventBus,
  ModuleEvent,
  ModuleEventPayload,
} from './types';

export class ModuleRegistry {
  private modules: Map<string, ModuleRegistryEntry> = new Map();
  private eventBus: ModuleEventBus;

  constructor() {
    this.eventBus = this.createEventBus();
  }

  register(module: GalaxyMapModule): void {
    if (this.modules.has(module.id)) {
      throw new Error(`Module ${module.id} is already registered`);
    }

    // Validate dependencies exist
    for (const depId of module.dependencies) {
      if (!this.modules.has(depId)) {
        throw new Error(`Module ${module.id} requires dependency ${depId} which is not registered`);
      }
    }

    this.modules.set(module.id, {
      module,
      isRegistered: true,
    });

    this.eventBus.emit('module:initialized', {
      moduleId: module.id,
      timestamp: Date.now(),
    });

    console.log(`[ModuleRegistry] Registered module: ${module.name} (${module.id})`);
  }

  unregister(moduleId: string): void {
    const entry = this.modules.get(moduleId);
    if (!entry) return;

    // Check if other modules depend on this one
    const dependents = this.getDependents(moduleId);
    if (dependents.length > 0) {
      throw new Error(
        `Cannot unregister module ${moduleId}. Required by: ${dependents.join(', ')}`
      );
    }

    // Cleanup the module
    entry.module.cleanup();
    this.modules.delete(moduleId);

    console.log(`[ModuleRegistry] Unregistered module: ${moduleId}`);
  }

  getModule(id: string): GalaxyMapModule | null {
    const entry = this.modules.get(id);
    return entry?.module || null;
  }

  getAllModules(): GalaxyMapModule[] {
    return Array.from(this.modules.values()).map(entry => entry.module);
  }

  getModulesByCategory(category: string): GalaxyMapModule[] {
    return this.getAllModules().filter(module => module.category === category);
  }

  getEnabledModules(): GalaxyMapModule[] {
    return this.getAllModules().filter(module => module.config.enabled);
  }

  getModulesSortedByPriority(): GalaxyMapModule[] {
    return this.getAllModules()
      .filter(module => module.config.enabled)
      .sort((a, b) => b.config.priority - a.config.priority);
  }

  enableModule(moduleId: string): void {
    const module = this.getModule(moduleId);
    if (!module) {
      throw new Error(`Module ${moduleId} not found`);
    }

    // Check dependencies are enabled
    for (const depId of module.dependencies) {
      const depModule = this.getModule(depId);
      if (!depModule?.config.enabled) {
        throw new Error(`Cannot enable ${moduleId}: dependency ${depId} is not enabled`);
      }
    }

    module.enable();
    this.eventBus.emit('module:enabled', {
      moduleId,
      timestamp: Date.now(),
    });
  }

  disableModule(moduleId: string): void {
    const module = this.getModule(moduleId);
    if (!module) return;

    // Disable dependent modules first
    const dependents = this.getDependents(moduleId);
    for (const depId of dependents) {
      this.disableModule(depId);
    }

    module.disable();
    this.eventBus.emit('module:disabled', {
      moduleId,
      timestamp: Date.now(),
    });
  }

  getDependencyInfo(moduleId: string): ModuleDependencyInfo | null {
    const module = this.getModule(moduleId);
    if (!module) return null;

    const requiredBy = this.getDependents(moduleId);
    const circularDeps = this.detectCircularDependencies(moduleId);

    return {
      moduleId,
      requiredBy,
      requires: module.dependencies,
      canBeDisabled: requiredBy.length === 0,
      circularDependencies: circularDeps,
    };
  }

  validateDependencies(): string[] {
    const errors: string[] = [];
    
    for (const module of this.getAllModules()) {
      // Check for missing dependencies
      for (const depId of module.dependencies) {
        if (!this.modules.has(depId)) {
          errors.push(`Module ${module.id} requires missing dependency: ${depId}`);
        }
      }

      // Check for circular dependencies
      const circular = this.detectCircularDependencies(module.id);
      if (circular.length > 0) {
        errors.push(`Module ${module.id} has circular dependencies: ${circular.join(' -> ')}`);
      }
    }

    return errors;
  }

  getEventBus(): ModuleEventBus {
    return this.eventBus;
  }

  private getDependents(moduleId: string): string[] {
    return this.getAllModules()
      .filter(module => module.dependencies.includes(moduleId))
      .map(module => module.id);
  }

  private detectCircularDependencies(
    moduleId: string,
    visited: Set<string> = new Set(),
    path: string[] = []
  ): string[] {
    if (visited.has(moduleId)) {
      const cycleStart = path.indexOf(moduleId);
      return cycleStart >= 0 ? path.slice(cycleStart).concat(moduleId) : [];
    }

    visited.add(moduleId);
    path.push(moduleId);

    const module = this.getModule(moduleId);
    if (!module) return [];

    for (const depId of module.dependencies) {
      const cycle = this.detectCircularDependencies(depId, visited, path);
      if (cycle.length > 0) return cycle;
    }

    path.pop();
    visited.delete(moduleId);
    return [];
  }

  private createEventBus(): ModuleEventBus {
    const eventListeners = new Map<ModuleEvent, Set<(payload: ModuleEventPayload) => void>>();

    return {
      emit: (event: ModuleEvent, payload: ModuleEventPayload) => {
        const listeners = eventListeners.get(event);
        if (listeners) {
          listeners.forEach(callback => {
            try {
              callback(payload);
            } catch (error) {
              console.error(`[ModuleRegistry] Error in event listener for ${event}:`, error);
            }
          });
        }
      },

      subscribe: (event: ModuleEvent, callback: (payload: ModuleEventPayload) => void) => {
        if (!eventListeners.has(event)) {
          eventListeners.set(event, new Set());
        }
        eventListeners.get(event)!.add(callback);

        // Return unsubscribe function
        return () => {
          const listeners = eventListeners.get(event);
          if (listeners) {
            listeners.delete(callback);
            if (listeners.size === 0) {
              eventListeners.delete(event);
            }
          }
        };
      },

      unsubscribe: (event: ModuleEvent, callback: (payload: ModuleEventPayload) => void) => {
        const listeners = eventListeners.get(event);
        if (listeners) {
          listeners.delete(callback);
          if (listeners.size === 0) {
            eventListeners.delete(event);
          }
        }
      },
    };
  }

}