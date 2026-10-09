// The table in progress is saved under one key so a refresh returns to it.
import type { StorageAdapter } from '../storage/storage';
import type { SavedTable } from './hooks/useTableController';

const KEY = 'activeGame';

export function loadActiveGame(storage: StorageAdapter): SavedTable | undefined {
  const g = storage.load<SavedTable>(KEY);
  const valid =
    g && g.v === 1 && g.engine?.v === 1 && typeof g.userSeat === 'number' && g.occupants?.[g.userSeat]?.kind === 'human' && g.session;
  if (!valid) {
    if (g) storage.remove(KEY);
    return undefined;
  }
  return g;
}

export function saveActiveGame(storage: StorageAdapter, game: SavedTable): void {
  storage.save(KEY, game);
}

export function clearActiveGame(storage: StorageAdapter): void {
  storage.remove(KEY);
}
