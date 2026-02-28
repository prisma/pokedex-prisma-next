import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Database, Loader2, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { StatLabel, typeBadgeClass } from "@/components/pokemon-utils";
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

function PokedexRoute() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [legendaryOnly, setLegendaryOnly] = useState(false);
  const [selectedDexNumber, setSelectedDexNumber] = useState<number | null>(
    null,
  );
  const [delayMs, setDelayMs] = useState(5);

  const listQuery = useQuery(
    orpc.pokedex.listPokemon.experimental_streamedOptions({
      input: {
        search: search.trim() || undefined,
        type: type.trim() || undefined,
        legendaryOnly,
        limit: 1200,
        delayMs,
      },
    }),
  );

  const listPokemon = listQuery.data ?? [];
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

  const seedMutation = useMutation(
    orpc.pokedex.importPokemon.mutationOptions({
      onSuccess: () => {
        listQuery.refetch();
        selectedPokemonQuery.refetch();
        typeBreakdownQuery.refetch();
      },
    }),
  );

  const selectedPokemon = selectedPokemonQuery.data;
  const selectedSpawnPoints = selectedPokemon?.spawnPoints ?? [];

  const topTypes = useMemo(() => {
    return (typeBreakdownQuery.data ?? []).slice(0, 5);
  }, [typeBreakdownQuery.data]);

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
              High-level ORM queries + low-level Kysely DSL, powered by Prisma
              Next.
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
          <div className="grid gap-6">
            <div className="sticky top-0 z-10 bg-background pb-3">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    High-Level Queries
                  </CardTitle>
                  <CardDescription>
                    Uses pokemon.where().include().all() with filters and
                    relation lookups.
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
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-muted-foreground whitespace-nowrap">
                      Stream delay: {delayMs}ms
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={delayMs}
                      onChange={(e) => setDelayMs(Number(e.target.value))}
                      className="w-40"
                    />
                  </div>

                  {listQuery.isFetching && listPokemon.length > 0 && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Streaming... {listPokemon.length} pokemon loaded
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {listQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : listPokemon.length > 0 ? (
              <div className="rounded-md border p-2">
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
          </div>

          <div className="grid gap-6 self-start sticky top-0">
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
                        .map((spawn) => (
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
                  Via groupBy().aggregate() ORM queries.
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
      </div>
    </div>
  );
}
