import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { ZodType, ZodTypeDef } from 'zod';

/**
 * Pipe that validates the body/params against a zod schema.
 * Usage: `@Body(new ZodValidationPipe(createProjectSchema)) body: CreateProjectInput`
 * The input type is open (`unknown`) to accept schemas with transform
 * (e.g. query string "a,b,c" → string[]).
 */
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodType<T, ZodTypeDef, unknown>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation error',
        errors: result.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    return result.data;
  }
}
