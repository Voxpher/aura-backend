import { Server as SocketIOServer } from 'socket.io';
import User from '../models/User';
import Mood from '../models/Mood';

/**
 * Represents a single member's mood contribution to the Pulse Board blend.
 *
 * Requirements: 3.4, 3.5
 */
export interface MoodContribution {
  /** Hex color string for this member's current mood, e.g. "#FFD700" */
  color: string;
  /** Timestamp of the member's last mood update */
  lastMoodAt: Date;
}

/**
 * RGB channel values (0–255 each).
 */
export interface RGB {
  r: number;
  g: number;
  b: number;
}

/** Neutral mood color — used when no active members exist (Requirement 3.6) */
const NEUTRAL_COLOR = '#A9A9A9';

/** Active window: members who updated their mood within the last 30 minutes (Requirement 3.4, 3.5) */
const ACTIVE_WINDOW_MS = 30 * 60 * 1000;

/**
 * Parses a 6-digit hex color string into its RGB components.
 *
 * @param hex - A hex color string, e.g. "#FFD700" or "FFD700"
 * @returns RGB object with r, g, b in range 0–255
 */
export function hexToRgb(hex: string): RGB {
  const clean = hex.replace(/^#/, '');
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

/**
 * Converts RGB channel values back to a 6-digit uppercase hex string.
 *
 * @param rgb - RGB object with r, g, b in range 0–255
 * @returns Hex color string, e.g. "#FFD700"
 */
export function rgbToHex(rgb: RGB): string {
  const toHex = (n: number): string => Math.round(n).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

/**
 * Computes the blended Pulse Board color from a list of member mood contributions.
 *
 * Algorithm (Requirement 3.4, 3.5, 3.6):
 * 1. Filter contributions to those with `lastMoodAt` within the last 30 minutes.
 * 2. If no active contributions remain, return the Neutral color (#A9A9A9).
 * 3. Compute equal-weight additive blend:
 *    R = Σ(r_i) / n,  G = Σ(g_i) / n,  B = Σ(b_i) / n
 *    where n = number of active members.
 * 4. Return the result as a hex string.
 *
 * @param contributions - Array of mood contributions from group members
 * @returns Blended hex color string
 */
export function computePulseColor(contributions: MoodContribution[]): string {
  const now = Date.now();

  // Filter to members who updated their mood within the active window
  const active = contributions.filter(
    (c) => now - c.lastMoodAt.getTime() <= ACTIVE_WINDOW_MS
  );

  if (active.length === 0) {
    return NEUTRAL_COLOR;
  }

  const n = active.length;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;

  for (const contribution of active) {
    const { r, g, b } = hexToRgb(contribution.color);
    sumR += r;
    sumG += g;
    sumB += b;
  }

  return rgbToHex({ r: sumR / n, g: sumG / n, b: sumB / n });
}

/**
 * Fetches all members of a group conversation, resolves their current mood colors,
 * computes the blended Pulse Board color, and broadcasts `pulse_board_update` to
 * the group's Socket.io room.
 *
 * Emitted event payload: `{ groupId, blendedColor, activeCount }`
 *
 * Requirements: 3.2, 3.7, 3.8
 *
 * @param groupId - The conversation (group) ID whose Pulse Board should be updated
 * @param io      - The Socket.io server instance used to emit the event
 */
export async function triggerPulseUpdate(
  groupId: string,
  io: SocketIOServer
): Promise<void> {
  // Fetch all members of the group conversation
  const Conversation = (await import('../models/Conversation')).default;
  const conversation = await Conversation.findById(groupId).lean().exec();

  if (!conversation) {
    console.warn(`[PulseEngine] Conversation not found: ${groupId}`);
    return;
  }

  // Collect member user IDs
  const memberIds = conversation.members.map((m) => m.userId);

  // Fetch users with their current mood and last activity
  const users = await User.find(
    { _id: { $in: memberIds } },
    { currentMoodId: 1, updatedAt: 1 }
  )
    .lean()
    .exec();

  // Build mood contributions by resolving each user's current mood color
  const contributions: MoodContribution[] = [];

  for (const user of users) {
    if (!user.currentMoodId) {
      // No mood set — treat as Neutral with a very old timestamp so it falls outside the window
      contributions.push({
        color: NEUTRAL_COLOR,
        lastMoodAt: new Date(0),
      });
      continue;
    }

    const mood = await Mood.findById(user.currentMoodId).lean().exec();
    const color = mood?.color ?? NEUTRAL_COLOR;

    // Use the user's updatedAt as a proxy for when their mood was last set.
    // The profile PATCH endpoint updates this timestamp whenever currentMoodId changes.
    const lastMoodAt = (user as any).updatedAt instanceof Date
      ? (user as any).updatedAt
      : new Date((user as any).updatedAt ?? 0);

    contributions.push({ color, lastMoodAt });
  }

  const blendedColor = computePulseColor(contributions);

  // Count active members (those whose mood was updated within the last 30 minutes)
  const now = Date.now();
  const activeCount = contributions.filter(
    (c) => now - c.lastMoodAt.getTime() <= ACTIVE_WINDOW_MS
  ).length;

  // Broadcast to the group's Socket.io room (Requirement 3.7, 3.8)
  io.to(groupId).emit('pulse_board_update', {
    groupId,
    blendedColor,
    activeCount,
  });
}
