import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from './project-access.service';
import type { AuthUser } from './decorators';

const admin: AuthUser = {
  id: 'a1',
  email: 'a@example.com',
  name: 'Admin',
  role: 'ADMIN',
  isLocalAdmin: false,
};
const author: AuthUser = {
  id: 'u1',
  email: 'u@example.com',
  name: 'Author',
  role: 'AUTHOR',
  isLocalAdmin: false,
};

describe('ProjectAccessService (isolation between projects)', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let service: ProjectAccessService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new ProjectAccessService(prisma);
  });

  it('global ADMIN has effective MANAGER role in any project', async () => {
    const role = await service.effectiveRole(admin, 'proj-x');
    expect(role).toBe('MANAGER');
    expect(prisma.projectMember.findUnique).not.toHaveBeenCalled();
  });

  it('non-member has no access (null)', async () => {
    (prisma.projectMember.findUnique as jest.Mock).mockResolvedValue(null);
    const role = await service.effectiveRole(author, 'someone-elses-proj');
    expect(role).toBeNull();
  });

  it('member gets the membership role', async () => {
    (prisma.projectMember.findUnique as jest.Mock).mockResolvedValue({ role: 'EDITOR' });
    const role = await service.effectiveRole(author, 'my-proj');
    expect(role).toBe('EDITOR');
  });

  it('role hierarchy is respected', () => {
    expect(service.hasAtLeast('MANAGER', 'EDITOR')).toBe(true);
    expect(service.hasAtLeast('EDITOR', 'EDITOR')).toBe(true);
    expect(service.hasAtLeast('VIEWER', 'EDITOR')).toBe(false);
    expect(service.hasAtLeast(null, 'VIEWER')).toBe(false);
  });

  it('ADMIN sees all projects (empty filter)', async () => {
    const filter = await service.visibleProjectFilter(admin);
    expect(filter).toEqual({});
  });

  it('non-admin only sees projects where they are a member', async () => {
    (prisma.projectMember.findMany as jest.Mock).mockResolvedValue([
      { projectId: 'p1' },
      { projectId: 'p2' },
    ]);
    const filter = await service.visibleProjectFilter(author);
    expect(filter).toEqual({ id: { in: ['p1', 'p2'] } });
  });
});
