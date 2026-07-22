// Standard single-elimination bracket order (1v16, 8v9, 5v12, ... for n=16),
// generated recursively so any power of two "just works" without hardcoded tables.
export function seedOrder(n: number): number[] {
  if (n === 1) return [1];
  return seedOrder(n / 2).flatMap((s) => [s, n + 1 - s]);
}

export function pairEntrants<T extends { seed: number }>(entrants: T[]): [T, T][] {
  const bySeed = new Map(entrants.map((e) => [e.seed, e]));
  const order = seedOrder(entrants.length);
  const pairs: [T, T][] = [];
  for (let i = 0; i < order.length; i += 2) {
    const a = bySeed.get(order[i]);
    const b = bySeed.get(order[i + 1]);
    if (!a || !b) throw new Error("pairEntrants: seed list doesn't match entrant count");
    pairs.push([a, b]);
  }
  return pairs;
}

export function roundLabel(matchesInRound: number): string {
  switch (matchesInRound) {
    case 1:
      return "Final";
    case 2:
      return "Semifinals";
    case 4:
      return "Quarterfinals";
    case 8:
      return "Round of 16";
    case 16:
      return "Round of 32";
    default:
      return `Round of ${matchesInRound * 2}`;
  }
}
