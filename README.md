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

In production, configure `AUTH_SECRET` and `DATABASE_URL` in the runtime environment; the development-only signing-secret fallback is available only when `NODE_ENV=development`. For serverless deployments, use the provider's pooled PostgreSQL connection URL for application traffic (and keep any direct connection URL separate for operator-only database tasks); set a small Prisma connection limit compatible with your provider's pool and function concurrency, for example `?sslmode=require&connection_limit=1` where supported. `PUBLIC_APP_URL` is optional when the public request origin is reliable; when set, it must be a valid HTTPS origin (scheme and hostname only, with an optional trailing slash). Invalid values are rejected by the server. Set it when a reverse proxy makes the internal request origin differ from the public site. `TRUST_PROXY=true` is required to use forwarded client-IP headers for login throttling, and is safe only when the trusted proxy strips incoming forwarded-IP headers and writes its own; otherwise leave it unset. Without a trusted client IP, throttling uses the per-identifier bucket only and does not create a shared bucket for all unknown-IP requests.

## Existing database safety

The configured datasource was previously identified as an existing Supabase PostgreSQL database, but its current identity and migration state have not been re-verified. A prior runtime investigation reported that the target lacked `User.displayTier`, so do not assume its schema matches `prisma/schema.prisma`. Earlier baseline/migration-history observations are historical only and must be confirmed against the intended target before any database operation. A local baseline migration is present at `prisma/migrations/0_init/migration.sql`; never execute it against an existing populated database without a reviewed and approved baseline procedure.

Until the baseline procedure is explicitly reviewed and approved, do not run `db:push`, any `prisma migrate` command, `db:pull`, or the seed script against the configured database. The baseline SQL describes creation from an empty database and must not be executed against the existing populated database.

## Install and run

```bash
npm run db:generate
npm run dev
```

The seed script is only for an explicitly verified database. Its development demo-data path requires `ALLOW_HOUSINGPRO_LOCAL_SEED=YES` and a loopback PostgreSQL `DATABASE_URL`; set the opt-in only after verifying the target is disposable. A one-time production Super Admin bootstrap additionally requires `ALLOW_HOUSINGPRO_PRODUCTION_SEED=YES`, valid `SUPER_ADMIN_*` values, and the intended production datasource to be independently confirmed. If `PlatformSetting` is absent, the seed also creates the schema's default manager-seat limit and generic deposit instructions. Production bootstrap creates an initial Super Admin only when none exists; it never changes credentials for an existing Super Admin. Do not run it against an unknown database or as a routine production task.

The legacy `scripts/provision-super-admin.ts` now follows the same database-target opt-in and creates an account only when no Super Admin exists; it does not update existing credentials. The legacy Netlify wrapper requires `NODE_ENV=production` and the local `ALLOW_HOUSINGPRO_PRODUCTION_SEED=YES` opt-in before it reads deployment environment variables. `scripts/fix-super-admin-email.ts` is a credential repair tool and requires both the database-target opt-in above and `ALLOW_HOUSINGPRO_SUPER_ADMIN_REPAIR=YES`. These tools were not executed during this audit.

Open `http://localhost:3000`.

## Production verification

```bash
npm run db:generate
npm run build
npm run start
```

Database deployment is intentionally omitted here until the existing database baseline has been formally reconciled. Do not substitute `db:push`.

For Vercel or another serverless host, use the Node.js runtime for Prisma route handlers and a provider-managed pooled PostgreSQL URL for application requests. Prisma's development singleton prevents duplicate clients during hot reload; serverless instances still each create their own client, so set a conservative connection limit and size the database pool for the maximum concurrent instances. Do not run migrations or Prisma schema synchronization from the build step. `npm run db:generate` generates the client locally/build-time and does not change database contents.

### Automatic task progression and Re-Rent settlement

Supabase Cron is the single production scheduler. It invokes `POST /api/internal/scheduler/process` once per minute through `pg_net`. The authenticated endpoint runs a bounded daily-progression batch and a bounded Re-Rent candidate-discovery batch, then returns aggregate counts only. Daily task creation reuses the same progression service as manager/admin sync. The Re-Rent batch only identifies due work for manager review; manager approval uses the shared transaction in `lib/rerent-settlement.mjs` to validate and record the final return and single wallet credit. The default Re-Rent delay is 90 seconds; a one-minute schedule can add up to about one schedule interval before a task appears for manager review.

Set `SCHEDULER_SERVICE_SECRET` in the Housing.pro Vercel Production environment to a randomly generated value of at least 32 bytes. Store that same value in Supabase Vault; the endpoint returns 503 when the Vercel secret is missing or too short. Store the public production origin in Vault as well. Do not put either value in committed SQL, browser code, or logs. The endpoint accepts only the bearer secret and does not use session authentication. Supabase documents Cron, Vault, and `pg_net` ([Cron](https://supabase.com/docs/guides/cron), [pg_net](https://supabase.com/docs/guides/database/extensions/pg_net), [Vault](https://supabase.com/docs/guides/database/vault)).

After the Vercel endpoint is deployed and the Vault values are configured, create the single job below in the Supabase Cron SQL editor. This is deployment guidance only; do not run it as part of a local build or test:

```sql
select cron.schedule(
  'housingpro-scheduler',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'housingpro_app_url') || '/api/internal/scheduler/process',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'housingpro_scheduler_service_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
```

Monitor Supabase Cron run history and the endpoint's aggregate processed/failed counts. The daily and Re-Rent batches use deterministic time-slot rotation over stable ordering, so repeatedly failing early records do not permanently block later eligible records. The compatibility path `/api/internal/rerent/process` delegates to the same Re-Rent batch service; do not configure a second Cron job for it.

The scheduler uses deterministic time-slot rotation to identify delayed Re-Rent submissions for manager review. It never calculates or credits a Re-Rent return. A manager enters the final return in Task Center; the server validates and records the single wallet credit atomically. Do not configure a separate Re-Rent worker. Before deploying this application version, verify that the intended database has all migrations required by the current Prisma schema, including `20261001000000_manager_entered_rerent_return` (`Order.finalReturnAmount` and `RERENT_SETTLEMENT`) and `20261002000000_user_display_tier` (`User.displayTier`). Migration application status must be confirmed against the intended database; this repository does not verify it. Supabase Cron/Vault/`pg_cron`/`pg_net` setup is operator-managed platform configuration.

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

## Cancellation policy

Housing.pro does not provide cancellation refunds. Cancelling an order does not automatically refund wallet-paid rent or reverse an existing wallet debit or ledger entry. The platform also does not process refunds for manual/off-platform payments or for orders cancelled while Re-Rent is pending. Existing Manager authorization, order-status checks, audit records, and notifications remain in effect. Any off-platform payment arrangements are outside Housing.pro's refund processing.

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
