# Record ownership milestone

The private login test site now scopes shoots, scores, notes, history, dashboard totals, and classification settings to the authenticated account. The server derives ownership from the session; submitted owner IDs are ignored. Requests targeting another shoot return 404. Disabled accounts cannot use existing sessions.

James remains the only account allowed to request and redeem email login codes. Invitations, account administration, and administrator access to other shooters' records are the next implementation phase. Keep this checkpoint owner-private.

Migration 0007 adds users, per-user classification settings, a migration marker, and a nullable shoot owner reference. It does not automatically assign existing data. After signing in, James can use **Assign existing records to my account** on the home page if unassigned records or legacy settings exist. This operation assigns legacy records only to James, preserves linked scores and notes, and records completion atomically. Repeating it does not overwrite newer settings. The old settings table remains available for migration review. This deployment changes only the separate test database; no live data migration has been performed.

Validation: all 22 automated tests passed, TypeScript checking passed, and the production build passed. Tests exercise two synthetic shooters, spoofed ownership, cross-account reads and writes, settings isolation, disabled accounts, direct unauthenticated API calls, origin checks, and repeatable legacy migration. Local HTTP checks returned 401 for every unauthenticated data endpoint and 200 for the login page.

Field testing continues at https://sk33t.net. Account testing uses https://skeet-tracker-login-test.jtdelosh.chatgpt.site on branch `feature/user-accounts`.
