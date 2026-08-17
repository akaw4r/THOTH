import { ConfigService } from './config.service';

const base = {
  BASE_URL: 'http://localhost:8080',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  SESSION_SECRET: 'x'.repeat(32),
  ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
} as NodeJS.ProcessEnv;

describe('ConfigService', () => {
  it('accepts config with local admin enabled', () => {
    const config = new ConfigService({ ...base, LOCAL_ADMIN_ENABLED: 'true' });
    expect(config.localAdminEnabled).toBe(true);
    expect(config.googleEnabled).toBe(false);
  });

  it('trust proxy: defaults to 1, accepts override and rejects invalid values', () => {
    expect(new ConfigService({ ...base }).trustProxyHops).toBe(1);
    expect(new ConfigService({ ...base, TRUST_PROXY_HOPS: '2' }).trustProxyHops).toBe(2);
    expect(() => new ConfigService({ ...base, TRUST_PROXY_HOPS: '-1' })).toThrow(
      /Invalid environment configuration/,
    );
  });

  it('prevents lockout: refuses to start without any login method', () => {
    expect(() => new ConfigService({ ...base, LOCAL_ADMIN_ENABLED: 'false' })).toThrow(
      /No login method/,
    );
  });

  it('allows disabling local admin if Google is configured', () => {
    const config = new ConfigService({
      ...base,
      LOCAL_ADMIN_ENABLED: 'false',
      GOOGLE_CLIENT_ID: 'id',
      GOOGLE_CLIENT_SECRET: 'secret',
    });
    expect(config.localAdminEnabled).toBe(false);
    expect(config.googleEnabled).toBe(true);
  });

  it('validates email domains and admins', () => {
    const config = new ConfigService({
      ...base,
      ALLOWED_EMAIL_DOMAINS: 'example.com, example.org',
      ADMIN_EMAILS: 'boss@example.com',
    });
    expect(config.isEmailAllowed('someone@example.com')).toBe(true);
    expect(config.isEmailAllowed('someone@example.org')).toBe(true);
    expect(config.isEmailAllowed('someone@gmail.com')).toBe(false);
    expect(config.isAdminEmail('boss@example.com')).toBe(true);
    expect(config.isAdminEmail('other@example.com')).toBe(false);
  });

  it('rejects ENCRYPTION_KEY with invalid length', () => {
    expect(() => new ConfigService({ ...base, ENCRYPTION_KEY: 'short' })).toThrow();
  });

  it('derives redirect URI and rpId from BASE_URL', () => {
    const config = new ConfigService({ ...base, BASE_URL: 'https://thoth.example.com' });
    expect(config.googleRedirectUri).toBe('https://thoth.example.com/api/auth/callback/google');
    expect(config.rpId).toBe('thoth.example.com');
    expect(config.webauthnOrigin).toBe('https://thoth.example.com');
  });

  // --- Google group gate (Directory API) ---
  const fakeSa = JSON.stringify({
    client_email: 'sa@proj.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n',
  });

  it('group gate off by default', () => {
    expect(new ConfigService({ ...base }).googleGroupGatingEnabled).toBe(false);
  });

  it('anti-bypass: group set without a service account refuses to start', () => {
    expect(() => new ConfigService({ ...base, GOOGLE_ALLOWED_GROUPS: 'sec@example.com' })).toThrow(
      /GOOGLE_ALLOWED_GROUPS/,
    );
  });

  it('enables the gate with service account (JSON) + subject', () => {
    const config = new ConfigService({
      ...base,
      GOOGLE_ALLOWED_GROUPS: 'security-group@example.com',
      GOOGLE_WORKSPACE_SA_JSON: fakeSa,
      GOOGLE_WORKSPACE_ADMIN_SUBJECT: 'admin@example.com',
    });
    expect(config.googleGroupGatingEnabled).toBe(true);
    expect(config.allowedGoogleGroups).toContain('security-group@example.com');
    expect(config.googleWorkspaceSa?.clientEmail).toBe('sa@proj.iam.gserviceaccount.com');
    expect(config.googleWorkspaceAdminSubject).toBe('admin@example.com');
  });

  it('MFA is optional by default and enforceable via MFA_REQUIRED', () => {
    expect(new ConfigService({ ...base }).mfaRequired).toBe(false);
    expect(new ConfigService({ ...base, MFA_REQUIRED: 'true' }).mfaRequired).toBe(true);
  });

  // --- AI assistant ---
  it('AI disabled by default', () => {
    expect(new ConfigService({ ...base }).aiEnabled).toBe(false);
  });

  it('anthropic requires AI_MODEL and ANTHROPIC_API_KEY', () => {
    expect(() => new ConfigService({ ...base, AI_PROVIDER: 'anthropic' })).toThrow(
      /AI_PROVIDER=anthropic/,
    );
    const config = new ConfigService({
      ...base,
      AI_PROVIDER: 'anthropic',
      AI_MODEL: 'claude-opus-5',
      ANTHROPIC_API_KEY: 'sk-test',
    });
    expect(config.aiEnabled).toBe(true);
    expect(config.ai.provider).toBe('anthropic');
    expect(config.ai.model).toBe('claude-opus-5');
  });

  it('ollama requires only the model and normalizes the base URL', () => {
    expect(() => new ConfigService({ ...base, AI_PROVIDER: 'ollama' })).toThrow(/AI_MODEL/);
    const config = new ConfigService({
      ...base,
      AI_PROVIDER: 'ollama',
      AI_MODEL: 'llama3.1',
      OLLAMA_BASE_URL: 'http://host.docker.internal:11434/',
    });
    expect(config.aiEnabled).toBe(true);
    expect(config.ai.ollamaBaseUrl).toBe('http://host.docker.internal:11434');
  });

  it('accepts the service account in base64', () => {
    const config = new ConfigService({
      ...base,
      GOOGLE_ALLOWED_GROUPS: 'g@example.com',
      GOOGLE_WORKSPACE_SA_JSON: Buffer.from(fakeSa).toString('base64'),
      GOOGLE_WORKSPACE_ADMIN_SUBJECT: 'admin@example.com',
    });
    expect(config.googleWorkspaceSa?.clientEmail).toBe('sa@proj.iam.gserviceaccount.com');
  });
});
