/**
 * Unit tests for echoThreadService — depth enforcement.
 * Requirements: 5.3, 5.6
 *
 * Mongoose models are mocked so no real DB connection is needed.
 */

jest.mock('../src/models', () => ({
  Message: {
    findById: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
  },
}));

jest.mock('../src/socket', () => ({
  getIO: jest.fn(() => ({
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  })),
}));

// Mock messageService to avoid its own model dependencies
jest.mock('../src/services/messageService', () => ({
  stripLockedCapsuleContent: jest.fn((msg: Record<string, unknown>) => {
    const obj = { ...msg };
    return obj;
  }),
}));

import { Message } from '../src/models';
import { createReply } from '../src/services/echoThreadService';
import { Types } from 'mongoose';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeParentMessage(depth: number) {
  const id = new Types.ObjectId();
  const conversationId = new Types.ObjectId();
  return {
    _id: id,
    conversationId,
    senderId: new Types.ObjectId(),
    content: 'parent message',
    moodId: 'neutral',
    depth,
    deliveredTo: [],
    readBy: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    toObject: function () { return { ...this }; },
  };
}

function makeReplyDoc(depth: number) {
  const id = new Types.ObjectId();
  return {
    _id: id,
    conversationId: new Types.ObjectId(),
    senderId: new Types.ObjectId(),
    content: 'reply content',
    moodId: 'neutral',
    depth,
    deliveredTo: [],
    readBy: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    toObject: function () { return { ...this }; },
  };
}

// ── Depth enforcement ──────────────────────────────────────────────────────

describe('echoThreadService — depth enforcement', () => {
  const senderId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows a reply at depth 1 (parent depth 0)', async () => {
    const parent = makeParentMessage(0);
    (Message.findById as jest.Mock).mockResolvedValue(parent);
    (Message.create as jest.Mock).mockResolvedValue(makeReplyDoc(1));

    const result = await createReply({
      parentMessageId: parent._id.toString(),
      senderId,
      content: 'reply',
    });

    expect(result).toBeDefined();
    expect(Message.create).toHaveBeenCalledWith(
      expect.objectContaining({ depth: 1 })
    );
  });

  it('allows a reply at depth 2 (parent depth 1)', async () => {
    const parent = makeParentMessage(1);
    (Message.findById as jest.Mock).mockResolvedValue(parent);
    (Message.create as jest.Mock).mockResolvedValue(makeReplyDoc(2));

    await createReply({
      parentMessageId: parent._id.toString(),
      senderId,
      content: 'reply',
    });

    expect(Message.create).toHaveBeenCalledWith(
      expect.objectContaining({ depth: 2 })
    );
  });

  it('allows a reply at depth 5 (parent depth 4)', async () => {
    const parent = makeParentMessage(4);
    (Message.findById as jest.Mock).mockResolvedValue(parent);
    (Message.create as jest.Mock).mockResolvedValue(makeReplyDoc(5));

    const result = await createReply({
      parentMessageId: parent._id.toString(),
      senderId,
      content: 'reply at max depth',
    });

    expect(result).toBeDefined();
    expect(Message.create).toHaveBeenCalledWith(
      expect.objectContaining({ depth: 5 })
    );
  });

  it('rejects a reply at depth 6 (parent depth 5) with MAX_DEPTH_EXCEEDED', async () => {
    const parent = makeParentMessage(5);
    (Message.findById as jest.Mock).mockResolvedValue(parent);

    await expect(
      createReply({
        parentMessageId: parent._id.toString(),
        senderId,
        content: 'too deep',
      })
    ).rejects.toMatchObject({
      code: 'MAX_DEPTH_EXCEEDED',
      statusCode: 400,
    });

    expect(Message.create).not.toHaveBeenCalled();
  });

  it('rejects when parent message does not exist', async () => {
    (Message.findById as jest.Mock).mockResolvedValue(null);

    await expect(
      createReply({
        parentMessageId: new Types.ObjectId().toString(),
        senderId,
        content: 'orphan reply',
      })
    ).rejects.toMatchObject({
      code: 'MESSAGE_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('rejects when parentMessageId is not a valid ObjectId', async () => {
    await expect(
      createReply({
        parentMessageId: 'not-valid-id',
        senderId,
        content: 'reply',
      })
    ).rejects.toMatchObject({
      code: 'INVALID_MESSAGE_ID',
      statusCode: 400,
    });
  });

  it('computes depth as parent.depth + 1', async () => {
    for (const parentDepth of [0, 1, 2, 3, 4]) {
      jest.clearAllMocks();
      const parent = makeParentMessage(parentDepth);
      (Message.findById as jest.Mock).mockResolvedValue(parent);
      (Message.create as jest.Mock).mockResolvedValue(makeReplyDoc(parentDepth + 1));

      await createReply({
        parentMessageId: parent._id.toString(),
        senderId,
        content: 'reply',
      });

      expect(Message.create).toHaveBeenCalledWith(
        expect.objectContaining({ depth: parentDepth + 1 })
      );
    }
  });
});
