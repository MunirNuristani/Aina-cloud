// Runs before any test module is imported — loads .env so DATABASE_URL is
// available when lib/prisma.ts creates the pg.Pool.
import { config } from 'dotenv'

config() // reads .env from the project root
