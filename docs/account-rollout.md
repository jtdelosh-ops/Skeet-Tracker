# Account release and data consolidation

The account release adds passwordless email login, email-bound invitations, account isolation, administrator support and audit history, reviewed CSV/multiple-image imports with duplicate checks and undo, and the shoot start date prompt.

James approved consolidation into sk33t.net on September 14, 2026. The rehearsed inventory is 53 production shoots plus 13 test shoots: 53 for James, 12 for the tester, and one for the separate test account. There are 268 total event-score rows after transfer. No records are discarded.

## Migration

1. Capture application-table backups from both Sites. Restore the snapshots against the versioned schema in isolated SQLite databases and verify integrity and foreign keys.
2. Deploy the protected rollout build in locked mode to the test Site and export its final, transactionally consistent snapshot. Pin its SHA-256 in the production rollout environment.
3. Set production's origin and independent authentication secret, configure Resend/OpenAI secrets, and deploy the account schema and build with maintenance locked. Export production again after writes have stopped.
4. Rehearse using these final snapshots. Transfer only from the pinned source and only when production's fingerprint still matches its backup. The transfer runs in one atomic D1 batch; a completed marker makes retries harmless.
5. Keep original production shoot, score and note IDs. Assign production records to James. Offset test shoot/score IDs and update notes, import records and administrative references, including deleted historical shoot IDs. Preserve all users, audit snapshots, batch snapshots and timestamps. Production class settings take precedence for James.
6. Preserve invitation history, but revoke outstanding test invitations because production uses a different authentication key. Do not transfer browser sessions or one-time login challenges; existing accounts sign in again without registering.
7. Compare all transferred records, counts, notes, import snapshots and per-account gauge totals to the rehearsal. Test production email and image extraction. Enable normal account access only after verification; direct the old test URL to sk33t.net and disable maintenance credentials.

## Recovery

Before any data transfer, both original datasets and their final snapshots remain available. A failed transfer batch leaves production unchanged. A source-fingerprint mismatch or changed target requires a new export and review, not a blind retry. Keep the site locked if verification fails after transfer; do not publish the old unprotected app to a public Site.

The repository includes `scripts/rehearse-rollout.mjs` and migration tests. Backup files and verification reports are private local artifacts and must never be committed. The rollout endpoint is disabled unless a maintenance mode, a 256-bit secret, and an unexpired deadline are configured; it accepts no arbitrary SQL or table names. Disable it and remove its secret after the transfer.
