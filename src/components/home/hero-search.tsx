"use client";

import { useRouter } from "next/navigation";
import { SearchInput } from "@/components/ui";
import { hero } from "@/data/site";

/* -------------------------------------------------------------------------- */
/* Client island of the hero: the search field.                                 */
/* Phase 3 seam fulfilled — submitting navigates to the /courses results        */
/* engine (`?q=`; see lib/course-search.ts for the URL contract).               */
/* Quick-filter pills are plain links (rendered server-side by <Hero>), so      */
/* this island holds no state of its own.                                       */
/* -------------------------------------------------------------------------- */

export function HeroSearch() {
  const router = useRouter();
  return (
    <SearchInput
      size="xl"
      label={hero.searchLabel}
      placeholder={hero.searchPlaceholder}
      className="home-hero-search"
      onSubmit={(query) =>
        router.push(`/courses?q=${encodeURIComponent(query)}`)
      }
    />
  );
}
