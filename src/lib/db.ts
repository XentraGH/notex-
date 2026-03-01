import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

export const db = prisma

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
