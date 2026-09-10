# Owner login milestone

This checkpoint implements owner-only email-code authentication for the isolated test Site. It is not multi-user ready and must not be deployed to the live tracker or opened to pilot accounts.

- Only jtdelosh@gmail.com can receive a code and establish an application session.
- Resend sends from login@sk33t.net with explicit TEST subject/body; replies go to James.
- Six-digit single-use codes expire after ten minutes. Five wrong guesses exhaust a challenge. A new code invalidates the previous one. Send limits: one per minute, five per hour, eighty per rolling day.
- Codes and sessions use keyed digests with a separate AUTH_SECRET. Session cookies are host-only, Secure, HttpOnly, SameSite=Lax. Expiry is twelve hours or thirty days when Remember this device is selected.
- Worker entrypoint enforces authentication before all tracker data routes and server rendering. Mutations validate Origin. Authenticated responses are no-store. The login page remains reachable behind the existing private Sites access gate.
- Test Site requires RESEND_API_KEY and AUTH_SECRET secrets plus APP_ORIGIN. Local .dev.vars uses synthetic values and does not send email. Secret files are excluded from Git.
- Existing schema migrations remain unchanged; migration 0006 adds authentication tables only. No live record ownership has been changed.

Validation: build, lint and all eighteen tests passed. Local HTTP checks: login 200; anonymous dashboard/history/shoots/settings 401. Automated tests cover session flags, replay, concurrent redemption, wrong-code exhaustion, expiry, logout, cross-origin rejection, non-owner denial, resend throttling, and failed delivery invalidation.

Next gate: James verifies delivery and enters a code in the hosted login page; confirm cookie persistence and logout there. Public/no-ChatGPT visitor testing needs an explicitly approved test audience change after that protected build is reviewable. Only then expand to user ownership, invitations and admin tools. Do not treat the platform access cookie as application authentication.
