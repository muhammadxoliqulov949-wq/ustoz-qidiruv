import "server-only";

/* -------------------------------------------------------------------------- */
/* Database configuration errors — Phase 22 split-out.                          */
/*                                                                              */
/* `DatabaseConfigError` used to live in `db/client.ts`; it moves here so the   */
/* pure connection-string policy (`postgres-url.ts`) and the pool factory can   */
/* share one error type. Messages name ENVIRONMENT VARIABLES and never their    */
/* values, so they are safe to log and safe to show an operator.                */
/* -------------------------------------------------------------------------- */

export class DatabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseConfigError";
  }
}
