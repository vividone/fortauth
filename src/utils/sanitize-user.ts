import type { FortUser } from '../entities/fort-user.entity';

/**
 * Strip sensitive fields from a user entity before returning to the client.
 */
export function sanitizeUser(user: FortUser): Partial<FortUser> {
  const { passwordHash, lockedUntil, ...safe } = user;
  return safe;
}
