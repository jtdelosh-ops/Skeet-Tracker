# Invitations and signup

James can open Manage invitations from the home page and use Send invitation to email the signup link directly through Resend. Create link only remains available for manual sharing, and Copy link only copies the URL without a message. James can revoke pending invitations. Email is sent only when James selects Send invitation. Each invitation expires after seven days, works once, and is replaced when James creates another for the same address. Only James's authenticated, enabled administrator account can manage invitations; the API validates this independently of the Worker gate.

The link contains a random 256-bit code in its fragment. The signup page removes the fragment from browser history after loading it. Only an HMAC digest is persisted. Links are returned once; the recent-invitation list never returns codes or digests. Losing a link requires creating a replacement.

Signup requires the invited email, a nonblank display name of at most 80 characters, and acknowledgment that James may access records to assist with uploads and corrections. Resend delivers the existing six-digit verification code. The challenge binds the invited email, invitation ID, and display name. Successful verification atomically creates one shooter account, consumes the still-valid invitation, and issues a session. Expiry, revocation, replacement, and existing accounts are rechecked at redemption. A timestamp records the support-access acknowledgment. Existing enabled shooters subsequently sign in without an invitation. Disabled users cannot sign in or obtain replacement invitations.

Email codes retain ten-minute expiry, five guesses, single redemption, secure cookies, origin checks, and no-store responses. Login codes are limited to one per minute and five per hour per email. Invitation emails have a separate one-per-minute recipient limit; invitations and login codes share a cap of eighty email attempts per rolling day. Test messages retain the TEST label.

The test site remains owner-private at the hosting layer. Do not expect outside shooters to open links until James authorizes a suitable test audience. No real invitations or emails were sent during implementation. No live deployment, migration, or account creation was performed. Administrator record editing and its audit trail remain the next phase.

Validation: 31 automated tests cover existing tracker behavior plus owner-only invitation management, email binding, required profile/acknowledgment, hashed codes, expiry, revocation, replacement during signup, replay, concurrent redemption, rollback on session-write failure, returning-user login, disabled accounts, and per-email/global throttling. TypeScript checking, the production build, and local migration application passed. Local HTTP checks returned 200 for login and 401 for anonymous invitation access.


Invitation email results persist as link-only, sending, sent (provider accepted), failed, or unknown. Provider acceptance does not guarantee inbox delivery. A failed or uncertain send preserves the valid link for manual sharing; sending a replacement invalidates the older invitation. Resend requests use a unique invitation idempotency key. Tests simulate accepted, rejected, server-error and timeout responses without sending real email.

