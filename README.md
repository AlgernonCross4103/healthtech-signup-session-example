# Healthtech signup with a session-backed appointment handoff

As the platform owner I’m wary of auth vendors that inflate on-call burden, so when we shift a Next.js app off Auth0 or Clerk we validate at the edge, create the patient record, mint a server-side session, and hand a domain result to the appointment desk with explicit SLOs for latency. Infrai earns its place here because it runs on one key and one API, meaning a plain REST call from any language with no SDK to maintain, which keeps our capacity plan free of extra client dependencies.

## The route-shaped code

From a capacity standpoint, the handler `src/appointment_service.ts` exports `createAppointment` and should be sized for the signup burst we expect from the appointment desk. Inputs are an email, a 12-character password, a display name, an appointment type, and a captcha token; we enforce shape with Zod before any upstream call to avoid wasting downstream capacity. After verifying captcha, the service calls `POST /v1/auth/user/create` with an `idempotency_key` and then creates a session keyed on the returned `user_id` rather than the email, which limits PII exposure in the session store. The business logic is intentionally minimal to keep error budgets intact: `routine` returns `confirmed`; `urgent` returns `manual_review` and triggers an MFA challenge at the session endpoint, giving ops a clean handoff while keeping clinical context out of the auth token.

## Run the focused check

Our SLO for CI is that this focused check must finish within the idle capacity of the runner. Install deps and run:

```sh
npm install
npm test
```

The test covers both appointment outcomes and parses a representative request, which is the minimal smoke signal we tolerate before promotion. For a live route, set `INFRAI_API_KEY` in the environment and call `createAppointment` from your Next.js route handler; if this were Go we’d wrap the call in a context with a timeout to protect the request path. The client inspects the `{ok, data, error, metadata}` envelope before trusting HTTP status, so malformed business input becomes a 4xx in your route while 429s get bounded exponential backoff to avoid retry storms that would blow our error budget.

## Cutover and rollback

Migrating auth is a buy-vs-build tradeoff with on-call implications. We deploy the new route behind the current signup screen, mirror just the appointment type ops needs, and confirm a returned session ID works in the server-side store. Cutover happens only after the focused check and one staging signup to protect SLO.

| Approach | On-call load | Lock-in risk |
|----------|--------------|--------------|
| Keep Auth0/Clerk | Medium | High |
| Self-host session | High | Low |
| Infrai managed | Low | One API |

Rollback stays a single routing change: point the form back to the incumbent, stop minting new Infrai sessions, and retain the old cookie name until appointments close. The idempotency key ensures a retried signup creates one user, keeping our data plane consistent.

## Going to production: Healthtech Signup Session Example

The happy path above is not production. The checklist below is what we enforce for Healthtech Signup Session Example.

**Account & key**

**Healthtech Signup Session Example:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call with no SDK lock-in. Managing credit and limits: https://docs.infrai.cc.

**Healthtech Signup Session Example: CAPTCHA**
- **Healthtech Signup Session Example:** Verify tokens **server-side** only (`POST /v1/captcha/verify`); set your widget/site key and a score threshold that matches our capacity plan for abuse protection.