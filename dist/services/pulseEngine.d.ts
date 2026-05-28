import { Server as SocketIOServer } from 'socket.io';
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
/**
 * Parses a 6-digit hex color string into its RGB components.
 *
 * @param hex - A hex color string, e.g. "#FFD700" or "FFD700"
 * @returns RGB object with r, g, b in range 0–255
 */
export declare function hexToRgb(hex: string): RGB;
/**
 * Converts RGB channel values back to a 6-digit uppercase hex string.
 *
 * @param rgb - RGB object with r, g, b in range 0–255
 * @returns Hex color string, e.g. "#FFD700"
 */
export declare function rgbToHex(rgb: RGB): string;
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
export declare function computePulseColor(contributions: MoodContribution[]): string;
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
export declare function triggerPulseUpdate(groupId: string, io: SocketIOServer): Promise<void>;
//# sourceMappingURL=pulseEngine.d.ts.map