/**
 * Basic tests for the module system to verify functionality
 * This is a minimal test to ensure the module system works correctly
 */

import { ModuleManager, BeaconRenderingModule, ConnectionRenderingModule } from '../index';
import { ModuleContext } from '../types';

// Create a simple test context
const createTestContext = (): ModuleContext => ({
  viewport: {
    translateX: 0,
    translateY: 0,
    scale: 1,
    bounds: { minX: 0, maxX: 400, minY: 0, maxY: 600 },
  },
  screenDimensions: { width: 400, height: 600 },
  beacons: [
    {
      id: 'test-beacon-1',
      position: { x: 100, y: 100 },
      level: 1,
      type: 'pioneer',
      connections: [],
    },
  ],
  connections: [],
  patterns: [],
  starSystems: [],
  sectors: [],
  deltaTime: 16.67,
  frameCount: 1,
});

// Test module system functionality
export const testModuleSystem = async (): Promise<boolean> => {
  try {
    console.log('[ModuleSystemTest] Starting module system test...');
    
    // Create module manager
    const manager = new ModuleManager({ debugMode: true });
    
    // Create and register modules
    const beaconModule = new BeaconRenderingModule();
    const connectionModule = new ConnectionRenderingModule();
    
    await manager.registerModule(beaconModule);
    await manager.registerModule(connectionModule);
    
    console.log('[ModuleSystemTest] Modules registered successfully');
    
    // Test rendering
    const context = createTestContext();
    const elements = manager.renderModules(context);
    
    console.log(`[ModuleSystemTest] Rendered ${elements.length} elements`);
    
    // Test module configuration
    manager.setGlobalPerformanceMode(true);
    manager.setDebugMode(false);
    
    console.log('[ModuleSystemTest] Configuration changes applied');
    
    // Test module enabling/disabling
    manager.disableModule('connection-rendering');
    const elementsAfterDisable = manager.renderModules(context);
    
    console.log(`[ModuleSystemTest] Elements after disabling connections: ${elementsAfterDisable.length}`);
    
    // Re-enable module
    manager.enableModule('connection-rendering');
    
    console.log('[ModuleSystemTest] Module system test completed successfully');
    return true;
    
  } catch (error) {
    console.error('[ModuleSystemTest] Test failed:', error);
    return false;
  }
};

// Export for use in development/debugging
export const runModuleSystemTest = () => {
  return testModuleSystem();
};