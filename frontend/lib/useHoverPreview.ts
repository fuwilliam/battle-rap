"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getMasterVolume, subscribeMasterVolume } from "./masterVolume";
import { audioBus, type Pausable } from "./spotifyEmbed";

// Fades a 30s preview clip in on hover (or on demand via `autoplay`) and back
// out on mouse-leave, claiming the shared audioBus so only one clip plays at
// once across the whole page -- used by both the artist card's image and
// each track row.
export function useHoverPreview(url: string | null, autoplay = false) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const busHandle = useRef<Pausable>({ pause: () => {} });
  const [isPlaying, setIsPlaying] = useState(false);

  const fadeTo = useCallback((target: number, onDone?: () => void) => {
    const el = audioRef.current;
    if (!el) return;
    if (fadeRef.current) clearInterval(fadeRef.current);
    fadeRef.current = setInterval(() => {
      const step = 0.08;
      if (Math.abs(el.volume - target) <= step) {
        el.volume = target;
        if (fadeRef.current) clearInterval(fadeRef.current);
        onDone?.();
      } else {
        el.volume += el.volume < target ? step : -step;
      }
    }, 40);
  }, []);

  const stop = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    audioBus.release(busHandle.current);
    setIsPlaying(false);
    fadeTo(0, () => el.pause());
  }, [fadeTo]);

  const start = useCallback(() => {
    const el = audioRef.current;
    if (!el || !url) return;
    audioBus.claim(busHandle.current); // pause any playing track/clip first
    el.currentTime = 0;
    el.volume = 0;
    el
      .play()
      .then(() => {
        setIsPlaying(true);
        fadeTo(getMasterVolume());
      })
      .catch(() => {}); // ignore autoplay blocks
  }, [url, fadeTo]);

  // the bus pauses this clip by calling this handle
  useEffect(() => {
    busHandle.current.pause = stop;
  }, [stop]);

  // Apply volume changes live -- e.g. the user drags the navbar slider while
  // a clip is already playing -- instead of waiting for the next hover.
  useEffect(() => {
    if (!isPlaying) return;
    return subscribeMasterVolume((v) => {
      const el = audioRef.current;
      if (el) el.volume = v;
    });
  }, [isPlaying]);

  // e.g. the bracket champion screen -- plays without waiting for a hover.
  // Relies on the "sticky" user-activation the page already has from the
  // click that got here, so browsers don't block the programmatic play().
  useEffect(() => {
    if (!autoplay) return;
    start();
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, url]);

  useEffect(
    () => () => {
      if (fadeRef.current) clearInterval(fadeRef.current);
      audioRef.current?.pause();
    },
    [],
  );

  return { audioRef, isPlaying, start, stop };
}
