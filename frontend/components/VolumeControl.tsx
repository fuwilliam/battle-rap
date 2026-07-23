"use client";

import { useEffect, useState } from "react";
import { getMasterVolume, setMasterVolume, subscribeMasterVolume } from "@/lib/masterVolume";

export function VolumeControl() {
  // Real value is read from localStorage on mount (see masterVolume.ts) --
  // start at the same default so there's no server/client mismatch.
  const [volume, setVolume] = useState(0.85);

  useEffect(() => {
    setVolume(getMasterVolume());
    return subscribeMasterVolume(setVolume);
  }, []);

  return (
    <div className="flex items-center gap-1.5 text-white/60">
      <span aria-hidden="true" className="text-sm leading-none">
        {volume === 0 ? "🔇" : "🔊"}
      </span>
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
