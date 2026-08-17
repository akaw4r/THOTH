import type { OwaspCategory } from '@prisma/client';
import { serializeOwasp } from './owasp.serialize';

describe('serializeOwasp', () => {
  it('returns null for null input', () => {
    expect(serializeOwasp(null)).toBeNull();
  });

  it('projects only the DTO fields (without createdAt)', () => {
    const row = {
      id: 'a1',
      family: 'WEB',
      code: 'A01:2021',
      name: 'Broken Access Control',
      order: 1,
      createdAt: new Date(),
    } as OwaspCategory;
    expect(serializeOwasp(row)).toEqual({
      id: 'a1',
      family: 'WEB',
      code: 'A01:2021',
      name: 'Broken Access Control',
      order: 1,
    });
  });
});
