/**
 * Unit tests for presenceService — computeActivityLevel.
 * Requirements: 6.2
 *
 * computeActivityLevel is a pure function — no DB or Socket.io needed.
 */

import { computeActivityLevel } from '../src/services/presenceService';

// Threshold constants (mirrors presenceService.ts)
const ACTIVE_MS  = 2  * 60 * 1000;   // 2 minutes
const RECENT_MS  = 15 * 60 * 1000;   // 15 minutes
const IDLE_MS    = 60 * 60 * 1000;   // 60 minutes

function msAgo(ms: number): Date {
  return new Date(Date.now() - ms);
}

// ── Active tier ────────────────────────────────────────────────────────────

describe('computeActivityLevel — active tier', () => {
  it('returns "active" for activity 0 ms ago (just now)', () => {
    expect(computeActivityLevel(msAgo(0))).toBe('active');
  });

  it('returns "active" for activity 1 minute ago', () => {
    expect(computeActivityLevel(msAgo(60_000))).toBe('active');
  });

  it('returns "active" for activity exactly 2 minutes ago (boundary)', () => {
    expect(computeActivityLevel(msAgo(ACTIVE_MS))).toBe('active');
  });

  it('returns "recent" for activity 1 ms past the 2-minute boundary', () => {
    expect(computeActivityLevel(msAgo(ACTIVE_MS + 1))).toBe('recent');
  });
});

// ── Recent tier ────────────────────────────────────────────────────────────

describe('computeActivityLevel — recent tier', () => {
  it('returns "recent" for activity 5 minutes ago', () => {
    expect(computeActivityLevel(msAgo(5 * 60_000))).toBe('recent');
  });

  it('returns "recent" for activity 10 minutes ago', () => {
    expect(computeActivityLevel(msAgo(10 * 60_000))).toBe('recent');
  });

  it('returns "recent" for activity exactly 15 minutes ago (boundary)', () => {
    expect(computeActivityLevel(msAgo(RECENT_MS))).toBe('recent');
  });

  it('returns "idle" for activity 1 ms past the 15-minute boundary', () => {
    expect(computeActivityLevel(msAgo(RECENT_MS + 1))).toBe('idle');
  });
});

// ── Idle tier ──────────────────────────────────────────────────────────────

describe('computeActivityLevel — idle tier', () => {
  it('returns "idle" for activity 30 minutes ago', () => {
    expect(computeActivityLevel(msAgo(30 * 60_000))).toBe('idle');
  });

  it('returns "idle" for activity 45 minutes ago', () => {
    expect(computeActivityLevel(msAgo(45 * 60_000))).toBe('idle');
  });

  it('returns "idle" for activity exactly 60 minutes ago (boundary)', () => {
    expect(computeActivityLevel(msAgo(IDLE_MS))).toBe('idle');
  });

  it('returns "away" for activity 1 ms past the 60-minute boundary', () => {
    expect(computeActivityLevel(msAgo(IDLE_MS + 1))).toBe('away');
  });
});

// ── Away tier ──────────────────────────────────────────────────────────────

describe('computeActivityLevel — away tier', () => {
  it('returns "away" for activity 2 hours ago', () => {
    expect(computeActivityLevel(msAgo(2 * 60 * 60_000))).toBe('away');
  });

  it('returns "away" for activity 24 hours ago', () => {
    expect(computeActivityLevel(msAgo(24 * 60 * 60_000))).toBe('away');
  });

  it('returns "away" for activity 7 days ago', () => {
    expect(computeActivityLevel(msAgo(7 * 24 * 60 * 60_000))).toBe('away');
  });

  it('returns "away" for epoch (very old timestamp)', () => {
    expect(computeActivityLevel(new Date(0))).toBe('away');
  });
});

// ── Return type ────────────────────────────────────────────────────────────

describe('computeActivityLevel — return type', () => {
  it('always returns one of the four valid activity levels', () => {
    const validLevels = new Set(['active', 'recent', 'idle', 'away']);
    const testCases = [0, 60_000, ACTIVE_MS, RECENT_MS, IDLE_MS, IDLE_MS + 1, 24 * 60 * 60_000];
    for (const ms of testCases) {
      const level = computeActivityLevel(msAgo(ms));
      expect(validLevels.has(level)).toBe(true);
    }
  });
});
