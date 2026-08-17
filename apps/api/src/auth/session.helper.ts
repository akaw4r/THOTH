import { randomBytes } from 'node:crypto';
import type { Request } from 'express';
import type { User } from '@prisma/client';

/** Regenerates the session ID (prevents fixation) and returns a Promise. */
export function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

export function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((err) => (err ? reject(err) : resolve()));
  });
}

export function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => (err ? reject(err) : resolve()));
  });
}

/**
 * Establishes the authenticated session with a new ID and a fresh CSRF token.
 * Must be called only after all factors have been validated.
 */
export async function establishSession(req: Request, user: User): Promise<void> {
  await regenerateSession(req);
  req.session.userId = user.id;
  req.session.role = user.role;
  req.session.isLocalAdmin = user.isLocalAdmin;
  req.session.csrfToken = randomBytes(32).toString('hex');
  await saveSession(req);
}

export function ensureCsrfToken(req: Request): string {
  if (!req.session.csrfToken) {
    req.session.csrfToken = randomBytes(32).toString('hex');
  }
  return req.session.csrfToken;
}
