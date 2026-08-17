/**
 * Creates/updates a local admin account (break-glass).
 *
 *   npm run create-admin -- --username breakglass --email admin@example.com
 *
 * The password comes from LOCAL_ADMIN_INITIAL_PASSWORD or an interactive prompt.
 * At the end, the account is flagged to change the password and enroll MFA on first access.
 */
import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import * as readline from 'node:readline';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

interface Args {
  username: string;
  email: string;
  name: string;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (flag: string, fallback: string): string => {
    const i = argv.indexOf(flag);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
  };
  return {
    username: get('--username', 'breakglass'),
    email: get('--email', 'breakglass@local'),
    name: get('--name', 'Break-glass Admin'),
  };
}

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const stdout = process.stdout as NodeJS.WriteStream & { muted?: boolean };
    stdout.write(question);
    stdout.muted = true;
    // Mutes the echo while the user types the password.
    const originalWrite = stdout.write.bind(stdout);
    (stdout as any).write = (chunk: any, ...rest: any[]) => {
      if (!stdout.muted) return originalWrite(chunk, ...rest);
      return true;
    };
    rl.question('', (answer) => {
      stdout.muted = false;
      (stdout as any).write = originalWrite;
      stdout.write('\n');
      rl.close();
      resolve(answer);
    });
  });
}

async function main(): Promise<void> {
  const args = parseArgs();
  const prisma = new PrismaClient();

  let password = process.env.LOCAL_ADMIN_INITIAL_PASSWORD ?? '';
  let generated = false;
  if (!password) {
    if (process.stdin.isTTY) {
      password = await promptHidden('Initial local admin password: ');
    }
    if (!password) {
      password = randomBytes(15).toString('base64');
      generated = true;
    }
  }
  if (password.length < 12) {
    // eslint-disable-next-line no-console
    console.error('The initial password must be at least 12 characters long.');
    process.exit(1);
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const user = await prisma.user.upsert({
    where: { username: args.username },
    update: {
      email: args.email,
      name: args.name,
      role: 'ADMIN',
      isLocalAdmin: true,
      passwordHash,
      mustChangePassword: true,
      mfaEnrolled: false,
      totpSecretEnc: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
    create: {
      username: args.username,
      email: args.email,
      name: args.name,
      role: 'ADMIN',
      isLocalAdmin: true,
      passwordHash,
      mustChangePassword: true,
    },
  });

  // eslint-disable-next-line no-console
  console.log(`\nLocal admin ready:`);
  // eslint-disable-next-line no-console
  console.log(`  username: ${user.username}`);
  // eslint-disable-next-line no-console
  console.log(`  email:    ${user.email}`);
  if (generated) {
    // eslint-disable-next-line no-console
    console.log(`  GENERATED PASSWORD (save it now, it will not be shown again): ${password}`);
  }
  // eslint-disable-next-line no-console
  console.log(`\nGo to the UNADVERTISED route /auth/local for the first login.`);
  // eslint-disable-next-line no-console
  console.log(`On first access you will be required to change the password and enroll MFA.\n`);

  await prisma.$disconnect();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
