import type { OwaspCategory } from '@prisma/client';
import type { OwaspCategoryDto } from '@thoth/shared';

/** Serializes an OwaspCategory (or null) to the lean embedded DTO. */
export function serializeOwasp(c: OwaspCategory | null): OwaspCategoryDto | null {
  if (!c) return null;
  return { id: c.id, family: c.family, code: c.code, name: c.name, order: c.order };
}
