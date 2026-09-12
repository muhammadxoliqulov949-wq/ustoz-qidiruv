import "server-only";
import { eq } from "drizzle-orm";
import { schema, type Database } from "./db/client";

/* Slug helpers — teacher profile slugs must be unique, lowercase and match the
 * teacher_profiles_slug_format CHECK constraint. */

const TRANSLIT: Record<string, string> = {
  "‘": "", "'": "", "’": "", "ʻ": "",
  ä: "a", ö: "o", ü: "u", ç: "c", ğ: "g", ş: "s", ı: "i",
};

export function slugifyName(name: string): string {
  const base = name
    .toLowerCase()
    .split("")
    .map((char) => TRANSLIT[char] ?? char)
    .join("")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base.length >= 2 ? base : "ustoz";
}

/** Structural type covering both the db handle and a transaction handle. */
type Selector = Pick<Database, "select">;

/** Appends -2, -3 … until the slug is free. Called inside the register tx. */
export async function uniqueTeacherSlug(tx: Selector, base: string): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const rows = await tx
      .select({ slug: schema.teacherProfiles.slug })
      .from(schema.teacherProfiles)
      .where(eq(schema.teacherProfiles.slug, candidate))
      .limit(1);
    if (rows.length === 0) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}
