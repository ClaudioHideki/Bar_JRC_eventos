import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getDatabaseUrl(): string {
  const rawUrl =
    process.env.DATABASE_URL ||
    process.env.DATABASE_TEST_URL ||
    "postgresql://jrc_test_user:jrc_test_password@localhost:5433/jrc_passaporte_test?schema=public";

  if (!rawUrl.includes("connection_limit")) {
    const separator = rawUrl.includes("?") ? "&" : "?";
    return `${rawUrl}${separator}connection_limit=30`;
  }
  return rawUrl;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
