"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type StoryChapterKind =
  | "hero"
  | "categories"
  | "courses"
  | "formats"
  | "teachers"
  | "process"
  | "trust"
  | "teacher-cta";

/**
 * One scroll coordinator for the public homepage story.
 *
 * It only publishes progress values as CSS custom properties. Layout, content,
 * links and focus order stay in the server-rendered chapter markup, so the page
 * remains complete before JavaScript and when reduced motion is requested.
 */
export function HomeStory({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const chapters = Array.from(
      root.querySelectorAll<HTMLElement>("[data-story-chapter]"),
    );
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animationFrame = 0;
    let lastScrollY = window.scrollY;
    let observer: IntersectionObserver | null = null;
    let stopMotion: (() => void) | null = null;

    const reset = () => {
      delete root.dataset.storyMotion;
      delete root.dataset.storyDirection;
      chapters.forEach((chapter) => {
        delete chapter.dataset.storyVisible;
        chapter.style.removeProperty("--story-enter");
        chapter.style.removeProperty("--story-exit");
        chapter.style.removeProperty("--story-focus");
        chapter.style.removeProperty("--story-progress");
      });
    };

    const startMotion = () => {
      root.dataset.storyMotion = "true";

      const update = () => {
        animationFrame = 0;
        const viewportHeight = Math.max(window.innerHeight, 1);
        const headerOffset = window.innerWidth >= 640 ? 84 : 72;
        const scrollY = window.scrollY;

        root.dataset.storyDirection = scrollY >= lastScrollY ? "down" : "up";
        lastScrollY = scrollY;

        // Read every rectangle first, then write styles. This avoids alternating
        // layout reads/writes inside the same frame.
        const measurements = chapters.map((chapter) => ({
          chapter,
          rect: chapter.getBoundingClientRect(),
        }));

        measurements.forEach(({ chapter, rect }) => {
          const enter = clamp((viewportHeight - rect.top) / (viewportHeight * 0.46));
          const exit = clamp(
            (headerOffset - rect.top) / Math.max(rect.height * 0.68, 1),
          );
          const focus = clamp(Math.min(enter, 1 - exit * 0.72));
          const progress = clamp(
            (viewportHeight * 0.72 - rect.top) /
              Math.max(rect.height + viewportHeight * 0.44, 1),
          );

          chapter.style.setProperty("--story-enter", enter.toFixed(4));
          chapter.style.setProperty("--story-exit", exit.toFixed(4));
          chapter.style.setProperty("--story-focus", focus.toFixed(4));
          chapter.style.setProperty("--story-progress", progress.toFixed(4));
        });
      };

      const requestUpdate = () => {
        if (animationFrame) return;
        animationFrame = window.requestAnimationFrame(update);
      };

      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              (entry.target as HTMLElement).dataset.storyVisible = "true";
            } else {
              delete (entry.target as HTMLElement).dataset.storyVisible;
            }
          });
          requestUpdate();
        },
        { rootMargin: "32% 0px 32% 0px", threshold: [0, 0.05, 0.25, 0.6] },
      );

      chapters.forEach((chapter) => observer?.observe(chapter));
      window.addEventListener("scroll", requestUpdate, { passive: true });
      window.addEventListener("resize", requestUpdate, { passive: true });
      update();

      return () => {
        observer?.disconnect();
        observer = null;
        window.removeEventListener("scroll", requestUpdate);
        window.removeEventListener("resize", requestUpdate);
        if (animationFrame) window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      };
    };

    const applyMotionPreference = () => {
      stopMotion?.();
      stopMotion = null;
      reset();
      if (!reduceMotion.matches) stopMotion = startMotion();
    };

    applyMotionPreference();
    reduceMotion.addEventListener("change", applyMotionPreference);

    return () => {
      reduceMotion.removeEventListener("change", applyMotionPreference);
      stopMotion?.();
      reset();
    };
  }, []);

  return (
    <div ref={rootRef} className="home-story">
      {children}
    </div>
  );
}

export function StoryChapter({
  index,
  kind,
  name,
  sticky = false,
  className,
  children,
}: {
  index: string;
  kind: StoryChapterKind;
  name: string;
  sticky?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn("home-story-chapter", `home-story-${kind}`, className)}
      data-story-chapter={kind}
      data-story-index={index}
      data-story-name={name}
      data-story-sticky={sticky ? "true" : undefined}
    >
      <div className="home-story-scene">{children}</div>
    </div>
  );
}

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}
