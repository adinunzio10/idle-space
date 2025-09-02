import { Point2D } from '../types/galaxy';
import { Beacon } from '../entities/Beacon';
import { BEACON_CONSTANTS } from '../constants/beacon';

export interface ConnectionInfo {
  id: string;
  sourceId: string;
  targetId: string;
  distance: number;
  strength: number; // 0-1 based on distance and levels
  isActive: boolean;
  establishedAt: number;
}

export interface ConnectionCandidate {
  beacon: Beacon;
  distance: number;
  canConnect: boolean;
  reason?: string;
}

export class BeaconConnectionManager {
  private connections: Map<string, ConnectionInfo> = new Map();
  private beacons: Map<string, Beacon> = new Map();

  /**
   * Update the beacon collection for connection management
   */
  public updateBeacons(beacons: Record<string, Beacon> | Beacon[]): void {
    this.beacons.clear();

    if (Array.isArray(beacons)) {
      beacons.forEach(beacon => {
        this.beacons.set(beacon.id, beacon);
      });
    } else {
      Object.values(beacons).forEach(beacon => {
        this.beacons.set(beacon.id, beacon);
      });
    }

    // Rebuild connections based on current beacon state
    this.rebuildConnections();
  }

  /**
   * Detect and establish automatic connections for all beacons
   */
  public rebuildConnections(): void {
    this.connections.clear();

    const beaconArray = Array.from(this.beacons.values());

    for (let i = 0; i < beaconArray.length; i++) {
      for (let j = i + 1; j < beaconArray.length; j++) {
        const beacon1 = beaconArray[i];
        const beacon2 = beaconArray[j];

        if (this.shouldConnect(beacon1, beacon2)) {
          this.establishConnection(beacon1, beacon2);
        }
      }
    }
  }

  /**
   * Check if two beacons should be connected based on distance and capacity
   */
  private shouldConnect(beacon1: Beacon, beacon2: Beacon): boolean {
    // Skip if either beacon is inactive
    if (beacon1.status !== 'active' || beacon2.status !== 'active') {
      return false;
    }

    // Check if already connected
    if (
      beacon1.isConnectedTo(beacon2.id) ||
      beacon2.isConnectedTo(beacon1.id)
    ) {
      return true; // Already connected, maintain connection
    }

    // Check connection capacity
    if (
      beacon1.connections.length >= beacon1.getMaxConnections() ||
      beacon2.connections.length >= beacon2.getMaxConnections()
    ) {
      return false;
    }

    // Check if within range
    const distance = beacon1.getDistanceTo(beacon2.position);
    const maxRange = Math.max(
      beacon1.calculateConnectionRange(),
      beacon2.calculateConnectionRange()
    );

    return distance <= maxRange;
  }

  /**
   * Establish a connection between two beacons
   */
  private establishConnection(
    beacon1: Beacon,
    beacon2: Beacon
  ): ConnectionInfo | null {
    // Check if connection already exists
    const existingConnectionId = this.getConnectionId(beacon1.id, beacon2.id);
    if (this.connections.has(existingConnectionId)) {
      return this.connections.get(existingConnectionId)!;
    }

    const distance = beacon1.getDistanceTo(beacon2.position);
    const strength = this.calculateConnectionStrength(
      beacon1,
      beacon2,
      distance
    );

    const connection: ConnectionInfo = {
      id: existingConnectionId,
      sourceId: beacon1.id,
      targetId: beacon2.id,
      distance,
      strength,
      isActive: true,
      establishedAt: Date.now(),
    };

    // Add to internal tracking
    this.connections.set(connection.id, connection);

    // Update beacon connection arrays
    beacon1.addConnection(beacon2.id);
    beacon2.addConnection(beacon1.id);

    return connection;
  }

  /**
   * Remove a connection between two beacons
   */
  public removeConnection(beacon1Id: string, beacon2Id: string): boolean {
    const connectionId = this.getConnectionId(beacon1Id, beacon2Id);
    const connection = this.connections.get(connectionId);

    if (!connection) {
      return false;
    }

    // Remove from internal tracking
    this.connections.delete(connectionId);

    // Update beacon connection arrays
    const beacon1 = this.beacons.get(beacon1Id);
    const beacon2 = this.beacons.get(beacon2Id);

    if (beacon1) {
      beacon1.removeConnection(beacon2Id);
    }
    if (beacon2) {
      beacon2.removeConnection(beacon1Id);
    }

    return true;
  }

  /**
   * Calculate connection strength based on distance and beacon properties
   */
  private calculateConnectionStrength(
    beacon1: Beacon,
    beacon2: Beacon,
    distance: number
  ): number {
    const maxRange = Math.max(
      beacon1.calculateConnectionRange(),
      beacon2.calculateConnectionRange()
    );

    // Base strength decreases with distance (1.0 at distance 0, 0.1 at max range)
    const distanceStrength = Math.max(0.1, 1.0 - (distance / maxRange) * 0.9);

    // Level difference bonus/penalty
    const avgLevel = (beacon1.level + beacon2.level) / 2;
    const levelStrength = Math.min(1.0, avgLevel / 10); // Stronger connections at higher levels

    // Type compatibility bonus
    const typeStrength = this.getTypeCompatibilityBonus(
      beacon1.type,
      beacon2.type
    );

    return Math.min(1.0, distanceStrength * levelStrength * typeStrength);
  }

  /**
   * Get type compatibility bonus for connections
   */
  private getTypeCompatibilityBonus(type1: string, type2: string): number {
    // Architect beacons work well with everything
    if (type1 === 'architect' || type2 === 'architect') {
      return 1.2;
    }

    // Harvester-Pioneer synergy
    if (
      (type1 === 'harvester' && type2 === 'pioneer') ||
      (type1 === 'pioneer' && type2 === 'harvester')
    ) {
      return 1.15;
    }

    return 1.0; // Default compatibility
  }

  /**
   * Find potential connections for a beacon
   */
  public findConnectionCandidates(
    beacon: Beacon,
    maxCandidates: number = 10
  ): ConnectionCandidate[] {
    const candidates: ConnectionCandidate[] = [];

    for (const otherBeacon of this.beacons.values()) {
      if (otherBeacon.id === beacon.id || otherBeacon.status !== 'active') {
        continue;
      }

      const distance = beacon.getDistanceTo(otherBeacon.position);
      const maxRange = beacon.calculateConnectionRange();

      const candidate: ConnectionCandidate = {
        beacon: otherBeacon,
        distance,
        canConnect: false,
        reason: '',
      };

      // Check various connection criteria
      if (beacon.isConnectedTo(otherBeacon.id)) {
        candidate.reason = 'Already connected';
      } else if (distance > maxRange) {
        candidate.reason = `Out of range (${distance.toFixed(1)}/${maxRange.toFixed(1)})`;
      } else if (beacon.connections.length >= beacon.getMaxConnections()) {
        candidate.reason = 'At connection capacity';
      } else if (
        otherBeacon.connections.length >= otherBeacon.getMaxConnections()
      ) {
        candidate.reason = 'Target at capacity';
      } else {
        candidate.canConnect = true;
        candidate.reason = 'Can connect';
      }

      candidates.push(candidate);
    }

    // Sort by distance and return top candidates
    candidates.sort((a, b) => a.distance - b.distance);
    return candidates.slice(0, maxCandidates);
  }

  /**
   * Get all connections for a specific beacon
   */
  public getBeaconConnections(beaconId: string): ConnectionInfo[] {
    const connections: ConnectionInfo[] = [];

    for (const connection of this.connections.values()) {
      if (
        connection.sourceId === beaconId ||
        connection.targetId === beaconId
      ) {
        connections.push(connection);
      }
    }

    return connections;
  }

  /**
   * Get connection between two specific beacons
   */
  public getConnection(
    beacon1Id: string,
    beacon2Id: string
  ): ConnectionInfo | null {
    const connectionId = this.getConnectionId(beacon1Id, beacon2Id);
    return this.connections.get(connectionId) || null;
  }

  /**
   * Get all active connections
   */
  public getAllConnections(): ConnectionInfo[] {
    return Array.from(this.connections.values());
  }

  /**
   * Update connection strengths based on current beacon states
   */
  public updateConnectionStrengths(): void {
    for (const connection of this.connections.values()) {
      const beacon1 = this.beacons.get(connection.sourceId);
      const beacon2 = this.beacons.get(connection.targetId);

      if (beacon1 && beacon2) {
        connection.strength = this.calculateConnectionStrength(
          beacon1,
          beacon2,
          connection.distance
        );
        connection.isActive =
          beacon1.status === 'active' && beacon2.status === 'active';
      } else {
        // Remove connections to non-existent beacons
        this.connections.delete(connection.id);
      }
    }
  }

  /**
   * Force establish a connection (override capacity limits)
   */
  public forceConnection(
    beacon1Id: string,
    beacon2Id: string
  ): ConnectionInfo | null {
    const beacon1 = this.beacons.get(beacon1Id);
    const beacon2 = this.beacons.get(beacon2Id);

    if (!beacon1 || !beacon2) {
      return null;
    }

    // Check if already connected
    if (beacon1.isConnectedTo(beacon2Id)) {
      return this.getConnection(beacon1Id, beacon2Id);
    }

    return this.establishConnection(beacon1, beacon2);
  }

  /**
   * Get connection statistics
   */
  public getConnectionStats(): {
    totalConnections: number;
    activeConnections: number;
    averageStrength: number;
    strongestConnection: ConnectionInfo | null;
    connectionsByType: Record<string, number>;
  } {
    const connections = Array.from(this.connections.values());
    const activeConnections = connections.filter(c => c.isActive);

    const averageStrength =
      activeConnections.length > 0
        ? activeConnections.reduce((sum, c) => sum + c.strength, 0) /
          activeConnections.length
        : 0;

    const strongestConnection = connections.reduce(
      (strongest, current) =>
        !strongest || current.strength > strongest.strength
          ? current
          : strongest,
      null as ConnectionInfo | null
    );

    const connectionsByType: Record<string, number> = {};
    for (const connection of activeConnections) {
      const beacon1 = this.beacons.get(connection.sourceId);
      const beacon2 = this.beacons.get(connection.targetId);

      if (beacon1 && beacon2) {
        const typeKey = [beacon1.type, beacon2.type].sort().join('-');
        connectionsByType[typeKey] = (connectionsByType[typeKey] || 0) + 1;
      }
    }

    return {
      totalConnections: connections.length,
      activeConnections: activeConnections.length,
      averageStrength,
      strongestConnection,
      connectionsByType,
    };
  }

  /**
   * Generate connection ID from two beacon IDs (order-independent)
   */
  private getConnectionId(beacon1Id: string, beacon2Id: string): string {
    const ids = [beacon1Id, beacon2Id].sort();
    return `connection_${ids[0]}_${ids[1]}`;
  }

  /**
   * Clear all connections
   */
  public clear(): void {
    this.connections.clear();
    // Also clear connection arrays in beacons
    for (const beacon of this.beacons.values()) {
      beacon.connections.length = 0;
    }
  }

  /**
   * Export connections for save data
   */
  public exportConnections(): Record<string, any> {
    const exportData: Record<string, any> = {};

    for (const [id, connection] of this.connections) {
      exportData[id] = {
        id: connection.id,
        sourceId: connection.sourceId,
        targetId: connection.targetId,
        distance: connection.distance,
        strength: connection.strength,
        isActive: connection.isActive,
        establishedAt: connection.establishedAt,
      };
    }

    return exportData;
  }

  /**
   * Import connections from save data
   */
  public importConnections(connectionData: Record<string, any>): void {
    this.connections.clear();

    for (const data of Object.values(connectionData)) {
      const connection: ConnectionInfo = {
        id: data.id,
        sourceId: data.sourceId,
        targetId: data.targetId,
        distance: data.distance,
        strength: data.strength,
        isActive: data.isActive,
        establishedAt: data.establishedAt,
      };

      this.connections.set(connection.id, connection);
    }
  }
}
