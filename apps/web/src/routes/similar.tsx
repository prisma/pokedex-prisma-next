import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Search } from "lucide-react";
import { useState } from "react";

import { StatLabel, typeBadgeClass } from "@/components/pokemon-utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/similar")({
  component: SimilarRoute,
});

function SimilarRoute() {
  const [dexInput, setDexInput] = useState("");
  const dexNumber = Number.parseInt(dexInput, 10) || 0;

  const similarQuery = useQuery({
    ...orpc.pokedex.similarPokemon.queryOptions({
      input: { dexNumber },
    }),
    enabled: dexNumber > 0,
  });

  const refQuery = useQuery({
    ...orpc.pokedex.byDexNumber.queryOptions({
      input: { dexNumber },
    }),
    enabled: dexNumber > 0,
  });

  const results =
    (similarQuery.data as Array<{
      dexNumber: number;
      name: string;
      primaryType: string;
      secondaryType: string | null;
      hp: number;
      attack: number;
      defense: number;
      speed: number;
      spriteUrl: string;
      similarity: number;
    }>) ?? [];

  const ref = refQuery.data as
    | {
        dexNumber: number;
        name: string;
        primaryType: string;
        secondaryType: string | null;
        hp: number;
        attack: number;
        defense: number;
        speed: number;
        spriteUrl: string;
      }
    | undefined;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            pgvector — Similar Pokemon
          </CardTitle>
          <CardDescription>
            Uses cosineDistance() from the pgvector extension pack to find
            pokemon with similar stat profiles via the typed SQL lane.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-center gap-3">
            <Input
              value={dexInput}
              onChange={(e) => setDexInput(e.target.value)}
              placeholder="Enter Pokedex number (e.g. 25)"
              className="max-w-xs"
              type="number"
              min={1}
            />
            {(similarQuery.isFetching || refQuery.isFetching) && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
          </div>

          {ref && (
            <div className="rounded-md border bg-muted/50 p-3">
              <div className="text-xs font-medium text-muted-foreground mb-1">
                Reference Pokemon
              </div>
              <div className="flex items-center gap-3">
                <img
                  src={ref.spriteUrl}
                  alt={ref.name}
                  className="h-12 w-12"
                />
                <div>
                  <div className="font-medium">
                    {ref.name}{" "}
                    <span className="text-muted-foreground">
                      #{ref.dexNumber}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeBadgeClass(ref.primaryType)}`}
                    >
                      {ref.primaryType}
                    </span>
                    {ref.secondaryType ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeBadgeClass(ref.secondaryType)}`}
                      >
                        {ref.secondaryType}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="ml-auto grid grid-cols-4 gap-2 text-xs">
                  <StatLabel label="HP" value={ref.hp} />
                  <StatLabel label="ATK" value={ref.attack} />
                  <StatLabel label="DEF" value={ref.defense} />
                  <StatLabel label="SPD" value={ref.speed} />
                </div>
              </div>
            </div>
          )}

          {results.length > 0 ? (
            <div className="grid gap-2 md:grid-cols-3">
              {results.map((pick) => (
                <div
                  key={pick.dexNumber}
                  className="rounded-md border p-3 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <img
                      src={pick.spriteUrl}
                      alt={pick.name}
                      className="h-10 w-10"
                    />
                    <div>
                      <div className="font-medium">
                        {pick.name}{" "}
                        <span className="text-muted-foreground">
                          #{pick.dexNumber}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        similarity:{" "}
                        {(pick.similarity * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
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
                </div>
              ))}
            </div>
          ) : dexNumber > 0 && !similarQuery.isFetching ? (
            <div className="text-sm text-muted-foreground">
              No similar pokemon found. Import pokemon first, then re-seed to
              populate stat vectors.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
