import dns from 'dns'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/app/generated/prisma/client'

dns.setDefaultResultOrder('ipv4first')

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function withSslDisabled(url: string): string {
  if (url.includes('sslmode=')) return url.replace(/sslmode=[^&?#]*/g, 'sslmode=disable')
  return url + (url.includes('?') ? '&' : '?') + 'sslmode=disable'
}

function createPrismaClient() {
  const rawUrl = process.env.POSTGRES_URL ?? ''
  const pool = new Pool({ connectionString: rawUrl, ssl: { rejectUnauthorized: false } })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter, datasourceUrl: withSslDisabled(rawUrl) })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
