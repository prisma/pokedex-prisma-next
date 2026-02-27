import { ModeToggle } from "./mode-toggle";

export default function Header() {
  return (
    <div>
      <div className="flex flex-row items-center justify-between px-4 py-2">
        <span className="text-lg font-semibold">Pokedex</span>
        <ModeToggle />
      </div>
      <hr />
    </div>
  );
}
