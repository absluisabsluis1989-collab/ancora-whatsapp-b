/**
 * Local email/password sign-in (this app's Better Auth DB — not the broker).
 *
 * On so the project runs outside the Grok builder. Google and X still go
 * through the broker when that broker is reachable. Accounts live in this
 * app's own database.
 */
export const emailAndPasswordEnabled = true;
