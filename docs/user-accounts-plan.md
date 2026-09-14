# Skeet Tracker account implementation brief

Prepared September 10, 2026. Planning checkpoint; no authentication implementation or access changes performed in this phase.

## Objective and agreed scope

Add invite-only shooter accounts while James continues field testing the current release. Each account represents one shooter. James alone invites users and has full administrative access to all records, with that access explained to users as assistance with importing records and correcting issues.

James's account email is jtdelosh@gmail.com. All existing live shoots, scores, notes, and classification settings must be assigned to this account through a controlled migration. Do not make the first visitor an administrator or assign existing data to the first registrant.

First release: invitations, passwordless email-code login and logout, private shooter records, basic account administration, audit records for administrative changes, and migration of James's data. Preserve existing scoring, preliminary/main handling, HOA/HAA, notes, search, pagination, and classification behavior.

Deferred: historical import tools, screenshot/PDF extraction, AI advice, multiple shooters per account, and full offline synchronization. Assess recovery of an unfinished shoot after a connection drop separately; do not silently include it in the account release.

## Environments and current state

| Environment | Live field testing | Account testing |
| --- | --- | --- |
| URL | https://sk33t.net | https://skeet-tracker-login-test.jtdelosh.chatgpt.site |
| Site ID | appgprj_6a9d4e9d4e0c8191a6d59d0110caa77e | appgprj_6aa28fd30fc0819180dd17a3c078983a |
| Checkout | C:/Users/James/Documents/Codex/Skeet-Tracker | C:/Users/James/Documents/Codex/Skeet-Tracker-Login-Test |
| Branch | main | feature/user-accounts |
| Hosted version at setup | 11 | 1 |
| Access | Owner-only | Owner-only |

Test baseline commit: e5f8693f9b85ff02f2e5c6c7d0c8776794559626. Branch is on GitHub and unmerged. Test D1 database is separate and has no shoots after the temporary verification record was removed. Existing build and 14 tests passed; hosted creation, reading, editing, and deletion were checked. No live database backup or migration has been performed in this planning phase.

## Hosting compatibility finding

Confirmed from current Sites documentation and the test Site's read-only settings:

- Sites audience controls and application authentication are separate. Private Sites require platform sign-in; public Sites may receive anonymous visitors.
- The current test Site offers both custom and public access modes. It remains custom/owner-only.
- The official developer guide identifies public sign-in/external identity as an authentication-enabled Site use case. Therefore a public entry page protected by application authentication is a supported architectural direction; a hosting move is not currently indicated.
- Current code has no application authentication. Every existing data endpoint must be protected before widening access. The settings PUT endpoint currently deletes/replaces global settings; it must become shooter-scoped, alongside dashboards and shoot CRUD.

Not yet proven: end-to-end custom session-cookie behavior on this exact hosted runtime and domain, Resend delivery from the hosted Worker, and the final visitor flow without ChatGPT sign-in. Documentation establishes the architecture, not a tested implementation. Do not describe the email-code solution as already verified.

First implementation milestone: establish a minimal session proof in the test environment, with existing tracker/data routes denied unless properly authorized. Verify secure cookie setting, receipt on subsequent requests, expiry, logout/revocation, and outbound HTTPS email API behavior. Test without a ChatGPT session once James explicitly approves changing the test audience. Never put platform bypass credentials in browser code or use them as application login.

Do not change either Site's access during planning. Before requesting a public-access test, prepare the protected build and evidence that anonymous requests cannot read or mutate data. The future audience change makes the login page reachable; it must not expose shooter records. If runtime behavior blocks this approach, stop broad account work and document the specific limitation before proposing a hosting alternative.

## Recommended invitation and login defaults

These implement the discussed direction; durations are proposed defaults rather than separately approved requirements.

1. James enters the recipient's email in the admin screen. Create an invitation bound to that email, expiring after seven days, revocable and resendable by James.
2. Recipient opens the invitation, requests a six-digit email code, and enters it to prove control of the invited mailbox. A forwarded invitation alone grants no access.
3. Recipient accepts the administrator-access notice and completes their shooter profile. Record the notice version and acceptance time.
4. Later sign-ins use email codes; no user passwords. Do not reveal whether an unrecognized email has an account.
5. Codes expire after ten minutes, are single-use, and have bounded attempts and resend cooldowns. Enforce counters server-side and atomically, including concurrent requests. Store a keyed digest of low-entropy codes; never plaintext codes or tokens in logs. New challenges must not permit replay or bypass attempt limits.
6. Use opaque, high-entropy server-side sessions with secure, HttpOnly, SameSite cookies, scoped to the exact host. Suggested session duration: 12 hours normally, 30 days with explicit Remember this device. Logout revokes the session; disabling an account revokes all sessions immediately. Do not share cookies between live and testing.
7. Require recent verification for sensitive admin actions and protect mutation endpoints against cross-site requests. Use a verified fixed application origin in emails rather than trusting request host headers.

Suggested user notice: "James Delosh administers Skeet Tracker and can view and edit your profile, shooting records, and notes to help upload historical records and correct issues. Other shooters cannot access your records. Administrative changes are logged."

## Email setup and cost boundary

Use Resend Free for invitations and sign-in codes, with replies initially directed to jtdelosh@gmail.com. Proposed sender: Skeet Tracker <login@sk33t.net>; a dedicated sending subdomain is acceptable if DNS setup warrants it. Branded support forwarding is optional and deferred.

Pricing checked September 10: $0/month for 3,000 transactional emails/month, maximum 100/day. No paid upgrade without James's approval. Invitations, codes, and testing all consume the allowance. Apply application throttles and a global send budget below the provider limit; display recoverable errors when delivery fails or quota is unavailable. Do not report a failed email as sent.

Prerequisites: James-owned Resend account; inspect existing DNS/MX/SPF before adding provider verification records; verified domain; restricted sending API key stored as a Sites secret; fixed sender, reply-to, and application origin. Never commit secrets. Avoid changing existing inbound email routing. Use separate test credentials where supported, clearly label test email, and restrict initial test recipients. Do not send invitations to other people without James's explicit direction.

## Data ownership and administration

- Users: immutable ID, unique normalized email (do not strip Gmail dots or plus tags), profile, role, active/disabled state, timestamps, notice acceptance.
- Invitations, verification challenges, sessions, and audit events: separate server-controlled records with expiry/revocation state as applicable.
- Shoots belong to a user. Scores and notes inherit ownership through their shoot. Classification settings use a user-and-event key instead of a global event key.
- Enforce identity and ownership on every endpoint, dashboard aggregate, history count/search, edit, delete, and settings operation. Never trust a client-supplied owner ID. Admin selection of another shooter requires an explicit server-side role check.
- Audit admin changes with actor, affected shooter, action, time, and bounded relevant before/after values. Protect audit access; do not record secrets. Do not offer invisible impersonation.
- Admin can invite/resend/revoke, list accounts, disable/reactivate, select a shooter, and correct records. Deletion and email-address changes are deferred until a deliberate recovery/data-retention flow is designed.

## Migration and release sequence

1. Complete the hosting/session proof and configure test email delivery.
2. Implement ownership schema and server enforcement, then invitation/login and basic admin interfaces. Maintain deny-by-default behavior during incremental work.
3. Generate additive migrations; keep previously applied migrations immutable. Rehearse ownership assignment on isolated fixtures/copies. Make backfill explicit, repeatable, and verifiable; preserve IDs, scores, notes, timestamps, and settings.
4. Run integration tests with James plus two shooters. Verify direct API attempts cannot cross accounts, including guessed IDs, aggregates, pagination counts, notes, and settings. Verify expiry, replay, concurrent code redemption, account disable, failed email, and session revocation. Re-run scoring regression tests.
5. Test the hosted visitor flow in phone browsers, including email-app switching, refresh, logout, and Remember this device. Obtain approval before widening test access. Confirm unauthenticated APIs return no records, and personalized responses cannot be shared through caches.
6. Before live rollout: back up the latest live database, verify restoration procedure, briefly freeze writes for ownership migration, reconcile row counts and representative totals, and confirm James can log in as admin. Remove test-only deployment configuration/banner from the proposed live change. Review the complete diff and obtain rollout approval.
7. Apply migration and deploy in a planned order while the platform owner-only gate remains in place. Widen the live audience only after the protected release passes checks and James approves. Never revert to an old unprotected build while the Site is public. A code rollback alone may not undo a schema migration.

## Resume checklist

Read this brief and docs/environments.md in the test checkout. Confirm branch, clean/expected worktree, and test Site ID. Start with hosting/session proof; no broad account implementation before that passes. Ask James to create/sign in to Resend when setup is needed, without requesting secrets in chat. Keep live field testing available. Do not merge, change audiences, migrate live data, purchase services, or send pilot invitations as part of resuming this planning checkpoint.

## Sources checked

- [Official Sites developer guide](https://learn.chatgpt.com/docs/sites): supported site shapes; separate audience and sign-in controls; secrets.
- [Creating and managing ChatGPT Sites](https://help.openai.com/en/articles/20001339-creating-and-managing-chatgpt-sites): public/private visitor behavior and authentication boundaries.
- Installed Sites authentication reference: C:/Users/James/.codex/plugins/cache/openai-bundled/sites/0.1.57/skills/sites-building/references/authentication.md. Requires confirming the platform auth path before implementation; does not itself prove email-code compatibility.
- [Resend pricing](https://resend.com/docs/knowledge-base/what-is-resend-pricing) and [domain verification](https://resend.com/docs/dashboard/domains/introduction), checked earlier in this task.
- Read-only Sites get_site on September 10 confirmed test audience custom and available modes custom/public.
