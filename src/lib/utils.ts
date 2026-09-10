/**
 * Join conditional class names. Keeps component signatures readable while
 * allowing consumers to extend primitive styles without duplication.
 */
export type ClassValue =
  | string
  | number
  | bigint
  | null
  | false
  | ClassValue[]
  | undefined;

export function cn(...classes: ClassValue[]): string {
  const out: string[] = [];
  const push = (value: ClassValue): void => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(push);
      return;
    }
    out.push(String(value));
  };
  classes.forEach(push);
  return out.join(" ");
}

/**
 * Shared keyboard-focus treatment for every interactive primitive
 * (Button, Input, IconButton, links). Keep focus styling here — components
 * must not hand-roll their own rings.
 */
export const focusRing =
  "outline-none focus-visible:ring-[length:var(--size-focus-ring)] focus-visible:ring-accent-600/35 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";
