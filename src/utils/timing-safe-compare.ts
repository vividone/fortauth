import { timingSafeEqual } from 'crypto';

/**
 * Constant-time comparison for hex-encoded hash strings.
 * Prevents timing attacks by ensuring comparison time is
 * independent of where the strings differ.
 */
export function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}
