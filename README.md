# Housing.pro

Next.js + Prisma + PostgreSQL property marketplace with three internal areas:

- **Admin:** full platform visibility, manager management, seat capacity, deposit instructions, payment-account settings, activity/audit visibility.
- **Manager:** isolated access to only users assigned through that manager's referral code; manual deposit/withdrawal processing.
- **User:** own wallet, deposits, withdrawals, transactions and request statuses.

## Important security behavior

- Passwords are hashed with bcrypt.
- Sessions use an HTTP-only signed JWT cookie.
- Production requires `AUTH_SECRET` (minimum 32 characters); there is no production fallback secret.
- Manager ownership is enforced server-side through `managerId` filters; hiding UI elements is not the security boundary.
- Deposit approval uses a serializable transaction and a conditional `PENDING` claim to prevent duplicate credits.
- Withdrawal creation reserves available balance atomically.
- Withdrawal rejection releases the reservation only for a still-pending request.
- Withdrawal payment uses a conditional `APPROVED` transition plus atomic wallet debit/reservation release to prevent double payment.
- API responses explicitly select safe fields; password hashes are not returned to browsers.
- Money values are stored as PostgreSQL `Decimal(18,2)`.

## Requirements

- Node.js 20.9+ (current Next.js documentation requirement for modern Next.js setup).
- PostgreSQL database.
- npm.

## Environment

Copy `.env.example` to `.env` and set:

```text
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
AUTH_SECRET="a-long-random-secret-at-least-32-characters"
```

In production, configure `AUTH_SECRET` and `DATABASE_URL` in the runtime environment; the development-only signing-secret fallback is available only when `NODE_ENV=development`. `PUBLIC_APP_URL` is optional when the public request origin is reliable; when set, it must be a valid HTTPS origin (scheme and hostname only, with an optional trailing slash). Invalid values are rejected by the server. Set it when a reverse proxy makes the internal request origin differ from the public site. Set `TRUST_PROXY=true` only when a trusted proxy sanitizes the forwarded client-IP headers; otherwise leave it unset.

## Existing database safety

The configured Supabase database already contains the application tables and records. Its structure matches `prisma/schema.prisma`. A local baseline migration is present at `prisma/migrations/0_init/migration.sql`, but it has **not** been marked as applied and the database does not yet have a `_prisma_migrations` table.

Until the baseline procedure is explicitly reviewed and approved, do not run `db:push`, any `prisma migrate` command, `db:pull`, or the seed script against the configured database. The baseline SQL describes creation from an empty database and must not be executed against the existing populated database.

## Install and run

```bash
npm run db:generate
npm run dev
```

The seed script is only for a disposable development database. Never run it against the existing Supabase database or production data.

Open `http://localhost:3000`.

## Production verification

```bash
npm run db:generate
npm run build
npm run start
```

Database deployment is intentionally omitted here until the existing database baseline has been formally reconciled. Do not substitute `db:push`.

### Re-Rent settlement: scheduler first, worker optional

The shared settlement transaction enforces the configured delay, verifies current ownership/payment/account state, and atomically updates the order, wallet, profit ledger, notification, and audit record. User-side polling remains available as a fallback. The authenticated scheduler endpoint is `POST /api/internal/rerent/process`; it only selects submitted, payment-confirmed tasks whose configured delay has elapsed, processes a bounded batch, and returns aggregate counts without identifiers.

For scheduled HTTP endpoint processing, configure a Supabase Cron job to call the deployed Housing.pro endpoint and set `RERENT_SCHEDULER_SECRET` in the Housing.pro server environment to a randomly generated value of at least 32 bytes. The endpoint returns 503 until this is configured. Keep the same value in Supabase Vault for a direct `pg_cron` + `pg_net` request, or in Supabase Edge Function Secrets if using an Edge Function relay. The standalone persistent worker does not use this HTTP bearer secret; it connects directly to PostgreSQL through Prisma and requires `DATABASE_URL`. The HTTP endpoint requires `RERENT_SCHEDULER_SECRET`; neither mechanism requires this secret when relying only on user-side polling. Never put this credential, `DATABASE_URL`, or `AUTH_SECRET` in browser code or a publishable key. Supabase documents Cron HTTP requests and recommends Vault for credentials used by scheduled Edge Function calls ([Cron](https://supabase.com/docs/guides/cron), [scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions), [pg_net](https://supabase.com/docs/guides/database/extensions/pg_net)).

In the Supabase Dashboard, enable the Cron and `pg_net` integrations if they are not already available, store the public app origin and scheduler token in Vault, then create a job such as this in Cron's SQL editor. Replace the Vault secret names only if you choose different names; do not paste the token directly into a committed file:

```sql
select cron.schedule(
  'housingpro-rerent-settlement',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'housingpro_app_url') || '/api/internal/rerent/process',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'housingpro_rerent_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
```

Alternatively, a scheduled Supabase Edge Function can read `HOUSINGPRO_APP_URL` and `RERENT_SCHEDULER_SECRET` from its server-side secrets and `fetch()` the same endpoint with `method: 'POST'` and `Authorization: Bearer <secret>`. Keep the function short-lived; the endpoint processes at most 40 tasks per invocation and returns `hasMore` when another batch is available. A one-minute schedule means settlement may happen up to about one additional schedule interval after the configured delay. Review Cron job history and Edge Function invocation limits/quotas for the project's plan.

The existing persistent worker remains available for later hosting that supports a long-running process:

```bash
npm run worker:rerent
```

It runs separately from `npm run start`, polls every five seconds, and uses the same settlement function. Choose either scheduled invocations or the persistent worker for routine background processing; user-side polling remains a fallback. No Housing.pro schema change is required for the scheduler endpoint. Supabase's own Cron/Vault/`pg_net` setup is an operator-managed platform configuration.

A real production verification is only complete after the application is running and the following flows have been manually tested:

1. Admin login and manager creation.
2. Manager seat limit increase/decrease protection.
3. Manager activation/suspension.
4. User registration through an active referral code.
5. Manager isolation: manager A cannot read manager B's clients even by changing IDs/URLs.
6. Deposit submission → manager approval → exact wallet credit → ledger/audit entry.
7. Deposit duplicate-click/concurrent approval test.
8. Withdrawal submission → balance reservation → approval → manual payment → exact debit → ledger/audit entry.
9. Withdrawal rejection → reservation release.
10. Withdrawal duplicate/concurrent payment test.
11. User, manager and admin responses contain no password hashes.
12. Logout and expired/invalid session behavior.
13. Suspended manager cannot use manager APIs.
14. Suspended user cannot use user APIs.

## If `npm install` fails with `EAI_AGAIN` / registry DNS

Run:

```bash
npm config get registry
npm ping
npm doctor
```

The expected registry is `https://registry.npmjs.org/`. If `npm ping` fails with DNS/network errors, fix the machine's internet/DNS/proxy/VPN connection first. Do not replace dependencies or code merely because the registry cannot be reached.

## Local authentication test fixtures

Use the dedicated fixture command only with a disposable local PostgreSQL database whose existing schema has already been provisioned. The command refuses to run unless `NODE_ENV=development`, explicit opt-in is set, and `.env.local.test` points to `localhost`, `127.0.0.1`, or `::1` with the database name `housingpro_test`. It never falls back to `DATABASE_URL`.

Create `.env.local.test` locally with a `LOCAL_TEST_DATABASE_URL` for that disposable database. This file is ignored by Git. Then run:

```powershell
$env:NODE_ENV='development'; $env:ALLOW_HOUSINGPRO_TEST_FIXTURES='YES'; npm run db:test-fixtures
```

The command creates only five synthetic login identities (one admin, two managers, and two pending customers), with random passwords printed to the local terminal once. It refuses if any fixture email already exists. Customers are linked to separate fixture managers. It creates no wallet, financial, order, task, or notification records.

Do not use `npm run db:seed` with the existing Supabase database. That legacy seed upserts fixed demo emails, changes existing account fields, and can create a wallet and welcome ledger entry. It is not the safe fixture mechanism.

## Local sample property fixtures

`npm run db:local-sample-properties` creates up to eight original fictional property records for local UI development. It requires `NODE_ENV=development`, `HOUSINGPRO_CREATE_LOCAL_SAMPLE_PROPERTIES=YES`, and `.env.local.test` containing `LOCAL_TEST_DATABASE_URL`. The script accepts only PostgreSQL on `localhost`, `127.0.0.1`, or `::1` with the database name `housingpro_test`; it never reads or falls back to `DATABASE_URL`. Sample titles are marked `[LOCAL SAMPLE]`. This command was not run as part of this review. Do not point the fixture URL at a production or shared database.

For PowerShell, after setting up the disposable local test database and `.env.local.test`, run:

```powershell
$env:NODE_ENV='development'; $env:HOUSINGPRO_CREATE_LOCAL_SAMPLE_PROPERTIES='YES'; npm run db:local-sample-properties
```
