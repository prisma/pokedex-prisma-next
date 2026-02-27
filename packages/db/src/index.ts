import { createPrismaClient } from "./prisma/client";
import { db, ensureDbConnected } from "./prisma/db";

const prisma = createPrismaClient();

export { db, ensureDbConnected };
export default prisma;
