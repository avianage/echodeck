import { PrismaClient } from "@prisma/client"
import { Pool } from "pg"
// Force reload of Prisma Client
import { PrismaPg } from "@prisma/adapter-pg"

const prismaClientSingleton = () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })
    const adapter = new PrismaPg(pool)
    return new PrismaClient({ adapter })
}

declare global {
    var prisma: undefined | ReturnType<typeof prismaClientSingleton> // eslint-disable-line no-var
}

const prismaClient = globalThis.prisma ?? prismaClientSingleton()

export { prismaClient }

if (process.env.NODE_ENV !== "production") globalThis.prisma = prismaClient
