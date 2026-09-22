"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { ArrowRight, Search, X } from "lucide-react";
import { hero } from "@/data/site";

export function HeroSearch() {
  const router = useRouter();
  const inputId = useId();
  const [value, setValue] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = value.trim();
    if (query) router.push(`/courses?q=${encodeURIComponent(query)}`);
  };

  return (
    <form role="search" onSubmit={submit} className="relative w-full">
      <label htmlFor={inputId} className="sr-only">
        {hero.searchLabel}
      </label>

      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-500 sm:left-5 sm:size-[22px]"
      />

      <input
        id={inputId}
        type="search"
        autoComplete="off"
        placeholder={hero.searchPlaceholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-[56px] w-full rounded-pill border border-white/12 bg-white/[0.07] py-2 pl-12 pr-[64px] text-[15px] text-ink-900 placeholder:text-ink-500 shadow-sm backdrop-blur-md transition-[border-color,background-color] duration-150 hover:border-white/18 hover:bg-white/[0.08] focus:border-accent-600/50 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent-600/20 sm:h-[60px] sm:pl-13 sm:text-[16px]"
      />

      {value ? (
        <button
          type="button"
          aria-label="Qidiruvni tozalash"
          onClick={() => setValue("")}
          className="absolute right-[52px] top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-ink-400 hover:bg-white/15 hover:text-ink-900"
        >
          <X className="size-4" />
        </button>
      ) : null}

      <button
        type="submit"
        aria-label="Qidirish"
        className="absolute right-1.5 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-amber-500 text-amber-950 shadow-[0_8px_20px_-8px_rgba(232,181,90,0.8)] transition-colors hover:bg-amber-400 active:bg-amber-600 sm:size-11"
      >
        <ArrowRight className="size-5" />
      </button>
    </form>
  );
}
