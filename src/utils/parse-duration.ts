/**
 * Parse a human-readable duration string into milliseconds.
 *
 * Supported units: ms, s, m, h, d
 * @example parseDuration('15m') // 900_000
 */
export function parseDuration(duration: string, fallbackMs = 15 * 60 * 1000): number {
  const match = duration.match(/^(\d+)(ms|s|m|h|d)$/);
  if (!match) return fallbackMs;

  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return value * (multipliers[unit] || 86_400_000);
}
