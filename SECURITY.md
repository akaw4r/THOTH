# Security Policy

## Supported Versions

Only the latest release receives security fixes.

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Please use GitHub's private vulnerability reporting:  
**Security → "Report a vulnerability"** in this repository.

We will acknowledge your report within **5 business days** and aim to release a fix within **30 days** depending on severity.

Please include:

- Description of the vulnerability and its potential impact
- Steps to reproduce
- Any suggested mitigations (optional)

## Scope

In scope:

- The THOTH application code (API, web, worker)
- Authentication and authorization logic
- Cryptographic implementations
- Docker/deployment configuration

Out of scope:

- Vulnerabilities in third-party dependencies (please report upstream)
- Vulnerabilities requiring physical access to the host
- Social engineering attacks
