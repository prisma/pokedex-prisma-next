import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Database, Loader2, LocateFixed, Radar, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/pokedex")({
  component: PokedexRoute,
});

function normalizeType(type: string): string {
  return type.trim().toLowerCase();
}

function typeBadgeClass(type: string): string {
  const key = normalizeType(type);

  const classes: Record<string, string> = {
    grass: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
    poison: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-300",
    fire: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
    flying: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
    water: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
    electric: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    ghost: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
    ice: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300",
    dragon: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
    psychic: "bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-300",
  };

  return classes[key] ?? "bg-muted text-foreground";
}

function formatDistance(distanceMeters: number): string {
  if (distanceMeters >= 1000) {
    return `${(distanceMeters / 1000).toFixed(1)} km`;
  }

  return `${Math.round(distanceMeters)} m`;
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

function PokedexRoute() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [legendaryOnly, setLegendaryOnly] = useState(false);
  const [selectedDexNumber, setSelectedDexNumber] = useState<number | null>(null);

  const [latitude, setLatitude] = useState(40.758);
  const [longitude, setLongitude] = useState(-73.9855);
  const [radiusKm, setRadiusKm] = useState(400);

  const listQuery = useQuery(
    orpc.pokedex.listPokemon.queryOptions({
      input: {
        search: search.trim() || undefined,
        type: type.trim() || undefined,
        legendaryOnly,
        limit: 30,
      },
    }),
  );

  const selectedDex = selectedDexNumber ?? listQuery.data?.[0]?.dexNumber ?? null;

  const selectedPokemonQuery = useQuery({
    ...orpc.pokedex.byDexNumber.queryOptions({
      input: { dexNumber: selectedDex ?? 1 },
    }),
    enabled: selectedDex !== null,
  });

  const typeBreakdownQuery = useQuery(orpc.pokedex.typeBreakdown.queryOptions());
  const postgisStatusQuery = useQuery(orpc.pokedex.postgisStatus.queryOptions());

  const nearestSpawnsQuery = useQuery(
    orpc.pokedex.nearestSpawns.queryOptions({
      input: {
        latitude,
        longitude,
        radiusKm,
        limit: 8,
      },
    }),
  );

  const seedMutation = useMutation(
    orpc.pokedex.seedDemo.mutationOptions({
      onSuccess: () => {
        listQuery.refetch();
        selectedPokemonQuery.refetch();
        typeBreakdownQuery.refetch();
        nearestSpawnsQuery.refetch();
        postgisStatusQuery.refetch();
      },
    }),
  );

  const totalPokemon = listQuery.data?.length ?? 0;
  const totalLegendary =
    (listQuery.data as PokedexPokemon[] | undefined)?.filter((pokemon: PokedexPokemon) => pokemon.isLegendary)
      .length ?? 0;

  const topTypes = useMemo(() => {
    return (typeBreakdownQuery.data ?? []).slice(0, 5);
  }, [typeBreakdownQuery.data]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="grid gap-6">
        <Card className="border-none bg-gradient-to-r from-rose-500 to-orange-500 text-white shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Sparkles className="h-6 w-6" />
              Prisma Next Pokedex Demo
            </CardTitle>
            <CardDescription className="text-rose-50">
              High-level query interface first, plus one low-level PostGIS endpoint for spatial lookups.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => seedMutation.mutate({ forceReset: false })}
              disabled={seedMutation.isPending}
              className="bg-white text-rose-700 hover:bg-rose-50"
            >
              {seedMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Seed Demo"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => seedMutation.mutate({ forceReset: true })}
              disabled={seedMutation.isPending}
            >
              Reseed Demo Data
            </Button>
            <div className="text-sm text-rose-50">
              {seedMutation.data?.message ?? "Seed once to load starter Pokemon + spawn points."}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                High-Level Query Interface
              </CardTitle>
              <CardDescription>
                Filters and card data are served from `prisma.pokemon.findMany(...)` with includes.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-3 md:grid-cols-[2fr_1fr_auto]">
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by name or type"
                />
                <Input
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                  placeholder="Type filter (e.g. fire)"
                />
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={legendaryOnly}
                    onCheckedChange={(checked) => setLegendaryOnly(checked === true)}
                  />
                  Legendary only
                </label>
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>Total listed: {totalPokemon}</span>
                <span>Legendary listed: {totalLegendary}</span>
              </div>

              {listQuery.isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : listQuery.data && listQuery.data.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {(listQuery.data as PokedexPokemon[]).map((pokemon: PokedexPokemon) => (
                    <button
                      key={pokemon.id}
                      type="button"
                      className="rounded-lg border p-3 text-left transition hover:border-rose-400"
                      onClick={() => setSelectedDexNumber(pokemon.dexNumber)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs text-muted-foreground">#{pokemon.dexNumber}</div>
                          <div className="text-lg font-semibold">{pokemon.name}</div>
                          <div className="mt-1 flex flex-wrap gap-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeBadgeClass(
                                pokemon.primaryType,
                              )}`}
                            >
                              {pokemon.primaryType}
                            </span>
                            {pokemon.secondaryType ? (
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeBadgeClass(
                                  pokemon.secondaryType,
                                )}`}
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
              ) : (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No Pokemon yet. Click Seed Demo above.
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Selected Pokemon</CardTitle>
                <CardDescription>Includes spawn points via relation include.</CardDescription>
              </CardHeader>
              <CardContent>
                {selectedPokemonQuery.isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : selectedPokemonQuery.data ? (
                  <div className="space-y-3 text-sm">
                    <div className="font-medium">
                      #{selectedPokemonQuery.data.dexNumber} {selectedPokemonQuery.data.name}
                    </div>
                    <div>
                      Spawn points: {selectedPokemonQuery.data.spawnPoints.length}
                    </div>
                    <ul className="space-y-2 text-muted-foreground">
                      {selectedPokemonQuery.data.spawnPoints.slice(0, 3).map((spawn: SpawnPoint) => (
                        <li key={spawn.id}>
                          {spawn.label} · {spawn.region}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Pick a Pokemon card to inspect.</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Type Meta</CardTitle>
                <CardDescription>Computed from high-level reads.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {topTypes.map((row) => (
                    <li key={row.type} className="flex items-center justify-between">
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
              <LocateFixed className="h-5 w-5" />
              Low-Level Query + PostGIS
            </CardTitle>
            <CardDescription>
              Nearby spawn search uses `db.sql.raw` with `ST_DWithin` + `ST_DistanceSphere`.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-4">
              <Input
                type="number"
                step="0.0001"
                value={latitude}
                onChange={(event) => setLatitude(Number(event.target.value))}
                placeholder="Latitude"
              />
              <Input
                type="number"
                step="0.0001"
                value={longitude}
                onChange={(event) => setLongitude(Number(event.target.value))}
                placeholder="Longitude"
              />
              <Input
                type="number"
                step="1"
                min="1"
                value={radiusKm}
                onChange={(event) => setRadiusKm(Number(event.target.value))}
                placeholder="Radius km"
              />
              <Button onClick={() => nearestSpawnsQuery.refetch()} disabled={nearestSpawnsQuery.isFetching}>
                {nearestSpawnsQuery.isFetching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Radar className="mr-2 h-4 w-4" />
                    Refresh
                  </>
                )}
              </Button>
            </div>

            <div className="text-xs text-muted-foreground">
              PostGIS status: {postgisStatusQuery.data?.enabled ? "enabled" : "checking"}
            </div>
            <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
              {postgisStatusQuery.data?.version ?? "Loading PostGIS version..."}
            </div>

            {nearestSpawnsQuery.data && nearestSpawnsQuery.data.length > 0 ? (
              <div className="grid gap-2 md:grid-cols-2">
                {nearestSpawnsQuery.data.map((row) => (
                  <div key={row.id} className="rounded-md border p-3 text-sm">
                    <div className="font-medium">
                      {row.pokemonName} · #{row.dexNumber}
                    </div>
                    <div className="text-muted-foreground">
                      {row.label} ({row.region})
                    </div>
                    <div className="mt-1 text-xs">
                      {formatDistance(row.distanceMeters)} away · encounter rate {row.encounterRate}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                No nearby spawn points found for this radius.
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
