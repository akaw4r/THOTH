import 'express-session';
import type { Role } from '@thoth/shared';

/** Partial state during the local login flow before the full session. */
export interface PendingLocalLogin {
  userId: string;
  /** Steps already completed while awaiting MFA/password change. */
  awaitingMfa: boolean;
  awaitingMfaSetup: boolean;
  awaitingPasswordChange: boolean;
}

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    role?: Role;
    isLocalAdmin?: boolean;
    /** Per-session CSRF token (double-submit). */
    csrfToken?: string;
    /** Temporary state/nonce/verifier for the OIDC flow. */
    oidc?: { state: string; nonce: string; codeVerifier: string; returnTo?: string };
    /** WebAuthn challenge in progress (base64url). */
    webauthnChallenge?: string;
    /** Local login awaiting second factor. */
    pendingLocal?: PendingLocalLogin;
  }
}
