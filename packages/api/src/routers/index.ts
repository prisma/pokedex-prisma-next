import type { RouterClient } from "@orpc/server";

import { publicProcedure } from "../index";
import { pokedexRouter } from "./pokedex";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),
  pokedex: pokedexRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
