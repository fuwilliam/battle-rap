"use client";

import { useState } from "react";
import type { SeedEntry } from "@/lib/types";
import { BracketSizePicker } from "@/components/BracketSizePicker";
import { BracketArena } from "@/components/BracketArena";

export function BracketFlow() {
  const [entrants, setEntrants] = useState<SeedEntry[] | null>(null);

  if (!entrants) {
    return <BracketSizePicker onReady={setEntrants} />;
  }

  return <BracketArena entrants={entrants} onPlayAgain={() => setEntrants(null)} />;
}
