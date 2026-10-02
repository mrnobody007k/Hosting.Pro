# Housing.pro project handover

## Current owner scope — display-only tiers (2026-10-02)

This newest scope supersedes the tier/commission design and implementation proposals later in this document. Housing.pro tier work is limited to a display-only Gold/Diamond/Merchant assignment, a Tier page, showing the assigned value beside the user's account/profile name, and a safe Admin-only manual assignment control. Tiers do not influence tasks, progression, schedules, eligibility, commissions, payouts, wallet, transactions, or ledger. No property/task commission settings, commission snapshots, tier-task system, or fixed settlement branch are in scope. Preserve every existing Day-based task and financial path.

Existing users are not mapped from membership status: the new nullable display-tier field remains unassigned for all existing records until an Admin explicitly sets it. Assignment affects only the displayed value. Manager mutations are forbidden. The prior tier schedule, commission, points, and tier-task migration proposals are out of scope. The separately owner-approved signup override and authenticated scheduler requirements remain active and are summarized below.

The reduced implementation is an additive nullable `User.displayTier` enum and forward migration with no default/backfill; an Admin client-detail mutation requiring `MANAGE_USERS` and writing an audit record; an authenticated user read-only tier endpoint; a branded `/user/tier` page and account/profile badge; and focused tests for Admin authorization, Manager/User denial, unassigned legacy rows, and assigned-tier rendering. The tier migration was applied only to the disposable local `housingpro_test` database on 2026-10-02, as documented in the later integration checkpoint below; it was not applied to production. Preserve existing checkout changes and do not run production operations.

Updated: 2026-10-02

## Superseded historical tier/commission proposal

The following section was copied from an earlier product proposal and conflicts with the current owner-approved display-only tier scope above. It is retained as project history only; do not implement its tier task schedules, percentage commission, profile points, or Admin-no-credit rule. The active signup override requirement is documented separately below and in the latest continuation entry.

- Replace the user-facing Day 1 / Day 2 / Day 3 progression with Gold, Diamond, and Merchant tiers.
- Gold displays a 20% label and has morning and evening tasks. The percentage is display-only.
- Diamond displays a 40% label and has morning and afternoon tasks. The percentage is display-only.
- Merchant displays a 60% label; Admin configures its task count and schedule. The percentage is display-only.
- Admin configures a fixed commission amount separately for each property/task combination. The assigned Manager's approval of each eligible task makes that fixed amount payable. Percentages must never calculate payouts or change accounting.
- Show 10 default profile points beside the user's profile. Managers can add or subtract whole-number points only for their own clients; negative total points are allowed. Admin has oversight, every adjustment is audit logged, and duplicate submissions must be safely handled. No points menu.
- The assigned Manager's normal signup approval triggers the ₹120 welcome credit once, using existing ledger safeguards. Admin's signup-approval override is a separate approval action and must not issue or duplicate that credit.
- Preserve the existing manual payment and withdrawal workflows. Keep the user dashboard free of location selection and search; show only Admin-managed active properties.
- Preserve existing data and current uncommitted work. Never apply production migrations or access production services without explicit authorization.

## Active release requirements and implementation map (2026-10-02)

- **Display tiers:** Nullable `User.displayTier` is display-only, with no status-based backfill; Admin assignment requires `MANAGE_USERS` or Super Admin and is audited. Manager cannot mutate it. The user tier API, page, profile field, and badge use the explicit assigned value. Source/tests: `prisma/schema.prisma`, `prisma/migrations/20261002000000_user_display_tier`, `app/api/admin/clients/[id]/route.ts`, `app/api/user/tier/route.ts`, `app/user/tier/page.tsx`, `app/user/TierBadge.tsx`, `tests/display-tier.test.tsx`, `tests/release-route-policy.test.ts`.
- **Signup approval:** Manager approval and the owner-approved Super Admin override use the shared atomic approval service; either valid first approval grants exactly one ₹120 welcome credit with wallet/ledger consistency, an authenticated actor audit row, and notification. Duplicate requests do not double-credit. Routes/service/tests: `app/api/manager/signups/route.ts`, `app/api/admin/clients/[id]/signup/route.ts`, `lib/signup-approval.ts`, `tests/signup-approval.test.ts`, `tests/release-route-policy.test.ts`. Mock/retry tests do not prove PostgreSQL serialization concurrency; live login/effects remain unverified.
- **Cancellation:** Housing.pro has no cancellation-refund feature. Cancellation does not refund wallet debits or reverse ledger entries; manual/off-platform and `RE_RENT_PENDING` cancellations do not process refunds. Source/test: `lib/order-cancellation.ts`, manager/admin order routes, and cancellation policy tests. This policy remains active.
- **Daily tasks, membership, and Re-Rent:** Preserve established Day task progression, membership, and financial rules unless explicit evidence/authorization changes them. Manager-entered Re-Rent final return is separate and settles at most once through its own ledger/audit/notification path. Source/tests and migrations: `lib/daily-task-*`, `lib/rerent-*`, manager/user task/order routes, `prisma/migrations/20261001000000_manager_entered_rerent_return`, scheduler and settlement unit tests. Do not infer a live database migration from source tests.
- **Bookings and withdrawals:** Keep rental booking payment manual/off-platform: order starts `PAYMENT_PENDING`/`PENDING`; user submits a reference or proof from booking detail; Manager review activates payment. Booking creation does not debit the wallet. Existing withdrawal workflow stays unchanged. Source/test: `app/api/user/orders/route.ts`, `app/api/user/orders/payment/route.ts`, `app/user/orders/[id]/page.tsx`, dashboard link, and `tests/manual-order-payment.test.ts`. Local source contract tests do not prove a live workflow.
- **Properties and public discovery:** User sees only Admin-managed active properties (global active or assigned Manager active) and dashboard omits location selection/search. API filters and booking rechecks are server-side. External marketing links are clearly labeled as independent and unaffiliated. Source tests/docs are listed in the later release checklist.
- **Scheduler:** Canonical bounded route is `POST /api/internal/scheduler/process`, Bearer-authenticated by `SCHEDULER_SERVICE_SECRET` (minimum 32 UTF-8 bytes); legacy Re-Rent route is a compatibility alias. Source/unit tests cover auth/window/runner. Production secret validity, Supabase Cron configuration/history, deployment artifact contents, and actual execution remain unverified.
- **Runtime/release:** Runtime env names are `DATABASE_URL`, `AUTH_SECRET`, and `SCHEDULER_SERVICE_SECRET`; optional public-origin config must remain unset until the canonical domain is owner-confirmed. Include code, helpers, tests, Prisma schema, migrations, docs/assets, and the old-worker replacement as one reviewed release snapshot. Confirmed primary target is Vercel `housing-pro`, project ID `prj_uKNFA4R8JyqWOhiKZbcKhRQDEgg1`; do not modify/deploy without release authorization.

## Current checkout and completed work

- Repository: `D:\marketplace-platform-phase5\FINAL-AUDITED-INSPECT`
- Branch: `main`; HEAD at inspection: `a1dee6ead64b482037096db8b370696e6539b545`.
- The checkout contains substantial pre-existing modified and untracked scheduler, Re-Rent settlement, authentication/rate-limit, UI, E2E, tests, and migration work. Preserve it; do not reset, clean, checkout, stash, or overwrite it.
- Current `git status --short --untracked-files=all` was inspected for this continuation. It has the modified/deleted/untracked paths listed below, plus this handover. No `.env*` file, `next-env.d.ts`, or `REFERENCE-USER-PANEL/` appears in status.
- `next-env.d.ts` is not modified. `REFERENCE-USER-PANEL/` is absent as previously requested.
- No prior handover/progress document was present when this file was created.
- This handover is the only file changed during the tier-system continuation. No application, Prisma, migration, environment, or production configuration files were changed in that continuation.
- Earlier reported verification (not rerun in this continuation): scheduler unit tests 14/14, TypeScript, Prisma validation, production build, and `git diff --check` passed. Targeted task-verification and scheduler Playwright tests passed their assertions but the Windows Playwright web-server teardown hung. Treat these as earlier-session results, not fresh verification of the current tree.
- Earlier local environment investigation reported `housingpro_test` reachable and the manager-entered Re-Rent migration applied locally. No production migration/configuration was inspected or changed. Production migration and external scheduler configuration remain UNVERIFIED.

### Current modified tracked files

`.gitignore`, `README.md`, `app/admin/orders/page.tsx`, `app/admin/settings/page.tsx`, `app/api/admin/orders/route.ts`, `app/api/admin/overview/route.ts`, `app/api/admin/settings/route.ts`, `app/api/auth/login/route.ts`, `app/api/internal/rerent/process/route.ts`, `app/api/manager/orders/rerent/route.ts`, `app/api/manager/orders/route.ts`, `app/api/manager/overview/route.ts`, `app/api/manager/tasks/[id]/review/route.ts`, `app/api/manager/tasks/route.ts`, `app/api/user/activity/route.ts`, `app/api/user/orders/[id]/route.ts`, `app/api/user/orders/route.ts`, `app/api/user/overview/route.ts`, `app/api/user/tasks/route.ts`, `app/api/user/tasks/settle/route.ts`, `app/layout.tsx`, `app/login/LoginForm.tsx`, `app/manager/orders/page.tsx`, `app/manager/tasks/page.tsx`, `app/register/page.tsx`, `app/user/activity/page.tsx`, `app/user/orders/[id]/page.tsx`, `app/user/orders/page.tsx`, `app/user/page.tsx`, `app/user/properties/[id]/page.tsx`, `app/user/rerent/page.tsx`, `app/user/revenue/page.tsx`, `app/user/support/page.tsx`, `app/user/tasks/page.tsx`, `app/user/wallet/page.tsx`, `e2e/task-verification.spec.ts`, `lib/admin-auth.ts`, `lib/client-day.ts`, `lib/daily-task-progression.ts`, `lib/rerent-settlement.d.mts`, `lib/rerent-settlement.mjs`, `lib/security.ts`, `package.json`, `playwright.config.ts`, `prisma/schema.prisma`, and `prisma/seed.ts`. `scripts/rerent-worker.mjs` is deleted in the existing working tree; deletion is pre-existing and was not made during this continuation.

### Current untracked files/directories

`app/api/internal/scheduler/`, `app/experience.css`, `e2e/auth-token-registration.spec.ts`, `e2e/login-rate-limit.spec.ts`, `e2e/scheduler-test-secret.ts`, `e2e/scheduler.spec.ts`, `lib/daily-task-scheduler.ts`, `lib/login-rate-limit.ts`, `lib/rerent-scheduler.ts`, `lib/scheduler-auth.ts`, `lib/scheduler-runner.ts`, `lib/scheduler-window.ts`, `prisma/migrations/20261001000000_manager_entered_rerent_return/`, `tests/`, and this `PROJECT-HANDOVER.md`.

## Source facts verified for the tier work

- `prisma/schema.prisma` currently defines `MembershipStatus` as `PENDING_APPROVAL`, `DAY_1`, `DAY_2`, `OFFICIAL_MEMBER`; `TaskType` as `DAY_2_MORNING`, `DAY_2_AFTERNOON`, `DAY_3_OFFICIAL`, `RE_RENT`.
- `PlatformSetting` currently stores `welcomeBalance`, `day2ProfitRate`, `day3ProfitRate`, Re-Rent rate/delay, and deposit instructions. It has no tier, task-count, schedule, fixed commission, or profile-points configuration.
- `User` has no points field. `Task` stores `dayNumber`, `profitRate`, `profitAmount`; no tier or commission-base snapshot exists. `Order` stores principal/`amount`, `profit`, `profitRate`, and nullable Re-Rent final return.
- `lib/daily-task-progression.ts`, `lib/daily-task-settlement.ts`, `lib/daily-task-scheduler.ts`, `app/api/user/tasks/daily/route.ts`, manager review, and user/admin/manager views all encode legacy Day progression. Settlement currently calculates task profit from verified order principal using the hardcoded 1.20% / 1.40% rates and credits it through the existing wallet/transaction flow.
- Existing verified daily-task completion is manager-scoped and runs within the caller's Serializable transaction. `creditVerifiedDailyTask` checks task/order/user eligibility, rejects an existing `PROFIT` ledger row referenced by task ID, changes task state, credits wallet, inserts ledger, notification, and audit event, then performs membership progression.
- Manager signup approval in `app/api/manager/signups/route.ts` claims only a `PENDING` signup in a Serializable transaction, uses a `day1-welcome:<userId>` reference for the ₹120 `WELCOME_BONUS`, updates wallet and ledger atomically, and writes audit/notification records. No Admin signup-approval/override write endpoint was found in the inspected `app/api/admin` routes. Owner has approved a separate Admin override with no bonus effect.
- `app/user/profile/page.tsx` renders profile details but not points. `app/api/user/overview/route.ts` supplies the user overview data. `app/api/manager/clients/[id]/route.ts` scopes a manager's client lookup and related records by both client and manager IDs. `AuditLog` supports actor, manager, action, target, amount, and JSON metadata; `Transaction` supports `ADJUSTMENT` and optional reference but no unique idempotency constraint is defined in the schema.
- The user-facing properties API/UI and Admin property management are separate existing flows. Do not add user location/search controls; verify active/Admin-managed property filtering against the current property routes before changing them.
- Existing time progression uses `Asia/Kolkata` in `lib/client-day.ts`. Gold/Diamond/Merchant time-slot rules still need an explicit schedule/timezone interpretation for schedule configuration.
- Existing ₹120 approval copy and ledger/approval logic are tied to Day 1. Keep amount and existing manual payment/withdrawal workflow unchanged while tier wording and approval ownership are decided.

## Earlier proposed implementation and migration plan (superseded by the latest owner decisions below)

> The draft in this section predates the latest owner decisions. It is retained as history only. In particular, do not use the suggested percent-derived commission, do not infer tier assignments from Day states, and do not treat the Admin bonus behavior as undecided.

1. **Resolve behavior before financial writes.** Confirm whether commission means `configured base amount × tier percentage / 100`, which source wins when both a task and property base exist, INR rounding, zero/missing base behavior, and whether the amount is profit credited in addition to principal. Store immutable per-task snapshots of tier, rate, and base so later Admin setting changes cannot alter an assigned task's settlement.
2. **Additive schema phase.** Introduce explicit tier identity and Admin-owned settings for tier rates, task definitions/counts/schedules, and commission bases; add a points balance defaulting to 10; add a uniquely constrained adjustment/idempotency reference and immutable adjustment/audit record design. Keep current enum values/columns and old task/ledger rows intact while rollout is staged. Exact relational shape should be reviewed against finalized Admin configuration UX before migration authoring.
3. **Backfill only after owner-approved mapping.** Inventory every user's signup/membership state, approved timestamps, task type/status/count and assigned order, transaction references, and any existing Merchant-like manual status. Do not rewrite historical tasks or financial ledger entries. Do not infer that `OFFICIAL_MEMBER` means Merchant. A safe proposal is to retain legacy status/history, add an explicit `legacy/unmapped` rollout state or migration marker, and assign new tiers only under an owner-approved rule; release new progression only for explicitly mapped users. A compatibility window is needed so old task records remain readable/reviewable during transition. This is a proposal, not applied migration behavior.
4. **Centralize progression and settlement.** Replace the hard-coded Day progression with one tier policy/progression service called by scheduler, sync, user task submission, and manager review. Preserve conditional state claims and transaction boundaries. Use one canonical settlement service for task completion, wallet increment, ledger reference, notification, and audit log; make each task credit unique by task reference and race-safe. Keep Re-Rent on its existing separate authoritative settlement path.
5. **Admin settings and authorization.** Add Admin-authenticated GET/POST settings for tier rates, base amounts, schedules, and Merchant task count; validate bounds and slot uniqueness server-side and audit every effective change. Never trust UI-only authorization. Keep manager routes scoped by both `managerId` and client ID.
6. **Points and adjustment flow.** Display points beside the profile identity using server-provided user overview data. Manager adjustment must atomically claim an idempotency key, enforce manager-client ownership, update points, and write an audit record; Admin needs a review/oversight surface and audit filters. Before coding, decide adjustment sign/range, whether negative balance is forbidden, duplicate/reversal policy, and whether manager changes need prior approval or only post-action oversight. No points menu.
7. **Admin approval override.** Reuse a single shared approval transaction/claim and the existing user-specific welcome-credit idempotency reference. Admin approval authorization must require the relevant user-management permission and write an Admin actor audit event. Owner must decide whether override approval gives the same ₹120 credit; do not silently omit or duplicate it. Manager approval behavior and ₹120 amount must remain unchanged.
8. **Verification sequence.** Unit tests for policy/schedule/base/rounding and backfill classification; DB integration for role permissions, cross-manager isolation, task concurrency, wallet/ledger equality, points idempotency/audit, welcome-credit idempotency, and historical read compatibility; then focused E2E, TypeScript, Prisma validation, diff check, and build. Diagnose Windows Playwright teardown independently from test assertions; avoid broad repeated E2E runs.
9. **Migration safety.** Draft additive SQL only after policy/schema decisions. Verify defaults/nullability/backfill classification, FK/index/unique behavior, and rollback/expand-contract sequence locally. Preserve all existing ledger entries and task/order IDs. Production migration remains a separately approved operational step; no production DB, Supabase, Vercel, seed, or migration command is authorized here.

### Legacy state inventory (automatic mapping explicitly rejected by owner)

| Current state/data | What code establishes | What it does not establish |
| --- | --- | --- |
| `PENDING_APPROVAL` | Signup not approved; manager approval currently activates it and grants ₹120. | Whether Admin override grants the bonus; which tier is assigned at approval. |
| `DAY_1` | Approved starting membership; no tier enum relation exists. | Whether every such user becomes Gold and when Gold tasks first appear under the new policy. |
| `DAY_2` | Legacy Day 2 progression, potentially with morning/afternoon tasks in any mix/status. | Whether partial completion maps to Gold or Diamond; whether the two old task slots mean the new tier slots. |
| `OFFICIAL_MEMBER` | Both old Day 2 task types were completed and credited according to current flow. | Whether the new tier is Diamond or Merchant; there is no Merchant marker/count/schedule history. |
| Existing task/order/ledger rows | Legacy task status, order links, stored rate/profit, transaction reference, and timestamps are persisted. | They must not be rewritten to mimic new tier semantics without an explicit accounting/history policy. |

Required owner decisions before migration/backfill: mapping for each current membership state (especially partial DAY_2 and OFFICIAL_MEMBER); treatment of users with inconsistent status/task/ledger evidence; whether new users default to Gold; Admin-override welcome-credit behavior; commission base precedence/formula/rounding; Merchant schedule/count semantics; day boundary/timezone; points adjustment limits and approval/reversal/duplicate rules.

## Current phase and next exact task

- **Phase:** discovery and safe design. No tier, points, or Admin override application code/schema changes have been made in this continuation because source does not uniquely decide historical mapping and some monetary/authorization behavior.
- **Next task:** owner review of the unresolved decision list above; then implement the additive schema/settings and migration proposal in small slices, starting with explicit tier/settings/points data shape while preserving legacy columns and rows.
- **Do not** migrate production or remove old enum values until the owner approves the mapping and a staged migration/compatibility strategy.

## Verification status recorded by previous continuation

- Read-only inspection of checkout state, schema, tier progression/settlement, approval flow, profile, scheduler, README and pending local migration SQL completed.
- Previous continuation's `git diff --check` exited successfully but printed Windows LF-to-CRLF working-copy warnings for existing modified tracked files.
- No tests, TypeScript check, Prisma validation, build, Playwright, database command, seed, production/Supabase/Vercel command, deploy, commit, or push was run during this continuation.

---

## Previous owner decisions and verified state (superseded by the latest refinement below)

> The detailed remaining-question list and recommendations in this section reflect the prior owner-decision checkpoint. The final section, “Owner-approved refinements and source verification,” is newer and authoritative. Do not reopen decisions confirmed there.

### Owner decisions now confirmed

- Preserve all existing users' legacy Day statuses and historical records. Do not automatically map any user to Gold, Diamond, or Merchant. Use a future manual assignment flow.
- Gold 20%, Diamond 40%, Merchant 60% are display labels only. Payout accounting must use an Admin-configured fixed commission amount, never these percentages.
- Admin controls Merchant task count and schedule.
- Managers may add/subtract points only for their own clients; every adjustment must be audited; prevent invalid values, cross-manager access, and duplicate submissions. Admin has oversight.
- Only the assigned Manager's normal signup approval issues the ₹120 welcome credit once through existing safeguards. Admin override is a separate approval action and must not issue or duplicate that credit.

### Current source facts and conflicts with the earlier handover draft

- Current Git snapshot remains branch `main`, HEAD `a1dee6ead64b482037096db8b370696e6539b545`. The modified/deleted/untracked file inventory above is the snapshot captured at the start of this continuation. `PROJECT-HANDOVER.md` remains untracked and is the only file changed in this continuation; no application/schema/migration/environment file has been edited.
- `MembershipStatus` remains `PENDING_APPROVAL`, `DAY_1`, `DAY_2`, `OFFICIAL_MEMBER`; `TaskType` remains Day 2 morning/afternoon, Day 3 official, and Re-Rent. The only current untracked migration is the Re-Rent migration above; it adds the settlement transaction enum and nullable `Order.finalReturnAmount`, not tiers/points. No tier assignment/commission/points schema exists.
- Day logic is still in `lib/daily-task-progression.ts`, `lib/daily-task-scheduler.ts`, `lib/daily-task-settlement.ts`, `app/api/user/tasks/daily/route.ts`, `app/api/manager/tasks/[id]/review/route.ts`, `app/api/admin/tasks/route.ts`, manager/admin sync routes, and the user/manager/Admin task, client, overview, settings, revenue and dashboard views. UI also renders `OFFICIAL_MEMBER` as “Diamond Official”; that text is not a stored tier and must not drive assignment.
- `lib/daily-task-settlement.ts` still pays `verified order.amount × 1.20% or 1.40%`, rounds half-up to two decimal places, and writes wallet plus `PROFIT` transaction. This is incompatible with the approved new fixed-amount policy for future tier tasks. Do not alter old ledger entries; replace payout behavior only after commission unit and pay event are decided.
- `User` has no points balance. Existing `TransactionType.ADJUSTMENT` is used for monetary rent debit; it has no unique-reference constraint suitable for point adjustment idempotency. `AuditLog` can record actor/target/amount/metadata, but no points write route or oversight UI exists.
- `app/api/manager/signups/route.ts` is the only inspected approval write path: Manager-only, manager-scoped pending claim, Serializable transaction, `DAY_1` assignment, wallet increment ₹120 and `WELCOME_BONUS` transaction reference `day1-welcome:<userId>`, plus audit/notification. Inspected Admin client endpoints are read-only; no Admin approval override endpoint exists. An Admin-approved account will no longer satisfy the Manager route's PENDING precondition, so it will not receive the Manager bonus later; whether this is intended follows from the approved separation but should be confirmed operationally.
- No `.env` contents were accessed or printed. No database, seed, Prisma, production, Supabase, Vercel, deployment, commit, or push command was run. Production state remains unverified.

The earlier proposed plan above is superseded where it suggests using tier percentages in a formula, asks whether an Admin override issues the welcome bonus, or treats historical tier mapping as open. The latest decisions govern.

### Remaining decisions (no financial or historical behavior should be implemented before these are answered)

1. Fixed commission unit and earning event: per task, property, or completed order? For example, if the fixed amount is ₹50 and an order has two tasks, is the user's total ₹50 or ₹100? Is it payable at each manager-approved task completion or only once at order completion? Recommended default for owner approval: per task definition, snapshot the fixed amount on assignment, credit once on that task's existing manager approval/completion.
2. Fixed amount validation: allow paise or whole rupees only? Is zero valid? Recommended default: Decimal(18,2), accept at most two fractional digits without rounding, reject negative amount; separately choose whether zero is allowed.
3. Tier assignment: who may manually assign/change it, when it becomes effective, new-user default, and treatment of open/submitted/rejected Day tasks. Recommended default: Admin with `MANAGE_USERS`, prospective change, no edits to existing tasks/orders/ledger; leave old tasks on a legacy review path and start tier scheduling only after an explicit transition point.
4. Task schedule: exact times, timezone, recurrence, and missed-slot behavior. Existing `lib/client-day.ts` uses Asia/Kolkata; confirm whether tier scheduling should use that timezone. Merchant count and schedule remain Admin-configured as approved.
5. Points: maximum adjustment/balance, integer vs fractional, zero/negative resulting balance, reason requirements, duplicate-key lifetime, correction/reversal policy, and whether Admin oversight is read-only audit viewing or pre-approval. Recommended default for approval: integer deltas, nonzero, no negative resulting balance, idempotency key per submission, atomic balance+audit with actor/client/delta/before-after/reason/reference, Admin read-only oversight unless preapproval is explicitly requested.
6. Admin override: its no-bonus behavior is approved. Confirm whether preventing a later Manager bonus after Admin override is intended, or whether there should be a distinct Manager-only bonus action. Do not make Admin override call the bonus path.

### Incremental plan (not yet implemented)

1. After the decisions, add tier assignment/configuration, task schedule/count, fixed commission snapshot, points balance, and unique point-adjustment idempotency data additively. Preserve all legacy enums and rows; do not backfill any tier.
2. Add Admin-authorized configuration and manual assignment with audit. Percent values are presentation labels only. Snapshot a fixed amount and tier/task identity when a new task is assigned.
3. Add a separate Admin-audited signup override with no wallet/ledger side effect. Leave the Manager approval's existing ₹120 transaction/reference safeguard as the only bonus path.
4. Implement a single tier progression/task eligibility service and route scheduler, sync, user submission, and manager review through it. Keep the old task review path for historical Day tasks until explicitly resolved.
5. Implement points adjustment with server-side manager/client ownership, bounds, duplicate protection, and atomic audit logging; expose Admin oversight and show balance beside profile (no points menu).
6. Add focused tests for Admin/Manager/User roles, cross-manager denial, duplicate/concurrent point changes, fixed commission independent of labels, wallet/ledger invariants, one-time Manager bonus, no Admin bonus, manual assignment preserving history, and legacy task review compatibility. Then run focused tests, Prisma validate, TypeScript, diff check, build, and only targeted Playwright if the local environment supports clean teardown.
7. Draft/apply migrations locally only after decisions, on a test DB. Production migration/configuration needs separate authorization.

### Exact next task and current verification

- Phase: read-only verification/design complete; implementation is paused at owner decisions above. No app/business/schema change was made in this continuation.
- Next task: confirm commission unit/pay event/precision; assignment authority/default/effective time and open legacy task behavior; exact schedule/timezone/missed-slot rules; points limits/oversight/reversals; and whether a separate Manager bonus action is wanted after Admin override.
- After the latest handover update, `git diff --check` exited 0; it printed Windows LF-to-CRLF working-copy warnings for pre-existing modified files. A separate trailing-whitespace check on this untracked handover also found no trailing whitespace. No tests, TypeScript, Prisma validation, build, Playwright, DB command, seed, production/Supabase/Vercel access, deploy, commit, or push was run in this continuation.

---

## Owner-approved refinements and source verification (2026-10-02)

This section is the newest authority and supersedes earlier unresolved questions where the owner has now decided the behavior.

### Decisions confirmed on 2026-10-02

- Admin sets a fixed commission separately for each **property + task** pairing.
- That fixed commission becomes payable when the assigned Manager approves that eligible task.
- Only Admin may assign or change Gold, Diamond, or Merchant. Manager must not change tiers.
- Points are whole numbers. A negative total points balance is allowed. Default profile display is 10 Points. Managers may add/subtract only for their own clients; adjustments are audited, duplicates handled safely, and Admin has oversight.
- 20% / 40% / 60% remain display labels and never enter payout math. Legacy ledger entries and historical tasks/orders remain unmodified.

These decisions resolve earlier questions about commission unit, payout event, tier-assignment role, integer points, and negative balance. Do not ask the owner to decide those again.

### Latest checkout facts re-verified

- At this inspection the branch/HEAD remained `main` / `a1dee6ead64b482037096db8b370696e6539b545`. `git status --short --untracked-files=all` showed the existing modified/untracked inventory already listed above; no other file status changed during this continuation. `PROJECT-HANDOVER.md` is untracked and is the **only** file edited in this continuation.
- `prisma/schema.prisma`: `Task` points to optional `Order`; `Order` points to `Property`, so a task's property is currently reached through `Task.order.property`. `Property.price`, `Order.amount`, and legacy `Task.profitRate` are not fixed commission values. No property-task commission relation, commission snapshot, tier field, points field, or points-adjustment model exists.
- `Task.profitAmount` is an existing Decimal(18,2) result field. `lib/daily-task-settlement.ts` currently loads a verified legacy task, validates ownership/eligibility, computes order principal × 1.20% or 1.40%, conditionally moves task VERIFIED→COMPLETED, increments `Wallet.balance`, inserts a `PROFIT` Transaction using `reference: task.id`, and writes notification/audit in its caller's transaction. Thus current commission logic conflicts with approved fixed commission; the 20/40/60 labels must not be passed into this calculation.
- `app/api/manager/tasks/[id]/review/route.ts` requires a Manager session and scopes task/user/order to that Manager. For daily tasks it uses a Serializable transaction, conditionally changes SUBMITTED→VERIFIED, then calls `creditVerifiedDailyTask` before commit; the same transaction handles completion and wallet/ledger/audit. Serialization conflicts retry up to three attempts. Re-Rent uses its separate `settleReRentTask` path.
- Duplicate protection today is a `findFirst` for `PROFIT` with task reference plus the conditional task status update/Serializable transaction. `Transaction.reference` has no unique DB constraint in current schema. A new fixed-commission path should add a database-enforced unique settlement identity rather than relying only on application pre-checks; preserve old transaction rows.
- `Property` has no task definitions; `TaskType` is a fixed enum and `Task` carries no property ID directly. A per-property/per-task configuration therefore needs an additive task-definition/config model (or equivalent unique property+task key) and a fixed amount snapshot on each newly assigned task. Existing `orderId` linkage alone cannot store/freeze that amount.
- Points do not exist in Prisma or application routes. `Wallet.balance`/`reservedBalance` are Decimal(18,2) monetary values. `TransactionType.ADJUSTMENT` is already used for INR rent debits and has `balanceBefore`/`balanceAfter`; it must not represent points. A separate integer points balance and points-adjustment identity/audit record keeps negative points isolated from wallet, rent, and monetary ledger invariants.
- `AuditLog` supports actor role/id, managerId, action, target, Decimal amount, JSON metadata, and timestamps, but has no idempotency uniqueness constraint. Existing `requireAdminAuth` supports capabilities such as `MANAGE_USERS`, `MANAGE_PROPERTIES`, `MANAGE_TASKS`, and `MANAGE_PLATFORM_SETTINGS`; an Admin-only tier-write endpoint must call it server-side. `app/api/admin/clients` currently provides read-only client listing/detail and no tier mutation.
- `app/api/manager/signups/route.ts` remains the only inspected signup write path. It grants ₹120 only on the Manager's conditional pending approval; the wallet increment, `WELCOME_BONUS` transaction reference and audit are in one Serializable transaction. Admin override does not exist yet and must be a separate, no-credit action per owner decision.
- Migration inventory remains unchanged: the untracked `20261001000000_manager_entered_rerent_return` SQL adds only the Re-Rent settlement enum and nullable `Order.finalReturnAmount`; there is no tier/points/commission migration, and no existing migration was edited.
- Relevant current test inventory includes scheduler/Re-Rent unit tests and task/scheduler E2E. There are no points, tier assignment, fixed commission, or Admin override tests. Prior-session test results in the earlier section were not rerun during this read-only continuation.

### Remaining ambiguities only; recommendations are not approvals

1. **Fixed amount precision and allowed range:** Can amounts include paise? Is zero commission valid? What is the business maximum? Example: entering `₹125.567` could be rejected or rounded; no rule is encoded. Recommendation for approval: store as INR `Decimal(18,2)`, accept at most two fractional digits and reject excess precision (do not silently round); reject negative amounts; choose an explicit configurable maximum and decide whether zero is allowed.
2. **When per-property/task configuration is frozen:** If Admin changes a property/task commission from ₹50 to ₹75 after a task is assigned but before the Manager approves it, which amount applies? Recommendation for approval: snapshot amount and config version at task assignment; later changes affect only newly assigned tasks. Never rewrite existing task/ledger history.
3. **Rejection, re-approval, reversal, concurrency:** Rejected then resubmitted task? Manager clicks approve twice concurrently? Approved commission later needs reversal? Recommendation: rejection pays nothing; task-id has one unique settlement row, duplicate/concurrent approval returns already processed and cannot credit again; a legitimate reversal is a separate compensating ledger/audit record, never editing/deleting the original. Confirm reversal authority/reason requirements.
4. **Points bounds, zero delta, idempotency and Admin boundary:** Whole integers and negative totals are approved, but maximum adjustment/total, zero adjustment, reason requirements, and idempotency key lifecycle are not. Recommendation: reject zero delta as a no-op; impose a business-level per-request limit to avoid accidental large changes; use a unique request key and return the first result for the same key+payload while rejecting key reuse with a different payload. Managers may write only their own clients; Admin oversight is read-only audit unless owner says Admin may also adjust points. Use separate points data/audit, never Wallet or INR Transaction.
5. **Manual assignment workflow and existing open Day tasks:** Admin-only tier changes are approved, but initial UI/default tier/effective time and open SUBMITTED/REJECTED/IN_PROGRESS legacy task behavior are not. Recommendation: a dedicated Admin client-detail action protected by `MANAGE_USERS`; store tier separately from legacy `membershipStatus`; assignment is prospective, leaves all Day task/order/ledger rows and states intact, and does not auto-map anyone. Keep legacy tasks on the legacy review path; begin tier tasks only after assignment's explicit effective timestamp.
6. **Task schedule details:** The task time labels and Admin-controlled Merchant count/schedule are approved, but exact slot times, timezone, recurrence and missed-slot policy are not. Recommendation: use the existing `Asia/Kolkata` day boundary only if owner confirms; otherwise make timezone/time explicit in Admin settings.
7. **Default 10 points on existing users:** A new `User.points Int @default(10)` column would initialize existing rows to 10 when migration is applied, as well as default new users. The profile default is approved, but whether this should apply to all existing accounts or only newly created accounts should be confirmed before migration. Recommended default: backfill all current accounts to 10 only if that is the intended meaning of “default profile display is 10 Points.”

### Incremental additive plan and focused tests (not implemented)

1. **Schema/migration:** Add a separate Tier enum/nullable `User.tier` and assignment timestamp/actor metadata (or an assignment history table); retain `MembershipStatus` and all Day task enums. Add a task definition/config keyed uniquely by property+task, including display label/schedule and fixed commission `Decimal(18,2)`. Add nullable task commission snapshot/config reference for new tier tasks; do not backfill old tasks. Add points integer storage (migration default behavior needs the decision above) and a `PointsAdjustment` record with unique idempotency key, actor/manager/client, signed integer delta, before/after, reason and timestamps. Write matching `AuditLog` inside the same transaction.
2. **Admin controls:** Property/task commission configuration requires Admin server-side permission (`MANAGE_PROPERTIES` and/or `MANAGE_TASKS`, choose explicitly); tier assignment requires Admin `MANAGE_USERS`. Validate fixed amount precision/range and schedule on the server. Manager routes must never accept tier writes.
3. **Approval/accounting:** Add one new fixed-commission settlement effect to the existing Manager task approval transaction for eligible new tier tasks. Freeze commission when the task is assigned, pay exactly once on that task's Manager approval, and keep percentages display-only. Use a unique task-scoped settlement reference/constraint; leave historical Day settlement behavior available for old tasks without altering ledger rows. The Admin signup override is separately audited and performs no ₹120 wallet/ledger mutation.
4. **Points:** Manager endpoint scopes client by both client ID and authenticated manager ID; validate integer delta/limits server-side; atomically claim unique idempotency key, update only points, and record adjustment plus audit. Admin oversight reads those records. Show the balance beside profile details, not in a separate menu.
5. **Focused verification:** authorization matrix (Admin can assign/change tier; Manager cannot; Manager A cannot read/change Manager B's client); commission amount is property+task-specific and never derived from tier percentages; config edit does not change a frozen pending task; rejection pays zero; approved task gets one amount; duplicate/concurrent approval credits once; reversal is compensating only; points accept negatives but reject fractional/invalid/out-of-bound changes and duplicate requests do not repeat; points do not alter wallet or INR transactions; default points migration behavior and legacy records are verified; Manager ₹120 approval credits exactly once and Admin override credits zero.
6. Run focused DB-backed tests only after a local test DB is explicitly confirmed; then Prisma validation, TypeScript, diff check and build. No production migration/config/deploy is included.

### Exact next task and checks for this continuation

- Next task: obtain decisions for precision/range/zero fixed commission; snapshot timing; approval reversal policy; points limits/zero/reason/key lifecycle/Admin permission; manual assignment effective-time/open legacy task workflow; schedule time rules; and whether existing users receive the 10-point default in the additive migration.
- This continuation only inspected source and updated this handover. `git status`, branch/HEAD, targeted source searches/reads, and migration inspection were run. `git diff --check` exited 0 (with existing LF-to-CRLF warnings); the untracked handover's separate trailing-whitespace check was clean. No tests, build, TypeScript, Prisma validation, database command, seed, production/Supabase/Vercel access, deployment, commit, or push was run.

---

## Implementation-ready design checkpoint (owner decisions confirmed; 2026-10-02)

This is the newest design section. The commission scope/trigger, Admin-only tier authority, whole-number points and permission for negative totals are already approved and must not be reopened. Earlier sections' open-question lists are historical; use the unresolved list in this final section only.

### Current source behavior rechecked for this design

- `prisma/schema.prisma`: `Property` has `price` but no commission; `Task` has `orderId?` and relates to `Order`, which has `propertyId` and relates to `Property`. Thus task property is indirect (`task.order.property`). `TaskType` is a fixed enum. `Task` has `dayNumber`, legacy `profitRate` and `profitAmount Decimal(18,2)`, but no tier, definition, commission amount, commission snapshot or settlement relation. `User` has only legacy `membershipStatus`; no tier or points. `Transaction.reference` is nullable and has no unique constraint.
- `lib/daily-task-settlement.ts`: daily settlement only accepts legacy Day task types in `VERIFIED` state, checks user/manager/order eligibility, and computes principal × 1.20% or 1.40%, rounded half-up to 2 decimals. It conditionally updates VERIFIED→COMPLETED, increments `Wallet.balance`, creates `PROFIT` transaction with task ID as reference, notification and audit. This is the legacy path; never route new tier tasks through its percentage calculation. Do not rewrite any existing ledger entry.
- `app/api/manager/tasks/[id]/review/route.ts`: authenticated Manager and task/order/user are manager-scoped. Daily approval runs in one Serializable transaction, conditionally changes SUBMITTED→VERIFIED, then calls the settlement helper which completes the task and records wallet/ledger/audit. P2034 retries are limited to three attempts. Already-COMPLETED approval returns already processed. Re-Rent branches to the independent `settleReRentTask` path and must remain separate.
- `app/api/user/tasks/route.ts` permits eligible Re-Rent REJECTED tasks to be resubmitted through a conditional status update. Daily-task submission has its own route. `TaskStatus` has no CANCELLED value. A Manager can cancel an Order in `app/api/manager/orders/route.ts`; that route updates the order and audit/notification, but does not reverse a prior task payout. Commission reversal therefore has no existing implementation.
- `lib/daily-task-progression.ts` and `lib/daily-task-scheduler.ts` still generate Day tasks based on `membershipStatus` and `getClientDayEligibilityCutoff`; `lib/client-day.ts` computes day boundaries in `Asia/Kolkata`. These are the old rules only. They do not define approved Gold/Diamond slot times, cadence or missed-slot behavior.
- Admin tier write boundary can use `requireAdminAuth(AdminPermission.MANAGE_USERS)` from `lib/admin-auth.ts`; the existing Admin client detail is read-only (`app/api/admin/clients/[id]/route.ts`, `app/admin/clients/[id]/page.tsx`). Manager client detail is scoped by both client ID and session manager ID. Managers must never receive a tier mutation path.
- Current Admin signup client read routes have no approval write action. The Manager-only `app/api/manager/signups/route.ts` uses a Serializable transaction, conditional PENDING claim, sets signup APPROVED/status ACTIVE/approvedAt and legacy DAY_1, then credits ₹120 and inserts `WELCOME_BONUS` at `day1-welcome:<userId>` with audit/notification. All are atomic in that transaction. On competing approval, conditional claim/serialization prevents two committed bonus transactions; route does not have an explicit P2034 retry and may return an error for the losing concurrent request, but it cannot commit a second transaction through the same atomic state claim.
- Profile currently reads `/api/user/overview` and shows account/profile fields in `app/user/profile/page.tsx`; neither API nor UI includes points. `Wallet.balance` and `.reservedBalance` are Decimal(18,2). `TransactionType.ADJUSTMENT` is currently an INR rent debit. Do not use either for points. `AuditLog` has actor/manager/action/target/amount/JSON metadata but no idempotency uniqueness.
- Existing migrations contain no tier/points/commission change. Current untracked Re-Rent migration only adds `RERENT_SETTLEMENT` and nullable `Order.finalReturnAmount`. No DB was queried during this design inspection.

### Proposed technical design — recommendations, not additional owner approvals

#### Fixed commission

- Add an Admin-managed task definition (tier, stable key/title, active flag, slot/schedule metadata, ordering) and a property-task commission configuration with a unique `(propertyId, taskDefinitionId)` key and fixed INR `Decimal(18,2)` amount. Add a new enum value such as `TIER_TASK` additively and link its tasks to the definition; keep all existing Day/Re-Rent TaskType values unchanged. This expresses the approved “each property and task separately” scope; do not use `Property.price`, `Order.amount`, or tier percentage as commission.
- Add nullable `Task.taskDefinitionId` and `Task.commissionAmountSnapshot Decimal(18,2)?` (optionally configuration version/id). At the same time as creating/assigning a new tier task, read the active property+task configuration and copy its amount/version to that task in the same transaction. That is the recommended freeze point: later Admin config edits affect only subsequently assigned tasks, never an assigned or started task. If no config exists, do not create an eligible payable task; report a configuration error.
- A new fixed-settlement service should be called only for new tier-defined tasks from the assigned Manager's approval transaction. It should validate the frozen snapshot and current task/order/user/manager eligibility, make the task completion claim, increment wallet, write exactly one monetary `PROFIT` transaction for the fixed amount, and create settlement/audit/notification records atomically. Tier labels may be included in metadata/display only; no `rate × principal` calculation.
- Preserve the existing legacy Day branch and its existing ledger history. No backfill of `commissionAmountSnapshot`, no rewriting of completed Day tasks, and no recalculation of prior `Transaction` rows. Existing open Day tasks remain tagged/recognized as legacy and continue through the existing Day review/settlement path unless the owner decides otherwise; new tier tasks use only the fixed path.
- For a database-enforced idempotency boundary without imposing a new unique constraint on historical `Transaction.reference` values, add an auxiliary `TaskCommissionSettlement` (or equivalent) with unique `taskId`, unique linked `transactionId`, amount and timestamp. Create this record and the `PROFIT` ledger row in the same DB transaction as task completion and wallet increment. Keep `PROFIT` transaction as the wallet ledger of record; settlement row is its task-scoped exactly-once claim. On P2002/P2034, roll back all payout effects, read the committed settlement and return already-processed only if it matches this task; otherwise propagate the error. Keep the existing bounded serialization retry behavior; do not blindly retry non-conflict errors.
- Rejection or order cancellation before Manager approval pays no commission. User resubmission of a rejected task does not create a payout; the eventual successful approval pays once. A concurrent/double approval can commit at most one payout because of the conditional task claim, unique settlement `taskId`, and atomic transaction. Re-approval after successful completion returns already-processed. After a paid commission, order cancellation must not mutate/delete the original ledger entry; any reversal must be a separate compensating ledger/audit event after an authorized, reasoned reversal action. Reversal authority/reason policy is unresolved below.

#### Tiers, assignment, schedules, and legacy tasks

- Keep `MembershipStatus` and its Day values untouched. Add a separate nullable `User.tier` (Gold/Diamond/Merchant) and assignment timestamp/actor, preferably with an append-only `UserTierAssignment` history row storing old/new tier, Admin actor, effective timestamp and reason. No migration backfill; no inferred tier from `DAY_1`, `DAY_2` or `OFFICIAL_MEMBER`.
- Add Admin client-detail assignment UI and a server mutation route protected by `requireAdminAuth(MANAGE_USERS)`, same-origin validation, allowed-tier validation and one transaction that updates current tier plus assignment/audit history. Do not add a Manager write route; Manager views may display assigned tier read-only. Assignment history should distinguish assign/change/unassign. Whether unassign is allowed remains unresolved.
- Preserve pre-existing Day tasks as legacy and continue to display/review them via the existing route. Recommended behavior: assignment is prospective; do not change existing task/order/ledger rows. After assignment, stop generating additional Day tasks for that user by excluding tier-assigned users in every legacy progression entry point (scheduler and manual sync/progression helper), but keep already-existing Day tasks eligible under the legacy manager review service. Freeze the legacy membership state after assignment rather than letting legacy completion overwrite or infer the new tier. New tier tasks require a verified active booking and explicit assignment. This is a rollout design requiring test coverage.
- Store configurable task definitions/slot data relationally rather than relying on fixed `TaskType` values, because Merchant task count is Admin-configured. Gold definitions include morning/evening; Diamond morning/afternoon; Merchant definitions/count and schedule come from Admin settings. Each definition can contain local slot time, timezone, active flag and recurrence; each new `TIER_TASK` references its definition snapshot. User task-list/submission and Admin/Manager task views must recognize this new type while retaining their legacy Day/Re-Rent branches.
- `Asia/Kolkata` is verified only as the current old client-day boundary. Do not assume it defines new tier schedules. Exact clock times, timezone, daily/weekly recurrence, daylight/time-change behavior, and missed-slot catch-up/expiry are still needed for implementation. Scheduler may reuse bounded/stateless architecture, but candidate eligibility must be tier/schedule-based and not advance legacy membership.

#### Points

- Add `User.points Int @default(10)` as a separate signed integer, plus append-only `PointsAdjustment` containing user, manager, actor, signed integer delta, before/after points, reason, unique idempotency key and timestamp. Store points in no wallet or INR transaction fields. Also create `AuditLog` action `USER_POINTS_ADJUSTED` in the same transaction with actor, target, manager, delta and before/after/reason/request ID metadata.
- Add a Manager-only adjustment API: authenticate Manager; query client with `id` and `managerId=session.managerId`; validate integer delta/range/reason/idempotency key; use Serializable transaction or compare-and-swap to atomically update signed `User.points`, insert adjustment and audit; negative final balance is allowed. Never trust client-supplied actor/manager IDs. A unique `(managerId, idempotencyKey)` makes retries safe: same key+payload returns the stored result; same key with different payload returns 409. Reject zero delta as a recommended no-op. Admin oversight should be a read-only adjustment/audit view protected by `VIEW_AUDIT` unless owner explicitly authorizes Admin edits.
- Expose `points` in authenticated user overview and display “10 Points”/current balance beside profile identity in the existing Profile UI, with no points menu. Migration default 10 would populate all existing users as well as new users; owner’s default display requirement supports this recommendation, but whether migration should initialize existing balances to 10 is still a decision.
- Use Prisma `Int` only with explicit application bounds: PostgreSQL/Prisma 32-bit signed integer is finite even though negative totals are allowed. Set a separate per-adjustment magnitude bound to prevent accidental huge changes; no nonnegative-balance check.

#### Admin signup override

- Add a separate Admin action, recommended route `POST /api/admin/clients/[id]/signup-override`, protected by `requireAdminAuth(MANAGE_USERS)` and same-origin check. It must not call/import/reuse the Manager bonus-credit effect. In one Serializable transaction conditionally claim only `signupStatus=PENDING` and set `signupStatus=APPROVED`, `status=ACTIVE`, `approvedAt`; leave tier unset and do not alter wallet or create any `WELCOME_BONUS`/`Transaction`.
- Write an Admin actor `AuditLog` entry such as `USER_SIGNUP_APPROVAL_OVERRIDDEN`, target USER, managerId, prior/new signup/account state and explicit `welcomeBonusIssued:false`; create an approval notification if consistent with current UX. A unique override/action record or request key may be used for replay response, but the state claim must be the authoritative one-time transition. Retried completed request returns already-processed without new side effects; concurrent Admin/Manager decisions contend on the same PENDING claim, so only one transition commits.
- If Admin override wins, the Manager endpoint's existing PENDING-only precondition prevents later ₹120 credit. That matches the approved separate-action/no-automatic-bonus rule; do not add a delayed/implicit bonus action. Preserve the current Manager approval code and ₹120 reference path unless a focused test proves a defect.

### Remaining owner decisions only (examples + recommended defaults)

1. **Commission range/zero:** Is `₹0.00` a valid configured amount, and what maximum is safe? Example `₹125.567` exceeds two paise decimals. Recommended default: INR `Decimal(18,2)`, accept 0–2 fractional digits without rounding, reject negative/excess precision; require amount >0 for active payable config and allow null/disabled config to mean not assignable; define a business-level max below the database precision limit.
2. **Freeze timing:** Recommendation is assignment time as above. Confirm that Admin changing ₹50→₹75 after assignment leaves the existing task payable at ₹50 and applies ₹75 only to future assignments.
3. **Legacy pending Day tasks:** Confirm that open legacy tasks continue through the existing 1.20/1.40 settlement path when approved after tier assignment, while new tier tasks use fixed commission. Recommended default: yes, because changing those rows' payout semantics silently would break the legacy contract; gate future legacy task generation, not review of existing tasks.
4. **Paid reversal policy:** Who can reverse an already-paid task commission, required reason/approval, and whether only Admin or Manager+Admin may do so? Recommended default: no self-service reversal; Admin-only permissioned compensating ledger/audit entry; original transaction immutable; reversal idempotent and linked to original settlement.
5. **Amount max and points adjustment limits:** Choose max fixed commission and absolute points delta per request. Example point delta `+1,000,000` could be valid integer but accidental; recommendation: explicit configurable/constant cap approved by owner and reject above it. Points total can still be negative.
6. **Points zero/retry details:** Confirm zero delta rejected (recommended) and reason required. Recommended idempotency: UUID generated once in UI, unique per Manager; retry same payload returns original adjustment, key reuse with altered client/delta returns 409. Define how long request keys are retained; append-only record suggests indefinitely.
7. **Admin points and tier removal:** Confirm Admin oversight is read-only (recommended) and whether Admin may clear/unassign a tier. Do not expose either write until confirmed.
8. **Schedule:** Specify timezone, exact clock times, recurrence, and missed-slot behavior. Recommendation: explicit IANA timezone and slot times in Admin settings; only reuse Asia/Kolkata if owner confirms.
9. **Default points for existing users:** Confirm whether the additive migration initializes every existing user to 10, not just users created after migration. Recommended default: set all to 10 in additive column default, with no wallet/ledger effect.

### Migration, compatibility, and focused verification plan (recommendation)

1. Add new models/nullable links and signed points column plus the additive `TIER_TASK` enum value; leave legacy status/task enum values and old task/order/ledger rows intact. Do not backfill tier or commission snapshot. If existing-user 10-point initialization is approved, use a schema default/backfill with an explicit verification query on the local test DB only.
2. Add property-task config/definition and immutable task commission snapshot; add unique task-scoped settlement claim and points idempotency key. Audit existing data for any unique-index collision before adding constraints; do not add uniqueness on all legacy `Transaction.reference` values.
3. Keep new tier task settlement isolated from `creditVerifiedDailyTask`; legacy rows use legacy behavior, new tier tasks only use frozen fixed amount. Keep Re-Rent settlement service separate.
4. Add Admin settings/assignment/override APIs with capability checks; Manager points API with manager-client scoping; profile points read/display and Admin read-only oversight.
5. Focused tests: (a) property+task config resolution, precision/range, snapshot unchanged after config edit; (b) new-tier payout exactly fixed amount and independent of 20/40/60, atomic wallet/ledger/task/settlement; (c) legacy Day prior ledger unchanged and pending legacy task remains reviewable under chosen legacy rule; (d) reject/resubmit, duplicate, parallel approval, canceled order, and compensating reversal semantics; (e) Admin-only tier assignment, Manager forbidden; no automatic mapping and old tasks preserved; (f) schedule/count per tier and due-window behavior; (g) integer points incl negative totals, bounds, zero rejection, same-key replay/different-payload conflict/concurrent deltas, cross-manager denial, audit consistency and unchanged wallet; (h) Manager ₹120 once and Admin override no credit under retry/concurrency.
6. Only after decisions and implementation, run focused local tests first; then Prisma validate, TypeScript, `git diff --check`, build, and targeted E2E if environment permits. No production database or external platform operation is part of this plan.

### Next exact implementation task and current checks

- **Next task:** approve/decide commission precision/range/zero; assignment-time snapshot; pending legacy Day payout rule; reversal authority; points request limits/zero/reason/idempotency, Admin read-only scope, and existing-user default=10; specify new schedule timezone/times/recurrence/missed slot; decide tier unassignment. Then implement the additive schema/migration first, followed by shared commission definition/config API and snapshot assignment.
- This phase re-read handover, actual Git status/branch/HEAD, Prisma schema/migration SQL, task settlement/review and retry paths, Manager signup approval, Admin auth/permissions and client views/routes, user profile/overview, progression scheduler/timezone, cancellation/resubmission paths, and test inventory. No application/schema/migration/test files were edited. Only `PROJECT-HANDOVER.md` was updated. No tests/build/TypeScript/Prisma/database commands, secrets, production/Supabase/Vercel actions, deploy, commit or push occurred. Run final document whitespace and `git diff --check` now.

---

## Transition decision sheet — blockers vs safe implementation defaults (2026-10-02)

This section is the current decision sheet. The enumerated open questions above are reorganized here: settled owner rules stay settled; only the blocking answers below are needed before schema or application implementation. Recommendations are defaults, not owner approval. No code/schema/migration changes are authorized by this design checkpoint.

### Blocking owner decisions

These choices affect payable money, legacy payout semantics, or which tasks/users qualify. Please answer all in one reply; “use recommended defaults” can be used for any item.

1. **Commission amount policy.** Is a configured `₹0.00` allowed for an active property/task, and what is the maximum payable fixed commission? Example: should `₹0.00` create an eligible task whose approval pays zero, or should that configuration prevent assignment? Recommended default: require a positive amount for an active payable configuration; choose a business maximum below the `Decimal(18,2)` storage limit. Precision can use the safe technical default below.
2. **Snapshot timing.** Confirm the fixed amount/config version is frozen when a task is assigned. Example: if commission changes from ₹50 to ₹75 after assignment but before approval, existing task pays ₹50 and only later assignments use ₹75. Recommended default: yes; no existing task or ledger is rewritten.
3. **Open legacy Day tasks after tier assignment.** Should already-existing Day tasks remain reviewable and, if approved, retain their existing 1.20%/1.40% payout behavior? Recommended default: yes, because they were created under that accounting rule; assignment should stop creating new legacy Day tasks but must not silently convert or invalidate open records. New tier tasks use fixed commission only. This does not authorize the legacy percentage formula for new tasks.
4. **Cancellation and paid reversal.** For an unpaid tier task whose order is canceled before Manager approval, confirm it becomes ineligible and pays nothing. For a commission already paid before a later cancellation/correction, who may reverse it, and what reason/approval is required? Recommended default: canceled-before-approval means no payout; no automatic reversal; Admin-only explicit reversal with a reason, idempotent compensating ledger entry, and immutable original transaction.
5. **Tier assignment effective behavior.** Confirm assignment is prospective: preserve all existing Day task states for review as in item 3, stop further Day generation for that user, and start tier scheduling only after Admin explicitly assigns a tier. Recommended default: yes. No default tier and no inferred mapping. Admin may change among Gold/Diamond/Merchant; unassignment is disabled initially and can be added later if needed.
6. **New-tier schedule that controls task eligibility.** Specify timezone, exact Gold morning/evening and Diamond morning/afternoon times, Merchant schedule/count semantics, recurrence, and what happens to missed slots. Example: daily local-time slots expire at day end versus remain eligible until completed. Recommended default: store explicit IANA timezone and local slot times; do not assume the existing `Asia/Kolkata` boundary is the new schedule; do not catch up missed slots unless explicitly configured. Exact schedule is required before task generation can be implemented.

### Safe reversible defaults (no further owner decision needed to start design/implementation)

- **Money representation/validation:** store INR fixed commission as `Decimal(18,2)`; accept at most two fractional digits, reject negatives and excess precision rather than rounding. The owner must still set the business maximum and decide whether zero is eligible under blocker 1.
- **Idempotency/atomicity:** use one Serializable task-approval transaction and a unique task-scoped settlement record; conditionally claim the submitted task; update wallet, ledger, settlement, audit and notification atomically. Retry only serialization conflicts a bounded number of times. Duplicate/retry returns the existing result and never pays twice. Do not impose a new global unique constraint on historical `Transaction.reference` values.
- **Task review lifecycle:** rejected tasks pay nothing; resubmission can be reviewed normally; only one successful Manager approval pays once. Concurrent approvals contend on the conditional state claim and unique settlement. No second payout on re-review.
- **Points:** keep a signed integer balance and append-only adjustment records/audit separate from Wallet and INR `Transaction`. Negative totals remain valid. Reject zero delta as a no-op, require a reason, use a per-manager idempotency UUID retained with the append-only record; same key and payload replays the original result, altered payload with the same key conflicts. Apply a documented per-request magnitude limit and signed-Int overflow check, without imposing a nonnegative-balance rule. Admin oversight is read-only initially; Manager writes require `clientId + authenticated managerId` scoping.
- **Existing users' points:** initialize the newly introduced points field to 10 for both existing and new users, matching the approved default profile display; this is points-only and does not touch wallet or ledger history.
- **Tier/assignment authorization:** nullable explicit tier separate from `membershipStatus`; Admin `MANAGE_USERS` server authorization for assignment/change; append-only actor/reason/time history and audit in the same transaction. No automatic backfill. Only the three approved tiers are assignable; no unassignment action in the first slice.
- **Admin signup override:** separate Admin `MANAGE_USERS` transition that conditionally claims only PENDING approval; never invokes the Manager welcome-credit path or changes wallet/ledger. Record Admin actor and `welcomeBonusIssued:false`. Manager approval remains the sole ₹120 bonus trigger; concurrent approvals allow only one PENDING transition.
- **Task configuration:** model Admin-configured task definitions and per-property/task commission with a unique property+task key; Merchant count/schedule is represented by its configured task definitions. No commission is inferred from property price, rent, tier percentage, or legacy rate.

### Exact next task and dependencies

1. Resolve blockers 1–6 above in one owner response. Until then, do not author the schema/migration or change task eligibility/payout behavior.
2. After approval, implement the additive schema and forward migration first: separate nullable tier/assignment history, task definitions and property/task commission configuration, new tier-task discriminator and nullable immutable commission snapshot, unique task settlement record, and points/adjustment history. Preserve all old enum values, membership states, tasks, orders and ledger rows; no automatic tier mapping or ledger backfill. Existing-user points default 10 is the approved initialization.
3. Then implement Admin configuration/assignment APIs, task snapshot creation, fixed settlement within Manager approval, points adjustment/profile display, and separate Admin signup override. Add focused unit/DB tests for permissions, legacy compatibility, snapshots, fixed payouts, duplicate/concurrent approval, points idempotency/negative totals, and bonus separation before broader local checks.

### Current inspection/check status for this transition

- Re-read this handover, current Git status, branch/HEAD, Manager task review transaction, legacy daily progression and settlement, scheduler candidate query, schema, Admin client authorization surface, Manager signup approval, and Asia/Kolkata helper. Source confirms existing daily Manager approval invokes `creditVerifiedDailyTask` in a Serializable transaction; that service uses legacy percentage settlement. Tier/points/configuration fields and Admin signup override are absent. The daily scheduler/progression currently generates Day-based tasks from membership status. No new tier schedule exists.
- Working tree was not modified by this transition. No tests, TypeScript, Prisma validation, build, migration, database/service, production/Supabase/Vercel, deployment, commit, or push command was run.

---

## Owner decisions and illustrative tier schedule (2026-10-02)

This is the newest owner-approved decision record and supersedes the earlier “blocking owner decisions” list for the items below. Only the exact tier schedule/timezone/missed-slot policy remains open. Schedule times in this section are examples only and are NOT APPROVED.

### Approved decisions recorded

1. A configured fixed commission of zero is allowed; there is no fixed business maximum. Validate numeric input and the supported database precision safely; do not invent a business cap.
2. Freeze the property/task commission when the eligible task is created, so later configuration edits do not change that task's amount.
3. Preserve existing legacy Day tasks and let them complete under their existing rules. New tier tasks begin afterward; do not recalculate or rewrite existing records.
4. No commission is paid before Manager approval. A commission already paid may be reversed only by an authorized Admin, with an audit record and traceable accounting entry.
5. Tier changes apply only to newly generated tier tasks; do not rewrite existing tasks or historical records.
6. Exact schedule remains unapproved. The owner requested examples before deciding clock times, timezone, and missed-slot behavior.

### Illustrative schedule proposal — NOT APPROVED

| Tier | Illustrative local slot(s) | Example daily recurrence |
| --- | --- | --- |
| Gold | Morning 09:00; evening 18:00 | Each slot is generated once per calendar day in the configured timezone. |
| Diamond | Morning 09:00; afternoon 14:00 | Each slot is generated once per calendar day in the configured timezone. |
| Merchant | Admin-configured task count and times | Admin defines the number of slots and their local times for each recurring day. |

Suggested timezone: `Asia/Kolkata` — NOT APPROVED. Suggested missed-slot behavior: the task stays incomplete and goes through the existing or otherwise authorized user submission and Manager review flow; no scheduler action automatically completes it or pays commission. This could mean a missed task remains available for later submission/review; whether it expires at day-end or carries forward is part of the unapproved missed-slot rule. Daily recurrence means a new set of configured slots is generated on each local calendar day; it does not itself decide expiry, catch-up, or whether a missed slot blocks a later day's tasks.

### Current-source verification and constraints

- `Property` has a `price` and `orders` relation, but no task-specific commission configuration or task-definition relation (`prisma/schema.prisma`, `Property`, `Order`, `Task`). A generated task points to an `Order`; that order points to the `Property`. `Task` has no fixed commission snapshot field today.
- `syncDailyTaskProgress` receives a Prisma transaction client and creates Day tasks with the verified active order ID inside that transaction (`lib/daily-task-progression.ts`). Therefore a future generator can read the order's property and matching task configuration and copy the configured amount into the new task in the same database transaction. The required task-definition/configuration model and snapshot column do not yet exist, so atomic snapshotting is architecturally feasible but not currently implemented or source-verifiable end-to-end.
- Today the generator selects Day tasks based on `membershipStatus`, verified active booking, and the Asia/Kolkata day cutoff. Task review requires `SUBMITTED`, active/paid/verified order, active user/manager, and manager ownership; then `creditVerifiedDailyTask` settles the legacy Day task in the same Serializable review transaction. That service calculates the existing 1.20%/1.40% amount from order principal. Keep this path only for preserved legacy Day task types; a future tier-task discriminator must route to a separate fixed-amount settlement branch. No tier task type or branch currently exists.
- Cancellation changes the Order to `CANCELLED` and records an audit event, but does not change associated task status or write a commission reversal (`app/api/manager/orders/route.ts`). The current task-review path rejects non-`ACTIVE` orders for daily task approval, so a cancelled order cannot currently pass that legacy approval check. Future tier tasks need an explicit order/task eligibility rule while retaining old task behavior.
- Current `TransactionType` has `PROFIT`, `RERENT_SETTLEMENT`, `ADJUSTMENT`, and other values, but no dedicated commission-reversal type. `Transaction` stores amount, before/after wallet balances, optional free-form reference/note, with no unique reversal-to-settlement relation. `AuditLog` can store actor, action, target, amount, and JSON metadata. These are primitives, not a complete reversal feature: an additive, traceable reversal transaction/reference and an authorized Admin action are required; do not edit an original payout entry. No financial records were changed or queried in this inspection.
- Current legacy task/order rows can remain attached to their existing types and settlement path; new tier tasks can be added with a distinct type/definition and immutable commission snapshot. Task creation and approval changes will need explicit dispatch so a tier task never reaches `creditVerifiedDailyTask` and its percentage formula. This is a design requirement, not an implemented workaround.

### Remaining open decision and next exact step

- Owner to approve or revise the illustrative schedule: exact times for Gold/Diamond, Merchant slot count/times, timezone, recurrence, task expiration/carry-forward, and missed-slot catch-up. Until then, do not implement tier task eligibility or scheduler timing. After that answer, proceed with the previously planned additive schema/migration design and preserve all current legacy data and uncommitted work.

### Inspection/check record for this update

- Read the current handover, Git status/branch/HEAD, Prisma Property/Order/Task/Transaction/AuditLog models, daily task generation and settlement, Manager task review, order cancellation, and the legacy timezone helper. No source conflict was found with the newly approved zero commission, task-creation snapshot, legacy-task preservation, Admin-only reversal, or prospective tier-change decisions; the present code lacks the new config/snapshot/reversal structures needed to implement them.
- Only `PROJECT-HANDOVER.md` was edited. No application, schema, migration, test, database, production/external configuration, deployment, commit, or push action occurred.

---

## Display-tier implementation checkpoint (2026-10-02)

### Implemented in the current working tree

- Added nullable `User.displayTier` with values Gold, Diamond, Merchant, and a forward SQL migration that adds the enum and nullable column without a default or backfill. Existing Day membership values and records are untouched; old users remain “Not assigned.”
- Added Admin assignment on the existing Admin client-detail route, guarded by `requireAdminAuth(MANAGE_USERS)` plus an explicit role/capability check. Tier changes update the user and write an Admin `AuditLog` row atomically; selecting the already-assigned tier is a no-op. Manager and user sessions cannot use this mutation.
- Added an authenticated, owner-scoped user tier read endpoint. The account shell shows the display badge next to the user's name and has a Tier navigation item; Profile includes the assigned/unassigned value; `/user/tier` displays the three options and explains that tiers have no task/accounting effect.
- The old Day task generator, Manager review route, daily settlement, wallet and ledger code were not changed for tier behavior. No commission, task, progression, payout, schedule, or expiry behavior was added.

### Files changed for this implementation slice

`prisma/schema.prisma`; `prisma/migrations/20261002000000_user_display_tier/migration.sql`; `lib/display-tier.ts`; `app/api/admin/clients/[id]/route.ts`; `app/api/user/tier/route.ts`; `app/api/user/overview/route.ts`; `app/admin/clients/[id]/page.tsx`; `app/user/UserShell.tsx`; `app/user/TierBadge.tsx`; `app/user/tier/page.tsx`; `app/user/profile/page.tsx`; `app/user/CustomerUI.tsx`; `tests/display-tier.test.tsx`; and this handover.

### Checks actually run

- Focused display-tier tests: 4 passed, 0 failed.
- `npx prisma validate`: passed.
- `npx prisma generate`: passed; generated local client under ignored `node_modules` only.
- `npx tsc --noEmit`: passed after correcting request-tier narrowing.
- `npm run build`: passed; Next.js 16.3.6 compiled and listed `/user/tier` and `/api/user/tier`.
- `git diff --check`: exit 0. The repository emits existing LF-to-CRLF warnings for modified tracked files. `PROJECT-HANDOVER.md` whitespace check passed. `next-env.d.ts` remains clean.

### Remaining verification and deployment status

- Migration has not been applied to any database. No DB-backed Admin/user authorization E2E was run; the focused tests exercise the authorization predicate, migration's no-backfill shape, and actual badge rendering. Production role behavior should still be verified in a controlled local integration test before release.
- No production/Supabase/Vercel access, production configuration, seed, deployment, commit, or push occurred. Existing unrelated modified/untracked scheduler, Re-Rent, authentication, UI, test, and migration work remains in the checkout and was preserved.
- **Next shortest step:** if desired, run a focused local DB-backed test for the Admin PATCH and owner-scoped user GET after applying this migration only to an explicitly disposable local test database. Do not apply it to production as part of this handover.

---

## Focused display-tier API integration verification (2026-10-02)

### Outcome

- Confirmed `.env.local.test` points to the disposable local PostgreSQL database `housingpro_test` on loopback. The E2E test itself validates the local database URL before connecting. No production or external database was used.
- Before applying the migration, Prisma reported only `20261002000000_user_display_tier` pending on that disposable database. Applied only that migration locally with the repository's Prisma migration workflow. A subsequent `npx prisma migrate status` reported all six repository migrations applied and the local database schema up to date.
- Added `e2e/display-tier.spec.ts` for HTTP/browser integration against actual routes. It verifies authorized Admin assignment of all three tiers; denial for Admin without `MANAGE_USERS`; denial of Manager/User mutation and protected Admin client reads; unauthenticated read denial; invalid tier and missing user rejection; initial null/“Not assigned” behavior; user API/profile/tier-page display; three Admin audit events; and preservation of the user's legacy `DAY_2` membership status.
- Playwright reported the focused spec passed: 1 test passed (35.2 seconds). The Playwright process then hung during shutdown; it was interrupted after the passing assertion output, so the assertions passed but the overall Playwright process did not exit cleanly. No application code was changed to mask teardown behavior.
- Rechecked disposable-database cleanup: zero `tier-api-` fixture users, managers, admins, or login-attempt rows remained; the test cleanup hook also deletes its temporary PlatformSetting and audit entries. One pre-existing PlatformSetting remains in the database; its relationship to this run is not inferred. The focused test reported exactly three tier audit events before cleanup; post-cleanup count for this action is zero.
- `tests/display-tier.test.tsx`: 4 passed, 0 failed.
- `npx tsc --noEmit`: passed after the integration spec was added (reported by the preceding verification run).
- `npx prisma migrate status`: passed after local migration; schema up to date.
- `git diff --check`: exit 0 before this handover update; rerun after update for final whitespace verification.
- Playwright startup regenerated `next-env.d.ts` references to `.next/dev/types`. This was generated Next.js development type-path noise, so the tracked repository references (`.next/types`) were restored. Confirm final status before handoff.

### Files for this verification step

- Added `e2e/display-tier.spec.ts`.
- Updated `PROJECT-HANDOVER.md` with the actual local integration outcome.
- No application, tier implementation, Prisma schema, or migration file was changed during the verification step. The tier migration was applied only to the disposable local `housingpro_test` database. No production/Supabase/Vercel access, deployment, commit, or push occurred.

### Remaining issue and next step

- The API assertions are green, but the local Playwright process does not shut down cleanly after the spec. Diagnose the Windows Playwright/web-server teardown separately before relying on a clean E2E process exit; do not change application behavior to hide it.
- Shortest next step: inspect final `git status --short`, confirm `next-env.d.ts` has no diff, and run `git diff --check`. No production migration or configuration has been performed.

---

## Existing-workflow audit for owner-led manual testing (2026-10-02)

### Findings and severity

- Historical audit finding (pre-booking-path correction): the previous wallet-debit implementation was inconsistent with the active manual-payment requirement; it has been restored to the pending/manual workflow and is covered by `tests/manual-order-payment.test.ts`.
- The old conclusion that Admin override was absent is superseded by the owner-approved Super Admin route/service documented in the active release map. No live behavior is implied.
- **P2 — Visual comparison is blocked.** `REFERENCE-USER-PANEL/` is absent from this checkout, consistent with the earlier owner request to remove the unrelated screenshots. No reference screenshot comparison was possible.
- **P2 — Manual multi-panel behavior is not fully proven.** This audit is based on source and focused automated tests; it did not execute every Admin/Manager/User workflow in a browser. The focused display-tier HTTP integration passed in the previous verification checkpoint, but its Playwright process hung during shutdown.
- **P3 — Legacy Day terminology remains in existing Manager signup and task/progress screens.** This is consistent with the current reduced scope, which preserves Day progression and limits tiers to display-only. Do not treat that terminology as tier behavior or change financial logic in this audit.

### Verified source behavior

- Registration binds a new user to the active Manager selected by referral code; request input cannot choose `managerId`. Signup starts pending. Login requires an expected role and the configured access token for Manager/User; Admin login remains role-isolated. Login rate limiting and one-time access-token handling are part of the current modified source, but full login flows were not browser-tested in this audit.
- Manager signup approval conditionally claims only a pending signup, sets account/membership status, and credits INR 120 with reference `day1-welcome:<userId>` in the same Serializable transaction as the audit and notification. Repeated approval is rejected. Admin tier assignment remains separate and does not touch signup approval or wallet data.
- User properties are limited server-side to active global properties and active properties assigned to the user's Manager; booking rechecks the active property, manager scope, and price within a Serializable transaction, then creates a pending manual-payment order with notification and audit. It does not debit the wallet. The existing payment-proof endpoint atomically records the user's reference/proof submission for Manager review; no payment gateway is introduced.
- User order, task, activity, notification, deposit, withdrawal, and tier reads are session-scoped. Manager client/order/task/deposit/withdrawal reads and mutations constrain records to the session Manager and/or verify the client’s `managerId`. Admin handlers reviewed require their relevant server-side permissions. Cross-manager task ownership and duplicate/concurrent settlement have focused coverage in the existing task-verification/Re-Rent tests, but that Playwright suite was not rerun here.
- Daily task approval uses the existing `creditVerifiedDailyTask` settlement service. Re-Rent settlement remains on `settleReRentTask`; repeated/concurrent settlement is guarded by state claims and task-referenced settlement ledger checks. User activity and wallet summaries label/display transactions without changing the underlying ledger. Display tiers remain informational and do not enter task, booking, settlement, or wallet calculation paths.
- Admin client detail exposes bounded recent orders, tasks, deposits, withdrawals, transactions, notifications, and audit rows, plus the display-tier control. Screenshot-specific missing/duplicate controls remain unverified because the reference folder is absent.

### Changes and checks in this audit

- No application/API/UI, Prisma/schema/migration, or test code was modified. Only this handover was updated to correct the stale sentence that said the local tier migration had not been applied and to record this audit.
- `npm run test:scheduler-unit`: 14 passed, 0 failed (includes Re-Rent settlement, scheduler authentication/window/runner behavior).
- `node -r ./scripts/tsx-windows-preload.cjs ./node_modules/tsx/dist/cli.mjs --test tests/display-tier.test.tsx`: 4 passed, 0 failed.
- `npx tsc --noEmit`: passed (the command completed and the subsequent chained Prisma validation ran).
- `npx prisma validate`: passed.
- `npm run build`: passed; Next.js 16.3.6 compiled and rendered the Admin, Manager, User, and API route set.
- Playwright was not run during this audit. The previous focused display-tier HTTP integration reported its assertions passed but hung during shutdown. No effort was spent on that teardown issue.
- `git diff --check` and the untracked handover trailing-whitespace check still need to be run after this update.
- No production database, Supabase, Vercel, deployment, commit, or push action occurred. No migration was applied during this audit.

### Safe local launch and manual workflow checklist

Launch only against the disposable local `housingpro_test` database. In PowerShell, from the project root, this process-only setup reads `LOCAL_TEST_DATABASE_URL` without echoing its value, refuses any non-loopback host or database name, and makes it override any `DATABASE_URL` loaded from local dotenv files:

```powershell
$line = Get-Content -LiteralPath '.env.local.test' | Where-Object { $_ -match '^\s*LOCAL_TEST_DATABASE_URL\s*=' } | Select-Object -First 1
if (-not $line) { throw 'LOCAL_TEST_DATABASE_URL is not configured.' }
$localUrl = $line.Substring($line.IndexOf('=') + 1).Trim().Trim('"')
$parsedUrl = [Uri]$localUrl
$databaseName = [Uri]::UnescapeDataString($parsedUrl.AbsolutePath.TrimStart('/'))
if ($parsedUrl.Scheme -notin @('postgres', 'postgresql') -or $parsedUrl.Host -notin @('localhost', '127.0.0.1', '::1') -or $databaseName -ne 'housingpro_test' -or $parsedUrl.Query -match '(^|[?&])host(addr)?=') { throw 'Refusing to start against a non-disposable database.' }
$env:DATABASE_URL = $localUrl
npm run dev
```

Open `http://localhost:3000`. Use only synthetic/local test accounts already configured in the disposable database and local E2E credential file; do not copy their secrets into notes or messages. Admin sign-in is `/admin-login`; Manager and User sign-in use their authorized local access-token URLs (`/manager-login/<local-manager-token>` and `/login/<local-user-token>`). Do not run the legacy seed or any database setup command against an unknown database. Stop the dev server with Ctrl+C.

1. **Admin:** Sign in; verify the overview, manager/client lists, client detail and audit history. Confirm an Admin with `MANAGE_USERS` can set Gold, Diamond, or Merchant on a synthetic user and that the stored value is visible in the client detail/audit trail. Confirm a restricted Admin cannot use the assignment/API. Verify property active/inactive controls and permissions affect only intended records.
2. **Manager:** Sign in with a local Manager token; confirm only that Manager’s clients appear. For a synthetic pending signup, approve once and verify the client status/notification and a single INR 120 welcome ledger entry; repeat and verify it is rejected without another credit. Review a submitted daily task and an assigned Re-Rent task; confirm client-visible status/notification updates, and that Re-Rent settlement displays the Manager-entered final return. Test reject/resubmit only with synthetic fixtures.
3. **User:** Sign in with a local User token; check signup/account status, profile and display tier (`Not assigned` unless explicitly set), active properties, manual booking request, payment reference/proof submission, order history, task status, Re-Rent status, wallet/transaction history, notifications, deposits, withdrawals, and visible activity history. Verify a new booking remains payment-pending until Manager review and does not debit wallet. Use only synthetic local data and confirm Manager decisions appear in status/notifications.
4. **Isolation and duplicate actions:** With two synthetic Manager/User pairs, attempt cross-Manager client/order/task access and confirm denial. Repeat task approval, Re-Rent settlement, deposit/withdrawal actions, and signup approval where applicable; verify no duplicate wallet/ledger credit and truthful final status.
5. **Scope check:** Confirm tier assignment changes display only; it must not change membership status, tasks, booking eligibility, wallet, or ledger. Test Super Admin signup override once on a synthetic pending client and verify exactly one ₹120 welcome credit, normal ledger/audit/notification effects, and rejection of repeats. Confirm cancellations never trigger a wallet refund or ledger reversal.

### Remaining gaps and next step

- These instructions are an older manual-test checklist; the Admin override is now implemented in the local source, but no live Admin login/effect was performed. Follow the updated checklist above.
- Full browser/manual verification of all panels, screenshot parity, production configuration, and clean Playwright process shutdown remain unverified.
- **Shortest next step:** run the local checklist above with synthetic accounts only after a disposable target is independently confirmed safe and write testing is explicitly authorized. Do not treat source/mock tests as production verification.

---

## Autonomous engineering continuation (2026-10-02)

### Current repository checkpoint

- Branch: `main`; HEAD: `a1dee6e`.
- Existing working-tree changes, untracked scheduler/tier/Re-Rent/auth/test files, prior `prisma/seed.ts` edits, and `.env*` files were preserved. No Git history-changing command was run.
- `next-env.d.ts` has no diff against HEAD after the production build; it contains the tracked Next type references.
- The runtime database's migration status remains unknown. Earlier `P2022` evidence identified missing `User.displayTier` at the target used by login, but this continuation made no database connection or login attempt.

### Fixes completed

1. **P1 Admin login isolation:** the email lookup still checks all three account namespaces for duplicate-email collisions, but selects only `id` for roles unrelated to the requested portal. The expected role query selects only fields needed for authentication. This avoids selecting `User.displayTier` during Admin login while preserving collision detection. The route retains expected-role and active-status checks, password verification, Manager/User access-token checks, rate-limit handling, and session creation.
   - Files: `app/api/auth/login/route.ts`, `lib/login-account.ts`, `tests/login-account.test.ts`.
   - Evidence: 5 mocked tests pass, including missing unrelated User column behavior and cross-role collision rejection. Actual API/Admin login against the configured database remains unverified by design.

2. **P1 seed safety:** development seeding now requires `ALLOW_HOUSINGPRO_LOCAL_SEED=YES` and a loopback PostgreSQL URL; production bootstrap requires `ALLOW_HOUSINGPRO_PRODUCTION_SEED=YES`, a PostgreSQL URL without host overrides, and valid Super Admin bootstrap values before database work. Existing Super Admin credentials are never changed by seed. Bootstrap email is normalized and validated before use. README documents the requirements.
   - Files: `prisma/seed.ts`, `lib/seed-safety.ts`, `tests/seed-safety.test.ts`, `README.md`.
   - Evidence: database-free seed tests cover opt-in, URL restrictions, and bootstrap input validation. The seed was not executed.

### Verification actually run in this continuation

- Login and seed-safety tests: 8 passed, 0 failed.
- Scheduler/Re-Rent unit suite: 14 passed, 0 failed.
- Display-tier unit/render tests: 4 passed, 0 failed.
- Total focused unit tests: 26 passed, 0 failed.
- `npx tsc --noEmit`: passed.
- `npx prisma validate`: passed; schema valid. This did not connect to a database.
- `npm run build`: passed; Next.js 16.3.6 generated 90 static pages and completed route compilation.
- `git diff --check`: exit 0. Git emitted existing LF-to-CRLF conversion warnings for modified tracked files; there were no whitespace errors.
- No `lint` script is defined in `package.json`; lint was not run.
- No Playwright/E2E, seed, migration command, database query, login attempt, production/Supabase/Vercel command, deployment, commit, or push was run in this continuation.

### Prioritized remaining work

- **P1 — Runtime database/migration status:** `User.displayTier` is known to be absent at the previously configured login target, but target identity and current migration state were intentionally not rechecked. The login fix avoids selecting this unrelated User scalar during Admin authentication; Admin client detail and tier reads still require the column. The owner/operator must confirm the exact intended database and separately authorize a safe migration before those paths can be claimed operational.
- **P1 — Production seed operation remains unverified:** source now requires an explicit production opt-in, validates initial bootstrap inputs, and does not alter an existing Super Admin. No database target was verified and the seed was not executed. Any one-time bootstrap still requires the operator to confirm the target and authorize that operation separately.
- **P1 — Real Admin login:** mocked selection/auth tests pass, but the actual login endpoint remains unverified against the runtime database and no credentials were submitted.
- **P2 — Database-backed regression/E2E:** do not run until the owner confirms the exact local test target is disposable and authorizes its writes. The previous handover records a focused display-tier Playwright assertion pass followed by a shutdown hang; it was not repeated.
- **P2 — Lint:** no lint script is defined; lint was not run.
- **P2 — Full panel workflow verification:** source inspection and focused unit tests do not prove every Admin/Manager/User browser workflow. Continue with narrowly targeted checks only after database authorization.

### Safest next task

Resolve the runtime database identity and migration approval with the owner/operator without connecting to it from this task. After the target is explicitly confirmed, plan the smallest migration application and focused database-backed Admin client/tier test. Do not run the seed or attempt real Admin login before that approval.

---

## Further autonomous audit continuation (2026-10-02)

### Additional fixes

- **Seed bootstrap hardening:** a production seed run now requires `ALLOW_HOUSINGPRO_PRODUCTION_SEED=YES` and a syntactically valid PostgreSQL URL without `host`/`hostaddr` overrides. Required production Super Admin inputs are validated before the first database operation. The existing admin query now selects only the account ID; if a Super Admin exists, the script exits without changing credentials. Bootstrap email is trimmed/lowercased and validated, display name is validated, and creation logs no longer include the configured address. Before creating a bootstrap admin, a Serializable transaction checks Admin, Manager, and User email namespaces to preserve login collision protection. If platform settings are absent, seed still creates the default seat limit/payment instructions; README now calls out that side effect. Development seed writes continue to require their separate local opt-in and loopback target.
  - Files: `prisma/seed.ts`, `lib/seed-safety.ts`, `tests/seed-safety.test.ts`, `README.md`.
  - No seed was run and no datasource was contacted.
- **Admin account UI/API policy alignment:** account APIs are Super Admin-only. The navigation and edit control previously used staff permission flags and could display a page/action that the API rejected. They now use the same Super Admin-only rule; API authorization was not broadened.
  - Files: `lib/admin-permissions.ts`, `app/admin/AdminShell.tsx`, `app/admin/accounts/page.tsx`, `tests/admin-permissions.test.ts`.

### Authentication review findings

- Login requires an explicit expected role; Manager/User require a valid access token, Admin login does not. Email lookup detects a same-email collision across Admin/Manager/User while selecting only IDs for unrelated roles. Phone login is limited to a unique User match. Status, password, and rate-limit checks remain server-side.
- Sessions use HS256 JWTs in HttpOnly, SameSite=Lax cookies; production cookie is `__Host-platform_session`, secure-only, path `/`. `getSession()` re-reads the account, rejects disabled/non-active accounts, and derives a credential version from the current password hash so password changes invalidate old sessions. Admin role/type/permissions come from the current DB row, not client input. Layouts redirect cross-role sessions; Admin APIs use `requireAdminAuth` and explicit capabilities or Super Admin checks. Logout is same-origin POST and clears the current environment's cookie.
- Manager/User login URLs contain a random 32-byte access token; the database stores a SHA-256 representation for newly generated tokens, comparison is timing-safe, and token pages are `noindex`. Login throttling serializes bucket checks/inserts with PostgreSQL transaction advisory locks. These are source findings; no real login/session/API call was executed in this pass.
- `MANAGE_ADMIN_ACCOUNTS` and `MANAGE_ADMIN_PERMISSIONS` are defined in the staff permission vocabulary/UI, but Admin account APIs deliberately remain Super Admin-only. The UI has been aligned with that boundary. Whether to delegate those capabilities to staff remains a policy decision; do not broaden API access without explicit policy.

### Signup override and wider source audit

- Only `POST /api/manager/signups` currently approves/rejects a pending signup. Manager approval atomically updates signup/account/membership state, credits INR 120 once with `day1-welcome:<userId>`, and writes audit/notification entries. No Admin signup override route or control was found.
- The remaining decision is whether an Admin override should activate/approve a signup while forfeiting the Manager-only welcome credit, or leave the signup pending for the Manager to approve and credit. Those outcomes differ in eligibility and payment; no route was invented.
- Reviewed source paths keep booking and payment-proof submission scoped to session user/order/manager, Manager payment review checks both order and user ownership in a Serializable transaction, daily-task payout reuses the existing settlement service, and Re-Rent uses its separate idempotent settlement transaction. These are code review findings only; DB concurrency and panel workflows were not exercised here.

### Latest verification and state

- Mock/unit tests: Admin permissions + login + seed + display tier: 16 passed; scheduler/Re-Rent: 14 passed. Total: **30 passed, 0 failed**.
- `npx tsc --noEmit`: passed.
- `npx prisma validate`: passed; no DB connection.
- `npm run build`: passed; Next.js 16.3.6 generated all 90 static pages and completed route compilation.
- `git diff --check`: passed with the repository's LF-to-CRLF warnings. Handover and new-file trailing-whitespace checks passed. `next-env.d.ts` has no diff after the build.
- No E2E, database, seed, migration, production/Supabase/Vercel operation, login attempt, deployment, commit, push, or destructive Git command occurred. Lint remains unavailable because no lint script is defined.
- Branch/HEAD remain `main` / `a1dee6e`. Existing modifications and untracked files remain preserved.

### Remaining priorities

- **P1 — Runtime database target and migrations:** the previous P2022 indicates the deployed/configured target lacks `User.displayTier`. Identity and migration state remain unverified; only the owner/operator can confirm and separately authorize the next DB operation.
- **P1 — Real Admin login:** source fix and mocks pass; endpoint behavior against the actual runtime DB is unverified.
- **P1 — Production bootstrap procedure:** script safeguards are source-tested only. Before any bootstrap, an operator must verify the exact datasource and separately authorize the one-time operation.
- **P2 — Admin signup override:** resolve the approval/eligibility and welcome-credit outcome above before implementing.
- **P2 — Database-backed panel tests:** wait for explicit disposable-test-database confirmation and authorization. Prior Playwright shutdown hang remains separate and was not reproduced.
- **P2 — Staff Admin management delegation:** confirm whether those permission names are meant to delegate account/permission management; APIs remain Super Admin-only for now.

**Next safe action:** obtain confirmation of runtime database identity and migration authorization. Until then, continue only source/mock work; do not run seed, database-backed tests, migrations, or login attempts.

---

## Autonomous ownership, settlement, and deployment-tool audit (2026-10-02)

### Manager/client isolation and financial flow review

- Reviewed all Manager API handlers under `app/api/manager/**`, Manager panel pages, user booking/payment/deposit/withdrawal/task routes, and the daily/Re-Rent settlement services. No confirmed cross-Manager read or write path was found. Client detail checks `User.managerId` before related reads; orders, tasks, deposits, withdrawals, audit logs, cursors, and mutations are filtered by session `managerId`, with relation checks on sensitive mutations. Registration derives `managerId` from an active referral-code lookup rather than accepting a manager ID from the client.
- User booking in `app/api/user/orders/route.ts` validates the authenticated user and Manager, active property and current price; in a Serializable transaction it rechecks ownership/property, atomically debits available wallet balance, creates the paid/active order, rent-debit ledger row, notification, and audit record. User payment-proof submission in `app/api/user/orders/payment/route.ts` is a separate legacy transition for pending/submitted-payment orders and does not credit a wallet. Manager verification/rejection is transactionally claimed and audited. No database tests were run.
- `lib/daily-task-settlement.ts` remains the single legacy daily-task payout path; its conditional task claim, existing ledger-reference check, wallet increment, transaction, notification, audit, and membership progression run within the calling Serializable transaction. `lib/rerent-settlement.mjs` remains the Re-Rent settlement path; it validates the manager/client/order chain, payment and delay, claims both order/task state, credits the entered return and writes the settlement ledger/notification/audit atomically, with P2034 retry handling. Existing mocked concurrency/idempotency tests passed; real database race behavior remains unverified.
- **Owner-confirmed cancellation policy (2026-10-02):** Housing.pro must not have a cancellation-refund feature. Do not automatically refund wallet-paid rent, reverse existing debits/ledger entries, process refunds for off-platform payments, or add refunds for `RE_RENT_PENDING`. Preserve existing cancellation authorization, status validation, transaction guards, audit logs, and notifications. This policy is recorded in README; no financial code was changed.
- Daily task generation/progression, task quantities, and 1.20%/1.40% payout formulas were not changed. The existing display-only tiers remain outside financial/progression logic.

### Confirmed operational-tool defect and fix

- The older `scripts/provision-super-admin.ts` could update an existing Super Admin password and did not apply the seed target guard; `scripts/fix-super-admin-email.ts` could repair email/password without explicit opt-in. `scripts/run-provisioning-with-env.ts` could fetch deployment environment variables before any local production opt-in.
- Changed the bootstrap script to call `assertSeedExecutionAllowed` before creating Prisma or making a DB call, validate normalized inputs, create only if no Super Admin exists, check cross-role email uniqueness in a transaction, and never modify an existing Super Admin. Added a pre-network production opt-in gate to the Netlify wrapper; remote values cannot override the operator's explicit opt-in or `NODE_ENV`. The dedicated repair script now requires both the database-target guard and `ALLOW_HOUSINGPRO_SUPER_ADMIN_REPAIR=YES` before Prisma construction.
- Files changed in this batch: `scripts/provision-super-admin.ts`, `scripts/fix-super-admin-email.ts`, `scripts/run-provisioning-with-env.ts`, `lib/seed-safety.ts`, `tests/seed-safety.test.ts`, `README.md`. No provisioning, external CLI, or database command was executed.

### Other source checks and remaining risks

- Login and access-token code retains role-specific lookup, collision rejection, rate limits, active-account verification, session creation and token hashing. Scheduler code still documents the single canonical Supabase Cron -> `POST /api/internal/scheduler/process` -> `SCHEDULER_SERVICE_SECRET` path; the old Re-Rent endpoint remains authenticated compatibility code. Actual Supabase/Vercel configuration and deployed secret presence were not inspected.
- No application code was edited for this audit. No confirmed defect was found in the inspected Manager isolation, booking debit, task payout, Re-Rent settlement, deposit or withdrawal atomic paths. Panel behavior and database-level race guarantees remain unverified because the database and Playwright suite were not accessed.
- Admin signup override remains intentionally unimplemented pending the already-recorded approval/membership/₹120-credit decision. Runtime database target, migration application status and real Admin login remain unverified.

### Verification for this continuation

- Database-free mocked/unit tests: **32 passed, 0 failed** across Admin permissions, display tiers, login lookup, Re-Rent settlement, scheduler auth/runner/window, and seed/provisioning safety. The two `SCHEDULER_*_BATCH_FAILED` lines are expected output from tests exercising isolated failure handling; the tests passed.
- `npx tsc --noEmit`: passed.
- `npx prisma validate`: passed; it loaded environment files for schema validation only and did not connect to a database.
- `npm run build`: passed; Next.js compiled and generated 90 static pages.
- `git diff --check`: exit 0; only existing Windows LF-to-CRLF working-copy warnings were printed.
- No database access/query/write, migration, seed, Playwright/E2E, deployment-platform CLI, production configuration change, deploy, commit, or push occurred. `next-env.d.ts` remains unmodified after build.

### Prioritized next actions

- **Resolved — Cancellation refunds:** owner explicitly confirmed Housing.pro has no cancellation-refund feature. Do not ask again or add a refund flow.
- **P1 — Operator confirmation, 10–30 minutes:** confirm the intended runtime database identity and separately authorize safe migration verification/application; actual Admin login and tier routes remain blocked by the known database/schema mismatch.
- **P1 — Production config, 15–30 minutes after deployment access is authorized:** verify the external scheduler secret and Cron configuration through the owner/operator. No platform state was inspected here.
- **P2 — Targeted DB integration, 30–60 minutes after disposable DB identity and writes are explicitly authorized:** exercise cross-Manager ID tampering, wallet booking debit, deposit/withdrawal transitions, task and Re-Rent duplicate/concurrent settlement.
- **P2 — Admin signup override:** settle the approval eligibility and bonus outcome before designing/implementing the route.

**Next exact safe task (superseded):** cancellation policy confirmation is no longer needed. The next operational dependency is still for the operator to establish the intended database identity and authorize read-only migration-status verification; do not run database/E2E operations before authorization.

---

## Cancellation lifecycle and final static audit continuation (2026-10-02)

### Booking cancellation findings (historical before manual-booking correction)

- Only an authenticated Manager can use `POST /api/manager/orders` with `action: "CANCEL"`. The request is restricted to that Manager's assigned client and the order's matching `managerId`; the handler requires the client account active and signup approved. Admin order APIs are read-only, and no User cancellation endpoint was found.
- The current Manager cancellation accepts `PAYMENT_PENDING`, `PAYMENT_SUBMITTED`, `PAYMENT_VERIFIED`, `ACTIVE`, and `RE_RENT_PENDING`. It refuses `COMPLETED`, `RE_RENTED`, and already `CANCELLED`; an update-many status guard inside a Serializable transaction prevents the same order from being cancelled after a concurrent terminal transition. It writes `CANCELLED`/`cancelledAt`, a customer notification and an audit entry. It does not alter payment status, wallet, or transaction ledger.
- The preceding wallet-funded booking description was based on a prior working-tree snapshot and is not the current route behavior. The current booking route creates a pending manual-payment request and does not debit wallet funds; see “Latest safe booking-flow correction” below. Historical orders may still contain existing wallet-payment ledger entries.
- The separate payment-proof flow records a reference/proof without debiting Housing.pro wallet funds. Manager verification marks that order `ACTIVE`/`PAID` without an in-app rent debit. Cancellation through the common Manager action does not change `PAID` or create a Housing.pro refund transaction; the owner-confirmed policy is that the platform does not process off-platform refunds. `REJECT_PAYMENT` is narrower: it cancels a submitted payment and sets payment status `REJECTED`, with audit and notification, but does not make any wallet change.
- The earlier source audit had no written cancellation policy; the owner has since explicitly decided there will be no Housing.pro cancellation-refund feature. No automatic wallet refund or ledger reversal is to be added; Housing.pro does not process off-platform payment refunds or refunds for `RE_RENT_PENDING` cancellation. Existing order-state/auth/audit/notification behavior remains as reviewed.
- Added `lib/order-cancellation.ts` and `tests/order-cancellation.test.ts` to capture the existing status eligibility as a pure unit-tested rule, and refactored the existing Manager route to use an explicit allow-list in its compare-and-set update. All five currently cancellable statuses retain their behavior; terminal and unknown statuses fail closed. Role/ownership/transaction behavior is retained. This test does not specify a refund policy.

### Additional confirmed source fix

- `scripts/fix-super-admin-email.ts` previously updated the email first, then updated the password only when the email did not need updating. If both differed, it could change the email but leave the configured password unapplied. It now builds one patch containing either/both fields and applies it with a Serializable transaction. Its create and email-change paths also check for Admin/Manager/User email collisions, while allowing the current Admin row. `tests/super-admin-repair.test.ts` verifies combined and no-op patches; `tests/seed-safety.test.ts` verifies own-row allowance and cross-role collision rejection without Prisma calls. The repair script was not run.
- The main development seed (`prisma/seed.ts`) checks its opt-in/target guard before database calls; its non-production path upserts demo manager/user records and may update those designated demo accounts, while production bootstrap has a separate explicit opt-in and only creates an initial Super Admin if absent. The guarded production path may also create default `PlatformSetting` data if missing, as README documents. No seed was executed. The legacy `scripts/run-provisioning.ts` contains unused Netlify-fetch code; its direct-entry block imports the guarded bootstrap directly and does not call that function. The active `scripts/run-provisioning-with-env.ts` has the separate explicit production gate before Netlify access.

### Static migration and configuration inventory

- The checked-in migration chain, in order, is `prisma/migrations/0_init/migration.sql`, `20260928013424_add_admin_super_staff_and_login_tokens/migration.sql`, `20260929120000_add_verified_task_status/migration.sql`, `20260930031225_admin_permissions_not_null/migration.sql`, `20261001000000_manager_entered_rerent_return/migration.sql`, and `20261002000000_user_display_tier/migration.sql`. Static review shows the later migrations add Admin type/login-token fields, `TaskStatus.VERIFIED`, non-null Admin permissions, nullable `Order.finalReturnAmount` and `TransactionType.RERENT_SETTLEMENT`, and nullable `User.displayTier` with its enum, respectively. The current Prisma schema expects these objects. This is the repository-required chain only: no database was queried, so applied/pending status is unknown.
- README specifies Supabase Cron -> `POST /api/internal/scheduler/process` with `SCHEDULER_SERVICE_SECRET`, and the environment contract for the app/runtime and Supabase Vault. This continuation corrected README to identify both the manager-entered Re-Rent migration and display-tier migration as required by the current application. No deployment-platform state was inspected; presence/correctness of production Vercel/Supabase values, extensions, schedule, Vault entries, and migration history remains UNVERIFIED. The old Re-Rent endpoint is described as compatibility-only; no second Cron should be configured.

### Verification and remaining work

- Final focused database-free suite: **36 passed, 0 failed** across Admin permissions, display tier, login lookup, cancellation status rule, Re-Rent settlement, scheduler auth/runner/window, seed safety, and the Super Admin repair patch. Expected scheduler batch-failure log lines were emitted by the tests that verify failure isolation.
- `npx tsc --noEmit`: passed. `npx prisma validate`: passed; it loaded environment files for schema validation only and did not connect to a database. `npm run build`: passed; Next.js 16.3.6 compiled and generated 90 static pages. `git diff --check`: passed with existing Windows LF-to-CRLF warnings. No lint script is defined.
- This build and validation verify the source tree only. No database was accessed and no migration application status was checked. `next-env.d.ts` remains clean after build.
- No payment, wallet, ledger, daily progression, settlement formula, membership eligibility, schema, or migration behavior was altered in this continuation. No database connection/query/write, migration, seed, Playwright/E2E, Vercel/Supabase operation, login attempt, deployment, commit, push, reset, or cleanup was performed.
- Cancellation outcomes are settled: no cancellation-refund feature or automatic reversal in any of the three cases above. Other blockers remain: exact runtime database identity and migration application state, actual Admin login against that database, production Cron/Vault/secret configuration, and authorized disposable DB for HTTP integration tests. Admin signup override remains unimplemented under the previously recorded membership/₹120 bonus ambiguity.

---

## Panel route and workflow audit continuation (2026-10-02)

- Read the Admin, Manager, and User layouts and shells, panel route inventory, authentication/session helpers, permissions, and all API route entry-point authorization markers. Admin/Manager/User layouts redirect unauthenticated and cross-role sessions. `getSession()` re-reads the current account and status for each role; Admin API permissions are sourced from the current Admin row, and staff routes require a specific capability. Admin account management remains Super Admin-only at the API boundary. The only API route files without session/admin/scheduler authentication are the expected public/session handlers: login, logout, and customer registration.
- Registration takes Manager ownership only from an active referral/invitation code and begins in pending signup/membership state. Manager signup approval remains the only approval route and ₹120 credit trigger. The Admin override is absent and remains blocked by the existing owner decision. User notification reads/updates scope to the authenticated User; cross-role page access redirects at layouts and is independently rejected by APIs.
- Static review of property visibility, booking, payment proof, order history, task, notification, wallet, deposit/withdrawal, and Re-Rent entry points found no additional confirmed object-ownership bypass in this pass. Wallet booking and manual proof are separate payment paths. Withdrawal funds are reserved on request, released on rejection, and debited/ledgered when marked paid; these transitions use transactional status claims. Deposit approval/rejection similarly uses a pending-state claim and transaction for wallet/ledger/audit/notification effects. These are source observations, not database race tests.
- No new UI defect was confirmed that could be repaired without inventing business behavior. Responsive rendering, keyboard use, live loading/error states, redirects, and cross-panel customer display remain browser/manual-test items; E2E was intentionally not run because the database target and test-write authorization are unresolved.
- Release blockers: Admin signup override still requires a separate owner decision about membership eligibility and the ₹120 bonus; operator confirmation of intended runtime database and migration status; actual Admin login and tier-read verification against that target; production scheduler/Cron/Vault configuration verification; and focused HTTP/panel integration testing on an explicitly authorized disposable database. Cancellation refund behavior is resolved as unsupported. No production or external system was accessed.

---

## End-of-day continuation handover (2026-10-02)

### Today's finalization

- Recorded the owner's confirmed no-cancellation-refund rule above and added a matching README policy section. No cancellation accounting behavior was changed.
- Cancellation processing remains Manager-only, retains its status allow-list and transactional compare-and-set, and continues audit/notification behavior. Wallet debits and existing ledger rows are never automatically reversed; no off-platform or Re-Rent-pending cancellation refund mechanism is in scope.
- The prior source fixes remain in the worktree: fail-closed cancellation status allow-list and tests; guarded/atomic Super Admin repair with cross-role email collision checks; README migration guidance for Re-Rent and display-tier migrations.
- Current source evidence and older unresolved items are retained above. In particular, Admin signup override remains unimplemented; no tier/commission system beyond the approved display-only assignment is planned.

### Exact final verification state

- Fresh final checks after the no-refund documentation edits: focused database-free suite **36 passed, 0 failed**; `npx tsc --noEmit` passed; `npx prisma validate` passed (schema validation only, no DB connection); and `git diff --check` passed with existing Windows LF-to-CRLF warnings. The latest source code had already passed `npm run build` with 90 static pages; only README/handover documentation changed after that build, so it was not repeated.
- The final pass inspected current Git state and searched the handover/README for contradictory cancellation-policy language. The prior “refund decision unresolved” entries were replaced with the owner-confirmed no-refund policy. New/handover whitespace check is clean.
- Runtime datasource identity and migration application state: **UNVERIFIED**. Actual Admin login and browser-level panel behavior: **UNVERIFIED**. Production Cron/Vercel/Supabase/Vault configuration: **UNVERIFIED**. No database, migration, seed, E2E, production/external service, deployment, commit, or push was used.

### Current repository state

- Branch: `main`; HEAD: `a1dee6ead64b482037096db8b370696e6539b545` at this checkpoint.
- Preserve all current modified and untracked paths shown by `git status --short --untracked-files=all`. `next-env.d.ts` is clean. `scripts/rerent-worker.mjs` is an existing deletion; do not restore it without review. No `.env*` files were modified.
- Important work areas include `app/api/auth/login/route.ts` and `lib/login-account.ts`; `lib/auth.ts`, `lib/admin-auth.ts`, and `lib/admin-permissions.ts`; manager/user booking and finance APIs under `app/api/manager/**` and `app/api/user/**`; `lib/daily-task-settlement.ts`, `lib/rerent-settlement.mjs`, scheduler files under `lib/` and `app/api/internal/scheduler/process/route.ts`; migrations under `prisma/migrations/`; and this document.

### Tomorrow's prioritized continuation

1. **P1 — Operator database identity and migration verification, 15–30 min once authorized.** Confirm the intended target first. Then, only with authorization for a safe read-only connection, verify `_prisma_migrations` and schema presence for all six repository migrations. Do not infer applied status from the checkout. If applying an additive migration is requested, confirm target and approval separately before any write.
2. **P1 — Admin login and display-tier integration, 30–60 min after target confirmation.** Test one normal HTTP login and stored tier read against the confirmed intended environment. No credentials should be submitted until the target is confirmed and login testing is authorized.
3. **P1 — Cancellation UI/status messaging, 20–40 min source review.** With the no-refund policy now fixed, ensure Manager/User order screens do not imply a refund or funds reversal when an order is cancelled. Preserve all existing authorization, state checks, audit and notification behavior.
4. **P1 — Admin signup override decision, owner time 5–10 min; implementation/test 2–4 h after decision.** Decide whether Admin override changes signup/membership eligibility and whether it leaves the ₹120 credit unavailable for Manager approval. Do not implement until this is explicit.
5. **P2 — Production scheduler configuration, 15–30 min with operator access.** Verify the single Supabase Cron -> `POST /api/internal/scheduler/process` path, Vault values, Vercel `SCHEDULER_SERVICE_SECRET`, job history and migrations. Do not change production settings without separate authorization.
6. **P2 — Focused panel integration/manual QA, 1–2 h after a disposable test database is confirmed and writes authorized.** Cover Manager A/B ID tampering, signup approval, booking, payment proof, order cancellation visibility (no refund), deposits/withdrawals, task approval, Re-Rent duplicate/concurrent settlement, and Admin-only tier assignment. Avoid the full E2E suite until targeted checks are stable.

---

## Current continuation — owner-confirmed signup approval and scheduler verification (2026-10-02)

This section is the latest authority for this continuation and supersedes all older statements above that the Admin signup decision is unresolved, that an Admin override must not credit the wallet, or that implementation is awaiting owner approval.

### Confirmed policy

- A Super Admin may approve a pending client's signup directly from the Admin client detail associated with that client's Manager. This approval grants the same one-time INR 120 welcome credit as Manager approval, including the wallet increment, `WELCOME_BONUS` ledger/transaction row, Admin audit event, and user notification.
- Admin and Manager approval use the same Serializable approval service and conditional `PENDING` claim. Repeated approval is rejected. Concurrent approval can commit at most once; both actors use `day1-welcome:<userId>` as the canonical reference.
- Staff Admin cannot use the override; the route explicitly requires `adminType === SUPER_ADMIN`, in addition to a valid Admin session. The mutation requires same-origin POST.
- Cancellation has no refund feature: do not return wallet-paid rent, reverse existing wallet debits/ledger entries, or process off-platform or `RE_RENT_PENDING` cancellation refunds. The existing cancellation authorization, state checks, audit, and notification behavior remains as implemented.

### Implementation in this continuation

- Added `lib/signup-approval.ts` as the shared Serializable approval/credit/audit/notification transaction. The existing Manager approval path now delegates its APPROVE action to this service; Manager REJECT remains manager-scoped and does not touch the wallet.
- Added `app/api/admin/clients/[id]/signup/route.ts`, a same-origin Super Admin-only POST endpoint. The Admin client detail at `/admin/clients/[id]` shows the approval control only to Super Admins while the signup is pending.
- Added `tests/signup-approval.test.ts` covering credit and side effects, repeated and concurrent approval contention, and Manager ownership scope. Tests use in-memory mocks and do not construct or connect Prisma.
- No Prisma schema, migration, environment, README, or cancellation implementation was changed in this continuation. Existing uncommitted changes and files were preserved.

### Actual initial repository state and current verification

- At inspection before implementation: branch `main`, HEAD `a1dee6ead64b482037096db8b370696e6539b545`. The existing checkout already had extensive modified/untracked files; the full `git status --short --untracked-files=all` was captured in the continuation transcript. Do not reset, clean, stash, or overwrite those files.
- Current scheduler architecture verified in source: Supabase Cron calls `POST /api/internal/scheduler/process`; `lib/scheduler-auth.ts` requires a configured `SCHEDULER_SERVICE_SECRET` of at least 32 UTF-8 bytes and a Bearer header, and uses equal-length `timingSafeEqual` comparison before either job reaches Prisma. The route runs bounded daily progression through `syncDailyTaskProgress` and bounded Re-Rent candidate discovery. Re-Rent candidates wait for Manager settlement through the shared settlement service; the scheduler does not credit Re-Rent returns.
- `POST /api/internal/rerent/process` remains a thin authenticated compatibility wrapper over `processReRentBatch`; it contains no independent settlement implementation. Production should configure only the canonical scheduler route.
- Static local configuration check printed no secret values: the `SCHEDULER_SERVICE_SECRET` key was absent from local `.env*` files and the current process environment. Actual Vercel/Supabase configuration, secret presence, Cron schedule/run history, and deployed endpoint remain unverified and require the operator.
- Ran this continuation's focused signup tests: **3 passed, 0 failed**. Ran `npm run test:scheduler-unit`: **11 passed, 0 failed**; the two `SCHEDULER_*_BATCH_FAILED` log lines are expected in the failure-isolation tests.
- `npx tsc --noEmit`: passed. `npx prisma validate`: passed as schema validation; it did not connect to a database. `npm run build`: passed on Next.js 16.3.6, generated 90 static pages, and included `/api/admin/clients/[id]/signup` and `/api/internal/scheduler/process`. `git diff --check`: passed; Git printed existing LF-to-CRLF working-copy warnings. `next-env.d.ts` remained unchanged after build.
- No database access/query/write, migration, seed, E2E/Playwright, production/Supabase/Vercel operation, deployment, commit, push, or destructive Git operation was performed.

### Remaining operator work

1. Confirm intended runtime database identity and applied migration state; this continuation did not query a database.
2. After confirming the target and authorizing a disposable database, run focused HTTP/panel checks for Super Admin approval, Manager/Admin concurrent approval, exactly one INR 120 ledger credit, audit and notification, and denial for Staff Admin. The unit tests do not replace DB transaction verification.
3. Verify production `SCHEDULER_SERVICE_SECRET`, Supabase Vault values/extensions, the single Cron job and its run history, and the deployed endpoint through the operator's platform access. Do not infer these from local files or a successful build.
4. Perform authorized Admin login and user-facing panel checks only after the intended runtime database/migration state is confirmed.

The source implementation and local checks are complete; production configuration and database-backed behavior remain unverified, so this is not a production-readiness signoff.

**First task tomorrow:** ask the operator to identify the intended local/runtime database safely and authorize read-only migration-status verification. Do not restart the project or repeat completed source fixes. The project is not declared production-ready.

---

## Follow-up verification — approval hardening and local metadata (2026-10-02)

This is the newest verification record. It supersedes the prior section's statement that even the local test migration history was unknown; the remote/default database and production platform remain unverified.

### Signup approval review and fixes

- Reviewed the real Manager/Admin route diffs, shared service, client detail UI, and tests. Manager lookup and conditional claim both filter by that Manager's `managerId`; the Super Admin endpoint requires a valid Admin session, exact `SUPER_ADMIN` type, same-origin POST, and a client ID. The Admin client detail links the client to its assigned Manager for context. No staff Admin action is rendered; the server rejects non-Super-Admin access.
- Approval writes `APPROVED`/`ACTIVE`/legacy `DAY_1`, reads the current wallet balance, increments by INR 120, creates the canonical `WELCOME_BONUS` transaction with `day1-welcome:<userId>`, and writes actor-specific audit plus success notification in one Serializable transaction. A failure after the claim rolls the entire transaction back. Manager/Admin share this service and reference.
- Added a three-attempt retry for Prisma serialization error `P2034`. If contention persists, the service reports a conflict and both routes return 409; it never retries non-serialization failures. Replaced raw approval exception logging with stable event names. The Manager rejection response now reports rejection directly and does not contain unreachable approval response logic.
- Fixed Admin detail loading so client details and Admin identity are loaded together, Admin verification failures are visible, and approval failures use an alert state. The button remains guarded by the server; client-side visibility is not the authorization boundary.
- Expanded `tests/signup-approval.test.ts` to **5 passing tests**: Admin credit/ledger/audit/notification, repeated and concurrent claim behavior, Manager ownership scope, rollback under a transactional mock, and bounded serialization retries/exhaustion. These are mock tests only; they do not establish PostgreSQL concurrency behavior.
- Reviewed cancellation-related product copy: README explicitly says no cancellation refunds; no refund/reversal feature or cancellation financial change was introduced. Daily task progression, membership, and existing financial settlement rules were not changed.

### Database target and migration state

- Static inspection found several distinct configurations. `.env` points to a remote Supabase PostgreSQL target with a `postgres`-named configured role, but its exact environment/project is not owner-confirmed. `.env.local.test` points to loopback `housingpro_test`; `.env.production.audit.local` has a URL that could not be safely classified. No `.env*` was modified and no connection value was printed.
- After statically allowlisting the local test target only, read-only metadata confirmed `current_database() = housingpro_test`, `current_user = postgres`, server `127.0.0.1`, and that role is a PostgreSQL superuser. Read-only `prisma migrate status` and a direct metadata read of `public._prisma_migrations` found these six migrations applied, none rolled back: `0_init`, `20260928013424_add_admin_super_staff_and_login_tokens`, `20260929120000_add_verified_task_status`, `20260930031225_admin_permissions_not_null`, `20261001000000_manager_entered_rerent_return`, and `20261002000000_user_display_tier`. Prisma reported the schema up to date.
- This applies only to the local `housingpro_test` database. The remote Supabase target's identity/role, migration history, and backup/recovery state remain unverified. No DDL, migration, seed, reset, or data write was run.

### Vercel/Supabase scheduler inspection

- `.vercel/project.json` statically links this checkout to a Vercel project named `housing-pro`; this linkage is evidence of the local association, not owner confirmation that it is the authoritative production project. A read-only Vercel Production environment key listing showed `SCHEDULER_SERVICE_SECRET` is configured for that linked project. Vercel listed recent Production deployments as Ready, with the newest listed roughly two days old; those deployments do not prove this uncommitted checkout was deployed.
- Attempting to pull the linked Production environment into a unique temporary file solely to count the secret's UTF-8 bytes was rejected by automatic policy review. No secret value was retrieved or printed. The secret's deployed length therefore remains UNVERIFIED; do not bypass this restriction.
- `vercel.json`, `supabase/config.toml`, and `supabase/.temp/project-ref` are absent; the Supabase CLI is unavailable. No authoritative Supabase project was identified. Thus actual Cron schedule/destination and recent Cron execution history are UNVERIFIED.
- The route source exports POST only, uses Node.js runtime and force-dynamic execution, and checks configured Bearer auth before Prisma work. There is no source-level `maxDuration` override; the linked deployment's effective timeout/plan was not verified. The README's one-minute Supabase Cron destination is setup guidance, not proof of deployed configuration.

### Verification and exact next actions

- Database-free unit suite: **41 passed, 0 failed**. `npx tsc --noEmit`: passed. `npx prisma validate`: passed (schema validation only). `npm run build`: passed; 90 static pages generated and the Admin signup endpoint and canonical scheduler endpoint were present. `git diff --check`: passed with pre-existing Windows line-ending warnings. `next-env.d.ts` remained clean.
- Real Admin login/authentication and HTTP/panel workflows: **not tested**. Production/default database state: **not verified**. Production scheduler configuration/history and deployed secret length: **not verified**. No E2E, production DB access, deploy, commit, or push occurred.
- Next: (1) operator confirms whether the linked Vercel project `housing-pro` is authoritative and identifies the matching Supabase project/environment for the remote `.env` target; (2) use an approved safe method to verify the configured secret length without exposing it, and inspect Cron destination/history; (3) only after confirming any schema target's environment/role and recovery options, consider further DB actions; (4) test Admin-vs-Manager approval through HTTP/DB integration on a confirmed disposable database, including P2034 contention and exactly one wallet/ledger credit. Do not run against the unidentified remote database.

## Release configuration investigation — identity cross-check (2026-10-02)

### Vercel project identity

- Read-only Vercel account listing returned two distinct Next.js projects: `housing.pro` (project ID fingerprint `prj_l…CffB`, latest Production URL `housingpro-zeta.vercel.app`, updated about 3 days ago) and `housing-pro` (project ID fingerprint `prj_u…Egg1`, latest Production URL `housing-pro.vercel.app`, updated about 2 days ago). The local `.vercel/project.json` links this checkout to `housing-pro` (`prj_u…Egg1`). The local package name is `housing-pro`; the Git origin points to `mrnobody007k/Hosting.Pro`; these are clues, not proof of the production source of truth.
- Both project inspections report Next.js and no explicit root directory; available evidence does not establish canonical production domain or which Vercel project owns the intended release. A read-only domain lookup for `housing.pro` under the current Vercel account returned not found; this does not identify the custom production domain. No Vercel project setting or deployment was changed.
- **Operator confirmation required:** identify the authoritative Vercel project by full project ID and the canonical production hostname, and confirm whether the second Vercel project and linked Netlify site are active, stale, or unrelated. Do not change either project until this is resolved.

### Scheduler configuration

- Source confirms the canonical endpoint is `POST /api/internal/scheduler/process`, Node.js runtime, `force-dynamic`, and Bearer authentication via `Authorization: Bearer <secret>`. It requires `SCHEDULER_SERVICE_SECRET` to be at least 32 UTF-8 bytes and authenticates before any Prisma access. Non-POST requests are not exported by the Route Handler and therefore use framework method handling. The compatibility endpoint `/api/internal/rerent/process` is not the production scheduler target.
- Repository setup documentation specifies one Supabase Cron job each minute (`* * * * *`) calling the canonical route via `pg_net`, with a documented 30,000 ms HTTP timeout and secret/app-origin values in Vault. This is deployment guidance only. A read-only `vercel crons list` on the locally linked `housing-pro` returned no Vercel Cron jobs; this says nothing about Supabase Cron. No authoritative Supabase project linkage or Cron execution history is available locally, and the Supabase CLI/config/ref is absent.
- The linked Vercel project's Production environment key listing previously showed the `SCHEDULER_SERVICE_SECRET` name exists; the value and its length are unverified. Automatic policy review rejected a local environment pull intended only for a byte count. No attempt was made to retrieve or print the value. Safest next check: an authorized operator should use the platform's approved secret-safe validator to emit only configured/missing and UTF-8 byte-count/`>=32` booleans, without returning the value; do not copy it into chat, logs, or files.
- No source `maxDuration` override or `vercel.json` was found. The effective function timeout/runtime limits for the authoritative project are unverified, so compatibility with the documented 30-second `pg_net` timeout is not established. The account listing's recent deployment timestamps do not prove that this dirty local checkout is deployed or that those executions ran the scheduler.
- **Operator actions:** after confirming Vercel project ID and canonical hostname, verify its deployment's Node runtime/function duration; then inspect the matching Supabase project's Cron definition, Vault key presence without disclosure, and recent Cron run history. Confirm the single job targets the canonical hostname and path. Do not create or modify jobs as part of this investigation.

### Signup approval review and test evidence

- Final source review confirms the Admin route obtains authenticated Admin identity, rejects non-`SUPER_ADMIN`, and calls the shared approval transaction. The Manager route supplies the authenticated Manager identity and manager scope; cross-manager clients are not found. The service claims only `PENDING` status in a Serializable transaction, writes the one-time `day1-welcome:<userId>` ₹120 wallet/ledger credit, audit actor/action, and notification in that transaction, and retries Prisma `P2034` serialization conflicts at most three attempts before a safe conflict response. UI only offers the action to a Super Admin for a pending client and renders busy, success, and error states.
- The five focused approval tests are mocks. Their “concurrent” test shares a mutable mock state and does **not** model PostgreSQL isolation, real simultaneous transactions, or database rollback behavior. Rollback is likewise simulated. No database-backed approval integration test was run because the harness writes and no specific write authorization was provided. Real cross-role authorization and PostgreSQL concurrency remain unverified.

### Database status and release boundary

- Earlier read-only metadata for the explicitly allowlisted loopback `housingpro_test` reported all six repository migrations applied through `20261002000000_user_display_tier`; this is local only. No database command was run in this identity/scheduler cross-check. The remote `.env` Supabase target's environment, project, role, migration chain, and backup/recovery remain unverified; no remote query or mutation occurred.
- Required operator confirmation: classify the remote Supabase target as development/staging/production, match it to an authoritative project, confirm effective role and backup/recovery path, and then provide explicit authorization for any intended DB-backed test or schema change. Until then do not connect or write.
- No secret value was retrieved, no project/configuration was changed, no deployment or database operation was performed, and existing working-tree files were preserved.

## Continued safe release work — source audit and deployment evidence (2026-10-02)

### Source review and focused regression

- Reviewed Admin authorization (`requireAdminAuth` plus explicit Super Admin check on signup override), Manager ownership scoping and transaction claims, User wallet-backed booking/withdrawal flows, Manager deposit/withdrawal state transitions, task settlement, and cancellation policy. No confirmed safe source defect was established in the reviewed Admin/Manager/User paths that justified changing established financial or membership behavior.
- Added a signup-approval regression for an inconsistent pending account that already has the deterministic `day1-welcome:<userId>` ledger reference. The shared service rejects that state; the test verifies transaction rollback leaves signup pending and creates no second credit, audit, or notification. Renamed the overlapping in-memory claim test to make clear that it proves mock behavior only, not PostgreSQL concurrency.
- Focused approval suite now reports **6 passed, 0 failed**. This is database-free. PostgreSQL concurrency, real Admin authentication, and HTTP/panel behavior remain untested. No broad E2E was run.
- Scheduler source review reconfirmed `POST /api/internal/scheduler/process`, Node.js runtime, `force-dynamic`, Bearer auth through `SCHEDULER_SERVICE_SECRET` (minimum 32 UTF-8 bytes) before Prisma access. README documents one Supabase Cron run per minute via `pg_net`, with a 30-second request timeout. No `vercel.json` or route `maxDuration` is present; effective deployment function duration remains unknown. A read-only Cron listing on the locally linked Vercel project reports no Vercel Cron jobs; it does not verify Supabase Cron.

### Non-secret deployment identity evidence

| Candidate | Vercel project ID / Netlify site ID | Latest Production hostname and evidence | Repository/deployment evidence | Missing evidence |
|---|---|---|---|---|
| `housing.pro` | Vercel project `prj_lnoaPdJ3AUnggpiM8fH0e8JICffB` | Assigned hostname reported by project list: `housingpro-zeta.vercel.app`; latest Production deployment Ready at `housing-ahuyeqod1-mrnobody007k.vercel.app`, 2026-09-29 00:19 UTC | Team/account `mrnobody007k`; Git repository `Hosting.Pro`, branch `main`, production commit `452813069e2c602cfcdf0f3b8592c19ad070f4e6` | Owner confirmation of authoritative project/canonical hostname; deployment timeout and matching Supabase Cron/Vault evidence |
| `housing-pro` | Vercel project `prj_uKNFA4R8JyqWOhiKZbcKhRQDEgg1` (local `.vercel/project.json` link) | Assigned hostname `housing-pro.vercel.app`; latest Production deployment Ready at `housing-hon07ekmr-mrnobody007k.vercel.app`, 2026-09-30 23:45 UTC | Team/account `mrnobody007k`; Git repository `Hosting.Pro`, branch `main`, production commit `a1dee6ead64b482037096db8b370696e6539b545` (this checkout's HEAD; uncommitted changes are not deployed) | Owner confirmation of authoritative project/canonical hostname; deployment timeout and matching Supabase Cron/Vault evidence |
| `housingpromarket` Netlify site | Site ID `86f6b14a-9387-44af-af78-31655786c509` | Public site metadata hostname `housingpromarket.netlify.app`; latest **published** deployment Ready on 2026-09-28 16:45:33 UTC (commit `452813069e2c602cfcdf0f3b8592c19ad070f4e6`). Later deployment attempts on 2026-09-30 00:40 and 01:02 UTC errored; the latter used commit `a1dee6ead64b482037096db8b370696e6539b545` and branch `main`. | Netlify account `Hosting.Pro` (`mrnobody007k`); public site metadata links `https://github.com/mrnobody007k/Hosting.Pro`; public deploy metadata reports branch `main` | No custom domain is configured in public site metadata; owner confirmation whether this Netlify site is active/authoritative; no authenticated CLI session to inspect private build settings/logs |

- Vercel project metadata identifies both projects under team/account `mrnobody007k`; their latest successful Production deployments share the same `Hosting.Pro` Git repository and `main` branch but point to different commits. The linked Netlify site also links the same GitHub repository and `main` branch: its latest published commit matches the older `housing.pro` Production commit, while a later attempt for the `housing-pro` HEAD failed. This evidence narrows the history but cannot establish which hostname the owner considers canonical or which platform is authoritative. Neither project name, local link, commit recency, nor a generated hostname decides that business fact. No platform setting or deployment was changed.
- Netlify CLI is not installed, and no standard local Netlify auth config or `NETLIFY*` environment variable was found. A non-authenticated, read-only request to the public Netlify Sites/Deploys API using the existing site ID returned public metadata/history. No credential was obtained or exposed. Private Netlify settings/build logs remain unavailable.
- Secret-safe configuration limitation remains: a Production environment key listing showed the secret name on the locally linked Vercel project, but the value/length is unverified. An attempt to pull it solely to count bytes was rejected by automatic policy review. Do not retry through alternate retrieval. Authorized operator should run an approved in-platform check that returns only presence and UTF-8 byte count or a `>=32` Boolean, never the secret value.

### Checks run in this continuation

- Database-free unit suite `node -r ./scripts/tsx-windows-preload.cjs ./node_modules/tsx/dist/cli.mjs --test tests/*.test.ts`: **38 passed, 0 failed**. Expected scheduler failure-isolation tests emit `SCHEDULER_DAILY_BATCH_FAILED` and `SCHEDULER_RERENT_BATCH_FAILED` while passing.
- `node -r ./scripts/tsx-windows-preload.cjs ./node_modules/tsx/dist/cli.mjs --test tests/signup-approval.test.ts`: **6 passed**.
- `npx tsc --noEmit`: passed.
- `npx prisma validate`: passed; Prisma loaded environment variables from `.env` but performed schema validation only and did not connect to a database.
- `npm run build`: passed with Next.js 16.3.6; 90 static pages generated and both signup override and canonical scheduler API routes were included.
- `git diff --check`: passed after the focused test and handover edits; Git reports Windows LF-to-CRLF working-copy warnings for existing modified files.
- Read-only Vercel project listing/inspection, deployment listing/inspection, alias listing, and linked-project Cron listing; read-only public Netlify site/deploy metadata lookup. Netlify authenticated CLI status/private settings were unavailable; no deploy or setting mutation.
- No local or remote database connection/query/write, migration, seed, E2E, deploy, commit, or push was run. No `.env*` file was edited.

### Short operator checklist / next action

1. Confirm the authoritative target by full Vercel project ID **and** canonical production hostname; explicitly state whether `housingpromarket` Netlify (`housingpromarket.netlify.app`) and the other Vercel project are active, stale, or unrelated. Metadata shows all candidates have linked/deployed the same repository, so it cannot answer this owner-only production routing decision.
2. For the confirmed release target, verify repository/branch and deployment commit, Node runtime and effective function timeout, then check `SCHEDULER_SERVICE_SECRET` presence/length using an approved value-free validator.
3. Identify the matching Supabase project and confirm its environment/role before connecting. Through its operator UI, inspect the one-minute Cron destination and recent run history, plus Vault key presence without disclosing values. Do not modify job/settings here.
4. Confirm the database environment, effective role, migration status, and backup/recovery path before authorizing any database-backed test or schema operation.

**Checkpoint first action (superseded by the owner confirmation below):** obtain the authoritative Vercel project ID and canonical production hostname, and classify the second Vercel project and linked Netlify site. The owner has since confirmed the primary project; database and live scheduler verification remain outstanding.

## Primary Vercel target confirmed — deployment/source reconciliation (2026-10-02)

The owner has confirmed `housing-pro` (`prj_uKNFA4R8JyqWOhiKZbcKhRQDEgg1`) as the primary Vercel project. A canonical custom domain will be connected later; it is not yet confirmed or configured. The other Vercel project and Netlify site may be stale; neither was changed or disconnected.

### Read-only confirmed-project metadata

- `vercel project inspect housing-pro --json`: project ID matches the owner confirmation, account/team slug is `mrnobody007k`, framework Next.js, project Node version `24.x`, root directory unset.
- Latest Production deployment from read-only project listing: `housing-hon07ekmr-mrnobody007k.vercel.app`, state **READY**, created **2026-09-30 23:45:55 UTC**, GitHub repository `Hosting.Pro`, branch `main`, commit `a1dee6ead64b482037096db8b370696e6539b545` (the current checkout HEAD).
- Read-only Production environment listing targeted by project ID and parsed in memory to emit names only returned exactly: `AUTH_SECRET`, `DATABASE_URL`, `SCHEDULER_SERVICE_SECRET`. No values were printed or requested. `AUTH_SECRET` and `DATABASE_URL` are required by runtime code. `SCHEDULER_SERVICE_SECRET` is present by name, but its value/length is not verified. `PUBLIC_APP_URL` is optional when request origin is reliable and is not listed; set it only if the eventual custom-domain/proxy topology requires it. `TRUST_PROXY` is optional and must only be enabled behind a proxy that overwrites forwarded client IP headers.
- Deployment inspection exposes project Node `24.x` and Node.js Lambda runtime metadata (`nodejs:2`). Its available function/build metadata has no `maxDuration` or timeout value. The route source also has no `maxDuration`, and there is no `vercel.json`. Compatibility with README's 30-second Supabase `pg_net` timeout is therefore **not verified**; inspect the deployed function duration in Vercel's authorized function settings/metadata after the operator confirms it.

### Confirmed source/deployment mismatch

- The latest Production commit is HEAD, but the current repository status shows the canonical scheduler route and its services as untracked workspace files. `git cat-file` confirmed the deployed HEAD does not contain `app/api/internal/scheduler/process/route.ts`, `lib/scheduler-auth.ts`, `lib/daily-task-scheduler.ts`, `lib/rerent-scheduler.ts`, or `lib/scheduler-runner.ts`. The same deployed commit lacks `app/api/admin/clients/[id]/signup/route.ts` and `lib/signup-approval.ts`.
- Thus the deployment metadata does **not** prove that the documented scheduler endpoint or confirmed Super Admin signup override exists in the deployed application. No live HTTP request was sent, so no runtime response is claimed. These workspace changes must first be incorporated into a reviewed release commit and deployed through the owner-approved process before those features can be considered live; this task did not commit or deploy them.
- `.env.example` still names `RERENT_SCHEDULER_SECRET`, while current application code and README use `SCHEDULER_SERVICE_SECRET`. A repository search found no runtime consumer of `RERENT_SCHEDULER_SECRET`; this is a stale example-key mismatch. `.env.example` was not edited under the no-`.env*`-modification instruction. The actual primary Vercel environment has the expected `SCHEDULER_SERVICE_SECRET` name.

### Read-only operational verification procedure (not executed)

1. **Remote migrations:** operator first identifies the exact Supabase project/environment and role, verifies a recovery/backup path, and separately authorizes a read-only connection. Use a secure operator session bound explicitly to that target (never infer it from this checkout's `.env`). Before Prisma, read only `current_database()`, `current_user`, `inet_server_addr()`, and `transaction_read_only`; stop if any identity differs. Then run `prisma migrate status` and compare the full repository chain: `0_init`, `20260928013424_add_admin_super_staff_and_login_tokens`, `20260929120000_add_verified_task_status`, `20260930031225_admin_permissions_not_null`, `20261001000000_manager_entered_rerent_return`, `20261002000000_user_display_tier`. Do not run `migrate deploy`, `db push`, migration SQL, seed, or E2E as part of verification. This remote procedure was not run.
2. **Actual Admin login:** after database identity/schema compatibility is verified and an approved test account/environment is provided, perform a real browser login on the owner-confirmed production hostname or explicitly approved staging host; verify the returned Admin session through `/api/admin/me` and a permitted Admin page. Do not provision/change credentials or share them in logs/chat. No real login was performed.
3. **Supabase Cron:** after the matching Supabase project is confirmed, use its operator dashboard/read-only metadata to inspect the single `housingpro-scheduler` job (`* * * * *`), confirm its URL hostname/path is the approved deployment and `/api/internal/scheduler/process`, and review recent `cron.job_run_details` plus corresponding HTTP response status. Inspect Vault key names/presence only; never select decrypted secret values. Source README's SQL is deployment guidance and must not be executed to perform this check. No Supabase Cron/Vault/history access was performed.

### Current verification and next action

- No application source or test file changed during this continuation; the immediately preceding complete local run remains applicable: **38 database-free tests passed**, focused signup tests **6 passed**, TypeScript passed, Prisma schema validation passed without connecting to a database, production build passed (90 static pages), and `git diff --check` passed. This turn made read-only Vercel metadata calls and the Git-tree provenance check; no remote DB, platform setting, secret value, deployment, or `.env*` file was accessed/changed.
- **Next concrete action:** obtain an operator-confirmed Supabase project/environment and role, plus permission for a read-only target-identity/migration-status check. Keep Admin login and Cron-history checks blocked until their exact host/project is authorized. Separately prepare the reviewed release commit/deployment for the untracked scheduler and signup override only through the normal approved release workflow; no deployment occurred here.

## Supabase target identification and release preparation (2026-10-02)

### Static Supabase/database evidence (no connection made)

- `prisma/schema.prisma` configures PostgreSQL with `url = env("DATABASE_URL")`; it does not pin a Supabase project. No `supabase/config.toml`, `.temp/project-ref`, Supabase link, or project ref in tracked deployment config was found.
- Secret-safe parsing of local config identified `.env`'s `DATABASE_URL` as a Supabase pooler URL whose project reference is **`xopbnpadjtnmolchxyyo`**. This identifies the ref embedded in that local config only. There is no non-secret evidence connecting that ref to Vercel `housing-pro`, and its environment (development/staging/production), owner, and intended role are unconfirmed. Do not call it the production DB target.
- `.env.local.test`'s `DATABASE_URL` and `LOCAL_TEST_DATABASE_URL` classify as loopback `housingpro_test`; prior read-only local verification found all six migrations applied there. `.env.production.audit.local` has a `DATABASE_URL` entry whose value did not match a parseable PostgreSQL URL and could not be classified. Neither establishes the Vercel runtime target.
- Vercel `housing-pro` Production metadata confirms only that a `DATABASE_URL` key name exists. Its value/ref was not accessed. Thus the production Supabase project remains unidentified. No connection, query, or database write occurred.

### Least-privilege read-only verification after owner confirmation

1. Operator confirms the exact Supabase project reference, environment, and approved database endpoint, plus a recovery/backup path. Use a dedicated read-only database role with only `CONNECT`, required schema usage, and `SELECT` on migration metadata; no owner/superuser credential. Inject the endpoint through an approved secure runtime mechanism without placing it in shell history, logs, or `.env*` files.
2. Before Prisma, execute only read-only identity checks for `current_database()`, `current_user`, `inet_server_addr()`, and `current_setting('transaction_read_only')`; abort if database/project/environment/role does not match the operator's confirmation or the connection is not read-only.
3. With that explicitly selected datasource, run `prisma migrate status` (read-only) and compare the six migration names recorded above with repository migrations. If needed, select only `migration_name`, `finished_at`, and `rolled_back_at` from `public._prisma_migrations`. Do not run `migrate deploy`, `db push`, migration SQL, `db pull`, seeds, fixtures, or E2E as part of status verification. This procedure has not been executed remotely.
4. Actual Admin login is a separate later check: only after the database/schema is confirmed, use an owner-approved test account against the approved host and verify login plus `/api/admin/me`; do not create or repair accounts as part of login verification. No actual login has been performed.
5. Supabase Cron check is also separate: after the Supabase project is confirmed, use the project dashboard or read-only metadata to inspect job name/schedule/active state/destination and recent `cron.job_run_details`/HTTP status. Inspect Vault names/presence only, never decrypted values. Do not execute setup SQL or trigger a job. No live Cron evidence has been collected.

### `.env.example` documentation correction

- Replaced the stale example key `RERENT_SCHEDULER_SECRET` with runtime key `SCHEDULER_SERVICE_SECRET`; clarified that it is required by the canonical scheduler and authenticated compatibility route. The placeholder remains fake/example-only. No real secret was copied or touched.
- Runtime use, README and confirmed Vercel Production key name are consistent on `SCHEDULER_SERVICE_SECRET`; its configured value length remains unknown. No other `.env*` file was changed.

### Release-inclusion checklist (files remain unstaged/uncommitted)

- **Canonical scheduler:** include `app/api/internal/scheduler/process/route.ts`, `lib/scheduler-auth.ts`, `lib/scheduler-runner.ts`, `lib/daily-task-scheduler.ts`, `lib/rerent-scheduler.ts`, and `lib/scheduler-window.ts`; include its authenticated compatibility wrapper `app/api/internal/rerent/process/route.ts` and corresponding scheduler auth/window/runner/Re-Rent tests under `tests/`. Dependencies include `lib/prisma.ts`, `lib/client-day.ts`, and the current `lib/daily-task-progression.ts` progression service. Route is Node.js/force-dynamic, authenticates `SCHEDULER_SERVICE_SECRET` (32 UTF-8 byte minimum) before Prisma, and runs bounded 40-client daily and Re-Rent candidate batches.
- **Super Admin signup approval:** include `app/api/admin/clients/[id]/signup/route.ts`, `lib/signup-approval.ts`, the updated Super Admin control in `app/admin/clients/[id]/page.tsx`, shared Manager path `app/api/manager/signups/route.ts`, and `tests/signup-approval.test.ts`; include their auth/security dependencies (`lib/admin-auth.ts`, `lib/auth.ts`, `lib/security.ts`) in the reviewed change set. No dedicated new migration is introduced by signup approval; runtime requires the existing user/signup, wallet, ledger, audit, and notification schema.
- **Schema/migration alignment for the current full checkout:** include the modified `prisma/schema.prisma` and migration `20261001000000_manager_entered_rerent_return` (adds `Order.finalReturnAmount` and `RERENT_SETTLEMENT`) plus `20261002000000_user_display_tier` (adds `User.displayTier`). Release gate is the full ordered chain: `0_init`, `20260928013424_add_admin_super_staff_and_login_tokens`, `20260929120000_add_verified_task_status`, `20260930031225_admin_permissions_not_null`, and those two migrations. Verify status on the confirmed target before any release that depends on this schema; do not apply migrations in this task.
- The latest deployed Vercel commit is HEAD but these scheduler/signup route and library files remain untracked and absent from that commit. This checklist is preparation only; no staging, commit, or deployment was performed. Preserve the no-cancellation-refund policy and existing task/Re-Rent settlement rules.

### Tests and Git state

- `tests/signup-approval.test.ts`: **7 passed**. Coverage verifies exactly one ₹120 `WELCOME_BONUS` with deterministic reference and balance-before/after, Admin and Manager actor/action/target audit identity, repeat/overlapping mock claims, Manager ownership, rollback via transactional mock, pre-existing ledger reference rejection, and three-attempt P2034 retry/exhaustion. These mocks do not verify PostgreSQL isolation, concurrency, or actual DB rollback.
- `npm run test:scheduler-unit`: **14 passed, 0 failed**. It exercises Bearer auth, rotation/bounded scheduler behavior, independent failure handling, and Re-Rent settlement rules; it is database-free and not evidence of a live Cron run.
- `npx tsc --noEmit`: passed. `npx prisma validate`: passed schema validation only (Prisma printed that it loaded `.env`, but did not connect). `git diff --check`: passed with existing Windows LF-to-CRLF warnings. Production build was not rerun because application source/schema did not change in this continuation; the previous build on the same app source passed with 90 pages.
- Current branch remains `main`, HEAD `a1dee6ead64b482037096db8b370696e6539b545`, with the pre-existing broad modifications/untracked files preserved. `.env.example` is intentionally modified by the requested template correction; `tests/signup-approval.test.ts` remains untracked with the expanded test. Nothing was staged, committed, pushed, deployed, reverted, or deleted.

**Next exact action:** owner/operator identifies whether Supabase ref `xopbnpadjtnmolchxyyo` is the intended `housing-pro` runtime project (or provides the correct ref), labels its environment and least-privilege read-only role, and authorizes only identity/migration-status reads. Until that mapping is confirmed, do not connect, test Admin login, or inspect/trigger Cron on an assumed Supabase project.

## Remote target/access gate recheck (2026-10-02)

- Re-read this handover and the README safety/scheduler instructions before checks. `.env` still provides only a candidate Supabase pooler reference `xopbnpadjtnmolchxyyo`; `.env.production.audit.local` remains unclassifiable; the only positively identified DB endpoint is loopback `housingpro_test`. Prisma schema continues to select only `DATABASE_URL` and contains no project pin.
- Read-only Vercel Production key-name listing targeted to owner-confirmed `housing-pro` ID again returned `AUTH_SECRET`, `DATABASE_URL`, `SCHEDULER_SERVICE_SECRET`. Values were not read or printed. This cannot tie the Supabase ref in local `.env` to the remote Vercel `DATABASE_URL`. Previous secret pull was policy-blocked; no alternate secret retrieval/inspection was attempted.
- No Supabase CLI, Supabase local auth/config, or `SUPABASE_*` process environment names are available. The browser-surface inventory call timed out before returning any browser/session state, so it provides no evidence of dashboard access. Prior reports that Vault/`pg_net` were configured remain historical reports only; this pass could not verify them.
- **Remote checks not run:** no connection/query of current database, user, server, read-only mode or `_prisma_migrations`; no remote Prisma migration status; no Cron/job/history/Vault inspection. Exact blockers: no evidence mapping Vercel Production `DATABASE_URL` to project ref/environment, no verified least-privilege read-only DB credential/role, and no authenticated Supabase dashboard/CLI session for Cron metadata.
- Local loopback migration status is only the prior verification (`housingpro_test`, six migration rows applied, role previously reported as superuser); it does not resolve any remote state. Expected current schema chain remains the six migrations listed above.
- No app source changed during this recheck. Applicable database-free results from the preceding verification remain: approval tests **7/7**, scheduler/Re-Rent unit tests **14/14**, TypeScript passed, Prisma validation passed without a connection, and no production build rerun was needed. `.env.example`'s requested placeholder-name correction remains the only `.env*` change. No deployment, database operation, staging, commit, push, or discard occurred.
- **Next safe action:** have the deployment/database operator provide a non-secret confirmation (or use an approved value-free validator) that maps the `housing-pro` Production `DATABASE_URL` to a specific Supabase project ref and environment, and provision/authorize a read-only DB role for that target. Only after verifying those facts may identity and migration status be queried; Cron inspection separately requires authorized read-only access to that same confirmed Supabase project.

## Production DB read-only verification attempt — stopped at role gate (2026-10-02)

### Verified

- Operator confirmation now states Vercel `housing-pro` Production uses Supabase ref `xopbnpadjtnmolchxyyo`.
- Parsed `.env`'s `DATABASE_URL` entirely in memory and emitted only non-secret connection metadata: PostgreSQL/Supabase pooler host `aws-0-ap-south-1.pooler.supabase.com`, port `5432`, project ref `xopbnpadjtnmolchxyyo`, and configured role class `postgres`-named. The full URL, username/password, and URL query values were never printed. The parsed local connection's ref matches the operator-confirmed production project ref. Vercel's Production `DATABASE_URL` remains value-inaccessible, so its exact host/role is not independently attested beyond the operator's ref confirmation.
- No local evidence or authorized role metadata proves that the configured `postgres`-named credential has least-privilege read-only access. A role name is not proof of grants/read-only capability. Per the stop condition, **no remote database connection was attempted**.

### Not verified / blocked

- No `current_database()`, `current_user`, server address, transaction read-only mode, or remote `_prisma_migrations` query was run; production migration history and schema status remain unverified. The previous six-migration result applies only to loopback `housingpro_test` and its previously reported superuser role.
- Remote Cron/Vault/history remain unverified. Supabase CLI and local Supabase auth/config remain absent; no Supabase process environment names are present. The browser surface inventory timed out. Prior claims that Vault and `pg_net` exist are not current evidence. No job was read, triggered, created, or edited.
- No E2E, migration, seed, write, deployment, settings change, commit, push, or discard was performed. No application source changed in this check.

### Appropriate checks

- No application code or tests changed in this attempt. Most recent applicable focused results remain signup approval **7 passed** and scheduler/Re-Rent **14 passed**, TypeScript passed, and Prisma schema validation passed without a database connection. `git diff --check` was rerun after this handover update and passed with existing LF-to-CRLF warnings. No build rerun was needed.
- Scheduler and signup implementation dependency/migration checklist remains in the preceding release-preparation section. Both features remain untracked and absent from the latest deployed commit; tests do not establish live behavior or PostgreSQL concurrency.

- Final pre-stage verification found **203/203** manifest files and Git-normalized content matches, zero missing/extra paths, and exactly 60 modifications, 47 additions, and one intentional deletion. `git diff --check` passed. The original checkout remains on `main` at `a1dee6ead64b482037096db8b370696e6539b545`, with 108 existing status paths and its prior `.git/index` SHA-256 unchanged (`C540932C0A0BD52D17DF3F8BF67F815BA93378307BC9246D222F60A20942206F`).

**Next action:** provide/authorize an existing least-privilege read-only database role for confirmed project ref `xopbnpadjtnmolchxyyo` and attest its approved host/environment; separately provide authenticated read-only Supabase dashboard access for Cron metadata. Only then perform the read-only identity/migration and Cron-history checks.

## Latest continuation — source review and focused verification (2026-10-02)

### Changes completed in this pass

- Restored the approved homepage brand line: metadata now uses “Housing.pro — Online Property Rental & Re-Rental Marketplace”, the home hero shows “Discover. Rent. Re-Rent.”, and the tagline is visible in the hero. Replaced the “Earn” headline and changed guest calls to action to registration/sign-in routes instead of linking guests directly to the protected properties route. Files: `app/layout.tsx`, `app/page.tsx`.
- Clarified the support panel: it says no in-app contact is configured, and asks users to include a booking code only if they have separately received Housing.pro contact details. No contact information was invented. File: `app/user/support/page.tsx`.
- Added database-free regression tests for the homepage tagline/slogan and public CTA destinations, plus the support contact wording. Files: `tests/homepage-branding.test.ts`, `tests/support-copy.test.ts`.

### Source review evidence

- The Super Admin signup route checks same-origin, requires Admin authentication, rejects non-Super Admins, and calls the shared Serializable signup transaction. The service atomically claims only a pending signup, credits exactly INR 120.00, records matching wallet before/after balances and the deterministic welcome reference, then writes actor-aware audit and notification rows in that transaction. The Manager route supplies the authenticated Manager ID and the shared service scopes clients to that Manager. Unit mocks cover repeats, in-memory overlap, Manager ownership, rollback behavior, existing-credit rejection, and bounded P2034 retries. These mocks do **not** verify real PostgreSQL concurrency or rollback.
- Manager order cancellation updates order state and writes notification/audit only; the reviewed branch has no wallet credit, ledger reversal, or refund call. Existing Day task and final Re-Rent settlement code was not changed in this pass. No cancellation-refund feature was introduced.
- Scheduler source recheck confirms `POST /api/internal/scheduler/process`, Node.js runtime, `force-dynamic`, Bearer authentication against `SCHEDULER_SERVICE_SECRET` with a 32 UTF-8-byte minimum before Prisma job work, and independent bounded daily/Re-Rent jobs. README's expected Supabase Cron interval is once per minute with a 30-second `pg_net` request timeout. Deployed function timeout and live Cron status remain unknown.
- `/user` dashboard has no search/location input controls and reads the User properties API. That API returns active properties visible to the assigned Manager or global listings; property create/update is in the Admin properties API. The dedicated `/user/properties` listing retains its separate filters; they were not changed.
- A repository source/content and filename scan found no `Amazon` match (text search returned code 1, meaning no match). Git diff reports existing Windows LF-to-CRLF working-copy warnings only.
- Admin login was not exercised. The signup/scheduler implementations and other untracked work remain local and are not live solely because source checks pass.

### Verification in this pass

- Database-free tests: `node -r ./scripts/tsx-windows-preload.cjs ./node_modules/tsx/dist/cli.mjs --test tests/*.test.ts` — **42 passed, 0 failed**. Expected scheduler failure-isolation tests emit `SCHEDULER_DAILY_BATCH_FAILED` and `SCHEDULER_RERENT_BATCH_FAILED` while passing.
- Display-tier tests: `node -r ./scripts/tsx-windows-preload.cjs ./node_modules/tsx/dist/cli.mjs --test tests/display-tier.test.tsx` — **4 passed, 0 failed**.
- `npx tsc --noEmit` — passed.
- `npx prisma validate` — passed schema validation. Prisma loaded `.env`; it did not connect to a database.
- `git diff --check` — passed after this handover update; only existing Windows LF-to-CRLF working-copy warnings were reported.
- Production build was **not** rerun: Windows reported about **1,214 MB free physical memory** and 40.5 GB free on D:. The existing latest build result in the preceding checkpoint applies to its then-current source, not this small subsequent homepage/support copy edit. No E2E was run.

### External release status — still blocked/unverified

- Owner-confirmed primary Vercel project remains `housing-pro` (`prj_uKNFA4R8JyqWOhiKZbcKhRQDEgg1`). The prior handover's latest observed assigned hostname is `housing-pro.vercel.app`; latest observed Production deployment URL is `housing-hon07ekmr-mrnobody007k.vercel.app`. Canonical custom domain is not configured/confirmed. These are prior read-only observations, not a fresh platform check in this pass.
- Owner-confirmed intended Supabase ref is `xopbnpadjtnmolchxyyo`, but the configured DB role's least-privilege read-only status is unproven. No remote connection/query was made; production DB identity, current role/read-only mode, and migration state remain unverified. The prior local `housingpro_test` six-migration report is not production evidence.
- Supabase Cron/Vault settings and execution history, live scheduler response, configured secret byte length, effective deployed function timeout, and actual Admin login remain unverified. Source contract remains `POST /api/internal/scheduler/process`, Bearer `SCHEDULER_SERVICE_SECRET`, minimum 32 UTF-8 bytes; no job was read or triggered here.
- Current workspace still has broad pre-existing modifications and untracked files, including scheduler and signup implementation, tier schema/migration, this handover and new tests. Nothing was staged, committed, pushed, deployed, reverted, deleted, or connected to a database. The deployed commit does not contain untracked files; no source feature is represented as live by this pass.

### Next concrete action

Have the production operator provide an approved least-privilege read-only database role/connection for Supabase ref `xopbnpadjtnmolchxyyo` and attest the environment. Then run only the previously documented identity/read-only and six-migration-status checks. Keep production rollout gated on review/release of the local uncommitted changes, canonical hostname confirmation, and authorized read-only scheduler metadata; no owner action is needed for the local code/tests already completed.

## Authentication rate-limit follow-up (2026-10-02)

- Found and fixed a login abuse gap in `app/api/auth/login/route.ts`: invalid/missing User or Manager access tokens previously caused a PlatformSetting read and immediate 401 before the failed-login limiter. The route now validates the identifier/password shape, checks the identifier/IP buckets first, then reads the access-token setting; rejected access-token checks are recorded through the same failed-login path and return 429 when the bucket limit is reached. Access-token values are not logged.
- Added `tests/login-rate-limit.test.ts` with a database-free mock covering the ten-attempt identifier limit and a regression assertion that the access-setting query is after the limiter and rejected tokens are recorded. This does not exercise a real database, HTTP request, or cross-process locking.
- Read the installed Next.js 16 route-handler guide at `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` before modifying the handler; the change preserves the existing Web Request/NextResponse handler convention.
- Verification after the change: all `tests/*.test.ts` — **44 passed, 0 failed**; `npx tsc --noEmit` — passed. The separate `tests/display-tier.test.tsx` result from this same checkout remains **4 passed**. Prisma schema was unchanged; the immediately prior `npx prisma validate` remains applicable and passed without a database connection.
- Production build was not attempted: the pre-build system check showed **1,268 MB free physical memory** of 7,587 MB total, with 40.5 GB free disk. No E2E, database access, platform operation, `.env*` edit, or Git history change was made.

## Scheduler testability, URL example, and release verification (2026-10-02)

### Locally completed

- Extracted the canonical scheduler request gate into `lib/scheduler-handler.ts`. It returns `503` when the service secret is absent/too short, returns `401` for invalid Bearer authorization, and never invokes job callbacks until authorized. On an authorized request it invokes the independently handled daily and Re-Rent work and returns success/partial failure status. The route remains `POST /api/internal/scheduler/process`, Node.js runtime, forced dynamic, and `Cache-Control: no-store`.
- Added database-free handler tests for unconfigured and unauthorized requests not running callbacks and for authorized success/partial failure responses. Kept the default secret sourced from `process.env.SCHEDULER_SERVICE_SECRET`; tests can supply a non-production token directly without setting environment variables.
- Corrected `.env.example`: `PUBLIC_APP_URL` is now commented out and described as optional. Copying the example no longer activates a fake domain for origin checks or generated links. No real `.env*` file was accessed or changed in this continuation.
- Read the installed Next.js 16 route-handler guide before editing the route. Scheduler route behavior stays within the documented Web Request/Response handler model. Vercel function maximum-duration configuration reference: [Vercel function duration](https://vercel.com/docs/functions/configuring-functions/duration). Repository source specifies Node.js and bounded batches; no route-specific `maxDuration` is set. The effective deployed limit and the Supabase `pg_net` request timeout compatibility remain live configuration checks, not established by this source review.

### Verification run now

- Database-free `tests/*.test.ts`: **48 passed, 0 failed**.
- Display-tier suite `tests/display-tier.test.tsx`: **4 passed, 0 failed**.
- `npx tsc --noEmit`: passed.
- `npx prisma validate`: passed; Prisma reported loading `.env`, but no database connection/query was made.
- `git diff --check`: passed; Git emitted the existing Windows LF-to-CRLF working-copy warnings.
- Build was not run: available physical memory was about **1.5 GiB** at the check, and previous build attempts were deferred under constrained memory. No broad E2E, database operation, platform setting change, deployment, or Git-history operation occurred.

### Release state and remaining blockers

- Workspace remains on the existing dirty branch/tree, with earlier tracked modifications and untracked implementation/test/migration files preserved. Nothing was staged, committed, pushed, reverted, deleted, or deployed.
- Signup approval remains locally implemented with the approved Super Admin override and exactly one ₹120 welcome credit, atomic wallet/ledger/audit/notification effects, and Manager ownership checks. Regression mocks cover repeat/overlap, rollback, actor identity, and bounded serialization retries; they do not establish PostgreSQL concurrency or real Admin authentication.
- No cancellation-refund behavior was introduced. Existing daily-task, membership, and Re-Rent financial rules were preserved.
- Confirmed primary Vercel project remains `housing-pro` (`prj_uKNFA4R8JyqWOhiKZbcKhRQDEgg1`); the canonical custom domain remains unconfirmed/unconfigured. The production Supabase ref is owner-confirmed as `xopbnpadjtnmolchxyyo`, but the configured database role was not proven least-privilege/read-only, so no remote DB identity or migration query was run. Production Cron destination/run history, secret byte length, effective function timeout, and actual Admin login remain unverified. The current deployed commit predates the untracked scheduler/signup implementation, so these source changes are not live.
- Example configuration now leaves `PUBLIC_APP_URL` unset. Once the canonical hostname is confirmed by the owner, the operator must configure that HTTPS origin on the confirmed production project through the normal release process and verify auth callback/origin behavior; no Vercel settings were changed here.

**Next local action:** when adequate memory is available, run `npm run build` against this preserved tree and record the outcome. **Next external action:** owner/operator confirms the canonical production hostname and provisions/attests a least-privilege read-only DB role plus read-only Supabase Cron access; only then can production migration and Cron history checks proceed. Actual Admin login and production feature behavior require a reviewed release/deployment before they can be tested.

## URL, migration, scheduler, and build readiness follow-up (2026-10-02)

### Resource check and build decision

- Current check: about **1.22 GiB free RAM of 7.41 GiB** and **40.5 GiB free disk** on D:. The build was not started because memory remains constrained; disk is adequate. This is a local resource limitation, not a code/build failure. Recheck memory before the next build attempt.

### Source consistency review

- Migration directory contains the expected six ordered migrations: `0_init`, `20260928013424_add_admin_super_staff_and_login_tokens`, `20260929120000_add_verified_task_status`, `20260930031225_admin_permissions_not_null`, `20261001000000_manager_entered_rerent_return`, and `20261002000000_user_display_tier`. The current Prisma schema includes `Order.finalReturnAmount` and `User.displayTier`, matching the last two migration names/content. No migration was run in this continuation; remote state remains unverified.
- Canonical scheduler route reads `SCHEDULER_SERVICE_SECRET`; auth helper and README use the same name, and `.env.example` has no stale `RERENT_SCHEDULER_SECRET` entry. `POST /api/internal/scheduler/process` remains the canonical route; `/api/internal/rerent/process` is an authenticated compatibility endpoint. Both are Node.js/force-dynamic. The canonical route uses the tested handler gate before invoking bounded jobs.
- Signup approval remains wired through the Super Admin-specific client route and shared Manager service. Schema fields and migration references used by the service exist in `prisma/schema.prisma` and the existing migration chain. No change was made to refund, daily-task, membership, or Re-Rent financial behavior.
- Runtime configuration references found in application/library source: required `DATABASE_URL`, `AUTH_SECRET`, and `SCHEDULER_SERVICE_SECRET`; optional `PUBLIC_APP_URL` and `TRUST_PROXY`; seed/provisioning variables are operator-only. `.env.example` documents these runtime keys and keeps its public URL unset by default. No secret values were read or printed.

### Login and domain replacement review

- Successful login redirects only to fixed role paths (`/user`, `/manager`, `/admin`); no request-supplied redirect target is used.
- Registration carries an invite URL through session storage only when it matches `/login/` plus exactly 64 hexadecimal token characters; otherwise it falls back to `/login`. The access token is not put in an external redirect or hostname.
- Admin-generated User/Manager access URLs use `PUBLIC_APP_URL` when configured, otherwise the request's current origin. This supports temporary Vercel URLs and later custom-domain replacement without inventing a canonical hostname. `PUBLIC_APP_URL` parsing requires an HTTPS origin with no path/query/fragment/credentials. The owner has not confirmed/configured the canonical domain, so no production value was set.
- No confirmed URL, login redirect, callback, migration/schema, or environment-name defect was found in this review; no further source edit was justified.

### Verification and state

- No source changed after the preceding complete verification: database-free tests **48/48**, display-tier **4/4**, TypeScript, Prisma validate, and `git diff --check` all passed. Prisma validation loaded local `.env` but made no database connection. The production build was not attempted for the memory constraint above.
- Existing modified and untracked files remain preserved. No E2E, database access/write, migration, platform setting change, deploy, stage, commit, push, or discard occurred.

**Next local action:** retry `npm run build` after free RAM is materially higher, then record the actual build result. **Remaining external blockers:** confirm/configure the canonical hostname; obtain authorized least-privilege read-only access to verify production database identity/migrations and Cron history; release the reviewed local changes before real Admin login or live scheduler behavior can be tested. Production behavior is not claimed as verified.

## Release inventory and fresh Vercel artifact metadata (2026-10-02)

### Git inventory and review

- Current tree: **61 tracked paths changed** (60 modified, one deleted) and **44 individual untracked files** (the earlier count of 27 referred to grouped status entries, not all files). Branch `main`, local HEAD `a1dee6ead64b482037096db8b370696e6539b545`. Changes remain preserved and unstaged.
- Reviewed tracked changes by group: environment/docs/build/test setup; Admin/Manager/User routes and UI; authentication/session/security; order debit and daily/Re-Rent settlement; Prisma schema and seed/provisioning safeguards; homepage/support copy and supplied asset. No accidental path deletion or missing import was identified. Deleted `scripts/rerent-worker.mjs` has no remaining references; the documented replacement is the bounded authenticated HTTP scheduler plus manager-approved Re-Rent settlement. `public/ASSET-CREDITS.md` is included with the supplied homepage asset.
- Untracked implementation inventory: `app/api/admin/clients/[id]/signup/route.ts`, `app/api/internal/scheduler/process/route.ts`, `app/api/user/tier/route.ts`; `app/user/TierBadge.tsx`, `app/user/tier/page.tsx`, `app/experience.css`; `lib/daily-task-scheduler.ts`, `display-tier.ts`, `login-account.ts`, `login-rate-limit.ts`, `order-cancellation.ts`, `rerent-scheduler.ts`, `scheduler-auth.ts`, `scheduler-handler.ts`, `scheduler-runner.ts`, `scheduler-window.ts`, `seed-safety.ts`, `signup-approval.ts`; two migration directories listed below; homepage image and credit file; 16 database-free test files; five E2E specs/helpers; and this handover. No source issue found justifies changing existing financial behavior or the confirmed no-refund policy.

### Required release set and compatibility notes

- Primary deployment target: owner-confirmed Vercel project `housing-pro`, ID `prj_uKNFA4R8JyqWOhiKZbcKhRQDEgg1`, team `team_zCEYpXOVKxgTzhvrBqRynUtL`. Current aliases from the latest deployment include `housing-pro.vercel.app`; canonical custom domain remains unconfirmed. Do not substitute a guessed domain.
- Core application files in this change set include the modified Admin/Manager/User API and UI paths in the tracked diff, auth/security helpers, `prisma/schema.prisma`, `lib/rerent-settlement.mjs`, plus the new signup approval, scheduler, display-tier, login, and seed-safety modules listed above. Scheduler and signup routes import Prisma/auth/services as recorded in the earlier release checklist. The old worker deletion and changed financial APIs must be reviewed together with their UI and migration changes.
- Schema release dependencies: `prisma/migrations/20261001000000_manager_entered_rerent_return/migration.sql` (Re-Rent final-return and settlement type) and `prisma/migrations/20261002000000_user_display_tier/migration.sql` (display tier), ordered after the four existing migrations. Do not release code depending on these fields until migration state has been verified and the migration plan approved for the confirmed environment.
- Runtime environment names: required `DATABASE_URL`, `AUTH_SECRET`, `SCHEDULER_SERVICE_SECRET`; optional `PUBLIC_APP_URL` and `TRUST_PROXY`. `PUBLIC_APP_URL` must be the eventual canonical HTTPS origin if required by proxy/origin behavior; it remains unset in `.env.example`. The seed/provisioning variables in that template are operator-only and must not be treated as runtime deployment requirements.
- Compatibility: `POST /api/internal/scheduler/process` is the canonical new route; `/api/internal/rerent/process` remains an authenticated compatibility alias. Supabase Cron must target only the canonical endpoint. The scheduler secret must be the same value in Vercel and Supabase Vault and at least 32 UTF-8 bytes; value and length are not exposed/verified here. Runtime is Node.js. No schema changes were applied.

### Latest read-only Vercel evidence and deployment inclusion

- Read-only `vercel list housing-pro` and `vercel inspect` targeted the owner-confirmed project ID/team. Latest Production deployment observed: `housing-hon07ekmr-mrnobody007k.vercel.app`, Ready, created **2026-09-30 23:45:55 UTC**, aliases include `housing-pro.vercel.app`. Vercel list metadata associates it with repository `Hosting.Pro`, branch `main`, commit `a1dee6ead64b482037096db8b370696e6539b545` (same SHA as local HEAD) and reports `gitDirty=1`.
- The inspected deployment artifact has a `api/internal/scheduler/process` route entry and a `manager/signups`/`api/manager/signups` entry. Its API artifact list did **not** include `api/admin/clients/[id]/signup` or `api/user/tier`. The scheduler function artifact reports Node.js 24 with a 300-second timeout. This proves those route artifacts are present/absent in this deployment, not their runtime auth behavior or exact source equality with the current checkout.
- Because Vercel reports `gitDirty=1`, matching Git SHA alone does not establish the exact source snapshot used to build the deployment. The Super Admin override route and display-tier API are conclusively absent from its artifact list; the scheduler route exists but its exact tested implementation is not established by artifact metadata. Do not state that signup override is live or that scheduler authentication/processing works in Production. No deployment or platform change was made in this task.

### Build and remaining verification

- Fresh system check: **1.26 GiB free RAM of 7.41 GiB**, **40.5 GiB free disk**. `npm run build` remains deferred because available memory is low; no failure was induced. The latest source-level green results remain 48 database-free tests, 4 display-tier tests, TypeScript, Prisma validate, and `git diff --check` from the immediately preceding unchanged-source checkpoint.
- No E2E or database operation was run. Production DB migration state/read-only role, live Admin authentication, Supabase Cron configuration/history, secret byte length, canonical custom hostname, and actual scheduler request behavior remain unverified. Keep every existing modification and untracked file intact.

**Next exact action:** once at least several GiB of free RAM are available, run `npm run build` and address any reproducible local build error. Before release, reconcile the dirty-source Vercel artifact provenance, verify production migration state with an authorized read-only role, and confirm Cron/Vault settings and canonical hostname; then release the remaining unshipped approval/tier files through the approved workflow. No external release operation is authorized in this task.

## Signup/tier deployment mismatch investigation (2026-10-02)

### Evidence and cause

- Re-read this handover and Git status first. Tree remains `main` at `a1dee6ead64b482037096db8b370696e6539b545`, with **61 tracked changes (60 modified, one deleted) and 44 untracked files**. No tracked/untracked work was discarded or staged.
- Resource check at start: **1.30 GiB free RAM of 7.41 GiB**, **40.5 GiB free D: disk**. The build was deferred; this is insufficient headroom for another Next production build. No build failure occurred.
- Source files exist locally at `app/api/admin/clients/[id]/signup/route.ts` and `app/api/user/tier/route.ts`; both are untracked, as are their associated new libraries/components. Local `.next/server/app-paths-manifest.json` maps both API paths, and `.next/server/app/api/.../route.js` compiled files exist for both, timestamped **2026-10-02 19:54 local time**. This proves the local Next output contains the routes; without the build process log it is not recorded as a successful `npm run build` in this continuation.
- Read-only commands: `vercel list housing-pro --scope team_zCEYpXOVKxgTzhvrBqRynUtL --limit 5 --json`; `vercel inspect housing-hon07ekmr-mrnobody007k.vercel.app --json`. Latest observed Production artifact was Ready, created 2026-09-30 23:45:55 UTC, tied in list metadata to commit `a1dee6ead64b482037096db8b370696e6539b545`, with `gitDirty=1`. Its output contains `api/internal/scheduler/process` and `api/manager/signups`; it does not contain `api/admin/clients/[id]/signup` or `api/user/tier`. The scheduler artifact has Node.js 24 and timeout 300 seconds.
- **Exact proven mismatch:** the current local source/build output contains the two APIs, while the inspected deployed artifact does not; both API source files are absent from the referenced Git commit because they are untracked. Vercel's `gitDirty=1` means the commit SHA cannot reveal which dirty source snapshot was used. There is no evidence of a `.vercelignore` exclusion or source compilation failure, and the current local Next manifest shows the routes are discoverable. Therefore the release fix is to include the intended files in the reviewed release source snapshot and verify the resulting production artifact; do not assume either missing route is live.
- Existing UI and server authorization source checks: signup POST enforces same-origin, Admin session, and explicit `SUPER_ADMIN` before calling the shared service with `actor.type='ADMIN'`; shared Manager approval passes authenticated `managerId`, and the service scopes its transaction to that Manager. User tier GET requires a User session and queries by both session user ID and manager ID. Admin tier PATCH requires `MANAGE_USERS` or Super Admin and validates the tier enum. Tier migration dependency is `20261002000000_user_display_tier`; signup approval uses existing signup/wallet/transaction/audit/notification schema. Runtime names remain `DATABASE_URL`, `AUTH_SECRET`, and `SCHEDULER_SERVICE_SECRET`; no new env key is required by either route.

### Focused regression coverage and checks

- Added `tests/release-route-policy.test.ts` to protect route-level Super Admin ordering, Manager actor/ownership scope, User tier ownership, and Admin tier permission/enum validation.
- Focused test: `node -r ./scripts/tsx-windows-preload.cjs ./node_modules/tsx/dist/cli.mjs --test tests/release-route-policy.test.ts` — **3 passed, 0 failed**.
- `npx tsc --noEmit` — passed after adding the test. `git diff --check` — passed. No code behavior changed in this addition; the earlier 48 database-free tests and 4 display-tier tests remain the last full-suite run, while this new test adds three passing cases. No DB/E2E/platform mutation occurred.

### Safe release sequence (prepared only; not executed)

1. Resolve/approve production migration status first using the confirmed Supabase project and a verified least-privilege read-only role. Establish backup/recovery and approve the migration plan before any schema write. This step remains blocked; no DB access was attempted.
2. In the approved source-control release workflow, include the signup route/service, Manager shared approval route, client-detail UI, display-tier API/library/UI, both required migrations and all required existing modified source, environment template/docs, tests, and the homepage asset/credit file. Review the removed worker together with its scheduler replacement. No staging/commit/push was done here.
3. Build and run focused tests/TypeScript/Prisma validation on that exact release snapshot. Confirm the three runtime variable names are set on `housing-pro` by name/presence only; validate scheduler secret length through an approved secret-safe operator check and keep its same value in Vault. Set `PUBLIC_APP_URL` only after the owner confirms the canonical HTTPS hostname.
4. After migration approval and explicit release authorization, deploy to Vercel project ID `prj_uKNFA4R8JyqWOhiKZbcKhRQDEgg1`; do not target either potentially stale Vercel project or Netlify.
5. Read-only inspect the resulting Ready Production deployment. Require the expected release commit SHA and `gitDirty` absent/false; confirm artifact output includes `api/admin/clients/[id]/signup`, `api/user/tier`, and `api/internal/scheduler/process`, with Node runtime/timeout compatible with the Cron HTTP timeout. Check deployment build logs/status for errors.
6. Only after the new artifact is live, run an owner-approved real Admin login and safe signup-approval integration using an approved test client. Verify the one-time ₹120 ledger/audit/notification effects without repeating approval. Separately inspect Supabase Cron job destination, schedule, Vault key names/presence, and recent run history using authorized read-only access; do not trigger settlement as a verification shortcut.

No release step above was executed. Production database identity/migration history, Cron/Vault/run history, actual Admin login, exact live scheduler authentication/processing, canonical custom hostname, and safe migration/recovery approval remain external blockers. No production behavior is claimed from local source/build metadata.

### Final working-tree checkpoint after this investigation

- Added one untracked regression test file, so the current tree now has **61 changed tracked paths plus 45 untracked files** (106 status paths total), branch `main`, HEAD `a1dee6ead64b482037096db8b370696e6539b545`.
- Focused route-policy test passed **3/3**; `npx tsc --noEmit` passed; `git diff --check` passed after this handover update. The previous full database-free suite was 48/48 and display-tier was 4/4; the new three cases were run separately, so the combined current expected total is 51 database-free tests, not rerun as one command.
- Final resource check: **1.35 GiB free RAM**, **40.5 GiB free disk**. `npm run build` remains deferred. No staging, commit, push, deploy, database operation, secret access, platform setting change, reset, or discard occurred.

## Release coverage and route inclusion follow-up (2026-10-02)

### Local checks and changes

- Rechecked resources before build: **1.39 GiB free RAM**, 40.5 GiB free disk. After the safe test work, the last check showed **1.44 GiB free RAM**. This remains too little headroom for the production build; `npm run build` was not started, and there was no build failure to diagnose.
- Added five checks to `tests/release-route-policy.test.ts`: route authorization order and Super Admin actor, Manager actor/ownership scope, User tier ownership/Admin write permissions, tier/Re-Rent schema-migration alignment, and required runtime environment names with no stale Re-Rent scheduler variable.
- Added `npm run test:unit` to `package.json` to run both database-free `.test.ts` and display-tier `.test.tsx` files through the installed Windows-safe TSX runner. This does not connect to a database.
- `npm run test:unit` — **57 passed, 0 failed**. `npx tsc --noEmit` — passed after the new test changes. `git diff --check` — passed. No source business-rule change was made; no Prisma validation rerun was needed because the schema/migrations did not change and migration consistency is covered by the focused tests plus the prior Prisma validation.

### Release file/dependency status

- Super Admin override route: `app/api/admin/clients/[id]/signup/route.ts` imports Prisma, `requireAdminAuth`, `approveSignupTransaction`, and same-origin validation. The route checks the Admin session and explicit `SUPER_ADMIN` type before service invocation; actor ID is the authenticated Admin ID. No new migration or environment variable is required; it uses existing User/signup, Wallet, Transaction, AuditLog, and Notification schema. The shared Manager route still passes the authenticated Manager ID, and the transaction scopes the user by Manager ID.
- Tier read route: `app/api/user/tier/route.ts` requires a User session plus manager ID and queries on both. Admin tier updates use the existing client detail PATCH route, require `MANAGE_USERS` or Super Admin, validate the enum, and audit the change. Its schema dependency is `20261002000000_user_display_tier`; the route/library/page/badge all remain untracked and must be included together.
- Release environment names: `DATABASE_URL`, `AUTH_SECRET`, and `SCHEDULER_SERVICE_SECRET`; the two routes introduce no new env vars. `PUBLIC_APP_URL` stays optional until the canonical HTTPS hostname is confirmed.
- Local `.next/server/app-paths-manifest.json` and compiled API outputs contain both missing paths. The latest inspected Vercel Production artifact does not contain either one. Both route sources are still untracked and absent from the deployment's associated commit; this is the proven inclusion mismatch. `gitDirty=1` remains ambiguous metadata, not proof of which exact source was deployed. Do not claim either API works in Production based on local artifacts.

### Verification categories

- **Established from source/tests:** the Super Admin route's authorization boundary; the one-time ₹120 shared approval transaction and mock retry/rollback/duplicate protections; Manager ownership scoping; User/admin tier authorization; schema fields and local migration-file consistency; required env names; local compiled route presence.
- **Not established locally or by the deployment artifact:** PostgreSQL serialization/concurrency behavior, production migration application, a real Super Admin/Admin login, actual production approval effects, actual scheduler secret validity/authenticated processing, Supabase Cron/Vault configuration/history, or canonical custom domain.

### Next safe release sequence (no step executed)

1. Recheck memory and run `npm run build` when several GiB are free. Preserve the existing tree and capture the actual build log/result.
2. After release authorization, prepare a reviewed clean source snapshot that includes the two route files and all dependencies/UI/tests, the scheduler implementation, both schema migrations, updated schema, environment template/docs, and replacement for the old worker. Keep the source commit clean so deployment metadata does not report `gitDirty`.
3. Before any production migration, an authorized operator verifies production database identity and migration history with a least-privilege read-only role, confirms backup/recovery, and approves a migration plan. No production DB writes/migrations are authorized here.
4. Build/test the exact release snapshot (`npm run test:unit`, `npx tsc --noEmit`, `npx prisma validate`, `git diff --check`, `npm run build`). Confirm runtime env key names on Vercel `housing-pro` without viewing values; check scheduler secret length through an approved secret-safe mechanism. Configure `PUBLIC_APP_URL` only after canonical hostname confirmation.
5. After explicit release authorization, deploy only to Vercel project `housing-pro` ID `prj_uKNFA4R8JyqWOhiKZbcKhRQDEgg1`. Read-only inspect the Ready deployment and require the intended commit SHA, clean Git metadata, and artifact paths `api/admin/clients/[id]/signup`, `api/user/tier`, and `api/internal/scheduler/process`; verify runtime/timeout and build result.
6. Then perform approved live Admin/login and test-client signup checks, and separately inspect Supabase Cron/Vault names and run history through authorized read-only dashboard/metadata access. Do not trigger settlement merely to test the scheduler.

Current source/test work is complete for safe local checks. Remaining blockers are memory for a fresh production build and external operator access/approval for production DB identity/migrations, canonical hostname, deployment, real authentication, and Supabase Cron verification. No stage, commit, push, deploy, database operation, secret access, platform setting change, reset, or discard occurred in this continuation.

## Latest safe booking-flow correction (2026-10-02)

### Confirmed defect and fix

- The modified User booking API had departed from the manual/off-platform workflow: it immediately debited wallet funds, created a rent-debit `ADJUSTMENT`, and activated/paid the order. This contradicted the preserved manual payment/proof + Manager verification flow and the explicit “preserve existing manual payment” requirement.
- Restored `POST /api/user/orders` to create a `PAYMENT_PENDING` / `PENDING` order without wallet or ledger writes, while retaining existing property ownership/availability/price checks and transactional notification/audit. The endpoint response instructs the User to submit payment details.
- Restored a clear path from dashboard booking success to that booking's detail page. The detail page already submits an order-owned payment reference/proof to `/api/user/orders/payment`; its API checks same User and Manager ownership and changes only pending payment state pending Manager review. Updated property and Support copy so neither promises an immediate wallet debit.
- Added `tests/manual-order-payment.test.ts` to protect API state, absence of booking wallet/ledger debit, the dashboard detail link, and the existing payment proof flow. Extended `tests/order-cancellation.test.ts` to ensure Manager cancellation performs status/audit/notification changes only, without wallet/refund/reversal actions. These static-source/unit tests do not prove database transaction/concurrency behavior.

### Requirement status correction

- This section and “Active release requirements and implementation map” are authoritative where older notes conflict. The owner-approved Super Admin override grants the same one-time ₹120 welcome credit as Manager approval; the earlier text that says the Admin override grants no credit is superseded. It writes the authenticated Admin actor audit plus existing ledger/wallet/notification effects through the shared transaction. Mock regression coverage exists; PostgreSQL race behavior and live authentication remain unverified.
- Cancellation has no refund feature. The prior wallet-funded-booking cancellation narrative describes a historical source snapshot, not current new booking behavior. Existing ledger rows are not modified by this correction.
- The prior section “Existing-workflow audit” and its local manual-test checklist were edited to require manual payment/proof review and to include the Super Admin signup test. Older owner-decision and audit notes remain history, not current release instructions.

### Checks after this correction

- `node -r ./scripts/tsx-windows-preload.cjs ./node_modules/tsx/dist/cli.mjs --test tests/manual-order-payment.test.ts`: **2 passed, 0 failed**.
- `npm run test:unit`: **59 passed, 0 failed**, including signup approval, scheduler/Re-Rent, display tier, and booking-flow tests. Then one additional cancellation no-refund regression test was added; its focused run is recorded in the final status after it completes.
- `npx tsc --noEmit`: passed after the booking UI/API/test changes. `git diff --check`: passed after the booking changes (only existing Windows LF-to-CRLF warnings).
- No schema/migration change was made, so Prisma validation was not rerun; the already-recorded schema validation remains applicable to the unchanged schema. No DB, E2E, Vercel, Supabase, secret, deploy, commit, or platform configuration operation occurred.
- Memory was **1.26 GiB free of 7.41 GiB**, disk about **40.5 GiB free** at the latest pre-build check. `npm run build` was not started; this is a resource deferral, not a build failure.

### Release blockers and exact sequence

1. Recheck that the reviewed release snapshot contains all modified and untracked source, both required migrations, the Super Admin/Manager approval routes and shared service, scheduler route/runtime/auth modules, tier API/UI, the old-worker replacement, and all regression tests/docs/assets. Existing production artifact metadata showed approval/tier routes absent; `gitDirty=1` remains inconclusive for exact source provenance.
2. When there is several GiB of free RAM, run `npm run build` on this preserved tree and record the result; then confirm source-control review of the complete release snapshot. Do not interpret local `.next` artifacts as proof of a fresh successful build.
3. An authorized operator must confirm production database identity, least-privilege read-only access, applied migration history and backup/recovery plan before separately authorizing any production migration. No remote DB access/write/migration was performed here.
4. Confirm the future canonical HTTPS domain before setting public-origin config. Confirm production env names/presence and use an approved secret-safe check for `SCHEDULER_SERVICE_SECRET` length without retrieving the value.
5. Only with release approval, release to owner-confirmed Vercel project `housing-pro` ID `prj_uKNFA4R8JyqWOhiKZbcKhRQDEgg1`; read-only inspect a clean Ready deployment and require the expected source SHA plus `api/admin/clients/[id]/signup`, `api/user/tier`, and `api/internal/scheduler/process` artifacts.
6. After deploy, use authorized test credentials/client to verify real Admin login and one-time ₹120 effects; separately inspect Supabase Cron/Vault job metadata/history without triggering settlement. Do not report live behavior until those checks have evidence.

### Final verification for this continuation

- After the cancellation regression was added, focused `tests/order-cancellation.test.ts` run: **2 passed, 0 failed**. Together with the preceding 59/59 `npm run test:unit` result, all 60 current database-free unit tests passed across the full-suite and focused runs; the full suite was not rerun after adding that final isolated test.
- `npx tsc --noEmit` completed successfully after the cancellation test was added. `git diff --check` exited successfully after source and handover changes; Git printed only existing LF-to-CRLF working-copy notices.
- Reviewed the installed Next.js 16 `Route Handlers` and `use client` documentation under `node_modules/next/dist/docs/`; the changed API continues to use the documented Web `Request`/`NextResponse` handler convention, and the dashboard remains a Client Component for state, event handlers, and browser navigation. No version-specific incompatibility was found.
- Last resource check: **1.46 GiB free RAM of 7.41 GiB** and approximately **40.5 GiB free D:**. `npm run build` was deferred; no fresh build result exists for this continuation.
- The previous 57-test/TypeScript checkpoint was not redundantly rerun before code changes. This continuation reran the full database-free suite because booking source/UI and tests changed, then focused on the final cancellation test. Prisma schema/migration files did not change here, so Prisma validation was not repeated.
- Git working tree is preserved and unstaged; this continuation modified the booking API/dashboard/property page/Support page and cancellation test, added `tests/manual-order-payment.test.ts`, and updated this handover. All other pre-existing modifications, deletions, and untracked files remain. No stage, commit, push, deploy, remote/local database operation, migration, seed, E2E, platform setting change, secret access, reset, or discard occurred.
- **Local work completed this turn:** restored manual order-payment semantics and proof link, removed stale wallet-debit booking copy, protected no-refund cancellation behavior with a source regression check, clarified contradictory historical handover statements, and published the active requirement-to-source/test map.
- **External actions still needed:** wait for adequate memory and record a fresh production build; confirm production database/read-only role and migration history plus recovery plan; confirm canonical HTTPS domain and secret-safe scheduler setting validity; release approval and exact artifact verification on `housing-pro`; then separately verify real Admin login/₹120 effects and Supabase Cron/Vault history. Production, remote migration, and live authentication/scheduler behavior remain unverified.

**Next exact safe action:** once several GiB of RAM are free, run `npm run build` and record its result. Until then, do not access the remote DB or change deployment systems; the next production actions require the operator approvals/evidence listed above.

## Booking/schema consistency and release inventory verification (2026-10-02)

- Rechecked resources: **1.42 GiB free RAM of 7.41 GiB** at start and **1.40 GiB** after focused verification, with about **40.5 GiB free disk**. This remains below safe headroom for a production build, so `npm run build` was not started; no build failure is claimed.
- Reviewed the complete manual payment path against `prisma/schema.prisma`: `OrderStatus` contains `PAYMENT_PENDING`, `PAYMENT_SUBMITTED`, `PAYMENT_VERIFIED`, `ACTIVE`, and cancellation/Re-Rent states; `RequestStatus` contains `PENDING` and `PAID` among its values; `Order.paymentStatus` defaults to `PENDING`. New booking uses `PAYMENT_PENDING`/`PENDING`. User proof submission is scoped to session user and manager, claims pending state and records the proof/reference. Manager verification requires `PAYMENT_SUBMITTED`/`PENDING` plus a reference or proof, then changes to `ACTIVE`/`PAID`. No booking wallet or transaction write exists in the creation route. Dashboard/property UI and Support copy direct the user through the manual submission and Manager review path.
- Searched application API/UI/library code for refund/reversal/compensation behavior: no such cancellation behavior was found. README documents the approved no-refund rule; Manager cancellation only changes order state and records its existing audit/notification. Existing historical wallet-paid records are not modified by the booking correction.
- Expanded `tests/manual-order-payment.test.ts` to cross-check route states against Prisma enum/field definitions and Manager activation requirements. Added `tests/release-inventory.test.ts`, which checks the required signup/scheduler/tier/booking routes and dependencies, all six migration files, relevant unit tests, `.env.example`, README, handover, and homepage asset/credit file. It verifies the three required runtime variable names and that the handover records the missing Production approval/tier artifacts plus ambiguous `gitDirty=1` metadata.
- Focused command `node -r ./scripts/tsx-windows-preload.cjs ./node_modules/tsx/dist/cli.mjs --test tests/manual-order-payment.test.ts tests/release-inventory.test.ts`: **4 passed, 0 failed**. `npx tsc --noEmit`: passed after replacing an unsupported regex flag caught during the first type-check attempt. `git diff --check`: passed. The 59-case full suite from the previous continuation was not repeated; the changed manual-payment tests were focused-run, along with cancellation tests recorded above.
- Release inventory is present locally, not necessarily included in any release artifact: Super Admin signup override + shared Manager approval/service; canonical and compatibility scheduler routes + auth/runner/window libraries; User tier API/UI/Admin assignment; manual booking/payment detail APIs and UI; six migrations including `20261001000000_manager_entered_rerent_return` and `20261002000000_user_display_tier`; required environment names `DATABASE_URL`, `AUTH_SECRET`, `SCHEDULER_SERVICE_SECRET`; focused tests; `README.md`, this handover, and public asset credit. Continue to preserve the previously verified Production artifact mismatch: the observed deployment omitted the Super Admin signup and tier API routes, while `gitDirty=1` prevents attributing its exact source snapshot.
- No app source changed during this latest inventory pass. The only additions were focused static tests and handover evidence. No full suite, Prisma validation, DB, E2E, production setting, platform, or deployment operation was repeated or performed.

- Final pre-stage verification found **203/203** manifest files and Git-normalized content matches, zero missing/extra paths, and exactly 60 modifications, 47 additions, and one intentional deletion. `git diff --check` passed. The original checkout remains on `main` at `a1dee6ead64b482037096db8b370696e6539b545`, with 108 existing status paths and its prior `.git/index` SHA-256 unchanged (`C540932C0A0BD52D17DF3F8BF67F815BA93378307BC9246D222F60A20942206F`).

**Next action:** when free RAM is several GiB, run `npm run build` and record the fresh result. Then follow the already documented external verification/release sequence; do not infer production state from this source inventory or test evidence.

## Final continuation checkpoint — deployment source investigation (2026-10-02)

- Read this handover in full and recaptured working tree before investigation. Branch `main`; HEAD `a1dee6ead64b482037096db8b370696e6539b545`; 61 tracked changes, 47 untracked files, zero staged files. Changes were preserved.
- Read-only `.vercel/project.json` metadata confirms this checkout is linked to project ID `prj_uKNFA4R8JyqWOhiKZbcKhRQDEgg1`, team ID `team_zCEYpXOVKxgTzhvrBqRynUtL`. Read-only `vercel list housing-pro --scope team_zCEYpXOVKxgTzhvrBqRynUtL --limit 5 --json` returned five Ready Production deployments, all for repo `Hosting.Pro`, branch `main`, commit `a1dee6ead64b482037096db8b370696e6539b545`, all with `gitDirty=1`. The latest listed URL is `housing-hon07ekmr-mrnobody007k.vercel.app`.
- A fresh read-only `vercel inspect housing-hon07ekmr-mrnobody007k.vercel.app --scope team_zCEYpXOVKxgTzhvrBqRynUtL --json` produced no output after approximately 30 seconds and was interrupted. No new artifact route list was obtained. The prior successful inspect remains the latest artifact-level evidence: the Super Admin signup route and User tier route were absent. Because Git metadata remains dirty and artifact inspection did not complete, exact deployed-source provenance and current route inclusion remain unresolved; do not claim these routes are live.
- Current resource check: **0.87 GiB free RAM of 7.41 GiB**. No full build was run; it has not passed or failed. The full `npm run build` remains deferred until several GiB are available.
- Database and login checks were not attempted. Existing handover evidence says the remote DB target/least-privilege read-only role are not verified; no production database connection/migration query is safe yet. No authorized production Admin login credentials were available in this pass. Scheduler/Cron history and canonical hostname remain externally unverified.
- No source change, test rerun, build, database connection, secret access, platform setting change, stage, commit, push, deploy, reset, stash, or discard was performed. Existing verification remains route-policy 6/6, release-inventory 2/2, TypeScript pass, and `git diff --check` pass as previously recorded.

- Final pre-stage verification found **203/203** manifest files and Git-normalized content matches, zero missing/extra paths, and exactly 60 modifications, 47 additions, and one intentional deletion. `git diff --check` passed. The original checkout remains on `main` at `a1dee6ead64b482037096db8b370696e6539b545`, with 108 existing status paths and its prior `.git/index` SHA-256 unchanged (`C540932C0A0BD52D17DF3F8BF67F815BA93378307BC9246D222F60A20942206F`).

**Next action:** obtain an exact clean release source snapshot through the approved source-control workflow so the Super Admin signup-override and tier routes are included and deployment metadata is not dirty; then after explicit release authorization deploy only to the owner-confirmed project and inspect the resulting artifacts. Before any production migration, separately verify DB identity/migration state with an authorized read-only role and recovery plan. Retry full build once system memory is adequate.

## Resource check and final local release-coverage pass (2026-10-02)

### Build feasibility

- Initial resource check this turn: **1.23 GiB free RAM of 7.41 GiB**, about **40.5 GiB free disk**, Node.js **v24.21.0 x64**. The latest post-check remained below safe build headroom; `npm run build` was not run.
- Inspected the actual `next.config.mjs` and `package.json`: build script remains the full `next build`; the config has Turbopack root configuration and no custom Webpack config. The installed Next.js 16.3.6 docs say Turbopack is the default for `next build`.
- Reviewed the installed Next memory guide and v16 upgrade guide. `experimental.webpackMemoryOptimizations` applies to Webpack, so it will not reduce this default Turbopack build. `--experimental-debug-memory-usage` instruments/debugs memory rather than lowering required memory; `--experimental-app-only` and experimental compile/generate build modes are incomplete stages and are not substitutes for a full production build. Turbopack filesystem build caching is already enabled by default in this installed version; no project-supported setting was identified that safely reduces peak system RAM while preserving the configured complete production build.
- No build/configuration change was made. Do not lower Node's heap cap or switch bundlers just to force a pass: that may cause OOM or produce a non-equivalent release check. Retry the normal `npm run build` when several GiB of RAM are available.

### Inventory and regression coverage reconciliation

- Expanded `tests/release-inventory.test.ts` to check the local required release routes/dependencies, all six ordered migration files, runtime environment template and names, full `.test.ts`/`.test.tsx` globs in `test:unit`, the Playwright script/specs, README/handover and public asset/credit file. The test also asserts that the known Production artifact omission for the signup override/tier APIs and ambiguous `gitDirty=1` provenance remain documented.
- Coverage mapping is now checked alongside the inventory: `tests/manual-order-payment.test.ts` covers pending booking/schema states and manual proof/Manager activation; `tests/signup-approval.test.ts` plus `tests/release-route-policy.test.ts` cover the single ₹120 credit/effects, duplicate/retry/rollback behavior, Manager ownership and Super Admin server authorization; `tests/order-cancellation.test.ts` guards no-refund/no-ledger-reversal behavior; scheduler auth/handler/runner/window suites cover missing/short/invalid Bearer credentials and unauthorized callback suppression. These database-free and mock checks do not prove real Postgres races, login, or deployment behavior.
- Focused `tests/release-inventory.test.ts` after the expanded reconciliation: **2 passed, 0 failed**. `npx tsc --noEmit` passed after this test edit. Existing payment/schema focused checks (4/4), cancellation focused checks (2/2), and the previous full `npm run test:unit` (59/59) remain as recorded above; no unchanged full suite was repeated.
- Existing source inventory remains locally complete as tested. The inspected Production artifact still omits `api/admin/clients/[id]/signup` and `api/user/tier`, and `gitDirty=1` still prevents exact source provenance attribution. No claim that either API is live is authorized by the evidence.
- The only new file in this pass is `tests/release-inventory.test.ts`, expanded in place; all existing dirty and untracked work remains preserved. No `.env*`, source business behavior, schema, migration, deployment configuration, or platform setting was changed.

**Current next action:** run the unmodified full `npm run build` once several GiB of RAM are available. External blockers remain production database identity/read-only migration verification, canonical hostname, scheduler secret-safe/platform/Cron evidence, explicit release approval, and post-release artifact plus real authentication verification.

## Release-file snapshot and URL/domain handoff (2026-10-02)

### Exact checkout state observed before this documentation/test-only continuation

- Branch `main`, HEAD `a1dee6ead64b482037096db8b370696e6539b545`.
- `git diff --name-only`: 61 tracked paths changed (60 modified; one deletion, `scripts/rerent-worker.mjs`). `git ls-files --others --exclude-standard`: 47 untracked files. `git diff --cached --name-only`: zero staged files.
- Existing edits/untracked files remain intact. This is the checkout inventory, not an instruction to release every file without review. Before preparing any future release snapshot, rerun all three commands plus `git status --short --untracked-files=all`, compare the exact output, and review the full tracked diff. No staging/commit/push/deploy is authorized here.

### Release-critical source/file set

- **Currently untracked API routes that must be explicitly included and artifact-checked:** `app/api/admin/clients/[id]/signup/route.ts` (Super Admin-only approval override), `app/api/user/tier/route.ts` (authenticated User tier read), and `app/api/internal/scheduler/process/route.ts` (canonical authenticated scheduler). The Manager signup route `app/api/manager/signups/route.ts` is modified tracked code and calls the shared approval service. `app/api/internal/rerent/process/route.ts` is the modified tracked authenticated compatibility route. Do not claim any untracked route is deployed.
- **Approval/auth/scheduler/tier support:** `lib/signup-approval.ts`, `lib/scheduler-auth.ts`, `lib/scheduler-handler.ts`, `lib/scheduler-runner.ts`, `lib/scheduler-window.ts`, `lib/daily-task-scheduler.ts`, `lib/rerent-scheduler.ts`, `lib/display-tier.ts`, `lib/login-account.ts`, `lib/login-rate-limit.ts`, `lib/order-cancellation.ts`, and `lib/seed-safety.ts`; plus the modified `lib/admin-auth.ts`, `lib/admin-permissions.ts`, and `lib/security.ts` and existing `lib/auth.ts` dependency. The associated client-detail/Admin UI, `app/user/TierBadge.tsx`, `app/user/tier/page.tsx`, `app/experience.css`, and profile/shell/dashboard changes must travel with the routes.
- **Database compatibility:** schema `prisma/schema.prisma`; new migrations `prisma/migrations/20261001000000_manager_entered_rerent_return/migration.sql` and `prisma/migrations/20261002000000_user_display_tier/migration.sql`; plus the four existing prior migrations in the documented six-migration chain. Confirm the intended database history before any schema write.
- **Configuration and documentation:** modified `.env.example`, `README.md`, `PROJECT-HANDOVER.md`, `package.json`, `playwright.config.ts`, `next.config.mjs` (currently no change), and `public/ASSET-CREDITS.md` plus the supplied homepage image. Runtime names are `DATABASE_URL`, `AUTH_SECRET`, `SCHEDULER_SERVICE_SECRET`; optional `PUBLIC_APP_URL` and `TRUST_PROXY`. `.env.example` keeps the public URL commented/unset; never release a real local secret value.
- **Regression/release checks:** all database-free tests under `tests/` are included by both `tests/*.test.ts` and `tests/*.test.tsx` in `npm run test:unit`; critical coverage includes manual payment, signup approval/policy, cancellation, route authorization, scheduler auth/handler/runner/window, Re-Rent settlement, and tier policy. E2E specs/helpers under `e2e/` are source files only; they were not run in this checkpoint. The old `scripts/rerent-worker.mjs` deletion must be reviewed together with the scheduler replacement.
- **Known Production mismatch:** the last inspected `housing-pro` Production artifact did not contain the Super Admin signup route or tier API. It reported `gitDirty=1`; matching commit SHA does not prove the exact deployed source. Recheck deployment metadata/artifact paths only after an approved release; no route is considered live now.

### Temporary URL and eventual custom-domain procedure

1. While the canonical domain is unconfirmed, leave `PUBLIC_APP_URL` unset. `app/api/admin/login-access/route.ts` then uses the origin of the current request, so links follow the active temporary Vercel hostname. It generates `/login/[token]` for Users and `/manager-login/[token]` for Managers.
2. Keep those temporary URLs for current testing only; do not put an invented domain into config or documentation. The token paths already receive `Referrer-Policy: no-referrer` and `Cache-Control: no-store, max-age=0` from `next.config.mjs`.
3. After the owner confirms the canonical hostname, an authorized operator associates it with the confirmed `housing-pro` project and sets `PUBLIC_APP_URL` only to `https://<confirmed-host>` in the appropriate Production environment. The parser rejects non-HTTPS origins, credentials, paths, queries, and fragments. Do not change Vercel settings as part of this task.
4. After an approved deployment/configuration change, use the Admin login-access workflow to issue fresh User/Manager access URLs and verify the hostname, role-specific path/login, and redirects. Confirm the token paths retain no-referrer/no-store behavior. Do not expose generated tokens in logs, handover text, or screenshots.

### This continuation's changes/checks

- Added one focused check to `tests/release-route-policy.test.ts` for request-origin fallback, future configured origin usage, User/Manager token paths, and token-path response headers. Focused test run passed **6/6**; `npx tsc --noEmit` passed. The unchanged full unit suite was not rerun.
- Memory was approximately **1.1 GiB free of 7.41 GiB** at the initial check; no safe full-build headroom became available, so `npm run build` was not run. No application/configuration behavior was changed. Full build, Production DB/migration verification, canonical hostname confirmation, deployed route artifacts, Admin login, and scheduler/Cron verification remain outstanding.
- Final resource check after the focused tests: **0.86 GiB free RAM**. Final `git diff --check` passed (Git emitted only existing line-ending notices); tree remains at 61 changed tracked paths, 47 untracked files, zero staged files, branch `main` / HEAD `a1dee6ead64b482037096db8b370696e6539b545`.
- Expanded `tests/release-inventory.test.ts` now also asserts the handover's exact signup/tier/scheduler route list and temporary/custom-domain procedure. Its focused run passed **2/2**. `tests/release-route-policy.test.ts` passed **6/6**; `npx tsc --noEmit` passed after the route-policy test edit. No app source, environment, schema, or deployment setting changed.

## Final handover checkpoint for next account (2026-10-02)

- Latest recorded checks: route-policy tests **6/6 passed**; release-inventory tests **2/2 passed**; TypeScript passed; `git diff --check` passed. No reason to rerun these unless code changes.
- Full `npm run build`: **not run**. The prior last check showed **0.81 GiB free RAM**; the current handover-only session recheck shows **1.04 GiB free of 7.41 GiB**. The build has neither passed nor failed and remains deferred until sufficient RAM is available.
- Previously inspected Production artifact does not contain `api/admin/clients/[id]/signup` or `api/user/tier`; `gitDirty=1` leaves exact deployed source provenance unresolved. Do not claim these routes are live.
- Production database/migration state, real Admin login, scheduler/Cron run, and canonical domain remain **unverified**.
- Git was recaptured in this session: branch `main`, HEAD `a1dee6ead64b482037096db8b370696e6539b545`, 61 tracked paths changed (60 modified, one deleted), 47 untracked files, zero staged files. Recheck before relying on this snapshot for a later release. All existing changes remain preserved.
- No build, broad audit, test rerun, database operation, deployment, platform setting change, secret access, stage, commit, push, reset, stash, or discard occurred in this final handover pass.

### NEXT-ACCOUNT CONTINUATION PROMPT

Continue Housing.pro in this existing checkout. First read `PROJECT-HANDOVER.md`, then recapture actual Git status and inspect the relevant current source rather than trusting older summaries. Specifically reconcile the currently untracked Super Admin signup-override and User tier routes against the known Production artifact omission and ambiguous `gitDirty=1` provenance. Continue only safe, locally actionable fixes and focused tests; do not repeat already-passing checks without a code-change reason. Retry the full `npm run build` only when system memory has adequate headroom; partial build modes are not a substitute. Preserve the approved one-time ₹120 signup credit, Manager ownership checks, manual-payment booking flow, established task/Re-Rent financial rules, and no-cancellation-refund policy. Do not stage, commit, push, deploy, modify production settings, access secrets, or perform production database writes/migrations. Clearly distinguish source/test evidence from live database, Admin login, scheduler/Cron, deployment, and canonical-domain checks. Never claim Production-ready without a successful full build and verified external evidence.

## Safe release-source snapshot checkpoint (2026-10-02)

### Verified Git and deployment-source facts

- Rechecked the actual checkout: branch `main`, HEAD `a1dee6ead64b482037096db8b370696e6539b545`, 61 tracked paths changed (60 modified, one deleted), 47 untracked paths, zero staged. No files were staged, reverted, or discarded.
- `.vercel/project.json` contains the local link identifiers for `housing-pro` / project `prj_uKNFA4R8JyqWOhiKZbcKhRQDEgg1` and team `team_zCEYpXOVKxgTzhvrBqRynUtL`; `.gitignore` ignores `.vercel`. The five latest read-only Production metadata entries (recorded in the preceding checkpoint) identify the GitHub repository `Hosting.Pro`, branch `main`, the same commit SHA, and `gitDirty=1`. A fresh `vercel inspect` for the latest listed deployment timed out without artifact output. The preceding successful artifact inspection is still the latest artifact evidence and showed the signup-override and tier APIs absent.
- No `.vercelignore` or `vercel.json` exists at repository root. The critical route paths do not match any ignore rule. Therefore the available evidence shows the routes were not excluded by repository `.gitignore`; both are currently untracked and absent from commit `a1dee6e`. This explains why that Git commit cannot contain them. It does **not** establish which dirty source snapshot Vercel built, why the platform marked it dirty, or the exact present artifact contents. Do not infer those facts from `gitDirty=1`.
- `git config --show-origin --get core.excludesfile` and `status.showUntrackedFiles` are unset. `git check-ignore -v --no-index` showed the final `.env*` pattern overrode the earlier `.env.example` exception. Fixed `.gitignore` by reasserting `!/.env.example` after `.env*`; subsequent ignore checks confirmed `.env.example` is no longer ignored, `.env.production` remains ignored, and `.vercel/project.json` remains ignored. No environment file or value was read or changed.

### Precise release inclusion list for the route mismatch

| Feature | Required local paths | Current Git state | Dependencies / release requirement |
| --- | --- | --- | --- |
| Super Admin signup override and shared approval | `app/api/admin/clients/[id]/signup/route.ts`, `app/api/manager/signups/route.ts`, `app/admin/clients/[id]/page.tsx`, `lib/signup-approval.ts`, `lib/admin-auth.ts`, `lib/admin-permissions.ts`, `lib/security.ts`, `tests/signup-approval.test.ts`, `tests/release-route-policy.test.ts` | New Admin route, shared service, and two tests are untracked; Manager route, page, auth/permission/security files are modified tracked | Super Admin is checked server-side; Manager actor is scoped in shared service; transaction gives exactly INR 120 once, writes wallet/ledger/audit/notification atomically, and retries bounded serialization conflicts. No new migration or runtime environment name is needed for this approval feature. Real PostgreSQL concurrency remains unverified by mock tests. |
| User display tier | `app/api/user/tier/route.ts`, `app/api/admin/clients/[id]/route.ts`, `app/user/TierBadge.tsx`, `app/user/tier/page.tsx`, `app/user/UserShell.tsx`, `app/user/profile/page.tsx`, `lib/display-tier.ts`, `prisma/schema.prisma`, `prisma/migrations/20261002000000_user_display_tier/migration.sql`, `tests/display-tier.test.tsx`, `tests/release-route-policy.test.ts` | User API, badge/page/helper, tier migration, and tests are untracked; Admin API, shell/profile, schema are modified tracked | Requires migration `20261002000000_user_display_tier` before serving the tier API; Admin assignment permission and User self-scope are enforced in source. No new runtime environment name. |
| Scheduler / Re-Rent runtime already in this worktree | `app/api/internal/scheduler/process/route.ts`, compatibility route `app/api/internal/rerent/process/route.ts`, `lib/scheduler-auth.ts`, `lib/scheduler-handler.ts`, `lib/scheduler-runner.ts`, `lib/daily-task-scheduler.ts`, `lib/rerent-scheduler.ts`, `lib/scheduler-window.ts`, `lib/order-cancellation.ts`, `prisma/schema.prisma`, `prisma/migrations/20261001000000_manager_entered_rerent_return/migration.sql`, scheduler and settlement tests, `.env.example`, `README.md` | Primary scheduler route/libraries/tests/migration untracked; compatibility route, schema, env template and README modified tracked | Runtime names remain `DATABASE_URL`, `AUTH_SECRET`, `SCHEDULER_SERVICE_SECRET`; scheduler secret is required by source and must be set outside this checkout. No live Cron run is verified. Preserve existing task/Re-Rent accounting and the no-cancellation-refund rule. |

The Admin signup-override and tier endpoints, their helper/test files, and the tier migration are not in the current Git commit because they remain untracked. A future Git-sourced release must include these untracked files and all required tracked modifications in a reviewed clean commit/snapshot; the prior Production artifact omission cannot be corrected or verified by a file list alone. Keep all six repository migrations together and ordered. Do not deploy from this dirty source.

### Validation performed and source-snapshot decision

- Focused command: `node -r ./scripts/tsx-windows-preload.cjs ./node_modules/tsx/dist/cli.mjs --test tests/signup-approval.test.ts tests/display-tier.test.tsx tests/release-route-policy.test.ts tests/release-inventory.test.ts` — **19 passed, 0 failed**. This covers policy and mock transaction branches; it does not prove PostgreSQL concurrency or live authorization.
- `git diff --check` passed after the `.gitignore` and handover edits (only existing line-ending notices). No TypeScript source changed in this checkpoint; prior TypeScript pass remains recorded and was not repeated. `npm run build` was not run: free RAM was **0.97 GiB** before the focused tests and **1.38 GiB** at the final resource check; no build pass/failure is claimed.
- Did not create a release-copy directory or worktree. This is a broad dirty checkout with ignored local platform-link metadata and local environment files; no reviewed clean source snapshot can be generated from Git without first deciding which of 61 tracked edits and 47 untracked files belong. A partial manual copy could omit dependencies and would not resolve Vercel source provenance. Preserve the present tree and use the inclusion list above for the eventual reviewed source snapshot.
- No database connection, migration, seed, E2E, secret access, platform setting change, stage, commit, push, deployment, or destructive Git operation occurred.

### Remaining blockers and next concrete action

- **Source provenance:** have the release operator create/review the intended complete source snapshot through the approved source-control workflow, confirming that the two currently untracked API routes and their dependencies are included. Then inspect the resulting deployment artifact paths; do not deploy before separate release authorization.
- **Production checks:** database identity/read-only role/migrations, real Admin login, Supabase Cron/Vault history, canonical domain, and secret-safe scheduler setting validation remain unverified. Use documented authorized operator procedures; no remote database access was attempted here.
- **Build:** once several GiB of RAM are free, run the full `npm run build`; do not substitute an incremental/partial build.

**Next concrete action:** review and promote the complete source diff—including the untracked release files in the table—into an approved clean release snapshot; then verify the artifact contains `/api/admin/clients/[id]/signup` and `/api/user/tier` before any separately authorized deployment.

## Isolated release-candidate source snapshot (2026-10-02)

### Candidate and manifest

- Created the separate candidate directory `D:\marketplace-platform-phase5\housingpro-release-candidate-20261002-230306-c1e8a2ef`, outside the original checkout. The directory did not exist before the copy; it was created with a new unique suffix. The original checkout was not moved, reset, staged, or modified by the copy process.
- Candidate source file set was derived from `git ls-files --cached --others --exclude-standard`, not a handpicked route list. It includes **203 present source files**: all 157 indexed paths except the one intentionally deleted path, plus all 47 non-ignored untracked files. `scripts/rerent-worker.mjs` is intentionally absent because the source checkout deletes it. No ignored local environment files, `.git`, `.vercel`, `.netlify`, `.next`, `test-results`, or `*.tsbuildinfo` files were copied. `.env.example` is included; local environment values were not read.
- `RELEASE-MANIFEST.json` contains the Git state for each included path and its SHA-256, the six migrations, required runtime variable names, route inclusion assertions, and dependency maps for Super Admin signup approval, Manager approval, User tier, scheduler/Re-Rent, and the package/toolchain configuration. It also records the absent root `vercel.json` / `.vercelignore` and that the local Vercel project link is not part of the release source.
- Both `app/api/admin/clients/[id]/signup/route.ts` and `app/api/user/tier/route.ts` are physically present in the candidate and listed in the manifest. The tier route depends on `User.displayTier` and migration `20261002000000_user_display_tier`; scheduler/Re-Rent depends on `20261001000000_manager_entered_rerent_return`. All six repository migrations are present and ordered. Signup approval itself adds no migration or environment name.
- Candidate `node_modules` is a Windows directory junction to the original checkout’s dependency directory; package metadata and lockfile are copied. No install was run. The candidate contains no `.git` or `.vercel` link, so it is an isolated, locally verifiable source snapshot, not a Git-linked deployment checkout.

### Candidate validation

- Ran the focused candidate command `node -r ./scripts/tsx-windows-preload.cjs ./node_modules/tsx/dist/cli.mjs --test tests/signup-approval.test.ts tests/display-tier.test.tsx tests/release-route-policy.test.ts tests/release-inventory.test.ts`: **19 passed, 0 failed**.
- After copying this handover checkpoint into the candidate, reran `tests/release-inventory.test.ts`: **2 passed, 0 failed**. This confirms the final handover text still satisfies the candidate inventory assertions.
- Ran `npx tsc --noEmit --pretty false` from the candidate: **passed**.
- Ran `npx prisma validate` from the candidate with only a dummy loopback `DATABASE_URL` for schema parsing: **valid**. No DB connection was made.
- Candidate manifest verification checked all **203/203** recorded SHA-256 values, both route paths, and **6/6** migration directories. Full `npm run build` was not run; available RAM remained around 1 GiB before candidate checks, which is insufficient for the previously documented safe build headroom. No full-build success/failure is claimed.
- The candidate's test runner and type checker use the dependency junction. No package install, E2E, seed, migration, or database operation was performed.

### Vercel source evidence and limits

- Existing read-only deployment metadata for project `housing-pro` reports `githubDeployment=1`, repository `Hosting.Pro`, branch `main`, commit `a1dee6ead64b482037096db8b370696e6539b545`, and `gitDirty=1`. This supports GitHub-linked Git deployment as the observed source mechanism; Vercel documents Git provider deployments as commit/branch-triggered deployments ([Vercel Git deployments](https://vercel.com/docs/git)).
- The two target route files are untracked in the source checkout and therefore absent from commit `a1dee6e`; a deployment built solely from that commit would omit them. That is consistent with the prior inspected artifact omission, but does not prove the precise dirty source archive used for any listed deployment.
- The exact meaning of `gitDirty=1`, latest artifact bytes, and current deployed route presence remain unverified. The latest artifact inspect timed out. Do not claim the candidate is deployed or that Production contains either route.

### Original checkout preservation and next step

- After candidate creation and tests, the original checkout remains `main` at `a1dee6ead64b482037096db8b370696e6539b545`, with 61 tracked paths changed, 47 untracked files, and zero staged. No commit, push, deploy, production-setting change, secret read, or destructive operation occurred.
- The candidate does not replace the need for a reviewed Git release snapshot: release approval is still required to include this complete source diff in the approved version-control workflow, after which deployment artifact paths must be checked. Preserve the one-time INR 120 credit, Manager ownership, manual-payment, task/Re-Rent, and no-refund rules.

**Next concrete action:** review `RELEASE-MANIFEST.json` and the 203-file source snapshot with the release owner; after separate release approval, create the approved Git source revision and verify both route artifacts before deployment.

## Proposed Git release revision preparation (2026-10-02)

### Candidate packet

- The isolated candidate remains `D:\marketplace-platform-phase5\housingpro-release-candidate-20261002-230306-c1e8a2ef`. Its `RELEASE-MANIFEST.json` now includes source paths, Git state, SHA-256 values, dependency maps, migration list, route assertions, and checksums for two review artifacts: `PROPOSED-RELEASE-FILES.txt` and `PROPOSED-RELEASE-SUMMARY.md`.
- Proposed source delta is **60 modified tracked files, 47 added untracked files, and one deletion** (`scripts/rerent-worker.mjs`), based on current `main` HEAD `a1dee6ead64b482037096db8b370696e6539b545`. The candidate has 203 present source files (156 tracked files plus 47 untracked); the exact path/state/hash list is in the candidate file list. The two required routes, their helpers/UI/tests, and all six migrations are present in the candidate. The packet describes the one-time INR 120 approval, Manager scope, manual-payment booking, established task/Re-Rent logic, and no-refund rule.
- The original Git index was not changed and no source revision was staged or committed. The candidate is a source snapshot without `.git`; it is not itself a revision that Vercel can consume through the linked GitHub integration.

### Safe source revision procedure after approval

1. After release-owner approval of the manifest/file list, create a new isolated clone/worktree from the then-confirmed production branch; do not alter the existing `main` checkout.
2. Copy the reviewed candidate source paths into that isolated checkout, preserving the listed deletion. Verify all candidate source hashes and inspect the diff. Stage only the approved paths and create a new normal commit; do not amend or rewrite prior history. Push/merge only after separate authorization.
3. Existing read-only Vercel metadata reports GitHub-linked deployment source `Hosting.Pro`, branch `main`, with `githubDeployment=1`. The eventual approved revision must be on the project's confirmed Production branch; recent metadata shows `main`, but current automatic deployment settings were not verified. Vercel documents Git-provider deployments as built from commits/branches ([Vercel Git deployments](https://vercel.com/docs/git)).
4. After an authorized deployment, capture the new commit SHA and inspect the deployment's read-only route/function artifact inventory for `/api/admin/clients/[id]/signup` and `/api/user/tier`. Do not POST to the signup route or scheduler processing route to test their presence. If artifact inspection does not return route data, the operator must use the Vercel deployment's Build Output/Functions view; do not infer from a successful build alone.

### Checks and blockers

- Candidate focused tests **19/19**, `tests/release-inventory.test.ts` **2/2** after handover edits, TypeScript, Prisma validation, and all **203/203** source hash checks passed in the previous candidate checkpoint. No application source changed in this continuation; these checks were not redundantly rerun.
- Resource recheck was **1.45 GiB free RAM** before candidate TypeScript validation; final check is **0.98 GiB free of 7.41 GiB**, with approximately **40.48 GiB free disk**. Full `npm run build` remains deferred because RAM is below the previously identified several-GiB headroom. No build result is claimed.
- No source index, commit, push, deployment, database, migration, secret, or production setting was changed or accessed. Project's `gitDirty=1` meaning and prior deployed artifact bytes remain unresolved. Production migration state, live Admin login, scheduler/Cron run, and canonical domain remain unverified.
- **Specific approval needed:** owner approval to stage the exact candidate source delta and create a new non-rewrite Git commit in an isolated checkout. A separate approval is required before pushing/merging or deploying. Before that revision is created, recheck the remote Production branch and project Git linkage so the proposed base is current.

**Next concrete action:** obtain release-owner approval for the proposed manifest and change summary; then, only after that approval, create the normal release commit in a separate checkout based on the confirmed current Production branch.

## Isolated Git worktree preparation checkpoint (2026-10-02)

This pre-authorization checkpoint is superseded by the later sanitized-example review. At that point the worktree intentionally omitted the proposed `.env.example` modification and no paths were staged. The owner has since authorized the nonfunctional placeholder in this isolated worktree; see the later checkpoint for current verification.
## Isolated release staging authorization checkpoint (2026-10-03)

- The owner authorized replacing the `.env.example` database value with a clearly nonfunctional placeholder in this isolated worktree, plus a normal local commit only after the staged diff and exact path list are verified. The original checkout remains out of scope.
- `.env.example` contains only safe sample values: the approved nonfunctional `DATABASE_URL` placeholder, required `AUTH_SECRET`, and runtime `SCHEDULER_SERVICE_SECRET`; `RERENT_SCHEDULER_SECRET` is absent. No production hostname or credential was found. No real `.env` or `.env.local` was edited. Final file SHA-256 is in `RELEASE-MANIFEST.json`.
- Manifest/candidate/worktree comparison passed **203/203** source paths with zero missing, extra, or content mismatches (Git-normalized hashes for tracked files). Release delta is exactly **60 modified tracked paths, 47 additions, and one intentional deletion** (`scripts/rerent-worker.mjs`). Both required routes and all six migrations are included.
- Focused database-free environment/config/route-policy tests passed **10/10**. `tests/release-inventory.test.ts` passed **2/2** after the latest handover update. No PostgreSQL concurrency claim is made from mocks.
- Exactly **108** manifest-approved paths are staged: 60 modified, 47 added, and 1 deleted. The exact status/path list is recorded at `STAGED-RELEASE-FILES.txt` in the adjacent review packet. `git diff --cached --check` passed after removing one trailing blank line from `lib/daily-task-scheduler.ts`; the staged path set was reverified with no extras or omissions.
- Staged review covered Super Admin/Manager signup authorization and shared one-time ₹120 credit/audit/notification transaction, tier authorization/schema/migration, scheduler authentication and bounded work, login role isolation, manual-payment booking, Re-Rent accounting, and the no-refund cancellation branch. Mock tests do not establish live PostgreSQL concurrency or live production behavior.
- Original checkout preservation was verified: branch `main`, HEAD `a1dee6ead64b482037096db8b370696e6539b545`, 108 pre-existing status paths, and the prior index SHA-256 unchanged (`C540932C0A0BD52D17DF3F8BF67F815BA93378307BC9246D222F60A20942206F`).
- Free RAM was **1.20 GiB**, so the full production build is deferred; it has neither passed nor failed. No deployment, push, production database access, migration, platform setting change, or secret retrieval occurred.

**Next action:** confirm the packet's exact staged-path file and hashes one final time, then create the authorized normal local commit in this isolated branch. Record its commit SHA in the adjacent review packet. Push, merge, deployment, live database checks, Admin login, and Cron verification remain separate operator actions.