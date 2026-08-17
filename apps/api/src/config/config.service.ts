import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { parseEncryptionKey } from '@thoth/shared/node';
import type { Role } from '@thoth/shared';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().default(3000),
  BASE_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET too short (>=16 chars)'),
  ENCRYPTION_KEY: z.string().min(1),
  SESSION_TTL_HOURS: z.coerce.number().min(1).max(720).default(8),
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  // OIDC redirect path (must match the URI registered in Google and the
  // proxy routing). Default: /api/auth/callback/google.
  OIDC_REDIRECT_PATH: z
    .string()
    .default('/api/auth/callback/google')
    .transform((p) => (p.startsWith('/') ? p : `/${p}`)),
  // Number of trusted proxies in front of the API (Express `trust proxy`). Local
  // (Caddy) = 1. Behind gateways/load balancers there may be more hops —
  // undershooting suppresses the Secure cookie; overshooting makes the throttler
  // see a single IP for everyone. Confirm the value with your infrastructure.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(1),
  ALLOWED_EMAIL_DOMAINS: z.string().default('example.com'),
  ADMIN_EMAILS: z.string().default(''),
  DEFAULT_USER_ROLE: z.enum(['VIEWER', 'AUTHOR']).default('VIEWER'),
  // Google Workspace group restriction: only members of these groups can log
  // in via Google. Empty = no group restriction (domain only). Requires a
  // service account (Directory API) — see GOOGLE_WORKSPACE_SA_JSON below.
  GOOGLE_ALLOWED_GROUPS: z.string().default(''),
  // Service account key (Google JSON, raw or base64) used to query the
  // Directory API. Needs domain-wide delegation with the
  // admin.directory.group.member.readonly scope.
  GOOGLE_WORKSPACE_SA_JSON: z.string().default(''),
  // Email of a Workspace admin the service account impersonates (required
  // for the Directory API via delegation).
  GOOGLE_WORKSPACE_ADMIN_SUBJECT: z.string().default(''),
  LOCAL_ADMIN_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  SEED_DEMO: z.string().default('0'),
  // AI assistant (optional). AI_PROVIDER picks the LLM provider:
  // 'anthropic' (Anthropic's API, requires ANTHROPIC_API_KEY) or 'ollama'
  // (local/self-hosted Ollama instance). Empty = assistant disabled.
  AI_PROVIDER: z.enum(['', 'anthropic', 'ollama']).default(''),
  // Model to use on the chosen provider (e.g. claude-opus-5 | llama3.1).
  AI_MODEL: z.string().default(''),
  ANTHROPIC_API_KEY: z.string().default(''),
  // Ollama base URL. Inside docker compose, the host's Ollama is reachable at
  // http://host.docker.internal:11434.
  OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),
});

export type Env = z.infer<typeof envSchema>;

@Injectable()
export class ConfigService {
  private readonly env: Env;
  readonly encryptionKey: Buffer;
  readonly allowedEmailDomains: string[];
  readonly adminEmails: string[];
  readonly allowedGoogleGroups: string[];
  readonly googleWorkspaceSa: { clientEmail: string; privateKey: string } | null;

  constructor(raw: NodeJS.ProcessEnv = process.env) {
    const parsed = envSchema.safeParse(raw);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('\n');
      throw new Error(`Invalid environment configuration:\n${issues}`);
    }
    this.env = parsed.data;
    this.encryptionKey = parseEncryptionKey(this.env.ENCRYPTION_KEY);
    this.allowedEmailDomains = this.env.ALLOWED_EMAIL_DOMAINS.split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    this.adminEmails = this.env.ADMIN_EMAILS.split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    this.allowedGoogleGroups = this.env.GOOGLE_ALLOWED_GROUPS.split(',')
      .map((g) => g.trim().toLowerCase())
      .filter(Boolean);
    this.googleWorkspaceSa = this.parseServiceAccount(this.env.GOOGLE_WORKSPACE_SA_JSON);

    this.assertNoLockout();
    this.assertGroupGatingConfig();
    this.assertAiConfig();
  }

  /**
   * If an AI provider was chosen, its configuration must be complete — better
   * to refuse to start with a clear message than to silently disable the
   * assistant.
   */
  private assertAiConfig(): void {
    if (!this.env.AI_PROVIDER) return;
    const missing: string[] = [];
    if (!this.env.AI_MODEL.trim()) missing.push('AI_MODEL');
    if (this.env.AI_PROVIDER === 'anthropic' && !this.env.ANTHROPIC_API_KEY.trim())
      missing.push('ANTHROPIC_API_KEY');
    if (missing.length > 0) {
      throw new Error(
        `AI_PROVIDER=${this.env.AI_PROVIDER} is set but missing: ${missing.join(', ')}. ` +
          'Complete the AI assistant configuration or leave AI_PROVIDER empty.',
      );
    }
  }

  /** Accepts the service account JSON raw or base64-encoded. Returns null if empty. */
  private parseServiceAccount(raw: string): { clientEmail: string; privateKey: string } | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    let json = trimmed;
    if (!trimmed.startsWith('{')) {
      try {
        json = Buffer.from(trimmed, 'base64').toString('utf8');
      } catch {
        throw new Error('Invalid GOOGLE_WORKSPACE_SA_JSON (neither JSON nor base64).');
      }
    }
    let parsed: { client_email?: string; private_key?: string };
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new Error('Invalid GOOGLE_WORKSPACE_SA_JSON (malformed JSON).');
    }
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error('GOOGLE_WORKSPACE_SA_JSON missing client_email/private_key.');
    }
    return { clientEmail: parsed.client_email, privateKey: parsed.private_key };
  }

  /**
   * If the group restriction is on (GOOGLE_ALLOWED_GROUPS set), the service
   * account and the admin subject are MANDATORY. Without them the gate would be
   * silently ignored (letting the whole domain in) — refuses to start.
   */
  private assertGroupGatingConfig(): void {
    if (this.allowedGoogleGroups.length === 0) return;
    const missing: string[] = [];
    if (!this.googleWorkspaceSa) missing.push('GOOGLE_WORKSPACE_SA_JSON');
    if (!this.env.GOOGLE_WORKSPACE_ADMIN_SUBJECT.trim())
      missing.push('GOOGLE_WORKSPACE_ADMIN_SUBJECT');
    if (missing.length > 0) {
      throw new Error(
        `GOOGLE_ALLOWED_GROUPS is set but missing: ${missing.join(', ')}. ` +
          'Without the Directory API service account the group gate does not work — refusing to start.',
      );
    }
  }

  /**
   * Anti-lockout protection: at least ONE login method must exist.
   * If the local admin is disabled, Google OIDC must be configured.
   */
  private assertNoLockout(): void {
    if (!this.localAdminEnabled && !this.googleEnabled) {
      throw new Error(
        'No login method available: enable LOCAL_ADMIN_ENABLED or configure GOOGLE_CLIENT_ID/SECRET. ' +
          'Refusing to start to avoid lockout.',
      );
    }
  }

  get nodeEnv(): Env['NODE_ENV'] {
    return this.env.NODE_ENV;
  }
  get isProd(): boolean {
    return this.env.NODE_ENV === 'production';
  }
  /**
   * Secure cookies and HSTS depend on the BASE_URL SCHEME, not on NODE_ENV.
   * This way, `docker compose up` on http://localhost works (non-secure cookie),
   * and production on https://domain uses Secure cookies — regardless of NODE_ENV.
   */
  get isHttps(): boolean {
    return this.baseUrl.startsWith('https://');
  }
  get port(): number {
    return this.env.PORT;
  }
  get baseUrl(): string {
    return this.env.BASE_URL.replace(/\/$/, '');
  }
  get databaseUrl(): string {
    return this.env.DATABASE_URL;
  }
  get redisUrl(): string {
    return this.env.REDIS_URL;
  }
  get sessionSecret(): string {
    return this.env.SESSION_SECRET;
  }
  get sessionTtlMs(): number {
    return this.env.SESSION_TTL_HOURS * 3600 * 1000;
  }
  get trustProxyHops(): number {
    return this.env.TRUST_PROXY_HOPS;
  }
  get googleEnabled(): boolean {
    return Boolean(this.env.GOOGLE_CLIENT_ID && this.env.GOOGLE_CLIENT_SECRET);
  }
  get googleClientId(): string {
    return this.env.GOOGLE_CLIENT_ID;
  }
  get googleClientSecret(): string {
    return this.env.GOOGLE_CLIENT_SECRET;
  }
  get googleRedirectUri(): string {
    return `${this.baseUrl}${this.env.OIDC_REDIRECT_PATH}`;
  }
  get localAdminEnabled(): boolean {
    return this.env.LOCAL_ADMIN_ENABLED;
  }
  get defaultUserRole(): Role {
    return this.env.DEFAULT_USER_ROLE;
  }
  get seedDemo(): boolean {
    return this.env.SEED_DEMO === '1' || this.env.SEED_DEMO.toLowerCase() === 'true';
  }

  /** AI assistant enabled when a provider was configured (validated at boot). */
  get aiEnabled(): boolean {
    return Boolean(this.env.AI_PROVIDER);
  }
  get ai(): {
    provider: 'anthropic' | 'ollama' | '';
    model: string;
    apiKey: string;
    ollamaBaseUrl: string;
  } {
    return {
      provider: this.env.AI_PROVIDER,
      model: this.env.AI_MODEL.trim(),
      apiKey: this.env.ANTHROPIC_API_KEY,
      ollamaBaseUrl: this.env.OLLAMA_BASE_URL.replace(/\/$/, ''),
    };
  }

  /** Hostname/port from BASE_URL, used as the WebAuthn rpID/origin. */
  get rpId(): string {
    return new URL(this.baseUrl).hostname;
  }
  get rpName(): string {
    return 'THOTH';
  }
  get webauthnOrigin(): string {
    return new URL(this.baseUrl).origin;
  }

  /** Google group restriction active (only group members can log in). */
  get googleGroupGatingEnabled(): boolean {
    return this.allowedGoogleGroups.length > 0;
  }

  get googleWorkspaceAdminSubject(): string {
    return this.env.GOOGLE_WORKSPACE_ADMIN_SUBJECT.trim();
  }

  isEmailAllowed(email: string): boolean {
    const domain = email.toLowerCase().split('@')[1];
    return Boolean(domain) && this.allowedEmailDomains.includes(domain);
  }

  isAdminEmail(email: string): boolean {
    return this.adminEmails.includes(email.toLowerCase());
  }
}
