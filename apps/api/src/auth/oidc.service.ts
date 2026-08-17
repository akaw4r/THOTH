import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { generators, Issuer, type Client } from 'openid-client';
import { ConfigService } from '../config/config.service';

export interface OidcAuthRequest {
  url: string;
  state: string;
  nonce: string;
  codeVerifier: string;
}

export interface OidcProfile {
  email: string;
  emailVerified: boolean;
  name: string;
  sub: string;
}

/**
 * Native Google OIDC client (openid-client). The app does OIDC itself —
 * we do not depend on an external proxy to authenticate (lesson from the SysReptor gateway).
 * Uses Authorization Code + PKCE.
 */
@Injectable()
export class OidcService implements OnModuleInit {
  private readonly logger = new Logger(OidcService.name);
  private client: Client | null = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.googleEnabled) {
      this.logger.warn('Google OIDC not configured (GOOGLE_CLIENT_ID/SECRET empty).');
      return;
    }
    try {
      const issuer = await Issuer.discover('https://accounts.google.com');
      this.client = new issuer.Client({
        client_id: this.config.googleClientId,
        client_secret: this.config.googleClientSecret,
        redirect_uris: [this.config.googleRedirectUri],
        response_types: ['code'],
      });
      this.logger.log(`Google OIDC ready (redirect: ${this.config.googleRedirectUri})`);
    } catch (err) {
      this.logger.error(`Failed to discover Google issuer: ${(err as Error).message}`);
    }
  }

  get isReady(): boolean {
    return this.client !== null;
  }

  createAuthRequest(): OidcAuthRequest {
    if (!this.client) throw new Error('OIDC not initialized');
    const state = generators.state();
    const nonce = generators.nonce();
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);

    const url = this.client.authorizationUrl({
      scope: 'openid email profile',
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      prompt: 'select_account',
      // Hints Google to restrict to the primary domain (extra defense; the real
      // domain validation happens in the callback).
      hd: this.config.allowedEmailDomains[0],
    });

    return { url, state, nonce, codeVerifier };
  }

  async handleCallback(
    callbackParams: Record<string, string>,
    expected: { state: string; nonce: string; codeVerifier: string },
  ): Promise<OidcProfile> {
    if (!this.client) throw new Error('OIDC not initialized');
    const tokenSet = await this.client.callback(this.config.googleRedirectUri, callbackParams, {
      state: expected.state,
      nonce: expected.nonce,
      code_verifier: expected.codeVerifier,
    });
    const claims = tokenSet.claims();
    return {
      email: String(claims.email ?? ''),
      emailVerified: Boolean(claims.email_verified),
      name: String(claims.name ?? claims.email ?? ''),
      sub: String(claims.sub),
    };
  }
}
