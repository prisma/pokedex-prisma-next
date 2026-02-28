import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Swords } from "lucide-react";
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

export const Route = createFileRoute("/team-builder")({
  component: TeamBuilderRoute,
});

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

function TeamBuilderRoute() {
  const [teamType, setTeamType] = useState("");

  const teamQuery = useQuery(
    orpc.pokedex.teamBuilder.queryOptions({
      input: {
        type: teamType.trim() || undefined,
      },
    }),
  );

  const teamPicks = (teamQuery.data as TeamPick[] | undefined) ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
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
  );
}
