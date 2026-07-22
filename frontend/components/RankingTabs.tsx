"use client";

import { useState } from "react";
import type { BracketRankingRow, RankingRow } from "@/lib/types";
import { RankingTable } from "@/components/RankingTable";
import { BracketRankingTable } from "@/components/BracketRankingTable";

const TABS = [
  { key: "head2head", label: "Head-to-Head" },
  { key: "bracket", label: "Bracket" },
] as const;

type Tab = (typeof TABS)[number]["key"];

export function RankingTabs({
  headToHead,
  bracket,
}: {
  headToHead: RankingRow[];
  bracket: BracketRankingRow[];
}) {
  const [tab, setTab] = useState<Tab>("head2head");

  return (
    <>
      <div className="mb-6 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
              tab === t.key
                ? "border-accent bg-accent/10 text-accent"
                : "border-white/10 text-white/60 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "head2head" ? (
        <>
          <p className="mb-4 -mt-2 text-sm text-white/50">*minimum 5 matchups</p>
          <RankingTable rows={headToHead} />
        </>
      ) : (
        <>
          <p className="mb-4 -mt-2 text-sm text-white/50">*across all bracket runs played</p>
          <BracketRankingTable rows={bracket} />
        </>
      )}
    </>
  );
}
