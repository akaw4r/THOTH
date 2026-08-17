import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import session from 'express-session';
import RedisStore from 'connect-redis';
import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';
import { RedisService } from './redis/redis.service';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);
  const redis = app.get(RedisService);

  // Number of trusted proxies (local Caddy = 1; a platform may have more hops).
  // Affects req.ip (throttler) and req.secure (Secure cookie). See TRUST_PROXY_HOPS.
  app.set('trust proxy', config.trustProxyHops);
  app.disable('x-powered-by');

  app.setGlobalPrefix('api');

  // Secure headers. The API responds with JSON; a restrictive CSP is appropriate.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      hsts: config.isHttps ? { maxAge: 15552000, includeSubDomains: true } : false,
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );

  app.use(
    session({
      name: 'thoth.sid',
      secret: config.sessionSecret,
      store: new RedisStore({ client: redis.client, prefix: 'thoth:sess:' }),
      resave: false,
      saveUninitialized: false,
      rolling: true, // renews expiration on every request
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.isHttps,
        maxAge: config.sessionTtlMs,
      },
    }),
  );

  // Payload validation is done by ZodValidationPipe on the routes (zod), not
  // by ValidationPipe (class-validator) — we keep a single approach.

  app.enableShutdownHooks();

  await app.listen(config.port, '0.0.0.0');
  logger.log(`THOTH API listening on port ${config.port} (base: ${config.baseUrl})`);
  logger.log(`Google OIDC: ${config.googleEnabled ? 'enabled' : 'DISABLED'}`);
  logger.log(`Local admin: ${config.localAdminEnabled ? 'enabled' : 'disabled'}`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start the API:', err);
  process.exit(1);
});
