import type { OwaspFamily, Severity } from './constants';

/**
 * Standardized finding library (reference templates).
 *
 * Individually covers each subcategory/vector of the three supported
 * taxonomies: OWASP Top 10 Web (2021), OWASP API Security Top 10 (2023) and
 * OWASP Top 10 for LLM Applications. `owaspCode` references the natural
 * identity of OWASP_CATEGORIES (constants.ts) — the seed resolves the code to
 * the corresponding `owaspCategoryId`.
 *
 * This is the source of truth for the seeded catalog. The legacy templates
 * were discarded; every entry here is canonical and reproducible across boots.
 */
export interface FindingLibraryEntry {
  /** Canonical OWASP category code (e.g. 'A01:2021', 'API1:2023', 'LLM01'). */
  owaspCode: string;
  family: OwaspFamily;
  title: string;
  severity: Severity;
  tags: string[];
  descriptionMd: string;
  impactMd: string;
  recommendationMd: string;
  referencesMd: string;
}

const LIB_TAG = 'owasp-library';

/** Prefixes the library tag on every entry, ensuring traceability. */
function entry(e: Omit<FindingLibraryEntry, 'tags'> & { tags: string[] }): FindingLibraryEntry {
  return { ...e, tags: [LIB_TAG, ...e.tags] };
}

export const FINDING_TEMPLATE_LIBRARY: ReadonlyArray<FindingLibraryEntry> = [
  // =========================================================================
  // OWASP Top 10 (Web) — 2021
  // =========================================================================

  // --- A01:2021 — Broken Access Control ---
  entry({
    owaspCode: 'A01:2021',
    family: 'WEB',
    title: 'Insecure Direct Object References (IDOR)',
    severity: 'HIGH',
    tags: ['broken-access-control', 'idor', 'authorization'],
    descriptionMd:
      'The application exposes direct references to internal objects (numeric IDs, UUIDs, file names) in request parameters and uses that identifier to access the resource **without verifying** whether the authenticated user has permission over it. By swapping the identifier for another (e.g. `/api/invoices/1001` to `/api/invoices/1002`), an attacker accesses data belonging to other users.',
    impactMd:
      'Unauthorized reading, modification or deletion of third-party data (personal data, financial data or documents), with potential mass leakage via ID enumeration.',
    recommendationMd:
      '- Enforce **per-object** authorization checks on the server: every access must confirm that the resource belongs to (or was shared with) the session user.\n- Prefer non-sequential, unpredictable identifiers (UUIDv4) — not as a replacement for access control, only as defense in depth.\n- Centralize the authorization decision (policy/guard) instead of repeating ad-hoc checks per endpoint.',
    referencesMd:
      '- https://owasp.org/Top10/A01_2021-Broken_Access_Control/\n- https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html\n- CWE-639: Authorization Bypass Through User-Controlled Key',
  }),
  entry({
    owaspCode: 'A01:2021',
    family: 'WEB',
    title: 'Path Traversal / Directory Traversal',
    severity: 'HIGH',
    tags: ['broken-access-control', 'path-traversal', 'lfi'],
    descriptionMd:
      'A parameter used to build a file path on the server is neither normalized nor validated, allowing sequences such as `../` (or encoded variants: `%2e%2e%2f`, `....//`) to escape the intended directory and read or write arbitrary system files (e.g. `/etc/passwd`, configuration files, source code).',
    impactMd:
      'Disclosure of sensitive files (secrets, credentials, source code) and, in write scenarios, file overwrites with possible remote code execution.',
    recommendationMd:
      '- Never build paths from user input. Use an opaque identifier mapped, on the server, to the real path.\n- Canonicalize the resulting path and verify that it remains **inside** the allowed base directory (allow-list) after resolution.\n- Run the service with the least possible filesystem privilege.',
    referencesMd:
      '- https://owasp.org/www-community/attacks/Path_Traversal\n- https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html\n- CWE-22: Improper Limitation of a Pathname to a Restricted Directory',
  }),
  entry({
    owaspCode: 'A01:2021',
    family: 'WEB',
    title: 'CORS Misconfiguration',
    severity: 'MEDIUM',
    tags: ['broken-access-control', 'cors', 'misconfiguration'],
    descriptionMd:
      'The CORS policy reflects the request origin (`Access-Control-Allow-Origin` echoing the `Origin` header), uses `*` combined with `Access-Control-Allow-Credentials: true`, or trusts loose subdomains/regexes. This allows third-party sites to make authenticated requests to the API on behalf of the victim and read the responses.',
    impactMd:
      'Malicious sites can read sensitive data and perform authenticated actions in the context of the victim, bypassing the same-origin policy.',
    recommendationMd:
      '- Maintain an **explicit allow-list** of trusted origins; never reflect the received origin.\n- Do not combine `Access-Control-Allow-Credentials: true` with a wildcard origin (`*`).\n- Validate the origin by exact match, without regexes that accept arbitrary subdomains (e.g. `evil-example.com`).',
    referencesMd:
      '- https://owasp.org/Top10/A01_2021-Broken_Access_Control/\n- https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS\n- CWE-942: Permissive Cross-domain Policy with Untrusted Domains',
  }),
  entry({
    owaspCode: 'A01:2021',
    family: 'WEB',
    title: 'Missing Function-Level Access Control',
    severity: 'HIGH',
    tags: ['broken-access-control', 'authorization', 'missing-function-level'],
    descriptionMd:
      'Privileged functions (admin panels, management endpoints) rely solely on the interface not exposing the link ("security through obscurity"), with no role/permission check on the server. A regular user who discovers or guesses the route (e.g. `/admin`, `/api/users/{id}/role`) executes the action directly.',
    impactMd:
      'Unprivileged users access administrative functionality, changing settings, accounts and data across the entire platform.',
    recommendationMd:
      '- Deny by default and require explicit role/permission verification on **every** sensitive function, on the server.\n- Do not rely on hiding UI elements as a security mechanism.\n- Cover administrative endpoints with automated authorization tests.',
    referencesMd:
      '- https://owasp.org/Top10/A01_2021-Broken_Access_Control/\n- CWE-862: Missing Authorization',
  }),
  entry({
    owaspCode: 'A01:2021',
    family: 'WEB',
    title: 'Privilege Escalation (Elevation of Privilege)',
    severity: 'CRITICAL',
    tags: ['broken-access-control', 'privilege-escalation'],
    descriptionMd:
      'It is possible to move from a lower-privilege context to a higher-privilege one without authorization — for example, by changing a `role`/`isAdmin` field in a profile update payload, abusing invite/approval flows, or exploiting inconsistent authorization checks across endpoints (horizontal and vertical escalation).',
    impactMd:
      'Total compromise of the authorization model: an attacker gains administrative privileges and controls the data and functions of all users.',
    recommendationMd:
      '- Derive privileges **exclusively** on the server side from the session identity; never accept roles/permissions coming from the client.\n- Protect sensitive fields against mass assignment (allow-list of editable fields).\n- Re-evaluate authorization on every sensitive state transition and record it in an audit log.',
    referencesMd:
      '- https://owasp.org/Top10/A01_2021-Broken_Access_Control/\n- CWE-269: Improper Privilege Management',
  }),
  entry({
    owaspCode: 'A01:2021',
    family: 'WEB',
    title: 'Access Control Bypass via Parameter Tampering',
    severity: 'HIGH',
    tags: ['broken-access-control', 'parameter-tampering'],
    descriptionMd:
      'Access decisions are based on client-controllable parameters — hidden form fields, unsigned cookies, custom headers (e.g. `X-Role: admin`), or query string flags (`?admin=true`, `?debug=1`). By tampering with these values, the attacker bypasses access restrictions.',
    impactMd:
      'Access to restricted functionality and data and, depending on the parameter, activation of debug modes or bypass of payment/approval flows.',
    recommendationMd:
      '- Do not make authorization decisions based on client-supplied data; use only server-side session state.\n- Sign and validate the integrity of any state that must travel through the client.\n- Ignore unexpected control headers/parameters and log anomalous attempts.',
    referencesMd:
      '- https://owasp.org/Top10/A01_2021-Broken_Access_Control/\n- CWE-639: Authorization Bypass Through User-Controlled Key',
  }),

  // --- A02:2021 — Cryptographic Failures ---
  entry({
    owaspCode: 'A02:2021',
    family: 'WEB',
    title: 'Cleartext Transmission of Sensitive Data (HTTP/FTP)',
    severity: 'HIGH',
    tags: ['cryptographic-failures', 'cleartext', 'tls'],
    descriptionMd:
      'Sensitive data (credentials, session tokens, personal data) travels over unencrypted channels — plain HTTP, FTP, or HTTPS downgraded due to missing redirects/HSTS. An attacker in a network position (public Wi-Fi, MITM) captures the traffic in the clear.',
    impactMd:
      'Interception of credentials and sessions, enabling account hijacking and reading of confidential data in transit.',
    recommendationMd:
      '- Enforce TLS 1.2+ on all traffic; redirect HTTP to HTTPS and enable **HSTS** with `includeSubDomains` and `preload`.\n- Eliminate cleartext protocols (FTP, Telnet) in favor of SFTP/SSH.\n- Mark session cookies as `Secure`.',
    referencesMd:
      '- https://owasp.org/Top10/A02_2021-Cryptographic_Failures/\n- https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html\n- CWE-319: Cleartext Transmission of Sensitive Information',
  }),
  entry({
    owaspCode: 'A02:2021',
    family: 'WEB',
    title: 'Use of Weak or Obsolete Cryptographic Algorithms',
    severity: 'HIGH',
    tags: ['cryptographic-failures', 'weak-crypto', 'hashing'],
    descriptionMd:
      'The application employs broken or inappropriate cryptographic primitives: MD5/SHA-1 hashes for passwords, DES/3DES/RC4 ciphers, ECB mode, or password hashing without a cost-based derivation function (bcrypt/scrypt/Argon2). These algorithms are vulnerable to collisions, accelerated brute force and pattern analysis.',
    impactMd:
      'Recovery of passwords and encrypted data, signature forgery and compromise of the confidentiality and integrity of protected data.',
    recommendationMd:
      '- Use **Argon2id**, scrypt or bcrypt for passwords, with adequate cost parameters and a unique salt.\n- For symmetric encryption, use AES-256 in an authenticated mode (GCM). Avoid ECB and legacy ciphers.\n- Use SHA-256+ for signatures and integrity; centralize cryptography in reviewed libraries.',
    referencesMd:
      '- https://owasp.org/Top10/A02_2021-Cryptographic_Failures/\n- https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html\n- CWE-327: Use of a Broken or Risky Cryptographic Algorithm',
  }),
  entry({
    owaspCode: 'A02:2021',
    family: 'WEB',
    title: 'Hardcoded Secrets and API Keys in Source Code',
    severity: 'HIGH',
    tags: ['cryptographic-failures', 'hardcoded-secrets', 'secrets-management'],
    descriptionMd:
      'Credentials, API keys, tokens or private keys are embedded in source code, in versioned configuration files or in the repository history. Anyone with access to the repository (or to the frontend bundle) can recover these secrets.',
    impactMd:
      'Direct compromise of integrated systems and services; secrets leaked into Git history remain exposed even after removal from the current file.',
    recommendationMd:
      '- Remove all secrets from the code and **rotate them** immediately (assume they have already leaked).\n- Manage secrets in a vault (Vault/Secrets Manager) or environment variables injected at runtime.\n- Adopt secret scanning in CI (git-secrets, gitleaks) and pre-commit hooks.',
    referencesMd:
      '- https://owasp.org/Top10/A02_2021-Cryptographic_Failures/\n- https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html\n- CWE-798: Use of Hard-coded Credentials',
  }),
  entry({
    owaspCode: 'A02:2021',
    family: 'WEB',
    title: 'Improper TLS/SSL Certificate Validation',
    severity: 'HIGH',
    tags: ['cryptographic-failures', 'tls', 'certificate-validation'],
    descriptionMd:
      'Clients or integrations disable TLS certificate verification (`verify=false`, `rejectUnauthorized: false`, `InsecureSkipVerify`) or fail to validate the certificate chain/hostname of the server. This neutralizes TLS protection against man-in-the-middle attacks.',
    impactMd:
      'An attacker on the network intercepts and alters supposedly secure communications, capturing credentials and data exchanged with third-party servers.',
    recommendationMd:
      '- Keep certificate validation **enabled** in all HTTP clients and integrations.\n- Validate the trust chain and hostname match; consider certificate pinning for critical integrations.\n- Never disable verification as a "fix" for certificate errors — fix the chain/CA instead.',
    referencesMd:
      '- https://owasp.org/Top10/A02_2021-Cryptographic_Failures/\n- https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html\n- CWE-295: Improper Certificate Validation',
  }),

  // --- A03:2021 — Injection ---
  entry({
    owaspCode: 'A03:2021',
    family: 'WEB',
    title: 'SQL Injection (In-band, Blind and Time-based)',
    severity: 'CRITICAL',
    tags: ['injection', 'sqli', 'database'],
    descriptionMd:
      'User input is concatenated directly into SQL queries, allowing injection of arbitrary commands. It is exploited **in-band** (data returned in the response or in error messages), as **boolean-based blind** (inference through behavioral differences) and **time-based** (inference through delays, e.g. `SLEEP()`), even when there is no visible output.',
    impactMd:
      'Unauthorized reading and modification of the entire database, authentication bypass and — depending on permissions — file reads and command execution on the database server.',
    recommendationMd:
      '- Use **parameterized queries** (prepared statements) or an ORM for all database interactions; never concatenate input.\n- Validate/normalize input and apply an allow-list for dynamic identifiers (column/ordering names).\n- Apply least privilege to the database user and disable detailed error messages in production.',
    referencesMd:
      '- https://owasp.org/Top10/A03_2021-Injection/\n- https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html\n- CWE-89: SQL Injection',
  }),
  entry({
    owaspCode: 'A03:2021',
    family: 'WEB',
    title: 'Command Injection (OS Command Injection)',
    severity: 'CRITICAL',
    tags: ['injection', 'command-injection', 'rce'],
    descriptionMd:
      'The application passes user input to an operating system shell (e.g. `exec`, `system`, `child_process`) without sanitization, allowing commands to be chained with metacharacters (`;`, `|`, `&&`, `$()`) and arbitrary commands to be executed on the server.',
    impactMd:
      'Remote code execution with the privileges of the application process, leading to full server compromise and pivoting into the internal network.',
    recommendationMd:
      '- Avoid invoking the shell. Use native language APIs for the intended task.\n- When an external binary is required, use argument-array execution (no shell) and a strict allow-list of values.\n- Validate input by type/format and run the process with the least possible privilege.',
    referencesMd:
      '- https://owasp.org/Top10/A03_2021-Injection/\n- https://cheatsheetseries.owasp.org/cheatsheets/OS_Command_Injection_Defense_Cheat_Sheet.html\n- CWE-78: OS Command Injection',
  }),
  entry({
    owaspCode: 'A03:2021',
    family: 'WEB',
    title: 'Cross-Site Scripting (Reflected, Stored and DOM-based)',
    severity: 'HIGH',
    tags: ['injection', 'xss', 'client-side'],
    descriptionMd:
      "The application inserts user-controlled data into HTML pages without proper output encoding. In the **reflected** (payload returned in the response), **stored** (persisted and served to other users) and **DOM-based** (insecure DOM manipulation on the client) variants, arbitrary scripts execute in the victim's browser.",
    impactMd:
      'Cookie/session theft, keylogging, phishing on the legitimate page, actions performed on behalf of the victim and, in the stored case, worms spreading between users.',
    recommendationMd:
      '- Apply **contextual output encoding** (HTML, attribute, JS, URL) at the rendering point; prefer frameworks with automatic escaping.\n- Never use APIs such as `innerHTML`/`dangerouslySetInnerHTML` with untrusted data; sanitize with DOMPurify when HTML is required.\n- Implement a restrictive **Content-Security-Policy** and mark cookies as `HttpOnly`.',
    referencesMd:
      '- https://owasp.org/Top10/A03_2021-Injection/\n- https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html\n- CWE-79: Cross-site Scripting',
  }),
  entry({
    owaspCode: 'A03:2021',
    family: 'WEB',
    title: 'Server-Side Template Injection (SSTI)',
    severity: 'HIGH',
    tags: ['injection', 'ssti', 'rce'],
    descriptionMd:
      'User input is interpolated directly into a template rendered on the server (Jinja2, Twig, Freemarker, Velocity, etc.), allowing injection of template language expressions. Depending on the engine, this leads to reading internal objects and, frequently, remote code execution.',
    impactMd:
      'Leakage of sensitive data from the server context and arbitrary code execution, culminating in host compromise.',
    recommendationMd:
      '- Never concatenate user input into the template **source**; pass data only as context variables.\n- Use engines in sandbox/logic-less mode and disable dangerous features.\n- Validate and escape input; treat user-supplied templates as untrusted code.',
    referencesMd:
      '- https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Input_Validation_Testing/18-Testing_for_Server-side_Template_Injection\n- CWE-1336: Improper Neutralization of Special Elements Used in a Template Engine',
  }),
  entry({
    owaspCode: 'A03:2021',
    family: 'WEB',
    title: 'LDAP Injection',
    severity: 'HIGH',
    tags: ['injection', 'ldap', 'authentication'],
    descriptionMd:
      'User input is concatenated into LDAP query filters without escaping, allowing the filter logic to be altered with metacharacters (`*`, `(`, `)`, `|`, `&`). This enables authentication bypass and enumeration/extraction of directory attributes.',
    impactMd:
      'Login bypass, enumeration of users and groups, and disclosure of sensitive attributes from the corporate directory.',
    recommendationMd:
      '- Escape input according to RFC 4515 (distinguished names and filters) using safe APIs from the LDAP library.\n- Apply a character allow-list and bind with the least privilege necessary.\n- Prefer parameterized search APIs instead of building filters by concatenation.',
    referencesMd:
      '- https://owasp.org/www-community/attacks/LDAP_Injection\n- https://cheatsheetseries.owasp.org/cheatsheets/LDAP_Injection_Prevention_Cheat_Sheet.html\n- CWE-90: LDAP Injection',
  }),
  entry({
    owaspCode: 'A03:2021',
    family: 'WEB',
    title: 'NoSQL Injection',
    severity: 'HIGH',
    tags: ['injection', 'nosql', 'database'],
    descriptionMd:
      'User input is used in queries to NoSQL databases (MongoDB, etc.) without type/structure validation, allowing injection of query operators (e.g. `{"$ne": null}`, `{"$gt": ""}`) or `$where`/JavaScript expressions. This alters the query logic and can bypass authentication.',
    impactMd:
      'Authentication bypass, unauthorized document extraction and, with `$where`/eval, code execution in the database context.',
    recommendationMd:
      '- Validate and type-coerce input (reject objects where a string is expected) using a schema (e.g. Zod).\n- Use APIs/ODMs that separate data from operators; disable `$where` and server-side JavaScript execution.\n- Apply least privilege to the database user.',
    referencesMd:
      '- https://owasp.org/www-community/attacks/NoSQL_injection\n- https://cheatsheetseries.owasp.org/cheatsheets/Injection_Prevention_Cheat_Sheet.html\n- CWE-943: Improper Neutralization of Special Elements in Data Query Logic',
  }),

  // --- A04:2021 — Insecure Design ---
  entry({
    owaspCode: 'A04:2021',
    family: 'WEB',
    title: 'Business Logic Flaws',
    severity: 'HIGH',
    tags: ['insecure-design', 'business-logic'],
    descriptionMd:
      'The business flow can be executed in unintended ways: skipping checkout steps, applying discounts/coupons repeatedly, manipulating quantities into negative values, or reordering calls to bypass validations. This is not a technical injection flaw, but one of design assumptions not validated on the server.',
    impactMd:
      'Financial fraud, obtaining goods/services without payment, promotion abuse and business state manipulation.',
    recommendationMd:
      '- Model and enforce, on the server, the business invariants and the **state machine** of each critical flow (mandatory steps, idempotency, limits).\n- Validate values in the business domain (e.g. quantities > 0, one coupon per order) in a centralized way.\n- Cover anticipated abuses with negative-case tests (abuse cases).',
    referencesMd:
      '- https://owasp.org/Top10/A04_2021-Insecure_Design/\n- https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/10-Business_Logic_Testing/\n- CWE-840: Business Logic Errors',
  }),
  entry({
    owaspCode: 'A04:2021',
    family: 'WEB',
    title: 'Missing Rate Limiting on Critical Flows',
    severity: 'MEDIUM',
    tags: ['insecure-design', 'rate-limiting', 'anti-automation'],
    descriptionMd:
      'Sensitive flows (login, MFA, OTP/email/SMS sending, coupons, account creation) have no rate limiting or anti-automation protection, allowing an attacker to execute them at high frequency via scripts.',
    impactMd:
      'Enables brute force, enumeration, message spam (with financial cost), and abuse of promotions and resources.',
    recommendationMd:
      '- Apply rate limiting per IP, account and credential (with progressive backoff) on critical flows.\n- Combine with CAPTCHA/proof-of-work and anomaly detection on usage spikes.\n- Define business quotas (e.g. N OTP resends per hour) and alert when they are exceeded.',
    referencesMd:
      '- https://owasp.org/Top10/A04_2021-Insecure_Design/\n- https://owasp.org/www-project-automated-threats-to-web-applications/\n- CWE-799: Improper Control of Interaction Frequency',
  }),
  entry({
    owaspCode: 'A04:2021',
    family: 'WEB',
    title: 'Insecure Password Recovery Flow',
    severity: 'HIGH',
    tags: ['insecure-design', 'password-reset', 'account-takeover'],
    descriptionMd:
      'The password recovery process has design weaknesses: predictable or long-lived tokens, short OTP codes without rate limiting (brute force), reset tokens not invalidated after use, or low-entropy security questions. This allows accounts belonging to other users to be taken over.',
    impactMd: 'Mass account takeover, bypassing the primary authentication.',
    recommendationMd:
      '- Generate high-entropy, single-use, short-lived random reset tokens; invalidate them after use or upon a new request.\n- Apply rate limiting and lockout to OTPs; use codes with adequate length/entropy.\n- Do not reveal whether the email exists (uniform responses) and notify the user about the change.',
    referencesMd:
      '- https://owasp.org/Top10/A04_2021-Insecure_Design/\n- https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html\n- CWE-640: Weak Password Recovery Mechanism',
  }),
  entry({
    owaspCode: 'A04:2021',
    family: 'WEB',
    title: 'Lack of Threat Modeling',
    severity: 'MEDIUM',
    tags: ['insecure-design', 'threat-modeling', 'sdlc'],
    descriptionMd:
      'There is no evidence of threat modeling in the development lifecycle: sensitive features are designed without systematic analysis of threat agents, trust flows and abuse cases. As a result, security controls are added reactively and inconsistently.',
    impactMd:
      'Structural design flaws that propagate across multiple features and are expensive to fix late, increasing the attack surface.',
    recommendationMd:
      '- Incorporate threat modeling (e.g. STRIDE) into the design of sensitive features, documenting assets, trust boundaries and mitigations.\n- Keep security requirements and abuse cases traceable to tests.\n- Reassess the model on every relevant architectural change.',
    referencesMd:
      '- https://owasp.org/Top10/A04_2021-Insecure_Design/\n- https://cheatsheetseries.owasp.org/cheatsheets/Threat_Modeling_Cheat_Sheet.html\n- CWE-1053: Missing Documentation for Design',
  }),

  // --- A05:2021 — Security Misconfiguration ---
  entry({
    owaspCode: 'A05:2021',
    family: 'WEB',
    title: 'Default Credentials',
    severity: 'CRITICAL',
    tags: ['security-misconfiguration', 'default-credentials'],
    descriptionMd:
      'Components (admin panels, databases, devices, frameworks) keep factory-default accounts and passwords (e.g. `admin/admin`, `root` with no password), which are publicly known and frequently indexed by automated scanners.',
    impactMd:
      'Immediate administrative access to the affected component, with compromise of data and, often, of the underlying host.',
    recommendationMd:
      '- Change or disable **all** default credentials before exposing the service; remove sample/demo accounts.\n- Force a password change on first access and require strong passwords.\n- Include default credential checks in hardening and periodic scans.',
    referencesMd:
      '- https://owasp.org/Top10/A05_2021-Security_Misconfiguration/\n- CWE-1392: Use of Default Credentials',
  }),
  entry({
    owaspCode: 'A05:2021',
    family: 'WEB',
    title: 'Verbose Error Messages / Debug Mode Enabled',
    severity: 'MEDIUM',
    tags: ['security-misconfiguration', 'verbose-errors', 'information-disclosure'],
    descriptionMd:
      'In production, the application exposes stack traces, SQL queries, internal paths, component versions or debug pages (e.g. profiler, `/actuator`, `DEBUG=True`). This information helps the attacker map the technology stack and plan targeted attacks.',
    impactMd:
      'Disclosure of internal information that accelerates the exploitation of other vulnerabilities and may directly reveal sensitive data.',
    recommendationMd:
      '- Disable debug mode and diagnostic pages in production; return generic error messages to the user.\n- Log details only on the server, with correlation by request ID.\n- Restrict/disable management endpoints (actuator, profiler) and remove headers that reveal versions.',
    referencesMd:
      '- https://owasp.org/Top10/A05_2021-Security_Misconfiguration/\n- CWE-209: Generation of Error Message Containing Sensitive Information',
  }),
  entry({
    owaspCode: 'A05:2021',
    family: 'WEB',
    title: 'Directory Listing Enabled',
    severity: 'LOW',
    tags: ['security-misconfiguration', 'directory-listing', 'information-disclosure'],
    descriptionMd:
      'The web server automatically lists the contents of directories without an index file, exposing files that should not be browsable (backups, `.git`, dumps, configuration files, uploads from other users).',
    impactMd:
      'Discovery of sensitive files and of the application structure, serving as a starting point for targeted attacks.',
    recommendationMd:
      '- Disable directory listing in the server configuration (e.g. `autoindex off`, `Options -Indexes`).\n- Block access to VCS directories and sensitive artifacts; remove backups from the webroot.\n- Serve static files from a dedicated, controlled directory.',
    referencesMd:
      '- https://owasp.org/Top10/A05_2021-Security_Misconfiguration/\n- CWE-548: Exposure of Information Through Directory Listing',
  }),
  entry({
    owaspCode: 'A05:2021',
    family: 'WEB',
    title: 'Insecure Security Header Implementation (HSTS, CSP)',
    severity: 'MEDIUM',
    tags: ['security-misconfiguration', 'security-headers', 'csp', 'hsts'],
    descriptionMd:
      'HTTP security headers are missing or misconfigured: no `Strict-Transport-Security`, no `Content-Security-Policy` (or a permissive CSP with `unsafe-inline`/`*`), missing `X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors`. This weakens defense in depth against XSS, clickjacking and downgrade attacks.',
    impactMd: 'Easier exploitation of XSS, clickjacking, MIME sniffing and TLS downgrade attacks.',
    recommendationMd:
      '- Enable **HSTS** with a long `max-age`, `includeSubDomains` and `preload`.\n- Implement a restrictive **CSP** (ideally with nonces/hashes, without `unsafe-inline`) and tune it using reports.\n- Add appropriate `X-Content-Type-Options: nosniff`, `frame-ancestors`/`X-Frame-Options` and `Referrer-Policy`.',
    referencesMd:
      '- https://owasp.org/Top10/A05_2021-Security_Misconfiguration/\n- https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html\n- CWE-693: Protection Mechanism Failure',
  }),

  // --- A06:2021 — Vulnerable and Outdated Components ---
  entry({
    owaspCode: 'A06:2021',
    family: 'WEB',
    title: 'Use of Libraries/Dependencies with Known CVEs',
    severity: 'HIGH',
    tags: ['vulnerable-components', 'dependencies', 'cve'],
    descriptionMd:
      'The application depends on third-party libraries with known, exploitable public vulnerabilities (CVEs), without an update/monitoring process. Exploits for many of these flaws are readily available.',
    impactMd:
      'Depending on the CVE, remote code execution, authentication bypass, DoS or data leakage — without the need to discover a new flaw.',
    recommendationMd:
      '- Maintain a dependency inventory (SBOM) and run **SCA** (e.g. `npm audit`, Dependabot, OWASP Dependency-Check) in CI.\n- Establish a patching process with severity-based SLAs and update vulnerable components.\n- Remove unused dependencies and prefer supported versions.',
    referencesMd:
      '- https://owasp.org/Top10/A06_2021-Vulnerable_and_Outdated_Components/\n- CWE-1035 / CWE-937: Using Components with Known Vulnerabilities',
  }),
  entry({
    owaspCode: 'A06:2021',
    family: 'WEB',
    title: 'Outdated Frameworks and Runtimes',
    severity: 'HIGH',
    tags: ['vulnerable-components', 'outdated-framework'],
    descriptionMd:
      'The application framework or runtime (language, application server, CMS) is on an end-of-life (EOL) or severely outdated version, no longer receiving security fixes and accumulating known vulnerabilities.',
    impactMd:
      'Exposure to public exploits and absence of patches for new flaws, increasing the risk of compromise.',
    recommendationMd:
      '- Plan upgrades to supported (LTS) versions and track the EOL cycles of components.\n- Automate the detection of outdated versions in the pipeline.\n- Treat framework upgrades as recurring maintenance, not as a one-off project.',
    referencesMd:
      '- https://owasp.org/Top10/A06_2021-Vulnerable_and_Outdated_Components/\n- CWE-1104: Use of Unmaintained Third Party Components',
  }),
  entry({
    owaspCode: 'A06:2021',
    family: 'WEB',
    title: 'Unpatched Operating Systems and Services',
    severity: 'HIGH',
    tags: ['vulnerable-components', 'patching', 'infrastructure'],
    descriptionMd:
      'Servers, containers or base images run operating systems and infrastructure services without recent security patches, exposing known system-level vulnerabilities.',
    impactMd:
      'Host compromise through system exploits, local privilege escalation and lateral movement across the network.',
    recommendationMd:
      '- Implement patch management with regular windows and severity-based prioritization.\n- Use minimal, up-to-date base images; rebuild and redeploy containers periodically.\n- Scan images/hosts for vulnerabilities (e.g. Trivy) in CI/CD and at runtime.',
    referencesMd:
      '- https://owasp.org/Top10/A06_2021-Vulnerable_and_Outdated_Components/\n- CWE-1104: Use of Unmaintained Third Party Components',
  }),

  // --- A07:2021 — Identification and Authentication Failures ---
  entry({
    owaspCode: 'A07:2021',
    family: 'WEB',
    title: 'Brute Force / Credential Stuffing',
    severity: 'HIGH',
    tags: ['authentication', 'brute-force', 'credential-stuffing'],
    descriptionMd:
      'The authentication endpoint neither limits attempts nor detects the use of leaked credentials, enabling password brute force and **credential stuffing** (automated use of username/password pairs leaked from other services).',
    impactMd: 'Account compromise at scale, especially where users reuse passwords.',
    recommendationMd:
      '- Apply rate limiting and progressive lockout per account and per IP; introduce CAPTCHA after repeated failures.\n- Require **MFA** and check passwords against breached password lists (k-anonymity, e.g. HIBP).\n- Monitor and alert on anomalous login patterns (many users, many origins).',
    referencesMd:
      '- https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/\n- https://cheatsheetseries.owasp.org/cheatsheets/Credential_Stuffing_Prevention_Cheat_Sheet.html\n- CWE-307: Improper Restriction of Excessive Authentication Attempts',
  }),
  entry({
    owaspCode: 'A07:2021',
    family: 'WEB',
    title: 'Weak Password Policy',
    severity: 'MEDIUM',
    tags: ['authentication', 'password-policy'],
    descriptionMd:
      'The application accepts weak passwords: low minimum length, no check against common/leaked passwords, or composition rules that encourage predictable patterns without increasing real entropy.',
    impactMd:
      'Passwords easily guessed through brute force and dictionary attacks, raising the risk of account compromise.',
    recommendationMd:
      '- Follow NIST 800-63B: a minimum of 8–12 characters, no arbitrary composition requirements, checking against common/leaked password lists.\n- Encourage passphrases and password managers; support long lengths.\n- Combine with MFA for sensitive accounts.',
    referencesMd:
      '- https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/\n- https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html\n- CWE-521: Weak Password Requirements',
  }),
  entry({
    owaspCode: 'A07:2021',
    family: 'WEB',
    title: 'Session Fixation',
    severity: 'MEDIUM',
    tags: ['authentication', 'session-fixation', 'session-management'],
    descriptionMd:
      'The application does not regenerate the session identifier after authentication. An attacker who forces the victim to use a known session identifier (via link/parameter) ends up sharing the authenticated session once the victim logs in.',
    impactMd: "Session hijacking and access to the victim's account after they authenticate.",
    recommendationMd:
      '- **Regenerate** the session identifier on login and on privilege level changes.\n- Do not accept session identifiers coming from URLs/parameters; use cookies only.\n- Invalidate old sessions on logout and on password change.',
    referencesMd:
      '- https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/\n- https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html\n- CWE-384: Session Fixation',
  }),
  entry({
    owaspCode: 'A07:2021',
    family: 'WEB',
    title: 'Insecure Session Cookie Management',
    severity: 'MEDIUM',
    tags: ['authentication', 'cookie', 'session-management'],
    descriptionMd:
      'Session cookies are issued without the proper security attributes — missing `HttpOnly`, `Secure` or `SameSite` — or with inadequate scope/expiration. This makes them accessible to scripts (XSS), liable to travel in cleartext or to be sent in cross-site requests (CSRF).',
    impactMd:
      'Session cookie theft via XSS or the network, and facilitation of CSRF attacks, leading to account hijacking.',
    recommendationMd:
      '- Issue session cookies with `HttpOnly`, `Secure` and `SameSite=Lax/Strict`.\n- Set adequate expiration/idle timeouts and limit the scope (`Path`, `Domain`).\n- Invalidate the cookie on the server at logout (not only on the client).',
    referencesMd:
      '- https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/\n- https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html\n- CWE-614 / CWE-1004: Sensitive Cookie Without Secure/HttpOnly',
  }),

  // --- A08:2021 — Software and Data Integrity Failures ---
  entry({
    owaspCode: 'A08:2021',
    family: 'WEB',
    title: 'Insecure Deserialization',
    severity: 'CRITICAL',
    tags: ['integrity-failures', 'deserialization', 'rce'],
    descriptionMd:
      'The application deserializes user-controlled data using mechanisms that allow instantiating arbitrary types or triggering gadgets (e.g. native Java/PHP/.NET serialization, `pickle` in Python). Malicious payloads abuse these gadgets to alter logic or execute code.',
    impactMd: 'Remote code execution, privilege escalation and tampering with application objects.',
    recommendationMd:
      '- Avoid deserializing formats that carry types/code; prefer pure data formats (JSON) with a validated schema.\n- If unavoidable, apply a type allow-list, integrity verification (signature/HMAC) and execute in an isolated environment.\n- Never trust serialized objects coming from the client for sensitive decisions.',
    referencesMd:
      '- https://owasp.org/Top10/A08_2021-Software_and_Data_Integrity_Failures/\n- https://cheatsheetseries.owasp.org/cheatsheets/Deserialization_Cheat_Sheet.html\n- CWE-502: Deserialization of Untrusted Data',
  }),
  entry({
    owaspCode: 'A08:2021',
    family: 'WEB',
    title: 'Software Updates Without Digital Signature',
    severity: 'HIGH',
    tags: ['integrity-failures', 'code-signing', 'supply-chain'],
    descriptionMd:
      'Software updates, plugins or artifacts are downloaded and applied without digital signature or integrity verification (trusted hash). An attacker in a network position, or one who compromises the distribution channel, can deliver a tampered update.',
    impactMd:
      'Execution of malicious code with the privileges of the updated process, compromising all recipients of the update.',
    recommendationMd:
      '- Digitally sign updates and **verify the signature** before applying them.\n- Distribute exclusively over TLS channels and validate hashes from a trusted source.\n- Use trusted repositories/registries with integrity verification.',
    referencesMd:
      '- https://owasp.org/Top10/A08_2021-Software_and_Data_Integrity_Failures/\n- CWE-494: Download of Code Without Integrity Check',
  }),
  entry({
    owaspCode: 'A08:2021',
    family: 'WEB',
    title: 'Insecure CI/CD Pipelines',
    severity: 'HIGH',
    tags: ['integrity-failures', 'cicd', 'supply-chain'],
    descriptionMd:
      'The CI/CD pipeline has integrity flaws: secrets exposed in logs/variables, execution of untrusted code in pull requests from forks, dependencies and images not pinned by hash, or excessive runner permissions. This allows the build process to be compromised and code to be injected into artifacts.',
    impactMd:
      'Supply chain compromise: tampered artifacts in production and leakage of infrastructure secrets.',
    recommendationMd:
      '- Apply least privilege to runners/tokens; isolate workflows triggered by forks and protect branches.\n- Pin dependencies and actions by hash/immutable version; verify artifact integrity (SLSA/signing).\n- Manage secrets in a vault, mask them in logs and rotate them regularly.',
    referencesMd:
      '- https://owasp.org/Top10/A08_2021-Software_and_Data_Integrity_Failures/\n- https://owasp.org/www-project-top-10-ci-cd-security-risks/\n- CWE-829: Inclusion of Functionality from Untrusted Control Sphere',
  }),

  // --- A09:2021 — Security Logging and Monitoring Failures ---
  entry({
    owaspCode: 'A09:2021',
    family: 'WEB',
    title: 'Missing Logging of Critical Events',
    severity: 'MEDIUM',
    tags: ['logging-monitoring', 'audit-log'],
    descriptionMd:
      'Security-relevant events (successful and failed logins, privilege changes, sensitive data changes, administrative access) are not recorded, or the logs lack sufficient context (actor, origin, timestamp) for investigation.',
    impactMd:
      'Incidents go unnoticed and response/forensics become unfeasible, increasing attacker dwell time.',
    recommendationMd:
      '- Log relevant security events with actor, origin (IP), action, target and time, in a structured format.\n- Centralize logs (SIEM) with adequate retention and tamper protection.\n- Avoid logging sensitive data in cleartext (passwords, tokens, PII).',
    referencesMd:
      '- https://owasp.org/Top10/A09_2021-Security_Logging_and_Monitoring_Failures/\n- https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html\n- CWE-778: Insufficient Logging',
  }),
  entry({
    owaspCode: 'A09:2021',
    family: 'WEB',
    title: 'Unavailable Security Alerts / Lack of Monitoring',
    severity: 'MEDIUM',
    tags: ['logging-monitoring', 'alerting', 'detection'],
    descriptionMd:
      'Even when events are logged, there is no timely detection or alerting for suspicious activity (login failure spikes, anomalous access, exfiltration). Monitoring is reactive or nonexistent.',
    impactMd:
      'Ongoing attacks are not detected in time, increasing the impact and the incident response time.',
    recommendationMd:
      '- Define detection rules and **alerts** for high-risk events, with thresholds and correlation.\n- Integrate alerts into an incident response flow with owners and SLAs.\n- Periodically test the detection chain (e.g. purple team exercises).',
    referencesMd:
      '- https://owasp.org/Top10/A09_2021-Security_Logging_and_Monitoring_Failures/\n- CWE-778: Insufficient Logging',
  }),
  entry({
    owaspCode: 'A09:2021',
    family: 'WEB',
    title: 'Log Injection / Log Forging',
    severity: 'MEDIUM',
    tags: ['logging-monitoring', 'log-injection'],
    descriptionMd:
      'User input is written to logs without sanitization, allowing line breaks to be injected to forge fake log entries, pollute the audit trail or, when the logs are rendered in a web interface, inject payloads (e.g. XSS in the log viewer).',
    impactMd:
      'Corruption of the audit trail, concealment of malicious activity and possible attacks on systems that consume the logs.',
    recommendationMd:
      '- Neutralize control characters (CR/LF) and escape input before logging; prefer structured logging (JSON) with separate fields.\n- Treat user-supplied values as data, never as part of the log structure.\n- Encode properly when displaying logs in interfaces.',
    referencesMd:
      '- https://owasp.org/www-community/attacks/Log_Injection\n- https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html\n- CWE-117: Improper Output Neutralization for Logs',
  }),

  // --- A10:2021 — Server-Side Request Forgery (SSRF) ---
  entry({
    owaspCode: 'A10:2021',
    family: 'WEB',
    title: 'Basic SSRF — Internal Network Access',
    severity: 'HIGH',
    tags: ['ssrf', 'server-side-request-forgery'],
    descriptionMd:
      'The application makes HTTP requests to a URL supplied (or influenced) by the user without restricting the destination, making it possible to reach internal services not exposed to the internet (`localhost`, RFC 1918 ranges, internal admin panels) and interact with them through the server.',
    impactMd:
      'Internal network scanning and access, interaction with internal services and use of the server as a pivot for deeper attacks.',
    recommendationMd:
      '- Apply an **allow-list** of destination domains/IPs and permitted protocols (`https` only).\n- Resolve the hostname and validate the resulting IP, blocking internal/loopback/link-local ranges — re-validating after redirects (avoid TOCTOU).\n- Isolate the network egress of the service and do not return the raw response to the user.',
    referencesMd:
      '- https://owasp.org/Top10/A10_2021-Server-Side_Request_Forgery_%28SSRF%29/\n- https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html\n- CWE-918: Server-Side Request Forgery',
  }),
  entry({
    owaspCode: 'A10:2021',
    family: 'WEB',
    title: 'Blind SSRF',
    severity: 'MEDIUM',
    tags: ['ssrf', 'blind-ssrf'],
    descriptionMd:
      'A variant of SSRF in which the response of the forged request is not returned to the attacker. Exploitation is confirmed through side channels (out-of-band): DNS/HTTP interactions observed on an attacker-controlled server, or response time differences.',
    impactMd:
      'Blind mapping of the internal network and, combined with other flaws, access to internal metadata/services even without direct output.',
    recommendationMd:
      '- Apply the same defenses as for direct SSRF: destination allow-list, blocking of internal ranges and of redirects to them.\n- Restrict and monitor the network egress of the service (egress filtering) and alert on anomalous destinations.\n- Use a dedicated HTTP client that does not automatically follow redirects to unvalidated hosts.',
    referencesMd:
      '- https://owasp.org/Top10/A10_2021-Server-Side_Request_Forgery_%28SSRF%29/\n- https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html\n- CWE-918: Server-Side Request Forgery',
  }),
  entry({
    owaspCode: 'A10:2021',
    family: 'WEB',
    title: 'SSRF to Cloud Metadata (e.g. 169.254.169.254)',
    severity: 'CRITICAL',
    tags: ['ssrf', 'cloud-metadata', 'credential-theft'],
    descriptionMd:
      'The SSRF flaw allows reaching the cloud provider metadata endpoint (e.g. `http://169.254.169.254/`), from which temporary IAM credentials, tokens and instance configuration can be extracted — especially where IMDSv1 (no token requirement) is enabled.',
    impactMd:
      'Theft of cloud credentials and escalation to broad access to account resources (buckets, databases, roles), potentially compromising the entire environment.',
    recommendationMd:
      '- Block access to the link-local metadata IP from the application (destination allow-list and egress filtering).\n- Require **IMDSv2** (token-based flow, reduced hop limit) and disable IMDSv1.\n- Apply least privilege to instance roles and monitor anomalous credential use.',
    referencesMd:
      '- https://owasp.org/Top10/A10_2021-Server-Side_Request_Forgery_%28SSRF%29/\n- https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html\n- CWE-918: Server-Side Request Forgery',
  }),

  // =========================================================================
  // OWASP API Security Top 10 — 2023
  // =========================================================================

  // --- API1:2023 — Broken Object Level Authorization (BOLA) ---
  entry({
    owaspCode: 'API1:2023',
    family: 'API',
    title: "BOLA — Access to Other Users' Resources via ID Manipulation",
    severity: 'HIGH',
    tags: ['api', 'bola', 'authorization', 'idor'],
    descriptionMd:
      'API endpoints receive an object identifier (in the route, query or body) and return/modify the resource without validating whether it belongs to the authenticated user. By swapping the ID (`GET /api/v1/orders/{id}`), the attacker reads or modifies resources of other users — the equivalent of IDOR in the API context, and the number one flaw in API security.',
    impactMd:
      'Mass leakage and tampering of data belonging to other users through automated identifier enumeration.',
    recommendationMd:
      '- Enforce **per-object** authorization checks on every endpoint, comparing the resource owner with the session/token identity.\n- Centralize the check (middleware/policy) and cover it with automated tests per endpoint.\n- Use unpredictable identifiers (UUID) as an additional defense, without replacing authorization.',
    referencesMd:
      '- https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/\n- CWE-639: Authorization Bypass Through User-Controlled Key',
  }),

  // --- API2:2023 — Broken Authentication ---
  entry({
    owaspCode: 'API2:2023',
    family: 'API',
    title: 'Improper JWT Validation (alg "none" / Null Signature)',
    severity: 'CRITICAL',
    tags: ['api', 'jwt', 'authentication'],
    descriptionMd:
      'JWT validation is flawed: it accepts the `none` algorithm (unsigned token), does not verify the signature, trusts the `alg` header to choose the algorithm (allowing RS256↔HS256 confusion using the public key as an HMAC secret), or does not validate claims (`exp`, `aud`, `iss`). This allows forging arbitrary tokens.',
    impactMd:
      'Identity forgery and privilege escalation (e.g. forging an administrator token), compromising the entire API authentication.',
    recommendationMd:
      '- Reject `alg: none`; **pin** the expected algorithm on the server instead of deriving it from the token header.\n- Verify the signature with the correct key and validate `exp`, `nbf`, `aud` and `iss`.\n- Use well-maintained JWT libraries and strong keys; manage key rotation (JWKS).',
    referencesMd:
      '- https://owasp.org/API-Security/editions/2023/en/0xa2-broken-authentication/\n- https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html\n- CWE-347: Improper Verification of Cryptographic Signature',
  }),
  entry({
    owaspCode: 'API2:2023',
    family: 'API',
    title: 'Missing Re-authentication for Sensitive Operations',
    severity: 'MEDIUM',
    tags: ['api', 'authentication', 're-authentication'],
    descriptionMd:
      'Critical operations (email/password changes, MFA changes, transfers, account deletion) are executed with the current session alone, without requiring re-authentication (step-up). A hijacked session or a CSRF/XSS attack can perform high-impact changes.',
    impactMd:
      'Account takeover and irreversible actions executed from a compromised session, with no additional barrier.',
    recommendationMd:
      '- Require **re-authentication/step-up** (current password, MFA) immediately before sensitive operations.\n- Invalidate sessions and tokens after credential changes and notify the user.\n- Set a short validity period for the privilege elevation granted by the step-up.',
    referencesMd:
      '- https://owasp.org/API-Security/editions/2023/en/0xa2-broken-authentication/\n- CWE-306: Missing Authentication for Critical Function',
  }),
  entry({
    owaspCode: 'API2:2023',
    family: 'API',
    title: 'Inadequate Token Expiration',
    severity: 'MEDIUM',
    tags: ['api', 'token', 'session-management'],
    descriptionMd:
      'Access tokens have excessively long validity (or never expire), refresh tokens are neither rotated nor revocable, and there is no effective server-side revocation/logout mechanism. A leaked token remains usable for long periods.',
    impactMd:
      'A prolonged abuse window for compromised tokens, making containment harder after a leak.',
    recommendationMd:
      '- Use short-lived access tokens and refresh tokens with **rotation** and revocation; implement a revocation list/denylist.\n- Ensure effective logout (server-side invalidation) and revoke tokens on password change/compromise.\n- Bind tokens to their context (audience, client) and monitor anomalous usage.',
    referencesMd:
      '- https://owasp.org/API-Security/editions/2023/en/0xa2-broken-authentication/\n- CWE-613: Insufficient Session Expiration',
  }),

  // --- API3:2023 — Broken Object Property Level Authorization (BPLA) ---
  entry({
    owaspCode: 'API3:2023',
    family: 'API',
    title: 'Mass Assignment / HTTP Parameter Pollution',
    severity: 'HIGH',
    tags: ['api', 'mass-assignment', 'bpla'],
    descriptionMd:
      'The API automatically binds request body fields to object/model properties without restricting which ones can be changed. The client injects unexpected properties (e.g. `role`, `isAdmin`, `balance`, `verified`) and persists them, modifying properties that should be server-only.',
    impactMd:
      'Privilege escalation and tampering with protected data (roles, balances, state flags) through hidden properties.',
    recommendationMd:
      '- Use an **explicit allow-list** of editable properties (input DTOs), ignoring unexpected fields.\n- Never bind the request body directly to persistence entities.\n- Separate input, domain and response models; validate the payload with a strict schema.',
    referencesMd:
      '- https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/\n- https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html\n- CWE-915: Improperly Controlled Modification of Dynamically-Determined Object Attributes',
  }),
  entry({
    owaspCode: 'API3:2023',
    family: 'API',
    title: 'Excessive Data Exposure',
    severity: 'MEDIUM',
    tags: ['api', 'excessive-data-exposure', 'bpla'],
    descriptionMd:
      'The API returns the entire object (direct model serialization), trusting the client to filter what to display, exposing sensitive properties not required by the functionality (password hashes, tokens, PII, internal fields). The extra data is visible in the raw response.',
    impactMd:
      'Leakage of sensitive and internal data that widens the attack surface and may violate privacy requirements.',
    recommendationMd:
      '- Define **response DTOs/serializers** that expose only the necessary fields (allow-list); never serialize entities directly.\n- Review the responses of each endpoint for sensitive fields.\n- Do not rely on client-side filtering to protect data.',
    referencesMd:
      '- https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/\n- CWE-213: Exposure of Sensitive Information Due to Incompatible Policies',
  }),

  // --- API4:2023 — Unrestricted Resource Consumption ---
  entry({
    owaspCode: 'API4:2023',
    family: 'API',
    title: 'Missing Rate Limiting per IP/Token',
    severity: 'MEDIUM',
    tags: ['api', 'rate-limiting', 'resource-consumption'],
    descriptionMd:
      'The API does not enforce rate limits per IP, client or token, allowing a consumer to make an unlimited volume of requests. This enables abuse, brute force and resource exhaustion (CPU, database, paid third-party services).',
    impactMd:
      'Service degradation/denial, high infrastructure and third-party service costs, and facilitation of other automated attacks.',
    recommendationMd:
      '- Apply rate limiting and **quotas** per IP, client and token, with `429` responses and limit headers.\n- Define timeouts, concurrency limits and circuit breakers for dependencies.\n- Monitor consumption and alert on anomalous spikes.',
    referencesMd:
      '- https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/\n- CWE-770: Allocation of Resources Without Limits or Throttling',
  }),
  entry({
    owaspCode: 'API4:2023',
    family: 'API',
    title: 'File Upload Without Size Limits',
    severity: 'MEDIUM',
    tags: ['api', 'file-upload', 'resource-consumption', 'dos'],
    descriptionMd:
      'Upload endpoints do not enforce file/request size limits, allowing very large files to be sent that exhaust memory, disk or bandwidth, or that overload downstream processing (e.g. decompression, image processing).',
    impactMd:
      'Denial of service through resource exhaustion and storage costs, in addition to enabling "zip bomb"/decompression attacks.',
    recommendationMd:
      '- Enforce file and request body size limits at the server/proxy (e.g. `client_max_body_size`).\n- Validate type and content, and process uploads asynchronously and with resource limits.\n- Store outside the webroot and apply per-user quotas.',
    referencesMd:
      '- https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/\n- https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html\n- CWE-400: Uncontrolled Resource Consumption',
  }),
  entry({
    owaspCode: 'API4:2023',
    family: 'API',
    title: 'Excessive JSON/XML Payloads',
    severity: 'MEDIUM',
    tags: ['api', 'resource-consumption', 'dos', 'xml'],
    descriptionMd:
      'The API accepts structured payloads without limits on size, nesting depth or number of elements. Deeply nested or very large JSON/XML documents consume excessive CPU/memory when parsed; in the XML case, they additionally expose attacks such as billion laughs (entity expansion) and XXE.',
    impactMd:
      'Denial of service through CPU/memory exhaustion during parsing and, with misconfigured XML, XXE and entity expansion.',
    recommendationMd:
      '- Limit body size, nesting depth and the number of accepted elements/keys.\n- For XML, **disable DTDs and external entities** (protection against XXE/billion laughs).\n- Validate the payload against a strict schema before processing it.',
    referencesMd:
      '- https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/\n- https://cheatsheetseries.owasp.org/cheatsheets/XML_External_Entity_Prevention_Cheat_Sheet.html\n- CWE-400: Uncontrolled Resource Consumption',
  }),

  // --- API5:2023 — Broken Function Level Authorization (BFLA) ---
  entry({
    owaspCode: 'API5:2023',
    family: 'API',
    title: 'BFLA — Regular Users Accessing Administrative Endpoints',
    severity: 'HIGH',
    tags: ['api', 'bfla', 'authorization'],
    descriptionMd:
      'The API does not correctly validate the function level required per endpoint. Regular users access administrative functions by guessing routes (`/api/admin/...`) or by changing the HTTP method (from `GET` to `DELETE`/`PUT`/`POST`) on a resource, executing unauthorized privileged operations.',
    impactMd:
      'Execution of administrative functions (user management, settings, data deletion) by unprivileged users.',
    recommendationMd:
      '- Deny by default and enforce role/permission verification per endpoint **and per HTTP method**.\n- Centralize function-level authorization (guards/middleware) and do not rely on route obscurity.\n- Systematically test every administrative function with low-privilege accounts.',
    referencesMd:
      '- https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/\n- CWE-285: Improper Authorization',
  }),

  // --- API6:2023 — Unrestricted Access to Sensitive Business Flows ---
  entry({
    owaspCode: 'API6:2023',
    family: 'API',
    title: 'Automation/Bot Abuse of Sensitive Business Flows',
    severity: 'MEDIUM',
    tags: ['api', 'business-flow', 'anti-automation', 'bots'],
    descriptionMd:
      'Sensitive business flows (purchase of limited tickets/products, coupon application, mass sign-ups, reservations) can be executed in an automated fashion and at scale, without anti-bot controls. This enables inventory hoarding (scalping), promotion abuse and fake account creation.',
    impactMd:
      'Financial and business damage: inventory exhaustion by bots, promotion fraud and pollution of the user base.',
    recommendationMd:
      '- Identify sensitive business flows and apply anti-automation controls (per-identity rate limiting, CAPTCHA, device fingerprinting, behavioral analysis).\n- Enforce business limits (e.g. N items per account) and detect bot patterns.\n- Monitor business metrics for anomalous spikes and react automatically.',
    referencesMd:
      '- https://owasp.org/API-Security/editions/2023/en/0xa6-unrestricted-access-to-sensitive-business-flows/\n- https://owasp.org/www-project-automated-threats-to-web-applications/\n- CWE-799: Improper Control of Interaction Frequency',
  }),

  // --- API7:2023 — Server Side Request Forgery ---
  entry({
    owaspCode: 'API7:2023',
    family: 'API',
    title: 'SSRF via Webhooks and URL Parameters in APIs',
    severity: 'HIGH',
    tags: ['api', 'ssrf', 'webhooks'],
    descriptionMd:
      'The API fetches resources from client-supplied URLs — webhook configuration, URL-based imports, integrations, or parameters in REST/GraphQL queries — without validating the destination. This makes it possible to force the server to request internal addresses or the cloud metadata endpoint.',
    impactMd:
      'Access to internal services and cloud metadata (credential theft), internal network scanning and use of the server as a pivot.',
    recommendationMd:
      '- Apply a destination/protocol allow-list and validate the resolved IP, blocking internal/loopback/link-local ranges (re-validating after redirects).\n- For webhooks, require endpoint ownership verification and use egress filtering.\n- Do not return the raw response of the forged request to the client.',
    referencesMd:
      '- https://owasp.org/API-Security/editions/2023/en/0xa7-server-side-request-forgery/\n- https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html\n- CWE-918: Server-Side Request Forgery',
  }),

  // --- API8:2023 — Security Misconfiguration ---
  entry({
    owaspCode: 'API8:2023',
    family: 'API',
    title: 'Publicly Exposed API Documentation (Unauthenticated Swagger/OpenAPI)',
    severity: 'MEDIUM',
    tags: ['api', 'security-misconfiguration', 'information-disclosure', 'swagger'],
    descriptionMd:
      'The interactive API documentation (Swagger UI, OpenAPI, GraphQL introspection/Playground) is accessible without authentication in production, revealing all endpoints, parameters, schemas and, at times, examples containing sensitive data. This hands the attacker a complete map of the attack surface.',
    impactMd:
      'Complete enumeration of endpoints and of the data model, accelerating the discovery and exploitation of other flaws.',
    recommendationMd:
      '- Protect or disable the documentation and GraphQL introspection in production (restrict to authorized networks/users).\n- Do not include secrets/real data in documentation examples.\n- Treat the API specification as sensitive when it exposes non-public endpoints.',
    referencesMd:
      '- https://owasp.org/API-Security/editions/2023/en/0xa8-security-misconfiguration/\n- CWE-200: Exposure of Sensitive Information to an Unauthorized Actor',
  }),
  entry({
    owaspCode: 'API8:2023',
    family: 'API',
    title: 'Missing Security Headers in API Responses',
    severity: 'LOW',
    tags: ['api', 'security-misconfiguration', 'security-headers'],
    descriptionMd:
      'API responses do not set adequate security headers (e.g. `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Cache-Control` for sensitive data) nor restrict `Content-Type`, increasing the risk of sniffing, improper caching and misuse of the responses by clients.',
    impactMd:
      'Reduced defense in depth, with risk of sensitive data caching, MIME sniffing and transport downgrade.',
    recommendationMd:
      '- Standardize security headers on API responses (HSTS, `nosniff`, `Cache-Control: no-store` for sensitive data).\n- Enforce `Content-Type: application/json` and reject unexpected negotiations.\n- Apply the headers centrally (gateway/middleware).',
    referencesMd:
      '- https://owasp.org/API-Security/editions/2023/en/0xa8-security-misconfiguration/\n- https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html\n- CWE-693: Protection Mechanism Failure',
  }),
  entry({
    owaspCode: 'API8:2023',
    family: 'API',
    title: 'Open CORS Policy (Access-Control-Allow-Origin: *)',
    severity: 'MEDIUM',
    tags: ['api', 'security-misconfiguration', 'cors'],
    descriptionMd:
      'The API responds with an excessively permissive CORS policy — `Access-Control-Allow-Origin: *` or reflecting any origin — possibly combined with credentials. This allows any site to consume the API in the context of the user.',
    impactMd:
      'Exposure of authenticated data and actions to untrusted origins, bypassing the same-origin policy.',
    recommendationMd:
      '- Restrict the origin to an **explicit allow-list**; do not reflect the received origin or use `*` with credentials.\n- Limit allowed methods and headers to what is necessary.\n- Validate the origin by exact match, without permissive subdomain regexes.',
    referencesMd:
      '- https://owasp.org/API-Security/editions/2023/en/0xa8-security-misconfiguration/\n- CWE-942: Permissive Cross-domain Policy with Untrusted Domains',
  }),

  // --- API9:2023 — Improper Inventory Management ---
  entry({
    owaspCode: 'API9:2023',
    family: 'API',
    title: 'Staging/Test APIs Exposed to the Internet',
    severity: 'MEDIUM',
    tags: ['api', 'inventory-management', 'staging-exposed'],
    descriptionMd:
      'Non-production environments (staging, QA, dev) expose APIs to the internet, often with production data, relaxed security controls, test credentials and outdated versions. These environments are attractive, less-monitored targets.',
    impactMd:
      'Access to sensitive data and to flaws already fixed in production, serving as an entry point into the main environment.',
    recommendationMd:
      '- Restrict non-production environments to private networks/VPN and require strong authentication.\n- Do not use real production data in test environments (mask/anonymize it).\n- Keep an up-to-date inventory of all exposed environments and endpoints.',
    referencesMd:
      '- https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/\n- CWE-668: Exposure of Resource to Wrong Sphere',
  }),
  entry({
    owaspCode: 'API9:2023',
    family: 'API',
    title: 'Unversioned Endpoints',
    severity: 'LOW',
    tags: ['api', 'inventory-management', 'versioning'],
    descriptionMd:
      'The API does not adopt explicit versioning, making safe evolution and controlled decommissioning of endpoints difficult. Old, insecure versions remain active indefinitely because there is no clear mechanism to deprecate them.',
    impactMd:
      'Persistence of old, vulnerable endpoints in production, widening the attack surface over time.',
    recommendationMd:
      '- Adopt explicit versioning (e.g. `/v1/`, `/v2/`) and a formal deprecation and shutdown process.\n- Document and monitor the usage of each version; communicate decommissioning deadlines.\n- Disable obsolete versions after consumers have migrated.',
    referencesMd:
      '- https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/\n- https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html',
  }),
  entry({
    owaspCode: 'API9:2023',
    family: 'API',
    title: 'Shadow APIs / Undocumented Endpoints',
    severity: 'MEDIUM',
    tags: ['api', 'inventory-management', 'shadow-api'],
    descriptionMd:
      'Active endpoints exist that are not part of the official inventory/documentation (shadow APIs): debug routes, old endpoints, internal functionality inadvertently exposed. Because they are unknown, they escape security reviews and monitoring.',
    impactMd:
      'An attack surface invisible to the security team, with endpoints potentially lacking the controls applied to the others.',
    recommendationMd:
      '- Maintain an automated, up-to-date inventory of all endpoints (discovery via gateway/traffic).\n- Apply uniform security policies through a central gateway and remove unused endpoints.\n- Perform periodic audits comparing real traffic with the documentation.',
    referencesMd:
      '- https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/\n- CWE-1059: Insufficient Technical Documentation',
  }),

  // --- API10:2023 — Unsafe Consumption of APIs ---
  entry({
    owaspCode: 'API10:2023',
    family: 'API',
    title: 'Blind Trust in Third-Party API Data',
    severity: 'MEDIUM',
    tags: ['api', 'unsafe-consumption', 'third-party'],
    descriptionMd:
      'The application consumes third-party APIs and treats the responses as trusted, without validating/sanitizing the received data before processing, storing or forwarding it. A compromised or malicious third-party service can inject data that triggers injection, second-order XSS or improper logic.',
    impactMd:
      'Propagation of malicious third-party data into the application, resulting in injection, stored XSS or data corruption.',
    recommendationMd:
      '- Validate and sanitize third-party responses with the same rigor applied to user input (strict schema).\n- Use TLS, validate certificates and enforce timeouts/limits when integrating.\n- Apply least privilege and treat integrations as a trust boundary.',
    referencesMd:
      '- https://owasp.org/API-Security/editions/2023/en/0xaa-unsafe-consumption-of-apis/\n- CWE-345: Insufficient Verification of Data Authenticity',
  }),
  entry({
    owaspCode: 'API10:2023',
    family: 'API',
    title: 'Insecure Processing of External Webhooks',
    severity: 'HIGH',
    tags: ['api', 'unsafe-consumption', 'webhooks'],
    descriptionMd:
      'Endpoints that receive third-party webhooks neither verify the authenticity of the origin (HMAC signature/mTLS) nor protect against replay, and they process the payload directly. An attacker forges webhook calls to trigger sensitive logic (e.g. confirming a payment, granting access) with arbitrary data.',
    impactMd:
      'Execution of critical business logic with forged data (payment fraud, improper resource release) and injection via unvalidated payloads.',
    recommendationMd:
      '- **Verify the webhook signature** (HMAC/mTLS) and validate timestamp/nonce to prevent replay.\n- Treat the payload as untrusted: validate it against a schema and do not rely on it alone for critical decisions (reconcile with the provider API).\n- Restrict the origin by IP when possible and log received calls.',
    referencesMd:
      '- https://owasp.org/API-Security/editions/2023/en/0xaa-unsafe-consumption-of-apis/\n- CWE-345: Insufficient Verification of Data Authenticity',
  }),

  // =========================================================================
  // OWASP Top 10 for LLM Applications
  // =========================================================================

  // --- LLM01 — Prompt Injection ---
  entry({
    owaspCode: 'LLM01',
    family: 'LLM',
    title: 'Direct Prompt Injection (Jailbreaking)',
    severity: 'HIGH',
    tags: ['llm', 'prompt-injection', 'jailbreak'],
    descriptionMd:
      'A user crafts inputs that override or bypass the system instructions ("ignore the previous instructions…", role-play, obfuscation), leading the model to ignore safety guidelines, reveal restricted information or execute unintended actions. The model does not reliably distinguish system instructions from user content.',
    impactMd:
      'Guardrail bypass, generation of prohibited content, data leakage and misuse of tools/actions connected to the model.',
    recommendationMd:
      '- Clearly separate system instructions from user content; reinforce guidelines and treat all input as untrusted.\n- Enforce controls **outside the model**: output validation, authorization in the tools and human-in-the-loop for sensitive actions.\n- Apply input/output filters, continuous adversarial testing and least privilege to the model capabilities.',
    referencesMd:
      '- https://genai.owasp.org/llmrisk/llm01-prompt-injection/\n- https://owasp.org/www-project-top-10-for-large-language-model-applications/',
  }),
  entry({
    owaspCode: 'LLM01',
    family: 'LLM',
    title: 'Indirect Prompt Injection (via External Content)',
    severity: 'HIGH',
    tags: ['llm', 'prompt-injection', 'indirect'],
    descriptionMd:
      'Malicious instructions are embedded in content the model consumes indirectly — web pages, documents, emails, RAG results, tool outputs. When processing this content, the model executes the hidden instructions of the attacker, even without any direct interaction between the attacker and the prompt.',
    impactMd:
      'Exfiltration of context data, execution of unauthorized actions via tools and manipulation of the output presented to other users.',
    recommendationMd:
      '- Treat all retrieved external content as **untrusted**; isolate it from instructions and tag its provenance.\n- Require human approval for sensitive actions triggered by external content and restrict tools by least privilege.\n- Sanitize/normalize ingested content and monitor anomalous agent behavior.',
    referencesMd:
      '- https://genai.owasp.org/llmrisk/llm01-prompt-injection/\n- https://owasp.org/www-project-top-10-for-large-language-model-applications/',
  }),

  // --- LLM02 — Sensitive Information Disclosure ---
  entry({
    owaspCode: 'LLM02',
    family: 'LLM',
    title: 'Training Data Leakage',
    severity: 'HIGH',
    tags: ['llm', 'sensitive-information-disclosure', 'training-data'],
    descriptionMd:
      'The model has memorized and reproduces, in its responses, excerpts of sensitive data present in the training/fine-tuning set (secrets, PII, intellectual property). Extraction attacks induce the model to regurgitate this memorized data.',
    impactMd:
      'Disclosure of confidential and personal information embedded in the model, with privacy and compliance implications.',
    recommendationMd:
      '- Sanitize and minimize sensitive data before training/fine-tuning; apply anonymization and, where applicable, privacy techniques (e.g. differential privacy).\n- Filter the output to detect/redact regurgitated sensitive data.\n- Govern the provenance of training data and avoid training on unnecessary secrets/PII.',
    referencesMd:
      '- https://genai.owasp.org/llmrisk/llm02-sensitive-information-disclosure/\n- https://owasp.org/www-project-top-10-for-large-language-model-applications/',
  }),
  entry({
    owaspCode: 'LLM02',
    family: 'LLM',
    title: 'PII Exposure in LLM Output',
    severity: 'HIGH',
    tags: ['llm', 'sensitive-information-disclosure', 'pii'],
    descriptionMd:
      'The application includes personal data (PII) in the context/prompt (history, data from other users, records) and the model exposes it in the response, or mixes data across sessions/users due to inadequate context isolation.',
    impactMd:
      'Leakage of personal data between users and to unauthorized actors, with privacy violation and regulatory risk.',
    recommendationMd:
      '- Minimize and mask PII before inserting it into the context; apply per-data authorization in the LLM pipeline as well.\n- Ensure **strict context isolation** per user/session (no leakage between tenants).\n- Apply PII redaction/filtering on the output and log access to sensitive data.',
    referencesMd:
      '- https://genai.owasp.org/llmrisk/llm02-sensitive-information-disclosure/\n- https://owasp.org/www-project-top-10-for-large-language-model-applications/',
  }),
  entry({
    owaspCode: 'LLM02',
    family: 'LLM',
    title: 'Extraction of System Context / Confidential Prompt Data',
    severity: 'MEDIUM',
    tags: ['llm', 'sensitive-information-disclosure', 'context-extraction'],
    descriptionMd:
      'Through crafted prompts, the user induces the model to reveal confidential information present in its context — data from other parts of the conversation, documents retrieved via RAG, or sensitive configuration/instructions loaded into the prompt.',
    impactMd:
      'Disclosure of confidential data and of internal system details that assist subsequent attacks.',
    recommendationMd:
      '- Do not place secrets or unnecessary data in the context; treat prompt content as potentially exposed.\n- Apply per-document authorization in RAG and filter the output for sensitive data.\n- Monitor extraction attempts and limit what the model can access (least privilege).',
    referencesMd:
      '- https://genai.owasp.org/llmrisk/llm02-sensitive-information-disclosure/\n- https://owasp.org/www-project-top-10-for-large-language-model-applications/',
  }),

  // --- LLM03 — Supply Chain Vulnerabilities ---
  entry({
    owaspCode: 'LLM03',
    family: 'LLM',
    title: 'Use of Compromised Pre-trained Models',
    severity: 'HIGH',
    tags: ['llm', 'supply-chain', 'model-provenance'],
    descriptionMd:
      'The application uses pre-trained models from unverified sources (public model repositories) that may contain backdoors or malicious behavior, or may have been tampered with. Blind trust in model provenance introduces supply chain risk.',
    impactMd:
      'Hidden malicious behavior (trigger-activated backdoors), bias and compromise of the applications that depend on the model.',
    recommendationMd:
      '- Obtain models from trusted sources and **verify integrity/signatures**; maintain an inventory (SBOM) of models and artifacts.\n- Evaluate third-party models (provenance, model cards, adversarial testing) before adoption.\n- Prefer safe serialization formats (e.g. safetensors) and scan artifacts.',
    referencesMd:
      '- https://genai.owasp.org/llmrisk/llm03-supply-chain/\n- https://owasp.org/www-project-top-10-for-large-language-model-applications/',
  }),
  entry({
    owaspCode: 'LLM03',
    family: 'LLM',
    title: 'Vulnerable Third-Party Plugins/Tools',
    severity: 'HIGH',
    tags: ['llm', 'supply-chain', 'plugins', 'tools'],
    descriptionMd:
      'Third-party plugins, extensions or tools integrated with the LLM (including external servers/integrations) contain vulnerabilities or excessive permissions. Since the model can invoke them, flaws in these tools become exploitable from within the LLM flow.',
    impactMd:
      'Execution of unauthorized actions, access to connected data and systems, and propagation of tool vulnerabilities into the application.',
    recommendationMd:
      '- Assess and keep tools/plugins up to date; apply **least privilege** to each integration.\n- Validate and restrict the parameters the model can pass to tools; require per-action authorization.\n- Isolate tool execution and monitor their invocations.',
    referencesMd:
      '- https://genai.owasp.org/llmrisk/llm03-supply-chain/\n- https://owasp.org/www-project-top-10-for-large-language-model-applications/',
  }),
  entry({
    owaspCode: 'LLM03',
    family: 'LLM',
    title: 'Poisoned Training Datasets (Supply Chain)',
    severity: 'HIGH',
    tags: ['llm', 'supply-chain', 'data-poisoning'],
    descriptionMd:
      'Training datasets obtained from external/unverified sources may have been poisoned at the source (e.g. data scraped from the web without curation), introducing biases, hidden triggers or malicious content into the data supply chain.',
    impactMd:
      'Introduction of backdoors and biases into the model from the data stage, compromising the reliability of all derived applications.',
    recommendationMd:
      '- Verify the provenance and integrity of datasets; prefer curated sources and control the collection process.\n- Apply validation/cleaning and anomaly/outlier detection on the data before training.\n- Maintain versioning and traceability (data lineage) of the datasets used.',
    referencesMd:
      '- https://genai.owasp.org/llmrisk/llm03-supply-chain/\n- https://genai.owasp.org/llmrisk/llm04-data-and-model-poisoning/',
  }),

  // --- LLM04 — Data and Model Poisoning ---
  entry({
    owaspCode: 'LLM04',
    family: 'LLM',
    title: 'Fine-Tuning Data Manipulation',
    severity: 'HIGH',
    tags: ['llm', 'data-poisoning', 'fine-tuning'],
    descriptionMd:
      'An attacker with influence over the fine-tuning data (e.g. user feedback, collected data, RLHF pipelines) injects manipulated examples that degrade the safety/quality of the model or subtly implant unwanted behaviors.',
    impactMd:
      'Degradation of response safety and quality, targeted biases and manipulated behaviors that are hard to detect.',
    recommendationMd:
      '- Strictly control the origin and curation of fine-tuning data; validate and filter contributions.\n- Use anomaly/outlier detection and human review on data samples.\n- Evaluate the post-training model with safety benchmarks and adversarial regression tests.',
    referencesMd:
      '- https://genai.owasp.org/llmrisk/llm04-data-and-model-poisoning/\n- https://owasp.org/www-project-top-10-for-large-language-model-applications/',
  }),
  entry({
    owaspCode: 'LLM04',
    family: 'LLM',
    title: 'Backdoor Injection into Model Behavior',
    severity: 'HIGH',
    tags: ['llm', 'model-poisoning', 'backdoor'],
    descriptionMd:
      'The model is trained/tuned to behave normally except when it receives a specific trigger (word, phrase, pattern), at which point it produces attacker-controlled output. The backdoor remains latent and is hard to detect in standard evaluations.',
    impactMd:
      'On-demand activation of malicious behavior (control bypass, harmful outputs) in production, controlled by the attacker.',
    recommendationMd:
      '- Ensure the integrity and provenance of data and weights; sign and verify model artifacts.\n- Apply adversarial testing and trigger/backdoor scanning before promoting models.\n- Monitor production output for anomalous patterns and maintain rollback capability.',
    referencesMd:
      '- https://genai.owasp.org/llmrisk/llm04-data-and-model-poisoning/\n- https://owasp.org/www-project-top-10-for-large-language-model-applications/',
  }),

  // --- LLM05 — Improper Output Handling ---
  entry({
    owaspCode: 'LLM05',
    family: 'LLM',
    title: 'XSS Generated via LLM Response',
    severity: 'HIGH',
    tags: ['llm', 'improper-output-handling', 'xss'],
    descriptionMd:
      'The model output is rendered in the web interface without encoding/sanitization, treating it as trusted content. Since the model can be induced (via prompt injection) to produce HTML/JS, this results in Cross-Site Scripting originating from the generated response.',
    impactMd:
      "Script execution in the victim's browser, session theft and unauthorized actions — with the LLM as the injection vector.",
    recommendationMd:
      '- Treat model output as **untrusted input**: apply contextual output encoding and sanitize HTML (DOMPurify) before rendering.\n- Do not use `innerHTML`/`dangerouslySetInnerHTML` with the response; render it as text whenever possible.\n- Reinforce with a restrictive CSP.',
    referencesMd:
      '- https://genai.owasp.org/llmrisk/llm05-improper-output-handling/\n- https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html\n- CWE-79: Cross-site Scripting',
  }),
  entry({
    owaspCode: 'LLM05',
    family: 'LLM',
    title: 'Arbitrary Command Execution via LLM Output',
    severity: 'CRITICAL',
    tags: ['llm', 'improper-output-handling', 'rce', 'injection'],
    descriptionMd:
      'The model output is passed directly to downstream interpreters/systems without validation — OS shell, `eval`, SQL queries, tool calls. Since the output content can be manipulated through prompt injection, this results in command/SQL injection and arbitrary execution.',
    impactMd:
      'Remote code execution, SQL/command injection and compromise of the systems that consume the model output.',
    recommendationMd:
      '- Never pass LLM output directly to shells, `eval`, dynamic SQL or privileged tools.\n- Validate/parse the output against a strict schema and use parameterized interfaces; apply an action allow-list.\n- Execute model-derived actions with least privilege and with approval when they are sensitive.',
    referencesMd:
      '- https://genai.owasp.org/llmrisk/llm05-improper-output-handling/\n- CWE-78: OS Command Injection\n- CWE-94: Improper Control of Generation of Code',
  }),
  entry({
    owaspCode: 'LLM05',
    family: 'LLM',
    title: 'SSRF Triggered by LLM Responses Interpreted by Downstream Systems',
    severity: 'HIGH',
    tags: ['llm', 'improper-output-handling', 'ssrf'],
    descriptionMd:
      'A downstream system uses URLs or destinations present in the model output to make requests (e.g. fetching a resource, calling a webhook). Since the output can be manipulated, the attacker induces the model to produce internal URLs, resulting in SSRF triggered by the generated response.',
    impactMd:
      'Access to internal services and cloud metadata (credential theft) through requests originating from the LLM output.',
    recommendationMd:
      '- Validate and restrict any URL/destination derived from the model output with an allow-list and blocking of internal ranges.\n- Do not automatically trigger network requests from the output without validation and, when sensitive, human approval.\n- Apply egress filtering and require IMDSv2 in cloud environments.',
    referencesMd:
      '- https://genai.owasp.org/llmrisk/llm05-improper-output-handling/\n- https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html\n- CWE-918: Server-Side Request Forgery',
  }),

  // --- LLM06 — Excessive Agency ---
  entry({
    owaspCode: 'LLM06',
    family: 'LLM',
    title: 'Excessive Permissions Granted to LLM Agents',
    severity: 'HIGH',
    tags: ['llm', 'excessive-agency', 'least-privilege'],
    descriptionMd:
      'The LLM-based agent is granted tools with scope, functionality or permissions beyond what is necessary (e.g. write/delete access when it only needs to read, broad credentials, unused tools). Combined with prompt injection, this excess of agency drastically amplifies the impact of a manipulation.',
    impactMd:
      'Destructive or unauthorized actions on connected systems when the agent is manipulated, with impact proportional to the permissions granted.',
    recommendationMd:
      '- Apply **least privilege** to every agent tool/credential: strictly necessary scope, functionality and permissions.\n- Remove unused tools and limit destructive operations.\n- Enforce per-action authorization on the target system, without relying solely on the agent.',
    referencesMd:
      '- https://genai.owasp.org/llmrisk/llm06-excessive-agency/\n- https://owasp.org/www-project-top-10-for-large-language-model-applications/',
  }),
  entry({
    owaspCode: 'LLM06',
    family: 'LLM',
    title: 'Autonomous Action Execution Without Human-in-the-loop',
    severity: 'HIGH',
    tags: ['llm', 'excessive-agency', 'human-in-the-loop'],
    descriptionMd:
      'The agent executes high-impact actions (financial transactions, sending communications, configuration changes, deletions) autonomously, without human approval. A prompt injection manipulation or a hallucination directly results in an irreversible action.',
    impactMd:
      'Irreversible, harmful actions executed automatically from manipulated or incorrect model outputs.',
    recommendationMd:
      '- Require **human approval** (human-in-the-loop) before sensitive/irreversible actions.\n- Make actions reversible when possible and enforce limits (amounts, frequency) with verification outside the model.\n- Log all agent actions and make them auditable.',
    referencesMd:
      '- https://genai.owasp.org/llmrisk/llm06-excessive-agency/\n- https://owasp.org/www-project-top-10-for-large-language-model-applications/',
  }),

  // --- LLM07 — System Prompt Leakage ---
  entry({
    owaspCode: 'LLM07',
    family: 'LLM',
    title: 'System Prompt / System Instructions Extraction',
    severity: 'MEDIUM',
    tags: ['llm', 'system-prompt-leakage', 'prompt-injection'],
    descriptionMd:
      'Through prompt engineering, the user induces the model to reveal its system instructions. Besides exposing the guardrail logic (facilitating bypass), the problem is aggravated when the system prompt improperly contains secrets, keys or sensitive business rules.',
    impactMd:
      'Exposure of the security logic and of any secrets embedded in the prompt, facilitating bypass attacks and leaking sensitive information.',
    recommendationMd:
      '- **Never** place secrets, credentials or sensitive data in the system prompt; keep them outside the model.\n- Do not depend on system prompt secrecy as a security control — enforce guardrails externally.\n- Apply authorization and validation controls outside the model, regardless of what the prompt exposes.',
    referencesMd:
      '- https://genai.owasp.org/llmrisk/llm07-system-prompt-leakage/\n- https://owasp.org/www-project-top-10-for-large-language-model-applications/',
  }),

  // --- LLM08 — Vector and Embedding Weaknesses ---
  entry({
    owaspCode: 'LLM08',
    family: 'LLM',
    title: 'Data Injection into Vector Databases (RAG)',
    severity: 'HIGH',
    tags: ['llm', 'vector-embeddings', 'rag', 'prompt-injection'],
    descriptionMd:
      'The RAG pipeline indexes content from untrusted sources (user-uploaded documents, external data) without controls, allowing an attacker to insert documents with malicious instructions or false data. When retrieved, these documents poison the model context (indirect injection) or distort the responses.',
    impactMd:
      'Indirect prompt injection via the knowledge base, manipulated responses and, with inadequate isolation, data leakage between tenants.',
    recommendationMd:
      '- Control the provenance of what is indexed; validate/sanitize the content and apply **per-document authorization** on retrieval.\n- Ensure per-tenant/user isolation in the vector index (partitioning and access filters).\n- Treat retrieved content as untrusted and monitor anomalies in the knowledge base.',
    referencesMd:
      '- https://genai.owasp.org/llmrisk/llm08-vector-and-embedding-weaknesses/\n- https://owasp.org/www-project-top-10-for-large-language-model-applications/',
  }),
  entry({
    owaspCode: 'LLM08',
    family: 'LLM',
    title: 'Embedding Mechanism Manipulation',
    severity: 'MEDIUM',
    tags: ['llm', 'vector-embeddings', 'inversion'],
    descriptionMd:
      'Weaknesses in the use of embeddings enable attacks such as embedding inversion (approximate reconstruction of the source text from the vectors) or manipulation of similarity-based retrieval (poisoning to force retrieval of attacker-chosen content). Embeddings stored without adequate protection become a leakage vector.',
    impactMd:
      'Reconstruction of sensitive data from vectors and manipulation of retrieval results, affecting the integrity and confidentiality of the RAG.',
    recommendationMd:
      '- Treat embeddings of sensitive data as sensitive data: access control and encryption at rest.\n- Apply authorization and filters on retrieval; monitor/limit anomalous similarity queries.\n- Assess the inversion risk when exposing embeddings and minimize vectorized sensitive data.',
    referencesMd:
      '- https://genai.owasp.org/llmrisk/llm08-vector-and-embedding-weaknesses/\n- https://owasp.org/www-project-top-10-for-large-language-model-applications/',
  }),

  // --- LLM09 — Misconfiguration Vulnerabilities ---
  entry({
    owaspCode: 'LLM09',
    family: 'LLM',
    title: 'Exposed LLM Provider API Keys',
    severity: 'HIGH',
    tags: ['llm', 'misconfiguration', 'secrets', 'api-keys'],
    descriptionMd:
      'The LLM provider API key is exposed — embedded in client/frontend code, in a versioned repository, in logs or in accessible variables. Since calls to these providers have a cost, a leaked key is abused financially and for improper access to the service.',
    impactMd:
      'Unauthorized use of the LLM service at the expense of the organization (denial of wallet), data access and quota exhaustion.',
    recommendationMd:
      '- Keep the key **exclusively on the server** (never in the frontend); access the provider through an intermediary backend.\n- Manage the key in a secrets vault, rotate it and monitor consumption/billing.\n- Apply secret scanning in CI and revoke compromised keys immediately.',
    referencesMd:
      '- https://genai.owasp.org/llmrisk/llm09-misinformation/\n- https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html\n- CWE-798: Use of Hard-coded Credentials',
  }),
  entry({
    owaspCode: 'LLM09',
    family: 'LLM',
    title: 'Inadequate Access Permissions on the Model Endpoint',
    severity: 'HIGH',
    tags: ['llm', 'misconfiguration', 'access-control'],
    descriptionMd:
      'The endpoint serving the model (inference API, self-hosted endpoint, model administration panel) is exposed without adequate authentication/authorization or with broad permissions, allowing misuse, configuration extraction and, in some cases, access to context data.',
    impactMd:
      'Unauthorized use of the model, leakage of configuration/data and abuse of inference resources.',
    recommendationMd:
      '- Require robust authentication and authorization on the inference/administration endpoint and restrict the access origin (network/allow-list).\n- Apply least privilege and network segmentation to the model services.\n- Monitor access and apply rate limiting/quotas per client.',
    referencesMd:
      '- https://genai.owasp.org/llmrisk/llm09-misinformation/\n- https://owasp.org/www-project-top-10-for-large-language-model-applications/\n- CWE-284: Improper Access Control',
  }),
  entry({
    owaspCode: 'LLM09',
    family: 'LLM',
    title: 'Missing Encryption of Data in Transit/At Rest',
    severity: 'HIGH',
    tags: ['llm', 'misconfiguration', 'encryption'],
    descriptionMd:
      'Sensitive data handled by the LLM solution (prompts, responses, context, embeddings, conversation logs) travels or is stored without adequate encryption — calls without TLS, history/vectors stored in cleartext. This exposes confidential data to interception and improper access.',
    impactMd:
      'Interception of and unauthorized access to sensitive prompts and responses, with privacy and compliance risk.',
    recommendationMd:
      '- Enforce **TLS** on all calls (client↔backend↔provider) and encrypt sensitive data at rest (history, vectors, logs).\n- Minimize the retention of sensitive prompts/responses and control access to the storage.\n- Ensure providers/third parties meet the encryption and privacy requirements.',
    referencesMd:
      '- https://genai.owasp.org/llmrisk/llm09-misinformation/\n- https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html\n- CWE-311: Missing Encryption of Sensitive Data',
  }),

  // --- LLM10 — Unbounded Consumption ---
  entry({
    owaspCode: 'LLM10',
    family: 'LLM',
    title: 'Denial of Wallet (API Budget Exhaustion)',
    severity: 'MEDIUM',
    tags: ['llm', 'unbounded-consumption', 'denial-of-wallet'],
    descriptionMd:
      'Without per-user/client usage limits, an attacker generates a large volume of requests to the LLM provider (which bills per token/call), leading to exorbitant costs — a "Denial of Wallet". The absence of quotas and cost alerts allows the abuse to go unnoticed until the invoice arrives.',
    impactMd:
      'Direct, potentially high financial loss from abusive consumption of the paid LLM service.',
    recommendationMd:
      '- Enforce **quotas and rate limiting** per user/client and spending limits (budget) with cost alerts.\n- Require authentication to access LLM functionality and detect abuse patterns.\n- Monitor consumption in near real time and implement automatic cut-off when limits are reached.',
    referencesMd:
      '- https://genai.owasp.org/llmrisk/llm10-unbounded-consumption/\n- https://owasp.org/www-project-top-10-for-large-language-model-applications/',
  }),
  entry({
    owaspCode: 'LLM10',
    family: 'LLM',
    title: 'Denial of Service via Excessive Token Consumption',
    severity: 'MEDIUM',
    tags: ['llm', 'unbounded-consumption', 'dos'],
    descriptionMd:
      'Requests crafted to force very long generation or heavy processing (e.g. instructions to produce huge outputs, reasoning loops) consume tokens and inference resources disproportionately, degrading service availability for other users.',
    impactMd:
      'Degradation/unavailability of the LLM service and increased latency and cost due to inference overload.',
    recommendationMd:
      '- Limit output `max_tokens`, input size and time/resources per request; enforce timeouts.\n- Apply rate limiting and fair queueing per user; monitor resource usage.\n- Detect and block abusive request patterns.',
    referencesMd:
      '- https://genai.owasp.org/llmrisk/llm10-unbounded-consumption/\n- CWE-400: Uncontrolled Resource Consumption',
  }),
  entry({
    owaspCode: 'LLM10',
    family: 'LLM',
    title: 'Context Window Exhaustion (Oversized Context Submission)',
    severity: 'MEDIUM',
    tags: ['llm', 'unbounded-consumption', 'context-window'],
    descriptionMd:
      'The attacker submits inputs that fill the maximum context window of the model (huge documents, manipulated history), maximizing the cost and processing time per request and, in some cases, forcing system instructions to be dropped through context truncation.',
    impactMd:
      'High cost and latency per request, availability degradation and possible weakening of guardrails through context truncation.',
    recommendationMd:
      '- Limit the input size and the total context tokens accepted per request; reject payloads above the limit.\n- Protect system instructions from truncation and validate the size of the assembled context.\n- Combine with per-user quotas and consumption monitoring.',
    referencesMd:
      '- https://genai.owasp.org/llmrisk/llm10-unbounded-consumption/\n- CWE-400: Uncontrolled Resource Consumption',
  }),
];
