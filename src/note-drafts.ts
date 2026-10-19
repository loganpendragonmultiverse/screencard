import { setNote } from './storage';

/** Volatile drafts stay separate from persisted notes and exports until a write succeeds. */
export class NoteDrafts {
  private readonly drafts = new Map<string, string>();
  private readonly failures = new Set<string>();

  constructor(private readonly store: Storage) {}

  get size(): number {
    return this.drafts.size;
  }

  text(key: string, saved: string): string {
    return this.drafts.get(key) ?? saved;
  }

  state(key: string): 'saved' | 'unsaved' | 'failed' {
    return this.failures.has(key) ? 'failed' : this.drafts.has(key) ? 'unsaved' : 'saved';
  }

  update(key: string, text: string): void {
    this.drafts.set(key, text);
  }

  save(key: string): boolean {
    const text = this.drafts.get(key);
    if (text === undefined) return true;
    try {
      setNote(this.store, key, text);
    } catch {
      this.failures.add(key);
      return false;
    }
    this.drafts.delete(key);
    this.failures.delete(key);
    return true;
  }
}
