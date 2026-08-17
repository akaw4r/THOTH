import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { authenticator } from 'otplib';
import * as argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import { createTestApp } from './app.factory';

/**
 * E2E of the break-glass authentication flow + CSRF + project creation.
 * Requires Postgres and Redis (provided by CI). Migrations applied beforehand.
 */
describe('Auth e2e (local break-glass admin)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaClient;
  const username = `bg_${Date.now()}`;
  const initialPassword = 'SecureInitial#123';

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.user.create({
      data: {
        username,
        email: `${username}@local`,
        name: 'Break-glass Test',
        role: 'ADMIN',
        isLocalAdmin: true,
        passwordHash: await argon2.hash(initialPassword, { type: argon2.argon2id }),
        mustChangePassword: true,
      },
    });
    app = await createTestApp();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { username } });
    await prisma.$disconnect();
    await app.close();
  });

  it('GET /api/health responds ok', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/health/ready responds ok with dependencies up', async () => {
    const res = await request(app.getHttpServer()).get('/api/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.checks).toEqual({ db: 'up', redis: 'up' });
  });

  it('GET /api/auth/me returns csrf and null user', async () => {
    const res = await request(app.getHttpServer()).get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
    expect(res.body.csrfToken).toBeTruthy();
    expect(res.body.localAdminEnabled).toBe(true);
  });

  // Gets the CSRF token (and seeds the session cookie) like the frontend does at boot.
  const getCsrf = async (agent: ReturnType<typeof request.agent>): Promise<string> => {
    const me = await agent.get('/api/auth/me');
    return me.body.csrfToken as string;
  };

  it('completes the flow: password → password change → TOTP setup → authenticated', async () => {
    const agent = request.agent(app.getHttpServer());
    const newPassword = 'NewStrongPassword#456';

    // CSRF token stable throughout the pre-authentication flow
    const csrf = await getCsrf(agent);

    // 1) initial password → requires password change
    let res = await agent
      .post('/api/auth/local/login')
      .set('x-csrf-token', csrf)
      .send({ username, password: initialPassword });
    expect(res.status).toBe(201);
    expect(res.body.step).toBe('password_change_required');

    // 2) password change → requires MFA setup
    res = await agent
      .post('/api/auth/local/password')
      .set('x-csrf-token', csrf)
      .send({ newPassword });
    expect(res.status).toBe(201);
    expect(res.body.step).toBe('mfa_setup_required');

    // 3) TOTP setup
    res = await agent.get('/api/auth/local/mfa/totp/setup');
    expect(res.status).toBe(200);
    const secret = res.body.secret as string;
    expect(secret).toBeTruthy();

    // 4) confirms the first code → authenticated
    const code = authenticator.generate(secret);
    res = await agent
      .post('/api/auth/local/mfa/totp/enroll')
      .set('x-csrf-token', csrf)
      .send({ code });
    expect(res.status).toBe(201);
    expect(res.body.step).toBe('authenticated');

    // 5) authenticated session (CSRF token rotates after establishSession)
    res = await agent.get('/api/auth/me');
    expect(res.body.user?.role).toBe('ADMIN');
    expect(res.body.user?.mfaEnrolled).toBe(true);
    const csrf2 = res.body.csrfToken as string;

    // 6) CSRF: without the header → 403
    const noCsrf = await agent.post('/api/projects').send({ name: 'Proj without csrf' });
    expect(noCsrf.status).toBe(403);

    // 7) CSRF: with the header → creates the project and seeds default sections
    const created = await agent
      .post('/api/projects')
      .set('x-csrf-token', csrf2)
      .send({ name: 'Pentest E2E', client: 'ACME' });
    expect(created.status).toBe(201);
    expect(created.body.id).toBeTruthy();
    // the creator joins as the project's MANAGER
    expect(created.body.members?.some((m: { role: string }) => m.role === 'MANAGER')).toBe(true);

    // the project shows up in the user's listing with myRole=MANAGER (isolation)
    const list = await agent.get('/api/projects');
    const mine = (list.body as Array<{ id: string; myRole: string }>).find(
      (p) => p.id === created.body.id,
    );
    expect(mine?.myRole).toBe('MANAGER');

    // cleanup of the created project
    await prisma.project.deleteMany({ where: { id: created.body.id } });
  });

  it('blocks local login with a wrong password', async () => {
    const agent = request.agent(app.getHttpServer());
    const csrf = await getCsrf(agent);
    const res = await agent
      .post('/api/auth/local/login')
      .set('x-csrf-token', csrf)
      .send({ username, password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('requires authentication on protected routes', async () => {
    const res = await request(app.getHttpServer()).get('/api/projects');
    expect(res.status).toBe(401);
  });
});
