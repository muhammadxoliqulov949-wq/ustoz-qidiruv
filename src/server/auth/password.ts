import "server-only";
import { hash, verify } from "@node-rs/argon2";

/* -------------------------------------------------------------------------- */
/* Password hashing — Phase 11.                                                */
/*                                                                              */
/* argon2id via @node-rs/argon2 (native Rust binding to the reference           */
/* implementation). No custom crypto: parameters follow the OWASP Password      */
/* Storage Cheat Sheet baseline (m=19 MiB, t=2, p=1). The salt is generated     */
/* per hash by the library and embedded in the PHC string, so a plaintext or    */
/* unsalted value can never be written (the DB additionally CHECKs that the     */
/* stored value starts with "$argon2").                                         */
/* -------------------------------------------------------------------------- */

const OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

/** Constant-time verification; never throws on a malformed stored hash. */
export async function verifyPassword(storedHash: string, plain: string): Promise<boolean> {
  try {
    return await verify(storedHash, plain, OPTIONS);
  } catch {
    return false;
  }
}
