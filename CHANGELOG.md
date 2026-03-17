# Changelog

## [0.3.0] - 2026-03-17

### Security

- **Timing-safe hash comparisons** — Refresh token and MFA backup code hash verification now uses `crypto.timingSafeEqual` to prevent timing attacks.
- **OTP verification rate limiting** — Brute-force attempts on 6-digit OTP codes are now throttled (default: 5 attempts per 15min window). Configurable via `otp.maxVerifyAttempts` and `otp.verifyWindowDuration`.
- **MFA backup code rate limiting** — Failed backup code attempts are throttled (5 attempts per 15min window) to prevent brute-force attacks.
- **JWT secret validation** — Warns at startup if `jwt.secret` is shorter than 32 characters.
- **Session revocation enforcement** — JWT strategy now verifies the session has not been revoked on every authenticated request. Revoking a session immediately invalidates its access token.
- **Password field length limits** — All password inputs are capped at 128 characters (`@MaxLength(128)`) to prevent Argon2 CPU DoS attacks.

### Fixed

- **Atomic OTP verification** — OTP consumption now uses an atomic `UPDATE...WHERE` query, preventing double-use in concurrent requests.
- **Atomic magic link verification** — Magic link token consumption now uses an atomic `UPDATE...WHERE` query with the same pattern.
- **Atomic backup code consumption** — MFA backup code splice+save is protected by `@VersionColumn` optimistic locking with retry on conflict.
- **Atomic session revokeAll** — Replaced N+1 loop with bulk `UPDATE` queries for both sessions and refresh tokens.
- **Input validation on MFA endpoints** — `POST /mfa/enable` and `POST /mfa/disable` now use proper DTOs (`EnableMfaDto`, `DisableMfaDto`) instead of raw `@Body('field')` extraction.
- **Input validation on API key creation** — `POST /api-keys` now validates input via `CreateApiKeyDto` (name required, max 100 chars; scopes as string array; expiresAt as ISO date).
- **UUID validation on route params** — `ParseUUIDPipe` added to `DELETE /sessions/:id` and `DELETE /api-keys/:id` to return 400 instead of raw DB errors.

### Added

- **Database indexes** on all frequently queried columns across 8 entities:
  - `fort_refresh_tokens`: `userId`, `family`, `expiresAt`
  - `fort_sessions`: `userId`
  - `fort_api_keys`: `userId`, `keyPrefix`
  - `fort_login_attempts`: composite `(email, success, createdAt)`
  - `fort_password_resets`: `tokenHash`, `userId`
  - `fort_magic_links`: `tokenHash`, `email`
  - `fort_otps`: composite `(userId, purpose)`
  - `fort_oauth_accounts`: `userId`
- **`CleanupService`** — New service to purge expired/used refresh tokens, OTPs, magic links, password resets, login attempts, and revoked sessions. Exported for consumers to call via cron or manual trigger.
- **Configurable password policy** — New `password` option in `FortAuthOptions` with `minLength`, `requireUppercase`, `requireLowercase`, `requireNumbers`, and `requireSpecialChars` (all with sensible defaults).
- **Password-protected backup code regeneration** — `POST /mfa/backup-codes` now requires the user's password in the request body to prevent stolen-token abuse.
- **Custom JWT claims hook** — New `extendJwtPayload` option allows consumers to inject custom claims (tenant ID, plan tier, etc.) into access tokens.
- **New DTOs**: `EnableMfaDto`, `DisableMfaDto`, `RegenerateBackupCodesDto`, `CreateApiKeyDto`.
- **New utility**: `timingSafeCompare` for constant-time hex hash comparison.

### Changed

- `generateAccessToken()` in `TokenService` is now `async` to support the `extendJwtPayload` hook.
- `PasswordService` now injects `FORTAUTH_OPTIONS` and reads password policy configuration.
- `SessionsService.revokeAll()` uses bulk SQL instead of iterative save.
- `FortMfaSecret` entity now has a `@VersionColumn()` for optimistic locking.

## [0.2.0] - 2026-03-17

### Fixed

- Magic link service decoupled token creation from email sending (`createMagicLink()` method).
- Magic link `sendEmail` callback simplified to `(email, token)` signature.
- Magic link verification returns distinct error messages (invalid / already used / expired).
- Existing unused magic link tokens are invalidated before creating new ones.
- `changePassword()` now allows initial password setup for passwordless users (magic link / OAuth).
- `requestPasswordChangeOtp()` silently returns for passwordless users instead of throwing.
- `forgotPassword()` invalidates existing unused reset tokens before creating a new one.

## [0.1.0] - 2026-03-17

### Added

- Initial release with JWT authentication, refresh token rotation with reuse detection.
- User registration and login with email/password.
- Email verification via OTP.
- Password reset flow with hashed tokens.
- Password change with OTP verification.
- Multi-factor authentication (TOTP) with backup codes.
- OAuth (Google, GitHub) with account linking.
- Magic link passwordless authentication.
- API key authentication with scoped keys.
- Session management with device tracking.
- Brute-force protection with account lockout.
- Role-based and permission-based access control.
- Event system via `@nestjs/event-emitter`.
- `forRoot()` and `forRootAsync()` dynamic module configuration.
- Configurable route prefix via `RouterModule`.
