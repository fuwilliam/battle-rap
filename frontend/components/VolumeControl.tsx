"use client";

import { useEffect, useRef, useState } from "react";
import { getMasterVolume, setMasterVolume, subscribeMasterVolume } from "@/lib/masterVolume";

export function VolumeControl() {
  // Real value is read from localStorage on mount (see masterVolume.ts) --
  // start at the same default so there's no server/client mismatch.
  const [volume, setVolume] = useState(0.85);
  // Last nonzero volume, so clicking the icon to unmute restores it instead
  // of just always jumping back to the default.
  const lastNonZeroRef = useRef(0.85);

  useEffect(() => {
    const initial = getMasterVolume();
    setVolume(initial);
    if (initial > 0) lastNonZeroRef.current = initial;
    return subscribeMasterVolume((v) => {
      setVolume(v);
      if (v > 0) lastNonZeroRef.current = v;
    });
  }, []);

  function toggleMute() {
    setMasterVolume(volume > 0 ? 0 : lastNonZeroRef.current);
  }

  return (
    <div className="flex items-center gap-1.5 text-white/60">
      <button
        type="button"
        onClick={toggleMute}
        aria-label={volume > 0 ? "Mute" : "Unmute"}
        className="shrink-0 transition hover:text-white"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06Z" />
          {volume === 0 ? (
            <path d="M17.78 9.22a.75.75 0 1 0-1.06 1.06L18.44 12l-1.72 1.72a.75.75 0 0 0 1.06 1.06l1.72-1.72 1.72 1.72a.75.75 0 1 0 1.06-1.06L20.56 12l1.72-1.72a.75.75 0 0 0-1.06-1.06l-1.72 1.72-1.72-1.72Z" />
          ) : (
            <>
              <path d="M15.932 7.757a.75.75 0 0 1 1.061 0 6 6 0 0 1 0 8.486.75.75 0 0 1-1.06-1.06 4.5 4.5 0 0 0 0-6.365.75.75 0 0 1 0-1.06Z" />
              <path d="M18.584 5.106a.75.75 0 0 1 1.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 1 1-1.06-1.06 8.25 8.25 0 0 0 0-11.668.75.75 0 0 1 0-1.06Z" />
            </>
          )}
        </svg>
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        onChange={(e) => setMasterVolume(Number(e.target.value))}
        className="h-1 w-16 cursor-pointer accent-accent"
        aria-label="Preview volume"
      />
    </div>
  );
}
