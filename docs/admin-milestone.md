# Administrator support

James can open Administration beside his account name. The account list shows each shooter's name, email, access status, and shoot count. Help with records opens the familiar tracker for that shooter with a support banner and an Exit support mode link. Support access includes history, notes, totals, shoot creation/correction/deletion, and classification settings. Bulk file import remains deferred.

Support selection lives in the current page URL and is sent with that tab's tracker API requests. There is no shared support cookie. Server handlers independently verify that the active caller is the designated James administrator, then resolve the selected shooter from the database. The caller's session identity remains James. Other shooters cannot select another account by forging the support header. A missing target fails closed; requests without a selection use the caller's own records.

Disabling an account preserves records, deletes active sessions, and invalidates outstanding login codes. Restoring access requires a fresh sign-in; old credentials do not revive. James cannot disable his own administrator account. James may help with records while a shooter's sign-in is disabled.

Every support-mode shoot creation, correction, deletion, or classification-setting change writes an administrative history entry containing actor, target, time, action, and before/after values. Shoot snapshots include linked scores and notes. Account access changes are also recorded. Mutation and audit statements execute in one atomic database batch, so audit failure rolls back the edit. History is available only to James, can be filtered by shooter, and is paginated. No API edits or deletes audit entries. Shooters' ordinary self-service changes are outside this administrative log.

Migration 0010 adds only the audit table and indexes; existing migrations remain unchanged. No live deployment, live migration, account disabling, or changes to real shooter records were performed during implementation. The test site retains its owner-private hosting audience.

Validation covers administrative authorization, forged support selection, own/other-tab isolation, target ownership, complete snapshots, rollback on audit insertion and snapshot failure, session/code revocation, restoration, and history pagination. All 37 tests passed, including the existing tracker and signup regressions. TypeScript checking, the production build, and local migration application passed. Local HTTP checks returned 200 for login and 401 for anonymous administration access.

