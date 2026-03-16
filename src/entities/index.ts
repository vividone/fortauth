import { FortUser } from './fort-user.entity';
import { FortRefreshToken } from './fort-refresh-token.entity';
import { FortSession } from './fort-session.entity';
import { FortApiKey } from './fort-api-key.entity';
import { FortMfaSecret } from './fort-mfa-secret.entity';
import { FortLoginAttempt } from './fort-login-attempt.entity';
import { FortPasswordReset } from './fort-password-reset.entity';
import { FortMagicLink } from './fort-magic-link.entity';
import { FortOAuthAccount } from './fort-oauth-account.entity';
import { FortOtp } from './fort-otp.entity';

export {
  FortUser,
  FortRefreshToken,
  FortSession,
  FortApiKey,
  FortMfaSecret,
  FortLoginAttempt,
  FortPasswordReset,
  FortMagicLink,
  FortOAuthAccount,
  FortOtp,
};

/** All FortAuth entities — used by FortAuthCoreModule for TypeORM registration */
export const FORT_ENTITIES = [
  FortUser,
  FortRefreshToken,
  FortSession,
  FortApiKey,
  FortMfaSecret,
  FortLoginAttempt,
  FortPasswordReset,
  FortMagicLink,
  FortOAuthAccount,
  FortOtp,
] as const;
