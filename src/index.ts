// ─── Module ──────────────────────────────────────────────
export { FortAuthModule, FortAuthAsyncOptions } from './fortauth.module';
export { FortAuthCoreModule } from './fortauth-core.module';

// ─── Interfaces ──────────────────────────────────────────
export { FortAuthOptions, FortAuthOAuthProviderOptions } from './interfaces';

// ─── Entities ────────────────────────────────────────────
export { FortUser } from './entities/fort-user.entity';
export { FortRefreshToken } from './entities/fort-refresh-token.entity';
export { FortSession } from './entities/fort-session.entity';
export { FortApiKey } from './entities/fort-api-key.entity';
export { FortMfaSecret } from './entities/fort-mfa-secret.entity';
export { FortLoginAttempt } from './entities/fort-login-attempt.entity';
export { FortPasswordReset } from './entities/fort-password-reset.entity';
export { FortMagicLink } from './entities/fort-magic-link.entity';
export { FortOAuthAccount } from './entities/fort-oauth-account.entity';
export { FortOtp } from './entities/fort-otp.entity';
export { OtpPurpose } from './entities/fort-otp.entity';
export { FORT_ENTITIES } from './entities';

// ─── Decorators ──────────────────────────────────────────
export { Public } from './decorators/public.decorator';
export { Roles } from './decorators/roles.decorator';
export { Permissions } from './decorators/permissions.decorator';
export { CurrentUser } from './decorators/current-user.decorator';

// ─── Guards ──────────────────────────────────────────────
export { FortAuthGuard } from './guards/fort-auth.guard';
export { RolesGuard } from './guards/roles.guard';
export { PermissionsGuard } from './guards/permissions.guard';
export { ApiKeyGuard } from './guards/api-key.guard';

// ─── Services ────────────────────────────────────────────
export { AuthService, LoginResult } from './auth/auth.service';
export { TokenService, TokenPair } from './auth/token.service';
export { PasswordService } from './auth/password.service';
export { SessionsService } from './sessions/sessions.service';
export { BruteForceService } from './rate-limiting/brute-force.service';
export { MfaService } from './mfa/mfa.service';
export { ApiKeysService } from './api-keys/api-keys.service';
export { MagicLinkService } from './magic-link/magic-link.service';
export { OAuthService, OAuthProfile } from './oauth/oauth.service';
export { OtpService } from './auth/otp.service';
export { CleanupService, CleanupResult } from './maintenance/cleanup.service';

// ─── Events ──────────────────────────────────────────────
export { FortAuthEvent } from './events/fort-auth-events';
export {
  FortAuthEventEmitter,
  FortAuthEventPayload,
} from './events/fort-auth-event-emitter';

// ─── DTOs ────────────────────────────────────────────────
export {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  VerifyEmailDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  UpdateProfileDto,
  MfaVerifyLoginDto,
} from './dto/auth.dto';
export { EnableMfaDto, DisableMfaDto, RegenerateBackupCodesDto } from './dto/mfa.dto';
export { CreateApiKeyDto } from './dto/api-key.dto';

// ─── Utilities ──────────────────────────────────────────
export { parseDuration } from './utils/parse-duration';
export { sanitizeUser } from './utils/sanitize-user';
export { timingSafeCompare } from './utils/timing-safe-compare';

// ─── Constants ───────────────────────────────────────────
export {
  FORTAUTH_OPTIONS,
  IS_PUBLIC_KEY,
  ROLES_KEY,
  PERMISSIONS_KEY,
} from './constants';
