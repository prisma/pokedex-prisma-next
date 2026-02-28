export function normalizeType(type: string): string {
  return type.trim().toLowerCase();
}

export function typeBadgeClass(type: string): string {
  const key = normalizeType(type);

  const classes: Record<string, string> = {
    grass: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
    poison:
      "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-300",
    fire: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
    flying: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
    water: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
    electric:
      "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    ghost:
      "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
    ice: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300",
    dragon:
      "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
    psychic: "bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-300",
  };

  return classes[key] ?? "bg-muted text-foreground";
}

export function StatLabel({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border px-2 py-1 text-center">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
