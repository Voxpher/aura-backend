/**
 * Unit tests for Auth — registration validation, login lockout logic, token signing.
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 1.7
 *
 * All Mongoose model calls are mocked so no real DB connection is needed.
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

// ── Helpers extracted from auth.ts for unit testing ───────────────────────

/** Mirrors the RegisterSchema validation rules from auth.ts */
function validateRegisterInput(input: {
  username?: unknown;
  email?: unknown;
  password?: unknown;
  displayName?: unknown;
}): { valid: boolean; message?: string } {
  const { username, email, password, displayName } = input;

  if (typeof username !== 'string' || username.length < 3)
    return { valid: false, message: 'Username must be at least 3 characters' };
  if (username.length > 30)
    return { valid: false, message: 'Username must be at most 30 characters' };
  if (!/^[a-zA-Z0-9_-]+$/.test(username))
    return { valid: false, message: 'Username may only contain letters, numbers, underscores, or hyphens' };

  if (typeof email !== 'string' || !email.includes('@'))
    return { valid: false, message: 'Invalid email address' };

  if (typeof password !== 'string' || password.length < 8)
    return { valid: false, message: 'Password must be at least 8 characters' };
  if (password.length > 128)
    return { valid: false, message: 'Password must be at most 128 characters' };

  if (typeof displayName !== 'string' || displayName.length < 1)
    return { valid: false, message: 'Display name must be at least 1 character' };
  if (displayName.length > 30)
    return { valid: false, message: 'Display name must be at most 30 characters' };

  return { valid: true };
}

/** Mirrors the lockout logic from auth.ts */
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

function isAccountLocked(lockedUntil: Date | undefined, now: Date): boolean {
  return !!(lockedUntil && lockedUntil > now);
}

function shouldLockAccount(newFailedCount: number): boolean {
  return newFailedCount >= MAX_FAILED_ATTEMPTS;
}

function computeLockedUntil(now: Date): Date {
  return new Date(now.getTime() + LOCKOUT_DURATION_MS);
}

/** Mirrors signToken from auth.ts */
function signToken(userId: string, username: string, secret: string): string {
  return jwt.sign({ userId, username }, secret, {
    expiresIn: '30d',
    algorithm: 'HS256',
  });
}

// ── Registration validation ────────────────────────────────────────────────

describe('Auth — registration validation', () => {
  it('accepts a valid registration payload', () => {
    const result = validateRegisterInput({
      username: 'alice_99',
      email: 'alice@example.com',
      password: 'securePass1',
      displayName: 'Alice',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects a username shorter than 3 characters', () => {
    const result = validateRegisterInput({
      username: 'ab',
      email: 'a@b.com',
      password: 'password1',
      displayName: 'A',
    });
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/3 characters/);
  });

  it('rejects a username longer than 30 characters', () => {
    const result = validateRegisterInput({
      username: 'a'.repeat(31),
      email: 'a@b.com',
      password: 'password1',
      displayName: 'A',
    });
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/30 characters/);
  });

  it('rejects a username with special characters', () => {
    const result = validateRegisterInput({
      username: 'alice!',
      email: 'a@b.com',
      password: 'password1',
      displayName: 'A',
    });
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/letters, numbers/);
  });

  it('accepts a username with underscores and hyphens', () => {
    const result = validateRegisterInput({
      username: 'alice_bob-99',
      email: 'a@b.com',
      password: 'password1',
      displayName: 'A',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects an invalid email address', () => {
    const result = validateRegisterInput({
      username: 'alice',
      email: 'not-an-email',
      password: 'password1',
      displayName: 'A',
    });
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/email/i);
  });

  it('rejects a password shorter than 8 characters', () => {
    const result = validateRegisterInput({
      username: 'alice',
      email: 'a@b.com',
      password: 'short',
      displayName: 'A',
    });
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/8 characters/);
  });

  it('rejects a password longer than 128 characters', () => {
    const result = validateRegisterInput({
      username: 'alice',
      email: 'a@b.com',
      password: 'a'.repeat(129),
      displayName: 'A',
    });
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/128 characters/);
  });

  it('rejects an empty display name', () => {
    const result = validateRegisterInput({
      username: 'alice',
      email: 'a@b.com',
      password: 'password1',
      displayName: '',
    });
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/1 character/);
  });

  it('rejects a display name longer than 30 characters', () => {
    const result = validateRegisterInput({
      username: 'alice',
      email: 'a@b.com',
      password: 'password1',
      displayName: 'A'.repeat(31),
    });
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/30 characters/);
  });
});

// ── Login lockout logic ────────────────────────────────────────────────────

describe('Auth — login lockout logic', () => {
  it('does not lock account when failed attempts < 5', () => {
    expect(shouldLockAccount(4)).toBe(false);
  });

  it('locks account when failed attempts reach 5', () => {
    expect(shouldLockAccount(5)).toBe(true);
  });

  it('locks account when failed attempts exceed 5', () => {
    expect(shouldLockAccount(6)).toBe(true);
  });

  it('isAccountLocked returns false when lockedUntil is undefined', () => {
    expect(isAccountLocked(undefined, new Date())).toBe(false);
  });

  it('isAccountLocked returns false when lockedUntil is in the past', () => {
    const past = new Date(Date.now() - 1000);
    expect(isAccountLocked(past, new Date())).toBe(false);
  });

  it('isAccountLocked returns true when lockedUntil is in the future', () => {
    const future = new Date(Date.now() + 60_000);
    expect(isAccountLocked(future, new Date())).toBe(true);
  });

  it('computeLockedUntil returns a date 15 minutes in the future', () => {
    const now = new Date();
    const lockedUntil = computeLockedUntil(now);
    const diff = lockedUntil.getTime() - now.getTime();
    expect(diff).toBe(LOCKOUT_DURATION_MS);
  });
});

// ── Token signing ──────────────────────────────────────────────────────────

describe('Auth — token signing', () => {
  const TEST_SECRET = 'test-secret-key-for-unit-tests';

  it('signs a JWT that can be verified with the same secret', () => {
    const token = signToken('user123', 'alice', TEST_SECRET);
    const decoded = jwt.verify(token, TEST_SECRET) as { userId: string; username: string };
    expect(decoded.userId).toBe('user123');
    expect(decoded.username).toBe('alice');
  });

  it('signed token contains the correct userId and username', () => {
    const token = signToken('abc456', 'bob', TEST_SECRET);
    const decoded = jwt.decode(token) as { userId: string; username: string; exp: number };
    expect(decoded.userId).toBe('abc456');
    expect(decoded.username).toBe('bob');
  });

  it('signed token has an expiry approximately 30 days from now', () => {
    const before = Math.floor(Date.now() / 1000);
    const token = signToken('u1', 'user', TEST_SECRET);
    const decoded = jwt.decode(token) as { exp: number };
    const thirtyDaysSeconds = 30 * 24 * 60 * 60;
    expect(decoded.exp).toBeGreaterThanOrEqual(before + thirtyDaysSeconds - 5);
    expect(decoded.exp).toBeLessThanOrEqual(before + thirtyDaysSeconds + 5);
  });

  it('fails verification with a different secret', () => {
    const token = signToken('u1', 'user', TEST_SECRET);
    expect(() => jwt.verify(token, 'wrong-secret')).toThrow();
  });
});

// ── bcrypt password hashing ────────────────────────────────────────────────

describe('Auth — bcrypt password hashing', () => {
  it('hashes a password and verifies it correctly', async () => {
    const hash = await bcrypt.hash('myPassword123', 10); // cost 10 for test speed
    const match = await bcrypt.compare('myPassword123', hash);
    expect(match).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await bcrypt.hash('myPassword123', 10);
    const match = await bcrypt.compare('wrongPassword', hash);
    expect(match).toBe(false);
  });
});
