import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import session from 'express-session';
import RedisStore from 'connect-redis';
import { Redis } from 'ioredis';
import { AppModule } from '../src/app.module';

// TEST defaults for the ConfigService's required env vars: CI only provides
// DATABASE_URL/REDIS_URL. Real values (if exported) take precedence.
process.env.BASE_URL ??= 'http://localhost:3000';
process.env.SESSION_SECRET ??= 'test-secret-test-secret-test-secret';
process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString('base64');

/** Boots the app the same way main.ts does, for the e2e tests. */
export async function createTestApp(): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  app.set('trust proxy', 1);
  app.setGlobalPrefix('api');

  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
  });
  app.use(
    session({
      name: 'thoth.sid',
      secret: 'test-secret-test-secret-test-secret',
      store: new RedisStore({ client: redis, prefix: 'thoth:test:sess:' }),
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 3600_000 },
    }),
  );
  await app.init();
  return app;
}
