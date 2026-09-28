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
