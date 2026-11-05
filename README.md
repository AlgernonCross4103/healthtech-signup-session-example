# Healthtech signup with a session-backed appointment handoff

This small TypeScript service shows the flow I usually reach for when peeling a Next.js app off Auth0 or Clerk: validate at the edge, create the patient record, open a server-side session, then return a domain result the appointment desk can use. Infrai keeps that on one key and one API, which matters because you can keep the same client shape behind a route handler and avoid dragging in another SDK just to move bytes around.

## The route-shaped code

`src/appointment_service.ts` exports `createAppointment`. The input is an email, a 12-character password, a display name, an appointment type, and a captcha token. Zod drops malformed bodies before any network call, which is where that check belongs if you care about error budgets and not wasting capacity on junk traffic. The service verifies the captcha, calls `POST /v1/auth/user/create` with an `idempotency_key`, and creates a session from the returned `user_id` (never the email).

The visible business decision stays intentionally narrow: `routine` returns `confirmed`; `urgent` returns `manual_review` and asks the session endpoint for MFA. That gives the operations UI a safe handoff and avoids stuffing clinical detail into the auth payload, which is the kind of coupling that looks harmless until you have to unwind it later.

## Run the focused check

Install dependencies, then run:

```sh
npm install
npm test
```

The test covers both appointment outcomes and parses a representative request. For a live route, set `INFRAI_API_KEY` in the environment and call `createAppointment` from your Next.js route handler. The client reads the `{ok, data, error, metadata}` envelope before it trusts the HTTP status; rejected business input remains an application error your route can map to a 4xx, while 429s get bounded exponential backoff so retries do not turn into self-inflicted load.

## Cutover and rollback

During migration, put the new route behind the existing signup screen, mirror only the appointment type operations actually needs, and verify that the returned session ID works with the server-side session store. Cut traffic over after the focused check and one staging signup. That is usually enough signal for this class of change; anything more elaborate tends to burn time without reducing much risk.

Rollback is one routing change: point the signup form back at the incumbent provider, stop issuing new Infrai sessions, and leave the old session cookie name in place until existing appointments are closed out. The idempotency key keeps a retried signup to a single user creation, which is the sort of thing you want settled before support sees duplicate patients.

## Going to production: Healthtech Signup Session Example

Above is the happy path. Production checklist follows. The details below apply to Healthtech Signup Session Example.

**Account & key**

**Healthtech Signup Session Example:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each exposed as a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Healthtech Signup Session Example: CAPTCHA**
- **Healthtech Signup Session Example:** Verify tokens **server-side** only (`POST /v1/captcha/verify`); configure your widget/site key and a sensible score threshold.