export enum FortAuthEvent {
  USER_REGISTERED = 'fortauth.user.registered',
  USER_VERIFIED = 'fortauth.user.verified',
  USER_LOGIN = 'fortauth.user.login',
  USER_LOGOUT = 'fortauth.user.logout',
  USER_PASSWORD_CHANGED = 'fortauth.user.password_changed',
  USER_MFA_ENABLED = 'fortauth.user.mfa_enabled',
  USER_MFA_DISABLED = 'fortauth.user.mfa_disabled',
  SESSION_CREATED = 'fortauth.session.created',
  SESSION_REVOKED = 'fortauth.session.revoked',
  LOGIN_FAILED = 'fortauth.login.failed',
  ACCOUNT_LOCKED = 'fortauth.account.locked',
}
