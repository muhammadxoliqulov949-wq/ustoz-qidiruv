import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
let passed = 0;

function source(file: string) {
  return readFileSync(path.join(root, file), "utf8");
}

function check(name: string, condition: boolean) {
  assert.ok(condition, name);
  passed += 1;
}

const css = source("src/app/globals.css");

for (const token of [
  "--transition-duration-fast",
  "--transition-duration-base",
  "--transition-duration-slow",
  "--ease-enter",
  "--ease-exit",
  "--motion-distance-sm",
  "--motion-scale-dialog",
  "--motion-opacity-muted",
]) {
  check(`motion token exists: ${token}`, css.includes(token));
}

check(
  "reduced motion removes transitions and animations",
  css.includes("prefers-reduced-motion: reduce") &&
    css.includes("animation-duration: 0s !important") &&
    css.includes("transition-duration: 0s !important"),
);

for (const recipe of [
  ".motion-backdrop",
  ".motion-menu",
  ".motion-sheet",
  ".motion-dialog",
  ".motion-card",
  ".motion-feedback",
  ".motion-skeleton",
]) {
  check(`motion recipe exists: ${recipe}`, css.includes(recipe));
}

check(
  "card elevation is fine-pointer only",
  css.includes("@media (hover: hover) and (pointer: fine)") &&
    css.includes(".motion-card:hover"),
);

for (const file of [
  "src/components/navigation/mobile-menu.tsx",
  "src/components/courses/filter-sheet.tsx",
  "src/components/teachers/teacher-filter-sheet.tsx",
  "src/components/course-detail/enroll-dialog.tsx",
]) {
  const content = source(file);
  check(`${file} exposes open/closed state`, content.includes('data-state={open ? "open" : "closed"}'));
  check(`${file} hides closed content accessibly`, content.includes("aria-hidden={!open}"));
  check(`${file} makes closed content inert`, content.includes("inert={!open ? true : undefined}"));
}

const packageJson = source("package.json");
check(
  "no animation runtime dependency added",
  !packageJson.includes("framer-motion") && !packageJson.includes("motion/react"),
);

console.log(`phase25 motion suite: ${passed} passed, 0 failed`);
