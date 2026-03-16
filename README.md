# FortAuth

[![npm version](https://img.shields.io/npm/v/fortauth.svg)](https://www.npmjs.com/package/fortauth)
[![license](https://img.shields.io/npm/l/fortauth.svg)](https://github.com/vividone/fortauth/blob/main/LICENSE)

Production-grade authentication for NestJS. Drop-in module with JWT, OAuth, MFA, API keys, session management, and brute-force protection.

## Features

- **Email/Password Auth** — Registration, login, password reset, email verification
- **JWT Tokens** — Access + refresh token pairs with automatic rotation and reuse detection
- **OAuth** — Google and GitHub providers with account linking
- **Magic Links** — Passwordless email login
- **MFA (TOTP)** — Authenticator app support with QR codes and backup codes
- **API Keys** — Scoped, revocable API keys with `fort_` prefix
- **Session Management** — Track active sessions by device, revoke individually or all
- **Brute-Force Protection** — Automatic account lockout after failed attempts
- **RBAC** — Role and permission-based access control via decorators
- **Event System** — Hook into auth events (`user.registered`, `user.login`, etc.)

## Requirements

- Node.js >= 18
- NestJS 10 or 11
- TypeORM 0.3+ with PostgreSQL
- `@nestjs/event-emitter` (optional, for event system)

## Installation

```bash
npm install fortauth

# Peer dependencies (if not already installed)
npm install @nestjs/typeorm typeorm pg @nestjs/jwt @nestjs/passport passport passport-jwt
npm install @nestjs/event-emitter   # optional, for events
```

## Quick Start

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { FortAuthModule, FORT_ENTITIES } from 'fortauth';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'postgres',
      database: 'myapp',
      entities: [...FORT_ENTITIES],
      synchronize: true, // disable in production
    }),
    FortAuthModule.forRoot({
      jwt: {
        secret: process.env.JWT_SECRET!,
        accessTokenExpiry: '15m',
        refreshTokenExpiry: '7d',
      },
      mailer: {
        sendVerificationEmail: async (email, otp) => {
          // Send 6-digit OTP to user's email (e.g., "Your code is 123456")
        },
        sendPasswordResetEmail: async (email, token) => {
          // Send password reset email
        },
        sendPasswordChangeOtp: async (email, otp) => {
          // Send 6-digit OTP for password change confirmation
        },
      },
    }),
  ],
})
export class AppModule {}
```

That's it. Start your app and FortAuth registers all routes automatically.

## Configuration

### Full Options

```typescript
FortAuthModule.forRoot({
  // Required — JWT signing
  jwt: {
    secret: 'your-secret-key',
    accessTokenExpiry: '15m',    // default: '15m'
    refreshTokenExpiry: '7d',    // default: '7d'
  },

  // Required — Email callbacks
  mailer: {
    sendVerificationEmail: async (email, otp) => { /* send 6-digit OTP */ },
    sendPasswordResetEmail: async (email, token) => { /* ... */ },
    sendPasswordChangeOtp: async (email, otp) => { /* send 6-digit OTP */ },  // optional
  },

  // Optional — User defaults
  user: {
    defaultRole: 'user',                  // default: 'user'
    roles: ['user', 'admin', 'moderator'],
    permissions: ['read', 'write', 'delete'],
    requireEmailVerification: true,        // default: true
  },

  // Optional — OAuth providers
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackUrl: 'http://localhost:3000/oauth/google/callback',
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      callbackUrl: 'http://localhost:3000/oauth/github/callback',
    },
  },

  // Optional — Magic link login
  magicLink: {
    enabled: true,
    tokenExpiry: '15m',
    sendEmail: async (email, token, url) => { /* ... */ },
  },

  // Optional — Multi-factor auth (TOTP)
  mfa: {
    enabled: true,
    issuer: 'MyApp',       // shown in authenticator app
    backupCodeCount: 8,    // default: 8
  },

  // Optional — API key auth
  apiKeys: {
    enabled: true,
    headerName: 'x-api-key',  // default: 'x-api-key'
  },

  // Optional — Session management
  sessions: {
    maxPerUser: 10,            // default: 10
    trackDeviceInfo: true,     // default: true
  },

  // Optional — Brute-force protection
  rateLimiting: {
    maxLoginAttempts: 5,       // default: 5
    lockoutDuration: '15m',    // default: '15m'
    windowDuration: '15m',     // default: '15m'
  },

  // Optional — OTP (One-Time Password) settings
  otp: {
    expiry: '10m',             // default: '10m'
    maxRequestsPerWindow: 5,   // default: 5
    windowDuration: '15m',     // default: '15m'
  },

  // Optional — Route prefix (default: routes at root)
  routePrefix: 'auth',

  // Optional — Global guard (default: true)
  enableGlobalGuard: true,
})
```

### Async Configuration

```typescript
FortAuthModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  routePrefix: 'auth', // optional, static — applied at module level
  useFactory: (config: ConfigService) => ({
    jwt: { secret: config.get('JWT_SECRET') },
    mailer: { /* ... */ },
  }),
})
```

## API Endpoints

All routes are registered at the root level by default. If you set `routePrefix: 'auth'`, prefix all paths with `/auth`.

### Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/register` | Public | Create a new account |
| `POST` | `/login` | Public | Login with email/password |
| `POST` | `/logout` | Bearer | Revoke all refresh tokens |
| `POST` | `/refresh` | Public | Rotate refresh token for new token pair |
| `POST` | `/verify-email` | Public | Verify email with 6-digit OTP |
| `POST` | `/forgot-password` | Public | Request password reset email |
| `POST` | `/reset-password` | Public | Reset password with token |
| `GET` | `/me` | Bearer | Get current user profile |
| `PATCH` | `/me` | Bearer | Update profile (fullName, email) |
| `POST` | `/me/password/request-otp` | Bearer | Request OTP for password change |
| `PATCH` | `/me/password` | Bearer | Change password (requires OTP) |

### Sessions

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/sessions` | Bearer | List active sessions |
| `DELETE` | `/sessions/:id` | Bearer | Revoke a specific session |
| `DELETE` | `/sessions` | Bearer | Revoke all other sessions |

### MFA (requires `mfa.enabled: true`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/mfa/setup` | Bearer | Generate TOTP secret + QR code |
| `POST` | `/mfa/enable` | Bearer | Verify TOTP code and enable MFA |
| `POST` | `/mfa/verify` | Public* | Complete MFA login with TOTP/backup code |
| `POST` | `/mfa/disable` | Bearer | Disable MFA (requires password) |
| `POST` | `/mfa/backup-codes` | Bearer | Regenerate backup codes |

*Uses a temporary MFA token, not a full JWT.

### API Keys (requires `apiKeys.enabled: true`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api-keys` | Bearer | Create a new API key |
| `GET` | `/api-keys` | Bearer | List API keys (prefix only) |
| `DELETE` | `/api-keys/:id` | Bearer | Revoke an API key |

### Magic Links (requires `magicLink.enabled: true`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/magic-link` | Public | Send a magic link email |
| `POST` | `/magic-link/verify` | Public | Verify magic link token and login |

### OAuth (requires `oauth` config)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/oauth/google` | Public | Redirect to Google login |
| `GET` | `/oauth/google/callback` | Public | Google OAuth callback |
| `GET` | `/oauth/github` | Public | Redirect to GitHub login |
| `GET` | `/oauth/github/callback` | Public | GitHub OAuth callback |

## Decorators

FortAuth provides decorators you can use in your own controllers:

```typescript
import { Public, Roles, Permissions, CurrentUser } from 'fortauth';

@Controller('admin')
export class AdminController {
  // Public route — bypasses auth guard
  @Public()
  @Get('health')
  health() {
    return { status: 'ok' };
  }

  // Role-restricted
  @Roles('admin')
  @Get('dashboard')
  dashboard(@CurrentUser() user: FortUser) {
    return { user };
  }

  // Permission-restricted
  @Permissions('users:delete')
  @Delete('users/:id')
  deleteUser(@CurrentUser('id') adminId: string) {
    // ...
  }
}
```

### `@Public()`
Marks a route as public. Bypasses the global JWT guard.

### `@Roles(...roles: string[])`
Restricts access to users with one of the specified roles.

### `@Permissions(...permissions: string[])`
Restricts access to users with ALL of the specified permissions.

### `@CurrentUser(field?: string)`
Extracts the authenticated user (or a specific field) from the request.

## Authentication Flows

This section documents every authentication flow in detail, with request/response examples and sequence diagrams. All examples assume default routes (no `routePrefix`).

---

### 1. Registration Flow

A new user creates an account with email, password, and full name. FortAuth validates the password strength, hashes it with argon2, sends a verification email, and returns JWT tokens.

```
Client                          FortAuth                         Database
  │                                │                                │
  │  POST /register                │                                │
  │  { email, password, fullName } │                                │
  │──────────────────────────────▶│                                │
  │                                │  Validate password strength    │
  │                                │  Hash password (argon2)        │
  │                                │  Create user ──────────────────▶
  │                                │  Generate 6-digit OTP          │
  │                                │  Send OTP via email            │
  │                                │  Generate access + refresh tokens
  │                                │  Create session ──────────────▶│
  │  { user, tokens }             │                                │
  │◀──────────────────────────────│                                │
```

**Request:**
```bash
curl -X POST http://localhost:3000/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "MyPass@1234",
    "fullName": "John Doe"
  }'
```

**Response (201):**
```json
{
  "user": {
    "id": "a1b2c3d4-...",
    "email": "user@example.com",
    "fullName": "John Doe",
    "role": "user",
    "isEmailVerified": false
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "d4e5f6a7-..."
  }
}
```

**Password Requirements:**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (`@`, `#`, `$`, etc.)

**Error Responses:**
- `409 Conflict` — Email already registered
- `400 Bad Request` — Password does not meet strength requirements

---

### 2. Email Verification (OTP)

After registration, the user receives a 6-digit OTP via email. Your `mailer.sendVerificationEmail(email, otp)` callback receives the email and a 6-digit code — display it in your email template (e.g., "Your verification code is **123456**").

```
Client                          FortAuth                         Database
  │                                │                                │
  │  POST /verify-email            │                                │
  │  { email, otp }               │                                │
  │──────────────────────────────▶│                                │
  │                                │  Find user by email            │
  │                                │  Hash OTP, match in DB ────────▶
  │                                │  Check: not used, not expired  │
  │                                │  Mark OTP as used ────────────▶│
  │                                │  Set isEmailVerified = true ──▶│
  │  { message: "Email verified" }│                                │
  │◀──────────────────────────────│                                │
```

**Request:**
```bash
curl -X POST http://localhost:3000/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "otp": "123456"
  }'
```

**Response (200):**
```json
{ "message": "Email verified successfully" }
```

**OTP Details:**
- 6-digit numeric code (cryptographically random)
- Single-use — consumed on successful verification
- Expires after 10 minutes (configurable via `otp.expiry`)
- Requesting a new OTP invalidates the previous one
- Rate limited: max 5 requests per 15 minutes (configurable)

**Error Responses:**
- `400 Bad Request` — Invalid or expired OTP, or email already verified

---

### 3. Login Flow (Standard)

User logs in with email and password. FortAuth checks brute-force lockout, validates credentials, creates a session, and returns JWT tokens.

```
Client                          FortAuth                         Database
  │                                │                                │
  │  POST /login                   │                                │
  │  { email, password }           │                                │
  │──────────────────────────────▶│                                │
  │                                │  Check brute-force lockout     │
  │                                │  Find user by email ───────────▶
  │                                │  Verify password (argon2)      │
  │                                │  Record login attempt ─────────▶
  │                                │  Generate access + refresh tokens
  │                                │  Create session ──────────────▶│
  │  { accessToken, refreshToken,  │                                │
  │    user }                      │                                │
  │◀──────────────────────────────│                                │
```

**Request:**
```bash
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "MyPass@1234"
  }'
```

**Response (200) — Standard login (no MFA):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "d4e5f6a7-...",
  "user": {
    "id": "a1b2c3d4-...",
    "email": "user@example.com",
    "fullName": "John Doe",
    "role": "user"
  }
}
```

**Error Responses:**
- `401 Unauthorized` — Invalid email or password
- `403 Forbidden` — Account is disabled
- `429 Too Many Requests` — Account locked due to too many failed attempts (includes `retryAfter` in seconds)

---

### 4. Login Flow (with MFA)

When a user has MFA enabled, login becomes a two-step process. The first step returns a temporary MFA token instead of full JWT tokens.

```
Client                          FortAuth                         Database
  │                                │                                │
  │  POST /login                   │                                │
  │  { email, password }           │                                │
  │──────────────────────────────▶│                                │
  │                                │  Validate credentials ✓        │
  │                                │  Detect MFA enabled            │
  │  { mfaRequired: true,         │                                │
  │    mfaToken: "temp-jwt" }     │                                │
  │◀──────────────────────────────│                                │
  │                                │                                │
  │  POST /mfa/verify              │                                │
  │  { mfaToken, code: "123456" } │                                │
  │──────────────────────────────▶│                                │
  │                                │  Validate temp MFA token       │
  │                                │  Verify TOTP code              │
  │                                │  Generate full token pair      │
  │                                │  Create session ──────────────▶│
  │  { accessToken, refreshToken,  │                                │
  │    user }                      │                                │
  │◀──────────────────────────────│                                │
```

**Step 1 — Login (returns MFA challenge):**
```bash
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{ "email": "user@example.com", "password": "MyPass@1234" }'
```

**Response (200):**
```json
{
  "mfaRequired": true,
  "mfaToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Step 2 — Verify MFA code:**
```bash
curl -X POST http://localhost:3000/mfa/verify \
  -H "Content-Type: application/json" \
  -d '{
    "mfaToken": "eyJhbGciOiJIUzI1NiIs...",
    "code": "123456"
  }'
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "d4e5f6a7-...",
  "user": { "id": "...", "email": "user@example.com", ... }
}
```

> **Backup codes** can be used in place of the 6-digit TOTP code. Each backup code is single-use and is consumed upon verification.

---

### 5. Token Lifecycle & Refresh Rotation

FortAuth uses short-lived access tokens (default 15m) and long-lived refresh tokens (default 7d). When the access token expires, the client uses the refresh token to obtain a new pair.

**Key security features:**
- Each refresh rotates both tokens — the old refresh token is immediately revoked
- Tokens belong to a **family** (chain). If a revoked token is reused, the entire family is revoked (compromise detection)
- Refresh tokens are stored as SHA-256 hashes — never in plaintext

```
Client                          FortAuth                         Database
  │                                │                                │
  │  (access token expired)        │                                │
  │                                │                                │
  │  POST /refresh                 │                                │
  │  { refreshToken: "old-token" } │                                │
  │──────────────────────────────▶│                                │
  │                                │  Hash token, find in DB ───────▶
  │                                │  Check: not revoked, not expired│
  │                                │  Revoke old token ────────────▶│
  │                                │  Issue new pair (same family)   │
  │                                │  Store new refresh token ─────▶│
  │  { accessToken, refreshToken } │                                │
  │◀──────────────────────────────│                                │
```

**Request:**
```bash
curl -X POST http://localhost:3000/refresh \
  -H "Content-Type: application/json" \
  -d '{ "refreshToken": "d4e5f6a7-old-refresh-token" }'
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...(new)",
  "refreshToken": "f8g9h0i1-...(new)"
}
```

**Reuse Detection:**
```
If an attacker steals refresh token A and uses it after the legitimate client
already rotated to token B:

1. Attacker sends token A (already revoked) to POST /refresh
2. FortAuth detects reuse → revokes ALL tokens in the family
3. Both attacker and legitimate user are logged out
4. User must re-authenticate with email/password
```

**Frontend Integration Example:**
```typescript
// Axios interceptor for automatic token refresh
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      const { data } = await axios.post('/refresh', {
        refreshToken: localStorage.getItem('refreshToken'),
      });
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      error.config.headers.Authorization = `Bearer ${data.accessToken}`;
      return axios(error.config);
    }
    return Promise.reject(error);
  }
);
```

---

### 6. Accessing Protected Routes

All routes require authentication by default (unless marked `@Public()`). Send the access token in the `Authorization` header.

**With JWT:**
```bash
curl http://localhost:3000/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

**With API Key (if enabled):**
```bash
curl http://localhost:3000/me \
  -H "x-api-key: fort_abc123def456..."
```

Both methods return the same response. API key auth and JWT auth can be used interchangeably on any protected route.

**Response (200):**
```json
{
  "id": "a1b2c3d4-...",
  "email": "user@example.com",
  "fullName": "John Doe",
  "role": "user",
  "isEmailVerified": true,
  "isMfaEnabled": false,
  "createdAt": "2025-01-15T10:30:00.000Z"
}
```

**Error Responses:**
- `401 Unauthorized` — Missing, invalid, or expired token/API key

---

### 7. Password Reset Flow

A two-step flow: request a reset email, then reset using the token.

```
Client                          FortAuth                  Email Service
  │                                │                            │
  │  POST /forgot-password         │                            │
  │  { email }                     │                            │
  │──────────────────────────────▶│                            │
  │                                │  Generate reset token       │
  │                                │  Call sendPasswordResetEmail ──▶
  │  { message: "If an account..." }                            │
  │◀──────────────────────────────│                            │
  │                                │                            │
  │  (user clicks link in email)   │                            │
  │                                │                            │
  │  POST /reset-password          │                            │
  │  { token, newPassword }        │                            │
  │──────────────────────────────▶│                            │
  │                                │  Validate token             │
  │                                │  Hash new password          │
  │                                │  Update user                │
  │                                │  Revoke all refresh tokens  │
  │  { message: "Password reset" } │                            │
  │◀──────────────────────────────│                            │
```

**Step 1 — Request reset email:**
```bash
curl -X POST http://localhost:3000/forgot-password \
  -H "Content-Type: application/json" \
  -d '{ "email": "user@example.com" }'
```

**Response (200):**
```json
{ "message": "If an account with that email exists, a reset link has been sent" }
```

> The response is always the same whether the email exists or not — this prevents email enumeration attacks.

**Step 2 — Reset password with token:**
```bash
curl -X POST http://localhost:3000/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "reset-token-from-email",
    "newPassword": "NewSecure@Pass1"
  }'
```

**Response (200):**
```json
{ "message": "Password reset successful" }
```

> After a successful reset, all existing refresh tokens are revoked (the user is logged out on all devices).

---

### 8. Change Password (Authenticated + OTP)

Password change is a two-step process requiring both the current password and a 6-digit OTP sent to the user's email.

```
Client                          FortAuth                  Email Service
  │                                │                            │
  │  POST /me/password/request-otp │                            │
  │  (Bearer token)                │                            │
  │──────────────────────────────▶│                            │
  │                                │  Generate 6-digit OTP       │
  │                                │  Call sendPasswordChangeOtp ──▶
  │  { message: "OTP sent" }      │                            │
  │◀──────────────────────────────│                            │
  │                                │                            │
  │  (user receives OTP in email)  │                            │
  │                                │                            │
  │  PATCH /me/password            │                            │
  │  { currentPassword,            │                            │
  │    newPassword, otp }          │                            │
  │──────────────────────────────▶│                            │
  │                                │  Verify current password    │
  │                                │  Verify OTP (consumed)      │
  │                                │  Hash new password          │
  │                                │  Revoke all refresh tokens  │
  │  { message: "Password changed" }                            │
  │◀──────────────────────────────│                            │
```

**Step 1 — Request OTP:**
```bash
curl -X POST http://localhost:3000/me/password/request-otp \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

**Response (200):**
```json
{ "message": "OTP sent to your email" }
```

**Step 2 — Change password with OTP:**
```bash
curl -X PATCH http://localhost:3000/me/password \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "MyPass@1234",
    "newPassword": "NewPass@5678",
    "otp": "123456"
  }'
```

**Response (200):**
```json
{ "message": "Password changed successfully" }
```

**Security notes:**
- The current password is verified **before** the OTP is consumed — a wrong password won't waste the OTP
- After success, all existing refresh tokens are revoked (user is logged out on all devices)
- Requires `mailer.sendPasswordChangeOtp` callback to be configured

**Error Responses:**
- `401 Unauthorized` — Current password is incorrect
- `400 Bad Request` — Invalid/expired OTP or weak new password

---

### 9. MFA Setup & Management

#### Setting up MFA

```
Client                          FortAuth
  │                                │
  │  POST /mfa/setup               │
  │  (Bearer token)                │
  │──────────────────────────────▶│
  │                                │  Generate TOTP secret
  │                                │  Generate QR code (data URL)
  │                                │  Generate backup codes
  │  { secret, qrCodeUrl,         │
  │    backupCodes }               │
  │◀──────────────────────────────│
  │                                │
  │  (User scans QR in app)        │
  │                                │
  │  POST /mfa/enable              │
  │  { code: "123456" }            │
  │──────────────────────────────▶│
  │                                │  Verify TOTP code
  │                                │  Mark MFA as enabled
  │  { message: "MFA enabled" }   │
  │◀──────────────────────────────│
```

**Step 1 — Generate MFA secret:**
```bash
curl -X POST http://localhost:3000/mfa/setup \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

**Response (201):**
```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCodeUrl": "data:image/png;base64,iVBORw0KGgo...",
  "backupCodes": [
    "a1b2c3d4", "e5f6g7h8", "i9j0k1l2", "m3n4o5p6",
    "q7r8s9t0", "u1v2w3x4", "y5z6a7b8", "c9d0e1f2"
  ]
}
```

> **Store backup codes securely.** They are shown only once and are hashed in the database. Each code can only be used once.

**Step 2 — Verify and enable:**
```bash
curl -X POST http://localhost:3000/mfa/enable \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{ "code": "123456" }'
```

#### Disabling MFA

Requires the user's password for security:

```bash
curl -X POST http://localhost:3000/mfa/disable \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{ "password": "MyPass@1234" }'
```

#### Regenerating Backup Codes

Generates a new set of backup codes (invalidates old ones):

```bash
curl -X POST http://localhost:3000/mfa/backup-codes \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

---

### 10. API Key Authentication

API keys provide long-lived, programmatic access without JWT tokens. Ideal for CI/CD pipelines, server-to-server communication, and automated scripts.

```
Client                          FortAuth                         Database
  │                                │                                │
  │  POST /api-keys                │                                │
  │  { name, scopes }             │                                │
  │  (Bearer token)                │                                │
  │──────────────────────────────▶│                                │
  │                                │  Generate key: fort_ + random  │
  │                                │  Hash key (SHA-256)            │
  │                                │  Store hash + prefix ─────────▶│
  │  { key, id, keyPrefix }       │  ⚠ Full key returned ONCE      │
  │◀──────────────────────────────│                                │
  │                                │                                │
  │  (later — use key on any route)│                                │
  │                                │                                │
  │  GET /me                       │                                │
  │  x-api-key: fort_abc123...     │                                │
  │──────────────────────────────▶│                                │
  │                                │  Extract key from header       │
  │                                │  Hash key, match by prefix+hash│
  │                                │  Load user ───────────────────▶│
  │  { user profile }             │                                │
  │◀──────────────────────────────│                                │
```

**Create an API key:**
```bash
curl -X POST http://localhost:3000/api-keys \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{ "name": "CI Pipeline", "scopes": ["read", "write"] }'
```

**Response (201):**
```json
{
  "id": "b2c3d4e5-...",
  "key": "fort_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0",
  "keyPrefix": "fort_a1b2",
  "name": "CI Pipeline",
  "scopes": ["read", "write"]
}
```

> **The full key is only returned at creation time.** Store it in a secure location (e.g., environment variable, secrets manager). It cannot be retrieved again.

**Use the API key:**
```bash
curl http://localhost:3000/me \
  -H "x-api-key: fort_a1b2c3d4e5f6g7h8..."
```

**List keys (prefix only):**
```bash
curl http://localhost:3000/api-keys \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

**Revoke a key:**
```bash
curl -X DELETE http://localhost:3000/api-keys/b2c3d4e5-key-id \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

---

### 11. OAuth Login Flow

OAuth provides "Login with Google" / "Login with GitHub" functionality. The flow redirects the user to the provider and back.

```
Browser                         FortAuth                     Google/GitHub
  │                                │                              │
  │  GET /oauth/google             │                              │
  │──────────────────────────────▶│                              │
  │  302 Redirect ──────────────────────────────────────────────▶│
  │                                │                              │
  │  (User authenticates with provider)                           │
  │                                │                              │
  │  GET /oauth/google/callback    │                              │
  │  ?code=auth_code               │                              │
  │◀────────────────────────────────────────────────────────────│
  │──────────────────────────────▶│                              │
  │                                │  Exchange code for profile   │
  │                                │  Find/create user             │
  │                                │  Link OAuth account           │
  │                                │  Generate tokens              │
  │  { accessToken, refreshToken,  │                              │
  │    user }                      │                              │
  │◀──────────────────────────────│                              │
```

**Step 1 — Redirect to provider (open in browser):**
```
GET http://localhost:3000/oauth/google
GET http://localhost:3000/oauth/github
```

**Step 2 — Callback (handled automatically):**

After authentication, the provider redirects back to your callback URL. FortAuth handles this and returns tokens.

**Account Linking Behavior:**
- If the OAuth email matches an existing user, the OAuth account is linked
- If no user exists with that email, a new account is created (no password set)
- Users can have multiple OAuth providers linked to the same account

---

### 12. Magic Link Login Flow

Passwordless authentication via email. The user receives a one-time link and clicks it to log in.

```
Client                          FortAuth                  Email Service
  │                                │                            │
  │  POST /magic-link              │                            │
  │  { email }                     │                            │
  │──────────────────────────────▶│                            │
  │                                │  Generate token             │
  │                                │  Call magicLink.sendEmail ────▶
  │  { message: "Magic link sent" }│                            │
  │◀──────────────────────────────│                            │
  │                                │                            │
  │  (user clicks link in email)   │                            │
  │                                │                            │
  │  POST /magic-link/verify       │                            │
  │  { token }                     │                            │
  │──────────────────────────────▶│                            │
  │                                │  Validate token             │
  │                                │  Find/create user           │
  │                                │  Generate tokens            │
  │  { tokens, user }             │                            │
  │◀──────────────────────────────│                            │
```

**Step 1 — Request magic link:**
```bash
curl -X POST http://localhost:3000/magic-link \
  -H "Content-Type: application/json" \
  -d '{ "email": "user@example.com" }'
```

**Response (200):**
```json
{ "message": "If an account with that email exists, a magic link has been sent" }
```

**Step 2 — Verify token:**
```bash
curl -X POST http://localhost:3000/magic-link/verify \
  -H "Content-Type: application/json" \
  -d '{ "token": "magic-link-token-from-email" }'
```

**Response (200):**
```json
{
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "d4e5f6a7-..."
  },
  "user": { "id": "...", "email": "user@example.com", ... }
}
```

> Magic link tokens are single-use and expire after the configured `tokenExpiry` (default: 15 minutes).

---

### 13. Session Management

FortAuth tracks every login as a session with device information. Users can view and revoke sessions.

**List active sessions:**
```bash
curl http://localhost:3000/sessions \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

**Response (200):**
```json
[
  {
    "id": "s1e2s3s4-...",
    "ipAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...",
    "deviceName": "Chrome on macOS",
    "lastActiveAt": "2025-01-15T10:30:00.000Z",
    "createdAt": "2025-01-15T09:00:00.000Z"
  },
  {
    "id": "a5b6c7d8-...",
    "ipAddress": "10.0.0.1",
    "deviceName": "Mobile Safari on iOS",
    "lastActiveAt": "2025-01-14T18:00:00.000Z",
    "createdAt": "2025-01-14T12:00:00.000Z"
  }
]
```

**Revoke a specific session:**
```bash
curl -X DELETE http://localhost:3000/sessions/a5b6c7d8-session-id \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

**Revoke all other sessions (keep current):**
```bash
curl -X DELETE http://localhost:3000/sessions \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

> When a session is revoked, its associated refresh token is also revoked. The revoked session's access token will expire naturally.

---

### 14. Brute-Force Protection

FortAuth automatically tracks failed login attempts and locks accounts after too many failures.

```
Client                          FortAuth                         Database
  │                                │                                │
  │  POST /login (wrong password)  │                                │
  │──────────────────────────────▶│                                │
  │  401 Unauthorized              │  Record attempt (1/5) ────────▶│
  │◀──────────────────────────────│                                │
  │                                │                                │
  │  ... (4 more failed attempts)  │                                │
  │                                │                                │
  │  POST /login (6th attempt)     │                                │
  │──────────────────────────────▶│                                │
  │                                │  Check attempts: 5/5 exceeded  │
  │                                │  Lock account for 15m ────────▶│
  │  429 Too Many Requests         │                                │
  │  { message, retryAfter: 900 } │                                │
  │◀──────────────────────────────│                                │
```

**Response when locked (429):**
```json
{
  "statusCode": 429,
  "message": "Account locked due to too many failed login attempts. Try again later.",
  "retryAfter": 900
}
```

**Defaults (configurable):**
- `maxLoginAttempts`: 5 attempts before lockout
- `lockoutDuration`: 15 minutes
- `windowDuration`: 15 minutes (rolling window for counting attempts)

> Successful login clears the failed attempt counter.

---

### 15. Logout

Logout revokes the current session and its associated refresh token.

```bash
curl -X POST http://localhost:3000/logout \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

**Response (200):**
```json
{ "message": "Logged out" }
```

> The access token remains valid until it expires (default: 15 minutes). For immediate invalidation, keep access token expiry short and rely on refresh token revocation.

---

### Complete Frontend Integration Example

Here's a typical frontend authentication flow using FortAuth:

```typescript
class AuthClient {
  private baseUrl = 'http://localhost:3000';

  // Register a new user
  async register(email: string, password: string, fullName: string) {
    const res = await fetch(`${this.baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName }),
    });
    const data = await res.json();
    this.storeTokens(data.tokens);
    return data.user;
  }

  // Login — handles MFA if enabled
  async login(email: string, password: string) {
    const res = await fetch(`${this.baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (data.mfaRequired) {
      // Prompt user for TOTP code, then call completeMfaLogin()
      return { mfaRequired: true, mfaToken: data.mfaToken };
    }

    this.storeTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    return { user: data.user };
  }

  // Complete MFA login with TOTP code
  async completeMfaLogin(mfaToken: string, code: string) {
    const res = await fetch(`${this.baseUrl}/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mfaToken, code }),
    });
    const data = await res.json();
    this.storeTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    return data.user;
  }

  // Refresh tokens when access token expires
  async refreshTokens() {
    const refreshToken = localStorage.getItem('refreshToken');
    const res = await fetch(`${this.baseUrl}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const data = await res.json();
    this.storeTokens(data);
    return data.accessToken;
  }

  // Authenticated API call helper
  async authFetch(path: string, options: RequestInit = {}) {
    const accessToken = localStorage.getItem('accessToken');
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${accessToken}` },
    });

    if (res.status === 401) {
      // Token expired — try refresh
      const newToken = await this.refreshTokens();
      return fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers: { ...options.headers, Authorization: `Bearer ${newToken}` },
      });
    }

    return res;
  }

  private storeTokens(tokens: { accessToken: string; refreshToken: string }) {
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
  }
}
```

## Events

If `@nestjs/event-emitter` is installed, FortAuth emits events you can listen to:

```typescript
import { OnEvent } from '@nestjs/event-emitter';
import { FortAuthEvent, FortAuthEventPayload } from 'fortauth';

@Injectable()
export class AuthListener {
  @OnEvent(FortAuthEvent.USER_REGISTERED)
  handleRegistration(payload: FortAuthEventPayload) {
    console.log('New user:', payload.userId);
    // Send welcome email, create default resources, etc.
  }

  @OnEvent(FortAuthEvent.ACCOUNT_LOCKED)
  handleLockout(payload: FortAuthEventPayload) {
    console.log('Account locked:', payload.userId);
    // Alert security team
  }
}
```

### Available Events

| Event | Emitted When |
|-------|-------------|
| `fortauth.user.registered` | New user registers |
| `fortauth.user.verified` | Email verified |
| `fortauth.user.login` | Successful login |
| `fortauth.user.logout` | User logs out |
| `fortauth.user.password_changed` | Password changed |
| `fortauth.user.mfa_enabled` | MFA enabled |
| `fortauth.user.mfa_disabled` | MFA disabled |
| `fortauth.session.created` | New session created |
| `fortauth.session.revoked` | Session revoked |
| `fortauth.login.failed` | Login attempt failed |
| `fortauth.account.locked` | Account locked (brute force) |

## Database Tables

FortAuth creates 10 tables (via TypeORM `synchronize` or migrations):

| Table | Description |
|-------|-------------|
| `fort_users` | User accounts |
| `fort_refresh_tokens` | Refresh tokens with family tracking |
| `fort_sessions` | Active sessions with device info |
| `fort_otps` | OTP codes for email verification and password change |
| `fort_api_keys` | API keys (hashed) |
| `fort_mfa_secrets` | TOTP secrets and backup codes |
| `fort_login_attempts` | Login attempt log for brute-force detection |
| `fort_password_resets` | Password reset tokens |
| `fort_magic_links` | Magic link tokens |
| `fort_oauth_accounts` | Linked OAuth provider accounts |

## Exported Services

For advanced use cases, you can inject FortAuth services into your own modules:

```typescript
import { AuthService, TokenService, SessionsService, OtpService } from 'fortauth';

@Injectable()
export class MyService {
  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
    private readonly sessionsService: SessionsService,
  ) {}
}
```

## Security

- Passwords hashed with **argon2**
- Refresh tokens stored as **SHA-256 hashes**
- API keys stored as **SHA-256 hashes** (only prefix visible after creation)
- OTPs stored as **SHA-256 hashes** and are **single-use** with configurable expiry
- OTP requests are **rate-limited** (default: 5 per 15 minutes per user)
- Refresh token **reuse detection** revokes entire token family
- Account **lockout** after configurable failed attempts
- Password **strength validation** (length, mixed case, numbers, special chars)
- Responses prevent **email enumeration** (forgot-password always returns success)
- MFA backup codes are **hashed** and **single-use**

## Author

**Fortbridge Technologies Ltd** — [fortbridge.co](https://fortbridge.co)

Lead Product Architect: **Victor Olaitan**

Contact: [ops@fortbridge.co](mailto:ops@fortbridge.co)

## License

MIT
