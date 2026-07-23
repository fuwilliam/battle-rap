"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { VolumeControl } from "./VolumeControl";

const links = [
  { href: "/ranking", label: "Ranking" },
  { href: "/visualize", label: "Visualize" },
  { href: "https://github.com/fuwilliam/battle-rap", label: "Github", external: true },
  { href: "/about", label: "About" },
];

const MODES = [
  { href: "/", label: "Head-to-Head" },
  { href: "/bracket", label: "Bracket" },
];

function ModeToggle() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 text-sm">
      {MODES.map((m) => (
        <Link
          key={m.href}
          href={m.href}
          className={`rounded-full px-3 py-1 font-medium transition ${
            pathname === m.href
              ? "bg-accent text-black"
              : "text-white/60 hover:text-white"
          }`}
        >
          {m.label}
        </Link>
      ))}
    </div>
  );
}

export function Navbar() {
  return (
    <nav className="sticky top-0 z-20 border-b border-white/10 bg-black/40 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-accent text-black">🎤</span>
            <span className="text-lg">Battle Rap</span>
          </Link>
          <ModeToggle />
          <VolumeControl />
        </div>
        <ul className="flex items-center gap-1 text-sm">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                target={l.external ? "_blank" : undefined}
                className="rounded-md px-3 py-2 text-white/70 transition hover:bg-white/5 hover:text-white"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
