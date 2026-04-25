import { PrismaClient } from "@prisma/client"

const globalForPrisma = global as unknown as { prisma: PrismaClient }

// Ensure the correct MySQL URL is used (system DATABASE_URL may point to local SQLite)
const MYSQL_URL = "mysql://u184662983_Helite:Helite%2B12@auth-db2122.hstgr.io:3306/u184662983_Helite"

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    datasources: {
      db: {
        url: process.env.DATABASE_URL?.startsWith("mysql://") ? process.env.DATABASE_URL : MYSQL_URL,
      },
    },
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
