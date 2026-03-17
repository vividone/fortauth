export interface FortAuthOAuthProviderOptions {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
}

export interface FortAuthOptions {
  /** JWT signing configuration (required) */
  jwt: {
    secret: string;
    accessTokenExpiry?: string;   // default: '15m'
    refreshTokenExpiry?: string;  // default: '7d'
  };

  /** User role/permission defaults */
  user?: {
    defaultRole?: string;                    // default: 'user'
    roles?: string[];                        // default: ['user', 'admin']
    permissions?: string[];
    requireEmailVerification?: boolean;      // default: true
  };

  /** OAuth provider configuration (optional — omit to disable) */
  oauth?: {
    google?: FortAuthOAuthProviderOptions;
    github?: FortAuthOAuthProviderOptions;
  };

  /** Magic-link passwordless login (optional) */
  magicLink?: {
    enabled?: boolean;                       // default: false
    tokenExpiry?: string;                    // default: '15m'
    sendEmail: (email: string, token: string) => Promise<void>;
  };

  /** Multi-factor authentication — TOTP (optional) */
  mfa?: {
    enabled?: boolean;                       // default: false
    issuer?: string;                         // shown in authenticator app
    backupCodeCount?: number;                // default: 8
  };

  /** API key authentication (optional) */
  apiKeys?: {
    enabled?: boolean;                       // default: false
    headerName?: string;                     // default: 'x-api-key'
  };

  /** Session management */
  sessions?: {
    maxPerUser?: number;                     // default: 10
    trackDeviceInfo?: boolean;               // default: true
  };

  /** Brute-force / rate-limiting */
  rateLimiting?: {
    maxLoginAttempts?: number;               // default: 5
    lockoutDuration?: string;                // default: '15m'
    windowDuration?: string;                 // default: '15m'
  };

  /** OTP (One-Time Password) configuration */
  otp?: {
    expiry?: string;                         // default: '10m'
    maxRequestsPerWindow?: number;           // default: 5
    windowDuration?: string;                 // default: '15m'
    maxVerifyAttempts?: number;              // default: 5
    verifyWindowDuration?: string;           // default: '15m'
  };

  /** Password policy configuration */
  password?: {
    minLength?: number;                      // default: 8
    requireUppercase?: boolean;              // default: true
    requireLowercase?: boolean;              // default: true
    requireNumbers?: boolean;                // default: true
    requireSpecialChars?: boolean;           // default: true
  };

  /** Email sending callbacks (required) */
  mailer: {
    sendVerificationEmail: (email: string, otp: string) => Promise<void>;
    sendPasswordResetEmail: (email: string, token: string) => Promise<void>;
    sendPasswordChangeOtp?: (email: string, otp: string) => Promise<void>;
  };

  /** REST route prefix — default: 'auth' */
  routePrefix?: string;

  /** Register FortAuthGuard as a global guard — default: true */
  enableGlobalGuard?: boolean;

  /** Hook to add custom claims to JWT access tokens */
  extendJwtPayload?: (user: import('../entities/fort-user.entity').FortUser) =>
    Record<string, any> | Promise<Record<string, any>>;
}
