/**
 * Unit tests for pulseEngine — computePulseColor, hexToRgb, rgbToHex.
 * Requirements: 3.4, 3.5, 3.6
 *
 * All functions under test are pure — no DB or Socket.io needed.
 */

import {
  computePulseColor,
  hexToRgb,
  rgbToHex,
  MoodContribution,
  RGB,
} from '../src/services/pulseEngine';

// ── hexToRgb ──────────────────────────────────────────────────────────────

describe('hexToRgb', () => {
  it('parses a hex color with # prefix', () => {
    expect(hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('parses a hex color without # prefix', () => {
    expect(hexToRgb('00FF00')).toEqual({ r: 0, g: 255, b: 0 });
  });

  it('parses black (#000000)', () => {
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('parses white (#FFFFFF)', () => {
    expect(hexToRgb('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('parses a mixed color (#FFD700 — gold)', () => {
    expect(hexToRgb('#FFD700')).toEqual({ r: 255, g: 215, b: 0 });
  });

  it('parses neutral gray (#A9A9A9)', () => {
    expect(hexToRgb('#A9A9A9')).toEqual({ r: 169, g: 169, b: 169 });
  });
});

// ── rgbToHex ──────────────────────────────────────────────────────────────

describe('rgbToHex', () => {
  it('converts red to #FF0000', () => {
    expect(rgbToHex({ r: 255, g: 0, b: 0 })).toBe('#FF0000');
  });

  it('converts green to #00FF00', () => {
    expect(rgbToHex({ r: 0, g: 255, b: 0 })).toBe('#00FF00');
  });

  it('converts black to #000000', () => {
    expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe('#000000');
  });

  it('converts white to #FFFFFF', () => {
    expect(rgbToHex({ r: 255, g: 255, b: 255 })).toBe('#FFFFFF');
  });

  it('rounds fractional channel values', () => {
    // 0.6 rounds to 1 → #010000
    const result = rgbToHex({ r: 0.6, g: 0, b: 0 });
    expect(result).toBe('#010000');
  });
});

// ── hexToRgb / rgbToHex round-trip ────────────────────────────────────────

describe('hexToRgb / rgbToHex round-trip', () => {
  const colors = [
    '#FF0000',
    '#00FF00',
    '#0000FF',
    '#FFD700',
    '#A9A9A9',
    '#123456',
    '#ABCDEF',
    '#000000',
    '#FFFFFF',
  ];

  colors.forEach((hex) => {
    it(`round-trips ${hex}`, () => {
      expect(rgbToHex(hexToRgb(hex))).toBe(hex);
    });
  });
});

// ── computePulseColor ─────────────────────────────────────────────────────

const ACTIVE_WINDOW_MS = 30 * 60 * 1000;

function recentDate(offsetMs = 0): Date {
  return new Date(Date.now() - offsetMs);
}

function staleDate(): Date {
  // 31 minutes ago — outside the 30-minute active window
  return new Date(Date.now() - 31 * 60 * 1000);
}

describe('computePulseColor', () => {
  it('returns neutral (#A9A9A9) when contributions array is empty', () => {
    expect(computePulseColor([])).toBe('#A9A9A9');
  });

  it('returns neutral when all members are inactive (stale timestamps)', () => {
    const contributions: MoodContribution[] = [
      { color: '#FF0000', lastMoodAt: staleDate() },
      { color: '#00FF00', lastMoodAt: staleDate() },
    ];
    expect(computePulseColor(contributions)).toBe('#A9A9A9');
  });

  it('returns the single active member color when only one is active', () => {
    const contributions: MoodContribution[] = [
      { color: '#FF0000', lastMoodAt: recentDate(1000) },
    ];
    expect(computePulseColor(contributions)).toBe('#FF0000');
  });

  it('blends two complementary colors to produce a mid-tone', () => {
    // Red (#FF0000) + Blue (#0000FF) → average = #7F007F
    const contributions: MoodContribution[] = [
      { color: '#FF0000', lastMoodAt: recentDate(1000) },
      { color: '#0000FF', lastMoodAt: recentDate(1000) },
    ];
    const result = computePulseColor(contributions);
    const rgb = hexToRgb(result);
    // R and B should be ~127-128, G should be 0
    expect(rgb.r).toBeGreaterThanOrEqual(127);
    expect(rgb.r).toBeLessThanOrEqual(128);
    expect(rgb.g).toBe(0);
    expect(rgb.b).toBeGreaterThanOrEqual(127);
    expect(rgb.b).toBeLessThanOrEqual(128);
  });

  it('blends three equal colors to produce the same color', () => {
    const contributions: MoodContribution[] = [
      { color: '#FF0000', lastMoodAt: recentDate(1000) },
      { color: '#FF0000', lastMoodAt: recentDate(2000) },
      { color: '#FF0000', lastMoodAt: recentDate(3000) },
    ];
    expect(computePulseColor(contributions)).toBe('#FF0000');
  });

  it('ignores inactive members and only blends active ones', () => {
    // Active: red only. Inactive: blue (stale).
    const contributions: MoodContribution[] = [
      { color: '#FF0000', lastMoodAt: recentDate(1000) },
      { color: '#0000FF', lastMoodAt: staleDate() },
    ];
    expect(computePulseColor(contributions)).toBe('#FF0000');
  });

  it('includes a member whose mood was updated exactly at the active window boundary', () => {
    // Exactly 30 minutes ago — should be included (elapsed <= ACTIVE_WINDOW_MS)
    const contributions: MoodContribution[] = [
      { color: '#FF0000', lastMoodAt: new Date(Date.now() - ACTIVE_WINDOW_MS) },
    ];
    expect(computePulseColor(contributions)).toBe('#FF0000');
  });

  it('excludes a member whose mood was updated just past the active window', () => {
    // 30 minutes + 1 ms ago — should be excluded
    const contributions: MoodContribution[] = [
      { color: '#FF0000', lastMoodAt: new Date(Date.now() - ACTIVE_WINDOW_MS - 1) },
    ];
    expect(computePulseColor(contributions)).toBe('#A9A9A9');
  });

  it('blends white and black to produce mid-gray', () => {
    const contributions: MoodContribution[] = [
      { color: '#FFFFFF', lastMoodAt: recentDate(1000) },
      { color: '#000000', lastMoodAt: recentDate(1000) },
    ];
    const result = computePulseColor(contributions);
    const rgb = hexToRgb(result);
    expect(rgb.r).toBeGreaterThanOrEqual(127);
    expect(rgb.r).toBeLessThanOrEqual(128);
    expect(rgb.g).toBeGreaterThanOrEqual(127);
    expect(rgb.g).toBeLessThanOrEqual(128);
    expect(rgb.b).toBeGreaterThanOrEqual(127);
    expect(rgb.b).toBeLessThanOrEqual(128);
  });

  it('returns a valid hex string for any blend', () => {
    const contributions: MoodContribution[] = [
      { color: '#123456', lastMoodAt: recentDate(1000) },
      { color: '#ABCDEF', lastMoodAt: recentDate(2000) },
      { color: '#FF8800', lastMoodAt: recentDate(3000) },
    ];
    const result = computePulseColor(contributions);
    expect(result).toMatch(/^#[0-9A-F]{6}$/);
  });
});
