/**
 * Unit tests for conversationService — group name validation, insufficient members.
 * Requirements: 8.2, 8.3, 8.8
 *
 * Mongoose models are mocked so no real DB connection is needed.
 */

jest.mock('../src/models', () => ({
  Conversation: {
    findOne: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
  },
  IConversation: {},
  IConversationMember: {},
}));

jest.mock('../src/socket', () => ({
  getIO: jest.fn(() => ({
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  })),
}));

import { Conversation } from '../src/models';
import { createConversation } from '../src/services/conversationService';
import { Types } from 'mongoose';

const requesterId = new Types.ObjectId().toString();

function makeGroupInput(name: string, memberIds: string[]) {
  return {
    type: 'group' as const,
    requesterId,
    name,
    memberIds,
  };
}

// ── Group name validation ──────────────────────────────────────────────────

describe('conversationService — group name validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects an empty group name', async () => {
    await expect(
      createConversation(makeGroupInput('', [
        new Types.ObjectId().toString(),
        new Types.ObjectId().toString(),
      ]))
    ).rejects.toMatchObject({ code: 'INVALID_GROUP_NAME', status: 400 });
  });

  it('rejects a group name that is only whitespace', async () => {
    await expect(
      createConversation(makeGroupInput('   ', [
        new Types.ObjectId().toString(),
        new Types.ObjectId().toString(),
      ]))
    ).rejects.toMatchObject({ code: 'INVALID_GROUP_NAME', status: 400 });
  });

  it('rejects a group name longer than 50 characters', async () => {
    await expect(
      createConversation(makeGroupInput('A'.repeat(51), [
        new Types.ObjectId().toString(),
        new Types.ObjectId().toString(),
      ]))
    ).rejects.toMatchObject({ code: 'INVALID_GROUP_NAME', status: 400 });
  });

  it('accepts a group name of exactly 50 characters', async () => {
    const mockConversation = {
      _id: new Types.ObjectId(),
      type: 'group',
      name: 'A'.repeat(50),
      members: [],
    };
    (Conversation.create as jest.Mock).mockResolvedValue(mockConversation);

    const result = await createConversation(
      makeGroupInput('A'.repeat(50), [
        new Types.ObjectId().toString(),
        new Types.ObjectId().toString(),
      ])
    );
    expect(result.created).toBe(true);
  });

  it('accepts a group name of exactly 1 character', async () => {
    const mockConversation = {
      _id: new Types.ObjectId(),
      type: 'group',
      name: 'X',
      members: [],
    };
    (Conversation.create as jest.Mock).mockResolvedValue(mockConversation);

    const result = await createConversation(
      makeGroupInput('X', [
        new Types.ObjectId().toString(),
        new Types.ObjectId().toString(),
      ])
    );
    expect(result.created).toBe(true);
  });

  it('accepts a valid group name within bounds', async () => {
    const mockConversation = {
      _id: new Types.ObjectId(),
      type: 'group',
      name: 'My Group',
      members: [],
    };
    (Conversation.create as jest.Mock).mockResolvedValue(mockConversation);

    const result = await createConversation(
      makeGroupInput('My Group', [
        new Types.ObjectId().toString(),
        new Types.ObjectId().toString(),
      ])
    );
    expect(result.created).toBe(true);
  });
});

// ── Insufficient members validation ───────────────────────────────────────

describe('conversationService — insufficient members validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects when no other members are provided', async () => {
    await expect(
      createConversation(makeGroupInput('My Group', []))
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_MEMBERS', status: 400 });
  });

  it('rejects when only 1 other member is provided', async () => {
    await expect(
      createConversation(makeGroupInput('My Group', [new Types.ObjectId().toString()]))
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_MEMBERS', status: 400 });
  });

  it('rejects when memberIds only contains the requester (no other members)', async () => {
    await expect(
      createConversation(makeGroupInput('My Group', [requesterId]))
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_MEMBERS', status: 400 });
  });

  it('rejects when memberIds has 2 entries but both are the requester (deduplication)', async () => {
    await expect(
      createConversation(makeGroupInput('My Group', [requesterId, requesterId]))
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_MEMBERS', status: 400 });
  });

  it('accepts when exactly 2 other members are provided', async () => {
    const mockConversation = {
      _id: new Types.ObjectId(),
      type: 'group',
      name: 'My Group',
      members: [],
    };
    (Conversation.create as jest.Mock).mockResolvedValue(mockConversation);

    const result = await createConversation(
      makeGroupInput('My Group', [
        new Types.ObjectId().toString(),
        new Types.ObjectId().toString(),
      ])
    );
    expect(result.created).toBe(true);
  });

  it('accepts when 3 other members are provided', async () => {
    const mockConversation = {
      _id: new Types.ObjectId(),
      type: 'group',
      name: 'My Group',
      members: [],
    };
    (Conversation.create as jest.Mock).mockResolvedValue(mockConversation);

    const result = await createConversation(
      makeGroupInput('My Group', [
        new Types.ObjectId().toString(),
        new Types.ObjectId().toString(),
        new Types.ObjectId().toString(),
      ])
    );
    expect(result.created).toBe(true);
  });

  it('deduplicates member IDs before checking the count', async () => {
    const memberId = new Types.ObjectId().toString();
    // Same ID twice — should count as 1 unique other member → insufficient
    await expect(
      createConversation(makeGroupInput('My Group', [memberId, memberId]))
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_MEMBERS', status: 400 });
  });
});
