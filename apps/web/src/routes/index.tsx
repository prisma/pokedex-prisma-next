import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Database, Loader2, Sparkles, Swords } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/")({
  component: PokedexRoute,
});

function normalizeType(type: string): string {
  return type.trim().toLowerCase();
}

function typeBadgeClass(type: string): string {
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

type SpawnPoint = {
  id: number;
  label: string;
  region: string;
  latitude: number;
  longitude: number;
  encounterRate: number;
};

type PokedexPokemon = {
  id: number;
  dexNumber: number;
  name: string;
  primaryType: string;
  secondaryType: string | null;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  spriteUrl: string;
  isLegendary: boolean;
  spawnPoints: SpawnPoint[];
};

type TeamPick = {
  dexNumber: number;
  name: string;
  primaryType: string;
  secondaryType: string | null;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  isLegendary: boolean;
  totalStats: number;
};

function PokedexRoute() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [legendaryOnly, setLegendaryOnly] = useState(false);
  const [selectedDexNumber, setSelectedDexNumber] = useState<number | null>(
    null,
  );
  const [teamType, setTeamType] = useState("");

  const listQuery = useQuery(
    orpc.pokedex.listPokemon.queryOptions({
      input: {
        search: search.trim() || undefined,
        type: type.trim() || undefined,
        legendaryOnly,
        limit: 1200,
      },
    }),
  );

  const listPokemon =
    (listQuery.data as unknown as PokedexPokemon[] | undefined) ?? [];
  const selectedDex = selectedDexNumber ?? listPokemon[0]?.dexNumber ?? null;

  const selectedPokemonQuery = useQuery({
    ...orpc.pokedex.byDexNumber.queryOptions({
      input: { dexNumber: selectedDex ?? 1 },
    }),
    enabled: selectedDex !== null,
  });

  const typeBreakdownQuery = useQuery(
    orpc.pokedex.typeBreakdown.queryOptions(),
  );

  const teamQuery = useQuery(
    orpc.pokedex.teamBuilder.queryOptions({
      input: {
        type: teamType.trim() || undefined,
      },
    }),
  );

  const seedMutation = useMutation(
    orpc.pokedex.importPokemon.mutationOptions({
      onSuccess: () => {
        listQuery.refetch();
        selectedPokemonQuery.refetch();
        typeBreakdownQuery.refetch();
        teamQuery.refetch();
      },
    }),
  );

  const selectedPokemon = selectedPokemonQuery.data as
    | (PokedexPokemon & { spawnPoints?: SpawnPoint[] })
    | undefined;
  const selectedSpawnPoints = Array.isArray(selectedPokemon?.spawnPoints)
    ? selectedPokemon.spawnPoints
    : [];

  const topTypes = useMemo(() => {
    return (typeBreakdownQuery.data ?? []).slice(0, 5);
  }, [typeBreakdownQuery.data]);

  const teamPicks = (teamQuery.data as TeamPick[] | undefined) ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="grid gap-6">
        <Card className="border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Sparkles className="h-6 w-6" />
              Prisma Next Pokedex
            </CardTitle>
            <CardDescription>
              High-level ORM queries + low-level Kysely DSL, powered by Prisma Next.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => seedMutation.mutate({ forceReset: false })}
              disabled={seedMutation.isPending}
            >
              {seedMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Import Pokemon"
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => seedMutation.mutate({ forceReset: true })}
              disabled={seedMutation.isPending}
            >
              Reimport
            </Button>
            <span className="text-sm text-muted-foreground">
              {seedMutation.data?.message ??
                "Import from PokeAPI to load the dataset."}
            </span>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                High-Level Queries
              </CardTitle>
              <CardDescription>
                Uses pokemon.where().include().all() with filters and relation lookups.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-3 md:grid-cols-[2fr_1fr_auto]">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or type"
                />
                <Input
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  placeholder="Type filter"
                />
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={legendaryOnly}
                    onCheckedChange={(v) => setLegendaryOnly(v === true)}
                  />
                  Legendary
                </label>
              </div>

              {listQuery.isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : listPokemon.length > 0 ? (
                <div className="max-h-[600px] overflow-y-auto rounded-md border p-2">
                <div className="grid gap-3 md:grid-cols-2">
                  {listPokemon.map((pokemon) => (
                    <button
                      key={pokemon.id}
                      type="button"
                      className="rounded-lg border p-3 text-left transition hover:border-rose-400"
                      onClick={() => setSelectedDexNumber(pokemon.dexNumber)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs text-muted-foreground">
                            #{pokemon.dexNumber}
                          </div>
                          <div className="text-lg font-semibold">
                            {pokemon.name}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeBadgeClass(pokemon.primaryType)}`}
                            >
                              {pokemon.primaryType}
                            </span>
                            {pokemon.secondaryType ? (
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeBadgeClass(pokemon.secondaryType)}`}
                              >
                                {pokemon.secondaryType}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <img
                          src={pokemon.spriteUrl}
                          alt={pokemon.name}
                          className="h-16 w-16 object-contain"
                          loading="lazy"
                        />
                      </div>
                      <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
                        <StatLabel label="HP" value={pokemon.hp} />
                        <StatLabel label="ATK" value={pokemon.attack} />
                        <StatLabel label="DEF" value={pokemon.defense} />
                        <StatLabel label="SPD" value={pokemon.speed} />
                      </div>
                    </button>
                  ))}
                </div>
                </div>
              ) : (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No Pokemon yet. Click Import Pokemon above.
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Selected Pokemon</CardTitle>
                <CardDescription>
                  Via .where().include("spawnPoints").find() relation lookup.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedPokemonQuery.isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : selectedPokemon ? (
                  <div className="space-y-3 text-sm">
                    <div className="font-medium">
                      #{selectedPokemon.dexNumber} {selectedPokemon.name}
                    </div>
                    <div>Spawn points: {selectedSpawnPoints.length}</div>
                    <ul className="space-y-2 text-muted-foreground">
                      {selectedSpawnPoints
                        .slice(0, 3)
                        .map((spawn: SpawnPoint) => (
                          <li key={spawn.id}>
                            {spawn.label} · {spawn.region}
                          </li>
                        ))}
                    </ul>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Pick a Pokemon card to inspect.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Type Breakdown</CardTitle>
                <CardDescription>
                  Aggregated from high-level reads.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {topTypes.map((row) => (
                    <li
                      key={row.type}
                      className="flex items-center justify-between"
                    >
                      <span>{row.type}</span>
                      <span className="text-muted-foreground">
                        {row.total} total · {row.legendary} legendary
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Swords className="h-5 w-5" />
              Low-Level Query — Team Builder
            </CardTitle>
            <CardDescription>
              Uses Kysely DSL via db.kysely() to pick the top 6 strongest
              Pokemon across types.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex items-center gap-3">
              <Input
                value={teamType}
                onChange={(e) => setTeamType(e.target.value)}
                placeholder="Filter by type (optional)"
                className="max-w-xs"
              />
              {teamQuery.isFetching && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
            </div>

            {teamPicks.length > 0 ? (
              <div className="grid gap-2 md:grid-cols-3">
                {teamPicks.map((pick) => (
                  <div
                    key={pick.dexNumber}
                    className="rounded-md border p-3 text-sm"
                  >
                    <div className="font-medium">
                      {pick.name}{" "}
                      <span className="text-muted-foreground">
                        #{pick.dexNumber}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeBadgeClass(pick.primaryType)}`}
                      >
                        {pick.primaryType}
                      </span>
                      {pick.secondaryType ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeBadgeClass(pick.secondaryType)}`}
                        >
                          {pick.secondaryType}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
                      <StatLabel label="HP" value={pick.hp} />
                      <StatLabel label="ATK" value={pick.attack} />
                      <StatLabel label="DEF" value={pick.defense} />
                      <StatLabel label="SPD" value={pick.speed} />
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground text-right">
                      total: {pick.totalStats}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                No results. Import Pokemon first.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatLabel({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border px-2 py-1 text-center">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
