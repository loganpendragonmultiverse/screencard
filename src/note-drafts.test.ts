import { describe, expect, it } from 'vitest';
import { NoteDrafts } from './note-drafts';
import { getNotes, setNote } from './storage';
import { memoryStorage } from './testUtils';

describe('unsaved research note recovery', () => {
  it('retains the exact draft and old persisted note after a quota failure, then retries', () => {
    const store = memoryStorage();
    setNote(store, 'movie:1', 'Original');
    const originalWrite = store.setItem;
    store.setItem = () => {
      throw new DOMException('Storage full', 'QuotaExceededError');
    };
    const drafts = new NoteDrafts(store);
    drafts.update('movie:1', 'New draft <&>');
    expect(drafts.state('movie:1')).toBe('unsaved');
    expect(drafts.save('movie:1')).toBe(false);
    expect(drafts.state('movie:1')).toBe('failed');
    expect(drafts.text('movie:1', getNotes(store)['movie:1'] ?? '')).toBe('New draft <&>');
    expect(getNotes(store)['movie:1']).toBe('Original');
    expect(drafts.size).toBe(1);
    store.setItem = originalWrite;
    expect(drafts.save('movie:1')).toBe(true);
    expect(getNotes(store)['movie:1']).toBe('New draft <&>');
    expect(drafts.state('movie:1')).toBe('saved');
    expect(drafts.size).toBe(0);
  });

  it('keeps independent card drafts and empty-note deletion recoverable', () => {
    const store = memoryStorage();
    setNote(store, 'movie:1', 'Original');
    const drafts = new NoteDrafts(store);
    drafts.update('movie:1', '');
    drafts.update('tv:2', 'Other draft');
    expect(drafts.text('movie:1', 'Original')).toBe('');
    expect(drafts.save('movie:1')).toBe(true);
    expect(getNotes(store)).toEqual({});
    expect(drafts.text('tv:2', '')).toBe('Other draft');
    expect(drafts.size).toBe(1);
    expect(drafts.save('tv:2')).toBe(true);
    expect(drafts.save('missing')).toBe(true);
    expect(drafts.text('missing', 'Saved fallback')).toBe('Saved fallback');
  });

  it('does not delete the saved note until an empty draft is persisted', () => {
    const store = memoryStorage();
    setNote(store, 'movie:1', 'Keep until deletion saves');
    const originalWrite = store.setItem;
    store.setItem = () => {
      throw new DOMException('Storage full', 'QuotaExceededError');
    };
    const drafts = new NoteDrafts(store);
    drafts.update('movie:1', '');
    expect(drafts.save('movie:1')).toBe(false);
    expect(drafts.text('movie:1', 'Keep until deletion saves')).toBe('');
    expect(getNotes(store)['movie:1']).toBe('Keep until deletion saves');
    store.setItem = originalWrite;
    expect(drafts.save('movie:1')).toBe(true);
    expect(getNotes(store)).toEqual({});
  });

  it('preserves drafts when storage is blocked and permits an edited retry', () => {
    const store = memoryStorage();
    const originalWrite = store.setItem;
    store.setItem = () => {
      throw new DOMException('Blocked', 'SecurityError');
    };
    const drafts = new NoteDrafts(store);
    drafts.update('movie:1', 'First draft');
    expect(drafts.save('movie:1')).toBe(false);
    drafts.update('movie:1', 'Corrected draft');
    expect(drafts.save('movie:1')).toBe(false);
    expect(drafts.text('movie:1', '')).toBe('Corrected draft');
    store.setItem = originalWrite;
    expect(drafts.save('movie:1')).toBe(true);
    expect(getNotes(store)['movie:1']).toBe('Corrected draft');
  });
});
