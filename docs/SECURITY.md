# PropNinja CRM — Security

This document describes how PropNinja protects customer data, how to report vulnerabilities, and how to respond to incidents.

Related: [pre-launch-security.md](./pre-launch-security.md) · [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md) · [SQL_AUDIT.md](./SQL_AUDIT.md) · [MOBILE_SECURE_STORAGE.md](./MOBILE_SECURE_STORAGE.md)

---

## Security contact

If you discover a security vulnerability in PropNinja CRM:

- **Email:** security@propninja.com (replace with your production security alias before go-live)
- **Do not** open public GitHub issues for exploitable vulnerabilities.
- Include: affected URL/endpoint, steps to reproduce, impact assessment, and your contact details.
- We aim to acknowledge reports within **2 business days** and provide a remediation timeline within **5 business days**.

---

## Data we store and how it is protected

### Categories of data

| Data | Examples | Storage |
|------|----------|---------|
| **User accounts** | Name, email, role, bcrypt password hash | PostgreSQL (Railway) |
| **Leads & CRM** | Name, phone, email, notes, status, assignments | PostgreSQL |
| **Call logs** | Duration, outcome, agent, linked lead | PostgreSQL |
| **Documents** | PDFs/images in Cloudflare R2; metadata in PostgreSQL | R2 (private bucket) + signed URLs (1 h expiry) |
| **Audit & security** | Login events, export events, device security events | PostgreSQL |
| **Sessions** | Access JWT (15 min, HttpOnly cookie on web); refresh tokens (7 d, hashed in `auth_refresh_sessions`); revoked JTIs in `token_blocklist` | API cookie / SecureStore + PostgreSQL |

### Protection measures

- **Transport:** HTTPS only in production (Railway API, Vercel web, R2 presigned URLs).
- **Authentication:** JWT with minimum 64-character secret in production; brute-force limits (5 attempts/IP/15 min on login); session revocation and per-token blocklist.
- **Authorization:** Role-based access (admin / manager / agent). Agents are scoped to their own leads regardless of `scope=team` query params.
- **Passwords:** bcrypt with cost factor **12**; password history prevents reuse.
- **Input validation:** Zod schemas on API routes; HTML stripped from notes/imports; CSV formula injection neutralised.
- **Logging & errors:** PII scrubbed from request logs and Sentry (`sendDefaultPii: false`); production 500 responses are generic.
- **Headers:** HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy (API + web).
- **CORS:** Explicit allowlist only; wildcards rejected in production; disallowed origins (e.g. `https://evil.com`) receive no `Access-Control-Allow-Origin`.
- **Webhooks:** Meta Lead Ads webhooks require valid `X-Hub-Signature-256` in production.
- **Mobile:** JWT in Expo SecureStore; screenshot blocking on lead detail; app-switcher blur; optional certificate pinning; offline queue stores request paths/IDs only (no phone numbers on disk).

### Client-side storage notes

| Client | Token storage | Other local data |
|--------|---------------|------------------|
| **Web** | HttpOnly `auth_token` cookie on API domain; user profile cache in `localStorage` (`propninja_user` only); `propninja_session` marker cookie for Next.js middleware | Theme preference, saved filter presets |
| **Mobile** | Expo SecureStore (access + refresh tokens) | Offline call-log queue (lead IDs / API paths, no raw phone numbers) |

Web auth uses **HttpOnly cookies** for JWTs (not readable from JavaScript). Mutating API requests from the web app require `X-Requested-With: XMLHttpRequest` when using cookie auth (CSRF mitigation). Mobile uses Bearer tokens and is exempt.

---

## Data retention

| Data type | Retention |
|-----------|-----------|
| **Active leads** | Until soft-deleted by an authorised user |
| **Soft-deleted leads** | Retained in PostgreSQL with `deleted_at` set; visible via admin “deleted” scope; **not permanently purged automatically** — schedule manual/archival purge per your org policy (recommended: 90 days post-deletion for GDPR-style erasure requests) |
| **Audit logs** | Retained indefinitely unless you configure archival |
| **Login events** | Retained for security monitoring |
| **Revoked JWTs** | Removed from blocklist after token expiry |
| **R2 documents** | Until explicitly deleted via admin document controls |
| **Password reset tokens** | Single-use; expire after configured TTL |

Document your org-specific purge policy in internal ops runbooks before handling erasure requests.

---

## Incident response plan

If a data breach or active exploitation is detected:

1. **Contain** — Revoke compromised credentials immediately (`POST /api/admin/users/:id/revoke-sessions`), rotate `AUTH_JWT_SECRET` (forces re-login), block malicious IPs via admin security tools, disable affected integrations (Meta webhook, etc.).
2. **Assess** — Review audit logs, Sentry events, and Railway logs (scrubbed). Identify scope: which users/leads/documents were accessed, time window, and attack vector.
3. **Eradicate** — Patch the vulnerability, deploy fix, verify with OWASP regression tests (`apps/api/src/__tests__/owaspSecurity.test.ts`).
4. **Recover** — Restore from Railway backup if data was corrupted; admins reset affected user passwords from the Users page.
5. **Notify** — Inform affected users and regulators per applicable law (e.g. DPDP/GDPR timelines). Document timeline, root cause, and remediation in an internal post-incident report.

---

## Credential rotation

### JWT secret (`AUTH_JWT_SECRET`)

1. Generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
2. Set new value on Railway **crm** service → redeploy API.
3. All existing sessions invalidate immediately; users must re-login.

### Database password (`DATABASE_URL`)

1. Rotate password in Railway Postgres plugin.
2. Update `DATABASE_URL` on the API service.
3. Redeploy; verify `/health` returns 200.

### Cloudflare R2 keys

1. Create new R2 API token in Cloudflare dashboard.
2. Update `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` on Railway.
3. Redeploy; verify document upload/download.
4. Revoke old token.

### Meta / Google / Resend / Sentry

Rotate provider-specific keys in Railway and provider consoles. Update Meta webhook verify token if compromised.

### Admin password

```bash
railway run bash -c 'NEW_ADMIN_EMAIL=you@company.com NEW_ADMIN_PASSWORD=<strong> pnpm reset:admin'
```

---

## Dependency audit

Run locally:

```bash
pnpm audit --audit-level=high
```

**CI policy:** Builds **fail** on **critical** CVEs (`pnpm audit --audit-level=critical`). High-severity findings are reported in CI (non-blocking) and tracked here.

### Known high-severity findings (last audit: 2026-06-16)

| Package | Path | Risk | Mitigation |
|---------|------|------|------------|
| `next@14.x` | `apps/web` | RSC deserialization DoS (GHSA-h25m-26qc-wcjf) | **Planned:** upgrade to Next.js 15.0.8+ post v1.0; not exploitable if RSC endpoints are unused |
| `node-forge`, `tar` | `apps/mobile > eas-cli` (dev/build only) | Build-tool CVEs | Dev dependency only; not shipped in production APK/IPA; upgrade `eas-cli` when Expo releases patched version |
| Other moderate/low | Various dev/test tools | CI/dev only | Track via Dependabot; upgrade on routine maintenance |

**Fixed in this audit:** `hono` upgraded to ≥4.12.25 (CORS reflection CVE GHSA-88fw-hqm2-52qc).

---

## Automated security tests

| Test file | Coverage |
|-----------|----------|
| `apps/api/src/__tests__/owaspSecurity.test.ts` | A01 access control, A03 injection, A05 CORS, A07 auth/rate limit |
| `apps/api/src/lib/loginIpRateLimit.test.ts` | Brute-force IP limiter |
| `apps/api/src/lib/scrubLogger.test.ts` | PII log scrubbing |
| `apps/api/src/lib/facebook.test.ts` | Meta webhook HMAC |
| `apps/api/src/lib/inputSecurity.test.ts` | CSV/XSS sanitisation |
| `apps/api/src/lib/cors.test.ts` | Production CORS config |

Run: `pnpm --filter @propninja/api test`

---

## Codebase exposure scan (2026-06-16)

| Check | Result |
|-------|--------|
| `.env` files in git history | **None found** |
| Hardcoded production secrets in `apps/` | **None** — only test fixtures (`test-app-secret`, seed `admin` password) |
| `console.log` with PII in app code | **None** — mobile ESLint rule blocks PII logging |
| Security TODO/FIXME comments | **None** |
| Debug routes (`/api/debug`, `/api/test`) | **None registered** |

---

## OWASP Top 10 go-live verification summary

| ID | Control | Status | Evidence |
|----|---------|--------|----------|
| A01 | Broken access control | **Pass** | Agent `scope=team` → own leads only; DELETE users → 403; team-today report → 403 |
| A02 | Cryptographic failures | **Pass*** | bcrypt cost 12; JWT ≥64 chars enforced in production (*verify Railway env manually) |
| A03 | Injection | **Pass** | Parameterised queries + Zod; SQL/XSS payloads tested |
| A05 | Security misconfiguration | **Pass*** | No debug routes; CORS rejects evil.com (*verify `NODE_ENV=production` on Railway) |
| A07 | Authentication failures | **Pass** | 6th login → 429; revoked token → 401 |

Manual go-live checks: see [LAUNCH_CHECKLIST.md §10](./LAUNCH_CHECKLIST.md#10-go-live-security-checklist).
