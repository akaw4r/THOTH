# Contributing to THOTH

Thank you for your interest in contributing!

## Getting Started

1. Fork the repository and clone your fork
2. Run `./install.sh` to set up the local environment
3. Create a branch following the naming convention: `feat-`, `bug-`, `refactor-`, `docs-` (e.g. `feat-add-cvss-v4`)

## Development

```bash
# Install dependencies
npm install

# Start all services
docker compose up -d

# Run API in watch mode (from apps/api)
npm run start:dev

# Run frontend (from apps/web)
npm run dev
```

## Submitting a Pull Request

1. Ensure your branch is up to date with `main`
2. Run tests before opening a PR:
   ```bash
   # Unit tests
   npm run test

   # E2E tests
   cd e2e && npx playwright test
   ```
3. Open a PR against `main` with a clear description of what and why
4. PRs must pass all checks and receive at least one approval before merging

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(findings): add CVSS v4 support
fix(auth): correct session expiry on logout
docs(readme): update quick start instructions
```

## Reporting Bugs

Use the **Bug Report** issue template. For security vulnerabilities, see [SECURITY.md](../SECURITY.md).

## Code Style

- TypeScript strict mode is enforced
- ESLint rules must pass (`npm run lint`)
- No hardcoded secrets or credentials
