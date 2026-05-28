import { IMood } from '../models/Mood';
/**
 * Upserts all mood seed entries into MongoDB.
 *
 * Using `updateOne` with `upsert: true` makes this operation idempotent —
 * safe to call on every app startup without creating duplicates or
 * overwriting manual edits to fields not included in `$setOnInsert`.
 *
 * Called from `bootstrap()` in server.ts after `ensureIndexes()`.
 */
export declare function seedMoods(): Promise<void>;
/**
 * Returns the Mood document for the given id, or null if not found.
 *
 * @param id - The mood slug, e.g. "happy", "neutral"
 */
export declare function getMoodById(id: string): Promise<IMood | null>;
/**
 * Returns all Mood documents in the collection.
 */
export declare function getAllMoods(): Promise<IMood[]>;
//# sourceMappingURL=moods.d.ts.map