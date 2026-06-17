# Mobile secure storage audit

Last reviewed: 2026-06-17

## Encrypted storage (SecureStore)

| Key | Data | Location |
|-----|------|----------|
| `propninja_token` | JWT access token | `apps/mobile/src/lib/auth.ts` |
| `propninja_user` | Session user id, name, email, role (no lead data) | `apps/mobile/src/lib/auth.ts` |

JWT and session identity **must** remain in SecureStore only.

## AsyncStorage (unencrypted) — allowed uses

| Key | Data | Notes |
|-----|------|-------|
| `propninja_pending_call_logs` | Offline call-log API payloads (leadId + outcome metadata) | No phone numbers; queued for sync |
| _(removed)_ `propninja.pendingCall` | ~~leadName, phoneNumber~~ | **Removed** — pending dialer state is in-memory only |

## In-memory only (React Query)

- Lead lists, lead detail, call history, and pipeline data live in the React Query cache.
- `QueryClient` is **not** persisted to disk (`apps/mobile/src/lib/queryClient.ts`).
- Clearing auth calls `queryClient.clear()` on logout.

## Rules for new code

1. Never store phone numbers, emails, or full lead objects in AsyncStorage.
2. Never log PII to `console.log` (see `apps/mobile/.eslintrc.cjs`).
3. Use SecureStore for secrets; use in-memory state for sensitive CRM data.
4. Prefer lead IDs in offline queues instead of names or phone numbers.
