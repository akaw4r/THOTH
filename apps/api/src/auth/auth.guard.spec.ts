import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from './auth.guard';
import { ALLOW_PENDING_MFA, IS_PUBLIC } from './decorators';

const baseUser = {
  id: 'u1',
  email: 'u@example.com',
  name: 'User',
  role: 'AUTHOR',
  isLocalAdmin: false,
  mfaEnrolled: true,
};

function contextFor(req: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => 'handler',
    getClass: () => 'class',
  } as unknown as ExecutionContext;
}

describe('AuthGuard (MFA mandatory on first access)', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let metadata: Record<string, boolean>;
  let guard: AuthGuard;

  const reflector = {
    getAllAndOverride: (key: string) => metadata[key],
  } as unknown as Reflector;

  const configWith = (mfaRequired: boolean) =>
    ({ mfaRequired }) as unknown as import('../config/config.service').ConfigService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    metadata = {};
    guard = new AuthGuard(reflector, prisma, configWith(true));
  });

  it('rejects without a session', async () => {
    await expect(guard.canActivate(contextFor({ session: {} }))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('allows a user with MFA enrolled', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(baseUser);
    const req: Record<string, unknown> = { session: { userId: 'u1' } };
    await expect(guard.canActivate(contextFor(req))).resolves.toBe(true);
  });

  it('blocks a user WITHOUT MFA with 403 mfa_enrollment_required', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...baseUser, mfaEnrolled: false });
    const req: Record<string, unknown> = { session: { userId: 'u1' } };
    await expect(guard.canActivate(contextFor(req))).rejects.toMatchObject({
      constructor: ForbiddenException,
      response: { error: 'mfa_enrollment_required' },
    });
  });

  it('allows a user WITHOUT MFA when MFA_REQUIRED=false', async () => {
    guard = new AuthGuard(reflector, prisma, configWith(false));
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...baseUser, mfaEnrolled: false });
    const req: Record<string, unknown> = { session: { userId: 'u1' } };
    await expect(guard.canActivate(contextFor(req))).resolves.toBe(true);
  });

  it('allows a user WITHOUT MFA on an @AllowPendingMfa route (MFA enrollment/logout)', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...baseUser, mfaEnrolled: false });
    metadata[ALLOW_PENDING_MFA] = true;
    const req: Record<string, unknown> = { session: { userId: 'u1' } };
    await expect(guard.canActivate(contextFor(req))).resolves.toBe(true);
  });

  it('public routes bypass everything', async () => {
    metadata[IS_PUBLIC] = true;
    await expect(guard.canActivate(contextFor({ session: {} }))).resolves.toBe(true);
  });
});
