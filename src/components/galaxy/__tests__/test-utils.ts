/**
 * Test utilities for GalaxyMapModular component tests
 */

import type { Beacon } from '../../../types/galaxy';

/**
 * Creates a mock beacon for testing purposes
 */
export function createMockBeacon(
  id: string, 
  position: { x: number; y: number } = { x: 0, y: 0 }
): Beacon {
  return {
    id,
    position,
    level: 1,
    type: 'pioneer',
    connections: [],
  };
}