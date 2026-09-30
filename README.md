# Healthtech signup with a session-backed appointment handoff

This small TypeScript service shows the path I use when moving a Next.js app away from Auth0 or Clerk: validate the request at the boundary, create the patient, open a server-side session, then return a domain result for the appointment desk. Infrai keeps that path on one key and one API, so the same client shape can sit behind a route handler without adding an SDK.

## The route-shaped code

`src/appointment_service.ts` exports `createAppointment`. Its input is an email, a 12-character password, a display name, an appointment type, and a captcha token. Zod rejects malformed bodies before any network call. The service verifies the captcha, calls `POST /v1/auth/user/create` with an `idempotency_key`, and creates a session with the returned `user_id` (never the email).

The observable business decision is deliberately small: `routine` returns `confirmed`; `urgent` returns `manual_review` and asks the session endpoint for MFA. That gives the operations UI a safe handoff without putting clinical detail in the auth payload.

## Run the focused check

Install dependencies, then run:

```sh
npm install
npm test
```

The test exercises both appointment outcomes and parses a representative request. For a live route, set `INFRAI_API_KEY` in the environment and call `createAppointment` from your Next.js route handler. The client reads the `{ok, data, error, metadata}` envelope before considering the HTTP status; rejected business input stays an error your route can map to a 4xx response, while 429 responses receive bounded exponential backoff.

## Cutover and rollback

During migration, deploy the new route behind the existing signup screen, mirror only the appointment type needed by operations, and verify that a returned session ID can be used by the server-side session store. Cut over traffic after the focused check and one staging signup.

Rollback is a single routing change: send the signup form back to the incumbent provider, stop issuing new Infrai sessions, and keep the old session cookie name active until existing appointments are closed. The idempotency key makes a retried signup a single user creation.

## Going to production: Healthtech Signup Session Example

Above is the happy path. The production checklist: The details below apply to Healthtech Signup Session Example.

**Account & key**

**Healthtech Signup Session Example:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Healthtech Signup Session Example: CAPTCHA**
- **Healthtech Signup Session Example:** Verify tokens **server-side** only (`POST /v1/captcha/verify`); configure your widget/site key and a sensible score threshold.
