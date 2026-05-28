/**
 * Unit tests for capsule unlockAt validation logic.
 * Requirements: 4.2, 4.3
 *
 * The validation logic is extracted from messageService.sendMessage and tested
 * as a pure function — no DB connection needed.
 */

// ── Extracted validation logic (mirrors messageService.ts) ─────────────────

interface UnlockAtValidationResult {
  valid: boolean;
  code?: string;
  message?: string;
}

function validateUnlockAt(unlockAt: Date | undefined): UnlockAtValidationResult {
  if (!unlockAt) {
    return {
      valid: false,
      code: 'MISSING_UNLOCK_AT',
      message: 'unlockAt is required for time-based capsule messages.',
    };
  }
  const minUnlock = new Date(Date.now() + 60_000);
  if (unlockAt < minUnlock) {
    return {
      valid: false,
      code: 'INVALID_UNLOCK_AT',
      message: 'unlockAt must be at least 1 minute in the future.',
    };
  }
  return { valid: true };
}

// ── unlockAt validation ────────────────────────────────────────────────────

describe('capsule unlockAt validation', () => {
  it('rejects when unlockAt is undefined', () => {
    const result = validateUnlockAt(undefined);
    expect(result.valid).toBe(false);
    expect(result.code).toBe('MISSING_UNLOCK_AT');
  });

  it('rejects when unlockAt is in the past', () => {
    const past = new Date(Date.now() - 60_000);
    const result = validateUnlockAt(past);
    expect(result.valid).toBe(false);
    expect(result.code).toBe('INVALID_UNLOCK_AT');
  });

  it('rejects when unlockAt is exactly now', () => {
    const now = new Date();
    const result = validateUnlockAt(now);
    expect(result.valid).toBe(false);
    expect(result.code).toBe('INVALID_UNLOCK_AT');
  });

  it('rejects when unlockAt is less than 1 minute in the future (59 seconds)', () => {
    const tooSoon = new Date(Date.now() + 59_000);
    const result = validateUnlockAt(tooSoon);
    expect(result.valid).toBe(false);
    expect(result.code).toBe('INVALID_UNLOCK_AT');
  });

  it('rejects when unlockAt is 30 seconds in the future', () => {
    const tooSoon = new Date(Date.now() + 30_000);
    const result = validateUnlockAt(tooSoon);
    expect(result.valid).toBe(false);
    expect(result.code).toBe('INVALID_UNLOCK_AT');
  });

  it('accepts when unlockAt is exactly 1 minute in the future', () => {
    // Add a small buffer (100ms) to avoid flakiness from execution time
    const exactly1Min = new Date(Date.now() + 60_000 + 100);
    const result = validateUnlockAt(exactly1Min);
    expect(result.valid).toBe(true);
  });

  it('accepts when unlockAt is 5 minutes in the future', () => {
    const fiveMin = new Date(Date.now() + 5 * 60_000);
    const result = validateUnlockAt(fiveMin);
    expect(result.valid).toBe(true);
  });

  it('accepts when unlockAt is 1 hour in the future', () => {
    const oneHour = new Date(Date.now() + 60 * 60_000);
    const result = validateUnlockAt(oneHour);
    expect(result.valid).toBe(true);
  });

  it('accepts when unlockAt is 1 day in the future', () => {
    const oneDay = new Date(Date.now() + 24 * 60 * 60_000);
    const result = validateUnlockAt(oneDay);
    expect(result.valid).toBe(true);
  });

  it('accepts when unlockAt is 1 year in the future', () => {
    const oneYear = new Date(Date.now() + 365 * 24 * 60 * 60_000);
    const result = validateUnlockAt(oneYear);
    expect(result.valid).toBe(true);
  });
});
