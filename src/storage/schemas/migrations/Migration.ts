import { GameState } from '../GameState';

export interface Migration {
  version: number;
  description: string;
  up(gameState: GameState): GameState;
  down?(gameState: GameState): GameState;
}

export class MigrationError extends Error {
  constructor(
    message: string,
    public readonly version: number,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'MigrationError';
  }
}