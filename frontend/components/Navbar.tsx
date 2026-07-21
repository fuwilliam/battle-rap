import Link from "next/link";

const links = [
  { href: "/ranking", label: "Ranking" },
  { href: "/visualize", label: "Visualize" },
  { href: "https://github.com/fuwilliam/battle-rap", label: "Github", external: true },
  { href: "/about", label: "About" },
];

export function Navbar() {
  return (
    <nav className="sticky top-0 z-20 border-b border-white/10 bg-black/40 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-accent text-black">🎤</span>
          <span className="text-lg">Battle Rap</span>
        </Link>
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
