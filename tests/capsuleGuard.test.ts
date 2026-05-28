/**
 * Unit tests for the capsuleGuard middleware and sanitiseMessage helpers.
 *
 * Requirements: 4.5, 4.11, 4.12
 * Property 12: Locked Capsule Content Never Exposed
 */

import { sanitiseMessage, sanitiseMessages } from '../src/middleware/capsuleGuard';

// ── sanitiseMessage ────────────────────────────────────────────────────────

describe('sanitiseMessage', () => {
  it('removes content from a locked capsule message', () => {
    const msg: Record<string, unknown> = {
      _id: 'abc',
      content: 'secret text',
      capsule: { enabled: true, status: 'locked', type: 'time' },
    };
    sanitiseMessage(msg);
    expect(msg.content).toBeUndefined();
  });

  it('preserves content when capsule is unlocked', () => {
    const msg: Record<string, unknown> = {
      _id: 'abc',
      content: 'visible text',
      capsule: { enabled: true, status: 'unlocked', type: 'time' },
    };
    sanitiseMessage(msg);
    expect(msg.content).toBe('visible text');
  });

  it('preserves content when capsule is disabled (enabled: false)', () => {
    const msg: Record<string, unknown> = {
      _id: 'abc',
      content: 'visible text',
      capsule: { enabled: false, status: 'locked', type: 'time' },
    };
    sanitiseMessage(msg);
    expect(msg.content).toBe('visible text');
  });

  it('preserves content when there is no capsule sub-document', () => {
    const msg: Record<string, unknown> = {
      _id: 'abc',
      content: 'plain message',
    };
    sanitiseMessage(msg);
    expect(msg.content).toBe('plain message');
  });

  it('preserves content when capsule is undefined', () => {
    const msg: Record<string, unknown> = {
      _id: 'abc',
      content: 'plain message',
      capsule: undefined,
    };
    sanitiseMessage(msg);
    expect(msg.content).toBe('plain message');
  });

  it('returns the same object reference', () => {
    const msg: Record<string, unknown> = {
      _id: 'abc',
      content: 'text',
      capsule: { enabled: true, status: 'locked' },
    };
    const result = sanitiseMessage(msg);
    expect(result).toBe(msg);
  });
});

// ── sanitiseMessages ───────────────────────────────────────────────────────

describe('sanitiseMessages', () => {
  it('strips content from all locked capsule messages in an array', () => {
    const msgs: Record<string, unknown>[] = [
      {
        _id: '1',
        content: 'secret',
        capsule: { enabled: true, status: 'locked' },
      },
      {
        _id: '2',
        content: 'visible',
        capsule: { enabled: true, status: 'unlocked' },
      },
      {
        _id: '3',
        content: 'plain',
      },
    ];
    sanitiseMessages(msgs);
    expect(msgs[0].content).toBeUndefined();
    expect(msgs[1].content).toBe('visible');
    expect(msgs[2].content).toBe('plain');
  });

  it('handles an empty array', () => {
    expect(() => sanitiseMessages([])).not.toThrow();
  });
});

// ── capsuleGuard middleware (res.json interception) ────────────────────────

import { capsuleGuard } from '../src/middleware/capsuleGuard';

// node-mocks-http may not be installed; use a lightweight manual mock instead
describe('capsuleGuard middleware', () => {
  function makeResMock() {
    let capturedBody: unknown;
    const res: Record<string, unknown> = {
      json: function (body: unknown) {
        capturedBody = body;
        return res;
      },
      getBody: () => capturedBody,
    };
    return res as unknown as import('express').Response & { getBody: () => unknown };
  }

  function runMiddleware(res: import('express').Response): Promise<void> {
    return new Promise((resolve) => {
      const req = {} as import('express').Request;
      capsuleGuard(req, res, () => resolve());
    });
  }

  it('strips content from a single locked capsule message at top level', async () => {
    const res = makeResMock();
    await runMiddleware(res);

    const body = {
      _id: '1',
      content: 'secret',
      capsule: { enabled: true, status: 'locked' },
    };
    res.json(body);
    const sent = (res as unknown as { getBody: () => Record<string, unknown> }).getBody() as Record<string, unknown>;
    expect(sent.content).toBeUndefined();
  });

  it('preserves content for an unlocked capsule at top level', async () => {
    const res = makeResMock();
    await runMiddleware(res);

    const body = {
      _id: '1',
      content: 'visible',
      capsule: { enabled: true, status: 'unlocked' },
    };
    res.json(body);
    const sent = (res as unknown as { getBody: () => Record<string, unknown> }).getBody() as Record<string, unknown>;
    expect(sent.content).toBe('visible');
  });

  it('strips content from locked messages inside a { messages: [] } wrapper', async () => {
    const res = makeResMock();
    await runMiddleware(res);

    const body = {
      messages: [
        { _id: '1', content: 'secret', capsule: { enabled: true, status: 'locked' } },
        { _id: '2', content: 'visible', capsule: { enabled: true, status: 'unlocked' } },
      ],
    };
    res.json(body);
    const sent = (res as unknown as { getBody: () => { messages: Record<string, unknown>[] } }).getBody() as { messages: Record<string, unknown>[] };
    expect(sent.messages[0].content).toBeUndefined();
    expect(sent.messages[1].content).toBe('visible');
  });

  it('strips content from a top-level array of messages', async () => {
    const res = makeResMock();
    await runMiddleware(res);

    const body = [
      { _id: '1', content: 'secret', capsule: { enabled: true, status: 'locked' } },
      { _id: '2', content: 'visible' },
    ];
    res.json(body);
    const sent = (res as unknown as { getBody: () => Record<string, unknown>[] }).getBody() as Record<string, unknown>[];
    expect(sent[0].content).toBeUndefined();
    expect(sent[1].content).toBe('visible');
  });

  it('passes through non-message payloads unchanged', async () => {
    const res = makeResMock();
    await runMiddleware(res);

    const body = { status: 'ok', timestamp: '2024-01-01' };
    res.json(body);
    const sent = (res as unknown as { getBody: () => Record<string, unknown> }).getBody() as Record<string, unknown>;
    expect(sent).toEqual({ status: 'ok', timestamp: '2024-01-01' });
  });

  it('passes through null body unchanged', async () => {
    const res = makeResMock();
    await runMiddleware(res);

    res.json(null);
    const sent = (res as unknown as { getBody: () => unknown }).getBody();
    expect(sent).toBeNull();
  });
});

// ── Capsule unlock timestamp validation (server-side) ─────────────────────

describe('capsule unlockAt validation logic', () => {
  /**
   * Extracted validation logic matching what the route handler does.
   * Tests the rule: unlockAt must be >= now + 60 seconds.
   */
  function validateUnlockAt(unlockAt: Date): { valid: boolean; reason?: string } {
    const minUnlockAt = new Date(Date.now() + 60_000);
    if (unlockAt < minUnlockAt) {
      return { valid: false, reason: 'UNLOCK_AT_TOO_SOON' };
    }
    return { valid: true };
  }

  it('rejects an unlockAt that is exactly now', () => {
    const result = validateUnlockAt(new Date());
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('UNLOCK_AT_TOO_SOON');
  });

  it('rejects an unlockAt that is 59 seconds in the future', () => {
    const result = validateUnlockAt(new Date(Date.now() + 59_000));
    expect(result.valid).toBe(false);
  });

  it('rejects an unlockAt that is in the past', () => {
    const result = validateUnlockAt(new Date(Date.now() - 1000));
    expect(result.valid).toBe(false);
  });

  it('accepts an unlockAt that is exactly 60 seconds in the future', () => {
    const result = validateUnlockAt(new Date(Date.now() + 60_000));
    expect(result.valid).toBe(true);
  });

  it('accepts an unlockAt that is 5 minutes in the future', () => {
    const result = validateUnlockAt(new Date(Date.now() + 5 * 60_000));
    expect(result.valid).toBe(true);
  });

  it('accepts an unlockAt that is 1 day in the future', () => {
    const result = validateUnlockAt(new Date(Date.now() + 24 * 60 * 60_000));
    expect(result.valid).toBe(true);
  });
});
