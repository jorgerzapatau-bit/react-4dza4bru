import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['query'], // Esto te permite ver las consultas SQL en la consola de VS Code
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma