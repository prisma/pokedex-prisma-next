import { Link } from "@tanstack/react-router";

import { ModeToggle } from "./mode-toggle";

export default function Header() {
  return (
    <div>
      <div className="flex flex-row items-center justify-between px-4 py-2">
        <nav className="flex items-center gap-4">
          <Link
            to="/"
            className="text-lg font-semibold text-muted-foreground [&.active]:text-foreground"
          >
            Pokedex
          </Link>
          <Link
            to="/team-builder"
            className="text-lg font-semibold text-muted-foreground [&.active]:text-foreground"
          >
            Team Builder
          </Link>
          <Link
            to="/similar"
            className="text-lg font-semibold text-muted-foreground [&.active]:text-foreground"
          >
            Similar
          </Link>
        </nav>
        <ModeToggle />
      </div>
      <hr />
    </div>
  );
}
