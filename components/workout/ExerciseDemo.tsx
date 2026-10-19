"use client";

import clsx from "clsx";
import { useEffect, useState, useSyncExternalStore } from "react";
import { MEDIA_CREDIT, MEDIA_SOURCE_URL, exerciseMedia } from "@/lib/exerciseMedia";

const FRAME_MS = 1100;
const REDUCED = "(prefers-reduced-motion: reduce)";

function subscribeReduced(cb: () => void) {
  const q = window.matchMedia(REDUCED);
  q.addEventListener("change", cb);
  return () => q.removeEventListener("change", cb);
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );
}

/**
 * How the exercise is done: start and end photos alternating like a short
 * loop. With reduced motion it stays still and a tap switches the frame.
 */
export function ExerciseDemo({ exerciseId, name, className }: { exerciseId: string; name: string; className?: string }) {
  const media = exerciseMedia(exerciseId);
  const reduced = useReducedMotion();
  const [tick, setTick] = useState(0);
  const count = media?.frames.length ?? 0;
  const frame = count ? tick % count : 0;

  useEffect(() => {
    if (count < 2 || reduced) return;
    const t = setInterval(() => setTick((f) => (f + 1) % count), FRAME_MS);
    return () => clearInterval(t);
  }, [count, reduced]);

  if (!media) return null;
  const label = count > 1 ? `${name}: posición inicial y final` : `${name}: posición a mantener`;
  return (
    <figure className={clsx("overflow-hidden rounded-2xl border border-line bg-sunken", className)}>
      <button
        type="button"
        onClick={() => count > 1 && setTick((f) => (f + 1) % count)}
        className="relative block aspect-[3/2] w-full"
        aria-label={count > 1 ? `${label}. Tocar para cambiar de posición` : label}
      >
        {media.frames.map((src, i) => (
          // Plain <img>: tiny static files already sized at build time and cached by the service worker.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            className={clsx("absolute inset-0 size-full object-cover transition-opacity duration-300", i === frame ? "opacity-100" : "opacity-0")}
          />
        ))}
        {count > 1 && (
          <span className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[0.7rem] font-semibold text-white">
            {frame === 0 ? "Inicio" : "Final"}
          </span>
        )}
      </button>
      <figcaption className="px-3 py-1.5 text-[0.65rem] text-muted">
        <a href={MEDIA_SOURCE_URL} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
          {MEDIA_CREDIT}
        </a>
      </figcaption>
    </figure>
  );
}

/** Small still of the end position for lists; empty box when there is no photo. */
export function ExerciseThumb({ exerciseId, className }: { exerciseId: string; className?: string }) {
  const media = exerciseMedia(exerciseId);
  const src = media?.frames.at(-1);
  return (
    <span className={clsx("block size-12 shrink-0 overflow-hidden rounded-xl bg-sunken", className)} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src && <img src={src} alt="" loading="lazy" decoding="async" className="size-full object-cover" />}
    </span>
  );
}
