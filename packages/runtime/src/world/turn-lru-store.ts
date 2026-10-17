/**
 * SuperGravity Turn Metadata LRU Store
 *
 * Enforces zero-fullText, metadata-only storage invariants with strict LRU capacity (Cap=30)
 * and atomic history rollback truncation on "Undo to this point" events.
 */

export const TURN_METADATA_STORAGE_KEY = 'sg:turn_meta_lru:v1';
export const MAX_TURN_CAPACITY = 30;

export const FORBIDDEN_FIELDS = [
  'fullText',
  'rawHtml',
  'markdownBody',
  'domSnapshot',
  'tokens',
  'body'
] as const;

export interface TurnMetadataEntry {
  sessionId: string;
  turnId: string;
  sequenceIndex: number;
  parentTurnId: string | null;
  timestamp: number;
  contentHash: string;
  previewSnippet: string;
  charCount: number;
  fileSnapshotRef: string | null;
}

export class TurnMetadataLRUStore {
  #cache = new Map<string, TurnMetadataEntry>(); // key: `${sessionId}:${turnId}`
  #dirty = false;
  #persistScheduled = false;
  #storageKey: string;
  #capacity: number;

  constructor(storageKey = TURN_METADATA_STORAGE_KEY, capacity = MAX_TURN_CAPACITY) {
    this.#storageKey = storageKey;
    this.#capacity = capacity;
    this.#hydrate();
  }

  get size(): number {
    return this.#cache.size;
  }

  #hydrate(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(this.#storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const [k, v] of parsed.slice(-this.#capacity)) {
          if (v && typeof v === 'object' && v.sessionId && v.turnId) {
            this.#cache.set(k, v);
          }
        }
      }
    } catch {
      try {
        localStorage.removeItem(this.#storageKey);
      } catch {}
    }
  }

  /**
   * Upsert conversation turn metadata (strips forbidden large payloads and enforces Cap=30 LRU)
   */
  upsert(sessionId: string, turnId: string, rawMeta: Partial<TurnMetadataEntry> & Record<string, unknown>): TurnMetadataEntry {
    const sanitized = { ...rawMeta };

    // Strict hygiene audit: delete any forbidden field
    for (const field of FORBIDDEN_FIELDS) {
      if (field in sanitized) {
        delete sanitized[field];
      }
    }

    const key = `${sessionId}:${turnId}`;
    const entry: TurnMetadataEntry = {
      sessionId: String(sessionId),
      turnId: String(turnId),
      sequenceIndex: Number(sanitized.sequenceIndex) || 0,
      parentTurnId: sanitized.parentTurnId ? String(sanitized.parentTurnId) : null,
      timestamp: Number(sanitized.timestamp) || Date.now(),
      contentHash: String(sanitized.contentHash || '').slice(0, 16),
      previewSnippet: String(sanitized.previewSnippet || '').slice(0, 48),
      charCount: Number(sanitized.charCount) || 0,
      fileSnapshotRef: sanitized.fileSnapshotRef ? String(sanitized.fileSnapshotRef) : null
    };

    // Maintain LRU access order in Map
    if (this.#cache.has(key)) {
      this.#cache.delete(key);
    }
    this.#cache.set(key, entry);

    // Evict oldest entries exceeding capacity
    while (this.#cache.size > this.#capacity) {
      const oldestKey = this.#cache.keys().next().value;
      if (oldestKey) this.#cache.delete(oldestKey);
    }

    this.#schedulePersist();
    return entry;
  }

  get(sessionId: string, turnId: string): TurnMetadataEntry | null {
    const key = `${sessionId}:${turnId}`;
    const entry = this.#cache.get(key);
    if (!entry) return null;

    // Refresh LRU order on access
    this.#cache.delete(key);
    this.#cache.set(key, entry);
    return entry;
  }

  list(sessionId: string): TurnMetadataEntry[] {
    const result: TurnMetadataEntry[] = [];
    for (const entry of this.#cache.values()) {
      if (entry.sessionId === sessionId) {
        result.push(entry);
      }
    }
    return result.sort((a, b) => a.sequenceIndex - b.sequenceIndex);
  }

  /**
   * Atomic history truncation on "Undo to this point"
   * Evicts all future turns strictly after the target pivot turn
   */
  truncateOnUndo(sessionId: string, targetTurnId: string, inclusive = false): string[] {
    const targetKey = `${sessionId}:${targetTurnId}`;
    const pivot = this.#cache.get(targetKey);
    if (!pivot) return [];

    const pivotSeq = pivot.sequenceIndex;
    const pivotTime = pivot.timestamp;
    const evictedTurnIds: string[] = [];

    for (const [key, entry] of [...this.#cache.entries()]) {
      if (entry.sessionId !== sessionId) continue;

      const isTarget = entry.turnId === targetTurnId;
      const isAfterPivot =
        entry.sequenceIndex > pivotSeq ||
        (entry.sequenceIndex === pivotSeq && entry.timestamp > pivotTime);

      if ((inclusive && isTarget) || isAfterPivot) {
        this.#cache.delete(key);
        evictedTurnIds.push(entry.turnId);
      }
    }

    if (evictedTurnIds.length > 0) {
      this.#schedulePersist();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('sg:history-truncated', {
            detail: { sessionId, targetTurnId, evictedTurnIds }
          })
        );
      }
    }

    return evictedTurnIds;
  }

  clear(sessionId?: string): void {
    if (!sessionId) {
      this.#cache.clear();
    } else {
      for (const [key, entry] of [...this.#cache.entries()]) {
        if (entry.sessionId === sessionId) {
          this.#cache.delete(key);
        }
      }
    }
    this.#schedulePersist();
  }

  #schedulePersist(): void {
    this.#dirty = true;
    if (this.#persistScheduled) return;
    this.#persistScheduled = true;

    const persistWork = (): void => {
      this.#persistScheduled = false;
      if (!this.#dirty) return;
      this.#dirty = false;

      if (typeof localStorage === 'undefined') return;
      try {
        const serialized = JSON.stringify(Array.from(this.#cache.entries()));
        localStorage.setItem(this.#storageKey, serialized);
      } catch {
        // Quota recovery: prune to half capacity
        const retained = Array.from(this.#cache.entries()).slice(-Math.floor(this.#capacity / 2));
        this.#cache = new Map(retained);
        try {
          localStorage.setItem(this.#storageKey, JSON.stringify(retained));
        } catch {}
      }
    };

    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(persistWork, { timeout: 1000 });
    } else {
      setTimeout(persistWork, 0);
    }
  }

  flushSync(): void {
    if (!this.#dirty || typeof localStorage === 'undefined') return;
    this.#dirty = false;
    this.#persistScheduled = false;
    try {
      localStorage.setItem(this.#storageKey, JSON.stringify(Array.from(this.#cache.entries())));
    } catch {}
  }
}

export const turnMetadataStore = new TurnMetadataLRUStore();
