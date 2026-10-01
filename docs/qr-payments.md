# QR payments kit (PromptPay)

Reusable automatic payment detection for the demos. `scope` = demo slug; each scope has its own payee, intents, webhook events and unmatched list. Fashion store is the reference integration (`lib/db/fashion-store.ts`, `app/demos/fashion-store/page.tsx`).

## Pieces

| File | Role |
| --- | --- |
| `lib/qr-payments.ts` | Server-only core: tables, payee, intents, matching, settlement |
| `lib/payment-webhook.ts` | HMAC-SHA256 sign/verify, timestamp tolerance, event validation |
| `lib/sandbox.ts` | `sandboxEnabled()`: the one switch for every demo-only fallback |
| `lib/qr-route-handlers.ts` | `createQrRoutes(cfg)` catch-all dispatcher plus the individual handler factories |
| `components/qr/*` | `QrPayPanel`, `PayeeSettings`, `UnmatchedPayments`, `SandboxSimulate` |

Tables (created lazily): `qrpay_payee(scope)`, `qrpay_intents` (unique payable amount among pending per scope), `qrpay_events(scope, event_id)`, `qrpay_unmatched`.

## Plugging a demo in

1. Keep your own order/booking/invoice table. In the same `tx()` that inserts it, call
   `createIntent(scope, { refType, refId, baseAmount, windowMs, referencePrefix? }, tx)` and store the returned `intentId` on your row.
   Returns `{ intentId, payableAmount, reference, expiresAt, qrPayload }`. `payableAmount` = base + a unique 0.01-0.99.
2. Write an `onPaid` callback and export a config:
   ```ts
   export const qrpay: QrRouteConfig = { scope: "my-demo", onPaid, defaultPayeeName: "ร้านตัวอย่าง" };
   ```
3. Mount one route file, `app/api/<scope>/qrpay/[...path]/route.ts`:
   ```ts
   export const dynamic = "force-dynamic";
   const h = createQrRoutes(qrpay);
   export const GET = h.GET; export const POST = h.POST; export const PUT = h.PUT;
   ```
   Sub-paths: `POST webhook`, `POST simulate` (sandbox only), `GET settings` (public), `GET|PUT payee` (admin), `GET unmatched` (admin),
   `POST unmatched/:id/assign` (admin, body `{ intentId }`), `GET intents/:id` (public status + QR payload), `POST intents/:id/slip` (multipart `slip`).
   Admin auth defaults to header `x-demo-role: admin`; override with `authorizeAdmin` in the config.
4. UI: render `<QrPayPanel scope intentId accent onPaid onClosed />` for a pending payment. In admin render
   `<PayeeSettings>`, `<SandboxSimulate targets>` and `<UnmatchedPayments targets>`, all with `scope`, `headers` (e.g. `{ "x-demo-role": "admin" }`) and `accent`.
   `targets` for assignment are `{ intentId, label }`; for simulation `{ key, label, amount, reference? }`.
5. Before reading your own rows, call `expireStale(scope, db)` and mirror expired intents onto your rows (see `expireStale` in the fashion store).

## onPaid contract

`onPaid({ scope, refType, refId, intent, via }, tx) => void | { cancelled: true, reason, message? }`

- Runs inside the kit's transaction, exactly once per intent, for webhook, slip and manual assignment. Flip your row to paid and decrement stock there; use `tx` only (never `db()` transactions).
- **Never throw because the order is in an impossible state** (not found, already paid, closed, sold out) once money has arrived: a throw rolls back the event and unmatched rows, the money becomes untracked and the provider retries forever. Return `{ cancelled: true, reason, message? }` instead: the intent becomes `cancelled`, the money is parked in `qrpay_unmatched` for a refund (webhook: the event id; slip: the slip `transRef`), and your own writes (e.g. cancelling the order) commit. For manual assignment this is thrown as 409 instead. Throw only for genuine bugs/infrastructure failures (everything rolls back, the slip is released).
- When you settle an order, also cancel its sibling pending intents (a re-issued QR), see `settleOrder` in the cafe/fashion/handmade demos.
- Matching: exact payable amount (plus `reference` when the event carries one), idempotent by `eventId`. Ambiguous or unknown money goes to `qrpay_unmatched`.
- Payable amounts stay reserved for 24h after an intent lapses, so a late reference-less notification cannot match a newer intent with the same amount. If that pool is exhausted the longest-lapsed amount is recycled; with all 99 amounts pending, `createIntent` throws 503 `busy`.
- Assigning unmatched money requires the parked amount to equal the intent's payable amount (else 409 `amount_mismatch`).

Errors are `QrPayError(status, message, code)`; turn them into responses with `qrErrorResponse`.

## Environment

- `PAYMENT_WEBHOOK_SECRET` (shared) or `PAYMENT_WEBHOOK_SECRET_<SCOPE>` (e.g. `..._FASHION_STORE`): HMAC secret. Signature = hex HMAC-SHA256 of `${scope}.${x-timestamp}.${rawBody}` in header `x-signature` (the scope binds a signature to one demo, so a shared secret cannot be replayed across demos); timestamp must be within 5 minutes.
- `sandboxEnabled()` (`lib/sandbox.ts`) is true when `(NODE_ENV !== "production" && QRPAY_SANDBOX !== "0") || DEMO_SANDBOX === "1"`. The dev fallback webhook secret, Thunder sandbox slips, the OTP `devCode`, `POST simulate` and the cafe table launcher all depend on it. Production deploys leave it OFF; the public portfolio (a demo with no real money) sets `DEMO_SANDBOX=1` on purpose. Never set it where real money flows.
- Without a secret and with the sandbox off the webhook answers 503.
- `THUNDER_API_KEY` for real slip verification. Outside the sandbox `THUNDER_EXPECT_RECEIVER` is also required (else `provider_error`), slips dated before the intent was created are rejected when the provider returns a date, and a missing key is `provider_error` instead of a fake pass.
- OTP: outside the sandbox without ThaiBulkSMS keys `/api/otp/request` answers 503. A verified token authorises at most 5 uses within 15 minutes (consumed by `isOtpVerified`); `/api/otp/request` is capped at 20 per IP per day (`x-forwarded-for`) on top of the 30s per-phone throttle.
- Slip upload: `content-length` over ~5.5MB answers 413 before the body is read.

## Sandbox vs production

The demos have no real bank feed. In sandbox, `POST simulate` signs a notification on the server and passes it to the real webhook handler, so signature check, matching and `onPaid` all run exactly as in production. It returns 404 when the sandbox is disabled.
In production the webhook must be called by the bank or a payment provider that supports PromptPay incoming-payment notifications, mapped to the event body
`{ eventId, amount (baht), paidAt (ISO), reference?, provider?, accountLast4? }` (amount is validated after rounding to satang: 0.01 to 10,000,000 baht), signed with the shared secret over `${scope}.${timestamp}.${body}`. Replace the `x-demo-role` header check with a real admin session.
