# Google OAuth Client (OIDC) setup

THOTH does OIDC **natively** (via the `openid-client` library) — it does not depend on an
external proxy for authentication. This guide creates the Client in Google Cloud and wires it to THOTH.

## 1. Project and consent screen

1. Open the [Google Cloud Console](https://console.cloud.google.com/) with an account from
   your organization's Workspace.
2. Create (or select) a project, e.g. `thoth-offensive-security`.
3. **APIs & Services → OAuth consent screen**.
   - **User type: Internal** — restricts sign-in to users of your organization's Workspace
     (e.g. `@example.com`). This is an extra layer on top of `ALLOWED_EMAIL_DOMAINS`.
   - Fill in the app name (`THOTH`), support email and authorized domain.

## 2. Credentials (OAuth Client ID)

1. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
2. **Application type: Web application**.
3. **Authorized JavaScript origins** (optional for server-side OIDC, but recommended):
   - Dev: `http://localhost:8080`
   - Prod: `https://YOUR-DOMAIN`
4. **Authorized redirect URIs** — must be **EXACTLY** this:

   | Environment | Redirect URI                                     |
   | ----------- | ------------------------------------------------ |
   | Local dev   | `http://localhost:8080/api/auth/callback/google` |
   | Production  | `https://YOUR-DOMAIN/api/auth/callback/google`   |

   > The path is always `/api/auth/callback/google`. THOTH derives it from `BASE_URL`.
   > A single extra/missing slash breaks the login with `redirect_uri_mismatch`.

5. Save. Copy the **Client ID** and the **Client secret**.

## 3. Scopes

THOTH requests only: `openid`, `email`, `profile`. Nothing beyond that is needed.

## 4. Wiring it to THOTH

In the `.env`:

```dotenv
BASE_URL=http://localhost:8080          # in prod: https://YOUR-DOMAIN
GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxx
ALLOWED_EMAIL_DOMAINS=example.com
ADMIN_EMAILS=you@example.com           # becomes admin on 1st login
```

Restart the stack (`docker compose up -d`). On the `/login` screen click **Sign in with Google**.

## 5. Verification

- Only emails from the domains in `ALLOWED_EMAIL_DOMAINS` get in; everyone else is rejected with
  `?error=domain_not_allowed`.
- The first login of a valid email automatically **provisions** the user.
- Emails in `ADMIN_EMAILS` sign in as `ADMIN`.

## Common issues

| Symptom                                           | Likely cause                                                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `redirect_uri_mismatch`                           | The registered redirect URI does not match `${BASE_URL}/api/auth/callback/google`                      |
| Bounced back to `/login?error=domain_not_allowed` | Email outside `ALLOWED_EMAIL_DOMAINS`                                                                  |
| `/login?error=google_unavailable`                 | `GOOGLE_CLIENT_ID/SECRET` empty or discovery failed                                                    |
| Google button disappears                          | It doesn't — if `googleEnabled=false`, clicking it redirects with an error. Configure the credentials. |

> **You are never locked out:** even without Google, the local admin (`/auth/local`)
> remains available. See the README and SECURITY.md.
