/**
 * Unit tests for messageService — stripLockedCapsuleContent and getMessages pagination.
 * Requirements: 2.1, 4.5, 4.11
 *
 * Mongoose models are mocked so no real DB connection is needed.
 */

// ── Mock Mongoose models ───────────────────────────────────────────────────

jest.mock('../src/models', () => ({
  Message: {
    find: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
  },
  Mood: {
    findById: jest.fn(),
  },
  Conversation: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

jest.mock('../src/socket', () => ({
  getIO: jest.fn(() => ({
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  })),
}));

import { Message } from '../src/models';
import {
  stripLockedCapsuleContent,
  getMessages,
} from '../src/services/messageService';
import { IMessage } from '../src/models/Message';
import { Types } from 'mongoose';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeMessage(overrides: Partial<Record<string, unknown>> = {}): IMessage {
  const base: Record<string, unknown> = {
    _id: new Types.ObjectId(),
    conversationId: new Types.ObjectId(),
    senderId: new Types.ObjectId(),
    content: 'Hello world',
    moodId: 'neutral',
    depth: 0,
    deliveredTo: [],
    readBy: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  // Attach a toObject method that returns the plain object
  base.toObject = () => ({ ...base });
  return base as unknown as IMessage;
}

// ── stripLockedCapsuleContent ──────────────────────────────────────────────

describe('stripLockedCapsuleContent', () => {
  it('removes content from a locked capsule message', () => {
    const msg = makeMessage({
      content: 'secret',
      capsule: { enabled: true, status: 'locked', type: 'time' },
    });
    const result = stripLockedCapsuleContent(msg);
    expect(result.content).toBeUndefined();
  });

  it('preserves content when capsule is unlocked', () => {
    const msg = makeMessage({
      content: 'visible',
      capsule: { enabled: true, status: 'unlocked', type: 'time' },
    });
    const result = stripLockedCapsuleContent(msg);
    expect(result.content).toBe('visible');
  });

  it('preserves content when capsule.enabled is false', () => {
    const msg = makeMessage({
      content: 'visible',
      capsule: { enabled: false, status: 'locked', type: 'time' },
    });
    const result = stripLockedCapsuleContent(msg);
    expect(result.content).toBe('visible');
  });

  it('preserves content when there is no capsule sub-document', () => {
    const msg = makeMessage({ content: 'plain message' });
    const result = stripLockedCapsuleContent(msg);
    expect(result.content).toBe('plain message');
  });

  it('preserves other fields when stripping content', () => {
    const id = new Types.ObjectId();
    const msg = makeMessage({
      _id: id,
      content: 'secret',
      moodId: 'happy',
      capsule: { enabled: true, status: 'locked' },
    });
    const result = stripLockedCapsuleContent(msg);
    expect(result.moodId).toBe('happy');
    expect(result._id).toEqual(id);
  });

  it('returns a plain object (not the original Mongoose document)', () => {
    const msg = makeMessage({ content: 'text' });
    const result = stripLockedCapsuleContent(msg);
    // Should be a plain object, not have the toObject method
    expect(typeof result).toBe('object');
  });
});

// ── getMessages pagination ─────────────────────────────────────────────────

describe('getMessages — pagination logic', () => {
  const conversationId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('defaults limit to 50 when not specified', async () => {
    const mockFind = Message.find as jest.Mock;
    mockFind.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });

    await getMessages({ conversationId });

    const limitCall = mockFind.mock.results[0].value.sort.mock.results[0].value.limit;
    expect(limitCall).toHaveBeenCalledWith(50);
  });

  it('caps limit at 100 even when a higher value is requested', async () => {
    const mockFind = Message.find as jest.Mock;
    mockFind.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });

    await getMessages({ conversationId, limit: 200 });

    const limitCall = mockFind.mock.results[0].value.sort.mock.results[0].value.limit;
    expect(limitCall).toHaveBeenCalledWith(100);
  });

  it('respects a custom limit within bounds', async () => {
    const mockFind = Message.find as jest.Mock;
    mockFind.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });

    await getMessages({ conversationId, limit: 25 });

    const limitCall = mockFind.mock.results[0].value.sort.mock.results[0].value.limit;
    expect(limitCall).toHaveBeenCalledWith(25);
  });

  it('strips content from locked capsule messages in results', async () => {
    const mockFind = Message.find as jest.Mock;
    const messages = [
      {
        _id: new Types.ObjectId(),
        content: 'secret',
        capsule: { enabled: true, status: 'locked' },
        createdAt: new Date(),
      },
      {
        _id: new Types.ObjectId(),
        content: 'visible',
        capsule: { enabled: true, status: 'unlocked' },
        createdAt: new Date(),
      },
      {
        _id: new Types.ObjectId(),
        content: 'plain',
        createdAt: new Date(),
      },
    ];
    mockFind.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(messages),
    });

    const result = await getMessages({ conversationId });

    expect(result[0].content).toBeUndefined();
    expect(result[1].content).toBe('visible');
    expect(result[2].content).toBe('plain');
  });

  it('throws INVALID_CURSOR when before is not a valid ObjectId', async () => {
    await expect(
      getMessages({ conversationId, before: 'not-valid-id' })
    ).rejects.toMatchObject({ code: 'INVALID_CURSOR' });
  });

  it('adds a createdAt filter when a valid before cursor is provided', async () => {
    const cursorId = new Types.ObjectId();
    const cursorDate = new Date('2024-01-15T10:00:00Z');

    const mockFindById = Message.findById as jest.Mock;
    mockFindById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ createdAt: cursorDate }),
    });

    const mockFind = Message.find as jest.Mock;
    mockFind.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });

    await getMessages({ conversationId, before: cursorId.toString() });

    const filterArg = mockFind.mock.calls[0][0] as Record<string, unknown>;
    expect(filterArg.createdAt).toEqual({ $lt: cursorDate });
  });

  it('returns messages sorted newest-first (sort called with createdAt: -1)', async () => {
    const mockFind = Message.find as jest.Mock;
    const sortMock = jest.fn().mockReturnThis();
    mockFind.mockReturnValue({
      sort: sortMock,
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });

    await getMessages({ conversationId });

    expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
  });
});
